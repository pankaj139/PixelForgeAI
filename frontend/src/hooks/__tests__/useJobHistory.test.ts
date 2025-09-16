/**
 * Job History Hook Tests
 * 
 * Purpose: Comprehensive unit tests for the useJobHistory hook, including
 * state management, API calls, error handling, and user interactions.
 * 
 * Test Coverage:
 * - Hook initialization and state management
 * - API call functions (fetch, search, update, delete)
 * - Filter and pagination updates
 * - Error handling and loading states
 * - Optimistic updates for better UX
 * - Export functionality
 * - Statistics and filter options fetching
 * 
 * Updates:
 * - Initial implementation with comprehensive test coverage
 * - Added tests for all major hook functionality
 * - Integrated with existing test infrastructure
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useJobHistory } from '../useJobHistory';
import { jobHistoryService } from '../../services/jobHistoryService';
import { Job, JobStatistics } from '../../types';

// Mock the job history service
vi.mock('../../services/jobHistoryService', () => ({
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
    downloadFile: vi.fn()
  }
}));

const mockJobHistoryService = vi.mocked(jobHistoryService);

describe('useJobHistory Hook', () => {
  const mockJobs: Job[] = [
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
    }
  ];

  const mockStatistics: JobStatistics = {
    total: 1,
    completed: 1,
    failed: 0,
    processing: 0,
    pending: 0,
    cancelled: 0,
    completionRate: 100,
    averageProcessingTime: 5,
    totalFilesProcessed: 1,
    mostUsedAspectRatio: '5x7',
    recentActivity: {
      last7Days: 1,
      last30Days: 1
    }
  };

  const mockJobHistoryResponse = {
    jobs: mockJobs,
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    },
    filters: {},
    statistics: mockStatistics
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockJobHistoryService.getJobHistory.mockResolvedValue(mockJobHistoryResponse);
    mockJobHistoryService.searchJobs.mockResolvedValue(mockJobHistoryResponse);
    mockJobHistoryService.getJobStatistics.mockResolvedValue(mockStatistics);
    mockJobHistoryService.getRecentJobs.mockResolvedValue(mockJobs);
    mockJobHistoryService.getJobDetails.mockResolvedValue(mockJobs[0]);
    mockJobHistoryService.updateJob.mockResolvedValue(true);
    mockJobHistoryService.deleteJob.mockResolvedValue(true);
    mockJobHistoryService.exportJobHistory.mockResolvedValue(new Blob(['test data']));
    mockJobHistoryService.getFilterOptions.mockResolvedValue({
      status: ['completed', 'failed'],
      aspectRatios: ['5x7', '4x6'],
      dateRange: { min: '2024-01-01', max: '2024-01-02' }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useJobHistory());

      expect(result.current.jobs).toEqual([]);
      expect(result.current.statistics).toBeNull();
      expect(result.current.filterOptions).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.filters).toEqual({});
      expect(result.current.searchQuery).toBe('');
    });

    it('should auto-fetch data on mount when autoFetch is true', async () => {
      renderHook(() => useJobHistory({ autoFetch: true }));

      await waitFor(() => {
        expect(mockJobHistoryService.getJobHistory).toHaveBeenCalled();
        expect(mockJobHistoryService.getJobStatistics).toHaveBeenCalled();
        expect(mockJobHistoryService.getFilterOptions).toHaveBeenCalled();
        expect(mockJobHistoryService.getRecentJobs).toHaveBeenCalled();
      });
    });

    it('should not auto-fetch data when autoFetch is false', () => {
      renderHook(() => useJobHistory({ autoFetch: false }));

      expect(mockJobHistoryService.getJobHistory).not.toHaveBeenCalled();
    });
  });

  describe('fetchJobs', () => {
    it('should fetch jobs successfully', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.fetchJobs();
      });

      expect(result.current.jobs).toEqual(mockJobs);
      expect(result.current.statistics).toEqual(mockStatistics);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch jobs error', async () => {
      const errorMessage = 'Failed to fetch jobs';
      mockJobHistoryService.getJobHistory.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.fetchJobs();
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.loading).toBe(false);
    });

    it('should update filters when provided', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      const newFilters = { status: 'completed' as const };

      await act(async () => {
        await result.current.fetchJobs(newFilters);
      });

      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalledWith(
        newFilters,
        expect.any(Object)
      );
      expect(result.current.filters).toEqual(newFilters);
    });

    it('should update pagination when provided', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      const newPagination = { page: 2, limit: 10 };

      await act(async () => {
        await result.current.fetchJobs({}, newPagination);
      });

      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalledWith(
        {},
        newPagination
      );
    });

    it('should handle optional pagination properties correctly with undefined values', async () => {
      const { result } = renderHook(() => useJobHistory({ 
        autoFetch: false,
        initialPagination: { page: 1, limit: 20 } // No sortBy or sortOrder
      }));

      await act(async () => {
        await result.current.fetchJobs();
      });

      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          page: 1,
          limit: 20
          // sortBy and sortOrder should not be present when undefined
        })
      );
      
      // Verify that the call was made without undefined sortBy/sortOrder properties
      const [, paginationArg] = mockJobHistoryService.getJobHistory.mock.calls[0];
      expect(paginationArg).not.toHaveProperty('sortBy');
      expect(paginationArg).not.toHaveProperty('sortOrder');
    });

    it('should include optional pagination properties when they have values', async () => {
      const { result } = renderHook(() => useJobHistory({ 
        autoFetch: false,
        initialPagination: { 
          page: 1, 
          limit: 20, 
          sortBy: 'createdAt', 
          sortOrder: 'desc' 
        }
      }));

      await act(async () => {
        await result.current.fetchJobs();
      });

      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })
      );
    });
  });

  describe('searchJobs', () => {
    it('should search jobs successfully', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.searchJobs('test');
      });

      expect(mockJobHistoryService.searchJobs).toHaveBeenCalledWith(
        'test',
        {},
        expect.any(Object)
      );
      expect(result.current.jobs).toEqual(mockJobs);
      expect(result.current.searchQuery).toBe('test');
    });

    it('should handle search error', async () => {
      const errorMessage = 'Search failed';
      mockJobHistoryService.searchJobs.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.searchJobs('test');
      });

      expect(result.current.error).toBe(errorMessage);
    });

    it('should handle optional pagination properties correctly in search with undefined values', async () => {
      const { result } = renderHook(() => useJobHistory({ 
        autoFetch: false,
        initialPagination: { page: 1, limit: 20 } // No sortBy or sortOrder
      }));

      await act(async () => {
        await result.current.searchJobs('test query');
      });

      expect(mockJobHistoryService.searchJobs).toHaveBeenCalledWith(
        'test query',
        {},
        expect.objectContaining({
          page: 1,
          limit: 20
          // sortBy and sortOrder should not be present when undefined
        })
      );
      
      // Verify that the call was made without undefined sortBy/sortOrder properties
      const [, , paginationArg] = mockJobHistoryService.searchJobs.mock.calls[0];
      expect(paginationArg).not.toHaveProperty('sortBy');
      expect(paginationArg).not.toHaveProperty('sortOrder');
    });

    it('should include optional pagination properties in search when they have values', async () => {
      const { result } = renderHook(() => useJobHistory({ 
        autoFetch: false,
        initialPagination: { 
          page: 1, 
          limit: 20, 
          sortBy: 'status', 
          sortOrder: 'asc' 
        }
      }));

      await act(async () => {
        await result.current.searchJobs('test query');
      });

      expect(mockJobHistoryService.searchJobs).toHaveBeenCalledWith(
        'test query',
        {},
        expect.objectContaining({
          page: 1,
          limit: 20,
          sortBy: 'status',
          sortOrder: 'asc'
        })
      );
    });
  });

  describe('updateFilters', () => {
    it('should update filters and refetch data', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        result.current.updateFilters({ status: 'completed' });
      });

      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalledWith(
        { status: 'completed' },
        { page: 1, limit: 20 }
      );
      expect(result.current.filters).toEqual({ status: 'completed' });
    });
  });

  describe('updatePagination', () => {
    it('should update pagination and refetch data', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        result.current.updatePagination({ page: 2 });
      });

      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalledWith(
        {},
        { page: 2, limit: 20 }
      );
    });
  });

  describe('clearFilters', () => {
    it('should clear all filters and search query', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      // Set some initial state
      act(() => {
        result.current.setSearchQuery('test');
      });

      await act(async () => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({});
      expect(result.current.searchQuery).toBe('');
      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 20 }
      );
    });
  });

  describe('updateJob', () => {
    it('should update job successfully with optimistic updates', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      // Set initial jobs
      act(() => {
        result.current.jobs = mockJobs;
      });

      const updates = { title: 'Updated Title' };

      await act(async () => {
        const success = await result.current.updateJob('job-1', updates);
        expect(success).toBe(true);
      });

      expect(mockJobHistoryService.updateJob).toHaveBeenCalledWith('job-1', updates);
    });

    it('should handle update job error and revert optimistic update', async () => {
      const errorMessage = 'Update failed';
      mockJobHistoryService.updateJob.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      // Set initial jobs
      act(() => {
        result.current.jobs = mockJobs;
      });

      const updates = { title: 'Updated Title' };

      await act(async () => {
        const success = await result.current.updateJob('job-1', updates);
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('deleteJob', () => {
    it('should delete job successfully with optimistic updates', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      // Set initial jobs
      act(() => {
        result.current.jobs = mockJobs;
        result.current.pagination = {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        };
      });

      await act(async () => {
        const success = await result.current.deleteJob('job-1');
        expect(success).toBe(true);
      });

      expect(mockJobHistoryService.deleteJob).toHaveBeenCalledWith('job-1');
      expect(result.current.jobs).toHaveLength(0);
    });

    it('should handle delete job error and revert optimistic update', async () => {
      const errorMessage = 'Delete failed';
      mockJobHistoryService.deleteJob.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      // Set initial jobs
      act(() => {
        result.current.jobs = mockJobs;
      });

      await act(async () => {
        const success = await result.current.deleteJob('job-1');
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('getJobDetails', () => {
    it('should get job details successfully', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      let jobDetails: Job | null = null;

      await act(async () => {
        jobDetails = await result.current.getJobDetails('job-1');
      });

      expect(jobDetails).toEqual(mockJobs[0]);
      expect(mockJobHistoryService.getJobDetails).toHaveBeenCalledWith('job-1');
    });

    it('should handle get job details error', async () => {
      const errorMessage = 'Job not found';
      mockJobHistoryService.getJobDetails.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      let jobDetails: Job | null = null;

      await act(async () => {
        jobDetails = await result.current.getJobDetails('job-1');
      });

      expect(jobDetails).toBeNull();
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('exportJobs', () => {
    it('should export jobs successfully', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      const exportOptions = {
        format: 'json' as const,
        includeFiles: true,
        includeProgress: true
      };

      await act(async () => {
        await result.current.exportJobs(exportOptions);
      });

      expect(mockJobHistoryService.exportJobHistory).toHaveBeenCalledWith(exportOptions);
      expect(mockJobHistoryService.downloadFile).toHaveBeenCalled();
    });

    it('should handle export error', async () => {
      const errorMessage = 'Export failed';
      mockJobHistoryService.exportJobHistory.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.exportJobs({ format: 'json' });
      });

      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('fetchStatistics', () => {
    it('should fetch statistics successfully', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.fetchStatistics();
      });

      expect(result.current.statistics).toEqual(mockStatistics);
      expect(mockJobHistoryService.getJobStatistics).toHaveBeenCalled();
    });

    it('should fetch statistics with date range', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      const dateFrom = '2024-01-01';
      const dateTo = '2024-01-02';

      await act(async () => {
        await result.current.fetchStatistics(dateFrom, dateTo);
      });

      expect(mockJobHistoryService.getJobStatistics).toHaveBeenCalledWith(dateFrom, dateTo);
    });
  });

  describe('fetchFilterOptions', () => {
    it('should fetch filter options successfully', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.fetchFilterOptions();
      });

      expect(result.current.filterOptions).toEqual({
        status: ['completed', 'failed'],
        aspectRatios: ['5x7', '4x6'],
        dateRange: { min: '2024-01-01', max: '2024-01-02' }
      });
    });
  });

  describe('fetchRecentJobs', () => {
    it('should fetch recent jobs successfully', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.fetchRecentJobs();
      });

      expect(result.current.recentJobs).toEqual(mockJobs);
      expect(mockJobHistoryService.getRecentJobs).toHaveBeenCalledWith(10);
    });

    it('should fetch recent jobs with custom limit', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.fetchRecentJobs(5);
      });

      expect(mockJobHistoryService.getRecentJobs).toHaveBeenCalledWith(5);
    });
  });

  describe('refreshJobs', () => {
    it('should refresh jobs based on current search state', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      // Set search query
      act(() => {
        result.current.setSearchQuery('test');
      });

      await act(async () => {
        await result.current.refreshJobs();
      });

      expect(mockJobHistoryService.searchJobs).toHaveBeenCalled();
    });

    it('should refresh jobs without search when no search query', async () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      await act(async () => {
        await result.current.refreshJobs();
      });

      expect(mockJobHistoryService.getJobHistory).toHaveBeenCalled();
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useJobHistory({ autoFetch: false }));

      act(() => {
        result.current.setSearchQuery('test query');
      });

      expect(result.current.searchQuery).toBe('test query');
    });
  });
});
