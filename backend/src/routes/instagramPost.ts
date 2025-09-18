/**
 * Instagram Content Generation Routes
 * 
 * This module provides REST API endpoints for generating Instagram content (captions and hashtags)
 * that users can manually copy and post to Instagram themselves.
 * 
 * Features:
 * - AI-generated captions and hashtags for processed images
 * - Caption refresh with different styles and moods
 * - Multiple caption alternatives generation
 * - Content ready for manual copy-paste to Instagram
 * 
 * Integration:
 * - Works with processed images from PixelForge AI
 * - Uses enhanced Instagram content generation (up to 50 words)
 * - Supports multiple caption styles and moods
 * - No direct Instagram posting - content is for manual use
 * 
 * Usage:
 * ```typescript
 * // Generate content for an image
 * POST /api/instagram/content/generate
 * {
 *   "imageId": "processed_image_id",
 *   "options": { "style": "casual", "mood": "happy" }
 * }
 * 
 * // Get caption alternatives
 * POST /api/instagram/content/alternatives
 * {
 *   "imageId": "processed_image_id",
 *   "styles": ["casual", "professional", "creative"]
 * }
 * ```
 * 
 * Returns: Generated content ready for manual Instagram posting
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { aiNamingService } from '../services/aiNamingService.js';
import { logger } from '../utils/logger.js';
import { authenticateToken as authMiddleware } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Input validation schemas
const GenerateContentSchema = z.object({
  imageId: z.string().min(1, 'Image ID is required'),
  options: z.object({
    style: z.enum(['casual', 'professional', 'creative', 'inspirational', 'humorous']).optional(),
    mood: z.enum(['happy', 'excited', 'calm', 'thoughtful', 'energetic']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    includeHashtags: z.boolean().optional().default(true),
    maxHashtags: z.number().min(1).max(30).optional().default(10)
  }).optional().default({})
});

const AlternativesSchema = z.object({
  imageId: z.string().min(1, 'Image ID is required'),
  styles: z.array(z.enum(['casual', 'professional', 'creative', 'inspirational', 'humorous'])).min(1).max(5),
  options: z.object({
    includeHashtags: z.boolean().optional().default(true),
    maxHashtags: z.number().min(1).max(30).optional().default(10)
  }).optional().default({})
});

const RefreshContentSchema = z.object({
  imageId: z.string().min(1, 'Image ID is required'),
  currentCaption: z.string().optional(),
  newStyle: z.enum(['casual', 'professional', 'creative', 'inspirational', 'humorous']).optional(),
  newMood: z.enum(['happy', 'excited', 'calm', 'thoughtful', 'energetic']).optional()
});

interface ContentOptions {
  style?: string;
  mood?: string;
  length?: string;
  includeHashtags?: boolean;
  maxHashtags?: number;
}

interface GeneratedContent {
  caption: string;
  hashtags: string[];
  formattedPost: string;
  style: string;
  mood: string;
  timestamp: string;
}

/**
 * Generate Instagram content for a processed image
 * Returns AI-generated caption and hashtags for manual posting
 */
router.post('/content/generate', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId, options } = GenerateContentSchema.parse(req.body);
    
    logger.info(`Generating Instagram content for image: ${imageId}`);

    // Check if image exists in processed folder
    const processedDir = path.join(process.cwd(), 'processed');
    const imageFiles = fs.readdirSync(processedDir).filter(file => 
      file.includes(imageId) && /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    if (imageFiles.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Processed image not found',
        imageId
      });
      return;
    }

    const imageFile = imageFiles[0];
    const imagePath = path.join(processedDir, imageFile);

    // Extract image info for content generation
    const imageInfo = {
      filename: imageFile,
      path: imagePath,
      format: path.extname(imageFile).slice(1).toLowerCase()
    };

    // Generate content using AI naming service
    const contentPrompt = buildContentPrompt(imageInfo, options);
    const generatedText = await aiNamingService.generateInstagramContent(contentPrompt);
    
    if (!generatedText) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate content'
      });
      return;
    }

    const content = parseGeneratedContent(generatedText.caption || generatedText.toString(), options);

    const result: GeneratedContent = {
      caption: content.caption,
      hashtags: content.hashtags,
      formattedPost: formatForInstagram(content.caption, content.hashtags),
      style: options.style || 'casual',
      mood: options.mood || 'happy',
      timestamp: new Date().toISOString()
    };

    logger.info(`Successfully generated Instagram content for image: ${imageId}`);
    
    res.json({
      success: true,
      content: result,
      imageId,
      instructions: 'Copy the formattedPost content and manually paste it to Instagram'
    });

  } catch (error) {
    logger.error('Error generating Instagram content:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate content'
    });
  }
});

