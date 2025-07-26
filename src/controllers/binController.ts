// src/controllers/binController.ts
import { Response, NextFunction } from 'express';
import { BinService } from '../services/binService';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  CreateBinRequest, 
  UpdateBinRequest, 
  BinSensorDataRequest,
  BinListQuery,
  BinHistoryQuery,
  NearbyBinsQuery 
} from '@/types/bin';

const binService = new BinService();

export class BinController {
  /**
   * Create new bin
   */
  async createBin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const binData: CreateBinRequest = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.createBin(binData, userRole, userId);
      
      res.status(201).json({
        success: true,
        message: 'Bin created successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all bins with filtering
   */
  async getBins(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: BinListQuery = req.query;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.getBins(query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bin by ID
   */
  async getBinById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { binId } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.getBinById(binId, userRole, userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update bin
   */
  async updateBin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { binId } = req.params;
      const updateData: UpdateBinRequest = req.body;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.updateBin(binId, updateData, userRole, userId);
      
      res.status(200).json({
        success: true,
        message: 'Bin updated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete bin
   */
  async deleteBin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { binId } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.deleteBin(binId, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update sensor data (for IoT devices)
   */
  async updateSensorData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { binCode } = req.params;
      const sensorData: BinSensorDataRequest = req.body;

      const result = await binService.updateSensorData(binCode, sensorData);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bin statistics
   */
  async getBinStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.getBinStats(userRole, userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get nearby bins
   */
  async getNearbyBins(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: NearbyBinsQuery = req.query as any;

      const result = await binService.getNearbyBins(query);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bin sensor history
   */
  async getBinHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { binId } = req.params;
      const query: BinHistoryQuery = req.query;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.getBinHistory(binId, query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark bin as emptied
   */
  async markBinEmptied(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { binId } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const result = await binService.markBinEmptied(binId, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bins by status for quick filtering
   */
  async getBinsByStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const query: BinListQuery = { 
        status: status as any,
        limit: 50 
      };

      const result = await binService.getBins(query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search bins by location
   */
  async searchBins(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { location } = req.query;
      const userRole = req.user!.role;
      const userId = req.user!.userId;

      const query: BinListQuery = { 
        location: location as string,
        limit: 20 
      };

      const result = await binService.getBins(query, userRole, userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}