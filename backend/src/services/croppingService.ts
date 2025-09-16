/**
 * CroppingService - Intelligent Image Cropping Service
 * 
 * This service provides intelligent cropping capabilities that automatically determine
 * the optimal crop area for images to achieve the desired aspect ratio while preserving
 * the most important visual content.
 * 
 * Key Features:
 * - Smart detection of people and faces to guide cropping decisions
 * - Multiple fallback strategies (center, rule-of-thirds, smart) when no subjects detected
 * - Quality-preserving crop operations with NO stretching/upscaling by default
 * - Integration with Python computer vision service for enhanced detection
 * - Intelligent padding when exact aspect ratios can't be achieved without stretching
 * 
 * Usage:
 * ```typescript
 * const suggestion = await croppingService.calculateOptimalCrop(
 *   imageData, detections, { width: 4, height: 6, name: '4x6' }
 * );
 * 
 * await croppingService.applyCrop(
 *   inputPath, suggestion.cropArea, targetAspectRatio, outputPath
 * );
 * ```
 * 
 * Returns: Optimally cropped images that maximize visual content retention
 * while achieving the requested aspect ratio WITHOUT any image stretching.
 */
import sharp from 'sharp';
import {
  DetectionResult,
  CropArea,
  AspectRatio,
  Dimensions,
  BoundingBox,
  Point,
  Detection,
  ImageData
} from '../types/index.js';
import { getPythonServiceClient } from './pythonServiceClient.js';

export interface CroppingOptions {
  preserveQuality: boolean;
  minCropSize: number;
  maxUpscaleFactor: number;
  fallbackStrategy: 'center' | 'smart' | 'rule-of-thirds';
  preventStretching: boolean; // Never allow image stretching/upscaling
  paddingColor: { r: number; g: number; b: number; alpha: number }; // Background color for padding
  maintainAspectRatio: boolean; // Prioritize exact aspect ratio vs content preservation
}

export interface CropSuggestion {
  cropArea: CropArea;
  strategy: 'people-centered' | 'fallback-center' | 'fallback-smart' | 'rule-of-thirds';
  qualityScore: number;
}

export class CroppingService {
  private pythonClient = getPythonServiceClient();
  private defaultOptions: CroppingOptions = {
    preserveQuality: true,
    minCropSize: 200, // Minimum crop dimension in pixels
    maxUpscaleFactor: 1.0, // No upscaling allowed (changed from 2.0)
    fallbackStrategy: 'smart',
    preventStretching: true, // Never allow stretching
    paddingColor: { r: 255, g: 255, b: 255, alpha: 1 }, // White background
    maintainAspectRatio: true // Prioritize exact aspect ratio
  };

  /**
   * Calculate optimal crop area based on image content and target aspect ratio
   * 
   * This function analyzes the image content to determine the best cropping strategy:
   * - Uses people/face detection when available to preserve subjects in frame
   * - Falls back to intelligent positioning strategies when no subjects detected
   * - Always maintains the exact target aspect ratio
   * 
   * @param imageData - Image metadata including dimensions
   * @param detections - Computer vision detection results for people/faces
   * @param targetAspectRatio - Desired output aspect ratio
   * @param options - Cropping configuration options
   * @returns CropSuggestion with optimal crop area and quality score
   */
  async calculateOptimalCrop(
    imageData: ImageData,
    detections: DetectionResult,
    targetAspectRatio: AspectRatio,
    options: Partial<CroppingOptions> = {}
  ): Promise<CropSuggestion> {
    const opts = { ...this.defaultOptions, ...options };
    const { dimensions } = imageData;
    
    // If people are detected, use people-centered cropping
    if (this.hasPeopleDetections(detections)) {
      return this.calculatePeopleCenteredCrop(dimensions, detections, targetAspectRatio, opts);
    }
    
    // Fallback to intelligent cropping without people
    return this.calculateFallbackCrop(dimensions, targetAspectRatio, opts);
  }

