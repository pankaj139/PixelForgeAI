/**
 * Health monitoring service for Node.js backend
 */

import { getPythonServiceClient } from './pythonServiceClient';
import { logger } from '../utils/logger';
import { handleHealthCheckError } from '../utils/errorHandler';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: any;
  responseTime?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

class HealthMonitorService {
  private startTime: number;
  private version: string;
  private environment: string;
  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthStatus: SystemHealth | null = null;

  constructor() {
    this.startTime = Date.now();
    this.version = process.env.npm_package_version || '1.0.0';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Start periodic health monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        this.lastHealthStatus = health;
        
        if (health.status !== 'healthy') {
          logger.warn('System health degraded', {
            status: health.status,
            unhealthyChecks: health.checks.filter(c => c.status !== 'healthy').length
          });
        }
      } catch (error) {
        logger.error('Health monitoring failed', {}, error);
      }
    }, intervalMs);

    logger.info('Health monitoring started', { intervalMs });
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info('Health monitoring stopped');
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];

    // Check Python service health
    checks.push(await this.checkPythonService());

    // Check database connectivity
    checks.push(await this.checkDatabase());

    // Check file system access
    checks.push(await this.checkFileSystem());

    // Check memory usage
    checks.push(this.checkMemoryUsage());

    // Calculate overall status
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length
    };

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: this.version,
      environment: this.environment,
      checks,
      summary
    };
  }

  /**
   * Check Python service health
   */
  private async checkPythonService(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const pythonClient = getPythonServiceClient();
      const health = await pythonClient.checkHealth();
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (health.status === 'healthy') {
        status = 'healthy';
      } else if (health.status === 'degraded') {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        name: 'python-service',
        status,
        message: `Python service is ${health.status}`,
        responseTime,
        details: {
          uptime_seconds: health.uptime_seconds,
          memory_usage_mb: health.memory_usage_mb,
          disk_usage_percent: health.disk_usage_percent,
          checks: health.checks
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'python-service',
        status: 'unhealthy',
        message: 'Python service is unavailable',
        responseTime,
        details: handleHealthCheckError(error)
      };
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Import database connection dynamically to avoid circular dependencies
      const { testConnection } = await import('../database/connection');
      await testConnection();
      
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database',
        status: 'unhealthy',
        message: 'Database connection failed',
        responseTime,
        details: handleHealthCheckError(error)
      };
    }
  }

  /**
   * Check file system access
   */
  private async checkFileSystem(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Check upload directory
      const uploadDir = path.join(process.cwd(), 'uploads');
      await fs.access(uploadDir);
      
      // Check processed directory
      const processedDir = path.join(process.cwd(), 'processed');
      await fs.access(processedDir);
      
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'filesystem',
        status: 'healthy',
        message: 'File system access is healthy',
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'filesystem',
        status: 'unhealthy',
        message: 'File system access failed',
        responseTime,
        details: handleHealthCheckError(error)
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(): HealthCheck {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemoryMB = memoryUsage.heapTotal / 1024 / 1024;
      const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024;
      const memoryUsagePercent = (usedMemoryMB / totalMemoryMB) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;
      
      if (memoryUsagePercent < 70) {
        status = 'healthy';
        message = 'Memory usage is normal';
      } else if (memoryUsagePercent < 90) {
        status = 'degraded';
        message = 'Memory usage is elevated';
      } else {
        status = 'unhealthy';
        message = 'Memory usage is critical';
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'memory',
        status,
        message,
        responseTime,
        details: {
          heap_used_mb: Math.round(usedMemoryMB),
          heap_total_mb: Math.round(totalMemoryMB),
          usage_percent: Math.round(memoryUsagePercent),
          external_mb: Math.round(memoryUsage.external / 1024 / 1024),
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024)
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'memory',
        status: 'unhealthy',
        message: 'Memory check failed',
        responseTime,
        details: handleHealthCheckError(error)
      };
    }
  }

  /**
   * Get last known health status
   */
  getLastHealthStatus(): SystemHealth | null {
    return this.lastHealthStatus;
  }

  /**
   * Get service uptime in seconds
   */
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    const memoryUsage = process.memoryUsage();
    
    return {
      uptime_seconds: this.getUptimeSeconds(),
      memory_usage: {
        heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external_mb: Math.round(memoryUsage.external / 1024 / 1024),
        rss_mb: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      version: this.version,
      environment: this.environment,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }
}

// Create singleton instance
const healthMonitorService = new HealthMonitorService();

export { healthMonitorService };
export default healthMonitorService;