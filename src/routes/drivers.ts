// src/routes/drivers.ts
import { Router } from 'express';
import { DriverController } from '../controllers/driverController';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  createDriverValidation,
  updateDriverValidation,
  driverStatusValidation,
  driverLocationValidation,
  driverListValidation,
  nearbyDriversValidation
} from '../validators/driverValidators';
import { param } from 'express-validator';

const router = Router();
const driverController = new DriverController();

// Validation for UUID parameters
const validateDriverId = [
  param('driverId').isUUID().withMessage('Invalid driver ID format')
];

// All routes require authentication
router.use(authenticate);

// GET routes
router.get(
  '/', 
  authorize(['ADMIN', 'DRIVER']),
  driverListValidation, 
  validateRequest, 
  driverController.getDrivers
);

router.get(
  '/available', 
  authorize(['ADMIN']),
  driverController.getAvailableDrivers
);

router.get(
  '/nearby', 
  nearbyDriversValidation, 
  validateRequest, 
  driverController.getNearbyDrivers
);

router.get(
  '/stats', 
  authorize(['ADMIN']),
  driverController.getDriverStats
);

router.get(
  '/me', 
  authorize(['DRIVER']),
  driverController.getMyProfile
);

router.get(
  '/:driverId', 
  validateDriverId, 
  validateRequest, 
  driverController.getDriverById
);

router.get(
  '/:driverId/performance', 
  authorize(['ADMIN']),
  validateDriverId, 
  validateRequest, 
  driverController.getDriverPerformance
);

// POST routes - Only admins can create drivers
router.post(
  '/', 
  authorize(['ADMIN']),
  createDriverValidation, 
  validateRequest, 
  driverController.createDriver
);

// PUT routes
router.put(
  '/:driverId', 
  validateDriverId,
  updateDriverValidation, 
  validateRequest, 
  driverController.updateDriver
);

router.put(
  '/:driverId/status', 
  validateDriverId,
  driverStatusValidation, 
  validateRequest, 
  driverController.updateDriverStatus
);

router.put(
  '/:driverId/location', 
  authorize(['DRIVER', 'ADMIN']),
  validateDriverId,
  driverLocationValidation, 
  validateRequest, 
  driverController.updateDriverLocation
);

// DELETE routes - Only admins can delete drivers
router.delete(
  '/:driverId', 
  authorize(['ADMIN']),
  validateDriverId, 
  validateRequest, 
  driverController.deleteDriver
);

export { router as driverRoutes };