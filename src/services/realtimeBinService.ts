// src/services/realtimeBinService.ts
import { Server as SocketIOServer } from 'socket.io';
import { BinService } from '../services/binService';
import { BinSensorDataRequest } from '@/types/bin';

export class RealtimeBinService {
  private io: SocketIOServer;
  private binService: BinService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.binService = new BinService();
  }

  /**
   * Initialize real-time bin monitoring
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join rooms based on user role
      socket.on('join-room', (data) => {
        const { userRole, userId } = data;
        
        if (userRole === 'ADMIN') {
          socket.join('admin-room');
        } else if (userRole === 'DRIVER') {
          socket.join('driver-room');
        } else {
          socket.join(`user-${userId}`);
        }
      });

      // Handle bin level updates from IoT devices
      socket.on('bin-level-update', async (data) => {
        try {
          await this.handleBinLevelUpdate(data);
        } catch (error) {
          console.error('Error handling bin level update:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Handle bin level updates from IoT devices
   */
  async handleBinLevelUpdate(data: { binCode: string; sensorData: BinSensorDataRequest }) {
    try {
      const { binCode, sensorData } = data;

      // Update sensor data in database
      await this.binService.updateSensorData(binCode, sensorData);

      // Get updated bin information
      const updatedBin = await this.getBinByCode(binCode);

      if (updatedBin) {
        // Broadcast to admin room
        this.io.to('admin-room').emit('bin-updated', {
          type: 'LEVEL_UPDATE',
          bin: updatedBin,
          timestamp: new Date()
        });

        // Broadcast to drivers if bin is full
        if (updatedBin.status === 'FULL') {
          this.io.to('driver-room').emit('bin-full-alert', {
            type: 'FULL_ALERT',
            bin: updatedBin,
            timestamp: new Date()
          });
        }

        // Broadcast to bin owner
        if (updatedBin.user?.id) {
          this.io.to(`user-${updatedBin.user.id}`).emit('bin-updated', {
            type: 'LEVEL_UPDATE',
            bin: updatedBin,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error in handleBinLevelUpdate:', error);
    }
  }

  /**
   * Broadcast bin status change
   */
  async broadcastBinStatusChange(binId: string, oldStatus: string, newStatus: string) {
    try {
      const bin = await this.binService.getBinById(binId, 'ADMIN', '');

      const updateData = {
        type: 'STATUS_CHANGE',
        bin,
        oldStatus,
        newStatus,
        timestamp: new Date()
      };

      // Broadcast to all relevant parties
      this.io.to('admin-room').emit('bin-status-changed', updateData);
      this.io.to('driver-room').emit('bin-status-changed', updateData);

      if (bin.user?.id) {
        this.io.to(`user-${bin.user.id}`).emit('bin-status-changed', updateData);
      }
    } catch (error) {
      console.error('Error broadcasting bin status change:', error);
    }
  }

  /**
   * Send emergency alerts
   */
  broadcastEmergencyAlert(message: string, binId?: string) {
    const alertData = {
      type: 'EMERGENCY',
      message,
      binId,
      timestamp: new Date()
    };

    this.io.to('admin-room').emit('emergency-alert', alertData);
    this.io.to('driver-room').emit('emergency-alert', alertData);
  }

  /**
   * Get bin by code (helper method)
   */
  private async getBinByCode(binCode: string) {
    try {
      // This is a simplified version - you might want to add this method to BinService
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const bin = await prisma.bin.findUnique({
        where: { binCode },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      });

      return bin;
    } catch (error) {
      console.error('Error getting bin by code:', error);
      return null;
    }
  }
}