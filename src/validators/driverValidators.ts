// src/validators/driverValidators.ts
import { body, query, ValidationChain } from 'express-validator';
import { DriverStatus } from '@prisma/client';

export const createDriverValidation: ValidationChain[] = [
  body('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .trim(),
  
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  
  body('driverLicense')
    .notEmpty()
    .withMessage('Driver license is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Driver license must be between 3 and 50 characters')
    .trim(),
  
  body('truckId')
    .optional()
    .isUUID()
    .withMessage('Truck ID must be a valid UUID'),
  
  body('shiftStart')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Shift start must be in HH:MM format'),
  
  body('shiftEnd')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Shift end must be in HH:MM format')
];

export const updateDriverValidation: ValidationChain[] = [
  body('driverLicense')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Driver license must be between 3 and 50 characters')
    .trim(),
  
  body('truckId')
    .optional()
    .isUUID()
    .withMessage('Truck ID must be a valid UUID'),
  
  body('shiftStart')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Shift start must be in HH:MM format'),
  
  body('shiftEnd')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Shift end must be in HH:MM format'),
  
  body('isAvailable')
    .optional()
    .isBoolean()
    .withMessage('isAvailable must be a boolean')
];

export const driverStatusValidation: ValidationChain[] = [
  body('status')
    .isIn(Object.values(DriverStatus))
    .withMessage('Invalid driver status'),
  
  body('currentLatitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('currentLongitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

export const driverLocationValidation: ValidationChain[] = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude is required and must be between -90 and 90'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude is required and must be between -180 and 180')
];

export const driverListValidation: ValidationChain[] = [
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
    .isIn(Object.values(DriverStatus))
    .withMessage('Invalid driver status'),
  
  query('isAvailable')
    .optional()
    .isBoolean()
    .withMessage('isAvailable must be a boolean'),
  
  query('truckId')
    .optional()
    .isUUID()
    .withMessage('Truck ID must be a valid UUID')
];

export const nearbyDriversValidation: ValidationChain[] = [
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
    .withMessage('Limit must be between 1 and 50'),
  
  query('status')
    .optional()
    .isIn(Object.values(DriverStatus))
    .withMessage('Invalid driver status')
];

// Truck validation schemas
export const createTruckValidation: ValidationChain[] = [
  body('licensePlate')
    .notEmpty()
    .withMessage('License plate is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('License plate must be between 2 and 20 characters')
    .trim(),
  
  body('model')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Model must be between 2 and 100 characters')
    .trim(),
  
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage('Capacity must be between 1 and 50000'),
  
  body('fuelType')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Fuel type must be between 2 and 50 characters'),
  
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Year must be a valid year'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

export const updateTruckValidation: ValidationChain[] = [
  body('licensePlate')
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage('License plate must be between 2 and 20 characters')
    .trim(),
  
  body('model')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Model must be between 2 and 100 characters')
    .trim(),
  
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage('Capacity must be between 1 and 50000'),
  
  body('fuelType')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Fuel type must be between 2 and 50 characters'),
  
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Year must be a valid year'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];