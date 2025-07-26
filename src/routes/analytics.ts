// src/routes/analytics.ts
import { Router } from 'express';
import { AnalyticsController } from '@/controllers/analyticsController';
import { authenticate, authorize } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { query, param, body } from 'express-validator';

const router = Router();
const analyticsController = new AnalyticsController();

// Validation middleware
const dateValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

const metricValidation = [
  param('metric')
    .isIn(['pickupTrends', 'binStatusDistribution', 'driverPerformance', 'routeEfficiency', 'fuelConsumption'])
    .withMessage('Invalid metric type')
];

// All routes require authentication
router.use(authenticate);

// GET routes - Most analytics are admin only, some available to drivers
router.get(
  '/dashboard',
  authorize(['ADMIN']),
  dateValidation,
  validateRequest,
  analyticsController.getDashboardMetrics
);

router.get(
  '/overview',
  authorize(['ADMIN', 'DRIVER']),
  dateValidation,
  validateRequest,
  analyticsController.getOverviewMetrics
);

router.get(
  '/bins',
  authorize(['ADMIN']),
  dateValidation,
  validateRequest,
  analyticsController.getBinAnalytics
);

router.get(
  '/drivers',
  authorize(['ADMIN']),
  dateValidation,
  validateRequest,
  analyticsController.getDriverAnalytics
);

router.get(
  '/pickups',
  authorize(['ADMIN', 'DRIVER']),
  dateValidation,
  validateRequest,
  analyticsController.getPickupAnalytics
);

router.get(
  '/routes',
  authorize(['ADMIN']),
  dateValidation,
  validateRequest,
  analyticsController.getRouteAnalytics
);

router.get(
  '/performance',
  authorize(['ADMIN']),
  dateValidation,
  validateRequest,
  analyticsController.getPerformanceMetrics
);

router.get(
  '/trends',
  authorize(['ADMIN']),
  dateValidation,
  validateRequest,
  analyticsController.getTrendAnalysis
);

router.get(
  '/chart/:metric',
  authorize(['ADMIN']),
  metricValidation,
  dateValidation,
  validateRequest,
  analyticsController.getChartData
);

router.get(
  '/realtime',
  authorize(['ADMIN']),
  analyticsController.getRealTimeMetrics
);

router.get(
  '/summary',
  authorize(['ADMIN', 'DRIVER']),
  query('period').optional().isInt({ min: 1, max: 365 }).withMessage('Period must be between 1 and 365 days'),
  validateRequest,
  analyticsController.getSummaryReport
);

// POST routes
router.post(
  '/custom',
  authorize(['ADMIN']),
  body('startDate').isISO8601().withMessage('Start date is required and must be valid'),
  body('endDate').isISO8601().withMessage('End date is required and must be valid'),
  body('metrics').optional().isArray().withMessage('Metrics must be an array'),
  validateRequest,
  analyticsController.getCustomAnalytics
);

router.post(
  '/export',
  authorize(['ADMIN']),
  query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  analyticsController.exportAnalytics
);

export { router as analyticsRoutes };