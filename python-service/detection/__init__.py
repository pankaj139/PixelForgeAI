"""
Computer vision detection module for face and person detection
"""

from .face_detector import FaceDetector
from .person_detector import PersonDetector
from .detection_processor import DetectionProcessor

__all__ = ["FaceDetector", "PersonDetector", "DetectionProcessor"]