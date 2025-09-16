/**
 * AI-Powered Image Naming Service
 * 
 * This service uses AI vision to analyze image content and generate descriptive
 * 2-word names that make images easier to identify and organize.
 * 
 * Features:
 * - Content-aware naming using Google Gemini Vision API
 * - 2-word descriptive names (e.g., "family_portrait", "beach_sunset")
 * - Fallback to generic naming if AI fails
 * - Caching to avoid re-analyzing similar images
 * 
 * Usage:
 * ```typescript
 * const suggestedName = await aiNamingService.generateImageName(imagePath);
 * // Returns: "family_portrait" or "mountain_landscape" etc.
 * ```
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

interface NamingOptions {
  fallbackName?: string;
  maxRetries?: number;
  useCache?: boolean;
}

interface InstagramContentOptions {
  maxRetries?: number;
  useCache?: boolean;
}

interface InstagramContent {
  caption: string;
  hashtags: string[];
  generatedAt: string;
}

interface CachedName {
  name: string;
  timestamp: number;
  imageHash: string;
}

interface CachedInstagramContent extends InstagramContent {
  timestamp: number;
  imageHash: string;
}

export class AiNamingService {
  private genAI: GoogleGenerativeAI | null = null;
  private cache: Map<string, CachedName> = new Map();
  private instagramCache: Map<string, CachedInstagramContent> = new Map();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Delay initialization to allow environment variables to load
    this.initializeGeminiClient();
  }

  private initializeGeminiClient() {
    // Initialize Gemini client if API key is available
    const apiKey = process.env['GEMINI_API_KEY'];

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ AI Naming Service initialized with Google Gemini');
    } else {
      console.warn('⚠️ AI Naming Service: GEMINI_API_KEY not found, using fallback naming only');
    }
  }

  /**
   * Generate a descriptive 2-word name for an image based on its content
   */
  async generateImageName(
    imagePath: string, 
    options: NamingOptions = {}
  ): Promise<string> {
    const { fallbackName = 'processed_image', maxRetries = 2, useCache = true } = options;

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.warn(`Image not found: ${imagePath}`);
      return this.sanitizeName(fallbackName);
    }

    // Generate image hash for caching
    const imageHash = await this.generateImageHash(imagePath);
    
    // Check cache first
    if (useCache && this.cache.has(imageHash)) {
      const cached = this.cache.get(imageHash)!;
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`Using cached name for ${path.basename(imagePath)}: ${cached.name}`);
        return cached.name;
      }
    }

    // Try AI naming if available
    console.log(`🤖 AI Naming - genAI client available: ${this.genAI ? 'YES' : 'NO'}`);
    if (this.genAI) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🤖 AI Naming attempt ${attempt} for ${path.basename(imagePath)}`);
          const aiName = await this.analyzeImageWithAI(imagePath);
          if (aiName) {
            const sanitizedName = this.sanitizeName(aiName);
            
            // Cache the result
            if (useCache) {
              this.cache.set(imageHash, {
                name: sanitizedName,
                timestamp: Date.now(),
                imageHash
              });
            }
            
            console.log(`✅ AI generated name for ${path.basename(imagePath)}: ${sanitizedName}`);
            return sanitizedName;
          } else {
            console.warn(`🤖 AI naming attempt ${attempt} returned no result`);
          }
        } catch (error) {
          console.warn(`❌ AI naming attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
          if (attempt === maxRetries) {
            console.warn('⚠️ All AI naming attempts failed, using fallback');
          }
        }
      }
    } else {
      console.warn('🚫 No Gemini client available, skipping AI naming');
    }

    // Fallback to enhanced generic naming
    const enhancedFallback = this.generateEnhancedFallbackName(imagePath, fallbackName);
    console.log(`Using fallback name for ${path.basename(imagePath)}: ${enhancedFallback}`);
    return enhancedFallback;
  }

  /**
   * Analyze image content using Google Gemini Vision
   */
  private async analyzeImageWithAI(imagePath: string): Promise<string | null> {
    if (!this.genAI) return null;

    try {
      // Get the Gemini model
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Convert image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(imagePath);

      const prompt = `Analyze this image and generate exactly 2 words that best describe its main content or subject. The words should be simple, descriptive, and separated by an underscore. Examples: 'family_portrait', 'beach_sunset', 'mountain_landscape', 'city_skyline', 'birthday_party', 'wedding_ceremony', 'nature_scene', 'food_table'. Only respond with the 2 words separated by underscore, nothing else.`;

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      };

      const response = await model.generateContent([prompt, imagePart]);
      const aiResponse = response.response.text()?.trim();
      
      // Validate the response
      if (aiResponse && this.isValidTwoWordName(aiResponse)) {
        return aiResponse.toLowerCase();
      }

      console.warn('Invalid AI response format:', aiResponse);
      return null;

    } catch (error) {
      console.error('Gemini API error:', error);
      return null;
    }
  }

  /**
   * Generate enhanced fallback name using image metadata
   */
  private generateEnhancedFallbackName(imagePath: string, _baseName: string): string {
    // Try to infer content type from filename
    const basename = path.basename(imagePath, path.extname(imagePath)).toLowerCase();
    
    // Common patterns in filenames that might indicate content
    const patterns = {
      family: /family|group|people|together/,
      portrait: /portrait|selfie|photo|pic/,
      landscape: /landscape|nature|outdoor|scenery/,
      event: /party|celebration|wedding|birthday|holiday/,
      travel: /vacation|trip|travel|beach|mountain|city/,
      food: /food|meal|dinner|lunch|restaurant/
    };

    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(basename)) {
        return `${category}_photo`;
      }
    }

    // Default enhanced fallback
    return `captured_moment`;
  }

  /**
   * Generate hash of image file for caching
   */
  private async generateImageHash(imagePath: string): Promise<string> {
    const stats = fs.statSync(imagePath);
    const hash = crypto.createHash('md5');
    hash.update(`${imagePath}-${stats.size}-${stats.mtime.getTime()}`);
    return hash.digest('hex');
  }

  /**
   * Validate that AI response is a proper 2-word format
   */
  private isValidTwoWordName(name: string): boolean {
    const cleaned = name.trim().toLowerCase();
    // Should be exactly 2 words separated by underscore, letters/numbers only
    return /^[a-z0-9]+_[a-z0-9]+$/.test(cleaned) && cleaned.split('_').length === 2;
  }

  /**
   * Sanitize and format name for filesystem safety
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_') // Replace invalid chars with underscore
      .replace(/_+/g, '_')         // Collapse multiple underscores
      .replace(/^_|_$/g, '')       // Remove leading/trailing underscores
      .substring(0, 30);           // Limit length
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Generate Instagram content (caption and hashtags) for an image
   */
  async generateInstagramContent(imagePath: string, options: InstagramContentOptions = {}): Promise<InstagramContent | null> {
    const { maxRetries = 3, useCache = true } = options;

    // Check cache first
    if (useCache) {
      const imageHash = await this.generateImageHash(imagePath);
      const cacheKey = `instagram-${imageHash}`;
      const cached = this.instagramCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        console.log(`📸 Using cached Instagram content for ${path.basename(imagePath)}`);
        return {
          caption: cached.caption,
          hashtags: cached.hashtags,
          generatedAt: cached.generatedAt
        };
      }
    }

    if (this.genAI) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const content = await this.analyzeImageForInstagram(imagePath);
          if (content) {
            // Cache the result
            if (useCache) {
              const imageHash = await this.generateImageHash(imagePath);
              const cacheKey = `instagram-${imageHash}`;
              this.instagramCache.set(cacheKey, {
                ...content,
                timestamp: Date.now(),
                imageHash
              });
            }

            console.log(`✅ Instagram content generated: ${content.hashtags.length} hashtags`);
            return content;
          }
        } catch (error) {
          if (attempt === maxRetries) {
            console.warn('⚠️ Instagram content generation failed');
          }
        }
      }
    }

    return null;
  }

  private async analyzeImageForInstagram(imagePath: string): Promise<InstagramContent | null> {
    if (!this.genAI) return null;

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeType(imagePath);

      const prompt = `Analyze this image and generate Instagram content:

1. Create an engaging caption (50-100 characters) with relevant emojis
2. Generate 10-15 relevant hashtags (mix of popular and niche)
3. Make it engaging for maximum social media interaction

Return ONLY a JSON object with this structure:
{
  "caption": "Engaging caption with emojis",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", ...]
}

Rules:
- Caption should be catchy and descriptive
- Include 2-3 relevant emojis in caption
- Hashtags should be relevant and trending
- Mix general and specific hashtags
- No # symbol in hashtags (just the words)
- Keep it authentic and engaging`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType
          }
        }
      ]);

      const response = await result.response;
      const text = response.text().trim();

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.caption || !Array.isArray(parsed.hashtags)) {
        throw new Error('Invalid response structure');
      }

      return {
        caption: parsed.caption.trim(),
        hashtags: parsed.hashtags.slice(0, 15), // Limit to 15 hashtags
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Instagram content generation error:', error);
      return null;
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    
    // Clear expired naming cache
    for (const [hash, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.cacheExpiry) {
        this.cache.delete(hash);
      }
    }
    
    // Clear expired Instagram cache
    for (const [hash, cached] of this.instagramCache.entries()) {
      if (now - cached.timestamp > this.cacheExpiry) {
        this.instagramCache.delete(hash);
      }
    }
  }

  /**
   * Clear all cache entries (useful for debugging or ensuring fresh analysis)
   */
  clearAllCache(): void {
    this.cache.clear();
    this.instagramCache.clear();
    console.log('✅ All AI caches cleared (naming + Instagram)');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; oldestEntry: number; newestEntry: number; instagramSize: number } {
    const timestamps = Array.from(this.cache.values()).map(c => c.timestamp);
    return {
      size: this.cache.size,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
      instagramSize: this.instagramCache.size
    };
  }
}

// Lazy singleton pattern - create only when first accessed
let _aiNamingServiceInstance: AiNamingService | null = null;

export const aiNamingService = {
  get instance(): AiNamingService {
    if (!_aiNamingServiceInstance) {
      console.log('🚀 Initializing AiNamingService (lazy initialization)');
      _aiNamingServiceInstance = new AiNamingService();
    }
    return _aiNamingServiceInstance;
  },
  
  // Proxy all methods to the lazy instance
  async generateImageName(imagePath: string, options: NamingOptions = {}) {
    return this.instance.generateImageName(imagePath, options);
  },
  
  async generateInstagramContent(imagePath: string, options: InstagramContentOptions = {}) {
    return this.instance.generateInstagramContent(imagePath, options);
  },
  
  clearExpiredCache() {
    return this.instance.clearExpiredCache();
  },
  
  clearAllCache() {
    return this.instance.clearAllCache();
  },
  
  getCacheStats() {
    return this.instance.getCacheStats();
  }
};
