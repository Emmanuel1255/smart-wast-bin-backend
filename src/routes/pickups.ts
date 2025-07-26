// src/routes/pickups.ts
import { Router } from 'express';
import { PickupController } from '../controllers/pickupController';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  createPickupValidation,
  updatePickupValidation,
  pickupStatusValidation,
  assignDriverValidation,
  pickupListValidation,
  routeOptimizationValidation,
  cancelPickupValidation
} from '@/validators/pickupValidators';
import { param } from 'express-validator';

const router = Router();
const pickupController = new PickupController();

// Validation for UUID parameters
const validatePickupId = [
  param('pickupId').isUUID().withMessage('Invalid pickup ID format')
];

const validatePriority = [
  param('priority').isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority')
];

const validateStatus = [
  param('status').isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status')
];

// All routes require authentication
router.use(authenticate);

// GET routes
router.get(
  '/', 
  pickupListValidation, 
  validateRequest, 
  pickupController.getPickups
);

router.get(
  '/stats', 
  pickupController.getPickupStats
);

router.get(
  '/my-upcoming', 
  authorize(['DRIVER']),
  pickupController.getMyUpcomingPickups
);

router.get(
  '/my-route', 
  authorize(['DRIVER']),
  pickupController.getMyOptimizedRoute
);

router.get(
  '/today', 
  pickupController.getTodaysPickups
);

router.get(
  '/priority/:priority', 
  validatePriority,
  validateRequest,
  pickupController.getPickupsByPriority
);

router.get(
  '/status/:status', 
  validateStatus,
  validateRequest,
  pickupController.getPickupsByStatus
);

router.get(
  '/:pickupId', 
  validatePickupId, 
  validateRequest, 
  pickupController.getPickupById
);

// POST routes
router.post(
  '/', 
  authorize(['USER', 'ADMIN']),
  createPickupValidation, 
  validateRequest, 
  pickupController.createPickup
);

router.post(
  '/optimize-route', 
  authorize(['ADMIN', 'DRIVER']),
  routeOptimizationValidation, 
  validateRequest, 
  pickupController.optimizeRoute
);

// PUT routes
router.put(
  '/:pickupId', 
  validatePickupId,
  updatePickupValidation, 
  validateRequest, 
  pickupController.updatePickup
);

router.put(
  '/:pickupId/status', 
  authorize(['DRIVER', 'ADMIN']),
  validatePickupId,
  pickupStatusValidation, 
  validateRequest, 
  pickupController.updatePickupStatus
);

router.put(
  '/:pickupId/assign', 
  authorize(['ADMIN']),
  validatePickupId,
  assignDriverValidation, 
  validateRequest, 
  pickupController.assignDriverToPickup
);

router.put(
  '/:pickupId/cancel', 
  validatePickupId,
  cancelPickupValidation, 
  validateRequest, 
  pickupController.cancelPickup
);

export { router as pickupRoutes };