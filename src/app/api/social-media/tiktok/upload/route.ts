import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { TikTokAPI } from '@/lib/social-media/tiktok';

export const dynamic = 'force-dynamic';
// Increase timeout for video uploads (Railway allows up to 300 seconds)
// TikTok video uploads can take time, especially for larger files
export const maxDuration = 180; // 3 minutes

export async function POST(request: NextRequest) {
  try {
    console.log('=== TikTok Video Upload Started ===');
    
    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated:', userId);

    // Get TikTok credentials
    const credentials = await getSocialMediaCredentialsServer(userId, 'tiktok');
    if (!credentials) {
      return new Response(JSON.stringify({ 
        error: 'TikTok not connected. Please connect your TikTok account first.' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('TikTok credentials found');
    if (!credentials.accessToken || typeof credentials.accessToken !== 'string') {
      return new Response(JSON.stringify(
        { error: 'TikTok access token is missing. Please disconnect and reconnect TikTok.' }
      ), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (credentials.accessToken.startsWith('test_access_token_')) {
      return new Response(JSON.stringify({
        error:
          'Your TikTok connection is using a TEST token (TIKTOK_TEST_MODE). Disable test mode and reconnect TikTok in Settings → Social Media.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const videoFile = formData.get('video') as File;
    const privacyLevel = formData.get('privacy_level') as 'PUBLIC' | 'SELF_ONLY' | 'MUTUAL_FOLLOW' || 'SELF_ONLY';

    if (!title || !videoFile) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: title and video file' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Upload request:', {
      title,
      videoSize: videoFile.size,
      videoType: videoFile.type,
      privacyLevel
    });

    // Convert file to buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI();

    // Upload video
    const result = await tiktokApi.uploadVideo(credentials.accessToken, {
      title,
      video_file: videoBuffer,
      privacy_level: privacyLevel
    });

    console.log('Video upload successful:', result);
    console.log('=== TikTok Video Upload Completed ===');

    return new Response(JSON.stringify({
      success: true,
      message: 'Video uploaded successfully',
      result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== TikTok Video Upload Error ===');
    console.error('Error details:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 