// src/services/binService.ts
import { PrismaClient, BinStatus, UserRole } from '@prisma/client';
import { 
  CreateBinRequest, 
  UpdateBinRequest, 
  BinResponse, 
  BinListQuery,
  BinStatsResponse,
  BinSensorDataRequest,
  BinHistoryQuery,
  NearbyBinsQuery
} from '@/types/bin';
import { AppError } from '@/middleware/errorHandler';

const prisma = new PrismaClient();

export class BinService {
  /**
   * Create a new bin
   */
  async createBin(data: CreateBinRequest, userRole: string, requestUserId: string): Promise<BinResponse> {
    try {
      // Check if bin code already exists
      const existingBin = await prisma.bin.findUnique({
        where: { binCode: data.binCode }
      });

      if (existingBin) {
        const error: AppError = new Error('Bin with this code already exists');
        error.statusCode = 400;
        throw error;
      }

      // For regular users, set userId to their own ID
      // For admins, allow setting any userId or leave null
      let assignedUserId = data.userId;
      if (userRole === UserRole.USER) {
        assignedUserId = requestUserId;
      }

      const bin = await prisma.bin.create({
        data: {
          binCode: data.binCode,
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          capacity: data.capacity || 100,
          binType: data.binType || 'general',
          userId: assignedUserId,
          currentLevel: 0,
          status: BinStatus.EMPTY
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      return this.formatBinResponse(bin);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all bins with filtering and pagination
   */
  async getBins(query: BinListQuery, userRole: string, userId: string) {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      // Build where clause based on role and filters
      const whereClause: any = {};

      // Role-based filtering
      if (userRole === UserRole.USER) {
        whereClause.userId = userId;
      } else if (query.userId) {
        whereClause.userId = query.userId;
      }

      // Status filter
      if (query.status) {
        whereClause.status = query.status;
      }

      // Bin type filter
      if (query.binType) {
        whereClause.binType = query.binType;
      }

      // Location search
      if (query.location) {
        whereClause.location = {
          contains: query.location,
          mode: 'insensitive'
        };
      }

      // Nearby search (if coordinates provided)
      if (query.nearLat && query.nearLng) {
        const radius = query.radius || 5; // Default 5km radius
        whereClause.latitude = {
          gte: query.nearLat - (radius / 111), // Rough conversion: 1 degree ≈ 111km
          lte: query.nearLat + (radius / 111)
        };
        whereClause.longitude = {
          gte: query.nearLng - (radius / (111 * Math.cos(query.nearLat * Math.PI / 180))),
          lte: query.nearLng + (radius / (111 * Math.cos(query.nearLat * Math.PI / 180)))
        };
      }

      const [bins, totalCount] = await Promise.all([
        prisma.bin.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            },
            _count: {
              select: {
                sensorData: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.bin.count({ where: whereClause })
      ]);

      const formattedBins = bins.map(bin => this.formatBinResponse(bin));

      return {
        success: true,
        data: formattedBins,
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
   * Get bin by ID
   */
  async getBinById(binId: string, userRole: string, userId: string): Promise<BinResponse> {
    try {
      const whereClause: any = { id: binId };

      // Users can only see their own bins
      if (userRole === UserRole.USER) {
        whereClause.userId = userId;
      }

      const bin = await prisma.bin.findFirst({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          _count: {
            select: {
              sensorData: true
            }
          }
        }
      });

      if (!bin) {
        const error: AppError = new Error('Bin not found or access denied');
        error.statusCode = 404;
        throw error;
      }

      return this.formatBinResponse(bin);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update bin
   */
  async updateBin(binId: string, data: UpdateBinRequest, userRole: string, userId: string): Promise<BinResponse> {
    try {
      // Check if bin exists and user has permission
      const existingBin = await this.getBinById(binId, userRole, userId);

      const updatedBin = await prisma.bin.update({
        where: { id: binId },
        data: {
          ...(data.location && { location: data.location }),
          ...(data.latitude && { latitude: data.latitude }),
          ...(data.longitude && { longitude: data.longitude }),
          ...(data.capacity && { capacity: data.capacity }),
          ...(data.binType && { binType: data.binType }),
          ...(data.status && { status: data.status }),
          ...(data.isActive !== undefined && { isActive: data.isActive })
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      return this.formatBinResponse(updatedBin);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete bin
   */
  async deleteBin(binId: string, userRole: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if bin exists and user has permission
      await this.getBinById(binId, userRole, userId);

      await prisma.bin.delete({
        where: { id: binId }
      });

      return {
        success: true,
        message: 'Bin deleted successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update bin sensor data (for IoT devices)
   */
  async updateSensorData(binCode: string, sensorData: BinSensorDataRequest): Promise<{ success: boolean; message: string }> {
    try {
      const bin = await prisma.bin.findUnique({
        where: { binCode }
      });

      if (!bin) {
        const error: AppError = new Error('Bin not found');
        error.statusCode = 404;
        throw error;
      }

      // Determine bin status based on fill level
      const status = this.calculateBinStatus(sensorData.fillLevel);

      // Update bin with new data
      await prisma.$transaction([
        // Update bin current level and status
        prisma.bin.update({
          where: { binCode },
          data: {
            currentLevel: sensorData.fillLevel,
            status
          }
        }),
        // Store sensor data for history
        prisma.binSensorData.create({
          data: {
            binId: bin.id,
            fillLevel: sensorData.fillLevel,
            weight: sensorData.weight,
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            batteryLevel: sensorData.batteryLevel,
            signalStrength: sensorData.signalStrength
          }
        })
      ]);

      return {
        success: true,
        message: 'Sensor data updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get bin statistics
   */
  async getBinStats(userRole: string, userId: string): Promise<BinStatsResponse> {
    try {
      const whereClause: any = {};

      // Users can only see stats for their own bins
      if (userRole === UserRole.USER) {
        whereClause.userId = userId;
      }

      const [total, statusCounts, avgFillLevel] = await Promise.all([
        prisma.bin.count({ where: whereClause }),
        prisma.bin.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true
        }),
        prisma.bin.aggregate({
          where: whereClause,
          _avg: {
            currentLevel: true
          }
        })
      ]);

      const stats: BinStatsResponse = {
        total,
        empty: 0,
        low: 0,
        medium: 0,
        high: 0,
        full: 0,
        maintenance: 0,
        outOfService: 0,
        averageFillLevel: Number(avgFillLevel._avg.currentLevel?.toFixed(2)) || 0
      };

      statusCounts.forEach(item => {
        switch (item.status) {
          case BinStatus.EMPTY:
            stats.empty = item._count;
            break;
          case BinStatus.LOW:
            stats.low = item._count;
            break;
          case BinStatus.MEDIUM:
            stats.medium = item._count;
            break;
          case BinStatus.HIGH:
            stats.high = item._count;
            break;
          case BinStatus.FULL:
            stats.full = item._count;
            break;
          case BinStatus.MAINTENANCE:
            stats.maintenance = item._count;
            break;
          case BinStatus.OUT_OF_SERVICE:
            stats.outOfService = item._count;
            break;
        }
      });

      return stats;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get nearby bins
   */
  async getNearbyBins(query: NearbyBinsQuery): Promise<BinResponse[]> {
    try {
      const radius = Number(query.radius) || 5; // Default 5km
      const limit = Number(query.limit) || 20;
      const latitude = Number(query.latitude);
      const longitude = Number(query.longitude);

      // Simple distance calculation (for more accurate results, use PostGIS)
      const bins = await prisma.bin.findMany({
        where: {
          isActive: true,
          latitude: {
            gte: latitude - (radius / 111),
            lte: latitude + (radius / 111)
          },
          longitude: {
            gte: longitude - (radius / (111 * Math.cos(latitude * Math.PI / 180))),
            lte: longitude + (radius / (111 * Math.cos(latitude * Math.PI / 180)))
          }
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        },
        take: limit,
        orderBy: {
          updatedAt: 'desc'
        }
      });

      // Calculate actual distances and sort
      const binsWithDistance = bins.map(bin => {
        const distance = this.calculateDistance(
          query.latitude,
          query.longitude,
          Number(bin.latitude),
          Number(bin.longitude)
        );
        return {
          ...this.formatBinResponse(bin),
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        };
      }).filter(bin => bin.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      return binsWithDistance;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get bin sensor history
   */
  async getBinHistory(binId: string, query: BinHistoryQuery, userRole: string, userId: string) {
    try {
      // Check if bin exists and user has permission
      await this.getBinById(binId, userRole, userId);

      const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const dataPoints = query.dataPoints || 100;

      const sensorData = await prisma.binSensorData.findMany({
        where: {
          binId,
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: dataPoints
      });

      return {
        success: true,
        data: sensorData.reverse() // Reverse to get chronological order
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark bin as emptied
   */
  async markBinEmptied(binId: string, userRole: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if bin exists and user has permission
      await this.getBinById(binId, userRole, userId);

      await prisma.bin.update({
        where: { id: binId },
        data: {
          currentLevel: 0,
          status: BinStatus.EMPTY,
          lastEmptied: new Date()
        }
      });

      return {
        success: true,
        message: 'Bin marked as emptied successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate bin status based on fill level
   */
  private calculateBinStatus(fillLevel: number): BinStatus {
    if (fillLevel <= 20) return BinStatus.EMPTY;
    if (fillLevel <= 40) return BinStatus.LOW;
    if (fillLevel <= 60) return BinStatus.MEDIUM;
    if (fillLevel <= 80) return BinStatus.HIGH;
    return BinStatus.FULL;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
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
   * Format bin response
   */
  private formatBinResponse(bin: any): BinResponse {
    return {
      id: bin.id,
      binCode: bin.binCode,
      location: bin.location,
      latitude: Number(bin.latitude),
      longitude: Number(bin.longitude),
      capacity: bin.capacity,
      currentLevel: Number(bin.currentLevel),
      status: bin.status,
      binType: bin.binType,
      lastEmptied: bin.lastEmptied,
      isActive: bin.isActive,
      createdAt: bin.createdAt,
      updatedAt: bin.updatedAt,
      user: bin.user,
      _count: bin._count
    };
  }
}