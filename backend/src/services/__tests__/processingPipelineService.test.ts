import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processingPipelineService } from '../processingPipelineService.js';
import { 
  Job, 
  ProcessingOptions, 
  FileMetadata, 
  AspectRatio, 
  GridLayout 
} from '../../types/index.js';

// Mock the services
vi.mock('../imageProcessingService.js', () => ({
  imageProcessingService: {
    processImageToAspectRatio: vi.fn()
  }
}));



vi.mock('../sheetCompositionService.js', () => ({
  sheetCompositionService: {
    composeA4Sheets: vi.fn()
  }
}));

vi.mock('../pdfGenerationService.js', () => ({
  pdfGenerationService: {
    validateSheetFiles: vi.fn(),
    generatePDF: vi.fn()
  }
}));

describe('ProcessingPipelineService', () => {
  const testOutputDir = './test-output';
  const testTempDir = './test-temp';

  beforeEach(() => {
    // Create test directories
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  const createMockJob = (options: Partial<ProcessingOptions> = {}): Job => {
    const aspectRatio: AspectRatio = {
      width: 4,
      height: 6,
      name: '4x6'
    };

    const gridLayout: GridLayout = {
      rows: 2,
      columns: 2,
      name: '2x2'
    };

    const files: FileMetadata[] = [
      {
        id: 'file1',
        originalName: 'test1.jpg',
        size: 1024000,
        mimeType: 'image/jpeg',
        uploadPath: './test-images/test1.jpg',
        uploadedAt: new Date()
      },
      {
        id: 'file2',
        originalName: 'test2.jpg',
        size: 2048000,
        mimeType: 'image/jpeg',
        uploadPath: './test-images/test2.jpg',
        uploadedAt: new Date()
      }
    ];

    const processingOptions: ProcessingOptions = {
      aspectRatio,
      faceDetectionEnabled: false,
      sheetComposition: null,
      ...options
    };

    return {
      id: 'test-job-1',
      status: 'pending',
      files,
      options: processingOptions,
      createdAt: new Date(),
      progress: {
        currentStage: 'uploading',
        processedImages: 0,
        totalImages: files.length,
        percentage: 0
      }
    };
  };

  describe('executeProcessingPipeline', () => {
    it('should process images successfully without sheet composition', async () => {
      const job = createMockJob();
      
      // Mock image processing service
      const { imageProcessingService } = await import('../imageProcessingService.js');
      vi.mocked(imageProcessingService.processImageToAspectRatio).mockResolvedValueOnce({
        id: 'processed1',
        originalFileId: 'file1',
        processedPath: path.join(testOutputDir, 'processed1.jpg'),
        cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
        aspectRatio: job.options.aspectRatio,
        detections: { faces: [], people: [], confidence: 0 },
        processingTime: 1500
      }).mockResolvedValueOnce({
        id: 'processed2',
        originalFileId: 'file2',
        processedPath: path.join(testOutputDir, 'processed2.jpg'),
        cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
        aspectRatio: job.options.aspectRatio,
        detections: { faces: [], people: [], confidence: 0 },
        processingTime: 1800
      });



      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.jobId).toBe('test-job-1');
      expect(results.processedImages).toHaveLength(2);
      expect(results.composedSheets).toHaveLength(0);
      expect(results.pdfPath).toBeUndefined();
      expect(results.downloadUrls.individualImages).toEqual({});
      expect(results.downloadUrls.sheets).toEqual({});
    });

    it('should process images and compose sheets successfully', async () => {
      const job = createMockJob({
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait',
          generatePDF: false
        }
      });

      // Mock services
      const { imageProcessingService } = await import('../imageProcessingService.js');
      const { sheetCompositionService } = await import('../sheetCompositionService.js');

      const mockProcessedImages = [
        {
          id: 'processed1',
          originalFileId: 'file1',
          processedPath: path.join(testOutputDir, 'processed1.jpg'),
          cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
          aspectRatio: job.options.aspectRatio,
          detections: { faces: [], people: [], confidence: 0 },
          processingTime: 1500
        },
        {
          id: 'processed2',
          originalFileId: 'file2',
          processedPath: path.join(testOutputDir, 'processed2.jpg'),
          cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
          aspectRatio: job.options.aspectRatio,
          detections: { faces: [], people: [], confidence: 0 },
          processingTime: 1800
        }
      ];

      vi.mocked(imageProcessingService.processImageToAspectRatio)
        .mockResolvedValueOnce(mockProcessedImages[0])
        .mockResolvedValueOnce(mockProcessedImages[1]);

      vi.mocked(sheetCompositionService.composeA4Sheets).mockResolvedValue([
        {
          id: 'sheet1',
          sheetPath: path.join(testOutputDir, 'sheet1.jpg'),
          layout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait',
          images: mockProcessedImages,
          emptySlots: 2,
          createdAt: new Date()
        }
      ]);



      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(2);
      expect(results.composedSheets).toHaveLength(1);
      expect(results.downloadUrls.individualImages).toEqual({});
      expect(results.downloadUrls.sheets).toEqual({});
    });

    it('should process images, compose sheets, and generate PDF successfully', async () => {
      const job = createMockJob({
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait',
          generatePDF: true
        }
      });

      // Mock services
      const { imageProcessingService } = await import('../imageProcessingService.js');
      const { sheetCompositionService } = await import('../sheetCompositionService.js');
      const { pdfGenerationService } = await import('../pdfGenerationService.js');

      const mockProcessedImages = [
        {
          id: 'processed1',
          originalFileId: 'file1',
          processedPath: path.join(testOutputDir, 'processed1.jpg'),
          cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
          aspectRatio: job.options.aspectRatio,
          detections: { faces: [], people: [], confidence: 0 },
          processingTime: 1500
        },
        {
          id: 'processed2',
          originalFileId: 'file2',
          processedPath: path.join(testOutputDir, 'processed2.jpg'),
          cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
          aspectRatio: job.options.aspectRatio,
          detections: { faces: [], people: [], confidence: 0 },
          processingTime: 1800
        }
      ];

      const mockComposedSheets = [
        {
          id: 'sheet1',
          sheetPath: path.join(testOutputDir, 'sheet1.jpg'),
          layout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait' as const,
          images: mockProcessedImages,
          emptySlots: 2,
          createdAt: new Date()
        }
      ];

      vi.mocked(imageProcessingService.processImageToAspectRatio)
        .mockResolvedValueOnce(mockProcessedImages[0])
        .mockResolvedValueOnce(mockProcessedImages[1]);

      vi.mocked(sheetCompositionService.composeA4Sheets)
        .mockResolvedValue(mockComposedSheets);

      vi.mocked(pdfGenerationService.validateSheetFiles)
        .mockReturnValue({ isValid: true, missingFiles: [] });

      vi.mocked(pdfGenerationService.generatePDF)
        .mockResolvedValue(path.join(testOutputDir, 'output.pdf'));



      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(2);
      expect(results.composedSheets).toHaveLength(1);
      expect(results.pdfPath).toBeDefined();
      expect(results.downloadUrls.individualImages).toEqual({});
      expect(results.downloadUrls.sheets).toEqual({});
    });

    it('should handle image processing failures with retries', async () => {
      const job = createMockJob();
      
      const { imageProcessingService } = await import('../imageProcessingService.js');
      
      // First image fails twice then succeeds, second image succeeds immediately
      vi.mocked(imageProcessingService.processImageToAspectRatio)
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockRejectedValueOnce(new Error('Processing failed again'))
        .mockResolvedValueOnce({
          id: 'processed1',
          originalFileId: 'file1',
          processedPath: path.join(testOutputDir, 'processed1.jpg'),
          cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
          aspectRatio: job.options.aspectRatio,
          detections: { faces: [], people: [], confidence: 0 },
          processingTime: 1500
        })
        .mockResolvedValueOnce({
          id: 'processed2',
          originalFileId: 'file2',
          processedPath: path.join(testOutputDir, 'processed2.jpg'),
          cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
          aspectRatio: job.options.aspectRatio,
          detections: { faces: [], people: [], confidence: 0 },
          processingTime: 1800
        });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 3
      });

      expect(results.processedImages).toHaveLength(2);
      expect(imageProcessingService.processImageToAspectRatio).toHaveBeenCalledTimes(4);
    });

    it('should continue processing when sheet composition fails', async () => {
      const job = createMockJob({
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait',
          generatePDF: false
        }
      });

      const { imageProcessingService } = await import('../imageProcessingService.js');
      const { sheetCompositionService } = await import('../sheetCompositionService.js');

      const mockProcessedImage = {
        id: 'processed1',
        originalFileId: 'file1',
        processedPath: path.join(testOutputDir, 'processed1.jpg'),
        cropArea: { x: 0, y: 0, width: 800, height: 1200, confidence: 0.8 },
        aspectRatio: job.options.aspectRatio,
        detections: { faces: [], people: [], confidence: 0 },
        processingTime: 1500
      };

      vi.mocked(imageProcessingService.processImageToAspectRatio)
        .mockResolvedValueOnce(mockProcessedImage)
        .mockResolvedValueOnce({
          ...mockProcessedImage,
          id: 'processed2',
          originalFileId: 'file2'
        });

      vi.mocked(sheetCompositionService.composeA4Sheets)
        .mockRejectedValue(new Error('Sheet composition failed'));

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      // Should still have processed images even though sheet composition failed
      expect(results.processedImages).toHaveLength(2);
      expect(results.composedSheets).toHaveLength(0);
    });

    it('should throw error when all image processing fails', async () => {
      const job = createMockJob();
      
      const { imageProcessingService } = await import('../imageProcessingService.js');
      vi.mocked(imageProcessingService.processImageToAspectRatio)
        .mockRejectedValue(new Error('All processing failed'));

      await expect(
        processingPipelineService.executeProcessingPipeline(job, {
          outputDir: testOutputDir,
          tempDir: testTempDir,
          cleanupOnError: false,
          maxRetries: 1
        })
      ).rejects.toThrow('Image processing failed');
    });
  });

  describe('validateProcessingOptions', () => {
    it('should validate valid processing options', () => {
      const options: ProcessingOptions = {
        aspectRatio: { width: 4, height: 6, name: '4x6' },
        faceDetectionEnabled: true,
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait',
          generatePDF: true
        }
      };

      const result = processingPipelineService.validateProcessingOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid aspect ratio', () => {
      const options: ProcessingOptions = {
        aspectRatio: { width: 0, height: 0, name: '' },
        faceDetectionEnabled: false,
        sheetComposition: null
      };

      const result = processingPipelineService.validateProcessingOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid aspect ratio configuration');
    });

    it('should detect invalid sheet composition options', () => {
      const options: ProcessingOptions = {
        aspectRatio: { width: 4, height: 6, name: '4x6' },
        faceDetectionEnabled: false,
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 0, columns: 0, name: '' },
          orientation: 'invalid' as any,
          generatePDF: false
        }
      };

      const result = processingPipelineService.validateProcessingOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid grid layout configuration');
      expect(result.errors).toContain('Invalid sheet orientation');
    });
  });

  describe('getProcessingStats', () => {
    it('should calculate processing statistics correctly', () => {
      const results = {
        jobId: 'test-job',
        processedImages: [
          { processingTime: 1500 } as any,
          { processingTime: 2000 } as any
        ],
        composedSheets: [
          { id: 'sheet1' } as any
        ],
        pdfPath: '/path/to/pdf',
        downloadUrls: { individualImages: {} }
      };

      const stats = processingPipelineService.getProcessingStats(results);
      
      expect(stats.totalImages).toBe(2);
      expect(stats.successfulImages).toBe(2);
      expect(stats.totalSheets).toBe(1);
      expect(stats.hasPDF).toBe(true);
      expect(stats.processingTime).toBe(3500);
    });
  });
});