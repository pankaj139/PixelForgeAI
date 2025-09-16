/**
 * Forgot Password Integration Tests
 * 
 * Purpose: End-to-end integration tests for the complete forgot password flow
 * covering the entire process from email submission to password reset.
 * 
 * Test Coverage:
 * - Complete forgot password flow
 * - Email service integration
 * - Database operations
 * - Token generation and validation
 * - Password reset completion
 * - Error handling throughout the flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth.js';
import { getDatabase } from '../database/connection.js';
import { getEmailService } from '../services/emailService.js';

// Mock the email service
vi.mock('../services/emailService.js', () => ({
  getEmailService: vi.fn(() => ({
    sendPasswordResetEmail: vi.fn()
  }))
}));

// Mock the database
vi.mock('../database/connection.js', () => ({
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

describe('Forgot Password Integration Flow', () => {
  let mockDb: any;
  let mockEmailService: any;
  let resetToken: string;

  beforeEach(() => {
    mockDb = getDatabase();
    mockEmailService = getEmailService();
    vi.clearAllMocks();
    
    // Generate a mock reset token
    resetToken = 'test-reset-token-' + Date.now();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Forgot Password Flow', () => {
    it('should complete the entire forgot password flow successfully', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        passwordHash: 'old-hash'
      };

      const passwordResetToken = {
        id: 'token-123',
        userId: 'user-123',
        token: resetToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        isUsed: false
      };

      // Step 1: User requests password reset
      mockDb.getUserByEmail.mockResolvedValue(user);
      mockDb.createPasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      });

      const forgotPasswordResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(forgotPasswordResponse.body).toEqual({
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

      // Step 2: User clicks reset link and submits new password
      mockDb.getPasswordResetTokenByToken.mockResolvedValue(passwordResetToken);
      mockDb.getUserById.mockResolvedValue(user);
      mockDb.updateUser.mockResolvedValue(undefined);
      mockDb.markPasswordResetTokenAsUsed.mockResolvedValue(undefined);
      mockDb.deactivateAllUserSessions.mockResolvedValue(undefined);

      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123'
        })
        .expect(200);

      expect(resetPasswordResponse.body).toEqual({
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.'
      });

      expect(mockDb.getPasswordResetTokenByToken).toHaveBeenCalledWith(resetToken);
      expect(mockDb.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockDb.updateUser).toHaveBeenCalledWith('user-123', {
        passwordHash: expect.any(String),
        updatedAt: expect.any(Date)
      });
      expect(mockDb.markPasswordResetTokenAsUsed).toHaveBeenCalledWith('token-123');
      expect(mockDb.deactivateAllUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('should handle invalid token in reset step', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      // Step 1: User requests password reset (successful)
      mockDb.getUserByEmail.mockResolvedValue(user);
      mockDb.createPasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      // Step 2: User tries to reset with invalid token
      mockDb.getPasswordResetTokenByToken.mockResolvedValue(null);

      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(resetPasswordResponse.body).toEqual({
        success: false,
        message: 'Invalid or expired reset token'
      });
    });

    it('should handle expired token in reset step', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      // Step 1: User requests password reset (successful)
      mockDb.getUserByEmail.mockResolvedValue(user);
      mockDb.createPasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      // Step 2: User tries to reset with expired token
      const expiredToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'expired-token',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        isUsed: false
      };

      mockDb.getPasswordResetTokenByToken.mockResolvedValue(expiredToken);

      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(resetPasswordResponse.body).toEqual({
        success: false,
        message: 'Reset token has expired'
      });
    });

    it('should handle already used token in reset step', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      // Step 1: User requests password reset (successful)
      mockDb.getUserByEmail.mockResolvedValue(user);
      mockDb.createPasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      // Step 2: User tries to reset with already used token
      const usedToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'used-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        isUsed: true
      };

      mockDb.getPasswordResetTokenByToken.mockResolvedValue(usedToken);

      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'used-token',
          newPassword: 'NewPassword123'
        })
        .expect(400);

      expect(resetPasswordResponse.body).toEqual({
        success: false,
        message: 'Reset token has already been used'
      });
    });

    it('should handle non-existent user in forgot password step', async () => {
      // Step 1: User requests password reset for non-existent email
      mockDb.getUserByEmail.mockResolvedValue(null);

      const forgotPasswordResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(forgotPasswordResponse.body).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

      expect(mockDb.getUserByEmail).toHaveBeenCalledWith('nonexistent@example.com');
      expect(mockDb.createPasswordResetToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should handle email service failure gracefully', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      // Step 1: User requests password reset but email service fails
      mockDb.getUserByEmail.mockResolvedValue(user);
      mockDb.createPasswordResetToken.mockResolvedValue(undefined);
      mockEmailService.sendPasswordResetEmail.mockResolvedValue({
        success: false,
        error: 'Email service unavailable'
      });

      const forgotPasswordResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      // Should still return success even if email fails
      expect(forgotPasswordResponse.body).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

      expect(mockDb.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockDb.createPasswordResetToken).toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });
});
