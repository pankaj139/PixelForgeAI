import React from 'react';
import { cn } from '../utils/cn';
import { SheetCompositionOptions, GRID_LAYOUTS } from '../types';
import Card from './ui/Card';

interface SheetCompositionConfigProps {
  options: SheetCompositionOptions | null;
  onOptionsChange: (options: SheetCompositionOptions | null) => void;
  className?: string;
}

export const SheetCompositionConfig: React.FC<SheetCompositionConfigProps> = ({
  options,
  onOptionsChange,
  className
}) => {
  const gridLayouts = Object.values(GRID_LAYOUTS);

  const handleEnabledToggle = () => {
    if (options?.enabled) {
      onOptionsChange(null);
    } else {
      onOptionsChange({
        enabled: true,
        gridLayout: GRID_LAYOUTS['2x2'],
        orientation: 'portrait',
        generatePDF: false
      });
    }
  };

  const handleGridLayoutChange = (gridLayout: typeof GRID_LAYOUTS[keyof typeof GRID_LAYOUTS]) => {
    if (!options) return;
    onOptionsChange({
      ...options,
      gridLayout
    });
  };

  const handleOrientationChange = (orientation: 'portrait' | 'landscape') => {
    if (!options) return;
    onOptionsChange({
      ...options,
      orientation
    });
  };

  const handlePDFToggle = () => {
    if (!options) return;
    onOptionsChange({
      ...options,
      generatePDF: !options.generatePDF
    });
  };

  const renderGridPreview = (layout: typeof GRID_LAYOUTS[keyof typeof GRID_LAYOUTS]) => {
    const cells = Array.from({ length: layout.rows * layout.columns }, (_, i) => i);
    
    return (
      <div 
        className="grid gap-1 w-12 h-16 bg-white border border-gray-300 p-1"
        style={{ 
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`
        }}
      >
        {cells.map((cell) => (
          <div 
            key={cell}
            className="bg-gray-200 border border-gray-300 rounded-sm"
          />
        ))}
      </div>
    );
  };

  return (
    <Card padding="md" className={className || ''}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 id="sheet-composition-label" className="text-lg font-medium text-gray-900">A4 Sheet Composition</h3>
            <p className="text-sm text-gray-500 mt-1">
              Arrange processed images on A4 sheets for printing
            </p>
          </div>
          
          <button
            type="button"
            onClick={handleEnabledToggle}
            className={cn(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
              'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              options?.enabled ? 'bg-blue-600' : 'bg-gray-200'
            )}
            role="switch"
            aria-checked={options?.enabled || false}
            aria-labelledby="sheet-composition-label"
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0',
                'transition duration-200 ease-in-out',
                options?.enabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {options?.enabled && (
          <div className="space-y-6">
            {/* Grid Layout Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Grid Layout
              </label>
              <div className="grid grid-cols-3 gap-3">
                {gridLayouts.map((layout) => {
                  const isSelected = options.gridLayout.name === layout.name;
                  
                  return (
                    <button
                      key={layout.name}
                      onClick={() => handleGridLayoutChange(layout)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all duration-200',
                        'hover:border-blue-300 hover:bg-blue-50',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2'
                          : 'border-gray-200 bg-white'
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-center">
                          {renderGridPreview(layout)}
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-900">
                            {layout.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {layout.rows}×{layout.columns} grid
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* A4 Orientation */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                A4 Sheet Orientation
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['portrait', 'landscape'] as const).map((orientation) => {
                  const isSelected = options.orientation === orientation;
                  
                  return (
                    <button
                      key={orientation}
                      onClick={() => handleOrientationChange(orientation)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all duration-200',
                        'hover:border-blue-300 hover:bg-blue-50',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2'
                          : 'border-gray-200 bg-white'
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-center">
                          <div 
                            className="bg-white border-2 border-gray-300"
                            style={{
                              width: orientation === 'portrait' ? '24px' : '32px',
                              height: orientation === 'portrait' ? '32px' : '24px'
                            }}
                          />
                        </div>
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {orientation}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PDF Generation Option */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <label id="pdf-generation-label" className="text-sm font-medium text-gray-900">
                  Generate PDF
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Create a multi-page PDF from composed sheets
                </p>
              </div>
              
              <button
                type="button"
                onClick={handlePDFToggle}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                  'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  options.generatePDF ? 'bg-blue-600' : 'bg-gray-200'
                )}
                role="switch"
                aria-checked={options.generatePDF}
                aria-labelledby="pdf-generation-label"
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0',
                    'transition duration-200 ease-in-out',
                    options.generatePDF ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Composition Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                Composition Settings
              </h4>
              <div className="space-y-1 text-sm text-blue-700">
                <div className="flex justify-between">
                  <span>Grid Layout:</span>
                  <span className="font-medium">{options.gridLayout.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>A4 Orientation:</span>
                  <span className="font-medium capitalize">{options.orientation}</span>
                </div>
                <div className="flex justify-between">
                  <span>Images per Sheet:</span>
                  <span className="font-medium">
                    {options.gridLayout.rows * options.gridLayout.columns}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>PDF Generation:</span>
                  <span className="font-medium">
                    {options.generatePDF ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SheetCompositionConfig;