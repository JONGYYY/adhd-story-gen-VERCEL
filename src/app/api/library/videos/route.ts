import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/get-user';
import { getUserVideos } from '@/lib/storage/video-metadata';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Get user's video library from Firestore
 * Returns only videos owned by the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const user = await requireCurrentUser();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    // Fetch user's videos from Firestore
    const videos = await getUserVideos(user.uid, limit);
    
    // Transform to frontend format
    const formattedVideos = videos.map(video => ({
      id: video.videoId,
      title: video.title,
      subreddit: video.subreddit,
      status: video.status,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      createdAt: video.createdAt,
      duration: video.duration,
      error: video.error,
    }));
    
    return NextResponse.json({
      success: true,
      videos: formattedVideos,
      total: formattedVideos.length,
    });
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.error('[library] Error fetching videos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}
