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
    const origin = getPublicOrigin(request);
    const redirectUri = `${origin}/api/auth/tiktok/callback`;
    const authReq = tiktokApi.createAuthRequest({ redirectUri });
    
    // Persist state + PKCE verifier in an httpOnly cookie for the callback.
    const response = NextResponse.json({ url: authReq.url });
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
      path: '/api/auth/tiktok',
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