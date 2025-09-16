"""
Comprehensive error handling utilities with structured error responses
"""

import traceback
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Union
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from models import ErrorResponse
from utils.logging_config import get_correlation_id, get_logger

logger = get_logger(__name__)

# Error code constants
class ErrorCodes:
    # Client errors (4xx)
    INVALID_INPUT = "INVALID_INPUT"
    IMAGE_NOT_FOUND = "IMAGE_NOT_FOUND"
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    
    # Server errors (5xx)
    PROCESSING_FAILED = "PROCESSING_FAILED"
    DETECTION_FAILED = "DETECTION_FAILED"
    CROP_FAILED = "CROP_FAILED"
    COMPOSITION_FAILED = "COMPOSITION_FAILED"
    INSUFFICIENT_MEMORY = "INSUFFICIENT_MEMORY"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    
    # Network/Communication errors
    CONNECTION_ERROR = "CONNECTION_ERROR"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"

def create_error_response(
    error_code: str,
    message: str,
    status_code: int,
    details: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None
) -> ErrorResponse:
    """Create a structured error response"""
    
    return ErrorResponse(
        error_code=error_code,
        message=message,
        details=details or {},
        timestamp=datetime.now(timezone.utc).isoformat(),
        correlation_id=correlation_id or get_correlation_id(),
        service="python-image-processing-service"
    )

def create_error_json_response(
    error_code: str,
    message: str,
    status_code: int,
    details: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None
) -> JSONResponse:
    """Create a JSON error response"""
    
    error_response = create_error_response(
        error_code=error_code,
        message=message,
        status_code=status_code,
        details=details,
        correlation_id=correlation_id
    )
    
    return JSONResponse(
        status_code=status_code,
        content=error_response.model_dump()
    )

class ServiceException(Exception):
    """Base exception for service-specific errors"""
    
    def __init__(
        self,
        message: str,
        error_code: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}

class ImageNotFoundException(ServiceException):
    """Exception for image not found errors"""
    
    def __init__(self, image_path: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=f"Image file not found: {image_path}",
            error_code=ErrorCodes.IMAGE_NOT_FOUND,
            status_code=404,
            details={"image_path": image_path, **(details or {})}
        )

