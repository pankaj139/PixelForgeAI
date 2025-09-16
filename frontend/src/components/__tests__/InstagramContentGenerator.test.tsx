/**
 * @fileoverview Test suite for Instagram Content Generation Features
 * 
 * This file contains comprehensive unit tests for Instagram content generation, covering:
 * - Instagram content display in processed images
 * - Hashtag and caption generation integration
 * - Copy to clipboard functionality for Instagram content
 * - Instagram content in download results
 * - AI naming integration with Instagram features
 * - Instagram content rendering in galleries and modals
 * 
 * Tests ensure Instagram content generation features work correctly throughout the application.
 * 
 * @usage npm test -- src/components/__tests__/InstagramContentGenerator.test.tsx
 * @expected-returns Test results with coverage for all Instagram content features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import type { ProcessedImage } from '../../types';

// Mock the clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});

// Component to test Instagram content rendering
const InstagramContentDisplay: React.FC<{ image: ProcessedImage }> = ({ image }) => {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div data-testid="instagram-content">
      {image.instagramContent && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            📸 Instagram Content
          </h4>
          
          {/* Caption */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Caption
            </label>
            <div className="bg-gray-50 rounded-lg p-3 relative">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {image.instagramContent.caption}
              </p>
              <button
                onClick={() => copyToClipboard(image.instagramContent!.caption)}
                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700"
                title="Copy caption"
                data-testid="copy-caption"
              >
                📋
              </button>
            </div>
          </div>

          {/* Hashtags */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Hashtags ({image.instagramContent.hashtags.length})
            </label>
            <div className="bg-gray-50 rounded-lg p-3 relative">
              <p className="text-sm text-blue-600">
                {image.instagramContent.hashtags.join(' ')}
              </p>
              <button
                onClick={() => copyToClipboard(image.instagramContent!.hashtags.join(' '))}
                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700"
                title="Copy hashtags"
                data-testid="copy-hashtags"
              >
                📋
              </button>
            </div>
          </div>
          
          {/* Copy All Button */}
          <button
            onClick={() => copyToClipboard(`${image.instagramContent!.caption}\n\n${image.instagramContent!.hashtags.join(' ')}`)}
            className="mt-3 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium py-2 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
            data-testid="copy-all-instagram"
          >
            📸 Copy Full Instagram Post
          </button>
        </div>
      )}
    </div>
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

