import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  AspectRatio,
  FileMetadata,
  Job,
  DetectionResult,
  BoundingBox,
  CropArea,
  ProcessedImage,
} from '../index';
import {
  isAspectRatio,
  isFileMetadata,
  isJob,
  isDetectionResult,
  isBoundingBox,
  isCropArea,
  isProcessedImage,
  validateAspectRatio,
  validateFileMetadata,
  validateJob,
  validateFileSchema,
  validateFileSchemas,
  isValidAspectRatioForProcessing,
  isBoundingBoxValid,
  isCropAreaValid,
} from '../../utils/typeGuards';
import {
  isSupportedMimeType,
  isValidFileSize,
  isValidFileCount,
  validateAspectRatioValues,
  validateAspectRatioName,
  isCommonAspectRatio,
  getAspectRatioValue,
  validateBoundingBox,
  validateCropArea,
  isValidConfidence,
  isValidUUID,
  validateFileExtension,
  sanitizeFilename,
  isValidProgress,
} from '../../utils/validation';
import { ASPECT_RATIOS } from '../../constants';

describe('Type Guards', () => {
  describe('isAspectRatio', () => {
    it('should validate correct aspect ratio', () => {
      const aspectRatio: AspectRatio = {
        width: 4,
        height: 6,
        name: '4x6',
      };
      expect(isAspectRatio(aspectRatio)).toBe(true);
    });

    it('should reject invalid aspect ratio', () => {
      expect(isAspectRatio({ width: -1, height: 6, name: '4x6' })).toBe(false);
      expect(isAspectRatio({ width: 4, height: 0, name: '4x6' })).toBe(false);
      expect(isAspectRatio({ width: 4, height: 6 })).toBe(false); // missing name
    });
  });

  describe('isFileMetadata', () => {
    it('should validate correct file metadata', () => {
      const fileMetadata: FileMetadata = {
        id: uuidv4(),
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        uploadPath: '/uploads/test.jpg',
        uploadedAt: new Date(),
      };
      expect(isFileMetadata(fileMetadata)).toBe(true);
    });

    it('should reject invalid file metadata', () => {
      expect(isFileMetadata({
        id: 'invalid-uuid',
        originalName: 'test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        uploadPath: '/uploads/test.jpg',
        uploadedAt: new Date(),
      })).toBe(false);
    });
  });

  describe('isBoundingBox', () => {
    it('should validate correct bounding box', () => {
      const bbox: BoundingBox = {
        x: 10,
        y: 20,
        width: 100,
        height: 150,
      };
      expect(isBoundingBox(bbox)).toBe(true);
    });

    it('should reject invalid bounding box', () => {
      expect(isBoundingBox({ x: -1, y: 20, width: 100, height: 150 })).toBe(false);
      expect(isBoundingBox({ x: 10, y: 20, width: 0, height: 150 })).toBe(false);
    });
  });

  describe('isCropArea', () => {
    it('should validate correct crop area', () => {
      const cropArea: CropArea = {
        x: 10,
        y: 20,
        width: 100,
        height: 150,
        confidence: 0.8,
      };
      expect(isCropArea(cropArea)).toBe(true);
    });

    it('should reject invalid crop area', () => {
      expect(isCropArea({
        x: 10,
        y: 20,
        width: 100,
        height: 150,
        confidence: 1.5, // Invalid confidence
      })).toBe(false);
    });
  });
});

