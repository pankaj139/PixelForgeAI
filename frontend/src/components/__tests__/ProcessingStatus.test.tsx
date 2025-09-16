import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProcessingStatus } from '../ProcessingStatus';
import type { ProcessingStatus as ProcessingStatusType } from '../../types';

// Mock the useProcessingStatus hook
const mockUseProcessingStatus = vi.fn();

vi.mock('../../hooks/useProcessingStatus', () => ({
  useProcessingStatus: () => mockUseProcessingStatus()
}));

// Test wrapper with QueryClient
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ProcessingStatus', () => {
  const mockJobId = 'test-job-123';
  const mockOnComplete = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const renderProcessingStatus = (props = {}) => {
    const defaultProps = {
      jobId: mockJobId,
      onComplete: mockOnComplete,
      onRetry: mockOnRetry,
    };

    return render(
      <ProcessingStatus {...defaultProps} {...props} />,
      { wrapper: createTestWrapper() }
    );
  };

  describe('Loading State', () => {
    it('should show loading spinner when data is loading', () => {
      mockUseProcessingStatus.mockReturnValue({
        data: undefined,
        error: null,
        isLoading: true,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getByText('Loading processing status...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when there is an error', () => {
      const mockError = new Error('Network error');
      mockUseProcessingStatus.mockReturnValue({
        data: undefined,
        error: mockError,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call onRetry when provided and retry button is clicked', async () => {
      mockUseProcessingStatus.mockReturnValue({
        data: undefined,
        error: new Error('Network error'),
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockOnRetry).toHaveBeenCalledWith(mockJobId);
      });
    });
  });

  describe('Processing States', () => {
    it('should display uploading stage correctly', () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'processing',
        progress: {
          currentStage: 'uploading',
          processedImages: 0,
          totalImages: 5,
          percentage: 20
        },
        processedImages: [],
        composedSheets: []
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getByText('Uploading')).toBeInTheDocument();
      expect(screen.getByText('Uploading files to server')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('should display processing stage with image progress', () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'processing',
        progress: {
          currentStage: 'processing',
          processedImages: 3,
          totalImages: 5,
          percentage: 60
        },
        processedImages: [],
        composedSheets: []
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getByText('Converting aspect ratios and applying intelligent cropping')).toBeInTheDocument();
      expect(screen.getByText('Images Processed')).toBeInTheDocument();
      expect(screen.getByText('3 of 5')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should display composing stage correctly', () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'composing',
        progress: {
          currentStage: 'composing',
          processedImages: 5,
          totalImages: 5,
          percentage: 80
        },
        processedImages: [],
        composedSheets: []
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getByText('Composing Sheets')).toBeInTheDocument();
      expect(screen.getByText('Creating A4 sheet layouts with processed images')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Completed State', () => {
    it('should display completion message and call onComplete', () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'completed',
        progress: {
          currentStage: 'completed',
          processedImages: 5,
          totalImages: 5,
          percentage: 100
        },
        processedImages: [],
        composedSheets: []
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getAllByText('Processing Complete!')).toHaveLength(2); // Header and success message
      expect(screen.getByText('5 images processed successfully')).toBeInTheDocument();
      expect(mockOnComplete).toHaveBeenCalledWith(mockStatus);
    });
  });

  describe('Failed State', () => {
    it('should display error message and retry button for failed jobs', () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'failed',
        progress: {
          currentStage: 'processing',
          processedImages: 2,
          totalImages: 5,
          percentage: 40
        },
        processedImages: [],
        composedSheets: [],
        errors: ['Image processing failed', 'Invalid file format']
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getByText('• Image processing failed')).toBeInTheDocument();
      expect(screen.getByText('• Invalid file format')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry processing/i })).toBeInTheDocument();
    });

    it('should call onRetry when retry processing button is clicked', async () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'failed',
        progress: {
          currentStage: 'processing',
          processedImages: 2,
          totalImages: 5,
          percentage: 40
        },
        processedImages: [],
        composedSheets: [],
        errors: ['Processing failed']
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      const retryButton = screen.getByRole('button', { name: /retry processing/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockOnRetry).toHaveBeenCalledWith(mockJobId);
      });
    });
  });

  describe('Time Estimation', () => {
    it('should display estimated time remaining during processing', () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'processing',
        progress: {
          currentStage: 'processing',
          processedImages: 2,
          totalImages: 10,
          percentage: 30
        },
        processedImages: [],
        composedSheets: []
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.getByText(/estimated time remaining/i)).toBeInTheDocument();
    });

    it('should not display time estimation when completed', () => {
      const mockStatus: ProcessingStatusType = {
        jobId: mockJobId,
        status: 'completed',
        progress: {
          currentStage: 'completed',
          processedImages: 5,
          totalImages: 5,
          percentage: 100
        },
        processedImages: [],
        composedSheets: []
      };

      mockUseProcessingStatus.mockReturnValue({
        data: mockStatus,
        error: null,
        isLoading: false,
        refetch: vi.fn()
      });

      renderProcessingStatus();

      expect(screen.queryByText(/estimated time remaining/i)).not.toBeInTheDocument();
    });
  });
});