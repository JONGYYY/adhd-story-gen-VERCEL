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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await verifySessionCookie(sessionCookie);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get user's campaigns
    const campaigns = await getUserCampaigns(decoded.uid);

    return NextResponse.json({
      success: true,
      campaigns,
    });
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = await verifySessionCookie(sessionCookie);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = decoded.uid;

    // Verify Pro access
    const autoPilotCheck = await canUseAutoPilot(userId);
    if (!autoPilotCheck.allowed) {
      return NextResponse.json(
        { error: autoPilotCheck.reason || 'Auto-pilot not available' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: CreateCampaignRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    if (!body.sources || body.sources.length === 0) {
      return NextResponse.json({ error: 'At least one story source is required' }, { status: 400 });
    }

    if (!body.subreddits || body.subreddits.length === 0) {
      return NextResponse.json({ error: 'At least one subreddit is required' }, { status: 400 });
    }

    if (!body.backgrounds || body.backgrounds.length === 0) {
      return NextResponse.json({ error: 'At least one background is required' }, { status: 400 });
    }

    if (!body.voices || body.voices.length === 0) {
      return NextResponse.json({ error: 'At least one voice is required' }, { status: 400 });
    }

    if (body.videosPerBatch < 1 || body.videosPerBatch > 20) {
      return NextResponse.json(
        { error: 'Videos per batch must be between 1 and 20' },
        { status: 400 }
      );
    }

    // Calculate first run time
    const nextRunAt = calculateNextRunTime(
      body.frequency,
      body.scheduleTime,
      body.customScheduleTimes,
      body.intervalHours,
      body.timesPerDay,
      body.distributedTimes
    );

    // Create campaign
    const now = Date.now();
    const campaignId = await createCampaign({
      userId,
      name: body.name.trim(),
      status: 'active',
      frequency: body.frequency,
      scheduleTime: body.scheduleTime,
      customScheduleTimes: body.customScheduleTimes,
      videosPerBatch: body.videosPerBatch,
      sources: body.sources,
      subreddits: body.subreddits,
      backgrounds: body.backgrounds,
      voices: body.voices,
      storyLength: body.storyLength,
      showRedditUI: body.showRedditUI,
      autoPostToTikTok: body.autoPostToTikTok,
      autoPostToYouTube: body.autoPostToYouTube,
      redditUrls: body.redditUrls,
      useRedditUrls: body.useRedditUrls,
      currentUrlIndex: 0,
      intervalHours: body.intervalHours,
      timesPerDay: body.timesPerDay,
      distributedTimes: body.distributedTimes,
      createdAt: now,
      updatedAt: now,
      nextRunAt,
      totalVideosGenerated: 0,
      totalVideosPosted: 0,
      failedGenerations: 0,
    });

    return NextResponse.json({
      success: true,
      campaignId,
      nextRunAt,
    });
  } catch (error) {
    console.error('Failed to create campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

