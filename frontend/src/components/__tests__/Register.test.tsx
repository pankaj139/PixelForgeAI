/**
 * @fileoverview Test suite for Register Component
 * 
 * This file contains comprehensive unit tests for the Register component, covering:
 * - Component rendering and form elements
 * - Form validation (username, email, password, confirm password)
 * - Password strength requirements
 * - Successful registration submission
 * - Error handling for registration failures
 * - Loading states during registration
 * - Navigation between register and login forms
 * - Password visibility toggle functionality
 * 
 * Tests ensure the register component works correctly with authentication flow.
 * 
 * @usage npm test -- src/components/__tests__/Register.test.tsx
 * @expected-returns Test results with coverage for all registration functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Register from '../Register';
import { useAuth } from '../../hooks/useAuth';

// Mock the useAuth hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});


const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

describe('Register', () => {
  const mockUseAuth = vi.mocked(useAuth);
  const mockRegister = vi.fn();
  
  const defaultProps = {
    onSuccess: vi.fn(),
    onSwitchToLogin: vi.fn(),
    onToggleMode: vi.fn()
  };

  // Helper to create complete UseAuthReturn mock
  const createMockAuthReturn = (overrides: any = {}) => ({
    isAuthenticated: false,
    user: null,
    loading: false,
    token: null,
    login: vi.fn().mockResolvedValue({ success: false }),
    register: mockRegister.mockResolvedValue({ success: false }),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAllDevices: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn().mockResolvedValue({ success: false }),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    validateSession: vi.fn().mockResolvedValue(false),
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    defaultProps.onSuccess.mockClear();
    defaultProps.onSwitchToLogin.mockClear();
    defaultProps.onToggleMode.mockClear();
    mockUseAuth.mockReturnValue(createMockAuthReturn({
      register: mockRegister
    }));
  });

  it('renders register form correctly', () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getAllByText('Create Account')[0]).toBeInTheDocument();
    expect(screen.getByText('Join the AI-powered image processing platform')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
  });

  it('prevents submission with empty username', async () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    // Submit button should be disabled when required fields are empty
    expect(submitButton).toBeDisabled();
    
    // Even clicking shouldn't trigger form submission
    fireEvent.click(submitButton);
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('prevents submission with short username', async () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    // Enter short username (less than 3 characters)
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    
    // Submit button should be disabled or form validation should prevent submission
    fireEvent.click(submitButton);

    // Form submission should not occur with invalid data
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('prevents submission with invalid email', async () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    // Form submission should not occur with invalid email
    await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows password strength feedback for weak password', async () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const passwordInput = screen.getByLabelText('Password');

    // Enter a weak password
    fireEvent.change(passwordInput, { target: { value: '123' } });

    // Check that password strength is shown as Weak
    expect(screen.getByText('Weak')).toBeInTheDocument();
    
    // Check that requirements are displayed
    expect(screen.getByText('At least 8 characters long')).toBeInTheDocument();
    expect(screen.getByText('At least one uppercase letter')).toBeInTheDocument();
    
    // Submit button should be disabled due to weak password
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    expect(submitButton).toBeDisabled();
  });

  it('shows validation errors for mismatched passwords', async () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    mockRegister.mockResolvedValue({ success: true });

    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    // Fill all required form fields
    const firstNameInput = screen.getByLabelText('First Name');
    const lastNameInput = screen.getByLabelText('Last Name');
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const acceptTermsCheckbox = screen.getByRole('checkbox', { name: /I agree to the/ });
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } }); // Strong password
    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.click(acceptTermsCheckbox); // Accept terms

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        username: 'testuser',
        email: 'test@example.com',
        password: 'StrongPassword123!'
      }, false); // rememberMe is false by default
    });
  });

  it('shows loading state during registration', async () => {
    // Mock a pending register call to trigger isSubmitting state
    mockRegister.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ success: true }), 100);
    }));

    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    // Fill out form to enable submission
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const firstNameInput = screen.getByLabelText('First Name');
    const lastNameInput = screen.getByLabelText('Last Name');
    const acceptTermsCheckbox = screen.getByRole('checkbox', { name: /I agree to the/ });
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.click(acceptTermsCheckbox);

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitButton);

    // Check loading state appears
    expect(screen.getByRole('button', { name: 'Creating Account...' })).toBeInTheDocument();
  });

  it('shows error message when registration fails', async () => {
    mockRegister.mockResolvedValue({
      success: false,
      errors: ['Username already exists']
    });

    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    // Fill out form and submit to trigger the error
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const firstNameInput = screen.getByLabelText('First Name');
    const lastNameInput = screen.getByLabelText('Last Name');
    const acceptTermsCheckbox = screen.getByRole('checkbox', { name: /I agree to the/ });
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.click(acceptTermsCheckbox);

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });
    
    // The Register component doesn't add role="alert" - let's just check for the error container
    expect(screen.getByText('Please correct the following errors:')).toBeInTheDocument();
  });

  it('calls onToggleMode when sign in link is clicked', () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const signInLink = screen.getByText('Sign in to your account');
    fireEvent.click(signInLink);

    expect(defaultProps.onSwitchToLogin).toHaveBeenCalled();
  });

  it('toggles password visibility', () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const passwordInput = screen.getByLabelText('Password');
    // Find the password toggle button (it's the button next to the password input)
    const passwordToggle = screen.getByRole('button', { name: '' }); // The toggle button has no accessible name

    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle to show password
    fireEvent.click(passwordToggle);
    expect(passwordInput).toHaveAttribute('type', 'text');

    // Click toggle again to hide password
    fireEvent.click(passwordToggle);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('confirm password field works correctly', () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    
    // Initially password should be hidden
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    
    // Test that we can input text
    fireEvent.change(confirmPasswordInput, { target: { value: 'test123' } });
    expect(confirmPasswordInput).toHaveValue('test123');
  });

  it('shows password strength indicator', () => {
    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const passwordInput = screen.getByLabelText('Password');

    // Test weak password
    fireEvent.change(passwordInput, { target: { value: '123' } });
    expect(screen.getByText('Weak')).toBeInTheDocument();

    // Test fair password (component shows "Fair", not "Medium")
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    expect(screen.getByText('Fair')).toBeInTheDocument();

    // Test strong password
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('calls onSuccess after successful submission', async () => {
    mockRegister.mockResolvedValue({ success: true });

    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    // Fill all required fields
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } }); // Strong password
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });
    
    // Check required checkbox (use the input id instead of complex label text)
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the/ }));
    
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    // Check that onSuccess was called (Register component doesn't clear form automatically)
    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('calls onSuccess callback after successful registration', async () => {
    mockRegister.mockResolvedValue({ success: true });

    render(
      <TestWrapper>
        <Register {...defaultProps} />
      </TestWrapper>
    );

    // Fill out form and submit
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const firstNameInput = screen.getByLabelText('First Name');
    const lastNameInput = screen.getByLabelText('Last Name');
    const acceptTermsCheckbox = screen.getByRole('checkbox', { name: /I agree to the/ });
    
    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
    fireEvent.click(acceptTermsCheckbox);

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitButton);

    // Should call onSuccess callback after successful registration
    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });
});
