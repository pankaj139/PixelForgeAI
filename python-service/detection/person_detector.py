"""
Enhanced person detection with improved HOG parameters and multi-scale detection

This module provides optimized person detection with enhanced sensitivity for detecting
multiple people in various poses and sizes, especially in family photos.

Usage:
    detector = PersonDetector(min_confidence=0.3)
    people = detector.detect_persons(image)

Returns:
    List of DetectionResult objects with person locations and confidence scores
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
import os
from models import BoundingBox, DetectionResult, DetectionType
import logging

logger = logging.getLogger(__name__)

class PersonDetector:
    """Person detection using OpenCV DNN with MobileNet-SSD or YOLO"""
    
    def __init__(self, model_type: str = "hog", min_confidence: float = 0.3):
        """
        Initialize enhanced person detector with improved sensitivity
        
        Args:
            model_type: Type of model to use ("mobilenet", "yolo", or "hog")
            min_confidence: Minimum confidence threshold for detections (default 0.3 for better sensitivity)
            
        Call Example:
            detector = PersonDetector()  # Uses HOG with default sensitivity
            detector = PersonDetector(min_confidence=0.2)  # More sensitive detection
            
        Expected Return:
            Initialized PersonDetector instance ready for person detection
        """
        self.model_type = model_type.lower() if model_type else "hog"
        self.min_confidence = min_confidence
        self.net = None
        self.output_layers = None
        self.class_names = []
        
        try:
            if self.model_type == "mobilenet":
                self._load_mobilenet_model()
            elif self.model_type == "yolo":
                self._load_yolo_model()
            else:
                # Default to enhanced HOG detector
                self._load_hog_detector()
                
            logger.info(f"Enhanced person detector initialized with {self.model_type} model, min_confidence: {min_confidence}")
        except Exception as e:
            logger.error(f"Failed to initialize person detector: {e}")
            # Fallback to HOG detector
            self._load_hog_detector()
    
    def _load_mobilenet_model(self):
        """Load MobileNet-SSD model for person detection"""
        try:
            # Try to load pre-trained MobileNet-SSD model
            # In production, you would download these files
            prototxt_path = "models/MobileNetSSD_deploy.prototxt"
            model_path = "models/MobileNetSSD_deploy.caffemodel"
            
            if os.path.exists(prototxt_path) and os.path.exists(model_path):
                self.net = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
                self.class_names = ["background", "aeroplane", "bicycle", "bird", "boat",
                                  "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
                                  "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
                                  "sofa", "train", "tvmonitor"]
                logger.info("MobileNet-SSD model loaded successfully")
            else:
                logger.warning("MobileNet-SSD model files not found, falling back to HOG")
                self._load_hog_detector()
        except Exception as e:
            logger.error(f"Failed to load MobileNet model: {e}")
            self._load_hog_detector()
    
    def _load_yolo_model(self):
        """Load YOLO model for person detection"""
        try:
            # Try to load YOLO model
            config_path = "models/yolov3.cfg"
            weights_path = "models/yolov3.weights"
            names_path = "models/coco.names"
            
            if all(os.path.exists(p) for p in [config_path, weights_path, names_path]):
                self.net = cv2.dnn.readNet(weights_path, config_path)
                
                # Load class names
                with open(names_path, 'r') as f:
                    self.class_names = [line.strip() for line in f.readlines()]
                
                # Get output layer names
                layer_names = self.net.getLayerNames()
                self.output_layers = [layer_names[i[0] - 1] for i in self.net.getUnconnectedOutLayers()]
                
                logger.info("YOLO model loaded successfully")
            else:
                logger.warning("YOLO model files not found, falling back to HOG")
                self._load_hog_detector()
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self._load_hog_detector()
    
    def _load_hog_detector(self):
        """Load HOG (Histogram of Oriented Gradients) detector as fallback"""
        try:
            self.hog = cv2.HOGDescriptor()
            self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            self.model_type = "hog"
            logger.info("HOG detector loaded as fallback")
        except Exception as e:
            logger.error(f"Failed to load HOG detector: {e}")
            raise
    
    def detect_persons(self, image: np.ndarray) -> List[DetectionResult]:
        """
        Detect persons in an image
        
        Args:
            image: Input image as numpy array (BGR format)
            
        Returns:
            List of DetectionResult objects for detected persons
        """
        if image is None or image.size == 0:
            logger.warning("Empty or invalid image provided")
            return []
        
        try:
            if self.model_type == "mobilenet" and self.net is not None:
                return self._detect_with_mobilenet(image)
            elif self.model_type == "yolo" and self.net is not None:
                return self._detect_with_yolo(image)
            else:
                return self._detect_with_hog(image)
        except Exception as e:
            logger.error(f"Person detection failed: {e}")
            return []
    
    def _detect_with_mobilenet(self, image: np.ndarray) -> List[DetectionResult]:
        """Detect persons using MobileNet-SSD"""
        height, width = image.shape[:2]
        
        # Create blob from image
        blob = cv2.dnn.blobFromImage(image, 0.007843, (300, 300), 127.5)
        self.net.setInput(blob)
        detections = self.net.forward()
        
        results = []
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            class_id = int(detections[0, 0, i, 1])
            
            # Check if it's a person (class_id 15 in MobileNet-SSD)
            if class_id == 15 and confidence >= self.min_confidence:
                # Get bounding box coordinates
                x1 = int(detections[0, 0, i, 3] * width)
                y1 = int(detections[0, 0, i, 4] * height)
                x2 = int(detections[0, 0, i, 5] * width)
                y2 = int(detections[0, 0, i, 6] * height)
                
                # Ensure coordinates are within image bounds
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(width, x2)
                y2 = min(height, y2)
                
                if x2 > x1 and y2 > y1:
                    bounding_box = BoundingBox(
                        x=x1, y=y1, 
                        width=x2-x1, height=y2-y1
                    )
                    detection = DetectionResult(
                        type=DetectionType.PERSON,
                        confidence=float(confidence),
                        bounding_box=bounding_box
                    )
                    results.append(detection)
        
        return results
    
    def _detect_with_yolo(self, image: np.ndarray) -> List[DetectionResult]:
        """Detect persons using YOLO"""
        height, width = image.shape[:2]
        
        # Create blob from image
        blob = cv2.dnn.blobFromImage(image, 1/255.0, (416, 416), swapRB=True, crop=False)
        self.net.setInput(blob)
        outputs = self.net.forward(self.output_layers)
        
        boxes = []
        confidences = []
        
        for output in outputs:
            for detection in output:
                scores = detection[5:]
                class_id = np.argmax(scores)
                confidence = scores[class_id]
                
                # Check if it's a person (class_id 0 in COCO dataset)
                if class_id == 0 and confidence >= self.min_confidence:
                    # Get bounding box coordinates
                    center_x = int(detection[0] * width)
                    center_y = int(detection[1] * height)
                    w = int(detection[2] * width)
                    h = int(detection[3] * height)
                    
                    x = int(center_x - w/2)
                    y = int(center_y - h/2)
                    
                    boxes.append([x, y, w, h])
                    confidences.append(float(confidence))
        
        # Apply non-maximum suppression
        indices = cv2.dnn.NMSBoxes(boxes, confidences, self.min_confidence, 0.4)
        
        results = []
        if len(indices) > 0:
            for i in indices.flatten():
                x, y, w, h = boxes[i]
                
                # Ensure coordinates are within image bounds
                x = max(0, x)
                y = max(0, y)
                w = min(width - x, w)
                h = min(height - y, h)
                
                if w > 0 and h > 0:
                    bounding_box = BoundingBox(x=x, y=y, width=w, height=h)
                    detection = DetectionResult(
                        type=DetectionType.PERSON,
                        confidence=confidences[i],
                        bounding_box=bounding_box
                    )
                    results.append(detection)
        
        return results
    
    def _detect_with_hog(self, image: np.ndarray) -> List[DetectionResult]:
        """
        Enhanced person detection using HOG descriptor with multi-scale approach
        
        Args:
            image: Input image as numpy array (BGR format)
            
        Returns:
            List of DetectionResult objects for detected persons
            
        Call Example:
            people = self._detect_with_hog(cv2.imread('family_photo.jpg'))
            
        Expected Return:
            List of DetectionResult objects with person bounding boxes and confidence scores
        """
        try:
            all_detections = []
            
            # More sensitive detection to catch people in various poses
            detection_configs = [
                # Primary sensitive detection  
                {"winStride": (8, 8), "padding": (16, 16), "scale": 1.05, "hitThreshold": -0.2},
                # Secondary detection for different scales
                {"winStride": (6, 6), "padding": (12, 12), "scale": 1.1, "hitThreshold": 0.1},
                # Third pass for smaller people
                {"winStride": (4, 4), "padding": (8, 8), "scale": 1.03, "hitThreshold": 0.0}
            ]
            
            for config in detection_configs:
                try:
                    # Use detectMultiScale with custom hit threshold
                    (rects, weights) = self.hog.detectMultiScale(
                        image,
                        winStride=config["winStride"],
                        padding=config["padding"],
                        scale=config["scale"],
                        hitThreshold=config["hitThreshold"]
                    )
                    
                    # Process detections from this configuration
                    for i, (x, y, w, h) in enumerate(rects):
                        # Handle different weight formats from HOG detector
                        try:
                            if len(weights) > i:
                                weight_val = weights[i]
                                # Handle both scalar and array formats
                                if hasattr(weight_val, '__len__') and len(weight_val) > 0:
                                    weight = weight_val[0]
                                else:
                                    weight = float(weight_val)
                            else:
                                weight = 0.0
                        except (TypeError, IndexError):
                            weight = 0.0
                        
                        all_detections.append((x, y, w, h, weight))
                        
                except Exception as config_error:
                    logger.warning(f"HOG detection config failed: {config_error}")
                    continue
            
            if not all_detections:
                logger.info("No person detections found with enhanced HOG")
                return []
            
            # Remove overlapping detections
            unique_detections = self._merge_overlapping_persons(all_detections)
            
            results = []
            image_height, image_width = image.shape[:2]
            
            for (x, y, w, h, weight) in unique_detections:
                # More balanced confidence calculation for better person detection
                # Normalize weight to confidence score (HOG weights can be negative)
                base_confidence = min(0.9, max(0.1, (weight + 1.5) / 3.0))  # More lenient normalization
                
                # Reasonable size filtering - people can vary in size
                person_area = w * h
                image_area = image_width * image_height
                relative_size = person_area / image_area
                
                # Less strict size filtering 
                if relative_size < 0.0008:  # Very small detections
                    continue
                if relative_size > 0.5:  # Unreasonably large
                    continue
                    
                size_confidence = min(0.9, max(0.2, relative_size * 35))
                
                # More flexible aspect ratio - people can be sitting, leaning, etc.
                aspect_ratio = h / w
                if aspect_ratio < 0.8:  # Too wide (but allow sitting people)
                    continue
                if aspect_ratio > 5.0:  # Too tall to be realistic
                    continue
                    
                aspect_confidence = max(0.3, min(0.9, aspect_ratio / 2.5))
                
                # Edge confidence - allow people near edges
                edge_distance = min(x, y, image_width - (x + w), image_height - (y + h))
                edge_confidence = min(0.9, max(0.4, edge_distance / max(w, h) + 0.3))
                
                # More lenient confidence combination
                confidence = (base_confidence * 0.5 + size_confidence * 0.25 + 
                             aspect_confidence * 0.15 + edge_confidence * 0.1)
                
                # Lower minimum confidence threshold
                min_threshold = max(self.min_confidence, 0.35)  # Minimum 0.35 confidence
                if confidence >= min_threshold:
                    bounding_box = BoundingBox(x=int(x), y=int(y), width=int(w), height=int(h))
                    detection = DetectionResult(
                        type=DetectionType.PERSON,
                        confidence=confidence,
                        bounding_box=bounding_box
                    )
                    results.append(detection)
            
            logger.info(f"Enhanced HOG detection found {len(results)} people with confidence >= {self.min_confidence}")
            return results
            
        except Exception as e:
            logger.error(f"Enhanced HOG detection failed: {e}")
            return []
    
    def _merge_overlapping_persons(self, detections: List[Tuple], overlap_threshold: float = 0.2) -> List[Tuple]:
        """
        Merge overlapping person detections to remove duplicates
        
        Args:
            detections: List of person detections as (x, y, w, h, weight) tuples
            overlap_threshold: IoU threshold for merging overlapping detections
            
        Returns:
            List of merged unique person detections
            
        Call Example:
            unique_people = self._merge_overlapping_persons(all_detected_people)
            
        Expected Return:
            Filtered list without duplicate/overlapping person detections
        """
        if not detections:
            return []
        
        # Convert to numpy array for easier processing
        detections_array = np.array(detections)
        if len(detections_array) == 0:
            return []
        
        # Calculate areas
        areas = detections_array[:, 2] * detections_array[:, 3]
        
        # Sort by weight (detection strength)
        indices = np.argsort(detections_array[:, 4])[::-1]  # Sort by weight descending
        
        keep = []
        while len(indices) > 0:
            # Take the highest weight detection
            current = indices[0]
            keep.append(current)
            
            if len(indices) == 1:
                break
                
            # Calculate IoU with remaining detections
            current_det = detections_array[current]
            remaining_dets = detections_array[indices[1:]]
            
            # Calculate intersection
            x1 = np.maximum(current_det[0], remaining_dets[:, 0])
            y1 = np.maximum(current_det[1], remaining_dets[:, 1])
            x2 = np.minimum(current_det[0] + current_det[2], remaining_dets[:, 0] + remaining_dets[:, 2])
            y2 = np.minimum(current_det[1] + current_det[3], remaining_dets[:, 1] + remaining_dets[:, 3])
            
            intersection = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
            union = areas[current] + areas[indices[1:]] - intersection
            
            iou = intersection / (union + 1e-6)
            
            # Keep detections that don't overlap significantly
            indices = indices[1:][iou < overlap_threshold]
        
        return [detections[i] for i in keep]
    
    def detect_persons_from_file(self, image_path: str) -> List[DetectionResult]:
        """
        Detect persons from image file
        
        Args:
            image_path: Path to image file
            
        Returns:
            List of DetectionResult objects for detected persons
        """
        try:
            if not os.path.exists(image_path):
                logger.error(f"Image file not found: {image_path}")
                return []
            
            image = cv2.imread(image_path)
            if image is None:
                logger.error(f"Failed to load image: {image_path}")
                return []
            
            return self.detect_persons(image)
            
        except Exception as e:
            logger.error(f"Failed to detect persons from file {image_path}: {e}")
            return []