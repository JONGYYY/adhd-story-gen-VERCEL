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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await verifySessionCookie(sessionCookie);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get campaign to verify ownership
    const campaign = await getCampaign(params.id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify ownership
    if (campaign.userId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get runs
    const runs = await getCampaignRuns(params.id);

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error) {
    console.error('Failed to fetch campaign runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign runs' },
      { status: 500 }
    );
  }
}

