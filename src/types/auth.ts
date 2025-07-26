// src/types/auth.ts
export interface RegisterRequest {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: 'USER' | 'DRIVER' | 'ADMIN';
  }
  
  export interface LoginRequest {
    email: string;
    password: string;
  }
  
  export interface RefreshTokenRequest {
    refreshToken: string;
  }
  
  export interface ForgotPasswordRequest {
    email: string;
  }
  
  export interface ResetPasswordRequest {
    token: string;
    password: string;
  }
  
  export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
  }
  
  export interface AuthResponse {
    success: boolean;
    message: string;
    data?: {
      user: {
        id: string;
        email: string;
        fullName: string;
        role: string;
        isActive: boolean;
        emailVerified: boolean;
      };
      accessToken: string;
      refreshToken: string;
    };
  }
  
  export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
  }