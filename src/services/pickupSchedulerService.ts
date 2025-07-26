// src/services/pickupSchedulerService.ts
import { PrismaClient } from '@prisma/client';
import { PickupService } from '../services/pickupService';
import { NotificationService } from '../services/notificationService';

const prisma = new PrismaClient();

export class PickupSchedulerService {
  private pickupService: PickupService;
  private notificationService: NotificationService;

  constructor() {
    this.pickupService = new PickupService();
    this.notificationService = new NotificationService();
  }

  /**
   * Check for bins that need pickup and create automatic requests
   */
  async checkAndCreateAutomaticPickups(): Promise<void> {
    try {
      console.log('🕐 Running automatic pickup check...');

      // Find bins that are 80% or more full and don't have pending pickups
      const fullBins = await prisma.bin.findMany({
        where: {
          currentLevel: { gte: 80 },
          isActive: true,
          pickups: {
            none: {
              status: {
                in: ['SCHEDULED', 'IN_PROGRESS']
              }
            }
          }
        },
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

      console.log(`📊 Found ${fullBins.length} bins requiring pickup`);

      for (const bin of fullBins) {
        try {
          // Determine priority based on fill level
          let priority = 'HIGH';
          if (bin.currentLevel >= 95) {
            priority = 'URGENT';
          } else if (bin.currentLevel >= 90) {
            priority = 'HIGH';
          }

          // Create automatic pickup request
          await this.pickupService.createPickup(
            {
              binId: bin.id,
              priority: priority as any,
              pickupType: 'SCHEDULED',
              notes: `Automatic pickup - bin ${bin.currentLevel}% full`
            },
            'ADMIN',
            bin.userId || 'system'
          );

          console.log(`📋 Created automatic pickup for bin ${bin.binCode} (${bin.currentLevel}% full)`);
        } catch (error) {
          console.error(`Error creating pickup for bin ${bin.binCode}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in automatic pickup check:', error);
    }
  }

  /**
   * Send pickup reminders to drivers
   */
  async sendPickupReminders(): Promise<void> {
    try {
      console.log('🔔 Sending pickup reminders...');

      const now = new Date();
      const reminderTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

      // Find pickups scheduled within the next 15 minutes
      const upcomingPickups = await prisma.pickup.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            gte: now,
            lte: reminderTime
          },
          driverId: { not: null }
        },
        include: {
          driver: {
            include: {
              user: {
                select: {
                  phone: true
                }
              }
            }
          },
          bin: {
            select: {
              location: true
            }
          }
        }
      });

      for (const pickup of upcomingPickups) {
        if (pickup.driver?.user.phone) {
          await this.notificationService.sendPickupReminder(
            pickup.id,
            pickup.driver.user.phone,
            pickup.scheduledAt!
          );
        }
      }

      console.log(`🔔 Sent ${upcomingPickups.length} pickup reminders`);
    } catch (error) {
      console.error('Error sending pickup reminders:', error);
    }
  }

  /**
   * Check for overdue pickups
   */
  async checkOverduePickups(): Promise<void> {
    try {
      console.log('⏰ Checking for overdue pickups...');

      const now = new Date();
      const overdueThreshold = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      const overduePickups = await prisma.pickup.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lt: overdueThreshold },
          driverId: { not: null }
        },
        include: {
          driver: {
            include: {
              user: {
                select: {
                  fullName: true,
                  phone: true
                }
              }
            }
          },
          bin: {
            select: {
              binCode: true,
              location: true
            }
          }
        }
      });

      for (const pickup of overduePickups) {
        // Update pickup priority to urgent
        await prisma.pickup.update({
          where: { id: pickup.id },
          data: { priority: 'URGENT' }
        });

        // Send notification to driver
        if (pickup.driver?.user.phone) {
          const message = `OVERDUE: Pickup at ${pickup.bin.location} is now ${Math.round((now.getTime() - pickup.scheduledAt!.getTime()) / (1000 * 60))} minutes overdue.`;
          
          await this.notificationService.sendPickupNotification({
            type: 'REMINDER',
            pickupId: pickup.id,
            message,
            recipients: [pickup.driver.user.phone],
            channel: 'SMS'
          });
        }

        console.log(`⏰ Marked pickup ${pickup.id} as overdue`);
      }

      console.log(`⏰ Found ${overduePickups.length} overdue pickups`);
    } catch (error) {
      console.error('Error checking overdue pickups:', error);
    }
  }

  /**
   * Start automated scheduling (run this from a cron job or scheduler)
   */
  startScheduler(): void {
    // Check for automatic pickups every 30 minutes
    setInterval(() => {
      this.checkAndCreateAutomaticPickups();
    }, 30 * 60 * 1000);

    // Send reminders every 5 minutes
    setInterval(() => {
      this.sendPickupReminders();
    }, 5 * 60 * 1000);

    // Check overdue pickups every 10 minutes
    setInterval(() => {
      this.checkOverduePickups();
    }, 10 * 60 * 1000);

    console.log('🕐 Pickup scheduler started');
  }
}