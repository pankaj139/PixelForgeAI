/**
 * Job History Service
 * 
 * Purpose: Provides comprehensive job history management with advanced filtering,
 * search, pagination, and statistics. Handles user-specific job queries and
 * analytics for the job history feature.
 * 
 * Usage:
 * ```typescript
 * const jobHistory = await jobHistoryService.getUserJobHistory(userId, {
 *   page: 1,
 *   limit: 20,
 *   status: 'completed',
 *   search: 'vacation photos'
 * });
 * ```
 * 
 * Key Features:
 * - Advanced filtering by status, date range, aspect ratio
 * - Full-text search across job titles and file names
 * - Pagination with configurable limits
 * - Job statistics and analytics
 * - Export functionality for job data
 * - Real-time job count updates
 * 
 * Updates:
 * - Initial implementation with comprehensive job history features
 * - Added advanced filtering and search capabilities
 * - Integrated with existing job processing system
 */

import { getDatabase } from '../database/connection';
import { Job } from '../types';

export interface JobHistoryFilters {
  status?: 'pending' | 'processing' | 'composing' | 'generating_pdf' | 'completed' | 'failed' | 'cancelled';
  dateFrom?: Date;
  dateTo?: Date;
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
  averageProcessingTime: number; // in minutes
  totalFilesProcessed: number;
  mostUsedAspectRatio: string;
  recentActivity: {
    last7Days: number;
    last30Days: number;
  };
}

