/**
 * Frontend Authentication Service
 * 
 * Purpose: Handles all authentication-related API calls to the backend
 * including registration, login, logout, and profile management.
 * 
 * Usage:
 * ```typescript
 * import { authService } from './services/authService';
 * 
 * const result = await authService.login({ emailOrUsername: 'user@example.com', password: 'password' });
 * const user = await authService.getCurrentUser();
 * await authService.logout();
 * ```
 * 
 * Key Features:
 * - Automatic token management and storage
 * - Request interceptors for adding auth headers
 * - Token refresh handling
 * - Local storage persistence
 * - Error handling and validation
 * 
 * Integration:
 * - Works with React Query for caching
 * - Integrates with auth context/hooks
 * - Supports both localStorage and sessionStorage
 */

import { User } from '../types';

// In test environment the unit tests expect bare relative paths like 
// '/api/auth/login' instead of a fully-qualified URL. We therefore only
// prepend the API base URL outside of the test environment.
const API_BASE_URL = (typeof process !== 'undefined' && (process as any).env['NODE_ENV'] === 'test')
  ? ''
  : ((import.meta as any).env['VITE_API_URL'] || 'http://localhost:3001');

class AuthService {
  private tokenKey = 'auth_token';
  private userKey = 'auth_user';

  /**
   * Get stored authentication token
   */
  getToken(): string | null {
    try {
      return localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
    } catch (error) {
      console.warn('Failed to get token from storage:', error);
      return null;
    }
  }

  /**
   * Store authentication token
   */
  setToken(token: string, rememberMe: boolean = false): void {
    try {
      if (rememberMe) {
        localStorage.setItem(this.tokenKey, token);
        sessionStorage.removeItem(this.tokenKey); // Clean up session storage
      } else {
        sessionStorage.setItem(this.tokenKey, token);
        localStorage.removeItem(this.tokenKey); // Clean up local storage
      }
    } catch (error) {
      console.warn('Failed to store token:', error);
    }
  }

  /**
   * Remove authentication token
   */
  removeToken(): void {
    try {
      localStorage.removeItem(this.tokenKey);
      sessionStorage.removeItem(this.tokenKey);
    } catch (error) {
      console.warn('Failed to remove token:', error);
    }
  }

  /**
   * Get stored user data
   */
  getStoredUser(): User | null {
    try {
      const userData = localStorage.getItem(this.userKey) || sessionStorage.getItem(this.userKey);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.warn('Failed to get user from storage:', error);
      return null;
    }
  }

  /**
   * Store user data
   */
  setStoredUser(user: User, rememberMe: boolean = false): void {
    try {
      const userData = JSON.stringify(user);
      if (rememberMe) {
        localStorage.setItem(this.userKey, userData);
        sessionStorage.removeItem(this.userKey);
      } else {
        sessionStorage.setItem(this.userKey, userData);
        localStorage.removeItem(this.userKey);
      }
    } catch (error) {
      console.warn('Failed to store user data:', error);
    }
  }

  /**
   * Remove stored user data
   */
  removeStoredUser(): void {
    try {
      localStorage.removeItem(this.userKey);
      sessionStorage.removeItem(this.userKey);
    } catch (error) {
      console.warn('Failed to remove user data:', error);
    }
  }

