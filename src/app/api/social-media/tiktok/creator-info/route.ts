import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { secureJsonResponse } from '@/lib/security/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== TikTok Creator Info Request ===');
    
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
    
    // SECURITY: Rate limiting (use READ limit for info endpoints)
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.READ, userId);
    if (rateLimitResponse) return rateLimitResponse;

    // SECURITY: Get TikTok credentials
    const credentials = await getSocialMediaCredentialsServer(userId, 'tiktok');
    if (!credentials) {
      return secureJsonResponse({ 
        error: 'TikTok not connected. Please connect your TikTok account first.' 
      }, 400);
    }

    console.log('TikTok credentials found');
    
    // SECURITY: Validate access token
    if (!credentials.accessToken || typeof credentials.accessToken !== 'string') {
      return secureJsonResponse({ 
        error: 'TikTok access token is missing. Please disconnect and reconnect TikTok.' 
      }, 400);
    }

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI();

    // Get creator info
    const creatorInfo = await tiktokApi.getCreatorInfo(credentials.accessToken);

    console.log('Creator info retrieved successfully');
    console.log('=== TikTok Creator Info Completed ===');

    // SECURITY: Return response with security headers
    return secureJsonResponse({
      success: true,
      data: creatorInfo
    }, 200);

  } catch (error) {
    console.error('=== TikTok Creator Info Error ===');
    console.error('Error details:', error);
    
    // SECURITY: Handle errors without exposing internal details
    let errorMessage = 'Failed to get creator info from TikTok';
    let statusCode = 500;
    
    if (error instanceof Error) {
      const message = error.message;
      
      // Check for specific error types
      if (message.includes('401') || message.includes('expired')) {
        errorMessage = 'TikTok access expired. Please reconnect TikTok.';
        statusCode = 401;
      } else if (message.includes('Invalid') || message.includes('not connected')) {
        errorMessage = message;
        statusCode = 400;
      }
    }
    
    return secureJsonResponse({
      success: false,
      error: errorMessage
    }, statusCode);
  }
}
