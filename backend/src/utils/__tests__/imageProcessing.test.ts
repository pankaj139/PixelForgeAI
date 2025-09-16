import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  processImageWithIntelligentCropping,
  batchProcessImages,
  getCropPreview,
  validateImageFile,
  getImageInfo,
  createImageThumbnail,
  processImageAdvanced
} from '../imageProcessing.js';
import { AspectRatio } from '../../types/index.js';

// Mock dependencies
vi.mock('../../services/computerVisionService.js', () => ({
  computerVisionService: {
    detectPeople: vi.fn().mockResolvedValue({
      faces: [{
        boundingBox: { x: 400, y: 200, width: 200, height: 250 },
        confidence: 0.9
      }],
      people: [],
      confidence: 0.9
    })
  }
}));

vi.mock('../../services/croppingService.js', () => ({
  croppingService: {
    calculateOptimalCrop: vi.fn().mockResolvedValue({
      cropArea: { x: 100, y: 50, width: 400, height: 600, confidence: 0.9 },
      strategy: 'people-centered',
      qualityScore: 0.85
    })
  }
}));

vi.mock('../../services/imageProcessingService.js', () => ({
  imageProcessingService: {
    convertAspectRatio: vi.fn().mockResolvedValue({
      originalSize: { width: 1000, height: 800 },
      finalSize: { width: 400, height: 600 },
      cropArea: { x: 100, y: 50, width: 400, height: 600, confidence: 0.9 },
      upscaleFactor: 1.0,
      qualityScore: 85
    }),
    getImageMetadata: vi.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
      size: 2048000,
      aspectRatio: 1.777
    }),
    createThumbnail: vi.fn().mockResolvedValue({ width: 300, height: 169 }),
    validateImage: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      metadata: { width: 1920, height: 1080, format: 'jpeg' }
    })
  }
}));

vi.mock('sharp', () => {
  const mockSharp = {
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 800, format: 'jpeg' })
  };
  
  return {
    default: vi.fn(() => mockSharp)
  };
});

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123')
}));

const mockAspectRatio: AspectRatio = {
  width: 4,
  height: 6,
  name: '4x6'
};

describe('imageProcessing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processImageWithIntelligentCropping', () => {
    it('should successfully process an image with people detection', async () => {
      const result = await processImageWithIntelligentCropping(
        '/input/test.jpg',
        '/output/processed.jpg',
        mockAspectRatio
      );

      expect(result.success).toBe(true);
      expect(result.processedImage).toBeDefined();
      expect(result.processedImage?.aspectRatio).toEqual(mockAspectRatio);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle processing errors gracefully', async () => {
      const sharp = await import('sharp');
      const mockSharp = sharp.default as any;
      mockSharp().metadata.mockRejectedValueOnce(new Error('File not found'));

      const result = await processImageWithIntelligentCropping(
        '/invalid/path.jpg',
        '/output/processed.jpg',
        mockAspectRatio
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('batchProcessImages', () => {
    it('should process multiple images in sequence', async () => {
      const inputPaths = ['/input/image1.jpg', '/input/image2.png', '/input/image3.jpeg'];
      const outputDir = '/output';

      const results = await batchProcessImages(
        inputPaths,
        outputDir,
        mockAspectRatio
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });

    it('should handle empty input array', async () => {
      const results = await batchProcessImages([], '/output', mockAspectRatio);
      expect(results).toHaveLength(0);
    });
  });

  describe('getCropPreview', () => {
    it('should return crop preview without processing the image', async () => {
      const preview = await getCropPreview('/input/test.jpg', mockAspectRatio);

      expect(preview.cropArea).toEqual({
        x: 100,
        y: 50,
        width: 400,
        height: 600,
        confidence: 0.9
      });
      expect(preview.strategy).toBe('people-centered');
      expect(preview.qualityScore).toBe(0.85);
      expect(preview.detections).toBeDefined();
    });
  });

  describe('validateImageFile', () => {
    it('should validate image file using image processing service', async () => {
      const result = await validateImageFile('/test/image.jpg');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata).toBeDefined();
    });
  });

  describe('getImageInfo', () => {
    it('should get detailed image metadata', async () => {
      const info = await getImageInfo('/test/image.jpg');

      expect(info.width).toBe(1920);
      expect(info.height).toBe(1080);
      expect(info.aspectRatio).toBeCloseTo(1.777);
    });
  });

  describe('createImageThumbnail', () => {
    it('should create thumbnail with specified size', async () => {
      const dimensions = await createImageThumbnail('/input/image.jpg', '/output/thumb.jpg', 300);

      expect(dimensions.width).toBe(300);
      expect(dimensions.height).toBe(169);
    });
  });

  describe('processImageAdvanced', () => {
    it('should process image with advanced options and return metrics', async () => {
      const cropArea = { x: 100, y: 50, width: 400, height: 600, confidence: 0.9 };
      
      const result = await processImageAdvanced(
        '/input/image.jpg',
        '/output/processed.jpg',
        mockAspectRatio,
        cropArea,
        { quality: 95, maxUpscaleFactor: 2.0 }
      );

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.qualityScore).toBe(85);
    });
  });
});