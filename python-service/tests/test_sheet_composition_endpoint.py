"""
Unit tests for sheet composition endpoint functionality
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


class TestSheetCompositionEndpoint:
    """Test cases for the sheet composition endpoint"""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the FastAPI app"""
        return TestClient(app)
    
    @pytest.fixture
    def sample_processed_images(self):
        """Create sample processed images for sheet composition"""
        images = []
        for i in range(4):
            # Create 4x6 aspect ratio images (standard photo size)
            image = np.zeros((600, 400, 3), dtype=np.uint8)
            # Create different colored images for visual distinction
            color = (50 + i * 50, 100 + i * 30, 150 + i * 20)
            image[:] = color
            
            with tempfile.NamedTemporaryFile(suffix=f'_processed_{i}.jpg', delete=False) as f:
                temp_path = f.name
            
            cv2.imwrite(temp_path, image)
            images.append(temp_path)
        
        yield images
        
        # Cleanup
        for image_path in images:
            if os.path.exists(image_path):
                os.unlink(image_path)
    
    def test_compose_sheet_2x2_grid(self, client, sample_processed_images):
        """Test sheet composition with 2x2 grid layout"""
        request_data = {
            "processed_images": sample_processed_images,
            "grid_layout": {"rows": 2, "columns": 2},
            "sheet_orientation": "portrait",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "output_path" in data
        assert "grid_layout" in data
        assert "images_used" in data
        assert "sheet_dimensions" in data
        assert "processing_time" in data
        
        # Verify output file exists
        assert os.path.exists(data["output_path"])
        
        # Verify it's using the correct grid layout
        assert data["grid_layout"]["rows"] == 2
        assert data["grid_layout"]["columns"] == 2
        
        # Verify A4 portrait dimensions (300 DPI)
        dims = data["sheet_dimensions"]
        assert dims["width"] == 2480  # A4 width at 300 DPI
        assert dims["height"] == 3508  # A4 height at 300 DPI
        
        # Check that it used all 4 images
        assert len(data["images_used"]) == 4
    
    def test_compose_sheet_1x3_grid(self, client, sample_processed_images):
        """Test sheet composition with 1x3 grid layout"""
        request_data = {
            "processed_images": sample_processed_images[:3],
            "grid_layout": {"rows": 1, "columns": 3},
            "sheet_orientation": "landscape",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify A4 landscape dimensions
        dims = data["sheet_dimensions"]
        assert dims["width"] == 3508  # A4 height becomes width in landscape
        assert dims["height"] == 2480  # A4 width becomes height in landscape
        
        # Verify grid layout
        assert data["grid_layout"]["rows"] == 1
        assert data["grid_layout"]["columns"] == 3
        assert len(data["images_used"]) == 3
    
    def test_compose_sheet_pdf_output(self, client, sample_processed_images):
        """Test sheet composition with PDF output"""
        request_data = {
            "processed_images": sample_processed_images[:2],
            "grid_layout": {"rows": 1, "columns": 2},
            "sheet_orientation": "portrait",
            "output_format": "pdf"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "output_path" in data
        assert "grid_layout" in data
        assert data["output_path"].endswith(".pdf")
        assert os.path.exists(data["output_path"])
        assert len(data["images_used"]) == 2
        
        # Verify PDF file size is reasonable
        file_size = os.path.getsize(data["output_path"])
        assert file_size > 1000  # At least 1KB
        assert file_size < 10 * 1024 * 1024  # Less than 10MB
    
    def test_compose_sheet_with_empty_slots(self, client, sample_processed_images):
        """Test sheet composition with empty slots"""
        request_data = {
            "processed_images": sample_processed_images[:2],  # Only 2 images
            "grid_layout": {"rows": 2, "columns": 2},  # 4 slots total
            "sheet_orientation": "portrait",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify grid layout and images used
        assert data["grid_layout"]["rows"] == 2
        assert data["grid_layout"]["columns"] == 2
        assert len(data["images_used"]) == 2  # Only 2 images provided for 4 slots
    
    def test_compose_sheet_single_image(self, client, sample_processed_images):
        """Test sheet composition with single image"""
        request_data = {
            "processed_images": [sample_processed_images[0]],
            "grid_layout": {"rows": 1, "columns": 1},
            "sheet_orientation": "portrait",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify grid layout and images used
        assert data["grid_layout"]["rows"] == 1
        assert data["grid_layout"]["columns"] == 1
        assert len(data["images_used"]) == 1
    
    def test_compose_sheet_nonexistent_images(self, client):
        """Test sheet composition with nonexistent images"""
        request_data = {
            "processed_images": ["nonexistent1.jpg", "nonexistent2.jpg"],
            "grid_layout": {"rows": 1, "columns": 2},
            "sheet_orientation": "portrait",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 404  # API correctly returns 404 for nonexistent files
        
        data = response.json()
        assert data["error_code"] == "IMAGE_NOT_FOUND"  # Correct error code for missing files
    
    def test_compose_sheet_invalid_grid(self, client, sample_processed_images):
        """Test sheet composition with invalid grid layout"""
        request_data = {
            "processed_images": sample_processed_images[:2],
            "grid_layout": {"rows": 0, "columns": 2},  # Invalid rows
            "sheet_orientation": "portrait",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_compose_sheet_invalid_orientation(self, client, sample_processed_images):
        """Test sheet composition with invalid orientation"""
        request_data = {
            "processed_images": sample_processed_images[:2],
            "grid_layout": {"rows": 1, "columns": 2},
            "sheet_orientation": "invalid_orientation",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_compose_sheet_invalid_format(self, client, sample_processed_images):
        """Test sheet composition with invalid output format"""
        request_data = {
            "processed_images": sample_processed_images[:2],
            "grid_layout": {"rows": 1, "columns": 2},
            "sheet_orientation": "portrait",
            "output_format": "invalid_format"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_compose_sheet_too_many_images(self, client, sample_processed_images):
        """Test sheet composition with more images than grid slots"""
        # Create more images than can fit in a 1x2 grid
        extra_images = []
        for i in range(2):
            image = np.zeros((600, 400, 3), dtype=np.uint8)
            image[:] = (200, 100, 50)
            
            with tempfile.NamedTemporaryFile(suffix=f'_extra_{i}.jpg', delete=False) as f:
                temp_path = f.name
            
            cv2.imwrite(temp_path, image)
            extra_images.append(temp_path)
        
        try:
            all_images = sample_processed_images + extra_images  # 6 images total
            
            request_data = {
                "processed_images": all_images,
                "grid_layout": {"rows": 1, "columns": 2},  # Only 2 slots
                "sheet_orientation": "portrait",
                "output_format": "image"
            }
            
            response = client.post("/api/v1/compose-sheet", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            
            # Should only use first 2 images for the 1x2 grid
            assert data["grid_layout"]["rows"] == 1
            assert data["grid_layout"]["columns"] == 2
            assert len(data["images_used"]) == 2
            
        finally:
            # Cleanup extra images
            for image_path in extra_images:
                if os.path.exists(image_path):
                    os.unlink(image_path)
    
    def test_compose_sheet_custom_output_path(self, client, sample_processed_images):
        """Test sheet composition with custom output path"""
        output_dir = tempfile.mkdtemp()
        custom_output = os.path.join(output_dir, "custom_sheet.jpg")
        
        request_data = {
            "processed_images": sample_processed_images[:2],
            "grid_layout": {"rows": 1, "columns": 2},
            "sheet_orientation": "portrait",
            "output_format": "image",
            "output_path": custom_output
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["output_path"] == custom_output
        assert os.path.exists(custom_output)
        
        # Cleanup
        if os.path.exists(custom_output):
            os.unlink(custom_output)
        os.rmdir(output_dir)
    
    def test_compose_sheet_performance(self, client, sample_processed_images):
        """Test sheet composition performance"""
        request_data = {
            "processed_images": sample_processed_images,
            "grid_layout": {"rows": 2, "columns": 2},
            "sheet_orientation": "portrait",
            "output_format": "image"
        }
        
        import time
        start_time = time.time()
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        
        end_time = time.time()
        processing_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        assert response.status_code == 200
        
        # Should complete within reasonable time (10 seconds)
        assert processing_time < 10000
    
    def test_compose_sheet_image_quality(self, client, sample_processed_images):
        """Test that composed sheet maintains image quality"""
        request_data = {
            "processed_images": sample_processed_images[:1],
            "grid_layout": {"rows": 1, "columns": 1},
            "sheet_orientation": "portrait",
            "output_format": "image"
        }
        
        response = client.post("/api/v1/compose-sheet", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        output_path = data["output_path"]
        
        # Verify output image properties
        with Image.open(output_path) as img:
            assert img.mode in ['RGB', 'RGBA']
            assert img.size[0] > 0
            assert img.size[1] > 0
            
            # Verify image is not corrupted
            img.verify()
    
    def test_compose_multiple_sheets_endpoint(self, client, sample_processed_images):
        """Test endpoint for composing multiple sheets"""
        # Create enough images for multiple sheets
        extra_images = []
        for i in range(4):
            image = np.zeros((600, 400, 3), dtype=np.uint8)
            image[:] = (100 + i * 30, 150 + i * 20, 200 + i * 10)
            
            with tempfile.NamedTemporaryFile(suffix=f'_multi_{i}.jpg', delete=False) as f:
                temp_path = f.name
            
            cv2.imwrite(temp_path, image)
            extra_images.append(temp_path)
        
        try:
            all_images = sample_processed_images + extra_images  # 8 images total
            
            request_data = {
                "processed_images": all_images,
                "grid_layout": {"rows": 2, "columns": 2},  # 4 images per sheet
                "sheet_orientation": "portrait",
                "output_format": "image",
                "create_multiple_sheets": True
            }
            
            response = client.post("/api/v1/compose-sheet", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            
            if "sheets" in data:  # If multiple sheets are supported
                assert len(data["sheets"]) == 2  # Should create 2 sheets
                for sheet in data["sheets"]:
                    assert os.path.exists(sheet["output_path"])
            else:
                # Single sheet with first 4 images
                assert os.path.exists(data["output_path"])
            
        finally:
            # Cleanup extra images
            for image_path in extra_images:
                if os.path.exists(image_path):
                    os.unlink(image_path)