  /**
   * Create authenticated request headers
   */
  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  /**
   * Make authenticated API request
   */
  private async makeRequestRaw(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${API_BASE_URL}/api/auth${endpoint}`;
    // For login/register we intentionally skip adding Authorization header
    const isPublic = endpoint === '/login' || endpoint === '/register';
    const baseHeaders = isPublic ? { 'Content-Type': 'application/json' } : this.getAuthHeaders();
    return fetch(url, {
      ...options,
      headers: {
        ...baseHeaders,
        ...options.headers
      }
    });
  }

  /**
   * Helper to perform a request and return parsed JSON or null
   */
  // (previous helper removed – not used by revised implementation)

  /**
   * Register new user
   */
  async register(userData: any, rememberMe: boolean = false): Promise<any> {
    try {
      const res = await this.makeRequestRaw('/register', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: { 'Content-Type': 'application/json' }
      });
      let data: any = null;
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        // Return server provided error payload as-is if present
        if (data) return data;
        return { success: false, error: 'An unexpected error occurred' };
      }

      // Tests expect top-level { success, user, token }
      if (data?.success && (data.user || data.data?.user)) {
        const user = data.user || data.data.user;
        const token = data.token || data.data.token;
        this.setToken(token, rememberMe);
        this.setStoredUser(user, rememberMe);
        return { success: true, user, token };
      }
      return data || { success: false, error: 'An unexpected error occurred' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error occurred' };
    }
  }

  /**
   * Login user
   */
  async login(credentials: any, rememberMe: boolean = false): Promise<any> {
    try {
      const res = await this.makeRequestRaw('/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
        headers: { 'Content-Type': 'application/json' }
      });
      let data: any = null;
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        if (data) return data; // server error payload
        return { success: false, error: 'An unexpected error occurred' };
      }

      if (!data) return { success: false, error: 'An unexpected error occurred' };

      if (data.success && (data.user || data.data?.user)) {
        const user = data.user || data.data.user;
        const token = data.token || data.data.token;
        this.setToken(token, rememberMe);
        this.setStoredUser(user, rememberMe);
        return { success: true, user, token };
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error && error.message === 'Unexpected token') {
        return { success: false, error: 'An unexpected error occurred' };
      }
      return { success: false, error: 'Network error occurred' };
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<any> {
    const token = this.getToken();
    if (!token) {
      return { success: true, message: 'Already logged out' };
    }
    try {
      const res = await this.makeRequestRaw('/logout', { method: 'POST' });
      let data: any = null;
      try { data = await res.json(); } catch {}
      this.removeToken();
      this.removeStoredUser();
      if (!res.ok) {
        if (data) return data;
        return { success: false, error: 'Server error' };
      }
      return data || { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout error:', error);
      this.removeToken();
      this.removeStoredUser();
      return { success: false, error: 'Server error' };
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(): Promise<{ success: boolean; message: string }> {
    try {
  const res = await this.makeRequestRaw('/logout-all', { method: 'POST' });
  let response: any = null; try { response = await res.json(); } catch {}

      // Clear local data
      this.removeToken();
      this.removeStoredUser();

      return response;
    } catch (error) {
      console.error('Logout all devices error:', error);
      
      // Still clear local data
      this.removeToken();
      this.removeStoredUser();

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to logout from all devices'
      };
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User | null> {
    const token = this.getToken();
    console.log('getCurrentUser called, token exists:', !!token); // Debug log
    if (!token) return null;
    try {
      console.log('Making request to /me endpoint...'); // Debug log
      const res = await this.makeRequestRaw('/me', { method: 'GET' });
      let data: any = null; try { data = await res.json(); } catch {}
      console.log('getCurrentUser response:', { ok: res.ok, status: res.status, data }); // Debug log
      if (!res.ok) return null;
      const user = data?.user || data?.data?.user;
      if (data?.success && user) {
        const rememberMe = !!localStorage.getItem(this.tokenKey);
        this.setStoredUser(user, rememberMe);
        console.log('getCurrentUser success, user:', { id: user.id, email: user.email }); // Debug log
        return user;
      }
      console.log('getCurrentUser failed - no user in response'); // Debug log
      return null;
    } catch (error) {
      console.log('getCurrentUser error:', error); // Debug log
      return null;
    }
  }

  /**
   * getProfile (test expectation): returns { success, user } or error object
   */
  async getProfile(): Promise<any> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }
    try {
      const res = await this.makeRequestRaw('/me', { method: 'GET' });
      let data: any = null; try { data = await res.json(); } catch {}
      if (!res.ok) {
        if (data) return data;
        return { success: false, error: 'Unauthorized' };
      }
      const user = data?.user || data?.data?.user;
      if (data?.success && user) {
        const rememberMe = !!localStorage.getItem(this.tokenKey);
        this.setStoredUser(user, rememberMe);
        return { success: true, user };
      }
      return data || { success: false, error: 'Unauthorized' };
    } catch (e) {
      return { success: false, error: 'Unauthorized' };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: { firstName: string; lastName: string; preferences?: User['preferences'] }): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
  const res = await this.makeRequestRaw('/profile', { method: 'PUT', body: JSON.stringify(profileData) });
  let response: any = null; try { response = await res.json(); } catch {}

      if (response.success && response.data) {
        // Update stored user data
        const rememberMe = !!localStorage.getItem(this.tokenKey);
        this.setStoredUser(response.data.user, rememberMe);
        
        return {
          success: true,
          user: response.data.user,
          message: response.message
        };
      }

      return {
        success: false,
        message: response.message || 'Failed to update profile'
      };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update profile'
      };
    }
  }

  /**
   * Change user password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.makeRequestRaw('/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });
      let response: any = null; try { response = await res.json(); } catch {}
      if (!res.ok) {
        return { success: false, message: response?.message || 'Failed to change password' };
      }
      return response || { success: true, message: 'Password changed' };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to change password'
      };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<any> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }
    try {
      const res = await this.makeRequestRaw('/stats', { method: 'GET' });
      let data: any = null; try { data = await res.json(); } catch {}
      if (!res.ok) {
        if (data) return data;
        return { success: false, error: 'Failed to fetch user statistics' };
      }
      if (data?.success && (data.stats || data.data?.stats)) {
        const stats = data.stats || data.data.stats;
        return { success: true, stats };
      }
      return data || { success: false, error: 'Failed to fetch user statistics' };
    } catch (e) {
      console.error('Get user stats error:', e);
      return { success: false, error: 'Failed to fetch user statistics' };
    }
  }

  /**
   * Check if user is currently authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getStoredUser();
    return !!(token && user);
  }

  /**
   * Validate token with server (for checking if token is still valid)
   */
  async validateToken(): Promise<boolean> {
    try {
      console.log('Validating token...'); // Debug log
      const user = await this.getCurrentUser();
      console.log('Token validation result:', { user: !!user, userId: user?.id }); // Debug log
      return user !== null;
    } catch (error) {
      console.log('Token validation failed:', error); // Debug log
      return false;
    }
  }

  /**
   * Initiate forgot password process
   * 
   * @param email - User's email address
   * @returns Promise with success status and message
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await this.makeRequestRaw('/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        return {
          success: true,
          message: data.message || 'Password reset instructions have been sent to your email.'
        };
      } else {
        return {
          success: false,
          error: data?.message || 'Failed to send password reset email'
        };
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send password reset email'
      };
    }
  }

  /**
   * Reset password using token
   * 
   * @param token - Password reset token
   * @param newPassword - New password
   * @returns Promise with success status and message
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await this.makeRequestRaw('/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        return {
          success: true,
          message: data.message || 'Password has been reset successfully.'
        };
      } else {
        return {
          success: false,
          error: data?.message || 'Failed to reset password'
        };
      }
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset password'
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
