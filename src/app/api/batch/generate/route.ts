/**
 * Manual batch generation API
 * POST /api/batch/generate - Generate a batch of videos
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { canCreateBatch } from '@/lib/subscription';
import { generateBatch, BatchGenerationConfig } from '@/lib/campaigns/batch-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Generate a batch of videos
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

    // Parse request body
    const body = await request.json();
    const config: BatchGenerationConfig = {
      userId,
      videosPerBatch: body.videosPerBatch || 5,
      sources: body.sources || ['ai'],
      subreddits: body.subreddits || ['r/stories'],
      backgrounds: body.backgrounds || ['minecraft'],
      voices: body.voices || ['brian'],
      storyLength: body.storyLength || '1 min+ (Cliffhanger)',
      showRedditUI: body.showRedditUI !== false,
    };

    // Validate batch size
    const batchCheck = await canCreateBatch(userId, config.videosPerBatch);
    if (!batchCheck.allowed) {
      return NextResponse.json(
        { error: batchCheck.reason || 'Batch creation not allowed' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (config.sources.length === 0) {
      return NextResponse.json(
        { error: 'At least one story source is required' },
        { status: 400 }
      );
    }

    if (config.subreddits.length === 0) {
      return NextResponse.json(
        { error: 'At least one subreddit is required' },
        { status: 400 }
      );
    }

    if (config.backgrounds.length === 0) {
      return NextResponse.json(
        { error: 'At least one background is required' },
        { status: 400 }
      );
    }

    if (config.voices.length === 0) {
      return NextResponse.json(
        { error: 'At least one voice is required' },
        { status: 400 }
      );
    }

    // Get Railway API URL
    const railwayApiUrl = process.env.RAILWAY_API_URL || process.env.NEXT_PUBLIC_RAILWAY_API_URL || 'https://api.taleo.media';

    // Generate batch (fire and forget - videos will be queued)
    // In production, you'd want to use a job queue system
    const result = await generateBatch(config, railwayApiUrl);

    return NextResponse.json({
      success: true,
      batchSize: config.videosPerBatch,
      videoIds: result.videoIds,
      failedVideos: result.failedVideos,
      errors: result.errors,
      message: result.success
        ? `Successfully queued ${result.videoIds.length} videos`
        : `Queued ${result.videoIds.length} videos with ${result.failedVideos} failures`,
    });
  } catch (error) {
    console.error('Failed to generate batch:', error);
    return NextResponse.json(
      { error: 'Failed to generate batch' },
      { status: 500 }
    );
  }
}

