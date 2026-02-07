import { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { validateFile, FILE_VALIDATION_CONFIGS, sanitizeString } from '@/lib/security/validation';
import { secureJsonResponse } from '@/lib/security/headers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for YouTube uploads

export async function POST(request: NextRequest) {
  try {
    console.log('=== YouTube Video Upload Started ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // SECURITY: Authentication check
    const sessionCookie = request.cookies.get('session')?.value;
    if (!sessionCookie) {
      return secureJsonResponse({ error: 'Not authenticated' }, 401);
    }

    // Verify session cookie and get user
    const decodedClaims = await verifySessionCookie(sessionCookie);
    if (!decodedClaims) {
      return secureJsonResponse({ error: 'Invalid session' }, 401);
    }

    const userId = decodedClaims.uid;
    console.log('User authenticated:', userId);
    
    // SECURITY: Rate limiting (IP + user-based)
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.UPLOAD, userId);
    if (rateLimitResponse) return rateLimitResponse;

    // SECURITY: Get YouTube credentials
    const credentials = await getSocialMediaCredentialsServer(userId, 'youtube');
    if (!credentials) {
      return secureJsonResponse({ 
        error: 'YouTube not connected. Please connect your YouTube account first.' 
      }, 400);
    }

    console.log('YouTube credentials found');
    
    // SECURITY: Validate access token
    if (!credentials.accessToken || typeof credentials.accessToken !== 'string') {
      return secureJsonResponse({ 
        error: 'YouTube access token is missing. Please disconnect and reconnect YouTube.' 
      }, 400);
    }
    
    if (credentials.accessToken.length < 20) {
      return secureJsonResponse({ 
        error: 'Invalid YouTube access token. Please reconnect YouTube.' 
      }, 400);
    }
    
    // CRITICAL: Check if token is expired
    if (credentials.expiresAt && Date.now() > credentials.expiresAt) {
      console.error('YouTube access token has expired');
      const expiredDate = new Date(credentials.expiresAt).toLocaleString();
      console.error(`Token expired at: ${expiredDate}`);
      return secureJsonResponse({ 
        error: 'YouTube access token has expired. Please go to Settings → Social Media, disconnect and reconnect your YouTube account.' 
      }, 401);
    }
    
    console.log('Access token validation passed');

    // SECURITY: Parse and validate form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || '';
    const videoFile = formData.get('video') as File;
    const privacyStatus = (formData.get('privacy_status') as string) || 'private';

    // SECURITY: Required field validation
    if (!title || !videoFile) {
      return secureJsonResponse({ 
        error: 'Missing required fields: title and video file' 
      }, 400);
    }
    
    // SECURITY: Input validation - length limits
    if (title.length > 100) {
      return secureJsonResponse({ error: 'Title exceeds YouTube limit (100 characters)' }, 400);
    }
    
    if (description.length > 5000) {
      return secureJsonResponse({ error: 'Description exceeds YouTube limit (5000 characters)' }, 400);
    }
    
    // SECURITY: Privacy status validation
    if (!['public', 'private', 'unlisted'].includes(privacyStatus)) {
      return secureJsonResponse({ 
        error: 'Invalid privacy status. Must be public, private, or unlisted' 
      }, 400);
    }
    
    // SECURITY: File validation (type, size, extension)
    const fileValidation = validateFile(videoFile, FILE_VALIDATION_CONFIGS.VIDEO);
    if (!fileValidation.valid) {
      return secureJsonResponse({ error: fileValidation.error }, 400);
    }
    
    // SECURITY: Sanitize text inputs
    const sanitizedTitle = sanitizeString(title, 100);
    const sanitizedDescription = sanitizeString(description, 5000);

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

    console.log('Uploading to YouTube using resumable upload protocol...');
    
    // STEP 1: Initiate resumable upload session
    // https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
    const metadata = {
      snippet: {
        title: sanitizedTitle,
        description: sanitizedDescription,
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: privacyStatus as 'private' | 'public' | 'unlisted',
        selfDeclaredMadeForKids: false,
      }
    };

    console.log('Step 1: Initiating resumable upload session...');
    console.log('Access token length:', credentials.accessToken.length);
    console.log('Video size:', videoBuffer.length, 'bytes');
    console.log('Request URL:', 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status');
    
    const initController = new AbortController();
    const initTimeoutId = setTimeout(() => {
      console.error('Init request timeout (30s) - aborting');
      initController.abort();
    }, 30000); // 30 second timeout for init

    try {
      console.log('Sending POST request to YouTube...');
      const startTime = Date.now();
      
      // Initiate resumable upload session
      const initResponse = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': videoBuffer.length.toString(),
            'X-Upload-Content-Type': 'video/mp4',
          },
          body: JSON.stringify(metadata),
          signal: initController.signal
        }
      );

      const elapsed = Date.now() - startTime;
      clearTimeout(initTimeoutId);
      console.log(`Init response received in ${elapsed}ms, status: ${initResponse.status}`);

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error('Failed to initiate upload session:', initResponse.status, errorText);
        throw new Error(`Failed to initiate upload: ${initResponse.status} ${errorText}`);
      }

      // Get the upload URL from Location header
      const uploadUrl = initResponse.headers.get('Location');
      if (!uploadUrl) {
        throw new Error('No upload URL returned from YouTube');
      }

      console.log('Upload session initiated, upload URL received');
      console.log('Step 2: Uploading video file...');

      // STEP 2: Upload the actual video file
      const uploadController = new AbortController();
      const uploadTimeoutId = setTimeout(() => uploadController.abort(), 300000); // 5 minute timeout for upload

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Length': videoBuffer.length.toString(),
          'Content-Type': 'video/mp4',
        },
        body: videoBuffer,
        signal: uploadController.signal
      });

      clearTimeout(uploadTimeoutId);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Video upload failed:', uploadResponse.status, errorText);
        throw new Error(`Video upload failed: ${uploadResponse.status} ${errorText}`);
      }

      // Parse the response - YouTube returns the video resource
      const uploadResult = await uploadResponse.json();
      console.log('Video uploaded successfully:', uploadResult.id);
      console.log('=== YouTube Video Upload Completed ===');

      // SECURITY: Return response with security headers
      return secureJsonResponse({
        success: true,
        message: 'Video uploaded successfully to YouTube',
        videoId: uploadResult.id,
        videoUrl: `https://youtube.com/watch?v=${uploadResult.id}`
      }, 200);

    } catch (uploadError: any) {
      // Clean up any pending timeouts
      try { clearTimeout(initTimeoutId); } catch {}
      
      if (uploadError.name === 'AbortError') {
        console.error('YouTube upload timed out');
        throw new Error('Video upload timed out. The video may be too large or your connection is too slow.');
      }
      
      // Handle specific error codes
      if (uploadError.message?.includes('ECONNRESET')) {
        throw new Error('Connection was reset. Please check your internet connection and try again.');
      }
      
      throw uploadError;
    }

  } catch (error) {
    console.error('=== YouTube Video Upload Error ===');
    console.error('Error details:', error);
    
    // SECURITY: Handle errors without exposing internal details
    let errorMessage = 'Failed to upload video to YouTube';
    let statusCode = 500;
    
    if (error instanceof Error) {
      const message = error.message;
      
      // Check for quota exceeded
      if (message.includes('quotaExceeded')) {
        errorMessage = 'YouTube API quota exceeded. Try again tomorrow.';
        statusCode = 429;
      }
      // Check for token expired
      else if (message.includes('invalid_grant') || message.includes('Token has been expired')) {
        errorMessage = 'YouTube access token expired. Please reconnect YouTube.';
        statusCode = 401;
      }
      // Check for timeout
      else if (message.includes('timed out')) {
        errorMessage = 'Upload timed out. Please try a smaller video.';
        statusCode = 408;
      }
      // Generic validation errors
      else if (message.includes('Validation failed') || message.includes('Invalid')) {
        errorMessage = message;
        statusCode = 400;
      }
    }
    
    // SECURITY: Return secure response with appropriate status
    return secureJsonResponse({
      success: false,
      error: errorMessage
    }, statusCode);
  }
}

