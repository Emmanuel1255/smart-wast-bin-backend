// src/routes/auth.ts
import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  changePasswordValidation,
  updateProfileValidation
} from '../validators/authValidators';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', registerValidation, validateRequest, authController.register);
router.post('/login', loginValidation, validateRequest, authController.login);
router.post('/refresh', refreshTokenValidation, validateRequest, authController.refreshToken);
router.post('/logout', refreshTokenValidation, validateRequest, authController.logout);

// Protected routes
router.get('/me', authenticate, authController.me);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, updateProfileValidation, validateRequest, authController.updateProfile);
router.put('/change-password', authenticate, changePasswordValidation, validateRequest, authController.changePassword);

export { router as authRoutes };