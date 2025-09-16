/**
 * Job History Component Tests
 * 
 * Purpose: Comprehensive unit and integration tests for the JobHistory component,
 * including rendering, user interactions, filtering, search, and job management.
 * 
 * Test Coverage:
 * - Component rendering with different states
 * - Filter and search functionality
 * - Pagination controls
 * - Job management operations
 * - Export functionality
 * - Error handling and loading states
 * - User interactions and accessibility
 * 
 * Updates:
 * - Initial implementation with comprehensive test coverage
 * - Added tests for all major job history features
 * - Integrated with existing test infrastructure
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import JobHistory from '../JobHistory';
import { useJobHistory } from '../../hooks/useJobHistory';
import { Job, JobStatistics } from '../../types';

// Mock the useJobHistory hook
vi.mock('../../hooks/useJobHistory');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: (date: Date) => '2 days ago'
}));

const mockUseJobHistory = vi.mocked(useJobHistory);

describe('JobHistory Component', () => {
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
    }
  ];

  const mockStatistics: JobStatistics = {
    total: 2,
    completed: 1,
    failed: 1,
    processing: 0,
    pending: 0,
    cancelled: 0,
    completionRate: 50,
    averageProcessingTime: 5,
    totalFilesProcessed: 2,
    mostUsedAspectRatio: '5x7',
    recentActivity: {
      last7Days: 2,
      last30Days: 2
    }
  };

  const mockFilterOptions = {
    status: ['completed', 'failed', 'processing'],
    aspectRatios: ['5x7', '4x6'],
    dateRange: {
      min: '2024-01-01',
      max: '2024-01-02'
    }
  };

  const defaultMockReturn = {
    jobs: mockJobs,
    statistics: mockStatistics,
    filterOptions: mockFilterOptions,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    },
    filters: {},
    searchQuery: '',
    fetchJobs: vi.fn(),
    searchJobs: vi.fn(),
    updateFilters: vi.fn(),
    updatePagination: vi.fn(),
    setSearchQuery: vi.fn(),
    clearFilters: vi.fn(),
    refreshJobs: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    getJobDetails: vi.fn(),
    exportJobs: vi.fn(),
    fetchStatistics: vi.fn(),
    fetchFilterOptions: vi.fn(),
    recentJobs: [],
    fetchRecentJobs: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJobHistory.mockReturnValue(defaultMockReturn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderJobHistory = () => {
    return render(
      <BrowserRouter>
        <JobHistory />
      </BrowserRouter>
    );
  };

  describe('Rendering', () => {
    it('should render job history component', () => {
      renderJobHistory();

      expect(screen.getByText('Job History')).toBeInTheDocument();
      expect(screen.getByText('Manage and view your image processing jobs')).toBeInTheDocument();
    });

    it('should render statistics cards', () => {
      renderJobHistory();

      expect(screen.getByText('Total Jobs')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Files Processed')).toBeInTheDocument();
    });

    it('should render search bar', () => {
      renderJobHistory();

      const searchInput = screen.getByPlaceholderText('Search jobs by title or file names...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should render filter and export buttons', () => {
      renderJobHistory();

      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('should render jobs table', () => {
      renderJobHistory();

      expect(screen.getByText('Job')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render job rows', () => {
      renderJobHistory();

      expect(screen.getByText('Test Job 1')).toBeInTheDocument();
      expect(screen.getByText('Test Job 2')).toBeInTheDocument();
      expect(screen.getByText('5x7')).toBeInTheDocument();
      expect(screen.getByText('4x6')).toBeInTheDocument();
    });

    it('should render status badges correctly', () => {
      renderJobHistory();

      const completedBadge = screen.getByText('Completed');
      const failedBadge = screen.getByText('Failed');

      expect(completedBadge).toBeInTheDocument();
      expect(failedBadge).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading and no jobs', () => {
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        loading: true,
        jobs: []
      });

      renderJobHistory();

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no jobs', () => {
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        jobs: []
      });

      renderJobHistory();

      expect(screen.getByText('No jobs found')).toBeInTheDocument();
      expect(screen.getByText("You haven't processed any images yet")).toBeInTheDocument();
      expect(screen.getByText('Start Processing Images')).toBeInTheDocument();
    });

    it('should show filtered empty state when filters applied', () => {
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        jobs: [],
        filters: { status: 'completed' }
      });

      renderJobHistory();

      expect(screen.getByText('No jobs found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your filters or search terms')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when error occurs', () => {
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to fetch jobs'
      });

      renderJobHistory();

      expect(screen.getByText('Failed to fetch jobs')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should call searchJobs when search input changes', async () => {
      const mockSearchJobs = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        searchJobs: mockSearchJobs
      });

      renderJobHistory();

      const searchInput = screen.getByPlaceholderText('Search jobs by title or file names...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(mockSearchJobs).toHaveBeenCalledWith('test', {}, expect.any(Object));
      });
    });

    it('should call fetchJobs when search input is cleared', async () => {
      const mockFetchJobs = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        fetchJobs: mockFetchJobs,
        searchQuery: 'test'
      });

      renderJobHistory();

      const searchInput = screen.getByPlaceholderText('Search jobs by title or file names...');
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        expect(mockFetchJobs).toHaveBeenCalled();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('should show filters when filter button is clicked', () => {
      renderJobHistory();

      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('From Date')).toBeInTheDocument();
      expect(screen.getByText('To Date')).toBeInTheDocument();
      expect(screen.getByText('Aspect Ratio')).toBeInTheDocument();
    });

    it('should call updateFilters when status filter changes', async () => {
      const mockUpdateFilters = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        updateFilters: mockUpdateFilters
      });

      renderJobHistory();

      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      await waitFor(() => {
        expect(mockUpdateFilters).toHaveBeenCalledWith({ status: 'completed' });
      });
    });

    it('should call updateFilters when date filter changes', async () => {
      const mockUpdateFilters = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        updateFilters: mockUpdateFilters
      });

      renderJobHistory();

      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      const dateFromInput = screen.getByLabelText('From Date');
      fireEvent.change(dateFromInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(mockUpdateFilters).toHaveBeenCalledWith({ dateFrom: '2024-01-01' });
      });
    });

    it('should call updateFilters when aspect ratio filter changes', async () => {
      const mockUpdateFilters = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        updateFilters: mockUpdateFilters
      });

      renderJobHistory();

      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      const aspectRatioSelect = screen.getByDisplayValue('All Ratios');
      fireEvent.change(aspectRatioSelect, { target: { value: '5x7' } });

      await waitFor(() => {
        expect(mockUpdateFilters).toHaveBeenCalledWith({ aspectRatio: '5x7' });
      });
    });

    it('should show clear filters button when filters are active', () => {
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        filters: { status: 'completed' }
      });

      renderJobHistory();

      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });

    it('should call clearFilters when clear button is clicked', async () => {
      const mockClearFilters = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        clearFilters: mockClearFilters,
        filters: { status: 'completed' }
      });

      renderJobHistory();

      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      const clearButton = screen.getByText('Clear All Filters');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(mockClearFilters).toHaveBeenCalled();
      });
    });
  });

  describe('Job Management', () => {
    it('should call deleteJob when delete button is clicked', async () => {
      const mockDeleteJob = vi.fn().mockResolvedValue(true);
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        deleteJob: mockDeleteJob
      });

      // Mock window.confirm
      window.confirm = vi.fn(() => true);

      renderJobHistory();

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this job? This action cannot be undone.');
        expect(mockDeleteJob).toHaveBeenCalledWith('job-1');
      });
    });

    it('should not call deleteJob when user cancels confirmation', async () => {
      const mockDeleteJob = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        deleteJob: mockDeleteJob
      });

      // Mock window.confirm to return false
      window.confirm = vi.fn(() => false);

      renderJobHistory();

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
        expect(mockDeleteJob).not.toHaveBeenCalled();
      });
    });

    it('should disable view button for non-completed jobs', () => {
      renderJobHistory();

      const viewButtons = screen.getAllByText('View');
      const failedJobViewButton = viewButtons[1]; // Second job is failed

      expect(failedJobViewButton).toBeDisabled();
    });

    it('should show retry button for failed jobs', () => {
      renderJobHistory();

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should handle job selection', () => {
      renderJobHistory();

      const checkboxes = screen.getAllByRole('checkbox');
      const jobCheckbox = checkboxes[1]; // First job checkbox (skip select all)

      fireEvent.click(jobCheckbox);

      expect(jobCheckbox).toBeChecked();
    });

    it('should handle select all functionality', () => {
      renderJobHistory();

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      const jobCheckboxes = screen.getAllByRole('checkbox').slice(1);
      jobCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should show export modal when export button is clicked', () => {
      renderJobHistory();

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      expect(screen.getByText('Export Job History')).toBeInTheDocument();
      expect(screen.getByText('Format')).toBeInTheDocument();
      expect(screen.getByText('Include file details')).toBeInTheDocument();
      expect(screen.getByText('Include progress data')).toBeInTheDocument();
    });

    it('should close export modal when cancel is clicked', () => {
      renderJobHistory();

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Export Job History')).not.toBeInTheDocument();
    });

    it('should call exportJobs when export is confirmed', async () => {
      const mockExportJobs = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        exportJobs: mockExportJobs
      });

      renderJobHistory();

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      const exportConfirmButton = screen.getByText('Export');
      fireEvent.click(exportConfirmButton);

      await waitFor(() => {
        expect(mockExportJobs).toHaveBeenCalledWith({
          format: 'json',
          includeFiles: false,
          includeProgress: false
        });
      });
    });

    it('should update export options when form changes', () => {
      renderJobHistory();

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      const formatSelect = screen.getByDisplayValue('JSON');
      fireEvent.change(formatSelect, { target: { value: 'csv' } });

      const includeFilesCheckbox = screen.getByLabelText('Include file details');
      fireEvent.click(includeFilesCheckbox);

      expect(formatSelect).toHaveValue('csv');
      expect(includeFilesCheckbox).toBeChecked();
    });
  });

  describe('Pagination', () => {
    it('should show pagination when multiple pages exist', () => {
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        pagination: {
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
          hasNext: true,
          hasPrev: false
        }
      });

      renderJobHistory();

      expect(screen.getByText('Showing 1 to 1 of 2 results')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should call updatePagination when pagination buttons are clicked', async () => {
      const mockUpdatePagination = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        updatePagination: mockUpdatePagination,
        pagination: {
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
          hasNext: true,
          hasPrev: false
        }
      });

      renderJobHistory();

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(mockUpdatePagination).toHaveBeenCalledWith({ page: 2 });
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should call refreshJobs when refresh button is clicked', async () => {
      const mockRefreshJobs = vi.fn();
      mockUseJobHistory.mockReturnValue({
        ...defaultMockReturn,
        refreshJobs: mockRefreshJobs
      });

      renderJobHistory();

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockRefreshJobs).toHaveBeenCalled();
      });
    });
  });
});
