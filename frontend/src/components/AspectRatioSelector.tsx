import React, { useState } from 'react';
import { cn } from '../utils/cn';
import { AspectRatio, ASPECT_RATIOS } from '../types';
import Card from './ui/Card';

interface AspectRatioSelectorProps {
  selectedRatio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  className?: string;
}

interface CustomRatioInputs {
  width: string;
  height: string;
  name: string;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selectedRatio,
  onRatioChange,
  className
}) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInputs, setCustomInputs] = useState<CustomRatioInputs>({
    width: '',
    height: '',
    name: ''
  });
  const [customRatioError, setCustomRatioError] = useState<string>('');

  const ratios = Object.values(ASPECT_RATIOS);

  const getOrientationVariants = (ratio: AspectRatio): AspectRatio[] => {
    if (ratio.orientation === 'square') {
      return [ratio];
    }

    const portrait: AspectRatio = {
      ...ratio,
      orientation: 'portrait'
    };

    const landscape: AspectRatio = {
      width: ratio.height,
      height: ratio.width,
      name: ratio.name,
      orientation: 'landscape'
    };

    return [portrait, landscape];
  };

  const renderRatioPreview = (ratio: AspectRatio) => {
    // Calculate dimensions for preview with better proportions
    let width, height;
    const maxSize = 40;
    const aspectRatio = ratio.width / ratio.height;
    
    if (ratio.orientation === 'square') {
      width = height = maxSize;
    } else if (aspectRatio > 1) {
      // Landscape
      width = maxSize;
      height = maxSize / aspectRatio;
    } else {
      // Portrait
      height = maxSize;
      width = maxSize * aspectRatio;
    }

    return (
      <div className="relative mx-auto" style={{ width: `${maxSize}px`, height: `${maxSize}px` }}>
        {/* Sample image background */}
        <div 
          className="bg-gradient-to-br from-blue-200 via-purple-200 to-pink-200 border-2 border-gray-300 rounded-sm absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          {/* Sample crop area overlay */}
          <div className="absolute inset-0 border-2 border-blue-500 bg-blue-500 bg-opacity-10 rounded-sm">
            <div className="absolute top-1 left-1 w-1 h-1 bg-blue-500 rounded-full"></div>
            <div className="absolute top-1 right-1 w-1 h-1 bg-blue-500 rounded-full"></div>
            <div className="absolute bottom-1 left-1 w-1 h-1 bg-blue-500 rounded-full"></div>
            <div className="absolute bottom-1 right-1 w-1 h-1 bg-blue-500 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  };

  const handleCustomRatioSubmit = () => {
    const width = parseFloat(customInputs.width);
    const height = parseFloat(customInputs.height);
    const name = customInputs.name.trim();

    // Validation
    if (!width || !height || width <= 0 || height <= 0) {
      setCustomRatioError('Please enter valid positive numbers for width and height');
      return;
    }

    if (!name) {
      setCustomRatioError('Please enter a name for the custom ratio');
      return;
    }

    if (name.length > 20) {
      setCustomRatioError('Name must be 20 characters or less');
      return;
    }

    // Determine orientation
    let orientation: 'portrait' | 'landscape' | 'square';
    if (width === height) {
      orientation = 'square';
    } else if (width < height) {
      orientation = 'portrait';
    } else {
      orientation = 'landscape';
    }

    const customRatio: AspectRatio = {
      width,
      height,
      name,
      orientation
    };

    setCustomRatioError('');
    setShowCustomInput(false);
    setCustomInputs({ width: '', height: '', name: '' });
    onRatioChange(customRatio);
  };

  const handleCustomInputChange = (field: keyof CustomRatioInputs, value: string) => {
    setCustomInputs(prev => ({ ...prev, [field]: value }));
    if (customRatioError) {
      setCustomRatioError('');
    }
  };

  return (
    <Card padding="md" className={className || ''}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Aspect Ratio</h3>
          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {showCustomInput ? 'Hide Custom' : 'Custom Ratio'}
          </button>
        </div>

        {/* Custom Ratio Input */}
        {showCustomInput && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Create Custom Aspect Ratio</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={customInputs.width}
                  onChange={(e) => handleCustomInputChange('width', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 4"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={customInputs.height}
                  onChange={(e) => handleCustomInputChange('height', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 6"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={customInputs.name}
                onChange={(e) => handleCustomInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Custom 4x6"
                maxLength={20}
              />
            </div>
            {customRatioError && (
              <p className="text-xs text-red-600 mb-3">{customRatioError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCustomRatioSubmit}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Apply Custom Ratio
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomInputs({ width: '', height: '', name: '' });
                  setCustomRatioError('');
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Preset Ratios */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Common Presets</h4>
            <div className="text-xs text-gray-500">
              💡 <span className="text-blue-600 font-medium">Portrait</span> (taller) or <span className="text-green-600 font-medium">Landscape</span> (wider)
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ratios.map((baseRatio) => {
              const variants = getOrientationVariants(baseRatio);
              
              return variants.map((ratio) => {
                const isSelected = 
                  selectedRatio.name === ratio.name && 
                  selectedRatio.orientation === ratio.orientation;
                
                const orientationLabel = ratio.orientation === 'square' 
                  ? '' 
                  : ratio.orientation === 'portrait' 
                    ? 'Portrait' 
                    : 'Landscape';

                return (
                  <button
                    key={`${ratio.name}-${ratio.orientation}`}
                    onClick={() => onRatioChange(ratio)}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all duration-200',
                      'hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2 shadow-sm'
                        : 'border-gray-200 bg-white'
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-center h-12 items-center">
                        {renderRatioPreview(ratio)}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-900">
                          {ratio.name}
                        </p>
                        {orientationLabel && (
                          <p className={cn("text-xs font-medium", 
                            ratio.orientation === 'portrait' ? "text-blue-600" : "text-green-600"
                          )}>
                            {orientationLabel}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {ratio.width} × {ratio.height}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              });
            })}
          </div>
        </div>

        {/* Selected Ratio Info with Enhanced Preview */}
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 flex items-center justify-center">
                {renderRatioPreview(selectedRatio)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                Selected: {selectedRatio.name}
              </h4>
              <p className="text-sm text-gray-600 mb-2">
                Ratio: {selectedRatio.width}:{selectedRatio.height}
                {selectedRatio.orientation !== 'square' && ` (${selectedRatio.orientation})`}
              </p>
              <p className="text-xs text-gray-500">
                Images will be cropped to this aspect ratio while preserving maximum content.
                {selectedRatio.orientation !== 'square' && 
                  ` This ${selectedRatio.orientation} orientation works best for ${
                    selectedRatio.orientation === 'portrait' ? 'vertical' : 'horizontal'
                  } compositions.`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AspectRatioSelector;