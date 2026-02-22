import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { sanitizeString } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

// Token cache to avoid hitting Reddit's OAuth endpoint repeatedly
let cachedToken: { token: string; expires: number } | null = null;

/**
 * Get Reddit OAuth access token using client credentials
 * Uses refresh token grant to get a short-lived access token
 * Implements caching to reduce API calls
 */
async function getRedditAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const refreshToken = process.env.REDDIT_REFRESH_TOKEN;
  const userAgent = process.env.REDDIT_USER_AGENT;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('[reddit-scraper] Reddit OAuth credentials not configured, will use unauthenticated scraping');
    return null;
  }

  // Check cache first (with 5-minute buffer before expiry)
  if (cachedToken && cachedToken.expires > Date.now() + 5 * 60 * 1000) {
    console.log('[reddit-scraper] Using cached OAuth token (expires in', Math.round((cachedToken.expires - Date.now()) / 60000), 'minutes)');
    return cachedToken.token;
  }

  try {
    console.log('[reddit-scraper] Getting fresh Reddit OAuth access token...');
    
    // CRITICAL: Reddit requires proper encoding of client_id and client_secret
    // Don't include any whitespace or newlines in credentials
    const cleanClientId = clientId.trim();
    const cleanClientSecret = clientSecret.trim();
    const cleanRefreshToken = refreshToken.trim();
    
    const auth = Buffer.from(`${cleanClientId}:${cleanClientSecret}`).toString('base64');
    
    // CRITICAL: Reddit's OAuth endpoint is very strict about User-Agent
    // It must be unique and follow the format: platform:app_id:version (by /u/username)
    const finalUserAgent = userAgent || 'web:taleo-media:v1.0.0 (by /u/taleo-app)';
    
    console.log('[reddit-scraper] Using User-Agent:', finalUserAgent);
    console.log('[reddit-scraper] Client ID length:', cleanClientId.length);
    console.log('[reddit-scraper] Client ID first 5 chars:', cleanClientId.substring(0, 5));
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': finalUserAgent,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cleanRefreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[reddit-scraper] ❌ OAuth token request failed');
      console.error('[reddit-scraper] Status:', response.status, response.statusText);
      console.error('[reddit-scraper] Response:', errorText);
      
      // 400 Bad Request typically means expired refresh token
      if (response.status === 400) {
        console.error('[reddit-scraper] 🔴 LIKELY CAUSE: Your Reddit refresh token has EXPIRED');
        console.error('[reddit-scraper] This token lasts ~1 year from when it was generated');
        console.error('[reddit-scraper] ACTION REQUIRED: Regenerate token at https://www.reddit.com/prefs/apps');
        console.error('[reddit-scraper] Will fall back to unauthenticated scraping (less reliable)');
      }
      
      // Try to parse error for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.error('[reddit-scraper] Error details:', JSON.stringify(errorJson, null, 2));
      } catch {
        // Not JSON, already logged as text
      }
      
      // Clear cached token if OAuth fails
      if (cachedToken) {
        console.log('[reddit-scraper] Clearing cached OAuth token due to failure');
        cachedToken = null;
      }
      
      return null;
    }

    const data = await response.json();
    const expiresIn = data.expires_in || 3600;
    
    // Cache the token (expires in 1 hour typically)
    cachedToken = {
      token: data.access_token,
      expires: Date.now() + (expiresIn * 1000),
    };
    
    console.log('[reddit-scraper] ✅ Reddit OAuth access token obtained (expires in', expiresIn, 'seconds, cached)');
    return data.access_token;
  } catch (error) {
    console.error('[reddit-scraper] ❌ Exception while getting Reddit access token:', error);
    if (error instanceof Error) {
      console.error('[reddit-scraper] Error stack:', error.stack);
    }
    return null;
  }
}

/**
 * Scrape Reddit post content from a URL
 * Uses Reddit's OAuth API when credentials are available (60 req/min),
 * falls back to public JSON API (10 req/min)
 */
