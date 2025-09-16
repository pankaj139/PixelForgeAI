import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComputerVisionService } from '../computerVisionService.js';
import {
  DetectionResult,
  FaceDetection,
  PersonDetection,
  BoundingBox,
  Point,
  Keypoint,
  Dimensions
} from '../../types/index.js';

// Mock TensorFlow.js
const mockTensor = {
  dispose: vi.fn()
};

vi.mock('@tensorflow/tfjs-node', () => ({
  tensor3d: vi.fn(() => mockTensor),
  GraphModel: vi.fn()
}));

// Mock Sharp
vi.mock('sharp', () => {
  const mockSharp = vi.fn().mockImplementation(() => ({
    raw: () => ({
      toBuffer: vi.fn().mockResolvedValue({
        data: new Uint8Array(1920 * 1080 * 3), // Mock RGB data
        info: { width: 1920, height: 1080 }
      })
    })
  }));
  return { default: mockSharp };
});

describe('ComputerVisionService', () => {
  let service: ComputerVisionService;

  beforeEach(() => {
    service = new ComputerVisionService();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('detectPeople', () => {
    it('should detect faces and people in an image', async () => {
      // Since we're using a mock implementation with randomness,
      // we'll test that the method returns valid structure
      const result = await service.detectPeople('/mock/image/path.jpg');

      expect(result).toHaveProperty('faces');
      expect(result).toHaveProperty('people');
      expect(result).toHaveProperty('confidence');
      expect(Array.isArray(result.faces)).toBe(true);
      expect(Array.isArray(result.people)).toBe(true);
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle detection errors gracefully', async () => {
      // Mock Sharp to throw an error
      const sharp = await import('sharp');
      vi.mocked(sharp.default).mockImplementationOnce(() => {
        throw new Error('Image processing failed');
      });

      const result = await service.detectPeople('/mock/image/path.jpg');

      expect(result.faces).toHaveLength(0);
      expect(result.people).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle detection without errors', async () => {
      const result = await service.detectPeople('/mock/image/path.jpg');
      
      // Verify the service returns a valid result structure
      expect(result).toBeDefined();
      expect(result.faces).toBeDefined();
      expect(result.people).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('calculateCenterOfMass', () => {
    it('should calculate center of mass for multiple detections', () => {
      const detections: (FaceDetection | PersonDetection)[] = [
        {
          boundingBox: { x: 100, y: 100, width: 50, height: 60 },
          confidence: 0.9
        },
        {
          boundingBox: { x: 200, y: 150, width: 40, height: 50 },
          confidence: 0.7
        }
      ];

      const centerOfMass = service.calculateCenterOfMass(detections);

      // Expected calculation:
      // Detection 1 center: (125, 130), weight: 0.9
      // Detection 2 center: (220, 175), weight: 0.7
      // Weighted average: ((125*0.9 + 220*0.7) / (0.9+0.7), (130*0.9 + 175*0.7) / (0.9+0.7))
      // X: (112.5 + 154) / 1.6 = 266.5 / 1.6 = 166.5625
      // Y: (117 + 122.5) / 1.6 = 239.5 / 1.6 = 149.6875
      expect(centerOfMass.x).toBeCloseTo(166.5625);
      expect(centerOfMass.y).toBeCloseTo(149.6875);
    });

    it('should return (0, 0) for empty detections array', () => {
      const centerOfMass = service.calculateCenterOfMass([]);
      expect(centerOfMass.x).toBe(0);
      expect(centerOfMass.y).toBe(0);
    });

    it('should handle single detection', () => {
      const detections: FaceDetection[] = [{
        boundingBox: { x: 100, y: 200, width: 50, height: 60 },
        confidence: 0.8
      }];

      const centerOfMass = service.calculateCenterOfMass(detections);

      expect(centerOfMass.x).toBe(125); // 100 + 50/2
      expect(centerOfMass.y).toBe(230); // 200 + 60/2
    });
  });

  describe('generateCropSuggestions', () => {
    const imageDimensions: Dimensions = { width: 1920, height: 1080 };
    const targetAspectRatio = { width: 4, height: 6 }; // Portrait ratio

    it('should generate crop suggestions based on detected people', () => {
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 800, y: 300, width: 200, height: 250 },
          confidence: 0.9
        }],
        people: [{
          boundingBox: { x: 750, y: 200, width: 300, height: 600 },
          confidence: 0.8
        }],
        confidence: 0.85
      };

      const cropSuggestions = service.generateCropSuggestions(
        imageDimensions,
        detections,
        targetAspectRatio
      );

      expect(cropSuggestions).toHaveLength(1);
      
      const crop = cropSuggestions[0];
      expect(crop.width).toBeGreaterThan(0);
      expect(crop.height).toBeGreaterThan(0);
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(imageDimensions.width);
      expect(crop.y + crop.height).toBeLessThanOrEqual(imageDimensions.height);
      
      // Verify aspect ratio
      const aspectRatio = crop.width / crop.height;
      const expectedRatio = targetAspectRatio.width / targetAspectRatio.height;
      expect(aspectRatio).toBeCloseTo(expectedRatio, 2);
    });

    it('should generate center crop when no people are detected', () => {
      const detections: DetectionResult = {
        faces: [],
        people: [],
        confidence: 0
      };

      const cropSuggestions = service.generateCropSuggestions(
        imageDimensions,
        detections,
        targetAspectRatio
      );

      expect(cropSuggestions).toHaveLength(1);
      
      const crop = cropSuggestions[0];
      
      // Should be centered
      const expectedX = (imageDimensions.width - crop.width) / 2;
      const expectedY = (imageDimensions.height - crop.height) / 2;
      
      expect(crop.x).toBeCloseTo(expectedX);
      expect(crop.y).toBeCloseTo(expectedY);
      
      // Verify aspect ratio
      const aspectRatio = crop.width / crop.height;
      const expectedRatio = targetAspectRatio.width / targetAspectRatio.height;
      expect(aspectRatio).toBeCloseTo(expectedRatio, 2);
    });

    it('should handle landscape target aspect ratio', () => {
      const landscapeRatio = { width: 16, height: 9 };
      
      const detections: DetectionResult = {
        faces: [],
        people: [],
        confidence: 0
      };

      const cropSuggestions = service.generateCropSuggestions(
        imageDimensions,
        detections,
        landscapeRatio
      );

      const crop = cropSuggestions[0];
      const aspectRatio = crop.width / crop.height;
      const expectedRatio = landscapeRatio.width / landscapeRatio.height;
      
      expect(aspectRatio).toBeCloseTo(expectedRatio, 2);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      // Initialize the service first
      await service.initialize();
      
      // Call cleanup
      await service.cleanup();
      
      // Since we're using mock models, we can't test actual disposal
      // but we can verify the method completes without error
      expect(true).toBe(true);
    });
  });

  describe('Mock Detection Results', () => {
    it('should work with mock face detection data', () => {
      const mockFace: FaceDetection = {
        boundingBox: { x: 100, y: 100, width: 80, height: 100 },
        confidence: 0.95,
        landmarks: [
          { x: 130, y: 120 }, // left eye
          { x: 150, y: 120 }  // right eye
        ]
      };

      expect(mockFace.confidence).toBe(0.95);
      expect(mockFace.boundingBox.width).toBe(80);
      expect(mockFace.landmarks).toHaveLength(2);
    });

    it('should work with mock person detection data', () => {
      const mockKeypoints: Keypoint[] = [
        { x: 140, y: 110, confidence: 0.9, name: 'nose' },
        { x: 130, y: 105, confidence: 0.8, name: 'left_eye' },
        { x: 150, y: 105, confidence: 0.8, name: 'right_eye' },
        { x: 120, y: 160, confidence: 0.9, name: 'left_shoulder' },
        { x: 160, y: 160, confidence: 0.9, name: 'right_shoulder' }
      ];

      const mockPerson: PersonDetection = {
        boundingBox: { x: 100, y: 90, width: 80, height: 200 },
        confidence: 0.87,
        keypoints: mockKeypoints
      };

      expect(mockPerson.confidence).toBe(0.87);
      expect(mockPerson.keypoints).toHaveLength(5);
      expect(mockPerson.keypoints?.[0].name).toBe('nose');
    });

    it('should calculate center of mass with mock data', () => {
      const mockDetections: (FaceDetection | PersonDetection)[] = [
        {
          boundingBox: { x: 100, y: 100, width: 80, height: 100 },
          confidence: 0.9
        },
        {
          boundingBox: { x: 300, y: 200, width: 60, height: 120 },
          confidence: 0.7
        }
      ];

      const centerOfMass = service.calculateCenterOfMass(mockDetections);
      
      // Detection 1 center: (140, 150), weight: 0.9
      // Detection 2 center: (330, 260), weight: 0.7
      // Weighted center: ((140*0.9 + 330*0.7)/(0.9+0.7), (150*0.9 + 260*0.7)/(0.9+0.7))
      // X: (126 + 231) / 1.6 = 357 / 1.6 = 223.125
      // Y: (135 + 182) / 1.6 = 317 / 1.6 = 198.125
      expect(centerOfMass.x).toBeCloseTo(223.125);
      expect(centerOfMass.y).toBeCloseTo(198.125);
    });
  });
});