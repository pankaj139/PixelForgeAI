/**
 * Instagram Graph API Authentication Component
 * 
 * ⚠️ UPDATED for Instagram Graph API (post-Dec 2024)
 * Instagram Basic Display API was deprecated December 4, 2024
 * 
 * This component provides a user interface for Instagram BUSINESS/CREATOR account
 * authentication through Facebook Graph API integration.
 * 
 * NEW REQUIREMENTS:
 * - Instagram account MUST be Business or Creator (not personal)
 * - Instagram account MUST be linked to a Facebook Page  
 * - Uses Facebook OAuth authentication (not Instagram Basic Display)
 * - Requires Facebook App with Instagram Graph API access
 * 
 * Features:
 * - Facebook OAuth authentication for Instagram access
 * - Instagram Business account profile display
 * - Connection status indicator with new requirements warning
 * - Disconnect functionality
 * - Error handling and loading states
 * - Requirements checklist for user guidance
 * 
 * Usage:
 * ```tsx
 * <InstagramAuth
 *   onAuthSuccess={(userProfile) => console.log('Connected:', userProfile)}
 *   onDisconnect={() => console.log('Disconnected')}
 *   compact={false}
 * />
 * ```
 */

import React from 'react';
import { useInstagram } from '../hooks/useInstagram';
import Button from './ui/Button';
import Card from './ui/Card';

interface InstagramAuthProps {
  onAuthSuccess?: (userProfile: any) => void;
  onDisconnect?: () => void;
  compact?: boolean;
  className?: string;
}

export const InstagramAuth: React.FC<InstagramAuthProps> = ({
  onAuthSuccess,
  onDisconnect,
  compact = false,
  className = ''
}) => {
  const {
    isConnected,
    userProfile,
    authenticate,
    disconnect,
    isAuthenticating,
    authError,
    profileError,
  } = useInstagram();

  const handleConnect = async () => {
    try {
      const authData = await authenticate();
      onAuthSuccess?.(authData.userProfile);
    } catch (error) {
      console.error('Instagram authentication failed:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onDisconnect?.();
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {isConnected && userProfile ? (
          <>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">📸</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  @{userProfile.username}
                </p>
                <p className="text-xs text-gray-500">Connected</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="text-xs"
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleConnect}
            disabled={isAuthenticating}
            loading={isAuthenticating}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            📸 Connect via Facebook
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-start space-x-4">
        {/* Instagram Icon */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xl">📸</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isConnected && userProfile ? (
            <>
              {/* Connected State */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Instagram Connected
                  </h3>
                  <p className="text-sm text-gray-500">
                    Connected to @{userProfile.username}
                  </p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Connected
                </span>
              </div>

              {/* User Profile Info */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile.mediaCount?.toLocaleString() || '—'}
                    </p>
                    <p className="text-xs text-gray-500">Posts</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile.followersCount?.toLocaleString() || '—'}
                    </p>
                    <p className="text-xs text-gray-500">Followers</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile.followsCount?.toLocaleString() || '—'}
                    </p>
                    <p className="text-xs text-gray-500">Following</p>
                  </div>
                </div>
                
                {userProfile.accountType && (
                  <div className="mt-2 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      userProfile.accountType === 'BUSINESS'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {userProfile.accountType === 'BUSINESS' ? '🏢' : '👤'} {userProfile.accountType}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="flex-1"
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Not Connected State */}
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Connect Instagram Business Account
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Post your processed images directly to Instagram Business/Creator accounts with AI-generated captions and hashtags.
                </p>
              </div>

              {/* New Requirements Warning */}
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <span className="text-amber-600 text-sm">⚠️</span>
                  </div>
                  <div className="ml-2">
                    <h4 className="text-sm font-medium text-amber-800 mb-1">
                      New Requirements (Dec 2024)
                    </h4>
                    <ul className="text-xs text-amber-700 space-y-1">
                      <li className="flex items-center">
                        <span className="mr-2">•</span>
                        Instagram account must be Business or Creator
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">•</span>
                        Must be linked to a Facebook Page
                      </li>
                      <li className="flex items-center">
                        <span className="mr-2">•</span>
                        Personal accounts no longer supported
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="mt-3">
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Direct posting to Instagram Business feed
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    AI-generated captions and hashtags
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Batch posting for multiple images
                  </li>
                </ul>
              </div>

              {/* Error Display */}
              {(authError || profileError) && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700">
                    {authError?.message || profileError?.message || 'Authentication failed'}
                  </p>
                </div>
              )}

              {/* Connect Button */}
              <div className="mt-4">
                <Button
                  variant="primary"
                  onClick={handleConnect}
                  disabled={isAuthenticating}
                  loading={isAuthenticating}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  📸 Connect via Facebook
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default InstagramAuth;