export interface JobExportOptions {
  format: 'json' | 'csv';
  includeFiles: boolean;
  includeProgress: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export class JobHistoryService {
  private db = getDatabase();

  /**
   * Retrieve a job by ID (simple pass-through used by instagram routes)
   */
  async getJobById(jobId: string) {
    try {
      return await this.db.getJob(jobId);
    } catch (e) {
      console.error('Error getJobById:', e);
      return null;
    }
  }

  /**
   * Retrieve a single processed image by its ID
   */
  async getProcessedImageById(imageId: string) {
    try {
      return await this.db.getProcessedImage(imageId);
    } catch (e) {
      console.error('Error getProcessedImageById:', e);
      return null;
    }
  }

  /**
   * Retrieve all processed images for a job
   */
  async getProcessedImagesByJobId(jobId: string) {
    try {
      return await this.db.getProcessedImagesByJobId(jobId);
    } catch (e) {
      console.error('Error getProcessedImagesByJobId:', e);
      return [];
    }
  }

  /**
   * Get comprehensive job history for a user with filtering and pagination
   * 
   * @param userId - User ID to get job history for
   * @param filters - Optional filters to apply
   * @param pagination - Pagination options
   * @returns Promise<JobHistoryResponse> - Paginated job history with statistics
   */
  async getUserJobHistory(
    userId: string,
    filters: JobHistoryFilters = {},
    pagination: JobHistoryPagination = { page: 1, limit: 20 }
  ): Promise<JobHistoryResponse> {
    try {
      // Get all user jobs
      let jobs = await this.db.getJobsByUserId(userId);

      // Apply filters
      jobs = this.applyFilters(jobs, filters);

      // Get statistics before pagination
      const statistics = this.calculateStatistics(jobs);

      // Sort jobs
      const sortBy = pagination.sortBy || 'createdAt';
      const sortOrder = pagination.sortOrder || 'desc';
      jobs = this.sortJobs(jobs, sortBy, sortOrder);

      // Apply pagination
      const total = jobs.length;
      const totalPages = Math.ceil(total / pagination.limit);
      const startIndex = (pagination.page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      const paginatedJobs = jobs.slice(startIndex, endIndex);

      return {
        jobs: paginatedJobs,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1
        },
        filters,
        statistics
      };
    } catch (error) {
      console.error('Error getting user job history:', error);
      throw new Error('Failed to retrieve job history');
    }
  }

  /**
   * Get job statistics for a user
   * 
   * @param userId - User ID to get statistics for
   * @param dateRange - Optional date range for statistics
   * @returns Promise<JobStatistics> - Comprehensive job statistics
   */
  async getUserJobStatistics(
    userId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<JobStatistics> {
    try {
      let jobs = await this.db.getJobsByUserId(userId);

      // Apply date range filter if provided
      if (dateRange) {
        jobs = jobs.filter(job => {
          const jobDate = new Date(job.createdAt);
          return jobDate >= dateRange.from && jobDate <= dateRange.to;
        });
      }

      return this.calculateStatistics(jobs);
    } catch (error) {
      console.error('Error getting user job statistics:', error);
      throw new Error('Failed to retrieve job statistics');
    }
  }

  /**
   * Search jobs by title, file names, or other criteria
   * 
   * @param userId - User ID to search jobs for
   * @param query - Search query string
   * @param filters - Additional filters to apply
   * @param pagination - Pagination options
   * @returns Promise<JobHistoryResponse> - Search results with pagination
   */
  async searchUserJobs(
    userId: string,
    query: string,
    filters: JobHistoryFilters = {},
    pagination: JobHistoryPagination = { page: 1, limit: 20 }
  ): Promise<JobHistoryResponse> {
    try {
      // Add search query to filters
      const searchFilters = { ...filters, search: query };
      return this.getUserJobHistory(userId, searchFilters, pagination);
    } catch (error) {
      console.error('Error searching user jobs:', error);
      throw new Error('Failed to search jobs');
    }
  }

  /**
   * Get recent jobs for a user (last 10 by default)
   * 
   * @param userId - User ID to get recent jobs for
   * @param limit - Number of recent jobs to return
   * @returns Promise<Job[]> - Array of recent jobs
   */
  async getRecentJobs(userId: string, limit: number = 10): Promise<Job[]> {
    try {
      const jobs = await this.db.getJobsByUserId(userId);
      return jobs
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent jobs:', error);
      throw new Error('Failed to retrieve recent jobs');
    }
  }

  /**
   * Get job by ID with full details (including files and results)
   * 
   * @param userId - User ID (for authorization)
   * @param jobId - Job ID to retrieve
   * @returns Promise<Job | null> - Job details or null if not found/unauthorized
   */
  async getJobDetails(userId: string, jobId: string): Promise<Job | null> {
    try {
      const job = await this.db.getJob(jobId);
      
      if (!job || job.userId !== userId) {
        return null;
      }

      return job;
    } catch (error) {
      console.error('Error getting job details:', error);
      throw new Error('Failed to retrieve job details');
    }
  }

  /**
   * Delete a job and all associated data
   * 
   * @param userId - User ID (for authorization)
   * @param jobId - Job ID to delete
   * @returns Promise<boolean> - True if deleted successfully
   */
  async deleteJob(userId: string, jobId: string): Promise<boolean> {
    try {
      // Check if user owns the job
      const ownsJob = await this.db.userOwnsJob(userId, jobId);
      if (!ownsJob) {
        return false;
      }

      // Get associated data
      const files = await this.db.getFilesByJobId(jobId);
      const processedImages = await this.db.getProcessedImagesByJobId(jobId);
      const composedSheets = await this.db.getComposedSheetsByJobId(jobId);

      // Delete physical files
      const fs = require('fs');
      
      for (const file of files) {
        try {
          if (fs.existsSync(file.uploadPath)) {
            fs.unlinkSync(file.uploadPath);
          }
        } catch (error) {
          console.error('Error deleting file:', file.uploadPath, error);
        }
      }

      for (const image of processedImages) {
        try {
          if (fs.existsSync(image.processedPath)) {
            fs.unlinkSync(image.processedPath);
          }
        } catch (error) {
          console.error('Error deleting processed image:', image.processedPath, error);
        }
      }

      for (const sheet of composedSheets) {
        try {
          if (fs.existsSync(sheet.sheetPath)) {
            fs.unlinkSync(sheet.sheetPath);
          }
        } catch (error) {
          console.error('Error deleting composed sheet:', sheet.sheetPath, error);
        }
      }

      // Delete from database
      await this.db.deleteJob(jobId);
      // Note: These delete methods don't exist in the database class yet
      // files.forEach(file => this.db.deleteFile?.(file.id));
      // processedImages.forEach(image => this.db.deleteProcessedImage?.(image.id));
      // composedSheets.forEach(sheet => this.db.deleteComposedSheet?.(sheet.id));

      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      throw new Error('Failed to delete job');
    }
  }

  /**
   * Update job title or visibility
   * 
   * @param userId - User ID (for authorization)
   * @param jobId - Job ID to update
   * @param updates - Updates to apply
   * @returns Promise<boolean> - True if updated successfully
   */
  async updateJob(
    userId: string,
    jobId: string,
    updates: { title?: string; isPublic?: boolean }
  ): Promise<boolean> {
    try {
      // Check if user owns the job
      const ownsJob = await this.db.userOwnsJob(userId, jobId);
      if (!ownsJob) {
        return false;
      }

      await this.db.updateJob(jobId, updates);
      return true;
    } catch (error) {
      console.error('Error updating job:', error);
      throw new Error('Failed to update job');
    }
  }

  /**
   * Export job history data
   * 
   * @param userId - User ID to export data for
   * @param options - Export options
   * @returns Promise<string> - Exported data as string
   */
  async exportJobHistory(
    userId: string,
    options: JobExportOptions
  ): Promise<string> {
    try {
      let jobs = await this.db.getJobsByUserId(userId);

      // Apply date range filter if provided
      if (options.dateRange) {
        jobs = jobs.filter(job => {
          const jobDate = new Date(job.createdAt);
          return jobDate >= options.dateRange!.from && jobDate <= options.dateRange!.to;
        });
      }

      // Prepare export data
      const exportData = jobs.map(job => {
        const baseData = {
          id: job.id,
          title: job.title || 'Untitled',
          status: job.status,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          aspectRatio: job.options.aspectRatio.name,
          filesCount: job.files.length,
          isPublic: job.isPublic || false
        };

        if (options.includeFiles) {
          (baseData as any).files = job.files.map((file: any) => ({
            name: file.originalName,
            size: file.size,
            mimeType: file.mimeType,
            uploadedAt: file.uploadedAt
          }));
        }

        if (options.includeProgress) {
          (baseData as any).progress = job.progress;
        }

        return baseData;
      });

      if (options.format === 'csv') {
        return this.convertToCSV(exportData);
      } else {
        return JSON.stringify(exportData, null, 2);
      }
    } catch (error) {
      console.error('Error exporting job history:', error);
      throw new Error('Failed to export job history');
    }
  }

  /**
   * Apply filters to job array
   */
  private applyFilters(jobs: Job[], filters: JobHistoryFilters): Job[] {
    return jobs.filter(job => {
      // Status filter
      if (filters.status && job.status !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        const jobDate = new Date(job.createdAt);
        if (jobDate < filters.dateFrom!) {
          return false;
        }
      }

      if (filters.dateTo) {
        const jobDate = new Date(job.createdAt);
        if (jobDate > filters.dateTo!) {
          return false;
        }
      }

      // Aspect ratio filter
      if (filters.aspectRatio && job.options.aspectRatio.name !== filters.aspectRatio) {
        return false;
      }

      // Public/private filter
      if (filters.isPublic !== undefined && (job as any).isPublic !== filters.isPublic) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const titleMatch = (job as any).title?.toLowerCase().includes(searchTerm) || false;
        const fileMatch = job.files.some(file => 
          file.originalName.toLowerCase().includes(searchTerm)
        );
        
        if (!titleMatch && !fileMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort jobs by specified criteria
   */
  private sortJobs(jobs: Job[], sortBy: string, sortOrder: 'asc' | 'desc'): Job[] {
    return jobs.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'completedAt':
          aValue = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          bValue = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'title':
          aValue = (a as any).title || '';
          bValue = (b as any).title || '';
          break;
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  /**
   * Calculate comprehensive job statistics
   */
  private calculateStatistics(jobs: Job[]): JobStatistics {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const total = jobs.length;
    const completed = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    const processing = jobs.filter(j => ['processing', 'composing', 'generating_pdf'].includes(j.status)).length;
    const pending = jobs.filter(j => j.status === 'pending').length;
    const cancelled = jobs.filter(j => (j as any).status === 'cancelled').length;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // Calculate average processing time
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.completedAt);
    const totalProcessingTime = completedJobs.reduce((sum, job) => {
      const start = new Date(job.createdAt).getTime();
      const end = new Date(job.completedAt!).getTime();
      return sum + (end - start);
    }, 0);
    const averageProcessingTime = completedJobs.length > 0 
      ? totalProcessingTime / completedJobs.length / (1000 * 60) // Convert to minutes
      : 0;

    // Calculate total files processed
    const totalFilesProcessed = jobs.reduce((sum, job) => sum + job.files.length, 0);

    // Find most used aspect ratio
    const aspectRatioCounts = jobs.reduce((counts, job) => {
      const ratio = job.options.aspectRatio.name;
      counts[ratio] = (counts[ratio] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    const mostUsedAspectRatio = Object.entries(aspectRatioCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

    return {
      total,
      completed,
      failed,
      processing,
      pending,
      cancelled,
      completionRate: Math.round(completionRate * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
      totalFilesProcessed,
      mostUsedAspectRatio,
      recentActivity: {
        last7Days: jobs.filter(j => new Date(j.createdAt) > last7Days).length,
        last30Days: jobs.filter(j => new Date(j.createdAt) > last30Days).length
      }
    };
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

// Singleton instance
export const jobHistoryService = new JobHistoryService();