describe('Validation Functions', () => {
  describe('isSupportedMimeType', () => {
    it('should accept supported MIME types', () => {
      expect(isSupportedMimeType('image/jpeg')).toBe(true);
      expect(isSupportedMimeType('image/png')).toBe(true);
      expect(isSupportedMimeType('image/webp')).toBe(true);
      expect(isSupportedMimeType('image/tiff')).toBe(true);
    });

    it('should reject unsupported MIME types', () => {
      expect(isSupportedMimeType('image/gif')).toBe(false);
      expect(isSupportedMimeType('text/plain')).toBe(false);
      expect(isSupportedMimeType('application/pdf')).toBe(false);
    });
  });

  describe('isValidFileSize', () => {
    it('should accept valid file sizes', () => {
      expect(isValidFileSize(1024)).toBe(true);
      expect(isValidFileSize(50 * 1024 * 1024)).toBe(true); // 50MB
    });

    it('should reject invalid file sizes', () => {
      expect(isValidFileSize(0)).toBe(false);
      expect(isValidFileSize(-1)).toBe(false);
      expect(isValidFileSize(51 * 1024 * 1024)).toBe(false); // > 50MB
    });
  });

  describe('validateAspectRatioValues', () => {
    it('should validate correct aspect ratio values', () => {
      const result = validateAspectRatioValues(4, 6);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid aspect ratio values', () => {
      const result = validateAspectRatioValues(-1, 6);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Width must be a positive number');
    });
  });

  describe('isCommonAspectRatio', () => {
    it('should identify common aspect ratios', () => {
      expect(isCommonAspectRatio(ASPECT_RATIOS['4x6'])).toBe(true);
      expect(isCommonAspectRatio(ASPECT_RATIOS['Square'])).toBe(true);
    });

    it('should reject non-common aspect ratios', () => {
      expect(isCommonAspectRatio({ width: 7, height: 11, name: 'Custom' })).toBe(false);
    });
  });

  describe('getAspectRatioValue', () => {
    it('should calculate correct aspect ratio value', () => {
      expect(getAspectRatioValue(ASPECT_RATIOS['4x6'])).toBeCloseTo(4/6);
      expect(getAspectRatioValue(ASPECT_RATIOS['Square'])).toBe(1);
      expect(getAspectRatioValue(ASPECT_RATIOS['16x9'])).toBeCloseTo(16/9);
    });
  });

  describe('validateBoundingBox', () => {
    it('should validate bounding box within image bounds', () => {
      const bbox: BoundingBox = { x: 10, y: 20, width: 100, height: 150 };
      const result = validateBoundingBox(bbox, 200, 300);
      expect(result.isValid).toBe(true);
    });

    it('should reject bounding box outside image bounds', () => {
      const bbox: BoundingBox = { x: 150, y: 20, width: 100, height: 150 };
      const result = validateBoundingBox(bbox, 200, 100);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bounding box extends beyond image height');
    });
  });

  describe('isValidConfidence', () => {
    it('should accept valid confidence values', () => {
      expect(isValidConfidence(0)).toBe(true);
      expect(isValidConfidence(0.5)).toBe(true);
      expect(isValidConfidence(1)).toBe(true);
    });

    it('should reject invalid confidence values', () => {
      expect(isValidConfidence(-0.1)).toBe(false);
      expect(isValidConfidence(1.1)).toBe(false);
      expect(isValidConfidence(NaN)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should accept valid UUIDs', () => {
      const uuid = uuidv4();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('validateFileExtension', () => {
    it('should validate matching file extension and MIME type', () => {
      const result = validateFileExtension('test.jpg', 'image/jpeg');
      expect(result.isValid).toBe(true);
    });

    it('should reject mismatched file extension and MIME type', () => {
      const result = validateFileExtension('test.png', 'image/jpeg');
      expect(result.isValid).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize unsafe characters', () => {
      expect(sanitizeFilename('test file!@#.jpg')).toBe('test_file.jpg');
      expect(sanitizeFilename('normal-file.png')).toBe('normal-file.png');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.jpg';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });
  });

  describe('isValidProgress', () => {
    it('should accept valid progress values', () => {
      expect(isValidProgress(0)).toBe(true);
      expect(isValidProgress(50)).toBe(true);
      expect(isValidProgress(100)).toBe(true);
    });

    it('should reject invalid progress values', () => {
      expect(isValidProgress(-1)).toBe(false);
      expect(isValidProgress(101)).toBe(false);
      expect(isValidProgress(NaN)).toBe(false);
    });
  });
});

describe('Complex Validation Scenarios', () => {
  describe('validateFileSchemas', () => {
    it('should validate array of valid files', () => {
      const files = [
        {
          originalname: 'test1.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('test'),
        },
        {
          originalname: 'test2.png',
          mimetype: 'image/png',
          size: 2048,
          buffer: Buffer.from('test'),
        },
      ] as Express.Multer.File[];

      const result = validateFileSchemas(files);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty file array', () => {
      const result = validateFileSchemas([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No files provided');
    });
  });

  describe('Utility Functions', () => {
    it('should validate aspect ratio for processing', () => {
      expect(isValidAspectRatioForProcessing(ASPECT_RATIOS['4x6'])).toBe(true);
      expect(isValidAspectRatioForProcessing({ width: 0, height: 6, name: 'Invalid' })).toBe(false);
      expect(isValidAspectRatioForProcessing({ width: 4, height: 6, name: '' })).toBe(false);
    });

    it('should validate bounding box within image dimensions', () => {
      const bbox: BoundingBox = { x: 10, y: 20, width: 100, height: 150 };
      expect(isBoundingBoxValid(bbox, 200, 300)).toBe(true);
      expect(isBoundingBoxValid(bbox, 50, 300)).toBe(false); // Exceeds width
    });

    it('should validate crop area within image dimensions', () => {
      const cropArea: CropArea = { x: 10, y: 20, width: 100, height: 150, confidence: 0.8 };
      expect(isCropAreaValid(cropArea, 200, 300)).toBe(true);
      expect(isCropAreaValid(cropArea, 50, 300)).toBe(false); // Exceeds width
    });
  });
});