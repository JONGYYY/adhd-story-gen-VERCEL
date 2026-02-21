/**
 * Cron job endpoint to automatically refresh TikTok tokens before they expire
 * Call this endpoint every 12 hours via external cron service (e.g., cron-job.org)
 * 
 * Schedule: Every 12 hours
 * URL: https://taleo.media/api/cron/refresh-tiktok-tokens
 * Method: POST
 * Header: Authorization: Bearer <CRON_SECRET>
 * 
 * Note: TikTok access tokens expire after 24 hours, refresh tokens valid for 365 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { TikTokAPI } from '@/lib/social-media/tiktok';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

// Cron secret from environment variable
const CRON_SECRET = process.env.CRON_SECRET || process.env.API_SECRET;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('=== TikTok Token Refresh Cron Job Started ===');
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
    const socialCredsCollection = db.collection('socialMediaCredentials');

    // Find all users with TikTok credentials
    console.log('Fetching all TikTok credentials...');
    const tiktokCredsSnapshot = await socialCredsCollection
      .where('platform', '==', 'tiktok')
      .get();

    console.log(`Found ${tiktokCredsSnapshot.size} users with TikTok connected`);

    if (tiktokCredsSnapshot.empty) {
      console.log('No TikTok credentials found');
      return NextResponse.json({
        success: true,
        message: 'No users with TikTok connected',
        stats: {
          totalUsers: 0,
          tokensChecked: 0,
          tokensRefreshed: 0,
          errors: 0,
        }
      });
    }

    const tiktokApi = new TikTokAPI();
    const now = Date.now();
    // Refresh tokens that expire within 12 hours (TikTok tokens last 24 hours)
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
    for (const doc of tiktokCredsSnapshot.docs) {
      const credentials = doc.data();
      // Extract userId from document ID (format: "userId_tiktok")
      const userId = doc.id.split('_')[0];
      
      tokensChecked++;
      console.log(`\n[User ${userId}] Checking TikTok token...`);

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
        
        const newTokens = await tiktokApi.refreshAccessToken(credentials.refreshToken);
        
        // Calculate new expiry time (TikTok tokens last 24 hours = 86400 seconds)
        const newExpiresAt = Date.now() + ((newTokens.expires_in || 86400) * 1000);
        
        // Update credentials in Firestore
        await doc.ref.update({
          accessToken: newTokens.access_token,
          expiresAt: newExpiresAt,
          refreshToken: newTokens.refresh_token || credentials.refreshToken,
          lastRefreshed: Date.now(),
        });

        tokensRefreshed++;
        console.log(`[User ${userId}] ✅ Token refreshed successfully (new expiry: ${new Date(newExpiresAt).toISOString()})`);
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
    console.log('\n=== TikTok Token Refresh Cron Job Completed ===');
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Tokens checked: ${tokensChecked}`);
    console.log(`Tokens refreshed: ${tokensRefreshed}`);
    console.log(`Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      message: `TikTok token refresh completed`,
      stats: {
        totalUsers: tiktokCredsSnapshot.size,
        tokensChecked,
        tokensRefreshed,
        errors,
        durationMs: duration,
      },
      results: refreshResults,
    });

  } catch (error) {
    console.error('=== TikTok Token Refresh Cron Job Error ===');
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
