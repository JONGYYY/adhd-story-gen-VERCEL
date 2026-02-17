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
import { getAdminFirestore } from '@/lib/firebase-admin';
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
 * Wait for videos to complete processing on Railway
 * Polls video status until all videos are completed or failed
 */
async function waitForVideosToComplete(
  videoIds: string[],
  userId: string,
  railwayApiUrl: string,
  maxWaitTime: number = 420000 // 7 minutes max wait per video (increased from 3 min)
): Promise<void> {
  console.log(`[Campaign Scheduler] Polling ${videoIds.length} videos for completion...`);
  
  const startTime = Date.now();
  const completedVideos = new Set<string>();
  const failedVideos = new Set<string>();
  
  while (completedVideos.size + failedVideos.size < videoIds.length) {
    // Check if we've exceeded max wait time
    if (Date.now() - startTime > maxWaitTime * videoIds.length) {
      console.warn(`[Campaign Scheduler] Polling timeout after ${maxWaitTime * videoIds.length}ms`);
      break;
    }
    
    // Check status of each pending video
    for (const videoId of videoIds) {
      if (completedVideos.has(videoId) || failedVideos.has(videoId)) {
        continue; // Already processed
      }
      
      try {
        // Include userId in query parameter for server-side calls
        const response = await fetch(`${railwayApiUrl}/api/video-status/${videoId}?userId=${userId}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'completed' && data.videoUrl) {
            console.log(`[Campaign Scheduler] ✅ Video ${videoId} completed with URL: ${data.videoUrl}`);
            completedVideos.add(videoId);
          } else if (data.status === 'failed') {
            console.warn(`[Campaign Scheduler] ❌ Video ${videoId} failed: ${data.error || 'Unknown error'}`);
            failedVideos.add(videoId);
          } else {
            console.log(`[Campaign Scheduler] ⏳ Video ${videoId} still processing (status: ${data.status}, progress: ${data.progress}%)`);
          }
        } else {
          console.warn(`[Campaign Scheduler] Failed to fetch status for ${videoId}: ${response.status}`);
        }
      } catch (error) {
        console.error(`[Campaign Scheduler] Error checking video ${videoId}:`, error);
      }
    }
    
    // If all videos are processed, exit
    if (completedVideos.size + failedVideos.size >= videoIds.length) {
      break;
    }
    
    // Wait before next poll (exponential backoff: 2s, 4s, 6s, 8s, max 10s)
    const pollCount = Math.floor((Date.now() - startTime) / 1000);
    const waitTime = Math.min(2000 + (pollCount * 1000), 10000);
    console.log(`[Campaign Scheduler] Waiting ${waitTime}ms before next poll...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  console.log(`[Campaign Scheduler] Polling complete: ${completedVideos.size} completed, ${failedVideos.size} failed, ${videoIds.length - completedVideos.size - failedVideos.size} timeout`);
}

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

    // CLEANUP: Clear stuck "currentlyRunning" flags from runs that started >15 minutes ago
    // This is a safety net - if it fails (e.g., missing Firestore index), scheduler continues
    try {
      const db = await getAdminFirestore();
      const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
      const stuckCampaigns = await db
        .collection('campaigns')
        .where('currentlyRunning', '==', true)
        .where('lastRunStartedAt', '<', fifteenMinutesAgo)
        .get();
      
      if (!stuckCampaigns.empty) {
        console.log(`[Campaign Scheduler] Found ${stuckCampaigns.docs.length} campaigns with stuck running flag, clearing...`);
        const batch = db.batch();
        stuckCampaigns.docs.forEach(doc => {
          batch.update(doc.ref, { 
            currentlyRunning: false,
            lastRunStartedAt: null 
          });
        });
        await batch.commit();
        console.log(`[Campaign Scheduler] Cleared ${stuckCampaigns.docs.length} stuck flags`);
      }
    } catch (cleanupError) {
      console.warn('[Campaign Scheduler] Cleanup failed (non-critical):', cleanupError instanceof Error ? cleanupError.message : cleanupError);
      console.warn('[Campaign Scheduler] Continuing without cleanup...');
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
    console.log('[Campaign Scheduler] Railway API URL:', railwayApiUrl);
    console.log('[Campaign Scheduler] Environment variables:', {
      RAILWAY_API_URL: process.env.RAILWAY_API_URL ? 'Set' : 'Not set',
      NEXT_PUBLIC_RAILWAY_API_URL: process.env.NEXT_PUBLIC_RAILWAY_API_URL ? 'Set' : 'Not set',
    });
    
    const results = [];

    // Process each campaign
    for (const campaign of campaigns) {
      try {
        // CRITICAL: Check if campaign is already running (prevent concurrent runs)
        if (campaign.currentlyRunning) {
          console.log(`[Campaign Scheduler] Skipping campaign "${campaign.name}" (${campaign.id}) - already running`);
          continue;
        }
        
        console.log(`[Campaign Scheduler] Running campaign: ${campaign.name} (${campaign.id})`);
        
        // Mark campaign as running
        await updateCampaign(campaign.id, {
          currentlyRunning: true,
          lastRunStartedAt: Date.now(),
        });

        let redditUrl: string | undefined;
        
        // Get next Reddit URL if campaign uses URL list
        if (campaign.useRedditUrls && campaign.redditUrls) {
          redditUrl = await getNextRedditUrl(campaign.id);
          
          // Check if URL list is exhausted
          if (!redditUrl) {
            console.log(`[Campaign Scheduler] Campaign ${campaign.id} completed - all URLs used`);
            
            await updateCampaignStatus(campaign.id, 'completed');
            
            // Clear running flag
            await updateCampaign(campaign.id, {
              currentlyRunning: false,
            });
            
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
        console.log(`[Campaign Scheduler] Starting batch generation for ${config.videosPerBatch} videos...`);
        const result = await generateBatch(config, railwayApiUrl);
        console.log(`[Campaign Scheduler] Batch generation complete:`, {
          success: result.success,
          videoIds: result.videoIds,
          failedVideos: result.failedVideos,
          errors: result.errors
        });

        // Wait for all videos to complete processing before autoposting
        if (result.videoIds.length > 0) {
          console.log(`[Campaign Scheduler] Waiting for ${result.videoIds.length} videos to complete processing...`);
          await waitForVideosToComplete(result.videoIds, campaign.userId, railwayApiUrl);
          console.log(`[Campaign Scheduler] All videos are ready for autoposting`);
        }

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
                currentlyRunning: false, // Clear running flag on YouTube token failure
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
            failureReason: errorMessage,
            currentlyRunning: false, // Clear running flag on failure
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
          currentlyRunning: false, // Clear running flag on success
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
          currentlyRunning: false, // Clear running flag on error
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
    console.error('[Campaign Scheduler] Fatal Error:', error);
    console.error('[Campaign Scheduler] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Campaign Scheduler] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { 
        error: 'Scheduler error',
        message: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

