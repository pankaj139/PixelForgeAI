/**
 * Authentication Context
 * 
 * Purpose: Provides a centralized authentication state management system
 * that can be shared across all components without creating multiple
 * instances of the useAuth hook.
 * 
 * Usage:
 * ```tsx
 * import { AuthProvider } from './contexts/AuthContext';
 * import { useAuth } from './hooks/useAuth';
 * 
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <YourAppComponents />
 *     </AuthProvider>
 *   );
 * }
 * 
 * function SomeComponent() {
 *   const { isAuthenticated, user, login, logout } = useAuth();
 *   // Use auth state and methods
 * }
 * ```
 * 
 * Features:
 * - Single source of truth for authentication state
 * - Prevents multiple auth initializations
 * - Shared state across all components
 * - Automatic token validation
 * - Loading state management
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth as useAuthHook } from '../hooks/useAuth';
import type { UseAuthReturn } from '../hooks/useAuth';

// Create the context
const AuthContext = createContext<UseAuthReturn | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component that provides authentication context to all children
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = useAuthHook();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access authentication context
 * This ensures all components use the same auth instance
 */
export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
