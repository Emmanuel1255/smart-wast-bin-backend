// src/routes/trucks.ts
import { Router } from 'express';
import { TruckController } from '../controllers/truckController';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { createTruckValidation, updateTruckValidation } from '../validators/driverValidators';
import { param } from 'express-validator';

const router = Router();
const truckController = new TruckController();

// Validation for UUID parameters
const validateTruckId = [
  param('truckId').isUUID().withMessage('Invalid truck ID format')
];

// All routes require authentication
router.use(authenticate);

// GET routes
router.get('/', truckController.getTrucks);
router.get('/available', truckController.getAvailableTrucks);
router.get('/:truckId', validateTruckId, validateRequest, truckController.getTruckById);

// POST routes - Only admins can create trucks
router.post(
  '/', 
  authorize(['ADMIN']),
  createTruckValidation, 
  validateRequest, 
  truckController.createTruck
);

// PUT routes - Only admins can update trucks
router.put(
  '/:truckId', 
  authorize(['ADMIN']),
  validateTruckId,
  updateTruckValidation, 
  validateRequest, 
  truckController.updateTruck
);

// DELETE routes - Only admins can delete trucks
router.delete(
  '/:truckId', 
  authorize(['ADMIN']),
  validateTruckId, 
  validateRequest, 
  truckController.deleteTruck
);

export { router as truckRoutes };