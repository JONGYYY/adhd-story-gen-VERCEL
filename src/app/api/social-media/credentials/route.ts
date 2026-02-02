import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer, deleteSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { SocialPlatform } from '@/lib/social-media/types';

// Prevent static generation but use Node.js runtime for Firebase Admin
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = decodedClaims.uid;
    const platform = request.nextUrl.searchParams.get('platform') as SocialPlatform;

    if (!platform) {
      return new Response(JSON.stringify({ error: 'Platform parameter is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get credentials using server-side function
    const credentials = await getSocialMediaCredentialsServer(userId, platform);

    if (!credentials) {
      return new Response(JSON.stringify({ connected: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return safe credential data (without sensitive tokens)
    return new Response(JSON.stringify({
      connected: true,
      username: credentials.username,
      platform: credentials.platform,
      profileId: credentials.profileId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to get social media credentials:', error);
    
    // Handle database service errors more gracefully
    if (error instanceof Error && error.message.includes('Database service is not available')) {
      return new Response(JSON.stringify({ 
        error: 'Database service is temporarily unavailable',
        connected: false 
      }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Failed to get credentials',
      connected: false 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 

export async function DELETE(request: NextRequest) {
  try {
    // Get current user from session cookie
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = decodedClaims.uid;
    const platform = request.nextUrl.searchParams.get('platform') as SocialPlatform;

    if (!platform) {
      return new Response(JSON.stringify({ error: 'Platform parameter is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Disconnecting ${platform} for user ${userId}`);

    // Delete credentials using server-side function
    await deleteSocialMediaCredentialsServer(userId, platform);

    console.log(`Successfully disconnected ${platform} for user ${userId}`);
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully disconnected ${platform}` 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to disconnect social media account:', error);
    
    // Handle database service errors more gracefully
    if (error instanceof Error && error.message.includes('Database service is not available')) {
      return new Response(JSON.stringify({ 
        error: 'Database service is temporarily unavailable' 
      }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Failed to disconnect account',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 