// Core data models and type definitions for the Image Aspect Ratio Converter

export interface AspectRatio {
  width: number;
  height: number;
  name: string; // e.g., "4x6", "5x7", "Square"
  orientation: 'portrait' | 'landscape' | 'square';
}

export interface FileMetadata {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadPath: string;
  uploadedAt: Date;
}

export interface JobProgress {
  currentStage: 'uploading' | 'processing' | 'composing' | 'generating_pdf' | 'completed';
  processedImages: number;
  totalImages: number;
  percentage: number;
  stageProgress?: {
    processing?: number;
    composing?: number;
    generatingPdf?: number;
  };
}

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'composing' | 'generating_pdf' | 'completed' | 'failed';
  files: FileMetadata[];
  options: ProcessingOptions;
  createdAt: Date;
  completedAt?: Date | undefined;
  progress: JobProgress;
  errorMessage?: string;
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
  name?: string | undefined;
}

export interface FaceDetection {
  boundingBox: BoundingBox;
  confidence: number;
  landmarks?: Point[] | undefined;
}

export interface PersonDetection {
  boundingBox: BoundingBox;
  confidence: number;
  keypoints?: Keypoint[] | undefined;
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

export interface ImageData {
  path: string;
  dimensions: Dimensions;
  format: string;
}

// Additional utility types
export type JobStatus = Job['status'];
export type Detection = FaceDetection | PersonDetection;

// Upload and processing result types
export interface UploadResult {
  success: boolean;
  files: FileMetadata[];
  jobId: string;
  errors?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ProcessingResult {
  success: boolean;
  processedImage?: ProcessedImage;
  error?: string;
}

// Sheet composition types
export interface GridLayout {
  rows: number;
  columns: number;
  name: string; // e.g., "1x2", "2x2", "1x3"
}

export interface ComposedSheet {
  id: string;
  sheetPath: string;
  layout: GridLayout;
  orientation: 'portrait' | 'landscape';
  images: ProcessedImage[];
  emptySlots: number;
  createdAt: Date;
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