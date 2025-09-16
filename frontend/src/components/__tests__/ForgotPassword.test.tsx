/**
 * ForgotPassword Component Tests
 * 
 * Purpose: Comprehensive test suite for the ForgotPassword component
 * covering user interactions, form validation, API integration,
 * and error handling scenarios.
 * 
 * Test Coverage:
 * - Component rendering and initial state
 * - Form validation and error handling
 * - User interactions (typing, submitting)
 * - API integration and success/error states
 * - Accessibility and keyboard navigation
 * - Responsive design elements
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ForgotPassword from '../ForgotPassword';
import { authService } from '../../services/authService';

// Mock the authService
vi.mock('../../services/authService', () => ({
  authService: {
    forgotPassword: vi.fn()
  }
}));

// Mock the Button component
vi.mock('../ui/Button', () => ({
  default: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      data-testid="submit-button"
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}));

// Mock the Card component
vi.mock('../ui/Card', () => ({
  default: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card" {...props}>
      {children}
    </div>
  )
}));

describe('ForgotPassword Component', () => {
  const mockOnSuccess = vi.fn();
  const mockOnBackToLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the forgot password form correctly', () => {
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
      expect(screen.getByText('Enter your email address and we\'ll send you a link to reset your password.')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();
      expect(screen.getByText('← Back to Login')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <ForgotPassword
          className="custom-class"
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
    });
  });

  describe('Form Validation', () => {
    it('shows error for empty email', async () => {
      const user = userEvent.setup();
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('shows error for invalid email format', async () => {
      const user = userEvent.setup();
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    it('accepts valid email format', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('updates email input value when typing', async () => {
      const user = userEvent.setup();
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('submits form when Enter key is pressed', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('calls onBackToLogin when back button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const backButton = screen.getByText('← Back to Login');
      await user.click(backButton);

      expect(mockOnBackToLogin).toHaveBeenCalled();
    });
  });

  describe('API Integration', () => {
    it('calls authService.forgotPassword with correct email on successful submission', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('shows success message when password reset request is successful', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check Your Email')).toBeInTheDocument();
        expect(screen.getByText('Password reset instructions have been sent to your email.')).toBeInTheDocument();
      });
    });

    it('shows error message when password reset request fails', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: false,
        error: 'Failed to send password reset email'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to send password reset email')).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockRejectedValue(new Error('Network error'));

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('disables form inputs during submission', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      expect(emailInput).toBeDisabled();
    });
  });

  describe('Success State', () => {
    it('shows success screen after successful submission', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check Your Email')).toBeInTheDocument();
        expect(screen.getByText('Password reset instructions have been sent to your email.')).toBeInTheDocument();
        expect(screen.getByText('Back to Login')).toBeInTheDocument();
        expect(screen.getByText('try again')).toBeInTheDocument();
      });
    });

    it('calls onSuccess when password reset request is successful', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('allows retry from success screen', async () => {
      const user = userEvent.setup();
      (authService.forgotPassword as any).mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });

      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check Your Email')).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByText('try again');
      await user.click(tryAgainButton);

      expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('has proper button labels', () => {
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '← Back to Login' })).toBeInTheDocument();
    });

    it('focuses email input on mount', () => {
      render(
        <ForgotPassword
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      expect(emailInput).toHaveFocus();
    });
  });
});
