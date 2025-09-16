/**
 * Reset Password Page
 * 
 * Purpose: Provides a dedicated page for password reset functionality
 * that extracts the reset token from URL parameters and displays
 * the ResetPassword component.
 * 
 * Usage:
 * Navigate to /reset-password?token=<reset_token>
 * 
 * Features:
 * - Extracts reset token from URL parameters
 * - Displays ResetPassword component
 * - Handles missing or invalid tokens
 * - Redirects to login on success
 * - Responsive design for all devices
 * 
 * Integration:
 * - Uses React Router for navigation
 * - Integrates with ResetPassword component
 * - Handles URL parameter extraction
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ResetPassword from '../components/ResetPassword';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    const resetToken = searchParams.get('token');
    
    if (!resetToken) {
      setIsValidToken(false);
      return;
    }

    // Basic token validation (should be a UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resetToken)) {
      setIsValidToken(false);
      return;
    }

    setToken(resetToken);
    setIsValidToken(true);
  }, [searchParams]);

  const handleSuccess = () => {
    navigate('/login', { 
      state: { 
        message: 'Password reset successfully. Please log in with your new password.' 
      } 
    });
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (isValidToken === null) {
    // Loading state
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-blue-600 animate-spin" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Validating Reset Token</h2>
            <p className="text-gray-600 mt-2">Please wait while we validate your reset token...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    // Invalid or missing token
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="w-full max-w-lg mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-red-600" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                  />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Invalid Reset Link
              </h2>
              
              <p className="text-gray-600 mb-6">
                The password reset link is invalid or has expired. Please request a new password reset.
              </p>
              
              <div className="space-y-4">
                <Button
                  onClick={() => navigate('/login')}
                  variant="primary"
                  className="w-full"
                >
                  Back to Login
                </Button>
                
                <p className="text-sm text-gray-500">
                  Need a new reset link?{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Request a new one
                  </button>
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Valid token - show reset password form
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <ResetPassword
          token={token!}
          onSuccess={handleSuccess}
          onBackToLogin={handleBackToLogin}
        />
      </div>
    </div>
  );
};

export default ResetPasswordPage;
