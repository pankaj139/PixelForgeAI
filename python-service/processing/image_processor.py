"""
Image processing and cropping module

This module provides intelligent image cropping, aspect ratio conversion,
and image manipulation utilities using PIL (Pillow).
"""

import os
import time
from typing import List, Optional, Tuple, Dict, Any
from PIL import Image, ImageOps, ImageEnhance
import logging
from pathlib import Path

from models import (
    DetectionResult, BoundingBox, AspectRatio, CropStrategy,
    ProcessedImage, CropRequest
)

logger = logging.getLogger(__name__)


class ImageProcessor:
    """
    Main image processing class that handles cropping, resizing,
    and format conversion operations.
    """
    
    def __init__(self, max_image_size: int = 50 * 1024 * 1024):
        """
        Initialize the image processor
        
        Args:
            max_image_size: Maximum allowed image size in bytes
        """
        self.max_image_size = max_image_size
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        
    def load_image(self, image_path: str) -> Image.Image:
        """
        Load and validate an image file
        
        Args:
            image_path: Path to the image file
            
        Returns:
            PIL Image object
            
        Raises:
            FileNotFoundError: If image file doesn't exist
            ValueError: If image format is not supported or file is too large
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
            
        # Check file size
        file_size = os.path.getsize(image_path)
        if file_size > self.max_image_size:
            raise ValueError(f"Image file too large: {file_size} bytes (max: {self.max_image_size})")
            
        # Check file extension
        file_ext = Path(image_path).suffix.lower()
        if file_ext not in self.supported_formats:
            raise ValueError(f"Unsupported image format: {file_ext}")
            
        try:
            # Load and convert to RGB if necessary
            image = Image.open(image_path)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            return image
        except Exception as e:
            raise ValueError(f"Failed to load image: {str(e)}")
    
    def save_image(self, image: Image.Image, output_path: str, quality: int = 95) -> str:
        """
        Save an image to the specified path with quality preservation
        
        Args:
            image: PIL Image object to save
            output_path: Path where to save the image
            quality: JPEG quality (1-100, higher is better)
            
        Returns:
            Path to the saved image
        """
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Determine format from extension
        file_ext = Path(output_path).suffix.lower()
        if file_ext in {'.jpg', '.jpeg'}:
            image.save(output_path, 'JPEG', quality=quality, optimize=True)
        elif file_ext == '.png':
            image.save(output_path, 'PNG', optimize=True)
        else:
            # Default to JPEG for other formats
            output_path = str(Path(output_path).with_suffix('.jpg'))
            image.save(output_path, 'JPEG', quality=quality, optimize=True)
            
        return output_path
    
    def calculate_crop_coordinates(
        self,
        image_size: Tuple[int, int],
        target_aspect_ratio: AspectRatio,
        detections: Optional[List[DetectionResult]] = None,
        strategy: CropStrategy = CropStrategy.CENTER
    ) -> BoundingBox:
        """
        Calculate optimal crop coordinates based on detection results and strategy
        
        Args:
            image_size: (width, height) of the original image
            target_aspect_ratio: Desired aspect ratio
            detections: List of detected objects (faces, persons)
            strategy: Cropping strategy to use
            
        Returns:
            BoundingBox with crop coordinates
        """
        img_width, img_height = image_size
        target_ratio = target_aspect_ratio.width / target_aspect_ratio.height
        current_ratio = img_width / img_height
        
        # Calculate target dimensions that fit within the image
        if current_ratio > target_ratio:
            # Image is wider than target ratio - crop width
            crop_height = img_height
            crop_width = int(crop_height * target_ratio)
        else:
            # Image is taller than target ratio - crop height
            crop_width = img_width
            crop_height = int(crop_width / target_ratio)
        
        # Ensure crop dimensions don't exceed image dimensions
        crop_width = min(crop_width, img_width)
        crop_height = min(crop_height, img_height)
        
        # Calculate crop position based on strategy
        if strategy == CropStrategy.CENTER or not detections:
            # Center crop
            x = (img_width - crop_width) // 2
            y = (img_height - crop_height) // 2
        elif strategy == CropStrategy.CENTER_FACES:
            # Center on faces if available, otherwise center on persons
            faces = [d for d in detections if d.type.value == 'face']
            persons = [d for d in detections if d.type.value == 'person']
            
            target_detections = faces if faces else persons
            if target_detections:
                x, y = self._center_on_detections(
                    target_detections, crop_width, crop_height, img_width, img_height
                )
            else:
                # Fallback to center
                x = (img_width - crop_width) // 2
                y = (img_height - crop_height) // 2
        elif strategy == CropStrategy.PRESERVE_ALL:
            # Try to include all detections
            if detections:
                x, y = self._preserve_all_detections(
                    detections, crop_width, crop_height, img_width, img_height
                )
            else:
                # Fallback to center
                x = (img_width - crop_width) // 2
                y = (img_height - crop_height) // 2
        else:
            # Default to center
            x = (img_width - crop_width) // 2
            y = (img_height - crop_height) // 2
        
        # Ensure coordinates are within bounds
        x = max(0, min(x, img_width - crop_width))
        y = max(0, min(y, img_height - crop_height))
        
        return BoundingBox(x=x, y=y, width=crop_width, height=crop_height)
    
    def _center_on_detections(
        self,
        detections: List[DetectionResult],
        crop_width: int,
        crop_height: int,
        img_width: int,
        img_height: int
    ) -> Tuple[int, int]:
        """
        Calculate crop position to center on detected objects
        
        Args:
            detections: List of detections to center on
            crop_width: Width of the crop area
            crop_height: Height of the crop area
            img_width: Original image width
            img_height: Original image height
            
        Returns:
            (x, y) coordinates for crop position
        """
        if not detections:
            return (img_width - crop_width) // 2, (img_height - crop_height) // 2
        
        # Calculate center of all detections
        total_x = 0
        total_y = 0
        total_weight = 0
        
        for detection in detections:
            bbox = detection.bounding_box
            # Weight by confidence and size
            weight = detection.confidence * (bbox.width * bbox.height)
            center_x = bbox.x + bbox.width // 2
            center_y = bbox.y + bbox.height // 2
            
            total_x += center_x * weight
            total_y += center_y * weight
            total_weight += weight
        
        if total_weight > 0:
            center_x = int(total_x / total_weight)
            center_y = int(total_y / total_weight)
        else:
            center_x = img_width // 2
            center_y = img_height // 2
        
        # Position crop to center on this point
        x = center_x - crop_width // 2
        y = center_y - crop_height // 2
        
        return x, y
    
    def _preserve_all_detections(
        self,
        detections: List[DetectionResult],
        crop_width: int,
        crop_height: int,
        img_width: int,
        img_height: int
    ) -> Tuple[int, int]:
        """
        Calculate crop position to preserve all detected objects
        
        Args:
            detections: List of detections to preserve
            crop_width: Width of the crop area
            crop_height: Height of the crop area
            img_width: Original image width
            img_height: Original image height
            
        Returns:
            (x, y) coordinates for crop position
        """
        if not detections:
            return (img_width - crop_width) // 2, (img_height - crop_height) // 2
        
        # Find bounding box that contains all detections
        min_x = min(d.bounding_box.x for d in detections)
        min_y = min(d.bounding_box.y for d in detections)
        max_x = max(d.bounding_box.x + d.bounding_box.width for d in detections)
        max_y = max(d.bounding_box.y + d.bounding_box.height for d in detections)
        
        # Calculate center of all detections
        center_x = (min_x + max_x) // 2
        center_y = (min_y + max_y) // 2
        
        # Try to center crop on all detections
        x = center_x - crop_width // 2
        y = center_y - crop_height // 2
        
        # Adjust if crop would go outside image bounds
        detection_width = max_x - min_x
        detection_height = max_y - min_y
        
        if detection_width > crop_width or detection_height > crop_height:
            # Detections don't fit in crop area, center on detection center
            return x, y
        
        # Ensure all detections are within crop area
        if x > min_x:
            x = min_x
        if y > min_y:
            y = min_y
        if x + crop_width < max_x:
            x = max_x - crop_width
        if y + crop_height < max_y:
            y = max_y - crop_height
        
        return x, y
    
    def crop_image(
        self,
        image: Image.Image,
        crop_coords: BoundingBox
    ) -> Image.Image:
        """
        Crop an image using the specified coordinates
        
        Args:
            image: PIL Image object to crop
            crop_coords: BoundingBox with crop coordinates
            
        Returns:
            Cropped PIL Image object
        """
        return image.crop((
            crop_coords.x,
            crop_coords.y,
            crop_coords.x + crop_coords.width,
            crop_coords.y + crop_coords.height
        ))
    
    def resize_with_aspect_ratio(
        self,
        image: Image.Image,
        target_size: Optional[Tuple[int, int]] = None,
        max_dimension: Optional[int] = None,
        quality_enhance: bool = True
    ) -> Image.Image:
        """
        Resize image while maintaining aspect ratio and quality
        
        Args:
            image: PIL Image object to resize
            target_size: Specific (width, height) to resize to
            max_dimension: Maximum dimension (width or height)
            quality_enhance: Whether to apply quality enhancement
            
        Returns:
            Resized PIL Image object
        """
        if target_size:
            # Resize to specific dimensions
            resized = image.resize(target_size, Image.Resampling.LANCZOS)
        elif max_dimension:
            # Resize maintaining aspect ratio with max dimension
            image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            resized = image
        else:
            # No resizing needed
            resized = image
        
        # Apply quality enhancement if requested
        if quality_enhance and resized.size != image.size:
            # Slight sharpening for resized images
            enhancer = ImageEnhance.Sharpness(resized)
            resized = enhancer.enhance(1.1)
        
        return resized
    
    def process_crop_request(self, request: CropRequest) -> ProcessedImage:
        """
        Process a complete crop request
        
        Args:
            request: CropRequest with all processing parameters
            
        Returns:
            ProcessedImage with processing results
            
        Raises:
            FileNotFoundError: If input image doesn't exist
            ValueError: If processing fails
        """
        start_time = time.time()
        
        try:
            # Load the image
            image = self.load_image(request.image_path)
            original_size = image.size
            
            # Calculate crop coordinates
            crop_coords = self.calculate_crop_coordinates(
                image_size=original_size,
                target_aspect_ratio=request.target_aspect_ratio,
                detections=request.detection_results,
                strategy=request.crop_strategy
            )
            
            # Perform the crop
            cropped_image = self.crop_image(image, crop_coords)
            
            # Generate output path if not provided
            if request.output_path:
                output_path = request.output_path
            else:
                # Generate temporary path - Node.js will rename it with AI-generated names
                input_path = Path(request.image_path)
                temp_filename = f"temp_{input_path.stem}_{int(time.time())}{input_path.suffix}"
                output_path = str(input_path.parent / "processed" / temp_filename)
            
            # Save the processed image
            saved_path = self.save_image(cropped_image, output_path)
            
            processing_time = time.time() - start_time
            
            return ProcessedImage(
                original_path=request.image_path,
                processed_path=saved_path,
                crop_coordinates=crop_coords,
                final_dimensions=AspectRatio(
                    width=cropped_image.width,
                    height=cropped_image.height
                ),
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Failed to process crop request: {e}")
            raise ValueError(f"Image processing failed: {str(e)}")


class ImageFormatConverter:
    """
    Utility class for image format conversion and optimization
    """
    
    @staticmethod
    def convert_format(
        input_path: str,
        output_path: str,
        target_format: str = 'JPEG',
        quality: int = 95
    ) -> str:
        """
        Convert image to different format
        
        Args:
            input_path: Path to input image
            output_path: Path for output image
            target_format: Target format (JPEG, PNG, etc.)
            quality: Quality setting for lossy formats
            
        Returns:
            Path to converted image
        """
        try:
            with Image.open(input_path) as image:
                # Convert to RGB if necessary for JPEG
                if target_format.upper() == 'JPEG' and image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Ensure output directory exists
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Save with appropriate settings
                if target_format.upper() == 'JPEG':
                    image.save(output_path, target_format, quality=quality, optimize=True)
                else:
                    image.save(output_path, target_format, optimize=True)
                
                return output_path
                
        except Exception as e:
            raise ValueError(f"Format conversion failed: {str(e)}")
    
    @staticmethod
    def optimize_image(
        input_path: str,
        output_path: str,
        max_file_size: Optional[int] = None,
        quality_start: int = 95
    ) -> str:
        """
        Optimize image file size while maintaining quality
        
        Args:
            input_path: Path to input image
            output_path: Path for optimized image
            max_file_size: Maximum file size in bytes
            quality_start: Starting quality level
            
        Returns:
            Path to optimized image
        """
        try:
            with Image.open(input_path) as image:
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Ensure output directory exists
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                quality = quality_start
                
                while quality > 10:
                    # Save with current quality
                    image.save(output_path, 'JPEG', quality=quality, optimize=True)
                    
                    # Check file size if limit specified
                    if max_file_size and os.path.getsize(output_path) <= max_file_size:
                        break
                    elif not max_file_size:
                        break
                    
                    # Reduce quality and try again
                    quality -= 10
                
                return output_path
                
        except Exception as e:
            raise ValueError(f"Image optimization failed: {str(e)}")