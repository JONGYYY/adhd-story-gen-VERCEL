/**
 * YouTube auto-posting for batch-generated videos
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import { YouTubeAPI } from '@/lib/social-media/youtube';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SOCIAL_CREDENTIALS_COLLECTION = 'social_credentials';

export type YouTubeErrorType = 'TOKEN_EXPIRED' | 'TOKEN_REFRESH_FAILED' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'UNKNOWN';

/**
 * Get user's YouTube credentials
 */
async function getUserYouTubeCredentials(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  try {
    const db = await getAdminFirestore();
    const doc = await db.collection(SOCIAL_CREDENTIALS_COLLECTION).doc(userId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data?.youtube?.accessToken) {
      return null;
    }

    return {
      accessToken: data.youtube.accessToken,
      refreshToken: data.youtube.refreshToken,
      expiresAt: data.youtube.expiresAt || Date.now() + 3600000, // Default 1 hour if not set
    };
  } catch (error) {
    console.error('Failed to get YouTube credentials:', error);
    return null;
  }
}

/**
 * Save refreshed YouTube credentials back to Firestore
 */
async function saveYouTubeCredentials(
  userId: string,
  credentials: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
  }
): Promise<void> {
  try {
    const db = await getAdminFirestore();
    await db.collection(SOCIAL_CREDENTIALS_COLLECTION).doc(userId).set(
      {
        youtube: {
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          expiresAt: credentials.expiresAt,
          connectedAt: Date.now(),
        },
      },
      { merge: true }
    );
    console.log(`[YouTube Auto-Post] Saved refreshed credentials for user ${userId}`);
  } catch (error) {
    console.error('[YouTube Auto-Post] Failed to save credentials:', error);
  }
}

/**
 * Ensure token is valid, refresh if necessary
 * Returns valid credentials or throws error
 */
