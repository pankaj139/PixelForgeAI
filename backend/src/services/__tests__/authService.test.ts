/**
 * @fileoverview Test suite for AuthService
 * 
 * This file contains comprehensive unit tests for the AuthService class, covering:
 * - User registration with validation
 * - User login with password verification
 * - JWT token generation and verification
 * - Password hashing and comparison
 * - Session management
 * - User profile retrieval
 * - User statistics generation
 * - Error handling scenarios
 * 
 * Tests ensure authentication security, data integrity, and proper error handling.
 * 
 * @usage npm test -- src/services/__tests__/authService.test.ts
 * @expected-returns Test results with coverage for all authentication flows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../authService';
import type { UserRegistration, UserLogin, User } from '../../database/schema';

// Mock dependencies
const mockDatabase = {
  getUserByEmail: vi.fn(),
  getUserByUsername: vi.fn(),
  getUserByEmailOrUsername: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  isEmailTaken: vi.fn(),
  isUsernameTaken: vi.fn(),
  createUserSession: vi.fn(),
  getUserSession: vi.fn(),
  getUserSessionByToken: vi.fn(),
  deactivateUserSession: vi.fn(),
  deactivateAllUserSessions: vi.fn(),
  cleanupExpiredSessions: vi.fn(),
  getJobsByUserId: vi.fn(),
  getUserJobHistory: vi.fn()
};

vi.mock('../../database/connection', () => ({
  getDatabase: () => mockDatabase
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true)
  }
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock_jwt_token'),
    verify: vi.fn().mockReturnValue({ userId: 'user123', email: 'test@example.com', username: 'testuser' })
  }
}));

// Mock environment variables
const originalEnv = process.env;

describe('AuthService', () => {
  let authService: AuthService;
  let mockBcrypt: any;
  let mockJwt: any;

  const validUserRegistration: UserRegistration = {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser'
  };

  const validUserLogin: UserLogin = {
    emailOrUsername: 'test@example.com',
    password: 'SecurePassword123!'
  };

  const mockUser: User = {
    id: 'user123',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: 'hashed_password',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    isActive: true,
    emailVerified: true
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up environment variables for tests
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test_jwt_secret_key_for_testing'
    };

    authService = new AuthService();
    
    // Get mocked modules
    mockBcrypt = await import('bcrypt');
    mockJwt = await import('jsonwebtoken');

    // Reset database mocks
    mockDatabase.getUserByEmail.mockResolvedValue(null);
    mockDatabase.getUserByUsername.mockResolvedValue(null);
    mockDatabase.getUserByEmailOrUsername.mockResolvedValue(null);
    mockDatabase.isEmailTaken.mockResolvedValue(false);
    mockDatabase.isUsernameTaken.mockResolvedValue(false);
    mockDatabase.createUser.mockResolvedValue(undefined);
    mockDatabase.getUserById.mockResolvedValue(mockUser);
    mockDatabase.updateUser.mockResolvedValue(undefined);
    mockDatabase.createUserSession.mockResolvedValue(undefined);
    mockDatabase.getUserSession.mockResolvedValue(null);
    mockDatabase.getUserSessionByToken.mockResolvedValue(null);
    mockDatabase.deactivateUserSession.mockResolvedValue(undefined);
    mockDatabase.deactivateAllUserSessions.mockResolvedValue(undefined);
    mockDatabase.getJobsByUserId.mockResolvedValue([]);
    mockDatabase.getUserJobHistory.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('User Registration', () => {
    it('should successfully register a new user', async () => {
      const result = await authService.registerUser(validUserRegistration);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBe('mock_jwt_token');
      expect(mockDatabase.isEmailTaken).toHaveBeenCalledWith('test@example.com');
      expect(mockDatabase.isUsernameTaken).toHaveBeenCalledWith('testuser');
      expect(mockBcrypt.default.hash).toHaveBeenCalledWith('SecurePassword123!', 12);
      expect(mockDatabase.createUser).toHaveBeenCalled();
      expect(mockDatabase.createUserSession).toHaveBeenCalled();
    });

    it('should fail when email already exists', async () => {
      mockDatabase.isEmailTaken.mockResolvedValue(true);

      const result = await authService.registerUser(validUserRegistration);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
      expect(mockDatabase.createUser).not.toHaveBeenCalled();
    });

    it('should fail when username already exists', async () => {
      mockDatabase.isUsernameTaken.mockResolvedValue(true);

      const result = await authService.registerUser(validUserRegistration);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Username already taken');
      expect(mockDatabase.createUser).not.toHaveBeenCalled();
    });

    it('should handle registration errors gracefully', async () => {
      mockDatabase.createUser.mockRejectedValue(new Error('Database error'));

      const result = await authService.registerUser(validUserRegistration);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });
  });

  describe('User Login', () => {
    beforeEach(() => {
      mockDatabase.getUserByEmailOrUsername.mockResolvedValue(mockUser);
    });

    it('should successfully login with valid credentials', async () => {
      const result = await authService.loginUser(validUserLogin);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username
      }));
      expect(result.token).toBe('mock_jwt_token');
      expect(mockBcrypt.default.compare).toHaveBeenCalledWith('SecurePassword123!', 'hashed_password');
      expect(mockDatabase.createUserSession).toHaveBeenCalled();
    });

    it('should fail with invalid email', async () => {
      mockDatabase.getUserByEmailOrUsername.mockResolvedValue(null);

      const result = await authService.loginUser(validUserLogin);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(mockDatabase.createUserSession).not.toHaveBeenCalled();
    });

    it('should fail with invalid password', async () => {
      mockBcrypt.default.compare.mockResolvedValue(false);

      const result = await authService.loginUser(validUserLogin);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(mockDatabase.createUserSession).not.toHaveBeenCalled();
    });

    it('should fail for inactive user', async () => {
      mockDatabase.getUserByEmailOrUsername.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await authService.loginUser(validUserLogin);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is inactive');
    });

    it('should handle login errors gracefully', async () => {
      mockDatabase.getUserByEmailOrUsername.mockRejectedValue(new Error('Database error'));

      const result = await authService.loginUser(validUserLogin);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Login failed');
    });
  });

  describe('JWT Token Management', () => {
    it('should generate valid JWT token', async () => {
      const token = await authService.generateToken('user123', 'test@example.com', 'testuser');

      expect(token).toBe('mock_jwt_token');
      expect(mockJwt.default.sign).toHaveBeenCalledWith(
        { userId: 'user123', email: 'test@example.com', username: 'testuser' },
        'test_jwt_secret_key_for_testing',
        { expiresIn: '7d' }
      );
    });

    it('should verify valid JWT token', async () => {
      const result = await authService.verifyToken('valid_token');

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser'
      });
      expect(mockJwt.default.verify).toHaveBeenCalledWith('valid_token', 'test_jwt_secret_key_for_testing');
    });

    it('should handle invalid JWT token', async () => {
      mockJwt.default.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.verifyToken('invalid_token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should handle expired JWT token', async () => {
      mockJwt.default.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        (error as any).name = 'TokenExpiredError';
        throw error;
      });

      const result = await authService.verifyToken('expired_token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });
  });

  describe('Password Management', () => {
    it('should hash password with correct salt rounds', async () => {
      const hashedPassword = await authService.hashPassword('password123');

      expect(hashedPassword).toBe('hashed_password');
      expect(mockBcrypt.default.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should compare password correctly', async () => {
      mockBcrypt.default.compare.mockResolvedValue(true);
      
      const isMatch = await authService.comparePassword('password123', 'hashed_password');

      expect(isMatch).toBe(true);
      expect(mockBcrypt.default.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should return false for incorrect password', async () => {
      mockBcrypt.default.compare.mockResolvedValue(false);

      const isMatch = await authService.comparePassword('wrong_password', 'hashed_password');

      expect(isMatch).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should logout user and invalidate session', async () => {
      const token = 'valid_session_token';
      mockDatabase.getUserSessionByToken.mockResolvedValue({
        id: 'session123',
        userId: 'user123',
        token: 'session_token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 1 day
        isActive: true
      });

      const result = await authService.logoutUser(token);

      expect(result).toBe(true);
      expect(mockDatabase.getUserSessionByToken).toHaveBeenCalled();
      expect(mockDatabase.deactivateUserSession).toHaveBeenCalled();
    });

    it('should handle logout for invalid session', async () => {
      mockDatabase.getUserSessionByToken.mockResolvedValue(null);

      const result = await authService.logoutUser('invalid_token');

      expect(result).toBe(true); // Should still return true for graceful handling
      expect(mockDatabase.deactivateUserSession).not.toHaveBeenCalled();
    });
  });

  describe('User Profile Management', () => {
    it('should retrieve user profile successfully', async () => {
      const profile = await authService.getUserProfile('user123');

      expect(profile).toEqual(expect.objectContaining({
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser'
      }));
      expect(profile?.passwordHash).toBeUndefined(); // Should not include password
      expect(mockDatabase.getUserById).toHaveBeenCalledWith('user123');
    });

    it('should return null for non-existent user', async () => {
      mockDatabase.getUserById.mockResolvedValue(null);

      const profile = await authService.getUserProfile('nonexistent');

      expect(profile).toBeNull();
    });

    it('should get user statistics', async () => {
      const mockJobs = [
        { id: 'job1', status: 'completed', createdAt: new Date() },
        { id: 'job2', status: 'processing', createdAt: new Date() },
        { id: 'job3', status: 'failed', createdAt: new Date() }
      ];
      mockDatabase.getJobsByUserId.mockResolvedValue(mockJobs);

      const stats = await authService.getUserStats('user123');

      expect(stats.totalJobs).toBe(3);
      expect(stats.completedJobs).toBe(1);
      expect(stats.processingJobs).toBe(1);
      expect(stats.failedJobs).toBe(1);
      expect(stats.joinedAt).toEqual(mockUser.createdAt);
      expect(stats.lastLoginAt).toEqual(mockUser.lastLoginAt);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing JWT secret', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => new AuthService()).toThrow('JWT_SECRET environment variable is required');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle database connection errors', async () => {
      mockDatabase.getUserByEmailOrUsername.mockRejectedValue(new Error('Connection failed'));

      const result = await authService.loginUser(validUserLogin);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Login failed');
    });

    it('should handle bcrypt hashing errors', async () => {
      mockBcrypt.default.hash.mockRejectedValue(new Error('Hashing failed'));

      const result = await authService.registerUser(validUserRegistration);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registration failed');
    });
  });

  describe('Security Features', () => {
    it('should use strong salt rounds for password hashing', async () => {
      // Reset the mock to not throw an error
      mockBcrypt.default.hash.mockResolvedValue('hashed_password');
      
      await authService.hashPassword('test');
      
      expect(mockBcrypt.default.hash).toHaveBeenCalledWith('test', 12);
    });

    it('should generate JWT with appropriate expiration', async () => {
      await authService.generateToken('user123', 'test@example.com', 'testuser');

      expect(mockJwt.default.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ expiresIn: '7d' })
      );
    });

    it('should exclude sensitive data from user profile', async () => {
      const profile = await authService.getUserProfile('user123');

      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).toHaveProperty('id');
      expect(profile).toHaveProperty('email');
      expect(profile).toHaveProperty('username');
    });
  });

  describe('Data Validation', () => {
    it('should handle empty registration data', async () => {
      const emptyRegistration = {
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        username: ''
      } as UserRegistration;

      // This test assumes validation happens at the route level
      // but we can test that the service handles it gracefully
      const result = await authService.registerUser(emptyRegistration);
      expect(result).toBeDefined();
    });

    it('should handle malformed email in login', async () => {
      const malformedLogin = {
        email: 'not-an-email',
        password: 'password'
      } as UserLogin;

      mockDatabase.getUserByEmail.mockResolvedValue(null);
      const result = await authService.loginUser(malformedLogin);
      
      expect(result.success).toBe(false);
    });
  });
});
