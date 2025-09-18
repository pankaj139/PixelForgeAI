/**
 * Instagram Authentication Routes
 * 
 * This module provides REST API endpoints for Instagram OAuth authentication flow,
 * allowing users to connect their Instagram accounts for direct posting capabilities.
 * 
 * Features:
 * - Instagram OAuth authorization URL generation
 * - Authorization code exchange for access tokens
 * - Token refresh functionality
 * - User profile information retrieval
 * - Token validation and status checking
 * 
 * Authentication Flow:
 * 1. Client requests authorization URL from /api/instagram/auth/url
 * 2. User visits Instagram authorization page
 * 3. Instagram redirects to callback with authorization code
 * 4. Client exchanges code for access token via /api/instagram/auth/token
 * 5. Access token is used for posting and other operations
 * 
 * Usage:
 * ```typescript
 * // Get authorization URL
 * GET /api/instagram/auth/url
 * 
 * // Exchange code for token
 * POST /api/instagram/auth/token
 * { "code": "instagram_auth_code" }
 * 
 * // Refresh token
 * POST /api/instagram/auth/refresh
 * { "accessToken": "current_access_token" }
 * ```
 * 
 * Returns: Complete Instagram authentication data with user profile information
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { instagramLoginService } from '../services/instagramLoginService.js';
import { logger } from '../utils/logger.js';
import { authenticateToken as authMiddleware } from '../middleware/auth.js';

const router = Router();

// Input validation schemas
const ExchangeTokenSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional()
});

const RefreshTokenSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required')
});

const ValidateTokenSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required')
});

/**
 * Generate Instagram authorization URL
 * 
 * GET /api/instagram/auth/url
 * 
 * Query parameters:
 * - scopes: Comma-separated list of Instagram scopes (optional)
 * - state: Custom state parameter for CSRF protection (optional)
 * 
 * Returns authorization URL that users should visit to grant permissions
 */
