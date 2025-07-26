// src/controllers/pickupController.ts
import { Response, NextFunction } from 'express';
import { PickupService } from '../services/pickupService';
import { RouteOptimizationService } from '../services/routeOptimizationService';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  CreatePickupRequest, 
  UpdatePickupRequest, 
  PickupStatusUpdate,
  PickupListQuery,
  AssignDriverRequest,
  PickupRouteOptimization
} from '@/types/pickup';

const pickupService = new PickupService();
const routeOptimizationService = new RouteOptimizationService();

export class PickupController {
  /**
   * Create new pickup request
   */
  async createPickup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const pickupData: CreatePickupRequest = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await pickupService.createPickup(pickupData, userRole, userId);
      
      res.status(201).json({
        success: true,
        message: 'Pickup request created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickups with filtering
   */
  async getPickups(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: PickupListQuery = req.query;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await pickupService.getPickups(query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickup by ID
   */
  async getPickupById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { pickupId } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await pickupService.getPickupById(pickupId, userRole, userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update pickup
   */
  async updatePickup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { pickupId } = req.params;
      const updateData: UpdatePickupRequest = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await pickupService.updatePickup(pickupId, updateData, userRole, userId);
      
      res.status(200).json({
        success: true,
        message: 'Pickup updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update pickup status
   */
  async updatePickupStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { pickupId } = req.params;
      const statusData: PickupStatusUpdate = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await pickupService.updatePickupStatus(pickupId, statusData, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign driver to pickup
   */
  async assignDriverToPickup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { pickupId } = req.params;
      const assignData: AssignDriverRequest = req.body;
      const userRole = req.user!.role;

      const result = await pickupService.assignDriverToPickup(pickupId, assignData, userRole);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickup statistics
   */
  async getPickupStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await pickupService.getPickupStats(userRole, userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel pickup
   */
  async cancelPickup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { pickupId } = req.params;
      const { reason } = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await pickupService.cancelPickup(pickupId, reason, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming pickups for current driver
   */
  async getMyUpcomingPickups(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
        where: { userId }
      });

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver profile not found'
        });
      }

      const result = await pickupService.getUpcomingPickupsForDriver(driver.id);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Optimize route for pickups
   */
  async optimizeRoute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const optimizationData: PickupRouteOptimization = req.body;
      const result = await routeOptimizationService.optimizePickupRoute(optimizationData);
      
      res.status(200).json({
        success: true,
        message: 'Route optimized successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get optimized route for driver
   */
  async getMyOptimizedRoute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
        where: { userId }
      });

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver profile not found'
        });
      }

      const result = await routeOptimizationService.getDriverOptimizedRoute(driver.id);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickups by priority
   */
  async getPickupsByPriority(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { priority } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const query: PickupListQuery = { 
        priority: priority as any,
        limit: 50 
      };

      const result = await pickupService.getPickups(query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickups by status
   */
  async getPickupsByStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const query: PickupListQuery = { 
        status: status as any,
        limit: 50 
      };

      const result = await pickupService.getPickups(query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get today's pickups
   */
  async getTodaysPickups(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const today = new Date().toISOString().split('T')[0];
      const query: PickupListQuery = { 
        scheduledDate: today,
        limit: 100 
      };

      const result = await pickupService.getPickups(query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}