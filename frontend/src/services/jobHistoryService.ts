/**
 * Job History Service
 * 
 * Purpose: Frontend service for managing job history operations including
 * fetching, filtering, searching, and managing user job data. Provides
 * comprehensive API integration for the job history feature.
 * 
 * Usage:
 * ```typescript
 * const jobHistory = await jobHistoryService.getJobHistory({
 *   page: 1,
 *   limit: 20,
 *   status: 'completed'
 * });
 * ```
 * 
 * Key Features:
 * - Comprehensive job history retrieval with pagination
 * - Advanced filtering and search capabilities
 * - Job statistics and analytics
 * - Job management (update, delete)
 * - Export functionality
 * - Real-time data updates
 * 
 * Updates:
 * - Initial implementation with comprehensive job history features
 * - Added TypeScript interfaces for type safety
 * - Integrated with existing authentication system
 * - Added error handling and loading states
 */

import { Job, JobProgress, ProcessingOptions } from '../types';

export interface JobHistoryFilters {
  status?: 'pending' | 'processing' | 'composing' | 'generating_pdf' | 'completed' | 'failed' | 'cancelled';
  dateFrom?: string;
  dateTo?: string;
  aspectRatio?: string;
  search?: string;
  isPublic?: boolean;
}

export interface JobHistoryPagination {
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'completedAt' | 'status' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface JobHistoryResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: JobHistoryFilters;
  statistics: JobStatistics;
}

export interface JobStatistics {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  cancelled: number;
  completionRate: number;
  averageProcessingTime: number;
  totalFilesProcessed: number;
  mostUsedAspectRatio: string;
  recentActivity: {
    last7Days: number;
    last30Days: number;
  };
}

export interface JobUpdateData {
  title?: string;
  isPublic?: boolean;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  includeFiles?: boolean;
  includeProgress?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface FilterOptions {
  status: string[];
  aspectRatios: string[];
  dateRange: {
    min: string;
    max: string;
  } | null;
}

class JobHistoryService {
  private baseUrl = '/api/job-history';

  /**
   * Get comprehensive job history with filtering and pagination
   * 
   * @param filters - Optional filters to apply
   * @param pagination - Pagination options
   * @returns Promise<JobHistoryResponse> - Paginated job history with statistics
   */
  async getJobHistory(
    filters: JobHistoryFilters = {},
    pagination: JobHistoryPagination = { page: 1, limit: 20 }
  ): Promise<JobHistoryResponse> {
    try {
      const params = new URLSearchParams();
      
      // Add pagination params
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      
      if (pagination.sortBy) {
        params.append('sortBy', pagination.sortBy);
      }
      if (pagination.sortOrder) {
        params.append('sortOrder', pagination.sortOrder);
      }

      // Add filter params
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }
      if (filters.aspectRatio) {
        params.append('aspectRatio', filters.aspectRatio);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.isPublic !== undefined) {
        params.append('isPublic', filters.isPublic.toString());
      }

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in to view job history.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch job history');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching job history:', error);
      throw error;
    }
  }

  /**
   * Search jobs with advanced filtering
   * 
   * @param query - Search query string
   * @param filters - Additional filters to apply
   * @param pagination - Pagination options
   * @returns Promise<JobHistoryResponse> - Search results with pagination
   */
  async searchJobs(
    query: string,
    filters: JobHistoryFilters = {},
    pagination: JobHistoryPagination = { page: 1, limit: 20 }
  ): Promise<JobHistoryResponse> {
    try {
      const params = new URLSearchParams();
      
      // Add search query
      params.append('q', query);
      
      // Add pagination params
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      
      if (pagination.sortBy) {
        params.append('sortBy', pagination.sortBy);
      }
      if (pagination.sortOrder) {
        params.append('sortOrder', pagination.sortOrder);
      }

      // Add filter params
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }
      if (filters.aspectRatio) {
        params.append('aspectRatio', filters.aspectRatio);
      }
      if (filters.isPublic !== undefined) {
        params.append('isPublic', filters.isPublic.toString());
      }

      const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in to search jobs.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search jobs');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error searching jobs:', error);
      throw error;
    }
  }

  /**
   * Get job statistics
   * 
   * @param dateFrom - Optional start date for statistics
   * @param dateTo - Optional end date for statistics
   * @returns Promise<JobStatistics> - Job statistics
   */
  async getJobStatistics(dateFrom?: string, dateTo?: string): Promise<JobStatistics> {
    try {
      const params = new URLSearchParams();
      
      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.append('dateTo', dateTo);
      }

      const response = await fetch(`${this.baseUrl}/statistics?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in to view job statistics.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch job statistics');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching job statistics:', error);
      throw error;
    }
  }

  /**
   * Get recent jobs
   * 
   * @param limit - Number of recent jobs to return
   * @returns Promise<Job[]> - Array of recent jobs
   */
  async getRecentJobs(limit: number = 10): Promise<Job[]> {
    try {
      const response = await fetch(`${this.baseUrl}/recent?limit=${limit}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in to view recent jobs.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch recent jobs');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching recent jobs:', error);
      throw error;
    }
  }

  /**
   * Get detailed job information
   * 
   * @param jobId - Job ID to retrieve
   * @returns Promise<Job | null> - Job details or null if not found
   */
  async getJobDetails(jobId: string): Promise<Job | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${jobId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch job details');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching job details:', error);
      throw error;
    }
  }

  /**
   * Update job title or visibility
   * 
   * @param jobId - Job ID to update
   * @param updates - Updates to apply
   * @returns Promise<boolean> - True if updated successfully
   */
  async updateJob(jobId: string, updates: JobUpdateData): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/${jobId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update job');
      }

      return true;
    } catch (error) {
      console.error('Error updating job:', error);
      throw error;
    }
  }

  /**
   * Delete a job
   * 
   * @param jobId - Job ID to delete
   * @returns Promise<boolean> - True if deleted successfully
   */
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete job');
      }

      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      throw error;
    }
  }

  /**
   * Export job history data
   * 
   * @param options - Export options
   * @returns Promise<Blob> - Exported data as blob
   */
  async exportJobHistory(options: ExportOptions): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      
      params.append('format', options.format);
      if (options.includeFiles) {
        params.append('includeFiles', 'true');
      }
      if (options.includeProgress) {
        params.append('includeProgress', 'true');
      }
      if (options.dateFrom) {
        params.append('dateFrom', options.dateFrom);
      }
      if (options.dateTo) {
        params.append('dateTo', options.dateTo);
      }

      const response = await fetch(`${this.baseUrl}/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to export job history');
      }

      return response.blob();
    } catch (error) {
      console.error('Error exporting job history:', error);
      throw error;
    }
  }

  /**
   * Get available filter options
   * 
   * @returns Promise<FilterOptions> - Available filter options
   */
  async getFilterOptions(): Promise<FilterOptions> {
    try {
      const response = await fetch(`${this.baseUrl}/filters/options`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch filter options');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw error;
    }
  }

  /**
   * Download exported job history file
   * 
   * @param blob - Blob data to download
   * @param filename - Filename for the download
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

// Singleton instance
export const jobHistoryService = new JobHistoryService();
export default jobHistoryService;
