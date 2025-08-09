// src/services/driverService.ts
import { PrismaClient, DriverStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { 
  CreateDriverRequest, 
  UpdateDriverRequest, 
  DriverStatusUpdate,
  DriverLocationUpdate,
  DriverResponse, 
  DriverListQuery,
  DriverStatsResponse,
  NearbyDriversQuery,
  DriverPerformanceResponse
} from '@/types/driver';
import { AppError } from '@/middleware/errorHandler';

const prisma = new PrismaClient();

export class DriverService {
  /**
   * Create a new driver
   */
  async createDriver(data: CreateDriverRequest, requestUserRole: string): Promise<DriverResponse> {
    try {
      // Only admins can create drivers
      if (requestUserRole !== UserRole.ADMIN) {
        const error: AppError = new Error('Only administrators can create drivers');
        error.statusCode = 403;
        throw error;
      }

      // Check if driver license already exists
      const existingDriver = await prisma.driver.findFirst({
        where: { driverLicense: data.driverLicense }
      });

      if (existingDriver) {
        const error: AppError = new Error('Driver with this license already exists');
        error.statusCode = 400;
        throw error;
      }

      let userId = data.userId;

      // If userId not provided, create new user
      if (!userId && data.email && data.password && data.fullName) {
        // Check if user email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: data.email.toLowerCase() }
        });

        if (existingUser) {
          const error: AppError = new Error('User with this email already exists');
          error.statusCode = 400;
          throw error;
        }

        // Create new user
        const hashedPassword = await bcrypt.hash(data.password, 12);
        const newUser = await prisma.user.create({
          data: {
            email: data.email.toLowerCase(),
            passwordHash: hashedPassword,
            fullName: data.fullName,
            phone: data.phone,
            role: UserRole.DRIVER,
            isActive: true,
            emailVerified: true
          }
        });

        userId = newUser.id;
      }

      if (!userId) {
        const error: AppError = new Error('User ID is required or provide user details to create new user');
        error.statusCode = 400;
        throw error;
      }

      // Verify user exists and is not already a driver
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { driver: true }
      });

      if (!user) {
        const error: AppError = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      if (user.driver) {
        const error: AppError = new Error('User is already registered as a driver');
        error.statusCode = 400;
        throw error;
      }

      // Verify truck exists if provided
      if (data.truckId) {
        const truck = await prisma.truck.findUnique({
          where: { id: data.truckId }
        });

        if (!truck) {
          const error: AppError = new Error('Truck not found');
          error.statusCode = 404;
          throw error;
        }
      }

      // Create driver
      const driver = await prisma.driver.create({
        data: {
          userId,
          driverLicense: data.driverLicense,
          truckId: data.truckId,
          shiftStart: data.shiftStart,
          shiftEnd: data.shiftEnd,
          status: DriverStatus.OFFLINE,
          isAvailable: true
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              isActive: true
            }
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              model: true,
              capacity: true
            }
          },
          _count: {
            select: {
              routes: true,
              pickups: true
            }
          }
        }
      });

      return this.formatDriverResponse(driver);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all drivers with filtering and pagination
   */
  async getDrivers(query: DriverListQuery, requestUserRole: string) {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};

      if (query.status) {
        whereClause.status = query.status;
      }

      if (query.isAvailable !== undefined) {
        whereClause.isAvailable = query.isAvailable;
      }

      if (query.truckId) {
        whereClause.truckId = query.truckId;
      }

      if (query.search) {
        whereClause.OR = [
          {
            user: {
              fullName: {
                contains: query.search,
                mode: 'insensitive'
              }
            }
          },
          {
            driverLicense: {
              contains: query.search,
              mode: 'insensitive'
            }
          }
        ];
      }

      const [drivers, totalCount] = await Promise.all([
        prisma.driver.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                isActive: true
              }
            },
            truck: {
              select: {
                id: true,
                licensePlate: true,
                model: true,
                capacity: true
              }
            },
            _count: {
              select: {
                routes: true,
                pickups: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.driver.count({ where: whereClause })
      ]);

      const formattedDrivers = drivers.map(driver => this.formatDriverResponse(driver));

      return {
        success: true,
        data: formattedDrivers,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get driver by ID
   */
  async getDriverById(driverId: string, requestUserRole: string, requestUserId: string): Promise<DriverResponse> {
    try {
      const whereClause: any = { id: driverId };

      // Drivers can only see their own profile unless they're admin
      if (requestUserRole === UserRole.DRIVER) {
        whereClause.userId = requestUserId;
      }

      const driver = await prisma.driver.findFirst({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              isActive: true
            }
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              model: true,
              capacity: true
            }
          },
          _count: {
            select: {
              routes: true,
              pickups: true
            }
          }
        }
      });

      if (!driver) {
        const error: AppError = new Error('Driver not found or access denied');
        error.statusCode = 404;
        throw error;
      }

      return this.formatDriverResponse(driver);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update driver
   */
  async updateDriver(
    driverId: string, 
    data: UpdateDriverRequest, 
    requestUserRole: string, 
    requestUserId: string
  ): Promise<DriverResponse> {
    try {
      // Check if driver exists and user has permission
      const existingDriver = await this.getDriverById(driverId, requestUserRole, requestUserId);

      // Verify truck exists if being updated
      if (data.truckId) {
        const truck = await prisma.truck.findUnique({
          where: { id: data.truckId }
        });

        if (!truck) {
          const error: AppError = new Error('Truck not found');
          error.statusCode = 404;
          throw error;
        }
      }

      const updatedDriver = await prisma.driver.update({
        where: { id: driverId },
        data: {
          ...(data.driverLicense && { driverLicense: data.driverLicense }),
          ...(data.truckId !== undefined && { truckId: data.truckId }),
          ...(data.shiftStart && { shiftStart: data.shiftStart }),
          ...(data.shiftEnd && { shiftEnd: data.shiftEnd }),
          ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable })
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              isActive: true
            }
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              model: true,
              capacity: true
            }
          },
          _count: {
            select: {
              routes: true,
              pickups: true
            }
          }
        }
      });

      return this.formatDriverResponse(updatedDriver);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update driver status
   */
  async updateDriverStatus(
    driverId: string, 
    statusData: DriverStatusUpdate, 
    requestUserRole: string, 
    requestUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if driver exists and user has permission
      await this.getDriverById(driverId, requestUserRole, requestUserId);

      await prisma.driver.update({
        where: { id: driverId },
        data: {
          status: statusData.status,
          ...(statusData.currentLatitude && { currentLatitude: statusData.currentLatitude }),
          ...(statusData.currentLongitude && { currentLongitude: statusData.currentLongitude })
        }
      });

      return {
        success: true,
        message: 'Driver status updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(
    driverId: string, 
    locationData: DriverLocationUpdate, 
    requestUserRole: string, 
    requestUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if driver exists and user has permission
      await this.getDriverById(driverId, requestUserRole, requestUserId);

      await prisma.driver.update({
        where: { id: driverId },
        data: {
          currentLatitude: locationData.latitude,
          currentLongitude: locationData.longitude
        }
      });

      return {
        success: true,
        message: 'Driver location updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get available drivers
   */
  async getAvailableDrivers(limit?: number) {
    try {
      const drivers = await prisma.driver.findMany({
        where: {
          status: DriverStatus.ONLINE,
          isAvailable: true,
          user: {
            isActive: true
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              isActive: true
            }
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              model: true,
              capacity: true
            }
          }
        },
        take: limit || 50,
        orderBy: { updatedAt: 'desc' }
      });

      return {
        success: true,
        data: drivers.map(driver => this.formatDriverResponse(driver))
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get nearby drivers
   */
  async getNearbyDrivers(query: NearbyDriversQuery) {
    try {
      const radius = query.radius || 10; // Default 10km
      const limit = query.limit || 20;

      let whereClause: any = {
        isAvailable: true,
        user: { isActive: true },
        currentLatitude: { not: null },
        currentLongitude: { not: null }
      };

      if (query.status) {
        whereClause.status = query.status;
      } else {
        whereClause.status = DriverStatus.ONLINE; // Default to online drivers
      }

      // Parse latitude and longitude as numbers to avoid string concatenation errors
      const latitude = typeof query.latitude === 'string' ? parseFloat(query.latitude) : query.latitude;
      const longitude = typeof query.longitude === 'string' ? parseFloat(query.longitude) : query.longitude;

      // Simple distance calculation (for more accurate results, use PostGIS)
      whereClause.currentLatitude = {
        gte: latitude - (radius / 111),
        lte: latitude + (radius / 111)
      };
      whereClause.currentLongitude = {
        gte: longitude - (radius / (111 * Math.cos(latitude * Math.PI / 180))),
        lte: longitude + (radius / (111 * Math.cos(latitude * Math.PI / 180)))
      };


      const drivers = await prisma.driver.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              isActive: true
            }
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              model: true,
              capacity: true
            }
          }
        },
        take: limit
      });

      // Calculate actual distances and sort
      const driversWithDistance = drivers
        .filter(driver => driver.currentLatitude && driver.currentLongitude)
        .map(driver => {
          const distance = this.calculateDistance(
            query.latitude,
            query.longitude,
            Number(driver.currentLatitude),
            Number(driver.currentLongitude)
          );
          return {
            ...this.formatDriverResponse(driver),
            distance: Math.round(distance * 100) / 100
          };
        })
        .filter(driver => driver.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      return {
        success: true,
        data: driversWithDistance
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get driver statistics
   */
  async getDriverStats(): Promise<DriverStatsResponse> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());

      const [total, statusCounts, totalPickupsToday, totalPickupsThisWeek] = await Promise.all([
        prisma.driver.count(),
        prisma.driver.groupBy({
          by: ['status'],
          _count: true
        }),
        prisma.pickup.count({
          where: {
            createdAt: { gte: today },
            status: 'COMPLETED'
          }
        }),
        prisma.pickup.count({
          where: {
            createdAt: { gte: thisWeekStart },
            status: 'COMPLETED'
          }
        })
      ]);

      const available = await prisma.driver.count({
        where: {
          status: DriverStatus.ONLINE,
          isAvailable: true
        }
      });

      const stats: DriverStatsResponse = {
        total,
        online: 0,
        offline: 0,
        busy: 0,
        onBreak: 0,
        available,
        totalPickupsToday,
        totalPickupsThisWeek,
        averagePickupsPerDriver: total > 0 ? Math.round((totalPickupsThisWeek / total) * 100) / 100 : 0
      };

      statusCounts.forEach(item => {
        switch (item.status) {
          case DriverStatus.ONLINE:
            stats.online = item._count;
            break;
          case DriverStatus.OFFLINE:
            stats.offline = item._count;
            break;
          case DriverStatus.BUSY:
            stats.busy = item._count;
            break;
          case DriverStatus.ON_BREAK:
            stats.onBreak = item._count;
            break;
        }
      });

      return stats;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get driver performance
   */
  async getDriverPerformance(driverId: string): Promise<DriverPerformanceResponse> {
    try {
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        include: {
          pickups: {
            select: {
              status: true,
              createdAt: true,
              startedAt: true,
              completedAt: true
            }
          },
          routes: {
            select: {
              totalDistance: true,
              estimatedDuration: true,
              completedAt: true
            }
          }
        }
      });

      if (!driver) {
        const error: AppError = new Error('Driver not found');
        error.statusCode = 404;
        throw error;
      }

      const totalPickups = driver.pickups.length;
      const completedPickups = driver.pickups.filter(p => p.status === 'COMPLETED').length;
      const cancelledPickups = driver.pickups.filter(p => p.status === 'CANCELLED').length;

      // Calculate average time per pickup
      const completedPickupsWithTime = driver.pickups.filter(
        p => p.status === 'COMPLETED' && p.startedAt && p.completedAt
      );

      let averageTimePerPickup = 0;
      if (completedPickupsWithTime.length > 0) {
        const totalTime = completedPickupsWithTime.reduce((sum, pickup) => {
          const duration = (pickup.completedAt!.getTime() - pickup.startedAt!.getTime()) / (1000 * 60);
          return sum + duration;
        }, 0);
        averageTimePerPickup = Math.round((totalTime / completedPickupsWithTime.length) * 100) / 100;
      }

      // Calculate total distance
      const totalDistance = driver.routes.reduce((sum, route) => {
        return sum + (route.totalDistance ? Number(route.totalDistance) : 0);
      }, 0);

      // Simple performance rating calculation
      const completionRate = totalPickups > 0 ? (completedPickups / totalPickups) * 100 : 0;
      const rating = Math.min(5, Math.max(1, (completionRate / 20))); // Scale to 1-5

      return {
        driverId: driver.id,
        totalPickups,
        completedPickups,
        cancelledPickups,
        averageTimePerPickup,
        totalDistance: Math.round(totalDistance * 100) / 100,
        fuelEfficiency: 0, // TODO: Implement fuel tracking
        rating: Math.round(rating * 100) / 100,
        lastActiveDate: driver.updatedAt
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete driver
   */
  async deleteDriver(driverId: string, requestUserRole: string): Promise<{ success: boolean; message: string }> {
    try {
      // Only admins can delete drivers
      if (requestUserRole !== UserRole.ADMIN) {
        const error: AppError = new Error('Only administrators can delete drivers');
        error.statusCode = 403;
        throw error;
      }

      const driver = await prisma.driver.findUnique({
        where: { id: driverId }
      });

      if (!driver) {
        const error: AppError = new Error('Driver not found');
        error.statusCode = 404;
        throw error;
      }

      await prisma.driver.delete({
        where: { id: driverId }
      });

      return {
        success: true,
        message: 'Driver deleted successfully'
      };
    } catch (error) {
      throw error;
    }
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
   * Format driver response
   */
  public formatDriverResponse(driver: any): DriverResponse {
    return {
      id: driver.id,
      driverLicense: driver.driverLicense,
      status: driver.status,
      currentLatitude: driver.currentLatitude ? Number(driver.currentLatitude) : undefined,
      currentLongitude: driver.currentLongitude ? Number(driver.currentLongitude) : undefined,
      shiftStart: driver.shiftStart,
      shiftEnd: driver.shiftEnd,
      isAvailable: driver.isAvailable,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      user: driver.user,
      truck: driver.truck,
      _count: driver._count
    };
  }
}