/**
 * useProcessingStatus Hook
 * 
 * Purpose: Custom React Query hook for fetching and polling job processing status
 * with enhanced error handling and automatic updates. Manages real-time status
 * updates for image processing jobs.
 * 
 * Usage:
 * ```tsx
 * const { data: status, error, isLoading, refetch } = useProcessingStatus(jobId);
 * ```
 * 
 * Parameters:
 * - jobId: string | undefined - Unique job identifier to track
 * - enabled: boolean - Whether to enable the query (defaults to true)
 * 
 * Updates:
 * - Added processing options to response for dynamic stage visibility
 * - Enhanced error handling for Python service integration
 * 
 * Returns: React Query result object with status data, loading state, and error info
 */

import { useQuery } from '@tanstack/react-query';
import { processingApi } from '../services/apiClient';
import type { ProcessingStatus } from '../types';

interface ProcessingStatusResponse {
  success: boolean;
  jobId: string;
  status: string;
  progress: {
    currentStage: string;
    processedImages: number;
    totalImages: number;
    percentage: number;
  };
  options: any;
  results?: {
    processedImages: number;
    composedSheets: number;
    totalFiles: number;
  };
  timestamps: {
    createdAt: string;
    completedAt?: string;
  };
  errorMessage?: string;
}

export const useProcessingStatus = (jobId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ['processing-status', jobId],
    queryFn: async (): Promise<ProcessingStatus> => {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      
      try {
        const response = await processingApi.getJobProgress(jobId);
        const data = response.data as ProcessingStatusResponse;
        
        if (!data.success) {
          throw new Error('Failed to fetch processing status');
        }

        // Transform backend response to frontend ProcessingStatus type
        const status: ProcessingStatus = {
          jobId: data.jobId,
          status: data.status as any,
          progress: {
            currentStage: data.progress.currentStage as any,
            processedImages: data.progress.processedImages,
            totalImages: data.progress.totalImages,
            percentage: data.progress.percentage
          },
          processedImages: [], // Will be populated from results endpoint when completed
          ...(data.errorMessage && { errors: [data.errorMessage] }),
          // Add processing options to determine which stages to show
          options: data.options
          // estimatedTimeRemaining is calculated on frontend in component
        };

        return status;
      } catch (error: any) {
        // Enhanced error handling for Python service integration
        let errorMessage = 'Failed to fetch processing status';
        
        if (error.response?.status === 404) {
          errorMessage = 'Job not found';
        } else if (error.response?.status === 400) {
          errorMessage = 'Invalid job ID';
        } else if (error.errorCode) {
          // Handle Python service error codes
          switch (error.errorCode) {
            case 'CONNECTION_ERROR':
            case 'SERVICE_UNAVAILABLE':
              errorMessage = 'Processing service temporarily unavailable';
              break;
            case 'TIMEOUT_ERROR':
              errorMessage = 'Request timed out - processing may still be in progress';
              break;
            case 'PROCESSING_FAILED':
              errorMessage = 'Image processing failed';
              break;
            default:
              errorMessage = error.message || errorMessage;
          }
        } else if (error.response?.data?.error_code) {
          // Direct Python service error response
          errorMessage = error.response.data.message || errorMessage;
        } else if (error.response?.data?.error || error.response?.data?.message) {
          // Legacy Node.js error response
          errorMessage = error.response.data.error || error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        // Create enhanced error with correlation ID for debugging
        const enhancedError = new Error(errorMessage) as any;
        enhancedError.errorCode = error.errorCode;
        enhancedError.correlationId = error.correlationId;
        enhancedError.details = error.details;
        enhancedError.originalError = error;
        
        throw enhancedError;
      }
    },
    enabled: enabled && !!jobId,
    refetchInterval: (data) => {
      // Stop polling when processing is complete or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      // Poll every 2 seconds while processing
      return 2000;
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider status data stale for real-time updates
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (job not found) or 400 (invalid job ID)
      if (error?.message?.includes('Job not found') || error?.message?.includes('Invalid job ID')) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

export default useProcessingStatus;