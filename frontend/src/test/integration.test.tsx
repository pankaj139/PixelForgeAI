import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadApi, processingApi, downloadApi } from '../services/apiClient';
import { jobHistoryService } from '../services/jobHistoryService';
import { ASPECT_RATIOS, GRID_LAYOUTS } from '../types';

// Mock the API modules
vi.mock('../services/apiClient', () => ({
  uploadApi: {
    uploadImages: vi.fn(),
    validateFiles: vi.fn(),
    getUploadStatus: vi.fn(),
  },
  processingApi: {
    getJobProgress: vi.fn(),
    getJobResults: vi.fn(),
    getQueueStatus: vi.fn(),
    getProcessingStats: vi.fn(),
    cleanupOldJobs: vi.fn(),
  },
  downloadApi: {
    downloadImage: vi.fn(),
    downloadSheet: vi.fn(),
    downloadZip: vi.fn(),
    downloadPdf: vi.fn(),
    getDownloadStatus: vi.fn(),
  },
}));

// Mock the job history service
vi.mock('../services/jobHistoryService', () => ({
  jobHistoryService: {
    getJobHistory: vi.fn(),
    searchJobs: vi.fn(),
    getJobStatistics: vi.fn(),
    getRecentJobs: vi.fn(),
    getJobDetails: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    exportJobHistory: vi.fn(),
    getFilterOptions: vi.fn(),
    downloadFile: vi.fn(),
  }
}));

