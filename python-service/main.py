"""
FastAPI Image Processing Service

This service provides computer vision and image processing capabilities
for the Image Aspect Ratio Converter application.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import List, Optional, Literal
import uvicorn
import os
import time
import asyncio
from datetime import datetime, timezone

# Import configuration
from config import Settings

# Import detection modules
from detection.detection_processor import DetectionProcessor
from processing.image_processor import ImageProcessor
from composition.sheet_composer import SheetComposer
from models import (
    DetectionRequest, DetectionResponse, CropRequest, ProcessedImage, ErrorResponse,
    BatchProcessRequest, BatchProcessResult, SheetCompositionRequest, ComposedSheet,
    ServiceHealthStatus
)

# Import utilities
from utils.logging_config import setup_logging, get_logger
from utils.error_handling import (
    handle_service_exception, handle_file_not_found_error, handle_value_error,
    handle_memory_error, handle_validation_error, handle_http_exception,
    handle_general_exception, ServiceException, log_processing_step
)
from utils.health_monitor import get_health_monitor, periodic_cleanup_task
from middleware.correlation_id import CorrelationIdMiddleware

# Initialize settings
settings = Settings()

# Setup logging
setup_logging(debug=settings.debug, log_file=getattr(settings, 'log_file', None))
logger = get_logger(__name__)

# Initialize detection processor
detection_processor = DetectionProcessor(
    face_confidence=settings.face_detection_confidence,
    person_confidence=settings.person_detection_confidence
)

# Initialize image processor
image_processor = ImageProcessor(max_image_size=settings.max_image_size)

# Initialize sheet composer
sheet_composer = SheetComposer(temp_dir=settings.temp_dir)

# Initialize health monitor
health_monitor = get_health_monitor()

# Create FastAPI application
app = FastAPI(
    title="Image Processing Service",
    description="Python FastAPI service for computer vision and image processing",
    version="1.0.0"
)

# Add correlation ID middleware
app.add_middleware(CorrelationIdMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom exception handlers with structured error responses
app.add_exception_handler(ServiceException, handle_service_exception)
app.add_exception_handler(FileNotFoundError, handle_file_not_found_error)
app.add_exception_handler(ValueError, handle_value_error)
app.add_exception_handler(MemoryError, handle_memory_error)
app.add_exception_handler(ValidationError, handle_validation_error)
app.add_exception_handler(HTTPException, handle_http_exception)
app.add_exception_handler(Exception, handle_general_exception)

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("Starting Image Processing Service")
    
    # Start periodic cleanup task
    asyncio.create_task(periodic_cleanup_task())
    
    logger.info("Service startup completed")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on service shutdown"""
    logger.info("Shutting down Image Processing Service")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint"""
    health_status = health_monitor.get_health_status()
    return {
        "status": health_status.status,
        "service": "image-processing-service",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.environment,
        "checks": health_status.checks,
        "uptime_seconds": health_status.uptime_seconds,
        "memory_usage_mb": health_status.memory_usage_mb,
        "disk_usage_percent": health_status.disk_usage_percent
    }

# Detailed health endpoint
@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with metrics"""
    health_status = health_monitor.get_health_status()
    metrics = health_monitor.get_metrics()
    
    return {
        "health": health_status.model_dump(),
        "metrics": metrics,
        "service": "image-processing-service",
        "version": "1.0.0",
        "environment": settings.environment
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "message": "Image Processing Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# Detection endpoint
@app.post("/api/v1/detect", response_model=DetectionResponse)
async def detect_objects(request: DetectionRequest):
    """
    Detect objects (faces and/or persons) in an image
    
    Args:
        request: DetectionRequest containing image path and detection parameters
        
    Returns:
        DetectionResponse with detected objects and metadata
        
    Raises:
        HTTPException: If detection fails or image not found
    """
    try:
        logger.info(f"Processing detection request for image: {request.image_path}")
        
        # Validate image path
        if not os.path.exists(request.image_path):
            raise FileNotFoundError(f"Image file not found: {request.image_path}")
        
        # Validate detection types
        if not request.detection_types:
            raise ValueError("At least one detection type must be specified")
        
        # Process the detection request
        response = detection_processor.process_detection_request(request)
        
        logger.info(f"Detection completed. Found {len(response.detections)} objects in {response.processing_time:.3f}s")
        return response
        
    except FileNotFoundError:
        raise
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Detection processing failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail={
                "error_code": "DETECTION_FAILED",
                "message": "Object detection processing failed",
                "details": {"error": str(e)},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

# Crop endpoint
@app.post("/api/v1/crop", response_model=ProcessedImage)
async def crop_image(request: CropRequest):
    """
    Crop an image based on detection results and target aspect ratio
    
    Args:
        request: CropRequest containing image path, target aspect ratio, and crop parameters
        
    Returns:
        ProcessedImage with cropping results and metadata
        
    Raises:
        HTTPException: If cropping fails or image not found
    """
    try:
        logger.info(f"Processing crop request for image: {request.image_path}")
        
        # Validate image path
        if not os.path.exists(request.image_path):
            raise FileNotFoundError(f"Image file not found: {request.image_path}")
        
        # Validate aspect ratio
        if request.target_aspect_ratio.width <= 0 or request.target_aspect_ratio.height <= 0:
            raise ValueError("Target aspect ratio dimensions must be positive")
        
        # Process the crop request
        result = image_processor.process_crop_request(request)
        
        logger.info(f"Cropping completed in {result.processing_time:.3f}s. Output: {result.processed_path}")
        return result
        
    except FileNotFoundError:
        raise
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during cropping: {e}")
        raise HTTPException(
            status_code=500, 
            detail={
                "error_code": "CROP_FAILED",
                "message": "Image cropping processing failed",
                "details": {"error": str(e)},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

# Detection statistics endpoint
@app.get("/api/v1/detect/stats")
async def get_detection_stats():
    """
    Get detection service statistics and capabilities
    
    Returns:
        Dictionary with service capabilities and statistics
    """
    return {
        "service": "Computer Vision Detection",
        "capabilities": {
            "face_detection": True,
            "person_detection": True,
            "supported_formats": settings.supported_formats,
            "max_image_size": settings.max_image_size
        },
        "models": {
            "face_detector": "OpenCV Haar Cascades",
            "person_detector": "HOG + MobileNet/YOLO (fallback)"
        },
        "confidence_thresholds": {
            "face_detection": settings.face_detection_confidence,
            "person_detection": settings.person_detection_confidence
        }
    }

# Batch processing endpoint
@app.post("/api/v1/process-batch", response_model=BatchProcessResult)
async def process_batch(request: BatchProcessRequest):
    """
    Process multiple images in batch with detection and cropping
    
    Args:
        request: BatchProcessRequest containing list of images and processing parameters
        
    Returns:
        BatchProcessResult with processed images and any failures
        
    Raises:
        HTTPException: If batch processing fails completely
    """
    try:
        logger.info(f"Processing batch request with {len(request.images)} images")
        start_time = time.time()
        
        # Validate batch request
        if not request.images:
            raise ValueError("Batch request must contain at least one image")
        
        if len(request.images) > settings.max_batch_size:
            raise ValueError(f"Batch size exceeds maximum allowed ({settings.max_batch_size})")
        
        # Validate aspect ratio
        if request.target_aspect_ratio.width <= 0 or request.target_aspect_ratio.height <= 0:
            raise ValueError("Target aspect ratio dimensions must be positive")
        
        # Validate detection types
        if not request.detection_types:
            raise ValueError("At least one detection type must be specified")
        
        processed_images = []
        failed_images = []
        
        for i, image_path in enumerate(request.images):
            try:
                logger.debug(f"Processing image {i+1}/{len(request.images)}: {image_path}")
                
                # Validate individual image path
                if not os.path.exists(image_path):
                    raise FileNotFoundError(f"Image file not found: {image_path}")
                
                # First, detect objects in the image
                detection_request = DetectionRequest(
                    image_path=image_path,
                    detection_types=request.detection_types,
                    confidence_threshold=request.confidence_threshold
                )
                
                detection_response = detection_processor.process_detection_request(detection_request)
                
                # Then crop the image using detection results
                crop_request = CropRequest(
                    image_path=image_path,
                    target_aspect_ratio=request.target_aspect_ratio,
                    detection_results=detection_response.detections,
                    crop_strategy=request.crop_strategy
                )
                
                processed_image = image_processor.process_crop_request(crop_request)
                processed_images.append(processed_image)
                
                logger.debug(f"Successfully processed image: {image_path}")
                
            except FileNotFoundError as e:
                error_msg = f"File not found: {str(e)}"
                logger.warning(error_msg)
                failed_images.append({
                    "path": image_path,
                    "error": error_msg,
                    "error_code": "IMAGE_NOT_FOUND"
                })
            except ValueError as e:
                error_msg = f"Invalid input: {str(e)}"
                logger.warning(error_msg)
                failed_images.append({
                    "path": image_path,
                    "error": error_msg,
                    "error_code": "INVALID_INPUT"
                })
            except MemoryError as e:
                error_msg = f"Memory error: {str(e)}"
                logger.warning(error_msg)
                failed_images.append({
                    "path": image_path,
                    "error": error_msg,
                    "error_code": "INSUFFICIENT_MEMORY"
                })
            except Exception as e:
                error_msg = f"Processing failed: {str(e)}"
                logger.warning(error_msg)
                failed_images.append({
                    "path": image_path,
                    "error": error_msg,
                    "error_code": "PROCESSING_FAILED"
                })
        
        total_processing_time = time.time() - start_time
        
        result = BatchProcessResult(
            processed_images=processed_images,
            failed_images=failed_images,
            total_processing_time=total_processing_time
        )
        
        logger.info(f"Batch processing completed. Success: {len(processed_images)}, Failed: {len(failed_images)}, Time: {total_processing_time:.3f}s")
        
        # If all images failed, return an error
        if not processed_images and failed_images:
            raise HTTPException(
                status_code=422,
                detail={
                    "error_code": "BATCH_PROCESSING_FAILED",
                    "message": "All images in the batch failed to process",
                    "details": {"failed_count": len(failed_images), "failures": failed_images},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
        
        return result
        
    except ValueError:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail={
                "error_code": "BATCH_PROCESSING_FAILED",
                "message": "Batch processing encountered an unexpected error",
                "details": {"error": str(e)},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

# Sheet composition endpoint
@app.post("/api/v1/compose-sheet", response_model=ComposedSheet)
async def compose_sheet(request: SheetCompositionRequest):
    """
    Compose multiple images into an A4 sheet layout
    
    Args:
        request: SheetCompositionRequest containing images and layout parameters
        
    Returns:
        ComposedSheet with composition results and metadata
        
    Raises:
        HTTPException: If composition fails or images not found
    """
    try:
        logger.info(f"Processing sheet composition request with {len(request.processed_images)} images")
        
        # Validate request
        if not request.processed_images:
            raise ValueError("At least one image must be provided")
        
        max_images = request.grid_layout.rows * request.grid_layout.columns
        if len(request.processed_images) > max_images:
            logger.warning(f"Too many images provided ({len(request.processed_images)}). Using only first {max_images} images for {request.grid_layout.rows}x{request.grid_layout.columns} grid.")
            # Silently use only the images that fit in the grid
            request.processed_images = request.processed_images[:max_images]
        
        # Validate that all image files exist
        for image_path in request.processed_images:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Process the composition request
        result = sheet_composer.process_sheet_composition_request(request)
        
        logger.info(f"Sheet composition completed in {result.processing_time:.3f}s. Output: {result.output_path}")
        return result
        
    except FileNotFoundError:
        raise
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Sheet composition failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail={
                "error_code": "COMPOSITION_FAILED",
                "message": "Sheet composition processing failed",
                "details": {"error": str(e)},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

# Image validation endpoint
@app.post("/api/v1/validate")
async def validate_image(image_path: str):
    """
    Validate an image file for processing compatibility
    
    Args:
        image_path: Path to the image file to validate
        
    Returns:
        Dictionary with validation results and image metadata
        
    Raises:
        HTTPException: If validation fails
    """
    try:
        logger.info(f"Validating image: {image_path}")
        
        # Check if file exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Check file size
        file_size = os.path.getsize(image_path)
        if file_size > settings.max_image_size:
            raise ValueError(f"Image file too large: {file_size} bytes (max: {settings.max_image_size})")
        
        # Check file extension
        from pathlib import Path
        file_ext = Path(image_path).suffix.lower().lstrip('.')
        if file_ext not in settings.supported_formats:
            raise ValueError(f"Unsupported image format: {file_ext}")
        
        # Try to load the image to validate it
        image = image_processor.load_image(image_path)
        
        return {
            "valid": True,
            "image_path": image_path,
            "file_size": file_size,
            "format": file_ext,
            "dimensions": {
                "width": image.width,
                "height": image.height
            },
            "aspect_ratio": round(image.width / image.height, 3),
            "message": "Image is valid for processing"
        }
        
    except FileNotFoundError:
        raise
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Image validation failed: {e}")
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "VALIDATION_FAILED",
                "message": "Image validation failed",
                "details": {"error": str(e)},
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

# Processing statistics endpoint
@app.get("/api/v1/process/stats")
async def get_processing_stats():
    """
    Get image processing service statistics and capabilities
    
    Returns:
        Dictionary with processing capabilities and settings
    """
    return {
        "service": "Image Processing",
        "capabilities": {
            "intelligent_cropping": True,
            "aspect_ratio_conversion": True,
            "format_conversion": True,
            "quality_preservation": True,
            "batch_processing": True,
            "image_validation": True
        },
        "supported_formats": settings.supported_formats,
        "max_image_size": settings.max_image_size,
        "max_batch_size": settings.max_batch_size,
        "crop_strategies": ["center", "center_faces", "preserve_all"],
        "fallback_strategies": ["center_crop", "smart_crop", "edge_detection"]
    }

# Sheet composition capabilities endpoint
@app.get("/api/v1/compose-sheet/capabilities")
async def get_composition_capabilities():
    """
    Get sheet composition capabilities and supported layouts
    
    Returns:
        Dictionary with composition capabilities and supported grid layouts
    """
    return {
        "service": "Sheet Composition",
        "capabilities": {
            "a4_layout_generation": True,
            "configurable_grids": True,
            "pdf_generation": True,
            "image_generation": True,
            "portrait_landscape": True
        },
        "supported_grid_layouts": [
            {"rows": 1, "columns": 2, "description": "1x2 - Two images side by side"},
            {"rows": 1, "columns": 3, "description": "1x3 - Three images in a row"},
            {"rows": 2, "columns": 2, "description": "2x2 - Four images in a square"},
            {"rows": 2, "columns": 3, "description": "2x3 - Six images in two rows"},
            {"rows": 3, "columns": 2, "description": "3x2 - Six images in three rows"},
            {"rows": 3, "columns": 3, "description": "3x3 - Nine images in a square"}
        ],
        "supported_orientations": ["portrait", "landscape"],
        "supported_formats": ["image", "pdf"],
        "sheet_dimensions": {
            "a4_portrait": {"width": 2480, "height": 3508, "dpi": 300},
            "a4_landscape": {"width": 3508, "height": 2480, "dpi": 300}
        },
        "margins": {
            "pixels": 150,
            "inches": 0.5
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info" if not settings.debug else "debug"
    )