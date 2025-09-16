/**
 * Reset Password Component
 * 
 * Purpose: Provides user interface for resetting password using a token
 * with password validation, error handling, and responsive design.
 * 
 * Usage:
 * ```tsx
 * <ResetPassword
 *   token={resetToken}
 *   onSuccess={() => navigate('/login')}
 *   onBackToLogin={() => navigate('/login')}
 * />
 * ```
 * 
 * Features:
 * - Password strength validation with real-time feedback
 * - Confirm password matching
 * - Loading states and error handling
 * - Success confirmation display
 * - Responsive design for all devices
 * - Accessibility compliant
 * - Integration with backend reset password API
 * 
 * Integration:
 * - Uses authService for API calls
 * - Validates password strength requirements
 * - Shows appropriate success/error messages
 * - Handles keyboard navigation
 */

import React, { useState, useRef, useEffect } from 'react';
import { authService } from '../services/authService';
import Button from './ui/Button';
import Card from './ui/Card';

interface ResetPasswordProps {
  token: string;
  onSuccess?: () => void;
  onBackToLogin?: () => void;
  className?: string;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({
  token,
  onSuccess,
  onBackToLogin,
  className = ''
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  
  const passwordRef = useRef<HTMLInputElement>(null);

  // Focus password input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (passwordRef.current) {
        passwordRef.current.focus();
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  /**
   * Validate password strength
   */
  const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!newPassword) {
      newErrors.push('New password is required');
    } else {
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        newErrors.push(...passwordValidation.errors);
      }
    }

    if (!confirmPassword) {
      newErrors.push('Please confirm your password');
    } else if (newPassword !== confirmPassword) {
      newErrors.push('Passwords do not match');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors([]);
    setMessage('');
    
    try {
      const result = await authService.resetPassword(token, newPassword);
      
      if (result.success) {
        setIsSuccess(true);
        setMessage(result.message || 'Your password has been reset successfully.');
        onSuccess?.();
      } else {
        setErrors([result.message || 'Failed to reset password. Please try again.']);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setErrors(['An unexpected error occurred. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle key press events
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit(e as any);
    }
  };

  /**
   * Handle back to login
   */
  const handleBackToLogin = () => {
    setNewPassword('');
    setConfirmPassword('');
    setErrors([]);
    setMessage('');
    setIsSuccess(false);
    onBackToLogin?.();
  };

  if (isSuccess) {
    return (
      <Card className={`w-full max-w-lg mx-auto ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-green-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Password Reset Successfully
          </h2>
          
          <p className="text-gray-600 mb-6">
            {message}
          </p>
          
          <Button
            onClick={handleBackToLogin}
            variant="primary"
            className="w-full"
          >
            Continue to Login
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`w-full max-w-lg mx-auto ${className}`}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-blue-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" 
            />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Reset Your Password
        </h2>
        
        <p className="text-gray-600">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg 
                  className="h-5 w-5 text-red-400" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Please correct the following errors:
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Password Input */}
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <input
            ref={passwordRef}
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your new password"
            disabled={isSubmitting}
            autoComplete="new-password"
            required
          />
        </div>

        {/* Confirm Password Input */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Confirm your new password"
            disabled={isSubmitting}
            autoComplete="new-password"
            required
          />
        </div>

        {/* Password Requirements */}
        <div className="bg-gray-50 rounded-md p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className={`flex items-center ${newPassword.length >= 8 ? 'text-green-600' : ''}`}>
              <span className="mr-2">{newPassword.length >= 8 ? '✓' : '○'}</span>
              At least 8 characters long
            </li>
            <li className={`flex items-center ${/(?=.*[a-z])/.test(newPassword) ? 'text-green-600' : ''}`}>
              <span className="mr-2">{/(?=.*[a-z])/.test(newPassword) ? '✓' : '○'}</span>
              One lowercase letter
            </li>
            <li className={`flex items-center ${/(?=.*[A-Z])/.test(newPassword) ? 'text-green-600' : ''}`}>
              <span className="mr-2">{/(?=.*[A-Z])/.test(newPassword) ? '✓' : '○'}</span>
              One uppercase letter
            </li>
            <li className={`flex items-center ${/(?=.*\d)/.test(newPassword) ? 'text-green-600' : ''}`}>
              <span className="mr-2">{/(?=.*\d)/.test(newPassword) ? '✓' : '○'}</span>
              One number
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
        </Button>

        {/* Back to Login */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="text-sm text-gray-600 hover:text-gray-500 font-medium"
            disabled={isSubmitting}
          >
            ← Back to Login
          </button>
        </div>
      </form>
    </Card>
  );
};

export default ResetPassword;
