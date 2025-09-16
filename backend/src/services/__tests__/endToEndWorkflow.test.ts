import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import { 
  processingPipelineService,
  jobProcessingService,
  getPythonServiceClient,
  resetPythonServiceClient
} from '../index.js';
import { 
  Job, 
  ProcessingOptions, 
  FileMetadata, 
  AspectRatio, 
  GridLayout,
  ProcessingResult
} from '../../types/index.js';

// Force Python pipeline for this suite so axios mocks are exercised
process.env.USE_PYTHON_PIPELINE = 'true';

// Mock axios for Python service communication
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('End-to-End Image Processing Workflow', () => {
  const testDir = './test-e2e-workflow';
  const testImagesDir = path.join(testDir, 'images');
  const testOutputDir = path.join(testDir, 'output');
  const testTempDir = path.join(testDir, 'temp');

  let mockAxiosInstance: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    resetPythonServiceClient();

    // Create test directories
    [testDir, testImagesDir, testOutputDir, testTempDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create test images
    await createTestImages();

    // Mock axios instance for Python service
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      request: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      },
      defaults: {
        baseURL: 'http://localhost:8000',
        timeout: 30000
      }
    };

  // Cast to any because vi.mocked typing may not expose mockReturnValue depending on Axios types
  (mockedAxios.create as any).mockReturnValue(mockAxiosInstance);

    // Mock Python service health check
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        status: 'healthy',
        service: 'image-processing-service',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  const createTestImages = async (): Promise<void> => {
    const testImages = [
      { name: 'portrait-with-face.jpg', width: 600, height: 800 },
      { name: 'landscape-group.jpg', width: 1200, height: 800 },
      { name: 'square-single.jpg', width: 800, height: 800 },
      { name: 'wide-panorama.jpg', width: 1600, height: 600 },
      { name: 'tall-portrait.jpg', width: 400, height: 1200 }
    ];

    for (const img of testImages) {
      const imagePath = path.join(testImagesDir, img.name);
      await sharp({
        create: {
          width: img.width,
          height: img.height,
          channels: 3,
          background: { r: 100 + Math.random() * 100, g: 150 + Math.random() * 100, b: 200 + Math.random() * 55 }
        }
      })
      .jpeg()
      .toFile(imagePath);
    }
  };

  const createMockJob = (
    imageNames: string[],
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
      size: fs.statSync(path.join(testImagesDir, name)).size,
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
      id: `e2e-job-${Date.now()}`,
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

  const mockPythonServiceResponses = (scenarios: {
    detection?: any;
    crop?: any;
    batch?: any;
    sheet?: any;
  }) => {
    let cropCallCount = 0;
    
    mockAxiosInstance.post.mockImplementation((url: string) => {
      if (url === '/api/v1/detect') {
        return Promise.resolve({ data: scenarios.detection || { detections: [] } });
      }
      if (url === '/api/v1/crop') {
        if (scenarios.crop) {
          return Promise.resolve({ data: scenarios.crop });
        }
        // If batch scenario is provided, use it for individual crop calls
        if (scenarios.batch && scenarios.batch.processed_images) {
          const response = scenarios.batch.processed_images[cropCallCount % scenarios.batch.processed_images.length];
          cropCallCount++;
          return Promise.resolve({ 
            data: {
              processed_path: response.processed_path,
              crop_coordinates: response.crop_coordinates,
              final_dimensions: response.final_dimensions,
              processing_time: response.processing_time || 150
            }
          });
        }
        return Promise.reject(new Error('No crop response configured'));
      }
      if (url === '/api/v1/process-batch' && scenarios.batch) {
        return Promise.resolve({ data: scenarios.batch });
      }
      if (url === '/api/v1/compose-sheet' && scenarios.sheet) {
        return Promise.resolve({ data: scenarios.sheet });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  };

  describe('Complete Workflow Without Face Detection', () => {
    it('should process single image through complete pipeline', async () => {
      const job = createMockJob(['portrait-with-face.jpg']);

      // Mock Python service responses
      const mockCropResponse = {
        original_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
        processed_path: path.join(testOutputDir, 'processed_portrait-with-face.jpg'),
        crop_coordinates: { x: 0, y: 100, width: 600, height: 600 },
        final_dimensions: { width: 400, height: 600 },
        processing_time: 150
      };

      mockPythonServiceResponses({ 
        crop: {
          ...mockCropResponse,
          processing_time: 150 // Add processing time
        },
        detection: { detections: [] } // Add empty detection response
      });

      // Create the expected output file
      await sharp({
        create: {
          width: 400,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toFile(mockCropResponse.processed_path);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      // Verify results
      expect(results.jobId).toBe(job.id);
      expect(results.processedImages).toHaveLength(1);
      expect(results.composedSheets).toHaveLength(0);
      expect(results.pdfPath).toBeUndefined();

      const processedImage = results.processedImages[0];
      expect(processedImage.originalFileId).toBe('file1');
      expect(fs.existsSync(processedImage.processedPath)).toBe(true);
      expect(processedImage.cropArea.confidence).toBeGreaterThanOrEqual(0);
      expect(processedImage.processingTime).toBeGreaterThan(0);
    });

    it('should process multiple images through complete pipeline', async () => {
      const job = createMockJob(['portrait-with-face.jpg', 'landscape-group.jpg', 'square-single.jpg']);

      // Mock batch processing response
      const mockBatchResponse = {
        processed_images: [
          {
            original_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
            processed_path: path.join(testOutputDir, 'processed_portrait-with-face.jpg'),
            crop_coordinates: { x: 0, y: 100, width: 600, height: 600 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          },
          {
            original_path: path.join(testImagesDir, 'landscape-group.jpg'),
            processed_path: path.join(testOutputDir, 'processed_landscape-group.jpg'),
            crop_coordinates: { x: 300, y: 0, width: 600, height: 800 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          },
          {
            original_path: path.join(testImagesDir, 'square-single.jpg'),
            processed_path: path.join(testOutputDir, 'processed_square-single.jpg'),
            crop_coordinates: { x: 100, y: 0, width: 600, height: 800 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          }
        ],
        failed_images: [],
        processing_time: 450,
        batch_statistics: {
          total_images: 3,
          successful_images: 3,
          failed_images: 0,
          average_processing_time: 150
        }
      };

      mockPythonServiceResponses({ batch: mockBatchResponse });

      // Create expected output files
      for (const processed of mockBatchResponse.processed_images) {
        await sharp({
          create: {
            width: processed.final_dimensions.width,
            height: processed.final_dimensions.height,
            channels: 3,
            background: { r: 100, g: 150, b: 200 }
          }
        })
        .jpeg()
        .toFile(processed.processed_path);
      }

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(3);
      expect(results.composedSheets).toHaveLength(0);

      // Verify all processed images exist
      for (const processedImage of results.processedImages) {
        expect(fs.existsSync(processedImage.processedPath)).toBe(true);
      }
    });
  });

  describe('Complete Workflow With Face Detection', () => {
    it('should process images with face detection enabled', async () => {
      const job = createMockJob(['portrait-with-face.jpg'], {
        faceDetectionEnabled: true
      });

      // Mock detection and crop responses
      const mockDetectionResponse = {
        image_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
        detections: [
          {
            type: 'face',
            confidence: 0.95,
            bounding_box: { x: 200, y: 150, width: 200, height: 240 }
          }
        ],
        processing_time: 200,
        image_dimensions: { width: 600, height: 800 }
      };

      const mockCropResponse = {
        original_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
        processed_path: path.join(testOutputDir, 'processed_portrait-with-face.jpg'),
        crop_coordinates: { x: 100, y: 50, width: 400, height: 600 },
        final_dimensions: { width: 400, height: 600 },
        processing_time: 120
      };

      mockAxiosInstance.post.mockImplementation((url: string) => {
        if (url === '/api/v1/detect') {
          return Promise.resolve({ data: mockDetectionResponse });
        }
        if (url === '/api/v1/crop') {
          return Promise.resolve({ data: mockCropResponse });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Create expected output file
      await sharp({
        create: {
          width: 400,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toFile(mockCropResponse.processed_path);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(1);

      const processedImage = results.processedImages[0];
      expect(processedImage.detections).toBeDefined();
      expect(processedImage.detections!.faces).toHaveLength(1);
      expect(processedImage.detections!.faces[0].confidence).toBe(0.95);
      expect(fs.existsSync(processedImage.processedPath)).toBe(true);
    });

    it('should handle images with no face detections gracefully', async () => {
      const job = createMockJob(['landscape-group.jpg'], {
        faceDetectionEnabled: true
      });

      // Mock detection response with no faces
      const mockDetectionResponse = {
        image_path: path.join(testImagesDir, 'landscape-group.jpg'),
        detections: [],
        processing_time: 180,
        image_dimensions: { width: 1200, height: 800 }
      };

      const mockCropResponse = {
        original_path: path.join(testImagesDir, 'landscape-group.jpg'),
        processed_path: path.join(testOutputDir, 'processed_landscape-group.jpg'),
        crop_coordinates: { x: 300, y: 0, width: 600, height: 800 },
        final_dimensions: { width: 400, height: 600 },
        processing_time: 100
      };

      mockAxiosInstance.post.mockImplementation((url: string) => {
        if (url === '/api/v1/detect') {
          return Promise.resolve({ data: mockDetectionResponse });
        }
        if (url === '/api/v1/crop') {
          return Promise.resolve({ data: mockCropResponse });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Create expected output file
      await sharp({
        create: {
          width: 400,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toFile(mockCropResponse.processed_path);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(1);

      const processedImage = results.processedImages[0];
      expect(processedImage.detections).toBeDefined();
      expect(processedImage.detections!.faces).toHaveLength(0);
      expect(fs.existsSync(processedImage.processedPath)).toBe(true);
    });
  });

  describe('Complete Workflow With Sheet Composition', () => {
    it('should process images and compose sheets with PDF generation', async () => {
      const gridLayout: GridLayout = {
        rows: 2,
        columns: 2,
        name: '2x2'
      };

      const job = createMockJob(['portrait-with-face.jpg', 'landscape-group.jpg', 'square-single.jpg'], {
        sheetComposition: {
          enabled: true,
          gridLayout,
          orientation: 'portrait',
          generatePDF: true
        }
      });

      // Mock batch processing response
      const mockBatchResponse = {
        processed_images: [
          {
            original_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
            processed_path: path.join(testOutputDir, 'processed_portrait-with-face.jpg'),
            crop_coordinates: { x: 0, y: 100, width: 600, height: 600 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          },
          {
            original_path: path.join(testImagesDir, 'landscape-group.jpg'),
            processed_path: path.join(testOutputDir, 'processed_landscape-group.jpg'),
            crop_coordinates: { x: 300, y: 0, width: 600, height: 800 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          },
          {
            original_path: path.join(testImagesDir, 'square-single.jpg'),
            processed_path: path.join(testOutputDir, 'processed_square-single.jpg'),
            crop_coordinates: { x: 100, y: 0, width: 600, height: 800 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          }
        ],
        failed_images: [],
        processing_time: 450,
        batch_statistics: {
          total_images: 3,
          successful_images: 3,
          failed_images: 0,
          average_processing_time: 150
        }
      };

      // Mock sheet composition response
      const mockSheetResponse = {
        output_path: path.join(testOutputDir, 'composed_sheet.jpg'),
        format: 'image' as const,
        dimensions: { width: 2480, height: 3508 },
        grid_info: {
          total_slots: 4,
          filled_slots: 3,
          empty_slots: 1
        }
      };

      mockAxiosInstance.post.mockImplementation((url: string) => {
        if (url === '/api/v1/process-batch') {
          return Promise.resolve({ data: mockBatchResponse });
        }
        if (url === '/api/v1/compose-sheet') {
          return Promise.resolve({ data: mockSheetResponse });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Create expected output files
      for (const processed of mockBatchResponse.processed_images) {
        await sharp({
          create: {
            width: processed.final_dimensions.width,
            height: processed.final_dimensions.height,
            channels: 3,
            background: { r: 100, g: 150, b: 200 }
          }
        })
        .jpeg()
        .toFile(processed.processed_path);
      }

      // Create expected sheet file
      await sharp({
        create: {
          width: 2480,
          height: 3508,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .jpeg()
      .toFile(mockSheetResponse.output_path);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(3);
      expect(results.composedSheets).toHaveLength(1);
      expect(results.pdfPath).toBeDefined();

      const sheet = results.composedSheets[0];
      expect(sheet.layout.name).toBe('2x2');
      expect(sheet.orientation).toBe('portrait');
      expect(sheet.images).toHaveLength(3);
      expect(sheet.emptySlots).toBe(1);
      expect(fs.existsSync(sheet.sheetPath)).toBe(true);
      expect(fs.existsSync(results.pdfPath!)).toBe(true);
    });

    it('should create multiple sheets when images exceed grid capacity', async () => {
      const gridLayout: GridLayout = {
        rows: 1,
        columns: 2,
        name: '1x2'
      };

      const job = createMockJob([
        'portrait-with-face.jpg', 
        'landscape-group.jpg', 
        'square-single.jpg', 
        'wide-panorama.jpg', 
        'tall-portrait.jpg'
      ], {
        sheetComposition: {
          enabled: true,
          gridLayout,
          orientation: 'landscape',
          generatePDF: false
        }
      });

      // Mock batch processing response
      const mockBatchResponse = {
        processed_images: Array(5).fill(null).map((_, i) => ({
          original_path: path.join(testImagesDir, `image-${i}.jpg`),
          processed_path: path.join(testOutputDir, `processed_image-${i}.jpg`),
          crop_coordinates: { x: 0, y: 0, width: 400, height: 600 },
          final_dimensions: { width: 400, height: 600 },
          detections: []
        })),
        failed_images: [],
        processing_time: 750,
        batch_statistics: {
          total_images: 5,
          successful_images: 5,
          failed_images: 0,
          average_processing_time: 150
        }
      };

      mockPythonServiceResponses({ batch: mockBatchResponse });

      // Create expected output files
      for (const processed of mockBatchResponse.processed_images) {
        await sharp({
          create: {
            width: processed.final_dimensions.width,
            height: processed.final_dimensions.height,
            channels: 3,
            background: { r: 100, g: 150, b: 200 }
          }
        })
        .jpeg()
        .toFile(processed.processed_path);
      }

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      expect(results.processedImages).toHaveLength(5);
      expect(results.composedSheets).toHaveLength(3); // 5 images in 1x2 grid = 3 sheets (2+2+1)

      // Verify sheet distribution
      expect(results.composedSheets[0].images).toHaveLength(2);
      expect(results.composedSheets[1].images).toHaveLength(2);
      expect(results.composedSheets[2].images).toHaveLength(1);

      // Verify all sheet files exist
      for (const sheet of results.composedSheets) {
        expect(fs.existsSync(sheet.sheetPath)).toBe(true);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Python service unavailable gracefully', async () => {
      const job = createMockJob(['portrait-with-face.jpg']);

      // Mock connection error
      mockAxiosInstance.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:8000'
      });

      await expect(
        processingPipelineService.executeProcessingPipeline(job, {
          outputDir: testOutputDir,
          tempDir: testTempDir,
          cleanupOnError: false,
          maxRetries: 1
        })
      ).rejects.toThrow();
    });

    it('should handle partial processing failures', async () => {
      const job = createMockJob(['portrait-with-face.jpg', 'landscape-group.jpg']);

      // Mock batch response with one failure
      const mockBatchResponse = {
        processed_images: [
          {
            original_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
            processed_path: path.join(testOutputDir, 'processed_portrait-with-face.jpg'),
            crop_coordinates: { x: 0, y: 100, width: 600, height: 600 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          }
        ],
        failed_images: [
          {
            image_path: path.join(testImagesDir, 'landscape-group.jpg'),
            error: 'Processing failed',
            error_code: 'PROCESSING_FAILED'
          }
        ],
        processing_time: 300,
        batch_statistics: {
          total_images: 2,
          successful_images: 1,
          failed_images: 1,
          average_processing_time: 150
        }
      };

      mockPythonServiceResponses({ batch: mockBatchResponse });

      // Create expected output file for successful image
      await sharp({
        create: {
          width: 400,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toFile(mockBatchResponse.processed_images[0].processed_path);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      // Should process the successful image
      expect(results.processedImages).toHaveLength(1);
      expect(results.processedImages[0].originalFileId).toBe('file1');
    });

    it('should retry on transient failures', async () => {
      const job = createMockJob(['portrait-with-face.jpg']);

      const mockCropResponse = {
        original_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
        processed_path: path.join(testOutputDir, 'processed_portrait-with-face.jpg'),
        crop_coordinates: { x: 0, y: 100, width: 600, height: 600 },
        final_dimensions: { width: 400, height: 600 },
        processing_time: 150
      };

      // Fail once, then succeed
      mockAxiosInstance.post
        .mockRejectedValueOnce({
          code: 'ECONNRESET',
          message: 'Connection reset'
        })
        .mockResolvedValueOnce({ data: mockCropResponse });

      // Create expected output file
      await sharp({
        create: {
          width: 400,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toFile(mockCropResponse.processed_path);

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 2
      });

      expect(results.processedImages).toHaveLength(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2); // One retry
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batch processing efficiently', async () => {
      // Create job with 10 images
      const imageNames = Array(10).fill(null).map((_, i) => `test-image-${i}.jpg`);
      
      // Create the test images
      for (let i = 0; i < 10; i++) {
        const imagePath = path.join(testImagesDir, `test-image-${i}.jpg`);
        await sharp({
          create: {
            width: 600,
            height: 800,
            channels: 3,
            background: { r: 100 + i * 10, g: 150 + i * 5, b: 200 + i * 3 }
          }
        })
        .jpeg()
        .toFile(imagePath);
      }

      const job = createMockJob(imageNames);

      // Mock batch processing response
      const mockBatchResponse = {
        processed_images: Array(10).fill(null).map((_, i) => ({
          original_path: path.join(testImagesDir, `test-image-${i}.jpg`),
          processed_path: path.join(testOutputDir, `processed_test-image-${i}.jpg`),
          crop_coordinates: { x: 0, y: 100, width: 600, height: 600 },
          final_dimensions: { width: 400, height: 600 },
          detections: []
        })),
        failed_images: [],
        processing_time: 1500,
        batch_statistics: {
          total_images: 10,
          successful_images: 10,
          failed_images: 0,
          average_processing_time: 150
        }
      };

      mockPythonServiceResponses({ batch: mockBatchResponse });

      // Create expected output files
      for (const processed of mockBatchResponse.processed_images) {
        await sharp({
          create: {
            width: processed.final_dimensions.width,
            height: processed.final_dimensions.height,
            channels: 3,
            background: { r: 100, g: 150, b: 200 }
          }
        })
        .jpeg()
        .toFile(processed.processed_path);
      }

      const startTime = Date.now();
      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });
      const endTime = Date.now();

      expect(results.processedImages).toHaveLength(10);
      
      // Should complete within reasonable time (30 seconds)
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(30000);

      // Verify all files exist
      for (const processedImage of results.processedImages) {
        expect(fs.existsSync(processedImage.processedPath)).toBe(true);
      }
    });

    it('should maintain processing quality under load', async () => {
      const job = createMockJob(['portrait-with-face.jpg', 'landscape-group.jpg']);

      const mockBatchResponse = {
        processed_images: [
          {
            original_path: path.join(testImagesDir, 'portrait-with-face.jpg'),
            processed_path: path.join(testOutputDir, 'processed_portrait-with-face.jpg'),
            crop_coordinates: { x: 0, y: 100, width: 600, height: 600 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          },
          {
            original_path: path.join(testImagesDir, 'landscape-group.jpg'),
            processed_path: path.join(testOutputDir, 'processed_landscape-group.jpg'),
            crop_coordinates: { x: 300, y: 0, width: 600, height: 800 },
            final_dimensions: { width: 400, height: 600 },
            detections: []
          }
        ],
        failed_images: [],
        processing_time: 300,
        batch_statistics: {
          total_images: 2,
          successful_images: 2,
          failed_images: 0,
          average_processing_time: 150
        }
      };

      mockPythonServiceResponses({ batch: mockBatchResponse });

      // Create expected output files
      for (const processed of mockBatchResponse.processed_images) {
        await sharp({
          create: {
            width: processed.final_dimensions.width,
            height: processed.final_dimensions.height,
            channels: 3,
            background: { r: 100, g: 150, b: 200 }
          }
        })
        .jpeg()
        .toFile(processed.processed_path);
      }

      const results = await processingPipelineService.executeProcessingPipeline(job, {
        outputDir: testOutputDir,
        tempDir: testTempDir,
        cleanupOnError: false,
        maxRetries: 1
      });

      // Verify processing quality metrics
      for (const processedImage of results.processedImages) {
        expect(processedImage.processingTime).toBeGreaterThan(0);
        expect(processedImage.processingTime).toBeLessThan(5000); // Less than 5 seconds per image
        expect(processedImage.cropArea.confidence).toBeGreaterThanOrEqual(0);
        expect(processedImage.cropArea.confidence).toBeLessThanOrEqual(1);

        // Verify output image quality
        const metadata = await sharp(processedImage.processedPath).metadata();
        expect(metadata.width).toBeGreaterThan(0);
        expect(metadata.height).toBeGreaterThan(0);
        expect(metadata.format).toBe('jpeg');
      }
    });
  });
});