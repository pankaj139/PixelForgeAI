"""
Enhanced detection result processing with logical consistency validation

This module coordinates face and person detection with optimized parameters
and ensures logical consistency where faces ≤ people (every face belongs to a person).

Features:
- Multi-scale face and person detection
- Logical consistency validation (faces ≤ people) 
- Enhanced person detection around isolated faces
- Automatic correction when faces > people detected

Usage:
    processor = DetectionProcessor(face_confidence=0.5, person_confidence=0.35)
    response = processor.process_detection_request(request)

Returns:
    DetectionResponse with logically consistent detection results and metadata
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict, Any
import time
import os
from models import (
    DetectionResult, DetectionRequest, DetectionResponse, 
    DetectionType, BoundingBox
)
from .face_detector import FaceDetector
from .person_detector import PersonDetector
import logging

logger = logging.getLogger(__name__)

class DetectionProcessor:
    """Main processor for handling detection requests and combining results"""
    
    def __init__(self, face_confidence: float = 0.4, person_confidence: float = 0.35, enforce_consistency: bool = False):
        """
        Initialize advanced detection processor with multi-method face detection
        
        Args:
            face_confidence: Minimum confidence for face detection (default 0.35 - optimized for advanced multi-method detection)
            person_confidence: Minimum confidence for person detection (default 0.35 - balanced for person detection)
            enforce_consistency: Whether to enforce strict consistency that faces <= people (default False for better usability)
            
        Call Example:
            processor = DetectionProcessor()  # Uses advanced multi-method face detection
            processor = DetectionProcessor(face_confidence=0.3, person_confidence=0.4)  # Custom balance
            processor = DetectionProcessor(enforce_consistency=True)  # Strict consistency mode
            
        Expected Return:
            Initialized DetectionProcessor with advanced face detection and optional logical consistency validation
        """
        self.face_detector = FaceDetector(min_confidence=face_confidence)
        self.person_detector = PersonDetector(min_confidence=person_confidence)
        self.enforce_consistency = enforce_consistency
        logger.info(f"Advanced detection processor initialized - face_confidence: {face_confidence}, person_confidence: {person_confidence}, enforce_consistency: {enforce_consistency}")
        
    def process_detection_request(self, request: DetectionRequest) -> DetectionResponse:
        """
        Process a detection request and return combined results
        
        Args:
            request: DetectionRequest object
            
        Returns:
            DetectionResponse with all requested detections
        """
        start_time = time.time()
        
        try:
            # Validate image path
            if not os.path.exists(request.image_path):
                raise FileNotFoundError(f"Image file not found: {request.image_path}")
            
            # Load image
            image = cv2.imread(request.image_path)
            if image is None:
                raise ValueError(f"Failed to load image: {request.image_path}")
            
            # Get image dimensions
            height, width = image.shape[:2]
            image_dimensions = {"width": width, "height": height}
            
            # Collect all detections
            all_detections = []
            
            face_detections = []
            person_detections = []
            
            # Process face detection if requested
            if DetectionType.FACE in request.detection_types:
                face_detections = self.face_detector.detect_faces(image)
                # Filter by confidence threshold
                face_detections = [
                    d for d in face_detections 
                    if d.confidence >= request.confidence_threshold
                ]
                logger.info(f"Found {len(face_detections)} faces")
            
            # Process person detection if requested
            if DetectionType.PERSON in request.detection_types:
                person_detections = self.person_detector.detect_persons(image)
                # Filter by confidence threshold
                person_detections = [
                    d for d in person_detections 
                    if d.confidence >= request.confidence_threshold
                ]
                logger.info(f"Found {len(person_detections)} persons")
                
                # LOGICAL CONSISTENCY CHECK: If faces > people, enhance person detection
                if len(face_detections) > len(person_detections):
                    logger.warning(f"Logic issue: {len(face_detections)} faces > {len(person_detections)} people. Enhancing person detection...")
                    enhanced_person_detections = self._enhance_person_detection_around_faces(image, face_detections, person_detections)
                    person_detections.extend(enhanced_person_detections)
                    logger.info(f"After enhancement: Found {len(person_detections)} people total")
            
            all_detections.extend(face_detections)
            all_detections.extend(person_detections)
            
            # Remove overlapping detections
            filtered_detections = self._remove_overlapping_detections(all_detections)
            
            # Apply final consistency validation AFTER NMS to ensure faces <= people (only if enabled)
            final_faces = [d for d in filtered_detections if d.type == DetectionType.FACE]
            final_people = [d for d in filtered_detections if d.type == DetectionType.PERSON]
            
            # Only apply consistency check if enforce_consistency is True
            if self.enforce_consistency and final_faces:
                logger.warning(f"🔍 CONSISTENCY CHECK: Starting with {len(final_faces)} faces, {len(final_people)} people")
                final_faces, final_people = self._ensure_logical_consistency(final_faces, final_people)
                logger.warning(f"🔍 CONSISTENCY CHECK: After enforcement: {len(final_faces)} faces, {len(final_people)} people")
                
                # Reconstruct filtered detections with consistent counts
                other_detections = [d for d in filtered_detections if d.type not in [DetectionType.FACE, DetectionType.PERSON]]
                filtered_detections = final_faces + final_people + other_detections
            
            processing_time = time.time() - start_time
            
            # Final logging of results
            final_face_count = len([d for d in filtered_detections if d.type == DetectionType.FACE])
            final_person_count = len([d for d in filtered_detections if d.type == DetectionType.PERSON])
            logger.error(f"🎯 FINAL RESULT: Returning {final_face_count} faces, {final_person_count} people to client")
            
            return DetectionResponse(
                image_path=request.image_path,
                detections=filtered_detections,
                processing_time=processing_time,
                image_dimensions=image_dimensions
            )
            
        except Exception as e:
            logger.error(f"Detection processing failed: {e}")
            processing_time = time.time() - start_time
            return DetectionResponse(
                image_path=request.image_path,
                detections=[],
                processing_time=processing_time,
                image_dimensions={"width": 0, "height": 0}
            )
    
    def _remove_overlapping_detections(self, detections: List[DetectionResult]) -> List[DetectionResult]:
        """
        Remove overlapping detections using Non-Maximum Suppression
        
        Args:
            detections: List of detection results
            
        Returns:
            Filtered list with overlapping detections removed
        """
        if len(detections) <= 1:
            return detections
        
        # Group detections by type
        face_detections = [d for d in detections if d.type == DetectionType.FACE]
        person_detections = [d for d in detections if d.type == DetectionType.PERSON]
        
        # Apply NMS within each type
        filtered_faces = self._apply_nms(face_detections)
        filtered_persons = self._apply_nms(person_detections)
        
        # Combine results
        return filtered_faces + filtered_persons
    
    def _apply_nms(self, detections: List[DetectionResult], overlap_threshold: float = 0.25) -> List[DetectionResult]:
        """
        Apply Non-Maximum Suppression to remove overlapping detections
        
        Args:
            detections: List of detections of the same type
            overlap_threshold: IoU threshold for considering detections as overlapping
            
        Returns:
            Filtered list of detections
        """
        if len(detections) <= 1:
            return detections
        
        # Convert to format suitable for OpenCV NMS
        boxes = []
        confidences = []
        
        for detection in detections:
            bbox = detection.bounding_box
            boxes.append([bbox.x, bbox.y, bbox.width, bbox.height])
            confidences.append(detection.confidence)
        
        # Apply NMS
        indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.0, overlap_threshold)
        
        # Return filtered detections
        if len(indices) > 0:
            # Handle both single dimension and nested array cases
            if isinstance(indices, np.ndarray):
                if indices.ndim > 1:
                    indices = indices.flatten()
                # Ensure indices are within bounds
                valid_indices = [i for i in indices if 0 <= i < len(detections)]
                return [detections[i] for i in valid_indices]
            else:
                return detections
        else:
            return []
    
    def calculate_detection_center(self, detection: DetectionResult) -> Tuple[int, int]:
        """
        Calculate the center point of a detection
        
        Args:
            detection: DetectionResult object
            
        Returns:
            Tuple of (center_x, center_y)
        """
        bbox = detection.bounding_box
        center_x = bbox.x + bbox.width // 2
        center_y = bbox.y + bbox.height // 2
        return (center_x, center_y)
    
    def calculate_detection_area(self, detection: DetectionResult) -> int:
        """
        Calculate the area of a detection bounding box
        
        Args:
            detection: DetectionResult object
            
        Returns:
            Area in pixels
        """
        bbox = detection.bounding_box
        return bbox.width * bbox.height
    
    def get_detection_bounds(self, detections: List[DetectionResult]) -> Optional[BoundingBox]:
        """
        Calculate bounding box that encompasses all detections
        
        Args:
            detections: List of detection results
            
        Returns:
            BoundingBox encompassing all detections or None if no detections
        """
        if not detections:
            return None
        
        # Find min/max coordinates
        min_x = min(d.bounding_box.x for d in detections)
        min_y = min(d.bounding_box.y for d in detections)
        max_x = max(d.bounding_box.x + d.bounding_box.width for d in detections)
        max_y = max(d.bounding_box.y + d.bounding_box.height for d in detections)
        
        return BoundingBox(
            x=min_x,
            y=min_y,
            width=max_x - min_x,
            height=max_y - min_y
        )
    
    def filter_detections_by_area(self, detections: List[DetectionResult], 
                                 min_area: int = 100, max_area: Optional[int] = None) -> List[DetectionResult]:
        """
        Filter detections by bounding box area
        
        Args:
            detections: List of detection results
            min_area: Minimum area in pixels
            max_area: Maximum area in pixels (None for no limit)
            
        Returns:
            Filtered list of detections
        """
        filtered = []
        for detection in detections:
            area = self.calculate_detection_area(detection)
            if area >= min_area and (max_area is None or area <= max_area):
                filtered.append(detection)
        
        return filtered
    
    def sort_detections_by_confidence(self, detections: List[DetectionResult], 
                                    reverse: bool = True) -> List[DetectionResult]:
        """
        Sort detections by confidence score
        
        Args:
            detections: List of detection results
            reverse: If True, sort in descending order (highest confidence first)
            
        Returns:
            Sorted list of detections
        """
        return sorted(detections, key=lambda d: d.confidence, reverse=reverse)
    
    def sort_detections_by_size(self, detections: List[DetectionResult], 
                               reverse: bool = True) -> List[DetectionResult]:
        """
        Sort detections by bounding box area
        
        Args:
            detections: List of detection results
            reverse: If True, sort in descending order (largest first)
            
        Returns:
            Sorted list of detections
        """
        return sorted(detections, key=lambda d: self.calculate_detection_area(d), reverse=reverse)
    
    def get_detection_statistics(self, detections: List[DetectionResult]) -> Dict[str, Any]:
        """
        Calculate statistics for a list of detections
        
        Args:
            detections: List of detection results
            
        Returns:
            Dictionary with detection statistics
        """
        if not detections:
            return {
                "total_count": 0,
                "face_count": 0,
                "person_count": 0,
                "avg_confidence": 0.0,
                "max_confidence": 0.0,
                "min_confidence": 0.0,
                "avg_area": 0,
                "total_area": 0
            }
        
        face_count = sum(1 for d in detections if d.type == DetectionType.FACE)
        person_count = sum(1 for d in detections if d.type == DetectionType.PERSON)
        
        confidences = [d.confidence for d in detections]
        areas = [self.calculate_detection_area(d) for d in detections]
        
        return {
            "total_count": len(detections),
            "face_count": face_count,
            "person_count": person_count,
            "avg_confidence": sum(confidences) / len(confidences),
            "max_confidence": max(confidences),
            "min_confidence": min(confidences),
            "avg_area": sum(areas) / len(areas),
            "total_area": sum(areas)
        }
    
    def _enhance_person_detection_around_faces(self, image: np.ndarray, face_detections: List[DetectionResult], 
                                             existing_person_detections: List[DetectionResult]) -> List[DetectionResult]:
        """
        Enhance person detection by looking for people around detected faces
        
        This method is called when faces > people to find missing person bodies.
        For each face without a corresponding person, it searches for a person body.
        
        Args:
            image: Input image as numpy array
            face_detections: List of detected faces
            existing_person_detections: List of already detected people
            
        Returns:
            List of additional person detections found around faces
            
        Call Example:
            extra_people = self._enhance_person_detection_around_faces(image, faces, people)
            
        Expected Return:
            Additional DetectionResult objects for people found near isolated faces
        """
        if not face_detections:
            return []
            
        enhanced_detections = []
        
        for face in face_detections:
            # Check if this face already has a corresponding person nearby
            has_corresponding_person = False
            face_center_x = face.bounding_box.x + face.bounding_box.width // 2
            face_center_y = face.bounding_box.y + face.bounding_box.height // 2
            
            for person in existing_person_detections:
                person_box = person.bounding_box
                # Check if face center is within or near person bounding box
                if (person_box.x <= face_center_x <= person_box.x + person_box.width and
                    person_box.y <= face_center_y <= person_box.y + person_box.height * 1.2):  # Allow face above body
                    has_corresponding_person = True
                    break
            
            if not has_corresponding_person:
                # Try to find a person body for this isolated face
                person_candidate = self._search_person_around_face(image, face)
                if person_candidate:
                    # Avoid duplicates
                    is_duplicate = False
                    for existing in existing_person_detections + enhanced_detections:
                        if self._calculate_iou(person_candidate.bounding_box, existing.bounding_box) > 0.3:
                            is_duplicate = True
                            break
                    
                    if not is_duplicate:
                        enhanced_detections.append(person_candidate)
                        logger.info(f"Found missing person body around face at ({face.bounding_box.x}, {face.bounding_box.y})")
        
        return enhanced_detections
    
    def _search_person_around_face(self, image: np.ndarray, face: DetectionResult) -> Optional[DetectionResult]:
        """
        Search for a person body around a detected face using more sensitive parameters
        
        Args:
            image: Input image as numpy array  
            face: Face detection to search around
            
        Returns:
            DetectionResult for person body if found, None otherwise
            
        Call Example:
            person = self._search_person_around_face(image, face_detection)
            
        Expected Return:
            DetectionResult object for person body or None if not found
        """
        # Calculate search region around face (assume body extends below face)
        face_box = face.bounding_box
        image_height, image_width = image.shape[:2]
        
        # Estimate body region: faces are typically in upper 1/4 to 1/3 of body
        estimated_body_height = face_box.height * 6  # Body ~6x face height
        estimated_body_width = face_box.width * 2    # Body ~2x face width
        
        # Search region centered on face but extending downward
        search_x = max(0, face_box.x - estimated_body_width // 4)
        search_y = max(0, face_box.y - face_box.height // 2)
        search_w = min(image_width - search_x, estimated_body_width)
        search_h = min(image_height - search_y, estimated_body_height)
        
        # Extract search region
        search_region = image[search_y:search_y+search_h, search_x:search_x+search_w]
        
        if search_region.size == 0:
            return None
        
        try:
            # Use very sensitive HOG detection in this region
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            
            (rects, weights) = hog.detectMultiScale(
                search_region,
                winStride=(4, 4),
                padding=(8, 8),
                scale=1.02,
                hitThreshold=-0.5  # Very sensitive
            )
            
            if len(rects) > 0:
                # Take the best detection
                best_idx = 0
                if len(weights) > 0:
                    best_idx = np.argmax([w[0] if hasattr(w, '__len__') and len(w) > 0 else w for w in weights])
                
                x, y, w, h = rects[best_idx]
                # Convert back to full image coordinates
                abs_x = search_x + x
                abs_y = search_y + y
                
                # Validate the detection makes sense (face should be in upper part of body)
                face_in_body = (abs_y <= face_box.y <= abs_y + h * 0.4)  # Face in upper 40% of body
                if face_in_body:
                    confidence = 0.4  # Conservative confidence for enhanced detections
                    
                    bounding_box = BoundingBox(x=abs_x, y=abs_y, width=w, height=h)
                    return DetectionResult(
                        type=DetectionType.PERSON,
                        confidence=confidence,
                        bounding_box=bounding_box
                    )
        
        except Exception as e:
            logger.debug(f"Error in person search around face: {e}")
        
        return None
    
    def _calculate_iou(self, box1: BoundingBox, box2: BoundingBox) -> float:
        """
        Calculate Intersection over Union (IoU) for two bounding boxes
        
        Args:
            box1: First bounding box
            box2: Second bounding box
            
        Returns:
            IoU value between 0 and 1
            
        Call Example:
            iou = self._calculate_iou(detection1.bounding_box, detection2.bounding_box)
            
        Expected Return:
            Float value representing overlap percentage (0.0 to 1.0)
        """
        # Calculate intersection
        x1 = max(box1.x, box2.x)
        y1 = max(box1.y, box2.y)
        x2 = min(box1.x + box1.width, box2.x + box2.width)
        y2 = min(box1.y + box1.height, box2.y + box2.height)
        
        if x2 <= x1 or y2 <= y1:
            return 0.0
        
        intersection = (x2 - x1) * (y2 - y1)
        area1 = box1.width * box1.height
        area2 = box2.width * box2.height
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0.0
    
    def _ensure_logical_consistency(self, face_detections: List[DetectionResult], 
                                  person_detections: List[DetectionResult]) -> Tuple[List[DetectionResult], List[DetectionResult]]:
        """
        Final validation to ensure logical consistency: faces <= people
        
        Args:
            face_detections: List of face detections
            person_detections: List of person detections
            
        Returns:
            Tuple of (validated_faces, validated_people) ensuring faces <= people
            
        Call Example:
            faces, people = self._ensure_logical_consistency(faces, people)
            
        Expected Return:
            Tuple with consistent detection counts where faces <= people
        """
        if len(face_detections) <= len(person_detections):
            logger.info(f"✅ Logical consistency: {len(face_detections)} faces <= {len(person_detections)} people")
            return face_detections, person_detections
        
        # Special case: faces exist but no people detected
        if len(person_detections) == 0 and len(face_detections) > 0:
            logger.error(f"🚨 SPECIAL CASE: {len(face_detections)} faces detected but 0 people. This violates logical consistency!")
            logger.error("🚨 ENFORCING STRICT CONSISTENCY: Removing all faces since no people bodies were detected.")
            logger.error(f"🚨 BEFORE: {len(face_detections)} faces, {len(person_detections)} people")
            logger.error(f"🚨 AFTER: 0 faces, {len(person_detections)} people")
            return [], person_detections
        
        # If we still have faces > people, reduce face detections to match logic
        logger.warning(f"Still have {len(face_detections)} faces > {len(person_detections)} people. Reducing faces to match.")
        
        # Sort faces by confidence (keep highest confidence faces)
        sorted_faces = sorted(face_detections, key=lambda d: d.confidence, reverse=True)
        kept_faces = sorted_faces[:len(person_detections)]
        
        logger.info(f"✅ Consistency enforced: {len(kept_faces)} faces = {len(person_detections)} people")
        return kept_faces, person_detections