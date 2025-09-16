"""
Unit tests for detection processor functionality
"""

import pytest
import numpy as np
import cv2
import os
import tempfile
import time
from unittest.mock import Mock, patch, MagicMock
import sys
sys.path.append('..')

from detection.detection_processor import DetectionProcessor
from models import (
    DetectionResult, DetectionRequest, DetectionResponse, 
    DetectionType, BoundingBox
)

class TestDetectionProcessor:
    """Test cases for DetectionProcessor class"""
    
    @pytest.fixture
    def detection_processor(self):
        """Create a DetectionProcessor instance for testing"""
        return DetectionProcessor(face_confidence=0.5, person_confidence=0.5)
    
    @pytest.fixture
    def sample_image_path(self):
        """Create a temporary image file for testing"""
        # Create a simple test image
        image = np.zeros((300, 300, 3), dtype=np.uint8)
        image = cv2.randu(image, 0, 255)
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            temp_path = f.name
        
        cv2.imwrite(temp_path, image)
        yield temp_path
        
        # Cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    
    @pytest.fixture
    def sample_detections(self):
        """Create sample detection results for testing"""
        return [
            DetectionResult(
                type=DetectionType.FACE,
                confidence=0.8,
                bounding_box=BoundingBox(x=50, y=50, width=100, height=100)
            ),
            DetectionResult(
                type=DetectionType.FACE,
                confidence=0.6,
                bounding_box=BoundingBox(x=200, y=200, width=80, height=80)
            ),
            DetectionResult(
                type=DetectionType.PERSON,
                confidence=0.9,
                bounding_box=BoundingBox(x=100, y=100, width=120, height=200)
            )
        ]
    
    def test_detection_processor_initialization(self):
        """Test DetectionProcessor initialization"""
        processor = DetectionProcessor(face_confidence=0.3, person_confidence=0.7)
        assert processor.face_detector.min_confidence == 0.3
        assert processor.person_detector.min_confidence == 0.7
    
    def test_process_detection_request_nonexistent_file(self, detection_processor):
        """Test processing request with nonexistent image file"""
        request = DetectionRequest(
            image_path="nonexistent_file.jpg",
            detection_types=[DetectionType.FACE],
            confidence_threshold=0.5
        )
        
        response = detection_processor.process_detection_request(request)
        
        assert isinstance(response, DetectionResponse)
        assert response.image_path == "nonexistent_file.jpg"
        assert response.detections == []
        assert response.processing_time > 0
        assert response.image_dimensions == {"width": 0, "height": 0}
    
    @patch('cv2.imread')
    def test_process_detection_request_invalid_image(self, mock_imread, detection_processor, sample_image_path):
        """Test processing request with invalid image file"""
        mock_imread.return_value = None
        
        request = DetectionRequest(
            image_path=sample_image_path,
            detection_types=[DetectionType.FACE],
            confidence_threshold=0.5
        )
        
        response = detection_processor.process_detection_request(request)
        
        assert isinstance(response, DetectionResponse)
        assert response.detections == []
        assert response.image_dimensions == {"width": 0, "height": 0}
    
    @patch('detection.face_detector.FaceDetector.detect_faces')
    @patch('cv2.imread')
    def test_process_detection_request_face_only(self, mock_imread, mock_detect_faces, 
                                                detection_processor, sample_image_path):
        """Test processing request for face detection only"""
        # Mock image loading
        sample_image = np.zeros((300, 400, 3), dtype=np.uint8)
        mock_imread.return_value = sample_image
        
        # Mock face detection
        mock_face_detection = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=50, y=50, width=100, height=100)
        )
        mock_detect_faces.return_value = [mock_face_detection]
        
        request = DetectionRequest(
            image_path=sample_image_path,
            detection_types=[DetectionType.FACE],
            confidence_threshold=0.5
        )
        
        response = detection_processor.process_detection_request(request)
        
        assert isinstance(response, DetectionResponse)
        assert len(response.detections) == 1
        assert response.detections[0].type == DetectionType.FACE
        assert response.image_dimensions == {"width": 400, "height": 300}
        assert response.processing_time > 0
    
    @patch('detection.person_detector.PersonDetector.detect_persons')
    @patch('cv2.imread')
    def test_process_detection_request_person_only(self, mock_imread, mock_detect_persons,
                                                  detection_processor, sample_image_path):
        """Test processing request for person detection only"""
        # Mock image loading
        sample_image = np.zeros((300, 400, 3), dtype=np.uint8)
        mock_imread.return_value = sample_image
        
        # Mock person detection
        mock_person_detection = DetectionResult(
            type=DetectionType.PERSON,
            confidence=0.9,
            bounding_box=BoundingBox(x=100, y=50, width=120, height=200)
        )
        mock_detect_persons.return_value = [mock_person_detection]
        
        request = DetectionRequest(
            image_path=sample_image_path,
            detection_types=[DetectionType.PERSON],
            confidence_threshold=0.5
        )
        
        response = detection_processor.process_detection_request(request)
        
        assert isinstance(response, DetectionResponse)
        assert len(response.detections) == 1
        assert response.detections[0].type == DetectionType.PERSON
    
    @patch('detection.person_detector.PersonDetector.detect_persons')
    @patch('detection.face_detector.FaceDetector.detect_faces')
    @patch('cv2.imread')
    def test_process_detection_request_both_types(self, mock_imread, mock_detect_faces, 
                                                 mock_detect_persons, detection_processor, sample_image_path):
        """Test processing request for both face and person detection"""
        # Mock image loading
        sample_image = np.zeros((300, 400, 3), dtype=np.uint8)
        mock_imread.return_value = sample_image
        
        # Mock detections
        mock_face = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=50, y=50, width=80, height=80)
        )
        mock_person = DetectionResult(
            type=DetectionType.PERSON,
            confidence=0.9,
            bounding_box=BoundingBox(x=100, y=100, width=100, height=180)
        )
        
        mock_detect_faces.return_value = [mock_face]
        mock_detect_persons.return_value = [mock_person]
        
        request = DetectionRequest(
            image_path=sample_image_path,
            detection_types=[DetectionType.FACE, DetectionType.PERSON],
            confidence_threshold=0.5
        )
        
        response = detection_processor.process_detection_request(request)
        
        assert isinstance(response, DetectionResponse)
        assert len(response.detections) == 2
        
        # Check that both types are present
        detection_types = [d.type for d in response.detections]
        assert DetectionType.FACE in detection_types
        assert DetectionType.PERSON in detection_types
    
    def test_confidence_threshold_filtering(self, detection_processor, sample_image_path):
        """Test that detections below confidence threshold are filtered out"""
        with patch('cv2.imread') as mock_imread, \
             patch('detection.face_detector.FaceDetector.detect_faces') as mock_detect_faces:
            
            sample_image = np.zeros((300, 400, 3), dtype=np.uint8)
            mock_imread.return_value = sample_image
            
            # Mock detections with different confidence levels
            low_confidence = DetectionResult(
                type=DetectionType.FACE,
                confidence=0.3,  # Below threshold
                bounding_box=BoundingBox(x=50, y=50, width=80, height=80)
            )
            high_confidence = DetectionResult(
                type=DetectionType.FACE,
                confidence=0.8,  # Above threshold
                bounding_box=BoundingBox(x=150, y=150, width=80, height=80)
            )
            
            mock_detect_faces.return_value = [low_confidence, high_confidence]
            
            request = DetectionRequest(
                image_path=sample_image_path,
                detection_types=[DetectionType.FACE],
                confidence_threshold=0.5
            )
            
            response = detection_processor.process_detection_request(request)
            
            # Only high confidence detection should remain
            assert len(response.detections) == 1
            assert response.detections[0].confidence >= 0.5
    
    def test_remove_overlapping_detections_empty_list(self, detection_processor):
        """Test NMS with empty detection list"""
        result = detection_processor._remove_overlapping_detections([])
        assert result == []
    
    def test_remove_overlapping_detections_single_detection(self, detection_processor):
        """Test NMS with single detection"""
        detection = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=50, y=50, width=100, height=100)
        )
        
        result = detection_processor._remove_overlapping_detections([detection])
        assert len(result) == 1
        assert result[0] == detection
    
    @patch('cv2.dnn.NMSBoxes')
    def test_remove_overlapping_detections_multiple(self, mock_nms, detection_processor, sample_detections):
        """Test NMS with multiple overlapping detections"""
        # Mock NMS to return indices of non-overlapping detections
        mock_nms.return_value = np.array([0, 2])  # Keep first face and person
        
        result = detection_processor._remove_overlapping_detections(sample_detections)
        
        # Should have called NMS for faces (2 detections) and persons (1 detection)
        assert mock_nms.call_count >= 1
        assert isinstance(result, list)
    
    def test_calculate_detection_center(self, detection_processor):
        """Test calculation of detection center point"""
        detection = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=50, y=100, width=80, height=60)
        )
        
        center_x, center_y = detection_processor.calculate_detection_center(detection)
        
        assert center_x == 50 + 80 // 2  # 90
        assert center_y == 100 + 60 // 2  # 130
    
    def test_calculate_detection_area(self, detection_processor):
        """Test calculation of detection area"""
        detection = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=50, y=100, width=80, height=60)
        )
        
        area = detection_processor.calculate_detection_area(detection)
        assert area == 80 * 60  # 4800
    
    def test_get_detection_bounds_empty_list(self, detection_processor):
        """Test getting bounds of empty detection list"""
        bounds = detection_processor.get_detection_bounds([])
        assert bounds is None
    
    def test_get_detection_bounds_single_detection(self, detection_processor):
        """Test getting bounds of single detection"""
        detection = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=50, y=100, width=80, height=60)
        )
        
        bounds = detection_processor.get_detection_bounds([detection])
        
        assert bounds.x == 50
        assert bounds.y == 100
        assert bounds.width == 80
        assert bounds.height == 60
    
    def test_get_detection_bounds_multiple_detections(self, detection_processor, sample_detections):
        """Test getting bounds encompassing multiple detections"""
        bounds = detection_processor.get_detection_bounds(sample_detections)
        
        # Should encompass all detections
        assert bounds.x == 50  # Minimum x
        assert bounds.y == 50  # Minimum y
        # Width should be from min_x to max_x
        # Height should be from min_y to max_y
        assert bounds.width > 0
        assert bounds.height > 0
    
    def test_filter_detections_by_area(self, detection_processor, sample_detections):
        """Test filtering detections by area"""
        # Filter by minimum area
        filtered = detection_processor.filter_detections_by_area(
            sample_detections, min_area=5000
        )
        
        # Check that all returned detections meet the area requirement
        for detection in filtered:
            area = detection_processor.calculate_detection_area(detection)
            assert area >= 5000
    
    def test_filter_detections_by_area_with_max(self, detection_processor, sample_detections):
        """Test filtering detections by area with maximum limit"""
        filtered = detection_processor.filter_detections_by_area(
            sample_detections, min_area=1000, max_area=15000
        )
        
        # Check that all returned detections are within the area range
        for detection in filtered:
            area = detection_processor.calculate_detection_area(detection)
            assert 1000 <= area <= 15000
    
    def test_sort_detections_by_confidence(self, detection_processor, sample_detections):
        """Test sorting detections by confidence"""
        sorted_detections = detection_processor.sort_detections_by_confidence(sample_detections)
        
        # Should be sorted in descending order by default
        confidences = [d.confidence for d in sorted_detections]
        assert confidences == sorted(confidences, reverse=True)
    
    def test_sort_detections_by_confidence_ascending(self, detection_processor, sample_detections):
        """Test sorting detections by confidence in ascending order"""
        sorted_detections = detection_processor.sort_detections_by_confidence(
            sample_detections, reverse=False
        )
        
        # Should be sorted in ascending order
        confidences = [d.confidence for d in sorted_detections]
        assert confidences == sorted(confidences, reverse=False)
    
    def test_sort_detections_by_size(self, detection_processor, sample_detections):
        """Test sorting detections by size"""
        sorted_detections = detection_processor.sort_detections_by_size(sample_detections)
        
        # Should be sorted in descending order by area
        areas = [detection_processor.calculate_detection_area(d) for d in sorted_detections]
        assert areas == sorted(areas, reverse=True)
    
    def test_get_detection_statistics_empty_list(self, detection_processor):
        """Test getting statistics for empty detection list"""
        stats = detection_processor.get_detection_statistics([])
        
        expected_stats = {
            "total_count": 0,
            "face_count": 0,
            "person_count": 0,
            "avg_confidence": 0.0,
            "max_confidence": 0.0,
            "min_confidence": 0.0,
            "avg_area": 0,
            "total_area": 0
        }
        
        assert stats == expected_stats
    
    def test_get_detection_statistics_with_detections(self, detection_processor, sample_detections):
        """Test getting statistics for detection list"""
        stats = detection_processor.get_detection_statistics(sample_detections)
        
        assert stats["total_count"] == 3
        assert stats["face_count"] == 2
        assert stats["person_count"] == 1
        assert 0.0 <= stats["avg_confidence"] <= 1.0
        assert 0.0 <= stats["max_confidence"] <= 1.0
        assert 0.0 <= stats["min_confidence"] <= 1.0
        assert stats["avg_area"] > 0
        assert stats["total_area"] > 0
        
        # Check that max >= avg >= min for confidence
        assert stats["max_confidence"] >= stats["avg_confidence"] >= stats["min_confidence"]
    
    def test_apply_nms_empty_list(self, detection_processor):
        """Test NMS with empty list"""
        result = detection_processor._apply_nms([])
        assert result == []
    
    def test_apply_nms_single_detection(self, detection_processor):
        """Test NMS with single detection"""
        detection = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=50, y=50, width=100, height=100)
        )
        
        result = detection_processor._apply_nms([detection])
        assert len(result) == 1
        assert result[0] == detection
    
    @patch('cv2.dnn.NMSBoxes')
    def test_apply_nms_multiple_detections(self, mock_nms, detection_processor):
        """Test NMS with multiple detections"""
        detections = [
            DetectionResult(
                type=DetectionType.FACE,
                confidence=0.8,
                bounding_box=BoundingBox(x=50, y=50, width=100, height=100)
            ),
            DetectionResult(
                type=DetectionType.FACE,
                confidence=0.6,
                bounding_box=BoundingBox(x=60, y=60, width=90, height=90)
            )
        ]
        
        # Mock NMS to return first detection only
        mock_nms.return_value = np.array([0])
        
        result = detection_processor._apply_nms(detections)
        
        mock_nms.assert_called_once()
        assert len(result) == 1
        assert result[0] == detections[0]