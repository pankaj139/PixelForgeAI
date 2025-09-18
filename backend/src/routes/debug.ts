/**
 * Debug Routes for Image Processing System
 * 
 * This file provides debug endpoints to help diagnose and fix issues
 * in the image processing pipeline.
 * 
 * Routes:
 * - POST /api/debug/clear-ai-cache - Clear AI naming cache
 * - GET /api/debug/recent-images - List recent processed images
 * - GET /api/debug/processed-directory - Check processed directory
 * - GET /api/debug/cache-stats - Get AI naming cache statistics
 */

import { Router } from 'express';
import { debugUtils } from '../utils/debugUtils.js';
import { aiNamingService } from '../services/aiNamingService.js';

const router = Router();

/**
 * Clear AI naming cache
 */
router.post('/clear-ai-cache', async (_req, res) => {
  try {
    debugUtils.clearAINamingCache();
    res.json({
      success: true,
      message: 'AI naming cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing AI cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List recent processed images to check for duplicates
 */
router.get('/recent-images', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Capture console output
    const originalLog = console.log;
    let output = '';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };
    
    await debugUtils.listRecentProcessedImages(limit);
    
    // Restore console.log
    console.log = originalLog;
    
    res.json({
      success: true,
      output: output
    });
  } catch (error) {
    console.error('Error listing recent images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check processed directory
 */
router.get('/processed-directory', async (_req, res) => {
  try {
    // Capture console output
    const originalLog = console.log;
    let output = '';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };
    
    debugUtils.checkProcessedDirectory();
    
    // Restore console.log
    console.log = originalLog;
    
    res.json({
      success: true,
      output: output
    });
  } catch (error) {
    console.error('Error checking processed directory:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get AI naming cache statistics
 */
router.get('/cache-stats', async (_req, res) => {
  try {
    const stats = aiNamingService.getCacheStats();
    
    res.json({
      success: true,
      cacheStats: {
        size: stats.size,
        oldestEntry: stats.size > 0 ? new Date(stats.oldestEntry).toISOString() : null,
        newestEntry: stats.size > 0 ? new Date(stats.newestEntry).toISOString() : null
      }
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as debugRoutes };
