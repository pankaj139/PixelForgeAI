import express, { Request, Response } from 'express';
import { jobProcessingService } from '../services/jobProcessingService';
import { downloadService } from '../services/downloadService';
import { getDatabase } from '../database/connection';
import { getPythonServiceClient } from '../services/pythonServiceClient';
import { ensureAspectRatioOrientation } from '../utils/validation';

const router = express.Router();

// Get processing queue status including Python service health
router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const queueStatus = jobProcessingService.getQueueStatus();
    const pythonClient = getPythonServiceClient();
    
    // Check Python service health
    let pythonServiceStatus = {
      healthy: false,
      error: null as string | null
    };
    
    try {
      await pythonClient.checkHealth();
      pythonServiceStatus.healthy = true;
    } catch (error) {
      pythonServiceStatus.healthy = false;
      pythonServiceStatus.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    return res.json({
      success: true,
      queue: queueStatus,
      pythonService: pythonServiceStatus
    });
  } catch (error) {
    console.error('Queue status error:', error);
    return res.status(500).json({
      error: 'Failed to get queue status',
      code: 'QUEUE_STATUS_FAILED'
    });
  }
});

// Get detailed job progress
router.get('/job/:jobId/progress', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        error: 'Invalid job ID',
        code: 'INVALID_JOB_ID'
      });
    }

    const job = await jobProcessingService.getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND'
      });
    }

    const db = getDatabase();
    const processedImages = await db.getProcessedImagesByJobId(jobId);
    const composedSheets = await db.getComposedSheetsByJobId(jobId);

    return res.json({
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      options: job.options,
      results: {
        processedImages: processedImages.length,
        composedSheets: composedSheets.length,
        totalFiles: job.files.length
      },
      timestamps: {
        createdAt: job.createdAt,
        completedAt: job.completedAt
      },
      errorMessage: job.errorMessage
    });
  } catch (error) {
    console.error('Job progress error:', error);
    return res.status(500).json({
      error: 'Failed to get job progress',
      code: 'PROGRESS_CHECK_FAILED'
    });
  }
});

// Get job results
router.get('/job/:jobId/results', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        error: 'Invalid job ID',
        code: 'INVALID_JOB_ID'
      });
    }

    const job = await jobProcessingService.getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND'
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'Job not completed yet',
        code: 'JOB_NOT_COMPLETED',
        currentStatus: job.status,
        progress: job.progress
      });
    }

    const db = getDatabase();
    const processedImages = await db.getProcessedImagesByJobId(jobId);
    const composedSheets = await db.getComposedSheetsByJobId(jobId);

    // Generate download URLs using the download service
    const downloadUrls = await downloadService.generateDownloadUrls(jobId);

    return res.json({
      success: true,
      jobId: job.id,
      status: job.status,
      options: {
        ...job.options,
        aspectRatio: ensureAspectRatioOrientation(job.options.aspectRatio)
      },
      results: {
        processedImages: processedImages.map(image => ({
          id: image.id,
          originalFileId: image.originalFileId,
          processedPath: image.processedPath,
          aspectRatio: ensureAspectRatioOrientation(image.aspectRatio),
          cropArea: image.cropArea,
          detections: image.detections,
          processingTime: image.processingTime,
          instagramContent: image.instagramContent, // ✅ Added missing Instagram content!
          createdAt: image.createdAt
        })),
        composedSheets: composedSheets.map(sheet => ({
          id: sheet.id,
          sheetPath: sheet.sheetPath,
          layout: sheet.layout,
          orientation: sheet.orientation,
          imageCount: sheet.images.length,
          emptySlots: sheet.emptySlots,
          createdAt: sheet.createdAt
        }))
      },
      downloadUrls,
      completedAt: job.completedAt
    });
  } catch (error) {
    console.error('Job results error:', error);
    return res.status(500).json({
      error: 'Failed to get job results',
      code: 'RESULTS_FETCH_FAILED'
    });
  }
});

// Force cleanup of old jobs
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { olderThanHours = 24 } = req.body;
    
    if (typeof olderThanHours !== 'number' || olderThanHours < 1) {
      return res.status(400).json({
        error: 'Invalid olderThanHours parameter',
        code: 'INVALID_CLEANUP_HOURS'
      });
    }

    await jobProcessingService.cleanupOldJobs(olderThanHours);
    
    return res.json({
      success: true,
      message: `Cleaned up jobs older than ${olderThanHours} hours`
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({
      error: 'Failed to cleanup old jobs',
      code: 'CLEANUP_FAILED'
    });
  }
});

// Check Python service health
router.get('/python-service/health', async (_req: Request, res: Response) => {
  try {
    const pythonClient = getPythonServiceClient();
    const healthStatus = await pythonClient.checkHealth();
    
    return res.json({
      success: true,
      pythonService: {
        healthy: true,
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        version: healthStatus.version,
        uptime: healthStatus.uptime
      }
    });
  } catch (error) {
    console.error('Python service health check failed:', error);
    return res.status(503).json({
      success: false,
      pythonService: {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Get processing statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    
    // Get all jobs for statistics
    const allJobs = [];
    const jobsMap = (db as any).store.jobs;
    for (const [, job] of jobsMap) {
      allJobs.push(job);
    }

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: {
        jobs: allJobs.length,
        completed: allJobs.filter(j => j.status === 'completed').length,
        failed: allJobs.filter(j => j.status === 'failed').length,
        processing: allJobs.filter(j => ['processing', 'composing', 'generating_pdf'].includes(j.status)).length
      },
      last24Hours: {
        jobs: allJobs.filter(j => new Date(j.createdAt) > last24Hours).length,
        completed: allJobs.filter(j => j.status === 'completed' && new Date(j.createdAt) > last24Hours).length
      },
      last7Days: {
        jobs: allJobs.filter(j => new Date(j.createdAt) > last7Days).length,
        completed: allJobs.filter(j => j.status === 'completed' && new Date(j.createdAt) > last7Days).length
      },
      queue: jobProcessingService.getQueueStatus()
    };

    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({
      error: 'Failed to get processing statistics',
      code: 'STATS_FAILED'
    });
  }
});

export default router;