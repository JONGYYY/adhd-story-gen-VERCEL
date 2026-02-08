import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Video Metadata Storage in Firestore
 * Provides persistent, queryable video information
 */

export interface VideoMetadata {
  videoId: string;
  userId: string;
  status: 'processing' | 'completed' | 'failed';
  title: string;
  subreddit: string;
  videoUrl?: string; // R2 URL (only set when completed)
  thumbnailUrl?: string; // Optional thumbnail
  error?: string; // Error message if failed
  createdAt: number;
  updatedAt: number;
  duration?: number; // Video duration in seconds
  metadata?: {
    background?: string;
    voice?: string;
    speedMultiplier?: number;
    isCliffhanger?: boolean;
    wordCount?: number;
    storyLength?: number;
  };
}

const VIDEOS_COLLECTION = 'videos';

/**
 * Save video metadata to Firestore
 */
export async function saveVideoMetadata(
  videoId: string,
  userId: string,
  data: Partial<VideoMetadata>
): Promise<void> {
  const db = await getAdminFirestore();
  const now = Date.now();
  
  const metadata: VideoMetadata = {
    videoId,
    userId,
    status: data.status || 'processing',
    title: data.title || 'Untitled Story',
    subreddit: data.subreddit || 'r/stories',
    videoUrl: data.videoUrl,
    thumbnailUrl: data.thumbnailUrl,
    error: data.error,
    createdAt: data.createdAt || now,
    updatedAt: now,
    duration: data.duration,
    metadata: data.metadata,
  };
  
  await db.collection(VIDEOS_COLLECTION).doc(videoId).set(metadata, { merge: true });
  console.log('[firestore] Video metadata saved:', videoId);
}

/**
 * Get video metadata by ID and validate user ownership
 * @throws Error if video not found or user doesn't own it
 */
export async function getVideoMetadata(
  videoId: string,
  userId: string
): Promise<VideoMetadata> {
  const db = await getAdminFirestore();
  const doc = await db.collection(VIDEOS_COLLECTION).doc(videoId).get();
  
  if (!doc.exists) {
    throw new Error('Video not found');
  }
  
  const data = doc.data() as VideoMetadata;
  
  // SECURITY: Verify user owns this video
  if (data.userId !== userId) {
    console.warn('[firestore] Access denied: User', userId, 'attempted to access video', videoId, 'owned by', data.userId);
    throw new Error('Access denied: You do not own this video');
  }
  
  return data;
}

/**
 * Update video status (processing → completed/failed)
 */
export async function updateVideoStatus(
  videoId: string,
  status: 'processing' | 'completed' | 'failed',
  updates: Partial<VideoMetadata> = {}
): Promise<void> {
  const db = await getAdminFirestore();
  
  await db.collection(VIDEOS_COLLECTION).doc(videoId).update({
    status,
    updatedAt: Date.now(),
    ...updates,
  });
  
  console.log('[firestore] Video status updated:', videoId, '→', status);
}

/**
 * Get all videos for a user (for Library page)
 */
export async function getUserVideos(
  userId: string,
  limit: number = 50
): Promise<VideoMetadata[]> {
  const db = await getAdminFirestore();
  
  const snapshot = await db
    .collection(VIDEOS_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => doc.data() as VideoMetadata);
}

/**
 * Get recent videos for a user (for Dashboard)
 */
export async function getRecentUserVideos(
  userId: string,
  limit: number = 6
): Promise<VideoMetadata[]> {
  return getUserVideos(userId, limit);
}

/**
 * Check if video exists and user has access
 */
export async function checkVideoAccess(
  videoId: string,
  userId: string
): Promise<boolean> {
  try {
    await getVideoMetadata(videoId, userId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete video metadata (cleanup)
 */
export async function deleteVideoMetadata(
  videoId: string,
  userId: string
): Promise<void> {
  // Verify ownership before deletion
  await getVideoMetadata(videoId, userId);
  
  const db = await getAdminFirestore();
  await db.collection(VIDEOS_COLLECTION).doc(videoId).delete();
  
  console.log('[firestore] Video metadata deleted:', videoId);
}
