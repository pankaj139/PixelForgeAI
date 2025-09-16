import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  PythonServiceClient,
  PythonServiceError,
  PythonServiceConnectionError,
  PythonServiceTimeoutError,
  getPythonServiceClient,
  resetPythonServiceClient,
  type DetectionRequest,
  type CropRequest,
  type BatchProcessRequest,
  type SheetCompositionRequest
} from '../pythonServiceClient';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('PythonServiceClient', () => {
  let client: PythonServiceClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
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
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 100,
      maxConnections: 5,
      healthCheckInterval: 1000
    });
  });

  afterEach(() => {
    client.destroy();
    resetPythonServiceClient();
  });

  describe('Constructor and Configuration', () => {
    it('should create client with default configuration', () => {
      const defaultClient = new PythonServiceClient();
      const config = defaultClient.getConfig();
      
      expect(config.baseUrl).toBe(process.env.PYTHON_SERVICE_URL || 'http://localhost:8000');
      expect(config.timeout).toBe(parseInt(process.env.PYTHON_SERVICE_TIMEOUT || '30000'));
      expect(config.maxRetries).toBe(parseInt(process.env.PYTHON_SERVICE_MAX_RETRIES || '3'));
      
      defaultClient.destroy();
    });

    it('should create client with custom configuration', () => {
      const config = client.getConfig();
      
      expect(config.baseUrl).toBe('http://localhost:8000');
      expect(config.timeout).toBe(5000);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(100);
      expect(config.maxConnections).toBe(5);
    });

    it('should update configuration', () => {
      client.updateConfig({
        baseUrl: 'http://new-url:9000',
        timeout: 10000
      });

      const config = client.getConfig();
      expect(config.baseUrl).toBe('http://new-url:9000');
      expect(config.timeout).toBe(10000);
      expect(config.maxRetries).toBe(3); // Should keep existing values
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };
      
      mockAxiosInstance.get.mockRejectedValue(connectionError);

      await expect(client.checkHealth()).rejects.toThrow(PythonServiceConnectionError);
      expect(client.getHealthStatus()).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      };
      
      mockAxiosInstance.post.mockRejectedValue(timeoutError);

      const request: DetectionRequest = {
        image_path: '/test/image.jpg',
        detection_types: ['face']
      };

      await expect(client.detectObjects(request)).rejects.toThrow('Request to Python service timed out');
    });

    it('should handle HTTP errors', async () => {
      const httpError = new Error('Request failed with status code 400');
      (httpError as any).response = {
        status: 400,
        data: {
          message: 'Invalid image format',
          error_code: 'INVALID_FORMAT'
        }
      };
      (httpError as any).isAxiosError = true;
      
      mockAxiosInstance.post.mockRejectedValue(httpError);

      const request: DetectionRequest = {
        image_path: '/test/image.jpg',
        detection_types: ['face']
      };

      await expect(client.detectObjects(request)).rejects.toThrow();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on connection errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };
      
      // Fail twice, then succeed
      mockAxiosInstance.post
        .mockRejectedValueOnce(connectionError)
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce({
          data: [{ type: 'face', confidence: 0.9, bounding_box: { x: 10, y: 10, width: 50, height: 50 } }]
        });

      const request: DetectionRequest = {
        image_path: '/test/image.jpg',
        detection_types: ['face']
      };

      const result = await client.detectObjects(request);
      expect(result).toHaveLength(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 400 errors', async () => {
      const badRequestError = new Error('Request failed with status code 400');
      (badRequestError as any).response = {
        status: 400,
        data: { message: 'Bad request' }
      };
      (badRequestError as any).isAxiosError = true;
      
      mockAxiosInstance.post.mockRejectedValue(badRequestError);

      const request: DetectionRequest = {
        image_path: '/test/image.jpg',
        detection_types: ['face']
      };

      await expect(client.detectObjects(request)).rejects.toThrow();
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };
      
      mockAxiosInstance.post.mockRejectedValue(connectionError);

      const request: DetectionRequest = {
        image_path: '/test/image.jpg',
        detection_types: ['face']
      };

      await expect(client.detectObjects(request)).rejects.toThrow(PythonServiceError);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3); // maxRetries = 3
    });
  });

  describe('API Methods', () => {
    it('should detect objects successfully', async () => {
      const mockResponse = [
        {
          type: 'face',
          confidence: 0.95,
          bounding_box: { x: 10, y: 20, width: 100, height: 120 }
        },
        {
          type: 'person',
          confidence: 0.87,
          bounding_box: { x: 50, y: 60, width: 200, height: 300 }
        }
      ];

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const request: DetectionRequest = {
        image_path: '/test/image.jpg',
        detection_types: ['face', 'person'],
        confidence_threshold: 0.8
      };

      const result = await client.detectObjects(request);
      
      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/detect', request, {});
    });

    it('should crop image successfully', async () => {
      const mockResponse = {
        original_path: '/test/image.jpg',
        processed_path: '/test/cropped_image.jpg',
        crop_coordinates: { x: 10, y: 20, width: 400, height: 600 },
        final_dimensions: { width: 400, height: 600 }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const request: CropRequest = {
        image_path: '/test/image.jpg',
        target_aspect_ratio: { width: 4, height: 6 },
        crop_strategy: 'center_faces'
      };

      const result = await client.cropImage(request);
      
      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/crop', request, {});
    });

    it('should process batch successfully', async () => {
      const mockResponse = {
        processed_images: [
          {
            original_path: '/test/image1.jpg',
            processed_path: '/test/processed1.jpg',
            crop_coordinates: { x: 0, y: 0, width: 400, height: 600 },
            final_dimensions: { width: 400, height: 600 }
          }
        ],
        failed_images: []
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const request: BatchProcessRequest = {
        images: ['/test/image1.jpg', '/test/image2.jpg'],
        processing_options: {
          target_aspect_ratio: { width: 4, height: 6 },
          crop_strategy: 'center',
          detection_types: ['face']
        }
      };

      const result = await client.processBatch(request);
      
      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/process-batch', request, {});
    });

    it('should compose sheet successfully', async () => {
      const mockResponse = {
        output_path: '/test/composed_sheet.pdf',
        format: 'pdf',
        dimensions: { width: 595, height: 842 }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const request: SheetCompositionRequest = {
        processed_images: ['/test/image1.jpg', '/test/image2.jpg'],
        grid_layout: { rows: 2, columns: 1 },
        sheet_orientation: 'portrait',
        output_format: 'pdf'
      };

      const result = await client.composeSheet(request);
      
      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/compose-sheet', request, {});
    });

    it('should make custom requests', async () => {
      const mockResponse = { custom: 'data' };
      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.makeRequest('GET', '/custom/endpoint', null, {
        headers: { 'Custom-Header': 'value' }
      });

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/custom/endpoint',
        data: null,
        headers: { 'Custom-Header': 'value' }
      });
    });
  });

  describe('Health Check', () => {
    it('should check health successfully', async () => {
      const mockHealthResponse = {
        status: 'healthy' as const,
        timestamp: '2023-01-01T00:00:00Z',
        version: '1.0.0',
        uptime: 3600
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockHealthResponse });

      const result = await client.checkHealth();
      
      expect(result).toEqual(mockHealthResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
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

  describe('Singleton Pattern', () => {
    it('should return same instance for getPythonServiceClient', () => {
      const instance1 = getPythonServiceClient();
      const instance2 = getPythonServiceClient();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getPythonServiceClient();
      resetPythonServiceClient();
      const instance2 = getPythonServiceClient();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Resource Management', () => {
    it('should stop health check on destroy', () => {
      const stopHealthCheckSpy = vi.spyOn(client, 'stopHealthCheck');
      
      client.destroy();
      
      expect(stopHealthCheckSpy).toHaveBeenCalled();
    });
  });
});