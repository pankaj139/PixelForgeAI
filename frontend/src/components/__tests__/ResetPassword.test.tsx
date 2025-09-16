/**
 * ResetPassword Component Tests
 * 
 * Purpose: Comprehensive test suite for the ResetPassword component
 * covering user interactions, form validation, API integration,
 * and error handling scenarios.
 * 
 * Test Coverage:
 * - Component rendering and initial state
 * - Password validation and strength requirements
 * - User interactions (typing, submitting)
 * - API integration and success/error states
 * - Accessibility and keyboard navigation
 * - Password confirmation matching
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ResetPassword from '../ResetPassword';
import { authService } from '../../services/authService';

// Mock the authService
vi.mock('../../services/authService', () => ({
  authService: {
    resetPassword: vi.fn()
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

describe('ResetPassword Component', () => {
  const mockToken = 'test-reset-token-123';
  const mockOnSuccess = vi.fn();
  const mockOnBackToLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the reset password form correctly', () => {
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
      expect(screen.getByText('Enter your new password below.')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
      expect(screen.getByText('← Back to Login')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <ResetPassword
          token={mockToken}
          className="custom-class"
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
    });

    it('shows password requirements', () => {
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      expect(screen.getByText('Password Requirements:')).toBeInTheDocument();
      expect(screen.getByText('At least 8 characters long')).toBeInTheDocument();
      expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
      expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
      expect(screen.getByText('One number')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows error for empty new password', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('New password is required')).toBeInTheDocument();
    });

    it('shows error for empty confirm password', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    });

    it('shows error for passwords that do not match', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'DifferentPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    it('shows error for weak password (too short)', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'weak');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'weak');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
    });

    it('shows error for password without lowercase letter', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'PASSWORD123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'PASSWORD123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('Password must contain at least one lowercase letter')).toBeInTheDocument();
    });

    it('shows error for password without uppercase letter', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'password123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('Password must contain at least one uppercase letter')).toBeInTheDocument();
    });

    it('shows error for password without number', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'Password');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'Password');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
    });

    it('accepts valid password', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.'
      });

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.queryByText('Password must be at least 8 characters long')).not.toBeInTheDocument();
      expect(screen.queryByText('Password must contain at least one lowercase letter')).not.toBeInTheDocument();
      expect(screen.queryByText('Password must contain at least one uppercase letter')).not.toBeInTheDocument();
      expect(screen.queryByText('Password must contain at least one number')).not.toBeInTheDocument();
    });
  });

  describe('Password Requirements Visual Feedback', () => {
    it('shows checkmarks for met requirements', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      // Check that requirements show checkmarks
      const requirements = screen.getByText('Password Requirements:').parentElement;
      expect(requirements).toHaveTextContent('✓');
    });

    it('shows circles for unmet requirements', () => {
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      // Check that requirements show circles initially
      const requirements = screen.getByText('Password Requirements:').parentElement;
      expect(requirements).toHaveTextContent('○');
    });
  });

  describe('User Interactions', () => {
    it('updates password input values when typing', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      expect(newPasswordInput).toHaveValue('NewPassword123');
      expect(confirmPasswordInput).toHaveValue('NewPassword123');
    });

    it('submits form when Enter key is pressed', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.'
      });

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith(mockToken, 'NewPassword123');
      });
    });

    it('calls onBackToLogin when back button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ResetPassword
          token={mockToken}
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
    it('calls authService.resetPassword with correct parameters on successful submission', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.'
      });

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith(mockToken, 'NewPassword123');
      });
    });

    it('shows success message when password reset is successful', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.'
      });

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password Reset Successfully')).toBeInTheDocument();
        expect(screen.getByText('Password has been reset successfully.')).toBeInTheDocument();
      });
    });

    it('shows error message when password reset fails', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockResolvedValue({
        success: false,
        error: 'Invalid or expired reset token'
      });

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired reset token')).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockRejectedValue(new Error('Network error'));

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(screen.getByText('Resetting Password...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('disables form inputs during submission', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      expect(newPasswordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
    });
  });

  describe('Success State', () => {
    it('shows success screen after successful password reset', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.'
      });

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password Reset Successfully')).toBeInTheDocument();
        expect(screen.getByText('Password has been reset successfully.')).toBeInTheDocument();
        expect(screen.getByText('Continue to Login')).toBeInTheDocument();
      });
    });

    it('calls onSuccess when password reset is successful', async () => {
      const user = userEvent.setup();
      (authService.resetPassword as any).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.'
      });

      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      await user.type(newPasswordInput, 'NewPassword123');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      await user.type(confirmPasswordInput, 'NewPassword123');

      const submitButton = screen.getByRole('button', { name: 'Reset Password' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');

      expect(newPasswordInput).toBeInTheDocument();
      expect(newPasswordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toBeInTheDocument();
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    it('has proper button labels', () => {
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '← Back to Login' })).toBeInTheDocument();
    });

    it('focuses password input on mount', () => {
      render(
        <ResetPassword
          token={mockToken}
          onSuccess={mockOnSuccess}
          onBackToLogin={mockOnBackToLogin}
        />
      );

      const newPasswordInput = screen.getByLabelText('New Password');
      expect(newPasswordInput).toHaveFocus();
    });
  });
});
