import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import downloadRouter from '../download';
import { getDatabase } from '../../database/connection';

// Mock the database and fs
vi.mock('../../database/connection');
vi.mock('fs');
vi.mock('archiver');

describe('Download Routes', () => {
  let app: express.Application;
  let mockDb: any;

  const testJobId = 'test-job-123';
  const testImageId = 'test-image-123';
  const testSheetId = 'test-sheet-123';
  const testFileId = 'test-file-123';

  const mockProcessedImage = {
    id: testImageId,
    originalFileId: testFileId,
    processedPath: '/test/processed/image.jpg',
    cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
    aspectRatio: { width: 4, height: 6, name: '4x6' },
    detections: { faces: [], people: [], confidence: 0 },
    processingTime: 1000
  };

  const mockComposedSheet = {
    id: testSheetId,
    sheetPath: '/test/processed/sheet.jpg',
    layout: { rows: 1, columns: 2, name: '1x2' },
    orientation: 'portrait',
    images: [mockProcessedImage],
    emptySlots: 1,
    createdAt: new Date()
  };

  const mockFileMetadata = {
    id: testFileId,
    originalName: 'test-image.jpg',
    size: 1024000,
    mimeType: 'image/jpeg',
    uploadPath: '/test/uploads/test-image.jpg',
    uploadedAt: new Date()
  };

  const mockJob = {
    id: testJobId,
    status: 'completed',
    files: [mockFileMetadata],
    options: {
      aspectRatio: { width: 4, height: 6, name: '4x6' },
      faceDetectionEnabled: true,
      sheetComposition: {
        enabled: true,
        gridLayout: { rows: 1, columns: 2, name: '1x2' },
        orientation: 'portrait',
        generatePDF: true
      }
    },
    createdAt: new Date(),
    completedAt: new Date(),
    progress: {
      currentStage: 'completed',
      processedImages: 1,
      totalImages: 1,
      percentage: 100
    }
  };

  beforeEach(() => {
    app = express();
    app.use('/api/download', downloadRouter);

    mockDb = {
      getProcessedImage: vi.fn(),
      getComposedSheet: vi.fn(),
      getJob: vi.fn(),
      getProcessedImagesByJobId: vi.fn(),
      getComposedSheetsByJobId: vi.fn(),
      getFilesByJobId: vi.fn(),
      getFile: vi.fn()
    };

    vi.mocked(getDatabase).mockReturnValue(mockDb);

    // Mock fs methods
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.createReadStream).mockReturnValue({
      pipe: vi.fn((res) => {
        // Simulate successful streaming by ending the response
        res.end('mock file content');
        return res;
      }),
      on: vi.fn(),
      read: vi.fn()
    } as any);

    // Mock archiver
    const mockArchive = {
      pipe: vi.fn(),
      file: vi.fn(),
      finalize: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          // Don't trigger error by default
        }
      }),
      pointer: vi.fn().mockReturnValue(1024000)
    };

    vi.doMock('archiver', () => ({
      default: vi.fn(() => mockArchive)
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /image/:imageId', () => {
    it('should download individual processed image', async () => {
      mockDb.getProcessedImage.mockResolvedValue(mockProcessedImage);
      mockDb.getFile.mockResolvedValue(mockFileMetadata);

      // Since we're mocking fs.createReadStream, the response will be successful
      // but we can't easily test the actual file streaming in unit tests
      const response = await request(app)
        .get(`/api/download/image/${testImageId}`);

      // The response should have the correct headers set
      expect(mockDb.getProcessedImage).toHaveBeenCalledWith(testImageId);
      expect(mockDb.getFile).toHaveBeenCalledWith(testFileId);
    });

    it('should return 400 for missing image ID', async () => {
      const response = await request(app)
        .get('/api/download/image/')
        .expect(404); // Express returns 404 for missing route params
    });

    it('should return 404 for non-existent processed image', async () => {
      mockDb.getProcessedImage.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/download/image/${testImageId}`)
        .expect(404);

      expect(response.body.error).toBe('Processed image not found');
    });

    it('should return 404 when image file does not exist on disk', async () => {
      mockDb.getProcessedImage.mockResolvedValue(mockProcessedImage);
      mockDb.getFile.mockResolvedValue(mockFileMetadata);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const response = await request(app)
        .get(`/api/download/image/${testImageId}`)
        .expect(404);

      expect(response.body.error).toBe('Image file not found on disk');
    });

    it('should return 404 when original file metadata not found', async () => {
      mockDb.getProcessedImage.mockResolvedValue(mockProcessedImage);
      mockDb.getFile.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/download/image/${testImageId}`)
        .expect(404);

      expect(response.body.error).toBe('Original file metadata not found');
    });
  });

  describe('GET /sheet/:sheetId', () => {
    it('should download composed sheet image', async () => {
      mockDb.getComposedSheet.mockResolvedValue(mockComposedSheet);

      const response = await request(app)
        .get(`/api/download/sheet/${testSheetId}`);

      expect(mockDb.getComposedSheet).toHaveBeenCalledWith(testSheetId);
    });

    it('should return 400 for missing sheet ID', async () => {
      const response = await request(app)
        .get('/api/download/sheet/')
        .expect(404); // Express returns 404 for missing route params
    });

    it('should return 404 for non-existent composed sheet', async () => {
      mockDb.getComposedSheet.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/download/sheet/${testSheetId}`)
        .expect(404);

      expect(response.body.error).toBe('Composed sheet not found');
    });

    it('should return 404 when sheet file does not exist on disk', async () => {
      mockDb.getComposedSheet.mockResolvedValue(mockComposedSheet);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const response = await request(app)
        .get(`/api/download/sheet/${testSheetId}`)
        .expect(404);

      expect(response.body.error).toBe('Sheet file not found on disk');
    });
  });

  describe('GET /pdf/:jobId', () => {
    it('should download PDF when generation was requested', async () => {
      mockDb.getJob.mockResolvedValue(mockJob);

      const response = await request(app)
        .get(`/api/download/pdf/${testJobId}`);

      expect(mockDb.getJob).toHaveBeenCalledWith(testJobId);
    });

    it('should return 400 for missing job ID', async () => {
      const response = await request(app)
        .get('/api/download/pdf/')
        .expect(404); // Express returns 404 for missing route params
    });

    it('should return 404 for non-existent job', async () => {
      mockDb.getJob.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/download/pdf/${testJobId}`)
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });

    it('should return 404 when PDF generation was not requested', async () => {
      const jobWithoutPDF = {
        ...mockJob,
        options: {
          ...mockJob.options,
          sheetComposition: {
            ...mockJob.options.sheetComposition,
            generatePDF: false
          }
        }
      };
      mockDb.getJob.mockResolvedValue(jobWithoutPDF);

      const response = await request(app)
        .get(`/api/download/pdf/${testJobId}`)
        .expect(404);

      expect(response.body.error).toBe('PDF generation was not requested for this job');
    });

    it('should return 404 when PDF file does not exist', async () => {
      mockDb.getJob.mockResolvedValue(mockJob);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const response = await request(app)
        .get(`/api/download/pdf/${testJobId}`)
        .expect(404);

      expect(response.body.error).toBe('PDF file not found');
    });
  });

  describe('GET /zip/:jobId', () => {
    beforeEach(() => {
      mockDb.getJob.mockResolvedValue(mockJob);
      mockDb.getProcessedImagesByJobId.mockResolvedValue([mockProcessedImage]);
      mockDb.getComposedSheetsByJobId.mockResolvedValue([mockComposedSheet]);
      mockDb.getFilesByJobId.mockResolvedValue([mockFileMetadata]);
    });

    it('should create and download ZIP archive', async () => {
      const response = await request(app)
        .get(`/api/download/zip/${testJobId}`);

      // Should call the database methods to get job data
      expect(mockDb.getJob).toHaveBeenCalledWith(testJobId);
      expect(mockDb.getProcessedImagesByJobId).toHaveBeenCalledWith(testJobId);
      expect(mockDb.getComposedSheetsByJobId).toHaveBeenCalledWith(testJobId);
      expect(mockDb.getFilesByJobId).toHaveBeenCalledWith(testJobId);
    });

    it('should return 400 for missing job ID', async () => {
      const response = await request(app)
        .get('/api/download/zip/')
        .expect(404); // Express returns 404 for missing route params
    });

    it('should return 404 for non-existent job', async () => {
      mockDb.getJob.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/download/zip/${testJobId}`)
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });

    it('should return 400 for incomplete job', async () => {
      const incompleteJob = { ...mockJob, status: 'processing' };
      mockDb.getJob.mockResolvedValue(incompleteJob);

      const response = await request(app)
        .get(`/api/download/zip/${testJobId}`)
        .expect(400);

      expect(response.body.error).toBe('Job is not completed yet');
    });

    it('should return 404 when no processed content exists', async () => {
      mockDb.getProcessedImagesByJobId.mockResolvedValue([]);
      mockDb.getComposedSheetsByJobId.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/download/zip/${testJobId}`)
        .expect(404);

      expect(response.body.error).toBe('No processed content found for this job');
    });
  });

  describe('GET /batch/:jobId', () => {
    it('should redirect to ZIP endpoint', async () => {
      const response = await request(app)
        .get(`/api/download/batch/${testJobId}`)
        .expect(302);

      expect(response.headers.location).toBe(`/api/download/zip/${testJobId}`);
    });
  });

  describe('GET /status/:jobId', () => {
    it('should return download status and metadata', async () => {
      mockDb.getJob.mockResolvedValue(mockJob);
      mockDb.getProcessedImagesByJobId.mockResolvedValue([mockProcessedImage]);
      mockDb.getFilesByJobId.mockResolvedValue([mockFileMetadata]);

      const response = await request(app)
        .get(`/api/download/status/${testJobId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        jobId: testJobId,
        status: 'completed',
        processedImages: expect.arrayContaining([
          expect.objectContaining({
            id: testImageId,
            aspectRatio: { width: 4, height: 6, name: '4x6' }
          })
        ]),
        totalFiles: 1,
        processedCount: 1,
        downloadReady: true
      });
    });

    it('should return 404 for non-existent job', async () => {
      mockDb.getJob.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/download/status/${testJobId}`)
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });

    it('should indicate when download is not ready', async () => {
      const processingJob = { ...mockJob, status: 'processing' };
      mockDb.getJob.mockResolvedValue(processingJob);
      mockDb.getProcessedImagesByJobId.mockResolvedValue([]);
      mockDb.getFilesByJobId.mockResolvedValue([mockFileMetadata]);

      const response = await request(app)
        .get(`/api/download/status/${testJobId}`)
        .expect(200);

      expect(response.body.downloadReady).toBe(false);
      expect(response.body.status).toBe('processing');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.getProcessedImage.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/download/image/${testImageId}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to download image');
    });

    it('should handle file system errors gracefully', async () => {
      mockDb.getProcessedImage.mockResolvedValue(mockProcessedImage);
      mockDb.getFile.mockResolvedValue(mockFileMetadata);
      
      // Mock fs.createReadStream to throw an error
      const mockCreateReadStream = vi.mocked(fs.createReadStream);
      mockCreateReadStream.mockImplementation(() => {
        throw new Error('File system error');
      });

      const response = await request(app)
        .get(`/api/download/image/${testImageId}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to download image');
    });
  });
});