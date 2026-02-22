import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { VideoOptions, SubredditStory } from '@/lib/video-generator/types';
import { generateStory } from '@/lib/story-generator/openai';
import { verifySessionCookie, getAdminFirestore } from '@/lib/firebase-admin';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { videoGenerationSchema, sanitizeString } from '@/lib/security/validation';
import { secureJsonResponse } from '@/lib/security/headers';
import { getSecureApiKey } from '@/lib/security/api-keys';

// Prevent static generation but use Node.js runtime for video generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Railway API configuration (set in Railway env)
const RAW_RAILWAY_API_URL = (process.env.RAILWAY_API_URL || process.env.NEXT_PUBLIC_RAILWAY_API_URL || 'https://taleo.media').trim();
const RAILWAY_API_URL = RAW_RAILWAY_API_URL.replace(/\/$/, '');

async function getDisplayNameFromSession(request: NextRequest): Promise<string | null> {
  const sessionCookie = request.cookies.get('session')?.value;
  if (!sessionCookie) return null;
  const decoded = await verifySessionCookie(sessionCookie);
  if (!decoded?.uid) return null;
  const db = await getAdminFirestore();
  const snap = await db.collection('profiles').doc(decoded.uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  const name = typeof data?.displayName === 'string' ? data.displayName.trim() : '';
  return name || null;
}

// Force deployment trigger - updated with simplified Railway backend
async function generateVideoOnRailway(options: VideoOptions, videoId: string, story: SubredditStory) {
  if (!RAILWAY_API_URL) {
    throw new Error('Missing RAILWAY_API_URL environment variable');
  }

  const railwayRequest = {
    subreddit: story.subreddit,
    isCliffhanger: options.isCliffhanger,
    voice: options.voice,
    background: options.background,
    customStory: {
      title: story.title,
      story: story.story,
      subreddit: story.subreddit,
      author: story.author
    }
  };

  console.log('Sending request to Railway API:', JSON.stringify(railwayRequest, null, 2));

  try {
    const response = await fetch(`${RAILWAY_API_URL}/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(railwayRequest),
    });

    console.log('Railway API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Railway API error response:', errorText);
      throw new Error(`Railway API error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Railway API raw response (first 500 chars):', responseText.substring(0, 500));
    
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('Railway API parsed response:', JSON.stringify(result, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse Railway API response as JSON:', parseError);
      console.error('Full raw response:', responseText);
      throw new Error('Railway API returned invalid JSON response');
    }

    if (!result.success) {
      console.error('Railway API returned unsuccessful response:', result);
      throw new Error(result.error || 'Railway video generation failed');
    }

    if (!result.videoId) {
      console.error('Railway API response missing videoId:', result);
      throw new Error('Railway API response missing videoId');
    }

    console.log('✅ Railway video generation started successfully with ID:', result.videoId);
    return result.videoId; // Railway returns its own video ID
  } catch (error) {
    console.error('Error calling Railway API:', error);
    // If Railway fails, surface the error to the caller
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const videoId = uuidv4();
  
  try {
    // SECURITY: Authentication check
    const sessionCookie = request.cookies.get('session')?.value;
    const decodedClaims = sessionCookie ? await verifySessionCookie(sessionCookie) : null;
    const userId = decodedClaims?.uid;
    
    // SECURITY: Rate limiting (IP + user-based)
    // TEMPORARILY DISABLED FOR APPLICATION TESTING - RE-ENABLE AFTER TIKTOK APPLICATION APPROVAL
    // const rateLimitResponse = await rateLimit(
    //   request, 
    //   RATE_LIMITS.VIDEO_GENERATION,
    //   userId
    // );
    // if (rateLimitResponse) return rateLimitResponse;
    
    // SECURITY: Parse and validate request body
    const rawBody = await request.json();
    console.log('Received video generation request with options:', JSON.stringify(rawBody, null, 2));
    
    // SECURITY: Input validation - validate required fields
    if (!rawBody.subreddit || typeof rawBody.subreddit !== 'string') {
      return secureJsonResponse({ error: 'Subreddit is required and must be a string' }, 400);
    }
    
    // SECURITY: Validate video type (accepts both isCliffhanger boolean and videoType string)
    if (rawBody.isCliffhanger !== undefined) {
      // Frontend sends isCliffhanger as boolean
      if (typeof rawBody.isCliffhanger !== 'boolean') {
        return secureJsonResponse({ error: 'isCliffhanger must be a boolean' }, 400);
      }
    } else if (rawBody.videoType !== undefined) {
      // Alternative format: videoType as string
      if (!['cliffhanger', 'full-story'].includes(rawBody.videoType)) {
        return secureJsonResponse({ error: 'Video type must be cliffhanger or full-story' }, 400);
      }
    }
    // Note: isCliffhanger/videoType is optional, defaults to full-story if not provided
    
    // SECURITY: Sanitize string inputs to prevent injection
    const sanitizedSubreddit = sanitizeString(rawBody.subreddit, 100);
    
    // SECURITY: Validate subreddit format (more lenient for custom stories)
    // Accepts: r/subreddit, subreddit, or r/test (for testing)
    const subredditPattern = /^(r\/)?[a-zA-Z0-9_-]+$/;
    if (!subredditPattern.test(sanitizedSubreddit)) {
      return secureJsonResponse({ error: 'Invalid subreddit format. Use format: r/subreddit or subreddit' }, 400);
    }
    
    // SECURITY: Type-check nested objects
    if (rawBody.voice && typeof rawBody.voice !== 'object') {
      return secureJsonResponse({ error: 'Voice configuration must be an object' }, 400);
    }
    
    if (rawBody.background && typeof rawBody.background !== 'object') {
      return secureJsonResponse({ error: 'Background configuration must be an object' }, 400);
    }
    
    // SECURITY: Validate custom story if provided
    if (rawBody.customStory) {
      if (typeof rawBody.customStory !== 'object') {
        return secureJsonResponse({ error: 'Custom story must be an object' }, 400);
      }
      
      if (!rawBody.customStory.title || typeof rawBody.customStory.title !== 'string') {
        return secureJsonResponse({ error: 'Custom story title is required' }, 400);
      }
      
      if (!rawBody.customStory.story || typeof rawBody.customStory.story !== 'string') {
        return secureJsonResponse({ error: 'Custom story content is required' }, 400);
      }
      
      // SECURITY: Length limits to prevent resource exhaustion
      if (rawBody.customStory.title.length > 500) {
        return secureJsonResponse({ error: 'Story title too long (max 500 characters)' }, 400);
      }
      
      if (rawBody.customStory.story.length > 10000) {
        return secureJsonResponse({ error: 'Story content too long (max 10000 characters)' }, 400);
      }
    }
    
    const options: VideoOptions = rawBody;

    // Pull user-defined display name (if logged in) for the banner author label.
    let displayName: string | null = null;
    try {
      displayName = await getDisplayNameFromSession(request);
    } catch (e) {
      console.warn('Failed to load display name:', e);
    }

    // Generate or use custom story (UI does light work, heavy work happens on worker)
    let story: SubredditStory;
    if (options.customStory) {
      console.log('Using custom story:', JSON.stringify(options.customStory, null, 2));
      story = {
        title: options.customStory.title,
        story: options.customStory.story,
        subreddit: options.customStory.subreddit || 'r/stories',
        author: displayName || 'Anonymous',
      };
    } else {
      const subreddit = options.subreddit.startsWith('r/') ? options.subreddit : `r/${options.subreddit}`;
      console.log('Normalized subreddit:', subreddit);

      // SECURITY: Validate API key securely
      try {
        getSecureApiKey('OPENAI_API_KEY', 20);
      } catch (error) {
        console.error('OpenAI API key validation failed:', error);
        return secureJsonResponse({ error: 'Video generation service is misconfigured' }, 500);
      }
      const storyParams = {
        subreddit,
        narratorGender: options.voice.gender,
      };
      console.log('Generating story with params:', JSON.stringify(storyParams, null, 2));
      story = await generateStory(storyParams);
      story.author = displayName || story.author || 'Anonymous';
    }

    // Log story data before validation
    console.log('Story data before validation:', JSON.stringify(story, null, 2));

    // Validate story data
    if (!story.title || !story.story) {
      console.error('Invalid story data:', JSON.stringify(story, null, 2));
      throw new Error('Story is missing required fields (title or story content)');
    }

    // Always use Railway API from the UI service
    try {
      const railwayVideoId = await generateVideoOnRailway(options, videoId, story);
      
      // Increment user's video created count (async, don't wait for it)
      if (userId) {
        fetch(`${request.nextUrl.origin}/api/user-stats`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': `session=${sessionCookie}`
          },
        }).catch(err => console.error('Failed to increment video count:', err));
      }
      
      // SECURITY: Return response with security headers
      return secureJsonResponse({
        success: true,
        videoId: railwayVideoId,
        videoUrl: `/video/${railwayVideoId}`,
        useRailway: true,
      }, 200);
    } catch (railwayError) {
      console.error('Railway API failed:', railwayError);
      const message = railwayError instanceof Error ? railwayError.message : 'Unknown error';
      
      // SECURITY: Don't expose internal error details
      return secureJsonResponse({
        success: false,
        error: 'Video generation service temporarily unavailable. Please try again.'
      }, 503);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate video';
    console.error('Error generating video:', error);
    
    // SECURITY: Pass through user-friendly OpenAI errors, hide others
    // Check if this is an OpenAI quota/billing error (starts with warning emoji)
    if (errorMessage.includes('⚠️')) {
      // This is a user-friendly error from openai.ts, pass it through
      return secureJsonResponse({
        error: errorMessage
      }, 429);
    }
    
    // Check for other specific errors to pass through
    if (errorMessage.includes('OpenAI') || errorMessage.includes('API key')) {
      return secureJsonResponse({
        error: errorMessage
      }, 500);
    }
    
    // SECURITY: Generic error message for other errors to prevent information leakage
    return secureJsonResponse({
      error: 'An error occurred during video generation. Please try again.'
    }, 500);
  }
}
