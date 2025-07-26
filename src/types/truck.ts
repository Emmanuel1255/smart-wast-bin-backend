// src/types/truck.ts
export interface CreateTruckRequest {
    licensePlate: string;
    model?: string;
    capacity?: number; // in liters or kg
    fuelType?: string;
    year?: number;
    isActive?: boolean;
  }
  
  export interface UpdateTruckRequest {
    licensePlate?: string;
    model?: string;
    capacity?: number;
    fuelType?: string;
    year?: number;
    isActive?: boolean;
  }
  
  export interface TruckResponse {
    id: string;
    licensePlate: string;
    model?: string;
    capacity?: number;
    fuelType?: string;
    year?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      drivers: number;
    };
    drivers?: {
      id: string;
      user: {
        fullName: string;
      };
      status: string;
    }[];
  }
  
  export interface TruckListQuery {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
  }