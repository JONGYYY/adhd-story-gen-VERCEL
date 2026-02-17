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
async function getVideoMetadata(videoId: string, railwayApiUrl: string): Promise<{
  videoUrl: string;
  title?: string;
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
    
    if (!data.videoUrl) {
      console.error(`No videoUrl in response for ${videoId}`);
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

    // Get video metadata (includes videoUrl)
    const metadata = await getVideoMetadata(videoId, railwayApiUrl);
    if (!metadata || !metadata.videoUrl) {
      return {
        success: false,
        error: 'Failed to get video URL from metadata',
      };
    }
    
    // Download video file from URL
    const videoFile = await downloadVideoFile(metadata.videoUrl);
    if (!videoFile) {
      return {
        success: false,
        error: 'Failed to download video file',
      };
    }
    
    // Use metadata title if no custom title provided
    const finalTitle = title || metadata.title || 'New Story';

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI(
      process.env.TIKTOK_CLIENT_KEY!,
      process.env.TIKTOK_CLIENT_SECRET!
    );

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

