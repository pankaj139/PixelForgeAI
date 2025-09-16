import React from 'react';
import { cn } from '../utils/cn';
import { ProcessingOptions } from '../types';
import Card from './ui/Card';

interface ProcessingOptionsPanelProps {
  options: ProcessingOptions;
  onOptionsChange: (options: ProcessingOptions) => void;
  className?: string;
}

export const ProcessingOptionsPanel: React.FC<ProcessingOptionsPanelProps> = ({
  options,
  onOptionsChange,
  className
}) => {
  const handleFaceDetectionToggle = () => {
    onOptionsChange({
      ...options,
      faceDetectionEnabled: !options.faceDetectionEnabled
    });
  };

  const handleAiNamingToggle = () => {
    onOptionsChange({
      ...options,
      aiNamingEnabled: !options.aiNamingEnabled
    });
  };

  const handleInstagramToggle = () => {
    onOptionsChange({
      ...options,
      generateInstagramContent: !options.generateInstagramContent
    });
  };

  return (
    <Card padding="md" className={className || ''}>
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Processing Options</h3>
        
        {/* Face Detection Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label id="face-detection-label" className="text-sm font-medium text-gray-900">
              AI Face Detection
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Use computer vision to detect faces and keep them centered when cropping
            </p>
          </div>
          
          <button
            type="button"
            onClick={handleFaceDetectionToggle}
            className={cn(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
              'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              options.faceDetectionEnabled ? 'bg-blue-600' : 'bg-gray-200'
            )}
            role="switch"
            aria-checked={options.faceDetectionEnabled}
            aria-labelledby="face-detection-label"
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0',
                'transition duration-200 ease-in-out',
                options.faceDetectionEnabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {/* Face Detection Info */}
        {options.faceDetectionEnabled && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">
                  AI-Powered Cropping Enabled
                </h4>
                <div className="mt-1 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Detects faces and people in your images</li>
                    <li>Adjusts crop area to keep subjects centered</li>
                    <li>Falls back to center cropping if no faces detected</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Naming Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label id="ai-naming-label" className="text-sm font-medium text-gray-900">
              ✨ AI Smart Naming
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Generate descriptive 2-word names for images based on content
            </p>
          </div>
          
          <button
            type="button"
            onClick={handleAiNamingToggle}
            className={cn(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
              'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
              options.aiNamingEnabled ? 'bg-purple-600' : 'bg-gray-200'
            )}
            role="switch"
            aria-checked={options.aiNamingEnabled}
            aria-labelledby="ai-naming-label"
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0',
                'transition duration-200 ease-in-out',
                options.aiNamingEnabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {/* Instagram Content Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label id="instagram-label" className="text-sm font-medium text-gray-900">
              📸 Instagram Tags & Caption
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Generate hashtags and engaging captions for Instagram posts
            </p>
          </div>
          
          <button
            type="button"
            onClick={handleInstagramToggle}
            className={cn(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
              'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2',
              options.generateInstagramContent ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-200'
            )}
            role="switch"
            aria-checked={options.generateInstagramContent}
            aria-labelledby="instagram-label"
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0',
                'transition duration-200 ease-in-out',
                options.generateInstagramContent ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {/* Instagram Content Info */}
        {options.generateInstagramContent && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-md p-3">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-purple-800">
                  📸 Instagram Content Generation Enabled
                </h4>
                <div className="mt-1 text-sm text-purple-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>AI analyzes image content and mood</li>
                    <li>Generates 10-15 relevant hashtags</li>
                    <li>Creates engaging captions with emojis</li>
                    <li>Tailored for maximum Instagram engagement</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Summary */}
        <div className="bg-gray-50 rounded-md p-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Processing Summary</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Target Aspect Ratio:</span>
              <span className="font-medium">
                {options.aspectRatio.name} ({options.aspectRatio.width}:{options.aspectRatio.height})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Orientation:</span>
              <span className="font-medium capitalize">
                {options.aspectRatio.orientation}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Face Detection:</span>
              <span className={cn(
                'font-medium',
                options.faceDetectionEnabled ? 'text-green-600' : 'text-gray-500'
              )}>
                {options.faceDetectionEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Sheet Composition:</span>
              <span className={cn(
                'font-medium',
                options.sheetComposition?.enabled ? 'text-green-600' : 'text-gray-500'
              )}>
                {options.sheetComposition?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>AI Naming:</span>
              <span className={cn(
                'font-medium',
                options.aiNamingEnabled ? 'text-purple-600' : 'text-gray-500'
              )}>
                {options.aiNamingEnabled ? '✨ Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Instagram Content:</span>
              <span className={cn(
                'font-medium',
                options.generateInstagramContent ? 'text-pink-600' : 'text-gray-500'
              )}>
                {options.generateInstagramContent ? '📸 Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProcessingOptionsPanel;