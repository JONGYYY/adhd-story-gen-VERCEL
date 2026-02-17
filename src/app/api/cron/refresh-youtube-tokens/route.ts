/**
 * Cron job endpoint to automatically refresh YouTube tokens before they expire
 * Call this endpoint every hour via external cron service (e.g., cron-job.org)
 * 
 * Schedule: Every 1 hour
 * URL: https://taleo.media/api/cron/refresh-youtube-tokens
 * Method: POST
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { YouTubeAPI } from '@/lib/social-media/youtube';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

// Cron secret from environment variable
const CRON_SECRET = process.env.CRON_SECRET || process.env.API_SECRET;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('=== YouTube Token Refresh Cron Job Started ===');
  console.log('Time:', new Date().toISOString());

  try {
    // SECURITY: Verify cron secret
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    if (!CRON_SECRET) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron secret not configured on server' },
        { status: 500 }
      );
    }

    if (providedSecret !== CRON_SECRET) {
      console.warn('Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ Cron authentication verified');

    // Get Firestore instance
    const db = await getAdminFirestore();
    // Use the correct collection name that matches schema.ts
    const socialCredsCollection = db.collection('socialMediaCredentials');

    // Find all users with YouTube credentials
    console.log('Fetching all YouTube credentials...');
    const youtubeCredsSnapshot = await socialCredsCollection
      .where('platform', '==', 'youtube')
      .get();

    console.log(`Found ${youtubeCredsSnapshot.size} users with YouTube connected`);

    if (youtubeCredsSnapshot.empty) {
      console.log('No YouTube credentials found');
      return NextResponse.json({
        success: true,
        message: 'No users with YouTube connected',
        stats: {
          totalUsers: 0,
          tokensChecked: 0,
          tokensRefreshed: 0,
          errors: 0,
        }
      });
    }

    const youtubeApi = new YouTubeAPI();
    const now = Date.now();
    const REFRESH_THRESHOLD = 12 * 60 * 60 * 1000; // 12 hours

    let tokensChecked = 0;
    let tokensRefreshed = 0;
    let errors = 0;
    const refreshResults: Array<{
      userId: string;
      success: boolean;
      reason?: string;
      error?: string;
    }> = [];

    // Process each user's credentials
    for (const doc of youtubeCredsSnapshot.docs) {
      const credentials = doc.data();
      // Extract userId from document ID (format: "userId_youtube")
      const userId = doc.id.split('_')[0];
      
      tokensChecked++;
      console.log(`\n[User ${userId}] Checking token...`);

      try {
        // Check if token needs refresh
        if (!credentials.expiresAt) {
          console.log(`[User ${userId}] No expiry time set, skipping`);
          refreshResults.push({
            userId,
            success: false,
            reason: 'No expiry time',
          });
          continue;
        }

        const timeUntilExpiry = credentials.expiresAt - now;
        const hoursUntilExpiry = timeUntilExpiry / (60 * 60 * 1000);

        console.log(`[User ${userId}] Token expires in ${hoursUntilExpiry.toFixed(2)} hours`);

        // Only refresh if expiring within 12 hours
        if (timeUntilExpiry > REFRESH_THRESHOLD) {
          console.log(`[User ${userId}] Token still valid for ${hoursUntilExpiry.toFixed(2)} hours, skipping`);
          refreshResults.push({
            userId,
            success: true,
            reason: `Valid for ${hoursUntilExpiry.toFixed(1)}h`,
          });
          continue;
        }

        // Check if refresh token exists
        if (!credentials.refreshToken) {
          console.warn(`[User ${userId}] No refresh token available, user must reconnect`);
          refreshResults.push({
            userId,
            success: false,
            reason: 'No refresh token',
          });
          errors++;
          continue;
        }

        // Refresh the token
        console.log(`[User ${userId}] ⟳ Refreshing token (expires in ${hoursUntilExpiry.toFixed(2)}h)...`);
        
        const newTokens = await youtubeApi.refreshAccessToken(credentials.refreshToken);
        
        // Update credentials in Firestore
        await doc.ref.update({
          accessToken: newTokens.access_token,
          expiresAt: newTokens.expiry_date || (Date.now() + ((newTokens.expires_in || 3600) * 1000)),
          refreshToken: newTokens.refresh_token || credentials.refreshToken,
          lastRefreshed: Date.now(),
        });

        tokensRefreshed++;
        console.log(`[User ${userId}] ✅ Token refreshed successfully`);
        refreshResults.push({
          userId,
          success: true,
          reason: 'Refreshed',
        });

      } catch (error) {
        errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[User ${userId}] ❌ Failed to refresh token:`, errorMessage);
        refreshResults.push({
          userId,
          success: false,
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log('\n=== YouTube Token Refresh Cron Job Completed ===');
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Tokens checked: ${tokensChecked}`);
    console.log(`Tokens refreshed: ${tokensRefreshed}`);
    console.log(`Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      message: `YouTube token refresh completed`,
      stats: {
        totalUsers: youtubeCredsSnapshot.size,
        tokensChecked,
        tokensRefreshed,
        errors,
        durationMs: duration,
      },
      results: refreshResults,
    });

  } catch (error) {
    console.error('=== YouTube Token Refresh Cron Job Error ===');
    console.error('Error details:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Support GET for manual testing (with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
