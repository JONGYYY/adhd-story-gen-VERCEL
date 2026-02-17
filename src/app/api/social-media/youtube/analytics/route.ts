import { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { YouTubeAPI } from '@/lib/social-media/youtube';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== YouTube Analytics Request ===');
    
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
        connected: false
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

    // Get video ID from query params (optional)
    const videoId = request.nextUrl.searchParams.get('videoId');

    const youtubeApi = new YouTubeAPI();

    if (videoId) {
      // Get analytics for specific video
      console.log('Fetching analytics for video:', videoId);
      const videoAnalytics = await youtubeApi.getVideoAnalytics(credentials.accessToken, videoId);
      
      return new Response(JSON.stringify({
        success: true,
        video: videoAnalytics
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get channel-level analytics
      console.log('Fetching channel analytics');
      
      // Check if token is expired and refresh if needed
      const now = Date.now();
      const isExpired = credentials.expiresAt && credentials.expiresAt < now;
      const isExpiringSoon = credentials.expiresAt && credentials.expiresAt < now + (5 * 60 * 1000); // Within 5 minutes
      
      let accessToken = credentials.accessToken;
      
      if ((isExpired || isExpiringSoon) && credentials.refreshToken) {
        console.log('YouTube token expired or expiring soon, refreshing...');
        try {
          const newTokens = await youtubeApi.refreshAccessToken(credentials.refreshToken);
          accessToken = newTokens.access_token;
          
          console.log('New token details:', {
            hasAccessToken: !!newTokens.access_token,
            expiresIn: newTokens.expires_in,
            expiryDate: newTokens.expiry_date,
            calculatedExpiresAt: Date.now() + ((newTokens.expires_in || 3600) * 1000)
          });
          
          // Update stored credentials in Firebase
          const { setSocialMediaCredentialsServer } = await import('@/lib/social-media/schema');
          await setSocialMediaCredentialsServer(userId, 'youtube', {
            accessToken: newTokens.access_token,
            expiresAt: newTokens.expiry_date || (Date.now() + ((newTokens.expires_in || 3600) * 1000)),
            // Use new refresh token if provided, otherwise keep existing one
            refreshToken: newTokens.refresh_token || credentials.refreshToken,
            lastRefreshed: Date.now(),
          });
          
          console.log('YouTube token refreshed and saved to Firebase successfully');
        } catch (refreshError) {
          console.error('Failed to refresh YouTube token:', refreshError);
          return new Response(JSON.stringify({
            success: false,
            error: 'YouTube access token expired. Please disconnect and reconnect YouTube.',
            reconnectRequired: true
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      const channelAnalytics = await youtubeApi.getChannelAnalytics(accessToken);
      
      return new Response(JSON.stringify({
        success: true,
        channel: channelAnalytics,
        connected: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('=== YouTube Analytics Error ===');
    console.error('Error details:', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific errors
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
        errorMessage = 'YouTube access token expired. Please reconnect YouTube.';
      } else if (errorMessage.includes('insufficient permissions')) {
        errorMessage = 'Missing YouTube Analytics permission. Please disconnect and reconnect YouTube.';
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

