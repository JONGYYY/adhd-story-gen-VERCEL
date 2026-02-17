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
  getNextRedditUrl,
  incrementUrlIndex,
  updateCampaignStatus,
} from '@/lib/campaigns/db';
import { generateBatch, BatchGenerationConfig } from '@/lib/campaigns/batch-generator';
import { postBatchToTikTok } from '@/lib/campaigns/tiktok-autopost';
import { postBatchToYouTube } from '@/lib/campaigns/youtube-autopost';
import { 
  sendCampaignCompletionEmail, 
  sendCampaignFailureEmail,
  sendCampaignCompletedEmail,
  getUserEmail 
} from '@/lib/email/notifications';

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

        let redditUrl: string | undefined;
        
        // Get next Reddit URL if campaign uses URL list
        if (campaign.useRedditUrls && campaign.redditUrls) {
          redditUrl = await getNextRedditUrl(campaign.id);
          
          // Check if URL list is exhausted
          if (!redditUrl) {
            console.log(`[Campaign Scheduler] Campaign ${campaign.id} completed - all URLs used`);
            
            await updateCampaignStatus(campaign.id, 'completed');
            
            // Send completion email
            const userEmail = await getUserEmail(campaign.userId);
            if (userEmail) {
              await sendCampaignCompletedEmail({
                to: userEmail,
                campaignName: campaign.name,
                totalVideos: campaign.totalVideosGenerated,
                reason: 'All Reddit URLs have been used'
              });
              console.log(`[Campaign Scheduler] Completion email sent to ${userEmail}`);
            }
            
            results.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              success: true,
              videosGenerated: 0,
              videosFailed: 0,
              completed: true,
            });
            
            continue; // Skip to next campaign
          }
          
          console.log(`[Campaign Scheduler] Using Reddit URL: ${redditUrl}`);
        }

        // Create campaign run record
        const runId = await createCampaignRun({
          campaignId: campaign.id,
          userId: campaign.userId,
          status: 'generating',
          videoIds: [],
          totalVideos: campaign.useRedditUrls ? 1 : campaign.videosPerBatch,
          completedVideos: 0,
          failedVideos: 0,
          startedAt: Date.now(),
        });

        // Build batch configuration
        const config: BatchGenerationConfig = {
          userId: campaign.userId,
          videosPerBatch: campaign.useRedditUrls ? 1 : campaign.videosPerBatch, // Generate one video per run when using URL list
          sources: campaign.sources,
          subreddits: campaign.subreddits,
          backgrounds: campaign.backgrounds,
          voices: campaign.voices,
          storyLength: campaign.storyLength,
          showRedditUI: campaign.showRedditUI,
          redditUrl, // Pass the specific URL if available
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

        // Auto-post to YouTube if enabled and videos were generated
        let youtubePostResults;
        if (campaign.autoPostToYouTube && result.videoIds.length > 0) {
          console.log(`[Campaign Scheduler] Auto-posting ${result.videoIds.length} videos to YouTube...`);
          try {
            youtubePostResults = await postBatchToYouTube(
              campaign.userId,
              result.videoIds,
              railwayApiUrl
            );
            console.log(`[Campaign Scheduler] YouTube posting complete: ${youtubePostResults.successCount}/${result.videoIds.length} succeeded`);
            
            // Check for token-related failures in batch results
            const tokenFailures = youtubePostResults.results.filter(
              r => !r.success && (r.errorType === 'TOKEN_EXPIRED' || r.errorType === 'TOKEN_REFRESH_FAILED')
            );
            
            if (tokenFailures.length > 0) {
              // Pause campaign if any video failed due to token issues
              const errorMessage = tokenFailures[0].error || 'YouTube token expired or refresh failed';
              console.error(`[Campaign Scheduler] YouTube token failure detected: ${errorMessage}`);
              
              await updateCampaign(campaign.id, {
                status: 'paused',
                lastFailureAt: Date.now(),
                failureReason: errorMessage,
              });
              
              // Update campaign run as failed
              await updateCampaignRun(runId, {
                status: 'failed',
                videoIds: result.videoIds,
                completedVideos: youtubePostResults.successCount,
                failedVideos: tokenFailures.length,
                completedAt: Date.now(),
                errors: tokenFailures.map((failure, index) => ({
                  videoIndex: index,
                  error: failure.error || 'YouTube token error',
                  timestamp: Date.now(),
                })),
              });
              
              // Send failure notification
              const userEmail = await getUserEmail(campaign.userId);
              if (userEmail) {
                await sendCampaignFailureEmail({
                  to: userEmail,
                  campaignName: campaign.name,
                  error: errorMessage,
                  campaignId: campaign.id,
                });
                console.log(`[Campaign Scheduler] YouTube failure email sent to ${userEmail}`);
              }
              
              results.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                success: false,
                error: errorMessage,
              });
              
              continue; // Skip to next campaign
            }
            
            // Log other non-token failures but don't pause campaign (may be transient)
            const otherFailures = youtubePostResults.results.filter(r => !r.success && r.errorType !== 'TOKEN_EXPIRED' && r.errorType !== 'TOKEN_REFRESH_FAILED');
            if (otherFailures.length > 0) {
              console.warn(`[Campaign Scheduler] ${otherFailures.length} videos failed to upload to YouTube (non-token errors):`, 
                otherFailures.map(f => `${f.videoId}: ${f.error}`).join(', '));
            }
          } catch (youtubeError) {
            console.error('[Campaign Scheduler] YouTube auto-posting catastrophic error:', youtubeError);
            // Don't pause campaign for catastrophic errors - may be temporary infrastructure issues
          }
        }

        // Check for failures
        if (result.failedVideos > 0 || result.videoIds.length === 0) {
          // Pause campaign and notify user
          const errorMessage = result.errors[0]?.error || 'Unknown error';
          
          await updateCampaign(campaign.id, {
            status: 'paused',
            lastFailureAt: Date.now(),
            failureReason: errorMessage
          });
          
          // Update campaign run as failed
          await updateCampaignRun(runId, {
            status: 'failed',
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
          
          // Send failure notification
          const userEmail = await getUserEmail(campaign.userId);
          if (userEmail) {
            await sendCampaignFailureEmail({
              to: userEmail,
              campaignName: campaign.name,
              error: errorMessage,
              campaignId: campaign.id
            });
            console.log(`[Campaign Scheduler] Failure email sent to ${userEmail}`);
          }
          
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            success: false,
            error: errorMessage,
          });
          
          continue; // Skip scheduling next run
        }
        
        // Update campaign run
        await updateCampaignRun(runId, {
          status: 'completed',
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
        
        // Increment URL index if using URL list
        if (campaign.useRedditUrls && redditUrl) {
          await incrementUrlIndex(campaign.id);
        }

        // Calculate next run time with new frequency support
        const nextRunAt = calculateNextRunTime(
          campaign.frequency,
          campaign.scheduleTime,
          campaign.customScheduleTimes,
          campaign.intervalHours,
          campaign.timesPerDay,
          campaign.distributedTimes,
          Date.now(), // Pass current time as lastRunAt
          campaign.userTimezoneOffset // Use stored timezone offset
        );

        // Update campaign
        const totalPosted = (tiktokPostResults?.successCount || 0) + (youtubePostResults?.successCount || 0);
        await updateCampaign(campaign.id, {
          lastRunAt: Date.now(),
          nextRunAt,
          totalVideosGenerated: campaign.totalVideosGenerated + result.videoIds.length,
          totalVideosPosted: campaign.totalVideosPosted + totalPosted,
          failedGenerations: campaign.failedGenerations + result.failedVideos,
        });

        // Send email notification
        try {
          const userEmail = await getUserEmail(campaign.userId);
          if (userEmail) {
            const totalPostedForEmail = (tiktokPostResults?.successCount || 0) + (youtubePostResults?.successCount || 0);
            await sendCampaignCompletionEmail({
              to: userEmail,
              campaignName: campaign.name,
              videosGenerated: result.videoIds.length,
              videosFailed: result.failedVideos,
              videosPosted: totalPostedForEmail,
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
        
        // Pause campaign on error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await updateCampaign(campaign.id, {
          status: 'paused',
          lastRunAt: Date.now(),
          lastFailureAt: Date.now(),
          failureReason: errorMessage,
          failedGenerations: campaign.failedGenerations + (campaign.useRedditUrls ? 1 : campaign.videosPerBatch),
        });

        // Send failure notification
        try {
          const userEmail = await getUserEmail(campaign.userId);
          if (userEmail) {
            await sendCampaignFailureEmail({
              to: userEmail,
              campaignName: campaign.name,
              error: errorMessage,
              campaignId: campaign.id
            });
            console.log(`[Campaign Scheduler] Error email sent to ${userEmail}`);
          }
        } catch (emailError) {
          console.error('[Campaign Scheduler] Failed to send error notification:', emailError);
        }

        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          success: false,
          error: errorMessage,
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

