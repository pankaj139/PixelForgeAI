"""
Integration tests for the FastAPI detection service
"""

import pytest
import numpy as np
import cv2
import tempfile
import os
from fastapi.testclient import TestClient
import sys
sys.path.append('..')

from main import app
from models import DetectionType

class TestDetectionServiceIntegration:
    """Integration tests for the detection service API"""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the FastAPI app"""
        return TestClient(app)
    
    @pytest.fixture
    def sample_image_file(self):
        """Create a temporary image file for testing"""
        # Create a simple test image
        image = np.zeros((300, 300, 3), dtype=np.uint8)
        # Add some random content
        image = cv2.randu(image, 0, 255)
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            temp_path = f.name
        
        cv2.imwrite(temp_path, image)
        yield temp_path
        
        # Cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    
    def test_health_endpoint(self, client):
        """Test the health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "image-processing-service"
        assert "timestamp" in data
    
    def test_root_endpoint(self, client):
        """Test the root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert data["message"] == "Image Processing Service"
        assert data["version"] == "1.0.0"
    
    def test_detection_stats_endpoint(self, client):
        """Test the detection statistics endpoint"""
        response = client.get("/api/v1/detect/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert data["service"] == "Computer Vision Detection"
        assert "capabilities" in data
        assert "models" in data
        assert "confidence_thresholds" in data
        
        # Check capabilities
        capabilities = data["capabilities"]
        assert capabilities["face_detection"] is True
        assert capabilities["person_detection"] is True
        assert "supported_formats" in capabilities
        assert "max_image_size" in capabilities
    
    def test_detect_endpoint_with_valid_image(self, client, sample_image_file):
        """Test detection endpoint with a valid image file"""
        request_data = {
            "image_path": sample_image_file,
            "detection_types": ["face", "person"],
            "confidence_threshold": 0.5
        }
        
        response = client.post("/api/v1/detect", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "image_path" in data
        assert "detections" in data
        assert "processing_time" in data
        assert "image_dimensions" in data
        
        # Check that detections is a list (may be empty for random image)
        assert isinstance(data["detections"], list)
        assert data["processing_time"] > 0
        assert data["image_dimensions"]["width"] > 0
        assert data["image_dimensions"]["height"] > 0
    
    def test_detect_endpoint_with_nonexistent_image(self, client):
        """Test detection endpoint with nonexistent image file"""
        request_data = {
            "image_path": "nonexistent_file.jpg",
            "detection_types": ["face"],
            "confidence_threshold": 0.5
        }
        
        response = client.post("/api/v1/detect", json=request_data)
        # Should return 404 for nonexistent file
        assert response.status_code == 404
        
        data = response.json()
        # Should return error details
        assert data["error_code"] == "IMAGE_NOT_FOUND"
        assert "not found" in data["message"].lower()
    
    def test_detect_endpoint_face_only(self, client, sample_image_file):
        """Test detection endpoint with face detection only"""
        request_data = {
            "image_path": sample_image_file,
            "detection_types": ["face"],
            "confidence_threshold": 0.3
        }
        
        response = client.post("/api/v1/detect", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["detections"], list)
        
        # If there are detections, they should all be faces
        for detection in data["detections"]:
            assert detection["type"] == "face"
            assert 0.0 <= detection["confidence"] <= 1.0
            assert "bounding_box" in detection
    
    def test_detect_endpoint_person_only(self, client, sample_image_file):
        """Test detection endpoint with person detection only"""
        request_data = {
            "image_path": sample_image_file,
            "detection_types": ["person"],
            "confidence_threshold": 0.3
        }
        
        response = client.post("/api/v1/detect", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["detections"], list)
        
        # If there are detections, they should all be persons
        for detection in data["detections"]:
            assert detection["type"] == "person"
            assert 0.0 <= detection["confidence"] <= 1.0
            assert "bounding_box" in detection
    
    def test_detect_endpoint_invalid_request(self, client):
        """Test detection endpoint with invalid request data"""
        # Missing required fields
        request_data = {
            "detection_types": ["face"]
            # Missing image_path
        }
        
        response = client.post("/api/v1/detect", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_detect_endpoint_invalid_detection_type(self, client, sample_image_file):
        """Test detection endpoint with invalid detection type"""
        request_data = {
            "image_path": sample_image_file,
            "detection_types": ["invalid_type"],
            "confidence_threshold": 0.5
        }
        
        response = client.post("/api/v1/detect", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_detect_endpoint_confidence_threshold_validation(self, client, sample_image_file):
        """Test detection endpoint with invalid confidence threshold"""
        # Test confidence > 1.0
        request_data = {
            "image_path": sample_image_file,
            "detection_types": ["face"],
            "confidence_threshold": 1.5
        }
        
        response = client.post("/api/v1/detect", json=request_data)
        assert response.status_code == 422  # Validation error
        
        # Test negative confidence
        request_data["confidence_threshold"] = -0.1
        response = client.post("/api/v1/detect", json=request_data)
        assert response.status_code == 422  # Validation error