/**
 * InstagramProcessingService - Instagram-Optimized Image Processing Service
 * 
 * This service provides specialized image processing optimizations for Instagram uploads,
 * ensuring maximum engagement potential through proper formatting, quality, and visual enhancement.
 * 
 * Features:
 * - Instagram-specific aspect ratios (Posts, Stories, Reels, Portrait, Landscape)
 * - Automatic resolution optimization (minimum 1080px width for quality)
 * - Color enhancement optimized for mobile viewing (saturation, contrast, brightness)
 * - Smart sharpening for social media consumption
 * - Dual export formats: high quality + compressed versions
 * - File size optimization within Instagram's limits (8MB)
 * - Advanced JPEG compression using mozjpeg encoder
 * 
 * Usage:
 * ```typescript
 * const result = await instagramProcessingService.processForInstagram(
 *   inputPath, 
 *   outputDir, 
 *   'Instagram-Portrait', 
 *   { enhanceColors: true, generateCompressed: true }
 * );
 * ```
 * 
 * Returns: Instagram-optimized images with enhanced visual appeal and proper formatting
 * for maximum engagement and algorithmic visibility.
 */
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import {
  AspectRatio,
  ProcessedImage,
  CropArea,
  InstagramContent
} from '../types/index.js';
import { INSTAGRAM_CONSTANTS, ASPECT_RATIOS, PROCESSING_CONSTANTS } from '../constants/index.js';
import { croppingService } from './croppingService.js';
import { computerVisionService } from './computerVisionService.js';
import { logger } from '../utils/logger.js';

export interface InstagramProcessingOptions {
  enhanceColors?: boolean; // Apply mobile-optimized color enhancement
  sharpen?: boolean; // Apply smart sharpening for social media viewing
  generateCompressed?: boolean; // Generate compressed version for faster uploads
  targetResolution?: 'standard' | 'high' | 'story'; // Resolution optimization level
  compressionLevel?: 'high' | 'balanced' | 'compact'; // Compression quality
  preserveOriginalQuality?: boolean; // Maintain maximum quality
  customEnhancements?: { // Custom color adjustments
    saturation?: number;
    brightness?: number;
    contrast?: number;
  };
}

export interface InstagramProcessingResult {
  success: boolean;
  processedImages: {
    high: ProcessedImage;
    compressed?: ProcessedImage;
  };
  instagramContent?: InstagramContent;
  metrics: {
    originalSize: { width: number; height: number; fileSize: number };
    finalSize: { width: number; height: number; fileSize: number };
    compressionRatio: number;
    qualityScore: number;
  };
  processingTime: number;
  error?: string;
}

export class InstagramProcessingService {
  
  /**
   * Process image specifically for Instagram with all optimizations
   * 
   * This method applies Instagram-specific optimizations including:
   * - Aspect ratio conversion with intelligent cropping
   * - Resolution optimization for Instagram's algorithm
   * - Color enhancement for mobile viewing
   * - Smart compression within platform limits
   * 
   * @param inputPath - Path to input image
   * @param outputDir - Directory for processed images
   * @param aspectRatioName - Instagram aspect ratio (e.g., 'Instagram-Portrait')
   * @param options - Processing options and enhancements
   * @returns Complete processing result with metrics
   */
  async processForInstagram(
    inputPath: string,
    outputDir: string,
    aspectRatioName: string,
    options: InstagramProcessingOptions = {}
  ): Promise<InstagramProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Validate aspect ratio
      const aspectRatio = ASPECT_RATIOS[aspectRatioName];
      if (!aspectRatio) {
        throw new Error(`Invalid aspect ratio: ${aspectRatioName}. Available: ${Object.keys(ASPECT_RATIOS).join(', ')}`);
      }

      // Check if it's an Instagram-specific ratio for enhanced processing
      const isInstagramRatio = aspectRatioName.startsWith('Instagram-');
      
      // Get original image metadata
      const originalMetadata = await sharp(inputPath).metadata();
      if (!originalMetadata.width || !originalMetadata.height) {
        throw new Error('Unable to read image dimensions');
      }

      const originalFileStats = await fs.stat(inputPath);
      const originalSize = {
        width: originalMetadata.width,
        height: originalMetadata.height,
        fileSize: originalFileStats.size
      };

      logger.info(`Processing Instagram image: ${aspectRatioName} (${originalSize.width}x${originalSize.height})`);

