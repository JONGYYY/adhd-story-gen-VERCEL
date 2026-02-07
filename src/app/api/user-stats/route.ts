import { NextRequest } from 'next/server';
import { verifySessionCookie, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const STATS_COLLECTION = 'user_stats';

/**
 * Get user statistics (videos created count)
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get user stats from Firestore
    const db = await getAdminFirestore();
    const statsDoc = await db.collection(STATS_COLLECTION).doc(userId).get();
    
    const stats = statsDoc.exists ? statsDoc.data() : {};
    const videosCreated = typeof stats?.videosCreated === 'number' ? stats.videosCreated : 0;

    return new Response(JSON.stringify({
      success: true,
      videosCreated,
      // Add more stats here as needed
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch user stats'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Increment video created count
 * Called internally after successful video generation
 */
export async function POST(request: NextRequest) {
  try {
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

    // Increment videos created counter atomically
    const db = await getAdminFirestore();
    const statsRef = db.collection(STATS_COLLECTION).doc(userId);
    
    // Use FieldValue.increment() for atomic increment (thread-safe)
    await statsRef.set({
      videosCreated: FieldValue.increment(1),
      lastVideoCreatedAt: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });

    console.log(`✅ Incremented video count for user ${userId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Video count incremented'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error incrementing video count:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to increment video count'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
