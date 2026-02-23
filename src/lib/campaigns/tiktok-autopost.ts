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
  expiresAt: number;
} | null> {
  try {
    console.log(`[TikTok Credentials] Fetching credentials for user ${userId}`);
    console.log(`[TikTok Credentials] Document path: ${SOCIAL_CREDENTIALS_COLLECTION}/${userId}_tiktok`);
    
    const db = await getAdminFirestore();
    // Document ID format: ${userId}_tiktok (e.g., "abc123_tiktok")
    const doc = await db.collection(SOCIAL_CREDENTIALS_COLLECTION).doc(`${userId}_tiktok`).get();

    if (!doc.exists) {
      console.error(`[TikTok Credentials] ❌ Document does not exist`);
      return null;
    }

    const data = doc.data();
    console.log(`[TikTok Credentials] Document found, checking fields...`);
    console.log(`[TikTok Credentials] Has accessToken: ${!!data?.accessToken}`);
    console.log(`[TikTok Credentials] Has refreshToken: ${!!data?.refreshToken}`);
    console.log(`[TikTok Credentials] Has expiresAt: ${!!data?.expiresAt}`);
    
    if (data?.expiresAt) {
      const expiresAt = data.expiresAt;
      const now = Date.now();
      const isExpired = expiresAt < now;
      const timeUntilExpiry = expiresAt - now;
      const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
      
      console.log(`[TikTok Credentials] Token expires at: ${new Date(expiresAt).toISOString()}`);
      console.log(`[TikTok Credentials] Current time: ${new Date(now).toISOString()}`);
      console.log(`[TikTok Credentials] Is expired: ${isExpired}`);
      console.log(`[TikTok Credentials] Time until expiry: ${hoursUntilExpiry.toFixed(2)} hours`);
    }
    
    // Credentials are stored directly on the document, not nested under 'tiktok'
    if (!data?.accessToken) {
      console.error(`[TikTok Credentials] ❌ No accessToken field found`);
      return null;
    }

    if (!data?.refreshToken) {
      console.error(`[TikTok Credentials] ⚠️ No refreshToken field found - token refresh will fail!`);
    }

    console.log(`[TikTok Credentials] ✅ Credentials retrieved successfully`);
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt || Date.now() + 86400000, // Default 24 hours if not set
    };
  } catch (error) {
    console.error(`[TikTok Credentials] ❌ Failed to get TikTok credentials:`, error);
    return null;
  }
}

/**
 * Ensure TikTok token is valid, refresh proactively if needed
 * Returns valid credentials or throws error
 */
async function ensureValidTikTokToken(
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
    console.log('[TikTok Token Validation] ========================================');
    console.log('[TikTok Token Validation] Token expired or expiring soon');
    console.log('[TikTok Token Validation] Current time:', new Date(now).toISOString());
    console.log('[TikTok Token Validation] Token expires at:', new Date(credentials.expiresAt).toISOString());
    console.log('[TikTok Token Validation] Refreshing proactively BEFORE upload attempt...');
    console.log('[TikTok Token Validation] ========================================');
    
    if (!credentials.refreshToken) {
      console.error('[TikTok Token Validation] ❌ No refresh token available. User must reconnect TikTok.');
      throw new Error('No refresh token available. User must reconnect TikTok.');
    }
    
    try {
      const tiktokApi = new TikTokAPI();
      console.log('[TikTok Token Validation] Calling TikTok API to refresh token...');
      const refreshedTokens = await tiktokApi.refreshAccessToken(credentials.refreshToken);
      console.log('[TikTok Token Validation] ✅ Token refreshed successfully');
      console.log('[TikTok Token Validation] New token expires in:', refreshedTokens.expires_in || 86400, 'seconds');
      
      const refreshedCredentials = {
        accessToken: refreshedTokens.access_token,
        refreshToken: refreshedTokens.refresh_token || credentials.refreshToken,
        expiresAt: Date.now() + ((refreshedTokens.expires_in || 86400) * 1000),
      };
      
      // Save immediately
      console.log('[TikTok Token Validation] Saving refreshed token to Firestore...');
      await updateTikTokAccessToken(
        userId,
        refreshedCredentials.accessToken,
        refreshedCredentials.refreshToken,
        refreshedTokens.expires_in
      );
      console.log('[TikTok Token Validation] ✅ Token saved successfully');
      
      return refreshedCredentials;
    } catch (error) {
      console.error('[TikTok Token Validation] ========================================');
      console.error('[TikTok Token Validation] ❌ Token refresh failed');
      console.error('[TikTok Token Validation] Error:', error);
      console.error('[TikTok Token Validation] ========================================');
      throw new Error(`Failed to refresh TikTok token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log('[TikTok Token Validation] ✅ Token is valid (not expiring within 10 minutes)');
  console.log('[TikTok Token Validation] Expires at:', new Date(credentials.expiresAt).toISOString());
  return credentials;
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
    // Add timeout to prevent response.json() hang (Railway proxy bug)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${railwayApiUrl}/api/video-status/${videoId}?userId=${userId}`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    if (isTimeout) {
      console.error(`[TikTok Auto-Post] ⏱️ Timeout fetching video ${videoId} metadata after 10s`);
    } else {
      console.error(`Failed to fetch video status ${videoId}:`, error);
    }
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
async function updateTikTokAccessToken(userId: string, accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void> {
  try {
    console.log(`[TikTok Token Update] Updating token in Firestore for user ${userId}`);
    console.log(`[TikTok Token Update] New access token length: ${accessToken.length}`);
    console.log(`[TikTok Token Update] New refresh token provided: ${!!refreshToken}`);
    console.log(`[TikTok Token Update] Expires in: ${expiresIn || 'Not provided (using 24h default)'} seconds`);
    
    const db = await getAdminFirestore();
    const updateData: any = {
      accessToken,
      updatedAt: Date.now(),
      // TikTok access tokens expire after 24 hours (86400 seconds)
      expiresAt: Date.now() + ((expiresIn || 86400) * 1000),
      lastRefreshed: Date.now(),
    };
    
    // Update refresh token if provided (TikTok may return new refresh token)
    if (refreshToken) {
      updateData.refreshToken = refreshToken;
      console.log(`[TikTok Token Update] Updating refresh token as well`);
    }
    
    console.log(`[TikTok Token Update] Update data:`, {
      ...updateData,
      accessToken: `${accessToken.substring(0, 15)}...`,
      refreshToken: refreshToken ? `${refreshToken.substring(0, 15)}...` : undefined,
    });
    
    await db.collection(SOCIAL_CREDENTIALS_COLLECTION).doc(`${userId}_tiktok`).update(updateData);
    console.log(`[TikTok Token Update] ✅ Access token updated successfully for user ${userId}`);
  } catch (error) {
    console.error('[TikTok Token Update] ❌ Failed to update access token:', error);
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
    console.log(`[TikTok Auto-Post] ========================================`);
    console.log(`[TikTok Auto-Post] Starting upload for video ${videoId}`);
    console.log(`[TikTok Auto-Post] User ID: ${userId}`);
    console.log(`[TikTok Auto-Post] Railway API URL: ${railwayApiUrl}`);
    console.log(`[TikTok Auto-Post] Custom Title: ${title || 'None (will use metadata)'}`);
    console.log(`[TikTok Auto-Post] ========================================`);
    
    // Get user's TikTok credentials
    console.log(`[TikTok Auto-Post] Step 1: Retrieving TikTok credentials from Firestore...`);
    let credentials = await getUserTikTokCredentials(userId);
    if (!credentials) {
      console.error(`[TikTok Auto-Post] ❌ No TikTok credentials found for user ${userId}`);
      console.error(`[TikTok Auto-Post] Expected document: socialMediaCredentials/${userId}_tiktok`);
      return {
        success: false,
        error: 'TikTok not connected',
        errorType: 'UNKNOWN',
      };
    }
    
    console.log(`[TikTok Auto-Post] ✅ TikTok credentials found for user ${userId}`);
    console.log(`[TikTok Auto-Post] Access token length: ${credentials.accessToken.length}`);
    console.log(`[TikTok Auto-Post] Access token starts with: ${credentials.accessToken.substring(0, 15)}...`);
    console.log(`[TikTok Auto-Post] Has refresh token: ${!!credentials.refreshToken}`);
    console.log(`[TikTok Auto-Post] Token expires at: ${new Date(credentials.expiresAt).toISOString()}`);

    // CRITICAL: Ensure token is valid BEFORE attempting upload (proactive refresh)
    console.log(`[TikTok Auto-Post] Step 1.5: Validating token and refreshing if needed...`);
    try {
      credentials = await ensureValidTikTokToken(userId, credentials);
      console.log(`[TikTok Auto-Post] ✅ Token validated and ready for upload`);
    } catch (tokenError) {
      console.error(`[TikTok Auto-Post] ❌ Token validation failed:`, tokenError);
      return {
        success: false,
        error: tokenError instanceof Error ? tokenError.message : 'Token validation failed',
        errorType: 'TOKEN_REFRESH_FAILED',
      };
    }

    // Get video metadata (includes videoUrl)
    console.log(`[TikTok Auto-Post] Step 2: Fetching video metadata...`);
    console.log(`[TikTok Auto-Post] URL: ${railwayApiUrl}/api/video-status/${videoId}?userId=${userId}`);
    const metadata = await getVideoMetadata(videoId, userId, railwayApiUrl);
    if (!metadata || !metadata.videoUrl) {
      console.error(`[TikTok Auto-Post] ❌ Failed to get video metadata or URL for ${videoId}`);
      console.error(`[TikTok Auto-Post] Metadata received:`, JSON.stringify(metadata, null, 2));
      return {
        success: false,
        error: 'Failed to get video URL from metadata',
        errorType: 'UPLOAD_FAILED',
      };
    }
    
    console.log(`[TikTok Auto-Post] ✅ Video metadata retrieved`);
    console.log(`[TikTok Auto-Post]    Video URL: ${metadata.videoUrl}`);
    console.log(`[TikTok Auto-Post]    Title: ${metadata.title || 'None'}`);
    
    // Download video file from URL
    console.log(`[TikTok Auto-Post] Step 3: Downloading video file...`);
    const videoFile = await downloadVideoFile(metadata.videoUrl);
    if (!videoFile) {
      console.error(`[TikTok Auto-Post] ❌ Failed to download video file from ${metadata.videoUrl}`);
      return {
        success: false,
        error: 'Failed to download video file',
        errorType: 'UPLOAD_FAILED',
      };
    }
    
    console.log(`[TikTok Auto-Post] ✅ Video file downloaded: ${(videoFile.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Use metadata title if no custom title provided
    const finalTitle = title || metadata.title || 'New Story';
    const finalDescription = description || `Watch this story from ${metadata.title || 'Reddit'}!`;

    console.log(`[TikTok Auto-Post] Step 4: Preparing upload...`);
    console.log(`[TikTok Auto-Post]    Final Title: ${finalTitle}`);
    console.log(`[TikTok Auto-Post]    Final Description: ${finalDescription}`);
    console.log(`[TikTok Auto-Post]    Privacy Level: PUBLIC_TO_EVERYONE`);

    // Initialize TikTok API
    console.log(`[TikTok Auto-Post] Step 5: Initializing TikTok API...`);
    const tiktokApi = new TikTokAPI();
    console.log(`[TikTok Auto-Post] ✅ TikTok API initialized`);

    // Try to upload - with automatic token refresh on failure
    let uploadAttempt = 0;
    const maxAttempts = 2;
    
    while (uploadAttempt < maxAttempts) {
      uploadAttempt++;
      
      try {
        console.log(`[TikTok Auto-Post] ========================================`);
        console.log(`[TikTok Auto-Post] Upload attempt ${uploadAttempt}/${maxAttempts}`);
        console.log(`[TikTok Auto-Post] ========================================`);
        
        // Upload to TikTok
        console.log(`[TikTok Auto-Post] Calling tiktokApi.uploadVideo()...`);
        const result = await tiktokApi.uploadVideo(credentials.accessToken, {
          video_file: videoFile,
          title: finalTitle,
          description: finalDescription,
          privacy_level: 'PUBLIC_TO_EVERYONE', // Production mode: public posts
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        });

        console.log(`[TikTok Auto-Post] ========================================`);
        console.log(`[TikTok Auto-Post] ✅ Video uploaded successfully to TikTok!`);
        console.log(`[TikTok Auto-Post] Publish ID: ${result.publish_id}`);
        console.log(`[TikTok Auto-Post] ========================================`);
        return {
          success: true,
          publishId: result.publish_id,
        };
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
        console.error(`[TikTok Auto-Post] ========================================`);
        console.error(`[TikTok Auto-Post] ❌ Upload attempt ${uploadAttempt} failed`);
        console.error(`[TikTok Auto-Post] Error message: ${errorMessage}`);
        console.error(`[TikTok Auto-Post] ========================================`);
        
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
          console.log(`[TikTok Auto-Post] ========================================`);
          console.log(`[TikTok Auto-Post] Token error detected, attempting to refresh...`);
          console.log(`[TikTok Auto-Post] Refresh token available: ${!!credentials.refreshToken}`);
          console.log(`[TikTok Auto-Post] ========================================`);
          
          try {
            // Attempt to refresh the token
            console.log(`[TikTok Auto-Post] Calling tiktokApi.refreshAccessToken()...`);
            const refreshedTokens = await tiktokApi.refreshAccessToken(credentials.refreshToken);
            console.log(`[TikTok Auto-Post] ✅ Token refreshed successfully`);
            console.log(`[TikTok Auto-Post] New access token length: ${refreshedTokens.access_token.length}`);
            console.log(`[TikTok Auto-Post] New refresh token: ${refreshedTokens.refresh_token ? 'Provided' : 'Not provided (using old one)'}`);
            console.log(`[TikTok Auto-Post] Token expires in: ${refreshedTokens.expires_in || 86400} seconds`);
            
            // Update credentials in Firestore
            console.log(`[TikTok Auto-Post] Updating token in Firestore...`);
            await updateTikTokAccessToken(
              userId, 
              refreshedTokens.access_token, 
              refreshedTokens.refresh_token,
              refreshedTokens.expires_in
            );
            console.log(`[TikTok Auto-Post] ✅ Token updated in Firestore`);
            
            // Update our local credentials object for retry
            credentials = {
              accessToken: refreshedTokens.access_token,
              refreshToken: refreshedTokens.refresh_token || credentials.refreshToken,
              expiresAt: Date.now() + ((refreshedTokens.expires_in || 86400) * 1000),
            };
            
            console.log(`[TikTok Auto-Post] Retrying upload with new token...`);
            continue; // Retry upload with new token
          } catch (refreshError) {
            console.error(`[TikTok Auto-Post] ========================================`);
            console.error(`[TikTok Auto-Post] ❌ Token refresh failed`);
            console.error(`[TikTok Auto-Post] Error:`, refreshError);
            console.error(`[TikTok Auto-Post] ========================================`);
            return {
              success: false,
              error: `Token expired and refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`,
              errorType: 'TOKEN_REFRESH_FAILED',
            };
          }
        }
        
        // If not a token error, or we've exhausted retries, return failure
        console.error(`[TikTok Auto-Post] ========================================`);
        console.error(`[TikTok Auto-Post] Upload failed - no more retries`);
        console.error(`[TikTok Auto-Post] Is token error: ${isTokenError}`);
        console.error(`[TikTok Auto-Post] Attempts made: ${uploadAttempt}/${maxAttempts}`);
        console.error(`[TikTok Auto-Post] Final error: ${errorMessage}`);
        console.error(`[TikTok Auto-Post] ========================================`);
        return {
          success: false,
          error: errorMessage,
          errorType: isTokenError ? 'TOKEN_EXPIRED' : 'UPLOAD_FAILED',
        };
      }
    }
    
    // Should never reach here, but just in case
    console.error(`[TikTok Auto-Post] ========================================`);
    console.error(`[TikTok Auto-Post] ❌ Upload failed - exhausted all retry attempts`);
    console.error(`[TikTok Auto-Post] This should not happen - check loop logic`);
    console.error(`[TikTok Auto-Post] ========================================`);
    return {
      success: false,
      error: 'Upload failed after all retry attempts',
      errorType: 'UPLOAD_FAILED',
    };
  } catch (error) {
    console.error(`[TikTok Auto-Post] ========================================`);
    console.error(`[TikTok Auto-Post] ❌ UNEXPECTED ERROR in postVideoToTikTok`);
    console.error(`[TikTok Auto-Post] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`[TikTok Auto-Post] Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`[TikTok Auto-Post] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    console.error(`[TikTok Auto-Post] ========================================`);
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
  console.log(`[TikTok Batch] ========================================`);
  console.log(`[TikTok Batch] Starting batch upload for ${videoIds.length} videos`);
  console.log(`[TikTok Batch] User ID: ${userId}`);
  console.log(`[TikTok Batch] Railway API URL: ${railwayApiUrl}`);
  console.log(`[TikTok Batch] Video IDs: ${videoIds.join(', ')}`);
  console.log(`[TikTok Batch] ========================================`);
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < videoIds.length; i++) {
    const videoId = videoIds[i];
    console.log(`[TikTok Batch] Processing video ${i + 1}/${videoIds.length}: ${videoId}`);
    
    const result = await postVideoToTikTok(userId, videoId, railwayApiUrl);
    
    if (result.success) {
      successCount++;
      console.log(`[TikTok Batch] ✅ Video ${i + 1}/${videoIds.length} uploaded successfully`);
    } else {
      failureCount++;
      console.error(`[TikTok Batch] ❌ Video ${i + 1}/${videoIds.length} upload failed`);
      console.error(`[TikTok Batch]    Error: ${result.error}`);
      console.error(`[TikTok Batch]    Error Type: ${result.errorType}`);
    }

    results.push({
      videoId,
      ...result,
    });

    // Add delay between posts to avoid rate limiting (TikTok has a 15 posts/24h limit)
    if (i < videoIds.length - 1) {
      console.log(`[TikTok Batch] Waiting 3 seconds before next upload...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    }
  }

  console.log(`[TikTok Batch] ========================================`);
  console.log(`[TikTok Batch] Batch upload complete`);
  console.log(`[TikTok Batch] Success: ${successCount}/${videoIds.length}`);
  console.log(`[TikTok Batch] Failed: ${failureCount}/${videoIds.length}`);
  console.log(`[TikTok Batch] ========================================`);

  return {
    successCount,
    failureCount,
    results,
  };
}

