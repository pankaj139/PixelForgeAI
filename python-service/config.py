"""
Enhanced configuration settings for the Image Processing Service

This file contains configuration settings with improved detection sensitivity
for better face and person detection in family photos and group images.

Usage:
    settings = Settings()
    face_confidence = settings.face_detection_confidence

Returns:
    Application settings with enhanced detection parameters
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application settings
    app_name: str = "Image Processing Service"
    environment: str = "development"
    debug: bool = True
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Image processing settings
    max_image_size: int = 50 * 1024 * 1024  # 50MB
    max_batch_size: int = 50  # Maximum number of images in a batch
    supported_formats: list = ["jpg", "jpeg", "png", "bmp", "tiff"]
    temp_dir: str = "/tmp/image_processing"
    
    # MediaPipe-inspired detection settings with balanced accuracy
    face_detection_confidence: float = 0.4   # Balanced for family photos with varied lighting
    person_detection_confidence: float = 0.35  # Balanced for person detection
    
    # Model paths
    models_dir: str = "./models"
    face_cascade_path: str = "./models/haarcascade_frontalface_default.xml"
    
    # File storage settings  
    upload_dir: str = "../backend/uploads"
    processed_dir: str = "../backend/processed"
    
    # Logging settings
    log_level: str = "INFO"
    log_file: Optional[str] = None
    enable_json_logging: bool = True
    
    # Health monitoring settings
    max_disk_usage_percent: float = 90.0
    health_check_interval: int = 60  # seconds
    
    class Config:
        env_file = ".env"
        env_prefix = "IMAGE_SERVICE_"