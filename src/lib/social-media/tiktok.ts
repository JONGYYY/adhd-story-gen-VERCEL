import { generateRandomString } from '@/lib/utils';
import { APP_CONFIG } from '@/lib/config';
import crypto from 'crypto';

interface TikTokOAuthConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl: string;
}

const TIKTOK_OAUTH_CONFIG: TikTokOAuthConfig = {
  clientKey: process.env.TIKTOK_CLIENT_KEY || '',
  clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  redirectUri: `${APP_CONFIG.APP_URL}/api/auth/tiktok/callback`,
  // OAuth v2 authorization endpoint (OAuth v1 endpoints are deprecated).
  // See: https://developers.tiktok.com/bulletin/migration-guidance-oauth-v1
  baseUrl: process.env.TIKTOK_AUTHORIZE_URL || 'https://www.tiktok.com/v2/auth/authorize/',
};

// Add test mode for debugging (NEVER allow in production).
const TEST_MODE = process.env.NODE_ENV !== 'production' && process.env.TIKTOK_TEST_MODE === 'true';

console.log('TikTok OAuth Config:', {
  clientKey: TIKTOK_OAUTH_CONFIG.clientKey ? `${TIKTOK_OAUTH_CONFIG.clientKey.substring(0, 8)}...` : 'NOT_SET',
  clientSecret: TIKTOK_OAUTH_CONFIG.clientSecret ? 'SET' : 'NOT_SET',
  redirectUri: TIKTOK_OAUTH_CONFIG.redirectUri,
  baseUrl: TIKTOK_OAUTH_CONFIG.baseUrl,
  testMode: TEST_MODE
});

export class TikTokAPI {
  constructor() {
    // Validate required environment variables
    if (!process.env.TIKTOK_CLIENT_KEY) {
      throw new Error('TIKTOK_CLIENT_KEY is not set');
    }
    if (!process.env.TIKTOK_CLIENT_SECRET) {
      throw new Error('TIKTOK_CLIENT_SECRET is not set');
    }
    if (!APP_CONFIG.APP_URL) {
      throw new Error('APP_URL is not set');
    }
  }

