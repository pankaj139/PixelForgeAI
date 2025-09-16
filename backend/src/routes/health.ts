/**
 * Health check routes for monitoring service status
 */

import { Router } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { healthMonitorService } from '../services/healthMonitorService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/', asyncHandler(async (req, res) => {
  const health = await healthMonitorService.getSystemHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    status: health.status,
    timestamp: health.timestamp,
    uptime: health.uptime,
    version: health.version,
    environment: health.environment
  });
}));

/**
 * Detailed health check endpoint
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const health = await healthMonitorService.getSystemHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
}));

/**
 * Service metrics endpoint
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  const metrics = healthMonitorService.getMetrics();
  
  res.json({
    service: 'nodejs-backend',
    metrics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * Readiness probe endpoint
 */
router.get('/ready', asyncHandler(async (req, res) => {
  const health = await healthMonitorService.getSystemHealth();
  
  // Service is ready if it's healthy or degraded (but not unhealthy)
  const isReady = health.status !== 'unhealthy';
  
  if (isReady) {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      reason: 'Service is unhealthy',
      timestamp: new Date().toISOString(),
      checks: health.checks.filter(c => c.status === 'unhealthy')
    });
  }
}));

/**
 * Liveness probe endpoint
 */
router.get('/live', asyncHandler(async (req, res) => {
  // Service is alive if it can respond to requests
  res.json({
    status: 'alive',
    uptime: healthMonitorService.getUptimeSeconds(),
    timestamp: new Date().toISOString()
  });
}));

export default router;