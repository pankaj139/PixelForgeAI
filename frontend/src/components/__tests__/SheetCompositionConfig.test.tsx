import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import SheetCompositionConfig from '../SheetCompositionConfig';
import { GRID_LAYOUTS } from '../../types';

describe('SheetCompositionConfig', () => {
  const mockOnOptionsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    options: null,
    onOptionsChange: mockOnOptionsChange
  };

  it('renders sheet composition config correctly when disabled', () => {
    render(<SheetCompositionConfig {...defaultProps} />);
    
    expect(screen.getByText('A4 Sheet Composition')).toBeInTheDocument();
    expect(screen.getByText('Arrange processed images on A4 sheets for printing')).toBeInTheDocument();
    
    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveClass('bg-gray-200');
  });

  it('enables sheet composition when toggle is clicked', () => {
    render(<SheetCompositionConfig {...defaultProps} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait',
      generatePDF: false
    });
  });

  it('disables sheet composition when toggle is clicked while enabled', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    const switches = screen.getAllByRole('switch');
    const toggle = switches[0]; // First switch is the main toggle
    fireEvent.click(toggle);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith(null);
  });

  it('shows configuration options when enabled', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    expect(screen.getByText('Grid Layout')).toBeInTheDocument();
    expect(screen.getByText('A4 Sheet Orientation')).toBeInTheDocument();
    expect(screen.getByText('Generate PDF')).toBeInTheDocument();
  });

  it('displays all grid layout options', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    expect(screen.getAllByText('1x2')).toHaveLength(1);
    expect(screen.getAllByText('1x3')).toHaveLength(1);
    expect(screen.getAllByText('2x2')).toHaveLength(2); // One in button, one in summary
  });

  it('highlights selected grid layout', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['1x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    const selectedButton = screen.getByRole('button', { name: /1x2.*1×2 grid/s });
    expect(selectedButton).toHaveClass('border-blue-500');
    expect(selectedButton).toHaveClass('bg-blue-50');
  });

  it('changes grid layout when different option is selected', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    const layoutButton = screen.getByRole('button', { name: /1x3.*1×3 grid/s });
    fireEvent.click(layoutButton);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      ...enabledOptions,
      gridLayout: GRID_LAYOUTS['1x3']
    });
  });

  it('displays orientation options correctly', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    expect(screen.getAllByText('portrait')).toHaveLength(2); // One in button, one in summary
    expect(screen.getAllByText('landscape')).toHaveLength(1);
  });

  it('changes orientation when different option is selected', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    const landscapeButton = screen.getByRole('button', { name: /landscape/i });
    fireEvent.click(landscapeButton);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      ...enabledOptions,
      orientation: 'landscape'
    });
  });

  it('toggles PDF generation option', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    const switches = screen.getAllByRole('switch');
    const pdfToggle = switches[1]; // Second switch is the PDF toggle
    fireEvent.click(pdfToggle);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      ...enabledOptions,
      generatePDF: true
    });
  });

  it('displays composition settings summary', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['1x3'],
      orientation: 'landscape' as const,
      generatePDF: true
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    expect(screen.getByText('Composition Settings')).toBeInTheDocument();
    expect(screen.getByText('Grid Layout:')).toBeInTheDocument();
    expect(screen.getAllByText('1x3')).toHaveLength(2); // One in button, one in summary
    expect(screen.getByText('A4 Orientation:')).toBeInTheDocument();
    expect(screen.getAllByText('landscape')).toHaveLength(2); // One in button, one in summary
    expect(screen.getByText('Images per Sheet:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // 1x3 = 3 images
    expect(screen.getByText('PDF Generation:')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('calculates images per sheet correctly for different layouts', () => {
    const enabledOptions = {
      enabled: true,
      gridLayout: GRID_LAYOUTS['2x2'],
      orientation: 'portrait' as const,
      generatePDF: false
    };

    const props = {
      ...defaultProps,
      options: enabledOptions
    };

    render(<SheetCompositionConfig {...props} />);
    
    expect(screen.getByText('4')).toBeInTheDocument(); // 2x2 = 4 images
  });

  it('hides configuration options when disabled', () => {
    render(<SheetCompositionConfig {...defaultProps} />);
    
    expect(screen.queryByText('Grid Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('A4 Sheet Orientation')).not.toBeInTheDocument();
    expect(screen.queryByText('Generate PDF')).not.toBeInTheDocument();
  });
});