  /**
   * Calculate crop area centered on detected people
   */
  private calculatePeopleCenteredCrop(
    dimensions: Dimensions,
    detections: DetectionResult,
    targetAspectRatio: AspectRatio,
    options: CroppingOptions
  ): CropSuggestion {
    const allDetections = [...detections.faces, ...detections.people];
    
    // Calculate the bounding box that encompasses all people
    const peopleBounds = this.calculatePeopleBounds(allDetections);
    
    // Calculate center of mass weighted by confidence
    const centerOfMass = this.calculateWeightedCenterOfMass(allDetections);
    
    // Calculate target crop dimensions
    const targetRatio = targetAspectRatio.width / targetAspectRatio.height;
    const cropDimensions = this.calculateCropDimensions(dimensions, targetRatio);
    
    // Position crop to center on people while keeping them fully in frame
    const cropArea = this.positionCropAroundPeople(
      dimensions,
      cropDimensions,
      peopleBounds,
      centerOfMass,
      options
    );
    
    // Calculate quality score based on how well people are positioned
    const qualityScore = this.calculatePeopleQualityScore(
      cropArea,
      peopleBounds,
      centerOfMass,
      detections.confidence
    );

    return {
      cropArea: {
        ...cropArea,
        confidence: detections.confidence
      },
      strategy: 'people-centered',
      qualityScore
    };
  }

  /**
   * Calculate fallback crop when no people are detected
   */
  private calculateFallbackCrop(
    dimensions: Dimensions,
    targetAspectRatio: AspectRatio,
    options: CroppingOptions
  ): CropSuggestion {
    const targetRatio = targetAspectRatio.width / targetAspectRatio.height;
    const cropDimensions = this.calculateCropDimensions(dimensions, targetRatio);
    
    let cropArea: BoundingBox;
    let strategy: CropSuggestion['strategy'];
    let qualityScore: number;

    switch (options.fallbackStrategy) {
      case 'center':
        cropArea = this.calculateCenterCrop(dimensions, cropDimensions);
        strategy = 'fallback-center';
        qualityScore = 0.7; // Good but not optimal
        break;
        
      case 'rule-of-thirds':
        cropArea = this.calculateRuleOfThirdsCrop(dimensions, cropDimensions);
        strategy = 'rule-of-thirds';
        qualityScore = 0.8; // Better composition
        break;
        
      case 'smart':
      default:
        cropArea = this.calculateSmartCrop(dimensions, cropDimensions);
        strategy = 'fallback-smart';
        qualityScore = 0.75; // Balanced approach
        break;
    }

    return {
      cropArea: {
        ...cropArea,
        confidence: 0.4  // Balanced confidence for family photos with varied lighting
      },
      strategy,
      qualityScore
    };
  }

  /**
   * Apply the crop to an image while preserving quality
   */
  async applyCrop(
    imagePath: string,
    cropArea: CropArea,
    targetAspectRatio: AspectRatio,
    outputPath: string,
    options: Partial<CroppingOptions> = {}
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // Try Python service cropping first
      console.log('Attempting Python service cropping for image:', imagePath);
      
      const cropRequest = {
        image_path: imagePath,
        target_aspect_ratio: {
          width: targetAspectRatio.width,
          height: targetAspectRatio.height
        },
        crop_strategy: 'center_faces' as const
      };

      const result = await this.pythonClient.cropImage(cropRequest);
      
      // Copy the processed image to the desired output path
      await sharp(result.processed_path).toFile(outputPath);
      
      console.log('Python service cropping completed successfully');
      return;
      
    } catch (error) {
      console.warn('Python service cropping failed, falling back to local processing:', error);
      
      // Fallback to local Sharp processing
      let pipeline = sharp(imagePath);
      
      // Get original image metadata
      const metadata = await pipeline.metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to read image dimensions');
      }

      // Apply crop
      pipeline = pipeline.extract({
        left: Math.round(cropArea.x),
        top: Math.round(cropArea.y),
        width: Math.round(cropArea.width),
        height: Math.round(cropArea.height)
      });

      // Calculate final dimensions based on target aspect ratio
      const targetRatio = targetAspectRatio.width / targetAspectRatio.height;
      const finalDimensions = this.calculateFinalDimensions(
        { width: cropArea.width, height: cropArea.height },
        targetRatio,
        opts
      );

