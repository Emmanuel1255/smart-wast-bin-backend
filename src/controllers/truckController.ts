// src/controllers/truckController.ts
import { Request, Response, NextFunction } from 'express';
import { TruckService } from '../services/truckService';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateTruckRequest, UpdateTruckRequest, TruckListQuery } from '../types/truck';

const truckService = new TruckService();

export class TruckController {
  /**
   * Create new truck
   */
  async createTruck(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const truckData: CreateTruckRequest = req.body;
      const result = await truckService.createTruck(truckData);
      
      res.status(201).json({
        success: true,
        message: 'Truck created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all trucks with filtering
   */
  async getTrucks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: TruckListQuery = req.query;
      const result = await truckService.getTrucks(query);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get truck by ID
   */
  async getTruckById(req: Request, res: Response, next: NextFunction) {
    try {
      const { truckId } = req.params;
      const result = await truckService.getTruckById(truckId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update truck
   */
  async updateTruck(req: Request, res: Response, next: NextFunction) {
    try {
      const { truckId } = req.params;
      const updateData: UpdateTruckRequest = req.body;

      const result = await truckService.updateTruck(truckId, updateData);
      
      res.status(200).json({
        success: true,
        message: 'Truck updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete truck
   */
  async deleteTruck(req: Request, res: Response, next: NextFunction) {
    try {
      const { truckId } = req.params;
      const result = await truckService.deleteTruck(truckId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available trucks
   */
  async getAvailableTrucks(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await truckService.getAvailableTrucks();
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}