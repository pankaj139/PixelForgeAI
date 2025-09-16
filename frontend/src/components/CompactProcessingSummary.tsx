/**
 * CompactProcessingSummary Component
 * 
 * Purpose: Displays a condensed summary of selected processing options without
 * overwhelming the user interface. Shows key information in a compact, easy-to-scan format.
 * 
 * Usage:
 * ```tsx
 * <CompactProcessingSummary 
 *   fileCount={selectedFiles.length}
 *   processingOptions={processingOptions}
 *   onStartProcessing={handleStartProcessing}
 *   isUploading={isUploading}
 *   canStart={canStartProcessing}
 * />
 * ```
 * 
 * Props:
 * - fileCount: number - Number of selected files
 * - processingOptions: ProcessingOptions - Current processing configuration
 * - onStartProcessing: () => void - Function to call when starting processing
 * - isUploading: boolean - Whether upload is in progress
 * - canStart: boolean - Whether processing can be started
 * 
 * Returns: JSX element with compact processing summary and start button
 */

import React, { useState } from 'react';
import { ProcessingOptions } from '../types';
import Button from './ui/Button';
import Card from './ui/Card';

interface CompactProcessingSummaryProps {
  fileCount: number;
  processingOptions: ProcessingOptions;
  onStartProcessing: () => void;
  isUploading: boolean;
  canStart: boolean;
}

export const CompactProcessingSummary: React.FC<CompactProcessingSummaryProps> = ({
  fileCount,
  processingOptions,
  onStartProcessing,
  isUploading,
  canStart
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (fileCount === 0) return null;

  return (
    <Card padding="md" className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">{fileCount}</div>
            <div className="text-xs text-gray-600">Images</div>
          </div>
          
          <div className="text-center">
            <div className="text-xl font-bold text-green-600">
              {processingOptions.aspectRatio.name}
            </div>
            <div className="text-xs text-gray-600">Ratio</div>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            {processingOptions.faceDetectionEnabled && (
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs">
                👤 Face Detection
              </span>
            )}
            {processingOptions.aiNamingEnabled && (
              <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded-full text-xs">
                ✨ AI Naming
              </span>
            )}
            {processingOptions.generateInstagramContent && (
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs">
                📸 Instagram
              </span>
            )}
            {processingOptions.sheetComposition?.enabled && (
              <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs">
                📄 Sheet Layout
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          
          <Button
            onClick={onStartProcessing}
            disabled={!canStart}
            loading={isUploading}
            size="md"
          >
            {isUploading 
              ? 'Uploading...' 
              : `Start Processing`
            }
          </Button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Processing Options</h4>
              <ul className="space-y-1 text-gray-700">
                <li>• Aspect Ratio: {processingOptions.aspectRatio.name} ({processingOptions.aspectRatio.value})</li>
                <li>• Face Detection: {processingOptions.faceDetectionEnabled ? 'Enabled' : 'Disabled'}</li>
                <li>• AI Naming: {processingOptions.aiNamingEnabled ? 'Enabled' : 'Disabled'}</li>
                <li>• Instagram Content: {processingOptions.generateInstagramContent ? 'Enabled' : 'Disabled'}</li>
              </ul>
            </div>
            
            {processingOptions.sheetComposition?.enabled && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Sheet Composition</h4>
                <ul className="space-y-1 text-gray-700">
                  <li>• Layout: {processingOptions.sheetComposition.gridLayout.name} grid</li>
                  <li>• Orientation: {processingOptions.sheetComposition.orientation} A4</li>
                  <li>• PDF Generation: {processingOptions.sheetComposition.generatePDF ? 'Yes' : 'No'}</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CompactProcessingSummary;
