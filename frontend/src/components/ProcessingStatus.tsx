/**
 * ProcessingStatus Component
 * 
 * Purpose: Displays real-time processing status with dynamic stage visibility
 * based on selected processing options. Shows progress bars, time estimation,
 * and detailed status for each processing stage.
 * 
 * Usage:
 * ```tsx
 * <ProcessingStatus
 *   jobId={jobId}
 *   onComplete={(results) => console.log('Processing complete:', results)}
 *   onRetry={(jobId) => console.log('Retrying job:', jobId)}
 * />
 * ```
 * 
 * Props:
 * - jobId: string - Unique identifier for the processing job
 * - onComplete?: (results) => void - Callback when processing completes
 * - onRetry?: (jobId) => void - Callback when retry is requested
 * - className?: string - Additional CSS classes
 * 
 * Updates:
 * - Fixed visibility of optional stages (composing sheets, PDF generation) based on processing options
 * - Shows only enabled stages to reduce UI clutter and confusion
 * 
 * Returns: JSX element displaying current processing status with appropriate stages
 */

import React, { useState } from 'react';
import { useProcessingStatus } from '../hooks/useProcessingStatus';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import type { JobProgress } from '../types';

interface ProcessingStatusProps {
  jobId: string;
  onComplete?: (results: any) => void;
  onRetry?: (jobId: string) => void;
  className?: string;
}

interface StageInfo {
  name: string;
  description: string;
  icon: string;
  estimatedDuration: number; // in seconds
}

