// src/types/driver.ts
import { DriverStatus, UserRole } from '@prisma/client';

export interface CreateDriverRequest {
  userId?: string; // Admin can assign to any user, or create new user
  email?: string;  // If creating new user
  password?: string; // If creating new user
  fullName?: string; // If creating new user
  phone?: string;
  driverLicense: string;
  truckId?: string;
  shiftStart?: string; // Format: "HH:MM"
  shiftEnd?: string;   // Format: "HH:MM"
}

export interface UpdateDriverRequest {
  driverLicense?: string;
  truckId?: string;
  shiftStart?: string;
  shiftEnd?: string;
  isAvailable?: boolean;
}

export interface DriverStatusUpdate {
  status: DriverStatus;
  currentLatitude?: number;
  currentLongitude?: number;
}

export interface DriverLocationUpdate {
  latitude: number;
  longitude: number;
}

export interface DriverResponse {
  id: string;
  driverLicense: string;
  status: DriverStatus;
  currentLatitude?: number;
  currentLongitude?: number;
  shiftStart?: string;
  shiftEnd?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    isActive: boolean;
  };
  truck?: {
    id: string;
    licensePlate: string;
    model?: string;
    capacity?: number;
  };
  _count?: {
    routes: number;
    pickups: number;
  };
}

export interface DriverListQuery {
  page?: number;
  limit?: number;
  status?: DriverStatus;
  isAvailable?: boolean;
  truckId?: string;
  search?: string; // Search by name or license
}

export interface DriverStatsResponse {
  total: number;
  online: number;
  offline: number;
  busy: number;
  onBreak: number;
  available: number;
  totalPickupsToday: number;
  totalPickupsThisWeek: number;
  averagePickupsPerDriver: number;
}

export interface NearbyDriversQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers, default 10
  limit?: number;
  status?: DriverStatus;
}

export interface DriverPerformanceResponse {
  driverId: string;
  totalPickups: number;
  completedPickups: number;
  cancelledPickups: number;
  averageTimePerPickup: number; // in minutes
  totalDistance: number; // in kilometers
  fuelEfficiency: number;
  rating: number;
  lastActiveDate: Date;
}