/**
 * Generate multiple caption alternatives with different styles
 */
router.post('/content/alternatives', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId, styles, options } = AlternativesSchema.parse(req.body);
    
    logger.info(`Generating ${styles.length} alternative captions for image: ${imageId}`);

    // Check if image exists
    const processedDir = path.join(process.cwd(), 'processed');
    const imageFiles = fs.readdirSync(processedDir).filter(file => 
      file.includes(imageId) && /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    if (imageFiles.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Processed image not found',
        imageId
      });
      return;
    }

    const imageFile = imageFiles[0];
    const imagePath = path.join(processedDir, imageFile);
    const imageInfo = {
      filename: imageFile,
      path: imagePath,
      format: path.extname(imageFile).slice(1).toLowerCase()
    };

    // Generate alternatives for each style
    const alternatives: GeneratedContent[] = [];
    
    for (const style of styles) {
      const styleOptions = { ...options, style };
      const contentPrompt = buildContentPrompt(imageInfo, styleOptions);
      const generatedText = await aiNamingService.generateInstagramContent(contentPrompt);
      
      if (generatedText) {
        const content = parseGeneratedContent(generatedText.caption || generatedText.toString(), styleOptions);

        alternatives.push({
          caption: content.caption,
          hashtags: content.hashtags,
          formattedPost: formatForInstagram(content.caption, content.hashtags),
          style,
          mood: 'happy', // Default mood for alternatives
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info(`Successfully generated ${alternatives.length} alternatives for image: ${imageId}`);
    
    res.json({
      success: true,
      alternatives,
      imageId,
      instructions: 'Choose your preferred style and copy the formattedPost content for manual Instagram posting'
    });

  } catch (error) {
    logger.error('Error generating content alternatives:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate alternatives'
    });
  }
});

/**
 * Refresh/regenerate content with new style or mood
 */
router.post('/content/refresh', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId, currentCaption, newStyle, newMood } = RefreshContentSchema.parse(req.body);
    
    logger.info(`Refreshing content for image: ${imageId} with new style: ${newStyle}, mood: ${newMood}`);

    // Check if image exists
    const processedDir = path.join(process.cwd(), 'processed');
    const imageFiles = fs.readdirSync(processedDir).filter(file => 
      file.includes(imageId) && /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    if (imageFiles.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Processed image not found',
        imageId
      });
      return;
    }

    const imageFile = imageFiles[0];
    const imagePath = path.join(processedDir, imageFile);
    const imageInfo = {
      filename: imageFile,
      path: imagePath,
      format: path.extname(imageFile).slice(1).toLowerCase()
    };

    const refreshOptions = {
      style: newStyle || 'casual',
      mood: newMood || 'happy',
      includeHashtags: true,
      maxHashtags: 10
    };

    // Generate refreshed content
    const contentPrompt = buildRefreshPrompt(imageInfo, currentCaption, refreshOptions);
    const generatedText = await aiNamingService.generateInstagramContent(contentPrompt);
    
    if (!generatedText) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate refreshed content'
      });
      return;
    }

    const content = parseGeneratedContent(generatedText.caption || generatedText.toString(), refreshOptions);

    const result: GeneratedContent = {
      caption: content.caption,
      hashtags: content.hashtags,
      formattedPost: formatForInstagram(content.caption, content.hashtags),
      style: refreshOptions.style,
      mood: refreshOptions.mood,
      timestamp: new Date().toISOString()
    };

    logger.info(`Successfully refreshed content for image: ${imageId}`);
    
    res.json({
      success: true,
      content: result,
      previous: currentCaption,
      imageId,
      instructions: 'Copy the new formattedPost content for manual Instagram posting'
    });

  } catch (error) {
    logger.error('Error refreshing content:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh content'
    });
  }
});

/**
 * Get content for batch of images from a processing job
 */
