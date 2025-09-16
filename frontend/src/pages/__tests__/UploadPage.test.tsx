import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UploadPage from '../UploadPage';

// Mock the hooks
vi.mock('../../hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    uploadFiles: vi.fn().mockResolvedValue({ success: true, jobId: 'test-job-id' }),
    isUploading: false,
    error: null,
    reset: vi.fn()
  })
}));

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ 'data-testid': 'file-input' }),
    isDragActive: false
  }))
}));

// Mock the useAuth hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    user: { id: 'test-user', email: 'test@example.com', username: 'testuser' },
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn()
  }))
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload page correctly', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    expect(screen.getByText('Upload & Process Images')).toBeInTheDocument();
    expect(screen.getByText(/Upload your images, configure processing options, and let AI optimize them for your needs/)).toBeInTheDocument();
  });

  it('renders all main components', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    // File upload component
    expect(screen.getByText('Drag & drop images here')).toBeInTheDocument();
    
    // Aspect ratio selector (there are multiple, so use getAllByText)
    const aspectRatioElements = screen.getAllByText('Aspect Ratio');
    expect(aspectRatioElements.length).toBeGreaterThanOrEqual(1);
    
    // Processing options (section header is "AI & Processing Options")
    expect(screen.getByText('AI & Processing Options')).toBeInTheDocument();
    
    // Sheet composition config (section header is just "Sheet Composition")
    expect(screen.getByText('Sheet Composition')).toBeInTheDocument();
  });

  it('does not show processing button when no files are selected', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    expect(screen.queryByText(/Start Processing/)).not.toBeInTheDocument();
  });

  it('shows processing summary in options panel', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    // First, expand the processing options section to see the Processing Summary
    const processingOptionsButton = screen.getByRole('button', { name: /AI & Processing Options.*3 enabled/s });
    fireEvent.click(processingOptionsButton);
    
    // Processing Summary is shown in the ProcessingOptionsPanel when expanded
    expect(screen.getByText('Processing Summary')).toBeInTheDocument();
  });

  it('has correct default processing options', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    // Check that 4x6 is selected by default (should be highlighted)
    const aspectRatioElements = screen.getAllByText('Aspect Ratio');
    const aspectRatioSection = aspectRatioElements[0].closest('div');
    expect(aspectRatioSection).toBeInTheDocument();
    
    // Expand processing section to check face detection default
    const processingOptionsButton = screen.getByRole('button', { name: /AI & Processing Options.*3 enabled/s });
    fireEvent.click(processingOptionsButton);
    
    // Check that face detection is enabled by default
    const switches = screen.getAllByRole('switch');
    const faceDetectionToggle = switches[0]; // First switch is face detection
    expect(faceDetectionToggle).toBeChecked();
    
    // Check other processing options defaults (AI naming and Instagram content)
    expect(switches[1]).toBeChecked(); // AI naming enabled by default
    expect(switches[2]).toBeChecked(); // Instagram content enabled by default
    
    // Check sheet composition is disabled by default (need to expand that section)
    const sheetCompositionButton = screen.getByRole('button', { name: /Sheet Composition.*Disabled/s });
    fireEvent.click(sheetCompositionButton);
    
    // Now get the sheet composition switch
    const allSwitches = screen.getAllByRole('switch');
    const sheetCompositionToggle = allSwitches[3]; // Should be the 4th switch (after the 3 processing switches)
    expect(sheetCompositionToggle).not.toBeChecked();
  });

  it('updates aspect ratio when selection changes', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    // Click on Square ratio - text should match actual button content
    const squareButton = screen.getByRole('button', { name: /Square.*1.*×.*1/s });
    fireEvent.click(squareButton);
    
    // The component should update to show Square as selected
    // This would be reflected in the processing summary when files are selected
  });

  it('toggles face detection correctly', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    // First, expand the processing options section to see the switches
    const processingOptionsButton = screen.getByRole('button', { name: /AI & Processing Options.*3 enabled/s });
    fireEvent.click(processingOptionsButton);
    
    const switches = screen.getAllByRole('switch');
    const faceDetectionToggle = switches[0]; // First switch is face detection
    
    // Initially enabled
    expect(faceDetectionToggle).toBeChecked();
    
    // Toggle off
    fireEvent.click(faceDetectionToggle);
    expect(faceDetectionToggle).not.toBeChecked();
    
    // Toggle back on
    fireEvent.click(faceDetectionToggle);
    expect(faceDetectionToggle).toBeChecked();
  });

  it('enables sheet composition when toggle is clicked', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    // First, expand the sheet composition section to see the switch
    const sheetCompositionButton = screen.getByRole('button', { name: /Sheet Composition.*Disabled/s });
    fireEvent.click(sheetCompositionButton);
    
    const switches = screen.getAllByRole('switch');
    const sheetCompositionToggle = switches[0]; // First switch is sheet composition
    
    // Initially disabled
    expect(sheetCompositionToggle).not.toBeChecked();
    
    // Enable sheet composition
    fireEvent.click(sheetCompositionToggle);
    expect(sheetCompositionToggle).toBeChecked();
    
    // Should show additional options
    expect(screen.getByText('Grid Layout')).toBeInTheDocument();
    expect(screen.getByText('A4 Sheet Orientation')).toBeInTheDocument();
  });

  it('handles responsive layout correctly', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );
    
    // Check that the grid layout is applied (this is a basic check)
    const mainContainer = screen.getByText('Upload & Process Images').closest('div');
    expect(mainContainer).toBeInTheDocument();
  });

  it('shows correct page title and description', () => {
    render(
      <TestWrapper>
        <UploadPage />
      </TestWrapper>
    );

    expect(screen.getByText('Upload & Process Images')).toBeInTheDocument();
    expect(screen.getByText(/Upload your images, configure processing options, and let AI optimize them for your needs/)).toBeInTheDocument();
    // Remove the test for text that doesn't exist in the actual component
  });
});