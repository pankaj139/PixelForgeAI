import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProcessingOptionsPanel from '../ProcessingOptionsPanel';
import { ASPECT_RATIOS } from '../../types';

describe('ProcessingOptionsPanel', () => {
  const mockOnOptionsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultOptions = {
    aspectRatio: ASPECT_RATIOS['4x6'],
    faceDetectionEnabled: true,
    sheetComposition: null,
    aiNamingEnabled: false,
    generateInstagramContent: false
  };

  const defaultProps = {
    options: defaultOptions,
    onOptionsChange: mockOnOptionsChange
  };

  it('renders processing options panel correctly', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    expect(screen.getByText('Processing Options')).toBeInTheDocument();
    expect(screen.getByText('AI Face Detection')).toBeInTheDocument();
    expect(screen.getByText('Use computer vision to detect faces and keep them centered when cropping')).toBeInTheDocument();
  });

  it('shows face detection toggle in correct state', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    const toggle = screen.getByLabelText('AI Face Detection');
    expect(toggle).toBeChecked();
    expect(toggle).toHaveClass('bg-blue-600');
  });

  it('shows face detection disabled state correctly', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultOptions,
        faceDetectionEnabled: false
      }
    };
    
    render(<ProcessingOptionsPanel {...props} />);
    
    const toggle = screen.getByLabelText('AI Face Detection');
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveClass('bg-gray-200');
  });

  it('calls onOptionsChange when face detection is toggled', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    const toggle = screen.getByLabelText('AI Face Detection');
    fireEvent.click(toggle);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      ...defaultOptions,
      faceDetectionEnabled: false
    });
  });

  it('shows AI-powered cropping info when face detection is enabled', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    expect(screen.getByText('AI-Powered Cropping Enabled')).toBeInTheDocument();
    expect(screen.getByText('Detects faces and people in your images')).toBeInTheDocument();
    expect(screen.getByText('Adjusts crop area to keep subjects centered')).toBeInTheDocument();
    expect(screen.getByText('Falls back to center cropping if no faces detected')).toBeInTheDocument();
  });

  it('hides AI-powered cropping info when face detection is disabled', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultOptions,
        faceDetectionEnabled: false
      }
    };

    render(<ProcessingOptionsPanel {...props} />);
    
    expect(screen.queryByText('AI-Powered Cropping Enabled')).not.toBeInTheDocument();
  });

  it('displays processing summary correctly', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    expect(screen.getByText('Processing Summary')).toBeInTheDocument();
    expect(screen.getByText('Target Aspect Ratio:')).toBeInTheDocument();
    expect(screen.getByText('4x6 (4:6)')).toBeInTheDocument();
    expect(screen.getByText('Orientation:')).toBeInTheDocument();
    expect(screen.getByText('portrait')).toBeInTheDocument();
    expect(screen.getByText('Face Detection:')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Sheet Composition:')).toBeInTheDocument();
    expect(screen.getByText('AI Naming:')).toBeInTheDocument();
    expect(screen.getByText('Instagram Content:')).toBeInTheDocument();
    expect(screen.getAllByText('Disabled')).toHaveLength(3); // Sheet Composition, AI Naming, Instagram Content
  });

  it('shows sheet composition as enabled when configured', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultOptions,
        sheetComposition: {
          enabled: true,
          gridLayout: { rows: 2, columns: 2, name: '2x2' },
          orientation: 'portrait' as const,
          generatePDF: false
        }
      }
    };

    render(<ProcessingOptionsPanel {...props} />);
    
    const enabledText = screen.getAllByText('Enabled');
    expect(enabledText).toHaveLength(2); // Face Detection and Sheet Composition
  });

  it('updates summary when aspect ratio changes', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultOptions,
        aspectRatio: ASPECT_RATIOS['Square']
      }
    };

    render(<ProcessingOptionsPanel {...props} />);
    
    expect(screen.getByText('Square (1:1)')).toBeInTheDocument();
    expect(screen.getByText('square')).toBeInTheDocument();
  });

  it('shows correct colors for enabled/disabled states in summary', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    const enabledText = screen.getByText('Enabled');
    const disabledTexts = screen.getAllByText('Disabled');
    
    expect(enabledText).toHaveClass('text-green-600');
    disabledTexts.forEach(disabledText => {
      expect(disabledText).toHaveClass('text-gray-500');
    });
  });

  it('handles landscape orientation in summary', () => {
    const landscapeRatio = {
      width: 9,
      height: 16,
      name: '16x9',
      orientation: 'landscape' as const
    };

    const props = {
      ...defaultProps,
      options: {
        ...defaultOptions,
        aspectRatio: landscapeRatio
      }
    };

    render(<ProcessingOptionsPanel {...props} />);
    
    expect(screen.getByText('16x9 (9:16)')).toBeInTheDocument();
    expect(screen.getByText('landscape')).toBeInTheDocument();
  });

  it('calls onOptionsChange when AI naming is toggled', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    const aiNamingToggle = screen.getByLabelText('✨ AI Smart Naming');
    fireEvent.click(aiNamingToggle);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      ...defaultOptions,
      aiNamingEnabled: true
    });
  });

  it('calls onOptionsChange when Instagram content is toggled', () => {
    render(<ProcessingOptionsPanel {...defaultProps} />);
    
    const instagramToggle = screen.getByLabelText('📸 Instagram Tags & Caption');
    fireEvent.click(instagramToggle);
    
    expect(mockOnOptionsChange).toHaveBeenCalledWith({
      ...defaultOptions,
      generateInstagramContent: true
    });
  });

  it('shows AI features as enabled in summary when activated', () => {
    const props = {
      ...defaultProps,
      options: {
        ...defaultOptions,
        faceDetectionEnabled: true, // Keep face detection enabled
        aiNamingEnabled: true,
        generateInstagramContent: true
      }
    };

    render(<ProcessingOptionsPanel {...props} />);
    
    expect(screen.getByText('AI Naming:')).toBeInTheDocument();
    expect(screen.getByText('Instagram Content:')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument(); // Face Detection
    expect(screen.getByText('✨ Enabled')).toBeInTheDocument(); // AI Naming
    expect(screen.getByText('📸 Enabled')).toBeInTheDocument(); // Instagram Content
  });
});