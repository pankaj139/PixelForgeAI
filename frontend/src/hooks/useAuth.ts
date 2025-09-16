/**
 * Authentication Hook
 * 
 * Purpose: Provides authentication state management and operations
 * throughout the React application with automatic token validation
 * and user session persistence.
 * 
 * Usage:
 * ```tsx
 * const { isAuthenticated, user, login, logout, loading } = useAuth();
 * 
 * const handleLogin = async () => {
 *   const result = await login({ emailOrUsername: 'user@example.com', password: 'password' });
 *   if (result.success) {
 *     navigate('/dashboard');
 *   }
 * };
 * ```
 * 
 * Key Features:
 * - Automatic token validation on app startup
 * - Persistent authentication state
 * - Loading states for async operations
 * - Error handling and user feedback
 * - Integration with React Query
 * - Local storage synchronization
 * 
 * State Management:
 * - Uses React Context for global state
 * - Automatic token refresh handling
 * - Seamless logout across tabs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/authService';
import type { User, UserLogin, UserRegistration, AuthState } from '../types';

interface UseAuthReturn extends AuthState {
  login: (credentials: UserLogin, rememberMe?: boolean) => Promise<{
    success: boolean;
    message?: string;
    errors?: string[];
  }>;
  register: (userData: UserRegistration, rememberMe?: boolean) => Promise<{
    success: boolean;
    message?: string;
    errors?: string[];
  }>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  updateProfile: (profileData: { firstName: string; lastName: string; preferences?: User['preferences'] }) => Promise<{
    success: boolean;
    user?: User;
    message?: string;
  }>;
  refreshUser: () => Promise<void>;
  validateSession: () => Promise<boolean>;
}

// Global flag to prevent multiple simultaneous auth initializations
let isInitializing = false;

/**
 * Authentication hook for managing user authentication state
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true
  });

  /**
   * Initialize authentication state from stored data
   */
  const initializeAuth = useCallback(async () => {
    if (isInitializing) {
      console.log('Auth initialization already in progress, skipping...'); // Debug log
      return;
    }

    try {
      isInitializing = true;
      console.log('Initializing auth...'); // Debug log
      setState(prev => ({ ...prev, loading: true }));

      const storedToken = authService.getToken();
      const storedUser = authService.getStoredUser();
      
      console.log('Stored data check:', { 
        hasToken: !!storedToken, 
        hasUser: !!storedUser,
        tokenLength: storedToken?.length,
        userId: storedUser?.id 
      });

      if (storedToken && storedUser) {
        console.log('Found stored token and user, validating...'); // Debug log
        // Validate token with server
        const isValid = await authService.validateToken();
        
        if (isValid) {
          console.log('Token is valid, fetching current user...'); // Debug log
          // Get fresh user data from server
          const currentUser = await authService.getCurrentUser();
          console.log('Current user fetched:', currentUser); // Debug log
          
          setState({
            isAuthenticated: true,
            user: currentUser || storedUser,
            token: storedToken,
            loading: false
          });
          console.log('Auth initialized successfully - isAuthenticated set to true'); // Debug log
        } else {
          console.log('Token is invalid, clearing stored data'); // Debug log
          // Token is invalid, clear stored data
          authService.removeToken();
          authService.removeStoredUser();
          
          setState({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false
          });
        }
      } else {
        console.log('No stored token or user found'); // Debug log
        setState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      
      // Clear stored data on error
      authService.removeToken();
      authService.removeStoredUser();
      
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });
    } finally {
      isInitializing = false;
    }
  }, []);

  /**
   * Login user
   */
  const login = useCallback(async (credentials: UserLogin, rememberMe: boolean = false) => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const result = await authService.login(credentials, rememberMe);

      // authService.login returns { success: true, user, token } directly
      if (result.success && (result.user || result.data)) {
        const user = result.user || result.data?.user;
        const token = result.token || result.data?.token;
        
        setState({
          isAuthenticated: true,
          user: user,
          token: token,
          loading: false
        });

        return {
          success: true,
          message: result.message || 'Login successful'
        };
      } else {
        setState(prev => ({ ...prev, loading: false }));
        
        return {
          success: false,
          message: result.message || result.error || 'Login failed',
          errors: result.errors || (result.error ? [result.error] : ['Login failed'])
        };
      }
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (userData: UserRegistration, rememberMe: boolean = false) => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const result = await authService.register(userData, rememberMe);

      if (result.success && result.data) {
        setState({
          isAuthenticated: true,
          user: result.data.user,
          token: result.data.token,
          loading: false
        });

        return {
          success: true,
          message: result.message
        };
      } else {
        setState(prev => ({ ...prev, loading: false }));
        
        return {
          success: false,
          message: result.message,
          errors: result.errors
        };
      }
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }, []);

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      await authService.logout();
      
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });
    } catch (error) {
      console.error('Logout error:', error);
      
      // Still update state even if server request fails
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });
    }
  }, []);

  /**
   * Logout from all devices
   */
  const logoutAllDevices = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      await authService.logoutAllDevices();
      
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });
    } catch (error) {
      console.error('Logout all devices error:', error);
      
      // Still update state even if server request fails
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (profileData: { firstName: string; lastName: string; preferences?: User['preferences'] }) => {
    try {
      const result = await authService.updateProfile(profileData);

      if (result.success && result.user) {
        setState(prev => ({
          ...prev,
          user: result.user!
        }));
      }

      return result;
    } catch (error) {
      console.error('Update profile error:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update profile'
      };
    }
  }, []);

  /**
   * Refresh user data from server
   */
  const refreshUser = useCallback(async () => {
    try {
      if (!state.isAuthenticated) return;
      
      const currentUser = await authService.getCurrentUser();
      
      if (currentUser) {
        setState(prev => ({
          ...prev,
          user: currentUser
        }));
      } else {
        // User data couldn't be fetched, possibly invalid token
        setState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  }, [state.isAuthenticated]);

  /**
   * Validate current session
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      if (!state.token) return false;
      
      const isValid = await authService.validateToken();
      
      if (!isValid) {
        setState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false
        });
      }
      
      return isValid;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }, [state.token]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    initializeAuth();
  }, []); // Remove initializeAuth from dependencies to prevent loops

  /**
   * Listen for storage changes (for multi-tab sync) and auth events
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'auth_user') {
        // Re-initialize auth state when storage changes
        initializeAuth();
      }
    };

    const handleAuthLogout = () => {
      // Handle logout events from API client (e.g., when token expires)
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false
      });
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-logout', handleAuthLogout);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, []); // Remove initializeAuth from dependencies to prevent loops

  /**
   * Auto-refresh user data periodically
   */
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(() => {
      refreshUser();
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, [state.isAuthenticated]); // Remove refreshUser from dependencies to prevent recreation

  // Debug logging for state changes
  console.log('useAuth state:', { 
    isAuthenticated: state.isAuthenticated, 
    loading: state.loading, 
    hasUser: !!state.user,
    hasToken: !!state.token,
    userId: state.user?.id,
    userEmail: state.user?.email
  });

  return {
    ...state,
    login,
    register,
    logout,
    logoutAllDevices,
    updateProfile,
    refreshUser,
    validateSession
  };
}

/**
 * Hook for getting user statistics
 */
export function useUserStats() {
  const [stats, setStats] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (isFetchingRef.current) {
      console.log('Stats fetch already in progress, skipping...'); // Debug log
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      console.log('Fetching user stats...'); // Debug log
      const result = await authService.getUserStats();

      if (result.success) {
        setStats(result.stats || null);
        setRecentJobs(result.recentJobs || []);
        console.log('User stats fetched successfully'); // Debug log
      } else {
        setError(result.message || 'Failed to fetch user statistics');
        console.error('Failed to fetch user stats:', result.message); // Debug log
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching user stats:', err); // Debug log
    } finally {
      setLoading(false);
      setHasFetched(true);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!hasFetched && !isFetchingRef.current) {
      fetchStats();
    }
  }, [hasFetched]); // Remove fetchStats from dependencies to prevent loops

  return {
    stats,
    recentJobs,
    loading,
    error,
    refetch: fetchStats
  };
}