      // Resize if needed
      if (finalDimensions.width !== cropArea.width || finalDimensions.height !== cropArea.height) {
        const resizeOptions: any = {
          withoutEnlargement: opts.preventStretching, // Respect stretching prevention setting
          fit: opts.preventStretching ? 'inside' : 'fill', // Use 'inside' to prevent stretching
          background: opts.paddingColor || { r: 255, g: 255, b: 255, alpha: 1 } // Configurable background
        };
        
        // For strict no-stretching, ensure we never exceed source dimensions
        if (opts.preventStretching) {
          const maxAllowedScale = 1.0; // Never scale up
          const currentScale = Math.max(
            finalDimensions.width / cropArea.width,
            finalDimensions.height / cropArea.height
          );
          
          if (currentScale > maxAllowedScale) {
            // Recalculate to fit within bounds
            const scaleFactor = maxAllowedScale / currentScale;
            finalDimensions.width = Math.round(finalDimensions.width * scaleFactor);
            finalDimensions.height = Math.round(finalDimensions.height * scaleFactor);
          }
        }
        
        // Add kernel option if available (may not be available in all Sharp versions)
        try {
          if (sharp.kernel && sharp.kernel.lanczos3) {
            resizeOptions.kernel = sharp.kernel.lanczos3;
          }
        } catch (e) {
          // Kernel not available, use default
        }
        
        pipeline = pipeline.resize(
          Math.round(finalDimensions.width),
          Math.round(finalDimensions.height),
          resizeOptions
        );
      }

      // Apply quality preservation settings
      if (opts.preserveQuality) {
        pipeline = pipeline.jpeg({ quality: 95, progressive: true })
                          .png({ compressionLevel: 6, progressive: true });
      }

