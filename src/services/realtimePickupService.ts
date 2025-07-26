// src/services/realtimePickupService.ts
import { Server as SocketIOServer } from 'socket.io';
import { PickupService } from '../services/pickupService';
import { PickupNotification } from '@/types/pickup';

export class RealtimePickupService {
  private io: SocketIOServer;
  private pickupService: PickupService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.pickupService = new PickupService();
  }

  /**
   * Initialize real-time pickup notifications
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`📋 Pickup client connected: ${socket.id}`);

      // Handle pickup status updates
      socket.on('pickup-status-update', async (data) => {
        try {
          await this.handlePickupStatusUpdate(data);
        } catch (error) {
          console.error('Error handling pickup status update:', error);
        }
      });

      // Handle pickup creation
      socket.on('pickup-created', async (data) => {
        try {
          await this.handlePickupCreated(data);
        } catch (error) {
          console.error('Error handling pickup creation:', error);
        }
      });

      // Handle driver assignment
      socket.on('driver-assigned', async (data) => {
        try {
          await this.handleDriverAssigned(data);
        } catch (error) {
          console.error('Error handling driver assignment:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log(`📋 Pickup client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Handle pickup status updates
   */
  async handlePickupStatusUpdate(data: { pickupId: string; status: string; driverId?: string }) {
    try {
      const { pickupId, status, driverId } = data;

      // Get pickup details
      const pickup = await this.pickupService.getPickupById(pickupId, 'ADMIN', '');

      // Broadcast to relevant parties
      const updateData = {
        type: 'PICKUP_STATUS_UPDATE',
        pickup: {
          id: pickup.id,
          status,
          bin: pickup.bin,
          driver: pickup.driver
        },
        timestamp: new Date()
      };

      // Notify admin dashboard
      this.io.to('admin-room').emit('pickup-status-changed', updateData);

      // Notify assigned driver
      if (pickup.driver?.id) {
        this.io.to(`driver-${pickup.driver.id}`).emit('pickup-status-changed', updateData);
      }

      // Notify bin owner
      this.io.to(`user-${pickup.createdBy.id}`).emit('pickup-status-changed', updateData);

      console.log(`📋 Pickup ${pickupId} status updated to: ${status}`);
    } catch (error) {
      console.error('Error in handlePickupStatusUpdate:', error);
    }
  }

  /**
   * Handle new pickup creation
   */
  async handlePickupCreated(data: { pickupId: string }) {
    try {
      const pickup = await this.pickupService.getPickupById(data.pickupId, 'ADMIN', '');

      const notificationData = {
        type: 'PICKUP_CREATED',
        pickup: {
          id: pickup.id,
          priority: pickup.priority,
          bin: pickup.bin,
          scheduledAt: pickup.scheduledAt
        },
        timestamp: new Date()
      };

      // Notify admin dashboard
      this.io.to('admin-room').emit('pickup-created', notificationData);

      // If high priority or urgent, notify all available drivers
      if (['HIGH', 'URGENT'].includes(pickup.priority)) {
        this.io.to('driver-room').emit('urgent-pickup-created', notificationData);
      }

      console.log(`📋 New pickup created: ${pickup.id} (${pickup.priority})`);
    } catch (error) {
      console.error('Error in handlePickupCreated:', error);
    }
  }

  /**
   * Handle driver assignment to pickup
   */
  async handleDriverAssigned(data: { pickupId: string; driverId: string }) {
    try {
      const pickup = await this.pickupService.getPickupById(data.pickupId, 'ADMIN', '');

      const assignmentData = {
        type: 'DRIVER_ASSIGNED',
        pickup: {
          id: pickup.id,
          bin: pickup.bin,
          scheduledAt: pickup.scheduledAt,
          priority: pickup.priority
        },
        driver: pickup.driver,
        timestamp: new Date()
      };

      // Notify assigned driver
      this.io.to(`driver-${data.driverId}`).emit('pickup-assigned', assignmentData);

      // Notify admin dashboard
      this.io.to('admin-room').emit('pickup-assigned', assignmentData);

      // Notify bin owner
      this.io.to(`user-${pickup.createdBy.id}`).emit('pickup-assigned', assignmentData);

      console.log(`📋 Driver ${data.driverId} assigned to pickup ${data.pickupId}`);
    } catch (error) {
      console.error('Error in handleDriverAssigned:', error);
    }
  }

  /**
   * Broadcast pickup reminder
   */
  broadcastPickupReminder(pickupId: string, driverId: string, reminderType: 'UPCOMING' | 'OVERDUE') {
    const reminderData = {
      type: 'PICKUP_REMINDER',
      pickupId,
      reminderType,
      message: reminderType === 'UPCOMING' 
        ? 'You have an upcoming pickup in 15 minutes'
        : 'This pickup is overdue. Please complete as soon as possible.',
      timestamp: new Date()
    };

    this.io.to(`driver-${driverId}`).emit('pickup-reminder', reminderData);
  }

  /**
   * Broadcast emergency pickup alert
   */
  broadcastEmergencyPickup(pickupId: string, binLocation: string) {
    const emergencyData = {
      type: 'EMERGENCY_PICKUP',
      pickupId,
      message: `Emergency pickup required at ${binLocation}`,
      location: binLocation,
      timestamp: new Date()
    };

    // Notify all online drivers
    this.io.to('driver-room').emit('emergency-pickup-alert', emergencyData);

    // Notify admin dashboard
    this.io.to('admin-room').emit('emergency-pickup-alert', emergencyData);
  }

  /**
   * Send route completion notification
   */
  notifyRouteCompletion(driverId: string, routeData: any) {
    const completionData = {
      type: 'ROUTE_COMPLETED',
      routeData,
      message: 'Route completed successfully',
      timestamp: new Date()
    };

    this.io.to(`driver-${driverId}`).emit('route-completed', completionData);
    this.io.to('admin-room').emit('route-completed', {
      ...completionData,
      driverId
    });
  }

  /**
   * Send pickup statistics update
   */
  broadcastPickupStatsUpdate(stats: any) {
    this.io.to('admin-room').emit('pickup-stats-updated', {
      type: 'STATS_UPDATE',
      stats,
      timestamp: new Date()
    });
  }
}