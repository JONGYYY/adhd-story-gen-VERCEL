/**
 * Campaign management API
 * GET  /api/campaigns - List user's campaigns
 * POST /api/campaigns - Create new campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getUserCampaigns, createCampaign, calculateNextRunTime } from '@/lib/campaigns/db';
import { CreateCampaignRequest } from '@/lib/campaigns/types';
import { canUseAutoPilot } from '@/lib/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get user's campaigns
 */
export async function GET(request: NextRequest) {
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

    // Get user's campaigns
    const campaigns = await getUserCampaigns(decoded.uid);

    return new Response(JSON.stringify({
      success: true,
      campaigns,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch campaigns' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create new campaign
 */
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

    // Verify Pro access
    const autoPilotCheck = await canUseAutoPilot(userId);
    if (!autoPilotCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: autoPilotCheck.reason || 'Auto-pilot not available' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body: CreateCampaignRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return new Response(JSON.stringify({ error: 'Campaign name is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body.sources || body.sources.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one story source is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only require subreddits if not using Reddit URLs
    if (!body.useRedditUrls && (!body.subreddits || body.subreddits.length === 0)) {
      return new Response(JSON.stringify({ error: 'At least one subreddit is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Require Reddit URLs if using Reddit URL mode
    if (body.useRedditUrls && (!body.redditUrls || body.redditUrls.length === 0)) {
      return new Response(JSON.stringify({ error: 'At least one Reddit URL is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body.backgrounds || body.backgrounds.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one background is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!body.voices || body.voices.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one voice is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (body.videosPerBatch < 1 || body.videosPerBatch > 20) {
      return new Response(JSON.stringify({ 
        error: 'Videos per batch must be between 1 and 20' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate first run time
    console.log('=== Campaign Creation - Calculating Next Run ===');
    console.log('Frequency:', body.frequency);
    console.log('Schedule Time:', body.scheduleTime);
    console.log('Custom Schedule Times:', body.customScheduleTimes);
    console.log('Interval Hours:', body.intervalHours);
    console.log('Times Per Day:', body.timesPerDay);
    console.log('Distributed Times:', body.distributedTimes);
    console.log('User Timezone Offset:', body.userTimezoneOffset, 'minutes');
    
    const nextRunAt = calculateNextRunTime(
      body.frequency,
      body.scheduleTime,
      body.customScheduleTimes,
      body.intervalHours,
      body.timesPerDay,
      body.distributedTimes,
      undefined, // lastRunAt
      body.userTimezoneOffset
    );
    
    console.log('Calculated Next Run:');
    console.log('  Timestamp:', nextRunAt);
    console.log('  ISO Date:', new Date(nextRunAt).toISOString());
    console.log('  Local String:', new Date(nextRunAt).toString());
    console.log('=============================================');

    // Create campaign
    const now = Date.now();
    
    // Build campaign object, filtering out undefined values
    const campaignData: any = {
      userId,
      name: body.name.trim(),
      status: 'active',
      frequency: body.frequency,
      scheduleTime: body.scheduleTime || '09:00',
      videosPerBatch: body.videosPerBatch,
      sources: body.sources,
      subreddits: body.subreddits || [],
      backgrounds: body.backgrounds,
      voices: body.voices,
      storyLength: body.storyLength,
      showRedditUI: body.showRedditUI ?? false,
      videoSpeed: body.videoSpeed ?? 1.3,
      maxDuration: body.maxDuration ?? 75,
      autoPostToTikTok: body.autoPostToTikTok ?? false,
      autoPostToYouTube: body.autoPostToYouTube ?? false,
      useRedditUrls: body.useRedditUrls ?? false,
      currentUrlIndex: 0,
      createdAt: now,
      updatedAt: now,
      nextRunAt,
      totalVideosGenerated: 0,
      totalVideosPosted: 0,
      failedGenerations: 0,
    };

    // Add optional fields only if they have values
    if (body.customScheduleTimes && body.customScheduleTimes.length > 0) {
      campaignData.customScheduleTimes = body.customScheduleTimes;
    }
    if (body.intervalHours !== undefined && body.intervalHours !== null) {
      campaignData.intervalHours = body.intervalHours;
    }
    if (body.timesPerDay !== undefined && body.timesPerDay !== null) {
      campaignData.timesPerDay = body.timesPerDay;
    }
    if (body.distributedTimes && body.distributedTimes.length > 0) {
      campaignData.distributedTimes = body.distributedTimes;
    }
    if (body.redditUrls && body.redditUrls.length > 0) {
      campaignData.redditUrls = body.redditUrls;
    }
    if (body.userTimezoneOffset !== undefined && body.userTimezoneOffset !== null) {
      campaignData.userTimezoneOffset = body.userTimezoneOffset;
    }

    const campaignId = await createCampaign(campaignData);

    return new Response(JSON.stringify({
      success: true,
      campaignId,
      nextRunAt,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to create campaign:', error);
    return new Response(JSON.stringify({ error: 'Failed to create campaign' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

