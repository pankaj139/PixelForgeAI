import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import FileUpload from '../FileUpload';
import { FILE_CONSTRAINTS } from '../../types';

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn((options) => ({
    getRootProps: () => ({
      'data-testid': 'dropzone'
    }),
    getInputProps: () => ({
      'data-testid': 'file-input'
    }),
    isDragActive: false
  }))
}));

describe('FileUpload', () => {
  const mockOnFilesSelected = vi.fn();
  const mockOnRemoveFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    onFilesSelected: mockOnFilesSelected,
    selectedFiles: [],
    onRemoveFile: mockOnRemoveFile
  };

  it('renders upload interface correctly', () => {
    render(<FileUpload {...defaultProps} />);
    
    expect(screen.getByText('Drag & drop images here')).toBeInTheDocument();
    expect(screen.getByText('click to browse')).toBeInTheDocument();
    expect(screen.getByText('Supports: JPEG, PNG, WEBP, TIFF')).toBeInTheDocument();
  });

  it('displays file constraints correctly', () => {
    render(<FileUpload {...defaultProps} />);
    
    const maxSizeMB = Math.round(FILE_CONSTRAINTS.MAX_FILE_SIZE / (1024 * 1024));
    expect(screen.getByText(`Max file size: ${maxSizeMB}MB`)).toBeInTheDocument();
    expect(screen.getByText(`Max files: ${FILE_CONSTRAINTS.MAX_FILES_PER_UPLOAD}`)).toBeInTheDocument();
  });

  it('shows selected files when files are provided', () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const props = {
      ...defaultProps,
      selectedFiles: [mockFile]
    };

    render(<FileUpload {...props} />);
    
    expect(screen.getByText('Selected Files (1)')).toBeInTheDocument();
    expect(screen.getByText('test.jpg')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('calls onRemoveFile when remove button is clicked', () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const props = {
      ...defaultProps,
      selectedFiles: [mockFile]
    };

    render(<FileUpload {...props} />);
    
    const removeButton = screen.getByRole('button', { name: /remove test\.jpg/i });
    fireEvent.click(removeButton);
    
    expect(mockOnRemoveFile).toHaveBeenCalledWith(0);
  });

  it('calls onFilesSelected with empty array when Clear All is clicked', () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const props = {
      ...defaultProps,
      selectedFiles: [mockFile]
    };

    render(<FileUpload {...props} />);
    
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);
    
    expect(mockOnFilesSelected).toHaveBeenCalledWith([]);
  });

  it('disables interactions when disabled prop is true', () => {
    const props = {
      ...defaultProps,
      disabled: true
    };

    render(<FileUpload {...props} />);
    
    const dropzone = screen.getByTestId('dropzone');
    expect(dropzone.closest('.cursor-not-allowed')).toBeInTheDocument();
  });

  it('formats file sizes correctly', () => {
    const mockFile = new File(['x'.repeat(1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 }); // 1MB
    
    const props = {
      ...defaultProps,
      selectedFiles: [mockFile]
    };

    render(<FileUpload {...props} />);
    
    expect(screen.getByText('1 MB')).toBeInTheDocument();
  });

  it('shows multiple selected files correctly', () => {
    const mockFiles = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.png', { type: 'image/png' })
    ];
    const props = {
      ...defaultProps,
      selectedFiles: mockFiles
    };

    render(<FileUpload {...props} />);
    
    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    expect(screen.getByText('test1.jpg')).toBeInTheDocument();
    expect(screen.getByText('test2.png')).toBeInTheDocument();
  });

  it('handles empty file list correctly', () => {
    render(<FileUpload {...defaultProps} />);
    
    expect(screen.queryByText('Selected Files')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });
});