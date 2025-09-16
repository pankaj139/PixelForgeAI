"""
Performance tests for the Python image processing service
"""

import pytest
import time
import tempfile
import os
import numpy as np
import cv2
import threading
import concurrent.futures
from fastapi.testclient import TestClient
import sys
sys.path.append('..')

from main import app


class TestPerformance:
    """Performance test cases for the image processing service"""
    
    @pytest.fixture
    def client(self):
        """Create a test client for the FastAPI app"""
        return TestClient(app)
    
    @pytest.fixture
    def performance_images(self):
        """Create multiple test images for performance testing"""
        images = []
        sizes = [
            (400, 300),   # Small
            (800, 600),   # Medium
            (1200, 900),  # Large
            (1600, 1200), # Extra large
        ]
        
        for i, (width, height) in enumerate(sizes):
            # Create images with different sizes
            image = np.zeros((height, width, 3), dtype=np.uint8)
            image = cv2.randu(image, 0, 255)
            
            with tempfile.NamedTemporaryFile(suffix=f'_perf_{i}.jpg', delete=False) as f:
                temp_path = f.name
            
            cv2.imwrite(temp_path, image)
            images.append(temp_path)
        
        yield images
        
        # Cleanup
        for image_path in images:
            if os.path.exists(image_path):
                os.unlink(image_path)
    
    @pytest.fixture
    def large_batch_images(self):
        """Create a large batch of test images"""
        images = []
        
        for i in range(20):  # Create 20 images
            image = np.zeros((600, 800, 3), dtype=np.uint8)
            # Create varied content
            image = cv2.randu(image, 0, 255)
            
            with tempfile.NamedTemporaryFile(suffix=f'_batch_{i}.jpg', delete=False) as f:
                temp_path = f.name
            
            cv2.imwrite(temp_path, image)
            images.append(temp_path)
        
        yield images
        
        # Cleanup
        for image_path in images:
            if os.path.exists(image_path):
                os.unlink(image_path)

    def test_detection_performance_single_image(self, client, performance_images):
        """Test detection performance on single images of different sizes"""
        results = []
        
        for image_path in performance_images:
            request_data = {
                "image_path": image_path,
                "detection_types": ["face", "person"],
                "confidence_threshold": 0.5
            }
            
            start_time = time.time()
            response = client.post("/api/v1/detect", json=request_data)
            end_time = time.time()
            
            processing_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            assert response.status_code == 200
            data = response.json()
            
            results.append({
                "image_path": image_path,
                "processing_time_ms": processing_time,
                "service_processing_time_ms": data["processing_time"],
                "image_dimensions": data["image_dimensions"]
            })
        
        # Verify performance benchmarks
        for result in results:
            # Total processing time should be reasonable (< 5 seconds)
            assert result["processing_time_ms"] < 5000
            
            # Service processing time should be reasonable (< 3 seconds)
            assert result["service_processing_time_ms"] < 3000
            
            print(f"Image {result['image_dimensions']}: "
                  f"Total: {result['processing_time_ms']:.1f}ms, "
                  f"Service: {result['service_processing_time_ms']:.1f}ms")
    
    def test_crop_performance_different_sizes(self, client, performance_images):
        """Test cropping performance on images of different sizes"""
        results = []
        
        for image_path in performance_images:
            request_data = {
                "image_path": image_path,
                "target_aspect_ratio": {"width": 4, "height": 6},
                "crop_strategy": "center"
            }
            
            start_time = time.time()
            response = client.post("/api/v1/crop", json=request_data)
            end_time = time.time()
            
            processing_time = (end_time - start_time) * 1000
            
            assert response.status_code == 200
            data = response.json()
            
            results.append({
                "image_path": image_path,
                "processing_time_ms": processing_time,
                "service_processing_time_ms": data["processing_time"]
            })
        
        # Verify performance scales reasonably with image size
        for result in results:
            assert result["processing_time_ms"] < 3000  # < 3 seconds
            assert result["service_processing_time_ms"] < 2000  # < 2 seconds
            
            print(f"Crop processing: "
                  f"Total: {result['processing_time_ms']:.1f}ms, "
                  f"Service: {result['service_processing_time_ms']:.1f}ms")
    
    def test_batch_processing_performance(self, client, large_batch_images):
        """Test batch processing performance with large number of images"""
        batch_sizes = [5, 10, 15, 20]
        results = []
        
        for batch_size in batch_sizes:
            images_subset = large_batch_images[:batch_size]
            
            request_data = {
                "images": images_subset,
                "target_aspect_ratio": {"width": 4, "height": 6},
                "crop_strategy": "center",
                "detection_types": ["face"]
            }
            
            start_time = time.time()
            response = client.post("/api/v1/process-batch", json=request_data)
            end_time = time.time()
            
            total_time = (end_time - start_time) * 1000
            
            assert response.status_code == 200
            data = response.json()
            
            results.append({
                "batch_size": batch_size,
                "total_time_ms": total_time,
                "service_time_ms": data["total_processing_time"] * 1000,  # Convert to ms
                "avg_time_per_image_ms": (data["total_processing_time"] * 1000) / batch_size,
                "successful_images": len(data["processed_images"])
            })
        
        # Verify batch processing efficiency
        for result in results:
            # All images should be processed successfully
            assert result["successful_images"] == result["batch_size"]
            
            # Average time per image should be reasonable
            assert result["avg_time_per_image_ms"] < 2000  # < 2 seconds per image
            
            # Total batch time should scale reasonably
            expected_max_time = result["batch_size"] * 3000  # 3 seconds per image max
            assert result["total_time_ms"] < expected_max_time
            
            print(f"Batch size {result['batch_size']}: "
                  f"Total: {result['total_time_ms']:.1f}ms, "
                  f"Avg per image: {result['avg_time_per_image_ms']:.1f}ms")
        
        # Verify batch processing is more efficient than individual processing
        if len(results) >= 2:
            # Compare batch of 10 vs batch of 5 (should be less than 2x time)
            batch_5_result = next(r for r in results if r["batch_size"] == 5)
            batch_10_result = next(r for r in results if r["batch_size"] == 10)
            
            efficiency_ratio = batch_10_result["total_time_ms"] / batch_5_result["total_time_ms"]
            assert efficiency_ratio < 2.5  # Should be less than 2.5x time for 2x images
    
    def test_concurrent_requests_performance(self, client, performance_images):
        """Test performance under concurrent load"""
        num_concurrent_requests = 5
        results = []
        errors = []
        
        def make_request(image_path, request_id):
            try:
                request_data = {
                    "image_path": image_path,
                    "detection_types": ["face"],
                    "confidence_threshold": 0.5
                }
                
                start_time = time.time()
                response = client.post("/api/v1/detect", json=request_data)
                end_time = time.time()
                
                processing_time = (end_time - start_time) * 1000
                
                if response.status_code == 200:
                    results.append({
                        "request_id": request_id,
                        "processing_time_ms": processing_time,
                        "status_code": response.status_code
                    })
                else:
                    errors.append({
                        "request_id": request_id,
                        "status_code": response.status_code,
                        "error": response.text
                    })
                    
            except Exception as e:
                errors.append({
                    "request_id": request_id,
                    "error": str(e)
                })
        
        # Use ThreadPoolExecutor for concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent_requests) as executor:
            futures = []
            
            for i in range(num_concurrent_requests):
                image_path = performance_images[i % len(performance_images)]
                future = executor.submit(make_request, image_path, i)
                futures.append(future)
            
            # Wait for all requests to complete
            concurrent.futures.wait(futures)
        
        # Verify concurrent performance
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == num_concurrent_requests
        
        # All requests should complete within reasonable time
        for result in results:
            assert result["processing_time_ms"] < 10000  # < 10 seconds under load
            assert result["status_code"] == 200
        
        # Calculate statistics
        processing_times = [r["processing_time_ms"] for r in results]
        avg_time = sum(processing_times) / len(processing_times)
        max_time = max(processing_times)
        min_time = min(processing_times)
        
        print(f"Concurrent requests - Avg: {avg_time:.1f}ms, "
              f"Min: {min_time:.1f}ms, Max: {max_time:.1f}ms")
        
        # Performance should not degrade too much under concurrent load
        assert max_time < avg_time * 3  # Max time shouldn't be more than 3x average
    
    def test_sheet_composition_performance(self, client, performance_images):
        """Test sheet composition performance"""
        # Create processed images for composition
        processed_images = []
        
        for i, image_path in enumerate(performance_images):
            # Create a processed version
            processed_path = image_path.replace('.jpg', '_processed.jpg')
            
            # Copy original to processed (simulate processing)
            image = cv2.imread(image_path)
            cv2.imwrite(processed_path, image)
            processed_images.append(processed_path)
        
        try:
            grid_layouts = [
                {"rows": 1, "columns": 2},
                {"rows": 2, "columns": 2},
                {"rows": 1, "columns": 4}
            ]
            
            results = []
            
            for grid_layout in grid_layouts:
                # Use appropriate number of images for each grid layout
                max_images = grid_layout["rows"] * grid_layout["columns"]
                images_for_layout = processed_images[:max_images]
                
                request_data = {
                    "processed_images": images_for_layout,
                    "grid_layout": grid_layout,
                    "sheet_orientation": "portrait",
                    "output_format": "image"
                }
                
                start_time = time.time()
                response = client.post("/api/v1/compose-sheet", json=request_data)
                end_time = time.time()
                
                processing_time = (end_time - start_time) * 1000
                
                assert response.status_code == 200
                data = response.json()
                
                results.append({
                    "grid_layout": f"{grid_layout['rows']}x{grid_layout['columns']}",
                    "processing_time_ms": processing_time,
                    "output_path": data["output_path"]
                })
            
            # Verify sheet composition performance
            for result in results:
                assert result["processing_time_ms"] < 5000  # < 5 seconds
                assert os.path.exists(result["output_path"])
                
                print(f"Sheet composition {result['grid_layout']}: "
                      f"{result['processing_time_ms']:.1f}ms")
        
        finally:
            # Cleanup processed images
            for processed_path in processed_images:
                if os.path.exists(processed_path):
                    os.unlink(processed_path)
    
    def test_memory_usage_stability(self, client, large_batch_images):
        """Test that memory usage remains stable during processing"""
        import psutil
        import gc
        
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Process multiple batches to test memory stability
        for batch_num in range(3):
            batch_images = large_batch_images[batch_num * 5:(batch_num + 1) * 5]
            
            request_data = {
                "images": batch_images,
                "target_aspect_ratio": {"width": 4, "height": 6},
                "crop_strategy": "center"
            }
            
            response = client.post("/api/v1/process-batch", json=request_data)
            assert response.status_code == 200
            
            # Force garbage collection
            gc.collect()
            
            current_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_increase = current_memory - initial_memory
            
            print(f"Batch {batch_num + 1}: Memory usage: {current_memory:.1f}MB "
                  f"(+{memory_increase:.1f}MB from start)")
            
            # Memory increase should be reasonable (< 500MB)
            assert memory_increase < 500, f"Memory usage increased by {memory_increase:.1f}MB"
    
    def test_error_handling_performance(self, client):
        """Test that error handling doesn't significantly impact performance"""
        # Test with non-existent images
        non_existent_images = [f"nonexistent_{i}.jpg" for i in range(10)]
        
        start_time = time.time()
        
        for image_path in non_existent_images:
            request_data = {
                "image_path": image_path,
                "detection_types": ["face"],
                "confidence_threshold": 0.5
            }
            
            response = client.post("/api/v1/detect", json=request_data)
            assert response.status_code == 404  # Should return 404 quickly
        
        end_time = time.time()
        total_time = (end_time - start_time) * 1000
        avg_error_time = total_time / len(non_existent_images)
        
        print(f"Average error handling time: {avg_error_time:.1f}ms")
        
        # Error handling should be fast (< 100ms per error)
        assert avg_error_time < 100
    
    def test_throughput_measurement(self, client, performance_images):
        """Measure overall service throughput"""
        num_requests = 20
        start_time = time.time()
        
        successful_requests = 0
        
        for i in range(num_requests):
            image_path = performance_images[i % len(performance_images)]
            
            request_data = {
                "image_path": image_path,
                "detection_types": ["face"],
                "confidence_threshold": 0.5
            }
            
            response = client.post("/api/v1/detect", json=request_data)
            if response.status_code == 200:
                successful_requests += 1
        
        end_time = time.time()
        total_time = end_time - start_time
        
        throughput = successful_requests / total_time  # requests per second
        
        print(f"Throughput: {throughput:.2f} requests/second "
              f"({successful_requests}/{num_requests} successful)")
        
        # Should handle at least 1 request per second
        assert throughput >= 1.0
        assert successful_requests == num_requests