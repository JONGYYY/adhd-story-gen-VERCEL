/**
 * Campaign types for auto-pilot video generation
 */

export type CampaignFrequency = 'daily' | 'twice-daily' | 'custom';

export type CampaignStatus = 'active' | 'paused' | 'completed' | 'failed';

export interface CampaignConfig {
  // Campaign identity
  id: string;
  userId: string;
  name: string;
  status: CampaignStatus;
  
  // Scheduling
  frequency: CampaignFrequency;
  scheduleTime: string; // HH:mm format (e.g., "09:00")
  customScheduleTimes?: string[]; // For custom frequency
  videosPerBatch: number;
  
  // Content configuration
  sources: Array<'ai' | 'reddit'>;
  subreddits: string[];
  backgrounds: string[];
  voices: string[];
  storyLength: '1 min+ (Cliffhanger)' | 'Full Story Length';
  showRedditUI: boolean;
  
  // Auto-posting
  autoPostToTikTok: boolean;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
  
  // Statistics
  totalVideosGenerated: number;
  totalVideosPosted: number;
  failedGenerations: number;
}

export interface CampaignRun {
  id: string;
  campaignId: string;
  userId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  
  // Generated videos
  videoIds: string[];
  
  // Progress tracking
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  
  // Timestamps
  startedAt: number;
  completedAt?: number;
  
  // Error tracking
  errors?: Array<{
    videoIndex: number;
    error: string;
    timestamp: number;
  }>;
}

export interface CreateCampaignRequest {
  name: string;
  frequency: CampaignFrequency;
  scheduleTime: string;
  customScheduleTimes?: string[];
  videosPerBatch: number;
  sources: Array<'ai' | 'reddit'>;
  subreddits: string[];
  backgrounds: string[];
  voices: string[];
  storyLength: '1 min+ (Cliffhanger)' | 'Full Story Length';
  showRedditUI: boolean;
  autoPostToTikTok: boolean;
}

export interface UpdateCampaignRequest {
  name?: string;
  frequency?: CampaignFrequency;
  scheduleTime?: string;
  customScheduleTimes?: string[];
  videosPerBatch?: number;
  sources?: Array<'ai' | 'reddit'>;
  subreddits?: string[];
  backgrounds?: string[];
  voices?: string[];
  storyLength?: '1 min+ (Cliffhanger)' | 'Full Story Length';
  showRedditUI?: boolean;
  autoPostToTikTok?: boolean;
  status?: CampaignStatus;
}

