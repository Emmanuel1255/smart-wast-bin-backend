// src/services/authService.ts
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, User, UserRole } from '@prisma/client';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { 
  RegisterRequest, 
  LoginRequest, 
  AuthResponse,
  TokenPayload 
} from '@/types/auth';
import { AppError } from '@/middleware/errorHandler';

const prisma = new PrismaClient();

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() }
      });

      if (existingUser) {
        const error: AppError = new Error('User already exists with this email');
        error.statusCode = 400;
        throw error;
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: hashedPassword,
          fullName: data.fullName,
          phone: data.phone,
          role: data.role || UserRole.USER,
          isActive: true,
          emailVerified: false
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          emailVerified: true
        }
      });

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const { accessToken, refreshToken } = generateTokens(tokenPayload);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          fullName: true,
          role: true,
          isActive: true,
          emailVerified: true
        }
      });

      if (!user) {
        const error: AppError = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Check if user is active
      if (!user.isActive) {
        const error: AppError = new Error('Account has been deactivated');
        error.statusCode = 401;
        throw error;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        const error: AppError = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const { accessToken, refreshToken } = generateTokens(tokenPayload);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Remove password from response
      const { passwordHash, ...userWithoutPassword } = user;

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Check if refresh token exists in database
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              isActive: true,
              emailVerified: true
            }
          }
        }
      });

      if (!storedToken) {
        const error: AppError = new Error('Invalid refresh token');
        error.statusCode = 401;
        throw error;
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        const error: AppError = new Error('Refresh token expired');
        error.statusCode = 401;
        throw error;
      }

      // Check if user is still active
      if (!storedToken.user.isActive) {
        const error: AppError = new Error('Account has been deactivated');
        error.statusCode = 401;
        throw error;
      }

      // Generate new tokens
      const tokenPayload: TokenPayload = {
        userId: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role
      };

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(tokenPayload);

      // Replace old refresh token with new one
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      return {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: storedToken.user,
          accessToken,
          refreshToken: newRefreshToken
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
    try {
      // Delete refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });

      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      return {
        success: true,
        message: 'Logout successful' // Always return success for security
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, passwordHash: true }
      });

      if (!user) {
        const error: AppError = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        const error: AppError = new Error('Current password is incorrect');
        error.statusCode = 400;
        throw error;
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedNewPassword }
      });

      // Invalidate all refresh tokens for this user
      await prisma.refreshToken.deleteMany({
        where: { userId }
      });

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        const error: AppError = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateData: Partial<User>) {
    try {
      const allowedFields = ['fullName', 'phone'];
      const filteredData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj: Record<string, any>, key) => {
          obj[key] = updateData[key as keyof User];
          return obj;
        }, {} as Record<string, any>);

      const user = await prisma.user.update({
        where: { id: userId },
        data: filteredData,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          emailVerified: true,
          updatedAt: true
        }
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        data: user
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(userId: string, refreshToken: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt
      }
    });
  }

  /**
   * Cleanup expired refresh tokens
   */
  async cleanupExpiredTokens() {
    await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
  }
}