import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { VideoOptions, SubredditStory } from '@/lib/video-generator/types';
import { generateStory } from '@/lib/story-generator/openai';
import { verifySessionCookie, getAdminFirestore } from '@/lib/firebase-admin';

// Prevent static generation but use Node.js runtime for video generation
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Railway API configuration (set in Vercel env)
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

    const result = await response.json();
    console.log('Railway API response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('Railway API returned unsuccessful response:', result);
      throw new Error(result.error || 'Railway video generation failed');
    }

    if (!result.videoId) {
      console.error('Railway API response missing videoId:', result);
      throw new Error('Railway API response missing videoId');
    }

    console.log('Railway video generation started successfully with ID:', result.videoId);
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
    const options: VideoOptions = await request.json();
    console.log('Received video generation request with options:', JSON.stringify(options, null, 2));

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

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set on the UI service');
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
      return new Response(JSON.stringify({
        success: true,
        videoId: railwayVideoId,
        videoUrl: `/video/${railwayVideoId}`,
        useRailway: true,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (railwayError) {
      console.error('Railway API failed:', railwayError);
      const message = railwayError instanceof Error ? railwayError.message : 'Unknown error';
      return new Response(JSON.stringify({
        success: false,
        error: `Video generation service unavailable: ${message}. Please try again.`
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate video';
    console.error('Error generating video:', error);
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
} 