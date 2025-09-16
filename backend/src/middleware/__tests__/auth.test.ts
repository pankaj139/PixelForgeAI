/**
 * @fileoverview Test suite for Authentication Middleware
 * 
 * This file contains comprehensive unit tests for the authentication middleware, covering:
 * - Token extraction from Authorization header
 * - JWT token verification
 * - User attachment to request object
 * - Error handling for invalid/missing tokens
 * - Proper HTTP response codes and error messages
 * 
 * Tests ensure middleware properly authenticates requests and handles edge cases.
 * 
 * @usage npm test -- src/middleware/__tests__/auth.test.ts
 * @expected-returns Test results with coverage for all authentication middleware scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../auth';

// Mock the auth service
vi.mock('../../services/authService', () => ({
  authService: {
    verifyToken: vi.fn()
  }
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: any;
  let statusMock: any;
  let mockAuthService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked auth service
    const authServiceModule = await import('../../services/authService');
    mockAuthService = authServiceModule.authService;

    // Create mock response with method chaining
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {}
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock
    };

    mockNext = vi.fn();
  });

  describe('Token Extraction', () => {
    it('should extract token from Authorization header with Bearer prefix', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid_jwt_token'
      };

      mockAuthService.verifyToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid_jwt_token');
      expect(mockRequest.user).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing Authorization header', async () => {
      mockRequest.headers = {};

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Access token is required',
        errorCode: 'MISSING_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle Authorization header without Bearer prefix', async () => {
      mockRequest.headers = {
        authorization: 'invalid_format_token'
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Access token is required',
        errorCode: 'MISSING_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty Bearer token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer '
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Access token is required',
        errorCode: 'MISSING_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Token Verification', () => {
    beforeEach(() => {
      mockRequest.headers = {
        authorization: 'Bearer valid_jwt_token'
      };
    });

    it('should successfully verify valid token', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid_jwt_token');
      expect(mockRequest.user).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should handle invalid token', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token'
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
        errorCode: 'INVALID_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired token', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        valid: false,
        error: 'Token expired'
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired',
        errorCode: 'EXPIRED_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle malformed token', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        valid: false,
        error: 'Malformed token'
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Malformed token',
        errorCode: 'INVALID_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('User Context', () => {
    beforeEach(() => {
      mockRequest.headers = {
        authorization: 'Bearer valid_jwt_token'
      };
    });

    it('should attach user information to request object', async () => {
      const mockUserPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser'
      };

      mockAuthService.verifyToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        payload: mockUserPayload
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        payload: mockUserPayload
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve existing request properties', async () => {
      mockRequest.body = { someData: 'test' };
      mockRequest.params = { id: '123' };
      mockRequest.query = { filter: 'active' };

      mockAuthService.verifyToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.body).toEqual({ someData: 'test' });
      expect(mockRequest.params).toEqual({ id: '123' });
      expect(mockRequest.query).toEqual({ filter: 'active' });
      expect(mockRequest.user).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle auth service errors gracefully', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid_jwt_token'
      };

      mockAuthService.verifyToken.mockRejectedValue(new Error('Service unavailable'));

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication verification failed',
        errorCode: 'AUTH_VERIFICATION_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid_jwt_token'
      };

      const networkError = new Error('Network timeout');
      networkError.name = 'TimeoutError';
      mockAuthService.verifyToken.mockRejectedValue(networkError);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication verification failed',
        errorCode: 'AUTH_VERIFICATION_ERROR'
      });
    });

    it('should handle response object without status method', async () => {
      // Create a response mock without chaining methods
      const brokenResponse = {
        status: undefined,
        json: vi.fn()
      } as any;

      mockRequest.headers = {
        authorization: 'Bearer valid_jwt_token'
      };

      // This should not crash even with broken response object
      await expect(
        authenticateToken(mockRequest as Request, brokenResponse as Response, mockNext)
      ).resolves.not.toThrow();
    });
  });

  describe('Security Considerations', () => {
    it('should not leak sensitive information in error messages', async () => {
      mockRequest.headers = {
        authorization: 'Bearer malicious_token_with_sensitive_data'
      };

      mockAuthService.verifyToken.mockResolvedValue({
        valid: false,
        error: 'Invalid token'
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
        errorCode: 'INVALID_TOKEN'
      });

      // Ensure the actual token is not included in the response
      const callArgs = jsonMock.mock.calls[0][0];
      expect(JSON.stringify(callArgs)).not.toContain('malicious_token_with_sensitive_data');
    });

    it('should handle case-insensitive Bearer prefix', async () => {
      mockRequest.headers = {
        authorization: 'bearer valid_jwt_token'
      };

      mockAuthService.verifyToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid_jwt_token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle Authorization header with extra whitespace', async () => {
      mockRequest.headers = {
        authorization: '  Bearer   valid_jwt_token  '
      };

      mockAuthService.verifyToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid_jwt_token');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work correctly in a middleware chain', async () => {
      const middlewareChain = [
        authenticateToken,
        (req: Request, res: Response, next: NextFunction) => {
          expect((req as any).user).toBeDefined();
          next();
        }
      ];

      mockRequest.headers = {
        authorization: 'Bearer valid_jwt_token'
      };

      mockAuthService.verifyToken.mockResolvedValue({
        valid: true,
        userId: 'user123',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser'
        }
      });

      // Simulate middleware chain execution
      await middlewareChain[0](mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeDefined();
    });

    it('should handle concurrent requests correctly', async () => {
      const requests = [
        { headers: { authorization: 'Bearer token1' } },
        { headers: { authorization: 'Bearer token2' } },
        { headers: { authorization: 'Bearer token3' } }
      ];

      const responses = requests.map(() => ({
        status: vi.fn().mockReturnValue({ json: vi.fn() })
      }));

      const nextFunctions = [vi.fn(), vi.fn(), vi.fn()];

      mockAuthService.verifyToken
        .mockResolvedValueOnce({ valid: true, userId: 'user1', payload: { userId: 'user1' } })
        .mockResolvedValueOnce({ valid: true, userId: 'user2', payload: { userId: 'user2' } })
        .mockResolvedValueOnce({ valid: true, userId: 'user3', payload: { userId: 'user3' } });

      // Execute middleware for all requests concurrently
      await Promise.all(
        requests.map((req, index) =>
          authenticateToken(req as Request, responses[index] as Response, nextFunctions[index])
        )
      );

      // Verify each request was processed independently
      expect((requests[0] as any).user?.userId).toBe('user1');
      expect((requests[1] as any).user?.userId).toBe('user2');
      expect((requests[2] as any).user?.userId).toBe('user3');
      expect(nextFunctions[0]).toHaveBeenCalled();
      expect(nextFunctions[1]).toHaveBeenCalled();
      expect(nextFunctions[2]).toHaveBeenCalled();
    });
  });
});
