"""
Unit tests for crop endpoint functionality
"""

import pytest
import tempfile
import os
import numpy as np
import cv2
from fastapi.testclient import TestClient
from PIL import Image
import sys
sys.path.append('..')

from main import app
from models import CropRequest, AspectRatio, CropStrategy, DetectionResult, BoundingBox, DetectionType


class TestCropEndpoint:
    """Test cases for the crop endpoint"""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the FastAPI app"""
        return TestClient(app)
    
    @pytest.fixture
    def sample_image_file(self):
        """Create a temporary image file for testing"""
        image = np.zeros((600, 800, 3), dtype=np.uint8)
        image = cv2.randu(image, 0, 255)
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            temp_path = f.name
        
        cv2.imwrite(temp_path, image)
        yield temp_path
        
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    
    def test_crop_endpoint_center_strategy(self, client, sample_image_file):
        """Test crop endpoint with center strategy"""
        request_data = {
            "image_path": sample_image_file,
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "center"
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "original_path" in data
        assert "processed_path" in data
        assert "crop_coordinates" in data
        assert "final_dimensions" in data
        assert "processing_time" in data
        
        # Verify crop coordinates are valid
        crop = data["crop_coordinates"]
        assert crop["x"] >= 0
        assert crop["y"] >= 0
        assert crop["width"] > 0
        assert crop["height"] > 0
        
        # Verify final dimensions match aspect ratio
        dims = data["final_dimensions"]
        aspect_ratio = dims["width"] / dims["height"]
        expected_ratio = 4 / 6
        assert abs(aspect_ratio - expected_ratio) < 0.1
    
    def test_crop_endpoint_with_detections(self, client, sample_image_file):
        """Test crop endpoint with face detections"""
        request_data = {
            "image_path": sample_image_file,
            "target_aspect_ratio": {"width": 1, "height": 1},
            "crop_strategy": "center_faces",
            "detection_results": [
                {
                    "type": "face",
                    "confidence": 0.9,
                    "bounding_box": {"x": 200, "y": 150, "width": 100, "height": 120}
                }
            ]
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert os.path.exists(data["processed_path"])
        
        # Verify the crop was influenced by face detection
        crop = data["crop_coordinates"]
        face_center_x = 200 + 100 // 2  # 250
        crop_center_x = crop["x"] + crop["width"] // 2
        
        # Should be reasonably close to face center
        assert abs(crop_center_x - face_center_x) < 200
    
    def test_crop_endpoint_preserve_all_strategy(self, client, sample_image_file):
        """Test crop endpoint with preserve all strategy"""
        request_data = {
            "image_path": sample_image_file,
            "target_aspect_ratio": {"width": 4, "height": 3},
            "crop_strategy": "preserve_all",
            "detection_results": [
                {
                    "type": "face",
                    "confidence": 0.8,
                    "bounding_box": {"x": 100, "y": 100, "width": 80, "height": 80}
                },
                {
                    "type": "person",
                    "confidence": 0.9,
                    "bounding_box": {"x": 300, "y": 200, "width": 150, "height": 250}
                }
            ]
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        crop = data["crop_coordinates"]
        
        # Should include both detections
        assert crop["x"] <= 100  # Include first face
        assert crop["x"] + crop["width"] >= 450  # Include person (300 + 150)
        assert crop["y"] <= 100  # Include face top
        assert crop["y"] + crop["height"] >= 450  # Include person bottom (200 + 250)
    
    def test_crop_endpoint_invalid_image_path(self, client):
        """Test crop endpoint with invalid image path"""
        request_data = {
            "image_path": "nonexistent_image.jpg",
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "center"
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 404
        
        data = response.json()
        assert data["error_code"] == "IMAGE_NOT_FOUND"
    
    def test_crop_endpoint_invalid_aspect_ratio(self, client, sample_image_file):
        """Test crop endpoint with invalid aspect ratio"""
        request_data = {
            "image_path": sample_image_file,
            "target_aspect_ratio": {"width": 0, "height": 6},
            "crop_strategy": "center"
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_crop_endpoint_invalid_strategy(self, client, sample_image_file):
        """Test crop endpoint with invalid crop strategy"""
        request_data = {
            "image_path": sample_image_file,
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "invalid_strategy"
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_crop_endpoint_with_output_path(self, client, sample_image_file):
        """Test crop endpoint with custom output path"""
        output_dir = tempfile.mkdtemp()
        output_path = os.path.join(output_dir, "custom_output.jpg")
        
        request_data = {
            "image_path": sample_image_file,
            "target_aspect_ratio": {"width": 1, "height": 1},
            "crop_strategy": "center",
            "output_path": output_path
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["processed_path"] == output_path
        assert os.path.exists(output_path)
        
        # Cleanup
        if os.path.exists(output_path):
            os.unlink(output_path)
        os.rmdir(output_dir)
    
    def test_crop_endpoint_square_to_landscape(self, client):
        """Test cropping square image to landscape aspect ratio"""
        # Create square image
        image = np.zeros((400, 400, 3), dtype=np.uint8)
        image = cv2.randu(image, 0, 255)
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            temp_path = f.name
        
        cv2.imwrite(temp_path, image)
        
        try:
            request_data = {
                "image_path": temp_path,
                "target_aspect_ratio": {"width": 16, "height": 9},
                "crop_strategy": "center"
            }
            
            response = client.post("/api/v1/crop", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            dims = data["final_dimensions"]
            
            # Should be landscape (wider than tall)
            assert dims["width"] > dims["height"]
            
            # Check aspect ratio
            aspect_ratio = dims["width"] / dims["height"]
            expected_ratio = 16 / 9
            assert abs(aspect_ratio - expected_ratio) < 0.1
            
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def test_crop_endpoint_performance(self, client, sample_image_file):
        """Test crop endpoint performance"""
        request_data = {
            "image_path": sample_image_file,
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "center"
        }
        
        response = client.post("/api/v1/crop", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        processing_time = data["processing_time"]
        
        # Should complete within reasonable time (5 seconds)
        assert processing_time < 5000
        assert processing_time > 0