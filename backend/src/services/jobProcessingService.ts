/**
 * Job Processing Service
 * 
 * Purpose: Manages the job processing queue, coordinates processing pipeline
 * execution, and provides real-time progress updates through event emission.
 * Handles job lifecycle from queuing to completion with error recovery.
 * 
 * Usage:
 * ```typescript
 * const result = await jobProcessingService.processJob(jobId);
 * jobProcessingService.on('progressUpdated', (data) => console.log('Progress:', data));
 * ```
 * 
 * Updates:
 * - Added real-time progress tracking during image processing
 * - Enhanced progress callbacks for detailed status updates
 * - Improved error handling and job state management
 * 
 * Key Features:
 * - Queue-based processing with concurrency limits
 * - Real-time progress updates via event emission
 * - Automatic cleanup and error recovery
 * - Progress callbacks for pipeline integration
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getDatabase } from '../database/connection';
import {
  validateJob,
  validateProcessedImage,
  validateComposedSheet,
  type Job,
  type JobProgress,
  type ProcessingOptions,
  type FileMetadata,
  type ProcessedImage,
  type ComposedSheet
} from '../database/schema';
import { processingPipelineService } from './processingPipelineService.js';

import fs from 'fs';


export interface ProcessingQueue {
  jobId: string;
  priority: number;
  createdAt: Date;
}

export interface JobProcessingResult {
  success: boolean;
  jobId: string;
  processedImages: ProcessedImage[];
  composedSheets: ComposedSheet[];
  pdfPath?: string;
  zipPath?: string;
  error?: string;
}

export class JobProcessingService extends EventEmitter {
  private processingQueue: ProcessingQueue[] = [];
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs: number = 3;

  constructor() {
    super();
    // Start processing queue
    this.startQueueProcessor();
  }

  /**
   * Create a new processing job with enhanced options support
   */
  async createJob(files: FileMetadata[], options: ProcessingOptions, userId: string): Promise<Job> {
    const jobId = uuidv4();
    const now = new Date();

    const initialProgress: JobProgress = {
      currentStage: 'uploading',
      processedImages: 0,
      totalImages: files.length,
      percentage: 0,
      stageProgress: {
        processing: 0,
        composing: 0,
        generatingPdf: 0
      }
    };

    const job: Job = {
      id: jobId,
      userId, // Associate job with authenticated user
      status: 'pending',
      files,
      options,
      createdAt: now,
      progress: initialProgress,
      isPublic: false, // Jobs are private by default
      title: undefined // No custom title by default
    };

    const db = getDatabase();
    const validatedJob = validateJob(job);
    await db.createJob(validatedJob);

    // Add to processing queue
    this.addToQueue(jobId);

    console.log(`Created job ${jobId} with ${files.length} files and options:`, {
      aspectRatio: options.aspectRatio.name,
      faceDetection: options.faceDetectionEnabled,
      sheetComposition: options.sheetComposition?.enabled || false
    });

    return validatedJob;
  }

  /**
   * Add job to processing queue
   */
  private addToQueue(jobId: string, priority: number = 0): void {
    const queueItem: ProcessingQueue = {
      jobId,
      priority,
      createdAt: new Date()
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.processingQueue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.processingQueue.push(queueItem);
    } else {
      this.processingQueue.splice(insertIndex, 0, queueItem);
    }

    this.emit('queueUpdated', {
      queueLength: this.processingQueue.length,
      activeJobs: this.activeJobs.size
    });
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.activeJobs.size < this.maxConcurrentJobs && this.processingQueue.length > 0) {
        const nextJob = this.processingQueue.shift();
        if (nextJob) {
          this.processJob(nextJob.jobId).catch(error => {
            console.error(`Error processing job ${nextJob.jobId}:`, error);
          });
        }
      }
    }, 1000); // Check every second
  }

  /**
   * Process a complete job through all stages
   */
  private async processJob(jobId: string): Promise<void> {
    if (this.activeJobs.has(jobId)) {
      return; // Already processing
    }

    this.activeJobs.add(jobId);
    const db = getDatabase();

    try {
      const job = await db.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      console.log(`Starting processing for job ${jobId}`);

      // Update job status to processing
      await this.updateJobProgress(jobId, {
        currentStage: 'processing',
        processedImages: 0,
        totalImages: job.files.length,
        percentage: 0
      }, 'processing');

      // Execute the complete processing pipeline
      const processingResults = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: './processed',
        tempDir: './temp',
        cleanupOnError: true,
        maxRetries: 3,
        progressCallback: async (progress) => {
          await this.updateJobProgress(jobId, progress);
        }
      });

      // Update progress throughout the pipeline
      await this.updateJobProgress(jobId, {
        currentStage: 'completed',
        processedImages: processingResults.processedImages.length,
        totalImages: job.files.length,
        percentage: 100
      }, 'completed');

      // Store results in database
      await this.storeProcessingResults(jobId, processingResults);

      const result: JobProcessingResult = {
        success: true,
        jobId,
        processedImages: processingResults.processedImages,
        composedSheets: processingResults.composedSheets,
        ...(processingResults.pdfPath && { pdfPath: processingResults.pdfPath }),
        ...(processingResults.zipPath && { zipPath: processingResults.zipPath })
      };

      this.emit('jobCompleted', result);
      console.log(`Job ${jobId} completed successfully`);

    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);

      await this.updateJobProgress(jobId, {
        currentStage: 'completed',
        processedImages: 0,
        totalImages: 0,
        percentage: 0
      }, 'failed', error instanceof Error ? error.message : 'Unknown error');

      const result: JobProcessingResult = {
        success: false,
        jobId,
        processedImages: [],
        composedSheets: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('jobFailed', result);
    } finally {
      this.activeJobs.delete(jobId);

      // Schedule cleanup for this job (after 1 hour)
      setTimeout(() => {
        this.cleanupJob(jobId).catch(error => {
          console.error(`Error cleaning up job ${jobId}:`, error);
        });
      }, 60 * 60 * 1000); // 1 hour
    }
  }

  /**
   * Store processing results in database
   */
  private async storeProcessingResults(jobId: string, results: any): Promise<void> {
    const db = getDatabase();

    // Store processed images
    for (const image of results.processedImages) {
      const imageWithJobId = {
        ...image,
        jobId,
        createdAt: new Date()
      };
      const validatedImage = validateProcessedImage(imageWithJobId);
      await db.createProcessedImage(validatedImage);
    }

    // Store composed sheets
    for (const sheet of results.composedSheets) {
      const sheetWithJobId = {
        ...sheet,
        jobId,
        createdAt: new Date(),
        // Ensure each image in the sheet has jobId and createdAt
        images: sheet.images.map((image: any) => ({
          ...image,
          jobId,
          createdAt: new Date()
        }))
      };
      const validatedSheet = validateComposedSheet(sheetWithJobId);
      await db.createComposedSheet(validatedSheet);
    }

    // Emit events for real-time updates
    this.emit('processingCompleted', {
      jobId,
      processedImages: results.processedImages.length,
      composedSheets: results.composedSheets.length,
      hasPDF: !!results.pdfPath
    });
  }

  /**
   * Update job progress and status
   */
  private async updateJobProgress(
    jobId: string,
    progress: Partial<JobProgress>,
    status?: Job['status'],
    errorMessage?: string
  ): Promise<void> {
    const db = getDatabase();
    const job = await db.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const updatedProgress = { ...job.progress, ...progress };
    const updates: Partial<Job> = {
      progress: updatedProgress,
      ...(status && { status }),
      ...(errorMessage && { errorMessage }),
      ...(status === 'completed' && { completedAt: new Date() })
    };

    await db.updateJob(jobId, updates);

    this.emit('progressUpdated', {
      jobId,
      progress: updatedProgress,
      status: status || job.status
    });
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    const db = getDatabase();
    return await db.getJob(jobId);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { queueLength: number; activeJobs: number; maxConcurrent: number } {
    return {
      queueLength: this.processingQueue.length,
      activeJobs: this.activeJobs.size,
      maxConcurrent: this.maxConcurrentJobs
    };
  }

  /**
   * Clean up job files and data
   */
  private async cleanupJob(jobId: string): Promise<void> {
    const db = getDatabase();

    try {
      const job = await db.getJob(jobId);
      if (!job) return;

      const files = await db.getFilesByJobId(jobId);
      const processedImages = await db.getProcessedImagesByJobId(jobId);
      const composedSheets = await db.getComposedSheetsByJobId(jobId);

      // Delete physical files
      for (const file of files) {
        try {
          if (fs.existsSync(file.uploadPath)) {
            fs.unlinkSync(file.uploadPath);
          }
        } catch (error) {
          console.error(`Error deleting file ${file.uploadPath}:`, error);
        }
      }

      for (const image of processedImages) {
        try {
          if (fs.existsSync(image.processedPath)) {
            fs.unlinkSync(image.processedPath);
          }
        } catch (error) {
          console.error(`Error deleting processed image ${image.processedPath}:`, error);
        }
      }

      for (const sheet of composedSheets) {
        try {
          if (fs.existsSync(sheet.sheetPath)) {
            fs.unlinkSync(sheet.sheetPath);
          }
        } catch (error) {
          console.error(`Error deleting sheet ${sheet.sheetPath}:`, error);
        }
      }

      console.log(`Cleaned up job ${jobId}`);

    } catch (error) {
      console.error(`Error during cleanup of job ${jobId}:`, error);
    }
  }

  /**
   * Force cleanup of all old jobs
   */
  async cleanupOldJobs(olderThanHours: number = 24): Promise<void> {
    const db = getDatabase();
    await db.cleanupOldJobs(olderThanHours);
  }
}

// Export singleton instance
export const jobProcessingService = new JobProcessingService();