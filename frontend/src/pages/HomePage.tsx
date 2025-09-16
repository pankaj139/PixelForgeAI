/**
 * HomePage Component
 * 
 * Purpose: Landing page showcasing intelligent image processing features
 * including real-time progress tracking, dynamic processing options, and
 * comprehensive AI-powered image enhancement capabilities.
 * 
 * Usage:
 * Main entry point for users to understand and access image processing features
 * 
 * Updates:
 * - Enhanced feature descriptions with latest improvements
 * - Added real-time progress tracking highlights
 * - Updated with dynamic processing options and smart stage visibility
 * 
 * Returns: JSX element with feature cards and call-to-action
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Grid from '../components/ui/Grid';
import Button from '../components/ui/Button';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-balance">
          🖼️ Intelligent Image Processing & Cropping
        </h2>
        <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto text-balance">
          Transform your images with AI-powered smart cropping, real-time progress tracking, and dynamic processing options. 
          Convert to perfect aspect ratios while keeping faces and people perfectly centered.
        </p>
      </div>
      
      <Grid cols={1} responsive={{ lg: 3 }} gap="lg">
        <Card padding="lg" variant="elevated">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🚀 Real-Time Processing</h3>
            <p className="text-sm text-gray-600">
              Watch your images transform with live progress tracking. Dynamic stage visibility shows only relevant processing steps based on your selected options.
            </p>
          </div>
        </Card>
        
        <Card padding="lg" variant="elevated">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🤖 Complete AI Suite</h3>
            <p className="text-sm text-gray-600">
              Advanced computer vision for smart cropping, AI-generated descriptive filenames, and automatic Instagram captions with trending hashtags.
            </p>
          </div>
        </Card>
        
        <Card padding="lg" variant="elevated">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📋 Professional Output</h3>
            <p className="text-sm text-gray-600">
              Download individual images, create A4 sheet compositions with flexible grid layouts, generate multi-page PDFs, or get everything in a ZIP archive.
            </p>
          </div>
        </Card>
      </Grid>

      {/* New Features Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">✨ Latest Enhancements</h3>
          <p className="text-gray-600">Experience the newest improvements in our image processing pipeline</p>
        </div>
        
        <Grid cols={1} responsive={{ md: 2, lg: 4 }} gap="md">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-sm font-semibold mb-2">
              📊
            </div>
            <h4 className="font-medium text-gray-900 text-sm">Live Progress</h4>
            <p className="text-xs text-gray-600 mt-1">Real-time updates with accurate percentages and time estimates</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-semibold mb-2">
              📸
            </div>
            <h4 className="font-medium text-gray-900 text-sm">Instagram AI</h4>
            <p className="text-xs text-gray-600 mt-1">Auto-generates engaging captions and 10-15 trending hashtags</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full text-sm font-semibold mb-2">
              📋
            </div>
            <h4 className="font-medium text-gray-900 text-sm">A4 Sheets & PDFs</h4>
            <p className="text-xs text-gray-600 mt-1">Professional layouts from 1x1 to 3x3 grids with PDF export</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-orange-500 text-white rounded-full text-sm font-semibold mb-2">
              ✨
            </div>
            <h4 className="font-medium text-gray-900 text-sm">Smart Naming</h4>
            <p className="text-xs text-gray-600 mt-1">AI generates descriptive filenames like "family_portrait_4x6.jpg"</p>
          </div>
        </Grid>
      </div>
      
      <div className="text-center">
        {isAuthenticated && user ? (
          /* Authenticated User - Direct Upload Access */
          <>
            <Button
              onClick={() => navigate('/upload')}
              size="lg"
              className="px-8 py-4 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              🚀 Start Processing Images
            </Button>
            <p className="text-sm text-gray-500 mt-3">
              Welcome back, {user.firstName}! Upload multiple images and track your progress in real-time.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                size="sm"
                className="text-sm"
              >
                📊 View Dashboard
              </Button>
              <Button
                onClick={() => navigate('/history')}
                variant="outline"
                size="sm"
                className="text-sm"
              >
                📜 Job History
              </Button>
            </div>
          </>
        ) : (
          /* Unauthenticated User - Sign Up First */
          <>
            <div className="space-y-4">
              <Button
                onClick={() => navigate('/auth?mode=register')}
                size="lg"
                className="px-8 py-4 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
              >
                🚀 Get Started - Sign Up Free
              </Button>
              <div className="flex flex-col sm:flex-row justify-center gap-2 text-sm">
                <span className="text-gray-600">Already have an account?</span>
                <button
                  onClick={() => navigate('/auth')}
                  className="text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  Sign in here
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Create your account to access AI-powered image processing with job history and personalized dashboard
            </p>
            
            {/* Sign up benefits */}
            <div className="mt-6 inline-flex items-center px-4 py-2 bg-blue-50 rounded-full">
              <svg className="w-4 h-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-blue-700 font-medium">Free forever • No credit card required</span>
            </div>
          </>
        )}
        
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-400">
          <span className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Real-time Progress
          </span>
          <span className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            AI Smart Cropping
          </span>
          <span className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Instagram Content
          </span>
          <span className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            A4 Sheets & PDFs
          </span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;