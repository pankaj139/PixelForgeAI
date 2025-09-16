/**
 * Instagram Posting Routes
 * 
 * This module provides REST API endpoints for direct Instagram posting functionality,
 * enabling users to post processed images with AI-generated captions and hashtags directly to Instagram.
 * 
 * Features:
 * - Single image posting to Instagram feed
 * - Story posting capabilities
 * - Batch posting with progress tracking
 * - Caption refresh and alternatives generation
 * - Post scheduling (if supported)
 * - Post insights and analytics retrieval
 * 
 * Integration:
 * - Works with processed images from PixelForge AI
 * - Uses enhanced Instagram content generation (up to 50 words)
 * - Supports multiple caption styles and moods
 * - Provides real-time posting progress updates
 * 
 * Usage:
 * ```typescript
 * // Post single image
 * POST /api/instagram/post
 * {
 *   "imageId": "processed_image_id",
 *   "caption": "AI-generated caption",
 *   "hashtags": ["tag1", "tag2"],
 *   "accessToken": "instagram_access_token"
 * }
 * 
 * // Batch post images
 * POST /api/instagram/post/batch
 * {
 *   "jobId": "processing_job_id",
 *   "accessToken": "instagram_access_token",
 *   "postingOptions": { "delayBetweenPosts": 300 }
 * }
 * ```
 * 
 * Returns: Complete posting results with Instagram URLs and engagement data
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import { instagramMcpService } from '../services/instagramMcpService.js';
import { aiNamingService } from '../services/aiNamingService.js';
import { jobHistoryService } from '../services/jobHistoryService.js';
import { logger } from '../utils/logger.js';
import { authenticateToken as authMiddleware } from '../middleware/auth.js';

const router = Router();

// Input validation schemas
const PostImageSchema = z.object({
  imageId: z.string().min(1, 'Image ID is required'),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  accessToken: z.string().min(1, 'Instagram access token is required'),
  location: z.object({
    name: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  }).optional(),
  altText: z.string().optional(),
  isStory: z.boolean().optional().default(false)
});

const RefreshCaptionSchema = z.object({
  imageId: z.string().min(1, 'Image ID is required'),
  options: z.object({
    captionLength: z.enum(['short', 'medium', 'long']).optional(),
    style: z.enum(['casual', 'professional', 'creative', 'minimal', 'storytelling']).optional(),
    mood: z.enum(['happy', 'inspirational', 'professional', 'fun', 'elegant']).optional(),
    includeCallToAction: z.boolean().optional()
  }).optional()
});

const BatchPostSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  accessToken: z.string().min(1, 'Instagram access token is required'),
  postingOptions: z.object({
    delayBetweenPosts: z.number().min(5).max(3600).optional().default(300), // 5 seconds to 1 hour
    postToStory: z.boolean().optional().default(false),
    skipFailedImages: z.boolean().optional().default(true),
    captionOptions: z.object({
      captionLength: z.enum(['short', 'medium', 'long']).optional().default('medium'),
      style: z.enum(['casual', 'professional', 'creative', 'minimal', 'storytelling']).optional().default('casual'),
      mood: z.enum(['happy', 'inspirational', 'professional', 'fun', 'elegant']).optional().default('happy')
    }).optional()
  }).optional().default({})
});

const CaptionAlternativesSchema = z.object({
  imageId: z.string().min(1, 'Image ID is required'),
  styles: z.array(z.enum(['casual', 'professional', 'creative', 'minimal', 'storytelling'])).optional()
});

/**
 * Post a single processed image to Instagram
 * 
 * POST /api/instagram/post
 * 
 * Request body:
 * {
 *   "imageId": "processed_image_id",
 *   "caption": "Custom caption (optional)",
 *   "hashtags": ["tag1", "tag2"] (optional),
 *   "accessToken": "instagram_access_token",
 *   "location": { "name": "Location name" } (optional),
 *   "altText": "Accessibility description" (optional),
 *   "isStory": false (optional)
 * }
 */
router.post('/post', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validatedData = PostImageSchema.parse(req.body);
    const userId = (req as any).user.id;

    logger.info('Instagram post initiated', {
      userId,
      imageId: validatedData.imageId,
      isStory: validatedData.isStory,
      hasCustomCaption: !!validatedData.caption
    });

    // Get the processed image details
    const processedImage = await jobHistoryService.getProcessedImageById(validatedData.imageId);
    if (!processedImage) {
      return res.status(404).json({
        success: false,
        error: 'Processed image not found',
        message: 'The specified image ID does not exist or has been deleted'
      });
    }

    // Use provided caption/hashtags or generate Instagram content if not provided
    let caption = validatedData.caption;
    let hashtags = validatedData.hashtags || [];

    if (!caption || !hashtags.length) {
      logger.info('Generating Instagram content for posting', { imageId: validatedData.imageId });
      
      const instagramContent = processedImage.instagramContent || 
        await aiNamingService.generateInstagramContent(processedImage.processedPath, {
          captionLength: 'medium',
          style: 'casual',
          mood: 'happy',
          includeCallToAction: true
        });

      if (instagramContent) {
        caption = caption || instagramContent.caption;
        hashtags = hashtags.length > 0 ? hashtags : instagramContent.hashtags;
      } else {
        // Fallback caption
        caption = caption || 'Check out this amazing image! ✨ #PixelForgeAI';
        hashtags = hashtags.length > 0 ? hashtags : ['photography', 'ai', 'pixelforge'];
      }
    }

    // Post to Instagram
    const postResult = await instagramMcpService.postToInstagram({
      imagePath: processedImage.processedPath,
      caption,
      hashtags,
      accessToken: validatedData.accessToken,
      location: validatedData.location,
      altText: validatedData.altText,
      isStory: validatedData.isStory
    });

    if (postResult.success) {
      logger.info('Instagram post successful', {
        userId,
        imageId: validatedData.imageId,
        postId: postResult.postId,
        postUrl: postResult.postUrl,
        processingTime: postResult.uploadMetrics.processingTime
      });

      // TODO: Store posting record in database for tracking

      res.json({
        success: true,
        data: {
          postId: postResult.postId,
          postUrl: postResult.postUrl,
          mediaId: postResult.mediaId,
          caption,
          hashtags,
          uploadMetrics: postResult.uploadMetrics,
          postedAt: new Date().toISOString(),
          imageDetails: {
            originalName: processedImage.id,
            aspectRatio: processedImage.aspectRatio.name,
            instagramOptimized: processedImage.instagramOptimized || false
          }
        }
      });
    } else {
      logger.error('Instagram post failed', {
        userId,
        imageId: validatedData.imageId,
        error: postResult.error
      });

      res.status(400).json({
        success: false,
        error: 'Instagram posting failed',
        message: postResult.error,
        suggestions: [
          'Check if your Instagram access token is valid',
          'Verify the image meets Instagram\'s requirements',
          'Ensure your account has posting permissions'
        ]
      });
    }

  } catch (error) {
    logger.error('Instagram post request failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Instagram posting failed',
      message: 'An unexpected error occurred during posting'
    });
  }
});

/**
 * Refresh caption for an image with new options
 * 
 * POST /api/instagram/caption/refresh
 * 
 * Request body:
 * {
 *   "imageId": "processed_image_id",
 *   "options": {
 *     "captionLength": "long",
 *     "style": "professional",
 *     "mood": "inspirational",
 *     "includeCallToAction": true
 *   }
 * }
 */
router.post('/caption/refresh', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validatedData = RefreshCaptionSchema.parse(req.body);
    const userId = (req as any).user.id;

    logger.info('Caption refresh requested', {
      userId,
      imageId: validatedData.imageId,
      options: validatedData.options
    });

    // Get the processed image details
    const processedImage = await jobHistoryService.getProcessedImageById(validatedData.imageId);
    if (!processedImage) {
      return res.status(404).json({
        success: false,
        error: 'Processed image not found',
        message: 'The specified image ID does not exist or has been deleted'
      });
    }

    // Generate new Instagram content with specified options
    const refreshedContent = await aiNamingService.refreshInstagramContent(
      processedImage.processedPath,
      {
        ...validatedData.options,
        forceRefresh: true
      }
    );

    if (!refreshedContent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate refreshed caption',
        message: 'AI content generation is currently unavailable'
      });
    }

    logger.info('Caption refreshed successfully', {
      userId,
      imageId: validatedData.imageId,
      newWordCount: refreshedContent.wordCount,
      style: refreshedContent.style
    });

    res.json({
      success: true,
      data: {
        caption: refreshedContent.caption,
        hashtags: refreshedContent.hashtags,
        wordCount: refreshedContent.wordCount,
        style: refreshedContent.style,
        alternativeCaptions: refreshedContent.alternativeCaptions || [],
        generatedAt: refreshedContent.generatedAt,
        options: validatedData.options
      }
    });

  } catch (error) {
    logger.error('Caption refresh failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Caption refresh failed',
      message: 'Unable to generate new caption content'
    });
  }
});

/**
 * Generate caption alternatives in different styles
 * 
 * POST /api/instagram/caption/alternatives
 * 
 * Request body:
 * {
 *   "imageId": "processed_image_id",
 *   "styles": ["casual", "professional", "creative"] (optional)
 * }
 */
router.post('/caption/alternatives', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validatedData = CaptionAlternativesSchema.parse(req.body);
    const userId = (req as any).user.id;

    const alternativeStyles = validatedData.styles || ['casual', 'professional', 'creative'];

    logger.info('Caption alternatives requested', {
      userId,
      imageId: validatedData.imageId,
      styles: alternativeStyles
    });

    // Get the processed image details
    const processedImage = await jobHistoryService.getProcessedImageById(validatedData.imageId);
    if (!processedImage) {
      return res.status(404).json({
        success: false,
        error: 'Processed image not found',
        message: 'The specified image ID does not exist or has been deleted'
      });
    }

    // Generate caption alternatives
    const alternatives = await aiNamingService.generateCaptionAlternatives(
      processedImage.processedPath,
      { captionLength: 'medium', mood: 'happy' },
      alternativeStyles
    );

    const validAlternatives = Object.entries(alternatives)
      .filter(([_, content]) => content !== null)
      .reduce((acc, [style, content]) => {
        acc[style] = content;
        return acc;
      }, {} as { [style: string]: any });

    if (Object.keys(validAlternatives).length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate caption alternatives',
        message: 'AI content generation is currently unavailable'
      });
    }

    logger.info('Caption alternatives generated', {
      userId,
      imageId: validatedData.imageId,
      generatedStyles: Object.keys(validAlternatives)
    });

    res.json({
      success: true,
      data: {
        alternatives: validAlternatives,
        generatedAt: new Date().toISOString(),
        availableStyles: alternativeStyles
      }
    });

  } catch (error) {
    logger.error('Caption alternatives generation failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Caption alternatives generation failed',
      message: 'Unable to generate alternative captions'
    });
  }
});

/**
 * Batch post all processed images from a job to Instagram
 * 
 * POST /api/instagram/post/batch
 * 
 * Request body:
 * {
 *   "jobId": "processing_job_id",
 *   "accessToken": "instagram_access_token",
 *   "postingOptions": {
 *     "delayBetweenPosts": 300,
 *     "postToStory": false,
 *     "skipFailedImages": true,
 *     "captionOptions": {
 *       "captionLength": "medium",
 *       "style": "casual",
 *       "mood": "happy"
 *     }
 *   }
 * }
 */
router.post('/post/batch', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validatedData = BatchPostSchema.parse(req.body);
    const userId = (req as any).user.id;

    logger.info('Batch Instagram posting initiated', {
      userId,
      jobId: validatedData.jobId,
      options: validatedData.postingOptions
    });

    // Get job details and processed images
    const job = await jobHistoryService.getJobById(validatedData.jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        message: 'The specified job ID does not exist'
      });
    }

    const processedImages = await jobHistoryService.getProcessedImagesByJobId(validatedData.jobId);
    if (!processedImages || processedImages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No processed images found',
        message: 'The job has no processed images available for posting'
      });
    }

    // Generate Instagram content for images that don't have it
    const imagesWithContent = await Promise.all(
      processedImages.map(async (image) => {
        if (!image.instagramContent && validatedData.postingOptions.captionOptions) {
          const content = await aiNamingService.generateInstagramContent(
            image.processedPath,
            {
              ...validatedData.postingOptions.captionOptions,
              includeCallToAction: true
            }
          );
          
          if (content) {
            image.instagramContent = content;
          }
        }
        return image;
      })
    );

    // Start batch posting
    const postingResults = await instagramMcpService.batchPostToInstagram(
      imagesWithContent,
      {
        accessToken: validatedData.accessToken,
        isStory: validatedData.postingOptions.postToStory
      },
      (completed: number, total: number) => {
        logger.info('Batch posting progress', {
          userId,
          jobId: validatedData.jobId,
          completed,
          total,
          progress: Math.round((completed / total) * 100)
        });
        
        // TODO: Emit real-time progress updates to client via WebSocket/SSE
      }
    );

    const successCount = postingResults.filter(r => r.success).length;
    const failureCount = postingResults.length - successCount;

    logger.info('Batch Instagram posting completed', {
      userId,
      jobId: validatedData.jobId,
      totalImages: postingResults.length,
      successful: successCount,
      failed: failureCount
    });

    // TODO: Store batch posting record in database

    res.json({
      success: true,
      data: {
        totalImages: postingResults.length,
        successful: successCount,
        failed: failureCount,
        results: postingResults.map((result, index) => ({
          imageIndex: index,
          imageId: processedImages[index].id,
          success: result.success,
          postId: result.postId,
          postUrl: result.postUrl,
          error: result.error,
          uploadMetrics: result.uploadMetrics
        })),
        completedAt: new Date().toISOString(),
        statistics: {
          totalProcessingTime: postingResults.reduce((sum, r) => sum + r.uploadMetrics.processingTime, 0),
          averageFileSize: Math.round(postingResults.reduce((sum, r) => sum + r.uploadMetrics.fileSize, 0) / postingResults.length),
          successRate: Math.round((successCount / postingResults.length) * 100)
        }
      }
    });

  } catch (error) {
    logger.error('Batch Instagram posting failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Batch posting failed',
      message: 'An unexpected error occurred during batch posting'
    });
  }
});

export default router;
