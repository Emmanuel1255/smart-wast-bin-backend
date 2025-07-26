// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  RegisterRequest, 
  LoginRequest, 
  RefreshTokenRequest,
  ChangePasswordRequest 
} from '../types/auth';

const authService = new AuthService();

export class AuthController {
  /**
   * Register new user
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const registerData: RegisterRequest = req.body;
      const result = await authService.register(registerData);
      
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const loginData: LoginRequest = req.body;
      const result = await authService.login(loginData);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;
      const result = await authService.refreshToken(refreshToken);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.logout(refreshToken);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword }: ChangePasswordRequest = req.body;
      const userId = req.user!.userId;
      
      const result = await authService.changePassword(userId, currentPassword, newPassword);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await authService.getProfile(userId);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const updateData = req.body;
      
      const result = await authService.updateProfile(userId, updateData);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user info (for frontend to check auth status)
   */
  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      
      res.status(200).json({
        success: true,
        data: {
          userId: user.userId,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  }
}