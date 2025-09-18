import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadApi } from '../services/apiClient';
import type { ProcessingOptions } from '../types';

interface UploadImagesMutationData {
  files: File[];
  options: ProcessingOptions;
}

interface UploadResponse {
  success: boolean;
  message: string;
  jobId: string;
  filesCount: number;
  files: Array<{
    id: string;
    originalName: string;
    size: number;
    mimeType: string;
  }>;
  options: ProcessingOptions;
  progress: {
    currentStage: string;
    processedImages: number;
    totalImages: number;
    percentage: number;
  };
}

export const useImageUpload = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ files, options }: UploadImagesMutationData): Promise<UploadResponse> => {
      const formData = new FormData();
      
      // Append files
      files.forEach((file) => {
        formData.append('images', file);
      });
      
      // Append processing options
      formData.append('options', JSON.stringify(options));
      
      const response = await uploadApi.uploadImages(formData);
      
      const data = response.data as UploadResponse;
      if (!data.success) {
        throw new Error(data.message || 'Upload failed');
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch processing status queries
      queryClient.invalidateQueries({ queryKey: ['processing-status'] });
      
      // Pre-populate the processing status cache with initial job data
      if (data.jobId) {
        queryClient.setQueryData(['processing-status', data.jobId], {
          jobId: data.jobId,
          status: 'pending',
          progress: data.progress,
          processedImages: [],
          composedSheets: [],
        });
      }
    },
    onError: (error: any) => {
      console.error('Upload error:', {
        message: error.message,
        errorCode: error.errorCode,
        correlationId: error.correlationId,
        details: error.details,
        originalError: error.originalError
      });
      
      // Handle Python service integration errors
      if (error.errorCode) {
        switch (error.errorCode) {
          case 'SERVICE_UNAVAILABLE':
          case 'CONNECTION_ERROR':
            error.message = 'Processing service temporarily unavailable. Please try again in a moment.';
            break;
          case 'TIMEOUT_ERROR':
            error.message = 'Upload timed out. Please try again with smaller files.';
            break;
          case 'INVALID_FORMAT':
            error.message = 'One or more files are in an unsupported format. Please use JPEG, PNG, WebP, or TIFF files.';
            break;
          case 'INSUFFICIENT_MEMORY':
            error.message = 'Files are too large to process. Please use smaller images.';
            break;
        }
      }
      // Handle legacy Node.js error codes
      else if (error.response?.data?.code) {
        const { code, details } = error.response.data;
        
        switch (code) {
          case 'NO_FILES':
            error.message = 'No files were selected for upload';
            break;
          case 'VALIDATION_FAILED':
            error.message = `File validation failed: ${details?.join(', ') || 'Invalid files'}`;
            break;
          case 'MISSING_PROCESSING_OPTIONS':
            error.message = 'Processing options are required';
            break;
          case 'INVALID_PROCESSING_OPTIONS':
            error.message = `Invalid processing options: ${details || 'Please check your settings'}`;
            break;
          case 'UPLOAD_FAILED':
            error.message = 'Upload failed. Please try again.';
            break;
          default:
            error.message = error.response.data.message || 'Upload failed';
        }
      }
      // Handle Python service error responses
      else if (error.response?.data?.error_code) {
        const { error_code, message, details } = error.response.data;
        error.message = message || 'Upload failed';
        error.errorCode = error_code;
        error.details = details;
      }
    },
  });

  return {
    uploadFiles: (files: File[], options: ProcessingOptions) => 
      mutation.mutateAsync({ files, options }),
    isUploading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    data: mutation.data
  };
};

export default useImageUpload;