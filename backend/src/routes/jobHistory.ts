/**
 * Job History API Routes
 * 
 * Purpose: Provides comprehensive REST API endpoints for job history management,
 * including filtering, search, pagination, statistics, and export functionality.
 * All endpoints require user authentication and are user-scoped.
 * 
 * Usage:
 * ```typescript
 * app.use('/api/job-history', jobHistoryRoutes);
 * ```
 * 
 * Key Features:
 * - User-specific job history retrieval
 * - Advanced filtering and search capabilities
 * - Pagination with configurable limits
 * - Job statistics and analytics
 * - Export functionality (JSON/CSV)
 * - Job management (update, delete)
 * - Real-time job counts and status
 * 
 * Updates:
 * - Initial implementation with comprehensive job history API
 * - Added authentication middleware integration
 * - Implemented advanced filtering and search
 * - Added export functionality and job management
 */

import express, { Request, Response } from 'express';
import { jobHistoryService } from '../services/jobHistoryService';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Validation schemas
const JobHistoryQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  status: z.enum(['pending', 'processing', 'composing', 'generating_pdf', 'completed', 'failed', 'cancelled']).optional(),
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
  aspectRatio: z.string().optional(),
  search: z.string().optional(),
  isPublic: z.string().optional().transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
  sortBy: z.enum(['createdAt', 'completedAt', 'status', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

const JobUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  isPublic: z.boolean().optional()
});

const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  includeFiles: z.string().optional().transform(val => val === 'true'),
  includeProgress: z.string().optional().transform(val => val === 'true'),
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

/**
 * GET /api/job-history
 * Get paginated job history with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const query = JobHistoryQuerySchema.parse(req.query);

    const result = await jobHistoryService.getUserJobHistory(
      userId,
      {
        ...(query.status && { status: query.status }),
        ...(query.dateFrom && { dateFrom: query.dateFrom }),
        ...(query.dateTo && { dateTo: query.dateTo }),
        ...(query.aspectRatio && { aspectRatio: query.aspectRatio }),
        ...(query.search && { search: query.search }),
        ...(query.isPublic !== undefined && { isPublic: query.isPublic })
      },
      {
        page: query.page,
        limit: query.limit,
        ...(query.sortBy && { sortBy: query.sortBy }),
        ...(query.sortOrder && { sortOrder: query.sortOrder })
      }
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Job history error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve job history'
    });
  }
});

/**
 * GET /api/job-history/statistics
 * Get job statistics for the authenticated user
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { dateFrom, dateTo } = req.query;

    const dateRange = dateFrom && dateTo ? {
      from: new Date(dateFrom as string),
      to: new Date(dateTo as string)
    } : undefined;

    const statistics = await jobHistoryService.getUserJobStatistics(userId, dateRange);

    return res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Job statistics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve job statistics'
    });
  }
});

/**
 * GET /api/job-history/search
 * Search jobs with advanced filtering
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { q, ...filters } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const query = JobHistoryQuerySchema.parse(filters);
    const result = await jobHistoryService.searchUserJobs(
      userId,
      q,
      {
        ...(query.status && { status: query.status }),
        ...(query.dateFrom && { dateFrom: query.dateFrom }),
        ...(query.dateTo && { dateTo: query.dateTo }),
        ...(query.aspectRatio && { aspectRatio: query.aspectRatio }),
        ...(query.isPublic !== undefined && { isPublic: query.isPublic })
      },
      {
        page: query.page,
        limit: query.limit,
        ...(query.sortBy && { sortBy: query.sortBy }),
        ...(query.sortOrder && { sortOrder: query.sortOrder })
      }
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Job search error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to search jobs'
    });
  }
});

/**
 * GET /api/job-history/recent
 * Get recent jobs for the authenticated user
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    }

    const recentJobs = await jobHistoryService.getRecentJobs(userId, limit);

    return res.json({
      success: true,
      data: recentJobs
    });
  } catch (error) {
    console.error('Recent jobs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent jobs'
    });
  }
});

/**
 * GET /api/job-history/:jobId
 * Get detailed information about a specific job
 */
router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { jobId } = req.params;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid job ID'
      });
    }

    const job = await jobHistoryService.getJobDetails(userId, jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    return res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Job details error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve job details'
    });
  }
});

/**
 * PUT /api/job-history/:jobId
 * Update job title or visibility
 */
router.put('/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { jobId } = req.params;
    const updates = JobUpdateSchema.parse(req.body);

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid job ID'
      });
    }

    const success = await jobHistoryService.updateJob(userId, jobId, {
      ...(updates.title && { title: updates.title }),
      ...(updates.isPublic !== undefined && { isPublic: updates.isPublic })
    });

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Job not found or access denied'
      });
    }

    return res.json({
      success: true,
      message: 'Job updated successfully'
    });
  } catch (error) {
    console.error('Job update error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid update data',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to update job'
    });
  }
});

/**
 * DELETE /api/job-history/:jobId
 * Delete a job and all associated data
 */
router.delete('/:jobId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { jobId } = req.params;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid job ID'
      });
    }

    const success = await jobHistoryService.deleteJob(userId, jobId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Job not found or access denied'
      });
    }

    return res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Job deletion error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete job'
    });
  }
});

/**
 * GET /api/job-history/export
 * Export job history data
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const query = ExportQuerySchema.parse(req.query);

    const exportData = await jobHistoryService.exportJobHistory(userId, {
      format: query.format,
      includeFiles: query.includeFiles || false,
      includeProgress: query.includeProgress || false,
      ...(query.dateFrom && query.dateTo && {
        dateRange: {
          from: query.dateFrom,
          to: query.dateTo
        }
      })
    });

    const filename = `job-history-${new Date().toISOString().split('T')[0]}.${query.format}`;
    const contentType = query.format === 'csv' ? 'text/csv' : 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.send(exportData);
  } catch (error) {
    console.error('Job export error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid export parameters',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to export job history'
    });
  }
});

/**
 * GET /api/job-history/filters/options
 * Get available filter options for the user's jobs
 */
router.get('/filters/options', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const jobs = await jobHistoryService.getRecentJobs(userId, 1000); // Get more jobs for filter options

    // Extract unique values for filters
    const statusOptions = [...new Set(jobs.map(job => job.status))];
    const aspectRatioOptions = [...new Set(jobs.map(job => job.options.aspectRatio.name))];
    
    // Get date range
    const dates = jobs.map(job => new Date(job.createdAt)).sort();
    const dateRange = dates.length > 0 ? {
      min: dates[0].toISOString().split('T')[0],
      max: dates[dates.length - 1].toISOString().split('T')[0]
    } : null;

    return res.json({
      success: true,
      data: {
        status: statusOptions,
        aspectRatios: aspectRatioOptions,
        dateRange
      }
    });
  } catch (error) {
    console.error('Filter options error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve filter options'
    });
  }
});

export default router;
