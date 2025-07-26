// src/controllers/driverController.ts
import { Response, NextFunction } from 'express';
import { DriverService } from '../services/driverService';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  CreateDriverRequest, 
  UpdateDriverRequest, 
  DriverStatusUpdate,
  DriverLocationUpdate,
  DriverListQuery,
  NearbyDriversQuery 
} from '@/types/driver';

const driverService = new DriverService();

export class DriverController {
  /**
   * Create new driver
   */
  async createDriver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const driverData: CreateDriverRequest = req.body;
      const userRole = req.user!.role;

      const result = await driverService.createDriver(driverData, userRole);
      
      res.status(201).json({
        success: true,
        message: 'Driver created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all drivers with filtering
   */
  async getDrivers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: DriverListQuery = req.query;
      const userRole = req.user!.role;

      const result = await driverService.getDrivers(query, userRole);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get driver by ID
   */
  async getDriverById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await driverService.getDriverById(driverId, userRole, userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update driver
   */
  async updateDriver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const updateData: UpdateDriverRequest = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await driverService.updateDriver(driverId, updateData, userRole, userId);
      
      res.status(200).json({
        success: true,
        message: 'Driver updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update driver status
   */
  async updateDriverStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const statusData: DriverStatusUpdate = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await driverService.updateDriverStatus(driverId, statusData, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const locationData: DriverLocationUpdate = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await driverService.updateDriverLocation(driverId, locationData, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available drivers
   */
  async getAvailableDrivers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { limit } = req.query;
      const result = await driverService.getAvailableDrivers(limit ? parseInt(limit as string) : undefined);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get nearby drivers
   */
  async getNearbyDrivers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: NearbyDriversQuery = req.query as any;
      const result = await driverService.getNearbyDrivers(query);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get driver statistics
   */
  async getDriverStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await driverService.getDriverStats();
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get driver performance
   */
  async getDriverPerformance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const result = await driverService.getDriverPerformance(driverId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete driver
   */
  async deleteDriver(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { driverId } = req.params;
      const userRole = req.user!.role;

      const result = await driverService.deleteDriver(driverId, userRole);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current driver profile (for authenticated drivers)
   */
  async getMyProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const userRole = req.user!.role;

      if (userRole !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: 'Only drivers can access this endpoint'
        });
      }

      // Find driver by userId
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const driver = await prisma.driver.findUnique({
        where: { userId },
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
        }
      });

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver profile not found'
        });
      }

      res.status(200).json({
        success: true,
        data: driverService.formatDriverResponse(driver)
      });
    } catch (error) {
      next(error);
    }
  }
}