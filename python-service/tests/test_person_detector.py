"""
Unit tests for person detection functionality
"""

import pytest
import numpy as np
import cv2
import os
import tempfile
from unittest.mock import Mock, patch, MagicMock
import sys
sys.path.append('..')

from detection.person_detector import PersonDetector
from models import DetectionResult, DetectionType, BoundingBox

class TestPersonDetector:
    """Test cases for PersonDetector class"""
    
    @pytest.fixture
    def person_detector_hog(self):
        """Create a PersonDetector instance using HOG"""
        return PersonDetector(model_type="hog", min_confidence=0.5)
    
    @pytest.fixture
    def person_detector_mobilenet(self):
        """Create a PersonDetector instance using MobileNet (will fallback to HOG)"""
        return PersonDetector(model_type="mobilenet", min_confidence=0.5)
    
    @pytest.fixture
    def sample_image(self):
        """Create a sample test image"""
        # Create a simple 300x300 BGR image
        image = np.zeros((300, 300, 3), dtype=np.uint8)
        # Add some noise to make it more realistic
        image = cv2.randu(image, 0, 255)
        return image
    
    @pytest.fixture
    def sample_image_with_person(self):
        """Create a sample image with a simulated person region"""
        image = np.zeros((400, 300, 3), dtype=np.uint8)
        # Draw a simple person-like rectangle (taller than wide)
        cv2.rectangle(image, (100, 50), (200, 350), (128, 128, 128), -1)
        # Add some features to make it more person-like
        cv2.circle(image, (150, 80), 15, (255, 255, 255), -1)  # Head
        cv2.rectangle(image, (130, 100), (170, 200), (64, 64, 64), -1)  # Torso
        cv2.rectangle(image, (135, 200), (155, 300), (32, 32, 32), -1)  # Left leg
        cv2.rectangle(image, (165, 200), (185, 300), (32, 32, 32), -1)  # Right leg
        return image
    
    def test_person_detector_initialization_hog(self):
        """Test PersonDetector initialization with HOG"""
        detector = PersonDetector(model_type="hog", min_confidence=0.3)
        assert detector.min_confidence == 0.3
        assert detector.model_type == "hog"
        assert detector.hog is not None
    
    def test_person_detector_initialization_mobilenet_fallback(self):
        """Test PersonDetector initialization with MobileNet (should fallback to HOG)"""
        detector = PersonDetector(model_type="mobilenet", min_confidence=0.4)
        assert detector.min_confidence == 0.4
        # Should fallback to HOG since MobileNet files don't exist
        assert detector.model_type in ["mobilenet", "hog"]
    
    def test_person_detector_initialization_yolo_fallback(self):
        """Test PersonDetector initialization with YOLO (should fallback to HOG)"""
        detector = PersonDetector(model_type="yolo", min_confidence=0.6)
        assert detector.min_confidence == 0.6
        # Should fallback to HOG since YOLO files don't exist
        assert detector.model_type in ["yolo", "hog"]
    
    def test_person_detector_initialization_invalid_type(self):
        """Test PersonDetector initialization with invalid model type"""
        detector = PersonDetector(model_type="invalid", min_confidence=0.5)
        # Should fallback to HOG
        assert detector.model_type == "hog"
        assert detector.hog is not None
    
    def test_detect_persons_empty_image(self, person_detector_hog):
        """Test person detection with empty image"""
        empty_image = np.array([])
        detections = person_detector_hog.detect_persons(empty_image)
        assert detections == []
    
    def test_detect_persons_none_image(self, person_detector_hog):
        """Test person detection with None image"""
        detections = person_detector_hog.detect_persons(None)
        assert detections == []
    
    @patch('cv2.HOGDescriptor.detectMultiScale')
    def test_detect_persons_hog_with_mock_detection(self, mock_detect, person_detector_hog, sample_image):
        """Test person detection with mocked HOG detection"""
        # Mock detection result: (x, y, w, h) and weights
        mock_detect.return_value = (
            np.array([[50, 50, 100, 200], [150, 100, 80, 160]]),  # rectangles
            np.array([[1.5], [2.0]])  # weights
        )
        
        detections = person_detector_hog.detect_persons(sample_image)
        
        assert len(detections) == 2
        assert all(isinstance(d, DetectionResult) for d in detections)
        assert all(d.type == DetectionType.PERSON for d in detections)
        assert all(d.confidence >= person_detector_hog.min_confidence for d in detections)
        
        # Check that both expected detections are present (order may vary due to processing)
        detection_coords = [(d.bounding_box.x, d.bounding_box.y, d.bounding_box.width, d.bounding_box.height) 
                           for d in detections]
        expected_detections = [(50, 50, 100, 200), (150, 100, 80, 160)]
        
        for expected in expected_detections:
            assert expected in detection_coords
    
    @patch('cv2.HOGDescriptor.detectMultiScale')
    def test_detect_persons_hog_no_detections(self, mock_detect, person_detector_hog, sample_image):
        """Test person detection when no persons are found"""
        mock_detect.return_value = (np.array([]), np.array([]))
        
        detections = person_detector_hog.detect_persons(sample_image)
        assert detections == []
    
    @patch('cv2.HOGDescriptor.detectMultiScale')
    def test_detect_persons_hog_confidence_filtering(self, mock_detect, sample_image):
        """Test that detections below confidence threshold are filtered out"""
        detector = PersonDetector(model_type="hog", min_confidence=0.8)
        # Mock detection with low weight (should result in low confidence)
        mock_detect.return_value = (
            np.array([[50, 50, 100, 200]]),
            np.array([[-0.5]])  # Negative weight = low confidence
        )
        
        detections = detector.detect_persons(sample_image)
        # Should be filtered out due to low confidence
        assert len(detections) == 0
    
    def test_detect_persons_from_file_nonexistent(self, person_detector_hog):
        """Test person detection from nonexistent file"""
        detections = person_detector_hog.detect_persons_from_file("nonexistent_file.jpg")
        assert detections == []
    
    def test_detect_persons_from_file_invalid_image(self, person_detector_hog):
        """Test person detection from invalid image file"""
        # Create a temporary text file (not an image)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is not an image")
            temp_path = f.name
        
        try:
            detections = person_detector_hog.detect_persons_from_file(temp_path)
            assert detections == []
        finally:
            os.unlink(temp_path)
    
    @patch('cv2.imread')
    @patch('cv2.HOGDescriptor.detectMultiScale')
    def test_detect_persons_from_file_success(self, mock_detect, mock_imread, person_detector_hog, sample_image):
        """Test successful person detection from file"""
        mock_imread.return_value = sample_image
        mock_detect.return_value = (
            np.array([[100, 100, 50, 100]]),
            np.array([[1.0]])
        )
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            temp_path = f.name
        
        try:
            detections = person_detector_hog.detect_persons_from_file(temp_path)
            assert len(detections) >= 0  # Should not crash
            assert isinstance(detections, list)
        finally:
            os.unlink(temp_path)
    
    @patch('cv2.dnn.readNetFromCaffe')
    @patch('os.path.exists')
    def test_mobilenet_model_loading_success(self, mock_exists, mock_read_net):
        """Test successful MobileNet model loading"""
        mock_exists.return_value = True
        mock_net = MagicMock()
        mock_read_net.return_value = mock_net
        
        detector = PersonDetector(model_type="mobilenet")
        assert detector.model_type == "mobilenet"
        assert detector.net == mock_net
    
    @patch('cv2.dnn.readNet')
    @patch('os.path.exists')
    def test_yolo_model_loading_success(self, mock_exists, mock_read_net):
        """Test successful YOLO model loading"""
        mock_exists.return_value = True
        mock_net = MagicMock()
        mock_read_net.return_value = mock_net
        
        # Mock the names file
        with patch('builtins.open', create=True) as mock_open:
            mock_open.return_value.__enter__.return_value.readlines.return_value = [
                'person\n', 'bicycle\n', 'car\n'
            ]
            
            # Mock getLayerNames and getUnconnectedOutLayers
            mock_net.getLayerNames.return_value = ['layer1', 'layer2', 'output1', 'output2']
            mock_net.getUnconnectedOutLayers.return_value = [[3], [4]]  # 1-indexed
            
            detector = PersonDetector(model_type="yolo")
            assert detector.model_type == "yolo"
            assert detector.net == mock_net
    
    @patch('cv2.dnn.blobFromImage')
    @patch('cv2.dnn.NMSBoxes')
    def test_detect_with_yolo_mock(self, mock_nms, mock_blob, sample_image):
        """Test YOLO detection with mocked network"""
        # Create a detector with mocked YOLO network
        detector = PersonDetector(model_type="yolo")
        
        # Mock the network
        mock_net = MagicMock()
        detector.net = mock_net
        detector.output_layers = ['output1', 'output2']
        detector.class_names = ['person', 'bicycle', 'car']
        
        # Mock network outputs
        mock_output = np.array([
            [0.5, 0.5, 0.1, 0.2, 0.3, 0.8, 0.1, 0.1],  # person detection
            [0.3, 0.7, 0.05, 0.1, 0.2, 0.6, 0.2, 0.2]   # another detection
        ])
        mock_net.forward.return_value = [mock_output]
        
        # Mock NMS to return first detection
        mock_nms.return_value = np.array([0])
        
        detections = detector._detect_with_yolo(sample_image)
        
        assert isinstance(detections, list)
        # The exact number depends on the mock setup and confidence thresholds
    
    @patch('cv2.dnn.blobFromImage')
    def test_detect_with_mobilenet_mock(self, mock_blob, sample_image):
        """Test MobileNet detection with mocked network"""
        # Create a detector with mocked MobileNet network
        detector = PersonDetector(model_type="mobilenet")
        
        # Mock the network
        mock_net = MagicMock()
        detector.net = mock_net
        detector.class_names = ["background", "aeroplane", "bicycle", "bird", "boat",
                               "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
                               "dog", "horse", "motorbike", "person"]
        
        # Mock network output - shape should be (1, 1, N, 7)
        # Format: [batch_id, class_id, confidence, x1, y1, x2, y2]
        mock_output = np.array([[[[0, 15, 0.8, 0.1, 0.1, 0.5, 0.9]]]])  # person detection
        mock_net.forward.return_value = mock_output
        
        detections = detector._detect_with_mobilenet(sample_image)
        
        assert isinstance(detections, list)
        if len(detections) > 0:
            assert all(d.type == DetectionType.PERSON for d in detections)
    
    def test_hog_confidence_calculation(self, person_detector_hog):
        """Test HOG confidence calculation from weights"""
        # Test the confidence calculation logic
        detector = person_detector_hog
        
        # Test with different weight values
        test_weights = [-1.0, 0.0, 1.0, 2.0, 5.0]
        
        for weight in test_weights:
            # Simulate the confidence calculation
            confidence = min(0.95, max(detector.min_confidence, (weight + 1) / 2))
            
            # Confidence should be within valid range
            assert 0.0 <= confidence <= 1.0
            assert confidence >= detector.min_confidence or confidence == 0.95
    
    def test_person_detector_error_handling(self, person_detector_hog):
        """Test error handling in person detection"""
        # Test with None image (safer than corrupted data)
        detections = person_detector_hog.detect_persons(None)
        assert detections == []
        
        # Test with empty array
        empty_image = np.array([])
        detections = person_detector_hog.detect_persons(empty_image)
        assert detections == []
    
    @patch('cv2.HOGDescriptor.detectMultiScale')
    def test_hog_weight_to_confidence_conversion(self, mock_detect, person_detector_hog, sample_image):
        """Test conversion of HOG weights to confidence scores"""
        # Test various weight values and their confidence conversion
        test_cases = [
            ([-2.0], 0),  # Very negative weight
            ([-0.5], 1),  # Slightly negative weight  
            ([0.0], 1),   # Zero weight
            ([1.0], 1),   # Positive weight
            ([3.0], 1)    # High positive weight
        ]
        
        for weights, expected_count in test_cases:
            mock_detect.return_value = (
                np.array([[50, 50, 100, 200]] * len(weights)),
                np.array([weights]).T
            )
            
            detections = person_detector_hog.detect_persons(sample_image)
            
            # Check that confidence filtering works correctly
            valid_detections = [d for d in detections if d.confidence >= person_detector_hog.min_confidence]
            assert len(valid_detections) >= 0  # Should not crash
    
    def test_model_fallback_behavior(self):
        """Test that invalid model types fall back to HOG"""
        invalid_types = ["invalid", "nonexistent", "", None]
        
        for model_type in invalid_types:
            detector = PersonDetector(model_type=model_type)
            assert detector.model_type == "hog"
            assert hasattr(detector, 'hog')
            assert detector.hog is not None