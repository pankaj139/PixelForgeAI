/**
 * Health check routes for monitoring service status
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { healthMonitorService } from '../services/healthMonitorService';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const health = await healthMonitorService.getSystemHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  return res.status(statusCode).json({
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
router.get('/detailed', asyncHandler(async (_req: Request, res: Response) => {
  const health = await healthMonitorService.getSystemHealth();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;
  
  return res.status(statusCode).json(health);
}));

/**
 * Service metrics endpoint
 */
router.get('/metrics', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = healthMonitorService.getMetrics();
  
  return res.json({
    service: 'nodejs-backend',
    metrics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * Readiness probe endpoint
 */
router.get('/ready', asyncHandler(async (_req: Request, res: Response) => {
  const health = await healthMonitorService.getSystemHealth();
  
  // Service is ready if it's healthy or degraded (but not unhealthy)
  const isReady = health.status !== 'unhealthy';
  
  if (isReady) {
  return res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
  return res.status(503).json({
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
router.get('/live', asyncHandler(async (_req: Request, res: Response) => {
  // Service is alive if it can respond to requests
  return res.json({
    status: 'alive',
    uptime: healthMonitorService.getUptimeSeconds(),
    timestamp: new Date().toISOString()
  });
}));

export default router;