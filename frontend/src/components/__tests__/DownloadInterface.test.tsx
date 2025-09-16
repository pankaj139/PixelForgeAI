import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadInterface } from '../DownloadInterface';
import { ProcessingResults, DownloadType } from '../../types';

describe('DownloadInterface', () => {
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
        detections: { faces: [], people: [], confidence: 0.8 },
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

  it('renders empty state when no downloads available', () => {
    const emptyResults: ProcessingResults = {
      jobId: 'test-job',
      processedImages: [],
      composedSheets: [],
      downloadUrls: {
        individualImages: {},
        sheets: {},
      },
    };

    render(
      <DownloadInterface
        results={emptyResults}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('No downloads available')).toBeInTheDocument();
    expect(screen.getByText('Complete processing to see download options')).toBeInTheDocument();
  });

  it('renders all download sections with correct content', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Check section headers
    expect(screen.getByText('Bulk Downloads')).toBeInTheDocument();
    expect(screen.getByText('Individual Images')).toBeInTheDocument();
    expect(screen.getByText('A4 Sheets')).toBeInTheDocument();

    // Check section descriptions
    expect(screen.getByText('Download all processed content in convenient packages')).toBeInTheDocument();
    expect(screen.getByText('Download specific processed images')).toBeInTheDocument();
    expect(screen.getByText('Download individual composed sheets')).toBeInTheDocument();
  });

  it('displays bulk download options correctly', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Check ZIP download
    expect(screen.getByText('Complete Archive (ZIP)')).toBeInTheDocument();
    expect(screen.getByText('All 2 processed images and 1 A4 sheets')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();

    // Check PDF download
    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    expect(screen.getByText('Multi-page PDF with 1 A4 sheets')).toBeInTheDocument();
  });

  it('displays individual image downloads correctly', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Image 1')).toBeInTheDocument();
    expect(screen.getByText('4x6 (portrait)')).toBeInTheDocument();
    
    expect(screen.getByText('Image 2')).toBeInTheDocument();
    expect(screen.getByText('Square (square)')).toBeInTheDocument();
  });

  it('displays sheet downloads correctly', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Sheet 1')).toBeInTheDocument();
    expect(screen.getByText('2x2 layout (portrait)')).toBeInTheDocument();
  });

  it('handles download button clicks for different types', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Test ZIP download
    const zipButton = screen.getByText('Complete Archive (ZIP)').closest('.bg-white')?.querySelector('button');
    if (zipButton) {
      fireEvent.click(zipButton);
      expect(mockOnDownload).toHaveBeenCalledWith('zip', undefined);
    }

    // Test PDF download
    const pdfButton = screen.getByText('PDF Document').closest('.bg-white')?.querySelector('button');
    if (pdfButton) {
      fireEvent.click(pdfButton);
      expect(mockOnDownload).toHaveBeenCalledWith('pdf', undefined);
    }

    // Test individual image download
    const imageButton = screen.getByText('Image 1').closest('.bg-white')?.querySelector('button');
    if (imageButton) {
      fireEvent.click(imageButton);
      expect(mockOnDownload).toHaveBeenCalledWith('image', 'image-1');
    }

    // Test sheet download
    const sheetButton = screen.getByText('Sheet 1').closest('.bg-white')?.querySelector('button');
    if (sheetButton) {
      fireEvent.click(sheetButton);
      expect(mockOnDownload).toHaveBeenCalledWith('sheet', 'sheet-1');
    }
  });

  it('disables all download buttons when downloading', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
        isDownloading={true}
      />
    );

    const downloadButtons = screen.getAllByText('Download');
    downloadButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('displays correct size badges', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Large')).toBeInTheDocument(); // ZIP
    const mediumBadges = screen.getAllByText('Medium');
    expect(mediumBadges.length).toBeGreaterThan(0); // PDF and sheets
    
    const smallBadges = screen.getAllByText('Small');
    expect(smallBadges).toHaveLength(2); // Individual images
  });

  it('shows recommended badge only for ZIP download', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    const recommendedBadges = screen.getAllByText('Recommended');
    expect(recommendedBadges).toHaveLength(1);
  });

  it('displays download summary correctly', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Download Summary')).toBeInTheDocument();
    expect(screen.getByText('Total available downloads: 5')).toBeInTheDocument(); // 2 images + 1 sheet + 1 ZIP + 1 PDF
    expect(screen.getByText('Images: 2')).toBeInTheDocument();
    expect(screen.getByText('Sheets: 1')).toBeInTheDocument();
    expect(screen.getByText('Formats: ZIP, PDF, JPG')).toBeInTheDocument();
  });

  it('displays download tips section', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Download Tips')).toBeInTheDocument();
    expect(screen.getByText('Use the ZIP archive for the most convenient bulk download')).toBeInTheDocument();
    expect(screen.getByText('PDF format is ideal for printing multiple sheets at once')).toBeInTheDocument();
    expect(screen.getByText('Individual downloads are perfect for sharing specific images')).toBeInTheDocument();
    expect(screen.getByText('All downloads preserve the original quality and aspect ratios')).toBeInTheDocument();
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

    render(
      <DownloadInterface
        results={resultsWithoutSheets}
        onDownload={mockOnDownload}
      />
    );

    // Should not show A4 Sheets section
    expect(screen.queryByText('A4 Sheets')).not.toBeInTheDocument();
    
    // Should show only images in bulk download description
    expect(screen.getByText('All 2 processed images')).toBeInTheDocument();
  });

  it('handles results without PDF', () => {
    const resultsWithoutPdf: ProcessingResults = {
      ...mockResults,
      pdfPath: undefined,
      downloadUrls: {
        ...mockResults.downloadUrls,
        pdf: undefined,
      },
    };

    render(
      <DownloadInterface
        results={resultsWithoutPdf}
        onDownload={mockOnDownload}
      />
    );

    // Should not show PDF download option
    expect(screen.queryByText('PDF Document')).not.toBeInTheDocument();
    
    // Should not include PDF in formats list
    expect(screen.getByText('Formats: ZIP, JPG')).toBeInTheDocument();
  });

  it('handles results without ZIP', () => {
    const resultsWithoutZip: ProcessingResults = {
      ...mockResults,
      zipPath: undefined,
      downloadUrls: {
        ...mockResults.downloadUrls,
        zip: undefined,
      },
    };

    render(
      <DownloadInterface
        results={resultsWithoutZip}
        onDownload={mockOnDownload}
      />
    );

    // Should not show ZIP download option
    expect(screen.queryByText('Complete Archive (ZIP)')).not.toBeInTheDocument();
    
    // Should not show recommended badge
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
  });

  it('applies correct styling to recommended items', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // Find the ZIP download card (should be recommended)
    const zipCard = screen.getByText('Complete Archive (ZIP)').closest('.bg-white');
    expect(zipCard).toHaveClass('ring-2', 'ring-blue-500', 'ring-opacity-50');

    // Find a non-recommended card (should not have ring styling)
    const imageCard = screen.getByText('Image 1').closest('.bg-white');
    expect(imageCard).not.toHaveClass('ring-2', 'ring-blue-500');
  });

  it('uses primary button variant for recommended items', () => {
    render(
      <DownloadInterface
        results={mockResults}
        onDownload={mockOnDownload}
      />
    );

    // The ZIP download button should have primary styling (recommended)
    const zipButton = screen.getByText('Complete Archive (ZIP)').closest('.bg-white')?.querySelector('button');
    expect(zipButton).toHaveClass('bg-blue-600');

    // Other buttons should have outline styling
    const imageButton = screen.getByText('Image 1').closest('.bg-white')?.querySelector('button');
    expect(imageButton).toHaveClass('bg-transparent');
  });

  it('calculates total downloads correctly with varying content', () => {
    const customResults: ProcessingResults = {
      ...mockResults,
      processedImages: [mockResults.processedImages[0]], // Only 1 image
      composedSheets: [], // No sheets
      downloadUrls: {
        individualImages: { 'image-1': '/download/image-1' },
        sheets: {},
        zip: '/download/zip',
        // No PDF
      },
    };

    render(
      <DownloadInterface
        results={customResults}
        onDownload={mockOnDownload}
      />
    );

    // Should show 2 total downloads (1 image + 1 ZIP)
    expect(screen.getByText('Total available downloads: 2')).toBeInTheDocument();
    expect(screen.getByText('Images: 1')).toBeInTheDocument();
    expect(screen.queryByText('Sheets:')).not.toBeInTheDocument();
    expect(screen.getByText('Formats: ZIP, JPG')).toBeInTheDocument();
  });
});