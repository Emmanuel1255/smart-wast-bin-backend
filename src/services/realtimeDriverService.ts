// src/services/realtimeDriverService.ts
import { Server as SocketIOServer } from 'socket.io';
import { DriverService } from '@/services/driverService';
import { DriverLocationUpdate } from '@/types/driver';

export class RealtimeDriverService {
  private io: SocketIOServer;
  private driverService: DriverService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.driverService = new DriverService();
  }

  /**
   * Initialize real-time driver tracking
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`🚛 Driver tracking client connected: ${socket.id}`);

      // Handle driver joining their room
      socket.on('join-driver-room', (data) => {
        const { driverId } = data;
        socket.join(`driver-${driverId}`);
        console.log(`Driver ${driverId} joined their room`);
      });

      // Handle driver location updates
      socket.on('driver-location-update', async (data) => {
        try {
          await this.handleDriverLocationUpdate(data);
        } catch (error) {
          console.error('Error handling driver location update:', error);
        }
      });

      // Handle driver status changes
      socket.on('driver-status-change', async (data) => {
        try {
          await this.handleDriverStatusChange(data);
        } catch (error) {
          console.error('Error handling driver status change:', error);
        }
      });

      // Handle driver check-in/check-out
      socket.on('driver-shift-update', async (data) => {
        try {
          await this.handleDriverShiftUpdate(data);
        } catch (error) {
          console.error('Error handling driver shift update:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log(`🚛 Driver tracking client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Handle driver location updates
   */
  async handleDriverLocationUpdate(data: { driverId: string; location: DriverLocationUpdate }) {
    try {
      const { driverId, location } = data;

      // Update location in database
      await this.driverService.updateDriverLocation(driverId, location, 'DRIVER', '');

      // Broadcast to admin dashboard
      this.io.to('admin-room').emit('driver-location-updated', {
        type: 'LOCATION_UPDATE',
        driverId,
        location,
        timestamp: new Date()
      });

      // Broadcast to other drivers in the area (for coordination)
      this.io.emit('nearby-driver-update', {
        type: 'DRIVER_NEARBY',
        driverId,
        location,
        timestamp: new Date()
      });

      console.log(`📍 Driver ${driverId} location updated:`, location);
    } catch (error) {
      console.error('Error in handleDriverLocationUpdate:', error);
    }
  }

  /**
   * Handle driver status changes
   */
  async handleDriverStatusChange(data: { driverId: string; status: string; location?: DriverLocationUpdate }) {
    try {
      const { driverId, status, location } = data;

      // Update status in database
      const statusUpdate = {
        status: status as any,
        currentLatitude: location?.latitude,
        currentLongitude: location?.longitude
      };

      await this.driverService.updateDriverStatus(driverId, statusUpdate, 'DRIVER', '');

      // Get updated driver info
      const updatedDriver = await this.driverService.getDriverById(driverId, 'ADMIN', '');

      // Broadcast to relevant parties
      this.io.to('admin-room').emit('driver-status-changed', {
        type: 'STATUS_CHANGE',
        driver: updatedDriver,
        oldStatus: status,
        newStatus: updatedDriver.status,
        timestamp: new Date()
      });

      // Notify driver
      this.io.to(`driver-${driverId}`).emit('status-updated', {
        type: 'STATUS_CONFIRMED',
        status: updatedDriver.status,
        timestamp: new Date()
      });

      console.log(`📡 Driver ${driverId} status changed to:`, status);
    } catch (error) {
      console.error('Error in handleDriverStatusChange:', error);
    }
  }

  /**
   * Handle driver shift updates (check-in/check-out)
   */
  async handleDriverShiftUpdate(data: { driverId: string; action: 'check-in' | 'check-out'; location?: DriverLocationUpdate }) {
    try {
      const { driverId, action, location } = data;

      const status = action === 'check-in' ? 'ONLINE' : 'OFFLINE';
      
      // Update status
      const statusUpdate = {
        status: status as any,
        currentLatitude: location?.latitude,
        currentLongitude: location?.longitude
      };

      await this.driverService.updateDriverStatus(driverId, statusUpdate, 'DRIVER', '');

      // Broadcast shift change
      this.io.to('admin-room').emit('driver-shift-changed', {
        type: 'SHIFT_CHANGE',
        driverId,
        action,
        status,
        timestamp: new Date()
      });

      console.log(`⏰ Driver ${driverId} ${action}`);
    } catch (error) {
      console.error('Error in handleDriverShiftUpdate:', error);
    }
  }

  /**
   * Broadcast driver assignment notification
   */
  broadcastDriverAssignment(driverId: string, routeId: string, pickupId?: string) {
    this.io.to(`driver-${driverId}`).emit('assignment-received', {
      type: 'NEW_ASSIGNMENT',
      routeId,
      pickupId,
      message: 'You have been assigned a new route',
      timestamp: new Date()
    });

    // Also notify admin dashboard
    this.io.to('admin-room').emit('driver-assigned', {
      type: 'DRIVER_ASSIGNED',
      driverId,
      routeId,
      pickupId,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast emergency alert to nearby drivers
   */
  broadcastEmergencyToDrivers(location: DriverLocationUpdate, message: string, radius: number = 10) {
    this.io.emit('emergency-alert-drivers', {
      type: 'EMERGENCY_NEARBY',
      location,
      message,
      radius,
      timestamp: new Date()
    });
  }

  /**
   * Send route completion notification
   */
  notifyRouteCompletion(driverId: string, routeId: string, completionData: any) {
    this.io.to(`driver-${driverId}`).emit('route-completed', {
      type: 'ROUTE_COMPLETED',
      routeId,
      completionData,
      timestamp: new Date()
    });

    this.io.to('admin-room').emit('route-completed', {
      type: 'ROUTE_COMPLETED',
      driverId,
      routeId,
      completionData,
      timestamp: new Date()
    });
  }

  /**
   * Send traffic/route update to driver
   */
  sendTrafficUpdate(driverId: string, trafficData: any) {
    this.io.to(`driver-${driverId}`).emit('traffic-update', {
      type: 'TRAFFIC_UPDATE',
      data: trafficData,
      timestamp: new Date()
    });
  }
}