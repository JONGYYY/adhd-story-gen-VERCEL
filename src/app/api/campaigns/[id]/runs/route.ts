/**
 * Campaign runs history
 * GET /api/campaigns/[id]/runs - Get campaign run history
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getCampaign, getCampaignRuns } from '@/lib/campaigns/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get campaign run history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get campaign to verify ownership
    const campaign = await getCampaign(params.id);

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify ownership
    if (campaign.userId !== decoded.uid) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get runs
    const runs = await getCampaignRuns(params.id);

    return new Response(JSON.stringify({
      success: true,
      runs,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch campaign runs:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch campaign runs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

