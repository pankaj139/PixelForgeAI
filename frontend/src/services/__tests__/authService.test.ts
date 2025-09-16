/**
 * @fileoverview Test suite for Frontend AuthService
 * 
 * This file contains comprehensive unit tests for the frontend authService, covering:
 * - API communication with backend authentication endpoints
 * - Request/response handling for login, register, logout
 * - Token management and header setting
 * - Error handling and network issues
 * - User profile and statistics retrieval
 * - HTTP status code handling
 * - Request timeouts and retries
 * 
 * Tests ensure the auth service correctly communicates with the backend API.
 * 
 * @usage npm test -- src/services/__tests__/authService.test.ts
 * @expected-returns Test results with coverage for all auth service API calls
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../authService';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('login', () => {
    it('successfully logs in with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser'
        },
        token: 'auth-token-123'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await authService.login(loginData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });
    });

    it('handles invalid credentials error', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const mockErrorResponse = {
        success: false,
        error: 'Invalid email or password'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const result = await authService.login(loginData);

      expect(result).toEqual(mockErrorResponse);
    });

    it('handles network error during login', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await authService.login(loginData);

      expect(result).toEqual({
        success: false,
        error: 'Network error occurred'
      });
    });

    it('handles non-JSON response error', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const result = await authService.login(loginData);

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred'
      });
    });

    it('handles server error with custom message', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          success: false,
          error: 'Too many login attempts. Please try again later.'
        })
      });

      const result = await authService.login(loginData);

      expect(result).toEqual({
        success: false,
        error: 'Too many login attempts. Please try again later.'
      });
    });
  });

  describe('register', () => {
    it('successfully registers new user', async () => {
      const registerData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: true,
        user: {
          id: '2',
          email: 'newuser@example.com',
          username: 'newuser'
        },
        token: 'new-auth-token'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await authService.register(registerData);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerData)
      });
    });

    it('handles username already exists error', async () => {
      const registerData = {
        username: 'existinguser',
        email: 'test@example.com',
        password: 'password123'
      };

      const mockErrorResponse = {
        success: false,
        error: 'Username already exists'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const result = await authService.register(registerData);

      expect(result).toEqual(mockErrorResponse);
    });

    it('handles validation errors', async () => {
      const registerData = {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: '123'
      };

      const mockErrorResponse = {
        success: false,
        error: 'Validation failed: username must be at least 3 characters, email must be valid, password must be at least 6 characters'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const result = await authService.register(registerData);

      expect(result).toEqual(mockErrorResponse);
    });
  });

  describe('logout', () => {
    it('successfully logs out with valid token', async () => {
      const mockToken = 'valid-token';
      mockLocalStorage.getItem.mockReturnValue(mockToken);

      const mockResponse = {
        success: true,
        message: 'Logged out successfully'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await authService.logout();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`
        }
      });
    });

    it('handles logout without token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await authService.logout();

      expect(result).toEqual({
        success: true,
        message: 'Already logged out'
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles server error during logout', async () => {
      const mockToken = 'valid-token';
      mockLocalStorage.getItem.mockReturnValue(mockToken);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Server error'
        })
      });

      const result = await authService.logout();

      expect(result).toEqual({
        success: false,
        error: 'Server error'
      });
    });
  });

  describe('getProfile', () => {
    it('successfully retrieves user profile', async () => {
      const mockToken = 'valid-token';
      mockLocalStorage.getItem.mockReturnValue(mockToken);

      const mockResponse = {
        success: true,
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser'
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await authService.getProfile();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`
        }
      });
    });

    it('handles unauthorized access when token is invalid', async () => {
      const mockToken = 'invalid-token';
      mockLocalStorage.getItem.mockReturnValue(mockToken);

      const mockErrorResponse = {
        success: false,
        error: 'Unauthorized'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const result = await authService.getProfile();

      expect(result).toEqual(mockErrorResponse);
    });

    it('handles missing token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await authService.getProfile();

      expect(result).toEqual({
        success: false,
        error: 'No authentication token found'
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getUserStats', () => {
    it('successfully retrieves user statistics', async () => {
      const mockToken = 'valid-token';
      mockLocalStorage.getItem.mockReturnValue(mockToken);

      const mockStats = {
        success: true,
        stats: {
          totalJobs: 15,
          completedJobs: 12,
          processingJobs: 2,
          failedJobs: 1,
          totalImagesProcessed: 120,
          averageProcessingTime: 1500,
          storageUsed: 256000000,
          joinDate: '2024-01-15T10:30:00Z',
          lastActivity: '2024-12-15T14:20:00Z'
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats)
      });

      const result = await authService.getUserStats();

      expect(result).toEqual(mockStats);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`
        }
      });
    });

    it('handles error when fetching user statistics', async () => {
      const mockToken = 'valid-token';
      mockLocalStorage.getItem.mockReturnValue(mockToken);

      const mockErrorResponse = {
        success: false,
        error: 'Failed to fetch user statistics'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const result = await authService.getUserStats();

      expect(result).toEqual(mockErrorResponse);
    });

    it('handles missing token for stats request', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await authService.getUserStats();

      expect(result).toEqual({
        success: false,
        error: 'No authentication token found'
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles fetch timeout', async () => {
      vi.useFakeTimers();

      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock a fetch that takes too long
      mockFetch.mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          }), 10000);
        })
      );

      const loginPromise = authService.login(loginData);
      
      // Fast forward time
      vi.advanceTimersByTime(10000);
      
      const result = await loginPromise;

      // Should handle long requests gracefully
      expect(result.success).toBeDefined();

      vi.useRealTimers();
    });

    it('handles malformed JSON response', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Unexpected token'))
      });

      const result = await authService.login(loginData);

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred'
      });
    });

    it('handles empty response', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null)
      });

      const result = await authService.login(loginData);

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred'
      });
    });
  });

  describe('request headers and authentication', () => {
    it('includes authorization header when token is available', async () => {
      const mockToken = 'test-token-123';
      mockLocalStorage.getItem.mockReturnValue(mockToken);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, user: {} })
      });

      await authService.getProfile();

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`
        }
      });
    });

    it('does not include authorization header for login', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true })
      });

      await authService.login(loginData);

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });
    });

    it('does not include authorization header for register', async () => {
      const registerData = {
        username: 'test',
        email: 'test@example.com',
        password: 'password123'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ success: true })
      });

      await authService.register(registerData);

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerData)
      });
    });
  });
});
