import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { secureJsonResponse } from '@/lib/security/headers';

export const dynamic = 'force-dynamic';

/**
 * Get stored TikTok credentials (fast, no API call)
 * This returns the username/nickname stored in Firebase, not live data from TikTok
 */
export async function GET(request: NextRequest) {
  try {
    console.log('=== TikTok Credentials Request (Stored) ===');
    
    // SECURITY: Authentication check
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return secureJsonResponse({ error: 'Not authenticated' }, 401);
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return secureJsonResponse({ error: 'Invalid session' }, 401);
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated:', userId);
    
    // SECURITY: Rate limiting
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.READ, userId);
    if (rateLimitResponse) return rateLimitResponse;

    // Get stored credentials from Firebase
    const credentials = await getSocialMediaCredentialsServer(userId, 'tiktok');
    if (!credentials) {
      return secureJsonResponse({ 
        error: 'TikTok not connected. Please connect your TikTok account first.' 
      }, 400);
    }

    console.log('TikTok credentials found');
    console.log('Username:', credentials.username);
    console.log('Profile ID:', credentials.profileId);

    // Return stored credentials (fast, no TikTok API call)
    return secureJsonResponse({
      success: true,
      data: {
        username: credentials.username || 'TikTok User',
        profileId: credentials.profileId || '',
        // Provide sensible defaults for other fields
        // (these can be overridden by live creator-info if needed)
        privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
        comment_disabled: false,
        duet_disabled: false,
        stitch_disabled: false,
        max_video_post_duration_sec: 600
      }
    }, 200);

  } catch (error) {
    console.error('=== TikTok Credentials Error ===');
    console.error('Error details:', error);
    
    return secureJsonResponse({
      success: false,
      error: 'Failed to get TikTok credentials'
    }, 500);
  }
}
