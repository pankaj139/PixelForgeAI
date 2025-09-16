import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Agent } from 'http';

// Configuration interface
export interface PythonServiceConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxConnections: number;
  healthCheckInterval: number;
}

// Default configuration
const DEFAULT_CONFIG: PythonServiceConfig = {
  baseUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  timeout: parseInt(process.env.PYTHON_SERVICE_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.PYTHON_SERVICE_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.PYTHON_SERVICE_RETRY_DELAY || '1000'),
  maxConnections: parseInt(process.env.PYTHON_SERVICE_MAX_CONNECTIONS || '10'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000')
};

// Custom error classes
export class PythonServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public originalError?: any,
    public errorCode?: string,
    public correlationId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PythonServiceError';
  }
}

export class PythonServiceConnectionError extends PythonServiceError {
  constructor(message: string, originalError?: any) {
    super(message, 503, originalError, 'CONNECTION_ERROR');
    this.name = 'PythonServiceConnectionError';
  }
}

export class PythonServiceTimeoutError extends PythonServiceError {
  constructor(message: string, originalError?: any) {
    super(message, 408, originalError, 'TIMEOUT_ERROR');
    this.name = 'PythonServiceTimeoutError';
  }
}

// Request/Response interfaces
export interface DetectionRequest {
  image_path: string;
  detection_types: ('face' | 'person')[];
  confidence_threshold?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  type: 'face' | 'person';
  confidence: number;
  bounding_box: BoundingBox;
}

export interface CropRequest {
  image_path: string;
  target_aspect_ratio: {
    width: number;
    height: number;
  };
  detection_results?: DetectionResult[];
  crop_strategy?: 'center' | 'center_faces' | 'preserve_all';
}

export interface ProcessedImage {
  original_path: string;
  processed_path: string;
  crop_coordinates: BoundingBox;
  final_dimensions: {
    width: number;
    height: number;
  };
}

export interface BatchProcessRequest {
  images: string[];
  processing_options: {
    target_aspect_ratio: {
      width: number;
      height: number;
    };
    crop_strategy?: string;
    detection_types?: ('face' | 'person')[];
  };
}

export interface BatchProcessResult {
  processed_images: ProcessedImage[];
  failed_images: {
    path: string;
    error: string;
  }[];
}

export interface SheetCompositionRequest {
  processed_images: string[];
  grid_layout: {
    rows: number;
    columns: number;
  };
  sheet_orientation: 'portrait' | 'landscape';
  output_format?: 'image' | 'pdf';
}

export interface ComposedSheet {
  output_path: string;
  format: string;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, boolean>;
  uptime_seconds: number;
  memory_usage_mb: number;
  disk_usage_percent: number;
  last_error?: string;
  timestamp?: string;
  version?: string;
}

export interface DetailedHealthStatus {
  health: HealthStatus;
  metrics: {
    uptime_seconds: number;
    uptime_human: string;
    memory_usage_mb: number;
    disk_usage_percent: number;
    request_count: number;
    successful_requests: number;
    error_count: number;
    success_rate: number;
    error_rate: number;
    last_error?: string;
    timestamp: string;
  };
  service: string;
  version: string;
  environment: string;
}/**
 * Python Service Client with connection pooling, retry logic, error handling, and correlation ID support
 */
export class PythonServiceClient {
  private axiosInstance: AxiosInstance;
  private config: PythonServiceConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private isHealthy: boolean = true;
  private logger: any; // Use your logging system here

