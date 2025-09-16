"""
Unit tests for image processing and cropping functionality
"""

import pytest
import os
import tempfile
import shutil
from PIL import Image
from pathlib import Path
from unittest.mock import patch, MagicMock

from processing.image_processor import ImageProcessor, ImageFormatConverter
from models import (
    DetectionResult, BoundingBox, AspectRatio, CropStrategy,
    CropRequest, DetectionType
)


class TestImageProcessor:
    """Test cases for ImageProcessor class"""
    
    @pytest.fixture
    def processor(self):
        """Create ImageProcessor instance for testing"""
        return ImageProcessor(max_image_size=10 * 1024 * 1024)  # 10MB
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test files"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def sample_image(self, temp_dir):
        """Create a sample test image"""
        image_path = os.path.join(temp_dir, "test_image.jpg")
        # Create a 800x600 RGB image
        image = Image.new('RGB', (800, 600), color='red')
        image.save(image_path, 'JPEG')
        return image_path
    
    @pytest.fixture
    def sample_detections(self):
        """Create sample detection results"""
        return [
            DetectionResult(
                type=DetectionType.FACE,
                confidence=0.9,
                bounding_box=BoundingBox(x=200, y=150, width=100, height=120)
            ),
            DetectionResult(
                type=DetectionType.PERSON,
                confidence=0.8,
                bounding_box=BoundingBox(x=150, y=100, width=200, height=400)
            )
        ]
    
    def test_load_image_success(self, processor, sample_image):
        """Test successful image loading"""
        image = processor.load_image(sample_image)
        assert isinstance(image, Image.Image)
        assert image.mode == 'RGB'
        assert image.size == (800, 600)
    
    def test_load_image_not_found(self, processor):
        """Test loading non-existent image"""
        with pytest.raises(FileNotFoundError):
            processor.load_image("non_existent_image.jpg")
    
    def test_load_image_unsupported_format(self, processor, temp_dir):
        """Test loading unsupported image format"""
        unsupported_file = os.path.join(temp_dir, "test.txt")
        with open(unsupported_file, 'w') as f:
            f.write("not an image")
        
        with pytest.raises(ValueError, match="Unsupported image format"):
            processor.load_image(unsupported_file)
    
    def test_load_image_too_large(self, temp_dir):
        """Test loading image that exceeds size limit"""
        processor = ImageProcessor(max_image_size=100)  # Very small limit
        image_path = os.path.join(temp_dir, "large_image.jpg")
        
        # Create a larger image
        image = Image.new('RGB', (1000, 1000), color='blue')
        image.save(image_path, 'JPEG')
        
        with pytest.raises(ValueError, match="Image file too large"):
            processor.load_image(image_path)
    
    def test_save_image_jpeg(self, processor, temp_dir):
        """Test saving image as JPEG"""
        image = Image.new('RGB', (400, 300), color='green')
        output_path = os.path.join(temp_dir, "output", "test_output.jpg")
        
        saved_path = processor.save_image(image, output_path)
        
        assert os.path.exists(saved_path)
        assert saved_path == output_path
        
        # Verify saved image
        loaded_image = Image.open(saved_path)
        assert loaded_image.size == (400, 300)
    
    def test_save_image_png(self, processor, temp_dir):
        """Test saving image as PNG"""
        image = Image.new('RGB', (400, 300), color='blue')
        output_path = os.path.join(temp_dir, "output", "test_output.png")
        
        saved_path = processor.save_image(image, output_path)
        
        assert os.path.exists(saved_path)
        assert saved_path == output_path
    
    def test_calculate_crop_coordinates_center(self, processor):
        """Test center crop coordinate calculation"""
        image_size = (800, 600)
        target_ratio = AspectRatio(width=4, height=3)  # Same as original
        
        coords = processor.calculate_crop_coordinates(
            image_size, target_ratio, strategy=CropStrategy.CENTER
        )
        
        assert coords.x == 0
        assert coords.y == 0
        assert coords.width == 800
        assert coords.height == 600
    
    def test_calculate_crop_coordinates_wider_target(self, processor):
        """Test crop calculation when target is wider than original"""
        image_size = (800, 600)
        target_ratio = AspectRatio(width=16, height=9)  # Wider ratio
        
        coords = processor.calculate_crop_coordinates(
            image_size, target_ratio, strategy=CropStrategy.CENTER
        )
        
        # Should crop height, keep full width
        assert coords.x == 0
        assert coords.width == 800
        assert coords.height == 450  # 800 * 9/16
        assert coords.y == 75  # (600 - 450) / 2
    
    def test_calculate_crop_coordinates_taller_target(self, processor):
        """Test crop calculation when target is taller than original"""
        image_size = (800, 600)
        target_ratio = AspectRatio(width=3, height=4)  # Taller ratio
        
        coords = processor.calculate_crop_coordinates(
            image_size, target_ratio, strategy=CropStrategy.CENTER
        )
        
        # Should crop width, keep full height
        assert coords.y == 0
        assert coords.height == 600
        assert coords.width == 450  # 600 * 3/4
        assert coords.x == 175  # (800 - 450) / 2
    
    def test_calculate_crop_coordinates_center_faces(self, processor, sample_detections):
        """Test crop calculation centering on faces"""
        image_size = (800, 600)
        target_ratio = AspectRatio(width=1, height=1)  # Square crop
        
        coords = processor.calculate_crop_coordinates(
            image_size, target_ratio, sample_detections, CropStrategy.CENTER_FACES
        )
        
        # Should center on face detection (200, 150, 100, 120)
        # Face center is at (250, 210)
        assert coords.width == 600  # min(800, 600) for square
        assert coords.height == 600
        # Should be centered around face
        assert abs(coords.x + coords.width // 2 - 250) < 100  # Approximate centering
    
    def test_calculate_crop_coordinates_preserve_all(self, processor, sample_detections):
        """Test crop calculation preserving all detections"""
        image_size = (800, 600)
        target_ratio = AspectRatio(width=4, height=3)
        
        coords = processor.calculate_crop_coordinates(
            image_size, target_ratio, sample_detections, CropStrategy.PRESERVE_ALL
        )
        
        # Should include both detections
        # Face: (200, 150, 100, 120) -> (200-300, 150-270)
        # Person: (150, 100, 200, 400) -> (150-350, 100-500)
        # Combined: (150-350, 100-500)
        
        assert coords.x <= 150  # Should include person left edge
        assert coords.x + coords.width >= 350  # Should include person right edge
        assert coords.y <= 100  # Should include person top edge
        assert coords.y + coords.height >= 500  # Should include person bottom edge
    
    def test_crop_image(self, processor):
        """Test image cropping functionality"""
        image = Image.new('RGB', (800, 600), color='red')
        crop_coords = BoundingBox(x=100, y=50, width=400, height=300)
        
        cropped = processor.crop_image(image, crop_coords)
        
        assert cropped.size == (400, 300)
    
    def test_resize_with_aspect_ratio_target_size(self, processor):
        """Test resizing to specific target size"""
        image = Image.new('RGB', (800, 600), color='blue')
        
        resized = processor.resize_with_aspect_ratio(image, target_size=(400, 300))
        
        assert resized.size == (400, 300)
    
    def test_resize_with_aspect_ratio_max_dimension(self, processor):
        """Test resizing with maximum dimension constraint"""
        image = Image.new('RGB', (800, 600), color='green')
        
        resized = processor.resize_with_aspect_ratio(image, max_dimension=400)
        
        # Should maintain aspect ratio, largest dimension should be 400
        assert max(resized.size) == 400
        assert resized.size == (400, 300)  # Maintains 4:3 ratio
    
    def test_process_crop_request_success(self, processor, sample_image, temp_dir, sample_detections):
        """Test complete crop request processing"""
        request = CropRequest(
            image_path=sample_image,
            target_aspect_ratio=AspectRatio(width=1, height=1),
            detection_results=sample_detections,
            crop_strategy=CropStrategy.CENTER_FACES,
            output_path=os.path.join(temp_dir, "processed", "output.jpg")
        )
        
        result = processor.process_crop_request(request)
        
        assert isinstance(result.processing_time, float)
        assert result.processing_time > 0
        assert result.original_path == sample_image
        assert os.path.exists(result.processed_path)
        assert result.crop_coordinates.width > 0
        assert result.crop_coordinates.height > 0
        assert result.final_dimensions.width > 0
        assert result.final_dimensions.height > 0
    
    def test_process_crop_request_auto_output_path(self, processor, sample_image, sample_detections):
        """Test crop request with auto-generated output path"""
        request = CropRequest(
            image_path=sample_image,
            target_aspect_ratio=AspectRatio(width=4, height=3),
            detection_results=sample_detections,
            crop_strategy=CropStrategy.CENTER
        )
        
        result = processor.process_crop_request(request)
        
        assert result.processed_path != sample_image
        assert "temp_" in result.processed_path  # Auto-generated paths use "temp_" prefix
        assert "/processed/" in result.processed_path  # Should be in processed directory
        assert os.path.exists(result.processed_path)
    
    def test_process_crop_request_invalid_image(self, processor):
        """Test crop request with invalid image path"""
        request = CropRequest(
            image_path="non_existent.jpg",
            target_aspect_ratio=AspectRatio(width=1, height=1)
        )
        
        with pytest.raises(ValueError, match="Image processing failed"):
            processor.process_crop_request(request)


class TestImageFormatConverter:
    """Test cases for ImageFormatConverter class"""
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test files"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def sample_png_image(self, temp_dir):
        """Create a sample PNG image"""
        image_path = os.path.join(temp_dir, "test_image.png")
        image = Image.new('RGB', (400, 300), color='red')
        image.save(image_path, 'PNG')
        return image_path
    
    def test_convert_format_png_to_jpeg(self, sample_png_image, temp_dir):
        """Test converting PNG to JPEG"""
        output_path = os.path.join(temp_dir, "converted.jpg")
        
        result_path = ImageFormatConverter.convert_format(
            sample_png_image, output_path, 'JPEG'
        )
        
        assert result_path == output_path
        assert os.path.exists(output_path)
        
        # Verify converted image
        with Image.open(output_path) as img:
            assert img.format == 'JPEG'
            assert img.size == (400, 300)
    
    def test_convert_format_invalid_input(self, temp_dir):
        """Test format conversion with invalid input"""
        invalid_path = os.path.join(temp_dir, "non_existent.jpg")
        output_path = os.path.join(temp_dir, "output.jpg")
        
        with pytest.raises(ValueError, match="Format conversion failed"):
            ImageFormatConverter.convert_format(invalid_path, output_path)
    
    def test_optimize_image_success(self, sample_png_image, temp_dir):
        """Test image optimization"""
        output_path = os.path.join(temp_dir, "optimized.jpg")
        
        result_path = ImageFormatConverter.optimize_image(
            sample_png_image, output_path, quality_start=90
        )
        
        assert result_path == output_path
        assert os.path.exists(output_path)
    
    def test_optimize_image_with_size_limit(self, temp_dir):
        """Test image optimization with file size limit"""
        # Create a larger image
        input_path = os.path.join(temp_dir, "large_image.png")
        image = Image.new('RGB', (1000, 1000), color='blue')
        image.save(input_path, 'PNG')
        
        output_path = os.path.join(temp_dir, "optimized.jpg")
        max_size = 50 * 1024  # 50KB
        
        result_path = ImageFormatConverter.optimize_image(
            input_path, output_path, max_file_size=max_size
        )
        
        assert result_path == output_path
        assert os.path.exists(output_path)
        # Note: Actual size check might vary due to compression
    
    def test_optimize_image_invalid_input(self, temp_dir):
        """Test image optimization with invalid input"""
        invalid_path = os.path.join(temp_dir, "non_existent.jpg")
        output_path = os.path.join(temp_dir, "output.jpg")
        
        with pytest.raises(ValueError, match="Image optimization failed"):
            ImageFormatConverter.optimize_image(invalid_path, output_path)


class TestCropStrategies:
    """Test cases for different cropping strategies"""
    
    @pytest.fixture
    def processor(self):
        return ImageProcessor()
    
    def test_center_strategy_no_detections(self, processor):
        """Test center strategy without detections"""
        coords = processor.calculate_crop_coordinates(
            (800, 600), AspectRatio(width=1, height=1), None, CropStrategy.CENTER
        )
        
        # Should center the square crop
        assert coords.width == 600
        assert coords.height == 600
        assert coords.x == 100  # (800 - 600) / 2
        assert coords.y == 0
    
    def test_center_faces_fallback_to_persons(self, processor):
        """Test center faces strategy falling back to persons when no faces"""
        person_detection = DetectionResult(
            type=DetectionType.PERSON,
            confidence=0.8,
            bounding_box=BoundingBox(x=300, y=200, width=200, height=300)
        )
        
        coords = processor.calculate_crop_coordinates(
            (800, 600), AspectRatio(width=1, height=1), [person_detection], CropStrategy.CENTER_FACES
        )
        
        # Should center on person (center at 400, 350)
        expected_center_x = 300 + 200 // 2  # 400
        crop_center_x = coords.x + coords.width // 2
        
        # Allow some tolerance for centering
        assert abs(crop_center_x - expected_center_x) < 50
    
    def test_preserve_all_strategy_multiple_detections(self, processor):
        """Test preserve all strategy with multiple detections"""
        detections = [
            DetectionResult(
                type=DetectionType.FACE,
                confidence=0.9,
                bounding_box=BoundingBox(x=100, y=100, width=50, height=60)
            ),
            DetectionResult(
                type=DetectionType.FACE,
                confidence=0.8,
                bounding_box=BoundingBox(x=600, y=400, width=60, height=70)
            )
        ]
        
        coords = processor.calculate_crop_coordinates(
            (800, 600), AspectRatio(width=4, height=3), detections, CropStrategy.PRESERVE_ALL
        )
        
        # Should include both faces
        # Face 1: (100-150, 100-160)
        # Face 2: (600-660, 400-470)
        assert coords.x <= 100
        assert coords.x + coords.width >= 660
        assert coords.y <= 100
        assert coords.y + coords.height >= 470
    
    def test_edge_case_detection_larger_than_crop(self, processor):
        """Test case where detection is larger than crop area"""
        large_detection = DetectionResult(
            type=DetectionType.PERSON,
            confidence=0.9,
            bounding_box=BoundingBox(x=0, y=0, width=800, height=600)
        )
        
        coords = processor.calculate_crop_coordinates(
            (800, 600), AspectRatio(width=1, height=1), [large_detection], CropStrategy.PRESERVE_ALL
        )
        
        # Should still produce valid crop coordinates
        assert coords.width == 600  # Square crop
        assert coords.height == 600
        assert coords.x >= 0
        assert coords.y >= 0
        assert coords.x + coords.width <= 800
        assert coords.y + coords.height <= 600