import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Create base axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 30000, // 30 seconds for image processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens, logging, etc.
apiClient.interceptors.request.use(
  (config) => {
    // Add authentication token if available
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add timestamp for cache busting if needed
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    
    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
        headers: { ...config.headers, Authorization: token ? '[REDACTED]' : undefined },
      });
    }
    
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log responses in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
        correlationId: response.headers['x-correlation-id'],
      });
    }
    
    return response;
  },
  (error) => {
    // Enhanced error handling for hybrid Node.js/Python architecture
    const correlationId = error.response?.headers['x-correlation-id'] || 
                         error.config?.headers['x-correlation-id'];
    
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      console.error(`[API Error] ${status}:`, {
        data,
        correlationId,
        url: error.config?.url,
      });
      
      // Handle structured error responses from Python service integration
      if (data && typeof data === 'object') {
        // Python service error format
        if (data.error_code && data.message) {
          error.errorCode = data.error_code;
          error.message = data.message;
          error.details = data.details || {};
          error.correlationId = correlationId;
          
          // Map Python service error codes to user-friendly messages
          switch (data.error_code) {
            case 'IMAGE_NOT_FOUND':
              error.message = 'The specified image file was not found. Please try uploading again.';
              break;
            case 'INVALID_FORMAT':
              error.message = 'Unsupported image format. Please use JPEG, PNG, WebP, or TIFF files.';
              break;
            case 'PROCESSING_FAILED':
              error.message = 'Image processing failed. Please try again with a different image.';
              break;
            case 'DETECTION_FAILED':
              error.message = 'Face/person detection failed. The image will be processed with center cropping.';
              break;
            case 'INSUFFICIENT_MEMORY':
              error.message = 'Image too large to process. Please use a smaller image.';
              break;
            case 'CONNECTION_ERROR':
              error.message = 'Processing service temporarily unavailable. Please try again in a moment.';
              break;
            case 'TIMEOUT_ERROR':
              error.message = 'Processing took too long. Please try again with smaller images.';
              break;
            case 'SERVICE_UNAVAILABLE':
              error.message = 'Image processing service is currently unavailable. Please try again later.';
              break;
          }
        }
        // Node.js service error format (legacy)
        else if (data.message || data.error) {
          error.message = data.message || data.error;
        }
        // Fallback for other structured responses
        else {
          error.message = data.detail || `HTTP ${status} error`;
        }
      }
      
      // Handle specific HTTP status codes
      if (!error.message || error.message.includes('HTTP')) {
        switch (status) {
          case 400:
            error.message = 'Invalid request. Please check your input.';
            break;
          case 401:
            // Handle authentication errors - clear stored tokens
            localStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            sessionStorage.removeItem('auth_user');
            error.message = 'Authentication required. Please log in again.';
            // Dispatch a custom event to notify the app of logout
            window.dispatchEvent(new CustomEvent('auth-logout', { detail: 'Token expired' }));
            break;
          case 403:
            error.message = 'Access denied.';
            break;
          case 404:
            error.message = 'Resource not found.';
            break;
          case 413:
            error.message = 'File too large. Please select smaller images.';
            break;
          case 429:
            error.message = 'Too many requests. Please wait and try again.';
            break;
          case 500:
            error.message = 'Server error. Please try again later.';
            break;
          case 502:
            error.message = 'Processing service unavailable. Please try again later.';
            break;
          case 503:
            error.message = 'Service temporarily unavailable. Please try again in a moment.';
            break;
          case 504:
            error.message = 'Processing timeout. Please try again with smaller images.';
            break;
          default:
            error.message = 'An unexpected error occurred.';
        }
      }
    } else if (error.request) {
      // Network error
      console.error('[Network Error]', error.request);
      error.message = 'Network error. Please check your connection.';
      error.errorCode = 'NETWORK_ERROR';
    } else {
      // Other error
      console.error('[Unknown Error]', error.message);
      error.errorCode = 'UNKNOWN_ERROR';
    }
    
    // Add correlation ID to error for tracking
    if (correlationId) {
      error.correlationId = correlationId;
    }
    
    return Promise.reject(error);
  }
);

// Specialized API methods for different endpoint types
export const uploadApi = {
  uploadImages: (formData: FormData, onUploadProgress?: (progress: number) => void) => {
    return apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(progress);
        }
      },
    });
  },
  
  validateFiles: (formData: FormData) => {
    return apiClient.post('/api/upload/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  getUploadStatus: (jobId: string) => {
    return apiClient.get(`/api/upload/status/${jobId}`);
  },
};

export const processingApi = {
  getJobProgress: (jobId: string) => {
    return apiClient.get(`/api/processing/job/${jobId}/progress`);
  },
  
  getJobResults: (jobId: string) => {
    return apiClient.get(`/api/processing/job/${jobId}/results`);
  },
  
  getQueueStatus: () => {
    return apiClient.get('/api/processing/queue');
  },
  
  getProcessingStats: () => {
    return apiClient.get('/api/processing/stats');
  },
  
  cleanupOldJobs: (olderThanHours: number = 24) => {
    return apiClient.post('/api/processing/cleanup', { olderThanHours });
  },
};

export const downloadApi = {
  downloadImage: (imageId: string) => {
    return apiClient.get(`/api/download/image/${imageId}`, {
      responseType: 'blob',
    });
  },
  
  downloadSheet: (sheetId: string) => {
    return apiClient.get(`/api/download/sheet/${sheetId}`, {
      responseType: 'blob',
    });
  },
  
  downloadZip: (jobId: string) => {
    return apiClient.get(`/api/download/zip/${jobId}`, {
      responseType: 'blob',
    });
  },
  
  downloadPdf: (jobId: string) => {
    return apiClient.get(`/api/download/pdf/${jobId}`, {
      responseType: 'blob',
    });
  },
  
  getDownloadStatus: (jobId: string) => {
    return apiClient.get(`/api/download/status/${jobId}`);
  },
};

// Export the main client and specialized APIs
export { apiClient };
export default apiClient;