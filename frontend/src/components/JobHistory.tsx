/**
 * Job History Component
 * 
 * Purpose: Comprehensive job history interface with advanced filtering, search,
 * pagination, and job management. Provides users with complete control over
 * their image processing job history and results.
 * 
 * Usage:
 * ```tsx
 * <JobHistory />
 * ```
 * 
 * Key Features:
 * - Advanced filtering by status, date range, aspect ratio
 * - Full-text search across job titles and file names
 * - Pagination with configurable page sizes
 * - Job statistics and analytics dashboard
 * - Job management (update, delete, view details)
 * - Export functionality (JSON/CSV)
 * - Real-time updates and optimistic UI
 * - Responsive design for all screen sizes
 * 
 * Updates:
 * - Initial implementation with comprehensive job history features
 * - Added advanced filtering and search capabilities
 * - Integrated with job history service and hooks
 * - Added export functionality and job management
 * - Implemented responsive design and accessibility
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobHistory } from '../hooks/useJobHistory';
import { Job } from '../types';
import { JobHistoryFilters } from '../services/jobHistoryService';
import Container from './ui/Container';
import Card from './ui/Card';
import Button from './ui/Button';
import Grid from './ui/Grid';
// import LoadingSpinner from './ui/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';

interface JobHistoryProps {
  className?: string;
}

const JobHistory: React.FC<JobHistoryProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const {
    jobs,
    statistics,
    filterOptions,
    loading,
    error,
    pagination,
    filters,
    searchQuery,
    fetchJobs,
    searchJobs,
    updateFilters,
    updatePagination,
    setSearchQuery,
    clearFilters,
    refreshJobs,
    updateJob,
    deleteJob,
    exportJobs
  } = useJobHistory();

  // Local state for UI controls
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: 'json' as 'json' | 'csv',
    includeFiles: false,
    includeProgress: false
  });

  // Filter handlers
  const handleStatusFilter = (status: string) => {
    updateFilters({ status: status as any || undefined });
  };

  const handleDateFilter = (field: 'dateFrom' | 'dateTo', value: string) => {
    updateFilters({ [field]: value || undefined });
  };

  const handleAspectRatioFilter = (aspectRatio: string) => {
    updateFilters({ ...(aspectRatio && { aspectRatio }) });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchJobs(query, filters, pagination);
    } else {
      fetchJobs(filters, pagination);
    }
  };

  // Job management handlers

  const handleDeleteJob = async (jobId: string) => {
    if (window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      const success = await deleteJob(jobId);
      if (success) {
        setSelectedJobs(prev => prev.filter(id => id !== jobId));
      }
    }
  };

  const handleViewJob = (jobId: string) => {
    navigate(`/results/${jobId}`);
  };

  const handleRetryJob = (jobId: string) => {
    navigate(`/processing/${jobId}`);
  };

  // Export handlers
  const handleExport = async () => {
    await exportJobs(exportOptions);
    setShowExportModal(false);
  };

  // Selection handlers
  const handleSelectJob = (jobId: string) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleSelectAll = () => {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs.map(job => job.id));
    }
  };

  // Computed values
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => value !== undefined && value !== '');
  }, [filters]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'processing': case 'composing': case 'generating_pdf': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'failed': return '✗';
      case 'processing': case 'composing': case 'generating_pdf': return '⟳';
      case 'pending': return '⏳';
      case 'cancelled': return '⊘';
      default: return '?';
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <Container className={`py-8 ${className}`}>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Container>
    );
  }

  return (
    <Container className={`py-8 ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job History</h1>
            <p className="text-gray-600 mt-2">
              Manage and view your image processing jobs
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2"
            >
              <span>Export</span>
            </Button>
            
            <Button
              onClick={refreshJobs}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="mb-8">
          <Grid cols={1} gap="lg">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">📊</span>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.completed}</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-sm font-medium">✓</span>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-blue-600">{statistics.completionRate}%</p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-medium">📈</span>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Files Processed</p>
                  <p className="text-2xl font-bold text-purple-600">{statistics.totalFilesProcessed}</p>
                </div>
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-sm font-medium">🖼️</span>
                </div>
              </div>
            </Card>
          </Grid>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="mb-6">
        <div className="p-6">
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search jobs by title or file names..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => handleStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Statuses</option>
                    {filterOptions?.status.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => handleDateFilter('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => handleDateFilter('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aspect Ratio
                  </label>
                  <select
                    value={filters.aspectRatio || ''}
                    onChange={(e) => handleAspectRatioFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Ratios</option>
                    {filterOptions?.aspectRatios.map(ratio => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="text-sm"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <div className="p-4">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <div>
                <p className="text-red-800">{error}</p>
                {error.includes('Authentication required') && (
                  <p className="text-red-600 text-sm mt-1">
                    Please log in to access your job history.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Jobs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedJobs.length === jobs.length && jobs.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Files
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedJobs.includes(job.id)}
                      onChange={() => handleSelectJob(job.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {job.title || 'Untitled Job'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {job.options.aspectRatio.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      <span className="mr-1">{getStatusIcon(job.status)}</span>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {job.files.length}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewJob(job.id)}
                        disabled={job.status !== 'completed'}
                      >
                        View
                      </Button>
                      {job.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetryJob(job.id)}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {jobs.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-500 mb-4">
              {hasActiveFilters || searchQuery 
                ? 'Try adjusting your filters or search terms'
                : 'You haven\'t processed any images yet'
              }
            </p>
            {!hasActiveFilters && !searchQuery && (
              <Button onClick={() => navigate('/upload')}>
                Start Processing Images
              </Button>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updatePagination({ page: pagination.page - 1 })}
                  disabled={!pagination.hasPrev || loading}
                >
                  Previous
                </Button>
                
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updatePagination({ page: pagination.page + 1 })}
                  disabled={!pagination.hasNext || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Export Job History</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format
                  </label>
                  <select
                    value={exportOptions.format}
                    onChange={(e) => setExportOptions(prev => ({ 
                      ...prev, 
                      format: e.target.value as 'json' | 'csv' 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeFiles}
                      onChange={(e) => setExportOptions(prev => ({ 
                        ...prev, 
                        includeFiles: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include file details</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeProgress}
                      onChange={(e) => setExportOptions(prev => ({ 
                        ...prev, 
                        includeProgress: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include progress data</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={loading}
                >
                  Export
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Container>
  );
};

export default JobHistory;
