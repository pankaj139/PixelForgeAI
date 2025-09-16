import { computerVisionService } from '../services/computerVisionService.js';
import { croppingService } from '../services/croppingService.js';
import { imageProcessingService } from '../services/imageProcessingService.js';
import {
  AspectRatio,
  ImageData,
  CropArea,
  ProcessedImage,
  DetectionResult
} from '../types/index.js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessingOptions {
  preserveQuality?: boolean;
  fallbackStrategy?: 'center' | 'smart' | 'rule-of-thirds';
  minCropSize?: number;
  maxUpscaleFactor?: number;
}

export interface ProcessingResult {
  success: boolean;
  processedImage?: ProcessedImage;
  error?: string;
  processingTime: number;
}

/**
 * Process an image with intelligent cropping based on people detection
 */
export async function processImageWithIntelligentCropping(
  inputPath: string,
  outputPath: string,
  targetAspectRatio: AspectRatio,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const startTime = Date.now();
  
  try {
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const imageData: ImageData = {
      path: inputPath,
      dimensions: { width: metadata.width, height: metadata.height },
      format: metadata.format || 'jpeg'
    };

    // Detect people in the image
    const detections: DetectionResult = await computerVisionService.detectPeople(inputPath);

    // Calculate optimal crop area
    const cropSuggestion = await croppingService.calculateOptimalCrop(
      imageData,
      detections,
      targetAspectRatio,
      {
        preserveQuality: options.preserveQuality ?? true,
        fallbackStrategy: options.fallbackStrategy ?? 'smart',
        minCropSize: options.minCropSize ?? 200,
        maxUpscaleFactor: options.maxUpscaleFactor ?? 2.0
      }
    );

    // Apply the crop and aspect ratio conversion using the image processing service
    const processingMetrics = await imageProcessingService.convertAspectRatio(
      inputPath,
      outputPath,
      targetAspectRatio,
      cropSuggestion.cropArea,
      {
        quality: options.preserveQuality ? 95 : 85,
        maxUpscaleFactor: options.maxUpscaleFactor ?? 2.0,
        minOutputSize: { width: options.minCropSize ?? 200, height: options.minCropSize ?? 200 }
      }
    );

    const processingTime = Date.now() - startTime;

    // Create processed image result with enhanced metrics
    const processedImage: ProcessedImage = {
      id: uuidv4(),
      originalFileId: uuidv4(), // This would come from the file metadata in a real scenario
      processedPath: outputPath,
      cropArea: processingMetrics.cropArea,
      aspectRatio: targetAspectRatio,
      detections,
      processingTime
    };

    return {
      success: true,
      processedImage,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error',
      processingTime
    };
  }
}

/**
 * Batch process multiple images with intelligent cropping
 */
export async function batchProcessImages(
  inputPaths: string[],
  outputDir: string,
  targetAspectRatio: AspectRatio,
  options: ProcessingOptions = {}
): Promise<ProcessingResult[]> {
  const results: ProcessingResult[] = [];
  
  for (let i = 0; i < inputPaths.length; i++) {
    const inputPath = inputPaths[i];
    const filename = inputPath.split('/').pop() || `image_${i}`;
    const nameWithoutExt = filename.split('.')[0];
    const outputPath = `${outputDir}/${nameWithoutExt}_${targetAspectRatio.name}.jpg`;
    
    const result = await processImageWithIntelligentCropping(
      inputPath,
      outputPath,
      targetAspectRatio,
      options
    );
    
    results.push(result);
  }
  
  return results;
}

/**
 * Get crop preview without actually processing the image
 */
export async function getCropPreview(
  imagePath: string,
  targetAspectRatio: AspectRatio,
  options: ProcessingOptions = {}
): Promise<{
  cropArea: CropArea;
  strategy: string;
  qualityScore: number;
  detections: DetectionResult;
}> {
  // Get image metadata
  const metadata = await sharp(imagePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  const imageData: ImageData = {
    path: imagePath,
    dimensions: { width: metadata.width, height: metadata.height },
    format: metadata.format || 'jpeg'
  };

  // Detect people in the image
  const detections = await computerVisionService.detectPeople(imagePath);

  // Calculate optimal crop area
  const cropSuggestion = await croppingService.calculateOptimalCrop(
    imageData,
    detections,
    targetAspectRatio,
    {
      preserveQuality: options.preserveQuality ?? true,
      fallbackStrategy: options.fallbackStrategy ?? 'smart',
      minCropSize: options.minCropSize ?? 200,
      maxUpscaleFactor: options.maxUpscaleFactor ?? 2.0
    }
  );

  return {
    cropArea: cropSuggestion.cropArea,
    strategy: cropSuggestion.strategy,
    qualityScore: cropSuggestion.qualityScore,
    detections
  };
}
/*
*
 * Validate image file before processing
 */
export async function validateImageFile(imagePath: string): Promise<{
  isValid: boolean;
  errors: string[];
  metadata?: any;
}> {
  return await imageProcessingService.validateImage(imagePath);
}

/**
 * Get detailed image metadata
 */
export async function getImageInfo(imagePath: string): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  aspectRatio: number;
}> {
  return await imageProcessingService.getImageMetadata(imagePath);
}

/**
 * Create thumbnail for image preview
 */
export async function createImageThumbnail(
  inputPath: string,
  outputPath: string,
  maxSize: number = 300
): Promise<{ width: number; height: number }> {
  return await imageProcessingService.createThumbnail(inputPath, outputPath, maxSize);
}

/**
 * Process image with advanced options and quality metrics
 */
export async function processImageAdvanced(
  inputPath: string,
  outputPath: string,
  targetAspectRatio: AspectRatio,
  cropArea: CropArea,
  options: {
    quality?: number;
    preserveMetadata?: boolean;
    maxUpscaleFactor?: number;
    minOutputSize?: { width: number; height: number };
    format?: 'jpeg' | 'png' | 'webp';
  } = {}
): Promise<{
  success: boolean;
  metrics?: {
    originalSize: { width: number; height: number };
    finalSize: { width: number; height: number };
    cropArea: CropArea;
    upscaleFactor: number;
    qualityScore: number;
  };
  error?: string;
  processingTime: number;
}> {
  const startTime = Date.now();

  try {
    const metrics = await imageProcessingService.convertAspectRatio(
      inputPath,
      outputPath,
      targetAspectRatio,
      cropArea,
      options
    );

    return {
      success: true,
      metrics,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown processing error',
      processingTime: Date.now() - startTime
    };
  }
}