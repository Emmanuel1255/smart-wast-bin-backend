// src/services/driverAnalyticsService.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DriverAnalyticsService {
  /**
   * Get comprehensive driver performance report
   */
  async getDriverPerformanceReport(driverId: string, startDate?: Date, endDate?: Date) {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const end = endDate || new Date();

      const [driver, pickups, routes, sensorData] = await Promise.all([
        // Driver basic info
        prisma.driver.findUnique({
          where: { id: driverId },
          include: {
            user: { select: { fullName: true, email: true } },
            truck: { select: { licensePlate: true, model: true } }
          }
        }),
        
        // Pickup performance
        prisma.pickup.findMany({
          where: {
            driverId,
            createdAt: { gte: start, lte: end }
          },
          select: {
            status: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            bin: {
              select: {
                location: true,
                latitude: true,
                longitude: true
              }
            }
          }
        }),

        // Route performance
        prisma.route.findMany({
          where: {
            driverId,
            createdAt: { gte: start, lte: end }
          },
          select: {
            status: true,
            totalDistance: true,
            estimatedDuration: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            stops: {
              select: {
                status: true,
                estimatedArrival: true,
                actualArrival: true
              }
            }
          }
        }),

        // Recent bin sensor data for bins this driver has collected
        prisma.binSensorData.findMany({
          where: {
            bin: {
              pickups: {
                some: {
                  driverId,
                  completedAt: { gte: start, lte: end }
                }
              }
            },
            timestamp: { gte: start, lte: end }
          },
          select: {
            fillLevel: true,
            timestamp: true,
            bin: {
              select: {
                binCode: true,
                location: true
              }
            }
          }
        })
      ]);

      if (!driver) {
        throw new Error('Driver not found');
      }

      // Calculate metrics
      const metrics = this.calculatePerformanceMetrics(pickups, routes);
      const efficiency = this.calculateEfficiencyMetrics(routes, sensorData);
      const trends = this.calculateTrends(pickups, routes);

      return {
        success: true,
        data: {
          driver: {
            id: driver.id,
            name: driver.user.fullName,
            email: driver.user.email,
            truck: driver.truck,
            period: { start, end }
          },
          metrics,
          efficiency,
          trends,
          rawData: {
            pickupsCount: pickups.length,
            routesCount: routes.length,
            dataPoints: sensorData.length
          }
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate basic performance metrics
   */
  private calculatePerformanceMetrics(pickups: any[], routes: any[]) {
    const totalPickups = pickups.length;
    const completedPickups = pickups.filter(p => p.status === 'COMPLETED').length;
    const cancelledPickups = pickups.filter(p => p.status === 'CANCELLED').length;
    
    const totalRoutes = routes.length;
    const completedRoutes = routes.filter(r => r.status === 'COMPLETED').length;

    // Calculate average pickup time
    const completedPickupsWithTime = pickups.filter(
      p => p.status === 'COMPLETED' && p.startedAt && p.completedAt
    );

    let averagePickupTime = 0;
    if (completedPickupsWithTime.length > 0) {
      const totalTime = completedPickupsWithTime.reduce((sum, pickup) => {
        return sum + (pickup.completedAt.getTime() - pickup.startedAt.getTime());
      }, 0);
      averagePickupTime = totalTime / completedPickupsWithTime.length / (1000 * 60); // in minutes
    }

    // Calculate total distance
    const totalDistance = routes.reduce((sum, route) => {
      return sum + (route.totalDistance ? Number(route.totalDistance) : 0);
    }, 0);

    return {
      totalPickups,
      completedPickups,
      cancelledPickups,
      pickupCompletionRate: totalPickups > 0 ? (completedPickups / totalPickups) * 100 : 0,
      totalRoutes,
      completedRoutes,
      routeCompletionRate: totalRoutes > 0 ? (completedRoutes / totalRoutes) * 100 : 0,
      averagePickupTime: Math.round(averagePickupTime * 100) / 100,
      totalDistance: Math.round(totalDistance * 100) / 100,
      averageDistancePerRoute: totalRoutes > 0 ? Math.round((totalDistance / totalRoutes) * 100) / 100 : 0
    };
  }

  /**
   * Calculate efficiency metrics
   */
  private calculateEfficiencyMetrics(routes: any[], sensorData: any[]) {
    // Route efficiency
    const routesWithTiming = routes.filter(r => r.estimatedDuration && r.startedAt && r.completedAt);
    
    let routeEfficiency = 0;
    if (routesWithTiming.length > 0) {
      const efficiencySum = routesWithTiming.reduce((sum, route) => {
        const actualDuration = (route.completedAt.getTime() - route.startedAt.getTime()) / (1000 * 60);
        const efficiency = (route.estimatedDuration / actualDuration) * 100;
        return sum + Math.min(efficiency, 200); // Cap at 200% efficiency
      }, 0);
      routeEfficiency = efficiencySum / routesWithTiming.length;
    }

    // Bin optimization (how full bins were when collected)
    const averageBinFillLevel = sensorData.length > 0 
      ? sensorData.reduce((sum, data) => sum + data.fillLevel, 0) / sensorData.length
      : 0;

    return {
      routeEfficiency: Math.round(routeEfficiency * 100) / 100,
      averageBinFillLevel: Math.round(averageBinFillLevel * 100) / 100,
      binOptimizationScore: this.calculateBinOptimizationScore(averageBinFillLevel)
    };
  }

  /**
   * Calculate trends over time
   */
  private calculateTrends(pickups: any[], routes: any[]) {
    // Group by week
    const weeklyData: { [key: string]: { pickups: number; routes: number; distance: number } } = {};

    pickups.forEach(pickup => {
      const week = this.getWeekKey(pickup.createdAt);
      if (!weeklyData[week]) weeklyData[week] = { pickups: 0, routes: 0, distance: 0 };
      weeklyData[week].pickups++;
    });

    routes.forEach(route => {
      const week = this.getWeekKey(route.createdAt);
      if (!weeklyData[week]) weeklyData[week] = { pickups: 0, routes: 0, distance: 0 };
      weeklyData[week].routes++;
      weeklyData[week].distance += route.totalDistance ? Number(route.totalDistance) : 0;
    });

    return Object.entries(weeklyData)
      .map(([week, data]) => ({ week, ...data }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   * Calculate bin optimization score based on average fill level
   */
  private calculateBinOptimizationScore(averageFillLevel: number): number {
    // Optimal range is 70-90% full
    if (averageFillLevel >= 70 && averageFillLevel <= 90) {
      return 100; // Perfect score
    } else if (averageFillLevel >= 60 && averageFillLevel < 70) {
      return 80; // Good score
    } else if (averageFillLevel >= 50 && averageFillLevel < 60) {
      return 60; // Fair score
    } else {
      return 40; // Poor score
    }
  }

  /**
   * Get week key for grouping (YYYY-WW format)
   */
  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }

  /**
   * Get driver leaderboard
   */
  async getDriverLeaderboard(period: 'week' | 'month' | 'year' = 'month') {
    try {
      let startDate: Date;
      const endDate = new Date();

      switch (period) {
        case 'week':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      const drivers = await prisma.driver.findMany({
        include: {
          user: { select: { fullName: true } },
          pickups: {
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: 'COMPLETED'
            }
          },
          routes: {
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: 'COMPLETED'
            },
            select: {
              totalDistance: true
            }
          }
        }
      });

      const leaderboard = drivers.map(driver => {
        const totalPickups = driver.pickups.length;
        const totalDistance = driver.routes.reduce((sum, route) => 
          sum + (route.totalDistance ? Number(route.totalDistance) : 0), 0
        );

        return {
          driverId: driver.id,
          name: driver.user.fullName,
          totalPickups,
          totalDistance: Math.round(totalDistance * 100) / 100,
          score: totalPickups * 10 + totalDistance * 2 // Simple scoring system
        };
      }).sort((a, b) => b.score - a.score);

      return {
        success: true,
        data: {
          period,
          leaderboard: leaderboard.slice(0, 10), // Top 10
          totalDrivers: drivers.length
        }
      };
    } catch (error) {
      throw error;
    }
  }
}