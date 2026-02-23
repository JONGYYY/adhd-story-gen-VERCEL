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
    this.oauth2Client = new google.auth.OAuth2({
      clientId: YOUTUBE_OAUTH_CONFIG.clientId,
      clientSecret: YOUTUBE_OAUTH_CONFIG.clientSecret,
      redirectUri: YOUTUBE_OAUTH_CONFIG.redirectUri,
      // Enable automatic token refresh
      eagerRefreshThresholdMillis: 5 * 60 * 1000, // Refresh 5 minutes before expiry
      forceRefreshOnFailure: true, // Auto-retry with refresh if request fails
    });
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: YOUTUBE_OAUTH_CONFIG.scopes,
      // Force account selection screen - allows user to switch accounts
      prompt: 'select_account consent'
    });
  }

  /**
   * Set credentials on OAuth2Client to enable automatic token refresh
   * Call this before making any API requests
   * 
   * @param credentials - User's stored credentials from database
   * @param onRefresh - Optional callback when token is auto-refreshed
   */
  setStoredCredentials(
    credentials: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: number;
    },
    onRefresh?: (tokens: any) => Promise<void>
  ) {
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiresAt,
    });
    
    // Set up automatic refresh callback to persist new tokens
    if (onRefresh && credentials.refreshToken) {
      this.oauth2Client.on('tokens', async (tokens) => {
        console.log('OAuth2Client auto-refreshed tokens');
        try {
          await onRefresh(tokens);
        } catch (error) {
          console.error('Failed to persist auto-refreshed tokens:', error);
        }
      });
    }
    
    console.log('OAuth2Client credentials set for automatic refresh');
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
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (cron-job.org has 30s total)

      try {
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          signal: controller.signal
        });

        if (!response.ok) {
          clearTimeout(timeoutId);
          const errorText = await response.text();
          console.error('Token refresh failed:', response.status, errorText);
          throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
        }

        const tokens = await response.json();
        clearTimeout(timeoutId); // Clear timeout AFTER response.json() completes
        
        console.log('Access token refreshed successfully');
        console.log('Token response:', {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiresIn: tokens.expires_in,
          tokenType: tokens.token_type
        });
        
        return {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token, // Google may return a new refresh token
          expires_in: tokens.expires_in || 3600,
          expiry_date: Date.now() + ((tokens.expires_in || 3600) * 1000)
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('Token refresh timed out after 15 seconds');
          throw new Error('Token refresh timed out. YouTube API may be slow.');
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
      
      // Try google-auth-library's native method first (more reliable on Railway)
      try {
        console.log('Attempting native OAuth2Client.getToken()...');
        const startTime = Date.now();
        
        const { tokens } = await this.oauth2Client.getToken(code);
        
        const elapsed = Date.now() - startTime;
        console.log(`Native token exchange completed in ${elapsed}ms`);
        console.log('Tokens received successfully (native method)');
        
        return tokens;
      } catch (nativeError) {
        console.error('Native token exchange failed:', nativeError);
        console.log('Falling back to manual fetch method...');
        
        // Fallback: Manual token exchange
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

        // Aggressive timeout (20s)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error('Manual token exchange timeout (20s) - aborting');
          controller.abort();
        }, 20000); // 20 second timeout

        try {
          console.log('Sending manual token exchange request...');
          const startTime = Date.now();
          
          const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'User-Agent': 'adhd-story-gen/1.0',
            },
            body: params.toString(),
            signal: controller.signal,
          });
          
          const elapsed = Date.now() - startTime;
          clearTimeout(timeoutId);
          console.log(`Manual token exchange response in ${elapsed}ms, status: ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Token exchange failed:', response.status, errorText);
            throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
          }

          // Add timeout specifically for JSON parsing (response.json() can hang)
          console.log('Parsing response JSON...');
          const jsonParseTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('JSON parsing timeout')), 10000);
          });
          
          const tokens = await Promise.race([
            response.json(),
            jsonParseTimeout
          ]) as any;
          
          console.log('Tokens received successfully (manual method)');
          
          // Set credentials on OAuth2 client for automatic refresh
          // Include refresh_token if present for future auto-refresh
          this.oauth2Client.setCredentials({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date || (Date.now() + (tokens.expires_in * 1000)),
            token_type: tokens.token_type,
            scope: tokens.scope
          });
          
          return tokens;
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.error('Manual token exchange timed out after 20 seconds');
            throw new Error('YouTube authorization is taking too long. Railway may be experiencing network issues with Google APIs. Please try again later.');
          }
          throw fetchError;
        }
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
      // Note: Credentials should already be set via setStoredCredentials()
      // This just ensures we have at least the access token
      if (!this.oauth2Client.credentials.access_token) {
        console.warn('OAuth2Client has no credentials, setting access token only');
        this.oauth2Client.setCredentials({
          access_token: accessToken
        });
      }

      // Create YouTube client with the authenticated OAuth2 client
      // The OAuth2Client will automatically refresh if needed
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

  /**
   * Get list of uploaded videos from the channel
   * Returns up to 50 most recent videos with their stats
   */
  async getChannelVideos(accessToken: string, maxResults: number = 50) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube('v3');

    // First, get the channel to find the uploads playlist
    const channelRes = await youtube.channels.list({
      auth: this.oauth2Client,
      part: ['contentDetails', 'snippet'],
      mine: true,
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      return [];
    }

    const uploadsPlaylistId = channelRes.data.items[0].contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return [];
    }

    // Get videos from uploads playlist
    const playlistRes = await youtube.playlistItems.list({
      auth: this.oauth2Client,
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults,
    });

    if (!playlistRes.data.items || playlistRes.data.items.length === 0) {
      return [];
    }

    // Get detailed stats for each video
    const videoIds = playlistRes.data.items
      .map(item => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length === 0) {
      return [];
    }

    const videosRes = await youtube.videos.list({
      auth: this.oauth2Client,
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    if (!videosRes.data.items) {
      return [];
    }

    // Get analytics data for each video to include average view duration
    const youtubeAnalytics = google.youtubeAnalytics('v2');
    
    // Fetch analytics for each video
    const videosWithAnalytics = await Promise.all(
      videosRes.data.items.map(async (video) => {
        let averageViewDuration = undefined;
        
        try {
          // Get video-specific analytics for average view duration
          const analyticsRes = await youtubeAnalytics.reports.query({
            auth: this.oauth2Client,
            ids: 'channel==MINE',
            startDate: '2020-01-01', // Get all-time data
            endDate: new Date().toISOString().split('T')[0],
            metrics: 'averageViewDuration',
            dimensions: 'video',
            filters: `video==${video.id}`,
          });
          
          if (analyticsRes.data.rows && analyticsRes.data.rows.length > 0) {
            averageViewDuration = analyticsRes.data.rows[0][1] as number; // Second column is the metric value
          }
        } catch (error) {
          console.log(`Could not fetch analytics for video ${video.id}:`, error);
        }
        
        return {
          id: video.id || '',
          title: video.snippet?.title || 'Untitled',
          thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || '',
          publishedAt: video.snippet?.publishedAt || '',
          views: parseInt(video.statistics?.viewCount || '0'),
          likes: parseInt(video.statistics?.likeCount || '0'),
          comments: parseInt(video.statistics?.commentCount || '0'),
          duration: video.contentDetails?.duration || '',
          url: `https://www.youtube.com/watch?v=${video.id}`,
          averageViewDuration,
        };
      })
    );
    
    return videosWithAnalytics;
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

    // Log channel statistics for debugging
    console.log('=== YouTube Channel Statistics ===');
    console.log('Channel Name:', channel.snippet?.title);
    console.log('Channel ID:', channel.id);
    console.log('Subscriber Count:', channel.statistics?.subscriberCount);
    console.log('Hidden Subscriber Count:', channel.statistics?.hiddenSubscriberCount);
    console.log('Total Views:', channel.statistics?.viewCount);
    console.log('Total Videos:', channel.statistics?.videoCount);
    console.log('===================================');

    // Get analytics for different time periods
    const endDate = new Date().toISOString().split('T')[0];
    const startDate30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      // Get aggregated metrics for last 30 days
      console.log('=== Fetching YouTube Analytics (30 days) ===');
      console.log('Date Range:', startDate30, 'to', endDate);
      
      const analyticsRes = await youtubeAnalytics.reports.query({
        auth: this.oauth2Client,
        ids: 'channel==MINE',
        startDate: startDate30,
        endDate,
        metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
      });

      console.log('Analytics API Response:');
      console.log('  Column Headers:', analyticsRes.data.columnHeaders?.map(h => h.name).join(', '));
      console.log('  Rows:', analyticsRes.data.rows);
      console.log('  Number of rows:', analyticsRes.data.rows?.length || 0);

      const metrics = analyticsRes.data.rows?.[0] || [];
      
      console.log('Parsed Metrics:');
      console.log('  Views:', metrics[0]);
      console.log('  Likes:', metrics[1]);
      console.log('  Comments:', metrics[2]);
      console.log('  Shares:', metrics[3]);
      console.log('  Watch Time (minutes):', metrics[4]);
      console.log('  Avg View Duration (seconds):', metrics[5]);
      console.log('  Subscribers Gained:', metrics[6]);
      console.log('  Subscribers Lost:', metrics[7]);
      console.log('=============================================');

      // Get daily breakdown for last 30 days (for charts)
      const dailyAnalyticsRes = await youtubeAnalytics.reports.query({
        auth: this.oauth2Client,
        ids: 'channel==MINE',
        startDate: startDate30,
        endDate,
        metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
        dimensions: 'day',
        sort: 'day',
      });

      // Get weekly breakdown for last 7 days
      const weeklyAnalyticsRes = await youtubeAnalytics.reports.query({
        auth: this.oauth2Client,
        ids: 'channel==MINE',
        startDate: startDate7,
        endDate,
        metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
        dimensions: 'day',
        sort: 'day',
      });

      // Get 90-day breakdown (for longer trend)
      const ninetyDayAnalyticsRes = await youtubeAnalytics.reports.query({
        auth: this.oauth2Client,
        ids: 'channel==MINE',
        startDate: startDate90,
        endDate,
        metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
        dimensions: 'day',
        sort: 'day',
      });

      // Parse daily data (8 metrics + date dimension = 9 columns)
      const dailyData = (dailyAnalyticsRes.data.rows || []).map((row: any[]) => ({
        date: row[0], // YYYY-MM-DD
        views: row[1] || 0,
        likes: row[2] || 0,
        comments: row[3] || 0,
        shares: row[4] || 0,
        watchTime: row[5] || 0, // minutes
        averageViewDuration: row[6] || 0, // seconds
        subscribersGained: row[7] || 0,
        subscribersLost: row[8] || 0,
      }));

      const weeklyData = (weeklyAnalyticsRes.data.rows || []).map((row: any[]) => ({
        date: row[0],
        views: row[1] || 0,
        likes: row[2] || 0,
        comments: row[3] || 0,
        shares: row[4] || 0,
        watchTime: row[5] || 0,
        averageViewDuration: row[6] || 0,
        subscribersGained: row[7] || 0,
        subscribersLost: row[8] || 0,
      }));

      const ninetyDayData = (ninetyDayAnalyticsRes.data.rows || []).map((row: any[]) => ({
        date: row[0],
        views: row[1] || 0,
        likes: row[2] || 0,
        comments: row[3] || 0,
        shares: row[4] || 0,
        watchTime: row[5] || 0,
        averageViewDuration: row[6] || 0,
        subscribersGained: row[7] || 0,
        subscribersLost: row[8] || 0,
      }));

      // Handle hidden subscriber count
      const isSubscriberCountHidden = channel.statistics?.hiddenSubscriberCount === true;
      const subscriberCount = isSubscriberCountHidden 
        ? null 
        : parseInt(channel.statistics?.subscriberCount || '0');
      
      console.log('Final Analytics Summary:');
      console.log('  Subscribers:', subscriberCount, isSubscriberCountHidden ? '(HIDDEN BY CHANNEL)' : '');
      console.log('  Total Views:', channel.statistics?.viewCount);
      console.log('  Total Videos:', channel.statistics?.videoCount);
      console.log('  30-day Views:', metrics[0]);
      console.log('  30-day Watch Time:', metrics[4], 'minutes');
      console.log('  30-day Engagement:', (metrics[1] || 0) + (metrics[2] || 0), 'interactions');
      console.log('=============================================');

      return {
        channelName: channel.snippet?.title || '',
        channelId: channel.id || '',
        subscribers: subscriberCount,
        subscribersHidden: isSubscriberCountHidden,
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
        // Time-series data for charts - map to expected keys
        timeSeries: {
          '7d': weeklyData,
          '30d': dailyData,
          '90d': ninetyDayData,
          'all': ninetyDayData, // Use 90-day data for 'all' timeframe
          last7Days: weeklyData, // Keep for backwards compatibility
          last30Days: dailyData,
          last90Days: ninetyDayData,
        },
      };
    } catch (error) {
      console.error('Failed to fetch YouTube Analytics time-series data:', error);
      console.error('Error type:', error instanceof Error ? error.message : String(error));
      
      // Handle hidden subscriber count even in error case
      const isSubscriberCountHidden = channel.statistics?.hiddenSubscriberCount === true;
      const subscriberCount = isSubscriberCountHidden 
        ? null 
        : parseInt(channel.statistics?.subscriberCount || '0');
      
      console.log('Returning basic channel stats (Analytics API failed)');
      console.log('  Subscribers:', subscriberCount, isSubscriberCountHidden ? '(HIDDEN)' : '');
      
      // If analytics fail, return basic channel stats
      return {
        channelName: channel.snippet?.title || '',
        channelId: channel.id || '',
        subscribers: subscriberCount,
        subscribersHidden: isSubscriberCountHidden,
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
        timeSeries: {
          last7Days: [],
          last30Days: [],
          last90Days: [],
        },
      };
    }
  }
} 