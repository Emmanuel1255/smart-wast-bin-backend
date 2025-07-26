// src/validators/binValidators.ts
import { body, query, ValidationChain } from 'express-validator';
import { BinStatus } from '@prisma/client';

export const createBinValidation: ValidationChain[] = [
  body('binCode')
    .notEmpty()
    .withMessage('Bin code is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Bin code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Bin code must contain only uppercase letters and numbers'),
  
  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ min: 3, max: 255 })
    .withMessage('Location must be between 3 and 255 characters'),
  
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Capacity must be between 1 and 10000'),
  
  body('binType')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Bin type must be between 2 and 50 characters'),
  
  body('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID')
];

export const updateBinValidation: ValidationChain[] = [
  body('location')
    .optional()
    .isLength({ min: 3, max: 255 })
    .withMessage('Location must be between 3 and 255 characters'),
  
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Capacity must be between 1 and 10000'),
  
  body('binType')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Bin type must be between 2 and 50 characters'),
  
  body('status')
    .optional()
    .isIn(Object.values(BinStatus))
    .withMessage('Invalid bin status'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

export const sensorDataValidation: ValidationChain[] = [
  body('fillLevel')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Fill level must be between 0 and 100'),
  
  body('weight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Weight must be a positive number'),
  
  body('temperature')
    .optional()
    .isFloat({ min: -50, max: 100 })
    .withMessage('Temperature must be between -50 and 100 celsius'),
  
  body('humidity')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Humidity must be between 0 and 100'),
  
  body('batteryLevel')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Battery level must be between 0 and 100'),
  
  body('signalStrength')
    .optional()
    .isInt({ min: -120, max: 0 })
    .withMessage('Signal strength must be between -120 and 0 dBm')
];

export const binListValidation: ValidationChain[] = [
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
    .isIn(Object.values(BinStatus))
    .withMessage('Invalid bin status'),
  
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  query('nearLat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  query('nearLng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  query('radius')
    .optional()
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Radius must be between 0.1 and 100 kilometers')
];

export const nearbyBinsValidation: ValidationChain[] = [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude is required and must be between -90 and 90'),
  
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude is required and must be between -180 and 180'),
  
  query('radius')
    .optional()
    .isFloat({ min: 0.1, max: 100 })
    .withMessage('Radius must be between 0.1 and 100 kilometers'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];