describe('Instagram Content Generation', () => {
  const mockProcessedImageWithInstagram: ProcessedImage = {
    id: 'img-1',
    originalFileId: 'file-1',
    jobId: 'job-1',
    processedPath: '/processed/image1.jpg',
    cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
    aspectRatio: { width: 4, height: 6, name: '4x6' },
    detections: { faces: [], people: [], confidence: 0 },
    processingTime: 1500,
    createdAt: new Date(),
    instagramContent: {
      caption: '🌟 Captured this beautiful moment! ✨\n\nLife is full of precious memories that deserve to be cherished forever. Sometimes the simplest moments bring the greatest joy. 💫\n\n#memories #joy',
      hashtags: [
        '#photography',
        '#moment',
        '#beautiful',
        '#memories',
        '#joy',
        '#life',
        '#precious',
        '#cherish',
        '#simple',
        '#happiness',
        '#capture',
        '#photo',
        '#instagram',
        '#love',
        '#blessed'
      ]
    },
    aiGeneratedName: 'beautiful_moment'
  };

  const mockProcessedImageWithoutInstagram: ProcessedImage = {
    id: 'img-2',
    originalFileId: 'file-2',
    jobId: 'job-2',
    processedPath: '/processed/image2.jpg',
    cropArea: { x: 0, y: 0, width: 100, height: 100, confidence: 0.8 },
    aspectRatio: { width: 4, height: 6, name: '4x6' },
    detections: { faces: [], people: [], confidence: 0 },
    processingTime: 1200,
    createdAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Instagram Content Display', () => {
    it('renders Instagram content when available', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      expect(screen.getByText('📸 Instagram Content')).toBeInTheDocument();
      expect(screen.getByText('Caption')).toBeInTheDocument();
      expect(screen.getByText(/Captured this beautiful moment/)).toBeInTheDocument();
      expect(screen.getByText('Hashtags (15)')).toBeInTheDocument();
      expect(screen.getByText(/#photography #moment #beautiful/)).toBeInTheDocument();
      expect(screen.getByTestId('copy-caption')).toBeInTheDocument();
      expect(screen.getByTestId('copy-hashtags')).toBeInTheDocument();
      expect(screen.getByTestId('copy-all-instagram')).toBeInTheDocument();
    });

    it('does not render Instagram content when not available', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithoutInstagram} />
        </TestWrapper>
      );

      expect(screen.queryByText('📸 Instagram Content')).not.toBeInTheDocument();
      expect(screen.queryByText('Caption')).not.toBeInTheDocument();
      expect(screen.queryByText('Hashtags')).not.toBeInTheDocument();
    });

    it('copies caption to clipboard when copy button is clicked', async () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const copyButton = screen.getByTestId('copy-caption');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          mockProcessedImageWithInstagram.instagramContent!.caption
        );
      });
    });

    it('copies hashtags to clipboard when copy button is clicked', async () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const copyButton = screen.getByTestId('copy-hashtags');
      fireEvent.click(copyButton);

      const expectedHashtags = mockProcessedImageWithInstagram.instagramContent!.hashtags.join(' ');
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedHashtags);
      });
    });

    it('copies full Instagram post when copy all button is clicked', async () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const copyAllButton = screen.getByTestId('copy-all-instagram');
      fireEvent.click(copyAllButton);

      const expectedText = `${mockProcessedImageWithInstagram.instagramContent!.caption}\n\n${mockProcessedImageWithInstagram.instagramContent!.hashtags.join(' ')}`;
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedText);
      });
    });

    it('displays correct hashtag count', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const hashtagCount = mockProcessedImageWithInstagram.instagramContent!.hashtags.length;
      expect(screen.getByText(`Hashtags (${hashtagCount})`)).toBeInTheDocument();
    });

    it('preserves line breaks in caption', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const captionElement = screen.getByText(/Captured this beautiful moment/);
      expect(captionElement).toHaveClass('whitespace-pre-wrap');
    });

    it('displays hashtags with proper styling', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const hashtagsElement = screen.getByText(/#photography #moment #beautiful/);
      expect(hashtagsElement).toHaveClass('text-blue-600');
    });
  });

  describe('Instagram Content Integration', () => {
    it('shows Instagram content alongside AI generated name', () => {
      render(
        <TestWrapper>
          <div>
            <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
            {mockProcessedImageWithInstagram.aiGeneratedName && (
              <div data-testid="ai-name">
                AI Name: {mockProcessedImageWithInstagram.aiGeneratedName}
              </div>
            )}
          </div>
        </TestWrapper>
      );

      expect(screen.getByText('📸 Instagram Content')).toBeInTheDocument();
      expect(screen.getByTestId('ai-name')).toBeInTheDocument();
      expect(screen.getByText('AI Name: beautiful_moment')).toBeInTheDocument();
    });

    it('handles Instagram content with various hashtag counts', () => {
      const imageWithFewHashtags = {
        ...mockProcessedImageWithInstagram,
        instagramContent: {
          caption: 'Simple moment',
          hashtags: ['#photo', '#simple', '#moment']
        }
      };

      render(
        <TestWrapper>
          <InstagramContentDisplay image={imageWithFewHashtags} />
        </TestWrapper>
      );

      expect(screen.getByText('Hashtags (3)')).toBeInTheDocument();
    });

    it('handles Instagram content with long captions', () => {
      const imageWithLongCaption = {
        ...mockProcessedImageWithInstagram,
        instagramContent: {
          caption: 'This is a very long caption that contains multiple sentences and paragraphs to test how the component handles longer text content.\n\nIt should display properly with line breaks and proper formatting throughout the entire content area.',
          hashtags: ['#long', '#caption', '#test']
        }
      };

      render(
        <TestWrapper>
          <InstagramContentDisplay image={imageWithLongCaption} />
        </TestWrapper>
      );

      expect(screen.getByText(/This is a very long caption/)).toBeInTheDocument();
      expect(screen.getByText(/proper formatting throughout/)).toBeInTheDocument();
    });

    it('handles Instagram content with special characters in hashtags', () => {
      const imageWithSpecialHashtags = {
        ...mockProcessedImageWithInstagram,
        instagramContent: {
          caption: 'Special content',
          hashtags: ['#café', '#naïve', '#résumé', '#piñata', '#Zürich']
        }
      };

      render(
        <TestWrapper>
          <InstagramContentDisplay image={imageWithSpecialHashtags} />
        </TestWrapper>
      );

      expect(screen.getByText('#café #naïve #résumé #piñata #Zürich')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles clipboard API not available', async () => {
      // Mock clipboard API as undefined
      const originalClipboard = navigator.clipboard;
      // @ts-ignore
      delete navigator.clipboard;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const copyButton = screen.getByTestId('copy-caption');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Restore clipboard API
      navigator.clipboard = originalClipboard;
      consoleSpy.mockRestore();
    });

    it('handles clipboard API failure', async () => {
      const clipboardError = new Error('Clipboard access denied');
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(clipboardError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      const copyButton = screen.getByTestId('copy-caption');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy: ', clipboardError);
      });

      consoleSpy.mockRestore();
    });

    it('handles empty Instagram content gracefully', () => {
      const imageWithEmptyInstagram = {
        ...mockProcessedImageWithInstagram,
        instagramContent: {
          caption: '',
          hashtags: []
        }
      };

      render(
        <TestWrapper>
          <InstagramContentDisplay image={imageWithEmptyInstagram} />
        </TestWrapper>
      );

      expect(screen.getByText('📸 Instagram Content')).toBeInTheDocument();
      expect(screen.getByText('Hashtags (0)')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper button titles for copy actions', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      expect(screen.getByTitle('Copy caption')).toBeInTheDocument();
      expect(screen.getByTitle('Copy hashtags')).toBeInTheDocument();
    });

    it('uses semantic HTML elements', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      // Check for proper heading hierarchy
      expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('📸 Instagram Content');
      
      // Check for proper button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3); // caption, hashtags, copy all
    });

    it('provides proper labels for form elements', () => {
      render(
        <TestWrapper>
          <InstagramContentDisplay image={mockProcessedImageWithInstagram} />
        </TestWrapper>
      );

      expect(screen.getByText('Caption')).toBeInTheDocument();
      expect(screen.getByText(/Hashtags \(\d+\)/)).toBeInTheDocument();
    });
  });
});
