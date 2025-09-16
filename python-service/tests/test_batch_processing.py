"""
Unit tests for batch processing functionality
"""

import pytest
import tempfile
import os
import numpy as np
import cv2
from fastapi.testclient import TestClient
import sys
sys.path.append('..')

from main import app


class TestBatchProcessing:
    """Test cases for batch processing endpoint"""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the FastAPI app"""
        return TestClient(app)
    
    @pytest.fixture
    def sample_images(self):
        """Create multiple temporary image files for testing"""
        images = []
        for i in range(3):
            # Create images with different sizes
            height = 400 + i * 100
            width = 600 + i * 100
            image = np.zeros((height, width, 3), dtype=np.uint8)
            image = cv2.randu(image, 0, 255)
            
            with tempfile.NamedTemporaryFile(suffix=f'_test_{i}.jpg', delete=False) as f:
                temp_path = f.name
            
            cv2.imwrite(temp_path, image)
            images.append(temp_path)
        
        yield images
        
        # Cleanup
        for image_path in images:
            if os.path.exists(image_path):
                os.unlink(image_path)
    
    def test_batch_process_endpoint_success(self, client, sample_images):
        """Test successful batch processing"""
        request_data = {
            "images": sample_images,
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "center",
            "detection_types": ["face"]
        }
        
        response = client.post("/api/v1/process-batch", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "processed_images" in data
        assert "failed_images" in data
        assert "total_processing_time" in data  # API returns total_processing_time, not processing_time
        
        # Should process all images successfully
        assert len(data["processed_images"]) == 3
        assert len(data["failed_images"]) == 0
        
        # Verify each processed image
        for processed in data["processed_images"]:
            assert "original_path" in processed
            assert "processed_path" in processed
            assert "crop_coordinates" in processed
            assert "final_dimensions" in processed
            assert "processing_time" in processed
            assert os.path.exists(processed["processed_path"])
    
    def test_batch_process_with_mixed_results(self, client, sample_images):
        """Test batch processing with some failures"""
        # Add a non-existent image to the batch
        invalid_images = sample_images + ["nonexistent_image.jpg"]
        
        request_data = {
            "images": invalid_images,
            "target_aspect_ratio": {"width": 1, "height": 1},
            "crop_strategy": "center"
        }
        
        response = client.post("/api/v1/process-batch", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        
        # Should have 3 successful and 1 failed
        assert len(data["processed_images"]) == 3
        assert len(data["failed_images"]) == 1
        
        # Check failed image details
        failed = data["failed_images"][0]
        assert failed["path"] == "nonexistent_image.jpg"  # API returns "path", not "image_path"
        assert "error" in failed
        assert "error_code" in failed
    
    def test_batch_process_empty_list(self, client):
        """Test batch processing with empty image list"""
        request_data = {
            "images": [],
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "center"
        }
        
        response = client.post("/api/v1/process-batch", json=request_data)
        assert response.status_code == 400  # API returns 400 for empty list, not 422
    
    def test_batch_process_with_detections(self, client, sample_images):
        """Test batch processing with face detection enabled"""
        request_data = {
            "images": sample_images[:2],  # Process 2 images
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "center_faces",
            "detection_types": ["face", "person"],
            "confidence_threshold": 0.5
        }
        
        response = client.post("/api/v1/process-batch", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["processed_images"]) == 2
        
        # Each image should be processed successfully
        for processed in data["processed_images"]:
            assert "processed_path" in processed
            assert os.path.exists(processed["processed_path"])
            assert "processing_time" in processed
    
    def test_batch_process_different_aspect_ratios(self, client, sample_images):
        """Test batch processing with different target aspect ratios"""
        # Test multiple aspect ratios
        aspect_ratios = [
            {"width": 4, "height": 6},
            {"width": 1, "height": 1},
            {"width": 16, "height": 9}
        ]
        
        for aspect_ratio in aspect_ratios:
            request_data = {
                "images": [sample_images[0]],  # Use first image
                "target_aspect_ratio": aspect_ratio,
                "crop_strategy": "center"
            }
            
            response = client.post("/api/v1/process-batch", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            processed = data["processed_images"][0]
            dims = processed["final_dimensions"]
            
            # Verify aspect ratio
            actual_ratio = dims["width"] / dims["height"]
            expected_ratio = aspect_ratio["width"] / aspect_ratio["height"]
            assert abs(actual_ratio - expected_ratio) < 0.1
    
    def test_batch_process_statistics(self, client, sample_images):
        """Test batch processing statistics"""
        request_data = {
            "images": sample_images,
            "target_aspect_ratio": {"width": 4, "height": 6},
            "crop_strategy": "center",
            "detection_types": ["face"]
        }
        
        response = client.post("/api/v1/process-batch", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        
        # Basic statistics can be derived from the response
        total_images = len(data["processed_images"]) + len(data["failed_images"])
        assert total_images == len(sample_images)
        assert data["total_processing_time"] > 0
        
        # Verify successful processing
        assert len(data["processed_images"]) == 3
        assert len(data["failed_images"]) == 0
    
    def test_batch_process_large_batch(self, client):
        """Test batch processing with larger number of images"""
        # Create 10 small test images
        images = []
        for i in range(10):
            image = np.zeros((200, 300, 3), dtype=np.uint8)
            image = cv2.randu(image, 0, 255)
            
            with tempfile.NamedTemporaryFile(suffix=f'_batch_{i}.jpg', delete=False) as f:
                temp_path = f.name
            
            cv2.imwrite(temp_path, image)
            images.append(temp_path)
        
        try:
            request_data = {
                "images": images,
                "target_aspect_ratio": {"width": 1, "height": 1},
                "crop_strategy": "center"
            }
            
            response = client.post("/api/v1/process-batch", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert len(data["processed_images"]) == 10
            assert len(data["failed_images"]) == 0
            
            # Verify processing time is reasonable for batch
            assert data["total_processing_time"] < 30  # Less than 30 seconds
            
        finally:
            # Cleanup
            for image_path in images:
                if os.path.exists(image_path):
                    os.unlink(image_path)
    
    def test_batch_process_invalid_options(self, client, sample_images):
        """Test batch processing with invalid options"""
        request_data = {
            "images": sample_images[:1],
            "target_aspect_ratio": {"width": 0, "height": 6},  # Invalid
            "crop_strategy": "center"
        }
        
        response = client.post("/api/v1/process-batch", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_batch_process_concurrent_safety(self, client, sample_images):
        """Test that batch processing is safe for concurrent requests"""
        import threading
        import time
        
        results = []
        errors = []
        
        def process_batch():
            try:
                request_data = {
                    "images": [sample_images[0]],
                    "target_aspect_ratio": {"width": 4, "height": 6},
                    "crop_strategy": "center"
                }
                
                response = client.post("/api/v1/process-batch", json=request_data)
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # Start multiple threads
        threads = []
        for _ in range(3):
            thread = threading.Thread(target=process_batch)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        assert len(errors) == 0
        assert all(status == 200 for status in results)
        assert len(results) == 3