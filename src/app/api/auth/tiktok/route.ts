import { NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { getPublicOrigin } from '@/lib/server/public-origin';

// Prevent static generation
export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    console.log('Initiating TikTok OAuth flow...');
    
    // Verify environment variables
    if (!process.env.TIKTOK_CLIENT_KEY) {
      console.error('TIKTOK_CLIENT_KEY is not set');
      return NextResponse.json(
        { error: 'TikTok client key is not configured' },
        { status: 500 }
      );
    }

    if (!process.env.TIKTOK_CLIENT_SECRET) {
      console.error('TIKTOK_CLIENT_SECRET is not set');
      return NextResponse.json(
        { error: 'TikTok client secret is not configured' },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error('NEXT_PUBLIC_APP_URL is not set');
      return NextResponse.json(
        { error: 'App URL is not configured' },
        { status: 500 }
      );
    }

    console.log('Initializing TikTok API...');
    const tiktokApi = new TikTokAPI();
    
    console.log('Generating OAuth URL...');
    // IMPORTANT: We intentionally use apex for redirect_uri so TikTok domain verification works.
    // www is a CNAME (can't reliably publish TXT), so TikTok rejects redirect_uri on www.
    const redirectUri = `https://taleo.media/api/auth/tiktok/callback`;
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode');
    // Use this only for debugging: isolates whether TikTok rejects because of video scopes.
    // TEMPORARY: Using minimal scopes until we verify which are approved in TikTok Developer Dashboard
    const scope =
      mode === 'login'
        ? 'user.info.basic'
        : 'user.info.basic,video.upload,video.publish';
    const authReq = tiktokApi.createAuthRequest({ redirectUri, scope });
    
    // If redirect=1, do a server-side redirect (more robust than returning JSON + client redirect).
    const doRedirect = url.searchParams.get('redirect') === '1';

    // Clear any existing OAuth state cookie to force fresh authorization
    // This helps when users want to switch to a different TikTok account
    const response = doRedirect
      ? NextResponse.redirect(authReq.url)
      : NextResponse.json({ url: authReq.url });
    
    // Delete old cookie first
    response.cookies.delete({
      name: 'tiktok_oauth',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.taleo.media' : undefined,
    });
    
    // Set new OAuth state cookie
    response.cookies.set({
      name: 'tiktok_oauth',
      value: JSON.stringify({
        state: authReq.state,
        codeVerifier: authReq.codeVerifier,
        redirectUri: authReq.redirectUri,
        createdAt: Date.now(),
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // Must be readable on apex callback.
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.taleo.media' : undefined,
      maxAge: 10 * 60, // 10 minutes
    });

    console.log('OAuth URL generated successfully:', authReq.url);
    return response;
  } catch (error) {
    console.error('Error initiating TikTok OAuth:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate TikTok authentication',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 