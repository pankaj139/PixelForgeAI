"""
Pydantic models for request/response validation
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal, Dict, Any
from enum import Enum

# Enums for validation
class DetectionType(str, Enum):
    FACE = "face"
    PERSON = "person"

class CropStrategy(str, Enum):
    CENTER = "center"
    CENTER_FACES = "center_faces"
    PRESERVE_ALL = "preserve_all"

class OutputFormat(str, Enum):
    IMAGE = "image"
    PDF = "pdf"

class SheetOrientation(str, Enum):
    PORTRAIT = "portrait"
    LANDSCAPE = "landscape"

# Base models
class BoundingBox(BaseModel):
    """Bounding box coordinates"""
    x: int = Field(..., ge=0, description="X coordinate of top-left corner")
    y: int = Field(..., ge=0, description="Y coordinate of top-left corner")
    width: int = Field(..., gt=0, description="Width of bounding box")
    height: int = Field(..., gt=0, description="Height of bounding box")

class AspectRatio(BaseModel):
    """Aspect ratio dimensions"""
    width: int = Field(..., gt=0, description="Width ratio")
    height: int = Field(..., gt=0, description="Height ratio")
    
    @field_validator('width', 'height')
    @classmethod
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError('Width and height must be positive')
        return v

class GridLayout(BaseModel):
    """Grid layout configuration"""
    rows: int = Field(..., ge=1, le=10, description="Number of rows")
    columns: int = Field(..., ge=1, le=10, description="Number of columns")

# Detection models
class DetectionResult(BaseModel):
    """Object detection result"""
    type: DetectionType
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bounding_box: BoundingBox

class DetectionRequest(BaseModel):
    """Request for object detection"""
    image_path: str = Field(..., description="Path to image file")
    detection_types: List[DetectionType] = Field(default=[DetectionType.FACE, DetectionType.PERSON])
    confidence_threshold: float = Field(default=0.5, ge=0.0, le=1.0)

class DetectionResponse(BaseModel):
    """Response from object detection"""
    image_path: str
    detections: List[DetectionResult]
    processing_time: float
    image_dimensions: Dict[str, int]  # {"width": int, "height": int}

# Cropping models
class CropRequest(BaseModel):
    """Request for image cropping"""
    image_path: str = Field(..., description="Path to image file")
    target_aspect_ratio: AspectRatio
    detection_results: Optional[List[DetectionResult]] = None
    crop_strategy: CropStrategy = CropStrategy.CENTER
    output_path: Optional[str] = None

class ProcessedImage(BaseModel):
    """Processed image result"""
    original_path: str
    processed_path: str
    crop_coordinates: BoundingBox
    final_dimensions: AspectRatio
    processing_time: float

# Batch processing models
class BatchProcessRequest(BaseModel):
    """Request for batch image processing"""
    images: List[str] = Field(..., description="List of image paths")
    target_aspect_ratio: AspectRatio
    crop_strategy: CropStrategy = CropStrategy.CENTER
    detection_types: List[DetectionType] = Field(default=[DetectionType.FACE, DetectionType.PERSON])
    confidence_threshold: float = Field(default=0.5, ge=0.0, le=1.0)

class BatchProcessResult(BaseModel):
    """Result from batch processing"""
    processed_images: List[ProcessedImage]
    failed_images: List[Dict[str, str]]  # {"path": str, "error": str}
    total_processing_time: float

# Sheet composition models
class SheetCompositionRequest(BaseModel):
    """Request for sheet composition"""
    processed_images: List[str] = Field(..., description="List of processed image paths")
    grid_layout: GridLayout
    sheet_orientation: SheetOrientation = SheetOrientation.PORTRAIT
    output_format: OutputFormat = OutputFormat.IMAGE
    output_path: Optional[str] = None

class ComposedSheet(BaseModel):
    """Composed sheet result"""
    output_path: str
    grid_layout: GridLayout
    images_used: List[str]
    sheet_dimensions: Dict[str, int]  # {"width": int, "height": int}
    processing_time: float

# Error models
class ErrorResponse(BaseModel):
    """Standard error response"""
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str
    correlation_id: Optional[str] = None
    service: str = "python-image-processing-service"

class ServiceHealthStatus(BaseModel):
    """Service health status"""
    status: Literal["healthy", "unhealthy", "degraded"]
    checks: Dict[str, bool]
    uptime_seconds: float
    memory_usage_mb: float
    disk_usage_percent: float
    last_error: Optional[str] = None

# Health check model
class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    timestamp: str
    environment: str