// src/types/bin.ts
import { BinStatus } from '@prisma/client';

export interface CreateBinRequest {
  binCode: string;
  location: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  binType?: string;
  userId?: string; // For regular users, admin can assign to any user
}

export interface UpdateBinRequest {
  location?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  binType?: string;
  status?: BinStatus;
  isActive?: boolean;
}

export interface BinSensorDataRequest {
  fillLevel: number;
  weight?: number;
  temperature?: number;
  humidity?: number;
  batteryLevel?: number;
  signalStrength?: number;
}

export interface BinResponse {
  id: string;
  binCode: string;
  location: string;
  latitude: number;
  longitude: number;
  capacity: number;
  currentLevel: number;
  status: BinStatus;
  binType: string;
  lastEmptied?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  _count?: {
    sensorData: number;
  };
}

export interface BinListQuery {
  page?: number;
  limit?: number;
  status?: BinStatus;
  binType?: string;
  userId?: string;
  location?: string;
  nearLat?: number;
  nearLng?: number;
  radius?: number; // in kilometers
}

export interface BinStatsResponse {
  total: number;
  empty: number;
  low: number;
  medium: number;
  high: number;
  full: number;
  maintenance: number;
  outOfService: number;
  averageFillLevel: number;
}

export interface BinHistoryQuery {
  startDate?: string;
  endDate?: string;
  dataPoints?: number;
}

export interface NearbyBinsQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers, default 5
  limit?: number;
}