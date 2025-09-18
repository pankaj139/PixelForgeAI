/**
 * Comprehensive error handling utilities for Node.js backend
 */

import { Request, Response, NextFunction } from 'express';
import { logger, getCorrelationId } from './logger';
import { PythonServiceError } from '../services/pythonServiceClient';

export interface ErrorResponse {
  error_code: string;
  message: string;
  details?: any;
  timestamp: string;
  correlation_id?: string;
  service: string;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public errorCode: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends ServiceError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  errorCode: string,
  message: string,
  details?: any,
  correlationId?: string
): ErrorResponse {
  return {
    error_code: errorCode,
    message,
    details,
    timestamp: new Date().toISOString(),
    correlation_id: correlationId || getCorrelationId(),
    service: 'nodejs-backend'
  };
}

/**
 * Handle Python service errors and convert to appropriate HTTP responses
 */
export function handlePythonServiceError(error: PythonServiceError): ErrorResponse {
  const correlationId = error.correlationId || getCorrelationId();
  
  logger.error('Python service error', {
    correlationId,
    errorCode: error.errorCode,
    statusCode: error.statusCode,
    message: error.message,
    details: error.details
  }, error);

  // Map Python service errors to appropriate responses
  let errorCode = error.errorCode || 'PYTHON_SERVICE_ERROR';
  let message = error.message;

  // Handle specific error types
  if (error.name === 'PythonServiceConnectionError') {
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'Image processing service is temporarily unavailable';
  } else if (error.name === 'PythonServiceTimeoutError') {
    errorCode = 'SERVICE_TIMEOUT';
    message = 'Image processing service request timed out';
  }

  return createErrorResponse(errorCode, message, error.details, correlationId);
}

/**
 * Express error handling middleware
 */
export function errorHandlingMiddleware() {
  return (error: Error, req: Request, res: Response) => {
    const correlationId = req.correlationId || getCorrelationId();
    
    // Handle different error types
    if (error instanceof PythonServiceError) {
      const errorResponse = handlePythonServiceError(error);
      return res.status(error.statusCode).json(errorResponse);
    }
    
    if (error instanceof ServiceError) {
      logger.error('Service error', {
        correlationId,
        errorCode: error.errorCode,
        statusCode: error.statusCode
      }, error);
      
      const errorResponse = createErrorResponse(
        error.errorCode,
        error.message,
        error.details,
        correlationId
      );
      
      return res.status(error.statusCode).json(errorResponse);
    }
    
    // Handle validation errors (e.g., from express-validator)
    if (error.name === 'ValidationError' || (error as any).array) {
      logger.warn('Validation error', { correlationId }, error);
      
      const errorResponse = createErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        (error as any).array ? (error as any).array() : error.message,
        correlationId
      );
      
      return res.status(400).json(errorResponse);
    }
    
    // Handle multer errors (file upload)
    if (error.name === 'MulterError') {
      logger.warn('File upload error', { correlationId }, error);
      
      let message = 'File upload error';
      let errorCode = 'FILE_UPLOAD_ERROR';
      
      if ((error as any).code === 'LIMIT_FILE_SIZE') {
        message = 'File size too large';
        errorCode = 'FILE_TOO_LARGE';
      } else if ((error as any).code === 'LIMIT_FILE_COUNT') {
        message = 'Too many files';
        errorCode = 'TOO_MANY_FILES';
      }
      
      const errorResponse = createErrorResponse(errorCode, message, undefined, correlationId);
      return res.status(400).json(errorResponse);
    }
    
    // Handle unexpected errors
    logger.error('Unexpected error', {
      correlationId,
      errorName: error.name,
      stack: error.stack
    }, error);
    
    const errorResponse = createErrorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      correlationId
    );
    
    return res.status(500).json(errorResponse);
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle graceful degradation when Python service is unavailable
 */
export function withGracefulDegradation<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T> | T,
  operationName: string = 'operation'
) {
  return async (): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const correlationId = getCorrelationId();
      
      if (error instanceof PythonServiceError && 
          (error.name === 'PythonServiceConnectionError' || error.statusCode >= 500)) {
        
        logger.warn(`Python service unavailable for ${operationName}, attempting fallback`, {
          correlationId,
          error: error.message
        });
        
        if (fallback) {
          return await fallback();
        }
        
        throw new ServiceError(
          `Service temporarily unavailable: ${operationName}`,
          503,
          'SERVICE_UNAVAILABLE',
          { originalError: error.message }
        );
      }
      
      throw error;
    }
  };
}

/**
 * Health check error handler
 */
export function handleHealthCheckError(error: any): {
  status: 'unhealthy';
  error: string;
  timestamp: string;
} {
  logger.error('Health check failed', {}, error);
  
  return {
    status: 'unhealthy',
    error: error.message || 'Health check failed',
    timestamp: new Date().toISOString()
  };
}