/**
 * Campaign types for auto-pilot video generation
 */

export type CampaignFrequency = 
  | 'daily' 
  | 'twice-daily' 
  | 'custom'
  | 'interval'        // Every X hours
  | 'times-per-day';  // X times daily

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
  
  // Reddit URL list support
  redditUrls?: string[];           // List of Reddit URLs to use
  currentUrlIndex?: number;        // Track which URL to use next
  useRedditUrls?: boolean;         // true = use URL list, false = use subreddits
  
  // Advanced scheduling
  intervalHours?: number;          // For 'interval' frequency (e.g., 4 = every 4 hours)
  timesPerDay?: number;            // For 'times-per-day' frequency (e.g., 3 = 3x daily)
  distributedTimes?: string[];     // Auto-calculated times for 'times-per-day'
  
  // Auto-posting
  autoPostToTikTok: boolean;
  autoPostToYouTube: boolean;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
  
  // Statistics
  totalVideosGenerated: number;
  totalVideosPosted: number;
  failedGenerations: number;
  
  // Failure handling
  lastFailureAt?: number;
  failureReason?: string;
  notificationsSent?: {
    lastFailureNotification?: number;
    lastCompletionNotification?: number;
  };
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
  autoPostToYouTube: boolean;
  
  // Reddit URL list support
  redditUrls?: string[];
  useRedditUrls?: boolean;
  
  // Advanced scheduling
  intervalHours?: number;
  timesPerDay?: number;
  distributedTimes?: string[];
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
  autoPostToYouTube?: boolean;
  status?: CampaignStatus;
  
  // Reddit URL list support
  redditUrls?: string[];
  useRedditUrls?: boolean;
  currentUrlIndex?: number;
  
  // Advanced scheduling
  intervalHours?: number;
  timesPerDay?: number;
  distributedTimes?: string[];
  
  // Failure handling
  lastFailureAt?: number;
  failureReason?: string;
}

