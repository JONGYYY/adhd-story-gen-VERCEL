import { NextRequest } from 'next/server';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { sanitizeString } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

/**
 * Scrape Reddit post content from a URL
 * Uses Reddit's public JSON API (no auth required for public posts)
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.VIDEO_GENERATION);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { url } = body;

    // SECURITY: Validate URL
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Reddit URL is required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // SECURITY: Sanitize URL
    const sanitizedUrl = sanitizeString(url, 500);

    // Validate it's a Reddit URL
    const redditUrlPattern = /^https?:\/\/(www\.)?(reddit\.com|old\.reddit\.com)\/r\/[^\/]+\/comments\/[^\/]+/i;
    if (!redditUrlPattern.test(sanitizedUrl)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid Reddit URL. Must be a Reddit post URL like: https://reddit.com/r/subreddit/comments/...' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[reddit-scraper] Scraping URL:', sanitizedUrl);

    // Reddit's public JSON API: append .json to any Reddit URL
    const jsonUrl = sanitizedUrl.split('?')[0] + '.json';
    console.log('[reddit-scraper] JSON URL:', jsonUrl);

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      // Reddit requires a specific User-Agent format and blocks generic ones
      // Format: <platform>:<app ID>:<version> (by /u/<username>)
      // Using a browser-like User-Agent to avoid bot detection
      const response = await fetch(jsonUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.reddit.com/',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error('[reddit-scraper] Reddit API returned:', response.status, response.statusText);
        
        // Provide specific error messages for common Reddit blocks
        let errorMessage = `Failed to fetch Reddit post: ${response.status}`;
        if (response.status === 403) {
          errorMessage = 'Reddit is blocking automated requests. Try copying and pasting the story content manually instead.';
        } else if (response.status === 429) {
          errorMessage = 'Too many requests to Reddit. Please wait a moment and try again.';
        } else if (response.status === 404) {
          errorMessage = 'Reddit post not found. Please check the URL and try again.';
        }
        
        return new Response(JSON.stringify({ 
          error: errorMessage
        }), { 
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await response.json();
      console.log('[reddit-scraper] Received JSON response, parsing...');

      // Reddit JSON structure: data is an array with [post_data, comments_data]
      // We want the post data: data[0].data.children[0].data
      const postData = data[0]?.data?.children?.[0]?.data;

      if (!postData) {
        console.error('[reddit-scraper] Invalid Reddit JSON structure:', JSON.stringify(data).substring(0, 200));
        return new Response(JSON.stringify({ 
          error: 'Failed to parse Reddit post data. Invalid JSON structure.' 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const title = postData.title || '';
      const story = postData.selftext || '';
      const subreddit = postData.subreddit ? `r/${postData.subreddit}` : 'r/stories';
      const author = postData.author || 'Anonymous';

      // Validate we got actual content
      if (!title || !story) {
        return new Response(JSON.stringify({ 
          error: 'This Reddit post has no text content. It might be a link post, image, or video.' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Clean the story content
      const cleanStory = story
        .replace(/\r\n/g, '\n')           // Normalize line endings
        .replace(/\n\n\n+/g, '\n\n')      // Remove excessive newlines
        .trim();

      console.log('[reddit-scraper] Scraped successfully:', {
        title: title.substring(0, 50) + '...',
        storyLength: cleanStory.length,
        subreddit,
        author
      });

      return new Response(JSON.stringify({
        success: true,
        title,
        story: cleanStory,
        subreddit,
        author,
        url: sanitizedUrl,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[reddit-scraper] Request timed out after 15 seconds');
        return new Response(JSON.stringify({ 
          error: 'Reddit request timed out. Please try again.' 
        }), { 
          status: 504,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      throw fetchError;
    }

  } catch (error) {
    console.error('[reddit-scraper] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape Reddit post'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