router.post('/content/batch', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId, options = {} } = req.body;
    
    if (!jobId) {
      res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
      return;
    }

    logger.info(`Generating batch content for job: ${jobId}`);

    // Generate content for each processed image
    const batchContent: (GeneratedContent & { imageId: string })[] = [];
    const processedDir = path.join(process.cwd(), 'processed');
    
    // Find all processed images from this job
    const processedFiles = fs.readdirSync(processedDir).filter(file => 
      file.includes(jobId) && /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    for (const imageFile of processedFiles) {
      try {
        const imageId = extractImageId(imageFile);
        const imagePath = path.join(processedDir, imageFile);
        const imageInfo = {
          filename: imageFile,
          path: imagePath,
          format: path.extname(imageFile).slice(1).toLowerCase()
        };

        const contentPrompt = buildContentPrompt(imageInfo, options);
        const generatedText = await aiNamingService.generateInstagramContent(contentPrompt);
        
        if (generatedText) {
          const content = parseGeneratedContent(generatedText.caption || generatedText.toString(), options);

          batchContent.push({
            imageId,
            caption: content.caption,
            hashtags: content.hashtags,
            formattedPost: formatForInstagram(content.caption, content.hashtags),
            style: options.style || 'casual',
            mood: options.mood || 'happy',
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        logger.error(`Error generating content for image ${imageFile}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.info(`Successfully generated content for ${batchContent.length} images from job: ${jobId}`);
    
    res.json({
      success: true,
      batchContent,
      jobId,
      totalImages: batchContent.length,
      instructions: 'Copy each formattedPost content and manually post to Instagram'
    });

  } catch (error) {
    logger.error('Error generating batch content:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate batch content'
    });
  }
});

// Helper functions

function buildContentPrompt(imageInfo: any, options: ContentOptions): string {
  const style = options.style || 'casual';
  const mood = options.mood || 'happy';
  const length = options.length || 'medium';
  
  return `Generate an engaging Instagram caption for this processed image: ${imageInfo.filename}
  
Style: ${style}
Mood: ${mood}
Length: ${length}
Include hashtags: ${options.includeHashtags !== false}
Max hashtags: ${options.maxHashtags || 10}

Requirements:
- Create an engaging caption that matches the ${style} style and ${mood} mood
- ${length === 'short' ? 'Keep it concise (1-2 sentences)' : length === 'long' ? 'Make it detailed and storytelling' : 'Use medium length (2-3 sentences)'}
- ${options.includeHashtags !== false ? `Include ${options.maxHashtags || 10} relevant hashtags` : 'Do not include hashtags'}
- Make it authentic and engaging for Instagram audience
- Focus on the visual content and emotional impact

Return in format:
CAPTION: [your caption here]
HASHTAGS: [hashtag1, hashtag2, hashtag3, ...]`;
}

function buildRefreshPrompt(imageInfo: any, currentCaption: string | undefined, options: ContentOptions): string {
  const style = options.style || 'casual';
  const mood = options.mood || 'happy';
  
  return `Refresh and improve this Instagram content for image: ${imageInfo.filename}

Current caption: ${currentCaption || 'None provided'}
New style: ${style}
New mood: ${mood}

Requirements:
- Create a completely new caption with the ${style} style and ${mood} mood
- Make it different from the current caption while keeping the same image context
- Include ${options.maxHashtags || 10} fresh, relevant hashtags
- Ensure it's engaging and authentic for Instagram

Return in format:
CAPTION: [your new caption here]
HASHTAGS: [hashtag1, hashtag2, hashtag3, ...]`;
}

function parseGeneratedContent(generatedText: string, options: ContentOptions): { caption: string; hashtags: string[] } {
  try {
    const lines = generatedText.split('\n');
    let caption = '';
    let hashtags: string[] = [];

    for (const line of lines) {
      if (line.startsWith('CAPTION:')) {
        caption = line.replace('CAPTION:', '').trim();
      } else if (line.startsWith('HASHTAGS:')) {
        const hashtagText = line.replace('HASHTAGS:', '').trim();
        hashtags = hashtagText
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
          .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
          .slice(0, options.maxHashtags || 10);
      }
    }

    // Fallback if parsing fails
    if (!caption) {
      caption = generatedText.trim();
    }
    
    if (hashtags.length === 0 && options.includeHashtags !== false) {
      hashtags = ['#pixelforge', '#aiprocessed', '#instagram'];
    }

    return { caption, hashtags };
  } catch (error) {
    logger.error('Error parsing generated content:', { error: error instanceof Error ? error.message : String(error) });
    return {
      caption: 'Beautiful processed image ready for Instagram!',
      hashtags: ['#pixelforge', '#aiprocessed', '#instagram']
    };
  }
}

function formatForInstagram(caption: string, hashtags: string[]): string {
  return `${caption}\n\n${hashtags.join(' ')}`;
}

function extractImageId(filename: string): string {
  // Extract image ID from processed filename
  // Example: "processed_image_123_456.jpeg" -> "123_456"
  const match = filename.match(/processed_(.+?)_\w+\.(jpg|jpeg|png|webp)$/i);
  return match ? match[1] : filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
}

export default router;
