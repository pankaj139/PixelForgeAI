/**
 * Unit tests for InstagramMcpService
 * 
 * Tests Instagram MCP (Model Context Protocol) service functionality including:
 * - Instagram OAuth authentication flow
 * - Token management and refresh
 * - Direct Instagram posting capabilities
 * - Batch posting with progress tracking
 * - Rate limiting and error handling
 * - User profile management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InstagramMcpService } from '../instagramMcpService.js';
import axios from 'axios';
import FormData from 'form-data';

// Mock dependencies
vi.mock('axios');
vi.mock('form-data');
vi.mock('fs/promises');
vi.mock('sharp');
vi.mock('../../utils/logger.js');

const mockedAxios = vi.mocked(axios);
const mockedFormData = vi.mocked(FormData);

describe('InstagramMcpService', () => {
  let service: InstagramMcpService;
  const mockAuthConfig = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    redirectUri: 'http://localhost:3001/auth/instagram/callback'
  };

  beforeEach(() => {
    service = new InstagramMcpService(mockAuthConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('OAuth Authentication Flow', () => {
    it('should generate correct authorization URL', () => {
      const scopes = ['user_profile', 'user_media'];
      const state = 'test_state_123';
      
      const authUrl = service.generateAuthUrl(scopes, state);
      
      expect(authUrl).toContain('https://api.instagram.com/oauth/authorize');
      expect(authUrl).toContain(`client_id=${mockAuthConfig.clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockAuthConfig.redirectUri)}`);
      expect(authUrl).toContain(`scope=${scopes.join('%2C')}`);
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('response_type=code');
    });

    it('should use default scopes when none provided', () => {
      const authUrl = service.generateAuthUrl();
      
      expect(authUrl).toContain('scope=user_profile%2Cuser_media');
    });

    it('should exchange authorization code for access token', async () => {
      const mockTokenResponse = {
        access_token: 'test_access_token',
        user_id: '123456789',
        expires_in: 3600,
        token_type: 'bearer',
        scope: ['user_profile', 'user_media']
      };

      mockedAxios.post.mockResolvedValue({
        data: mockTokenResponse
      });

      const result = await service.exchangeCodeForToken('test_auth_code');

      expect(result).toEqual(mockTokenResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.instagram.com/oauth/access_token',
        {
          client_id: mockAuthConfig.clientId,
          client_secret: mockAuthConfig.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: mockAuthConfig.redirectUri,
          code: 'test_auth_code'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    });

    it('should handle token exchange errors gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Invalid authorization code'));

      await expect(service.exchangeCodeForToken('invalid_code')).rejects.toThrow(
        'Instagram authentication failed: Invalid authorization code'
      );
    });

    it('should refresh access token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new_access_token',
        expires_in: 7200
      };

      mockedAxios.get.mockResolvedValue({
        data: mockRefreshResponse
      });

      const result = await service.refreshAccessToken('current_token');

      expect(result).toEqual({
        ...mockRefreshResponse,
        token_type: 'bearer',
        scope: ['user_profile', 'user_media']
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/refresh_access_token',
        {
          params: {
            grant_type: 'ig_refresh_token',
            access_token: 'current_token'
          }
        }
      );
    });
  });

  describe('User Profile Management', () => {
    it('should get user info successfully', async () => {
      const mockUserInfo = {
        id: '123456789',
        username: 'test_user',
        account_type: 'PERSONAL',
        media_count: 150
      };

      mockedAxios.get.mockResolvedValue({
        data: mockUserInfo
      });

      const result = await service.getUserInfo('test_access_token');

      expect(result).toEqual(mockUserInfo);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.instagram.com/me',
        {
          params: {
            fields: 'id,username,account_type,media_count',
            access_token: 'test_access_token'
          }
        }
      );
    });

    it('should validate access token', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { id: '123456789', username: 'test_user' }
      });

      const isValid = await service.validateAccessToken('valid_token');

      expect(isValid).toBe(true);
    });

    it('should invalidate expired access token', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Invalid access token'));

      const isValid = await service.validateAccessToken('expired_token');

      expect(isValid).toBe(false);
    });
  });

  describe('Instagram Posting', () => {
    const mockPostOptions = {
      imagePath: '/test/image.jpg',
      caption: 'Test caption with emojis 🎉✨',
      hashtags: ['test', 'pixelforge', 'ai'],
      accessToken: 'test_access_token'
    };

    beforeEach(() => {
      // Mock fs.stat
      const fs = require('fs/promises');
      fs.stat = vi.fn().mockResolvedValue({ size: 2 * 1024 * 1024 }); // 2MB

      // Mock sharp
      const sharp = require('sharp');
      sharp.default = vi.fn().mockReturnValue({
        metadata: vi.fn().mockResolvedValue({
          width: 1080,
          height: 1080,
          format: 'jpeg'
        })
      });
    });

    it('should post to Instagram feed successfully', async () => {
      const mockUploadResponse = { id: 'media_123', status_code: 'FINISHED' };
      const mockPublishResponse = { id: 'post_456', permalink: 'https://instagram.com/p/abc123' };

      // Mock uploadImageToTemporaryUrl
      vi.spyOn(service as any, 'uploadImageToTemporaryUrl').mockResolvedValue('https://temp-url.com/image.jpg');

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockUploadResponse }) // Upload media
        .mockResolvedValueOnce({ data: mockPublishResponse }); // Publish media

      const result = await service.postToInstagram(mockPostOptions);

      expect(result.success).toBe(true);
      expect(result.postId).toBe('post_456');
      expect(result.postUrl).toBe('https://instagram.com/p/abc123');
      expect(result.mediaId).toBe('media_123');
      expect(result.uploadMetrics.fileSize).toBe(2 * 1024 * 1024);
      expect(result.uploadMetrics.dimensions).toEqual({ width: 1080, height: 1080 });
    });

    it('should handle file size limit', async () => {
      const fs = require('fs/promises');
      fs.stat.mockResolvedValue({ size: 10 * 1024 * 1024 }); // 10MB (over limit)

      const result = await service.postToInstagram(mockPostOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Image file too large');
    });

    it('should post to Instagram story', async () => {
      const storyOptions = { ...mockPostOptions, isStory: true };
      
      vi.spyOn(service as any, 'uploadImageToTemporaryUrl').mockResolvedValue('https://temp-url.com/image.jpg');
      
      mockedFormData.prototype.append = vi.fn();
      mockedFormData.prototype.getHeaders = vi.fn().mockReturnValue({
        'content-type': 'multipart/form-data'
      });

      mockedAxios.post.mockResolvedValue({
        data: { id: 'story_789' }
      });

      const result = await service.postToInstagram(storyOptions);

      expect(result.success).toBe(true);
      expect(result.postId).toBe('story_789');
    });

    it('should handle posting errors gracefully', async () => {
      vi.spyOn(service as any, 'uploadImageToTemporaryUrl').mockRejectedValue(
        new Error('CDN upload failed')
      );

      const result = await service.postToInstagram(mockPostOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('CDN upload failed');
    });
  });

  describe('Batch Posting', () => {
    const mockProcessedImages = [
      {
        id: '1',
        originalFileId: 'file1',
        processedPath: '/test/image1.jpg',
        cropArea: { x: 0, y: 0, width: 1080, height: 1080, confidence: 0.9 },
        aspectRatio: { width: 1, height: 1, name: 'Square', orientation: 'square' as const },
        detections: { faces: [], people: [], confidence: 0 },
        processingTime: 1000,
        instagramContent: {
          caption: 'First image caption 📸',
          hashtags: ['first', 'image'],
          generatedAt: '2024-01-01T00:00:00Z',
          wordCount: 3,
          style: 'casual'
        }
      },
      {
        id: '2',
        originalFileId: 'file2',
        processedPath: '/test/image2.jpg',
        cropArea: { x: 0, y: 0, width: 1080, height: 1080, confidence: 0.8 },
        aspectRatio: { width: 1, height: 1, name: 'Square', orientation: 'square' as const },
        detections: { faces: [], people: [], confidence: 0 },
        processingTime: 1200,
        instagramContent: {
          caption: 'Second image caption 🎉',
          hashtags: ['second', 'image'],
          generatedAt: '2024-01-01T00:05:00Z',
          wordCount: 3,
          style: 'casual'
        }
      }
    ];

    const mockBaseOptions = {
      accessToken: 'test_access_token'
    };

    beforeEach(() => {
      // Mock file system and image processing
      const fs = require('fs/promises');
      fs.stat = vi.fn().mockResolvedValue({ size: 2 * 1024 * 1024 });

      const sharp = require('sharp');
      sharp.default = vi.fn().mockReturnValue({
        metadata: vi.fn().mockResolvedValue({
          width: 1080,
          height: 1080,
          format: 'jpeg'
        })
      });

      // Mock successful posting
      vi.spyOn(service, 'postToInstagram').mockResolvedValue({
        success: true,
        postId: 'post_123',
        postUrl: 'https://instagram.com/p/abc123',
        mediaId: 'media_123',
        uploadMetrics: {
          uploadTime: 2000,
          fileSize: 2 * 1024 * 1024,
          dimensions: { width: 1080, height: 1080 },
          processingTime: 3000
        }
      });
    });

    it('should batch post multiple images successfully', async () => {
      let progressCallCount = 0;
      const onProgress = vi.fn((completed: number, total: number) => {
        progressCallCount++;
        expect(completed).toBe(progressCallCount);
        expect(total).toBe(2);
      });

      const results = await service.batchPostToInstagram(
        mockProcessedImages,
        mockBaseOptions,
        onProgress
      );

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(progressCallCount).toBe(2);
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch posting', async () => {
      vi.spyOn(service, 'postToInstagram')
        .mockResolvedValueOnce({
          success: true,
          postId: 'post_123',
          uploadMetrics: {
            uploadTime: 1000,
            fileSize: 2 * 1024 * 1024,
            dimensions: { width: 1080, height: 1080 },
            processingTime: 2000
          }
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Posting failed',
          uploadMetrics: {
            uploadTime: 0,
            fileSize: 0,
            dimensions: { width: 0, height: 0 },
            processingTime: 1000
          }
        });

      const results = await service.batchPostToInstagram(
        mockProcessedImages,
        mockBaseOptions
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Posting failed');
    });

    it('should skip images without Instagram content', async () => {
      const imagesWithoutContent = [
        { ...mockProcessedImages[0], instagramContent: undefined }
      ];

      const results = await service.batchPostToInstagram(
        imagesWithoutContent,
        mockBaseOptions
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('No Instagram content available');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const accessToken = 'test_token';
      
      // Mock the rate limit tracker to be at the limit
      const rateLimitTracker = (service as any).rateLimitTracker;
      rateLimitTracker.set('test_token', {
        count: 200, // At the limit
        resetTime: Date.now() + 3600000 // 1 hour from now
      });

      await expect(service.getUserInfo(accessToken)).rejects.toThrow(
        'Instagram API rate limit exceeded'
      );
    });

    it('should reset rate limits after time window', async () => {
      const accessToken = 'test_token';
      
      // Mock the rate limit tracker to be expired
      const rateLimitTracker = (service as any).rateLimitTracker;
      rateLimitTracker.set('test_token', {
        count: 200,
        resetTime: Date.now() - 1000 // 1 second ago (expired)
      });

      mockedAxios.get.mockResolvedValue({
        data: { id: '123', username: 'test' }
      });

      const result = await service.getUserInfo(accessToken);
      
      expect(result.id).toBe('123');
      
      // Check that rate limit was reset
      const updatedLimit = rateLimitTracker.get('test_token');
      expect(updatedLimit.count).toBe(1); // Should be 1 after the request
    });
  });

  describe('Post Analytics', () => {
    it('should get post insights', async () => {
      const mockInsights = {
        data: [
          { name: 'impressions', values: [{ value: 1250 }] },
          { name: 'reach', values: [{ value: 890 }] },
          { name: 'likes', values: [{ value: 45 }] }
        ]
      };

      mockedAxios.get.mockResolvedValue({
        data: mockInsights
      });

      const result = await service.getPostInsights('post_123', 'test_token');

      expect(result).toEqual(mockInsights);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.instagram.com/post_123/insights',
        {
          params: {
            metric: 'impressions,reach,likes,comments,shares,saves',
            access_token: 'test_token'
          }
        }
      );
    });

    it('should handle insights errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Insights not available'));

      const result = await service.getPostInsights('post_123', 'test_token');

      expect(result).toBeNull();
    });
  });

  describe('Helper Methods', () => {
    it('should format caption with hashtags correctly', () => {
      const caption = 'Test caption';
      const hashtags = ['test', 'hashtag'];
      
      const formatted = (service as any).formatCaption(caption, hashtags);
      
      expect(formatted).toBe('Test caption\n\n#test #hashtag');
    });

    it('should handle hashtags with existing # symbols', () => {
      const caption = 'Test caption';
      const hashtags = ['#test', 'hashtag'];
      
      const formatted = (service as any).formatCaption(caption, hashtags);
      
      expect(formatted).toBe('Test caption\n\n#test #hashtag');
    });

    it('should truncate caption if too long', () => {
      const longCaption = 'a'.repeat(2200);
      const hashtags = ['test'];
      
      const formatted = (service as any).formatCaption(longCaption, hashtags);
      
      expect(formatted).toHaveLength(2200); // Should be truncated
      expect(formatted).toEndWith('...');
    });
  });
});