export async function POST(request: NextRequest) {
  const isServerSideCall = request.headers.get('x-server-side-call') === 'true';
  
  console.log('[reddit-scraper] Request source:', isServerSideCall ? 'SERVER-SIDE (campaign/batch)' : 'CLIENT-SIDE (browser)');
  
  try {
    // SECURITY: Rate limiting - Skip for server-side calls (campaigns), apply for client-side
    // Rate limiting is only needed for client-side requests to prevent abuse
    if (!isServerSideCall) {
      const rateLimitResponse = await rateLimit(request, RATE_LIMITS.READ);
      if (rateLimitResponse) return rateLimitResponse;
    } else {
      console.log('[reddit-scraper] Skipping rate limit check for server-side call');
    }

    const body = await request.json();
    const { url } = body;

    // SECURITY: Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ 
        error: 'Reddit URL is required' 
      }, { 
        status: 400
      });
    }

    // SECURITY: Sanitize URL
    const sanitizedUrl = sanitizeString(url, 500);

    // Validate it's a Reddit URL
    const redditUrlPattern = /^https?:\/\/(www\.)?(reddit\.com|old\.reddit\.com)\/r\/[^\/]+\/comments\/[^\/]+/i;
    if (!redditUrlPattern.test(sanitizedUrl)) {
      return NextResponse.json({ 
        error: 'Invalid Reddit URL. Must be a Reddit post URL like: https://reddit.com/r/subreddit/comments/...' 
      }, { 
        status: 400
      });
    }

    console.log('[reddit-scraper] Scraping URL:', sanitizedUrl);

    // Reddit's public JSON API: append .json to any Reddit URL
    const jsonUrl = sanitizedUrl.split('?')[0] + '.json';
    console.log('[reddit-scraper] JSON URL:', jsonUrl);

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Try multiple strategies to avoid Reddit's bot detection
    let response: Response | null = null;
    let lastError: string = '';

    try {
      // Strategy 1: Try with Reddit OAuth (most reliable, 60 req/min)
      const accessToken = await getRedditAccessToken();
      if (accessToken) {
        console.log('[reddit-scraper] Strategy 1: Trying Reddit OAuth API');
        
        // Try OAuth with retries (handles temporary rate limits)
        const maxOAuthRetries = 2;
        for (let attempt = 0; attempt <= maxOAuthRetries && !response; attempt++) {
          try {
            if (attempt > 0) {
              const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000); // 2s, 4s, max 8s
              console.log(`[reddit-scraper] OAuth retry ${attempt}/${maxOAuthRetries} after ${delay}ms delay...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            // Use oauth.reddit.com subdomain for authenticated requests
            const oauthUrl = jsonUrl.replace(/(?:www\.|old\.)?reddit\.com/, 'oauth.reddit.com');
            console.log('[reddit-scraper] OAuth URL:', oauthUrl);
            
            const oauthResponse = await fetch(oauthUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': process.env.REDDIT_USER_AGENT || 'StoryScrapper/1.0',
              },
              signal: controller.signal,
            });

            if (oauthResponse.ok) {
              console.log('[reddit-scraper] ✅ Strategy 1 (OAuth) succeeded');
              response = oauthResponse;
              break;
            } else if (oauthResponse.status === 429) {
              // Rate limited - retry with backoff
              lastError = `OAuth API rate limited (429), attempt ${attempt + 1}/${maxOAuthRetries + 1}`;
              console.log('[reddit-scraper]', lastError);
              // Continue to next retry
            } else {
              lastError = `OAuth API returned ${oauthResponse.status}`;
              console.log('[reddit-scraper] Strategy 1 (OAuth) failed:', lastError);
              break; // Non-retryable error
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'OAuth fetch failed';
            console.log('[reddit-scraper] Strategy 1 (OAuth) failed:', lastError);
            break;
          }
        }
      }

      // Strategy 2: Try old.reddit.com with retry logic (less aggressive bot detection)
      if (!response) {
        const oldRedditUrl = jsonUrl.replace(/(?:www\.)?reddit\.com/, 'old.reddit.com');
        console.log('[reddit-scraper] Strategy 2: Trying old.reddit.com:', oldRedditUrl);
        
        // Retry up to 2 times for transient errors (429, 502, 503)
        for (let attempt = 0; attempt <= 2 && !response; attempt++) {
          try {
            if (attempt > 0) {
              const delay = 1000 * Math.pow(2, attempt); // 2s, 4s
              console.log(`[reddit-scraper] Strategy 2 retry ${attempt}/2 after ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const attemptResponse = await fetch(oldRedditUrl, {
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

            if (attemptResponse.ok) {
              console.log('[reddit-scraper] ✅ Strategy 2 (old.reddit.com) succeeded');
              response = attemptResponse;
              break;
            } else if ([429, 502, 503].includes(attemptResponse.status) && attempt < 2) {
              lastError = `old.reddit.com returned ${attemptResponse.status}, will retry`;
              console.log('[reddit-scraper]', lastError);
              // Continue to next retry
            } else {
              lastError = `old.reddit.com returned ${attemptResponse.status}`;
              console.log('[reddit-scraper] Strategy 2 failed:', lastError);
              break; // Non-retryable error or max retries reached
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'old.reddit.com fetch failed';
            console.log('[reddit-scraper] Strategy 2 (old.reddit.com) attempt failed:', lastError);
            // Continue to next retry if not at max
          }
        }
      }

      // Strategy 3: Try www.reddit.com with mobile user agent (with retry)
      if (!response) {
        console.log('[reddit-scraper] Strategy 3: Trying www.reddit.com with mobile user agent');
        
        for (let attempt = 0; attempt <= 2 && !response; attempt++) {
          try {
            if (attempt > 0) {
              const delay = 1000 * Math.pow(2, attempt);
              console.log(`[reddit-scraper] Strategy 3 retry ${attempt}/2 after ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const attemptResponse = await fetch(jsonUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.reddit.com/',
              },
              signal: controller.signal,
            });

            if (attemptResponse.ok) {
              console.log('[reddit-scraper] ✅ Strategy 3 (mobile user agent) succeeded');
              response = attemptResponse;
              break;
            } else if ([429, 502, 503].includes(attemptResponse.status) && attempt < 2) {
              lastError = `www.reddit.com returned ${attemptResponse.status}, will retry`;
              console.log('[reddit-scraper]', lastError);
            } else {
              lastError = `www.reddit.com returned ${attemptResponse.status}`;
              console.log('[reddit-scraper] Strategy 3 failed:', lastError);
              break;
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'www.reddit.com fetch failed';
            console.log('[reddit-scraper] Strategy 3 attempt failed:', lastError);
          }
        }
      }

      // Strategy 4: Try with different browser headers (Chrome on Mac, with retry)
      if (!response) {
        console.log('[reddit-scraper] Strategy 4: Trying with Chrome/Mac headers');
        
        for (let attempt = 0; attempt <= 2 && !response; attempt++) {
          try {
            if (attempt > 0) {
              const delay = 1000 * Math.pow(2, attempt);
              console.log(`[reddit-scraper] Strategy 4 retry ${attempt}/2 after ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const attemptResponse = await fetch(jsonUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.reddit.com/',
                'Origin': 'https://www.reddit.com',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
              },
              signal: controller.signal,
            });

            if (attemptResponse.ok) {
              console.log('[reddit-scraper] ✅ Strategy 4 (Chrome/Mac) succeeded');
              response = attemptResponse;
              break;
            } else if ([429, 502, 503].includes(attemptResponse.status) && attempt < 2) {
              lastError = `Chrome/Mac headers returned ${attemptResponse.status}, will retry`;
              console.log('[reddit-scraper]', lastError);
            } else {
              lastError = `Chrome/Mac headers returned ${attemptResponse.status}`;
              console.log('[reddit-scraper] Strategy 4 failed:', lastError);
              break;
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'Chrome/Mac headers failed';
            console.log('[reddit-scraper] Strategy 4 attempt failed:', lastError);
          }
        }
      }

      // Strategy 5: Try i.reddit.com (compact Reddit interface)
      if (!response) {
        const compactUrl = jsonUrl.replace(/(?:www\.|old\.|oauth\.)?reddit\.com/, 'i.reddit.com');
        console.log('[reddit-scraper] Strategy 5: Trying i.reddit.com:', compactUrl);
        
        try {
          response = await fetch(compactUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
              'Accept': 'application/json, text/plain, */*',
            },
            signal: controller.signal,
          });

          if (response.ok) {
            console.log('[reddit-scraper] ✅ Strategy 5 (i.reddit.com) succeeded');
          } else {
            lastError = `i.reddit.com returned ${response.status}`;
            response = null;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'i.reddit.com fetch failed';
          console.log('[reddit-scraper] Strategy 5 (i.reddit.com) failed:', lastError);
          response = null;
        }
      }

      // Strategy 6: Try with absolutely minimal headers (wget-style)
      if (!response) {
        console.log('[reddit-scraper] Strategy 6: Trying with minimal wget-style headers');
        try {
          response = await fetch(jsonUrl, {
            headers: {
              'User-Agent': 'Wget/1.21.3',
              'Accept': '*/*',
            },
            signal: controller.signal,
          });

          if (response.ok) {
            console.log('[reddit-scraper] ✅ Strategy 6 (wget-style) succeeded');
          } else {
            lastError = `Wget-style headers returned ${response.status}`;
            response = null;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Wget-style fetch failed';
          console.log('[reddit-scraper] Strategy 6 (wget-style) failed:', lastError);
          response = null;
        }
      }

      // Strategy 7: Try Reddit RSS feed as ultimate fallback
      if (!response) {
        const rssUrl = sanitizedUrl.split('?')[0] + '.rss';
        console.log('[reddit-scraper] Strategy 7 (LAST RESORT): Trying Reddit RSS feed:', rssUrl);
        
        try {
          const rssResponse = await fetch(rssUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: controller.signal,
          });

          if (rssResponse.ok) {
            console.log('[reddit-scraper] ✅ Strategy 7 (RSS feed) succeeded');
            const rssText = await rssResponse.text();
            
            // Parse RSS XML (basic parsing)
            const titleMatch = rssText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
            const contentMatch = rssText.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
            const authorMatch = rssText.match(/<author><name><!\[CDATA\[(.*?)\]\]><\/name>/);
            
            if (titleMatch && contentMatch) {
              const title = titleMatch[1];
              // Extract text content from HTML
              const htmlContent = contentMatch[1];
              const textMatch = htmlContent.match(/<div class="md">([\s\S]*?)<\/div>/);
              const story = textMatch ? textMatch[1]
                .replace(/<[^>]+>/g, '') // Remove HTML tags
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#x27;/g, "'")
                .trim() : '';
              
              const author = authorMatch ? authorMatch[1] : 'Anonymous';
              const subredditMatch = sanitizedUrl.match(/reddit\.com\/r\/([^\/]+)/);
              const subreddit = subredditMatch ? `r/${subredditMatch[1]}` : 'r/stories';
              
              if (title && story) {
                console.log('[reddit-scraper] ✅ Successfully parsed from RSS feed');
                return NextResponse.json({
                  success: true,
                  title,
                  story: story.replace(/\r\n/g, '\n').replace(/\n\n\n+/g, '\n\n').trim(),
                  subreddit,
                  author,
                  url: sanitizedUrl,
                  source: 'rss',
                });
              }
            }
            
            lastError = 'RSS feed parsed but missing title or content';
            console.log('[reddit-scraper] Strategy 7 (RSS) failed:', lastError);
          } else {
            lastError = `RSS feed returned ${rssResponse.status}`;
            console.log('[reddit-scraper] Strategy 7 (RSS) failed:', lastError);
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'RSS feed fetch failed';
          console.log('[reddit-scraper] Strategy 7 (RSS) failed:', lastError);
        }
      }

      clearTimeout(timeout);

      // If all strategies failed
      if (!response) {
        console.error('[reddit-scraper] ❌ ALL 7 STRATEGIES FAILED');
        console.error('[reddit-scraper] Last error:', lastError);
        console.error('[reddit-scraper] URL attempted:', sanitizedUrl);
        
        // Check if OAuth was attempted
        const hasOAuthCredentials = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_REFRESH_TOKEN);
        
        // Provide detailed troubleshooting based on what failed
        let errorMessage = 'Failed to scrape Reddit after trying 7 different methods.\n\n';
        
        if (hasOAuthCredentials) {
          errorMessage += '🔴 OAuth Status: Configured but failed\n';
          errorMessage += 'This suggests your Reddit refresh token may be expired or invalid.\n\n';
          errorMessage += 'SOLUTIONS:\n';
          errorMessage += '1. Generate a new Reddit refresh token:\n';
          errorMessage += '   - Go to https://www.reddit.com/prefs/apps\n';
          errorMessage += '   - Re-authorize your app\n';
          errorMessage += '   - Update REDDIT_REFRESH_TOKEN in Railway\n\n';
          errorMessage += '2. Wait 10-15 minutes (rate limit cooldown)\n';
          errorMessage += '3. Use a different Reddit post URL\n';
          errorMessage += '4. Copy story content manually from Reddit';
        } else {
          errorMessage += '🟡 OAuth Status: Not configured\n';
          errorMessage += 'Without OAuth, scraping is less reliable and rate-limited.\n\n';
          errorMessage += 'SOLUTIONS:\n';
          errorMessage += '1. Set up Reddit OAuth (recommended):\n';
          errorMessage += '   - Create app at https://www.reddit.com/prefs/apps\n';
          errorMessage += '   - Add credentials to Railway environment\n';
          errorMessage += '   - Restart deployment\n\n';
          errorMessage += '2. Wait 10-15 minutes (rate limit cooldown)\n';
          errorMessage += '3. Use a different Reddit post URL\n';
          errorMessage += '4. Copy story content manually';
        }
        
        errorMessage += '\n\nTechnical: ' + lastError;
        
        return NextResponse.json({ 
          error: errorMessage,
          hasOAuth: hasOAuthCredentials,
          lastError,
          url: sanitizedUrl,
        }, { 
          status: 502
        });
      }

      // This should not happen as we already checked response.ok in strategies above
      // But keeping it for safety
      if (!response.ok) {
        console.error('[reddit-scraper] Unexpected error - response not ok:', response.status, response.statusText);
        return NextResponse.json({ 
          error: 'Failed to fetch Reddit post. Please try copying the story manually.'
        }, { 
          status: 502
        });
      }

      const data = await response.json();
      console.log('[reddit-scraper] Received JSON response, parsing...');

      // Reddit JSON structure: data is an array with [post_data, comments_data]
      // We want the post data: data[0].data.children[0].data
      const postData = data[0]?.data?.children?.[0]?.data;

      if (!postData) {
        console.error('[reddit-scraper] Invalid Reddit JSON structure:', JSON.stringify(data).substring(0, 200));
        return NextResponse.json({ 
          error: 'Failed to parse Reddit post data. Invalid JSON structure.' 
        }, { 
          status: 500
        });
      }

      const title = postData.title || '';
      const story = postData.selftext || '';
      const subreddit = postData.subreddit ? `r/${postData.subreddit}` : 'r/stories';
      const author = postData.author || 'Anonymous';

      // Validate we got actual content
      if (!title || !story) {
        return NextResponse.json({ 
          error: 'This Reddit post has no text content. It might be a link post, image, or video.' 
        }, { 
          status: 400
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

      return NextResponse.json({
        success: true,
        title,
        story: cleanStory,
        subreddit,
        author,
        url: sanitizedUrl,
      });

    } catch (fetchError) {
      clearTimeout(timeout);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[reddit-scraper] Request timed out after 15 seconds');
        return NextResponse.json({ 
          error: 'Reddit request timed out. Please try again.' 
        }, { 
          status: 504
        });
      }

      throw fetchError;
    }

  } catch (error) {
    console.error('[reddit-scraper] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape Reddit post'
    }, { 
      status: 500
    });
  }
}
