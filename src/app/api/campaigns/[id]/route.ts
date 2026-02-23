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

    // Get campaign
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

    return new Response(JSON.stringify({
      success: true,
      campaign,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch campaign:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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

    // Get existing campaign
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

    // Parse updates
    const updates: UpdateCampaignRequest = await request.json();

    // Validate arrays if provided
    if (updates.sources && updates.sources.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'At least one story source is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only require subreddits if not using Reddit URLs
    if (!updates.useRedditUrls && updates.subreddits && updates.subreddits.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'At least one subreddit is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Require Reddit URLs if using Reddit URL mode
    if (updates.useRedditUrls && updates.redditUrls && updates.redditUrls.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'At least one Reddit URL is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (updates.backgrounds && updates.backgrounds.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'At least one background is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (updates.voices && updates.voices.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'At least one voice is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (updates.videosPerBatch !== undefined && (updates.videosPerBatch < 1 || updates.videosPerBatch > 20)) {
      return new Response(JSON.stringify({ 
        error: 'Videos per batch must be between 1 and 20' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify({
      success: true,
      campaign: updatedCampaign,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to update campaign:', error);
    return new Response(JSON.stringify({ error: 'Failed to update campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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

    // Get campaign
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

    // Delete campaign
    await deleteCampaign(params.id);

    return new Response(JSON.stringify({
      success: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to delete campaign:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

