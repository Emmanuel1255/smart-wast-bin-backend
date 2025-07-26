// src/types/analytics.ts
export interface DashboardMetrics {
    overview: OverviewMetrics;
    bins: BinAnalytics;
    drivers: DriverAnalytics;
    pickups: PickupAnalytics;
    routes: RouteAnalytics;
    performance: PerformanceMetrics;
    trends: TrendAnalysis;
  }
  
  export interface OverviewMetrics {
    totalBins: number;
    totalDrivers: number;
    totalPickups: number;
    completedPickups: number;
    activeBins: number;
    onlineDrivers: number;
    averageFillLevel: number;
    systemEfficiency: number;
  }
  
  export interface BinAnalytics {
    fillLevelDistribution: FillLevelDistribution;
    statusBreakdown: StatusBreakdown;
    locationAnalysis: LocationAnalysis;
    utilizationRate: number;
    problemBins: ProblemBin[];
    fillTrends: TimeSeries[];
  }
  
  export interface FillLevelDistribution {
    empty: number;      // 0-20%
    low: number;        // 21-40%
    medium: number;     // 41-60%
    high: number;       // 61-80%
    full: number;       // 81-100%
  }
  
  export interface StatusBreakdown {
    empty: number;
    low: number;
    medium: number;
    high: number;
    full: number;
    maintenance: number;
    outOfService: number;
  }
  
  export interface LocationAnalysis {
    topLocations: Array<{
      location: string;
      binCount: number;
      averageFillLevel: number;
      pickupFrequency: number;
    }>;
    utilizationByArea: Array<{
      area: string;
      utilization: number;
      efficiency: number;
    }>;
  }
  
  export interface ProblemBin {
    id: string;
    binCode: string;
    location: string;
    issue: 'OVERDUE' | 'FREQUENT_FULL' | 'LOW_USAGE' | 'MAINTENANCE_NEEDED';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    daysSinceLastPickup: number;
  }
  
  export interface DriverAnalytics {
    performanceMetrics: DriverPerformanceMetrics;
    workloadDistribution: WorkloadDistribution;
    efficiencyScores: EfficiencyScore[];
    activeHours: ActivityHours[];
    leaderboard: DriverLeaderboard[];
  }
  
  export interface DriverPerformanceMetrics {
    totalDrivers: number;
    activeDrivers: number;
    averagePickupsPerDriver: number;
    averageCompletionTime: number;
    onTimeRate: number;
    utilizationRate: number;
  }
  
  export interface WorkloadDistribution {
    underutilized: number;  // <5 pickups/day
    optimal: number;        // 5-15 pickups/day
    overworked: number;     // >15 pickups/day
  }
  
  export interface EfficiencyScore {
    driverId: string;
    driverName: string;
    score: number;
    completionRate: number;
    averageTime: number;
    fuelEfficiency: number;
  }
  
  export interface ActivityHours {
    hour: number;
    activeDrivers: number;
    completedPickups: number;
    averageResponseTime: number;
  }
  
  export interface DriverLeaderboard {
    rank: number;
    driverId: string;
    driverName: string;
    totalPickups: number;
    completionRate: number;
    averageRating: number;
    totalDistance: number;
    efficiency: number;
  }
  
  export interface PickupAnalytics {
    volumeMetrics: VolumeMetrics;
    timeAnalysis: TimeAnalysis;
    priorityDistribution: PriorityDistribution;
    completionTrends: TimeSeries[];
    responseTimeAnalysis: ResponseTimeAnalysis;
  }
  
  export interface VolumeMetrics {
    totalPickups: number;
    dailyAverage: number;
    weeklyAverage: number;
    monthlyAverage: number;
    growthRate: number;
    peakHours: Array<{ hour: number; count: number }>;
  }
  
  export interface TimeAnalysis {
    averageResponseTime: number;
    averageCompletionTime: number;
    peakDays: string[];
    timeDistribution: Array<{
      timeSlot: string;
      count: number;
      percentage: number;
    }>;
  }
  
  export interface PriorityDistribution {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  }
  
  export interface ResponseTimeAnalysis {
    averageResponseTime: number;
    medianResponseTime: number;
    responseTimeByPriority: Array<{
      priority: string;
      averageTime: number;
      target: number;
      performance: number;
    }>;
  }
  
  export interface RouteAnalytics {
    efficiencyMetrics: RouteEfficiencyMetrics;
    optimizationImpact: OptimizationImpact;
    distanceAnalysis: DistanceAnalysis;
    fuelConsumption: FuelConsumption;
  }
  
  export interface RouteEfficiencyMetrics {
    totalRoutes: number;
    averageDistance: number;
    averageDuration: number;
    optimizationRate: number;
    fuelSavings: number;
  }
  
  export interface OptimizationImpact {
    distanceSaved: number;
    timeSaved: number;
    fuelSaved: number;
    costSavings: number;
    co2Reduction: number;
  }
  
  export interface DistanceAnalysis {
    totalDistance: number;
    averagePerRoute: number;
    shortestRoute: number;
    longestRoute: number;
    distanceTrends: TimeSeries[];
  }
  
  export interface FuelConsumption {
    totalFuelUsed: number;
    averagePerKm: number;
    costPerMonth: number;
    efficiencyTrend: TimeSeries[];
  }
  
  export interface PerformanceMetrics {
    kpis: KPI[];
    benchmarks: Benchmark[];
    targets: Target[];
    alerts: Alert[];
  }
  
  export interface KPI {
    name: string;
    value: number;
    unit: string;
    change: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
    status: 'GOOD' | 'WARNING' | 'CRITICAL';
  }
  
  export interface Benchmark {
    metric: string;
    current: number;
    industry: number;
    target: number;
    performance: number;
  }
  
  export interface Target {
    metric: string;
    current: number;
    target: number;
    progress: number;
    deadline: Date;
  }
  
  export interface Alert {
    id: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    title: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }
  
  export interface TrendAnalysis {
    daily: TimeSeries[];
    weekly: TimeSeries[];
    monthly: TimeSeries[];
    yearly: TimeSeries[];
    seasonalPatterns: SeasonalPattern[];
    predictions: Prediction[];
  }
  
  export interface TimeSeries {
    date: string;
    value: number;
    metric: string;
  }
  
  export interface SeasonalPattern {
    season: string;
    averageValue: number;
    trend: string;
    factors: string[];
  }
  
  export interface Prediction {
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeframe: string;
    factors: string[];
  }
  
  export interface AnalyticsQuery {
    startDate?: string;
    endDate?: string;
    granularity?: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
    metrics?: string[];
    filters?: {
      driverId?: string;
      binId?: string;
      location?: string;
      status?: string;
    };
  }
  
  export interface ChartData {
    type: 'LINE' | 'BAR' | 'PIE' | 'AREA' | 'SCATTER' | 'HEATMAP';
    title: string;
    data: any[];
    xAxis?: string;
    yAxis?: string;
    colors?: string[];
    options?: any;
  }