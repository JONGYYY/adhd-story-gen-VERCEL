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

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: params.toString(),
      });

      const data = await response.json();
      console.log('Token response status:', response.status);
      
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
    console.log('Getting user info...');
    
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

      const response = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      console.log('User info response status:', response.status);

      if (!response.ok) {
        console.error('User info error response:', data);
        throw new Error(`TikTok API error: ${data.error?.message || data.message || 'Failed to get user info'}`);
      }

      if (!data.data?.user) {
        console.error('Invalid user info response:', data);
        throw new Error('Invalid user info response from TikTok');
      }

      console.log('Successfully obtained user info');
      return data.data.user;
    } catch (error) {
      console.error('Error getting user info:', error);
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

  async uploadVideo(accessToken: string, videoData: {
    title: string;
    video_file: Buffer;
    privacy_level?: 'PUBLIC' | 'SELF_ONLY' | 'MUTUAL_FOLLOW';
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
      // - Production endpoint: POST /v2/post/publish/video/init/ (for PUBLIC videos)
      // - Sandbox/Inbox endpoint: POST /v2/post/publish/inbox/video/init/ (for drafts/private)
      // Note: Using the production endpoint for PUBLIC uploads, sandbox for SELF_ONLY
      const videoSize = videoData.video_file.length;
      const privacyLevel = videoData.privacy_level || 'PUBLIC';
      
      // Use production endpoint for PUBLIC, sandbox/inbox for SELF_ONLY
      const initEndpoint = privacyLevel === 'PUBLIC' 
        ? 'https://open.tiktokapis.com/v2/post/publish/video/init/'
        : 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
      
      console.log(`Using ${privacyLevel === 'PUBLIC' ? 'PRODUCTION' : 'SANDBOX/INBOX'} endpoint for ${privacyLevel} video`);
      
      const initResponse = await fetch(initEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: videoData.title,
            privacy_level: privacyLevel,
            ...(privacyLevel === 'PUBLIC' && {
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
              video_cover_timestamp_ms: 1000,
            }),
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
          }
        }),
      });

      const initData = await initResponse.json();
      console.log('Init response status:', initResponse.status);
      
      if (!initResponse.ok) {
        console.error('Init error response:', initData);
        throw new Error(`Failed to initialize video upload: ${initData.error?.message || initData.message || 'Unknown error'}`);
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
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(videoSize),
          'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
        },
        // Node's fetch BodyInit typing doesn't accept Buffer in some TS DOM lib setups.
        // Convert to Uint8Array/ArrayBuffer to satisfy typings while preserving bytes.
        body: new Uint8Array(videoData.video_file),
      });

      console.log('Upload response status:', uploadResponse.status);
      const uploadBody = await uploadResponse.text().catch(() => '');
      
      if (!uploadResponse.ok) {
        console.error('Upload error response:', uploadBody);
        throw new Error(`Failed to upload video: ${uploadBody}`);
      }

      // Log success based on privacy level
      const uploadMode = privacyLevel === 'PUBLIC' ? 'public post' : 'inbox draft';
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
    } catch (error) {
      console.error('TikTok video upload error:', error);
      throw error;
    }
  }
} 