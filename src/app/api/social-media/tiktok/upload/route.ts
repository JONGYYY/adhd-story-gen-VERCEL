import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/firebase-admin';
import { getSocialMediaCredentialsServer } from '@/lib/social-media/schema';
import { TikTokAPI } from '@/lib/social-media/tiktok';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { validateFile, FILE_VALIDATION_CONFIGS, sanitizeString } from '@/lib/security/validation';
import { secureJsonResponse } from '@/lib/security/headers';

export const dynamic = 'force-dynamic';
// Increase timeout for video uploads (Railway allows up to 300 seconds)
// TikTok video uploads can take time, especially for larger files
export const maxDuration = 180; // 3 minutes

export async function POST(request: NextRequest) {
  try {
    console.log('=== TikTok Video Upload Started ===');
    
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

    // SECURITY: Get TikTok credentials
    const credentials = await getSocialMediaCredentialsServer(userId, 'tiktok');
    if (!credentials) {
      return secureJsonResponse({ 
        error: 'TikTok not connected. Please connect your TikTok account first.' 
      }, 400);
    }

    console.log('TikTok credentials found');
    
    // SECURITY: Validate access token
    if (!credentials.accessToken || typeof credentials.accessToken !== 'string') {
      return secureJsonResponse({ 
        error: 'TikTok access token is missing. Please disconnect and reconnect TikTok.' 
      }, 400);
    }
    
    if (credentials.accessToken.length < 20) {
      return secureJsonResponse({ 
        error: 'Invalid TikTok access token. Please reconnect TikTok.' 
      }, 400);
    }
    
    if (credentials.accessToken.startsWith('test_access_token_')) {
      return secureJsonResponse({
        error: 'TikTok test mode detected. Please disable test mode and reconnect.'
      }, 400);
    }

    // SECURITY: Parse and validate form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const videoFile = formData.get('video') as File;
    const privacyLevel = (formData.get('privacy_level') as 'PUBLIC' | 'SELF_ONLY') || 'SELF_ONLY';

    // SECURITY: Required field validation
    if (!title || !videoFile) {
      return secureJsonResponse({ 
        error: 'Missing required fields: title and video file' 
      }, 400);
    }
    
    // SECURITY: Input validation - length limits
    if (title.length > 2200) {
      return secureJsonResponse({ error: 'Title exceeds TikTok limit (2200 characters)' }, 400);
    }
    
    // SECURITY: Privacy level validation
    if (!['PUBLIC', 'SELF_ONLY'].includes(privacyLevel)) {
      return secureJsonResponse({ 
        error: 'Invalid privacy level. Must be PUBLIC or SELF_ONLY' 
      }, 400);
    }
    
    // SECURITY: File validation (type, size, extension)
    const fileValidation = validateFile(videoFile, FILE_VALIDATION_CONFIGS.VIDEO);
    if (!fileValidation.valid) {
      return secureJsonResponse({ error: fileValidation.error }, 400);
    }
    
    // SECURITY: Sanitize text input
    const sanitizedTitle = sanitizeString(title, 2200);

    console.log('Upload request:', {
      title,
      videoSize: videoFile.size,
      videoType: videoFile.type,
      privacyLevel
    });

    // Convert file to buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

    // Initialize TikTok API
    const tiktokApi = new TikTokAPI();

    // SECURITY: Upload video with sanitized title
    const result = await tiktokApi.uploadVideo(credentials.accessToken, {
      title: sanitizedTitle,
      video_file: videoBuffer,
      privacy_level: privacyLevel
    });

    console.log('Video upload successful:', result);
    console.log('=== TikTok Video Upload Completed ===');

    // SECURITY: Return response with security headers
    return secureJsonResponse({
      success: true,
      message: 'Video uploaded successfully',
      result
    }, 200);

  } catch (error) {
    console.error('=== TikTok Video Upload Error ===');
    console.error('Error details:', error);
    
    // SECURITY: Handle errors without exposing internal details
    let errorMessage = 'Failed to upload video to TikTok';
    let statusCode = 500;
    
    if (error instanceof Error) {
      const message = error.message;
      
      // Check for specific error types
      if (message.includes('timed out')) {
        errorMessage = 'Upload timed out. Please try again.';
        statusCode = 408;
      } else if (message.includes('401') || message.includes('expired')) {
        errorMessage = 'TikTok access expired. Please reconnect TikTok.';
        statusCode = 401;
      } else if (message.includes('Validation failed') || message.includes('Invalid')) {
        errorMessage = message;
        statusCode = 400;
      }
    }
    
    return secureJsonResponse({
      success: false,
      error: errorMessage
    }, statusCode);
  }
} 