async function ensureValidToken(
  userId: string,
  credentials: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const now = Date.now();
  const tenMinutesFromNow = now + (10 * 60 * 1000);
  
  // Check if token is expired or will expire in next 10 minutes
  if (credentials.expiresAt < tenMinutesFromNow) {
    console.log('[YouTube Auto-Post] Token expired or expiring soon, refreshing proactively...');
    
    if (!credentials.refreshToken) {
      throw {
        type: 'TOKEN_REFRESH_FAILED' as YouTubeErrorType,
        message: 'No refresh token available. User must reconnect YouTube.'
      };
    }
    
    try {
      const youtubeApi = new YouTubeAPI();
      const newTokens = await youtubeApi.refreshAccessToken(credentials.refreshToken);
      
      const refreshedCredentials = {
        accessToken: newTokens.access_token,
        refreshToken: credentials.refreshToken,
        expiresAt: newTokens.expiry_date,
      };
      
      // Save immediately
      await saveYouTubeCredentials(userId, refreshedCredentials);
      
      console.log('[YouTube Auto-Post] Token refreshed successfully');
      return refreshedCredentials;
    } catch (error) {
      console.error('[YouTube Auto-Post] Token refresh failed:', error);
      throw {
        type: 'TOKEN_REFRESH_FAILED' as YouTubeErrorType,
        message: `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  console.log('[YouTube Auto-Post] Token is valid');
  return credentials;
}

/**
 * Download video from URL to temporary file
 */
async function downloadVideoToFile(videoUrl: string, filePath: string): Promise<void> {
  console.log(`[YouTube Auto-Post] Downloading video from ${videoUrl}...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
  
  try {
    const response = await fetch(videoUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await fs.promises.writeFile(filePath, buffer);
    console.log(`[YouTube Auto-Post] Video downloaded to ${filePath} (${buffer.length} bytes)`);
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Video download timed out after 2 minutes');
    }
    
    throw error;
  }
}

/**
 * Get video URL and metadata from Railway API
 */
async function getVideoMetadata(videoId: string, railwayApiUrl: string): Promise<{
  videoUrl: string;
  title?: string;
  description?: string;
} | null> {
  try {
    const response = await fetch(`${railwayApiUrl}/api/video-status/${videoId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Failed to get video status ${videoId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      videoUrl: data.videoUrl,
      title: data.title,
      description: data.description,
    };
  } catch (error) {
    console.error(`Failed to fetch video status ${videoId}:`, error);
    return null;
  }
}

/**
 * Classify error type for better handling
 */
function classifyError(error: any): YouTubeErrorType {
  const errorMessage = error?.message || error?.toString() || '';
  const errorString = errorMessage.toLowerCase();
  
  // Token-related errors
  if (errorString.includes('token') && (
      errorString.includes('expired') ||
      errorString.includes('invalid') ||
      errorString.includes('revoked') ||
      errorString.includes('unauthorized') ||
      errorString.includes('401')
  )) {
    return 'TOKEN_EXPIRED';
  }
  
  if (errorString.includes('refresh') && errorString.includes('failed')) {
    return 'TOKEN_REFRESH_FAILED';
  }
  
  // Quota errors
  if (errorString.includes('quota') || errorString.includes('429')) {
    return 'QUOTA_EXCEEDED';
  }
  
  // Network errors
  if (errorString.includes('network') ||
      errorString.includes('timeout') ||
      errorString.includes('econnreset') ||
      errorString.includes('enotfound') ||
      errorString.includes('econnrefused')) {
    return 'NETWORK_ERROR';
  }
  
  return 'UNKNOWN';
}

/**
 * Upload video with retry logic for transient errors
 */
async function uploadVideoWithRetry(
  youtubeApi: YouTubeAPI,
  accessToken: string,
  videoData: {
    title: string;
    description: string;
    filePath: string;
    privacyStatus: 'private' | 'unlisted' | 'public';
  },
  maxRetries: number = 2
): Promise<any> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000); // 5s, 10s, max 30s
        console.log(`[YouTube Auto-Post] Retry attempt ${attempt} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await youtubeApi.uploadVideo(accessToken, videoData);
      console.log(`[YouTube Auto-Post] Upload successful${attempt > 0 ? ` after ${attempt} retries` : ''}`);
      return result;
    } catch (error) {
      lastError = error;
      const errorType = classifyError(error);
      
      console.error(`[YouTube Auto-Post] Upload attempt ${attempt + 1} failed:`, error);
      
      // Don't retry permanent errors
      if (errorType === 'TOKEN_EXPIRED' || 
          errorType === 'TOKEN_REFRESH_FAILED' || 
          errorType === 'QUOTA_EXCEEDED') {
        console.log(`[YouTube Auto-Post] Permanent error (${errorType}), not retrying`);
        throw error;
      }
      
      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        console.log(`[YouTube Auto-Post] Max retries (${maxRetries}) reached`);
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Post a single video to YouTube
 */
export async function postVideoToYouTube(
  userId: string,
  videoId: string,
  railwayApiUrl: string,
  title?: string,
  description?: string
): Promise<{
  success: boolean;
  error?: string;
  errorType?: YouTubeErrorType;
  youtubeVideoId?: string;
}> {
  let tempFilePath: string | null = null;
  
  try {
    // Get user's YouTube credentials
    const credentials = await getUserYouTubeCredentials(userId);
    if (!credentials) {
      return {
        success: false,
        error: 'YouTube not connected',
        errorType: 'TOKEN_EXPIRED',
      };
    }
    
    if (!credentials.refreshToken) {
      return {
        success: false,
        error: 'No refresh token available. User must reconnect YouTube.',
        errorType: 'TOKEN_REFRESH_FAILED',
      };
    }
    
    // Ensure token is valid (refresh if necessary)
    let validCredentials;
    try {
      validCredentials = await ensureValidToken(userId, credentials);
    } catch (tokenError: any) {
      return {
        success: false,
        error: tokenError.message || 'Failed to refresh token',
        errorType: tokenError.type || 'TOKEN_REFRESH_FAILED',
      };
    }

    // Get video metadata and URL
    const videoMetadata = await getVideoMetadata(videoId, railwayApiUrl);
    if (!videoMetadata || !videoMetadata.videoUrl) {
      return {
        success: false,
        error: 'Failed to get video URL',
        errorType: 'UNKNOWN',
      };
    }
    
    // Create temporary file path
    tempFilePath = path.join(os.tmpdir(), `youtube-upload-${videoId}-${Date.now()}.mp4`);
    
    // Download video to temp file
    try {
      await downloadVideoToFile(videoMetadata.videoUrl, tempFilePath);
    } catch (downloadError) {
      return {
        success: false,
        error: `Failed to download video: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`,
        errorType: 'NETWORK_ERROR',
      };
    }

    // Initialize YouTube API with auto-refresh callback
    const youtubeApi = new YouTubeAPI();
    youtubeApi.setStoredCredentials(validCredentials, async (newTokens) => {
      // Save refreshed tokens back to Firestore
      await saveYouTubeCredentials(userId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || validCredentials.refreshToken,
        expiresAt: Date.now() + (newTokens.expires_in * 1000),
      });
    });

    // Upload to YouTube with retry logic
    const result = await uploadVideoWithRetry(
      youtubeApi,
      validCredentials.accessToken,
      {
        title: title || videoMetadata.title || 'New Story',
        description: description || videoMetadata.description || '',
        filePath: tempFilePath,
        privacyStatus: 'public',
      }
    );
    
    // Clean up temp file
    try {
      await fs.promises.unlink(tempFilePath);
      console.log(`[YouTube Auto-Post] Temp file deleted: ${tempFilePath}`);
    } catch (cleanupError) {
      console.warn(`[YouTube Auto-Post] Failed to delete temp file: ${cleanupError}`);
    }

    return {
      success: true,
      youtubeVideoId: result.id,
    };
  } catch (error) {
    console.error('[YouTube Auto-Post] Failed to post video to YouTube:', error);
    
    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await fs.promises.unlink(tempFilePath);
        console.log(`[YouTube Auto-Post] Temp file deleted after error: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`[YouTube Auto-Post] Failed to delete temp file after error: ${cleanupError}`);
      }
    }
    
    const errorType = classifyError(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType,
    };
  }
}

/**
 * Post multiple videos to YouTube
 */
export async function postBatchToYouTube(
  userId: string,
  videoIds: string[],
  railwayApiUrl: string
): Promise<{
  successCount: number;
  failureCount: number;
  results: Array<{
    videoId: string;
    success: boolean;
    error?: string;
    errorType?: YouTubeErrorType;
    youtubeVideoId?: string;
  }>;
}> {
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const videoId of videoIds) {
    const result = await postVideoToYouTube(userId, videoId, railwayApiUrl);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }

    results.push({
      videoId,
      ...result,
    });

    // Add delay between posts to avoid rate limiting
    if (videoId !== videoIds[videoIds.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3s between YouTube uploads
    }
  }

  return {
    successCount,
    failureCount,
    results,
  };
}
