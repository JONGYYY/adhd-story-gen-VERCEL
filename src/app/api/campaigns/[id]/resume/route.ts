/**
 * Resume a paused campaign
 * POST /api/campaigns/[id]/resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { 
  getCampaign, 
  updateCampaign, 
  calculateNextRunTime,
  calculateDistributedTimes
} from '@/lib/campaigns/db';

export const dynamic = 'force-dynamic';

export async function POST(
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
    
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const userId = decodedClaims.uid;
    
    // Get campaign
    const campaign = await getCampaign(params.id);
    
    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify ownership
    if (campaign.userId !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if campaign is actually paused
    if (campaign.status !== 'paused') {
      return new Response(JSON.stringify({ 
        error: 'Campaign is not paused',
        currentStatus: campaign.status 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Calculate next run time
    const nextRunAt = calculateNextRunTime(
      campaign.frequency,
      campaign.scheduleTime,
      campaign.customScheduleTimes,
      campaign.intervalHours,
      campaign.timesPerDay,
      campaign.distributedTimes,
      Date.now(),
      campaign.userTimezoneOffset
    );
    
    // Resume campaign
    await updateCampaign(params.id, {
      status: 'active',
      nextRunAt,
      lastFailureAt: undefined,
      failureReason: undefined
    });
    
    console.log(`[Campaign Resume] Campaign ${params.id} resumed by user ${userId}`);
    console.log(`[Campaign Resume] Next run scheduled for: ${new Date(nextRunAt).toISOString()}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      nextRunAt,
      message: 'Campaign resumed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Campaign Resume] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to resume campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
