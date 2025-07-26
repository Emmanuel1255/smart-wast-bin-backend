// src/utils/jwt.ts (updated)
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { TokenPayload } from '@/types/auth';

export const generateTokens = (payload: TokenPayload) => {
  const accessToken = jwt.sign(
    payload,
    env.JWT_SECRET as string,
    { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
  );

  const refreshToken = jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET as string,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const err = new Error('Access token expired');
      (err as any).statusCode = 401;
      throw err;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      const err = new Error('Invalid access token');
      (err as any).statusCode = 401;
      throw err;
    }
    throw error;
  }
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const err = new Error('Refresh token expired');
      (err as any).statusCode = 401;
      throw err;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      const err = new Error('Invalid refresh token');
      (err as any).statusCode = 401;
      throw err;
    }
    throw error;
  }
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};