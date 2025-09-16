// Shared types for the frontend - mirrors backend types for consistency

// User authentication types
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
  emailVerified: boolean;
  preferences?: {
    defaultAspectRatio?: string;
    enableEmailNotifications: boolean;
    autoEnableFaceDetection: boolean;
    autoEnableAiNaming: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

export interface UserRegistration {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserLogin {
  emailOrUsername: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
  };
  errors?: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
}

export interface UserStats {
  totalJobs: number;
  completedJobs: number;
  successRate: number;
}

export interface AspectRatio {
  width: number;
  height: number;
  name: string;
  orientation: 'portrait' | 'landscape' | 'square';
}

export interface GridLayout {
  rows: number;
  columns: number;
  name: string; // e.g., "1x2", "2x2", "1x3"
}

export interface SheetCompositionOptions {
  enabled: boolean;
  gridLayout: GridLayout;
  orientation: 'portrait' | 'landscape';
  generatePDF: boolean;
}

export interface ProcessingOptions {
  aspectRatio: AspectRatio;
  faceDetectionEnabled: boolean;
  sheetComposition: SheetCompositionOptions | null;
  aiNamingEnabled: boolean;
  generateInstagramContent: boolean;
  instagramOptimization?: InstagramProcessingOptions; // Enhanced Instagram processing
}

// Instagram-specific processing options for frontend
export interface InstagramProcessingOptions {
  enabled: boolean; // Enable Instagram optimizations
  enhanceColors?: boolean; // Apply mobile-optimized color enhancement
  sharpen?: boolean; // Apply smart sharpening for social media viewing
  generateCompressed?: boolean; // Generate compressed version for faster uploads
  targetResolution?: 'standard' | 'high' | 'story'; // Resolution optimization level
  compressionLevel?: 'high' | 'balanced' | 'compact'; // Compression quality
  customEnhancements?: { // Custom color adjustments
    saturation?: number;
    brightness?: number;
    contrast?: number;
  };
}

export interface FileMetadata {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadPath: string;
  uploadedAt: Date;
}

export interface Job {
  id: string;
  userId: string; // Associate job with user
  status: 'pending' | 'processing' | 'composing' | 'generating_pdf' | 'completed' | 'failed' | 'cancelled';
  files: FileMetadata[];
  options: ProcessingOptions;
  createdAt: Date;
  completedAt?: Date;
  progress: JobProgress;
  isPublic?: boolean; // Allow users to make jobs public for sharing
  title?: string; // Optional user-defined title for the job
  errorMessage?: string;
}

export interface JobProgress {
  currentStage: 'uploading' | 'processing' | 'composing' | 'generating_pdf' | 'completed';
  processedImages: number;
  totalImages: number;
  percentage: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Keypoint {
  x: number;
  y: number;
  confidence: number;
  name?: string;
}

export interface FaceDetection {
  boundingBox: BoundingBox;
  confidence: number;
  landmarks?: Point[];
}

export interface PersonDetection {
  boundingBox: BoundingBox;
  confidence: number;
  keypoints?: Keypoint[];
}

export interface DetectionResult {
  faces: FaceDetection[];
  people: PersonDetection[];
  confidence: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface InstagramContent {
  caption: string;
  hashtags: string[];
  generatedAt: string;
}

export interface ProcessedImage {
  id: string;
  originalFileId: string;
  processedPath: string;
  cropArea: CropArea;
  aspectRatio: AspectRatio;
  detections: DetectionResult;
  processingTime: number;
  instagramContent?: InstagramContent;
}

export interface Dimensions {
  width: number;
  height: number;
}

// Frontend-specific types
export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Enhanced error types for Python service integration
export interface PythonServiceError {
  error_code: string;
  message: string;
  details?: Record<string, any>;
}

export interface EnhancedApiError extends Error {
  errorCode?: string;
  correlationId?: string;
  details?: Record<string, any>;
  statusCode?: number;
  originalError?: any;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  jobId: string;
  filesCount: number;
  files: Array<{
    id: string;
    originalName: string;
    size: number;
    mimeType: string;
  }>;
  options: ProcessingOptions;
  progress: JobProgress;
}

export interface ProcessingStatus {
  jobId: string;
  status: Job['status'];
  progress: JobProgress;
  processedImages: ProcessedImage[];
  errors?: string[];
  estimatedTimeRemaining?: number;
  options?: ProcessingOptions; // Add processing options to determine which stages to show
}

// UI State types
export interface AppState {
  selectedFiles: File[];
  selectedAspectRatio: AspectRatio;
  uploadProgress: UploadProgress[];
  currentJob?: Job;
  processedImages: ProcessedImage[];
  isUploading: boolean;
  isProcessing: boolean;
}

// Common aspect ratios for the frontend
export const ASPECT_RATIOS: Record<string, AspectRatio> = {
  // Traditional photo ratios
  '4x6': { width: 4, height: 6, name: '4x6', orientation: 'portrait' },
  '5x7': { width: 5, height: 7, name: '5x7', orientation: 'portrait' },
  '8x10': { width: 8, height: 10, name: '8x10', orientation: 'portrait' },
  '16x9': { width: 16, height: 9, name: '16x9', orientation: 'landscape' },
  'Square': { width: 1, height: 1, name: 'Square', orientation: 'square' },
  '3x2': { width: 3, height: 2, name: '3x2', orientation: 'landscape' },
  
  // Instagram-optimized ratios for maximum engagement
  'Instagram-Post': { width: 1, height: 1, name: 'Instagram-Post', orientation: 'square' },
  'Instagram-Portrait': { width: 4, height: 5, name: 'Instagram-Portrait', orientation: 'portrait' },
  'Instagram-Story': { width: 9, height: 16, name: 'Instagram-Story', orientation: 'portrait' },
  'Instagram-Reel': { width: 9, height: 16, name: 'Instagram-Reel', orientation: 'portrait' },
  'Instagram-Landscape': { width: 1.91, height: 1, name: 'Instagram-Landscape', orientation: 'landscape' },
} as const;

// File constraints
export const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILES_PER_UPLOAD: 20,
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'] as const,
} as const;

// Utility type for component props
export type ComponentProps<T = {}> = T & {
  className?: string;
  children?: React.ReactNode;
};

export interface ComposedSheet {
  id: string;
  sheetPath: string;
  layout: GridLayout;
  orientation: 'portrait' | 'landscape';
  images: ProcessedImage[];
  emptySlots: number;
  createdAt: Date;
}

export interface ProcessingResults {
  jobId: string;
  processedImages: ProcessedImage[];
  composedSheets: ComposedSheet[];
  pdfPath?: string;
  zipPath?: string;
  downloadUrls: DownloadUrls;
}

export interface DownloadUrls {
  individualImages: { [imageId: string]: string };
  sheets: { [sheetId: string]: string };
  zip?: string;
  pdf?: string;
}

export type DownloadType = 'image' | 'sheet' | 'zip' | 'pdf';

// Enhanced processing status (removed duplicate - kept the one above with options field)

// Processing stage information
export interface ProcessingStageInfo {
  name: string;
  description: string;
  icon: string;
  estimatedDuration: number; // in seconds
}

// Enhanced job progress with stage-specific details
export interface EnhancedJobProgress extends JobProgress {
  stageDetails?: {
    [stageName: string]: {
      progress: number;
      startTime?: Date;
      estimatedCompletion?: Date;
    };
  };
}

// Common grid layouts for sheet composition - optimized for maximum space utilization
export const GRID_LAYOUTS: Record<string, GridLayout> = {
  '1x1': { rows: 1, columns: 1, name: '1x1' },
  '1x2': { rows: 1, columns: 2, name: '1x2' },
  '1x3': { rows: 1, columns: 3, name: '1x3' },
  '1x4': { rows: 1, columns: 4, name: '1x4' },
  '2x2': { rows: 2, columns: 2, name: '2x2' },
  '2x3': { rows: 2, columns: 3, name: '2x3' },
  '3x2': { rows: 3, columns: 2, name: '3x2' },
  '3x3': { rows: 3, columns: 3, name: '3x3' },
} as const;