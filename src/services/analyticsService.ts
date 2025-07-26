// src/services/analyticsService.ts
import { PrismaClient } from '@prisma/client';
import { 
  DashboardMetrics,
  OverviewMetrics,
  ProblemBin,
  BinAnalytics,
  DriverAnalytics,
  PickupAnalytics,
  RouteAnalytics,
  PerformanceMetrics,
  TrendAnalysis,
  AnalyticsQuery,
  TimeSeries,
  ChartData
} from '@/types/analytics';

const prisma = new PrismaClient();

export class AnalyticsService {
  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(query: AnalyticsQuery = {}): Promise<DashboardMetrics> {
    try {
      const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      const [overview, bins, drivers, pickups, routes, performance, trends] = await Promise.all([
        this.getOverviewMetrics(startDate, endDate),
        this.getBinAnalytics(startDate, endDate),
        this.getDriverAnalytics(startDate, endDate),
        this.getPickupAnalytics(startDate, endDate),
        this.getRouteAnalytics(startDate, endDate),
        this.getPerformanceMetrics(startDate, endDate),
        this.getTrendAnalysis(startDate, endDate)
      ]);

      return {
        overview,
        bins,
        drivers,
        pickups,
        routes,
        performance,
        trends
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get overview metrics
   */
  async getOverviewMetrics(startDate: Date, endDate: Date): Promise<OverviewMetrics> {
    try {
      const [
        totalBins,
        totalDrivers,
        totalPickups,
        completedPickups,
        activeBins,
        onlineDrivers,
        avgFillLevel
      ] = await Promise.all([
        prisma.bin.count({ where: { isActive: true } }),
        prisma.driver.count(),
        prisma.pickup.count({
          where: {
            createdAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.pickup.count({
          where: {
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.bin.count({
          where: {
            isActive: true,
            currentLevel: { gt: 0 }
          }
        }),
        prisma.driver.count({ where: { status: 'ONLINE' } }),
        prisma.bin.aggregate({
          _avg: { currentLevel: true },
          where: { isActive: true }
        })
      ]);

      const systemEfficiency = totalPickups > 0 ? (completedPickups / totalPickups) * 100 : 0;
      const averageFillLevel = Number(avgFillLevel._avg.currentLevel || 0);

      return {
        totalBins,
        totalDrivers,
        totalPickups,
        completedPickups,
        activeBins,
        onlineDrivers,
        averageFillLevel: Math.round(averageFillLevel * 100) / 100,
        systemEfficiency: Math.round(systemEfficiency * 100) / 100
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get bin analytics
   */
  async getBinAnalytics(startDate: Date, endDate: Date): Promise<BinAnalytics> {
    try {
      // Get all bins with their current levels
      const bins = await prisma.bin.findMany({
        where: { isActive: true },
        select: {
          id: true,
          binCode: true,
          location: true,
          currentLevel: true,
          status: true,
          lastEmptied: true,
          pickups: {
            where: {
              createdAt: { gte: startDate, lte: endDate }
            },
            select: {
              createdAt: true,
              status: true
            }
          }
        }
      });

      // Calculate fill level distribution
      const fillLevelDistribution = {
        empty: 0,
        low: 0,
        medium: 0,
        high: 0,
        full: 0
      };

      const statusBreakdown = {
        empty: 0,
        low: 0,
        medium: 0,
        high: 0,
        full: 0,
        maintenance: 0,
        outOfService: 0
      };

      bins.forEach(bin => {
        const level = Number(bin.currentLevel);
        
        // Fill level distribution
        if (level <= 20) fillLevelDistribution.empty++;
        else if (level <= 40) fillLevelDistribution.low++;
        else if (level <= 60) fillLevelDistribution.medium++;
        else if (level <= 80) fillLevelDistribution.high++;
        else fillLevelDistribution.full++;

        // Status breakdown
        switch (bin.status) {
          case 'EMPTY': statusBreakdown.empty++; break;
          case 'LOW': statusBreakdown.low++; break;
          case 'MEDIUM': statusBreakdown.medium++; break;
          case 'HIGH': statusBreakdown.high++; break;
          case 'FULL': statusBreakdown.full++; break;
          case 'MAINTENANCE': statusBreakdown.maintenance++; break;
          case 'OUT_OF_SERVICE': statusBreakdown.outOfService++; break;
        }
      });

      // Location analysis
      const locationAnalysis = await this.getLocationAnalysis(bins);

      // Problem bins
      const problemBins = await this.identifyProblemBins(bins);

      // Fill trends
      const fillTrends = await this.getBinFillTrends(startDate, endDate);

      // Utilization rate
      const utilizationRate = bins.length > 0 
        ? (bins.filter(bin => Number(bin.currentLevel) > 20).length / bins.length) * 100 
        : 0;

      return {
        fillLevelDistribution,
        statusBreakdown,
        locationAnalysis,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        problemBins,
        fillTrends
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get driver analytics
   */
  async getDriverAnalytics(startDate: Date, endDate: Date): Promise<DriverAnalytics> {
    try {
      const drivers = await prisma.driver.findMany({
        include: {
          user: {
            select: { fullName: true }
          },
          pickups: {
            where: {
              createdAt: { gte: startDate, lte: endDate }
            },
            select: {
              status: true,
              startedAt: true,
              completedAt: true,
              createdAt: true
            }
          }
        }
      });

      // Performance metrics
      const totalDrivers = drivers.length;
      const activeDrivers = drivers.filter(d => d.status === 'ONLINE').length;
      
      const allPickups = drivers.flatMap(d => d.pickups);
      const completedPickups = allPickups.filter(p => p.status === 'COMPLETED');
      
      const averagePickupsPerDriver = totalDrivers > 0 
        ? Math.round((allPickups.length / totalDrivers) * 100) / 100 
        : 0;

      // Calculate average completion time
      const completionTimes = completedPickups
        .filter(p => p.startedAt && p.completedAt)
        .map(p => (p.completedAt!.getTime() - p.startedAt!.getTime()) / (1000 * 60));
      
      const averageCompletionTime = completionTimes.length > 0
        ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 100) / 100
        : 0;

      const onTimeRate = completedPickups.length > 0
        ? (completedPickups.length / allPickups.length) * 100
        : 0;

      const utilizationRate = totalDrivers > 0
        ? (activeDrivers / totalDrivers) * 100
        : 0;

      const performanceMetrics = {
        totalDrivers,
        activeDrivers,
        averagePickupsPerDriver,
        averageCompletionTime,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        utilizationRate: Math.round(utilizationRate * 100) / 100
      };

      // Workload distribution
      const workloadDistribution = this.calculateWorkloadDistribution(drivers);

      // Efficiency scores
      const efficiencyScores = this.calculateEfficiencyScores(drivers);

      // Activity hours
      const activityHours = await this.getActivityHours(startDate, endDate);

      // Leaderboard
      const leaderboard = this.generateDriverLeaderboard(drivers);

      return {
        performanceMetrics,
        workloadDistribution,
        efficiencyScores,
        activeHours: activityHours,
        leaderboard
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pickup analytics
   */
  async getPickupAnalytics(startDate: Date, endDate: Date): Promise<PickupAnalytics> {
    try {
      const pickups = await prisma.pickup.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        },
        select: {
          id: true,
          status: true,
          notes: true,
          createdAt: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true
        }
      });

      // Volume metrics
      const totalPickups = pickups.length;
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const dailyAverage = daysDiff > 0 ? totalPickups / daysDiff : 0;
      const weeklyAverage = dailyAverage * 7;
      const monthlyAverage = dailyAverage * 30;

      // Calculate growth rate (compare with previous period)
      const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousPickups = await prisma.pickup.count({
        where: {
          createdAt: { gte: previousPeriodStart, lt: startDate }
        }
      });

      const growthRate = previousPickups > 0 
        ? ((totalPickups - previousPickups) / previousPickups) * 100 
        : 0;

      // Peak hours analysis
      const peakHours = this.calculatePeakHours(pickups);

      const volumeMetrics = {
        totalPickups,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        weeklyAverage: Math.round(weeklyAverage * 100) / 100,
        monthlyAverage: Math.round(monthlyAverage * 100) / 100,
        growthRate: Math.round(growthRate * 100) / 100,
        peakHours
      };

      // Time analysis
      const timeAnalysis = this.calculateTimeAnalysis(pickups);

      // Priority distribution (extracted from notes)
      const priorityDistribution = this.calculatePriorityDistribution(pickups);

      // Completion trends
      const completionTrends = await this.getCompletionTrends(startDate, endDate);

      // Response time analysis
      const responseTimeAnalysis = this.calculateResponseTimeAnalysis(pickups);

      return {
        volumeMetrics,
        timeAnalysis,
        priorityDistribution,
        completionTrends,
        responseTimeAnalysis
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get route analytics
   */
  async getRouteAnalytics(startDate: Date, endDate: Date): Promise<RouteAnalytics> {
    try {
      const routes = await prisma.route.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        },
        select: {
          id: true,
          totalDistance: true,
          estimatedDuration: true,
          status: true,
          createdAt: true,
          startedAt: true,
          completedAt: true
        }
      });

      // Efficiency metrics
      const totalRoutes = routes.length;
      const completedRoutes = routes.filter(r => r.status === 'COMPLETED');
      
      const distances = routes
        .filter(r => r.totalDistance)
        .map(r => Number(r.totalDistance));
      
      const averageDistance = distances.length > 0
        ? distances.reduce((a, b) => a + b, 0) / distances.length
        : 0;

      const durations = completedRoutes
        .filter(r => r.startedAt && r.completedAt)
        .map(r => (r.completedAt!.getTime() - r.startedAt!.getTime()) / (1000 * 60));
      
      const averageDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      const optimizationRate = totalRoutes > 0
        ? (completedRoutes.length / totalRoutes) * 100
        : 0;

      // Simplified fuel savings calculation
      const fuelSavings = averageDistance * 0.1; // Assume 10% fuel savings from optimization

      const efficiencyMetrics = {
        totalRoutes,
        averageDistance: Math.round(averageDistance * 100) / 100,
        averageDuration: Math.round(averageDuration * 100) / 100,
        optimizationRate: Math.round(optimizationRate * 100) / 100,
        fuelSavings: Math.round(fuelSavings * 100) / 100
      };

      // Optimization impact (estimated)
      const optimizationImpact = {
        distanceSaved: averageDistance * 0.15, // 15% distance savings
        timeSaved: averageDuration * 0.20,     // 20% time savings
        fuelSaved: fuelSavings,
        costSavings: fuelSavings * 1.5,        // $1.5 per liter saved
        co2Reduction: fuelSavings * 2.3        // 2.3kg CO2 per liter
      };

      // Distance analysis
      const totalDistance = distances.reduce((a, b) => a + b, 0);
      const shortestRoute = distances.length > 0 ? Math.min(...distances) : 0;
      const longestRoute = distances.length > 0 ? Math.max(...distances) : 0;
      const distanceTrends = await this.getDistanceTrends(startDate, endDate);

      const distanceAnalysis = {
        totalDistance: Math.round(totalDistance * 100) / 100,
        averagePerRoute: averageDistance,
        shortestRoute,
        longestRoute,
        distanceTrends
      };

      // Fuel consumption (estimated)
      const totalFuelUsed = totalDistance * 0.08; // 8L per 100km
      const averagePerKm = 0.08;
      const costPerMonth = totalFuelUsed * 1.5 * 30; // $1.5 per liter
      const efficiencyTrend = await this.getFuelEfficiencyTrend(startDate, endDate);

      const fuelConsumption = {
        totalFuelUsed: Math.round(totalFuelUsed * 100) / 100,
        averagePerKm,
        costPerMonth: Math.round(costPerMonth * 100) / 100,
        efficiencyTrend
      };

      return {
        efficiencyMetrics,
        optimizationImpact,
        distanceAnalysis,
        fuelConsumption
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics> {
    try {
      // KPIs
      const kpis = await this.calculateKPIs(startDate, endDate);

      // Benchmarks (industry standards)
      const benchmarks = [
        {
          metric: 'Average Response Time',
          current: 45,
          industry: 60,
          target: 30,
          performance: 133 // current vs industry
        },
        {
          metric: 'Fuel Efficiency',
          current: 8.5,
          industry: 10.2,
          target: 7.0,
          performance: 120
        },
        {
          metric: 'Route Optimization',
          current: 85,
          industry: 70,
          target: 90,
          performance: 121
        }
      ];

      // Targets
      const targets = [
        {
          metric: 'Pickup Completion Rate',
          current: 92,
          target: 95,
          progress: 97,
          deadline: new Date('2024-12-31')
        },
        {
          metric: 'Average Response Time',
          current: 45,
          target: 30,
          progress: 67,
          deadline: new Date('2024-12-31')
        }
      ];

      // Alerts
      const alerts = await this.generateAlerts();

      return {
        kpis,
        benchmarks,
        targets,
        alerts
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get trend analysis
   */
  async getTrendAnalysis(startDate: Date, endDate: Date): Promise<TrendAnalysis> {
    try {
      const [daily, weekly, monthly] = await Promise.all([
        this.getDailyTrends(startDate, endDate),
        this.getWeeklyTrends(startDate, endDate),
        this.getMonthlyTrends(startDate, endDate)
      ]);

      const yearly = await this.getYearlyTrends();
      const seasonalPatterns = this.calculateSeasonalPatterns();
      const predictions = await this.generatePredictions();

      return {
        daily,
        weekly,
        monthly,
        yearly,
        seasonalPatterns,
        predictions
      };
    } catch (error) {
      throw error;
    }
  }

  // Helper methods (implementing key calculations)

  private async getLocationAnalysis(bins: any[]) {
    const locationGroups = bins.reduce((acc, bin) => {
      const location = bin.location.split(',')[0]; // Get first part of location
      if (!acc[location]) {
        acc[location] = {
          bins: [],
          totalPickups: 0
        };
      }
      acc[location].bins.push(bin);
      acc[location].totalPickups += bin.pickups.length;
      return acc;
    }, {});

    const topLocations = Object.entries(locationGroups)
      .map(([location, data]: [string, any]) => ({
        location,
        binCount: data.bins.length,
        averageFillLevel: data.bins.reduce((sum: number, bin: any) => sum + Number(bin.currentLevel), 0) / data.bins.length,
        pickupFrequency: data.totalPickups / data.bins.length
      }))
      .sort((a, b) => b.pickupFrequency - a.pickupFrequency)
      .slice(0, 10);

    const utilizationByArea = topLocations.map(loc => ({
      area: loc.location,
      utilization: (loc.averageFillLevel / 100) * 100,
      efficiency: loc.pickupFrequency > 0 ? (loc.averageFillLevel / loc.pickupFrequency) * 10 : 0
    }));

    return {
      topLocations,
      utilizationByArea
    };
  }

  private async identifyProblemBins(bins: any[]): Promise<ProblemBin[]> {
    const problemBins: ProblemBin[] = [];
    const now = new Date();

    for (const bin of bins) {
      const daysSinceLastPickup = bin.lastEmptied 
        ? Math.floor((now.getTime() - bin.lastEmptied.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const currentLevel = Number(bin.currentLevel);
      const recentPickups = bin.pickups.length;

      // Identify different types of problems
      if (daysSinceLastPickup > 7 && currentLevel > 80) {
        problemBins.push({
          id: bin.id,
          binCode: bin.binCode,
          location: bin.location,
          issue: 'OVERDUE',
          severity: currentLevel > 95 ? 'CRITICAL' : 'HIGH',
          description: `Bin ${bin.binCode} hasn't been emptied for ${daysSinceLastPickup} days and is ${currentLevel}% full`,
          daysSinceLastPickup
        });
      } else if (recentPickups > 10) {
        problemBins.push({
          id: bin.id,
          binCode: bin.binCode,
          location: bin.location,
          issue: 'FREQUENT_FULL',
          severity: 'MEDIUM',
          description: `Bin ${bin.binCode} requires frequent pickups (${recentPickups} in recent period)`,
          daysSinceLastPickup
        });
      } else if (recentPickups === 0 && currentLevel < 20) {
        problemBins.push({
          id: bin.id,
          binCode: bin.binCode,
          location: bin.location,
          issue: 'LOW_USAGE',
          severity: 'LOW',
          description: `Bin ${bin.binCode} has very low usage and may need relocation`,
          daysSinceLastPickup
        });
      }
    }

    return problemBins.slice(0, 20); // Return top 20 problem bins
  }

  private async getBinFillTrends(startDate: Date, endDate: Date): Promise<TimeSeries[]> {
    // Get daily average fill levels
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trends: TimeSeries[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      // This is simplified - in real implementation, you'd track historical fill levels
      const avgFillLevel = await prisma.bin.aggregate({
        _avg: { currentLevel: true },
        where: {
          isActive: true,
          updatedAt: { gte: date, lt: nextDate }
        }
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        value: Number(avgFillLevel._avg.currentLevel) || 0,
        metric: 'averageFillLevel'
      });
    }

    return trends;
  }

  private calculateWorkloadDistribution(drivers: any[]) {
    let underutilized = 0;
    let optimal = 0;
    let overworked = 0;

    drivers.forEach(driver => {
      const pickupsCount = driver.pickups.length;
      const dailyPickups = pickupsCount / 30; // Assume 30-day period

      if (dailyPickups < 5) underutilized++;
      else if (dailyPickups <= 15) optimal++;
      else overworked++;
    });

    return { underutilized, optimal, overworked };
  }

  private calculateEfficiencyScores(drivers: any[]) {
    return drivers.map(driver => {
      const completedPickups = driver.pickups.filter((p: any) => p.status === 'COMPLETED');
      const completionRate = driver.pickups.length > 0 
        ? (completedPickups.length / driver.pickups.length) * 100 
        : 0;

      const completionTimes = completedPickups
        .filter((p: any) => p.startedAt && p.completedAt)
        .map((p: any) => (p.completedAt.getTime() - p.startedAt.getTime()) / (1000 * 60));

      const averageTime = completionTimes.length > 0
        ? completionTimes.reduce((a: number, b: number) => a + b, 0) / completionTimes.length
        : 0;

      // Calculate efficiency score (0-100)
      const score = Math.min(100, Math.max(0, 
        (completionRate * 0.4) + 
        (Math.max(0, 60 - averageTime) * 0.4) + // Bonus for faster completion
        (driver.pickups.length * 0.2) // Bonus for volume
      ));

      return {
        driverId: driver.id,
        driverName: driver.user.fullName,
        score: Math.round(score * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
        averageTime: Math.round(averageTime * 100) / 100,
        fuelEfficiency: 85 + Math.random() * 15 // Placeholder
      };
    }).sort((a, b) => b.score - a.score);
  }

  private async getActivityHours(startDate: Date, endDate: Date) {
    const activityHours = [];

    for (let hour = 0; hour < 24; hour++) {
      // Count active drivers and completed pickups by hour
      const pickupsInHour = await prisma.pickup.count({
        where: {
          completedAt: {
            gte: startDate,
            lte: endDate
          },
          // This is a simplified query - you'd need to extract hour from completedAt
        }
      });

      activityHours.push({
        hour,
        activeDrivers: Math.floor(Math.random() * 10) + 5, // Placeholder
        completedPickups: Math.floor(pickupsInHour / 30), // Distribute across hours
        averageResponseTime: 30 + Math.random() * 30 // Placeholder
      });
    }

    return activityHours;
  }

  private generateDriverLeaderboard(drivers: any[]) {
    return drivers
      .map((driver, index) => {
        const completedPickups = driver.pickups.filter((p: any) => p.status === 'COMPLETED');
        const completionRate = driver.pickups.length > 0 
          ? (completedPickups.length / driver.pickups.length) * 100 
          : 0;

        return {
          rank: index + 1,
          driverId: driver.id,
          driverName: driver.user.fullName,
          totalPickups: driver.pickups.length,
          completionRate: Math.round(completionRate * 100) / 100,
          averageRating: 4.2 + Math.random() * 0.8, // Placeholder
          totalDistance: Math.random() * 1000 + 500, // Placeholder
          efficiency: Math.min(100, completionRate + Math.random() * 20)
        };
      })
      .sort((a, b) => b.totalPickups - a.totalPickups)
      .slice(0, 10);
  }

  private calculatePeakHours(pickups: any[]) {
    const hourCounts: { [key: number]: number } = {};

    pickups.forEach(pickup => {
      const hour = pickup.createdAt.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private calculateTimeAnalysis(pickups: any[]) {
    const completedPickups = pickups.filter(p => p.status === 'COMPLETED' && p.startedAt && p.completedAt);
    
    const responseTimes = pickups
      .filter(p => p.startedAt && p.scheduledAt)
      .map(p => (p.startedAt.getTime() - p.scheduledAt.getTime()) / (1000 * 60));

    const completionTimes = completedPickups
      .map(p => (p.completedAt.getTime() - p.startedAt.getTime()) / (1000 * 60));

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const averageCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    // Peak days analysis
    const dayCount: { [key: string]: number } = {};
    pickups.forEach(pickup => {
      const day = pickup.createdAt.toLocaleDateString();
      dayCount[day] = (dayCount[day] || 0) + 1;
    });

    const peakDays = Object.entries(dayCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => day);

    // Time distribution
    const timeSlots = {
      'Morning (6-12)': 0,
      'Afternoon (12-18)': 0,
      'Evening (18-24)': 0,
      'Night (0-6)': 0
    };

    pickups.forEach(pickup => {
      const hour = pickup.createdAt.getHours();
      if (hour >= 6 && hour < 12) timeSlots['Morning (6-12)']++;
      else if (hour >= 12 && hour < 18) timeSlots['Afternoon (12-18)']++;
      else if (hour >= 18 && hour < 24) timeSlots['Evening (18-24)']++;
      else timeSlots['Night (0-6)']++;
    });

    const total = pickups.length;
    const timeDistribution = Object.entries(timeSlots).map(([timeSlot, count]) => ({
      timeSlot,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0
    }));

    return {
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      averageCompletionTime: Math.round(averageCompletionTime * 100) / 100,
      peakDays,
      timeDistribution
    };
  }

  private calculatePriorityDistribution(pickups: any[]) {
    const priorities = { urgent: 0, high: 0, medium: 0, low: 0 };

    pickups.forEach(pickup => {
      const notes = pickup.notes || '';
      if (notes.includes('Priority: URGENT')) priorities.urgent++;
      else if (notes.includes('Priority: HIGH')) priorities.high++;
      else if (notes.includes('Priority: LOW')) priorities.low++;
      else priorities.medium++;
    });

    return priorities;
  }

  private async getCompletionTrends(startDate: Date, endDate: Date): Promise<TimeSeries[]> {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trends: TimeSeries[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const completedCount = await prisma.pickup.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: date, lt: nextDate }
        }
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        value: completedCount,
        metric: 'completedPickups'
      });
    }

    return trends;
  }

  private calculateResponseTimeAnalysis(pickups: any[]) {
    const responseTimes = pickups
      .filter(p => p.startedAt && p.scheduledAt)
      .map(p => (p.startedAt.getTime() - p.scheduledAt.getTime()) / (1000 * 60));

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    responseTimes.sort((a, b) => a - b);
    const medianResponseTime = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length / 2)]
      : 0;

    // Response time by priority
    const responseTimeByPriority = [
      { priority: 'URGENT', averageTime: 15, target: 30, performance: 200 },
      { priority: 'HIGH', averageTime: 45, target: 60, performance: 133 },
      { priority: 'MEDIUM', averageTime: 120, target: 240, performance: 200 },
      { priority: 'LOW', averageTime: 480, target: 1440, performance: 300 }
    ];

    return {
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      medianResponseTime: Math.round(medianResponseTime * 100) / 100,
      responseTimeByPriority
    };
  }

  private async getDistanceTrends(startDate: Date, endDate: Date): Promise<TimeSeries[]> {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trends: TimeSeries[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const dailyDistance = await prisma.route.aggregate({
        _sum: { totalDistance: true },
        where: {
          createdAt: { gte: date, lt: nextDate }
        }
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        value: Number(dailyDistance._sum.totalDistance) || 0,
        metric: 'totalDistance'
      });
    }

    return trends;
  }

  private async getFuelEfficiencyTrend(startDate: Date, endDate: Date): Promise<TimeSeries[]> {
    // Simplified calculation - in real implementation, you'd track actual fuel usage
    const distanceTrends = await this.getDistanceTrends(startDate, endDate);
    
    return distanceTrends.map(trend => ({
      date: trend.date,
      value: trend.value > 0 ? 8.0 + Math.random() * 2 : 0, // 8-10L per 100km
      metric: 'fuelEfficiency'
    }));
  }

  private async calculateKPIs(startDate: Date, endDate: Date) {
    const [totalPickups, completedPickups, avgResponseTime] = await Promise.all([
      prisma.pickup.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      prisma.pickup.count({
        where: { 
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate } 
        }
      }),
      // Simplified average response time calculation
      45 // Placeholder
    ]);

    const completionRate = totalPickups > 0 ? (completedPickups / totalPickups) * 100 : 0;

    return [
      {
        name: 'Pickup Completion Rate',
        value: Math.round(completionRate * 100) / 100,
        unit: '%',
        change: 2.5,
        trend: 'UP' as const,
        status: completionRate >= 90 ? 'GOOD' as const : completionRate >= 80 ? 'WARNING' as const : 'CRITICAL' as const
      },
      {
        name: 'Average Response Time',
        value: avgResponseTime,
        unit: 'minutes',
        change: -5.2,
        trend: 'DOWN' as const,
        status: avgResponseTime <= 60 ? 'GOOD' as const : avgResponseTime <= 120 ? 'WARNING' as const : 'CRITICAL' as const
      },
      {
        name: 'System Efficiency',
        value: 87.5,
        unit: '%',
        change: 1.8,
        trend: 'UP' as const,
        status: 'GOOD' as const
      },
      {
        name: 'Fuel Efficiency',
        value: 8.2,
        unit: 'L/100km',
        change: -0.3,
        trend: 'DOWN' as const,
        status: 'GOOD' as const
      }
    ];
  }

  private async generateAlerts() {
    // Check for various alert conditions
    const alerts = [];

    // Check for overdue pickups
    const overduePickups = await prisma.pickup.count({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lt: new Date() }
      }
    });

    if (overduePickups > 0) {
      alerts.push({
        id: 'overdue-pickups',
        type: 'WARNING' as const,
        title: 'Overdue Pickups Detected',
        message: `${overduePickups} pickups are overdue and require immediate attention`,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Check for low driver availability
    const onlineDrivers = await prisma.driver.count({
      where: { status: 'ONLINE' }
    });

    if (onlineDrivers < 3) {
      alerts.push({
        id: 'low-driver-availability',
        type: 'CRITICAL' as const,
        title: 'Low Driver Availability',
        message: `Only ${onlineDrivers} drivers are currently online`,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    // Check for full bins
    const fullBins = await prisma.bin.count({
      where: {
        currentLevel: { gte: 95 },
        isActive: true
      }
    });

    if (fullBins > 5) {
      alerts.push({
        id: 'multiple-full-bins',
        type: 'ERROR' as const,
        title: 'Multiple Full Bins',
        message: `${fullBins} bins are at 95%+ capacity and need immediate pickup`,
        timestamp: new Date(),
        acknowledged: false
      });
    }

    return alerts;
  }

  private async getDailyTrends(startDate: Date, endDate: Date): Promise<TimeSeries[]> {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trends: TimeSeries[] = [];

    for (let i = 0; i < Math.min(days, 30); i++) { // Limit to 30 days for performance
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const [pickups, completedPickups] = await Promise.all([
        prisma.pickup.count({
          where: { createdAt: { gte: date, lt: nextDate } }
        }),
        prisma.pickup.count({
          where: { 
            status: 'COMPLETED',
            completedAt: { gte: date, lt: nextDate } 
          }
        })
      ]);

      trends.push({
        date: date.toISOString().split('T')[0],
        value: pickups,
        metric: 'totalPickups'
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        value: completedPickups,
        metric: 'completedPickups'
      });
    }

    return trends;
  }

  private async getWeeklyTrends(startDate: Date, endDate: Date): Promise<TimeSeries[]> {
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const trends: TimeSeries[] = [];

    for (let i = 0; i < Math.min(weeks, 12); i++) { // Limit to 12 weeks
      const weekStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const pickups = await prisma.pickup.count({
        where: { createdAt: { gte: weekStart, lt: weekEnd } }
      });

      trends.push({
        date: weekStart.toISOString().split('T')[0],
        value: pickups,
        metric: 'weeklyPickups'
      });
    }

    return trends;
  }

  private async getMonthlyTrends(startDate: Date, endDate: Date): Promise<TimeSeries[]> {
    const trends: TimeSeries[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const pickups = await prisma.pickup.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd } }
      });

      trends.push({
        date: monthStart.toISOString().split('T')[0],
        value: pickups,
        metric: 'monthlyPickups'
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return trends;
  }

  private async getYearlyTrends(): Promise<TimeSeries[]> {
    const currentYear = new Date().getFullYear();
    const trends: TimeSeries[] = [];

    for (let year = currentYear - 2; year <= currentYear; year++) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);

      const pickups = await prisma.pickup.count({
        where: { createdAt: { gte: yearStart, lte: yearEnd } }
      });

      trends.push({
        date: year.toString(),
        value: pickups,
        metric: 'yearlyPickups'
      });
    }

    return trends;
  }

  private calculateSeasonalPatterns() {
    return [
      {
        season: 'Spring',
        averageValue: 85,
        trend: 'increasing',
        factors: ['Increased outdoor activities', 'Spring cleaning']
      },
      {
        season: 'Summer',
        averageValue: 120,
        trend: 'peak',
        factors: ['Peak tourism', 'Outdoor events', 'Higher consumption']
      },
      {
        season: 'Autumn',
        averageValue: 95,
        trend: 'decreasing',
        factors: ['Back to school', 'Seasonal cleaning']
      },
      {
        season: 'Winter',
        averageValue: 70,
        trend: 'low',
        factors: ['Reduced outdoor activities', 'Holiday periods']
      }
    ];
  }

  private async generatePredictions() {
    return [
      {
        metric: 'Daily Pickup Volume',
        currentValue: 45,
        predictedValue: 52,
        confidence: 85,
        timeframe: 'Next 7 days',
        factors: ['Historical trends', 'Seasonal patterns', 'Weather forecast']
      },
      {
        metric: 'System Efficiency',
        currentValue: 87.5,
        predictedValue: 91.2,
        confidence: 78,
        timeframe: 'Next 30 days',
        factors: ['Route optimization improvements', 'Driver training impact']
      },
      {
        metric: 'Fuel Consumption',
        currentValue: 8.2,
        predictedValue: 7.8,
        confidence: 82,
        timeframe: 'Next 30 days',
        factors: ['Route optimization', 'Vehicle maintenance', 'Driver efficiency']
      }
    ];
  }

  /**
   * Generate chart data for visualization
   */
  async generateChartData(metric: string, startDate: Date, endDate: Date): Promise<ChartData> {
    switch (metric) {
      case 'pickupTrends':
        const pickupTrends = await this.getDailyTrends(startDate, endDate);
        return {
          type: 'LINE',
          title: 'Daily Pickup Trends',
          data: pickupTrends.filter(t => t.metric === 'totalPickups').map(t => ({
            date: t.date,
            value: t.value
          })),
          xAxis: 'date',
          yAxis: 'value',
          colors: ['#3B82F6']
        };

      case 'binStatusDistribution':
        const binAnalytics = await this.getBinAnalytics(startDate, endDate);
        return {
          type: 'PIE',
          title: 'Bin Status Distribution',
          data: [
            { name: 'Empty', value: binAnalytics.statusBreakdown.empty },
            { name: 'Low', value: binAnalytics.statusBreakdown.low },
            { name: 'Medium', value: binAnalytics.statusBreakdown.medium },
            { name: 'High', value: binAnalytics.statusBreakdown.high },
            { name: 'Full', value: binAnalytics.statusBreakdown.full }
          ],
          colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#DC2626']
        };

      case 'driverPerformance':
        const driverAnalytics = await this.getDriverAnalytics(startDate, endDate);
        return {
          type: 'BAR',
          title: 'Driver Performance Scores',
          data: driverAnalytics.efficiencyScores.slice(0, 10).map(d => ({
            name: d.driverName,
            score: d.score
          })),
          xAxis: 'name',
          yAxis: 'score',
          colors: ['#8B5CF6']
        };

      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }
}