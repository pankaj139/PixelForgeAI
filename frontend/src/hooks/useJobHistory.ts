/**
 * Job History Hook
 * 
 * Purpose: Custom React hook for managing job history state, operations,
 * and data fetching. Provides comprehensive state management for the
 * job history feature with loading states, error handling, and caching.
 * 
 * Usage:
 * ```typescript
 * const {
 *   jobs,
 *   loading,
 *   error,
 *   pagination,
 *   statistics,
 *   fetchJobs,
 *   searchJobs,
 *   updateJob,
 *   deleteJob
 * } = useJobHistory();
 * ```
 * 
 * Key Features:
 * - Comprehensive job history state management
 * - Advanced filtering and search capabilities
 * - Pagination support with configurable limits
 * - Real-time statistics and analytics
 * - Job management operations (update, delete)
 * - Export functionality
 * - Error handling and loading states
 * - Optimistic updates for better UX
 * 
 * Updates:
 * - Initial implementation with comprehensive job history features
 * - Added TypeScript interfaces for type safety
 * - Integrated with existing authentication system
 * - Added error handling and loading states
 */

import { useState, useEffect, useCallback } from 'react';
import { jobHistoryService, JobHistoryFilters, JobHistoryPagination, JobHistoryResponse, JobStatistics, JobUpdateData, ExportOptions, FilterOptions } from '../services/jobHistoryService';
import { Job } from '../types';

export interface UseJobHistoryOptions {
  initialFilters?: JobHistoryFilters;
  initialPagination?: JobHistoryPagination;
  autoFetch?: boolean;
}

export interface UseJobHistoryReturn {
  // Data
  jobs: Job[];
  statistics: JobStatistics | null;
  filterOptions: FilterOptions | null;
  
  // State
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  
  // Filters
  filters: JobHistoryFilters;
  searchQuery: string;
  
  // Actions
  fetchJobs: (newFilters?: JobHistoryFilters, newPagination?: JobHistoryPagination) => Promise<void>;
  searchJobs: (query: string, newFilters?: JobHistoryFilters, newPagination?: JobHistoryPagination) => Promise<void>;
  updateFilters: (newFilters: Partial<JobHistoryFilters>) => void;
  updatePagination: (newPagination: Partial<JobHistoryPagination>) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  refreshJobs: () => Promise<void>;
  
  // Job operations
  updateJob: (jobId: string, updates: JobUpdateData) => Promise<boolean>;
  deleteJob: (jobId: string) => Promise<boolean>;
  getJobDetails: (jobId: string) => Promise<Job | null>;
  
  // Export
  exportJobs: (options: ExportOptions) => Promise<void>;
  
  // Statistics
  fetchStatistics: (dateFrom?: string, dateTo?: string) => Promise<void>;
  fetchFilterOptions: () => Promise<void>;
  
  // Recent jobs
  recentJobs: Job[];
  fetchRecentJobs: (limit?: number) => Promise<void>;
}

