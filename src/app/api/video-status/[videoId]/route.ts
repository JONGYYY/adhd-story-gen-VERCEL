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
  
  const status = toFrontendStatus(result.status);
  const progress = typeof result.progress === 'number' ? result.progress : (result.status === 'completed' ? 100 : 0);
  const videoUrl = result.videoUrl
    ? (result.videoUrl.startsWith('http') ? result.videoUrl : `${RAILWAY_API_URL}${result.videoUrl}`)
    : null;

  // Build response with NO undefined values (NextResponse.json() can't serialize undefined)
  const responseData: Record<string, any> = {
    status,
    progress,
    videoUrl: status === 'ready' ? videoUrl : null,
  };
  
  // Only add optional fields if they exist
  if (result.error) responseData.error = String(result.error);
  if (result.title) responseData.title = String(result.title);
  if (result.duration) responseData.duration = Number(result.duration);
  if (result.message) responseData.message = String(result.message);
  
  return responseData;
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
        return NextResponse.json(railwayStatus, {
          status: 200,
          headers: {
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
        });
      } catch (railwayError) {
        console.error('Railway API error:', railwayError);
        // If Railway also fails, return not found
        return NextResponse.json({
          error: 'Video status not found'
        }, {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          },
        });
      }
    } else {
      // Return local status if found, merge with Firestore metadata
      console.log('Found local video status:', JSON.stringify(localStatus, null, 2));
      
      // Build clean response with no undefined values
      const responseData: Record<string, any> = {
        status: localStatus.status,
        progress: localStatus.progress,
        videoUrl: localStatus.videoUrl,
      };
      
      // Add optional fields only if they exist
      if (localStatus.error) responseData.error = localStatus.error;
      if (localStatus.title || firestoreMetadata?.title) {
        responseData.title = localStatus.title || firestoreMetadata?.title;
      }
      if (localStatus.duration || firestoreMetadata?.duration) {
        responseData.duration = localStatus.duration || firestoreMetadata?.duration;
      }
      
      return NextResponse.json(responseData, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        },
      });
    }
  } catch (error) {
    console.error('Failed to get video status:', error);
    return NextResponse.json({
      error: 'Failed to get video status'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
    });
  }
}
