/**
 * User Dashboard Page
 * 
 * Purpose: Comprehensive user dashboard displaying job history, statistics,
 * recent activity, and account management. Provides central hub for 
 * authenticated users to manage their image processing activities.
 * 
 * Usage:
 * ```tsx
 * <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
 * ```
 * 
 * Features:
 * - User statistics and usage analytics
 * - Complete job history with search/filter
 * - Recent activity timeline
 * - Quick action buttons for common tasks
 * - Account settings and preferences
 * - Processing status overview
 * - Download history and file management
 * 
 * Data:
 * - Real-time user statistics
 * - Paginated job history
 * - Processing success rates
 * - File storage usage
 * - Performance metrics
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserStats } from '../hooks/useAuth';
import Container from '../components/ui/Container';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Grid from '../components/ui/Grid';

interface RecentJob {
  id: string;
  title?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  filesCount: number;
  progress: {
    percentage: number;
    processedImages: number;
    totalImages: number;
  };
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { stats, recentJobs, loading: statsLoading, error: statsError, refetch } = useUserStats();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'processing':
      case 'composing':
      case 'generating_pdf':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing':
        return 'Processing';
      case 'composing':
        return 'Composing Sheets';
      case 'generating_pdf':
        return 'Generating PDF';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Container className="py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user.firstName}!
              </h1>
              <p className="text-gray-600 mt-1">
                Manage your image processing jobs and account settings
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/upload')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                + New Processing Job
              </Button>
              
              <div className="relative">
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm"
                >
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </span>
                  </div>
                  <span className="font-medium">{user.username}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showAccountMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        navigate('/profile');
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50"
                    >
                      Profile Settings
                    </button>
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        navigate('/preferences');
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50"
                    >
                      Preferences
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <Grid cols={1} responsive={{ md: 3 }} gap="lg">
            <Card padding="lg" variant="elevated">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '...' : stats?.totalJobs || 0}
                  </p>
                  <p className="text-sm text-gray-500">All time</p>
                </div>
              </div>
            </Card>

            <Card padding="lg" variant="elevated">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '...' : stats?.completedJobs || 0}
                  </p>
                  <p className="text-sm text-gray-500">Successfully processed</p>
                </div>
              </div>
            </Card>

            <Card padding="lg" variant="elevated">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statsLoading ? '...' : `${stats?.successRate || 0}%`}
                  </p>
                  <p className="text-sm text-gray-500">Processing accuracy</p>
                </div>
              </div>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Card padding="lg" variant="elevated">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                onClick={() => navigate('/upload')}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto"
              >
                <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="font-medium">Upload Images</span>
                <span className="text-xs text-gray-500">Start new job</span>
              </Button>

              <Button
                onClick={() => navigate('/history')}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto"
              >
                <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Job History</span>
                <span className="text-xs text-gray-500">View all jobs</span>
              </Button>

              <Button
                onClick={() => navigate('/downloads')}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto"
              >
                <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">Downloads</span>
                <span className="text-xs text-gray-500">Access files</span>
              </Button>

              <Button
                onClick={() => navigate('/profile')}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto"
              >
                <svg className="w-8 h-8 text-orange-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">Profile</span>
                <span className="text-xs text-gray-500">Manage account</span>
              </Button>
            </div>
          </Card>

          {/* Recent Jobs */}
          <Card padding="lg" variant="elevated">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Jobs</h2>
              <Link
                to="/history"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All →
              </Link>
            </div>

            {statsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading recent jobs...</p>
              </div>
            ) : statsError ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-4">{statsError}</p>
                <Button onClick={refetch} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            ) : recentJobs && recentJobs.length > 0 ? (
              <div className="space-y-4">
                {recentJobs.map((job: RecentJob) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {job.title || `Job ${job.id.slice(-8)}`}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {job.filesCount} {job.filesCount === 1 ? 'image' : 'images'} • {formatDate(job.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {job.status === 'processing' || job.status === 'composing' || job.status === 'generating_pdf' ? (
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${job.progress.percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">{job.progress.percentage}%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {job.progress.processedImages}/{job.progress.totalImages} processed
                          </p>
                        </div>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {getStatusText(job.status)}
                        </span>
                      )}

                      <Button
                        onClick={() => navigate(`/job/${job.id}`)}
                        variant="outline"
                        size="sm"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs yet</h3>
                <p className="text-gray-500 mb-6">
                  Start by uploading some images to process
                </p>
                <Button onClick={() => navigate('/upload')}>
                  Upload Your First Images
                </Button>
              </div>
            )}
          </Card>

          {/* Account Info */}
          <div className="text-center text-sm text-gray-500">
            <p>
              Account created {formatDate(user.createdAt)}
              {user.lastLoginAt && (
                <>
                  {' • '}
                  Last login {formatDate(user.lastLoginAt)}
                </>
              )}
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default DashboardPage;
