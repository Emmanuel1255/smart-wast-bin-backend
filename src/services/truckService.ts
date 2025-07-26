// src/services/truckService.ts
import { PrismaClient } from '@prisma/client';
import { 
  CreateTruckRequest, 
  UpdateTruckRequest, 
  TruckResponse, 
  TruckListQuery 
} from '@/types/truck';
import { AppError } from '@/middleware/errorHandler';

const prisma = new PrismaClient();

export class TruckService {
  /**
   * Create a new truck
   */
  async createTruck(data: CreateTruckRequest): Promise<TruckResponse> {
    try {
      // Check if license plate already exists
      const existingTruck = await prisma.truck.findUnique({
        where: { licensePlate: data.licensePlate.toUpperCase() }
      });

      if (existingTruck) {
        const error: AppError = new Error('Truck with this license plate already exists');
        error.statusCode = 400;
        throw error;
      }

      const truck = await prisma.truck.create({
        data: {
          licensePlate: data.licensePlate.toUpperCase(),
          model: data.model,
          capacity: data.capacity || 1000,
          fuelType: data.fuelType,
          year: data.year,
          isActive: data.isActive !== false
        },
        include: {
          _count: {
            select: {
              drivers: true
            }
          }
        }
      });

      return this.formatTruckResponse(truck);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all trucks with filtering and pagination
   */
  async getTrucks(query: TruckListQuery) {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      const whereClause: any = {};

      if (query.isActive !== undefined) {
        whereClause.isActive = query.isActive;
      }

      if (query.search) {
        whereClause.OR = [
          {
            licensePlate: {
              contains: query.search,
              mode: 'insensitive'
            }
          },
          {
            model: {
              contains: query.search,
              mode: 'insensitive'
            }
          }
        ];
      }

      const [trucks, totalCount] = await Promise.all([
        prisma.truck.findMany({
          where: whereClause,
          include: {
            _count: {
              select: {
                drivers: true
              }
            },
            drivers: {
              select: {
                id: true,
                status: true,
                user: {
                  select: {
                    fullName: true
                  }
                }
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.truck.count({ where: whereClause })
      ]);

      const formattedTrucks = trucks.map(truck => this.formatTruckResponse(truck));

      return {
        success: true,
        data: formattedTrucks,
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
   * Get truck by ID
   */
  async getTruckById(truckId: string): Promise<TruckResponse> {
    try {
      const truck = await prisma.truck.findUnique({
        where: { id: truckId },
        include: {
          _count: {
            select: {
              drivers: true
            }
          },
          drivers: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true
                }
              }
            }
          }
        }
      });

      if (!truck) {
        const error: AppError = new Error('Truck not found');
        error.statusCode = 404;
        throw error;
      }

      return this.formatTruckResponse(truck);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update truck
   */
  async updateTruck(truckId: string, data: UpdateTruckRequest): Promise<TruckResponse> {
    try {
      const existingTruck = await this.getTruckById(truckId);

      // Check if license plate is being updated and already exists
      if (data.licensePlate && data.licensePlate !== existingTruck.licensePlate) {
        const truckWithSamePlate = await prisma.truck.findUnique({
          where: { licensePlate: data.licensePlate.toUpperCase() }
        });

        if (truckWithSamePlate) {
          const error: AppError = new Error('Truck with this license plate already exists');
          error.statusCode = 400;
          throw error;
        }
      }

      const updatedTruck = await prisma.truck.update({
        where: { id: truckId },
        data: {
          ...(data.licensePlate && { licensePlate: data.licensePlate.toUpperCase() }),
          ...(data.model !== undefined && { model: data.model }),
          ...(data.capacity && { capacity: data.capacity }),
          ...(data.fuelType && { fuelType: data.fuelType }),
          ...(data.year && { year: data.year }),
          ...(data.isActive !== undefined && { isActive: data.isActive })
        },
        include: {
          _count: {
            select: {
              drivers: true
            }
          },
          drivers: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true
                }
              }
            }
          }
        }
      });

      return this.formatTruckResponse(updatedTruck);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete truck
   */
  async deleteTruck(truckId: string): Promise<{ success: boolean; message: string }> {
    try {
      const truck = await this.getTruckById(truckId);

      // Check if truck has assigned drivers
      if (truck._count?.drivers && truck._count.drivers > 0) {
        const error: AppError = new Error('Cannot delete truck that has assigned drivers');
        error.statusCode = 400;
        throw error;
      }

      await prisma.truck.delete({
        where: { id: truckId }
      });

      return {
        success: true,
        message: 'Truck deleted successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get available trucks (not assigned to any driver or assigned to offline drivers)
   */
  async getAvailableTrucks() {
    try {
      const trucks = await prisma.truck.findMany({
        where: {
          isActive: true,
          OR: [
            // Trucks with no drivers assigned
            {
              drivers: {
                none: {}
              }
            },
            // Trucks with drivers that are offline
            {
              drivers: {
                every: {
                  status: 'OFFLINE'
                }
              }
            }
          ]
        },
        include: {
          _count: {
            select: {
              drivers: true
            }
          },
          drivers: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true
                }
              }
            }
          }
        },
        orderBy: { licensePlate: 'asc' }
      });

      return {
        success: true,
        data: trucks.map(truck => this.formatTruckResponse(truck))
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get trucks by status
   */
  async getTrucksByStatus(isActive: boolean) {
    try {
      const trucks = await prisma.truck.findMany({
        where: { isActive },
        include: {
          _count: {
            select: {
              drivers: true
            }
          },
          drivers: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true
                }
              }
            }
          }
        },
        orderBy: { licensePlate: 'asc' }
      });

      return {
        success: true,
        data: trucks.map(truck => this.formatTruckResponse(truck))
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get truck statistics
   */
  async getTruckStats() {
    try {
      const [total, active, inactive, withDrivers, withoutDrivers] = await Promise.all([
        prisma.truck.count(),
        prisma.truck.count({ where: { isActive: true } }),
        prisma.truck.count({ where: { isActive: false } }),
        prisma.truck.count({
          where: {
            drivers: {
              some: {}
            }
          }
        }),
        prisma.truck.count({
          where: {
            drivers: {
              none: {}
            }
          }
        })
      ]);

      // Get capacity statistics
      const capacityStats = await prisma.truck.aggregate({
        _avg: {
          capacity: true
        },
        _sum: {
          capacity: true
        },
        _max: {
          capacity: true
        },
        _min: {
          capacity: true
        },
        where: {
          isActive: true
        }
      });

      return {
        success: true,
        data: {
          total,
          active,
          inactive,
          withDrivers,
          withoutDrivers,
          utilizationRate: total > 0 ? Math.round((withDrivers / total) * 100) : 0,
          averageCapacity: capacityStats._avg.capacity ? Number(capacityStats._avg.capacity.toFixed(2)) : 0,
          totalCapacity: capacityStats._sum.capacity || 0,
          maxCapacity: capacityStats._max.capacity || 0,
          minCapacity: capacityStats._min.capacity || 0
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Assign driver to truck
   */
  async assignDriverToTruck(truckId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if truck exists and is active
      const truck = await this.getTruckById(truckId);
      if (!truck.isActive) {
        const error: AppError = new Error('Cannot assign driver to inactive truck');
        error.statusCode = 400;
        throw error;
      }

      // Check if driver exists
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        include: {
          user: {
            select: {
              isActive: true
            }
          }
        }
      });

      if (!driver) {
        const error: AppError = new Error('Driver not found');
        error.statusCode = 404;
        throw error;
      }

      if (!driver.user.isActive) {
        const error: AppError = new Error('Cannot assign inactive driver to truck');
        error.statusCode = 400;
        throw error;
      }

      // Update driver's truck assignment
      await prisma.driver.update({
        where: { id: driverId },
        data: { truckId }
      });

      return {
        success: true,
        message: 'Driver assigned to truck successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Unassign driver from truck
   */
  async unassignDriverFromTruck(driverId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if driver exists
      const driver = await prisma.driver.findUnique({
        where: { id: driverId }
      });

      if (!driver) {
        const error: AppError = new Error('Driver not found');
        error.statusCode = 404;
        throw error;
      }

      // Remove truck assignment
      await prisma.driver.update({
        where: { id: driverId },
        data: { truckId: null }
      });

      return {
        success: true,
        message: 'Driver unassigned from truck successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get truck maintenance schedule (placeholder for future implementation)
   */
  async getTruckMaintenanceSchedule(truckId: string) {
    try {
      const truck = await this.getTruckById(truckId);

      // This is a placeholder - you would implement actual maintenance tracking
      const maintenanceSchedule = {
        lastMaintenance: null, // Would come from maintenance records
        nextMaintenance: null, // Calculated based on mileage/time
        maintenanceInterval: 30, // days
        maintenanceStatus: 'up-to-date'
      };

      return {
        success: true,
        data: {
          truck: {
            id: truck.id,
            licensePlate: truck.licensePlate,
            model: truck.model
          },
          maintenance: maintenanceSchedule
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search trucks by license plate or model
   */
  async searchTrucks(searchTerm: string) {
    try {
      const trucks = await prisma.truck.findMany({
        where: {
          OR: [
            {
              licensePlate: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              model: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            }
          ]
        },
        include: {
          _count: {
            select: {
              drivers: true
            }
          },
          drivers: {
            select: {
              id: true,
              status: true,
              user: {
                select: {
                  fullName: true
                }
              }
            }
          }
        },
        orderBy: { licensePlate: 'asc' },
        take: 20 // Limit search results
      });

      return {
        success: true,
        data: trucks.map(truck => this.formatTruckResponse(truck))
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Format truck response
   */
  private formatTruckResponse(truck: any): TruckResponse {
    return {
      id: truck.id,
      licensePlate: truck.licensePlate,
      model: truck.model,
      capacity: truck.capacity,
      fuelType: truck.fuelType,
      year: truck.year,
      isActive: truck.isActive,
      createdAt: truck.createdAt,
      updatedAt: truck.updatedAt,
      _count: truck._count,
      drivers: truck.drivers
    };
  }
}