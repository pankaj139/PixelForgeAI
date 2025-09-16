/**
 * Forgot Password API Tests
 * 
 * Purpose: Comprehensive test suite for the forgot password API endpoints
 * covering request validation, email sending, error handling, and
 * security considerations.
 * 
 * Test Coverage:
 * - POST /api/auth/forgot-password endpoint
 * - POST /api/auth/reset-password endpoint
 * - Input validation and sanitization
 * - Email service integration
 * - Database operations
 * - Error handling and edge cases
 * - Security considerations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../auth.js';
import { getDatabase } from '../../database/connection.js';
import { getEmailService } from '../../services/emailService.js';

// Mock the email service
vi.mock('../../services/emailService.js', () => ({
  getEmailService: vi.fn(() => ({
    sendPasswordResetEmail: vi.fn()
  }))
}));

// Mock the database
vi.mock('../../database/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    getUserByEmail: vi.fn(),
    createPasswordResetToken: vi.fn(),
    getPasswordResetTokenByToken: vi.fn(),
    markPasswordResetTokenAsUsed: vi.fn(),
    updateUser: vi.fn(),
    deactivateAllUserSessions: vi.fn()
  }))
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Forgot Password API', () => {
  let mockDb: any;
  let mockEmailService: any;

  beforeEach(() => {
    mockDb = getDatabase();
    mockEmailService = getEmailService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return success for valid email', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      mockDb.getUserByEmail.mockResolvedValue(user);
      mockDb.createPasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

      expect(mockDb.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockDb.createPasswordResetToken).toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        'Test'
      );
    });

    it('should return success even for non-existent email (security)', async () => {
      mockDb.getUserByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

      expect(mockDb.getUserByEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(mockDb.createPasswordResetToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return success even for inactive user (security)', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: false
      };

      mockDb.getUserByEmail.mockResolvedValue(user);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

      expect(mockDb.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockDb.createPasswordResetToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email format');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email format');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.getUserByEmail.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to process password reset request due to server error'
      });
    });

    it('should handle email service errors gracefully', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      mockDb.getUserByEmail.mockResolvedValue(user);
      mockDb.createPasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue({
        success: false,
        error: 'Email service error'
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      // Should still return success even if email fails
      expect(response.body).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password successfully with valid token', async () => {
      const resetToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        isUsed: false
      };

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      mockDb.getPasswordResetTokenByToken.mockResolvedValue(resetToken);
      mockDb.getUserById.mockResolvedValue(user);
      mockDb.updateUser.mockResolvedValue(undefined);
      mockDb.markPasswordResetTokenAsUsed.mockResolvedValue(undefined);
      mockDb.deactivateAllUserSessions.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'NewPassword123'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.'
      });

      expect(mockDb.getPasswordResetTokenByToken).toHaveBeenCalledWith('valid-token');
      expect(mockDb.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockDb.updateUser).toHaveBeenCalledWith('user-123', {
        passwordHash: expect.any(String),
        updatedAt: expect.any(Date)
      });
      expect(mockDb.markPasswordResetTokenAsUsed).toHaveBeenCalledWith('token-123');
      expect(mockDb.deactivateAllUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('should return 400 for invalid token', async () => {
      mockDb.getPasswordResetTokenByToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid or expired reset token'
      });
    });

    it('should return 400 for already used token', async () => {
      const resetToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'used-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        isUsed: true
      };

      mockDb.getPasswordResetTokenByToken.mockResolvedValue(resetToken);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'used-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Reset token has already been used'
      });
    });

    it('should return 400 for expired token', async () => {
      const resetToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'expired-token',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        isUsed: false
      };

      mockDb.getPasswordResetTokenByToken.mockResolvedValue(resetToken);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Reset token has expired'
      });
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'weak'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid reset data');
      expect(response.body.errors).toContain('newPassword: Password must be at least 8 characters');
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid reset data');
      expect(response.body.errors).toContain('token: Reset token is required');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid reset data');
      expect(response.body.errors).toContain('newPassword: New password is required');
    });

    it('should return 400 for inactive user', async () => {
      const resetToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        isUsed: false
      };

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: false
      };

      mockDb.getPasswordResetTokenByToken.mockResolvedValue(resetToken);
      mockDb.getUserById.mockResolvedValue(user);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'User not found or inactive'
      });
    });

    it('should handle database errors gracefully', async () => {
      mockDb.getPasswordResetTokenByToken.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'NewPassword123'
        })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to reset password due to server error'
      });
    });
  });
});
