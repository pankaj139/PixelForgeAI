import sharp, { Sharp } from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AspectRatio, CropArea, Dimensions, ProcessedImage, DetectionResult, ImageData } from '../types/index.js';
import { computerVisionService } from './computerVisionService.js';
import { croppingService } from './croppingService.js';
import { getPythonServiceClient } from './pythonServiceClient.js';
import { aiNamingService } from './aiNamingService.js';

export interface ImageProcessingOptions {
  quality?: number;
  preserveMetadata?: boolean;
  maxUpscaleFactor?: number;
  minOutputSize?: Dimensions;
  format?: 'jpeg' | 'png' | 'webp';
  faceDetectionEnabled?: boolean;
  outputDir?: string;
  aiNamingEnabled?: boolean;
  generateInstagramContent?: boolean;
}

export interface ProcessingMetrics {
  originalSize: Dimensions;
  finalSize: Dimensions;
  cropArea: CropArea;
  upscaleFactor: number;
  qualityScore: number;
}

/**
 * Service for high-quality image processing using Sharp.js
 */
export class ImageProcessingService {
  private pythonClient = getPythonServiceClient();
  private readonly defaultOptions: Required<ImageProcessingOptions> = {
    quality: 90,
    preserveMetadata: false,
    maxUpscaleFactor: 2.0,
    minOutputSize: { width: 800, height: 600 },
    format: 'jpeg',
    faceDetectionEnabled: false,
    outputDir: './processed',
    aiNamingEnabled: true,
    generateInstagramContent: false
  };

  /**
   * Process image to target aspect ratio with integrated computer vision and cropping
   * Uses Python service for processing, falls back to local processing if unavailable
   */
  async processImageToAspectRatio(
    inputPath: string,
    targetAspectRatio: AspectRatio,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImage> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    
    const isTestEnv = process.env['NODE_ENV'] === 'test';
    if (!isTestEnv) {
      try {
        console.log(`Attempting Python service processing for image: ${inputPath}`);
        const cropResult = await this.pythonClient.cropImage({
          image_path: inputPath,
          target_aspect_ratio: {
            width: targetAspectRatio.width,
            height: targetAspectRatio.height
          },
          crop_strategy: opts.faceDetectionEnabled ? 'center_faces' : 'center'
        });

        const processedId = uuidv4();
        
        // Conditional AI-powered descriptive naming
        let descriptiveName: string;
        let finalOutputPath: string;
        
        if (opts.aiNamingEnabled) {
          const originalBasename = path.basename(inputPath, path.extname(inputPath));
            descriptiveName = await aiNamingService.generateImageName(
            cropResult.processed_path, 
            { fallbackName: originalBasename }
          );
          
          // Ensure uniqueness by adding processed ID to prevent overwrites
          const uniqueFilename = `${descriptiveName}_${processedId.slice(0, 8)}_${targetAspectRatio.name}.${opts.format}`;
          finalOutputPath = path.join(opts.outputDir, uniqueFilename);
        } else {
          // Use original filename with processed ID
          const originalBasename = path.basename(inputPath, path.extname(inputPath));
          const uniqueFilename = `processed_${originalBasename}_${processedId.slice(0, 8)}_${targetAspectRatio.name}.${opts.format}`;
          finalOutputPath = path.join(opts.outputDir, uniqueFilename);
          descriptiveName = `processed_${originalBasename}`;
          
        }

        // Copy the temp file from Python service to final location
        await sharp(cropResult.processed_path).toFile(finalOutputPath);
        
        // Clean up the temp file from Python service
        try {
          if (fs.existsSync(cropResult.processed_path) && cropResult.processed_path.includes('temp_')) {
            fs.unlinkSync(cropResult.processed_path);
            console.log(`Cleaned up temp file: ${path.basename(cropResult.processed_path)}`);
          }
        } catch (error) {
          console.warn('Failed to clean up temp file:', error);
        }

        const processingTime = Date.now() - startTime;

        const cropArea: CropArea = {
          ...cropResult.crop_coordinates,
          confidence: 0.8
        };

        let detections: DetectionResult = {
          faces: [],
          people: [],
          confidence: 0
        };

        if (opts.faceDetectionEnabled) {
          try {
            detections = await computerVisionService.detectPeople(inputPath);
          } catch (error) {
            console.warn('Face detection failed:', error);
          }
        }

        // Conditional Instagram content generation
        let instagramContent = undefined;
        if (opts.generateInstagramContent) {
          try {
            const content = await aiNamingService.generateInstagramContent(
              finalOutputPath,
              { useCache: true }
            );
            if (content) {
              instagramContent = content;
            }
          } catch (error) {
            console.warn('❌ Instagram content generation failed:', error);
          }
        }

        console.log('Python service processing completed successfully');

        const result: ProcessedImage = {
          id: processedId,
          originalFileId: '', // Will be set by caller
          processedPath: finalOutputPath,
          cropArea,
          aspectRatio: targetAspectRatio,
          detections,
          processingTime
        };
        
        if (instagramContent) {
          result.instagramContent = instagramContent;
        }
        
        return result;
      } catch (error) {
        console.warn('Python service processing failed, falling back to local processing:', error);
      }
    } else {
      console.log('[imageProcessingService] Test env – skipping Python client');
    }

  // Fallback path: local processing
  return this.processImageLocally(inputPath, targetAspectRatio, opts);
  }

