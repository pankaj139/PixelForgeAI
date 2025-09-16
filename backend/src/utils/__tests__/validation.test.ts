import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isSupportedMimeType,
  isValidFileSize,
  isValidFileCount,
  validateFileSignature,
  validateUploadedFile,
  validateUploadedFiles,
  validateFileExtension,
  sanitizeFilename,
  MAX_FILE_SIZE,
  MAX_FILES_PER_UPLOAD,
  SUPPORTED_MIME_TYPES
} from '../validation';

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, 'test-data');

describe('File Validation Utils', () => {
  beforeEach(() => {
    // Create test data directory
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(TEST_DATA_DIR)) {
      const files = fs.readdirSync(TEST_DATA_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(TEST_DATA_DIR, file));
      });
      fs.rmdirSync(TEST_DATA_DIR);
    }
  });

  describe('isSupportedMimeType', () => {
    it('should return true for supported MIME types', () => {
      SUPPORTED_MIME_TYPES.forEach(mimeType => {
        expect(isSupportedMimeType(mimeType)).toBe(true);
      });
    });

    it('should return false for unsupported MIME types', () => {
      const unsupportedTypes = [
        'image/gif',
        'image/bmp',
        'image/svg+xml',
        'text/plain',
        'application/pdf',
        'video/mp4'
      ];

      unsupportedTypes.forEach(mimeType => {
        expect(isSupportedMimeType(mimeType)).toBe(false);
      });
    });

    it('should handle empty or invalid input', () => {
      expect(isSupportedMimeType('')).toBe(false);
      expect(isSupportedMimeType('invalid')).toBe(false);
    });
  });

  describe('isValidFileSize', () => {
    it('should return true for valid file sizes', () => {
      expect(isValidFileSize(1024)).toBe(true);
      expect(isValidFileSize(1024 * 1024)).toBe(true);
      expect(isValidFileSize(MAX_FILE_SIZE)).toBe(true);
    });

    it('should return false for invalid file sizes', () => {
      expect(isValidFileSize(0)).toBe(false);
      expect(isValidFileSize(-1)).toBe(false);
      expect(isValidFileSize(MAX_FILE_SIZE + 1)).toBe(false);
    });
  });

  describe('isValidFileCount', () => {
    it('should return true for valid file counts', () => {
      expect(isValidFileCount(1)).toBe(true);
      expect(isValidFileCount(5)).toBe(true);
      expect(isValidFileCount(MAX_FILES_PER_UPLOAD)).toBe(true);
    });

    it('should return false for invalid file counts', () => {
      expect(isValidFileCount(0)).toBe(false);
      expect(isValidFileCount(-1)).toBe(false);
      expect(isValidFileCount(MAX_FILES_PER_UPLOAD + 1)).toBe(false);
    });
  });

  describe('validateFileSignature', () => {
    it('should validate JPEG file signature', () => {
      const jpegPath = path.join(TEST_DATA_DIR, 'test.jpg');
      const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      fs.writeFileSync(jpegPath, jpegSignature);

      const result = validateFileSignature(jpegPath, 'image/jpeg');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate PNG file signature', () => {
      const pngPath = path.join(TEST_DATA_DIR, 'test.png');
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      fs.writeFileSync(pngPath, pngSignature);

      const result = validateFileSignature(pngPath, 'image/png');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate WebP file signature', () => {
      const webpPath = path.join(TEST_DATA_DIR, 'test.webp');
      const webpSignature = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // File size (placeholder)
        0x57, 0x45, 0x42, 0x50  // WEBP
      ]);
      fs.writeFileSync(webpPath, webpSignature);

      const result = validateFileSignature(webpPath, 'image/webp');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid file signatures', () => {
      const invalidPath = path.join(TEST_DATA_DIR, 'invalid.jpg');
      fs.writeFileSync(invalidPath, 'not a jpeg file');

      const result = validateFileSignature(invalidPath, 'image/jpeg');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File signature does not match expected MIME type: image/jpeg');
    });

    it('should handle non-existent files', () => {
      const nonExistentPath = path.join(TEST_DATA_DIR, 'nonexistent.jpg');
      
      const result = validateFileSignature(nonExistentPath, 'image/jpeg');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateFileExtension', () => {
    it('should validate correct file extensions', () => {
      const testCases = [
        { filename: 'image.jpg', mimeType: 'image/jpeg' },
        { filename: 'image.jpeg', mimeType: 'image/jpeg' },
        { filename: 'image.png', mimeType: 'image/png' },
        { filename: 'image.webp', mimeType: 'image/webp' },
        { filename: 'image.tiff', mimeType: 'image/tiff' },
        { filename: 'image.tif', mimeType: 'image/tiff' }
      ];

      testCases.forEach(({ filename, mimeType }) => {
        const result = validateFileExtension(filename, mimeType);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject incorrect file extensions', () => {
      const testCases = [
        { filename: 'image.png', mimeType: 'image/jpeg' },
        { filename: 'image.jpg', mimeType: 'image/png' },
        { filename: 'image.gif', mimeType: 'image/jpeg' },
        { filename: 'document.pdf', mimeType: 'image/jpeg' }
      ];

      testCases.forEach(({ filename, mimeType }) => {
        const result = validateFileExtension(filename, mimeType);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize unsafe characters', () => {
      const testCases = [
        { input: 'file with spaces.jpg', expected: 'file_with_spaces.jpg' },
        { input: 'file/with\\slashes.png', expected: 'file_with_slashes.png' },
        { input: 'file<>with|special*.webp', expected: 'file_with_special.webp' },
        { input: '___multiple___underscores___.tiff', expected: 'multiple_underscores.tiff' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = sanitizeFilename(input);
        expect(result).toBe(expected);
      });
    });

    it('should limit filename length', () => {
      const longFilename = 'a'.repeat(300) + '.jpg';
      const result = sanitizeFilename(longFilename);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe('validateUploadedFile', () => {
    const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'images',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024 * 1024, // 1MB
      destination: TEST_DATA_DIR,
      filename: 'test.jpg',
      path: path.join(TEST_DATA_DIR, 'test.jpg'),
      buffer: Buffer.alloc(0),
      stream: {} as any,
      ...overrides
    });

    beforeEach(() => {
      // Create a valid JPEG file for testing
      const jpegPath = path.join(TEST_DATA_DIR, 'test.jpg');
      const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      fs.writeFileSync(jpegPath, jpegSignature);
    });

    it('should validate a correct file', () => {
      const file = createMockFile();
      const result = validateUploadedFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unsupported MIME types', () => {
      const file = createMockFile({ mimetype: 'image/gif' });
      const result = validateUploadedFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Unsupported file type'))).toBe(true);
    });

    it('should reject oversized files', () => {
      const file = createMockFile({ size: MAX_FILE_SIZE + 1 });
      const result = validateUploadedFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('exceeds maximum allowed size'))).toBe(true);
    });

    it('should reject files with empty names', () => {
      const file = createMockFile({ originalname: '' });
      const result = validateUploadedFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('valid name'))).toBe(true);
    });

    it('should handle null file input', () => {
      const result = validateUploadedFile(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No file provided');
    });
  });

  describe('validateUploadedFiles', () => {
    const createMockFiles = (count: number): Express.Multer.File[] => {
      return Array.from({ length: count }, (_, i) => ({
        fieldname: 'images',
        originalname: `test${i}.jpg`,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024 * 1024,
        destination: TEST_DATA_DIR,
        filename: `test${i}.jpg`,
        path: path.join(TEST_DATA_DIR, `test${i}.jpg`),
        buffer: Buffer.alloc(0),
        stream: {} as any
      }));
    };

    beforeEach(() => {
      // Create valid JPEG files for testing
      for (let i = 0; i < 5; i++) {
        const jpegPath = path.join(TEST_DATA_DIR, `test${i}.jpg`);
        const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
        fs.writeFileSync(jpegPath, jpegSignature);
      }
    });

    it('should validate multiple correct files', () => {
      const files = createMockFiles(3);
      const result = validateUploadedFiles(files);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject too many files', () => {
      const files = createMockFiles(MAX_FILES_PER_UPLOAD + 1);
      const result = validateUploadedFiles(files);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('exceeds maximum allowed'))).toBe(true);
    });

    it('should detect duplicate filenames', () => {
      const files = createMockFiles(2);
      files[1].originalname = files[0].originalname; // Create duplicate
      
      const result = validateUploadedFiles(files);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Duplicate filenames'))).toBe(true);
    });

    it('should handle empty file array', () => {
      const result = validateUploadedFiles([]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No files provided');
    });

    it('should handle null input', () => {
      const result = validateUploadedFiles(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No files provided');
    });
  });
});