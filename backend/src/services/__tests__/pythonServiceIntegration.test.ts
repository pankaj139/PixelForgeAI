import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import { 
  PythonServiceClient,
  PythonServiceError,
  PythonServiceConnectionError,
  getPythonServiceClient,
  resetPythonServiceClient
} from '../pythonServiceClient.js';

// Mock axios for controlled testing
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('Python Service Integration Tests', () => {
  let client: PythonServiceClient;
  let mockAxiosInstance: any;
  const testDir = './test-python-integration';
  const testImagesDir = path.join(testDir, 'images');

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create test directories
    [testDir, testImagesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create test images
    await createTestImages();

    // Mock axios instance
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

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create client instance
    client = new PythonServiceClient({
      baseUrl: 'http://localhost:8000',
      timeout: 10000,
      maxRetries: 2,
      retryDelay: 100
    });
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    client.destroy();
    resetPythonServiceClient();
    vi.clearAllMocks();
  });

  const createTestImages = async (): Promise<void> => {
    const testImages = [
      { name: 'test-face.jpg', width: 800, height: 600 },
      { name: 'test-landscape.jpg', width: 1200, height: 800 },
      { name: 'test-portrait.jpg', width: 600, height: 900 }
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

  describe('Service Communication', () => {
    it('should successfully communicate with Python service for detection', async () => {
      const mockDetectionResponse = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detections: [
          {
            type: 'face',
            confidence: 0.95,
            bounding_box: { x: 200, y: 150, width: 100, height: 120 }
          }
        ],
        processing_time: 150.5,
        image_dimensions: { width: 800, height: 600 }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockDetectionResponse });

      const request = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const],
        confidence_threshold: 0.8
      };

      const result = await client.detectObjects(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/detect', request, {});
      expect(result).toEqual(mockDetectionResponse);
    });

    it('should successfully communicate with Python service for cropping', async () => {
      const mockCropResponse = {
        original_path: path.join(testImagesDir, 'test-landscape.jpg'),
        processed_path: path.join(testImagesDir, 'processed_test-landscape.jpg'),
        crop_coordinates: { x: 100, y: 0, width: 800, height: 600 },
        final_dimensions: { width: 800, height: 600 },
        processing_time: 89.3
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockCropResponse });

      const request = {
        image_path: path.join(testImagesDir, 'test-landscape.jpg'),
        target_aspect_ratio: { width: 4, height: 3 },
        crop_strategy: 'center' as const
      };

      const result = await client.cropImage(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/crop', request, {});
      expect(result).toEqual(mockCropResponse);
    });

    it('should successfully communicate with Python service for batch processing', async () => {
      const mockBatchResponse = {
        processed_images: [
          {
            original_path: path.join(testImagesDir, 'test-face.jpg'),
            processed_path: path.join(testImagesDir, 'processed_test-face.jpg'),
            crop_coordinates: { x: 0, y: 75, width: 600, height: 450 },
            final_dimensions: { width: 600, height: 450 },
            detections: []
          }
        ],
        failed_images: [],
        processing_time: 245.7,
        batch_statistics: {
          total_images: 1,
          successful_images: 1,
          failed_images: 0,
          average_processing_time: 245.7
        }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockBatchResponse });

      const request = {
        images: [path.join(testImagesDir, 'test-face.jpg')],
        processing_options: {
          target_aspect_ratio: { width: 4, height: 3 },
          crop_strategy: 'center' as const,
          detection_types: ['face' as const]
        }
      };

      const result = await client.processBatch(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/process-batch', request, {});
      expect(result).toEqual(mockBatchResponse);
    });

    it('should successfully communicate with Python service for sheet composition', async () => {
      const mockSheetResponse = {
        output_path: path.join(testImagesDir, 'composed_sheet.pdf'),
        format: 'pdf' as const,
        dimensions: { width: 595, height: 842 },
        grid_info: {
          total_slots: 4,
          filled_slots: 2,
          empty_slots: 2
        }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockSheetResponse });

      const request = {
        processed_images: [
          path.join(testImagesDir, 'processed_test-face.jpg'),
          path.join(testImagesDir, 'processed_test-landscape.jpg')
        ],
        grid_layout: { rows: 2, columns: 2 },
        sheet_orientation: 'portrait' as const,
        output_format: 'pdf' as const
      };

      const result = await client.composeSheet(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/compose-sheet', request, {});
      expect(result).toEqual(mockSheetResponse);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle Python service unavailable error', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:8000');
      (connectionError as any).code = 'ECONNREFUSED';
      (connectionError as any).isAxiosError = true;

      mockAxiosInstance.post.mockRejectedValue(connectionError);

      const request = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const]
      };

      await expect(client.detectObjects(request)).rejects.toThrow();
    });

    it('should handle Python service timeout error', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      };

      mockAxiosInstance.post.mockRejectedValue(timeoutError);

      const request = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const]
      };

      await expect(client.detectObjects(request)).rejects.toThrow('Request to Python service timed out');
    });

    it('should handle Python service validation errors', async () => {
      const validationError = new Error('Request failed with status code 422');
      (validationError as any).response = {
        status: 422,
        data: {
          detail: [
            {
              loc: ['body', 'detection_types'],
              msg: 'field required',
              type: 'value_error.missing'
            }
          ]
        }
      };
      (validationError as any).isAxiosError = true;

      mockAxiosInstance.post.mockRejectedValue(validationError);

      const request = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        // Missing detection_types
      } as any;

      await expect(client.detectObjects(request)).rejects.toThrow();
    });

    it('should handle Python service processing errors', async () => {
      const processingError = new Error('Request failed with status code 400');
      (processingError as any).response = {
        status: 400,
        data: {
          error_code: 'IMAGE_NOT_FOUND',
          message: 'The specified image file was not found'
        }
      };
      (processingError as any).isAxiosError = true;

      mockAxiosInstance.post.mockRejectedValue(processingError);

      const request = {
        image_path: '/nonexistent/image.jpg',
        detection_types: ['face' as const]
      };

      await expect(client.detectObjects(request)).rejects.toThrow();
    });
  });

  describe('Retry Logic Integration', () => {
    it('should retry on connection failures and eventually succeed', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };

      const successResponse = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detections: [],
        processing_time: 100,
        image_dimensions: { width: 800, height: 600 }
      };

      // Fail once, then succeed
      mockAxiosInstance.post
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce({ data: successResponse });

      const request = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const]
      };

      const result = await client.detectObjects(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual(successResponse);
    });

    it('should fail after max retries on persistent connection errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };

      mockAxiosInstance.post.mockRejectedValue(connectionError);

      const request = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const]
      };

      await expect(client.detectObjects(request)).rejects.toThrow(PythonServiceError);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2); // maxRetries = 2
    });

    it('should not retry on client errors (4xx)', async () => {
      const clientError = new Error('Request failed with status code 400');
      (clientError as any).response = {
        status: 400,
        data: {
          error_code: 'INVALID_FORMAT',
          message: 'Unsupported image format'
        }
      };
      (clientError as any).isAxiosError = true;

      mockAxiosInstance.post.mockRejectedValue(clientError);

      const request = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const]
      };

      await expect(client.detectObjects(request)).rejects.toThrow();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1); // No retries for client errors
    });
  });

  describe('Health Check Integration', () => {
    it('should successfully check Python service health', async () => {
      const healthResponse = {
        status: 'healthy' as const,
        service: 'image-processing-service',
        timestamp: '2023-01-01T00:00:00Z',
        version: '1.0.0',
        uptime: 3600
      };

      mockAxiosInstance.get.mockResolvedValue({ data: healthResponse });

      const result = await client.checkHealth();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(healthResponse);
      expect(client.getHealthStatus()).toBe(true);
    });

    it('should handle health check failure', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Health check failed'
      };

      mockAxiosInstance.get.mockRejectedValue(connectionError);

      await expect(client.checkHealth()).rejects.toThrow();
      expect(client.getHealthStatus()).toBe(false);
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should complete full image processing workflow', async () => {
      // Mock detection response
      const detectionResponse = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detections: [
          {
            type: 'face',
            confidence: 0.9,
            bounding_box: { x: 300, y: 200, width: 100, height: 120 }
          }
        ],
        processing_time: 150,
        image_dimensions: { width: 800, height: 600 }
      };

      // Mock crop response
      const cropResponse = {
        original_path: path.join(testImagesDir, 'test-face.jpg'),
        processed_path: path.join(testImagesDir, 'processed_test-face.jpg'),
        crop_coordinates: { x: 200, y: 100, width: 400, height: 400 },
        final_dimensions: { width: 400, height: 400 },
        processing_time: 89
      };

      // Mock sheet composition response
      const sheetResponse = {
        output_path: path.join(testImagesDir, 'composed_sheet.jpg'),
        format: 'image' as const,
        dimensions: { width: 2480, height: 3508 },
        grid_info: {
          total_slots: 1,
          filled_slots: 1,
          empty_slots: 0
        }
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: detectionResponse })  // Detection call
        .mockResolvedValueOnce({ data: cropResponse })       // Crop call
        .mockResolvedValueOnce({ data: sheetResponse });     // Sheet composition call

      // Step 1: Detect objects
      const detectionRequest = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const],
        confidence_threshold: 0.8
      };

      const detections = await client.detectObjects(detectionRequest);
      expect(detections.detections).toHaveLength(1);

      // Step 2: Crop image using detection results
      const cropRequest = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        target_aspect_ratio: { width: 1, height: 1 },
        crop_strategy: 'center_faces' as const,
        detection_results: detections.detections
      };

      const cropResult = await client.cropImage(cropRequest);
      expect(cropResult.processed_path).toBeDefined();

      // Step 3: Compose sheet
      const sheetRequest = {
        processed_images: [cropResult.processed_path],
        grid_layout: { rows: 1, columns: 1 },
        sheet_orientation: 'portrait' as const,
        output_format: 'image' as const
      };

      const sheetResult = await client.composeSheet(sheetRequest);
      expect(sheetResult.output_path).toBeDefined();

      // Verify all calls were made
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in workflow gracefully', async () => {
      // Mock successful detection
      const detectionResponse = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detections: [],
        processing_time: 150,
        image_dimensions: { width: 800, height: 600 }
      };

      // Mock crop failure
      const cropError = new Error('Request failed with status code 400');
      (cropError as any).response = {
        status: 400,
        data: {
          error_code: 'PROCESSING_FAILED',
          message: 'Image processing failed'
        }
      };
      (cropError as any).isAxiosError = true;

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: detectionResponse })  // Detection succeeds
        .mockRejectedValueOnce(cropError);                   // Crop fails

      // Step 1: Detect objects (succeeds)
      const detectionRequest = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const]
      };

      const detections = await client.detectObjects(detectionRequest);
      expect(detections.detections).toHaveLength(0);

      // Step 2: Crop image (fails)
      const cropRequest = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        target_aspect_ratio: { width: 4, height: 6 },
        crop_strategy: 'center' as const
      };

      await expect(client.cropImage(cropRequest)).rejects.toThrow();
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const mockResponse = {
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detections: [],
        processing_time: 100,
        image_dimensions: { width: 800, height: 600 }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const requests = Array(5).fill(null).map(() => ({
        image_path: path.join(testImagesDir, 'test-face.jpg'),
        detection_types: ['face' as const]
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(request => client.detectObjects(request))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(5);
      
      // Should complete all requests within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds
    });

    it('should handle large batch processing efficiently', async () => {
      const mockBatchResponse = {
        processed_images: Array(10).fill(null).map((_, i) => ({
          original_path: path.join(testImagesDir, `test-image-${i}.jpg`),
          processed_path: path.join(testImagesDir, `processed-${i}.jpg`),
          crop_coordinates: { x: 0, y: 0, width: 400, height: 600 },
          final_dimensions: { width: 400, height: 600 },
          detections: []
        })),
        failed_images: [],
        processing_time: 2000,
        batch_statistics: {
          total_images: 10,
          successful_images: 10,
          failed_images: 0,
          average_processing_time: 200
        }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockBatchResponse });

      const request = {
        images: Array(10).fill(null).map((_, i) => 
          path.join(testImagesDir, `test-image-${i}.jpg`)
        ),
        processing_options: {
          target_aspect_ratio: { width: 4, height: 6 },
          crop_strategy: 'center' as const
        }
      };

      const startTime = Date.now();
      const result = await client.processBatch(request);
      const endTime = Date.now();

      expect(result.processed_images).toHaveLength(10);
      expect(result.failed_images).toHaveLength(0);
      
      // Should complete batch within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds
    });
  });
});