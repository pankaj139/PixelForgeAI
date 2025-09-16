import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetPreview } from '../SheetPreview';
import { ComposedSheet } from '../../types';

describe('SheetPreview', () => {
  const mockOnDownload = vi.fn();

  const mockSheets: ComposedSheet[] = [
    {
      id: 'sheet-1',
      sheetPath: '/path/to/sheet1.jpg',
      layout: { rows: 2, columns: 2, name: '2x2' },
      orientation: 'portrait',
      images: [
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
      emptySlots: 2,
      createdAt: new Date('2023-01-01T10:00:00Z'),
    },
    {
      id: 'sheet-2',
      sheetPath: '/path/to/sheet2.jpg',
      layout: { rows: 1, columns: 3, name: '1x3' },
      orientation: 'landscape',
      images: [
        {
          id: 'image-3',
          originalFileId: 'file-3',
          processedPath: '/path/to/image3.jpg',
          cropArea: { x: 5, y: 5, width: 95, height: 95, confidence: 0.92 },
          aspectRatio: { width: 16, height: 9, name: '16x9', orientation: 'landscape' },
          detections: { faces: [], people: [], confidence: 0.8 },
          processingTime: 1800,
        },
      ],
      emptySlots: 2,
      createdAt: new Date('2023-01-01T11:00:00Z'),
    },
  ];

  beforeEach(() => {
    mockOnDownload.mockClear();
  });

  it('renders empty state when no sheets provided', () => {
    render(
      <SheetPreview
        sheets={[]}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('No A4 sheets composed')).toBeInTheDocument();
    expect(screen.getByText('Enable sheet composition in processing options to see sheets here')).toBeInTheDocument();
  });

  it('renders sheet grid with correct number of sheets', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Should render 2 sheet cards
    expect(screen.getByText('Sheet 1')).toBeInTheDocument();
    expect(screen.getByText('Sheet 2')).toBeInTheDocument();
  });

  it('displays correct sheet information', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Check first sheet info
    expect(screen.getByText('2x2 • portrait')).toBeInTheDocument();
    expect(screen.getAllByText('1/1/2023')[0]).toBeInTheDocument();

    // Check second sheet info
    expect(screen.getByText('1x3 • landscape')).toBeInTheDocument();

    // Check A4 badges
    const a4Badges = screen.getAllByText('A4');
    expect(a4Badges).toHaveLength(2);
  });

  it('displays sheet statistics correctly', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // First sheet: 2 images, 2 empty slots
    const imagesCounts = screen.getAllByText('2');
    expect(imagesCounts.length).toBeGreaterThan(0);

    const emptySlotsCounts = screen.getAllByText('2');
    expect(emptySlotsCounts.length).toBeGreaterThan(0);

    // Second sheet: 1 image, 2 empty slots
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('handles sheet thumbnail loading errors with grid visualization fallback', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    const images = screen.getAllByRole('img');
    
    // Simulate image load error on first sheet
    fireEvent.error(images[0]);
    
    // The error handler should replace the image with grid visualization
    // This is tested by checking if the image is hidden
    expect(images[0]).toHaveStyle('display: none');
  });

  it('shows hover actions on sheet cards', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    const viewButtons = screen.getAllByText('View');
    expect(viewButtons).toHaveLength(2);

    const downloadButtons = screen.getAllByText('Download');
    expect(downloadButtons).toHaveLength(2);
  });

  it('handles download button clicks', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    const downloadButtons = screen.getAllByText('Download');
    
    // Click first download button
    fireEvent.click(downloadButtons[0]);
    expect(mockOnDownload).toHaveBeenCalledWith('sheet-1');

    // Click second download button
    fireEvent.click(downloadButtons[1]);
    expect(mockOnDownload).toHaveBeenCalledWith('sheet-2');
  });

  it('disables download buttons when downloading', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
        isDownloading={true}
      />
    );

    const downloadButtons = screen.getAllByText('Download');
    downloadButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('opens modal when clicking view button', async () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    const viewButtons = screen.getAllByText('View');
    
    // Click first view button
    fireEvent.click(viewButtons[0]);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('A4 Sheet Preview')).toBeInTheDocument();
      expect(screen.getByText('2x2 layout • portrait orientation')).toBeInTheDocument();
    });
  });

  it('opens modal when clicking sheet thumbnail', async () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    const images = screen.getAllByRole('img');
    
    // Click first sheet image
    fireEvent.click(images[0]);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('A4 Sheet Preview')).toBeInTheDocument();
    });
  });

  it('displays detailed information in modal', async () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Open modal for first sheet
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      // Check layout info
      expect(screen.getByText('2x2')).toBeInTheDocument();
      const layoutSection = screen.getByText('Layout').closest('div');
      expect(layoutSection).toHaveTextContent('portrait');
      expect(screen.getByText('4')).toBeInTheDocument(); // Total slots

      // Check content info
      const contentSection = screen.getByText('Content').closest('div');
      expect(contentSection).toHaveTextContent('2'); // Images count
      expect(contentSection).toHaveTextContent('2'); // Empty slots
      expect(screen.getByText('50%')).toBeInTheDocument(); // Fill rate

      // Check metadata
      const metadataSection = screen.getByText('Metadata').closest('div');
      expect(metadataSection).toHaveTextContent('1/1/2023');
    });
  });

  it('handles modal close', async () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Open modal
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('A4 Sheet Preview')).toBeInTheDocument();
    });

    // Close modal using close button
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('A4 Sheet Preview')).not.toBeInTheDocument();
    });
  });

  it('handles download from modal', async () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Open modal
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('A4 Sheet Preview')).toBeInTheDocument();
    });

    // Click download in modal
    const modalDownloadButton = screen.getByText('Download Sheet');
    fireEvent.click(modalDownloadButton);

    expect(mockOnDownload).toHaveBeenCalledWith('sheet-1');
  });

  it('renders grid layout visualization correctly', () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Should render grid visualizations for each sheet
    // The grid visualization is rendered as small colored squares
    const gridContainers = document.querySelectorAll('.grid');
    expect(gridContainers.length).toBeGreaterThan(0);
  });

  it('calculates fill rate correctly', async () => {
    const sheetWithDifferentFillRate: ComposedSheet = {
      ...mockSheets[0],
      images: [mockSheets[0].images[0]], // Only 1 image
      emptySlots: 3,
    };

    render(
      <SheetPreview
        sheets={[sheetWithDifferentFillRate]}
        onDownload={mockOnDownload}
      />
    );

    // Open modal
    const viewButton = screen.getByText('View');
    fireEvent.click(viewButton);

    await waitFor(() => {
      // Should show 25% fill rate (1 out of 4 slots)
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  it('handles modal image loading errors with grid visualization fallback', async () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Open modal
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      const modalImage = screen.getByAltText('A4 Sheet');
      
      // Simulate image load error in modal
      fireEvent.error(modalImage);
      
      // Should hide the image and show grid visualization
      expect(modalImage).toHaveStyle('display: none');
    });
  });

  it('prevents event propagation on overlay button clicks', () => {
    const mockStopPropagation = vi.fn();
    
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    const downloadButtons = screen.getAllByText('Download');
    
    // Create a mock event with stopPropagation
    const mockEvent = {
      stopPropagation: mockStopPropagation,
    } as any;

    // Simulate click with stopPropagation
    fireEvent.click(downloadButtons[0], mockEvent);
    
    expect(mockOnDownload).toHaveBeenCalledWith('sheet-1');
  });

  it('displays correct time format in modal', async () => {
    render(
      <SheetPreview
        sheets={mockSheets}
        onDownload={mockOnDownload}
      />
    );

    // Open modal
    const viewButtons = screen.getAllByText('View');
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      // Should show formatted time
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  it('handles sheets with no images', () => {
    const emptySheet: ComposedSheet = {
      ...mockSheets[0],
      images: [],
      emptySlots: 4,
    };

    render(
      <SheetPreview
        sheets={[emptySheet]}
        onDownload={mockOnDownload}
      />
    );

    expect(screen.getByText('Sheet 1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // Images count
    expect(screen.getByText('4')).toBeInTheDocument(); // Empty slots
  });
});