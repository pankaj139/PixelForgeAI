import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Layout from '../Layout';

// Mock the Container component
vi.mock('../ui/Container', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="container">{children}</div>
  ),
}));

// Mock the useAuth hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn()
  }))
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Layout', () => {
  it('renders the main title', () => {
    renderWithRouter(<Layout />);
    
    expect(screen.getByText('🖼️ AI Image Processor')).toBeInTheDocument();
  });

  it('renders the footer text', () => {
    renderWithRouter(<Layout />);
    
    expect(screen.getByText(/Image Aspect Ratio Converter - Intelligent cropping with AI/)).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    renderWithRouter(<Layout />);
    
    expect(screen.getByRole('banner')).toBeInTheDocument(); // header
    expect(screen.getByRole('main')).toBeInTheDocument(); // main
    expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
  });

  it('shows Sign In and Sign Up buttons when user is not authenticated', () => {
    renderWithRouter(<Layout />);
    
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered Image Processing')).toBeInTheDocument();
  });
});