import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AspectRatioSelector from '../AspectRatioSelector';
import { ASPECT_RATIOS } from '../../types';

describe('AspectRatioSelector', () => {
  const mockOnRatioChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    selectedRatio: ASPECT_RATIOS['4x6'],
    onRatioChange: mockOnRatioChange
  };

  it('renders aspect ratio selector correctly', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    expect(screen.getByText('Aspect Ratio')).toBeInTheDocument();
    expect(screen.getAllByText('4x6')).toHaveLength(2); // Portrait and landscape
  });

  it('displays all available aspect ratios', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    // Check for portrait and landscape variants
    expect(screen.getAllByText('4x6')).toHaveLength(2);
    expect(screen.getAllByText('5x7')).toHaveLength(2);
    expect(screen.getAllByText('8x10')).toHaveLength(2);
    expect(screen.getAllByText('16x9')).toHaveLength(2);
    expect(screen.getByText('Square')).toBeInTheDocument(); // Only one square
    expect(screen.getAllByText('3x2')).toHaveLength(2);
  });

  it('shows portrait and landscape options for non-square ratios', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    const portraitLabels = screen.getAllByText('Portrait');
    const landscapeLabels = screen.getAllByText('Landscape');
    
    expect(portraitLabels.length).toBeGreaterThan(0);
    expect(landscapeLabels.length).toBeGreaterThan(0);
  });

  it('highlights the selected aspect ratio', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    // Find the selected 4x6 portrait button - text format is "4x6 Portrait 4 × 6"
    const selectedButton = screen.getByRole('button', { 
      name: /4x6.*Portrait.*4.*×.*6/s 
    });
    
    expect(selectedButton).toHaveClass('border-blue-500');
    expect(selectedButton).toHaveClass('bg-blue-50');
  });

  it('calls onRatioChange when a different ratio is selected', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    // Click on Square ratio - text format is "Square 1 × 1"
    const squareButton = screen.getByRole('button', { 
      name: /Square.*1.*×.*1/s 
    });
    fireEvent.click(squareButton);
    
    expect(mockOnRatioChange).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Square',
        orientation: 'square'
      })
    );
  });

  it('calls onRatioChange when orientation is changed', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    // Click on 4x6 landscape (different orientation)
    const landscapeButton = screen.getByRole('button', { 
      name: /4x6.*Landscape/s 
    });
    fireEvent.click(landscapeButton);
    
    expect(mockOnRatioChange).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '4x6',
        orientation: 'landscape',
        width: 6,
        height: 4
      })
    );
  });

  it('displays selected ratio information correctly', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    expect(screen.getByText('Selected: 4x6')).toBeInTheDocument();
    expect(screen.getByText('Ratio: 4:6 (portrait)')).toBeInTheDocument();
  });

  it('updates selected ratio information when selection changes', () => {
    const { rerender } = render(<AspectRatioSelector {...defaultProps} />);
    
    // Change to square ratio
    const newProps = {
      ...defaultProps,
      selectedRatio: ASPECT_RATIOS['Square']
    };
    
    rerender(<AspectRatioSelector {...newProps} />);
    
    expect(screen.getByText('Selected: Square')).toBeInTheDocument();
    expect(screen.getByText('Ratio: 1:1')).toBeInTheDocument();
  });

  it('handles landscape orientation correctly', () => {
    const landscapeRatio = {
      width: 9,
      height: 16,
      name: '16x9',
      orientation: 'landscape' as const
    };
    
    const props = {
      ...defaultProps,
      selectedRatio: landscapeRatio
    };
    
    render(<AspectRatioSelector {...props} />);
    
    expect(screen.getByText('Selected: 16x9')).toBeInTheDocument();
    expect(screen.getByText('Ratio: 9:16 (landscape)')).toBeInTheDocument();
  });

  it('renders ratio previews with correct dimensions', () => {
    render(<AspectRatioSelector {...defaultProps} />);
    
    // Check that preview elements are rendered (they have specific styling)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // Each preset button should contain a preview div with specific dimensions
    const presetButtons = buttons.filter(button => 
      button.textContent?.includes('4x6') || 
      button.textContent?.includes('5x7') ||
      button.textContent?.includes('Square')
    );
    
    presetButtons.forEach(button => {
      const previewDiv = button.querySelector('div[style*="width"]');
      expect(previewDiv).toBeInTheDocument();
    });
  });

  describe('Custom Aspect Ratio', () => {
    it('shows custom ratio input when button is clicked', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      const customButton = screen.getByText('Custom Ratio');
      fireEvent.click(customButton);
      
      expect(screen.getByText('Create Custom Aspect Ratio')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., 4')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., 6')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., Custom 4x6')).toBeInTheDocument();
    });

    it('hides custom ratio input when hide button is clicked', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input
      const customButton = screen.getByText('Custom Ratio');
      fireEvent.click(customButton);
      
      // Hide custom input
      const hideButton = screen.getByText('Hide Custom');
      fireEvent.click(hideButton);
      
      expect(screen.queryByText('Create Custom Aspect Ratio')).not.toBeInTheDocument();
    });

    it('validates custom ratio inputs', async () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input
      fireEvent.click(screen.getByText('Custom Ratio'));
      
      // Try to submit without values
      const applyButton = screen.getByText('Apply Custom Ratio');
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter valid positive numbers for width and height')).toBeInTheDocument();
      });
    });

    it('validates custom ratio name', async () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input
      fireEvent.click(screen.getByText('Custom Ratio'));
      
      // Fill width and height but not name
      fireEvent.change(screen.getByPlaceholderText('e.g., 4'), { target: { value: '4' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., 6'), { target: { value: '6' } });
      
      const applyButton = screen.getByText('Apply Custom Ratio');
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a name for the custom ratio')).toBeInTheDocument();
      });
    });

    it('validates name length', async () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input
      fireEvent.click(screen.getByText('Custom Ratio'));
      
      // Fill with long name
      fireEvent.change(screen.getByPlaceholderText('e.g., 4'), { target: { value: '4' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., 6'), { target: { value: '6' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., Custom 4x6'), { 
        target: { value: 'This is a very long name that exceeds the limit' } 
      });
      
      const applyButton = screen.getByText('Apply Custom Ratio');
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Name must be 20 characters or less')).toBeInTheDocument();
      });
    });

    it('creates custom portrait ratio correctly', async () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input
      fireEvent.click(screen.getByText('Custom Ratio'));
      
      // Fill valid portrait ratio
      fireEvent.change(screen.getByPlaceholderText('e.g., 4'), { target: { value: '3' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., 6'), { target: { value: '4' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., Custom 4x6'), { target: { value: 'Custom 3x4' } });
      
      const applyButton = screen.getByText('Apply Custom Ratio');
      fireEvent.click(applyButton);
      
      expect(mockOnRatioChange).toHaveBeenCalledWith({
        width: 3,
        height: 4,
        name: 'Custom 3x4',
        orientation: 'portrait'
      });
    });

    it('creates custom landscape ratio correctly', async () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input
      fireEvent.click(screen.getByText('Custom Ratio'));
      
      // Fill valid landscape ratio
      fireEvent.change(screen.getByPlaceholderText('e.g., 4'), { target: { value: '16' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., 6'), { target: { value: '10' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., Custom 4x6'), { target: { value: 'Custom 16x10' } });
      
      const applyButton = screen.getByText('Apply Custom Ratio');
      fireEvent.click(applyButton);
      
      expect(mockOnRatioChange).toHaveBeenCalledWith({
        width: 16,
        height: 10,
        name: 'Custom 16x10',
        orientation: 'landscape'
      });
    });

    it('creates custom square ratio correctly', async () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input
      fireEvent.click(screen.getByText('Custom Ratio'));
      
      // Fill valid square ratio
      fireEvent.change(screen.getByPlaceholderText('e.g., 4'), { target: { value: '5' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., 6'), { target: { value: '5' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., Custom 4x6'), { target: { value: 'Custom Square' } });
      
      const applyButton = screen.getByText('Apply Custom Ratio');
      fireEvent.click(applyButton);
      
      expect(mockOnRatioChange).toHaveBeenCalledWith({
        width: 5,
        height: 5,
        name: 'Custom Square',
        orientation: 'square'
      });
    });

    it('clears error when input changes', async () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input and trigger error
      fireEvent.click(screen.getByText('Custom Ratio'));
      fireEvent.click(screen.getByText('Apply Custom Ratio'));
      
      await waitFor(() => {
        expect(screen.getByText('Please enter valid positive numbers for width and height')).toBeInTheDocument();
      });
      
      // Change input should clear error
      fireEvent.change(screen.getByPlaceholderText('e.g., 4'), { target: { value: '4' } });
      
      expect(screen.queryByText('Please enter valid positive numbers for width and height')).not.toBeInTheDocument();
    });

    it('cancels custom input correctly', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Show custom input and fill some values
      fireEvent.click(screen.getByText('Custom Ratio'));
      fireEvent.change(screen.getByPlaceholderText('e.g., 4'), { target: { value: '4' } });
      fireEvent.change(screen.getByPlaceholderText('e.g., 6'), { target: { value: '6' } });
      
      // Cancel
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(screen.queryByText('Create Custom Aspect Ratio')).not.toBeInTheDocument();
      
      // Show again and check inputs are cleared
      fireEvent.click(screen.getByText('Custom Ratio'));
      expect(screen.getByPlaceholderText('e.g., 4')).toHaveValue(null);
      expect(screen.getByPlaceholderText('e.g., 6')).toHaveValue(null);
    });
  });

  describe('Visual Previews', () => {
    it('renders enhanced preview with crop area indicators', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Check for gradient background and crop indicators
      const previewElements = screen.getAllByRole('button').filter(button => 
        button.querySelector('.bg-gradient-to-br')
      );
      
      expect(previewElements.length).toBeGreaterThan(0);
    });

    it('displays enhanced selected ratio information', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      expect(screen.getByText('Selected: 4x6')).toBeInTheDocument();
      expect(screen.getByText('Ratio: 4:6 (portrait)')).toBeInTheDocument();
      expect(screen.getByText(/Images will be cropped to this aspect ratio/)).toBeInTheDocument();
    });

    it('shows orientation-specific guidance', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      expect(screen.getByText(/This portrait orientation works best for vertical compositions/)).toBeInTheDocument();
    });

    it('handles square ratio guidance correctly', () => {
      const squareProps = {
        ...defaultProps,
        selectedRatio: ASPECT_RATIOS['Square']
      };
      
      render(<AspectRatioSelector {...squareProps} />);
      
      expect(screen.getByText('Ratio: 1:1')).toBeInTheDocument();
      expect(screen.queryByText(/orientation works best/)).not.toBeInTheDocument();
    });
  });

  describe('Orientation Handling', () => {
    it('correctly handles portrait orientation selection', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      const portraitButton = screen.getByRole('button', { 
        name: /4x6.*Portrait.*4.*×.*6/s 
      });
      
      expect(portraitButton).toHaveClass('border-blue-500');
    });

    it('correctly handles landscape orientation selection', () => {
      const landscapeRatio = {
        width: 6,
        height: 4,
        name: '4x6',
        orientation: 'landscape' as const
      };
      
      const props = {
        ...defaultProps,
        selectedRatio: landscapeRatio
      };
      
      render(<AspectRatioSelector {...props} />);
      
      const landscapeButton = screen.getByRole('button', { 
        name: /4x6.*Landscape.*6.*×.*4/s 
      });
      
      expect(landscapeButton).toHaveClass('border-blue-500');
    });

    it('shows both orientations for non-square ratios', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Should have both portrait and landscape for 4x6 (there are multiple portrait/landscape labels)
      expect(screen.getAllByText('Portrait').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Landscape').length).toBeGreaterThan(0);
    });

    it('shows only one option for square ratios', () => {
      render(<AspectRatioSelector {...defaultProps} />);
      
      // Square should only appear once
      const squareButtons = screen.getAllByText('Square');
      expect(squareButtons).toHaveLength(1);
    });
  });
});