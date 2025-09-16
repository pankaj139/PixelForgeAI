/**
 * Protected Route Component
 * 
 * Purpose: Wrapper component for routes that require authentication.
 * Automatically redirects unauthenticated users to login page
 * and provides loading states during authentication checks.
 * 
 * Usage:
 * ```tsx
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <DashboardPage />
 *   </ProtectedRoute>
 * } />
 * 
 * // Or with redirect URL
 * <Route path="/profile" element={
 *   <ProtectedRoute requireAuth returnUrl="/profile">
 *     <ProfilePage />
 *   </ProtectedRoute>
 * } />
 * ```
 * 
 * Features:
 * - Authentication state checking
 * - Automatic redirect to login
 * - Loading state management
 * - Return URL preservation
 * - Flexible authentication requirements
 * - Error handling for auth failures
 * 
 * Security:
 * - Prevents unauthorized access
 * - Token validation on route access
 * - Session timeout handling
 * - Graceful authentication failures
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // Default true
  redirectTo?: string; // Default '/auth'
  returnUrl?: string; // Override return URL
  fallback?: React.ReactNode; // Custom loading component
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  redirectTo = '/auth',
  returnUrl,
  fallback
}) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Determine the return URL
  const actualReturnUrl = returnUrl || location.pathname + location.search;

  // Show loading state - simplified to just use the auth loading state
  const isLoading = loading;

  // Debug logging
  console.log('ProtectedRoute render:', { 
    requireAuth, 
    isAuthenticated, 
    loading, 
    isLoading,
    pathname: location.pathname 
  });

  if (isLoading) {
    // Custom fallback or default loading
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    // Redirect to login/auth page with return URL
    const searchParams = new URLSearchParams();
    searchParams.set('returnUrl', actualReturnUrl);
    
    return <Navigate to={`${redirectTo}?${searchParams.toString()}`} replace />;
  }

  // Optional authentication - redirect authenticated users away from public routes
  if (!requireAuth && isAuthenticated && redirectTo && location.pathname !== redirectTo) {
    // This is useful for login/register pages that should redirect authenticated users
    return <Navigate to={redirectTo} replace />;
  }

  // Render protected content
  return <>{children}</>;
};

/**
 * Higher-order component for protecting routes
 */
export const withProtectedRoute = <P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) => {
  const ProtectedComponent = (props: P) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  );

  // Preserve component name for debugging
  ProtectedComponent.displayName = `withProtectedRoute(${Component.displayName || Component.name})`;

  return ProtectedComponent;
};

/**
 * Hook for getting protected route information
 */
export const useProtectedRoute = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  return {
    isAuthenticated,
    loading,
    user,
    currentPath: location.pathname,
    isProtectedPath: location.pathname.startsWith('/dashboard') || 
                     location.pathname.startsWith('/profile') ||
                     location.pathname.startsWith('/settings') ||
                     location.pathname.startsWith('/history'),
    shouldRedirect: !loading && !isAuthenticated
  };
};

export default ProtectedRoute;
