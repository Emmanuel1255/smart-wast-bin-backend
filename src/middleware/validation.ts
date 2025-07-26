// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '@/middleware/errorHandler';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    const error: AppError = new Error(errorMessages.join('. '));
    error.statusCode = 400;
    return next(error);
  }
  
  next();
};