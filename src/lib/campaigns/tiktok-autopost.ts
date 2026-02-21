/**
 * TikTok auto-posting for batch-generated videos
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import { TikTokAPI } from '@/lib/social-media/tiktok';

// Use the correct collection name that matches schema.ts
const SOCIAL_CREDENTIALS_COLLECTION = 'socialMediaCredentials';

/**
 * Get user's TikTok credentials
 * NOTE: Credentials are stored as separate documents with ID: ${userId}_tiktok
 */
async function getUserTikTokCredentials(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const db = await getAdminFirestore();
    // Document ID format: ${userId}_tiktok (e.g., "abc123_tiktok")
    const doc = await db.collection(SOCIAL_CREDENTIALS_COLLECTION).doc(`${userId}_tiktok`).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    // Credentials are stored directly on the document, not nested under 'tiktok'
    if (!data?.accessToken) {
      return null;
    }

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch (error) {
    console.error('Failed to get TikTok credentials:', error);
    return null;
  }
}

/**
 * Get video metadata including URL from Railway API
 */
async function getVideoMetadata(
  videoId: string, 
  userId: string,
  railwayApiUrl: string
): Promise<{
  videoUrl: string;
  title?: string;
} | null> {
  try {
    // Include userId as query parameter for server-side calls
    const response = await fetch(`${railwayApiUrl}/api/video-status/${videoId}?userId=${userId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Failed to get video status ${videoId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.videoUrl) {
      console.error(`No videoUrl in response for ${videoId}. Status: ${data.status}`);
      return null;
    }
    
    return {
      videoUrl: data.videoUrl,
      title: data.title,
    };
  } catch (error) {
    console.error(`Failed to fetch video status ${videoId}:`, error);
    return null;
  }
}

/**
 * Download video file from URL
 */
async function downloadVideoFile(videoUrl: string): Promise<Buffer | null> {
  try {
    console.log(`[TikTok Auto-Post] Downloading video from ${videoUrl}`);
    
    const response = await fetch(videoUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Failed to download video from ${videoUrl}: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[TikTok Auto-Post] Downloaded video (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    console.error(`Failed to fetch video from ${videoUrl}:`, error);
    return null;
  }
}

/**
 * Update user's TikTok access token in Firestore
 */
async function updateTikTokAccessToken(userId: string, accessToken: string, refreshToken?: string): Promise<void> {
  try {
    const db = await getAdminFirestore();
    const updateData: any = {
      accessToken,
      updatedAt: Date.now(),
    };
    
    // Update refresh token if provided (TikTok may return new refresh token)
    if (refreshToken) {
      updateData.refreshToken = refreshToken;
    }
    
    await db.collection(SOCIAL_CREDENTIALS_COLLECTION).doc(`${userId}_tiktok`).update(updateData);
    console.log(`[TikTok Auto-Post] Updated access token for user ${userId}`);
  } catch (error) {
    console.error('[TikTok Auto-Post] Failed to update access token:', error);
    throw error;
  }
}

/**
 * Post a single video to TikTok with automatic token refresh
 */
export async function postVideoToTikTok(
  userId: string,
  videoId: string,
  railwayApiUrl: string,
  title?: string,
  description?: string
): Promise<{
  success: boolean;
  error?: string;
  errorType?: 'TOKEN_EXPIRED' | 'TOKEN_REFRESH_FAILED' | 'UPLOAD_FAILED' | 'UNKNOWN';
  publishId?: string;
}> {
  try {
    console.log(`[TikTok Auto-Post] Posting video ${videoId} for user ${userId}`);
    
    // Get user's TikTok credentials
    let credentials = await getUserTikTokCredentials(userId);
    if (!credentials) {
      console.error(`[TikTok Auto-Post] No TikTok credentials found for user ${userId}`);
      return {
        success: false,
        error: 'TikTok not connected',
        errorType: 'UNKNOWN',
      };
    }
    
    console.log(`[TikTok Auto-Post] TikTok credentials found for user ${userId}`);

    // Get video metadata (includes videoUrl)
    console.log(`[TikTok Auto-Post] Fetching video metadata from: ${railwayApiUrl}/api/video-status/${videoId}?userId=${userId}`);
    const metadata = await getVideoMetadata(videoId, userId, railwayApiUrl);
    if (!metadata || !metadata.videoUrl) {
      console.error(`[TikTok Auto-Post] Failed to get video metadata or URL for ${videoId}`);
      console.error(`[TikTok Auto-Post] Metadata:`, metadata);
      return {
        success: false,
        error: 'Failed to get video URL from metadata',
        errorType: 'UPLOAD_FAILED',
      };
    }
    
    console.log(`[TikTok Auto-Post] Video metadata retrieved:`, { videoUrl: metadata.videoUrl, title: metadata.title });
    
    // Download video file from URL
    const videoFile = await downloadVideoFile(metadata.videoUrl);
    if (!videoFile) {
      return {
        success: false,
        error: 'Failed to download video file',
        errorType: 'UPLOAD_FAILED',
      };
    }
    
    // Use metadata title if no custom title provided
    const finalTitle = title || metadata.title || 'New Story';

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI();

    // Try to upload - with automatic token refresh on failure
    let uploadAttempt = 0;
    const maxAttempts = 2;
    
    while (uploadAttempt < maxAttempts) {
      uploadAttempt++;
      
      try {
        console.log(`[TikTok Auto-Post] Upload attempt ${uploadAttempt}/${maxAttempts}`);
        
        // Upload to TikTok
        const result = await tiktokApi.uploadVideo(credentials.accessToken, {
          video_file: videoFile,
          title: finalTitle,
          description: description || `Watch this story from ${metadata.title || 'Reddit'}!`,
          privacy_level: 'PUBLIC_TO_EVERYONE', // Production mode: public posts
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        });

        console.log(`[TikTok Auto-Post] Video uploaded successfully to TikTok`);
        return {
          success: true,
          publishId: result.publish_id,
        };
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
        console.error(`[TikTok Auto-Post] Upload attempt ${uploadAttempt} failed:`, errorMessage);
        
        // Check if error is due to token expiry (401, 403, TOKEN_EXPIRED prefix, or specific error messages)
        const isTokenError = 
          errorMessage.includes('TOKEN_EXPIRED:') ||
          errorMessage.includes('401') ||
          errorMessage.includes('Unauthorized') ||
          errorMessage.includes('access token is invalid') ||
          errorMessage.includes('access_token_invalid') ||
          errorMessage.includes('invalid_token') ||
          errorMessage.includes('token expired') ||
          errorMessage.includes('403') ||
          errorMessage.includes('Permission denied');
        
        if (isTokenError && uploadAttempt < maxAttempts) {
          console.log(`[TikTok Auto-Post] Token error detected, attempting to refresh...`);
          
          try {
            // Attempt to refresh the token
            const refreshedTokens = await tiktokApi.refreshAccessToken(credentials.refreshToken);
            console.log(`[TikTok Auto-Post] Token refreshed successfully`);
            
            // Update credentials in Firestore
            await updateTikTokAccessToken(userId, refreshedTokens.access_token, refreshedTokens.refresh_token);
            
            // Update our local credentials object for retry
            credentials = {
              accessToken: refreshedTokens.access_token,
              refreshToken: refreshedTokens.refresh_token || credentials.refreshToken,
            };
            
            console.log(`[TikTok Auto-Post] Retrying upload with new token...`);
            continue; // Retry upload with new token
          } catch (refreshError) {
            console.error(`[TikTok Auto-Post] Token refresh failed:`, refreshError);
            return {
              success: false,
              error: `Token expired and refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`,
              errorType: 'TOKEN_REFRESH_FAILED',
            };
          }
        }
        
        // If not a token error, or we've exhausted retries, return failure
        return {
          success: false,
          error: errorMessage,
          errorType: isTokenError ? 'TOKEN_EXPIRED' : 'UPLOAD_FAILED',
        };
      }
    }
    
    // Should never reach here, but just in case
    return {
      success: false,
      error: 'Upload failed after all retry attempts',
      errorType: 'UPLOAD_FAILED',
    };
  } catch (error) {
    console.error('[TikTok Auto-Post] Unexpected error in postVideoToTikTok:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: 'UNKNOWN',
    };
  }
}

/**
 * Post multiple videos to TikTok
 */
export async function postBatchToTikTok(
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
    errorType?: 'TOKEN_EXPIRED' | 'TOKEN_REFRESH_FAILED' | 'UPLOAD_FAILED' | 'UNKNOWN';
    publishId?: string;
  }>;
}> {
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (const videoId of videoIds) {
    const result = await postVideoToTikTok(userId, videoId, railwayApiUrl);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }

    results.push({
      videoId,
      ...result,
    });

    // Add delay between posts to avoid rate limiting (TikTok has a 15 posts/24h limit)
    if (videoId !== videoIds[videoIds.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    }
  }

  return {
    successCount,
    failureCount,
    results,
  };
}

