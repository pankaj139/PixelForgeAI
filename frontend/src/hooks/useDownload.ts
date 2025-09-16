import { useMutation } from '@tanstack/react-query';
import { downloadApi } from '../services/apiClient';

interface DownloadParams {
  jobId?: string;
  type: 'image' | 'sheet' | 'zip' | 'pdf';
  itemId?: string;
}

export const useDownload = () => {
  return useMutation({
    mutationFn: async ({ jobId, type, itemId }: DownloadParams): Promise<{ blob: Blob; filename: string }> => {
      let response;
      
      switch (type) {
        case 'image':
          if (!itemId) throw new Error('Item ID required for image download');
          response = await downloadApi.downloadImage(itemId);
          break;
        case 'sheet':
          if (!itemId) throw new Error('Item ID required for sheet download');
          response = await downloadApi.downloadSheet(itemId);
          break;
        case 'zip':
          if (!jobId) throw new Error('Job ID required for ZIP download');
          response = await downloadApi.downloadZip(jobId);
          break;
        case 'pdf':
          if (!jobId) throw new Error('Job ID required for PDF download');
          response = await downloadApi.downloadPdf(jobId);
          break;
        default:
          throw new Error(`Unknown download type: ${type}`);
      }
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'] || '';
      let filename = 'download';
      
      if (contentDisposition) {
        // Parse: attachment; filename="siblings_portrait_f3d472ab_4x6.jpeg"
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) {
          filename = match[1].replace(/['"]/g, '');
        }
      }
      
      // Fallback to generic names if no filename found
      if (!filename || filename === 'download') {
        switch (type) {
          case 'image':
            filename = `processed-${itemId}.jpg`;
            break;
          case 'sheet':
            filename = `sheet-${itemId}.jpg`;
            break;
          case 'zip':
            filename = `processed-all.zip`;
            break;
          case 'pdf':
            filename = `processed-sheets.pdf`;
            break;
        }
      }
      
      return { blob: response.data, filename };
    },
    onSuccess: (result) => {
      // Create download link and trigger download
      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Use the filename from Content-Disposition header
      link.download = result.filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    onError: (error: any) => {
      console.error('Download error:', {
        message: error.message,
        errorCode: error.errorCode,
        correlationId: error.correlationId,
        status: error.response?.status,
        data: error.response?.data
      });
      
      let errorMessage = 'Download failed. Please try again.';
      
      // Handle Python service integration errors
      if (error.errorCode) {
        switch (error.errorCode) {
          case 'SERVICE_UNAVAILABLE':
          case 'CONNECTION_ERROR':
            errorMessage = 'Download service temporarily unavailable. Please try again in a moment.';
            break;
          case 'TIMEOUT_ERROR':
            errorMessage = 'Download timed out. Please try again.';
            break;
          case 'IMAGE_NOT_FOUND':
            errorMessage = 'File not found. It may have been deleted or expired.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      // Handle HTTP status codes
      else if (error.response?.status === 404) {
        if (error.response.data?.error_code === 'IMAGE_NOT_FOUND' || 
            error.response.data?.error?.includes('not found')) {
          errorMessage = 'File not found. It may have been deleted or expired.';
        } else {
          errorMessage = 'Download not available';
        }
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 
                     error.response.data?.error || 
                     'Invalid download request';
      } else if (error.response?.status === 503) {
        errorMessage = 'Download service temporarily unavailable. Please try again later.';
      } else if (error.response?.status === 504) {
        errorMessage = 'Download timed out. Please try again.';
      }
      // Handle Python service error responses
      else if (error.response?.data?.error_code) {
        errorMessage = error.response.data.message || errorMessage;
      }
      
      throw new Error(errorMessage);
    },
  });
};

export default useDownload;