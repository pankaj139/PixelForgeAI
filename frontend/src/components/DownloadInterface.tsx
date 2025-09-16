import React from 'react';
import { ProcessingResults, DownloadType } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface DownloadInterfaceProps {
  results: ProcessingResults;
  onDownload: (type: DownloadType, itemId?: string) => void;
  isDownloading?: boolean;
}

export const DownloadInterface: React.FC<DownloadInterfaceProps> = ({
  results,
  onDownload,
  isDownloading = false,
}) => {
  const downloadSections = [
    {
      title: 'Bulk Downloads',
      description: 'Download all processed content in convenient packages',
      items: [
        ...(results.downloadUrls.zip ? [{
          id: 'zip',
          type: 'zip' as DownloadType,
          title: 'Complete Archive (ZIP)',
          description: `All ${results.processedImages.length} processed images${results.composedSheets.length > 0 ? ` and ${results.composedSheets.length} A4 sheets` : ''}`,
          icon: (
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          ),
          size: 'Large',
          recommended: true,
        }] : []),
        ...(results.downloadUrls.pdf ? [{
          id: 'pdf',
          type: 'pdf' as DownloadType,
          title: 'PDF Document',
          description: `Multi-page PDF with ${results.composedSheets.length} A4 sheets`,
          icon: (
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          size: 'Medium',
          recommended: false,
        }] : []),
      ],
    },
    {
      title: 'Individual Images',
      description: 'Download specific processed images',
      items: results.processedImages.map((image, index) => ({
        id: image.id,
        type: 'image' as DownloadType,
        title: `Image ${index + 1}`,
        description: `${image.aspectRatio.name} (${image.aspectRatio.orientation})`,
        icon: (
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        size: 'Small',
        recommended: false,
      })),
    },
    ...(results.composedSheets.length > 0 ? [{
      title: 'A4 Sheets',
      description: 'Download individual composed sheets',
      items: results.composedSheets.map((sheet, index) => ({
        id: sheet.id,
        type: 'sheet' as DownloadType,
        title: `Sheet ${index + 1}`,
        description: `${sheet.layout.name} layout (${sheet.orientation})`,
        icon: (
          <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
        ),
        size: 'Medium',
        recommended: false,
      })),
    }] : []),
  ].filter(section => section.items.length > 0);

  if (downloadSections.length === 0) {
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
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-lg font-medium">No downloads available</p>
          <p className="text-sm">Complete processing to see download options</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {downloadSections.map((section) => (
        <div key={section.title}>
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
            <p className="text-sm text-gray-600">{section.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item) => (
              <Card
                key={item.id}
                className={`relative transition-all duration-200 hover:shadow-md ${
                  item.recommended ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                }`}
              >
                {item.recommended && (
                  <div className="absolute -top-2 -right-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {item.title}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {item.description}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.size === 'Large' ? 'bg-orange-100 text-orange-800' :
                          item.size === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {item.size}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant={item.recommended ? 'primary' : 'outline'}
                        onClick={() => onDownload(item.type, item.type === 'image' || item.type === 'sheet' ? item.id : undefined)}
                        disabled={isDownloading}
                        loading={isDownloading}
                        className="w-full"
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Download Summary */}
      <Card className="bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Download Summary</h4>
            <p className="text-sm text-gray-600 mt-1">
              Total available downloads: {downloadSections.reduce((acc, section) => acc + section.items.length, 0)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 space-y-1">
              <div>Images: {results.processedImages.length}</div>
              {results.composedSheets.length > 0 && (
                <div>Sheets: {results.composedSheets.length}</div>
              )}
              <div>Formats: {[
                results.downloadUrls.zip ? 'ZIP' : null,
                results.downloadUrls.pdf ? 'PDF' : null,
                'JPG'
              ].filter(Boolean).join(', ')}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Download Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">Download Tips</h4>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Use the ZIP archive for the most convenient bulk download</li>
                <li>PDF format is ideal for printing multiple sheets at once</li>
                <li>Individual downloads are perfect for sharing specific images</li>
                <li>All downloads preserve the original quality and aspect ratios</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DownloadInterface;