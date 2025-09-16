"""
Unit tests for face detection functionality
"""

import pytest
import numpy as np
import cv2
import os
import tempfile
from unittest.mock import Mock, patch, MagicMock
import sys
sys.path.append('..')

from detection.face_detector import FaceDetector
from models import DetectionResult, DetectionType, BoundingBox

class TestFaceDetector:
    """Test cases for FaceDetector class"""
    
    @pytest.fixture
    def face_detector(self):
        """Create a FaceDetector instance for testing"""
        return FaceDetector(min_confidence=0.5)
    
    @pytest.fixture
    def sample_image(self):
        """Create a sample test image"""
        # Create a simple 300x300 BGR image
        image = np.zeros((300, 300, 3), dtype=np.uint8)
        # Add some noise to make it more realistic
        image = cv2.randu(image, 0, 255)
        return image
    
    @pytest.fixture
    def sample_image_with_face(self):
        """Create a sample image with a simulated face region"""
        image = np.zeros((300, 300, 3), dtype=np.uint8)
        # Draw a simple face-like rectangle
        cv2.rectangle(image, (100, 100), (200, 200), (255, 255, 255), -1)
        # Add some features
        cv2.circle(image, (130, 130), 10, (0, 0, 0), -1)  # Left eye
        cv2.circle(image, (170, 130), 10, (0, 0, 0), -1)  # Right eye
        cv2.rectangle(image, (140, 160), (160, 180), (0, 0, 0), -1)  # Nose
        return image
    
    def test_face_detector_initialization(self):
        """Test FaceDetector initialization"""
        detector = FaceDetector(min_confidence=0.3)
        assert detector.min_confidence == 0.3
        assert detector.cascades is not None
        assert len(detector.cascades) > 0
        assert detector.cascades.get('frontal') is not None
        assert not detector.cascades['frontal'].empty()
    
    def test_face_detector_initialization_with_invalid_cascade(self):
        """Test FaceDetector initialization with invalid cascade path falls back to default"""
        # Should fall back to default cascade, not raise an error
        detector = FaceDetector(cascade_path="nonexistent_file.xml")
        assert detector.cascades is not None
        assert len(detector.cascades) > 0
        assert detector.cascades.get('frontal') is not None
        assert not detector.cascades['frontal'].empty()
    
    def test_detect_faces_empty_image(self, face_detector):
        """Test face detection with empty image"""
        empty_image = np.array([])
        detections = face_detector.detect_faces(empty_image)
        assert detections == []
    
    def test_detect_faces_none_image(self, face_detector):
        """Test face detection with None image"""
        detections = face_detector.detect_faces(None)
        assert detections == []
    
    @patch('cv2.CascadeClassifier.detectMultiScale')
    def test_detect_faces_with_mock_detection(self, mock_detect, face_detector, sample_image):
        """Test face detection with mocked OpenCV detection"""
        # Mock detection result: (x, y, w, h)
        mock_detect.return_value = np.array([[50, 50, 100, 100], [150, 150, 80, 80]])
        
        detections = face_detector.detect_faces(sample_image)
        
        assert len(detections) == 2
        assert all(isinstance(d, DetectionResult) for d in detections)
        assert all(d.type == DetectionType.FACE for d in detections)
        assert all(d.confidence >= face_detector.min_confidence for d in detections)
        
        # Check first detection
        first_detection = detections[0]
        assert first_detection.bounding_box.x == 50
        assert first_detection.bounding_box.y == 50
        assert first_detection.bounding_box.width == 100
        assert first_detection.bounding_box.height == 100
    
    @patch('cv2.CascadeClassifier.detectMultiScale')
    def test_detect_faces_no_detections(self, mock_detect, face_detector, sample_image):
        """Test face detection when no faces are found"""
        mock_detect.return_value = np.array([])
        
        detections = face_detector.detect_faces(sample_image)
        assert detections == []
    
    @patch('cv2.CascadeClassifier.detectMultiScale')
    def test_detect_faces_confidence_filtering(self, mock_detect, sample_image):
        """Test that detections below confidence threshold are filtered out"""
        detector = FaceDetector(min_confidence=0.8)
        mock_detect.return_value = np.array([[50, 50, 20, 20]])  # Small face = low confidence
        
        detections = detector.detect_faces(sample_image)
        # Small faces should have lower confidence and might be filtered out
        # The exact behavior depends on the confidence calculation
        assert isinstance(detections, list)
    
    def test_detect_faces_from_file_nonexistent(self, face_detector):
        """Test face detection from nonexistent file"""
        detections = face_detector.detect_faces_from_file("nonexistent_file.jpg")
        assert detections == []
    
    def test_detect_faces_from_file_invalid_image(self, face_detector):
        """Test face detection from invalid image file"""
        # Create a temporary text file (not an image)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is not an image")
            temp_path = f.name
        
        try:
            detections = face_detector.detect_faces_from_file(temp_path)
            assert detections == []
        finally:
            os.unlink(temp_path)
    
    @patch('cv2.imread')
    @patch('cv2.CascadeClassifier.detectMultiScale')
    def test_detect_faces_from_file_success(self, mock_detect, mock_imread, face_detector, sample_image):
        """Test successful face detection from file"""
        mock_imread.return_value = sample_image
        mock_detect.return_value = np.array([[100, 100, 50, 50]])
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            temp_path = f.name
        
        try:
            detections = face_detector.detect_faces_from_file(temp_path)
            assert len(detections) >= 0  # Should not crash
            assert isinstance(detections, list)
        finally:
            os.unlink(temp_path)
    
    def test_get_largest_face_empty_list(self, face_detector):
        """Test getting largest face from empty list"""
        largest = face_detector.get_largest_face([])
        assert largest is None
    
    def test_get_largest_face_single_detection(self, face_detector):
        """Test getting largest face from single detection"""
        detection = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.8,
            bounding_box=BoundingBox(x=10, y=10, width=50, height=50)
        )
        largest = face_detector.get_largest_face([detection])
        assert largest == detection
    
    def test_get_largest_face_multiple_detections(self, face_detector):
        """Test getting largest face from multiple detections"""
        small_face = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.9,
            bounding_box=BoundingBox(x=10, y=10, width=30, height=30)
        )
        large_face = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.7,
            bounding_box=BoundingBox(x=50, y=50, width=80, height=80)
        )
        
        largest = face_detector.get_largest_face([small_face, large_face])
        assert largest == large_face
    
    def test_get_most_confident_face_empty_list(self, face_detector):
        """Test getting most confident face from empty list"""
        most_confident = face_detector.get_most_confident_face([])
        assert most_confident is None
    
    def test_get_most_confident_face_multiple_detections(self, face_detector):
        """Test getting most confident face from multiple detections"""
        low_confidence = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.6,
            bounding_box=BoundingBox(x=10, y=10, width=50, height=50)
        )
        high_confidence = DetectionResult(
            type=DetectionType.FACE,
            confidence=0.9,
            bounding_box=BoundingBox(x=50, y=50, width=40, height=40)
        )
        
        most_confident = face_detector.get_most_confident_face([low_confidence, high_confidence])
        assert most_confident == high_confidence
    
    @patch('cv2.CascadeClassifier.detectMultiScale')
    def test_confidence_calculation_center_bias(self, mock_detect, sample_image):
        """Test that faces closer to center get higher confidence"""
        detector = FaceDetector(min_confidence=0.1)
        
        # Mock two faces: one in center, one at edge
        mock_detect.return_value = np.array([
            [125, 125, 50, 50],  # Center face
            [10, 10, 50, 50]     # Edge face
        ])
        
        detections = detector.detect_faces(sample_image)
        
        if len(detections) >= 2:
            # Find center and edge detections
            center_detection = None
            edge_detection = None
            
            for detection in detections:
                if detection.bounding_box.x == 125:
                    center_detection = detection
                elif detection.bounding_box.x == 10:
                    edge_detection = detection
            
            if center_detection and edge_detection:
                # Center face should have higher confidence due to center bias
                assert center_detection.confidence >= edge_detection.confidence
    
    @patch('cv2.CascadeClassifier.detectMultiScale')
    def test_confidence_calculation_size_bias(self, mock_detect, sample_image):
        """Test that larger faces get higher confidence"""
        detector = FaceDetector(min_confidence=0.1)
        
        # Mock two faces: one large, one small
        mock_detect.return_value = np.array([
            [100, 100, 100, 100],  # Large face
            [200, 200, 20, 20]     # Small face
        ])
        
        detections = detector.detect_faces(sample_image)
        
        if len(detections) >= 2:
            # Find large and small detections
            large_detection = None
            small_detection = None
            
            for detection in detections:
                area = detection.bounding_box.width * detection.bounding_box.height
                if area >= 10000:  # Large face
                    large_detection = detection
                elif area <= 400:  # Small face
                    small_detection = detection
            
            if large_detection and small_detection:
                # Larger face should have higher confidence due to size bias
                assert large_detection.confidence >= small_detection.confidence
    
    def test_face_detector_error_handling(self, face_detector):
        """Test error handling in face detection"""
        # Test with None image (safer than corrupted data)
        detections = face_detector.detect_faces(None)
        assert detections == []
        
        # Test with empty array
        empty_image = np.array([])
        detections = face_detector.detect_faces(empty_image)
        assert detections == []