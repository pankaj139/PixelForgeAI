import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ResultsGallery } from '../ResultsGallery';
import { ProcessingResults, DownloadType } from '../../types';

// Test wrapper with Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

// Helper function to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<TestWrapper>{component}</TestWrapper>);
};

// Mock child components
vi.mock('../ImageGallery', () => ({
  ImageGallery: ({ images, onDownload, isDownloading }: any) => (
    <div data-testid="image-gallery">
      <span>Images: {images.length}</span>
      <button 
        onClick={() => onDownload('test-image-id')}
        disabled={isDownloading}
      >
        Download Image
      </button>
    </div>
  ),
}));

vi.mock('../SheetPreview', () => ({
  SheetPreview: ({ sheets, onDownload, isDownloading }: any) => (
    <div data-testid="sheet-preview">
      <span>Sheets: {sheets.length}</span>
      <button 
        onClick={() => onDownload('test-sheet-id')}
        disabled={isDownloading}
      >
        Download Sheet
      </button>
    </div>
  ),
}));

vi.mock('../DownloadInterface', () => ({
  DownloadInterface: ({ results, onDownload, isDownloading }: any) => (
    <div data-testid="download-interface">
      <span>Downloads Available</span>
      <button 
        onClick={() => onDownload('zip')}
        disabled={isDownloading}
      >
        Download ZIP
      </button>
    </div>
  ),
}));

