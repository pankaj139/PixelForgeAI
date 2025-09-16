import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FileStorageService, createDefaultStorageConfig } from '../fileStorage';

// Test directories
const TEST_BASE_DIR = path.join(__dirname, 'test-storage');
const TEST_UPLOAD_DIR = path.join(TEST_BASE_DIR, 'uploads');
const TEST_PROCESSED_DIR = path.join(TEST_BASE_DIR, 'processed');
const TEST_TEMP_DIR = path.join(TEST_BASE_DIR, 'temp');

describe('FileStorageService', () => {
  let storageService: FileStorageService;

  beforeEach(() => {
    // Clean up and create test directories
    if (fs.existsSync(TEST_BASE_DIR)) {
      fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
    }

    const config = {
      uploadDir: TEST_UPLOAD_DIR,
      processedDir: TEST_PROCESSED_DIR,
      tempDir: TEST_TEMP_DIR,
      maxAge: 1000 // 1 second for testing
    };

    storageService = new FileStorageService(config);
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(TEST_BASE_DIR)) {
      fs.rmSync(TEST_BASE_DIR, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create required directories', () => {
      expect(fs.existsSync(TEST_UPLOAD_DIR)).toBe(true);
      expect(fs.existsSync(TEST_PROCESSED_DIR)).toBe(true);
      expect(fs.existsSync(TEST_TEMP_DIR)).toBe(true);
    });
  });

  describe('storeUploadedFile', () => {
    it('should store an uploaded file successfully', async () => {
      // Create a mock uploaded file
      const tempFilePath = path.join(TEST_TEMP_DIR, 'temp-file.jpg');
      fs.writeFileSync(tempFilePath, 'test file content');

      const mockFile: Express.Multer.File = {
        fieldname: 'images',
        originalname: 'test-image.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 17, // Length of 'test file content'
        destination: TEST_TEMP_DIR,
        filename: 'temp-file.jpg',
        path: tempFilePath,
        buffer: Buffer.alloc(0),
        stream: {} as any
      };

      const result = await storageService.storeUploadedFile(mockFile);

      expect(result.id).toBeDefined();
      expect(result.originalName).toBe('test-image.jpg');
      expect(result.size).toBe(17);
      expect(result.mimeType).toBe('image/jpeg');
      expect(fs.existsSync(result.storedPath)).toBe(true);
      expect(fs.existsSync(tempFilePath)).toBe(false); // Original should be deleted
    });

    it('should handle file storage errors', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'images',
        originalname: 'test-image.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100,
        destination: TEST_TEMP_DIR,
        filename: 'nonexistent.jpg',
        path: path.join(TEST_TEMP_DIR, 'nonexistent.jpg'), // File doesn't exist
        buffer: Buffer.alloc(0),
        stream: {} as any
      };

      await expect(storageService.storeUploadedFile(mockFile)).rejects.toThrow('Failed to store file');
    });
  });

  describe('storeProcessedFile', () => {
    it('should store a processed file successfully', async () => {
      // Create source file
      const sourceFile = path.join(TEST_UPLOAD_DIR, 'source.jpg');
      fs.writeFileSync(sourceFile, 'processed content');

      const processedPath = await storageService.storeProcessedFile(sourceFile, 'original.jpg', '_converted');

      expect(fs.existsSync(processedPath)).toBe(true);
      expect(processedPath).toContain('_converted');
      expect(fs.readFileSync(processedPath, 'utf8')).toBe('processed content');
    });

    it('should handle missing source file', async () => {
      const nonexistentSource = path.join(TEST_UPLOAD_DIR, 'nonexistent.jpg');

      await expect(
        storageService.storeProcessedFile(nonexistentSource, 'original.jpg')
      ).rejects.toThrow('Failed to store processed file');
    });
  });

  describe('createTempFilePath', () => {
    it('should create unique temporary file paths', () => {
      const path1 = storageService.createTempFilePath('test.jpg');
      const path2 = storageService.createTempFilePath('test.jpg');

      expect(path1).not.toBe(path2);
      expect(path1).toContain(TEST_TEMP_DIR);
      expect(path1).toContain('.jpg');
    });
  });

  describe('deleteFile', () => {
    it('should delete existing files', async () => {
      const testFile = path.join(TEST_UPLOAD_DIR, 'test-delete.txt');
      fs.writeFileSync(testFile, 'delete me');

      expect(fs.existsSync(testFile)).toBe(true);
      
      await storageService.deleteFile(testFile);
      
      expect(fs.existsSync(testFile)).toBe(false);
    });

    it('should handle non-existent files gracefully', async () => {
      const nonexistentFile = path.join(TEST_UPLOAD_DIR, 'nonexistent.txt');
      
      // Should not throw
      await expect(storageService.deleteFile(nonexistentFile)).resolves.toBeUndefined();
    });
  });

  describe('deleteFiles', () => {
    it('should delete multiple files', async () => {
      const files = [
        path.join(TEST_UPLOAD_DIR, 'file1.txt'),
        path.join(TEST_UPLOAD_DIR, 'file2.txt'),
        path.join(TEST_UPLOAD_DIR, 'file3.txt')
      ];

      // Create test files
      files.forEach(file => fs.writeFileSync(file, 'test content'));

      // Verify files exist
      files.forEach(file => expect(fs.existsSync(file)).toBe(true));

      await storageService.deleteFiles(files);

      // Verify files are deleted
      files.forEach(file => expect(fs.existsSync(file)).toBe(false));
    });
  });

  describe('cleanupOldFiles', () => {
    it('should clean up old files based on maxAge', async () => {
      // Create old files (modify mtime to be older than maxAge)
      const oldFile1 = path.join(TEST_UPLOAD_DIR, 'old1.txt');
      const oldFile2 = path.join(TEST_PROCESSED_DIR, 'old2.txt');
      const newFile = path.join(TEST_TEMP_DIR, 'new.txt');

      fs.writeFileSync(oldFile1, 'old content 1');
      fs.writeFileSync(oldFile2, 'old content 2');
      fs.writeFileSync(newFile, 'new content');

      // Make files appear old by modifying their mtime
      const oldTime = new Date(Date.now() - 2000); // 2 seconds ago (older than maxAge of 1 second)
      fs.utimesSync(oldFile1, oldTime, oldTime);
      fs.utimesSync(oldFile2, oldTime, oldTime);

      const result = await storageService.cleanupOldFiles();

      expect(result.deleted).toBe(2);
      expect(fs.existsSync(oldFile1)).toBe(false);
      expect(fs.existsSync(oldFile2)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true); // New file should remain
    });
  });

  describe('getFileInfo', () => {
    it('should return file information for existing files', async () => {
      const testFile = path.join(TEST_UPLOAD_DIR, 'info-test.txt');
      const content = 'test content for info';
      fs.writeFileSync(testFile, content);

      const info = await storageService.getFileInfo(testFile);

      expect(info.exists).toBe(true);
      expect(info.size).toBe(content.length);
      expect(info.mtime).toBeInstanceOf(Date);
    });

    it('should return exists: false for non-existent files', async () => {
      const nonexistentFile = path.join(TEST_UPLOAD_DIR, 'nonexistent.txt');
      
      const info = await storageService.getFileInfo(nonexistentFile);

      expect(info.exists).toBe(false);
      expect(info.size).toBeUndefined();
      expect(info.mtime).toBeUndefined();
    });
  });

  describe('getStorageUsage', () => {
    it('should calculate storage usage correctly', async () => {
      // Create files in different directories
      const uploadFile = path.join(TEST_UPLOAD_DIR, 'upload.txt');
      const processedFile = path.join(TEST_PROCESSED_DIR, 'processed.txt');
      const tempFile = path.join(TEST_TEMP_DIR, 'temp.txt');

      fs.writeFileSync(uploadFile, 'a'.repeat(100)); // 100 bytes
      fs.writeFileSync(processedFile, 'b'.repeat(200)); // 200 bytes
      fs.writeFileSync(tempFile, 'c'.repeat(50)); // 50 bytes

      const usage = await storageService.getStorageUsage();

      expect(usage.uploadDir).toBe(100);
      expect(usage.processedDir).toBe(200);
      expect(usage.tempDir).toBe(50);
      expect(usage.total).toBe(350);
    });

    it('should handle empty directories', async () => {
      const usage = await storageService.getStorageUsage();

      expect(usage.uploadDir).toBe(0);
      expect(usage.processedDir).toBe(0);
      expect(usage.tempDir).toBe(0);
      expect(usage.total).toBe(0);
    });
  });

  describe('validateStoragePermissions', () => {
    it('should validate write permissions for all directories', async () => {
      const validation = await storageService.validateStoragePermissions();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('createDefaultStorageConfig', () => {
    it('should create default configuration with correct paths', () => {
      const baseDir = '/test/base';
      const config = createDefaultStorageConfig(baseDir);

      expect(config.uploadDir).toBe(path.join(baseDir, 'uploads'));
      expect(config.processedDir).toBe(path.join(baseDir, 'processed'));
      expect(config.tempDir).toBe(path.join(baseDir, 'temp'));
      expect(config.maxAge).toBe(24 * 60 * 60 * 1000); // 24 hours
    });
  });
});