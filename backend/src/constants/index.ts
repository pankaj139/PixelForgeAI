import { AspectRatio } from '../types';

// Common aspect ratios for photo printing and display
export const ASPECT_RATIOS: Record<string, AspectRatio> = {
  '4x6': { width: 4, height: 6, name: '4x6', orientation: 'portrait' },
  '5x7': { width: 5, height: 7, name: '5x7', orientation: 'portrait' },
  '8x10': { width: 8, height: 10, name: '8x10', orientation: 'portrait' },
  '16x9': { width: 16, height: 9, name: '16x9', orientation: 'landscape' },
  'Square': { width: 1, height: 1, name: 'Square', orientation: 'square' },
  '3x2': { width: 3, height: 2, name: '3x2', orientation: 'landscape' },
} as const;

// File processing constants
export const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILES_PER_UPLOAD: 20,
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'] as const,
  TEMP_FILE_CLEANUP_HOURS: 24,
} as const;

// Computer vision constants
export const CV_CONSTANTS = {
  MIN_FACE_CONFIDENCE: 0.4,   // Balanced confidence for family photos with varied lighting  
  MIN_PERSON_CONFIDENCE: 0.35, // Balanced confidence for person detection
  MIN_DETECTION_SIZE: 50, // Minimum bounding box size in pixels
  MAX_DETECTIONS_PER_IMAGE: 20,
} as const;

// Processing constants
export const PROCESSING_CONSTANTS = {
  DEFAULT_QUALITY: 90,
  MIN_IMAGE_DIMENSION: 100,
  MAX_IMAGE_DIMENSION: 8000,
  UPSCALE_THRESHOLD: 2.0, // Maximum upscale factor
  CROP_PADDING_RATIO: 0.1, // 10% padding around detected subjects
} as const;

// Job status constants
export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_FILE_TYPE: 'Unsupported file type. Please upload JPEG, PNG, WEBP, or TIFF images.',
  FILE_TOO_LARGE: `File size exceeds the maximum limit of ${FILE_CONSTRAINTS.MAX_FILE_SIZE / (1024 * 1024)}MB.`,
  TOO_MANY_FILES: `Maximum ${FILE_CONSTRAINTS.MAX_FILES_PER_UPLOAD} files allowed per upload.`,
  INVALID_ASPECT_RATIO: 'Invalid aspect ratio. Width and height must be positive numbers.',
  PROCESSING_FAILED: 'Image processing failed. Please try again.',
  FILE_NOT_FOUND: 'File not found.',
  JOB_NOT_FOUND: 'Job not found.',
  INVALID_UUID: 'Invalid ID format.',
  UPLOAD_FAILED: 'File upload failed. Please try again.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  UPLOAD_COMPLETE: 'Files uploaded successfully.',
  PROCESSING_COMPLETE: 'Image processing completed.',
  DOWNLOAD_READY: 'Files are ready for download.',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  UPLOAD: '/api/upload',
  PROCESS: '/api/process',
  STATUS: '/api/status',
  DOWNLOAD: '/api/download',
  BATCH_DOWNLOAD: '/api/download/batch',
} as const;

// Default values
export const DEFAULTS = {
  ASPECT_RATIO: ASPECT_RATIOS['4x6'],
  PROCESSING_TIMEOUT: 300000, // 5 minutes
  CLEANUP_INTERVAL: 3600000, // 1 hour
  MAX_CONCURRENT_JOBS: 5,
} as const;