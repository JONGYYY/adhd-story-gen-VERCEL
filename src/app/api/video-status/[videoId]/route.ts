import { NextResponse } from 'next/server';
import { getVideoStatus } from '@/lib/video-generator/status';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Railway API configuration
const RAW_RAILWAY_API_URL = (process.env.RAILWAY_API_URL || process.env.NEXT_PUBLIC_RAILWAY_API_URL || 'https://taleo.media').trim();
const RAILWAY_API_URL = RAW_RAILWAY_API_URL.replace(/\/$/, '');

function toFrontendStatus(railwayStatus: string): 'generating' | 'ready' | 'failed' {
  if (railwayStatus === 'processing') return 'generating';
  if (railwayStatus === 'completed') return 'ready';
  if (railwayStatus === 'failed') return 'failed';
  return 'generating';
}

async function getRailwayVideoStatus(videoId: string) {
  if (!RAILWAY_API_URL) {
    throw new Error('Missing RAILWAY_API_URL environment variable');
  }

  console.log(`Checking Railway video status for ID: ${videoId}`);
  
  const response = await fetch(`${RAILWAY_API_URL}/video-status/${videoId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Video status not found');
    }
    const errorText = await response.text();
    throw new Error(`Railway API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Railway video status:', JSON.stringify(result, null, 2));
  console.log('[Video Status API] RAILWAY_API_URL:', RAILWAY_API_URL);
  console.log('[Video Status API] result.videoUrl:', result.videoUrl);
  console.log('[Video Status API] result.title:', result.title);
  
  let status = toFrontendStatus(result.status);
  let progress = typeof result.progress === 'number' ? result.progress : (result.status === 'completed' ? 100 : 0);
  // Accept absolute videoUrl or Railway-relative
  let videoUrl = result.videoUrl
    ? (result.videoUrl.startsWith('http') ? result.videoUrl : `${RAILWAY_API_URL}${result.videoUrl}`)
    : null;
  
  console.log('[Video Status API] Constructed videoUrl:', videoUrl);

  // Guard: if status is ready but file not yet accessible (only for Railway-hosted paths), keep generating
  if (status === 'ready' && videoUrl && videoUrl.startsWith(RAILWAY_API_URL)) {
    try {
      const head = await fetch(videoUrl, { method: 'HEAD', cache: 'no-store' });
      if (!head.ok) {
        console.warn('Video file not yet available, delaying ready state');
        status = 'generating';
        progress = Math.max(progress, 95);
      }
    } catch (e) {
      console.warn('HEAD check failed, delaying ready state');
      status = 'generating';
      progress = Math.max(progress, 95);
    }
  }

  // Transform to frontend format
  return {
    status,
    progress,
    error: result.error,
    videoUrl: status === 'ready' ? videoUrl : null,
    title: result.title || undefined, // Include title for auto-fill
    duration: result.duration || undefined, // Include duration for TikTok validation
  };
}

export async function GET(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    // First, try to get local status
    const localStatus = await getVideoStatus(params.videoId);
    
    // Try to get video metadata from Firestore for additional info (duration, title)
    let firestoreMetadata = null;
    try {
      const db = await getAdminFirestore();
      const doc = await db.collection('videos').doc(params.videoId).get();
      if (doc.exists) {
        firestoreMetadata = doc.data();
      }
    } catch (firestoreError) {
      console.log('Could not fetch Firestore metadata:', firestoreError);
    }
    
    // If local status is not_found, try Railway API
    if (localStatus.status === 'not_found') {
      console.log('Local status not found, checking Railway API...');
      
      try {
        const railwayStatus = await getRailwayVideoStatus(params.videoId);
        return new Response(JSON.stringify(railwayStatus), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
        });
      } catch (railwayError) {
        console.error('Railway API error:', railwayError);
        // If Railway also fails, return not found
        return new Response(JSON.stringify({
          error: 'Video status not found'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
        });
      }
    } else {
      // Return local status if found, merge with Firestore metadata
      console.log('Found local video status:', JSON.stringify(localStatus, null, 2));
      
      const response = {
        ...localStatus,
        // Add Firestore metadata if available
        title: localStatus.title || firestoreMetadata?.title,
        duration: localStatus.duration || firestoreMetadata?.duration,
      };
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        },
      });
    }
  } catch (error) {
    console.error('Failed to get video status:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get video status'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
    });
  }
}