      // Save the processed image
      await pipeline.toFile(outputPath);
    }
  }

  /**
   * Check if there are any people detections
   */
  private hasPeopleDetections(detections: DetectionResult): boolean {
    return detections.faces.length > 0 || detections.people.length > 0;
  }

  /**
   * Calculate bounding box that encompasses all detected people
   */
  private calculatePeopleBounds(detections: Detection[]): BoundingBox {
    if (detections.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const bounds = detections.reduce((acc, detection) => {
      const bbox = detection.boundingBox;
      return {
        minX: Math.min(acc.minX, bbox.x),
        minY: Math.min(acc.minY, bbox.y),
        maxX: Math.max(acc.maxX, bbox.x + bbox.width),
        maxY: Math.max(acc.maxY, bbox.y + bbox.height)
      };
    }, {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    });

    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    };
  }

  /**
   * Calculate weighted center of mass for detections
   */
  private calculateWeightedCenterOfMass(detections: Detection[]): Point {
    if (detections.length === 0) {
      return { x: 0, y: 0 };
    }

    let totalX = 0;
    let totalY = 0;
    let totalWeight = 0;

    detections.forEach(detection => {
      const bbox = detection.boundingBox;
      const centerX = bbox.x + bbox.width / 2;
      const centerY = bbox.y + bbox.height / 2;
      const weight = detection.confidence;

      totalX += centerX * weight;
      totalY += centerY * weight;
      totalWeight += weight;
    });

    return {
      x: totalWeight > 0 ? totalX / totalWeight : 0,
      y: totalWeight > 0 ? totalY / totalWeight : 0
    };
  }

  /**
   * Calculate crop dimensions based on image size and target ratio
   * Always ensures crop fits within original image bounds to prevent stretching
   */
  private calculateCropDimensions(dimensions: Dimensions, targetRatio: number): Dimensions {
    const imageRatio = dimensions.width / dimensions.height;
    
    // Calculate the maximum possible crop dimensions for target ratio
    let cropWidth: number;
    let cropHeight: number;
    
    if (targetRatio > imageRatio) {
      // Target is wider than image - crop height, keep full width
      cropWidth = dimensions.width;
      cropHeight = Math.round(dimensions.width / targetRatio);
      
      // Ensure crop height doesn't exceed image height
      if (cropHeight > dimensions.height) {
        cropHeight = dimensions.height;
        cropWidth = Math.round(dimensions.height * targetRatio);
      }
    } else {
      // Target is taller than image - crop width, keep full height  
      cropHeight = dimensions.height;
      cropWidth = Math.round(dimensions.height * targetRatio);
      
      // Ensure crop width doesn't exceed image width
      if (cropWidth > dimensions.width) {
        cropWidth = dimensions.width;
        cropHeight = Math.round(dimensions.width / targetRatio);
      }
    }
    
    // Final safety check - ensure dimensions are within bounds
    return {
      width: Math.min(Math.max(1, Math.round(cropWidth)), dimensions.width),
      height: Math.min(Math.max(1, Math.round(cropHeight)), dimensions.height)
    };
  }

  /**
   * Position crop area around detected people
   */
  private positionCropAroundPeople(
    imageDimensions: Dimensions,
    cropDimensions: Dimensions,
    peopleBounds: BoundingBox,
    centerOfMass: Point,
    _options: CroppingOptions
  ): BoundingBox {
    // Start with center of mass as the ideal center
    let idealCenterX = centerOfMass.x;
    let idealCenterY = centerOfMass.y;

    // Adjust to ensure all people are included with some padding
    const padding = 0.1; // 10% padding around people
    const paddedPeopleBounds = {
      x: peopleBounds.x - peopleBounds.width * padding,
      y: peopleBounds.y - peopleBounds.height * padding,
      width: peopleBounds.width * (1 + 2 * padding),
      height: peopleBounds.height * (1 + 2 * padding)
    };

    // Ensure crop area can contain all people
    if (cropDimensions.width < paddedPeopleBounds.width || 
        cropDimensions.height < paddedPeopleBounds.height) {
      // People bounds are larger than crop area - center on people bounds
      idealCenterX = paddedPeopleBounds.x + paddedPeopleBounds.width / 2;
      idealCenterY = paddedPeopleBounds.y + paddedPeopleBounds.height / 2;
    }

    // Calculate crop position
    let cropX = idealCenterX - cropDimensions.width / 2;
    let cropY = idealCenterY - cropDimensions.height / 2;

    // Ensure crop stays within image bounds
    cropX = Math.max(0, Math.min(cropX, imageDimensions.width - cropDimensions.width));
    cropY = Math.max(0, Math.min(cropY, imageDimensions.height - cropDimensions.height));

    // Final adjustment to ensure people are still included
    const finalCrop = { 
      x: Math.round(cropX), 
      y: Math.round(cropY), 
      width: Math.round(cropDimensions.width), 
      height: Math.round(cropDimensions.height) 
    };
    
    if (!this.cropContainsBounds(finalCrop, paddedPeopleBounds)) {
      // Adjust crop to include people bounds
      return this.adjustCropToIncludeBounds(finalCrop, paddedPeopleBounds, imageDimensions);
    }

    return finalCrop;
  }

  /**
   * Calculate center crop
   */
  private calculateCenterCrop(imageDimensions: Dimensions, cropDimensions: Dimensions): BoundingBox {
    return {
      x: Math.round((imageDimensions.width - cropDimensions.width) / 2),
      y: Math.round((imageDimensions.height - cropDimensions.height) / 2),
      width: Math.round(cropDimensions.width),
      height: Math.round(cropDimensions.height)
    };
  }

  /**
   * Calculate rule of thirds crop (slightly off-center for better composition)
   */
  private calculateRuleOfThirdsCrop(imageDimensions: Dimensions, cropDimensions: Dimensions): BoundingBox {
    // Position crop area using rule of thirds
    const offsetX = Math.round((imageDimensions.width - cropDimensions.width) / 3);
    const offsetY = Math.round((imageDimensions.height - cropDimensions.height) / 3);
    
    return {
      x: offsetX,
      y: offsetY,
      width: Math.round(cropDimensions.width),
      height: Math.round(cropDimensions.height)
    };
  }

  /**
   * Calculate smart crop using basic saliency heuristics
   */
  private calculateSmartCrop(imageDimensions: Dimensions, cropDimensions: Dimensions): BoundingBox {
    // For now, use a slightly off-center approach that avoids edges
    // In a real implementation, this could use saliency detection
    const marginX = Math.round((imageDimensions.width - cropDimensions.width) * 0.2);
    const marginY = Math.round((imageDimensions.height - cropDimensions.height) * 0.2);
    
    return {
      x: marginX,
      y: marginY,
      width: Math.round(cropDimensions.width),
      height: Math.round(cropDimensions.height)
    };
  }

  /**
   * Calculate quality score for people-centered crops
   */
  private calculatePeopleQualityScore(
    cropArea: BoundingBox,
    peopleBounds: BoundingBox,
    centerOfMass: Point,
    detectionConfidence: number
  ): number {
    let score = 0;

    // Base score from detection confidence
    score += detectionConfidence * 0.4;

    // Score based on how centered people are in the crop
    const cropCenterX = cropArea.x + cropArea.width / 2;
    const cropCenterY = cropArea.y + cropArea.height / 2;
    const centerDistance = Math.sqrt(
      Math.pow(centerOfMass.x - cropCenterX, 2) + 
      Math.pow(centerOfMass.y - cropCenterY, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(cropArea.width / 2, 2) + Math.pow(cropArea.height / 2, 2));
    const centeringScore = Math.max(0, 1 - centerDistance / maxDistance);
    score += centeringScore * 0.3;

    // Score based on how much of the people are included
    const peopleArea = peopleBounds.width * peopleBounds.height;
    const cropArea_area = cropArea.width * cropArea.height;
    const inclusionScore = Math.min(1, peopleArea / (cropArea_area * 0.3)); // People should take up reasonable portion
    score += inclusionScore * 0.3;

    return Math.min(1, score);
  }

  /**
   * Calculate final output dimensions
   * NEVER exceeds crop dimensions to prevent stretching - always fits within bounds
   */
  private calculateFinalDimensions(
    cropDimensions: Dimensions,
    targetRatio: number,
    _options: CroppingOptions
  ): Dimensions {
    const currentRatio = cropDimensions.width / cropDimensions.height;
    
    if (Math.abs(currentRatio - targetRatio) < 0.01) {
      // Already at target ratio
      return {
        width: Math.round(cropDimensions.width),
        height: Math.round(cropDimensions.height)
      };
    }

    // Calculate dimensions that fit within crop bounds while achieving target ratio
    let finalWidth: number;
    let finalHeight: number;
    
    if (targetRatio > currentRatio) {
      // Target is wider - fit by height, then check if width fits
      finalHeight = cropDimensions.height;
      finalWidth = Math.round(finalHeight * targetRatio);
      
      // If calculated width exceeds crop width, fit by width instead
      if (finalWidth > cropDimensions.width) {
        finalWidth = cropDimensions.width;
        finalHeight = Math.round(finalWidth / targetRatio);
      }
    } else {
      // Target is taller - fit by width, then check if height fits
      finalWidth = cropDimensions.width;
      finalHeight = Math.round(finalWidth / targetRatio);
      
      // If calculated height exceeds crop height, fit by height instead
      if (finalHeight > cropDimensions.height) {
        finalHeight = cropDimensions.height;
        finalWidth = Math.round(finalHeight * targetRatio);
      }
    }
    
    // Ensure we never exceed the crop dimensions (prevent any stretching)
    return {
      width: Math.min(Math.max(1, Math.round(finalWidth)), cropDimensions.width),
      height: Math.min(Math.max(1, Math.round(finalHeight)), cropDimensions.height)
    };
  }

  /**
   * Check if crop area contains the given bounds
   */
  private cropContainsBounds(crop: BoundingBox, bounds: BoundingBox): boolean {
    return crop.x <= bounds.x &&
           crop.y <= bounds.y &&
           crop.x + crop.width >= bounds.x + bounds.width &&
           crop.y + crop.height >= bounds.y + bounds.height;
  }

  /**
   * Adjust crop to include the given bounds
   */
  private adjustCropToIncludeBounds(
    crop: BoundingBox,
    bounds: BoundingBox,
    imageDimensions: Dimensions
  ): BoundingBox {
    let adjustedCrop = { ...crop };

    // Expand crop to include bounds
    const minX = Math.min(crop.x, bounds.x);
    const minY = Math.min(crop.y, bounds.y);
    const maxX = Math.max(crop.x + crop.width, bounds.x + bounds.width);
    const maxY = Math.max(crop.y + crop.height, bounds.y + bounds.height);

    // Try to maintain crop dimensions while including bounds
    const requiredWidth = maxX - minX;
    const requiredHeight = maxY - minY;

    if (requiredWidth <= crop.width && requiredHeight <= crop.height) {
      // Can fit by repositioning
      adjustedCrop.x = Math.round(Math.max(0, Math.min(minX, imageDimensions.width - crop.width)));
      adjustedCrop.y = Math.round(Math.max(0, Math.min(minY, imageDimensions.height - crop.height)));
    } else {
      // Need to expand crop (may change aspect ratio slightly)
      adjustedCrop.x = Math.round(Math.max(0, minX));
      adjustedCrop.y = Math.round(Math.max(0, minY));
      adjustedCrop.width = Math.round(Math.min(requiredWidth, imageDimensions.width - adjustedCrop.x));
      adjustedCrop.height = Math.round(Math.min(requiredHeight, imageDimensions.height - adjustedCrop.y));
    }

    return adjustedCrop;
  }
}

// Export singleton instance
export const croppingService = new CroppingService();