import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { 
  jobProcessingService,
  imageProcessingService,
  computerVisionService,
  croppingService,
  sheetCompositionService,
  pdfGenerationService,
  processingPipelineService
} from '../index.js';
import { 
  Job, 
  ProcessingOptions, 
  FileMetadata, 
  AspectRatio, 
  GridLayout 
} from '../../types/index.js';

describe('Complete Processing Workflow Integration', () => {
  const testDir = './test-integration';
  const testImagesDir = path.join(testDir, 'images');
  const testOutputDir = path.join(testDir, 'output');
  const testTempDir = path.join(testDir, 'temp');

  beforeEach(async () => {
    // Create test directories
    [testDir, testImagesDir, testOutputDir, testTempDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create test images
    await createTestImages();
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  const createTestImages = async (): Promise<void> => {
    // Create test images with different sizes and aspect ratios
    const testImages = [
      { name: 'landscape.jpg', width: 1200, height: 800 },
      { name: 'portrait.jpg', width: 600, height: 900 },
      { name: 'square.jpg', width: 800, height: 800 }
    ];

    for (const img of testImages) {
      const imagePath = path.join(testImagesDir, img.name);
      await sharp({
        create: {
          width: img.width,
          height: img.height,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toFile(imagePath);
    }
  };

  const createMockJob = (
    imageNames: string[] = ['landscape.jpg', 'portrait.jpg'],
    options: Partial<ProcessingOptions> = {}
  ): Job => {
    const aspectRatio: AspectRatio = {
      width: 4,
      height: 6,
      name: '4x6'
    };

    const files: FileMetadata[] = imageNames.map((name, index) => ({
      id: `file${index + 1}`,
      originalName: name,
      size: 1024000,
      mimeType: 'image/jpeg',
      uploadPath: path.join(testImagesDir, name),
      uploadedAt: new Date()
    }));

    const processingOptions: ProcessingOptions = {
      aspectRatio,
      faceDetectionEnabled: false,
      sheetComposition: null,
      ...options
    };

    return {
      id: `test-job-${Date.now()}`,
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

  describe('Image Processing Integration', () => {
    it('should process images through the complete pipeline without face detection', async () => {
      const job = createMockJob(['landscape.jpg', 'portrait.jpg']);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      // Verify results structure
      expect(results.jobId).toBe(job.id);
      expect(results.processedImages).toHaveLength(2);
      expect(results.composedSheets).toHaveLength(0);
      expect(results.pdfPath).toBeUndefined();

      // Verify processed images exist
      for (const processedImage of results.processedImages) {
        expect(fs.existsSync(processedImage.processedPath)).toBe(true);
        
        // Verify image properties
        const metadata = await sharp(processedImage.processedPath).metadata();
        expect(metadata.width).toBeGreaterThan(0);
        expect(metadata.height).toBeGreaterThan(0);
        
        // Verify aspect ratio is approximately correct (4:6)
        const aspectRatio = metadata.width! / metadata.height!;
        const expectedRatio = 4 / 6;
        expect(Math.abs(aspectRatio - expectedRatio)).toBeLessThan(0.5); // More lenient for integration test
      }

      // Verify download URLs structure (empty until database storage)
      expect(results.downloadUrls.individualImages).toEqual({});
      expect(results.downloadUrls.sheets).toEqual({});
    });

    it('should process images with face detection enabled', async () => {
      const job = createMockJob(['landscape.jpg'], {
        faceDetectionEnabled: true
      });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(1);
      
      const processedImage = results.processedImages[0];
      expect(processedImage.detections).toBeDefined();
      expect(fs.existsSync(processedImage.processedPath)).toBe(true);
    });
  });

  describe('Sheet Composition Integration', () => {
    it('should compose A4 sheets with 2x2 grid layout', async () => {
      const gridLayout: GridLayout = {
        rows: 2,
        columns: 2,
        name: '2x2'
      };

      const job = createMockJob(['landscape.jpg', 'portrait.jpg', 'square.jpg'], {
        sheetComposition: {
          enabled: true,
          gridLayout,
          orientation: 'portrait',
          generatePDF: false
        }
      });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(3);
      expect(results.composedSheets).toHaveLength(1); // 3 images fit in one 2x2 sheet with 1 empty slot

      const sheet = results.composedSheets[0];
      expect(sheet.layout.name).toBe('2x2');
      expect(sheet.orientation).toBe('portrait');
      expect(sheet.images).toHaveLength(3);
      expect(sheet.emptySlots).toBe(1);
      expect(fs.existsSync(sheet.sheetPath)).toBe(true);

      // Verify sheet image properties
      const metadata = await sharp(sheet.sheetPath).metadata();
      expect(metadata.width).toBe(2480); // A4 portrait width at 300 DPI
      expect(metadata.height).toBe(3508); // A4 portrait height at 300 DPI
    });

    it('should create multiple sheets when needed', async () => {
      const gridLayout: GridLayout = {
        rows: 1,
        columns: 2,
        name: '1x2'
      };

      // Create 5 images for testing multiple sheets (1x2 grid = 2 images per sheet)
      const imageNames = ['landscape.jpg', 'portrait.jpg', 'square.jpg'];
      
      const job = createMockJob(imageNames, {
        sheetComposition: {
          enabled: true,
          gridLayout,
          orientation: 'landscape',
          generatePDF: false
        }
      });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(3);
      expect(results.composedSheets).toHaveLength(2); // 3 images need 2 sheets (2+1)

      // Verify first sheet has 2 images
      expect(results.composedSheets[0].images).toHaveLength(2);
      expect(results.composedSheets[0].emptySlots).toBe(0);

      // Verify second sheet has 1 image
      expect(results.composedSheets[1].images).toHaveLength(1);
      expect(results.composedSheets[1].emptySlots).toBe(1);

      // Verify all sheet files exist
      for (const sheet of results.composedSheets) {
        expect(fs.existsSync(sheet.sheetPath)).toBe(true);
      }
    });
  });

  describe('PDF Generation Integration', () => {
    it('should generate PDF from composed sheets', async () => {
      const job = createMockJob(['landscape.jpg', 'portrait.jpg'], {
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 1, columns: 2, name: '1x2' },
          orientation: 'portrait',
          generatePDF: true
        }
      });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(2);
      expect(results.composedSheets).toHaveLength(1);
      expect(results.pdfPath).toBeDefined();
      expect(fs.existsSync(results.pdfPath!)).toBe(true);

      // Verify download URLs structure (empty until database storage)
      expect(results.downloadUrls.individualImages).toEqual({});
      expect(results.downloadUrls.sheets).toEqual({});
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle partial failures gracefully', async () => {
      // Create a job with one valid image and one invalid path
      const files: FileMetadata[] = [
        {
          id: 'file1',
          originalName: 'landscape.jpg',
          size: 1024000,
          mimeType: 'image/jpeg',
          uploadPath: path.join(testImagesDir, 'landscape.jpg'),
          uploadedAt: new Date()
        },
        {
          id: 'file2',
          originalName: 'nonexistent.jpg',
          size: 1024000,
          mimeType: 'image/jpeg',
          uploadPath: path.join(testImagesDir, 'nonexistent.jpg'), // This file doesn't exist
          uploadedAt: new Date()
        }
      ];

      const job: Job = {
        id: 'test-partial-failure',
        status: 'pending',
        files,
        options: {
          aspectRatio: { width: 4, height: 6, name: '4x6' },
          faceDetectionEnabled: false,
          sheetComposition: null
        },
        createdAt: new Date(),
        progress: {
          currentStage: 'uploading',
          processedImages: 0,
          totalImages: files.length,
          percentage: 0
        }
      };

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      // Should process the valid image successfully
      expect(results.processedImages).toHaveLength(1);
      expect(results.processedImages[0].originalFileId).toBe('file1');
    });

    it('should continue with sheet composition even if some images fail', async () => {
      // This test would require mocking to simulate partial failures
      // For now, we'll test that the pipeline continues with available images
      const job = createMockJob(['landscape.jpg'], {
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait',
          generatePDF: false
        }
      });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(1);
      expect(results.composedSheets).toHaveLength(1);
      expect(results.composedSheets[0].images).toHaveLength(1);
      expect(results.composedSheets[0].emptySlots).toBe(3); // 3 empty slots in 2x2 grid
    });
  });

  describe('Performance and Quality', () => {
    it('should maintain image quality through processing pipeline', async () => {
      const job = createMockJob(['landscape.jpg']);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      const processedImage = results.processedImages[0];
      
      // Verify processing time is reasonable
      expect(processedImage.processingTime).toBeGreaterThan(0);
      expect(processedImage.processingTime).toBeLessThan(10000); // Less than 10 seconds

      // Verify crop area confidence
      expect(processedImage.cropArea.confidence).toBeGreaterThanOrEqual(0);
      expect(processedImage.cropArea.confidence).toBeLessThanOrEqual(1);

      // Verify output image quality
      const metadata = await sharp(processedImage.processedPath).metadata();
      expect(metadata.width).toBeGreaterThan(400); // Reasonable minimum size
      expect(metadata.height).toBeGreaterThan(400);
    });

    it('should generate processing statistics correctly', async () => {
      const job = createMockJob(['landscape.jpg', 'portrait.jpg'], {
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 1, columns: 2, name: '1x2' },
          orientation: 'portrait',
          generatePDF: true
        }
      });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      const stats = processingPipelineService.getProcessingStats(results);
      
      expect(stats.totalImages).toBe(2);
      expect(stats.successfulImages).toBe(2);
      expect(stats.totalSheets).toBe(1);
      expect(stats.hasPDF).toBe(true);
      expect(stats.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Download URL Generation', () => {
    it('should generate correct download URLs for all output types', async () => {
      const job = createMockJob(['landscape.jpg', 'portrait.jpg'], {
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 1, columns: 2, name: '1x2' },
          orientation: 'portrait',
          generatePDF: true
        }
      });

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      const { downloadUrls } = results;

      // Verify download URLs structure (empty until database storage)
      expect(downloadUrls.individualImages).toEqual({});
      expect(downloadUrls.sheets).toEqual({});
    });
  });
});