  /**
   * Local fallback processing when Python service is unavailable
   */
  private async processImageLocally(
    inputPath: string,
    targetAspectRatio: AspectRatio,
    opts: Required<ImageProcessingOptions>
  ): Promise<ProcessedImage> {
    const startTime = Date.now();
    
    // Get image metadata
    const metadata = await this.getImageMetadata(inputPath);
    const imageData: ImageData = {
      path: inputPath,
      dimensions: { width: metadata.width, height: metadata.height },
      format: metadata.format
    };

    // Detect people if enabled
    let detections: DetectionResult = {
      faces: [],
      people: [],
      confidence: 0
    };

    if (opts.faceDetectionEnabled) {
      try {
        detections = await computerVisionService.detectPeople(inputPath);
      } catch (error) {
        console.warn('Face detection failed, falling back to standard cropping:', error);
        // Continue with empty detections for fallback cropping
      }
    }

    // Calculate optimal crop area
    const cropSuggestion = await croppingService.calculateOptimalCrop(
      imageData,
      detections,
      targetAspectRatio,
      {
        preserveQuality: opts.preserveMetadata,
        maxUpscaleFactor: opts.maxUpscaleFactor,
        fallbackStrategy: 'smart'
      }
    );

    // Generate output path with conditional AI naming
    const processedId = uuidv4();
    const originalBasename = path.basename(inputPath, path.extname(inputPath));
    
    let descriptiveName: string;
    let outputPath: string;
    
    if (opts.aiNamingEnabled) {
      console.log(`✨ Generating AI name for: ${originalBasename}`);
      
      // Generate AI-powered descriptive name
      descriptiveName = await aiNamingService.generateImageName(
        inputPath, 
        { fallbackName: originalBasename }
      );
      
      // Ensure uniqueness by adding processed ID to prevent overwrites
      const uniqueFilename = `${descriptiveName}_${processedId.slice(0, 8)}_${targetAspectRatio.name}.${opts.format}`;
      outputPath = path.join(opts.outputDir, uniqueFilename);
      
      console.log(`✅ Generated AI filename: ${uniqueFilename}`);
    } else {
      // Use original filename with processed ID
      const uniqueFilename = `processed_${originalBasename}_${processedId.slice(0, 8)}_${targetAspectRatio.name}.${opts.format}`;
      outputPath = path.join(opts.outputDir, uniqueFilename);
      descriptiveName = `processed_${originalBasename}`;
      
      console.log(`📁 Using standard filename: ${uniqueFilename}`);
    }

    // Apply crop and convert aspect ratio
    await this.convertAspectRatio(
      inputPath,
      outputPath,
      targetAspectRatio,
      cropSuggestion.cropArea,
      opts
    );

    // Conditional Instagram content generation
    let instagramContent = undefined;
    if (opts.generateInstagramContent) {
      console.log(`📸 Generating Instagram content for: ${path.basename(outputPath)}`);
      try {
        const content = await aiNamingService.generateInstagramContent(
          outputPath,
          { useCache: true }
        );
        if (content) {
          instagramContent = content;
          console.log(`✅ Instagram content generated: ${content.hashtags.length} hashtags`);
        } else {
          console.warn('⚠️ Instagram content generation returned null');
        }
      } catch (error) {
        console.warn('❌ Instagram content generation failed:', error);
      }
    }

    const processingTime = Date.now() - startTime;

    const result: ProcessedImage = {
      id: processedId,
      originalFileId: '', // Will be set by caller
      processedPath: outputPath,
      cropArea: cropSuggestion.cropArea,
      aspectRatio: targetAspectRatio,
      detections,
      processingTime
    };
    
    if (instagramContent) {
      result.instagramContent = instagramContent;
    }
    
    return result;
  }

