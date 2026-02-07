import { NextRequest, NextResponse } from 'next/server';
import { YouTubeAPI } from '@/lib/social-media/youtube';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { setSocialMediaCredentialsServer } from '@/lib/social-media/schema';

// Prevent static generation but use Node.js runtime for Firebase Admin
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max for OAuth callback

export async function GET(request: NextRequest) {
  // Wrap entire handler in a timeout to prevent infinite hangs
  const handlerTimeout = new Promise((_, reject) => {
    setTimeout(() => {
      console.error('=== CRITICAL: OAuth callback timeout after 45 seconds ===');
      reject(new Error('OAuth callback timed out. YouTube API may be slow or your connection is unstable.'));
    }, 45000); // 45 second timeout
  });

  const handler = async () => {
    try {
      console.log('=== YouTube OAuth Callback Started ===');
      console.log('Timestamp:', new Date().toISOString());
      
      const searchParams = request.nextUrl.searchParams;
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      
      console.log('YouTube OAuth callback params:', { code: !!code, state: !!state, error });
    
    if (error) {
      console.error('YouTube OAuth error:', error);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=OAuth error: ${error}`);
    }
    
    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=No authorization code received`);
    }

    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      console.error('No session cookie found');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Not authenticated`);
    }

    // Verify session cookie and get user
    console.log('Verifying session cookie...');
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      console.error('Invalid session cookie');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Invalid session`);
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated:', userId);

    console.log('Initializing YouTube API...');
    const youtubeApi = new YouTubeAPI();
    
    console.log('Getting tokens from code...');
    console.log('Environment check:', {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      expectedRedirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
    });
    const tokens = await youtubeApi.getTokensFromCode(code);

    if (!tokens.access_token) {
      console.error('No access token received from YouTube');
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=No access token received`);
    }

    console.log('Getting user info...');
    // Get user info
    const userInfo = await youtubeApi.getUserInfo(tokens.access_token);

    console.log('YouTube user info:', userInfo);

    // Store credentials in Firebase using server-side function
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      username: userInfo.username,
      expiresAt: tokens.expiry_date ?? (Date.now() + 3600000),
      platform: 'youtube' as const,
      userId: userId,
      profileId: userInfo.id ?? undefined
    };

    console.log('Saving credentials to Firebase...');
    await setSocialMediaCredentialsServer(userId, 'youtube', credentials);

    console.log('YouTube OAuth callback completed successfully');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?success=YouTube connected successfully`);
  } catch (error) {
    console.error('Error handling YouTube OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=Failed to connect YouTube: ${errorMessage}`);
  }
  }; // End of handler function

  // Race between handler and timeout
  try {
    return await Promise.race([handler(), handlerTimeout]) as Response;
  } catch (error) {
    console.error('=== OAuth callback Promise.race error ===');
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'OAuth callback timed out';
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/social-media?error=${encodeURIComponent(errorMessage)}`);
  }
} 