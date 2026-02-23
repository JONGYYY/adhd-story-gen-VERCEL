/**
 * Manual cleanup endpoint to clear stuck currentlyRunning flags
 * POST /api/campaigns/cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie, getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const decoded = await verifySessionCookie(sessionCookie);
    if (!decoded) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = decoded.uid;
    console.log(`[Cleanup] Clearing stuck flags for user: ${userId}`);

    // Clear currentlyRunning flag for all user's campaigns
    const db = await getAdminFirestore();
    const snapshot = await db
      .collection('campaigns')
      .where('userId', '==', userId)
      .get();

    if (snapshot.empty) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No campaigns found',
        cleared: 0,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let clearedCount = 0;
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.currentlyRunning === true) {
        batch.update(doc.ref, {
          currentlyRunning: false,
          lastRunStartedAt: null,
        });
        clearedCount++;
      }
    });

    if (clearedCount > 0) {
      await batch.commit();
      console.log(`[Cleanup] Cleared ${clearedCount} stuck campaigns for user ${userId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Cleared ${clearedCount} stuck campaign(s)`,
      cleared: clearedCount,
      total: snapshot.docs.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to cleanup campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
