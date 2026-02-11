/**
 * YouTube auto-posting for batch-generated videos
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import { YouTubeAPI } from '@/lib/social-media/youtube';

const SOCIAL_CREDENTIALS_COLLECTION = 'social_credentials';

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
 * Get video URL from Railway API
 */
async function getVideoUrl(videoId: string, railwayApiUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${railwayApiUrl}/api/video-status/${videoId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Failed to get video status ${videoId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.videoUrl || null;
  } catch (error) {
    console.error(`Failed to fetch video status ${videoId}:`, error);
    return null;
  }
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
  youtubeVideoId?: string;
}> {
  try {
    // Get user's YouTube credentials
    const credentials = await getUserYouTubeCredentials(userId);
    if (!credentials) {
      return {
        success: false,
        error: 'YouTube not connected',
      };
    }

    // Get video URL
    const videoUrl = await getVideoUrl(videoId, railwayApiUrl);
    if (!videoUrl) {
      return {
        success: false,
        error: 'Failed to get video URL',
      };
    }

    // Initialize YouTube API with auto-refresh callback
    const youtubeApi = new YouTubeAPI();
    youtubeApi.setStoredCredentials(credentials, async (newTokens) => {
      // Save refreshed tokens back to Firestore
      await saveYouTubeCredentials(userId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || credentials.refreshToken,
        expiresAt: Date.now() + (newTokens.expires_in * 1000),
      });
    });

    // Upload to YouTube
    const result = await youtubeApi.uploadVideo({
      videoUrl,
      title: title || 'New Story',
      description: description || '',
      tags: ['shorts', 'story', 'trending'],
      privacyStatus: 'public',
    });

    return {
      success: true,
      youtubeVideoId: result.id,
    };
  } catch (error) {
    console.error('Failed to post video to YouTube:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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