const PROCESSING_STAGES: Record<string, StageInfo> = {
  uploading: {
    name: 'Uploading',
    description: 'Uploading files to server',
    icon: '📤',
    estimatedDuration: 10
  },
  processing: {
    name: 'Processing Images',
    description: 'Converting aspect ratios and applying intelligent cropping',
    icon: '🖼️',
    estimatedDuration: 30
  },
  composing: {
    name: 'Composing Sheets',
    description: 'Creating A4 sheet layouts with processed images',
    icon: '📄',
    estimatedDuration: 15
  },
  generating_pdf: {
    name: 'Generating PDF',
    description: 'Creating downloadable PDF document',
    icon: '📋',
    estimatedDuration: 10
  },
  completed: {
    name: 'Completed',
    description: 'All processing complete - ready for download',
    icon: '✅',
    estimatedDuration: 0
  }
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

const calculateEstimatedTime = (
  currentStage: string,
  progress: JobProgress,
  totalImages: number
): number => {
  const stages = Object.keys(PROCESSING_STAGES);
  const currentStageIndex = stages.indexOf(currentStage);
  
  if (currentStageIndex === -1 || currentStage === 'completed') {
    return 0;
  }

  let totalEstimatedTime = 0;

  // Add time for remaining stages
  for (let i = currentStageIndex + 1; i < stages.length - 1; i++) {
    const stage = stages[i];
    const stageInfo = PROCESSING_STAGES[stage];
    
    // Scale processing time based on number of images
    if (stage === 'processing') {
      totalEstimatedTime += stageInfo.estimatedDuration * totalImages;
    } else {
      totalEstimatedTime += stageInfo.estimatedDuration;
    }
  }

  // Add remaining time for current stage
  const currentStageInfo = PROCESSING_STAGES[currentStage];
  const currentStageProgress = progress.percentage / 100;
  const currentStageRemaining = currentStageInfo.estimatedDuration * (1 - currentStageProgress);
  
  if (currentStage === 'processing') {
    totalEstimatedTime += currentStageRemaining * totalImages;
  } else {
    totalEstimatedTime += currentStageRemaining;
  }

  return Math.max(0, Math.round(totalEstimatedTime));
};

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  jobId,
  onComplete,
  onRetry,
  className = ''
}) => {
  const [retryAttempts, setRetryAttempts] = useState(0);
  const { data: status, error, isLoading, refetch } = useProcessingStatus(jobId);

  // Handle completion
  React.useEffect(() => {
    if (status?.status === 'completed' && onComplete) {
      onComplete(status);
    }
  }, [status?.status, onComplete, status]);

  const handleRetry = async () => {
    if (onRetry) {
      setRetryAttempts(prev => prev + 1);
      onRetry(jobId);
    } else {
      // Fallback: just refetch status
      await refetch();
    }
  };

  if (isLoading && !status) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" role="status" aria-label="Loading"></div>
          <span className="text-gray-600">Loading processing status...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    const enhancedError = error as any;
    const isServiceError = enhancedError?.errorCode?.includes('SERVICE') || 
                          enhancedError?.errorCode?.includes('CONNECTION') ||
                          enhancedError?.errorCode?.includes('TIMEOUT');
    
    return (
      <Card className={`p-6 border-red-200 ${className}`}>
        <div className="text-center space-y-4">
          <div className="text-red-600">
            <span className="text-2xl">{isServiceError ? '🔧' : '⚠️'}</span>
            <h3 className="text-lg font-semibold mt-2">
              {isServiceError ? 'Service Issue' : 'Connection Error'}
            </h3>
            <p className="text-sm text-red-500 mt-1">
              {enhancedError?.message || 'Unable to fetch processing status'}
            </p>
            
            {/* Show correlation ID for debugging if available */}
            {enhancedError?.correlationId && import.meta.env.DEV && (
              <p className="text-xs text-red-400 mt-2 font-mono">
                ID: {enhancedError.correlationId}
              </p>
            )}
            
            {/* Show error code for debugging if available */}
            {enhancedError?.errorCode && import.meta.env.DEV && (
              <p className="text-xs text-red-400 mt-1">
                Code: {enhancedError.errorCode}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              Retry {retryAttempts > 0 && `(${retryAttempts})`}
            </Button>
            
            {/* Show additional help for service errors */}
            {isServiceError && (
              <p className="text-xs text-gray-500 mt-2">
                The processing service may be temporarily unavailable. 
                Your job may still be processing in the background.
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className={`p-6 border-yellow-200 ${className}`}>
        <div className="text-center text-yellow-600">
          <span className="text-2xl">❓</span>
          <p className="mt-2">No processing status available</p>
        </div>
      </Card>
    );
  }

  const currentStage = status.progress.currentStage;
  const isCompleted = status.status === 'completed';
  const isFailed = status.status === 'failed';
  const totalImages = status.progress.totalImages;
  const processedImages = status.progress.processedImages;
  
  const estimatedTimeRemaining = calculateEstimatedTime(
    currentStage,
    status.progress,
    totalImages
  );

  // Filter stages based on processing options
  const getEnabledStages = () => {
    const allStages = Object.entries(PROCESSING_STAGES);
    
    // Always show uploading and processing stages
    let enabledStages = allStages.filter(([stageKey]) => 
      stageKey === 'uploading' || stageKey === 'processing'
    );
    
    // Add optional stages based on processing options
    const processingOptions = status.options;
    
    if (processingOptions?.sheetComposition?.enabled) {
      const composingStage = allStages.find(([stageKey]) => stageKey === 'composing');
      if (composingStage) enabledStages.push(composingStage);
      if (processingOptions.sheetComposition.generatePDF) {
        const pdfStage = allStages.find(([stageKey]) => stageKey === 'generating_pdf');
        if (pdfStage) enabledStages.push(pdfStage);
      }
    }

    // Ensure the currently active stage is always visible even if options metadata missing
    if (!enabledStages.find(([stageKey]) => stageKey === currentStage)) {
      const current = allStages.find(([stageKey]) => stageKey === currentStage);
      if (current) enabledStages.push(current);
    }
    
    // Always show completed stage if job is completed
    if (isCompleted) {
      const completedStage = allStages.find(([stageKey]) => stageKey === 'completed');
      if (completedStage) enabledStages.push(completedStage);
    }
    
    return enabledStages;
  };

  const stages = getEnabledStages();

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {isFailed ? 'Processing Failed' : isCompleted ? 'Processing Complete!' : 'Processing Images'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Job ID: {jobId}
          </p>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Overall Progress
            </span>
            <span className="text-sm text-gray-600">
              {status.progress.percentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={status.progress.percentage} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${status.progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Stage Progress */}
        <div className="space-y-3">
          {stages.map(([stageKey, stageInfo], index) => {
            const isCurrentStage = currentStage === stageKey;
            const isPastStage = stages.findIndex(([key]) => key === currentStage) > index;
            const isActive = isCurrentStage || isPastStage;
            const isLastStage = stageKey === 'completed';

            // Skip completed stage if not actually completed
            if (isLastStage && !isCompleted) {
              return null;
            }

            return (
              <div
                key={stageKey}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                  isCurrentStage
                    ? 'bg-blue-50 border border-blue-200'
                    : isPastStage
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex-shrink-0">
                  <span className="text-xl">
                    {isPastStage ? '✅' : isCurrentStage ? stageInfo.icon : '⏳'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm font-medium ${
                      isActive ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {stageInfo.name}
                    </h4>
                    {isCurrentStage && !isCompleted && (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-xs text-blue-600">Active</span>
                      </div>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${
                    isActive ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {stageInfo.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Image Progress Details */}
        {currentStage === 'processing' && (
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-900">
                Images Processed
              </span>
              <span className="text-sm text-blue-700">
                {processedImages} of {totalImages}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2" role="progressbar" aria-valuenow={totalImages > 0 ? (processedImages / totalImages) * 100 : 0} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${totalImages > 0 ? (processedImages / totalImages) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Time Estimation */}
        {!isCompleted && !isFailed && estimatedTimeRemaining > 0 && (
          <div className="text-center text-sm text-gray-600">
            <span className="inline-flex items-center space-x-1">
              <span>⏱️</span>
              <span>Estimated time remaining: {formatTime(estimatedTimeRemaining)}</span>
            </span>
          </div>
        )}

        {/* Error Display */}
        {isFailed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <span className="text-red-500 text-lg">❌</span>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-900">Processing Failed</h4>
                {status.errors && status.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {status.errors.map((error, index) => {
                      // Try to parse enhanced error information
                      let errorMessage = error;
                      let errorCode = '';
                      
                      try {
                        if (typeof error === 'string' && error.includes('Code:')) {
                          const parts = error.split('Code:');
                          errorMessage = parts[0].trim();
                          errorCode = parts[1]?.trim();
                        }
                      } catch (e) {
                        // Fallback to original error
                      }
                      
                      return (
                        <div key={index} className="text-xs text-red-700">
                          <p>• {errorMessage}</p>
                          {errorCode && import.meta.env.DEV && (
                            <p className="text-red-500 ml-2 font-mono">Code: {errorCode}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Show helpful suggestions based on error type */}
                <div className="mt-2 text-xs text-red-600">
                  <p>Possible solutions:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Try uploading smaller images (under 10MB each)</li>
                    <li>Ensure images are in supported formats (JPEG, PNG, WebP, TIFF)</li>
                    <li>Check that images contain clear faces or people for detection</li>
                    <li>Wait a moment and try again if the service is busy</li>
                  </ul>
                </div>
                
                <div className="mt-3 flex space-x-2">
                  <Button
                    onClick={handleRetry}
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Retry Processing
                  </Button>
                  
                  {/* Show refresh status button for service errors */}
                  <Button
                    onClick={() => window.location.reload()}
                    size="sm"
                    variant="outline"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    Refresh Page
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="space-y-2">
              <span className="text-green-500 text-2xl">🎉</span>
              <h4 className="text-sm font-medium text-green-900">
                Processing Complete!
              </h4>
              <p className="text-xs text-green-700">
                {processedImages} images processed successfully
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ProcessingStatus;