export const useJobHistory = (options: UseJobHistoryOptions = {}): UseJobHistoryReturn => {
  const {
    initialFilters = {},
    initialPagination = { page: 1, limit: 20 },
    autoFetch = true
  } = options;

  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [statistics, setStatistics] = useState<JobStatistics | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<JobHistoryFilters>(initialFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: initialPagination.page,
    limit: initialPagination.limit,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  /**
   * Fetch job history with current filters and pagination
   */
  const fetchJobs = useCallback(async (
    newFilters?: JobHistoryFilters,
    newPagination?: JobHistoryPagination
  ) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = newFilters || filters;
      const currentPagination = newPagination || {
        page: pagination.page,
        limit: pagination.limit,
        ...(initialPagination.sortBy && { sortBy: initialPagination.sortBy }),
        ...(initialPagination.sortOrder && { sortOrder: initialPagination.sortOrder })
      };

      const response = await jobHistoryService.getJobHistory(currentFilters, currentPagination);
      
      setJobs(response.jobs);
      setPagination(response.pagination);
      setStatistics(response.statistics);
      
      if (newFilters) {
        setFilters(currentFilters);
      }
      if (newPagination) {
        setPagination(prev => ({ ...prev, ...currentPagination }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch jobs';
      setError(errorMessage);
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination, initialPagination]);

  /**
   * Search jobs with query and filters
   */
  const searchJobs = useCallback(async (
    query: string,
    newFilters?: JobHistoryFilters,
    newPagination?: JobHistoryPagination
  ) => {
    try {
      setLoading(true);
      setError(null);
      setSearchQuery(query);

      const currentFilters = newFilters || filters;
      const currentPagination = newPagination || {
        page: pagination.page,
        limit: pagination.limit,
        ...(initialPagination.sortBy && { sortBy: initialPagination.sortBy }),
        ...(initialPagination.sortOrder && { sortOrder: initialPagination.sortOrder })
      };

      const response = await jobHistoryService.searchJobs(query, currentFilters, currentPagination);
      
      setJobs(response.jobs);
      setPagination(response.pagination);
      setStatistics(response.statistics);
      
      if (newFilters) {
        setFilters(currentFilters);
      }
      if (newPagination) {
        setPagination(prev => ({ ...prev, ...currentPagination }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search jobs';
      setError(errorMessage);
      console.error('Error searching jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination, initialPagination]);

  /**
   * Update filters and refetch data
   */
  const updateFilters = useCallback((newFilters: Partial<JobHistoryFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    fetchJobs(updatedFilters, { page: 1, limit: pagination.limit });
  }, [filters, pagination.limit, fetchJobs]);

  /**
   * Update pagination and refetch data
   */
  const updatePagination = useCallback((newPagination: Partial<JobHistoryPagination>) => {
    const updatedPagination = { ...pagination, ...newPagination };
    setPagination(prev => ({ ...prev, ...updatedPagination }));
    fetchJobs(filters, updatedPagination);
  }, [filters, pagination, fetchJobs]);

  /**
   * Clear all filters and search query
   */
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
    fetchJobs({}, { page: 1, limit: pagination.limit });
  }, [pagination.limit, fetchJobs]);

  /**
   * Refresh current job list
   */
  const refreshJobs = useCallback(async () => {
    if (searchQuery) {
      await searchJobs(searchQuery, filters, pagination);
    } else {
      await fetchJobs(filters, pagination);
    }
  }, [searchQuery, filters, pagination, searchJobs, fetchJobs]);

  /**
   * Update a job with optimistic updates
   */
  const updateJob = useCallback(async (jobId: string, updates: JobUpdateData): Promise<boolean> => {
    try {
      setError(null);

      // Optimistic update
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId 
            ? { ...job, ...updates }
            : job
        )
      );

      const success = await jobHistoryService.updateJob(jobId, updates);
      
      if (!success) {
        // Revert optimistic update on failure
        await refreshJobs();
        return false;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update job';
      setError(errorMessage);
      console.error('Error updating job:', err);
      
      // Revert optimistic update on error
      await refreshJobs();
      return false;
    }
  }, [refreshJobs]);

  /**
   * Delete a job with optimistic updates
   */
  const deleteJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      setError(null);

      // Optimistic update
      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      setPagination(prev => ({
        ...prev,
        total: prev.total - 1,
        totalPages: Math.ceil((prev.total - 1) / prev.limit)
      }));

      const success = await jobHistoryService.deleteJob(jobId);
      
      if (!success) {
        // Revert optimistic update on failure
        await refreshJobs();
        return false;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete job';
      setError(errorMessage);
      console.error('Error deleting job:', err);
      
      // Revert optimistic update on error
      await refreshJobs();
      return false;
    }
  }, [refreshJobs]);

  /**
   * Get detailed job information
   */
  const getJobDetails = useCallback(async (jobId: string): Promise<Job | null> => {
    try {
      setError(null);
      return await jobHistoryService.getJobDetails(jobId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get job details';
      setError(errorMessage);
      console.error('Error getting job details:', err);
      return null;
    }
  }, []);

  /**
   * Export job history data
   */
  const exportJobs = useCallback(async (options: ExportOptions) => {
    try {
      setError(null);
      setLoading(true);

      const blob = await jobHistoryService.exportJobHistory(options);
      const filename = `job-history-${new Date().toISOString().split('T')[0]}.${options.format}`;
      
      jobHistoryService.downloadFile(blob, filename);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export jobs';
      setError(errorMessage);
      console.error('Error exporting jobs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch job statistics
   */
  const fetchStatistics = useCallback(async (dateFrom?: string, dateTo?: string) => {
    try {
      setError(null);
      const stats = await jobHistoryService.getJobStatistics(dateFrom, dateTo);
      setStatistics(stats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch statistics';
      setError(errorMessage);
      console.error('Error fetching statistics:', err);
    }
  }, []);

  /**
   * Fetch available filter options
   */
  const fetchFilterOptions = useCallback(async () => {
    try {
      setError(null);
      const options = await jobHistoryService.getFilterOptions();
      setFilterOptions(options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch filter options';
      setError(errorMessage);
      console.error('Error fetching filter options:', err);
    }
  }, []);

  /**
   * Fetch recent jobs
   */
  const fetchRecentJobs = useCallback(async (limit: number = 10) => {
    try {
      setError(null);
      const recent = await jobHistoryService.getRecentJobs(limit);
      setRecentJobs(recent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch recent jobs';
      setError(errorMessage);
      console.error('Error fetching recent jobs:', err);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      // Make requests sequentially to avoid overwhelming the server
      const initializeData = async () => {
        try {
          await fetchJobs();
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
          await fetchStatistics();
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
          await fetchFilterOptions();
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
          await fetchRecentJobs();
        } catch (error) {
          console.error('Error initializing job history data:', error);
        }
      };
      
      initializeData();
    }
  }, [autoFetch, fetchJobs, fetchStatistics, fetchFilterOptions, fetchRecentJobs]);

  return {
    // Data
    jobs,
    statistics,
    filterOptions,
    
    // State
    loading,
    error,
    pagination,
    
    // Filters
    filters,
    searchQuery,
    
    // Actions
    fetchJobs,
    searchJobs,
    updateFilters,
    updatePagination,
    setSearchQuery,
    clearFilters,
    refreshJobs,
    
    // Job operations
    updateJob,
    deleteJob,
    getJobDetails,
    
    // Export
    exportJobs,
    
    // Statistics
    fetchStatistics,
    fetchFilterOptions,
    
    // Recent jobs
    recentJobs,
    fetchRecentJobs
  };
};

export default useJobHistory;
