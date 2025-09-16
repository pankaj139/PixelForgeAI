/**
 * Unit tests for InstagramProcessingService
 * 
 * Tests Instagram-specific image processing optimizations including:
 * - Aspect ratio conversion for Instagram formats
 * - Color enhancement for mobile viewing
 * - Quality optimization and compression
 * - Batch processing capabilities
 * - Format recommendation analysis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InstagramProcessingService, instagramProcessingService } from '../instagramProcessingService.js';
import { INSTAGRAM_CONSTANTS, ASPECT_RATIOS } from '../../constants/index.js';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { computerVisionService } from '../computerVisionService.js';
import { croppingService } from '../croppingService.js';

// Mock dependencies
vi.mock('sharp');
vi.mock('fs/promises');
vi.mock('../croppingService.js');
vi.mock('../computerVisionService.js');
vi.mock('../../utils/logger.js');

describe('InstagramProcessingService', () => {
  let service: InstagramProcessingService;
  const mockSharpInstance = {
    metadata: vi.fn(),
    extract: vi.fn(),
    resize: vi.fn(),
    modulate: vi.fn(),
    sharpen: vi.fn(),
    jpeg: vi.fn(),
    toFile: vi.fn()
  };

  beforeEach(() => {
    service = new InstagramProcessingService();
    vi.clearAllMocks();

    // Setup sharp mock chain
    mockSharpInstance.extract.mockReturnThis();
    mockSharpInstance.resize.mockReturnThis();
    mockSharpInstance.modulate.mockReturnThis();
    mockSharpInstance.sharpen.mockReturnThis();
    mockSharpInstance.jpeg.mockReturnThis();
    mockSharpInstance.toFile.mockResolvedValue(undefined);

    (sharp as any).mockReturnValue(mockSharpInstance);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processForInstagram', () => {
    beforeEach(() => {
      // Mock image metadata
      mockSharpInstance.metadata.mockResolvedValue({
        width: 2000,
        height: 1500,
        format: 'jpeg'
      });

      // Mock file stats
      (fs.stat as any).mockResolvedValue({
        size: 5 * 1024 * 1024 // 5MB
      });

      // Mock computer vision service
      vi.mocked(computerVisionService.detectPeople).mockResolvedValue({
        faces: [],
        people: [],
        confidence: 0
      });

      // Mock cropping service
      vi.mocked(croppingService.calculateOptimalCrop).mockResolvedValue({
        cropArea: {
          x: 100,
          y: 100,
          width: 1000,
          height: 1000,
          confidence: 0.8
        },
        strategy: 'fallback-center',
        qualityScore: 0.85
      });
    });

    it('should process image for Instagram-Post format successfully', async () => {
      const result = await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Post',
        {
          enhanceColors: true,
          sharpen: true,
          generateCompressed: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.processedImages.high).toBeDefined();
      expect(result.processedImages.compressed).toBeDefined();
      expect(result.metrics.compressionRatio).toBeGreaterThan(0);
      expect(result.metrics.qualityScore).toBeGreaterThan(0);
    });

    it('should apply Instagram color enhancements', async () => {
      await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Portrait',
        { enhanceColors: true }
      );

      // Verify color enhancement was applied
      expect(mockSharpInstance.modulate).toHaveBeenCalledWith({
        brightness: INSTAGRAM_CONSTANTS.COLOR_ENHANCEMENT.brightness,
        saturation: INSTAGRAM_CONSTANTS.COLOR_ENHANCEMENT.saturation,
        lightness: INSTAGRAM_CONSTANTS.COLOR_ENHANCEMENT.contrast
      });
    });

    it('should apply custom color enhancements', async () => {
      const customEnhancements = {
        saturation: 1.2,
        brightness: 1.05,
        contrast: 1.1
      };

      await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Story',
        {
          enhanceColors: true,
          customEnhancements
        }
      );

      expect(mockSharpInstance.modulate).toHaveBeenCalledWith({
        brightness: customEnhancements.brightness,
        saturation: customEnhancements.saturation,
        lightness: customEnhancements.contrast
      });
    });

    it('should apply sharpening for mobile viewing', async () => {
      await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Reel',
        { sharpen: true }
      );

      // Verify sharpen method is called with individual parameters (Sharp.js v0.32+ API)
      expect(mockSharpInstance.sharpen).toHaveBeenCalledWith(
        INSTAGRAM_CONSTANTS.SHARPENING.sigma,
        INSTAGRAM_CONSTANTS.SHARPENING.flat,
        INSTAGRAM_CONSTANTS.SHARPENING.jagged
      );
    });

    it('should use correct Sharp.js API for sharpening with individual parameters', async () => {
      // This test specifically verifies the fix for the Sharp.js sharpen() API change
      await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Post',
        { sharpen: true }
      );

      // Verify that sharpen is called with three separate parameters, not an object
      // This ensures compatibility with Sharp.js v0.32+ API
      expect(mockSharpInstance.sharpen).toHaveBeenCalledWith(1.0, 1.0, 2.0);
      expect(mockSharpInstance.sharpen).not.toHaveBeenCalledWith({
        sigma: expect.any(Number),
        flat: expect.any(Number),
        jagged: expect.any(Number)
      });
    });

    it('should handle different Instagram aspect ratios', async () => {
      const testCases = [
        'Instagram-Post',
        'Instagram-Portrait',
        'Instagram-Story',
        'Instagram-Landscape'
      ];

      for (const aspectRatio of testCases) {
        const result = await service.processForInstagram(
          '/test/input.jpg',
          '/test/output',
          aspectRatio
        );

        expect(result.success).toBe(true);
        expect(result.processedImages.high.aspectRatio.name).toBe(aspectRatio);
      }
    });

    it('should handle invalid aspect ratio', async () => {
      const result = await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'InvalidRatio'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid aspect ratio');
    });

    it('should apply high-quality JPEG compression', async () => {
      await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Post',
        { targetResolution: 'high' }
      );

      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: INSTAGRAM_CONSTANTS.QUALITY_HIGH,
        progressive: INSTAGRAM_CONSTANTS.COMPRESSION.progressive,
        optimiseScans: INSTAGRAM_CONSTANTS.COMPRESSION.optimiseScans,
        mozjpeg: INSTAGRAM_CONSTANTS.COMPRESSION.mozjpeg
      });
    });

    it('should skip color enhancement when disabled', async () => {
      await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Post',
        { enhanceColors: false }
      );

      expect(mockSharpInstance.modulate).not.toHaveBeenCalled();
    });

    it('should skip sharpening when disabled', async () => {
      await service.processForInstagram(
        '/test/input.jpg',
        '/test/output',
        'Instagram-Post',
        { sharpen: false }
      );

      expect(mockSharpInstance.sharpen).not.toHaveBeenCalled();
    });
  });

  describe('batchProcessForInstagram', () => {
    beforeEach(() => {
      // Setup successful processing mock
      mockSharpInstance.metadata.mockResolvedValue({
        width: 2000,
        height: 1500,
        format: 'jpeg'
      });
      (fs.stat as any).mockResolvedValue({ size: 5 * 1024 * 1024 });
      
      vi.mocked(computerVisionService.detectPeople).mockResolvedValue({
        faces: [],
        people: [],
        confidence: 0
      });
      
      vi.mocked(croppingService.calculateOptimalCrop).mockResolvedValue({
        cropArea: { x: 100, y: 100, width: 1000, height: 1000, confidence: 0.8 },
        strategy: 'fallback-center',
        qualityScore: 0.85
      });
    });

    it('should process multiple images successfully', async () => {
      const inputPaths = ['/test/image1.jpg', '/test/image2.jpg', '/test/image3.jpg'];
      
      const results = await service.batchProcessForInstagram(
        inputPaths,
        '/test/output',
        'Instagram-Post'
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle batch processing errors gracefully', async () => {
      const inputPaths = ['/test/image1.jpg', '/test/invalid.jpg'];
      
      // Mock failure for second image
      mockSharpInstance.metadata
        .mockResolvedValueOnce({ width: 2000, height: 1500, format: 'jpeg' })
        .mockRejectedValueOnce(new Error('Invalid image file'));

      const results = await service.batchProcessForInstagram(
        inputPaths,
        '/test/output',
        'Instagram-Portrait'
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Invalid image file');
    });
  });

  describe('getInstagramFormatRecommendations', () => {
    beforeEach(() => {
      vi.mocked(computerVisionService.detectPeople).mockResolvedValue({
        faces: [{ boundingBox: { x: 100, y: 100, width: 200, height: 200 }, confidence: 0.9 }],
        people: [],
        confidence: 0.9
      });
    });

    it('should recommend formats for square image', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1080,
        height: 1080,
        format: 'jpeg'
      });

      const result = await service.getInstagramFormatRecommendations('/test/square.jpg');

      expect(result.recommended).toContain('Instagram-Post');
      expect(result.analysis.aspectRatio).toBe(1);
      expect(result.analysis.hasPortraitSubjects).toBe(true);
    });

    it('should recommend formats for portrait image', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1080,
        height: 1350,
        format: 'jpeg'
      });

      const result = await service.getInstagramFormatRecommendations('/test/portrait.jpg');

      expect(result.recommended).toContain('Instagram-Portrait');
      expect(result.recommended).toContain('Instagram-Post');
      expect(result.analysis.aspectRatio).toBe(1080 / 1350);
    });

    it('should recommend formats for landscape image', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg'
      });

      const result = await service.getInstagramFormatRecommendations('/test/landscape.jpg');

      expect(result.recommended).toContain('Instagram-Landscape');
      expect(result.analysis.aspectRatio).toBe(1920 / 1080);
    });

    it('should always suggest story format', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1200,
        height: 800,
        format: 'jpeg'
      });

      const result = await service.getInstagramFormatRecommendations('/test/any.jpg');

      expect(result.recommended).toContain('Instagram-Story');
      expect(result.analysis.suggestions).toContain('Create story version for additional exposure');
    });
  });

  describe('calculateInstagramDimensions', () => {
    it('should calculate correct dimensions for story resolution', () => {
      const dimensions = (service as any).calculateInstagramDimensions(
        ASPECT_RATIOS['Instagram-Story'],
        'story'
      );

      expect(dimensions.width).toBe(INSTAGRAM_CONSTANTS.STORY_WIDTH);
      expect(dimensions.height).toBe(INSTAGRAM_CONSTANTS.STORY_HEIGHT);
    });

    it('should calculate correct dimensions for high-quality posts', () => {
      const dimensions = (service as any).calculateInstagramDimensions(
        ASPECT_RATIOS['Instagram-Post'],
        'high'
      );

      expect(dimensions.width).toBe(INSTAGRAM_CONSTANTS.MAX_WIDTH);
      expect(dimensions.height).toBe(INSTAGRAM_CONSTANTS.MAX_WIDTH);
    });

    it('should calculate correct dimensions for standard quality', () => {
      const dimensions = (service as any).calculateInstagramDimensions(
        ASPECT_RATIOS['Instagram-Post'],
        'standard'
      );

      expect(dimensions.width).toBe(INSTAGRAM_CONSTANTS.MIN_WIDTH);
      expect(dimensions.height).toBe(INSTAGRAM_CONSTANTS.MIN_WIDTH);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score correctly', () => {
      const score = (service as any).calculateQualityScore(0.8, 3.0, true);
      
      // Should be: 0.8 * 0.4 + (compression score) * 0.3 + 0.2 (Instagram bonus) + 0.1 (format bonus)
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should give bonus for Instagram-specific ratios', () => {
      const instagramScore = (service as any).calculateQualityScore(0.8, 3.0, true);
      const regularScore = (service as any).calculateQualityScore(0.8, 3.0, false);
      
      expect(instagramScore).toBeGreaterThan(regularScore);
    });
  });
});
