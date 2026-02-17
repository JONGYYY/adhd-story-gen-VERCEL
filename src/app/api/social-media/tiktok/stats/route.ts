import { NextRequest, NextResponse } from 'next/server';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { verifySessionCookie, getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decodedClaims = await verifySessionCookie(sessionCookie);
    const userId = decodedClaims.uid;

    // Get TikTok credentials from Firestore
    const db = await getAdminFirestore();
    const credentialsDoc = await db
      .collection('socialMedia')
      .doc(userId)
      .collection('credentials')
      .doc('tiktok')
      .get();

    if (!credentialsDoc.exists) {
      return NextResponse.json(
        { error: 'TikTok not connected' },
        { status: 404 }
      );
    }

    const credentials = credentialsDoc.data();
    if (!credentials?.accessToken) {
      return NextResponse.json(
        { error: 'TikTok access token not found' },
        { status: 404 }
      );
    }

    // Fetch user stats from TikTok
    const tiktokApi = new TikTokAPI();
    const stats = await tiktokApi.getUserStats(credentials.accessToken);

    // Cache stats in Firestore for faster loading (update every hour)
    await credentialsDoc.ref.update({
      stats: {
        follower_count: stats.follower_count || 0,
        following_count: stats.following_count || 0,
        likes_count: stats.likes_count || 0,
        video_count: stats.video_count || 0,
        lastUpdated: Date.now(),
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        follower_count: stats.follower_count || 0,
        following_count: stats.following_count || 0,
        likes_count: stats.likes_count || 0,
        video_count: stats.video_count || 0,
      }
    });
  } catch (error: any) {
    console.error('Error fetching TikTok stats:', error);
    // Extract error message safely (error might contain Response/ReadableStream)
    const errorMessage = error?.message || error?.toString?.() || 'Failed to fetch TikTok stats';
    return NextResponse.json(
      { error: typeof errorMessage === 'string' ? errorMessage : 'Failed to fetch TikTok stats' },
      { status: 500 }
    );
  }
}