  constructor(config: Partial<PythonServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = console; // Replace with your logging system
    
    // Create HTTP agent with connection pooling
    const httpAgent = new Agent({
      keepAlive: true,
      maxSockets: this.config.maxConnections,
      maxFreeSockets: Math.floor(this.config.maxConnections / 2),
      timeout: this.config.timeout,
      keepAliveMsecs: 30000
    });

    // Create axios instance with configuration
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      httpAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Setup request/response interceptors after axios instance is created
    if (this.axiosInstance && this.axiosInstance.interceptors) {
      this.setupInterceptors();
    }
    
    // Start health check monitoring
    this.startHealthCheck();
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `nodejs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add correlation ID to request headers if not present
        if (!config.headers['x-correlation-id']) {
          config.headers['x-correlation-id'] = this.generateCorrelationId();
        }
        
        this.logger.info(`[PythonService] ${config.method?.toUpperCase()} ${config.url}`, {
          correlationId: config.headers['x-correlation-id'],
          service: 'python-service-client'
        });
        
        return config;
      },
      (error) => {
        this.logger.error('[PythonService] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const correlationId = response.headers['x-correlation-id'] || 
                             response.config.headers['x-correlation-id'];
        
        this.logger.info(`[PythonService] Response ${response.status} from ${response.config.url}`, {
          correlationId,
          duration: response.headers['x-response-time'],
          service: 'python-service-client'
        });
        
        return response;
      },
      (error) => {
        const correlationId = error.response?.headers['x-correlation-id'] || 
                             error.config?.headers['x-correlation-id'];
        
        this.logger.error(`[PythonService] Response error:`, {
          message: error.message,
          correlationId,
          service: 'python-service-client'
        });
        
        return Promise.reject(this.handleAxiosError(error));
      }
    );
  }

  /**
   * Handle axios errors and convert to custom error types
   */
  private handleAxiosError(error: any): PythonServiceError {
    const correlationId = error.response?.headers['x-correlation-id'] || 
                         error.config?.headers['x-correlation-id'];

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      this.isHealthy = false;
      return new PythonServiceConnectionError(
        `Failed to connect to Python service at ${this.config.baseUrl}`,
        error
      );
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new PythonServiceTimeoutError(
        `Request to Python service timed out after ${this.config.timeout}ms`,
        error
      );
    }

    if (error.response) {
      const { status, data } = error.response;
      
      // Handle structured error responses from Python service
      if (data && typeof data === 'object') {
        const message = data.message || data.detail || `HTTP ${status} error`;
        const errorCode = data.error_code || 'HTTP_ERROR';
        const details = data.details || {};
        
        return new PythonServiceError(
          message, 
          status, 
          error, 
          errorCode, 
          correlationId, 
          details
        );
      }
      
      // Fallback for non-structured responses
      return new PythonServiceError(
        `HTTP ${status} error`,
        status,
        error,
        'HTTP_ERROR',
        correlationId
      );
    }

    return new PythonServiceError(
      error.message || 'Unknown Python service error',
      500,
      error,
      'UNKNOWN_ERROR',
      correlationId
    );
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        // Convert axios errors to our custom error types
        const processedError = this.handleAxiosError(error);
        lastError = processedError;
        
        // Don't retry on certain error types
        if (processedError instanceof PythonServiceError && 
            (processedError.statusCode === 400 || processedError.statusCode === 404)) {
          throw processedError;
        }
        
        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          console.log(`[PythonService] Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    throw new PythonServiceError(
      `Failed after ${maxRetries} attempts: ${lastError.message}`,
      500,
      lastError
    );
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.checkHealth();
        if (!this.isHealthy) {
          console.log('[PythonService] Service is back online');
          this.isHealthy = true;
        }
      } catch (error) {
        if (this.isHealthy) {
          console.error('[PythonService] Service health check failed:', error);
          this.isHealthy = false;
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health check monitoring
   */
  public stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Check if the Python service is healthy
   */
  public async checkHealth(): Promise<HealthStatus> {
    try {
      const response = await this.axiosInstance.get<HealthStatus>('/health');
      this.isHealthy = response.data.status === 'healthy';
      return response.data;
    } catch (error) {
      this.isHealthy = false;
      throw this.handleAxiosError(error);
    }
  }

  /**
   * Get detailed health status
   */
  public async getDetailedHealth(): Promise<DetailedHealthStatus> {
    try {
      const response = await this.axiosInstance.get<DetailedHealthStatus>('/health/detailed');
      return response.data;
    } catch (error) {
      throw this.handleAxiosError(error);
    }
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): boolean {
    return this.isHealthy;
  }

  /**
   * Check if service is available for processing
   */
  public isServiceAvailable(): boolean {
    return this.isHealthy;
  }

  /**
   * Execute operation with graceful degradation
   */
  private async executeWithGracefulDegradation<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T,
    operationName: string = 'operation'
  ): Promise<T> {
    try {
      if (!this.isHealthy && !fallback) {
        throw new PythonServiceError(
          `Python service is unavailable and no fallback provided for ${operationName}`,
          503,
          undefined,
          'SERVICE_UNAVAILABLE'
        );
      }

      return await operation();
    } catch (error) {
      this.logger.error(`[PythonService] ${operationName} failed:`, error);
      
      if (fallback) {
        this.logger.info(`[PythonService] Using fallback for ${operationName}`);
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Detect objects (faces/people) in an image
   */
  public async detectObjects(
    request: DetectionRequest, 
    correlationId?: string
  ): Promise<DetectionResult[]> {
    return this.executeWithGracefulDegradation(
      () => this.retryWithBackoff(async () => {
        const config: AxiosRequestConfig = {};
        if (correlationId) {
          config.headers = { 'x-correlation-id': correlationId };
        }
        
        const response = await this.axiosInstance.post<DetectionResult[]>(
          '/api/v1/detect', 
          request,
          config
        );
        return response.data;
      }),
      undefined, // No fallback for detection
      'detectObjects'
    );
  }

  /**
   * Crop an image based on detection results and target aspect ratio
   */
  public async cropImage(
    request: CropRequest, 
    correlationId?: string
  ): Promise<ProcessedImage> {
    return this.executeWithGracefulDegradation(
      () => this.retryWithBackoff(async () => {
        const config: AxiosRequestConfig = {};
        if (correlationId) {
          config.headers = { 'x-correlation-id': correlationId };
        }
        
        const response = await this.axiosInstance.post<ProcessedImage>(
          '/api/v1/crop', 
          request,
          config
        );
        return response.data;
      }),
      undefined, // No fallback for cropping
      'cropImage'
    );
  }

  /**
   * Process multiple images in batch
   */
  public async processBatch(
    request: BatchProcessRequest, 
    correlationId?: string
  ): Promise<BatchProcessResult> {
    return this.executeWithGracefulDegradation(
      () => this.retryWithBackoff(async () => {
        const config: AxiosRequestConfig = {};
        if (correlationId) {
          config.headers = { 'x-correlation-id': correlationId };
        }
        
        const response = await this.axiosInstance.post<BatchProcessResult>(
          '/api/v1/process-batch', 
          request,
          config
        );
        return response.data;
      }),
      undefined, // No fallback for batch processing
      'processBatch'
    );
  }

  /**
   * Compose images into a sheet layout
   */
  public async composeSheet(
    request: SheetCompositionRequest, 
    correlationId?: string
  ): Promise<ComposedSheet> {
    return this.executeWithGracefulDegradation(
      () => this.retryWithBackoff(async () => {
        const config: AxiosRequestConfig = {};
        if (correlationId) {
          config.headers = { 'x-correlation-id': correlationId };
        }
        
        const response = await this.axiosInstance.post<ComposedSheet>(
          '/api/v1/compose-sheet', 
          request,
          config
        );
        return response.data;
      }),
      undefined, // No fallback for sheet composition
      'composeSheet'
    );
  }

  /**
   * Generic method for making custom requests to the Python service
   */
  public async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.retryWithBackoff(async () => {
      const response = await this.axiosInstance.request<T>({
        method,
        url: endpoint,
        data,
        ...config
      });
      return response.data;
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PythonServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update axios instance base URL if changed
    if (newConfig.baseUrl) {
      this.axiosInstance.defaults.baseURL = newConfig.baseUrl;
    }
    
    // Update timeout if changed
    if (newConfig.timeout) {
      this.axiosInstance.defaults.timeout = newConfig.timeout;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): PythonServiceConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopHealthCheck();
    // Note: axios doesn't have a destroy method, but we can clear the instance
    // The HTTP agent will be garbage collected
  }
}

// Singleton instance for global use
let pythonServiceClientInstance: PythonServiceClient | null = null;

/**
 * Get or create singleton instance of PythonServiceClient
 */
export function getPythonServiceClient(config?: Partial<PythonServiceConfig>): PythonServiceClient {
  if (!pythonServiceClientInstance) {
    pythonServiceClientInstance = new PythonServiceClient(config);
  }
  return pythonServiceClientInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetPythonServiceClient(): void {
  if (pythonServiceClientInstance) {
    pythonServiceClientInstance.destroy();
    pythonServiceClientInstance = null;
  }
}

// Export default factory function instead of instance to avoid initialization issues
export default getPythonServiceClient;