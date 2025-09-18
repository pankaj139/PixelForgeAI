// Type guard functions using Zod schemas
import {
  AspectRatio,
  FileMetadata,
  Job,
  DetectionResult,
  BoundingBox,
  CropArea,
  ProcessedImage,
  FaceDetection,
  PersonDetection,
  JobStatus,
  ValidationResult,
} from '../types';
import {
  AspectRatioSchema,
  FileMetadataSchema,
  JobSchema,
  DetectionResultSchema,
  BoundingBoxSchema,
  CropAreaSchema,
  ProcessedImageSchema,
  FaceDetectionSchema,
  PersonDetectionSchema,
  JobStatusSchema,
  FileUploadSchema,
} from '../schemas';

// Type guard functions
export function isAspectRatio(value: unknown): value is AspectRatio {
  return AspectRatioSchema.safeParse(value).success;
}

export function isFileMetadata(value: unknown): value is FileMetadata {
  return FileMetadataSchema.safeParse(value).success;
}

export function isJob(value: unknown): value is Job {
  return JobSchema.safeParse(value).success;
}

export function isDetectionResult(value: unknown): value is DetectionResult {
  return DetectionResultSchema.safeParse(value).success;
}

export function isBoundingBox(value: unknown): value is BoundingBox {
  return BoundingBoxSchema.safeParse(value).success;
}

export function isCropArea(value: unknown): value is CropArea {
  return CropAreaSchema.safeParse(value).success;
}

export function isProcessedImage(value: unknown): value is ProcessedImage {
  return ProcessedImageSchema.safeParse(value).success;
}

export function isFaceDetection(value: unknown): value is FaceDetection {
  return FaceDetectionSchema.safeParse(value).success;
}

export function isPersonDetection(value: unknown): value is PersonDetection {
  return PersonDetectionSchema.safeParse(value).success;
}

export function isJobStatus(value: unknown): value is JobStatus {
  return JobStatusSchema.safeParse(value).success;
}

// Validation functions with detailed error messages
export function validateAspectRatio(value: unknown): ValidationResult {
  const result = AspectRatioSchema.safeParse(value);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
}

export function validateFileMetadata(value: unknown): ValidationResult {
  const result = FileMetadataSchema.safeParse(value);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
}

export function validateJob(value: unknown): ValidationResult {
  const result = JobSchema.safeParse(value);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
}

export function validateDetectionResult(value: unknown): ValidationResult {
  const result = DetectionResultSchema.safeParse(value);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
}

export function validateProcessedImage(value: unknown): ValidationResult {
  const result = ProcessedImageSchema.safeParse(value);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
}

// File upload validation (basic schema validation)
export function validateFileSchema(file: Express.Multer.File): ValidationResult {
  const result = FileUploadSchema.safeParse(file);
  return {
    isValid: result.success,
    errors: result.success ? [] : result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
}

// Utility function to validate multiple files (basic schema validation)
export function validateFileSchemas(files: Express.Multer.File[]): ValidationResult {
  const errors: string[] = [];
  
  if (!Array.isArray(files) || files.length === 0) {
    return {
      isValid: false,
      errors: ['No files provided'],
    };
  }

  files.forEach((file, index) => {
    const validation = validateFileSchema(file);
    if (!validation.isValid) {
      errors.push(`File ${index + 1} (${file.originalname}): ${validation.errors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Utility function to check if aspect ratio is valid for processing
export function isValidAspectRatioForProcessing(aspectRatio: AspectRatio): boolean {
  return (
    aspectRatio.width > 0 &&
    aspectRatio.height > 0 &&
    aspectRatio.width <= 100 &&
    aspectRatio.height <= 100 &&
    aspectRatio.name.length > 0
  );
}

// Utility function to check if bounding box is within image dimensions
export function isBoundingBoxValid(bbox: BoundingBox, imageWidth: number, imageHeight: number): boolean {
  return (
    bbox.x >= 0 &&
    bbox.y >= 0 &&
    bbox.x + bbox.width <= imageWidth &&
    bbox.y + bbox.height <= imageHeight &&
    bbox.width > 0 &&
    bbox.height > 0
  );
}

// Utility function to check if crop area is valid
export function isCropAreaValid(cropArea: CropArea, imageWidth: number, imageHeight: number): boolean {
  return (
    isBoundingBoxValid(cropArea, imageWidth, imageHeight) &&
    cropArea.confidence >= 0 &&
    cropArea.confidence <= 1
  );
}

// Safe parsing functions that return the parsed value or null
export function safeParseAspectRatio(value: unknown): AspectRatio | null {
  const result = AspectRatioSchema.safeParse(value);
  if (!result.success) return null;
  // Ensure orientation present (schema should enforce, but guard against legacy objects)
  if (!('orientation' in result.data)) {
    return null;
  }
  return result.data as AspectRatio;
}

export function safeParseJob(value: unknown): Job | null {
  const result = JobSchema.safeParse(value);
  if (!result.success) return null;
  // Patch legacy options missing new required flags
  if (result.data && (result.data as any).options) {
    const opts: any = (result.data as any).options;
    if (typeof opts.aiNamingEnabled === 'undefined') opts.aiNamingEnabled = true;
    if (typeof opts.generateInstagramContent === 'undefined') opts.generateInstagramContent = true;
  }
  return result.data as Job;
}

export function safeParseDetectionResult(value: unknown): DetectionResult | null {
  const result = DetectionResultSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function safeParseProcessedImage(value: unknown): ProcessedImage | null {
  const result = ProcessedImageSchema.safeParse(value);
  if (!result.success) return null;
  // Ensure aspect ratio has orientation
  if (!(result.data.aspectRatio as any).orientation) return null;
  return result.data as ProcessedImage;
}