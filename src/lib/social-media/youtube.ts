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

  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
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
    const youtube = google.youtube('v3');
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const res = await youtube.channels.list({
      auth: this.oauth2Client,
      part: ['snippet'],
      mine: true,
    });
    if (!res.data.items || res.data.items.length === 0) {
      throw new Error('No YouTube channel found for this user');
    }
    const channel = res.data.items[0];
    return {
      id: channel.id,
      username: channel.snippet?.title || '',
    };
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