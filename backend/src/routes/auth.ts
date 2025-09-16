/**
 * Authentication Routes
 * 
 * Purpose: Provides REST API endpoints for user authentication including
 * registration, login, logout, and profile management with comprehensive
 * security validation and error handling.
 * 
 * Usage:
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login user
 * POST /api/auth/logout - Logout current user
 * POST /api/auth/logout-all - Logout from all devices
 * GET /api/auth/me - Get current user profile
 * PUT /api/auth/change-password - Change user password
 * 
 * Security Features:
 * - Input validation with Zod schemas
 * - Password strength requirements
 * - JWT token management
 * - Session tracking with device info
 * - Rate limiting integration points
 * 
 * Returns: Standardized JSON responses with success/error status
 */

import express, { Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { validateUserRegistration, validateUserLogin, validateForgotPassword, validateResetPassword } from '../database/schema.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to get client info
const getClientInfo = (req: Request) => ({
  userAgent: req.get('User-Agent'),
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown'
});

/**
 * Register new user
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { userAgent, ipAddress } = getClientInfo(req);
    
    // Validate registration data
    const registrationData = validateUserRegistration(req.body);
    
    const result = await authService.registerUser(registrationData, userAgent, ipAddress);
    
    if (result.success) {
      return res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          token: result.token
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors
      });
    }
    
  } catch (error: any) {
    console.error('Registration endpoint error:', error);
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration data',
        errors: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Registration failed due to server error'
    });
  }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { userAgent, ipAddress } = getClientInfo(req);
    
    // Validate login data
    const loginData = validateUserLogin(req.body);
    
    const result = await authService.loginUser(loginData, userAgent, ipAddress);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          token: result.token
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        message: result.message,
        errors: result.errors
      });
    }
    
  } catch (error: any) {
    console.error('Login endpoint error:', error);
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid login data',
        errors: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Login failed due to server error'
    });
  }
});

/**
 * Logout current user
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    
    const result = await authService.logoutUser(token);
    
    return res.json({
      success: result,
      message: result ? 'Logout successful' : 'Logout failed'
    });
    
  } catch (error) {
    console.error('Logout endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Logout failed due to server error'
    });
  }
});

/**
 * Logout from all devices
 * POST /api/auth/logout-all
 */
router.post('/logout-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const result = await authService.logoutAllDevices(userId);
    
    return res.json({
      success: result.success,
      message: result.message
    });
    
  } catch (error) {
    console.error('Logout all endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Logout from all devices failed due to server error'
    });
  }
});

/**
 * Get current user profile
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    
    const user = await authService.getCurrentUser(token);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.json({
      success: true,
      data: {
        user
      }
    });
    
  } catch (error) {
    console.error('Get current user endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

/**
 * Change user password
 * PUT /api/auth/change-password
 */
router.put('/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('Change password endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to change password due to server error'
    });
  }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { firstName, lastName, preferences } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }
    
    const db = (await import('../database/connection.js')).getDatabase();
    
    const updateData: any = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      updatedAt: new Date()
    };
    
    if (preferences) {
      updateData.preferences = preferences;
    }
    
    await db.updateUser(userId, updateData);
    
    const updatedUser = await db.getUserById(userId);
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userWithoutPassword
      }
    });
    
  } catch (error) {
    console.error('Update profile endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile due to server error'
    });
  }
});

/**
 * Get user statistics (for dashboard)
 * GET /api/auth/stats
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const db = (await import('../database/connection.js')).getDatabase();
    
    const totalJobs = await db.getUserJobCount(userId);
    const completedJobs = await db.getUserCompletedJobCount(userId);
    
    return res.json({
      success: true,
      data: {
        stats: {
          totalJobs,
          completedJobs,
          successRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
          processingJobs: 0,
          failedJobs: 0,
          joinedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        },
        recentJobs: []
      }
    });
    
  } catch (error) {
    console.error('Get user stats endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
});

/**
 * Forgot password - send reset email
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    // Validate email format
    const forgotPasswordData = validateForgotPassword(req.body);
    
    const result = await authService.forgotPassword(forgotPasswordData.email);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to process password reset request'
      });
    }
    
  } catch (error: any) {
    console.error('Forgot password endpoint error:', error);
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errors: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to process password reset request due to server error'
    });
  }
});

/**
 * Reset password using token
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    // Validate input data
    const resetPasswordData = validateResetPassword(req.body);
    
    const result = await authService.resetPassword(
      resetPasswordData.token, 
      resetPasswordData.newPassword
    );
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to reset password'
      });
    }
    
  } catch (error: any) {
    console.error('Reset password endpoint error:', error);
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset data',
        errors: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password due to server error'
    });
  }
});

export default router;
