// src/routes/bins.ts
import { Router } from 'express';
import { BinController } from '../controllers/binController';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  createBinValidation,
  updateBinValidation,
  sensorDataValidation,
  binListValidation,
  nearbyBinsValidation
} from '../validators/binValidators';
import { param } from 'express-validator';

const router = Router();
const binController = new BinController();

// Validation for UUID parameters
const validateBinId = [
  param('binId').isUUID().withMessage('Invalid bin ID format')
];

const validateBinCode = [
  param('binCode').notEmpty().withMessage('Bin code is required')
];

// Public routes (for IoT devices)
router.post(
  '/sensor/:binCode', 
  validateBinCode,
  sensorDataValidation, 
  validateRequest, 
  binController.updateSensorData
);

// Protected routes - All users can access
router.use(authenticate);

// GET routes
router.get(
  '/', 
  binListValidation, 
  validateRequest, 
  binController.getBins
);

router.get(
  '/stats', 
  binController.getBinStats
);

router.get(
  '/search', 
  binController.searchBins
);

router.get(
  '/status/counts',
  binController.getBinStatusCounts
);

router.get(
  '/status/:status', 
  param('status')
    .isString()
    .toUpperCase()
    .isIn(['EMPTY', 'LOW', 'MEDIUM', 'HIGH', 'FULL', 'MAINTENANCE', 'OUT_OF_SERVICE'])
    .withMessage('Invalid bin status'),
  validateRequest,
  binController.getBinsByStatus
);

router.get(
  '/nearby', 
  nearbyBinsValidation, 
  validateRequest, 
  binController.getNearbyBins
);

router.get(
  '/:binId', 
  validateBinId, 
  validateRequest, 
  binController.getBinById
);

router.get(
  '/:binId/history', 
  validateBinId, 
  validateRequest, 
  binController.getBinHistory
);

// POST routes - Users and Admins can create bins
router.post(
  '/', 
  authorize(['USER', 'ADMIN']),
  createBinValidation, 
  validateRequest, 
  binController.createBin
);

// PUT routes - Users can update their own bins, Admins can update any
router.put(
  '/:binId', 
  validateBinId,
  updateBinValidation, 
  validateRequest, 
  binController.updateBin
);

router.put(
  '/:binId/empty', 
  authorize(['DRIVER', 'ADMIN']),
  validateBinId, 
  validateRequest, 
  binController.markBinEmptied
);

// DELETE routes - Users can delete their own bins, Admins can delete any
router.delete(
  '/:binId', 
  validateBinId, 
  validateRequest, 
  binController.deleteBin
);

export { router as binRoutes };