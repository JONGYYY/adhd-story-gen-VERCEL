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
    // SECURITY: Rate limiting - Using READ limits (100/15min) as scraping is not resource-intensive
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.READ);
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
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    // Try multiple strategies to avoid Reddit's bot detection
    let response: Response | null = null;
    let lastError: string = '';

    try {
      // Strategy 1: Try old.reddit.com (less aggressive bot detection)
      const oldRedditUrl = jsonUrl.replace('www.reddit.com', 'old.reddit.com').replace('reddit.com', 'old.reddit.com');
      console.log('[reddit-scraper] Strategy 1: Trying old.reddit.com:', oldRedditUrl);
      
      try {
        response = await fetch(oldRedditUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: controller.signal,
        });

        if (response.ok) {
          console.log('[reddit-scraper] Strategy 1 succeeded');
        } else {
          lastError = `old.reddit.com returned ${response.status}`;
          response = null;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'old.reddit.com fetch failed';
        console.log('[reddit-scraper] Strategy 1 failed:', lastError);
        response = null;
      }

      // Strategy 2: Try www.reddit.com with different headers
      if (!response) {
        console.log('[reddit-scraper] Strategy 2: Trying www.reddit.com with mobile user agent');
        try {
          response = await fetch(jsonUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.reddit.com/',
            },
            signal: controller.signal,
          });

          if (response.ok) {
            console.log('[reddit-scraper] Strategy 2 succeeded');
          } else {
            lastError = `www.reddit.com returned ${response.status}`;
            response = null;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'www.reddit.com fetch failed';
          console.log('[reddit-scraper] Strategy 2 failed:', lastError);
          response = null;
        }
      }

      // Strategy 3: Try with minimal headers
      if (!response) {
        console.log('[reddit-scraper] Strategy 3: Trying with minimal headers');
        try {
          response = await fetch(jsonUrl, {
            headers: {
              'User-Agent': 'curl/7.68.0',
            },
            signal: controller.signal,
          });

          if (response.ok) {
            console.log('[reddit-scraper] Strategy 3 succeeded');
          } else {
            lastError = `Minimal headers returned ${response.status}`;
            response = null;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Minimal headers fetch failed';
          console.log('[reddit-scraper] Strategy 3 failed:', lastError);
          response = null;
        }
      }

      clearTimeout(timeout);

      // If all strategies failed
      if (!response) {
        console.error('[reddit-scraper] All strategies failed. Last error:', lastError);
        return new Response(JSON.stringify({ 
          error: 'Reddit is blocking automated requests. Please try:\n1. Copy and paste the story content manually\n2. Wait a few minutes and try again\n3. Use a different Reddit post'
        }), { 
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // This should not happen as we already checked response.ok in strategies above
      // But keeping it for safety
      if (!response.ok) {
        console.error('[reddit-scraper] Unexpected error - response not ok:', response.status, response.statusText);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch Reddit post. Please try copying the story manually.'
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