  /**
   * Convert image to target aspect ratio with intelligent cropping and upscaling
   */
  async convertAspectRatio(
    inputPath: string,
    outputPath: string,
    targetAspectRatio: AspectRatio,
    cropArea: CropArea,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessingMetrics> {
    const opts = { ...this.defaultOptions, ...options };
    
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const originalSize: Dimensions = {
      width: metadata.width,
      height: metadata.height
    };

    // Apply crop area
    const croppedImage = await this.applyCropArea(image, cropArea);
    
    // Calculate target dimensions based on aspect ratio
    const targetDimensions = this.calculateTargetDimensions(
      { width: cropArea.width, height: cropArea.height },
      targetAspectRatio,
      opts
    );

    // Apply intelligent upscaling if needed
    const processedImage = await this.applyIntelligentUpscaling(
      croppedImage,
      targetDimensions,
      opts
    );

    // Apply final processing and save
    await processedImage
      .jpeg({ quality: opts.quality, progressive: true })
      .toFile(outputPath);

    const upscaleFactor = Math.max(
      targetDimensions.width / Math.round(cropArea.width),
      targetDimensions.height / Math.round(cropArea.height)
    );

    return {
      originalSize,
      finalSize: targetDimensions,
      cropArea,
      upscaleFactor,
      qualityScore: this.calculateQualityScore(upscaleFactor, cropArea, originalSize)
    };
  }

  /**
   * Apply crop area to image
   */
  private async applyCropArea(image: Sharp, cropArea: CropArea): Promise<Sharp> {
    return image.extract({
      left: Math.round(cropArea.x),
      top: Math.round(cropArea.y),
      width: Math.round(cropArea.width),
      height: Math.round(cropArea.height)
    });
  }

  /**
   * Calculate optimal target dimensions based on aspect ratio and constraints
   */
  private calculateTargetDimensions(
    croppedSize: Dimensions,
    targetAspectRatio: AspectRatio,
    options: Required<ImageProcessingOptions>
  ): Dimensions {
    const targetRatio = targetAspectRatio.width / targetAspectRatio.height;
    const currentRatio = croppedSize.width / croppedSize.height;

    let targetWidth: number;
    let targetHeight: number;

    if (Math.abs(currentRatio - targetRatio) < 0.01) {
      // Already close to target ratio, maintain current size or upscale minimally
      targetWidth = Math.max(croppedSize.width, options.minOutputSize.width);
      targetHeight = Math.max(croppedSize.height, options.minOutputSize.height);
    } else {
      // Calculate dimensions to match target aspect ratio
      if (currentRatio > targetRatio) {
        // Image is wider than target ratio
        targetHeight = Math.max(croppedSize.height, options.minOutputSize.height);
        targetWidth = Math.round(targetHeight * targetRatio);
      } else {
        // Image is taller than target ratio
        targetWidth = Math.max(croppedSize.width, options.minOutputSize.width);
        targetHeight = Math.round(targetWidth / targetRatio);
      }
    }

    // Ensure we don't exceed maximum upscale factor
    const maxWidth = Math.floor(croppedSize.width * options.maxUpscaleFactor);
    const maxHeight = Math.floor(croppedSize.height * options.maxUpscaleFactor);

    return {
      width: Math.round(Math.min(targetWidth, maxWidth)),
      height: Math.round(Math.min(targetHeight, maxHeight))
    };
  }

  /**
   * Apply intelligent upscaling with quality preservation
   */
  private async applyIntelligentUpscaling(
    image: Sharp,
    targetDimensions: Dimensions,
    _options: Required<ImageProcessingOptions>
  ): Promise<Sharp> {
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read cropped image dimensions');
    }

    const currentWidth = metadata.width;
    const currentHeight = metadata.height;

    // Ensure target dimensions are integers
    const targetWidth = Math.round(targetDimensions.width);
    const targetHeight = Math.round(targetDimensions.height);

    // Check if upscaling is needed
    if (targetWidth <= currentWidth && targetHeight <= currentHeight) {
      // Downscaling or same size - use high-quality Lanczos resampling
      return image.resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill'
      });
    }

    // Upscaling needed - use different strategies based on upscale factor
    const upscaleFactor = Math.max(
      targetWidth / currentWidth,
      targetHeight / currentHeight
    );

    if (upscaleFactor <= 1.5) {
      // Moderate upscaling - use Lanczos with sharpening
      return image
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos3,
          fit: 'fill'
        })
        .sharpen({ sigma: 0.5, m1: 0.5, m2: 2.0 });
    } else {
      // Significant upscaling - use cubic interpolation with noise reduction
      return image
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.cubic,
          fit: 'fill'
        })
        .median(1) // Light noise reduction
        .sharpen({ sigma: 0.8, m1: 0.8, m2: 2.5 });
    }
  }

  /**
   * Calculate quality score based on processing parameters
   */
  private calculateQualityScore(
    upscaleFactor: number,
    cropArea: CropArea,
    originalSize: Dimensions
  ): number {
    // Base score starts at 100
    let score = 100;

    // Penalize upscaling
    if (upscaleFactor > 1) {
      const upscalePenalty = Math.min((upscaleFactor - 1) * 30, 50);
      score -= upscalePenalty;
    }

    // Penalize small crop areas (loss of resolution)
    const cropRatio = (cropArea.width * cropArea.height) / (originalSize.width * originalSize.height);
    if (cropRatio < 0.5) {
      const cropPenalty = (0.5 - cropRatio) * 40;
      score -= cropPenalty;
    }

    // Bonus for confidence in crop area
    score += cropArea.confidence * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get image metadata without processing
   */
  async getImageMetadata(imagePath: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    aspectRatio: number;
  }> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format || 'unknown',
      size: metadata.size || 0,
      aspectRatio: metadata.width / metadata.height
    };
  }

  /**
   * Create thumbnail for preview purposes
   */
  async createThumbnail(
    inputPath: string,
    outputPath: string,
    maxSize: number = 300
  ): Promise<Dimensions> {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const aspectRatio = metadata.width / metadata.height;
    let thumbnailWidth: number;
    let thumbnailHeight: number;

    if (aspectRatio > 1) {
      thumbnailWidth = maxSize;
      thumbnailHeight = Math.round(maxSize / aspectRatio);
    } else {
      thumbnailHeight = maxSize;
      thumbnailWidth = Math.round(maxSize * aspectRatio);
    }

    await image
      .resize(thumbnailWidth, thumbnailHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'inside'
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    return { width: thumbnailWidth, height: thumbnailHeight };
  }

  /**
   * Validate image format and quality
   */
  async validateImage(imagePath: string): Promise<{
    isValid: boolean;
    errors: string[];
    metadata?: any;
  }> {
    const errors: string[] = [];

    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      // Check if image has valid dimensions
      if (!metadata.width || !metadata.height) {
        errors.push('Image has invalid dimensions');
      }

      // Check minimum size requirements
      if (metadata.width && metadata.width < 100) {
        errors.push('Image width is too small (minimum 100px)');
      }
      if (metadata.height && metadata.height < 100) {
        errors.push('Image height is too small (minimum 100px)');
      }

      // Check supported formats
      const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'tiff'];
      if (metadata.format && !supportedFormats.includes(metadata.format.toLowerCase())) {
        errors.push(`Unsupported image format: ${metadata.format}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        metadata: errors.length === 0 ? metadata : undefined
      };

    } catch (error) {
      errors.push(`Failed to read image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors
      };
    }
  }
}

// Export singleton instance
export const imageProcessingService = new ImageProcessingService();