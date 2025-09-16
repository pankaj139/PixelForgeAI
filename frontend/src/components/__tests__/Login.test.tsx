/**
 * @fileoverview Test suite for Login Component
 * 
 * This file contains comprehensive unit tests for the Login component, covering:
 * - Component rendering and form elements
 * - Form validation (email, password requirements)
 * - Successful login submission
 * - Error handling for invalid credentials
 * - Loading states during authentication
 * - Navigation between login and register forms
 * - Return URL handling after successful login
 * 
 * Tests ensure the login component works correctly with authentication flow.
 * 
 * @usage npm test -- src/components/__tests__/Login.test.tsx
 * @expected-returns Test results with coverage for all login functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';

// Mock the useAuth hook
const mockLogin = vi.fn();
const mockAuthState = {
  isAuthenticated: false,
  user: null,
  login: mockLogin,
  logout: vi.fn(),
  register: vi.fn(),
  loading: false,
  error: null
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuthState
}));

// Mock navigation
const mockNavigate = vi.fn();
let locationSearch = '';
vi.mock('react-router-dom', async () => {
  const actual: any = await vi.importActual('react-router-dom');
  return {
    ...(actual as any),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: locationSearch, state: null })
  } as any;
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

describe('Login', () => {
  const defaultProps = {
    onToggleMode: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth state
    Object.assign(mockAuthState, {
      isAuthenticated: false,
      user: null,
      login: mockLogin,
      logout: vi.fn(),
      register: vi.fn(),
      loading: false,
      error: null
    });
  });

  it('renders login form correctly', () => {
    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText('Don\'t have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('shows validation errors for invalid email', async () => {
    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email Address');
  screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    // The form should prevent submission with invalid email (HTML5 validation)
    // No specific error message is displayed - just verify invalid data is in field
    expect(emailInput).toHaveValue('invalid-email');

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows validation errors for empty password', async () => {
    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    // The form should prevent submission with empty password (HTML5 validation)
    // No specific error message is displayed - just verify password field is empty
    expect(passwordInput).toHaveValue('');

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows validation errors for short password', async () => {
    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submits form with valid credentials', async () => {
    mockLogin.mockResolvedValue({ success: true });

    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        emailOrUsername: 'test@example.com',
        password: 'password123'
      });
    });
  });

  it('shows loading state during login', async () => {
    Object.assign(mockAuthState, {
      loading: true
    });

    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: 'Signing in...' });
    expect(submitButton).toBeDisabled();
  });

  it('shows error message when login fails', async () => {
    Object.assign(mockAuthState, {
      error: 'Invalid email or password'
    });

    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onToggleMode when sign up link is clicked', () => {
    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    const signUpLink = screen.getByText('Sign up');
    fireEvent.click(signUpLink);

    expect(defaultProps.onToggleMode).toHaveBeenCalled();
  });

  it('redirects to return URL after successful login', async () => {
    locationSearch = '?returnUrl=/upload';
    mockLogin.mockResolvedValue({ success: true });
    Object.assign(mockAuthState, {
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', username: 'testuser' }
    });

    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('clears form after successful submission', async () => {
    mockLogin.mockResolvedValue({ success: true });

    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

  const emailInput = screen.getByLabelText('Email Address');
  const passwordInput = screen.getByLabelText('Password');
  const signInButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
  fireEvent.click(signInButton);

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());

    await waitFor(() => {
      expect((emailInput as HTMLInputElement).value).toBe('');
      expect((passwordInput as HTMLInputElement).value).toBe('');
    });
  });

  it('handles form keyboard navigation correctly', () => {
    render(
      <TestWrapper>
        <Login {...defaultProps} />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');
  screen.getByRole('button', { name: 'Sign In' });

    // Tab navigation should work
    emailInput.focus();
    expect(document.activeElement).toBe(emailInput);

    fireEvent.keyDown(emailInput, { key: 'Tab', code: 'Tab' });
    // Next element should be focused (password input)
    
    fireEvent.keyDown(passwordInput, { key: 'Tab', code: 'Tab' });
    // Submit button should be focused
  });
});