      // Perform computer vision analysis for intelligent cropping
      const detections = await computerVisionService.detectPeople(inputPath);
      
      // Calculate Instagram-optimized crop with enhanced settings
      const cropSuggestion = await croppingService.calculateOptimalCrop(
        {
          path: inputPath,
          dimensions: { width: originalMetadata.width, height: originalMetadata.height },
          format: originalMetadata.format || 'jpeg'
        },
        detections,
        aspectRatio,
        {
          preserveQuality: true,
          fallbackStrategy: 'smart',
          minCropSize: isInstagramRatio ? INSTAGRAM_CONSTANTS.MIN_WIDTH : PROCESSING_CONSTANTS.MIN_IMAGE_DIMENSION,
          maxUpscaleFactor: 2.0, // Allow upscaling for Instagram quality requirements
          preventStretching: false, // Allow scaling for Instagram resolution requirements
          maintainAspectRatio: true
        }
      );

      // Process high-quality version
      const highQualityPath = path.join(outputDir, `${uuidv4()}_instagram_hq.jpg`);
      await this.processImageWithInstagramOptimizations(
        inputPath,
        highQualityPath,
        cropSuggestion.cropArea,
        aspectRatio,
        {
          ...options,
          quality: INSTAGRAM_CONSTANTS.QUALITY_HIGH,
          targetResolution: options.targetResolution || 'high',
          enhanceColors: options.enhanceColors !== false, // Default to true
          sharpen: options.sharpen !== false // Default to true
        }
      );

      // Get processed image metadata
      const processedMetadata = await sharp(highQualityPath).metadata();
      const processedFileStats = await fs.stat(highQualityPath);
      const finalSize = {
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
        fileSize: processedFileStats.size
      };

      const highQualityImage: ProcessedImage = {
        id: uuidv4(),
        originalFileId: uuidv4(),
        processedPath: highQualityPath,
        cropArea: cropSuggestion.cropArea,
        aspectRatio,
        detections,
        processingTime: Date.now() - startTime
      };

      // Process compressed version if requested
      let compressedImage: ProcessedImage | undefined;
      if (options.generateCompressed !== false) {
        const compressedPath = path.join(outputDir, `${uuidv4()}_instagram_compressed.jpg`);
        await this.processImageWithInstagramOptimizations(
          inputPath,
          compressedPath,
          cropSuggestion.cropArea,
          aspectRatio,
          {
            ...options,
            quality: INSTAGRAM_CONSTANTS.QUALITY_COMPRESSED,
            targetResolution: 'standard',
            enhanceColors: options.enhanceColors !== false,
            sharpen: options.sharpen !== false
          }
        );

        compressedImage = {
          id: uuidv4(),
          originalFileId: highQualityImage.originalFileId,
          processedPath: compressedPath,
          cropArea: cropSuggestion.cropArea,
          aspectRatio,
          detections,
          processingTime: Date.now() - startTime
        };
      }

      // Calculate metrics
      const compressionRatio = originalSize.fileSize / finalSize.fileSize;
      const qualityScore = this.calculateQualityScore(
        cropSuggestion.qualityScore,
        compressionRatio,
        isInstagramRatio
      );

      logger.info(`Instagram processing completed: ${finalSize.width}x${finalSize.height}, ${(finalSize.fileSize / 1024 / 1024).toFixed(2)}MB`);