describe('ResultsGallery', () => {
  const mockOnDownload = vi.fn();

  const mockResults: ProcessingResults = {
    jobId: 'test-job-123',
    processedImages: [
      {
        id: 'image-1',
        originalFileId: 'file-1',
        processedPath: '/path/to/image1.jpg',
        cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.95 },
        aspectRatio: { width: 4, height: 6, name: '4x6', orientation: 'portrait' },
        detections: { faces: [], people: [], confidence: 0.8 },
        processingTime: 1500,
      },
      {
        id: 'image-2',
        originalFileId: 'file-2',
        processedPath: '/path/to/image2.jpg',
        cropArea: { x: 10, y: 10, width: 90, height: 90, confidence: 0.88 },
        aspectRatio: { width: 1, height: 1, name: 'Square', orientation: 'square' },
        detections: { faces: [{ boundingBox: { x: 20, y: 20, width: 30, height: 30 }, confidence: 0.9 }], people: [], confidence: 0.9 },
        processingTime: 1200,
      },
    ],
    composedSheets: [
      {
        id: 'sheet-1',
        sheetPath: '/path/to/sheet1.jpg',
        layout: { rows: 2, columns: 2, name: '2x2' },
        orientation: 'portrait',
        images: [],
        emptySlots: 2,
        createdAt: new Date('2023-01-01'),
      },
    ],
    pdfPath: '/path/to/document.pdf',
    zipPath: '/path/to/archive.zip',
    downloadUrls: {
      individualImages: {
        'image-1': '/download/image-1',
        'image-2': '/download/image-2',
      },
      sheets: {
        'sheet-1': '/download/sheet-1',
      },
      zip: '/download/zip',
      pdf: '/download/pdf',
    },
  };

  beforeEach(() => {
    mockOnDownload.mockClear();
  });

  it('renders with default images tab active', () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Check that tabs are rendered
    expect(screen.getByText('Individual Images')).toBeInTheDocument();
    expect(screen.getByText('A4 Sheets')).toBeInTheDocument();
    expect(screen.getByText('Download Options')).toBeInTheDocument();

    // Check that images tab is active (should show ImageGallery)
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument();
    expect(screen.getByText('Images: 2')).toBeInTheDocument();
  });

  it('displays correct counts in tab labels', () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Check tab counts
    expect(screen.getByText('2')).toBeInTheDocument(); // Images count
    expect(screen.getByText('1')).toBeInTheDocument(); // Sheets count
    expect(screen.getByText('5')).toBeInTheDocument(); // Download options count (2 images + 1 sheet + 1 zip + 1 pdf)
  });

  it('switches between tabs correctly', async () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Initially shows images
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument();

    // Click on sheets tab
    fireEvent.click(screen.getByText('A4 Sheets'));
    await waitFor(() => {
      expect(screen.getByTestId('sheet-preview')).toBeInTheDocument();
      expect(screen.getByText('Sheets: 1')).toBeInTheDocument();
    });

    // Click on downloads tab
    fireEvent.click(screen.getByText('Download Options'));
    await waitFor(() => {
      expect(screen.getByTestId('download-interface')).toBeInTheDocument();
      expect(screen.getByText('Downloads Available')).toBeInTheDocument();
    });
  });

  it('handles download actions from child components', async () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Test image download
    fireEvent.click(screen.getByText('Download Image'));
    expect(mockOnDownload).toHaveBeenCalledWith('image', 'test-image-id');

    // Switch to sheets and test sheet download
    fireEvent.click(screen.getByText('A4 Sheets'));
    await waitFor(() => {
      fireEvent.click(screen.getByText('Download Sheet'));
    });
    expect(mockOnDownload).toHaveBeenCalledWith('sheet', 'test-sheet-id');

    // Switch to downloads and test ZIP download
    fireEvent.click(screen.getByText('Download Options'));
    await waitFor(() => {
      fireEvent.click(screen.getByText('Download ZIP'));
    });
    expect(mockOnDownload).toHaveBeenCalledWith('zip');
  });

  it('displays quick actions section with correct information', () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    expect(screen.getByText('2 images processed, 1 sheets composed')).toBeInTheDocument();
    expect(screen.getByText('Download All (ZIP)')).toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('handles quick action downloads', () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Test ZIP download from quick actions
    fireEvent.click(screen.getByText('Download All (ZIP)'));
    expect(mockOnDownload).toHaveBeenCalledWith('zip');

    // Test PDF download from quick actions
    fireEvent.click(screen.getByText('Download PDF'));
    expect(mockOnDownload).toHaveBeenCalledWith('pdf');
  });

  it('disables buttons when downloading', () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
        isDownloading={true}
      />
    );

    // Quick action buttons should be disabled
    expect(screen.getByText('Download All (ZIP)')).toBeDisabled();
    expect(screen.getByText('Download PDF')).toBeDisabled();

    // Child component buttons should also be disabled
    expect(screen.getByText('Download Image')).toBeDisabled();
  });

  it('handles results without sheets', () => {
    const resultsWithoutSheets: ProcessingResults = {
      ...mockResults,
      composedSheets: [],
      downloadUrls: {
        ...mockResults.downloadUrls,
        sheets: {},
      },
    };

    renderWithRouter(
      <ResultsGallery
        results={resultsWithoutSheets}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Individual Images')).toBeInTheDocument();
    expect(screen.getByText('A4 Sheets')).toBeInTheDocument();
    expect(screen.getByText('Download Options')).toBeInTheDocument();

    // Should show "0" for sheets count
    const sheetsTab = screen.getByText('A4 Sheets').closest('button');
    expect(sheetsTab).toHaveTextContent('A4 Sheets0');
  });

  it('handles results without PDF or ZIP', () => {
    const limitedResults: ProcessingResults = {
      ...mockResults,
      pdfPath: undefined,
      zipPath: undefined,
      downloadUrls: {
        ...mockResults.downloadUrls,
        pdf: undefined,
        zip: undefined,
      },
    };

    renderWithRouter(
      <ResultsGallery
        results={limitedResults}
        onDownload={mockOnDownload}
      />
    );

    // Quick actions should not show PDF or ZIP buttons
    expect(screen.queryByText('Download All (ZIP)')).not.toBeInTheDocument();
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();

    // Should still show processing complete message
    expect(screen.getByText('Processing Complete')).toBeInTheDocument();
    expect(screen.getByText(/2 images processed/)).toBeInTheDocument();
  });

  it('applies correct styling to active tab', () => {
    renderWithRouter(
      <ResultsGallery
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    const imagesTab = screen.getByText('Individual Images').closest('button');
    const sheetsTab = screen.getByText('A4 Sheets').closest('button');

    // Images tab should be active (blue styling)
    expect(imagesTab).toHaveClass('border-blue-500', 'text-blue-600');
    
    // Sheets tab should be inactive (gray styling)
    expect(sheetsTab).toHaveClass('border-transparent', 'text-gray-500');

    // Click sheets tab and check styling changes
    fireEvent.click(screen.getByText('A4 Sheets'));
    
    expect(sheetsTab).toHaveClass('border-blue-500', 'text-blue-600');
    expect(imagesTab).toHaveClass('border-transparent', 'text-gray-500');
  });
});