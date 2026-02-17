/**
 * Individual campaign management
 * GET    /api/campaigns/[id] - Get campaign details
 * PATCH  /api/campaigns/[id] - Update campaign
 * DELETE /api/campaigns/[id] - Delete campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import {
  getCampaign,
  updateCampaign,
  deleteCampaign,
  calculateNextRunTime,
} from '@/lib/campaigns/db';
import { UpdateCampaignRequest } from '@/lib/campaigns/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get campaign details
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

    // Get campaign
    const campaign = await getCampaign(params.id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify ownership
    if (campaign.userId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('Failed to fetch campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}

/**
 * Update campaign
 */
export async function PATCH(
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

    // Get existing campaign
    const campaign = await getCampaign(params.id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify ownership
    if (campaign.userId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse updates
    const updates: UpdateCampaignRequest = await request.json();

    // Validate arrays if provided
    if (updates.sources && updates.sources.length === 0) {
      return NextResponse.json(
        { error: 'At least one story source is required' },
        { status: 400 }
      );
    }

    // Only require subreddits if not using Reddit URLs
    if (!updates.useRedditUrls && updates.subreddits && updates.subreddits.length === 0) {
      return NextResponse.json(
        { error: 'At least one subreddit is required' },
        { status: 400 }
      );
    }

    // Require Reddit URLs if using Reddit URL mode
    if (updates.useRedditUrls && updates.redditUrls && updates.redditUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one Reddit URL is required' },
        { status: 400 }
      );
    }

    if (updates.backgrounds && updates.backgrounds.length === 0) {
      return NextResponse.json(
        { error: 'At least one background is required' },
        { status: 400 }
      );
    }

    if (updates.voices && updates.voices.length === 0) {
      return NextResponse.json(
        { error: 'At least one voice is required' },
        { status: 400 }
      );
    }

    if (updates.videosPerBatch !== undefined && (updates.videosPerBatch < 1 || updates.videosPerBatch > 20)) {
      return NextResponse.json(
        { error: 'Videos per batch must be between 1 and 20' },
        { status: 400 }
      );
    }

    // Recalculate next run time if scheduling changed
    let nextRunAt = campaign.nextRunAt;
    if (
      updates.frequency !== undefined ||
      updates.scheduleTime !== undefined ||
      updates.customScheduleTimes !== undefined ||
      updates.intervalHours !== undefined ||
      updates.timesPerDay !== undefined ||
      updates.distributedTimes !== undefined
    ) {
      nextRunAt = calculateNextRunTime(
        updates.frequency || campaign.frequency,
        updates.scheduleTime || campaign.scheduleTime,
        updates.customScheduleTimes || campaign.customScheduleTimes,
        updates.intervalHours ?? campaign.intervalHours,
        updates.timesPerDay ?? campaign.timesPerDay,
        updates.distributedTimes || campaign.distributedTimes,
        undefined, // lastRunAt
        campaign.userTimezoneOffset // Use stored timezone offset
      );
    }

    // Filter out undefined values from updates (Firestore doesn't allow undefined)
    const cleanUpdates: any = { nextRunAt };
    Object.keys(updates).forEach((key) => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    });

    // Update campaign
    await updateCampaign(params.id, cleanUpdates);

    // Get updated campaign
    const updatedCampaign = await getCampaign(params.id);

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error('Failed to update campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

/**
 * Delete campaign
 */
export async function DELETE(
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

    // Get campaign
    const campaign = await getCampaign(params.id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify ownership
    if (campaign.userId !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete campaign
    await deleteCampaign(params.id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Failed to delete campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}