router.get('/auth/url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { scopes, state } = req.query;
    
    // Parse scopes if provided (Instagram Graph API scopes)
    const scopeArray = typeof scopes === 'string' 
      ? scopes.split(',').map(s => s.trim())
      : ['instagram_business_basic', 'instagram_business_content_publish'];
    
    // Generate state parameter if not provided (CSRF protection)
    const stateParam = typeof state === 'string' ? state : `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const authUrl = instagramLoginService.generateAuthUrl(scopeArray, stateParam);
    
    logger.info('Instagram authorization URL generated', {
      userId: (req as any).user?.id,
      scopes: scopeArray,
      state: stateParam
    });

    res.json({
      success: true,
      data: {
        authorizationUrl: authUrl,
        state: stateParam,
        scopes: scopeArray,
        instructions: [
          'Visit the authorization URL to grant Instagram permissions',
          'You will be redirected back with an authorization code',
          'Use the code to exchange for an access token via /api/instagram/auth/token'
        ]
      }
    });

  } catch (error) {
    logger.error('Instagram auth URL generation failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate Instagram authorization URL',
      message: 'Please check your Instagram app configuration'
    });
  }
});

/**
 * Exchange authorization code for access token
 * 
 * POST /api/instagram/auth/token
 * 
 * Request body:
 * {
 *   "code": "instagram_authorization_code",
 *   "state": "optional_state_parameter"
 * }
 * 
 * Returns Instagram access token and user profile information
 */
router.post('/auth/token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validatedData = ExchangeTokenSchema.parse(req.body);
    
    logger.info('Instagram token exchange initiated', {
      userId: (req as any).user?.id,
      hasCode: !!validatedData.code,
      state: validatedData.state
    });

    // Exchange authorization code for access token
    const tokenResponse = await instagramLoginService.exchangeCodeForToken(validatedData.code);
    
    // Get Instagram user information
    const userInfo = await instagramLoginService.getUserInfo(tokenResponse.access_token);
    
    // Verify it's a Business or Creator account
    if (userInfo.account_type !== 'BUSINESS' && userInfo.account_type !== 'CREATOR') {
      throw new Error('Instagram account must be Business or Creator type. Personal accounts are no longer supported.');
    }
    
    logger.info('Instagram authentication successful', {
      userId: (req as any).user?.id,
      instagramUserId: userInfo.id,
      instagramUsername: userInfo.username,
      accountType: userInfo.account_type
    });

    res.json({
      success: true,
      data: {
        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
        userId: tokenResponse.user_id,
        expiresIn: tokenResponse.expires_in,
        userProfile: {
          id: userInfo.id,
          username: userInfo.username,
          accountType: userInfo.account_type,
          mediaCount: userInfo.media_count,
          followersCount: userInfo.followers_count,
          followsCount: userInfo.follows_count
        },
        connectedAt: new Date().toISOString(),
        instructions: [
          'Store the access token securely',
          'Use the token for posting images to Instagram',
          'Refresh the token periodically to maintain access'
        ]
      }
    });

  } catch (error) {
    logger.error('Instagram token exchange failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    res.status(400).json({
      success: false,
      error: 'Instagram authentication failed',
      message: error instanceof Error ? error.message : 'Token exchange failed',
      suggestions: [
        'Verify the authorization code is correct and not expired',
        'Check that your Instagram app configuration is valid',
        'Ensure the redirect URI matches your app settings'
      ]
    });
  }
});

/**
 * Refresh Instagram access token
 * 
 * POST /api/instagram/auth/refresh
 * 
 * Request body:
 * {
 *   "accessToken": "current_instagram_access_token"
 * }
 * 
 * Returns new access token with extended validity
 */
router.post('/auth/refresh', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validatedData = RefreshTokenSchema.parse(req.body);
    
    logger.info('Instagram token refresh initiated', {
      userId: (req as any).user?.id
    });

    // Refresh the access token
    const refreshedToken = await instagramLoginService.refreshAccessToken(validatedData.accessToken);
    
    // Verify the new token works
    const userInfo = await instagramLoginService.getUserInfo(refreshedToken.access_token);
    
    logger.info('Instagram token refresh successful', {
      userId: (req as any).user?.id,
      instagramUserId: userInfo.id,
      instagramUsername: userInfo.username
    });

    res.json({
      success: true,
      data: {
        accessToken: refreshedToken.access_token,
        tokenType: refreshedToken.token_type,
        expiresIn: refreshedToken.expires_in,
        refreshedAt: new Date().toISOString(),
        userProfile: {
          id: userInfo.id,
          username: userInfo.username,
          accountType: userInfo.account_type,
          mediaCount: userInfo.media_count
        }
      }
    });

  } catch (error) {
    logger.error('Instagram token refresh failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    res.status(400).json({
      success: false,
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Unable to refresh Instagram token',
      suggestions: [
        'The current token may be expired or invalid',
        'Re-authenticate with Instagram to get a new token',
        'Check your Instagram app permissions'
      ]
    });
  }
});

/**
 * Validate Instagram access token
 * 
 * POST /api/instagram/auth/validate
 * 
 * Request body:
 * {
 *   "accessToken": "instagram_access_token_to_validate"
 * }
 * 
 * Returns token validation status and user information if valid
 */
router.post('/auth/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validatedData = ValidateTokenSchema.parse(req.body);
    
    // Validate token by attempting to get user info
    const isValid = await instagramLoginService.validateAccessToken(validatedData.accessToken);
    
    if (isValid) {
      const userInfo = await instagramLoginService.getUserInfo(validatedData.accessToken);
      
      logger.info('Instagram token validation successful', {
        userId: (req as any).user?.id,
        instagramUserId: userInfo.id,
        instagramUsername: userInfo.username
      });

      res.json({
        success: true,
        data: {
          valid: true,
          userProfile: {
            id: userInfo.id,
            username: userInfo.username,
            accountType: userInfo.account_type,
            mediaCount: userInfo.media_count,
            followersCount: userInfo.followers_count,
            followsCount: userInfo.follows_count
          },
          validatedAt: new Date().toISOString()
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          valid: false,
          reason: 'Token is expired or invalid',
          suggestions: [
            'Re-authenticate with Instagram to get a new token',
            'Check if the token has been revoked',
            'Verify your Instagram app configuration'
          ]
        }
      });
    }

  } catch (error) {
    logger.error('Instagram token validation failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Token validation failed',
      message: 'Unable to validate Instagram access token'
    });
  }
});

/**
 * Get Instagram user profile information
 * 
 * GET /api/instagram/profile
 * 
 * Headers:
 * Authorization: Bearer <instagram_access_token>
 * 
 * Returns detailed Instagram user profile information
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Instagram access token required',
        message: 'Provide Instagram access token in Authorization header'
      });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    
    // Get user profile information
    const userInfo = await instagramLoginService.getUserInfo(accessToken);
    
    logger.info('Instagram profile retrieved', {
      userId: (req as any).user?.id,
      instagramUserId: userInfo.id,
      instagramUsername: userInfo.username
    });

  return res.json({
      success: true,
      data: {
        profile: {
          id: userInfo.id,
          username: userInfo.username,
          accountType: userInfo.account_type,
          mediaCount: userInfo.media_count,
          followersCount: userInfo.followers_count,
          followsCount: userInfo.follows_count
        },
        capabilities: {
          canPost: true,
          canPostStories: userInfo.account_type === 'BUSINESS',
          canSchedulePosts: false, // Not supported in basic display API
          canGetInsights: userInfo.account_type === 'BUSINESS'
        },
        retrievedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Instagram profile retrieval failed', { 
      error: error instanceof Error ? error.message : String(error),
      userId: (req as any).user?.id
    });

  return res.status(400).json({
      success: false,
      error: 'Failed to retrieve Instagram profile',
      message: error instanceof Error ? error.message : 'Profile retrieval failed',
      suggestions: [
        'Verify your Instagram access token is valid',
        'Check if the token has proper permissions',
        'Re-authenticate if the token is expired'
      ]
    });
  }
});

/**
 * Instagram OAuth callback endpoint (for redirect handling)
 * 
 * GET /api/instagram/auth/callback
 * 
 * Query parameters:
 * - code: Authorization code from Instagram
 * - state: State parameter for CSRF protection
 * - error: Error code if authorization failed
 * 
 * This endpoint is typically called by Instagram after user authorization
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_reason, error_description } = req.query;

    if (error) {
      logger.warn('Instagram authorization denied', {
        error,
        errorReason: error_reason,
        errorDescription: error_description,
        state
      });

      // Redirect to frontend with error
      const errorParams = new URLSearchParams({
        error: error as string,
        error_reason: (error_reason as string) || 'Authorization denied',
        error_description: (error_description as string) || 'User denied Instagram access'
      });

      return res.redirect(`${process.env.FRONTEND_URL}/instagram/callback?${errorParams}`);
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code missing',
        message: 'Instagram did not provide an authorization code'
      });
    }

    logger.info('Instagram OAuth callback received', {
      hasCode: !!code,
      state
    });

    // Redirect to frontend with the authorization code
    const successParams = new URLSearchParams({
      code: code as string,
      ...(state && { state: state as string })
    });

    res.redirect(`${process.env.FRONTEND_URL}/instagram/callback?${successParams}`);

  } catch (error) {
    logger.error('Instagram OAuth callback failed', { 
      error: error instanceof Error ? error.message : String(error)
    });

    const errorParams = new URLSearchParams({
      error: 'callback_error',
      error_description: 'Failed to process Instagram OAuth callback'
    });

    res.redirect(`${process.env.FRONTEND_URL}/instagram/callback?${errorParams}`);
  }
});

export default router;
