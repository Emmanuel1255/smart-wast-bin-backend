// src/types/pickup.ts
import { PickupStatus } from '@prisma/client';

export interface CreatePickupRequest {
  binId: string;
  driverId?: string; // Optional - admin can assign, otherwise auto-assign
  scheduledAt?: Date;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
  pickupType?: 'SCHEDULED' | 'ON_DEMAND' | 'EMERGENCY';
}

export interface UpdatePickupRequest {
  driverId?: string;
  scheduledAt?: Date;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
  status?: PickupStatus;
}

export interface PickupStatusUpdate {
  status: PickupStatus;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface PickupResponse {
  id: string;
  status: PickupStatus;
  priority: string;
  pickupType: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  bin: {
    id: string;
    binCode: string;
    location: string;
    latitude: number;
    longitude: number;
    currentLevel: number;
    status: string;
  };
  driver?: {
    id: string;
    user: {
      fullName: string;
      phone?: string;
    };
    truck?: {
      licensePlate: string;
      model?: string;
    };
    status: string;
  };
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  estimatedDuration?: number; // in minutes
  actualDuration?: number; // in minutes
}

export interface PickupListQuery {
  page?: number;
  limit?: number;
  status?: PickupStatus;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  pickupType?: 'SCHEDULED' | 'ON_DEMAND' | 'EMERGENCY';
  driverId?: string;
  binId?: string;
  userId?: string;
  scheduledDate?: string; // YYYY-MM-DD format
  startDate?: string;
  endDate?: string;
}

export interface PickupStatsResponse {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  averageCompletionTime: number; // in minutes
  completionRate: number; // percentage
  onTimeRate: number; // percentage
  totalToday: number;
  totalThisWeek: number;
  totalThisMonth: number;
}

export interface AssignDriverRequest {
  driverId: string;
  estimatedDuration?: number;
  scheduledAt?: Date;
}

export interface PickupRouteOptimization {
  driverId: string;
  pickupIds: string[];
  startLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface OptimizedRoute {
  routeId: string;
  driverId: string;
  totalDistance: number;
  estimatedDuration: number;
  pickups: {
    pickupId: string;
    order: number;
    estimatedArrival: Date;
    bin: {
      id: string;
      binCode: string;
      location: string;
      latitude: number;
      longitude: number;
    };
  }[];
}

export interface PickupNotification {
  type: 'ASSIGNMENT' | 'STATUS_CHANGE' | 'REMINDER' | 'EMERGENCY';
  pickupId: string;
  message: string;
  recipients: string[];
  channel: 'SMS' | 'EMAIL' | 'PUSH' | 'ALL';
}