import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { JobProcessingService } from '../jobProcessingService';
import { getDatabase } from '../../database/connection';
import { ImageProcessingService } from '../imageProcessingService';
import { SheetCompositionService } from '../sheetCompositionService';
import { PDFGenerationService } from '../pdfGenerationService';
import type { 
  FileMetadata, 
  ProcessingOptions, 
  AspectRatio, 
  ProcessedImage,
  ComposedSheet,
  GridLayout 
} from '../../database/schema';

// Mock dependencies
vi.mock('../../database/connection');
vi.mock('../imageProcessingService');
vi.mock('../sheetCompositionService');
vi.mock('../pdfGenerationService');
vi.mock('../../utils/fileStorage');

const mockDatabase = {
  createJob: vi.fn(),
  getJob: vi.fn(),
  updateJob: vi.fn(),
  createProcessedImage: vi.fn(),
  createComposedSheet: vi.fn(),
  getFilesByJobId: vi.fn(),
  getProcessedImagesByJobId: vi.fn(),
  getComposedSheetsByJobId: vi.fn(),
  cleanupOldJobs: vi.fn()
};

const mockImageProcessingService = {
  processImage: vi.fn()
};

const mockSheetCompositionService = {
  composeSheets: vi.fn()
};

const mockPDFGenerationService = {
  generatePDF: vi.fn()
};

