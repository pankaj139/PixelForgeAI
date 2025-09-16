/**
 * Authentication Service
 * 
 * Purpose: Handles user authentication, password hashing, JWT token generation,
 * and session management for secure user access to the image processing platform.
 * 
 * Usage:
 * ```typescript
 * const authService = new AuthService();
 * const hashedPassword = await authService.hashPassword('userPassword');
 * const token = await authService.generateToken(userId);
 * const userId = await authService.verifyToken(token);
 * ```
 * 
 * Key Features:
 * - Secure password hashing with bcrypt
 * - JWT token generation and verification
 * - User registration and login validation
 * - Session management and cleanup
 * - Password strength validation
 * 
 * Security:
 * - Uses bcrypt with salt rounds for password hashing
 * - JWT tokens with configurable expiration
 * - Secure session token validation
 * - Rate limiting integration points
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection';
import { getEmailService } from './emailService.js';
import { 
  validateUserRegistration, 
  validateUserLogin,
  validateForgotPassword,
  validateResetPassword,
  type User, 
  type UserRegistration, 
  type UserLogin,
  type PasswordResetToken,
  type JwtPayload,
  type UserSession
} from '../database/schema';

interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  error?: string;
  errors?: string[];
}

interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  payload?: JwtPayload;
  error?: string;
}

export class AuthService {
  private readonly saltRounds = 12;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string = '7d'; // Token expires in 7 days

  constructor() {
    if (!process.env['JWT_SECRET']) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('JWT_SECRET environment variable is required');
      }
      this.jwtSecret = 'your-super-secret-jwt-key-change-in-production';
      console.warn('⚠️  WARNING: JWT_SECRET not set, using default key!');
    } else {
      this.jwtSecret = process.env['JWT_SECRET'];
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Compare password against hash (alias for verifyPassword for test compatibility)
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.verifyPassword(password, hash);
  }

  /**
   * Generate JWT token for user
   */
  async generateToken(userId: string, email: string, username: string): Promise<string> {
    const payload = {
      userId,
      email,
      username
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn } as jwt.SignOptions);
  }

  /**
   * Verify JWT token and return payload
   */
  async verifyToken(token: string): Promise<TokenValidationResult> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      
      // Additional validation - check if user still exists and is active
      const db = getDatabase();
      const user = await db.getUserById(payload.userId);
      
      if (!user || !user.isActive) {
        return {
          valid: false,
          error: 'User account is inactive or does not exist'
        };
      }

      return {
        valid: true,
        userId: payload.userId,
        payload
      };
    } catch (error) {
      let errorMessage = 'Invalid token';
      
      if (error && typeof error === 'object' && 'name' in error) {
        if (error.name === 'TokenExpiredError') {
          errorMessage = 'Token has expired';
        } else if (error.name === 'JsonWebTokenError') {
          errorMessage = 'Invalid token format';
        }
      }

      return {
        valid: false,
        error: errorMessage
      };
    }
  }

  /**
   * Register new user
   */
  async registerUser(registrationData: UserRegistration, userAgent?: string, ipAddress?: string): Promise<AuthResult> {
    try {
      // Validate input data
      const validatedData = validateUserRegistration(registrationData);
      
      const db = getDatabase();
      
      // Check if email is already taken
      if (await db.isEmailTaken(validatedData.email)) {
        return {
          success: false,
          error: 'Email already registered'
        };
      }

      // Check if username is already taken
      if (await db.isUsernameTaken(validatedData.username)) {
        return {
          success: false,
          error: 'Username already taken'
        };
      }

      // Hash password
      const passwordHash = await this.hashPassword(validatedData.password);

      // Create user
      const userId = uuidv4();
      const now = new Date();
      
      const newUser: User = {
        id: userId,
        email: validatedData.email,
        username: validatedData.username,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        emailVerified: false, // In a real app, you'd send verification email
        preferences: {
          enableEmailNotifications: true,
          autoEnableFaceDetection: true,
          autoEnableAiNaming: true,
          theme: 'light'
        }
      };

      await db.createUser(newUser);

      // Generate token
      const token = await this.generateToken(userId, validatedData.email, validatedData.username);

      // Create user session
      await this.createUserSession(userId, token, userAgent, ipAddress);

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = newUser;

      return {
        success: true,
        user: userWithoutPassword as User,
        token,
        message: 'User registered successfully'
      };

    } catch (error) {
      console.error('User registration error:', error);
      
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  /**
   * Login user
   */
  async loginUser(loginData: UserLogin, userAgent?: string, ipAddress?: string): Promise<AuthResult> {
    try {
      // Validate input data
      const validatedData = validateUserLogin(loginData);
      
      const db = getDatabase();
      
      // Find user by email or username
      const user = await db.getUserByEmailOrUsername(validatedData.emailOrUsername);
      
      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          error: 'Account is inactive'
        };
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(validatedData.password, user.passwordHash);
      
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Update last login
      await db.updateUser(user.id, { 
        lastLoginAt: new Date() 
      });

      // Generate token
      const token = await this.generateToken(user.id, user.email, user.username);

      // Create user session
      await this.createUserSession(user.id, token, userAgent, ipAddress);

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword as User,
        token,
        message: 'Login successful'
      };

    } catch (error) {
      console.error('User login error:', error);
      
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  /**
   * Logout user (invalidate session)
   */
  async logoutUser(token: string): Promise<boolean> {
    try {
      const db = getDatabase();
      const session = await db.getUserSessionByToken(token);
      
      if (session) {
        await db.deactivateUserSession(session.id);
      }

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Logout user from all devices
   */
  async logoutAllDevices(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const db = getDatabase();
      await db.deactivateAllUserSessions(userId);

      return {
        success: true,
        message: 'Logged out from all devices'
      };
    } catch (error) {
      console.error('Logout all devices error:', error);
      return {
        success: false,
        message: 'Failed to logout from all devices'
      };
    }
  }

  /**
   * Create user session
   */
  private async createUserSession(userId: string, token: string, userAgent?: string, ipAddress?: string): Promise<void> {
    const db = getDatabase();
    const sessionId = uuidv4();
    
    const session: UserSession = {
      id: sessionId,
      userId,
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days
      isActive: true,
      userAgent,
      ipAddress
    };

    await db.createUserSession(session);
  }

  /**
   * Get current user from token
   */
  async getCurrentUser(token: string): Promise<User | null> {
    const tokenResult = await this.verifyToken(token);
    
    if (!tokenResult.valid || !tokenResult.userId) {
      return null;
    }

    const db = getDatabase();
    const user = await db.getUserById(tokenResult.userId);
    
    if (!user || !user.isActive) {
      return null;
    }

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const db = getDatabase();
      const user = await db.getUserById(userId);
      
      if (!user || !user.isActive) {
        return null;
      }

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    totalJobs: number;
    completedJobs: number;
    processingJobs: number;
    failedJobs: number;
    joinedAt: Date;
    lastLoginAt: Date | null;
  }> {
    try {
      const db = getDatabase();
      const user = await db.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const jobs = await db.getJobsByUserId(userId);
      
      const stats = {
        totalJobs: jobs.length,
        completedJobs: jobs.filter(job => job.status === 'completed').length,
        processingJobs: jobs.filter(job => job.status === 'processing').length,
        failedJobs: jobs.filter(job => job.status === 'failed').length,
        joinedAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      };

      return stats;
    } catch (error) {
      console.error('Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const db = getDatabase();
      const user = await db.getUserById(userId);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.passwordHash);
      
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect'
        };
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        return {
          success: false,
          message: 'New password must be at least 8 characters long'
        };
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await db.updateUser(userId, {
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      });

      // Logout from all other devices for security
      await this.logoutAllDevices(userId);

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        message: 'Failed to change password'
      };
    }
  }

  /**
   * Initiate forgot password process
   * 
   * @param email - User's email address
   * @returns Promise<AuthResult>
   */
  async forgotPassword(email: string): Promise<AuthResult> {
    try {
      // Validate email format
      const validatedData = validateForgotPassword({ email });
      
      const db = getDatabase();
      const emailService = getEmailService();
      
      // Check if user exists
      const user = await db.getUserByEmail(validatedData.email);
      
      if (!user) {
        // For security, don't reveal if email exists or not
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      }

      if (!user.isActive) {
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      }

      // Generate reset token
      const resetToken = uuidv4();
      const tokenId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

      // Create password reset token
      const passwordResetToken: PasswordResetToken = {
        id: tokenId,
        userId: user.id,
        token: resetToken,
        createdAt: now,
        expiresAt,
        isUsed: false
      };

      // Save token to database
      await db.createPasswordResetToken(passwordResetToken);

      // Send password reset email
      const emailResult = await emailService.sendPasswordResetEmail(
        user.email, 
        resetToken, 
        user.firstName
      );

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Don't fail the request if email fails, but log it
      }

      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      };

    } catch (error) {
      console.error('Forgot password error:', error);
      
      return {
        success: false,
        error: 'Failed to process password reset request'
      };
    }
  }

  /**
   * Reset password using token
   * 
   * @param token - Password reset token
   * @param newPassword - New password
   * @returns Promise<AuthResult>
   */
  async resetPassword(token: string, newPassword: string): Promise<AuthResult> {
    try {
      // Validate input data
      const validatedData = validateResetPassword({ token, newPassword });
      
      const db = getDatabase();
      
      // Find valid reset token
      const resetToken = await db.getPasswordResetTokenByToken(validatedData.token);
      
      if (!resetToken) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        };
      }

      // Check if token is already used
      if (resetToken.isUsed) {
        return {
          success: false,
          error: 'Reset token has already been used'
        };
      }

      // Check if token is expired
      if (new Date() >= new Date(resetToken.expiresAt)) {
        return {
          success: false,
          error: 'Reset token has expired'
        };
      }

      // Get user
      const user = await db.getUserById(resetToken.userId);
      
      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'User not found or inactive'
        };
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(validatedData.newPassword);

      // Update user password
      await db.updateUser(user.id, {
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      });

      // Mark token as used
      await db.markPasswordResetTokenAsUsed(resetToken.id);

      // Invalidate all user sessions for security
      await db.deactivateAllUserSessions(user.id);

      return {
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.'
      };

    } catch (error) {
      console.error('Reset password error:', error);
      
      return {
        success: false,
        error: 'Failed to reset password'
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
