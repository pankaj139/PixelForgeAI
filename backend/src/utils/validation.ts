import { AspectRatio, ValidationResult, BoundingBox, CropArea } from '../types';
import { COMMON_ASPECT_RATIOS } from '../schemas';
import fs from 'fs';

// Supported image MIME types
export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
] as const;

// Maximum file size (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Maximum number of files per upload
export const MAX_FILES_PER_UPLOAD = 10;

// File signature validation (magic numbers)
const FILE_SIGNATURES = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // JPEG
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
  ],
  'image/tiff': [
    [0x49, 0x49, 0x2A, 0x00], // TIFF little-endian
    [0x4D, 0x4D, 0x00, 0x2A], // TIFF big-endian
  ],
} as const;

/**
 * Validates if a MIME type is supported for image processing
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType as any);
}

/**
 * Validates file signature (magic numbers) against MIME type
 */
export function validateFileSignature(filePath: string, expectedMimeType: string): ValidationResult {
  const errors: string[] = [];

  try {
    const buffer = fs.readFileSync(filePath);
    const signatures = FILE_SIGNATURES[expectedMimeType as keyof typeof FILE_SIGNATURES];
    
    if (!signatures) {
      errors.push(`Unsupported MIME type: ${expectedMimeType}`);
      return { isValid: false, errors };
    }

    const isValidSignature = signatures.some(signature => {
      if (buffer.length < signature.length) return false;
      return signature.every((byte, index) => buffer[index] === byte);
    });

    if (!isValidSignature) {
      errors.push(`File signature does not match expected MIME type: ${expectedMimeType}`);
    }

    // Additional WebP validation
    if (expectedMimeType === 'image/webp' && isValidSignature) {
      // Check for WebP signature at offset 8
      const webpSignature = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
      if (buffer.length >= 12) {
        const hasWebPSignature = webpSignature.every((byte, index) => buffer[8 + index] === byte);
        if (!hasWebPSignature) {
          errors.push('Invalid WebP file format');
        }
      } else {
        errors.push('File too small to be a valid WebP image');
      }
    }

  } catch (error) {
    errors.push(`Failed to read file for signature validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive file validation for uploaded images
 */
export function validateUploadedFile(file: Express.Multer.File): ValidationResult {
  const errors: string[] = [];

  // Check if file exists
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }

  // Validate MIME type
  if (!isSupportedMimeType(file.mimetype)) {
    errors.push(`Unsupported file type: ${file.mimetype}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`);
  }

  // Validate file size
  if (!isValidFileSize(file.size)) {
    errors.push(`File size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Validate filename
  if (!file.originalname || file.originalname.trim().length === 0) {
    errors.push('File must have a valid name');
  }

  // Validate file extension
  const extensionValidation = validateFileExtension(file.originalname, file.mimetype);
  if (!extensionValidation.isValid) {
    errors.push(...extensionValidation.errors);
  }

  // Validate file signature if file exists on disk
  if (file.path && fs.existsSync(file.path)) {
    const signatureValidation = validateFileSignature(file.path, file.mimetype);
    if (!signatureValidation.isValid) {
      errors.push(...signatureValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates multiple uploaded files
 */
export function validateUploadedFiles(files: Express.Multer.File[]): ValidationResult {
  const errors: string[] = [];

  if (!files || !Array.isArray(files) || files.length === 0) {
    errors.push('No files provided');
    return { isValid: false, errors };
  }

  if (!isValidFileCount(files.length)) {
    errors.push(`Number of files (${files.length}) exceeds maximum allowed (${MAX_FILES_PER_UPLOAD})`);
  }

  // Validate each file
  files.forEach((file, index) => {
    const fileValidation = validateUploadedFile(file);
    if (!fileValidation.isValid) {
      errors.push(`File ${index + 1} (${file.originalname}): ${fileValidation.errors.join(', ')}`);
    }
  });

  // Check for duplicate filenames
  const filenames = files.map(f => f.originalname.toLowerCase());
  const duplicates = filenames.filter((name, index) => filenames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate filenames detected: ${[...new Set(duplicates)].join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates file size
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Validates if the number of files is within limits
 */
export function isValidFileCount(count: number): boolean {
  return count > 0 && count <= MAX_FILES_PER_UPLOAD;
}

/**
 * Validates aspect ratio values
 */
export function validateAspectRatioValues(width: number, height: number): ValidationResult {
  const errors: string[] = [];

  if (!Number.isFinite(width) || width <= 0) {
    errors.push('Width must be a positive number');
  }

  if (!Number.isFinite(height) || height <= 0) {
    errors.push('Height must be a positive number');
  }

  if (width > 100 || height > 100) {
    errors.push('Aspect ratio dimensions should not exceed 100');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates aspect ratio name
 */
export function validateAspectRatioName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || typeof name !== 'string') {
    errors.push('Name is required and must be a string');
  } else if (name.trim().length === 0) {
    errors.push('Name cannot be empty');
  } else if (name.length > 50) {
    errors.push('Name cannot exceed 50 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if an aspect ratio matches one of the common presets
 */
export function isCommonAspectRatio(aspectRatio: AspectRatio): boolean {
  return COMMON_ASPECT_RATIOS.some(
    preset => preset.width === aspectRatio.width && 
              preset.height === aspectRatio.height
  );
}

/**
 * Gets the aspect ratio as a decimal value
 */
export function getAspectRatioValue(aspectRatio: AspectRatio): number {
  return aspectRatio.width / aspectRatio.height;
}

/**
 * Determines orientation from aspect ratio dimensions
 */
export function determineOrientation(width: number, height: number): 'portrait' | 'landscape' | 'square' {
  if (width === height) {
    return 'square';
  } else if (width > height) {
    return 'landscape';
  } else {
    return 'portrait';
  }
}

/**
 * Ensures an AspectRatio object has the orientation property
 * Adds it based on width/height if missing
 */
export function ensureAspectRatioOrientation(aspectRatio: Partial<AspectRatio>): AspectRatio {
  if (!aspectRatio.width || !aspectRatio.height || !aspectRatio.name) {
    throw new Error('Invalid aspect ratio: missing required properties');
  }

  const orientation = aspectRatio.orientation || determineOrientation(aspectRatio.width, aspectRatio.height);
  
  return {
    width: aspectRatio.width,
    height: aspectRatio.height,
    name: aspectRatio.name,
    orientation
  };
}

/**
 * Validates bounding box coordinates
 */
export function validateBoundingBox(bbox: BoundingBox, imageWidth?: number, imageHeight?: number): ValidationResult {
  const errors: string[] = [];

  if (!Number.isFinite(bbox.x) || bbox.x < 0) {
    errors.push('X coordinate must be a non-negative number');
  }

  if (!Number.isFinite(bbox.y) || bbox.y < 0) {
    errors.push('Y coordinate must be a non-negative number');
  }

  if (!Number.isFinite(bbox.width) || bbox.width <= 0) {
    errors.push('Width must be a positive number');
  }

  if (!Number.isFinite(bbox.height) || bbox.height <= 0) {
    errors.push('Height must be a positive number');
  }

  // Validate against image dimensions if provided
  if (imageWidth !== undefined && imageHeight !== undefined) {
    if (bbox.x + bbox.width > imageWidth) {
      errors.push('Bounding box extends beyond image width');
    }

    if (bbox.y + bbox.height > imageHeight) {
      errors.push('Bounding box extends beyond image height');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates crop area
 */
export function validateCropArea(cropArea: CropArea, imageWidth?: number, imageHeight?: number): ValidationResult {
  const bboxValidation = validateBoundingBox(cropArea, imageWidth, imageHeight);
  const errors = [...bboxValidation.errors];

  if (!Number.isFinite(cropArea.confidence) || cropArea.confidence < 0 || cropArea.confidence > 1) {
    errors.push('Confidence must be a number between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates detection confidence score
 */
export function isValidConfidence(confidence: number): boolean {
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
}

/**
 * Validates UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates file extension against MIME type
 */
export function validateFileExtension(filename: string, mimeType: string): ValidationResult {
  const errors: string[] = [];
  const extension = filename.toLowerCase().split('.').pop();

  const mimeToExtension: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/tiff': ['tiff', 'tif'],
  };

  const expectedExtensions = mimeToExtension[mimeType];
  if (!expectedExtensions || !extension || !expectedExtensions.includes(extension)) {
    errors.push(`File extension '${extension}' does not match MIME type '${mimeType}'`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Split filename into name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  let name = filename;
  let extension = '';
  
  if (lastDotIndex > 0) {
    name = filename.substring(0, lastDotIndex);
    extension = filename.substring(lastDotIndex);
  }
  
  // Sanitize the name part
  const sanitizedName = name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  
  // Combine and limit length
  const result = (sanitizedName + extension).substring(0, 255);
  return result;
}

/**
 * Validates job progress value
 */
export function isValidProgress(progress: number): boolean {
  return Number.isFinite(progress) && progress >= 0 && progress <= 100;
}