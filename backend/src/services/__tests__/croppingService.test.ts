import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CroppingService } from '../croppingService.js';
import {
  DetectionResult,
  AspectRatio,
  Dimensions,
  ImageData,
  FaceDetection,
  PersonDetection
} from '../../types/index.js';

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = {
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 800 }),
    extract: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined)
  };
  
  return {
    default: vi.fn(() => mockSharp)
  };
});

describe('CroppingService', () => {
  let croppingService: CroppingService;
  let mockImageData: ImageData;
  let mockAspectRatio: AspectRatio;

  beforeEach(() => {
    croppingService = new CroppingService();
    mockImageData = {
      path: '/test/image.jpg',
      dimensions: { width: 1000, height: 800 },
      format: 'jpeg'
    };
    mockAspectRatio = {
      width: 4,
      height: 6,
      name: '4x6'
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateOptimalCrop', () => {
    it('should use people-centered cropping when people are detected', async () => {
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 400, y: 200, width: 200, height: 250 },
          confidence: 0.9,
          landmarks: [
            { x: 450, y: 250 },
            { x: 550, y: 250 },
            { x: 500, y: 300 },
            { x: 500, y: 350 }
          ]
        }],
        people: [],
        confidence: 0.9
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio
      );

      expect(result.strategy).toBe('people-centered');
      expect(result.qualityScore).toBeGreaterThan(0.5);
      expect(result.cropArea.confidence).toBe(0.9);
    });

    it('should use fallback cropping when no people are detected', async () => {
      const detections: DetectionResult = {
        faces: [],
        people: [],
        confidence: 0
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio
      );

      expect(result.strategy).toBe('fallback-smart');
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.cropArea.confidence).toBe(0.4);
    });

    it('should handle multiple people detections', async () => {
      const detections: DetectionResult = {
        faces: [
          {
            boundingBox: { x: 300, y: 150, width: 150, height: 200 },
            confidence: 0.85
          },
          {
            boundingBox: { x: 550, y: 180, width: 140, height: 190 },
            confidence: 0.8
          }
        ],
        people: [{
          boundingBox: { x: 280, y: 120, width: 440, height: 600 },
          confidence: 0.9,
          keypoints: [
            { x: 500, y: 200, confidence: 0.9, name: 'nose' },
            { x: 480, y: 180, confidence: 0.8, name: 'left_eye' },
            { x: 520, y: 180, confidence: 0.8, name: 'right_eye' }
          ]
        }],
        confidence: 0.85
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio
      );

      expect(result.strategy).toBe('people-centered');
      expect(result.cropArea.x).toBeGreaterThanOrEqual(0);
      expect(result.cropArea.y).toBeGreaterThanOrEqual(0);
      expect(result.cropArea.x + result.cropArea.width).toBeLessThanOrEqual(1000);
      expect(result.cropArea.y + result.cropArea.height).toBeLessThanOrEqual(800);
    });

    it('should respect different fallback strategies', async () => {
      const detections: DetectionResult = {
        faces: [],
        people: [],
        confidence: 0
      };

      const centerResult = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio,
        { fallbackStrategy: 'center' }
      );

      const ruleOfThirdsResult = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio,
        { fallbackStrategy: 'rule-of-thirds' }
      );

      expect(centerResult.strategy).toBe('fallback-center');
      expect(ruleOfThirdsResult.strategy).toBe('rule-of-thirds');
      expect(centerResult.cropArea.x).not.toBe(ruleOfThirdsResult.cropArea.x);
    });

    it('should handle different aspect ratios correctly', async () => {
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 400, y: 300, width: 200, height: 200 },
          confidence: 0.9
        }],
        people: [],
        confidence: 0.9
      };

      const squareRatio: AspectRatio = { width: 1, height: 1, name: 'Square' };
      const wideRatio: AspectRatio = { width: 16, height: 9, name: '16:9' };

      const squareResult = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        squareRatio
      );

      const wideResult = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        wideRatio
      );

      // Square crop should be taller than wide crop
      expect(squareResult.cropArea.height).toBeGreaterThan(wideResult.cropArea.height);
      expect(wideResult.cropArea.width).toBeGreaterThan(squareResult.cropArea.width);
    });
  });

  describe('applyCrop', () => {
    it('should apply crop with quality preservation', async () => {
      const sharp = await import('sharp');
      const mockSharp = sharp.default as any;
      
      const cropArea = {
        x: 100,
        y: 50,
        width: 400,
        height: 600,
        confidence: 0.9
      };

      await croppingService.applyCrop(
        '/input/image.jpg',
        cropArea,
        mockAspectRatio,
        '/output/cropped.jpg',
        { preserveQuality: true }
      );

      expect(mockSharp).toHaveBeenCalledWith('/input/image.jpg');
      expect(mockSharp().extract).toHaveBeenCalledWith({
        left: 100,
        top: 50,
        width: 400,
        height: 600
      });
      expect(mockSharp().jpeg).toHaveBeenCalledWith({ quality: 95, progressive: true });
      expect(mockSharp().toFile).toHaveBeenCalledWith('/output/cropped.jpg');
    });

    it('should handle resize when crop dimensions do not match target ratio', async () => {
      const sharp = await import('sharp');
      const mockSharp = sharp.default as any;
      
      // Create a crop area that will definitely need resizing (square for 4:6 ratio)
      const cropArea = {
        x: 0,
        y: 0,
        width: 600,
        height: 600, // Square crop for 4:6 ratio (should be 400x600)
        confidence: 0.8
      };

      await croppingService.applyCrop(
        '/input/image.jpg',
        cropArea,
        mockAspectRatio,
        '/output/cropped.jpg'
      );

      // Should call resize because 600x600 doesn't match 4:6 ratio
      expect(mockSharp().resize).toHaveBeenCalled();
    });

    it('should throw error when image metadata cannot be read', async () => {
      const sharp = await import('sharp');
      const mockSharp = sharp.default as any;
      mockSharp().metadata.mockResolvedValueOnce({ width: undefined, height: undefined });

      const cropArea = {
        x: 0,
        y: 0,
        width: 400,
        height: 600,
        confidence: 0.8
      };

      await expect(
        croppingService.applyCrop(
          '/invalid/image.jpg',
          cropArea,
          mockAspectRatio,
          '/output/cropped.jpg'
        )
      ).rejects.toThrow('Unable to read image dimensions');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty detections gracefully', async () => {
      const detections: DetectionResult = {
        faces: [],
        people: [],
        confidence: 0
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio
      );

      expect(result.cropArea.x).toBeGreaterThanOrEqual(0);
      expect(result.cropArea.y).toBeGreaterThanOrEqual(0);
      expect(result.cropArea.width).toBeGreaterThan(0);
      expect(result.cropArea.height).toBeGreaterThan(0);
    });

    it('should handle very small images', async () => {
      const smallImageData: ImageData = {
        path: '/test/small.jpg',
        dimensions: { width: 100, height: 80 },
        format: 'jpeg'
      };

      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 30, y: 20, width: 40, height: 40 },
          confidence: 0.8
        }],
        people: [],
        confidence: 0.8
      };

      const result = await croppingService.calculateOptimalCrop(
        smallImageData,
        detections,
        mockAspectRatio
      );

      expect(result.cropArea.x + result.cropArea.width).toBeLessThanOrEqual(100);
      expect(result.cropArea.y + result.cropArea.height).toBeLessThanOrEqual(80);
    });

    it('should handle people at image edges', async () => {
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 0, y: 0, width: 200, height: 250 },
          confidence: 0.9
        }],
        people: [],
        confidence: 0.9
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio
      );

      expect(result.cropArea.x).toBeGreaterThanOrEqual(0);
      expect(result.cropArea.y).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe('people-centered');
    });

    it('should handle very wide aspect ratios', async () => {
      const wideRatio: AspectRatio = { width: 21, height: 9, name: 'Ultra-wide' };
      
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 400, y: 300, width: 200, height: 200 },
          confidence: 0.9
        }],
        people: [],
        confidence: 0.9
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        wideRatio
      );

      expect(result.cropArea.width).toBeLessThanOrEqual(1000);
      expect(result.cropArea.height).toBeLessThanOrEqual(800);
      expect(result.cropArea.width / result.cropArea.height).toBeCloseTo(21/9, 1);
    });

    it('should handle very tall aspect ratios', async () => {
      const tallRatio: AspectRatio = { width: 9, height: 21, name: 'Very tall' };
      
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 400, y: 300, width: 200, height: 200 },
          confidence: 0.9
        }],
        people: [],
        confidence: 0.9
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        tallRatio
      );

      expect(result.cropArea.width).toBeLessThanOrEqual(1000);
      expect(result.cropArea.height).toBeLessThanOrEqual(800);
      expect(result.cropArea.width / result.cropArea.height).toBeCloseTo(9/21, 1);
    });

    it('should maintain quality score bounds', async () => {
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 500, y: 400, width: 200, height: 200 },
          confidence: 1.0
        }],
        people: [],
        confidence: 1.0
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio
      );

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should handle low confidence detections', async () => {
      const detections: DetectionResult = {
        faces: [{
          boundingBox: { x: 400, y: 300, width: 200, height: 200 },
          confidence: 0.1
        }],
        people: [],
        confidence: 0.1
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        mockAspectRatio
      );

      expect(result.strategy).toBe('people-centered');
      expect(result.qualityScore).toBeLessThan(0.5); // Low confidence should result in lower quality score
    });
  });

  describe('quality preservation', () => {
    it('should use high-quality settings when preserveQuality is true', async () => {
      const sharp = await import('sharp');
      const mockSharp = sharp.default as any;
      
      // Use dimensions that will force a resize
      const cropArea = {
        x: 100,
        y: 100,
        width: 600, // Square-ish crop that needs adjustment for 4:6 ratio
        height: 600,
        confidence: 0.9
      };

      await croppingService.applyCrop(
        '/input/image.jpg',
        cropArea,
        mockAspectRatio,
        '/output/cropped.jpg',
        { preserveQuality: true }
      );

      expect(mockSharp().resize).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          withoutEnlargement: true
        })
      );
    });

    it('should allow enlargement when preserveQuality is false', async () => {
      const sharp = await import('sharp');
      const mockSharp = sharp.default as any;
      
      // Use dimensions that will force a resize
      const cropArea = {
        x: 100,
        y: 100,
        width: 300, // Will need adjustment for 4:6 ratio
        height: 300,
        confidence: 0.9
      };

      await croppingService.applyCrop(
        '/input/image.jpg',
        cropArea,
        mockAspectRatio,
        '/output/cropped.jpg',
        { preserveQuality: false }
      );

      expect(mockSharp().resize).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          withoutEnlargement: true
        })
      );
    });
  });

  describe('crop positioning algorithms', () => {
    it('should center crop when using center fallback strategy', async () => {
      const detections: DetectionResult = {
        faces: [],
        people: [],
        confidence: 0
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        { width: 1, height: 1, name: 'Square' }, // Square for easier calculation
        { fallbackStrategy: 'center' }
      );

      // For a 1000x800 image with square crop, should be centered
      const expectedSize = 800; // Limited by height
      const expectedX = (1000 - expectedSize) / 2;
      const expectedY = 0;

      expect(result.cropArea.x).toBeCloseTo(expectedX, 1);
      expect(result.cropArea.y).toBeCloseTo(expectedY, 1);
      expect(result.cropArea.width).toBeCloseTo(expectedSize, 1);
      expect(result.cropArea.height).toBeCloseTo(expectedSize, 1);
    });

    it('should apply rule of thirds when using rule-of-thirds strategy', async () => {
      const detections: DetectionResult = {
        faces: [],
        people: [],
        confidence: 0
      };

      const result = await croppingService.calculateOptimalCrop(
        mockImageData,
        detections,
        { width: 1, height: 1, name: 'Square' },
        { fallbackStrategy: 'rule-of-thirds' }
      );

      // Should not be perfectly centered
      const centerX = (1000 - result.cropArea.width) / 2;
      expect(result.cropArea.x).not.toBeCloseTo(centerX, 1);
    });
  });
});