class InvalidInputException(ServiceException):
    """Exception for invalid input errors"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code=ErrorCodes.INVALID_INPUT,
            status_code=400,
            details=details
        )

class ProcessingFailedException(ServiceException):
    """Exception for processing failures"""
    
    def __init__(self, operation: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=f"{operation} processing failed",
            error_code=ErrorCodes.PROCESSING_FAILED,
            status_code=500,
            details={"operation": operation, **(details or {})}
        )

class InsufficientMemoryException(ServiceException):
    """Exception for memory errors"""
    
    def __init__(self, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message="Not enough memory to process the request",
            error_code=ErrorCodes.INSUFFICIENT_MEMORY,
            status_code=413,
            details=details
        )

async def handle_service_exception(request: Request, exc: ServiceException) -> JSONResponse:
    """Handle service-specific exceptions"""
    
    correlation_id = get_correlation_id()
    
    logger.error(
        f"Service exception: {exc.message}",
        extra_fields={
            "error_code": exc.error_code,
            "status_code": exc.status_code,
            "details": exc.details,
            "correlation_id": correlation_id
        }
    )
    
    return create_error_json_response(
        error_code=exc.error_code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
        correlation_id=correlation_id
    )

async def handle_file_not_found_error(request: Request, exc: FileNotFoundError) -> JSONResponse:
    """Handle file not found errors"""
    
    correlation_id = get_correlation_id()
    
    logger.error(
        f"File not found: {exc}",
        extra_fields={
            "error_code": ErrorCodes.IMAGE_NOT_FOUND,
            "correlation_id": correlation_id
        }
    )
    
    return create_error_json_response(
        error_code=ErrorCodes.IMAGE_NOT_FOUND,
        message="The specified image file was not found",
        status_code=404,
        details={"file_path": str(exc)},
        correlation_id=correlation_id
    )

async def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
    """Handle validation and processing errors"""
    
    correlation_id = get_correlation_id()
    
    logger.error(
        f"Value error: {exc}",
        extra_fields={
            "error_code": ErrorCodes.INVALID_INPUT,
            "correlation_id": correlation_id
        }
    )
    
    return create_error_json_response(
        error_code=ErrorCodes.INVALID_INPUT,
        message="Invalid input or processing parameters",
        status_code=400,
        details={"error": str(exc)},
        correlation_id=correlation_id
    )

async def handle_memory_error(request: Request, exc: MemoryError) -> JSONResponse:
    """Handle memory errors during processing"""
    
    correlation_id = get_correlation_id()
    
    logger.error(
        f"Memory error: {exc}",
        extra_fields={
            "error_code": ErrorCodes.INSUFFICIENT_MEMORY,
            "correlation_id": correlation_id
        }
    )
    
    return create_error_json_response(
        error_code=ErrorCodes.INSUFFICIENT_MEMORY,
        message="Not enough memory to process the image",
        status_code=413,
        details={"suggestion": "Try with a smaller image or reduce batch size"},
        correlation_id=correlation_id
    )

async def handle_validation_error(request: Request, exc: ValidationError) -> JSONResponse:
    """Handle Pydantic validation errors"""
    
    correlation_id = get_correlation_id()
    
    logger.error(
        f"Validation error: {exc}",
        extra_fields={
            "error_code": ErrorCodes.VALIDATION_FAILED,
            "correlation_id": correlation_id
        }
    )
    
    return create_error_json_response(
        error_code=ErrorCodes.VALIDATION_FAILED,
        message="Request validation failed",
        status_code=422,
        details={"validation_errors": exc.errors()},
        correlation_id=correlation_id
    )

async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions"""
    
    correlation_id = get_correlation_id()
    
    # Extract error details if they exist
    detail = exc.detail
    if isinstance(detail, dict):
        error_code = detail.get('error_code', 'HTTP_ERROR')
        message = detail.get('message', f'HTTP {exc.status_code} error')
        details = detail.get('details', {})
    else:
        error_code = 'HTTP_ERROR'
        message = str(detail) if detail else f'HTTP {exc.status_code} error'
        details = {}
    
    logger.error(
        f"HTTP exception: {message}",
        extra_fields={
            "error_code": error_code,
            "status_code": exc.status_code,
            "correlation_id": correlation_id
        }
    )
    
    return create_error_json_response(
        error_code=error_code,
        message=message,
        status_code=exc.status_code,
        details=details,
        correlation_id=correlation_id
    )

async def handle_general_exception(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected errors"""
    
    correlation_id = get_correlation_id()
    
    logger.error(
        f"Unexpected error: {exc}",
        extra_fields={
            "error_code": ErrorCodes.INTERNAL_ERROR,
            "error_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
            "correlation_id": correlation_id
        }
    )
    
    return create_error_json_response(
        error_code=ErrorCodes.INTERNAL_ERROR,
        message="An unexpected error occurred during processing",
        status_code=500,
        details={
            "error_type": type(exc).__name__,
            "suggestion": "Please try again or contact support if the problem persists"
        },
        correlation_id=correlation_id
    )

def log_request_start(endpoint: str, correlation_id: str, **kwargs):
    """Log request start with correlation ID"""
    
    logger.info(
        f"Request started: {endpoint}",
        extra_fields={
            "event": "request_start",
            "endpoint": endpoint,
            "correlation_id": correlation_id,
            **kwargs
        }
    )

def log_request_end(endpoint: str, correlation_id: str, duration_ms: float, status_code: int, **kwargs):
    """Log request completion with correlation ID"""
    
    logger.info(
        f"Request completed: {endpoint} - {status_code} ({duration_ms:.2f}ms)",
        extra_fields={
            "event": "request_end",
            "endpoint": endpoint,
            "correlation_id": correlation_id,
            "duration_ms": duration_ms,
            "status_code": status_code,
            **kwargs
        }
    )

def log_processing_step(step: str, correlation_id: str, **kwargs):
    """Log processing step with correlation ID"""
    
    logger.debug(
        f"Processing step: {step}",
        extra_fields={
            "event": "processing_step",
            "step": step,
            "correlation_id": correlation_id,
            **kwargs
        }
    )