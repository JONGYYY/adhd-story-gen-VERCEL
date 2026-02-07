import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';

const YOUTUBE_OAUTH_CONFIG = {
  clientId: process.env.YOUTUBE_CLIENT_ID!,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`,
  scopes: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly'
  ]
};

export class YouTubeAPI {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      YOUTUBE_OAUTH_CONFIG.clientId,
      YOUTUBE_OAUTH_CONFIG.clientSecret,
      YOUTUBE_OAUTH_CONFIG.redirectUri
    );
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: YOUTUBE_OAUTH_CONFIG.scopes,
      prompt: 'consent'
    });
  }

  /**
   * Refresh access token using refresh token
   * YouTube access tokens expire after 1 hour
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      console.log('Refreshing YouTube access token...');
      
      const tokenEndpoint = 'https://oauth2.googleapis.com/token';
      const params = new URLSearchParams({
        client_id: YOUTUBE_OAUTH_CONFIG.clientId,
        client_secret: YOUTUBE_OAUTH_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Token refresh failed:', response.status, errorText);
          throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
        }

        const tokens = await response.json();
        console.log('Access token refreshed successfully');
        
        return {
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
          expiry_date: Date.now() + (tokens.expires_in * 1000)
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('Token refresh timed out after 30 seconds');
          throw new Error('Token refresh timed out. Please try again.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error in refreshAccessToken:', error);
      throw error;
    }
  }

  async getTokensFromCode(code: string) {
    try {
      console.log('Exchanging code for tokens...');
      console.log('Redirect URI:', YOUTUBE_OAUTH_CONFIG.redirectUri);
      
      // Manual token exchange to avoid google-auth-library body serialization bug
      const tokenEndpoint = 'https://oauth2.googleapis.com/token';
      const params = new URLSearchParams({
        code: code,
        client_id: YOUTUBE_OAUTH_CONFIG.clientId,
        client_secret: YOUTUBE_OAUTH_CONFIG.clientSecret,
        redirect_uri: YOUTUBE_OAUTH_CONFIG.redirectUri,
        grant_type: 'authorization_code'
      });

      console.log('Token exchange params:', {
        client_id: YOUTUBE_OAUTH_CONFIG.clientId.substring(0, 20) + '...',
        redirect_uri: YOUTUBE_OAUTH_CONFIG.redirectUri,
        grant_type: 'authorization_code',
        code_length: code.length
      });

      // Add timeout to prevent hanging (increased to 60s for slow YouTube API)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('Token exchange timeout (60s) - aborting');
        controller.abort();
      }, 60000); // 60 second timeout

      try {
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Token exchange failed:', response.status, errorText);
          throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
        }

        const tokens = await response.json();
        console.log('Tokens received successfully');
        
        // Set credentials on OAuth2 client for future API calls
        this.oauth2Client.setCredentials(tokens);
        
        return tokens;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('Token exchange timed out after 60 seconds');
          throw new Error('YouTube authorization is taking too long. Please try again.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error in getTokensFromCode:', error);
      throw error;
    }
  }

  async uploadVideo(accessToken: string, videoData: {
    title: string;
    description: string;
    filePath: string;
    privacyStatus?: 'private' | 'unlisted' | 'public';
  }) {
    try {
      // Set the credentials on the OAuth2 client
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      // Create YouTube client with the authenticated OAuth2 client
      const youtube = google.youtube('v3');

      const fileSize = fs.statSync(videoData.filePath).size;

      const res = await youtube.videos.insert({
        auth: this.oauth2Client,
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: videoData.title,
            description: videoData.description,
          },
          status: {
            privacyStatus: videoData.privacyStatus || 'private'
          }
        },
        media: {
          body: fs.createReadStream(videoData.filePath)
        }
      }, {
        onUploadProgress: (evt) => {
          const progress = (evt.bytesRead / fileSize) * 100;
          console.log(`Upload progress: ${Math.round(progress)}%`);
        }
      });

      return res.data;
    } catch (error) {
      console.error('Error uploading video to YouTube:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken: string) {
    try {
      console.log('Fetching YouTube channel info...');
      
      // Add timeout to prevent hanging (increased to 60s for slow YouTube API)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('getUserInfo timeout (60s) - aborting');
        controller.abort();
      }, 60000); // 60 second timeout
      
      let data: any;
      
      try {
        console.log('Sending request to YouTube channels API...');
        const startTime = Date.now();
        
        // Manual REST API call to avoid googleapis compatibility issues
        const response = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            },
            signal: controller.signal
          }
        );

        const elapsed = Date.now() - startTime;
        clearTimeout(timeoutId);
        console.log(`Channel info response received in ${elapsed}ms, status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('YouTube API error:', response.status, errorText);
          throw new Error(`Failed to fetch YouTube channel info: ${response.status}`);
        }

        data = await response.json();
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('getUserInfo request timed out after 60 seconds');
          throw new Error('YouTube API is taking too long to respond. Please try again.');
        }
        throw fetchError;
      }
      
      if (!data || !data.items || data.items.length === 0) {
        throw new Error('No YouTube channel found for this user');
      }
      
      const channel = data.items[0];
      console.log('YouTube channel found:', channel.snippet?.title);
      
      return {
        id: channel.id,
        username: channel.snippet?.title || '',
      };
    } catch (error) {
      console.error('Error in getUserInfo:', error);
      throw error;
    }
  }

  async getVideoAnalytics(accessToken: string, videoId: string) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtubeAnalytics = google.youtubeAnalytics('v2');
    const youtube = google.youtube('v3');

    // Get video details first
    const videoRes = await youtube.videos.list({
      auth: this.oauth2Client,
      part: ['snippet', 'statistics', 'contentDetails'],
      id: [videoId],
    });

    if (!videoRes.data.items || videoRes.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = videoRes.data.items[0];
    
    // Get analytics data
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = video.snippet?.publishedAt?.split('T')[0] || endDate;

    try {
      const analyticsRes = await youtubeAnalytics.reports.query({
        auth: this.oauth2Client,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration',
        dimensions: 'video',
        filters: `video==${videoId}`,
      });

      const analytics = analyticsRes.data.rows?.[0] || [];
      
      return {
        videoId,
        title: video.snippet?.title || '',
        views: parseInt(video.statistics?.viewCount || '0'),
        likes: parseInt(video.statistics?.likeCount || '0'),
        comments: parseInt(video.statistics?.commentCount || '0'),
        shares: analytics[5] || 0,
        watchTime: analytics[4] || 0, // minutes
        averageViewDuration: analytics[5] || 0, // seconds
        publishedAt: video.snippet?.publishedAt || '',
        thumbnail: video.snippet?.thumbnails?.default?.url || '',
      };
    } catch (error) {
      // If analytics fail, return basic stats
      return {
        videoId,
        title: video.snippet?.title || '',
        views: parseInt(video.statistics?.viewCount || '0'),
        likes: parseInt(video.statistics?.likeCount || '0'),
        comments: parseInt(video.statistics?.commentCount || '0'),
        shares: 0,
        watchTime: 0,
        averageViewDuration: 0,
        publishedAt: video.snippet?.publishedAt || '',
        thumbnail: video.snippet?.thumbnails?.default?.url || '',
      };
    }
  }

  async getChannelAnalytics(accessToken: string) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube('v3');
    const youtubeAnalytics = google.youtubeAnalytics('v2');

    // Get channel info
    const channelRes = await youtube.channels.list({
      auth: this.oauth2Client,
      part: ['snippet', 'statistics'],
      mine: true,
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      throw new Error('No YouTube channel found');
    }

    const channel = channelRes.data.items[0];

    // Get analytics for last 30 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const analyticsRes = await youtubeAnalytics.reports.query({
        auth: this.oauth2Client,
        ids: 'channel==MINE',
        startDate,
        endDate,
        metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
      });

      const metrics = analyticsRes.data.rows?.[0] || [];

      return {
        channelName: channel.snippet?.title || '',
        channelId: channel.id || '',
        subscribers: parseInt(channel.statistics?.subscriberCount || '0'),
        totalViews: parseInt(channel.statistics?.viewCount || '0'),
        totalVideos: parseInt(channel.statistics?.videoCount || '0'),
        last30Days: {
          views: metrics[0] || 0,
          likes: metrics[1] || 0,
          comments: metrics[2] || 0,
          shares: metrics[3] || 0,
          watchTime: metrics[4] || 0,
          averageViewDuration: metrics[5] || 0,
          subscribersGained: metrics[6] || 0,
          subscribersLost: metrics[7] || 0,
        },
      };
    } catch (error) {
      // If analytics fail, return basic channel stats
      return {
        channelName: channel.snippet?.title || '',
        channelId: channel.id || '',
        subscribers: parseInt(channel.statistics?.subscriberCount || '0'),
        totalViews: parseInt(channel.statistics?.viewCount || '0'),
        totalVideos: parseInt(channel.statistics?.videoCount || '0'),
        last30Days: {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          watchTime: 0,
          averageViewDuration: 0,
          subscribersGained: 0,
          subscribersLost: 0,
        },
      };
    }
  }
} 