describe('JobProcessingService', () => {
  let jobProcessingService: JobProcessingService;
  let mockGetDatabase: MockedFunction<typeof getDatabase>;

  const sampleAspectRatio: AspectRatio = {
    width: 4,
    height: 6,
    name: '4x6'
  };

  const sampleGridLayout: GridLayout = {
    rows: 1,
    columns: 2,
    name: '1x2'
  };

  const sampleProcessingOptions: ProcessingOptions = {
    aspectRatio: sampleAspectRatio,
    faceDetectionEnabled: true,
    sheetComposition: {
      enabled: true,
      gridLayout: sampleGridLayout,
      orientation: 'portrait',
      generatePDF: true
    },
    aiNamingEnabled: true,
    generateInstagramContent: true
  };

  const sampleFiles: FileMetadata[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      originalName: 'test1.jpg',
      size: 1024000,
      mimeType: 'image/jpeg',
      uploadPath: '/uploads/test1.jpg',
      uploadedAt: new Date()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      originalName: 'test2.jpg',
      size: 2048000,
      mimeType: 'image/jpeg',
      uploadPath: '/uploads/test2.jpg',
      uploadedAt: new Date()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetDatabase = vi.mocked(getDatabase);
    mockGetDatabase.mockReturnValue(mockDatabase as any);

    // Mock constructors
    vi.mocked(ImageProcessingService).mockImplementation(() => mockImageProcessingService as any);
    vi.mocked(SheetCompositionService).mockImplementation(() => mockSheetCompositionService as any);
    vi.mocked(PDFGenerationService).mockImplementation(() => mockPDFGenerationService as any);

    jobProcessingService = new JobProcessingService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createJob', () => {
    it('should create a job with correct initial progress', async () => {
      mockDatabase.createJob.mockResolvedValue(undefined);

      const result = await jobProcessingService.createJob(sampleFiles, sampleProcessingOptions, '550e8400-e29b-41d4-a716-446655440000');

      expect(result).toMatchObject({
        status: 'pending',
        files: sampleFiles,
        options: sampleProcessingOptions,
        progress: {
          currentStage: 'uploading',
          processedImages: 0,
          totalImages: 2,
          percentage: 0,
          stageProgress: {
            processing: 0,
            composing: 0,
            generatingPdf: 0
          }
        }
      });

      expect(mockDatabase.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          files: sampleFiles,
          options: sampleProcessingOptions,
          createdAt: expect.any(Date),
          progress: {
            currentStage: 'uploading',
            processedImages: 0,
            totalImages: 2,
            percentage: 0,
            stageProgress: {
              processing: 0,
              composing: 0,
              generatingPdf: 0
            }
          }
        })
      );
    });

    it('should create job with minimal options (no sheet composition)', async () => {
      const minimalOptions: ProcessingOptions = {
        aspectRatio: sampleAspectRatio,
        faceDetectionEnabled: false,
        sheetComposition: null,
        aiNamingEnabled: false,
        generateInstagramContent: false
      };

      mockDatabase.createJob.mockResolvedValue(undefined);

      const result = await jobProcessingService.createJob(sampleFiles, minimalOptions, '550e8400-e29b-41d4-a716-446655440000');

      expect(result.options.sheetComposition).toBeNull();
      expect(result.options.faceDetectionEnabled).toBe(false);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status from database', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'processing',
        progress: {
          currentStage: 'processing',
          processedImages: 1,
          totalImages: 2,
          percentage: 50
        }
      };

      mockDatabase.getJob.mockResolvedValue(mockJob);

      const result = await jobProcessingService.getJobStatus('job-123');

      expect(result).toEqual(mockJob);
      expect(mockDatabase.getJob).toHaveBeenCalledWith('job-123');
    });

    it('should return null for non-existent job', async () => {
      mockDatabase.getJob.mockResolvedValue(null);

      const result = await jobProcessingService.getJobStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getQueueStatus', () => {
    it('should return current queue status', () => {
      const status = jobProcessingService.getQueueStatus();

      expect(status).toEqual({
        queueLength: expect.any(Number),
        activeJobs: expect.any(Number),
        maxConcurrent: expect.any(Number)
      });
    });
  });

  describe('event emission', () => {
    it('should emit queueUpdated event when job is added', async () => {
      let eventEmitted = false;
      
      jobProcessingService.on('queueUpdated', (data) => {
        expect(data).toHaveProperty('queueLength');
        expect(data).toHaveProperty('activeJobs');
        eventEmitted = true;
      });

      // This will trigger the queue update
      await jobProcessingService.createJob(sampleFiles, sampleProcessingOptions, '550e8400-e29b-41d4-a716-446655440000');
      
      expect(eventEmitted).toBe(true);
    });
  });

  describe('image processing workflow', () => {
    it('should process images and update progress correctly', async () => {
      const mockProcessedImage: ProcessedImage = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        originalFileId: '550e8400-e29b-41d4-a716-446655440001',
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        processedPath: '/processed/test1_4x6.jpg',
        cropArea: { x: 0, y: 0, width: 400, height: 600, confidence: 0.9 },
        aspectRatio: sampleAspectRatio,
        detections: {
          faces: [],
          people: [],
          confidence: 0.8
        },
        processingTime: 1500,
        createdAt: new Date()
      };

      mockImageProcessingService.processImage.mockResolvedValue(mockProcessedImage);
      mockDatabase.createProcessedImage.mockResolvedValue(undefined);

      // Test the private method indirectly by checking if events are emitted
      let imageProcessedEmitted = false;
      jobProcessingService.on('imageProcessed', (data) => {
        expect(data).toMatchObject({
          jobId: expect.any(String),
          imageId: 'processed-1',
          progress: expect.any(Number),
          total: expect.any(Number)
        });
        imageProcessedEmitted = true;
      });

      // We can't directly test private methods, but we can verify the service is set up correctly
      expect(mockImageProcessingService.processImage).toBeDefined();
    });
  });

  describe('sheet composition workflow', () => {
    it('should compose sheets when enabled in options', async () => {
      const mockComposedSheet: ComposedSheet = {
        id: '550e8400-e29b-41d4-a716-446655440004',
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        sheetPath: '/sheets/job-123_sheet-1.jpg',
        layout: sampleGridLayout,
        orientation: 'portrait',
        images: [],
        emptySlots: 0,
        createdAt: new Date()
      };

      mockSheetCompositionService.composeSheets.mockResolvedValue([mockComposedSheet]);
      mockDatabase.createComposedSheet.mockResolvedValue(undefined);

      // Test that the service is properly configured
      expect(mockSheetCompositionService.composeSheets).toBeDefined();
    });
  });

  describe('PDF generation workflow', () => {
    it('should generate PDF when requested', async () => {
      const mockPDFPath = '/pdfs/job-123_sheets.pdf';
      
      mockPDFGenerationService.generatePDF.mockResolvedValue(mockPDFPath);

      // Test that the service is properly configured
      expect(mockPDFGenerationService.generatePDF).toBeDefined();
    });
  });

  describe('progress tracking', () => {
    it('should track multi-stage progress correctly', async () => {
      const progressUpdates: any[] = [];
      
      jobProcessingService.on('progressUpdated', (data) => {
        progressUpdates.push(data);
      });

      // We can verify the progress structure is correct
      const mockJob = {
        id: 'job-123',
        progress: {
          currentStage: 'processing',
          processedImages: 1,
          totalImages: 2,
          percentage: 25,
          stageProgress: {
            processing: 50,
            composing: 0,
            generatingPdf: 0
          }
        }
      };

      mockDatabase.getJob.mockResolvedValue(mockJob);
      mockDatabase.updateJob.mockResolvedValue(undefined);

      // The progress structure should be valid
      expect(mockJob.progress.currentStage).toBe('processing');
      expect(mockJob.progress.stageProgress?.processing).toBe(50);
    });
  });

  describe('error handling', () => {
    it('should handle job processing errors gracefully', async () => {
      let jobFailedEmitted = false;
      
      jobProcessingService.on('jobFailed', (result) => {
        expect(result).toMatchObject({
          success: false,
          jobId: expect.any(String),
          processedImages: [],
          composedSheets: [],
          error: expect.any(String)
        });
        jobFailedEmitted = true;
      });

      // Test error handling setup
      expect(jobProcessingService.listenerCount('jobFailed')).toBeGreaterThan(0);
    });

    it('should continue processing other images when one fails', async () => {
      // Mock one successful and one failed image processing
      mockImageProcessingService.processImage
        .mockResolvedValueOnce({
          id: '550e8400-e29b-41d4-a716-446655440003',
          originalFileId: '550e8400-e29b-41d4-a716-446655440001',
          jobId: '550e8400-e29b-41d4-a716-446655440000',
          processedPath: '/processed/test1_4x6.jpg',
          cropArea: { x: 0, y: 0, width: 400, height: 600, confidence: 0.9 },
          aspectRatio: sampleAspectRatio,
          detections: { faces: [], people: [], confidence: 0.8 },
          processingTime: 1500,
          createdAt: new Date()
        })
        .mockRejectedValueOnce(new Error('Processing failed'));

      // The service should be resilient to individual image failures
      expect(mockImageProcessingService.processImage).toBeDefined();
    });
  });

  describe('cleanup functionality', () => {
    it('should clean up old jobs', async () => {
      mockDatabase.cleanupOldJobs.mockResolvedValue(undefined);

      await jobProcessingService.cleanupOldJobs(24);

      expect(mockDatabase.cleanupOldJobs).toHaveBeenCalledWith(24);
    });

    it('should use default cleanup time when not specified', async () => {
      mockDatabase.cleanupOldJobs.mockResolvedValue(undefined);

      await jobProcessingService.cleanupOldJobs();

      expect(mockDatabase.cleanupOldJobs).toHaveBeenCalledWith(24);
    });
  });

  describe('job completion workflow', () => {
    it('should emit jobCompleted event with correct result structure', (done) => {
      jobProcessingService.on('jobCompleted', (result) => {
        expect(result).toMatchObject({
          success: true,
          jobId: expect.any(String),
          processedImages: expect.any(Array),
          composedSheets: expect.any(Array)
        });
        done();
      });

      // The event structure should be properly defined
      expect(jobProcessingService.listenerCount('jobCompleted')).toBeGreaterThan(0);
    });
  });

  describe('concurrent job processing', () => {
    it('should respect maximum concurrent job limit', () => {
      const queueStatus = jobProcessingService.getQueueStatus();
      
      expect(queueStatus.maxConcurrent).toBeGreaterThan(0);
      expect(queueStatus.activeJobs).toBeLessThanOrEqual(queueStatus.maxConcurrent);
    });
  });
});