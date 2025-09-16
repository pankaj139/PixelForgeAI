/**
 * Instagram OAuth Callback Page
 * 
 * This page handles the OAuth callback from Instagram after user authorization.
 * It extracts the authorization code from the URL and sends it to the parent window
 * for token exchange.
 * 
 * Features:
 * - Authorization code extraction from URL parameters
 * - Error handling for OAuth failures
 * - Message posting to parent window for popup flow
 * - Loading state while processing
 * 
 * Usage:
 * This page is automatically opened in a popup during Instagram authentication
 * and should be configured as the redirect URI in your Instagram app settings.
 */

import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';

export const InstagramCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Instagram authentication...');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const state = urlParams.get('state');

    if (error) {
      setStatus('error');
      setMessage(errorDescription || 'Instagram authorization failed');
      
      // Send error to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'instagram-auth-error',
          error: errorDescription || error
        }, window.location.origin);
        
        setTimeout(() => window.close(), 3000);
      }
      return;
    }

    if (code) {
      setStatus('success');
      setMessage('Authorization successful! Completing setup...');
      
      // Send success to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'instagram-auth-success',
          code,
          state
        }, window.location.origin);
        
        // Close popup after a short delay
        setTimeout(() => window.close(), 1000);
      } else {
        // If not in popup, redirect to main app
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } else {
      setStatus('error');
      setMessage('No authorization code received from Instagram');
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'instagram-auth-error',
          error: 'No authorization code received'
        }, window.location.origin);
        
        setTimeout(() => window.close(), 3000);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center">
          {/* Instagram Logo */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
            <span className="text-white text-2xl">📸</span>
          </div>

          {/* Status */}
          <div className="mb-4">
            {status === 'loading' && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Connecting to Instagram
                </h2>
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <h2 className="text-xl font-semibold text-green-600 mb-2">
                  ✓ Authorization Successful
                </h2>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600">✓</span>
                  </div>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <h2 className="text-xl font-semibold text-red-600 mb-2">
                  ✗ Authorization Failed
                </h2>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600">✗</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Message */}
          <p className="text-gray-600 mb-6">{message}</p>

          {/* Actions */}
          {status === 'error' && (
            <button
              onClick={() => window.close()}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close Window
            </button>
          )}

          {status === 'success' && (
            <p className="text-sm text-gray-500">
              This window will close automatically...
            </p>
          )}

          {status === 'loading' && (
            <p className="text-sm text-gray-500">
              Please wait while we complete the setup...
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default InstagramCallback;
