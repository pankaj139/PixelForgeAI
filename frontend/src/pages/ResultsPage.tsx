import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { processingApi } from '../services/apiClient';
import { ProcessingResults, DownloadType } from '../types';
import { ResultsGallery } from '../components/ResultsGallery';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useDownload } from '../hooks/useDownload';

interface ProcessingResultsResponse {
  success: boolean;
  jobId: string;
  status: string;
  options: any;
  results: {
    processedImages: Array<{
      id: string;
      originalFileId: string;
      processedPath: string;
      aspectRatio: any;
      cropArea: any;
      processingTime: number;
      createdAt: string;
    }>;
    composedSheets: Array<{
      id: string;
      sheetPath: string;
      layout: any;
      orientation: string;
      imageCount: number;
      emptySlots: number;
      createdAt: string;
    }>;
  };
  downloadUrls: {
    individualImages: { [imageId: string]: string };
    sheets: { [sheetId: string]: string };
    zip?: string;
    pdf?: string;
  };
  completedAt: string;
}

export const ResultsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [error, setError] = useState<string | null>(null);
  
  const downloadMutation = useDownload();

  // Fetch processing results
  const { data: results, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['processing-results', jobId],
    queryFn: async (): Promise<ProcessingResults> => {
      if (!jobId) throw new Error('Job ID is required');
      
      const response = await processingApi.getJobResults(jobId);
      const data: ProcessingResultsResponse = response.data;
      
      if (!data.success) {
        throw new Error('Failed to fetch processing results');
      }
      
      // Transform backend response to frontend ProcessingResults type
      const transformedResults: ProcessingResults = {
        jobId: data.jobId,
        processedImages: data.results.processedImages.map(img => ({
          ...img,
          // Use actual detections from backend, fallback to empty if not provided
          detections: img.detections || { faces: [], people: [], confidence: 0 },
          createdAt: new Date(img.createdAt)
        })),
        composedSheets: data.results.composedSheets.map(sheet => ({
          ...sheet,
          orientation: sheet.orientation as 'portrait' | 'landscape', // Type assertion
          images: [], // Images are referenced by ID, not included in sheet object
          createdAt: new Date(sheet.createdAt)
        })),
        downloadUrls: data.downloadUrls,
        ...(data.downloadUrls.pdf && { pdfPath: data.downloadUrls.pdf }),
        ...(data.downloadUrls.zip && { zipPath: data.downloadUrls.zip })
      };
      
      return transformedResults;
    },
    enabled: !!jobId,
    retry: 3,
    retryDelay: 1000,
  });

  const handleDownload = async (type: DownloadType, itemId?: string) => {
    try {
      setError(null);
      
      // Prepare download params based on type
      const downloadParams = {
        type,
        ...(itemId && { itemId }),
        ...(type === 'zip' || type === 'pdf' ? { jobId: jobId! } : {})
      };
      
      await downloadMutation.mutateAsync(downloadParams);
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleRetry = () => {
    setError(null);
    refetch();
  };

  if (!jobId) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Invalid Request
          </h2>
          <p className="text-gray-600 mb-4">
            No job ID provided. Please check your URL.
          </p>
          <Link 
            to="/upload" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Upload
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Loading Results
          </h2>
          <p className="text-gray-600">
            Job ID: {jobId}
          </p>
        </div>
        
        <Card className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your processed images...</p>
        </Card>
      </div>
    );
  }

  if (queryError || error) {
    const errorMessage = error || (queryError instanceof Error ? queryError.message : 'Failed to load results');
    
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Error Loading Results
          </h2>
          <p className="text-gray-600">
            Job ID: {jobId}
          </p>
        </div>
        
        <Card className="text-center py-12">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">
            Failed to Load Results
          </p>
          <p className="text-gray-600 mb-4">
            {errorMessage}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleRetry} variant="primary">
              Try Again
            </Button>
            <Link 
              to="/upload" 
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Start New Upload
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            No Results Found
          </h2>
          <p className="text-gray-600">
            Job ID: {jobId}
          </p>
        </div>
        
        <Card className="text-center py-12">
          <p className="text-gray-600 mb-4">
            No processing results found for this job. The job may still be processing or may have expired.
          </p>
          <Link 
            to="/upload" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Upload
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Processing Results
        </h2>
        <p className="text-gray-600 mb-4">
          Job ID: {jobId}
        </p>
        <Link 
          to="/upload" 
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start New Upload
        </Link>
      </div>
      
      {error && (
        <Card className="bg-red-50 border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Download Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </Card>
      )}
      
      <ResultsGallery
        results={results}
        onDownload={handleDownload}
        isDownloading={downloadMutation.isPending}
      />
    </div>
  );
};

export default ResultsPage;