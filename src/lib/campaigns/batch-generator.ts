/**
 * Batch video generation logic
 */

import { VideoOptions, VideoBackground, VoiceOption } from '@/lib/video-generator/types';

export interface BatchGenerationConfig {
  userId: string;
  videosPerBatch: number;
  sources: Array<'ai' | 'reddit'>;
  subreddits: string[];
  backgrounds: string[];
  voices: string[];
  storyLength: '1 min+ (Cliffhanger)' | 'Full Story Length';
  showRedditUI: boolean;
  redditUrl?: string;  // If provided, use this specific URL instead of generating
}

export interface BatchGenerationResult {
  success: boolean;
  videoIds: string[];
  failedVideos: number;
  errors: Array<{
    index: number;
    error: string;
  }>;
}

/**
 * Voice ID to gender mapping
 */
const voiceGenders: Record<string, VoiceOption['gender']> = {
  'brian': 'male',
  'adam': 'male',
  'antoni': 'male',
  'sarah': 'female',
  'laura': 'female',
  'rachel': 'female',
};

/**
 * Get next item from array in rotation
 */
function getRotatingItem<T>(array: T[], index: number): T {
  return array[index % array.length];
}

/**
 * Generate a batch of videos
 */
export async function generateBatch(
  config: BatchGenerationConfig,
  railwayApiUrl: string,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchGenerationResult> {
  const videoIds: string[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  
  // Get the Next.js app URL for API routes like scrape-reddit
  // In production, this should be the main domain (taleo.media)
  // Railway backend handles video generation, but scraping is in Next.js
  const appUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://taleo.media';

  for (let i = 0; i < config.videosPerBatch; i++) {
    try {
      let customStory;
      
      // If Reddit URL provided, scrape it
      if (config.redditUrl) {
        console.log(`[Batch Generator] Scraping Reddit URL: ${config.redditUrl}`);
        
        try {
          const scrapeResponse = await fetch(`${appUrl}/api/scrape-reddit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: config.redditUrl })
          });
          
          if (!scrapeResponse.ok) {
            const errorText = await scrapeResponse.text();
            throw new Error(`Failed to scrape Reddit URL: ${scrapeResponse.status} ${errorText}`);
          }
          
          const scrapeData = await scrapeResponse.json();
          
          if (!scrapeData.success) {
            throw new Error(scrapeData.error || 'Failed to scrape Reddit URL');
          }
          
          customStory = {
            title: scrapeData.title,
            story: scrapeData.story,
            subreddit: scrapeData.subreddit,
            author: scrapeData.author
          };
          
          console.log(`[Batch Generator] Successfully scraped story: "${scrapeData.title}"`);
        } catch (scrapeError) {
          console.error('[Batch Generator] Reddit scraping failed:', scrapeError);
          throw new Error(`Reddit scraping failed: ${scrapeError instanceof Error ? scrapeError.message : 'Unknown error'}`);
        }
      }
      
      // Rotate through selected options
      const source = getRotatingItem(config.sources, i);
      const subreddit = customStory?.subreddit || getRotatingItem(config.subreddits, i);
      const background = getRotatingItem(config.backgrounds, i);
      const voiceId = getRotatingItem(config.voices, i);

      // Build video options
      const options: VideoOptions = {
        subreddit: subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`,
        isCliffhanger: config.storyLength === '1 min+ (Cliffhanger)',
        customStory,  // Include scraped story if available
        background: {
          category: background as VideoBackground['category'],
          speedMultiplier: 1.0,
        },
        voice: {
          id: voiceId as VoiceOption['id'],
          gender: voiceGenders[voiceId] || 'male',
        },
        captionStyle: {
          font: 'Arial-Bold',
          size: 72,
          color: 'white',
          outlineColor: 'black',
          outlineWidth: 4,
          shadowColor: 'black',
          shadowOffset: 2,
          position: 'center',
        },
        uiOverlay: {
          showSubreddit: true,
          showRedditUI: config.showRedditUI,
          showBanner: true,
        },
      };

      // Call Railway API to generate video
      // Include userId for server-side requests (campaign scheduler)
      const response = await fetch(`${railwayApiUrl}/api/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          userId: config.userId, // Pass userId for server-side metadata storage
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.videoId) {
        throw new Error(data.error || 'No video ID returned');
      }

      videoIds.push(data.videoId);

      // Report progress
      if (onProgress) {
        onProgress(i + 1, config.videosPerBatch);
      }

      // Add small delay between requests to avoid overwhelming the server
      if (i < config.videosPerBatch - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to generate video ${i + 1}:`, error);
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    videoIds,
    failedVideos: errors.length,
    errors,
  };
}

/**
 * Generate batch and wait for completion with polling
 */
export async function generateBatchWithPolling(
  config: BatchGenerationConfig,
  railwayApiUrl: string,
  onVideoProgress?: (videoIndex: number, progress: number) => void,
  onBatchProgress?: (completed: number, total: number) => void
): Promise<BatchGenerationResult> {
  const videoIds: string[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  
  // Get the Next.js app URL for API routes like scrape-reddit
  const appUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://taleo.media';

  for (let i = 0; i < config.videosPerBatch; i++) {
    try {
      let customStory;
      
      // If Reddit URL provided, scrape it
      if (config.redditUrl) {
        console.log(`[Batch Generator] Scraping Reddit URL: ${config.redditUrl}`);
        
        try {
          const scrapeResponse = await fetch(`${appUrl}/api/scrape-reddit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: config.redditUrl })
          });
          
          if (!scrapeResponse.ok) {
            const errorText = await scrapeResponse.text();
            throw new Error(`Failed to scrape Reddit URL: ${scrapeResponse.status} ${errorText}`);
          }
          
          const scrapeData = await scrapeResponse.json();
          
          if (!scrapeData.success) {
            throw new Error(scrapeData.error || 'Failed to scrape Reddit URL');
          }
          
          customStory = {
            title: scrapeData.title,
            story: scrapeData.story,
            subreddit: scrapeData.subreddit,
            author: scrapeData.author
          };
          
          console.log(`[Batch Generator] Successfully scraped story: "${scrapeData.title}"`);
        } catch (scrapeError) {
          console.error('[Batch Generator] Reddit scraping failed:', scrapeError);
          throw new Error(`Reddit scraping failed: ${scrapeError instanceof Error ? scrapeError.message : 'Unknown error'}`);
        }
      }
      
      // Rotate through selected options
      const source = getRotatingItem(config.sources, i);
      const subreddit = customStory?.subreddit || getRotatingItem(config.subreddits, i);
      const background = getRotatingItem(config.backgrounds, i);
      const voiceId = getRotatingItem(config.voices, i);

      // Build video options
      const options: VideoOptions = {
        subreddit: subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`,
        isCliffhanger: config.storyLength === '1 min+ (Cliffhanger)',
        customStory,  // Include scraped story if available
        background: {
          category: background as VideoBackground['category'],
          speedMultiplier: 1.0,
        },
        voice: {
          id: voiceId as VoiceOption['id'],
          gender: voiceGenders[voiceId] || 'male',
        },
        captionStyle: {
          font: 'Arial-Bold',
          size: 72,
          color: 'white',
          outlineColor: 'black',
          outlineWidth: 4,
          shadowColor: 'black',
          shadowOffset: 2,
          position: 'center',
        },
        uiOverlay: {
          showSubreddit: true,
          showRedditUI: config.showRedditUI,
          showBanner: true,
        },
      };

      // Call Railway API to generate video
      // Include userId for server-side requests (campaign scheduler)
      const response = await fetch(`${railwayApiUrl}/api/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          userId: config.userId, // Pass userId for server-side metadata storage
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.videoId) {
        throw new Error(data.error || 'No video ID returned');
      }

      const videoId = data.videoId;

      // Poll for completion
      let pollCount = 0;
      const maxPolls = 300; // 5 minutes
      let videoReady = false;

      while (pollCount < maxPolls && !videoReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        pollCount++;

        try {
          const statusResponse = await fetch(
            `${railwayApiUrl}/api/video-status/${videoId}`,
            {
              method: 'GET',
              cache: 'no-cache',
            }
          );

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();

            if (onVideoProgress && typeof statusData.progress === 'number') {
              onVideoProgress(i, statusData.progress);
            }

            if (statusData.status === 'ready' || statusData.status === 'completed') {
              videoReady = true;
              videoIds.push(videoId);
              break;
            } else if (statusData.status === 'failed') {
              throw new Error(statusData.error || 'Video generation failed');
            }
          }
        } catch (pollError) {
          // Continue polling on transient errors
          if (pollCount > 10) {
            throw pollError;
          }
        }
      }

      if (!videoReady) {
        throw new Error('Video generation timed out');
      }

      // Report batch progress
      if (onBatchProgress) {
        onBatchProgress(i + 1, config.videosPerBatch);
      }
    } catch (error) {
      console.error(`Failed to generate video ${i + 1}:`, error);
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    videoIds,
    failedVideos: errors.length,
    errors,
  };
}

