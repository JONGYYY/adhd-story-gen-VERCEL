import { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';

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

    console.log('Uploading to YouTube...');
    
    // Use direct REST API to avoid googleapis Gaxios compatibility issues
    // YouTube Data API v3 simple upload
    const metadata = {
      snippet: {
        title: title,
        description: description,
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: privacyStatus as 'private' | 'public' | 'unlisted',
        selfDeclaredMadeForKids: false,
      }
    };

    // Create multipart body with metadata + video
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(delimiter + 'Content-Type: video/mp4\r\n\r\n'),
      videoBuffer,
      Buffer.from(closeDelimiter)
    ]);

    // Upload with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

    try {
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': multipartBody.length.toString(),
          },
          body: multipartBody,
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('YouTube upload failed:', uploadResponse.status, errorText);
        throw new Error(`YouTube upload failed: ${uploadResponse.status} ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Video uploaded successfully:', uploadResult.id);
      console.log('=== YouTube Video Upload Completed ===');

      return new Response(JSON.stringify({
        success: true,
        message: 'Video uploaded successfully to YouTube',
        videoId: uploadResult.id,
        videoUrl: `https://youtube.com/watch?v=${uploadResult.id}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (uploadError: any) {
      clearTimeout(timeoutId);
      if (uploadError.name === 'AbortError') {
        console.error('YouTube upload timed out after 3 minutes');
        throw new Error('Video upload timed out. Please try again with a smaller video.');
      }
      throw uploadError;
    }

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

