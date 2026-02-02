import { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for YouTube uploads

export async function POST(request: NextRequest) {
  try {
    console.log('=== YouTube Video Upload Started ===');
    
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
    console.log('User authenticated:', userId);

    // Get YouTube credentials
    const credentials = await getSocialMediaCredentialsServer(userId, 'youtube');
    if (!credentials) {
      return new Response(JSON.stringify({ 
        error: 'YouTube not connected. Please connect your YouTube account first.' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('YouTube credentials found');
    if (!credentials.accessToken || typeof credentials.accessToken !== 'string') {
      return new Response(JSON.stringify(
        { error: 'YouTube access token is missing. Please disconnect and reconnect YouTube.' }
      ), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const videoFile = formData.get('video') as File;
    const privacyStatus = (formData.get('privacy_status') as string) || 'private';

    if (!title || !videoFile) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: title and video file' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Upload request:', {
      title,
      description: description.substring(0, 100),
      videoSize: videoFile.size,
      videoType: videoFile.type,
      privacyStatus
    });

    // Convert file to buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    console.log('Video buffer created:', videoBuffer.length, 'bytes');

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID!,
      process.env.YOUTUBE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
    );

    oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken
    });

    // Create YouTube API client
    const youtube = google.youtube('v3');

    console.log('Uploading to YouTube...');
    
    // Convert buffer to readable stream
    const videoStream = Readable.from(videoBuffer);

    // Upload video
    const response = await youtube.videos.insert({
      auth: oauth2Client,
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title,
          description: description,
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: privacyStatus as 'private' | 'public' | 'unlisted',
          selfDeclaredMadeForKids: false,
        }
      },
      media: {
        body: videoStream
      }
    }, {
      onUploadProgress: (evt: any) => {
        const progress = (evt.bytesRead / videoBuffer.length) * 100;
        console.log(`Upload progress: ${Math.round(progress)}%`);
      }
    });

    console.log('Video uploaded successfully:', response.data.id);
    console.log('=== YouTube Video Upload Completed ===');

    return new Response(JSON.stringify({
      success: true,
      message: 'Video uploaded successfully to YouTube',
      videoId: response.data.id,
      videoUrl: `https://youtube.com/watch?v=${response.data.id}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== YouTube Video Upload Error ===');
    console.error('Error details:', error);
    
    // Handle specific YouTube API errors
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for quota exceeded
      if (errorMessage.includes('quotaExceeded')) {
        errorMessage = 'YouTube API quota exceeded. Try again tomorrow or request quota increase.';
      }
      // Check for token expired
      else if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
        errorMessage = 'YouTube access token expired. Please disconnect and reconnect YouTube.';
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

