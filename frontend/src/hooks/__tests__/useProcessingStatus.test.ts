import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi } from 'vitest';
import { useProcessingStatus } from '../useProcessingStatus';

// Mock the API client
vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('useProcessingStatus', () => {
  it('should initialize hook correctly', () => {
    const { result } = renderHook(
      () => useProcessingStatus(undefined),
      { wrapper: createWrapper() }
    );
    
    expect(result.current).toBeDefined();
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('should handle disabled state', () => {
    const { result } = renderHook(
      () => useProcessingStatus('test-job-id', false),
      { wrapper: createWrapper() }
    );
    
    expect(result.current).toBeDefined();
  });
});