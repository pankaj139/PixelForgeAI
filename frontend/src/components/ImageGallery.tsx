import React, { useState, useEffect } from 'react';
import { ProcessedImage } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useInstagram } from '../hooks/useInstagram';
import InstagramAuth from './InstagramAuth';

interface ImageGalleryProps {
  images: ProcessedImage[];
  onDownload: (imageId: string) => void;
  isDownloading?: boolean;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onDownload,
  isDownloading = false,
}) => {
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(null);
  const [showInstagramAuth, setShowInstagramAuth] = useState(false);
  const { isConnected, postImage, isPosting, postError, lastPostResult } = useInstagram();

  // Instagram posting function
  const handlePostToInstagram = async (image: ProcessedImage) => {
    if (!isConnected) {
      setShowInstagramAuth(true);
      return;
    }

    try {
      await postImage({
        imageId: image.id,
        caption: image.instagramContent?.caption,
        hashtags: image.instagramContent?.hashtags,
      });
      
      // Show success message
      console.log('Posted to Instagram successfully!');
    } catch (error) {
      console.error('Failed to post to Instagram:', error);
    }
  };

  // Navigation functions
  const getCurrentImageIndex = () => {
    if (!selectedImage) return -1;
    return images.findIndex(img => img.id === selectedImage.id);
  };

  const goToNextImage = () => {
    const currentIndex = getCurrentImageIndex();
    if (currentIndex < images.length - 1) {
      setSelectedImage(images[currentIndex + 1]);
    }
  };

  const goToPreviousImage = () => {
    const currentIndex = getCurrentImageIndex();
    if (currentIndex > 0) {
      setSelectedImage(images[currentIndex - 1]);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedImage) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPreviousImage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNextImage();
          break;
        case 'Escape':
          event.preventDefault();
          setSelectedImage(null);
          break;
      }
    };

    if (selectedImage) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedImage, images]);

  if (images.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg font-medium">No processed images</p>
          <p className="text-sm">Images will appear here after processing</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Processed Images ({images.length})
        </h3>
        {images.length > 4 && (
          <p className="text-sm text-gray-500">← Scroll to see more →</p>
        )}
      </div>

      {/* Gallery Grid - Scrollable */}
      <div className="overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 w-max min-h-0"
             style={{ minWidth: '100%' }}>
        {images.map((image) => (
          <Card key={image.id} padding="none" className="overflow-hidden group flex-shrink-0 w-64">
            <div className="relative">
              {/* Image Thumbnail */}
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={`/api/download/image/${image.id}/thumbnail`}
                  alt={`Processed image ${image.id}`}
                  className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                  onClick={() => setSelectedImage(image)}
                  onError={(e) => {
                    // Fallback to placeholder if thumbnail fails to load
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik02MCA2MEgxNDBWMTQwSDYwVjYwWiIgZmlsbD0iI0Q1RDlERCIvPgo8L3N2Zz4K';
                  }}
                />
              </div>

              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 space-x-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(image);
                    }}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(image.id);
                    }}
                    disabled={isDownloading}
                  >
                    📥 Download
                  </Button>
                  {image.instagramContent && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostToInstagram(image);
                      }}
                      disabled={isPosting}
                      loading={isPosting}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      📸 Post
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Image Info */}
            <div className="p-3">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {(() => {
                      // Extract AI-generated name from processedPath
                      const filename = image.processedPath.split('/').pop() || '';
                      const nameWithoutExt = filename.split('.')[0] || '';
                      
                      // Parse AI name: "kids_beach_a7909950_4x6" -> "Kids Beach"
                      const parts = nameWithoutExt.split('_');
                      if (parts.length >= 3) {
                        // Take first parts before the UUID and aspect ratio
                        const aiName = parts.slice(0, -2).join(' ');
                        return aiName.split(' ').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                      }
                      
                      return `Image ${image.id.slice(0, 8)}`;
                    })()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {image.aspectRatio.name} ({image.aspectRatio.orientation})
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0 space-y-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ✨ AI Named
                  </span>
                  {image.instagramContent && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
                      📸 IG Content
                    </span>
                  )}
                </div>
              </div>

              {/* Processing details */}
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Processing time:</span>
                  <span>{image.processingTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Crop quality:</span>
                  <span>{Math.round(image.cropArea.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          currentIndex={getCurrentImageIndex()}
          totalImages={images.length}
          onClose={() => setSelectedImage(null)}
          onDownload={() => onDownload(selectedImage.id)}
          onNext={goToNextImage}
          onPrevious={goToPreviousImage}
          hasNext={getCurrentImageIndex() < images.length - 1}
          hasPrevious={getCurrentImageIndex() > 0}
          isDownloading={isDownloading}
          onPostToInstagram={handlePostToInstagram}
          isPosting={isPosting}
        />
      )}

      {/* Instagram Authentication Modal */}
      {showInstagramAuth && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowInstagramAuth(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Connect to Instagram</h3>
                  <button
                    onClick={() => setShowInstagramAuth(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <InstagramAuth 
                  onAuthSuccess={() => setShowInstagramAuth(false)}
                  onDisconnect={() => setShowInstagramAuth(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ImageModalProps {
  image: ProcessedImage;
  currentIndex: number;
  totalImages: number;
  onClose: () => void;
  onDownload: () => void;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  isDownloading: boolean;
  onPostToInstagram?: (image: ProcessedImage) => void;
  isPosting?: boolean;
}

const ImageModal: React.FC<ImageModalProps> = ({
  image,
  currentIndex,
  totalImages,
  onClose,
  onDownload,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  isDownloading,
  onPostToInstagram,
  isPosting = false,
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    {(() => {
                      // Extract AI-generated name from processedPath for modal title
                      const filename = image.processedPath.split('/').pop() || '';
                      const nameWithoutExt = filename.split('.')[0] || '';

                      // Parse AI name: "kids_beach_a7909950_4x6" -> "Kids Beach"
                      const parts = nameWithoutExt.split('_');
                      if (parts.length >= 3) {
                        const aiName = parts.slice(0, -2).join(' ');
                        return aiName.split(' ').map(word =>
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                      }

                      return 'Processed Image';
                    })()}
                  </h3>
                  
                  {/* Navigation Buttons */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={onPrevious}
                      disabled={!hasPrevious}
                      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous image (←)"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <span className="text-sm text-gray-500 font-medium min-w-0">
                      {currentIndex + 1} / {totalImages}
                    </span>
                    
                    <button
                      onClick={onNext}
                      disabled={!hasNext}
                      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next image (→)"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={onClose}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Close (Esc)"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {image.aspectRatio.name} • {image.aspectRatio.orientation} • ✨ AI Generated Name
                </p>
              </div>
            </div>

            {/* Image */}
            <div className="flex justify-center">
              <img
                src={`/api/download/image/${image.id}/preview`}
                alt="Processed image"
                className="max-w-full max-h-96 object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjAgMTIwSDE4MFYxODBIMTIwVjEyMFoiIGZpbGw9IiNENUQ5REQiLz4KPC9zdmc+Cg==';
                }}
              />
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card padding="sm">
                <h4 className="font-medium text-gray-900 mb-2">Processing Info</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Processing time:</dt>
                    <dd className="text-gray-900">{image.processingTime}ms</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Crop confidence:</dt>
                    <dd className="text-gray-900">{Math.round(image.cropArea.confidence * 100)}%</dd>
                  </div>
                </dl>
              </Card>

              <Card padding="sm">
                <h4 className="font-medium text-gray-900 mb-2">Crop Details</h4>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Crop area:</dt>
                    <dd className="text-gray-900">
                      {Math.round(image.cropArea.width)} × {Math.round(image.cropArea.height)}px
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Quality score:</dt>
                    <dd className="text-gray-900">
                      {Math.round(image.cropArea.confidence * 100)}%
                    </dd>
                  </div>
                  {image.detections && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Processing strategy:</dt>
                      <dd className="text-gray-900">
                        {image.detections.faces.length > 0 || image.detections.people.length > 0 
                          ? 'Smart cropping' 
                          : 'Center cropping'
                        }
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            </div>

            {/* Instagram Content */}
            {image.instagramContent && (
              <Card padding="md" className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                <div className="flex items-center mb-3">
                  <div className="text-2xl mr-2">📸</div>
                  <h4 className="font-medium text-gray-900">Instagram Content</h4>
                  <span className="ml-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
                    AI Generated
                  </span>
                </div>
                
                <div className="space-y-4">
                  {/* Caption */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Caption</h5>
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <p className="text-gray-800">{image.instagramContent.caption}</p>
                    </div>
                  </div>
                  
                  {/* Hashtags */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">
                      Hashtags ({image.instagramContent.hashtags.length})
                    </h5>
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <div className="flex flex-wrap gap-1">
                        {image.instagramContent.hashtags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-block bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-2 py-1 rounded-md text-sm cursor-pointer hover:from-purple-200 hover:to-pink-200 transition-colors"
                            onClick={() => navigator.clipboard.writeText(`#${tag}`)}
                            title="Click to copy"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Copy Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(image.instagramContent?.caption || '')}
                      className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors"
                    >
                      📋 Copy Caption
                    </button>
                    <button
                      onClick={() => {
                        const hashtags = image.instagramContent?.hashtags.map(tag => `#${tag}`).join(' ') || '';
                        navigator.clipboard.writeText(hashtags);
                      }}
                      className="flex-1 bg-pink-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-pink-700 transition-colors"
                    >
                      🏷️ Copy Hashtags
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                Use ← → arrow keys to navigate • Press Esc to close
              </div>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={onDownload}
                  disabled={isDownloading}
                  loading={isDownloading}
                >
                  📥 Download
                </Button>
                {image.instagramContent && onPostToInstagram && (
                  <Button
                    variant="primary"
                    onClick={() => onPostToInstagram(image)}
                    disabled={isPosting}
                    loading={isPosting}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    📸 Post to Instagram
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGallery;