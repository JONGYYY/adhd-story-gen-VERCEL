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
 * Get video file from Railway API
 */
async function getVideoFile(videoId: string, railwayApiUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(`${railwayApiUrl}/api/video/${videoId}/download`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Failed to download video ${videoId}: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Failed to fetch video ${videoId}:`, error);
    return null;
  }
}

/**
 * Post a single video to TikTok
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
  publishId?: string;
}> {
  try {
    // Get user's TikTok credentials
    const credentials = await getUserTikTokCredentials(userId);
    if (!credentials) {
      return {
        success: false,
        error: 'TikTok not connected',
      };
    }

    // Download video file
    const videoFile = await getVideoFile(videoId, railwayApiUrl);
    if (!videoFile) {
      return {
        success: false,
        error: 'Failed to download video',
      };
    }

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI(
      process.env.TIKTOK_CLIENT_KEY!,
      process.env.TIKTOK_CLIENT_SECRET!
    );

    // Upload to TikTok
    const result = await tiktokApi.uploadVideo(credentials.accessToken, {
      video_file: videoFile,
      title: title || 'New Story',
      description: description,
      privacy_level: 'SELF_ONLY', // Sandbox mode: drafts only
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
    });

    return {
      success: true,
      publishId: result.publish_id,
    };
  } catch (error) {
    console.error('Failed to post video to TikTok:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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

    // Add delay between posts to avoid rate limiting
    if (videoId !== videoIds[videoIds.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return {
    successCount,
    failureCount,
    results,
  };
}