      return {
        success: true,
        processedImages: {
          high: highQualityImage,
          compressed: compressedImage
        },
        metrics: {
          originalSize,
          finalSize,
          compressionRatio,
          qualityScore
        },
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Instagram processing failed', { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        processedImages: {
          high: {} as ProcessedImage
        },
        metrics: {
          originalSize: { width: 0, height: 0, fileSize: 0 },
          finalSize: { width: 0, height: 0, fileSize: 0 },
          compressionRatio: 1,
          qualityScore: 0
        },
        error: error instanceof Error ? error.message : 'Unknown Instagram processing error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Apply Instagram-specific optimizations to image processing pipeline
   * 
   * This method handles the complete processing pipeline with Instagram optimizations:
   * - Cropping and resizing to Instagram specifications
   * - Color enhancement for mobile screens
   * - Smart sharpening for social media consumption
   * - Advanced compression with quality preservation
   */
  private async processImageWithInstagramOptimizations(
    inputPath: string,
    outputPath: string,
    cropArea: CropArea,
    aspectRatio: AspectRatio,
    options: InstagramProcessingOptions & { quality: number; targetResolution: string }
  ): Promise<void> {
    let pipeline = sharp(inputPath);

    // Apply intelligent crop
    pipeline = pipeline.extract({
      left: Math.round(Math.max(0, cropArea.x)),
      top: Math.round(Math.max(0, cropArea.y)),
      width: Math.round(cropArea.width),
      height: Math.round(cropArea.height)
    });

    // Calculate Instagram-optimized dimensions
    const targetDimensions = this.calculateInstagramDimensions(
      aspectRatio,
      options.targetResolution
    );

    // Resize with high-quality resampling
    pipeline = pipeline.resize(
      targetDimensions.width,
      targetDimensions.height,
      {
        fit: 'fill',
        withoutEnlargement: false, // Allow upscaling for Instagram quality requirements
        kernel: sharp.kernel.lanczos3 // High-quality Lanczos resampling
      }
    );

    // Apply Instagram-specific color enhancements
    if (options.enhanceColors) {
      const enhancement = options.customEnhancements || INSTAGRAM_CONSTANTS.COLOR_ENHANCEMENT;
      pipeline = pipeline.modulate({
        brightness: enhancement.brightness,
        saturation: enhancement.saturation,
        lightness: enhancement.contrast
      });
    }

    // Apply smart sharpening optimized for mobile viewing
    if (options.sharpen) {
      const sharpening = INSTAGRAM_CONSTANTS.SHARPENING;
      pipeline = pipeline.sharpen(
        sharpening.sigma,
        sharpening.flat,
        sharpening.jagged
      );
    }

    // Color profile optimization (Sharp.js uses sRGB as default for web images)

    // Apply Instagram-optimized JPEG compression
    const compressionSettings = {
      quality: options.quality,
      progressive: INSTAGRAM_CONSTANTS.COMPRESSION.progressive,
      optimiseScans: INSTAGRAM_CONSTANTS.COMPRESSION.optimiseScans,
      mozjpeg: INSTAGRAM_CONSTANTS.COMPRESSION.mozjpeg
    };

    pipeline = pipeline.jpeg(compressionSettings);

    // Save processed image
    await pipeline.toFile(outputPath);

    // Validate file size meets Instagram requirements
    const fileStats = await fs.stat(outputPath);
    if (fileStats.size > PROCESSING_CONSTANTS.INSTAGRAM_MAX_FILE_SIZE) {
      logger.warn(`Instagram file size exceeds 8MB limit: ${(fileStats.size / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  /**
   * Calculate optimal dimensions for Instagram based on aspect ratio and target resolution
   * 
   * Instagram has specific requirements for different content types:
   * - Posts: 1080x1080 to 1350x1350 (square), 1080x1350 (portrait), 1350x1080 (landscape)
   * - Stories/Reels: 1080x1920
   * - Maximum file size: 8MB
   */
  private calculateInstagramDimensions(
    aspectRatio: AspectRatio,
    targetResolution: string
  ): { width: number; height: number } {
    const ratio = aspectRatio.width / aspectRatio.height;

    switch (targetResolution) {
      case 'story':
        // Always use story dimensions for story content
        return {
          width: INSTAGRAM_CONSTANTS.STORY_WIDTH,
          height: INSTAGRAM_CONSTANTS.STORY_HEIGHT
        };

      case 'high':
        // High-quality dimensions for maximum engagement
        if (aspectRatio.name.includes('Story') || aspectRatio.name.includes('Reel')) {
          return {
            width: INSTAGRAM_CONSTANTS.STORY_WIDTH,
            height: INSTAGRAM_CONSTANTS.STORY_HEIGHT
          };
        }
        
        // For posts, use maximum allowed dimensions
        if (ratio === 1) {
          // Square posts
          return {
            width: INSTAGRAM_CONSTANTS.MAX_WIDTH,
            height: INSTAGRAM_CONSTANTS.MAX_WIDTH
          };
        } else if (ratio < 1) {
          // Portrait posts
          return {
            width: INSTAGRAM_CONSTANTS.MIN_WIDTH,
            height: Math.round(INSTAGRAM_CONSTANTS.MIN_WIDTH / ratio)
          };
        } else {
          // Landscape posts
          return {
            width: INSTAGRAM_CONSTANTS.MAX_WIDTH,
            height: Math.round(INSTAGRAM_CONSTANTS.MAX_WIDTH / ratio)
          };
        }

      case 'standard':
      default:
        // Standard quality for faster loading
        if (aspectRatio.name.includes('Story') || aspectRatio.name.includes('Reel')) {
          return {
            width: INSTAGRAM_CONSTANTS.STORY_WIDTH,
            height: INSTAGRAM_CONSTANTS.STORY_HEIGHT
          };
        }
        
        // Use minimum recommended dimensions for posts
        return {
          width: INSTAGRAM_CONSTANTS.MIN_WIDTH,
          height: Math.round(INSTAGRAM_CONSTANTS.MIN_WIDTH / ratio)
        };
    }
  }

  /**
   * Calculate overall quality score for processed image
   * 
   * Considers crop quality, compression efficiency, and Instagram optimization
   */
  private calculateQualityScore(
    cropQuality: number,
    compressionRatio: number,
    isInstagramRatio: boolean
  ): number {
    let score = cropQuality * 0.4; // 40% from crop quality

    // Compression efficiency (sweet spot around 2-4x compression)
    const compressionScore = Math.min(1, Math.max(0, (compressionRatio - 1) / 3));
    score += compressionScore * 0.3; // 30% from compression efficiency

    // Instagram optimization bonus
    if (isInstagramRatio) {
      score += 0.2; // 20% bonus for Instagram-specific ratios
    }

    // Format optimization bonus
    score += 0.1; // 10% for proper format optimization

    return Math.min(1, score);
  }

  /**
   * Batch process multiple images for Instagram
   * 
   * Efficiently processes multiple images with the same Instagram settings
   */
  async batchProcessForInstagram(
    inputPaths: string[],
    outputDir: string,
    aspectRatioName: string,
    options: InstagramProcessingOptions = {}
  ): Promise<InstagramProcessingResult[]> {
    logger.info(`Starting Instagram batch processing: ${inputPaths.length} images`);
    
    const results: InstagramProcessingResult[] = [];
    
    for (let i = 0; i < inputPaths.length; i++) {
      const inputPath = inputPaths[i];
      logger.info(`Processing Instagram image ${i + 1}/${inputPaths.length}: ${path.basename(inputPath)}`);
      
      const result = await this.processForInstagram(
        inputPath,
        outputDir,
        aspectRatioName,
        options
      );
      
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    logger.info(`Instagram batch processing completed: ${successCount}/${inputPaths.length} successful`);
    
    return results;
  }

  /**
   * Get Instagram format recommendations based on image content
   * 
   * Analyzes image and suggests optimal Instagram format
   */
  async getInstagramFormatRecommendations(
    imagePath: string
  ): Promise<{
    recommended: string[];
    analysis: {
      hasPortraitSubjects: boolean;
      aspectRatio: number;
      resolution: { width: number; height: number };
      suggestions: string[];
    };
  }> {
    const metadata = await sharp(imagePath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const aspectRatio = metadata.width / metadata.height;
    const detections = await computerVisionService.detectPeople(imagePath);
    const hasPortraitSubjects = detections.faces.length > 0 || detections.people.length > 0;

    const recommendations: string[] = [];
    const suggestions: string[] = [];

    // Analyze current ratio and make recommendations
    if (Math.abs(aspectRatio - 1) < 0.1) {
      // Square-ish image
      recommendations.push('Instagram-Post');
      suggestions.push('Perfect for Instagram feed posts - maximum engagement');
    }
    
    if (aspectRatio < 1.2) {
      // Portrait or square
      recommendations.push('Instagram-Portrait', 'Instagram-Post');
      suggestions.push('Great for portrait mode posts');
    }
    
    if (aspectRatio > 1.5) {
      // Landscape
      recommendations.push('Instagram-Landscape');
      suggestions.push('Suitable for landscape posts');
    }

    // Always suggest story format for additional reach
    recommendations.push('Instagram-Story');
    suggestions.push('Create story version for additional exposure');

    if (hasPortraitSubjects) {
      suggestions.push('Portrait subjects detected - consider Instagram-Portrait for best composition');
    }

    return {
      recommended: [...new Set(recommendations)], // Remove duplicates
      analysis: {
        hasPortraitSubjects,
        aspectRatio,
        resolution: { width: metadata.width, height: metadata.height },
        suggestions
      }
    };
  }
}

// Export singleton instance
export const instagramProcessingService = new InstagramProcessingService();
