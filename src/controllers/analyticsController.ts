// src/controllers/analyticsController.ts
import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '@/services/analyticsService';
import { AuthenticatedRequest } from '@/middleware/auth';
import { AnalyticsQuery } from '@/types/analytics';

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: AnalyticsQuery = req.query;
      const result = await analyticsService.getDashboardMetrics(query);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get overview metrics
   */
  async getOverviewMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.getOverviewMetrics(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bin analytics
   */
  async getBinAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.getBinAnalytics(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get driver analytics
   */
  async getDriverAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.getDriverAnalytics(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pickup analytics
   */
  async getPickupAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.getPickupAnalytics(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get route analytics
   */
  async getRouteAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.getRouteAnalytics(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.getPerformanceMetrics(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trend analysis
   */
  async getTrendAnalysis(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.getTrendAnalysis(start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate chart data for specific metrics
   */
  async getChartData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { metric } = req.params;
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const result = await analyticsService.generateChartData(metric, start, end);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const result = await analyticsService.getOverviewMetrics(oneHourAgo, now);
      
      res.status(200).json({
        success: true,
        data: {
          ...result,
          timestamp: now
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get custom analytics based on filters
   */
  async getCustomAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query: AnalyticsQuery = req.body;
      
      // Validate required fields
      if (!query.startDate || !query.endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const result = await analyticsService.getDashboardMetrics(query);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { format = 'json' } = req.query;
      const query: AnalyticsQuery = req.body;

      const result = await analyticsService.getDashboardMetrics(query);

      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(result);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');
        res.status(200).send(csv);
      } else {
        res.status(200).json({
          success: true,
          data: result,
          exported_at: new Date()
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get analytics summary report
   */
  async getSummaryReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { period = '30' } = req.query;
      const days = parseInt(period as string);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const [overview, bins, drivers, pickups] = await Promise.all([
        analyticsService.getOverviewMetrics(startDate, endDate),
        analyticsService.getBinAnalytics(startDate, endDate),
        analyticsService.getDriverAnalytics(startDate, endDate),
        analyticsService.getPickupAnalytics(startDate, endDate)
      ]);

      const summary = {
        period: `${days} days`,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        keyMetrics: {
          totalPickups: overview.totalPickups,
          completionRate: pickups.volumeMetrics.totalPickups > 0 
            ? (overview.completedPickups / pickups.volumeMetrics.totalPickups) * 100 
            : 0,
          averageResponseTime: pickups.responseTimeAnalysis.averageResponseTime,
          systemEfficiency: overview.systemEfficiency,
          activeBins: overview.activeBins,
          onlineDrivers: overview.onlineDrivers
        },
        insights: [
          {
            category: 'Performance',
            message: overview.systemEfficiency > 85 
              ? 'System is performing well above target'
              : 'System performance needs improvement',
            value: overview.systemEfficiency,
            trend: 'stable'
          },
          {
            category: 'Efficiency',
            message: drivers.performanceMetrics.utilizationRate > 80
              ? 'Driver utilization is optimal'
              : 'Driver utilization could be improved',
            value: drivers.performanceMetrics.utilizationRate,
            trend: 'up'
          },
          {
            category: 'Bins',
            message: bins.problemBins.length > 10
              ? 'Multiple bins require attention'
              : 'Bin management is under control',
            value: bins.problemBins.length,
            trend: bins.problemBins.length > 10 ? 'up' : 'down'
          }
        ]
      };

      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper method to convert data to CSV
   */
  private convertToCSV(data: any): string {
    const lines = [];
    
    // Overview metrics
    lines.push('Overview Metrics');
    lines.push('Metric,Value');
    lines.push(`Total Bins,${data.overview.totalBins}`);
    lines.push(`Total Drivers,${data.overview.totalDrivers}`);
    lines.push(`Total Pickups,${data.overview.totalPickups}`);
    lines.push(`Completed Pickups,${data.overview.completedPickups}`);
    lines.push(`System Efficiency,${data.overview.systemEfficiency}%`);
    lines.push('');

    // Bin status breakdown
    lines.push('Bin Status Breakdown');
    lines.push('Status,Count');
    Object.entries(data.bins.statusBreakdown).forEach(([status, count]) => {
      lines.push(`${status},${count}`);
    });

    return lines.join('\n');
  }
}