  private static base64Url(input: Buffer) {
    return input
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private static sha256Base64Url(input: string) {
    const hash = crypto.createHash('sha256').update(input).digest();
    return TikTokAPI.base64Url(hash);
  }

  /**
   * Create an OAuth authorization request.
   * TikTok may require PKCE; we always include it for reliability.
   */
  createAuthRequest(opts?: { redirectUri?: string; scope?: string }) {
    const state = generateRandomString(32);
    const redirectUri = opts?.redirectUri || TIKTOK_OAUTH_CONFIG.redirectUri;
    const scope =
      opts?.scope || 'user.info.basic,user.info.profile,user.info.stats,video.upload,video.publish';
    // PKCE
    const codeVerifier = TikTokAPI.base64Url(crypto.randomBytes(32));
    const codeChallenge = TikTokAPI.sha256Base64Url(codeVerifier);
    
    // In test mode, redirect to our test endpoint
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Using test endpoint instead of TikTok OAuth');
      return `${APP_CONFIG.APP_URL}/api/force-tiktok-connect?state=${state}`;
    }

    const params = new URLSearchParams({
      client_key: TIKTOK_OAUTH_CONFIG.clientKey,
      redirect_uri: redirectUri,
      scope,
      response_type: 'code',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    // Some TikTok configurations expect these fields for Web/Desktop.
    // (We keep them consistent with older implementations.)
    try {
      params.set('app_id', TIKTOK_OAUTH_CONFIG.clientKey);
      params.set('app_source_domain', new URL(redirectUri).hostname);
    } catch {}

    const url = `${TIKTOK_OAUTH_CONFIG.baseUrl}?${params.toString()}`;
    console.log('Generated TikTok OAuth URL:', url);
    return { url, state, codeVerifier, redirectUri };
  }

  async getAccessToken(code: string, opts?: { codeVerifier?: string; redirectUri?: string }) {
    console.log('Getting access token from code...');
    
    // In test mode, return mock tokens
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock access token');
      return {
        access_token: 'test_access_token_' + Date.now(),
        refresh_token: 'test_refresh_token_' + Date.now(),
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'user.info.basic,user.info.profile,video.list,video.upload,video.publish'
      };
    }
    
    try {
      const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
      console.log('Token endpoint:', tokenUrl);

      const params = new URLSearchParams({
        client_key: TIKTOK_OAUTH_CONFIG.clientKey,
        client_secret: TIKTOK_OAUTH_CONFIG.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: opts?.redirectUri || TIKTOK_OAUTH_CONFIG.redirectUri,
      });
      if (opts?.codeVerifier) {
        params.set('code_verifier', opts.codeVerifier);
      }

      console.log('Token request params:', {
        client_key: `${TIKTOK_OAUTH_CONFIG.clientKey.substring(0, 8)}...`,
        client_secret: 'HIDDEN',
        code: `${code.substring(0, 8)}...`,
        redirect_uri: opts?.redirectUri || TIKTOK_OAUTH_CONFIG.redirectUri,
        pkce: Boolean(opts?.codeVerifier),
      });

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('Token exchange timed out after 30 seconds');
        controller.abort();
      }, 30000); // 30 second timeout

      let response;
      try {
        response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache',
          },
          body: params.toString(),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('Token exchange request timed out');
          throw new Error('TikTok token exchange timed out. Please try again.');
        }
        throw fetchError;
      }

      console.log('Token response received - status:', response.status);
      const data = await response.json();
      console.log('Token response parsed successfully');
      
      if (!response.ok) {
        console.error('Token error response:', data);
        throw new Error(`TikTok OAuth error: ${data.error?.message || data.message || 'Failed to get access token'}`);
      }

      if (!data.access_token) {
        console.error('No access token in response:', data);
        throw new Error('No access token received from TikTok');
      }

      console.log('Successfully obtained access token');
      return data;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken: string) {
    console.log('=== getUserInfo START ===');
    console.log('Access token length:', accessToken ? accessToken.length : 0);
    console.log('Access token starts with:', accessToken ? accessToken.substring(0, 10) + '...' : 'NONE');
    
    // In test mode, return mock user info
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock user info');
      return {
        open_id: 'test_open_id_' + Date.now(),
        username: 'test_user_' + Date.now(),
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        bio_description: 'Test bio',
        profile_deep_link: 'https://tiktok.com/@testuser',
        is_verified: false,
        follower_count: 100,
        following_count: 50,
        likes_count: 1000,
        video_count: 25
      };
    }
    
    try {
      // TikTok v2 requires a `fields` parameter.
      // (Missing fields returns: "Fields is required, please provide fields in the request")
      const fields = [
        'open_id',
        'union_id',
        'avatar_url',
        'display_name',
        'username',
      ].join(',');
      const userUrl = `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`;
      console.log('User info endpoint:', userUrl);
      console.log('Requesting fields:', fields);
      console.log('Sending request to TikTok...');

      const response = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Encoding': 'identity', // Disable gzip to avoid Node.js fetch decompression issues
        },
      });

      console.log('Response received from TikTok');
      console.log('User info response status:', response.status);
      console.log('User info response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      const data = await response.json();
      console.log('User info response data:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error('=== TikTok API ERROR ===');
        console.error('Status:', response.status);
        console.error('Error data:', data);
        console.error('Error code:', data.error?.code);
        console.error('Error message:', data.error?.message);
        throw new Error(`TikTok API error: ${data.error?.message || data.message || 'Failed to get user info'}`);
      }

      if (!data.data?.user) {
        console.error('Invalid user info response:', data);
        throw new Error('Invalid user info response from TikTok');
      }

      console.log('=== getUserInfo SUCCESS ===');
      console.log('Username:', data.data.user.username);
      console.log('Display name:', data.data.user.display_name);
      return data.data.user;
    } catch (error) {
      console.error('=== getUserInfo ERROR ===');
      console.error('Error:', error);
      throw error;
    }
  }

  async getUserStats(accessToken: string) {
    console.log('Getting user stats...');
    
    // In test mode, return mock user stats
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock user stats');
      return {
        follower_count: 15200,
        following_count: 340,
        likes_count: 125000,
        video_count: 24
      };
    }
    
    try {
      // TikTok v2 requires a `fields` parameter for user stats
      const fields = [
        'follower_count',
        'following_count',
        'likes_count',
        'video_count',
      ].join(',');
      const statsUrl = `https://open.tiktokapis.com/v2/user/info/?fields=${encodeURIComponent(fields)}`;
      console.log('User stats endpoint:', statsUrl);

      const response = await fetch(statsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept-Encoding': 'identity', // Disable gzip to avoid Node.js fetch decompression issues
        },
      });

      const data = await response.json();
      console.log('User stats response status:', response.status);

      if (!response.ok) {
        console.error('User stats error response:', data);
        throw new Error(`TikTok API error: ${data.error?.message || data.message || 'Failed to get user stats'}`);
      }

      if (!data.data?.user) {
        console.error('Invalid user stats response:', data);
        throw new Error('TikTok API returned invalid stats response');
      }

      console.log('Successfully obtained user stats');
      return data.data.user;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  async getPublishStatus(accessToken: string, publishId: string) {
    console.log('Getting publish status...');
    
    // In test mode, return mock status
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock publish status');
      return {
        status: 'PUBLISH_COMPLETE',
        fail_reason: null,
        publiclyAvailable: true,
        uploaded_bytes: 1024000
      };
    }
    
    try {
      const statusUrl = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
      console.log('Status endpoint:', statusUrl);

      const response = await fetch(statusUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'identity', // Disable gzip to avoid Node.js fetch decompression issues
        },
        body: JSON.stringify({
          publish_id: publishId
        })
      });

      const data = await response.json();
      console.log('Publish status response status:', response.status);

      if (!response.ok) {
        console.error('Publish status error response:', data);
        throw new Error(`TikTok API error: ${data.error?.message || data.message || 'Failed to get publish status'}`);
      }

      if (!data.data) {
        console.error('Invalid publish status response:', data);
        throw new Error('TikTok API returned invalid publish status response');
      }

      console.log('Successfully obtained publish status');
      return data.data;
    } catch (error) {
      console.error('Error getting publish status:', error);
      throw error;
    }
  }

  async getCreatorInfo(accessToken: string) {
    console.log('Getting creator info...');
    
    // In test mode, return mock creator info
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock creator info');
      return {
        creator_avatar_url: 'https://example.com/avatar.jpg',
        creator_username: 'testuser',
        creator_nickname: 'Test User',
        privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
        comment_disabled: false,
        duet_disabled: false,
        stitch_disabled: false,
        max_video_post_duration_sec: 600
      };
    }
    
    try {
      const creatorInfoUrl = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
      console.log('Creator info endpoint:', creatorInfoUrl);

      // Add timeout to prevent hanging (increased to 20s as TikTok API can be slow)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Creator info request timed out after 20 seconds');
        controller.abort();
      }, 20000); // 20 second timeout

      const response = await fetch(creatorInfoUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'identity', // Disable gzip to avoid Node.js fetch decompression issues
        },
        body: JSON.stringify({}),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      console.log('Creator info response status:', response.status);

      // TikTok returns HTTP 200 even for errors - check error.code field
      // Per UX Guidelines Point 1b: Check for posting limits
      if (data.error && data.error.code !== 'ok') {
        console.error('Creator info error response:', data);
        
        // Handle specific error codes per TikTok documentation
        if (data.error.code === 'spam_risk_too_many_posts') {
          throw new Error('POSTING_LIMIT_REACHED: You have reached the daily post limit (15 posts/24h). Please try again later.');
        }
        if (data.error.code === 'spam_risk_user_banned_from_posting') {
          throw new Error('USER_BANNED: Your account is temporarily banned from posting. Please contact TikTok support.');
        }
        if (data.error.code === 'reached_active_user_cap') {
          throw new Error('APP_LIMIT_REACHED: This app has reached its daily active user limit. Please try again tomorrow.');
        }
        
        throw new Error(`TikTok API error: ${data.error.message || data.error.code || 'Failed to get creator info'}`);
      }

      if (!response.ok) {
        console.error('Creator info HTTP error response:', data);
        throw new Error(`TikTok API error: ${data.error?.message || data.message || 'Failed to get creator info'}`);
      }

      if (!data.data) {
        console.error('Invalid creator info response:', data);
        throw new Error('TikTok API returned invalid creator info response');
      }

      console.log('Successfully obtained creator info');
      return data.data;
    } catch (error) {
      console.error('Error getting creator info:', error);
      
      // Provide more context for abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('TikTok API request timed out. Please try again.');
      }
      
      throw error;
    }
  }

  async uploadVideo(accessToken: string, videoData: {
    title: string;
    video_file: Buffer;
    privacy_level?: 'PUBLIC_TO_EVERYONE' | 'SELF_ONLY' | 'MUTUAL_FOLLOW_FRIENDS';
    disable_comment?: boolean;
    disable_duet?: boolean;
    disable_stitch?: boolean;
    brand_content_toggle?: boolean;
    brand_organic_type?: 'YOUR_BRAND' | 'BRANDED_CONTENT' | 'BOTH';
  }) {
    console.log('Uploading video to TikTok...');
    
    // In test mode, return mock upload response
    if (TEST_MODE) {
      console.log('TikTok TEST MODE: Returning mock video upload response');
      return {
        video_id: 'test_video_id_' + Date.now(),
        status: 'success',
        message: 'Video uploaded successfully (test mode)',
        share_url: 'https://tiktok.com/@testuser/video/test123',
        privacy_level: videoData.privacy_level || 'SELF_ONLY'
      };
    }
    
    try {
      console.log('Initializing video upload...');
      
      // 1. Initialize upload
      // TikTok Content Posting API:
      // - Production endpoint: POST /v2/post/publish/video/init/ (for PUBLIC videos - requires approval)
      // - Inbox endpoint: POST /v2/post/publish/inbox/video/init/ (for drafts - works immediately)
      // Note: Using INBOX mode for testing until TikTok application is approved
      const videoSize = videoData.video_file.length;
      const privacyLevel = videoData.privacy_level || 'PUBLIC_TO_EVERYONE';
      
      // TEMPORARY: Use INBOX endpoint for all uploads during application testing
      // This sends videos to your TikTok Drafts instead of publishing publicly
      // After TikTok approves your application, switch back to production endpoint for PUBLIC videos
      const initEndpoint = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
      
      console.log(`Using INBOX/DRAFT endpoint for testing (privacy: ${privacyLevel})`);
      console.log(`Video size: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Access token length: ${accessToken.length}, starts with: ${accessToken.substring(0, 10)}...`);
      console.log(`Init endpoint: ${initEndpoint}`);
      
      // Create abort controller for timeout (30 seconds for init)
      const initAbortController = new AbortController();
      const initTimeout = setTimeout(() => {
        console.error('TikTok init request timed out after 30 seconds');
        initAbortController.abort();
      }, 30000);
      
      console.log('Sending init request to TikTok...');
      const initStartTime = Date.now();
      
      try {
        const initResponse = await fetch(initEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'identity', // Disable gzip to avoid Node.js fetch decompression issues
          },
          body: JSON.stringify({
            post_info: {
              title: videoData.title,
              privacy_level: privacyLevel,
              disable_comment: videoData.disable_comment ?? false,
              disable_duet: videoData.disable_duet ?? false,
              disable_stitch: videoData.disable_stitch ?? false,
              video_cover_timestamp_ms: 1000,
              ...(videoData.brand_content_toggle && videoData.brand_organic_type && {
                brand_content_toggle: true,
                brand_organic_type: videoData.brand_organic_type,
              }),
            },
            source_info: {
              source: 'FILE_UPLOAD',
              video_size: videoSize,
              chunk_size: videoSize,
              total_chunk_count: 1,
            }
          }),
          signal: initAbortController.signal,
        });
        
        clearTimeout(initTimeout);
        const initElapsedTime = Date.now() - initStartTime;
        console.log(`Init request completed in ${initElapsedTime}ms`);
        console.log('Init response status:', initResponse.status);
        console.log('Init response headers:', JSON.stringify(Object.fromEntries(initResponse.headers.entries())).substring(0, 300));

        // CRITICAL: Check for 401/403 BEFORE reading body
        // TikTok error responses can have hanging body streams that timeout
        if (initResponse.status === 401) {
          console.error('Init returned 401 Unauthorized - access token is invalid or expired');
          throw new Error(
            `TikTok access token is invalid or expired. Please go to Settings → Social Media → Disconnect and then Reconnect your TikTok account.`
          );
        }
        
        if (initResponse.status === 403) {
          console.error('Init returned 403 Forbidden - permission denied');
          // Try to get error details with a short timeout
          let errorDetails = 'Permission denied';
          try {
            const errorText = await Promise.race([
              initResponse.text(),
              new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
            ]);
            console.error('403 error body:', errorText);
            const errorData = JSON.parse(errorText);
            errorDetails = errorData.error?.message || errorData.message || 'Permission denied';
          } catch (e) {
            console.error('Could not parse 403 error body:', e);
          }
          throw new Error(
            `TikTok upload permission denied (403): ${errorDetails}. Please reconnect your TikTok account in Settings → Social Media.`
          );
        }

        // Parse response JSON with timeout
        // TikTok returns gzipped JSON - use .text() first then JSON.parse() to avoid gzip hanging
        let initData;
        
        try {
          console.log('Reading init response as text...');
          // First get the text (handles gzip properly)
          const responseText = await Promise.race([
            initResponse.text(),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('Text read timed out after 5 seconds')), 5000)
            )
          ]);
          console.log('✅ Response text received, length:', responseText.length);
          
          // Then parse the JSON
          console.log('Parsing JSON...');
          initData = JSON.parse(responseText);
          console.log('✅ Parsed init response successfully');
          console.log('Init response data:', JSON.stringify(initData).substring(0, 300));
        } catch (error) {
          console.error('❌ Failed to parse init response:', error);
          console.error('Response status was:', initResponse.status);
          console.error('Response headers:', JSON.stringify(Object.fromEntries(initResponse.headers.entries())));
          
          // If parsing fails, provide helpful error message
          if (error instanceof Error && error.message.includes('timed out')) {
            throw new Error(`TikTok response timed out while reading. Please try again.`);
          }
          
          throw new Error(`Failed to parse TikTok init response: ${error instanceof Error ? error.message : 'Parse error'}`);
        }
        
        if (!initResponse.ok) {
          console.error('Init error response:', initData);
          const errorMessage = initData.error?.message || initData.message || 'Unknown error';
          throw new Error(`Failed to initialize video upload (${initResponse.status}): ${errorMessage}`);
        }

        // Most v2 APIs return payload under { data: ... }
        const initPayload = (initData && typeof initData === 'object' && 'data' in initData) ? (initData as any).data : initData;
        const upload_url = (initPayload as any)?.upload_url;
        const upload_id = (initPayload as any)?.upload_id;
        const video_id = (initPayload as any)?.video_id;
        const publish_id = (initPayload as any)?.publish_id;

        if (!upload_url) {
          console.error('Init response missing upload_url:', initData);
          throw new Error('TikTok init did not return an upload_url');
        }

        console.log('Upload URL received:', upload_url);

        // 2. Upload video
        console.log('Uploading video file...');
        console.log(`Upload URL domain: ${new URL(upload_url).hostname}`);
        
        // Create abort controller for upload timeout (2 minutes for video upload)
        // Large videos can take time, especially on slower connections
        const uploadAbortController = new AbortController();
        const uploadTimeoutMs = 120000; // 2 minutes
        const uploadTimeout = setTimeout(() => {
          console.error(`TikTok video upload timed out after ${uploadTimeoutMs / 1000} seconds`);
          uploadAbortController.abort();
        }, uploadTimeoutMs);
        
        console.log('Sending video bytes to TikTok upload URL...');
        const uploadStartTime = Date.now();
        
        try {
          const uploadResponse = await fetch(upload_url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': String(videoSize),
              'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
              'Accept-Encoding': 'identity', // Disable gzip to avoid Node.js fetch decompression issues
            },
            // Node's fetch BodyInit typing doesn't accept Buffer in some TS DOM lib setups.
            // Convert to Uint8Array/ArrayBuffer to satisfy typings while preserving bytes.
            body: new Uint8Array(videoData.video_file),
            signal: uploadAbortController.signal,
          });

          clearTimeout(uploadTimeout);
          const uploadElapsedTime = Date.now() - uploadStartTime;
          console.log(`Video upload completed in ${(uploadElapsedTime / 1000).toFixed(2)} seconds`);
          console.log('Upload response status:', uploadResponse.status);
          
          // Parse response body with timeout using Promise.race
          let uploadBody = '';
          try {
            uploadBody = await Promise.race([
              uploadResponse.text(),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Upload response body parsing timed out after 15 seconds')), 15000)
              )
            ]);
            console.log('Upload response body:', uploadBody.substring(0, 500));
          } catch (bodyError) {
            console.error('Failed to read upload response body:', bodyError);
            uploadBody = '';
          }
          
          if (!uploadResponse.ok) {
            console.error('Upload error response:', uploadBody);
            throw new Error(`Failed to upload video: ${uploadBody || `HTTP ${uploadResponse.status}`}`);
          }

          // Log success based on privacy level
          const uploadMode = privacyLevel === 'PUBLIC_TO_EVERYONE' ? 'public post' : 'inbox draft';
          console.log(`Video uploaded successfully (${uploadMode})`, {
            publish_id,
            upload_id,
            video_id,
            privacy_level: privacyLevel,
            uploadResponseStatus: uploadResponse.status,
          });
          return {
            init: initData,
            publish_id,
            upload_id,
            video_id,
            upload_response: {
              status: uploadResponse.status,
              body: uploadBody?.slice(0, 2000) || '',
            },
            status: 'uploaded_to_tiktok'
          };
        } catch (uploadError) {
          clearTimeout(uploadTimeout);
          if (uploadError instanceof Error && uploadError.name === 'AbortError') {
            throw new Error(`TikTok video upload timed out after ${uploadTimeoutMs / 1000} seconds. The video may be too large or the connection is slow.`);
          }
          throw uploadError;
        }
      } catch (initError) {
        clearTimeout(initTimeout);
        if (initError instanceof Error && initError.name === 'AbortError') {
          throw new Error('TikTok initialization request timed out after 30 seconds. Please try again.');
        }
        throw initError;
      }
    } catch (error) {
      console.error('TikTok video upload error:', error);
      throw error;
    }
  }
} 