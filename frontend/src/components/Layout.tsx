/**
 * Application Layout
 * 
 * Purpose: Main layout wrapper that provides consistent header, navigation,
 * and footer across all pages. Includes authentication-aware header that
 * dynamically shows login/register options or user menu based on auth state.
 * 
 * Features:
 * - Responsive navigation with mobile support
 * - Authentication-aware header (login/register vs user menu)
 * - Consistent styling and spacing
 * - Accessible navigation structure
 * - Dynamic user greeting and logout
 * - Quick access to key features
 * 
 * Updates:
 * - Added authentication integration
 * - Dynamic header based on login status
 * - User menu with logout functionality
 * - Protected route awareness
 */

import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Container from './ui/Container';
import Button from './ui/Button';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    navigate('/', { replace: true });
  };

  const handleLoginClick = () => {
    const returnUrl = location.pathname !== '/' ? location.pathname : undefined;
    navigate(returnUrl ? `/auth?returnUrl=${encodeURIComponent(returnUrl)}` : '/auth');
  };

  const handleRegisterClick = () => {
    const returnUrl = location.pathname !== '/' ? location.pathname : undefined;
    navigate(returnUrl ? `/auth?mode=register&returnUrl=${encodeURIComponent(returnUrl)}` : '/auth?mode=register');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <Container>
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <div className="flex items-center">
              <Link 
                to="/" 
                className="text-lg sm:text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                🖼️ AI Image Processor
              </Link>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center space-x-4">
              {/* Loading state */}
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-500">Loading...</span>
                </div>
              ) : isAuthenticated && user ? (
                /* Authenticated User Menu */
                <>
                  {/* Quick Actions */}
                  <div className="hidden sm:flex items-center space-x-3">
                    <Link 
                      to="/upload" 
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      📤 Upload
                    </Link>
                    <Link 
                      to="/dashboard" 
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      📊 Dashboard
                    </Link>
                  </div>

                  {/* User Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
                    >
                      <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </div>
                      <div className="hidden sm:block text-left">
                        <p className="text-sm font-medium">{user.firstName}</p>
                      </div>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        {/* User Info */}
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-gray-500">@{user.username}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        
                        {/* Menu Items */}
                        <Link
                          to="/dashboard"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Dashboard
                        </Link>
                        
                        <Link
                          to="/upload"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:hidden"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Upload Images
                        </Link>
                        
                        <Link
                          to="/history"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Job History
                        </Link>
                        
                        <Link
                          to="/profile"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Profile Settings
                        </Link>
                        
                        <hr className="my-2" />
                        
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Unauthenticated User Options */
                <>
                  <span className="text-sm text-gray-500 hidden sm:inline">AI-Powered Image Processing</span>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={handleLoginClick}
                      variant="outline"
                      size="sm"
                      className="text-sm"
                    >
                      Sign In
                    </Button>
                    <Button
                      onClick={handleRegisterClick}
                      size="sm"
                      className="text-sm bg-blue-600 hover:bg-blue-700"
                    >
                      Sign Up
                    </Button>
                  </div>
                </>
              )}
            </nav>
          </div>
        </Container>

        {/* Close user menu when clicking outside */}
        {showUserMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
        )}
      </header>
      
      <main className="flex-1 py-6 sm:py-8">
        <Container>
          {children || <Outlet />}
        </Container>
      </main>
      
      <footer className="bg-white border-t mt-auto">
        <Container>
          <div className="py-4">
            <p className="text-xs sm:text-sm text-gray-500 text-center">
              Image Aspect Ratio Converter - Intelligent cropping with AI
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default Layout;