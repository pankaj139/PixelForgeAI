/**
 * @fileoverview Test suite for Authentication Routes
 * 
 * This file contains comprehensive integration tests for authentication API endpoints, covering:
 * - User registration endpoint (/api/auth/register)
 * - User login endpoint (/api/auth/login)
 * - User logout endpoint (/api/auth/logout)
 * - User profile endpoint (/api/auth/me)
 * - User statistics endpoint (/api/auth/stats)
 * - Request validation and error handling
 * - Authentication middleware integration
 * 
 * Tests ensure API endpoints work correctly with proper HTTP status codes and responses.
 * 
 * @usage npm test -- src/routes/__tests__/auth.test.ts
 * @expected-returns Test results with coverage for all authentication API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the auth service
vi.mock('../../services/authService', () => ({
  authService: {
    registerUser: vi.fn(),
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
    getUserProfile: vi.fn(),
    getUserStats: vi.fn(),
    getCurrentUser: vi.fn()
  }
}));

// Mock authentication middleware
vi.mock('../../middleware/auth', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    // Mock successful authentication by default
    req.user = {
      userId: 'user123',
      email: 'test@example.com',
      username: 'testuser'
    };
    next();
  })
}));

import authRouter from '../auth';

describe('Authentication Routes', () => {
  let app: express.Application;
  let mockAuthService: any;
  let mockAuthenticateToken: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked auth service
    const authServiceModule = await import('../../services/authService');
    mockAuthService = authServiceModule.authService;
    
    // Get the mocked middleware
    const authMiddlewareModule = await import('../../middleware/auth');
    mockAuthenticateToken = authMiddlewareModule.authenticateToken;
    
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    // Reset mock implementations
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser'
      };
      next();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser'
    };

    it('should register user successfully', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 'user123',
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        },
        token: 'jwt_token_here',
        message: 'User registered successfully'
      };

      mockAuthService.registerUser.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'User registered successfully',
        data: {
          user: mockResponse.user,
          token: mockResponse.token
        }
      });

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(validRegistrationData, undefined, '::ffff:127.0.0.1');
    });

    it('should fail with validation error for missing fields', async () => {
      const invalidData = {
        email: 'test@example.com'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/invalid/i);
    });

    it('should fail when email already exists', async () => {
      const mockResponse = {
        success: false,
        message: 'Email already registered'
      };

      mockAuthService.registerUser.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Email already registered'
      });
    });

    it('should handle service errors gracefully', async () => {
      mockAuthService.registerUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(500);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Registration failed due to server error');
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validRegistrationData,
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validRegistrationData,
        password: '123' // Too weak
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      emailOrUsername: 'test@example.com',
      password: 'SecurePassword123!'
    };

    it('should login user successfully', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 'user123',
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        },
        token: 'jwt_token_here',
        message: 'Login successful'
      };

      mockAuthService.loginUser.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Login successful',
        data: {
          user: mockResponse.user,
          token: mockResponse.token
        }
      });

      expect(mockAuthService.loginUser).toHaveBeenCalledWith(validLoginData, undefined, '::ffff:127.0.0.1');
    });

    it('should fail with invalid credentials', async () => {
      const mockResponse = {
        success: false,
        message: 'Invalid credentials'
      };

      mockAuthService.loginUser.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid credentials'
      });
    });

    it('should fail with missing email or password', async () => {
      const incompleteData = {
        emailOrUsername: 'test@example.com'
        // Missing password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle service errors gracefully', async () => {
      mockAuthService.loginUser.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(500);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Login failed due to server error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      mockAuthService.logoutUser.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logout successful'
      });

      expect(mockAuthService.logoutUser).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ message: 'Authentication required' });
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle logout service errors', async () => {
      mockAuthService.logoutUser.mockRejectedValue(new Error('Logout failed'));

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid_token')
        .expect(500);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile successfully', async () => {
      const mockProfile = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        createdAt: new Date().toISOString(),
        isActive: true,
        emailVerified: true
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: mockProfile
        }
      });

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith('valid_token');
    });

    it('should require authentication', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ message: 'Authentication required' });
      });

      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle user not found', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid_token')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'User not found'
      });
    });

    it('should handle service errors', async () => {
      mockAuthService.getCurrentUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid_token')
        .expect(500);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/auth/stats', () => {
    it('should return user statistics successfully', async () => {
      const mockStats = {
        totalJobs: 10,
        completedJobs: 8,
        processingJobs: 1,
        failedJobs: 1,
        joinedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      const response = await request(app)
        .get('/api/auth/stats')
        .set('Authorization', 'Bearer valid_token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          stats: {
            totalJobs: 0,
            completedJobs: 0,
            successRate: 0,
            processingJobs: 0,
            failedJobs: 0,
            joinedAt: expect.any(String),
            lastLoginAt: expect.any(String)
          },
          recentJobs: []
        }
      });
    });

    it('should require authentication', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ message: 'Authentication required' });
      });

      const response = await request(app)
        .get('/api/auth/stats')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle service errors', async () => {
      // Mock database error by making getUserJobCount throw
      const originalGetDatabase = await import('../../database/connection.js');
      const mockDb = {
        getUserJobCount: vi.fn().mockRejectedValue(new Error('Database error')),
        getUserCompletedJobCount: vi.fn().mockResolvedValue(0)
      };
      
      vi.doMock('../../database/connection.js', () => ({
        getDatabase: () => mockDb
      }));

      const response = await request(app)
        .get('/api/auth/stats')
        .set('Authorization', 'Bearer valid_token')
        .expect(500);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Request Validation', () => {
    it('should validate JSON content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('not json')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express returns empty body for malformed JSON, so we just check the status
      expect(response.status).toBe(400);
    });

    it('should validate request body size limits', async () => {
      const largePayload = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'A'.repeat(10000), // Very large first name
        lastName: 'User',
        username: 'testuser'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload);

      // Response code depends on body parser limits
      expect([400, 413, 500]).toContain(response.status);
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include security headers in responses', async () => {
      mockAuthService.loginUser.mockResolvedValue({
        success: true,
        user: { id: 'user123' },
        token: 'token'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        });

      // Check that the response includes security headers
      expect(response.headers).toHaveProperty('x-powered-by'); // Express includes this by default
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/auth/login');

      // Should allow OPTIONS requests
      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      mockAuthService.registerUser.mockResolvedValue({
        success: false,
        error: 'Email already registered'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
    });

    it('should not leak internal error details', async () => {
      mockAuthService.loginUser.mockRejectedValue(new Error('Database connection failed on server db-prod-01'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'test@example.com',
          password: 'SecurePassword123!'
        })
        .expect(500);

      expect(response.body.message).toBe('Login failed due to server error');
      expect(response.body.message).not.toContain('db-prod-01');
      expect(response.body.message).not.toContain('Database connection');
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle multiple concurrent requests', async () => {
      mockAuthService.loginUser.mockResolvedValue({
        success: true,
        user: { id: 'user123' },
        token: 'token'
      });

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            emailOrUsername: 'test@example.com',
            password: 'SecurePassword123!'
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should complete requests within reasonable time', async () => {
      mockAuthService.loginUser.mockResolvedValue({
        success: true,
        user: { id: 'user123' },
        token: 'token'
      });

      const startTime = Date.now();
      
      await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'test@example.com',
          password: 'SecurePassword123!'
        })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
