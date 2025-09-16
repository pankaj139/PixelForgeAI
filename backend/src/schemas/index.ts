import { z } from 'zod';

// Basic validation schemas
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const DimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const BoundingBoxSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const AspectRatioSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  name: z.string().min(1),
});

export const FileMetadataSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string().min(1),
  size: z.number().positive(),
  mimeType: z.string().regex(/^image\/(jpeg|png|webp|tiff)$/),
  uploadPath: z.string().min(1),
  uploadedAt: z.date(),
});

export const GridLayoutSchema = z.object({
  rows: z.number().positive(),
  columns: z.number().positive(),
  name: z.string().min(1),
});

export const SheetCompositionOptionsSchema = z.object({
  enabled: z.boolean(),
  gridLayout: GridLayoutSchema,
  orientation: z.enum(['portrait', 'landscape']),
  generatePDF: z.boolean(),
});

export const ProcessingOptionsSchema = z.object({
  aspectRatio: AspectRatioSchema,
  faceDetectionEnabled: z.boolean(),
  sheetComposition: SheetCompositionOptionsSchema.nullable(),
});

export const JobProgressSchema = z.object({
  currentStage: z.enum(['uploading', 'processing', 'composing', 'generating_pdf', 'completed']),
  processedImages: z.number().min(0),
  totalImages: z.number().min(0),
  percentage: z.number().min(0).max(100),
  stageProgress: z.object({
    processing: z.number().min(0).max(100).optional(),
    composing: z.number().min(0).max(100).optional(),
    generatingPdf: z.number().min(0).max(100).optional(),
  }).optional(),
});

export const JobStatusSchema = z.enum(['pending', 'processing', 'composing', 'generating_pdf', 'completed', 'failed']);

export const JobSchema = z.object({
  id: z.string().uuid(),
  status: JobStatusSchema,
  files: z.array(FileMetadataSchema),
  options: ProcessingOptionsSchema,
  createdAt: z.date(),
  completedAt: z.date().optional(),
  progress: JobProgressSchema,
  errorMessage: z.string().optional(),
});

export const KeypointSchema = z.object({
  x: z.number(),
  y: z.number(),
  confidence: z.number().min(0).max(1),
  name: z.string().optional(),
});

export const FaceDetectionSchema = z.object({
  boundingBox: BoundingBoxSchema,
  confidence: z.number().min(0).max(1),
  landmarks: z.array(PointSchema).optional(),
});

export const PersonDetectionSchema = z.object({
  boundingBox: BoundingBoxSchema,
  confidence: z.number().min(0).max(1),
  keypoints: z.array(KeypointSchema).optional(),
});

export const DetectionResultSchema = z.object({
  faces: z.array(FaceDetectionSchema),
  people: z.array(PersonDetectionSchema),
  confidence: z.number().min(0).max(1),
});

export const CropAreaSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  confidence: z.number().min(0).max(1),
});

export const ProcessedImageSchema = z.object({
  id: z.string().uuid(),
  originalFileId: z.string().uuid(),
  processedPath: z.string().min(1),
  cropArea: CropAreaSchema,
  aspectRatio: AspectRatioSchema,
  detections: DetectionResultSchema,
  processingTime: z.number().positive(),
});

export const ImageDataSchema = z.object({
  path: z.string().min(1),
  dimensions: DimensionsSchema,
  format: z.string().min(1),
});

// Request/Response schemas
export const UploadResultSchema = z.object({
  success: z.boolean(),
  files: z.array(FileMetadataSchema),
  jobId: z.string().uuid(),
  errors: z.array(z.string()).optional(),
});

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
});

export const ProcessingResultSchema = z.object({
  success: z.boolean(),
  processedImage: ProcessedImageSchema.optional(),
  error: z.string().optional(),
});

// Input validation schemas for API endpoints
export const CreateJobRequestSchema = z.object({
  options: ProcessingOptionsSchema,
});

export const FileUploadSchema = z.object({
  originalname: z.string().min(1),
  mimetype: z.string().regex(/^image\/(jpeg|png|webp|tiff)$/),
  size: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  buffer: z.instanceof(Buffer),
});

// Common aspect ratio presets
export const COMMON_ASPECT_RATIOS = [
  { width: 4, height: 6, name: '4x6' },
  { width: 5, height: 7, name: '5x7' },
  { width: 8, height: 10, name: '8x10' },
  { width: 16, height: 9, name: '16x9' },
  { width: 1, height: 1, name: 'Square' },
  { width: 3, height: 2, name: '3x2' },
] as const;

export const CommonAspectRatioSchema = z.enum(['4x6', '5x7', '8x10', '16x9', 'Square', '3x2']);