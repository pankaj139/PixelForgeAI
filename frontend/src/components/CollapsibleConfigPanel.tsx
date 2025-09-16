/**
 * CollapsibleConfigPanel Component
 * 
 * Purpose: Organizes processing configuration options into collapsible sections
 * to reduce visual clutter and improve user experience. Users can expand only
 * the sections they need to configure.
 * 
 * Usage:
 * ```tsx
 * <CollapsibleConfigPanel
 *   processingOptions={processingOptions}
 *   onAspectRatioChange={handleAspectRatioChange}
 *   onProcessingOptionsChange={handleProcessingOptionsChange}
 *   onSheetCompositionChange={handleSheetCompositionChange}
 * />
 * ```
 * 
 * Props:
 * - processingOptions: ProcessingOptions - Current processing configuration
 * - onAspectRatioChange: (ratio) => void - Handler for aspect ratio changes
 * - onProcessingOptionsChange: (options) => void - Handler for processing option changes
 * - onSheetCompositionChange: (config) => void - Handler for sheet composition changes
 * 
 * Returns: JSX element with collapsible configuration sections
 */

import React, { useState } from 'react';
import { ProcessingOptions } from '../types';
import AspectRatioSelector from './AspectRatioSelector';
import ProcessingOptionsPanel from './ProcessingOptionsPanel';
import SheetCompositionConfig from './SheetCompositionConfig';
import Card from './ui/Card';

interface CollapsibleConfigPanelProps {
  processingOptions: ProcessingOptions;
  onAspectRatioChange: (aspectRatio: typeof processingOptions.aspectRatio) => void;
  onProcessingOptionsChange: (options: ProcessingOptions) => void;
  onSheetCompositionChange: (sheetComposition: ProcessingOptions['sheetComposition']) => void;
}

interface SectionState {
  aspectRatio: boolean;
  processing: boolean;
  sheetComposition: boolean;
}

export const CollapsibleConfigPanel: React.FC<CollapsibleConfigPanelProps> = ({
  processingOptions,
  onAspectRatioChange,
  onProcessingOptionsChange,
  onSheetCompositionChange
}) => {
  const [expanded, setExpanded] = useState<SectionState>({
    aspectRatio: true,
    processing: false,
    sheetComposition: false
  });

  const toggleSection = (section: keyof SectionState) => {
    setExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const SectionHeader = ({ 
    title, 
    isExpanded, 
    onClick, 
    badge 
  }: { 
    title: string; 
    isExpanded: boolean; 
    onClick: () => void;
    badge?: string;
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center space-x-3">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        {badge && (
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <svg
        className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  return (
    <div className="space-y-2">
      {/* Aspect Ratio Section */}
      <Card padding="none">
        <SectionHeader
          title="Aspect Ratio"
          isExpanded={expanded.aspectRatio}
          onClick={() => toggleSection('aspectRatio')}
          badge={processingOptions.aspectRatio.name}
        />
        {expanded.aspectRatio && (
          <div className="px-4 pb-4">
            <AspectRatioSelector
              selectedRatio={processingOptions.aspectRatio}
              onRatioChange={onAspectRatioChange}
            />
          </div>
        )}
      </Card>

      {/* Processing Options Section */}
      <Card padding="none">
        <SectionHeader
          title="AI & Processing Options"
          isExpanded={expanded.processing}
          onClick={() => toggleSection('processing')}
          badge={`${[
            processingOptions.faceDetectionEnabled && 'Face Detection',
            processingOptions.aiNamingEnabled && 'AI Naming',
            processingOptions.generateInstagramContent && 'Instagram'
          ].filter(Boolean).length} enabled`}
        />
        {expanded.processing && (
          <div className="px-4 pb-4">
            <ProcessingOptionsPanel
              options={processingOptions}
              onOptionsChange={onProcessingOptionsChange}
            />
          </div>
        )}
      </Card>

      {/* Sheet Composition Section */}
      <Card padding="none">
        <SectionHeader
          title="Sheet Composition"
          isExpanded={expanded.sheetComposition}
          onClick={() => toggleSection('sheetComposition')}
          badge={processingOptions.sheetComposition?.enabled ? 'Enabled' : 'Disabled'}
        />
        {expanded.sheetComposition && (
          <div className="px-4 pb-4">
            <SheetCompositionConfig
              options={processingOptions.sheetComposition}
              onOptionsChange={onSheetCompositionChange}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default CollapsibleConfigPanel;
