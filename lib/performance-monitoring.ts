/**
 * Performance Monitoring & Metrics Utility
 * Tracks app performance, query times, and provides insights
 */

import { supabase } from './supabase';

/**
 * Performance metric types
 */
export type MetricType =
  | 'api_call'
  | 'image_load'
  | 'screen_render'
  | 'database_query'
  | 'image_upload'
  | 'message_send'
  | 'match_algorithm';

export interface PerformanceMetric {
  type: MetricType;
  operation: string;
  duration: number; // milliseconds
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  operation: string;
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
}

/**
 * In-memory performance metrics storage
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private timers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(operationId: string): void {
    this.timers.set(operationId, Date.now());
  }

  /**
   * End timing and record metric
   */
  endTimer(
    operationId: string,
    type: MetricType,
    operation: string,
    metadata?: Record<string, any>
  ): number | null {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      console.warn(`No timer found for operation: ${operationId}`);
      return null;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operationId);

    this.recordMetric({
      type,
      operation,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    return duration;
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (metric.duration > 1000) {
      console.warn(
        `🐌 Slow operation detected: ${metric.operation} took ${metric.duration}ms`,
        metric.metadata
      );
    }
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(operation?: string): PerformanceStats[] {
    const filtered = operation
      ? this.metrics.filter((m) => m.operation === operation)
      : this.metrics;

    // Group by operation
    const grouped = filtered.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      acc[metric.operation].push(metric.duration);
      return acc;
    }, {} as Record<string, number[]>);

    // Calculate stats for each operation
    return Object.entries(grouped).map(([op, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);

      return {
        operation: op,
        count: durations.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: sorted[0],
        maxDuration: sorted[sorted.length - 1],
        p95Duration: sorted[p95Index] || sorted[sorted.length - 1],
      };
    });
  }

  /**
   * Get all metrics for a specific type
   */
  getMetricsByType(type: MetricType): PerformanceMetric[] {
    return this.metrics.filter((m) => m.type === type);
  }

  /**
   * Get recent slow operations
   */
  getSlowOperations(thresholdMs: number = 1000): PerformanceMetric[] {
    return this.metrics
      .filter((m) => m.duration > thresholdMs)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 20);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get summary report
   */
  getSummary(): {
    totalOperations: number;
    avgDuration: number;
    slowOperations: number;
    byType: Record<MetricType, number>;
  } {
    const totalOperations = this.metrics.length;
    const avgDuration =
      this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations || 0;
    const slowOperations = this.metrics.filter((m) => m.duration > 1000).length;

    const byType = this.metrics.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<MetricType, number>);

    return {
      totalOperations,
      avgDuration,
      slowOperations,
      byType,
    };
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      summary: this.getSummary(),
      stats: this.getStats(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator/wrapper function to measure async function performance
 */
export function measurePerformance<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operation: string,
  type: MetricType = 'api_call'
): T {
  return (async (...args: any[]) => {
    const operationId = `${operation}_${Date.now()}_${Math.random()}`;
    performanceMonitor.startTimer(operationId);

    try {
      const result = await fn(...args);
      performanceMonitor.endTimer(operationId, type, operation, {
        success: true,
      });
      return result;
    } catch (error) {
      performanceMonitor.endTimer(operationId, type, operation, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }) as T;
}

/**
 * Measure image loading performance
 */
export async function measureImageLoad(
  uri: string,
  metadata?: Record<string, any>
): Promise<void> {
  const operationId = `image_load_${uri}`;
  performanceMonitor.startTimer(operationId);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      performanceMonitor.endTimer(operationId, 'image_load', 'image_load', {
        uri,
        ...metadata,
      });
      resolve();
    };
    img.onerror = () => {
      performanceMonitor.endTimer(operationId, 'image_load', 'image_load_error', {
        uri,
        error: true,
        ...metadata,
      });
      resolve();
    };
    img.src = uri;
  });
}

/**
 * Database query performance tracking
 */
export async function measureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const operationId = `query_${queryName}_${Date.now()}`;
  performanceMonitor.startTimer(operationId);

  try {
    const result = await queryFn();
    const duration = performanceMonitor.endTimer(
      operationId,
      'database_query',
      queryName,
      { success: true, ...metadata }
    );

    // Warn on slow queries
    if (duration && duration > 500) {
      console.warn(`⚠️ Slow query: ${queryName} took ${duration}ms`);
    }

    return result;
  } catch (error) {
    performanceMonitor.endTimer(operationId, 'database_query', queryName, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...metadata,
    });
    throw error;
  }
}

/**
 * Screen render performance tracking
 */
