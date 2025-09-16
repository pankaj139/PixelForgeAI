import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProcessingResults, DownloadType } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ImageGallery } from './ImageGallery';
import { SheetPreview } from './SheetPreview';
import { DownloadInterface } from './DownloadInterface';

interface ResultsGalleryProps {
  results: ProcessingResults;
  onDownload: (type: DownloadType, itemId?: string) => void;
  isDownloading?: boolean;
}

type TabType = 'images' | 'sheets' | 'downloads';

export const ResultsGallery: React.FC<ResultsGalleryProps> = ({
  results,
  onDownload,
  isDownloading = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('images');

  const tabs = [
    {
      id: 'images' as TabType,
      label: 'Individual Images',
      count: results.processedImages.length,
    },
    {
      id: 'sheets' as TabType,
      label: 'A4 Sheets',
      count: results.composedSheets.length,
    },
    {
      id: 'downloads' as TabType,
      label: 'Download Options',
      count: Object.keys(results.downloadUrls.individualImages).length + 
             Object.keys(results.downloadUrls.sheets).length + 
             (results.downloadUrls.zip ? 1 : 0) + 
             (results.downloadUrls.pdf ? 1 : 0),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
              <span className={`
                ml-2 py-0.5 px-2 rounded-full text-xs
                ${activeTab === tab.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'images' && (
          <ImageGallery
            images={results.processedImages}
            onDownload={(imageId) => onDownload('image', imageId)}
            isDownloading={isDownloading}
          />
        )}

        {activeTab === 'sheets' && (
          <SheetPreview
            sheets={results.composedSheets}
            onDownload={(sheetId) => onDownload('sheet', sheetId)}
            isDownloading={isDownloading}
          />
        )}

        {activeTab === 'downloads' && (
          <DownloadInterface
            results={results}
            onDownload={onDownload}
            isDownloading={isDownloading}
          />
        )}
      </div>

      {/* Quick Actions */}
      <Card className="bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Processing Complete
            </h3>
            <p className="text-sm text-gray-600">
              {results.processedImages.length} images processed
              {results.composedSheets.length > 0 && 
                `, ${results.composedSheets.length} sheets composed`
              }
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {results.downloadUrls.zip && (
              <Button
                variant="primary"
                onClick={() => onDownload('zip')}
                disabled={isDownloading}
                loading={isDownloading}
              >
                Download All (ZIP)
              </Button>
            )}
            
            {results.downloadUrls.pdf && (
              <Button
                variant="outline"
                onClick={() => onDownload('pdf')}
                disabled={isDownloading}
              >
                Download PDF
              </Button>
            )}
            
            <Link 
              to="/upload" 
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Start New Upload
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ResultsGallery;