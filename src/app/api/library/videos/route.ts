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
    
    return new Response(JSON.stringify({
      success: true,
      videos: formattedVideos,
      total: formattedVideos.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication required' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.error('[library] Error fetching videos:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch videos' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