export function measureScreenRender(screenName: string) {
  const operationId = `screen_${screenName}_${Date.now()}`;
  performanceMonitor.startTimer(operationId);

  return {
    finish: () => {
      const duration = performanceMonitor.endTimer(
        operationId,
        'screen_render',
        screenName
      );

      if (duration && duration > 1000) {
        console.warn(`⚠️ Slow screen render: ${screenName} took ${duration}ms`);
      }

      return duration;
    },
  };
}

/**
 * Report performance metrics to analytics
 * (Can be extended to send to PostHog, Sentry, etc.)
 */
export function reportPerformanceMetrics(): void {
  const summary = performanceMonitor.getSummary();
  const stats = performanceMonitor.getStats();
  const slowOps = performanceMonitor.getSlowOperations(1000);

  console.log('📊 Performance Summary:', summary);
  console.log('📈 Operation Stats:', stats);

  if (slowOps.length > 0) {
    console.warn('🐌 Slow Operations:', slowOps);
  }

  // TODO: Send to analytics service (PostHog, Sentry, etc.)
  // Example:
  // posthog.capture('performance_report', {
  //   summary,
  //   slowOperationsCount: slowOps.length
  // });
}

/**
 * Memory usage monitoring (React Native specific)
 */
export async function checkMemoryUsage(): Promise<{
  used: number;
  available: number;
  percentage: number;
}> {
  // Note: This is a placeholder. In production, you'd use:
  // - react-native-device-info for actual memory stats
  // - or native modules to get real memory usage

  // For now, return mock data
  return {
    used: 0,
    available: 0,
    percentage: 0,
  };
}

/**
 * Network performance monitoring
 */
export async function measureNetworkSpeed(): Promise<{
  downloadSpeedMbps: number;
  latencyMs: number;
}> {
  const startTime = Date.now();

  try {
    // Simple ping test to Supabase
    await supabase.from('profiles').select('id').limit(1);
    const latency = Date.now() - startTime;

    return {
      downloadSpeedMbps: 0, // Would need actual download test
      latencyMs: latency,
    };
  } catch (error) {
    return {
      downloadSpeedMbps: 0,
      latencyMs: -1,
    };
  }
}

/**
 * App startup performance tracking
 */
export const startupPerformance = {
  appLaunchTime: 0,
  authCheckTime: 0,
  profileLoadTime: 0,
  totalStartupTime: 0,

  recordAppLaunch(duration: number) {
    this.appLaunchTime = duration;
  },

  recordAuthCheck(duration: number) {
    this.authCheckTime = duration;
  },

  recordProfileLoad(duration: number) {
    this.profileLoadTime = duration;
    this.totalStartupTime = this.appLaunchTime + this.authCheckTime + this.profileLoadTime;

    if (this.totalStartupTime > 3000) {
      console.warn(`⚠️ Slow app startup: ${this.totalStartupTime}ms`);
    }
  },

  getSummary() {
    return {
      appLaunchTime: this.appLaunchTime,
      authCheckTime: this.authCheckTime,
      profileLoadTime: this.profileLoadTime,
      totalStartupTime: this.totalStartupTime,
    };
  },
};

/**
 * Utility to log performance in development
 */
export function logPerformance(operation: string, startTime: number): void {
  const duration = Date.now() - startTime;

  if (__DEV__) {
    const emoji = duration < 100 ? '⚡' : duration < 500 ? '✅' : duration < 1000 ? '⚠️' : '🐌';
    console.log(`${emoji} ${operation}: ${duration}ms`);
  }

  performanceMonitor.recordMetric({
    type: 'api_call',
    operation,
    duration,
    timestamp: Date.now(),
  });
}

/**
 * Performance budget thresholds (in milliseconds)
 */
export const PERFORMANCE_BUDGETS = {
  // API calls
  API_CALL_FAST: 200,
  API_CALL_ACCEPTABLE: 500,
  API_CALL_SLOW: 1000,

  // Screen renders
  SCREEN_RENDER_FAST: 300,
  SCREEN_RENDER_ACCEPTABLE: 800,
  SCREEN_RENDER_SLOW: 1500,

  // Image loads
  IMAGE_LOAD_FAST: 500,
  IMAGE_LOAD_ACCEPTABLE: 1500,
  IMAGE_LOAD_SLOW: 3000,

  // Database queries
  QUERY_FAST: 100,
  QUERY_ACCEPTABLE: 300,
  QUERY_SLOW: 500,
};

/**
 * Check if operation meets performance budget
 */
export function checkPerformanceBudget(
  duration: number,
  budget: number,
  operation: string
): boolean {
  const passed = duration <= budget;

  if (!passed && __DEV__) {
    console.warn(
      `⚠️ Performance budget exceeded: ${operation} took ${duration}ms (budget: ${budget}ms)`
    );
  }

  return passed;
}
