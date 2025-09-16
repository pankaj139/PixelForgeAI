/**
 * Instagram Graph API Integration Hook
 * 
 * ⚠️ UPDATED for Instagram Graph API (post-Dec 2024)
 * Instagram Basic Display API was deprecated December 4, 2024
 * 
 * This hook provides functionality for Instagram BUSINESS/CREATOR account authentication 
 * and posting through Facebook Graph API integration.
 * 
 * NEW REQUIREMENTS:
 * - Instagram account MUST be Business or Creator (not personal)
 * - Instagram account MUST be linked to a Facebook Page
 * - Uses Facebook OAuth authentication (not Instagram Basic Display)
 * - Requires Facebook App with Instagram Graph API access
 * 
 * Features:
 * - Facebook OAuth authentication for Instagram access
 * - Instagram Business account integration
 * - Facebook Page-linked Instagram posting
 * - Access token management with local storage
 * - Single image posting with captions/hashtags
 * - Batch posting for multiple images
 * - Error handling and loading states
 * 
 * Usage:
 * ```typescript
 * const {
 *   isConnected,
 *   userProfile,
 *   authenticate,
 *   postImage,
 *   disconnect
 * } = useInstagram();
 * 
 * // Connect Instagram Business account via Facebook
 * await authenticate();
 * 
 * // Post an image to Instagram Business account
 * await postImage({
 *   imageId: 'processed_image_id',
 *   caption: 'AI-generated caption',
 *   hashtags: ['tag1', 'tag2']
 * });
 * ```
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { instagramApi } from '../services/apiClient';

interface InstagramUserProfile {
  id: string;
  username: string;
  accountType: 'PERSONAL' | 'BUSINESS';
  mediaCount?: number;
  followersCount?: number;
  followsCount?: number;
}

interface InstagramAuthData {
  accessToken: string;
  tokenType: string;
  userId: string;
  expiresIn: number;
  scope: string;
  userProfile: InstagramUserProfile;
  connectedAt: string;
}

interface PostImageData {
  imageId: string;
  caption?: string;
  hashtags?: string[];
  location?: { name: string; latitude?: number; longitude?: number };
  altText?: string;
  isStory?: boolean;
}

interface BatchPostData {
  jobId: string;
  postingOptions?: {
    delayBetweenPosts?: number;
    postToStory?: boolean;
    skipFailedImages?: boolean;
    captionOptions?: {
      captionLength?: 'short' | 'medium' | 'long';
      style?: 'casual' | 'professional' | 'creative' | 'minimal' | 'storytelling';
      mood?: 'happy' | 'inspirational' | 'professional' | 'fun' | 'elegant';
    };
  };
}

const INSTAGRAM_AUTH_KEY = 'instagram_auth';

export const useInstagram = () => {
  const [authData, setAuthData] = useState<InstagramAuthData | null>(null);

  // Load auth data from localStorage on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem(INSTAGRAM_AUTH_KEY);
    if (savedAuth) {
      try {
        const parsedAuth = JSON.parse(savedAuth);
        setAuthData(parsedAuth);
      } catch (error) {
        console.error('Failed to parse Instagram auth data:', error);
        localStorage.removeItem(INSTAGRAM_AUTH_KEY);
      }
    }
  }, []);

  // Validate token and get user profile
  const { data: profileData, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['instagram-profile', authData?.accessToken],
    queryFn: async () => {
      if (!authData?.accessToken) return null;
      const response = await instagramApi.validateToken(authData.accessToken);
      return response.data;
    },
    enabled: !!authData?.accessToken,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Authentication mutation
  const authMutation = useMutation({
    mutationFn: async () => {
      // Get authorization URL (Updated for Facebook Graph API)
      const urlResponse = await instagramApi.getAuthUrl(
        'pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish',
        `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );
      
      if (!urlResponse.data.success) {
        throw new Error('Failed to get Instagram authorization URL');
      }
      
      const { authorizationUrl, state } = urlResponse.data.data;
      
      // Open Facebook auth popup for Instagram Graph API access
      const popup = window.open(
        authorizationUrl,
        'facebook-instagram-auth',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      // Wait for auth completion
      return new Promise<InstagramAuthData>((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            reject(new Error('Authentication cancelled'));
          }
        }, 1000);
        
        // Listen for auth completion message
        const messageHandler = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'instagram-auth-success' && event.data.code) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            popup.close();
            
            try {
              // Exchange code for token
              const tokenResponse = await instagramApi.exchangeToken(event.data.code, state);
              
              if (!tokenResponse.data.success) {
                throw new Error('Failed to exchange authorization code');
              }
              
              const authData = tokenResponse.data.data;
              setAuthData(authData);
              localStorage.setItem(INSTAGRAM_AUTH_KEY, JSON.stringify(authData));
              
              resolve(authData);
            } catch (error) {
              reject(error);
            }
          } else if (event.data.type === 'instagram-auth-error') {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            popup.close();
            reject(new Error(event.data.error || 'Authentication failed'));
          }
        };
        
        window.addEventListener('message', messageHandler);
      });
    },
  });

  // Post image mutation
  const postImageMutation = useMutation({
    mutationFn: async (data: PostImageData) => {
      if (!authData?.accessToken) {
        throw new Error('Not connected to Instagram. Please authenticate first.');
      }
      
      const response = await instagramApi.postImage({
        ...data,
        accessToken: authData.accessToken,
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to post to Instagram');
      }
      
      return response.data;
    },
  });

  // Batch post mutation
  const batchPostMutation = useMutation({
    mutationFn: async (data: BatchPostData) => {
      if (!authData?.accessToken) {
        throw new Error('Not connected to Instagram. Please authenticate first.');
      }
      
      const response = await instagramApi.batchPost({
        ...data,
        accessToken: authData.accessToken,
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to batch post to Instagram');
      }
      
      return response.data;
    },
  });

  // Token refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!authData?.accessToken) {
        throw new Error('No access token to refresh');
      }
      
      const response = await instagramApi.refreshToken(authData.accessToken);
      
      if (!response.data.success) {
        throw new Error('Failed to refresh Instagram token');
      }
      
      const newAuthData = {
        ...authData,
        accessToken: response.data.data.accessToken,
        expiresIn: response.data.data.expiresIn,
      };
      
      setAuthData(newAuthData);
      localStorage.setItem(INSTAGRAM_AUTH_KEY, JSON.stringify(newAuthData));
      
      return newAuthData;
    },
  });

  // Authentication function
  const authenticate = useCallback(async () => {
    return authMutation.mutateAsync();
  }, [authMutation]);

  // Post image function
  const postImage = useCallback(async (data: PostImageData) => {
    return postImageMutation.mutateAsync(data);
  }, [postImageMutation]);

  // Batch post function
  const batchPost = useCallback(async (data: BatchPostData) => {
    return batchPostMutation.mutateAsync(data);
  }, [batchPostMutation]);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    return refreshMutation.mutateAsync();
  }, [refreshMutation]);

  // Disconnect function
  const disconnect = useCallback(() => {
    setAuthData(null);
    localStorage.removeItem(INSTAGRAM_AUTH_KEY);
  }, []);

  // Check if connected and token is valid
  const isConnected = !!authData && !!profileData?.data?.valid;
  const userProfile = authData?.userProfile || profileData?.data?.userProfile;

  return {
    // State
    isConnected,
    userProfile,
    authData,
    
    // Actions
    authenticate,
    postImage,
    batchPost,
    refreshToken,
    disconnect,
    refetchProfile,
    
    // Loading states
    isAuthenticating: authMutation.isPending,
    isPosting: postImageMutation.isPending,
    isBatchPosting: batchPostMutation.isPending,
    isRefreshing: refreshMutation.isPending,
    isValidatingToken: profileData === undefined && !!authData,
    
    // Errors
    authError: authMutation.error,
    postError: postImageMutation.error,
    batchPostError: batchPostMutation.error,
    refreshError: refreshMutation.error,
    profileError,
    
    // Success states
    lastPostResult: postImageMutation.data,
    lastBatchResult: batchPostMutation.data,
  };
};

export default useInstagram;
