import { NextResponse } from 'next/server';
import { YouTubeAPI } from '@/lib/social-media/youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('Initiating YouTube OAuth flow...');
    
    // Verify environment variables
    if (!process.env.YOUTUBE_CLIENT_ID) {
      console.error('YOUTUBE_CLIENT_ID is not set');
      return new Response(JSON.stringify({ 
        error: 'YouTube client ID is not configured' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!process.env.YOUTUBE_CLIENT_SECRET) {
      console.error('YOUTUBE_CLIENT_SECRET is not set');
      return new Response(JSON.stringify({ 
        error: 'YouTube client secret is not configured' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Initializing YouTube API...');
    const youtubeApi = new YouTubeAPI();
    
    console.log('Generating OAuth URL...');
    const authUrl = youtubeApi.getAuthUrl();
    
    // Check if we should do a server-side redirect (more robust than returning JSON)
    const url = new URL(request.url);
    const doRedirect = url.searchParams.get('redirect') === '1';

    console.log('OAuth URL generated successfully:', authUrl);
    console.log('Redirect mode:', doRedirect);

    // If redirect=1, do a server-side redirect
    if (doRedirect) {
      return NextResponse.redirect(authUrl);
    }
    
    // Otherwise, return JSON (for API calls)
    return new Response(JSON.stringify({ url: authUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error initiating YouTube OAuth:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to initiate YouTube authentication' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 