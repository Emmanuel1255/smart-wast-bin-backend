// src/validators/pickupValidators.ts
import { body, query, ValidationChain } from 'express-validator';
import { PickupStatus } from '@prisma/client';

export const createPickupValidation: ValidationChain[] = [
  body('binId')
    .isUUID()
    .withMessage('Valid bin ID is required'),
  
  body('driverId')
    .optional()
    .isUUID()
    .withMessage('Driver ID must be a valid UUID'),
  
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
  
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be LOW, MEDIUM, HIGH, or URGENT'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('pickupType')
    .optional()
    .isIn(['SCHEDULED', 'ON_DEMAND', 'EMERGENCY'])
    .withMessage('Pickup type must be SCHEDULED, ON_DEMAND, or EMERGENCY')
];

export const updatePickupValidation: ValidationChain[] = [
  body('driverId')
    .optional()
    .isUUID()
    .withMessage('Driver ID must be a valid UUID'),
  
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
  
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be LOW, MEDIUM, HIGH, or URGENT'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('status')
    .optional()
    .isIn(Object.values(PickupStatus))
    .withMessage('Invalid pickup status')
];

export const pickupStatusValidation: ValidationChain[] = [
  body('status')
    .isIn(Object.values(PickupStatus))
    .withMessage('Invalid pickup status'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

export const assignDriverValidation: ValidationChain[] = [
  body('driverId')
    .isUUID()
    .withMessage('Valid driver ID is required'),
  
  body('estimatedDuration')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('Estimated duration must be between 1 and 1440 minutes'),
  
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date')
];

export const pickupListValidation: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(Object.values(PickupStatus))
    .withMessage('Invalid pickup status'),
  
  query('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Invalid priority'),
  
  query('pickupType')
    .optional()
    .isIn(['SCHEDULED', 'ON_DEMAND', 'EMERGENCY'])
    .withMessage('Invalid pickup type'),
  
  query('driverId')
    .optional()
    .isUUID()
    .withMessage('Driver ID must be a valid UUID'),
  
  query('binId')
    .optional()
    .isUUID()
    .withMessage('Bin ID must be a valid UUID'),
  
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  query('scheduledDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Scheduled date must be in YYYY-MM-DD format'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

export const routeOptimizationValidation: ValidationChain[] = [
  body('driverId')
    .isUUID()
    .withMessage('Valid driver ID is required'),
  
  body('pickupIds')
    .isArray({ min: 1 })
    .withMessage('At least one pickup ID is required'),
  
  body('pickupIds.*')
    .isUUID()
    .withMessage('Each pickup ID must be a valid UUID'),
  
  body('startLocation.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Start latitude must be between -90 and 90'),
  
  body('startLocation.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Start longitude must be between -180 and 180')
];

export const cancelPickupValidation: ValidationChain[] = [
  body('reason')
    .notEmpty()
    .withMessage('Cancellation reason is required')
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be between 3 and 500 characters')
];