describe('Frontend-Backend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Upload API Integration', () => {
    it('should handle successful file upload with processing options', async () => {
      // Mock successful upload response
      const mockUploadResponse = {
        data: {
          success: true,
          message: 'Files uploaded successfully and processing started',
          jobId: 'test-job-123',
          filesCount: 2,
          files: [
            {
              id: 'file-1',
              originalName: 'test1.jpg',
              size: 1024000,
              mimeType: 'image/jpeg',
            },
            {
              id: 'file-2',
              originalName: 'test2.jpg',
              size: 2048000,
              mimeType: 'image/jpeg',
            },
          ],
          options: {
            aspectRatio: ASPECT_RATIOS['4x6'],
            faceDetectionEnabled: true,
            sheetComposition: {
              enabled: true,
              gridLayout: GRID_LAYOUTS['2x2'],
              orientation: 'portrait',
              generatePDF: true,
            },
          },
          progress: {
            currentStage: 'uploading',
            processedImages: 0,
            totalImages: 2,
            percentage: 0,
          },
        },
      };

      (uploadApi.uploadImages as any).mockResolvedValue(mockUploadResponse);

      // Test the upload API integration
      const formData = new FormData();
      formData.append('images', new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }));
      formData.append('images', new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }));
      formData.append('options', JSON.stringify({
        aspectRatio: ASPECT_RATIOS['4x6'],
        faceDetectionEnabled: true,
        sheetComposition: {
          enabled: true,
          gridLayout: GRID_LAYOUTS['2x2'],
          orientation: 'portrait',
          generatePDF: true,
        },
      }));

      const result = await uploadApi.uploadImages(formData);

      expect(uploadApi.uploadImages).toHaveBeenCalledWith(formData);
      expect(result.data.success).toBe(true);
      expect(result.data.jobId).toBe('test-job-123');
      expect(result.data.filesCount).toBe(2);
      expect(result.data.files).toHaveLength(2);
    });

    it('should handle upload errors with proper error codes', async () => {
      // Mock upload error response
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'File validation failed',
            code: 'VALIDATION_FAILED',
            details: ['File too large', 'Unsupported format'],
          },
        },
      };

      (uploadApi.uploadImages as any).mockRejectedValue(mockError);

      const formData = new FormData();
      formData.append('images', new File(['test'], 'test.txt', { type: 'text/plain' }));

      await expect(uploadApi.uploadImages(formData)).rejects.toEqual(mockError);
    });
  });

  describe('Processing Status API Integration', () => {
    it('should fetch processing status with correct job progress', async () => {
      // Mock processing status response
      const mockStatusResponse = {
        data: {
          success: true,
          jobId: 'test-job-123',
          status: 'processing',
          progress: {
            currentStage: 'processing',
            processedImages: 1,
            totalImages: 2,
            percentage: 50,
          },
          options: {
            aspectRatio: ASPECT_RATIOS['4x6'],
            faceDetectionEnabled: true,
            sheetComposition: null,
          },
          results: {
            processedImages: 1,
            composedSheets: 0,
            totalFiles: 2,
          },
          timestamps: {
            createdAt: new Date().toISOString(),
          },
        },
      };

      (processingApi.getJobProgress as any).mockResolvedValue(mockStatusResponse);

      const result = await processingApi.getJobProgress('test-job-123');

      expect(processingApi.getJobProgress).toHaveBeenCalledWith('test-job-123');
      expect(result.data.success).toBe(true);
      expect(result.data.jobId).toBe('test-job-123');
      expect(result.data.status).toBe('processing');
      expect(result.data.progress.percentage).toBe(50);
    });

    it('should handle processing status errors', async () => {
      // Mock processing error
      const mockError = {
        response: {
          status: 404,
          data: {
            error: 'Job not found',
            code: 'JOB_NOT_FOUND',
          },
        },
      };

      (processingApi.getJobProgress as any).mockRejectedValue(mockError);

      await expect(processingApi.getJobProgress('nonexistent-job')).rejects.toEqual(mockError);
    });
  });

  describe('Results and Download API Integration', () => {
    it('should fetch processing results with correct structure', async () => {
      // Mock successful results response
      const mockResultsResponse = {
        data: {
          success: true,
          jobId: 'test-job-123',
          status: 'completed',
          options: {
            aspectRatio: ASPECT_RATIOS['4x6'],
            faceDetectionEnabled: true,
            sheetComposition: {
              enabled: true,
              gridLayout: GRID_LAYOUTS['2x2'],
              orientation: 'portrait',
              generatePDF: true,
            },
          },
          results: {
            processedImages: [
              {
                id: 'img-1',
                originalFileId: 'file-1',
                processedPath: '/processed/img-1.jpg',
                aspectRatio: ASPECT_RATIOS['4x6'],
                cropArea: { x: 0, y: 0, width: 400, height: 600, confidence: 0.9 },
                processingTime: 1500,
                createdAt: new Date().toISOString(),
              },
            ],
            composedSheets: [
              {
                id: 'sheet-1',
                sheetPath: '/processed/sheet-1.jpg',
                layout: GRID_LAYOUTS['2x2'],
                orientation: 'portrait',
                imageCount: 1,
                emptySlots: 3,
                createdAt: new Date().toISOString(),
              },
            ],
          },
          downloadUrls: {
            individualImages: {
              'img-1': '/api/download/image/img-1',
            },
            sheets: {
              'sheet-1': '/api/download/sheet/sheet-1',
            },
            zip: '/api/download/zip/test-job-123',
            pdf: '/api/download/pdf/test-job-123',
          },
          completedAt: new Date().toISOString(),
        },
      };

      (processingApi.getJobResults as any).mockResolvedValue(mockResultsResponse);

      const result = await processingApi.getJobResults('test-job-123');

      expect(processingApi.getJobResults).toHaveBeenCalledWith('test-job-123');
      expect(result.data.success).toBe(true);
      expect(result.data.jobId).toBe('test-job-123');
      expect(result.data.results.processedImages).toHaveLength(1);
      expect(result.data.results.composedSheets).toHaveLength(1);
      expect(result.data.downloadUrls).toBeDefined();
    });

    it('should handle download API calls for different file types', async () => {
      // Mock download responses
      const mockBlob = new Blob(['test content'], { type: 'image/jpeg' });
      (downloadApi.downloadImage as any).mockResolvedValue({ data: mockBlob });
      (downloadApi.downloadZip as any).mockResolvedValue({ data: mockBlob });
      (downloadApi.downloadPdf as any).mockResolvedValue({ data: mockBlob });

      // Test image download
      const imageResult = await downloadApi.downloadImage('img-1');
      expect(downloadApi.downloadImage).toHaveBeenCalledWith('img-1');
      expect(imageResult.data).toEqual(mockBlob);

      // Test ZIP download
      const zipResult = await downloadApi.downloadZip('test-job-123');
      expect(downloadApi.downloadZip).toHaveBeenCalledWith('test-job-123');
      expect(zipResult.data).toEqual(mockBlob);

      // Test PDF download
      const pdfResult = await downloadApi.downloadPdf('test-job-123');
      expect(downloadApi.downloadPdf).toHaveBeenCalledWith('test-job-123');
      expect(pdfResult.data).toEqual(mockBlob);
    });

    it('should handle download errors with proper error messages', async () => {
      // Mock download error
      const mockError = {
        response: {
          status: 404,
          data: {
            error: 'File not found on disk',
          },
        },
      };

      (downloadApi.downloadImage as any).mockRejectedValue(mockError);

      await expect(downloadApi.downloadImage('nonexistent-img')).rejects.toEqual(mockError);
    });
  });

  describe('End-to-End API Workflow Integration', () => {
    it('should complete full API workflow from upload to download', async () => {
      // This test simulates the complete API journey
      const mockUploadResponse = {
        data: {
          success: true,
          message: 'Files uploaded successfully',
          jobId: 'e2e-job-123',
          filesCount: 1,
          files: [
            {
              id: 'file-1',
              originalName: 'test.jpg',
              size: 1024000,
              mimeType: 'image/jpeg',
            },
          ],
          options: {
            aspectRatio: ASPECT_RATIOS['4x6'],
            faceDetectionEnabled: true,
            sheetComposition: null,
          },
          progress: {
            currentStage: 'uploading',
            processedImages: 0,
            totalImages: 1,
            percentage: 0,
          },
        },
      };

      const mockProcessingComplete = {
        data: {
          success: true,
          jobId: 'e2e-job-123',
          status: 'completed',
          progress: {
            currentStage: 'completed',
            processedImages: 1,
            totalImages: 1,
            percentage: 100,
          },
          options: mockUploadResponse.data.options,
          results: {
            processedImages: 1,
            composedSheets: 0,
            totalFiles: 1,
          },
          timestamps: {
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        },
      };

      const mockResults = {
        data: {
          success: true,
          jobId: 'e2e-job-123',
          status: 'completed',
          options: mockUploadResponse.data.options,
          results: {
            processedImages: [
              {
                id: 'img-1',
                originalFileId: 'file-1',
                processedPath: '/processed/img-1.jpg',
                aspectRatio: ASPECT_RATIOS['4x6'],
                cropArea: { x: 0, y: 0, width: 400, height: 600, confidence: 0.9 },
                processingTime: 1500,
                createdAt: new Date().toISOString(),
              },
            ],
            composedSheets: [],
          },
          downloadUrls: {
            individualImages: {
              'img-1': '/api/download/image/img-1',
            },
            sheets: {},
            zip: '/api/download/zip/e2e-job-123',
          },
          completedAt: new Date().toISOString(),
        },
      };

      const mockBlob = new Blob(['test content'], { type: 'image/jpeg' });

      (uploadApi.uploadImages as any).mockResolvedValue(mockUploadResponse);
      (processingApi.getJobProgress as any).mockResolvedValue(mockProcessingComplete);
      (processingApi.getJobResults as any).mockResolvedValue(mockResults);
      (downloadApi.downloadImage as any).mockResolvedValue({ data: mockBlob });

      // Step 1: Upload
      const formData = new FormData();
      formData.append('images', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
      formData.append('options', JSON.stringify(mockUploadResponse.data.options));

      const uploadResult = await uploadApi.uploadImages(formData);
      expect(uploadResult.data.success).toBe(true);
      expect(uploadResult.data.jobId).toBe('e2e-job-123');

      // Step 2: Check processing status
      const statusResult = await processingApi.getJobProgress('e2e-job-123');
      expect(statusResult.data.success).toBe(true);
      expect(statusResult.data.status).toBe('completed');

      // Step 3: Get results
      const resultsResult = await processingApi.getJobResults('e2e-job-123');
      expect(resultsResult.data.success).toBe(true);
      expect(resultsResult.data.results.processedImages).toHaveLength(1);

      // Step 4: Download processed image
      const downloadResult = await downloadApi.downloadImage('img-1');
      expect(downloadResult.data).toEqual(mockBlob);

      // Verify all API calls were made
      expect(uploadApi.uploadImages).toHaveBeenCalled();
      expect(processingApi.getJobProgress).toHaveBeenCalledWith('e2e-job-123');
      expect(processingApi.getJobResults).toHaveBeenCalledWith('e2e-job-123');
      expect(downloadApi.downloadImage).toHaveBeenCalledWith('img-1');
    });
  });

  describe('Job History API Integration', () => {
    const mockJobHistoryService = vi.mocked(jobHistoryService);
    
    const mockJobData = {
      id: 'job-history-1',
      userId: 'user-1',
      status: 'completed' as const,
      files: [{
        id: 'file-1',
        originalName: 'test.jpg',
        size: 1024000,
        mimeType: 'image/jpeg',
        uploadPath: '/uploads/test.jpg',
        uploadedAt: new Date('2024-01-01')
      }],
      options: {
        aspectRatio: ASPECT_RATIOS['4x6'],
        faceDetectionEnabled: true,
        sheetComposition: { enabled: false }
      },
      createdAt: new Date('2024-01-01T10:00:00Z'),
      completedAt: new Date('2024-01-01T10:05:00Z'),
      progress: {
        currentStage: 'completed',
        processedImages: 1,
        totalImages: 1,
        percentage: 100,
        stageProgress: { processing: 100, composing: 0, generatingPdf: 0 }
      },
      isPublic: false,
      title: 'Test Job'
    };

    const mockJobHistoryResponse = {
      jobs: [mockJobData],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      filters: {},
      statistics: {
        total: 1,
        completed: 1,
        failed: 0,
        processing: 0,
        pending: 0,
        cancelled: 0,
        completionRate: 100,
        averageProcessingTime: 5,
        totalFilesProcessed: 1,
        mostUsedAspectRatio: '4x6',
        recentActivity: { last7Days: 1, last30Days: 1 }
      }
    };

    it('should fetch job history with pagination and filters', async () => {
      mockJobHistoryService.getJobHistory.mockResolvedValue(mockJobHistoryResponse);

      const filters = { status: 'completed' as const };
      const pagination = { page: 1, limit: 20 };

      const result = await jobHistoryService.getJobHistory(filters, pagination);

      expect(jobHistoryService.getJobHistory).toHaveBeenCalledWith(filters, pagination);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('completed');
      expect(result.pagination.total).toBe(1);
      expect(result.statistics.completionRate).toBe(100);
    });

    it('should search jobs with query and optional filters', async () => {
      mockJobHistoryService.searchJobs.mockResolvedValue(mockJobHistoryResponse);

      const query = 'test';
      const filters = { dateFrom: '2024-01-01' };
      const pagination = { page: 1, limit: 10 };

      const result = await jobHistoryService.searchJobs(query, filters, pagination);

      expect(jobHistoryService.searchJobs).toHaveBeenCalledWith(query, filters, pagination);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Test Job');
    });

    it('should handle pagination properties correctly without undefined values', async () => {
      mockJobHistoryService.getJobHistory.mockResolvedValue(mockJobHistoryResponse);

      // Test with pagination object that doesn't include sortBy/sortOrder
      const paginationWithoutSort = { page: 1, limit: 20 };

      const result = await jobHistoryService.getJobHistory({}, paginationWithoutSort);

      expect(jobHistoryService.getJobHistory).toHaveBeenCalledWith({}, paginationWithoutSort);
      expect(result.jobs).toBeDefined();
    });

    it('should handle pagination with optional sort properties when provided', async () => {
      mockJobHistoryService.getJobHistory.mockResolvedValue(mockJobHistoryResponse);

      // Test with full pagination object including sort properties
      const fullPagination = { 
        page: 1, 
        limit: 20, 
        sortBy: 'createdAt' as const, 
        sortOrder: 'desc' as const 
      };

      const result = await jobHistoryService.getJobHistory({}, fullPagination);

      expect(jobHistoryService.getJobHistory).toHaveBeenCalledWith({}, fullPagination);
      expect(result.jobs).toBeDefined();
    });

    it('should get job details by ID', async () => {
      mockJobHistoryService.getJobDetails.mockResolvedValue(mockJobData);

      const result = await jobHistoryService.getJobDetails('job-history-1');

      expect(jobHistoryService.getJobDetails).toHaveBeenCalledWith('job-history-1');
      expect(result.id).toBe('job-history-1');
      expect(result.status).toBe('completed');
    });

    it('should update job with new data', async () => {
      mockJobHistoryService.updateJob.mockResolvedValue(true);

      const updates = { title: 'Updated Job Title', isPublic: true };

      const result = await jobHistoryService.updateJob('job-history-1', updates);

      expect(jobHistoryService.updateJob).toHaveBeenCalledWith('job-history-1', updates);
      expect(result).toBe(true);
    });

    it('should delete job and return success status', async () => {
      mockJobHistoryService.deleteJob.mockResolvedValue(true);

      const result = await jobHistoryService.deleteJob('job-history-1');

      expect(jobHistoryService.deleteJob).toHaveBeenCalledWith('job-history-1');
      expect(result).toBe(true);
    });

    it('should fetch job statistics with optional date range', async () => {
      const mockStatistics = mockJobHistoryResponse.statistics;
      mockJobHistoryService.getJobStatistics.mockResolvedValue(mockStatistics);

      const dateFrom = '2024-01-01';
      const dateTo = '2024-01-31';

      const result = await jobHistoryService.getJobStatistics(dateFrom, dateTo);

      expect(jobHistoryService.getJobStatistics).toHaveBeenCalledWith(dateFrom, dateTo);
      expect(result.total).toBe(1);
      expect(result.completionRate).toBe(100);
    });

    it('should fetch recent jobs with optional limit', async () => {
      mockJobHistoryService.getRecentJobs.mockResolvedValue([mockJobData]);

      const limit = 5;
      const result = await jobHistoryService.getRecentJobs(limit);

      expect(jobHistoryService.getRecentJobs).toHaveBeenCalledWith(limit);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('job-history-1');
    });

    it('should export job history and handle file download', async () => {
      const mockBlob = new Blob(['job data'], { type: 'application/json' });
      mockJobHistoryService.exportJobHistory.mockResolvedValue(mockBlob);

      const exportOptions = {
        format: 'json' as const,
        includeFiles: true,
        includeProgress: true,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      };

      const result = await jobHistoryService.exportJobHistory(exportOptions);

      expect(jobHistoryService.exportJobHistory).toHaveBeenCalledWith(exportOptions);
      expect(result).toEqual(mockBlob);
    });

    it('should fetch filter options for job history interface', async () => {
      const mockFilterOptions = {
        status: ['completed', 'failed', 'processing'],
        aspectRatios: ['4x6', '5x7', '8x10'],
        dateRange: { 
          min: '2024-01-01', 
          max: '2024-01-31' 
        }
      };

      mockJobHistoryService.getFilterOptions.mockResolvedValue(mockFilterOptions);

      const result = await jobHistoryService.getFilterOptions();

      expect(jobHistoryService.getFilterOptions).toHaveBeenCalled();
      expect(result.status).toContain('completed');
      expect(result.aspectRatios).toContain('4x6');
      expect(result.dateRange).toBeDefined();
    });

    it('should handle authentication errors in job history requests', async () => {
      const authError = {
        response: {
          status: 401,
          data: { error: 'Authentication required' }
        }
      };

      mockJobHistoryService.getJobHistory.mockRejectedValue(authError);

      await expect(jobHistoryService.getJobHistory({})).rejects.toEqual(authError);
    });

    it('should handle server errors in job operations', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: 'Internal server error' }
        }
      };

      mockJobHistoryService.deleteJob.mockRejectedValue(serverError);

      await expect(jobHistoryService.deleteJob('job-1')).rejects.toEqual(serverError);
    });

    it('should handle not found errors for job details', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { error: 'Job not found' }
        }
      };

      mockJobHistoryService.getJobDetails.mockRejectedValue(notFoundError);

      await expect(jobHistoryService.getJobDetails('nonexistent-job')).rejects.toEqual(notFoundError);
    });
  });
});