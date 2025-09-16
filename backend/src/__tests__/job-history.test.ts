/**
 * Job History Service Tests
 * 
 * Purpose: Comprehensive unit and integration tests for the job history service,
 * including filtering, search, pagination, statistics, and job management operations.
 * 
 * Test Coverage:
 * - Job history retrieval with various filters
 * - Search functionality with different query types
 * - Pagination with different page sizes and sorting
 * - Job statistics calculation
 * - Job management operations (update, delete)
 * - Export functionality
 * - Error handling and edge cases
 * 
 * Updates:
 * - Initial implementation with comprehensive test coverage
 * - Added tests for all major job history features
 * - Integrated with existing test infrastructure
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jobHistoryService } from '../services/jobHistoryService';
import { getDatabase } from '../database/connection';
import { Job, JobProgress, ProcessingOptions } from '../types';

// Mock the database
vi.mock('../database/connection', () => ({
  getDatabase: vi.fn()
}));

describe('JobHistoryService', () => {
  let mockDb: any;
  let mockJobs: Job[];

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock database
    mockDb = {
      getJobsByUserId: vi.fn(),
      getJob: vi.fn(),
      updateJob: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
      deleteProcessedImage: vi.fn(),
      deleteComposedSheet: vi.fn(),
      userOwnsJob: vi.fn()
    };

    (getDatabase as any).mockReturnValue(mockDb);

    // Create mock jobs data
    mockJobs = [
      {
        id: 'job-1',
        userId: 'user-1',
        status: 'completed',
        files: [
          {
            id: 'file-1',
            originalName: 'test1.jpg',
            size: 1024000,
            mimeType: 'image/jpeg',
            uploadPath: '/uploads/test1.jpg',
            uploadedAt: new Date('2024-01-01')
          }
        ],
        options: {
          aspectRatio: { name: '5x7', width: 5, height: 7 },
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
        title: 'Test Job 1'
      },
      {
        id: 'job-2',
        userId: 'user-1',
        status: 'failed',
        files: [
          {
            id: 'file-2',
            originalName: 'test2.jpg',
            size: 2048000,
            mimeType: 'image/jpeg',
            uploadPath: '/uploads/test2.jpg',
            uploadedAt: new Date('2024-01-02')
          }
        ],
        options: {
          aspectRatio: { name: '4x6', width: 4, height: 6 },
          faceDetectionEnabled: false,
          sheetComposition: { enabled: true }
        },
        createdAt: new Date('2024-01-02T10:00:00Z'),
        progress: {
          currentStage: 'failed',
          processedImages: 0,
          totalImages: 1,
          percentage: 0,
          stageProgress: { processing: 0, composing: 0, generatingPdf: 0 }
        },
        isPublic: true,
        title: 'Test Job 2',
        errorMessage: 'Processing failed'
      },
      {
        id: 'job-3',
        userId: 'user-1',
        status: 'processing',
        files: [
          {
            id: 'file-3',
            originalName: 'vacation.jpg',
            size: 1536000,
            mimeType: 'image/jpeg',
            uploadPath: '/uploads/vacation.jpg',
            uploadedAt: new Date('2024-01-03')
          }
        ],
        options: {
          aspectRatio: { name: '5x7', width: 5, height: 7 },
          faceDetectionEnabled: true,
          sheetComposition: { enabled: false }
        },
        createdAt: new Date('2024-01-03T10:00:00Z'),
        progress: {
          currentStage: 'processing',
          processedImages: 0,
          totalImages: 1,
          percentage: 25,
          stageProgress: { processing: 25, composing: 0, generatingPdf: 0 }
        },
        isPublic: false,
        title: 'Vacation Photos'
      }
    ];

    mockDb.getJobsByUserId.mockResolvedValue(mockJobs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserJobHistory', () => {
    it('should return paginated job history with default filters', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1');

      expect(result.jobs).toHaveLength(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(3);
      expect(result.statistics.total).toBe(3);
      expect(result.statistics.completed).toBe(1);
      expect(result.statistics.failed).toBe(1);
      expect(result.statistics.processing).toBe(1);
    });

    it('should apply status filter correctly', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1', {
        status: 'completed'
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('completed');
    });

    it('should apply date range filter correctly', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1', {
        dateFrom: new Date('2024-01-02'),
        dateTo: new Date('2024-01-02')
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe('job-2');
    });

    it('should apply aspect ratio filter correctly', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1', {
        aspectRatio: '5x7'
      });

      expect(result.jobs).toHaveLength(2);
      expect(result.jobs.every(job => job.options.aspectRatio.name === '5x7')).toBe(true);
    });

    it('should apply search filter correctly', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1', {
        search: 'vacation'
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Vacation Photos');
    });

    it('should apply public/private filter correctly', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1', {
        isPublic: true
      });

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].isPublic).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1', {}, {
        page: 1,
        limit: 2
      });

      expect(result.jobs).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should sort jobs correctly', async () => {
      const result = await jobHistoryService.getUserJobHistory('user-1', {}, {
        sortBy: 'title',
        sortOrder: 'asc'
      });

      expect(result.jobs[0].title).toBe('Test Job 1');
      expect(result.jobs[1].title).toBe('Test Job 2');
      expect(result.jobs[2].title).toBe('Vacation Photos');
    });

    it('should handle empty results', async () => {
      mockDb.getJobsByUserId.mockResolvedValue([]);

      const result = await jobHistoryService.getUserJobHistory('user-1');

      expect(result.jobs).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.statistics.total).toBe(0);
    });

    it('should throw error when database fails', async () => {
      mockDb.getJobsByUserId.mockRejectedValue(new Error('Database error'));

      await expect(jobHistoryService.getUserJobHistory('user-1'))
        .rejects.toThrow('Failed to retrieve job history');
    });
  });

  describe('getUserJobStatistics', () => {
    it('should calculate statistics correctly', async () => {
      const result = await jobHistoryService.getUserJobStatistics('user-1');

      expect(result.total).toBe(3);
      expect(result.completed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.processing).toBe(1);
      expect(result.pending).toBe(0);
      expect(result.cancelled).toBe(0);
      expect(result.completionRate).toBe(33.33);
      expect(result.totalFilesProcessed).toBe(3);
      expect(result.mostUsedAspectRatio).toBe('5x7');
      expect(result.recentActivity.last7Days).toBe(3);
      expect(result.recentActivity.last30Days).toBe(3);
    });

    it('should calculate average processing time correctly', async () => {
      const result = await jobHistoryService.getUserJobStatistics('user-1');

      // Job 1 took 5 minutes (300000ms)
      expect(result.averageProcessingTime).toBe(5);
    });

    it('should apply date range filter to statistics', async () => {
      const result = await jobHistoryService.getUserJobStatistics('user-1', {
        from: new Date('2024-01-02'),
        to: new Date('2024-01-02')
      });

      expect(result.total).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('searchUserJobs', () => {
    it('should search jobs by title', async () => {
      const result = await jobHistoryService.searchUserJobs('user-1', 'vacation');

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].title).toBe('Vacation Photos');
    });

    it('should search jobs by file names', async () => {
      const result = await jobHistoryService.searchUserJobs('user-1', 'test1');

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].files[0].originalName).toBe('test1.jpg');
    });

    it('should return empty results for no matches', async () => {
      const result = await jobHistoryService.searchUserJobs('user-1', 'nonexistent');

      expect(result.jobs).toHaveLength(0);
    });
  });

  describe('getRecentJobs', () => {
    it('should return recent jobs sorted by creation date', async () => {
      const result = await jobHistoryService.getRecentJobs('user-1', 2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('job-3'); // Most recent
      expect(result[1].id).toBe('job-2');
    });

    it('should respect limit parameter', async () => {
      const result = await jobHistoryService.getRecentJobs('user-1', 1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('job-3');
    });
  });

  describe('getJobDetails', () => {
    it('should return job details for owned job', async () => {
      mockDb.getJob.mockResolvedValue(mockJobs[0]);
      mockDb.userOwnsJob.mockResolvedValue(true);

      const result = await jobHistoryService.getJobDetails('user-1', 'job-1');

      expect(result).toEqual(mockJobs[0]);
    });

    it('should return null for non-owned job', async () => {
      mockDb.getJob.mockResolvedValue(mockJobs[0]);
      mockDb.userOwnsJob.mockResolvedValue(false);

      const result = await jobHistoryService.getJobDetails('user-1', 'job-1');

      expect(result).toBeNull();
    });

    it('should return null for non-existent job', async () => {
      mockDb.getJob.mockResolvedValue(null);

      const result = await jobHistoryService.getJobDetails('user-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateJob', () => {
    it('should update job successfully', async () => {
      mockDb.userOwnsJob.mockResolvedValue(true);
      mockDb.updateJob.mockResolvedValue(undefined);

      const result = await jobHistoryService.updateJob('user-1', 'job-1', {
        title: 'Updated Title',
        isPublic: true
      });

      expect(result).toBe(true);
      expect(mockDb.updateJob).toHaveBeenCalledWith('job-1', {
        title: 'Updated Title',
        isPublic: true
      });
    });

    it('should return false for non-owned job', async () => {
      mockDb.userOwnsJob.mockResolvedValue(false);

      const result = await jobHistoryService.updateJob('user-1', 'job-1', {
        title: 'Updated Title'
      });

      expect(result).toBe(false);
      expect(mockDb.updateJob).not.toHaveBeenCalled();
    });

    it('should throw error when update fails', async () => {
      mockDb.userOwnsJob.mockResolvedValue(true);
      mockDb.updateJob.mockRejectedValue(new Error('Update failed'));

      await expect(jobHistoryService.updateJob('user-1', 'job-1', {
        title: 'Updated Title'
      })).rejects.toThrow('Failed to update job');
    });
  });

  describe('deleteJob', () => {
    it('should delete job successfully', async () => {
      mockDb.userOwnsJob.mockResolvedValue(true);
      mockDb.getFilesByJobId.mockResolvedValue([]);
      mockDb.getProcessedImagesByJobId.mockResolvedValue([]);
      mockDb.getComposedSheetsByJobId.mockResolvedValue([]);
      mockDb.deleteJob.mockResolvedValue(undefined);

      const result = await jobHistoryService.deleteJob('user-1', 'job-1');

      expect(result).toBe(true);
      expect(mockDb.deleteJob).toHaveBeenCalledWith('job-1');
    });

    it('should return false for non-owned job', async () => {
      mockDb.userOwnsJob.mockResolvedValue(false);

      const result = await jobHistoryService.deleteJob('user-1', 'job-1');

      expect(result).toBe(false);
      expect(mockDb.deleteJob).not.toHaveBeenCalled();
    });

    it('should clean up associated files', async () => {
      const mockFiles = [{ id: 'file-1', uploadPath: '/uploads/test1.jpg' }];
      const mockProcessedImages = [{ id: 'img-1', processedPath: '/processed/test1.jpg' }];
      const mockComposedSheets = [{ id: 'sheet-1', sheetPath: '/sheets/sheet1.jpg' }];

      mockDb.userOwnsJob.mockResolvedValue(true);
      mockDb.getFilesByJobId.mockResolvedValue(mockFiles);
      mockDb.getProcessedImagesByJobId.mockResolvedValue(mockProcessedImages);
      mockDb.getComposedSheetsByJobId.mockResolvedValue(mockComposedSheets);
      mockDb.deleteJob.mockResolvedValue(undefined);

      // Mock fs operations
      const fs = require('fs');
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      const result = await jobHistoryService.deleteJob('user-1', 'job-1');

      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('exportJobHistory', () => {
    it('should export jobs as JSON', async () => {
      const result = await jobHistoryService.exportJobHistory('user-1', {
        format: 'json',
        includeFiles: true,
        includeProgress: true
      });

      expect(typeof result).toBe('string');
      const data = JSON.parse(result);
      expect(data).toHaveLength(3);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('files');
      expect(data[0]).toHaveProperty('progress');
    });

    it('should export jobs as CSV', async () => {
      const result = await jobHistoryService.exportJobHistory('user-1', {
        format: 'csv',
        includeFiles: false,
        includeProgress: false
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('id,title,status');
      expect(result).toContain('job-1,Test Job 1,completed');
    });

    it('should apply date range filter to export', async () => {
      const result = await jobHistoryService.exportJobHistory('user-1', {
        format: 'json',
        dateRange: {
          from: new Date('2024-01-02'),
          to: new Date('2024-01-02')
        }
      });

      const data = JSON.parse(result);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('job-2');
    });
  });
});
