/**
 * Authentication Page
 * 
 * Purpose: Combined authentication page that handles both login and registration
 * flows with smooth transitions and comprehensive user experience.
 * 
 * Usage:
 * ```tsx
 * <Route path="/auth" element={<AuthPage />} />
 * ```
 * 
 * Features:
 * - Unified login and registration interface
 * - Smooth transitions between forms
 * - Responsive design for all devices
 * - Automatic redirect after authentication
 * - Loading states and error handling
 * - Social authentication preparation
 * 
 * Navigation:
 * - Redirects authenticated users to dashboard
 * - Supports return URL after authentication
 * - Handles authentication state changes
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Login from '../components/Login';
import Register from '../components/Register';
import Container from '../components/ui/Container';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  
  // Determine initial mode from URL parameters
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode);
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, returnUrl]);

  const handleAuthSuccess = () => {
    navigate(returnUrl, { replace: true });
  };

  const switchToRegister = () => {
    setAuthMode('register');
    // Update URL without triggering navigation
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', 'register');
    window.history.replaceState({}, '', `${window.location.pathname}?${newParams}`);
  };

  const switchToLogin = () => {
    setAuthMode('login');
    // Update URL without triggering navigation
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('mode');
    window.history.replaceState({}, '', `${window.location.pathname}?${newParams}`);
  };

  // Show loading if checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Container className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              AI Image Processing Platform
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transform your images with intelligent cropping, AI-powered naming, 
              and professional sheet composition. Join thousands of users creating 
              perfect images effortlessly.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Column - Features & Benefits */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Why Join Our Platform?
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        🤖
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        AI-Powered Intelligence
                      </h3>
                      <p className="text-gray-600 mt-1">
                        Advanced computer vision detects faces and people for perfect cropping. 
                        AI generates descriptive filenames and Instagram-ready content automatically.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        📊
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Real-Time Progress Tracking
                      </h3>
                      <p className="text-gray-600 mt-1">
                        Watch your images process in real-time with accurate progress bars, 
                        time estimates, and stage-by-stage updates.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        📋
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Professional Sheet Composition
                      </h3>
                      <p className="text-gray-600 mt-1">
                        Create beautiful A4 photo sheets with flexible layouts and 
                        generate downloadable PDFs for printing.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        ⏱️
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Complete Job History
                      </h3>
                      <p className="text-gray-600 mt-1">
                        Access your processing history, redownload results, and track 
                        your usage statistics with detailed analytics.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Statistics</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">10K+</div>
                    <div className="text-sm text-gray-600">Images Processed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">500+</div>
                    <div className="text-sm text-gray-600">Happy Users</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">99.9%</div>
                    <div className="text-sm text-gray-600">Success Rate</div>
                  </div>
                </div>
              </div>

              {/* Testimonial */}
              <div className="bg-gray-50 rounded-xl p-6 border-l-4 border-blue-500">
                <blockquote className="text-gray-700 italic">
                  "This platform has revolutionized how I process family photos. The AI naming 
                  feature alone saves me hours, and the Instagram content generation is perfect 
                  for my social media posts!"
                </blockquote>
                <div className="mt-3 text-sm">
                  <span className="font-medium text-gray-900">Sarah Johnson</span>
                  <span className="text-gray-500"> • Professional Photographer</span>
                </div>
              </div>
            </div>

            {/* Right Column - Authentication Form */}
            <div className="lg:sticky lg:top-8">
              {authMode === 'login' ? (
                <Login
                  onSuccess={handleAuthSuccess}
                  onSwitchToRegister={switchToRegister}
                />
              ) : (
                <Register
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={switchToLogin}
                />
              )}
              
              {/* Demo Section */}
              <div className="mt-8 text-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800">
                      Try without account
                    </span>
                  </div>
                  <p className="text-xs text-yellow-700 mb-3">
                    Want to test the platform first?
                  </p>
                  <button
                    onClick={() => navigate('/upload')}
                    className="text-sm text-yellow-800 hover:text-yellow-900 underline font-medium"
                  >
                    Continue as Guest
                  </button>
                  <p className="text-xs text-yellow-600 mt-2">
                    Note: Guest sessions don't save history or preferences
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 text-center text-sm text-gray-500">
            <p>
              By using our platform, you agree to our{' '}
              <button 
                className="text-blue-600 hover:text-blue-800 underline"
                onClick={() => alert('Terms coming soon!')}
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button 
                className="text-blue-600 hover:text-blue-800 underline"
                onClick={() => alert('Privacy Policy coming soon!')}
              >
                Privacy Policy
              </button>
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default AuthPage;
