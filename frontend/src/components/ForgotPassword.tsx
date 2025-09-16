/**
 * Forgot Password Component
 * 
 * Purpose: Provides user interface for initiating password reset process
 * with email validation, error handling, and responsive design.
 * 
 * Usage:
 * ```tsx
 * <ForgotPassword
 *   onSuccess={() => setShowSuccess(true)}
 *   onBackToLogin={() => setShowForgotPassword(false)}
 * />
 * ```
 * 
 * Features:
 * - Email validation with real-time feedback
 * - Loading states and error handling
 * - Success confirmation display
 * - Responsive design for all devices
 * - Accessibility compliant
 * - Integration with backend forgot password API
 * 
 * Integration:
 * - Uses authService for API calls
 * - Validates email format
 * - Shows appropriate success/error messages
 * - Handles keyboard navigation
 */

import React, { useState, useRef, useEffect } from 'react';
import { authService } from '../services/authService';
import Button from './ui/Button';
import Card from './ui/Card';

interface ForgotPasswordProps {
  onSuccess?: () => void;
  onBackToLogin?: () => void;
  className?: string;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({
  onSuccess,
  onBackToLogin,
  className = ''
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus email input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (emailRef.current) {
        emailRef.current.focus();
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  /**
   * Validate email format
   */
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!email.trim()) {
      newErrors.push('Email is required');
    } else if (!validateEmail(email.trim())) {
      newErrors.push('Please enter a valid email address');
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
      const result = await authService.forgotPassword(email.trim());
      
      if (result.success) {
        setIsSuccess(true);
        setMessage(result.message || 'Password reset instructions have been sent to your email.');
        onSuccess?.();
      } else {
        setErrors([result.message || 'Failed to send password reset email. Please try again.']);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
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
    setEmail('');
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
            Check Your Email
          </h2>
          
          <p className="text-gray-600 mb-6">
            {message}
          </p>
          
          <div className="space-y-4">
            <Button
              onClick={handleBackToLogin}
              variant="outline"
              className="w-full"
            >
              Back to Login
            </Button>
            
            <p className="text-sm text-gray-500">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                try again
              </button>
            </p>
          </div>
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
          Forgot Password?
        </h2>
        
        <p className="text-gray-600">
          Enter your email address and we'll send you a link to reset your password.
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

        {/* Email Input */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            ref={emailRef}
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email address"
            disabled={isSubmitting}
            autoComplete="email"
            required
          />
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
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPassword;
