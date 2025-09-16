import React, { useState } from 'react';
import { ComposedSheet } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface SheetPreviewProps {
  sheets: ComposedSheet[];
  onDownload: (sheetId: string) => void;
  isDownloading?: boolean;
}

export const SheetPreview: React.FC<SheetPreviewProps> = ({
  sheets,
  onDownload,
  isDownloading = false,
}) => {
  const [selectedSheet, setSelectedSheet] = useState<ComposedSheet | null>(null);

  if (sheets.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium">No A4 sheets composed</p>
          <p className="text-sm">Enable sheet composition in processing options to see sheets here</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sheets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sheets.map((sheet, index) => (
          <Card key={sheet.id} padding="none" className="overflow-hidden group">
            <div className="relative">
              {/* Sheet Preview */}
              <div className="aspect-[210/297] bg-white border-2 border-gray-200 overflow-hidden">
                <img
                  src={`/api/download/sheet/${sheet.id}/preview`}
                  alt={`A4 Sheet ${index + 1}`}
                  className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-105"
                  onClick={() => setSelectedSheet(sheet)}
                  onError={(e) => {
                    // Fallback to grid visualization if thumbnail fails
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = generateGridVisualization(sheet);
                    }
                  }}
                />
              </div>

              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 space-x-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSheet(sheet);
                    }}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(sheet.id);
                    }}
                    disabled={isDownloading}
                  >
                    Download
                  </Button>
                </div>
              </div>
            </div>

            {/* Sheet Info */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    Sheet {index + 1}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {sheet.layout.name} • {sheet.orientation}
                  </p>
                </div>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  A4
                </span>
              </div>

              {/* Grid Layout Visualization */}
              <div className="mb-3">
                <GridLayoutVisualization
                  layout={sheet.layout}
                  filledSlots={sheet.images.length}
                  totalSlots={sheet.layout.rows * sheet.layout.columns}
                />
              </div>

              {/* Sheet Stats */}
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Images:</span>
                  <span>{sheet.images.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Empty slots:</span>
                  <span>{sheet.emptySlots}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{new Date(sheet.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Sheet Modal */}
      {selectedSheet && (
        <SheetModal
          sheet={selectedSheet}
          onClose={() => setSelectedSheet(null)}
          onDownload={() => onDownload(selectedSheet.id)}
          isDownloading={isDownloading}
        />
      )}
    </div>
  );
};

interface GridLayoutVisualizationProps {
  layout: { rows: number; columns: number };
  filledSlots: number;
  totalSlots: number;
}

const GridLayoutVisualization: React.FC<GridLayoutVisualizationProps> = ({
  layout,
  filledSlots,
  totalSlots,
}) => {
  const slots = Array.from({ length: totalSlots }, (_, index) => index < filledSlots);

  return (
    <div className="flex items-center justify-center">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        }}
      >
        {slots.map((filled, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-sm ${
              filled ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

interface SheetModalProps {
  sheet: ComposedSheet;
  onClose: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}

const SheetModal: React.FC<SheetModalProps> = ({
  sheet,
  onClose,
  onDownload,
  isDownloading,
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full sm:p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  A4 Sheet Preview
                </h3>
                <p className="text-sm text-gray-500">
                  {sheet.layout.name} layout • {sheet.orientation} orientation
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sheet Preview */}
            <div className="flex justify-center">
              <div className="max-w-2xl">
                <img
                  src={`/api/download/sheet/${sheet.id}/preview`}
                  alt="A4 Sheet"
                  className="w-full shadow-lg rounded-lg border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = generateGridVisualization(sheet);
                    }
                  }}
                />
              </div>
            </div>

            {/* Sheet Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card padding="sm">
                <h4 className="font-medium text-gray-900 mb-2">Layout</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Grid:</dt>
                    <dd className="text-gray-900">{sheet.layout.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Orientation:</dt>
                    <dd className="text-gray-900 capitalize">{sheet.orientation}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Total slots:</dt>
                    <dd className="text-gray-900">{sheet.layout.rows * sheet.layout.columns}</dd>
                  </div>
                </dl>
              </Card>

              <Card padding="sm">
                <h4 className="font-medium text-gray-900 mb-2">Content</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Images:</dt>
                    <dd className="text-gray-900">{sheet.images.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Empty slots:</dt>
                    <dd className="text-gray-900">{sheet.emptySlots}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Fill rate:</dt>
                    <dd className="text-gray-900">
                      {Math.round((sheet.images.length / (sheet.layout.rows * sheet.layout.columns)) * 100)}%
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card padding="sm">
                <h4 className="font-medium text-gray-900 mb-2">Metadata</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Created:</dt>
                    <dd className="text-gray-900">
                      {new Date(sheet.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Time:</dt>
                    <dd className="text-gray-900">
                      {new Date(sheet.createdAt).toLocaleTimeString()}
                    </dd>
                  </div>
                </dl>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={onDownload}
                disabled={isDownloading}
                loading={isDownloading}
              >
                Download Sheet
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to generate grid visualization fallback
const generateGridVisualization = (sheet: ComposedSheet): string => {
  const { rows, columns } = sheet.layout;
  const totalSlots = rows * columns;
  const filledSlots = sheet.images.length;

  let html = `
    <div class="w-full h-full flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <div class="grid gap-2 mb-4" style="grid-template-columns: repeat(${columns}, 1fr); grid-template-rows: repeat(${rows}, 1fr);">
  `;

  for (let i = 0; i < totalSlots; i++) {
    const filled = i < filledSlots;
    html += `
      <div class="w-8 h-8 rounded border-2 ${filled ? 'bg-blue-100 border-blue-300' : 'bg-gray-100 border-gray-300'} flex items-center justify-center">
        ${filled ? '<div class="w-4 h-4 bg-blue-500 rounded"></div>' : ''}
      </div>
    `;
  }

  html += `
        </div>
        <p class="text-sm text-gray-600">${sheet.layout.name} Layout</p>
        <p class="text-xs text-gray-500">${filledSlots}/${totalSlots} slots filled</p>
      </div>
    </div>
  `;

  return html;
};

export default SheetPreview;