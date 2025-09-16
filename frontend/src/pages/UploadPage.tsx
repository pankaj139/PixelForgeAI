import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import CollapsibleConfigPanel from '../components/CollapsibleConfigPanel';
import CompactProcessingSummary from '../components/CompactProcessingSummary';
import Grid from '../components/ui/Grid';
import { ProcessingOptions, ASPECT_RATIOS } from '../types';
import { useImageUpload } from '../hooks/useImageUpload';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { uploadFiles, isUploading, error: uploadError, reset } = useImageUpload();
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    aspectRatio: ASPECT_RATIOS['4x6'],
    faceDetectionEnabled: true,
    sheetComposition: null,
    aiNamingEnabled: true,
    generateInstagramContent: true
  });

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAspectRatioChange = (aspectRatio: typeof processingOptions.aspectRatio) => {
    setProcessingOptions(prev => ({
      ...prev,
      aspectRatio
    }));
  };

  const handleProcessingOptionsChange = (options: ProcessingOptions) => {
    setProcessingOptions(options);
  };

  const handleSheetCompositionChange = (sheetComposition: ProcessingOptions['sheetComposition']) => {
    setProcessingOptions(prev => ({
      ...prev,
      sheetComposition
    }));
  };

  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const result = await uploadFiles(selectedFiles, processingOptions);
      if (result.success) {
        // Navigate to processing page with job ID
        navigate(`/processing/${result.jobId}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      // Error is handled by the useImageUpload hook and will be displayed in UI
    }
  };

  const canStartProcessing = selectedFiles.length > 0 && !isUploading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Upload & Process Images
        </h2>
        <p className="text-sm text-gray-600 max-w-xl mx-auto">
          Upload your images, configure processing options, and let AI optimize them for your needs.
        </p>
      </div>

      {/* Main Content */}
      <Grid cols={1} responsive={{ lg: 2 }} gap="lg">
        {/* Left Column - File Upload */}
        <div className="space-y-4">
          <FileUpload
            onFilesSelected={handleFilesSelected}
            selectedFiles={selectedFiles}
            onRemoveFile={handleRemoveFile}
            disabled={isUploading}
          />

          {/* Upload Error Display */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-3">
                <span className="text-red-500 text-sm">❌</span>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-900">Upload Failed</h4>
                  <p className="text-xs text-red-700 mt-1">{uploadError.message}</p>
                  <button
                    onClick={() => reset()}
                    className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Configuration Options */}
        <div>
          <CollapsibleConfigPanel
            processingOptions={processingOptions}
            onAspectRatioChange={handleAspectRatioChange}
            onProcessingOptionsChange={handleProcessingOptionsChange}
            onSheetCompositionChange={handleSheetCompositionChange}
          />
        </div>
      </Grid>

      {/* Compact Processing Summary and Start Button */}
      <CompactProcessingSummary
        fileCount={selectedFiles.length}
        processingOptions={processingOptions}
        onStartProcessing={handleStartProcessing}
        isUploading={isUploading}
        canStart={canStartProcessing}
      />
    </div>
  );
};

export default UploadPage;