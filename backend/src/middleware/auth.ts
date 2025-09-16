/**
 * Authentication Middleware
 * 
 * Purpose: Provides JWT token validation middleware for protecting routes
 * that require user authentication. Integrates with the authentication service
 * to verify tokens and attach user information to requests.
 * 
 * Usage:
 * ```typescript
 * import { authenticateToken } from './middleware/auth';
 * 
 * // Protect a route
 * router.get('/protected', authenticateToken, (req, res) => {
 *   const userId = req.user.userId; // User info available
 * });
 * 
 * // Optional authentication (user info if token present)
 * router.get('/public', optionalAuthentication, (req, res) => {
 *   const userId = req.user?.userId; // Might be undefined
 * });
 * ```
 * 
 * Features:
 * - JWT token validation and parsing
 * - User session verification
 * - Rate limiting integration points
 * - Flexible optional authentication
 * - Comprehensive error handling
 * 
 * Security:
 * - Validates token signature and expiration
 * - Checks user account status
 * - Session-based token validation
 * - Request logging for security monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { JwtPayload } from '../database/schema.js';

// Extend Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        username: string;
        payload: JwtPayload;
      };
    }
  }
}

/**
 * Extract token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Handle case-insensitive "Bearer " prefix and trim whitespace
  const trimmedHeader = authHeader.trim();
  if (trimmedHeader.toLowerCase().startsWith('bearer ')) {
    return trimmedHeader.substring(7).trim();
  }
  
  return null;
}

/**
 * Required authentication middleware
 * Rejects requests without valid authentication
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    
    if (!token) {
      if (typeof res.status === 'function') {
        res.status(401).json({
          success: false,
          message: 'Access token is required',
          errorCode: 'MISSING_TOKEN'
        });
      }
      return;
    }
    
    const tokenResult = await authService.verifyToken(token);
    
    if (!tokenResult.valid) {
      let statusCode = 401;
      let errorCode = 'INVALID_TOKEN';
      
      if (tokenResult.error?.includes('expired')) {
        errorCode = 'EXPIRED_TOKEN';
      }
      
      if (typeof res.status === 'function') {
        res.status(statusCode).json({
          success: false,
          message: tokenResult.error || 'Invalid token',
          errorCode
        });
      }
      return;
    }
    
    if (!tokenResult.userId || !tokenResult.payload) {
      if (typeof res.status === 'function') {
        res.status(401).json({
          success: false,
          message: 'Invalid token payload',
          errorCode: 'INVALID_TOKEN_PAYLOAD'
        });
      }
      return;
    }
    
    // Attach user information to request
    req.user = {
      userId: tokenResult.userId,
      email: tokenResult.payload.email,
      username: tokenResult.payload.username,
      payload: tokenResult.payload
    };
    
    next();
    
  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    if (typeof res.status === 'function') {
      res.status(500).json({
        success: false,
        message: 'Authentication verification failed',
        errorCode: 'AUTH_VERIFICATION_ERROR'
      });
    }
  }
}

/**
 * Optional authentication middleware
 * Continues processing whether authentication succeeds or fails
 * User info is available if token is valid, undefined otherwise
 */
export async function optionalAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    
    if (!token) {
      // No token provided, continue without user info
      next();
      return;
    }
    
    const tokenResult = await authService.verifyToken(token);
    
    if (tokenResult.valid && tokenResult.userId && tokenResult.payload) {
      // Valid token, attach user info
      req.user = {
        userId: tokenResult.userId,
        email: tokenResult.payload.email,
        username: tokenResult.payload.username,
        payload: tokenResult.payload
      };
    }
    
    // Continue regardless of token validation result
    next();
    
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    
    // For optional auth, we don't want to block the request on errors
    next();
  }
}

/**
 * Admin authentication middleware
 * Requires authentication and admin privileges
 * (Placeholder for future admin functionality)
 */
export async function authenticateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  // First, require authentication
  await new Promise<void>((resolve, reject) => {
    authenticateToken(req, res, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  
  // If authentication failed, the response was already sent
  if (res.headersSent) {
    return;
  }
  
  // TODO: Add admin role checking here when implemented
  // For now, treat all authenticated users as potential admins
  // In a real app, you'd check user.role === 'admin' or similar
  
  next();
}

/**
 * Rate limiting integration middleware
 * (Placeholder for future rate limiting implementation)
 */
export function rateLimitByUser(requestsPerMinute: number = 60) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // TODO: Implement rate limiting by user ID or IP
    // For now, just pass through
    
    // Example structure:
    // - Track requests by user ID (if authenticated) or IP address
    // - Use in-memory store or Redis for request counts
    // - Reset counters periodically
    // - Return 429 Too Many Requests if limit exceeded
    
    next();
  };
}

/**
 * Resource ownership middleware
 * Verifies that the authenticated user owns the requested resource
 */
export function requireResourceOwnership(resourceType: 'job' | 'file' | 'image') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          errorCode: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }
      
      const resourceId = req.params.id || req.params.jobId || req.params.fileId || req.params.imageId;
      
      if (!resourceId) {
        res.status(400).json({
          success: false,
          message: 'Resource ID is required',
          errorCode: 'MISSING_RESOURCE_ID'
        });
        return;
      }
      
      const db = (await import('../database/connection.js')).getDatabase();
      
      let ownsResource = false;
      
      switch (resourceType) {
        case 'job':
          ownsResource = await db.userOwnsJob(req.user.userId, resourceId);
          break;
        case 'file':
          // TODO: Implement file ownership check
          // Would need to check file -> job -> user relationship
          ownsResource = true; // Placeholder
          break;
        case 'image':
          // TODO: Implement image ownership check
          // Would need to check image -> job -> user relationship
          ownsResource = true; // Placeholder
          break;
      }
      
      if (!ownsResource) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not own this resource',
          errorCode: 'RESOURCE_ACCESS_DENIED'
        });
        return;
      }
      
      next();
      
    } catch (error) {
      console.error('Resource ownership middleware error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to verify resource ownership',
        errorCode: 'OWNERSHIP_VERIFICATION_ERROR'
      });
    }
  };
}

/**
 * CORS middleware for authentication endpoints
 */
export function corsForAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow credentials for authentication
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Allow authentication headers
  const allowedHeaders = [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-User-Agent'
  ];
  
  res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
  
  // Allow authentication methods
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}
