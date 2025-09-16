/**
 * Application Router
 * 
 * Purpose: Central routing configuration with authentication-aware routes,
 * protected pages, and seamless navigation between authenticated and
 * public sections of the application.
 * 
 * Route Structure:
 * - Public routes: /, /upload (guest access allowed)
 * - Authentication: /auth (login/register)
 * - Protected routes: /dashboard, /profile, /history
 * - Processing routes: /processing/:jobId, /results/:jobId
 * 
 * Features:
 * - Protected route middleware
 * - Authentication-based redirects
 * - Persistent layout with navigation
 * - Dynamic route guards
 * - Fallback routes and error handling
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import HomePage from '../pages/HomePage';
import AuthPage from '../pages/AuthPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import DashboardPage from '../pages/DashboardPage';
import UploadPage from '../pages/UploadPage';
import ProcessingPage from '../pages/ProcessingPage';
import ResultsPage from '../pages/ResultsPage';
import JobHistoryPage from '../pages/JobHistoryPage';
import InstagramCallback from '../pages/InstagramCallback';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication routes - outside of main layout */}
        <Route 
          path="/auth" 
          element={
            <ProtectedRoute requireAuth={false} redirectTo="/dashboard">
              <AuthPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Password reset route - outside of main layout */}
        <Route 
          path="/reset-password" 
          element={
            <ProtectedRoute requireAuth={false} redirectTo="/dashboard">
              <ResetPasswordPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Instagram OAuth callback - outside of main layout */}
        <Route path="/instagram/callback" element={<InstagramCallback />} />
        
        {/* Main application routes with layout */}
        <Route path="/" element={<Layout />}>
          {/* Public routes */}
          <Route index element={<HomePage />} />
          
          {/* Protected upload route - requires authentication */}
          <Route 
            path="upload" 
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected dashboard route */}
          <Route 
            path="dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Processing routes - accessible to both authenticated and guest users */}
          {/* But authenticated users get enhanced features */}
          <Route path="processing/:jobId" element={<ProcessingPage />} />
          <Route path="results/:jobId" element={<ResultsPage />} />
          
          {/* Protected user management routes */}
          <Route 
            path="profile" 
            element={
              <ProtectedRoute>
                <div className="p-8 text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                  <p className="text-gray-600 mt-2">Profile management coming soon!</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="history" 
            element={
              <ProtectedRoute>
                <JobHistoryPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="downloads" 
            element={
              <ProtectedRoute>
                <div className="p-8 text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Downloads</h1>
                  <p className="text-gray-600 mt-2">Download management coming soon!</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="preferences" 
            element={
              <ProtectedRoute>
                <div className="p-8 text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>
                  <p className="text-gray-600 mt-2">User preferences coming soon!</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="job/:jobId" 
            element={
              <ProtectedRoute>
                <div className="p-8 text-center">
                  <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
                  <p className="text-gray-600 mt-2">Detailed job view coming soon!</p>
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;