/**
 * Job History Page
 * 
 * Purpose: Dedicated page for comprehensive job history management with
 * advanced filtering, search, and job management capabilities. Provides
 * users with complete control over their image processing job history.
 * 
 * Usage:
 * ```tsx
 * <Route path="/job-history" element={<ProtectedRoute><JobHistoryPage /></ProtectedRoute>} />
 * ```
 * 
 * Key Features:
 * - Comprehensive job history interface
 * - Advanced filtering and search capabilities
 * - Job statistics and analytics
 * - Job management operations
 * - Export functionality
 * - Responsive design
 * 
 * Updates:
 * - Initial implementation with comprehensive job history features
 * - Integrated with job history component and hooks
 * - Added proper page structure and navigation
 */

import React from 'react';
import JobHistory from '../components/JobHistory';

const JobHistoryPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <JobHistory />
    </div>
  );
};

export default JobHistoryPage;
