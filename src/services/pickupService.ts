// src/services/pickupService.ts (Fixed version)
import { PrismaClient, PickupStatus, UserRole, DriverStatus } from '@prisma/client';
import { 
  CreatePickupRequest, 
  UpdatePickupRequest, 
  PickupStatusUpdate,
  PickupResponse, 
  PickupListQuery,
  PickupStatsResponse,
  AssignDriverRequest,
  PickupRouteOptimization,
  OptimizedRoute
} from '@/types/pickup';
import { AppError } from '@/middleware/errorHandler';

const prisma = new PrismaClient();

export class PickupService {
  /**
   * Create a new pickup request
   */
  async createPickup(
    data: CreatePickupRequest, 
    requestUserRole: string, 
    requestUserId: string
  ): Promise<PickupResponse> {
    try {
      // Verify bin exists and user has permission
      const bin = await prisma.bin.findUnique({
        where: { id: data.binId },
        include: {
          user: {
            select: { id: true }
          }
        }
      });

      if (!bin) {
        const error: AppError = new Error('Bin not found');
        error.statusCode = 404;
        throw error;
      }

      // Check permissions
      if (requestUserRole === UserRole.USER && bin.userId !== requestUserId) {
        const error: AppError = new Error('You can only create pickups for your own bins');
        error.statusCode = 403;
        throw error;
      }

      // Verify driver exists and is available if specified
      if (data.driverId) {
        const driver = await prisma.driver.findUnique({
          where: { id: data.driverId },
          include: {
            user: { select: { isActive: true } }
          }
        });

        if (!driver || !driver.user.isActive || !driver.isAvailable) {
          const error: AppError = new Error('Driver not found or not available');
          error.statusCode = 400;
          throw error;
        }
      }

      // Convert Decimal to number for comparison
      const currentLevel = Number(bin.currentLevel);

      // Auto-assign driver if not specified and bin is full
      let assignedDriverId: string | undefined = data.driverId;
      if (!assignedDriverId && currentLevel >= 80) {
        const bestDriver = await this.findBestAvailableDriver(
          Number(bin.latitude), 
          Number(bin.longitude)
        );
        assignedDriverId = bestDriver || undefined;
      }

      // Determine priority based on bin level if not specified
      let priority = data.priority || 'MEDIUM';
      if (currentLevel >= 95) {
        priority = 'URGENT';
      } else if (currentLevel >= 85) {
        priority = 'HIGH';
      }

      // Create pickup - Note: Remove fields that don't exist in your schema
      const pickup = await prisma.pickup.create({
        data: {
          binId: data.binId,
          driverId: assignedDriverId,
          createdById: requestUserId,
          scheduledAt: data.scheduledAt || this.calculateScheduledTime(priority),
          notes: data.notes,
          status: PickupStatus.SCHEDULED
          // Note: Only include fields that exist in your Prisma schema
          // If priority and pickupType don't exist in your schema, remove them
        },
        include: {
          bin: {
            select: {
              id: true,
              binCode: true,
              location: true,
              latitude: true,
              longitude: true,
              currentLevel: true,
              status: true
            }
          },
          driver: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true,
                  phone: true
                }
              },
              truck: {
                select: {
                  licensePlate: true,
                  model: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      return this.formatPickupResponse(pickup, priority, data.pickupType || 'ON_DEMAND');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pickups with filtering and pagination
   */
  async getPickups(query: PickupListQuery, requestUserRole: string, requestUserId: string) {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Build where clause based on role and filters
      const whereClause: any = {};

      // Role-based filtering
      if (requestUserRole === UserRole.USER) {
        whereClause.createdById = requestUserId;
      } else if (requestUserRole === UserRole.DRIVER) {
        // Find driver ID for this user
        const driver = await prisma.driver.findUnique({
          where: { userId: requestUserId }
        });
        if (driver) {
          whereClause.driverId = driver.id;
        }
      }

      // Apply filters
      if (query.status) {
        whereClause.status = query.status;
      }

      if (query.driverId) {
        whereClause.driverId = query.driverId;
      }

      if (query.binId) {
        whereClause.binId = query.binId;
      }

      if (query.userId) {
        whereClause.createdById = query.userId;
      }

      // Date filters
      if (query.scheduledDate) {
        const date = new Date(query.scheduledDate);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        
        whereClause.scheduledAt = {
          gte: date,
          lt: nextDate
        };
      }

      if (query.startDate || query.endDate) {
        whereClause.createdAt = {};
        if (query.startDate) {
          whereClause.createdAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          whereClause.createdAt.lte = new Date(query.endDate);
        }
      }

      const [pickups, totalCount] = await Promise.all([
        prisma.pickup.findMany({
          where: whereClause,
          include: {
            bin: {
              select: {
                id: true,
                binCode: true,
                location: true,
                latitude: true,
                longitude: true,
                currentLevel: true,
                status: true
              }
            },
            driver: {
              select: {
                id: true,
                status: true,
                user: {
                  select: {
                    fullName: true,
                    phone: true
                  }
                },
                truck: {
                  select: {
                    licensePlate: true,
                    model: true
                  }
                }
              }
            },
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          },
          orderBy: [
            { scheduledAt: 'asc' },
            { createdAt: 'desc' }
          ],
          skip,
          take: limit
        }),
        prisma.pickup.count({ where: whereClause })
      ]);

      const formattedPickups = pickups.map(pickup => 
        this.formatPickupResponse(pickup, 'MEDIUM', 'ON_DEMAND')
      );

      return {
        success: true,
        data: formattedPickups,
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
   * Get pickup by ID
   */
  async getPickupById(
    pickupId: string, 
    requestUserRole: string, 
    requestUserId: string
  ): Promise<PickupResponse> {
    try {
      const pickup = await prisma.pickup.findUnique({
        where: { id: pickupId },
        include: {
          bin: {
            select: {
              id: true,
              binCode: true,
              location: true,
              latitude: true,
              longitude: true,
              currentLevel: true,
              status: true
            }
          },
          driver: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true,
                  phone: true
                }
              },
              truck: {
                select: {
                  licensePlate: true,
                  model: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      if (!pickup) {
        const error: AppError = new Error('Pickup not found');
        error.statusCode = 404;
        throw error;
      }

      // Check permissions
      if (requestUserRole === UserRole.USER && pickup.createdById !== requestUserId) {
        const error: AppError = new Error('Access denied');
        error.statusCode = 403;
        throw error;
      }

      if (requestUserRole === UserRole.DRIVER) {
        const driver = await prisma.driver.findUnique({
          where: { userId: requestUserId }
        });
        if (!driver || pickup.driverId !== driver.id) {
          const error: AppError = new Error('Access denied');
          error.statusCode = 403;
          throw error;
        }
      }

      return this.formatPickupResponse(pickup, 'MEDIUM', 'ON_DEMAND');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update pickup
   */
  async updatePickup(
    pickupId: string,
    data: UpdatePickupRequest,
    requestUserRole: string,
    requestUserId: string
  ): Promise<PickupResponse> {
    try {
      // Check if pickup exists and user has permission
      const existingPickup = await this.getPickupById(pickupId, requestUserRole, requestUserId);

      // Verify driver if being assigned
      if (data.driverId) {
        const driver = await prisma.driver.findUnique({
          where: { id: data.driverId },
          include: {
            user: { select: { isActive: true } }
          }
        });

        if (!driver || !driver.user.isActive || !driver.isAvailable) {
          const error: AppError = new Error('Driver not found or not available');
          error.statusCode = 400;
          throw error;
        }
      }

      const updatedPickup = await prisma.pickup.update({
        where: { id: pickupId },
        data: {
          ...(data.driverId !== undefined && { driverId: data.driverId }),
          ...(data.scheduledAt && { scheduledAt: data.scheduledAt }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.status && { status: data.status })
        },
        include: {
          bin: {
            select: {
              id: true,
              binCode: true,
              location: true,
              latitude: true,
              longitude: true,
              currentLevel: true,
              status: true
            }
          },
          driver: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true,
                  phone: true
                }
              },
              truck: {
                select: {
                  licensePlate: true,
                  model: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      return this.formatPickupResponse(updatedPickup, data.priority || 'MEDIUM', 'ON_DEMAND');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update pickup status (for drivers)
   */
  async updatePickupStatus(
    pickupId: string,
    statusData: PickupStatusUpdate,
    requestUserRole: string,
    requestUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if pickup exists and user has permission
      const existingPickup = await this.getPickupById(pickupId, requestUserRole, requestUserId);

      const updateData: any = {
        status: statusData.status,
        notes: statusData.notes
      };

      // Set timestamps based on status
      if (statusData.status === PickupStatus.IN_PROGRESS && !existingPickup.startedAt) {
        updateData.startedAt = new Date();
      } else if (statusData.status === PickupStatus.COMPLETED && !existingPickup.completedAt) {
        updateData.completedAt = new Date();
        
        // Mark bin as emptied if pickup is completed
        await prisma.bin.update({
          where: { id: existingPickup.bin.id },
          data: {
            currentLevel: 0,
            status: 'EMPTY',
            lastEmptied: new Date()
          }
        });
      }

      await prisma.pickup.update({
        where: { id: pickupId },
        data: updateData
      });

      return {
        success: true,
        message: 'Pickup status updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Assign driver to pickup
   */
  async assignDriverToPickup(
    pickupId: string,
    assignData: AssignDriverRequest,
    requestUserRole: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Only admins can assign drivers
      if (requestUserRole !== UserRole.ADMIN) {
        const error: AppError = new Error('Only administrators can assign drivers');
        error.statusCode = 403;
        throw error;
      }

      // Verify pickup exists
      const pickup = await prisma.pickup.findUnique({
        where: { id: pickupId }
      });

      if (!pickup) {
        const error: AppError = new Error('Pickup not found');
        error.statusCode = 404;
        throw error;
      }

      // Verify driver exists and is available
      const driver = await prisma.driver.findUnique({
        where: { id: assignData.driverId },
        include: {
          user: { select: { isActive: true } }
        }
      });

      if (!driver || !driver.user.isActive || !driver.isAvailable) {
        const error: AppError = new Error('Driver not found or not available');
        error.statusCode = 400;
        throw error;
      }

      // Update pickup with driver assignment (remove estimatedDuration if it doesn't exist)
      await prisma.pickup.update({
        where: { id: pickupId },
        data: {
          driverId: assignData.driverId,
          scheduledAt: assignData.scheduledAt || pickup.scheduledAt
        }
      });

      return {
        success: true,
        message: 'Driver assigned to pickup successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pickup statistics
   */
  async getPickupStats(requestUserRole: string, requestUserId: string): Promise<PickupStatsResponse> {
    try {
      const whereClause: any = {};

      // Role-based filtering
      if (requestUserRole === UserRole.USER) {
        whereClause.createdById = requestUserId;
      } else if (requestUserRole === UserRole.DRIVER) {
        const driver = await prisma.driver.findUnique({
          where: { userId: requestUserId }
        });
        if (driver) {
          whereClause.driverId = driver.id;
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());

      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        total,
        statusCounts,
        completedPickupsWithTime,
        totalToday,
        totalThisWeek,
        totalThisMonth
      ] = await Promise.all([
        prisma.pickup.count({ where: whereClause }),
        prisma.pickup.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true
        }),
        prisma.pickup.findMany({
          where: {
            ...whereClause,
            status: PickupStatus.COMPLETED,
            startedAt: { not: null },
            completedAt: { not: null }
          },
          select: {
            startedAt: true,
            completedAt: true,
            scheduledAt: true
          }
        }),
        prisma.pickup.count({
          where: {
            ...whereClause,
            createdAt: { gte: today }
          }
        }),
        prisma.pickup.count({
          where: {
            ...whereClause,
            createdAt: { gte: thisWeekStart }
          }
        }),
        prisma.pickup.count({
          where: {
            ...whereClause,
            createdAt: { gte: thisMonthStart }
          }
        })
      ]);

      const stats: PickupStatsResponse = {
        total,
        scheduled: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        averageCompletionTime: 0,
        completionRate: 0,
        onTimeRate: 0,
        totalToday,
        totalThisWeek,
        totalThisMonth
      };

      // Calculate status counts
      statusCounts.forEach(item => {
        switch (item.status) {
          case PickupStatus.SCHEDULED:
            stats.scheduled = item._count;
            break;
          case PickupStatus.IN_PROGRESS:
            stats.inProgress = item._count;
            break;
          case PickupStatus.COMPLETED:
            stats.completed = item._count;
            break;
          case PickupStatus.CANCELLED:
            stats.cancelled = item._count;
            break;
        }
      });

      // Calculate completion rate
      if (total > 0) {
        stats.completionRate = Math.round((stats.completed / total) * 100);
      }

      // Calculate average completion time and on-time rate
      if (completedPickupsWithTime.length > 0) {
        const totalTime = completedPickupsWithTime.reduce((sum, pickup) => {
          const duration = pickup.completedAt!.getTime() - pickup.startedAt!.getTime();
          return sum + duration;
        }, 0);

        stats.averageCompletionTime = Math.round((totalTime / completedPickupsWithTime.length) / (1000 * 60));

        const onTimePickups = completedPickupsWithTime.filter(pickup => 
          pickup.completedAt! <= pickup.scheduledAt!
        ).length;

        stats.onTimeRate = Math.round((onTimePickups / completedPickupsWithTime.length) * 100);
      }

      return stats;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel pickup
   */
  async cancelPickup(
    pickupId: string,
    reason: string,
    requestUserRole: string,
    requestUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if pickup exists and user has permission
      const existingPickup = await this.getPickupById(pickupId, requestUserRole, requestUserId);

      // Cannot cancel completed pickups
      if (existingPickup.status === PickupStatus.COMPLETED) {
        const error: AppError = new Error('Cannot cancel completed pickup');
        error.statusCode = 400;
        throw error;
      }

      await prisma.pickup.update({
        where: { id: pickupId },
        data: {
          status: PickupStatus.CANCELLED,
          notes: reason
        }
      });

      return {
        success: true,
        message: 'Pickup cancelled successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get upcoming pickups for a driver
   */
  async getUpcomingPickupsForDriver(driverId: string) {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const pickups = await prisma.pickup.findMany({
        where: {
          driverId,
          status: {
            in: [PickupStatus.SCHEDULED, PickupStatus.IN_PROGRESS]
          },
          scheduledAt: {
            lte: tomorrow
          }
        },
        include: {
          bin: {
            select: {
              id: true,
              binCode: true,
              location: true,
              latitude: true,
              longitude: true,
              currentLevel: true,
              status: true
            }
          }
        },
        orderBy: {
          scheduledAt: 'asc'
        }
      });

      return {
        success: true,
        data: pickups.map(pickup => ({
          id: pickup.id,
          status: pickup.status,
          scheduledAt: pickup.scheduledAt,
          bin: pickup.bin,
          notes: pickup.notes
        }))
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find best available driver based on location
   */
  private async findBestAvailableDriver(binLat: number, binLng: number): Promise<string | null> {
    try {
      const availableDrivers = await prisma.driver.findMany({
        where: {
          status: DriverStatus.ONLINE,
          isAvailable: true,
          currentLatitude: { not: null },
          currentLongitude: { not: null },
          user: {
            isActive: true
          }
        },
        select: {
          id: true,
          currentLatitude: true,
          currentLongitude: true
        }
      });

      if (availableDrivers.length === 0) {
        return null;
      }

      // Find closest driver
      let closestDriver = availableDrivers[0];
      let shortestDistance = this.calculateDistance(
        binLat,
        binLng,
        Number(closestDriver.currentLatitude),
        Number(closestDriver.currentLongitude)
      );

      for (const driver of availableDrivers.slice(1)) {
        const distance = this.calculateDistance(
          binLat,
          binLng,
          Number(driver.currentLatitude),
          Number(driver.currentLongitude)
        );

        if (distance < shortestDistance) {
          shortestDistance = distance;
          closestDriver = driver;
        }
      }

      return closestDriver.id;
    } catch (error) {
      console.error('Error finding best available driver:', error);
      return null;
    }
  }

  /**
   * Calculate scheduled time based on priority
   */
  private calculateScheduledTime(priority: string): Date {
    const now = new Date();
    
    switch (priority) {
      case 'URGENT':
        return new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
      case 'HIGH':
        return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      case 'MEDIUM':
        return new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
      case 'LOW':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      default:
        return new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
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
   * Format pickup response
   */
  private formatPickupResponse(pickup: any, priority: string = 'MEDIUM', pickupType: string = 'ON_DEMAND'): PickupResponse {
    let actualDuration = undefined;

    if (pickup.startedAt && pickup.completedAt) {
      actualDuration = Math.round(
        (pickup.completedAt.getTime() - pickup.startedAt.getTime()) / (1000 * 60)
      );
    }

    return {
      id: pickup.id,
      status: pickup.status,
      priority: priority, // Use passed priority since it might not be in DB
      pickupType: pickupType, // Use passed pickupType since it might not be in DB
      scheduledAt: pickup.scheduledAt,
      startedAt: pickup.startedAt,
      completedAt: pickup.completedAt,
      notes: pickup.notes,
      createdAt: pickup.createdAt,
      updatedAt: pickup.updatedAt,
      bin: {
        id: pickup.bin.id,
        binCode: pickup.bin.binCode,
        location: pickup.bin.location,
        latitude: Number(pickup.bin.latitude),
        longitude: Number(pickup.bin.longitude),
        currentLevel: Number(pickup.bin.currentLevel),
        status: pickup.bin.status
      },
      driver: pickup.driver,
      createdBy: pickup.createdBy,
      estimatedDuration: undefined, // Remove if not in schema
      actualDuration
    };
  }
}