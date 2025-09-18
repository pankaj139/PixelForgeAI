import express, { Request, Response } from 'express';
import multer from 'multer';

import { getDatabase } from '../database/connection';
import { validateProcessingOptions, validateFileMetadata } from '../database/schema';
import { validateUploadedFiles, SUPPORTED_MIME_TYPES, MAX_FILE_SIZE } from '../utils/validation';
import { FileStorageService, createDefaultStorageConfig } from '../utils/fileStorage';
import { jobProcessingService } from '../services/jobProcessingService';
import { getPythonServiceClient } from '../services/pythonServiceClient';
import { authenticateToken } from '../middleware/auth';
import type { FileMetadata, ProcessingOptions } from '../database/schema';
import path from 'path';

const router = express.Router();

// Initialize file storage service
const storageConfig = createDefaultStorageConfig(path.join(__dirname, '../../'));
const fileStorage = new FileStorageService(storageConfig);

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storageConfig.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only image files
  if (SUPPORTED_MIME_TYPES.includes(file.mimetype as any)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and TIFF files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 20 // Maximum 20 files per request
  }
});

// Upload endpoint with authentication and explicit multer error handling wrapper to ensure consistent JSON errors
router.post('/', authenticateToken, (req: Request, res: Response, next) => {
  return upload.array('images', 10)(req, res, (err: any) => {
    if (err) {
      const isMulter = err instanceof (multer as any).MulterError;
      return res.status(400).json({
        error: err.message,
        code: isMulter ? err.code || 'MULTER_ERROR' : 'UPLOAD_ERROR'
      });
    }
    return next();
  });
}, async (req: Request, res: Response): Promise<Response | void> => {
  const uploadedFiles: string[] = []; // Track files for cleanup on error

  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    // Comprehensive file validation
    const fileValidation = validateUploadedFiles(files);
    if (!fileValidation.isValid) {
      // Clean up uploaded files on validation failure
      await fileStorage.deleteFiles(files.map(f => f.path));

      return res.status(400).json({
        error: 'File validation failed',
        code: 'VALIDATION_FAILED',
        details: fileValidation.errors
      });
    }

    // Parse and validate processing options from request body
    const optionsData = req.body.options;
    if (!optionsData) {
      await fileStorage.deleteFiles(files.map(f => f.path));
      return res.status(400).json({
        error: 'Processing options are required',
        code: 'MISSING_PROCESSING_OPTIONS'
      });
    }

    let processingOptions: ProcessingOptions;
    try {
      processingOptions = typeof optionsData === 'string'
        ? JSON.parse(optionsData)
        : optionsData;

      console.log('🔍 Received processing options:', JSON.stringify(processingOptions, null, 2));
      validateProcessingOptions(processingOptions);
      console.log('✅ Processing options validated successfully');
    } catch (error) {
      await fileStorage.deleteFiles(files.map(f => f.path));
      return res.status(400).json({
        error: 'Invalid processing options format',
        code: 'INVALID_PROCESSING_OPTIONS',
        details: error instanceof Error ? error.message : 'Unknown validation error'
      });
    }

    const db = getDatabase();

    // Store files using file storage service and create metadata
    const fileMetadata: FileMetadata[] = [];

    for (const file of files) {
      try {
        const storedFile = await fileStorage.storeUploadedFile(file);
        uploadedFiles.push(storedFile.storedPath);

        const metadata: FileMetadata = {
          id: storedFile.id,
          originalName: storedFile.originalName,
          size: storedFile.size,
          mimeType: storedFile.mimeType,
          uploadPath: storedFile.storedPath,
          uploadedAt: storedFile.createdAt
        };

        fileMetadata.push(metadata);
      } catch (error) {
        // Clean up any files stored so far
        await fileStorage.deleteFiles(uploadedFiles);
        throw new Error(`Failed to store file ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Store file metadata with database
    for (const file of fileMetadata) {
      const validatedFile = validateFileMetadata(file);
      await db.createFile(validatedFile);
    }

    // Validate Python service availability before creating job
    const pythonClient = getPythonServiceClient();
    try {
      await pythonClient.checkHealth();
      console.log('Python service is healthy and ready for processing');
    } catch (error) {
      console.warn('Python service health check failed, processing may use fallback methods:', error);
      // Continue with job creation - the processing pipeline will handle fallbacks
    }

    // Get authenticated user ID
    const userId = (req as any).user.userId;
    
    // Create processing job using the job processing service
    const job = await jobProcessingService.createJob(fileMetadata, processingOptions, userId);

    console.log(`Created job ${job.id} with ${files.length} files`);

    return res.status(201).json({
      success: true,
      message: 'Files uploaded successfully and processing started',
      jobId: job.id,
      filesCount: files.length,
      files: fileMetadata.map(f => ({
        id: f.id,
        originalName: f.originalName,
        size: f.size,
        mimeType: f.mimeType
      })),
      options: job.options,
      progress: job.progress
    });

  } catch (error) {
    console.error('Upload error:', error);

    // Clean up any uploaded files on error
    if (uploadedFiles.length > 0) {
      await fileStorage.deleteFiles(uploadedFiles);
    }

    return res.status(500).json({
      error: 'Failed to process upload',
      code: 'UPLOAD_FAILED',
      message: error instanceof Error ? error.message : 'Unknown server error'
    });
  }
});

// Validate files without uploading (for client-side validation) with multer wrapper
router.post('/validate', (req: Request, res: Response, next) => {
  return upload.array('images', 10)(req, res, (err: any) => {
    if (err) {
      const isMulter = err instanceof (multer as any).MulterError;
      return res.status(400).json({
        valid: false,
        error: err.message,
        code: isMulter ? err.code || 'MULTER_ERROR' : 'UPLOAD_ERROR'
      });
    }
    return next();
  });
}, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        valid: false,
        error: 'No files provided for validation'
      });
    }

    // Validate files
    const validation = validateUploadedFiles(files);

    // Clean up temporary files
    await fileStorage.deleteFiles(files.map(f => f.path));

    if (validation.isValid) {
      return res.json({
        valid: true,
        message: 'All files are valid',
        filesCount: files.length,
        files: files.map(f => ({
          name: f.originalname,
          size: f.size,
          mimeType: f.mimetype
        }))
      });
    } else {
      return res.status(400).json({
        valid: false,
        errors: validation.errors,
        filesCount: files.length
      });
    }

  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({
      valid: false,
      error: 'Failed to validate files'
    });
  }
});

// Get job status with enhanced progress tracking
router.get('/status/:jobId', async (req: Request, res: Response) => {
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
    const files = await db.getFilesByJobId(jobId);
    const processedImages = await db.getProcessedImagesByJobId(jobId);
    const composedSheets = await db.getComposedSheetsByJobId(jobId);

    return res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      filesCount: files.length,
      processedImagesCount: processedImages.length,
      composedSheetsCount: composedSheets.length,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      options: job.options,
      errorMessage: job.errorMessage,
      files: files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        size: f.size,
        mimeType: f.mimeType
      }))
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      error: 'Failed to check job status',
      code: 'STATUS_CHECK_FAILED'
    });
  }
});

// Storage management endpoints
router.get('/storage/usage', async (_req: Request, res: Response) => {
  try {
    const usage = await fileStorage.getStorageUsage();

    return res.json({
      usage: {
        upload: {
          bytes: usage.uploadDir,
          mb: Math.round(usage.uploadDir / (1024 * 1024) * 100) / 100
        },
        processed: {
          bytes: usage.processedDir,
          mb: Math.round(usage.processedDir / (1024 * 1024) * 100) / 100
        },
        temp: {
          bytes: usage.tempDir,
          mb: Math.round(usage.tempDir / (1024 * 1024) * 100) / 100
        },
        total: {
          bytes: usage.total,
          mb: Math.round(usage.total / (1024 * 1024) * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Storage usage error:', error);
    return res.status(500).json({ error: 'Failed to get storage usage' });
  }
});

router.post('/storage/cleanup', async (_req: Request, res: Response) => {
  try {
    const result = await fileStorage.cleanupOldFiles();

    return res.json({
      message: 'Cleanup completed',
      deleted: result.deleted,
      errors: result.errors
    });

  } catch (error) {
    console.error('Storage cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup storage' });
  }
});

export default router;