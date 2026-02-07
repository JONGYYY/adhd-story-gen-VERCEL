import { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { YouTubeAPI } from '@/lib/social-media/youtube';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== YouTube Videos Request ===');
    
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

    // Get YouTube credentials
    const credentials = await getSocialMediaCredentialsServer(userId, 'youtube');
    if (!credentials) {
      return new Response(JSON.stringify({ 
        error: 'YouTube not connected',
        connected: false,
        videos: []
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!credentials.accessToken) {
      return new Response(JSON.stringify(
        { error: 'YouTube access token is missing' }
      ), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get max results from query params (default 50)
    const maxResults = parseInt(request.nextUrl.searchParams.get('maxResults') || '50');

    const youtubeApi = new YouTubeAPI();
    console.log(`Fetching up to ${maxResults} videos from YouTube channel`);
    
    const videos = await youtubeApi.getChannelVideos(credentials.accessToken, maxResults);
    console.log(`Found ${videos.length} videos`);
    
    return new Response(JSON.stringify({
      success: true,
      videos,
      connected: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== YouTube Videos Error ===');
    console.error('Error details:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific errors
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
        errorMessage = 'YouTube access token expired. Please reconnect YouTube.';
      } else if (errorMessage.includes('insufficient permissions')) {
        errorMessage = 'Missing YouTube permission. Please disconnect and reconnect YouTube.';
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      videos: []
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
