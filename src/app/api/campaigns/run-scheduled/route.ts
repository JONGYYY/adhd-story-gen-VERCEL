/**
 * Campaign scheduler - run campaigns that are due
 * POST /api/campaigns/run-scheduled - Check and run due campaigns
 * 
 * This endpoint should be called by a cron job (e.g., every 5 minutes)
 * In production, use a service like Vercel Cron, Railway Cron, or external cron service
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCampaignsDueToRun,
  updateCampaign,
  calculateNextRunTime,
  createCampaignRun,
  updateCampaignRun,
} from '@/lib/campaigns/db';
import { generateBatch, BatchGenerationConfig } from '@/lib/campaigns/batch-generator';
import { postBatchToTikTok } from '@/lib/campaigns/tiktok-autopost';
import { sendCampaignCompletionEmail, getUserEmail } from '@/lib/email/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Run all campaigns that are due
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get campaigns due to run
    const campaigns = await getCampaignsDueToRun();
    
    console.log(`[Campaign Scheduler] Found ${campaigns.length} campaigns due to run`);

    if (campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        campaignsRun: 0,
        message: 'No campaigns due to run',
      });
    }

    const railwayApiUrl = process.env.RAILWAY_API_URL || process.env.NEXT_PUBLIC_RAILWAY_API_URL || 'https://api.taleo.media';
    
    const results = [];

    // Process each campaign
    for (const campaign of campaigns) {
      try {
        console.log(`[Campaign Scheduler] Running campaign: ${campaign.name} (${campaign.id})`);

        // Create campaign run record
        const runId = await createCampaignRun({
          campaignId: campaign.id,
          userId: campaign.userId,
          status: 'generating',
          videoIds: [],
          totalVideos: campaign.videosPerBatch,
          completedVideos: 0,
          failedVideos: 0,
          startedAt: Date.now(),
        });

        // Build batch configuration
        const config: BatchGenerationConfig = {
          userId: campaign.userId,
          videosPerBatch: campaign.videosPerBatch,
          sources: campaign.sources,
          subreddits: campaign.subreddits,
          backgrounds: campaign.backgrounds,
          voices: campaign.voices,
          storyLength: campaign.storyLength,
          showRedditUI: campaign.showRedditUI,
        };

        // Generate batch
        const result = await generateBatch(config, railwayApiUrl);

        // Auto-post to TikTok if enabled and videos were generated
        let tiktokPostResults;
        if (campaign.autoPostToTikTok && result.videoIds.length > 0) {
          console.log(`[Campaign Scheduler] Auto-posting ${result.videoIds.length} videos to TikTok...`);
          try {
            tiktokPostResults = await postBatchToTikTok(
              campaign.userId,
              result.videoIds,
              railwayApiUrl
            );
            console.log(`[Campaign Scheduler] TikTok posting complete: ${tiktokPostResults.successCount}/${result.videoIds.length} succeeded`);
          } catch (tiktokError) {
            console.error('[Campaign Scheduler] TikTok auto-posting failed:', tiktokError);
          }
        }

        // Update campaign run
        await updateCampaignRun(runId, {
          status: result.success ? 'completed' : 'failed',
          videoIds: result.videoIds,
          completedVideos: result.videoIds.length,
          failedVideos: result.failedVideos,
          completedAt: Date.now(),
          errors: result.errors.map(e => ({
            videoIndex: e.index,
            error: e.error,
            timestamp: Date.now(),
          })),
        });

        // Calculate next run time
        const nextRunAt = calculateNextRunTime(
          campaign.frequency,
          campaign.scheduleTime,
          campaign.customScheduleTimes
        );

        // Update campaign
        await updateCampaign(campaign.id, {
          lastRunAt: Date.now(),
          nextRunAt,
          totalVideosGenerated: campaign.totalVideosGenerated + result.videoIds.length,
          totalVideosPosted: campaign.totalVideosPosted + (tiktokPostResults?.successCount || 0),
          failedGenerations: campaign.failedGenerations + result.failedVideos,
        });

        // Send email notification
        try {
          const userEmail = await getUserEmail(campaign.userId);
          if (userEmail) {
            await sendCampaignCompletionEmail({
              to: userEmail,
              campaignName: campaign.name,
              videosGenerated: result.videoIds.length,
              videosFailed: result.failedVideos,
              videosPosted: tiktokPostResults?.successCount || 0,
              nextRunAt,
            });
            console.log(`[Campaign Scheduler] Email notification sent to ${userEmail}`);
          }
        } catch (emailError) {
          console.error('[Campaign Scheduler] Failed to send email notification:', emailError);
        }

        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: result.success,
          videosGenerated: result.videoIds.length,
          videosFailed: result.failedVideos,
        });

        console.log(`[Campaign Scheduler] Completed campaign: ${campaign.name} (${result.videoIds.length}/${campaign.videosPerBatch} videos)`);

      } catch (error) {
        console.error(`[Campaign Scheduler] Failed to run campaign ${campaign.id}:`, error);
        
        // Mark campaign as failed and reschedule
        const nextRunAt = calculateNextRunTime(
          campaign.frequency,
          campaign.scheduleTime,
          campaign.customScheduleTimes
        );
        
        await updateCampaign(campaign.id, {
          lastRunAt: Date.now(),
          nextRunAt,
          failedGenerations: campaign.failedGenerations + campaign.videosPerBatch,
        });

        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      campaignsRun: campaigns.length,
      results,
    });
  } catch (error) {
    console.error('[Campaign Scheduler] Error:', error);
    return NextResponse.json(
      { error: 'Scheduler error' },
      { status: 500 }
    );
  }
}

