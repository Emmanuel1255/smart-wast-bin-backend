// src/services/routeOptimizationService.ts
import { PickupStatus, PrismaClient } from '@prisma/client';
import { PickupRouteOptimization, OptimizedRoute } from '../types/pickup';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class RouteOptimizationService {
  /**
   * Optimize route for multiple pickups using nearest neighbor algorithm
   */
  async optimizePickupRoute(data: PickupRouteOptimization): Promise<OptimizedRoute> {
    try {
      // Verify driver exists
      const driver = await prisma.driver.findUnique({
        where: { id: data.driverId },
        include: {
          user: { select: { fullName: true } }
        }
      });

      if (!driver) {
        const error: AppError = new Error('Driver not found');
        error.statusCode = 404;
        throw error;
      }

      // Get pickup details
      const pickups = await prisma.pickup.findMany({
        where: {
          id: { in: data.pickupIds },
          status: 'SCHEDULED'
        },
        include: {
          bin: {
            select: {
              id: true,
              binCode: true,
              location: true,
              latitude: true,
              longitude: true
            }
          }
        }
      });

      if (pickups.length === 0) {
        const error: AppError = new Error('No valid pickups found for optimization');
        error.statusCode = 400;
        throw error;
      }

      // Use driver's current location or provided start location
      const startLocation = data.startLocation || {
        latitude: driver.currentLatitude ? Number(driver.currentLatitude) : 8.4840,
        longitude: driver.currentLongitude ? Number(driver.currentLongitude) : -13.2299
      };

      // Integrate Google Maps Directions API for route optimization
      const { GoogleMapsService } = await import('./googleMapsService');
      const googleMapsService = new GoogleMapsService();

      // Prepare waypoints
      const waypoints = pickups.map((pickup: any) => ({
        latitude: Number(pickup.bin.latitude),
        longitude: Number(pickup.bin.longitude)
      }));

      let routeResponse;
      let optimizedPickups;
      let totalDistance = 0;
      let estimatedDuration = 0;
      let useGoogleMaps = true;

      try {
        // Use Google Maps for route optimization
        if (waypoints.length > 1) {
          routeResponse = await googleMapsService.getRoute({
            origin: startLocation,
            destination: waypoints[waypoints.length - 1],
            waypoints: waypoints.slice(0, -1)
          });

          // Google returns the optimized waypoint order if optimize:true is used
          // Map the order back to pickups
          const optimizedOrder = routeResponse.steps?.map((step: any, idx: number) => idx) || waypoints.map((_: any, idx: number) => idx);
          optimizedPickups = optimizedOrder.map((i: number) => ({
            pickupId: pickups[i].id,
            bin: pickups[i].bin,
            latitude: Number(pickups[i].bin.latitude),
            longitude: Number(pickups[i].bin.longitude)
          }));

          totalDistance = routeResponse.distance;
          estimatedDuration = Math.round(routeResponse.duration / 60 + pickups.length * 5); // duration in min + 5 min per stop
        } else {
          // Only one pickup, no optimization needed
          optimizedPickups = pickups.map((pickup: any) => ({
            pickupId: pickup.id,
            bin: pickup.bin,
            latitude: Number(pickup.bin.latitude),
            longitude: Number(pickup.bin.longitude)
          }));
          // Use Haversine as backup for single
          totalDistance = googleMapsService.calculateHaversineDistance(startLocation, waypoints[0]);
          estimatedDuration = Math.round((totalDistance / 30) * 60 + 5); // 30 km/h + 5 min
        }
      } catch (err) {
        // Fallback to nearest neighbor if Google Maps fails
        useGoogleMaps = false;
        optimizedPickups = this.nearestNeighborOptimization(
          startLocation,
          pickups.map((pickup: any) => ({
            pickupId: pickup.id,
            bin: pickup.bin,
            latitude: Number(pickup.bin.latitude),
            longitude: Number(pickup.bin.longitude)
          }))
        );
        // Calculate total distance and estimated duration
        totalDistance = 0;
        let currentLocation = startLocation;
        for (const pickup of optimizedPickups) {
          const distance = this.calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            pickup.latitude,
            pickup.longitude
          );
          totalDistance += distance;
          currentLocation = { latitude: pickup.latitude, longitude: pickup.longitude };
        }
        const travelTimeMinutes = (totalDistance / 30) * 60;
        const pickupTimeMinutes = optimizedPickups.length * 5;
        estimatedDuration = Math.round(travelTimeMinutes + pickupTimeMinutes);
      }

      // Create route record
      const route = await prisma.route.create({
        data: {
          driverId: data.driverId,
          routeName: `Route ${new Date().toLocaleDateString()} - ${driver.user.fullName}`,
          totalDistance: totalDistance,
          estimatedDuration,
          status: 'PLANNED'
        }
      });

      // Create route stops
      const routeStops = [];
      let currentTime = new Date();

      for (let i = 0; i < optimizedPickups.length; i++) {
        const pickup = optimizedPickups[i];
        
        // Calculate estimated arrival time
        if (i > 0) {
          const segmentDistance = this.calculateDistance(
            optimizedPickups[i-1].latitude,
            optimizedPickups[i-1].longitude,
            pickup.latitude,
            pickup.longitude
          );
          const travelTime = (segmentDistance / 30) * 60; // minutes
          currentTime = new Date(currentTime.getTime() + (travelTime + 5) * 60 * 1000);
        }

        const routeStop = await prisma.routeStop.create({
          data: {
            routeId: route.id,
            binId: pickup.bin.id,
            stopOrder: i + 1,
            estimatedArrival: currentTime,
            status: PickupStatus.SCHEDULED
          }
        });

        routeStops.push({
          pickupId: pickup.pickupId,
          order: i + 1,
          estimatedArrival: currentTime,
          bin: pickup.bin
        });
      }

      // Update pickups with route assignment
      await prisma.pickup.updateMany({
        where: {
          id: { in: data.pickupIds }
        },
        data: {
          driverId: data.driverId
        }
      });

      return {
        routeId: route.id,
        driverId: data.driverId,
        totalDistance: Math.round(totalDistance * 100) / 100,
        estimatedDuration,
        pickups: routeStops
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get optimized route for driver's assigned pickups
   */
  async getDriverOptimizedRoute(driverId: string) {
    try {
      // Get scheduled pickups for driver
      const pickups = await prisma.pickup.findMany({
        where: {
          driverId,
          status: 'SCHEDULED'
        },
        include: {
          bin: {
            select: {
              id: true,
              binCode: true,
              location: true,
              latitude: true,
              longitude: true
            }
          }
        },
        orderBy: {
          priority: 'desc'
        }
      });

      if (pickups.length === 0) {
        return {
          success: true,
          data: {
            routeId: null,
            pickups: [],
            totalDistance: 0,
            estimatedDuration: 0
          }
        };
      }

      // Optimize route
      const optimizedRoute = await this.optimizePickupRoute({
        driverId,
        pickupIds: pickups.map(p => p.id)
      });

      return {
        success: true,
        data: optimizedRoute
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Nearest neighbor algorithm for route optimization
   */
  private nearestNeighborOptimization(
    startLocation: { latitude: number; longitude: number },
    pickups: Array<{
      pickupId: string;
      bin: any;
      latitude: number;
      longitude: number;
    }>
  ) {
    const optimized = [];
    const remaining = [...pickups];
    let currentLocation = startLocation;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        remaining[0].latitude,
        remaining[0].longitude
      );

      // Find nearest pickup
      for (let i = 1; i < remaining.length; i++) {
        const distance = this.calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          remaining[i].latitude,
          remaining[i].longitude
        );

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = i;
        }
      }

      // Add nearest pickup to optimized route
      const nearestPickup = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearestPickup);
      currentLocation = { 
        latitude: nearestPickup.latitude, 
        longitude: nearestPickup.longitude 
      };
    }

    return optimized;
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * Update route progress
   */
  async updateRouteProgress(routeId: string, stopId: string, status: PickupStatus) {
    try {
      await prisma.routeStop.update({
        where: { id: stopId },
        data: {
          status,
          ...(status === PickupStatus.COMPLETED && { actualArrival: new Date() })
        }
      });

      // Check if all stops are completed
      const route = await prisma.route.findUnique({
        where: { id: routeId },
        include: {
          stops: true
        }
      });

      if (route && route.stops.every(stop => stop.status === PickupStatus.COMPLETED)) {
        await prisma.route.update({
          where: { id: routeId },
          data: {
            status: PickupStatus.COMPLETED,
            completedAt: new Date()
          }
        });
      }

      return {
        success: true,
        message: 'Route progress updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }
}