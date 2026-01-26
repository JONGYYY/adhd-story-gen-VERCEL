/**
 * Campaign templates/presets
 */

import { CreateCampaignRequest } from './types';

export type CampaignTemplate = Omit<CreateCampaignRequest, 'name'> & {
  id: string;
  templateName: string;
  description: string;
  icon: string;
  category: 'horror' | 'drama' | 'general' | 'custom';
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'daily-horror-mix',
    templateName: 'Daily Horror Mix',
    description: 'Generate spooky stories every day with multiple voices',
    icon: '👻',
    category: 'horror',
    frequency: 'daily',
    scheduleTime: '21:00',
    videosPerBatch: 5,
    sources: ['ai', 'reddit'],
    subreddits: ['r/nosleep', 'r/ShortScaryStories'],
    backgrounds: ['minecraft', 'subway'],
    voices: ['brian', 'adam', 'sarah'],
    storyLength: '1 min+ (Cliffhanger)',
    showRedditUI: true,
    autoPostToTikTok: false,
  },
  {
    id: 'aita-marathon',
    templateName: 'AITA Marathon',
    description: 'Twice-daily drama and relationship content',
    icon: '⚖️',
    category: 'drama',
    frequency: 'twice-daily',
    scheduleTime: '09:00',
    videosPerBatch: 3,
    sources: ['ai', 'reddit'],
    subreddits: ['r/AITA', 'r/relationships', 'r/TrueOffMyChest'],
    backgrounds: ['food', 'worker'],
    voices: ['sarah', 'laura', 'rachel'],
    storyLength: '1 min+ (Cliffhanger)',
    showRedditUI: true,
    autoPostToTikTok: false,
  },
  {
    id: 'confession-collection',
    templateName: 'Daily Confessions',
    description: 'Real confessions and life stories',
    icon: '🤫',
    category: 'drama',
    frequency: 'daily',
    scheduleTime: '12:00',
    videosPerBatch: 4,
    sources: ['ai', 'reddit'],
    subreddits: ['r/confession', 'r/TIFU', 'r/TrueOffMyChest'],
    backgrounds: ['minecraft', 'food'],
    voices: ['adam', 'antoni', 'laura'],
    storyLength: 'Full Story Length',
    showRedditUI: true,
    autoPostToTikTok: false,
  },
  {
    id: 'multi-voice-variety',
    templateName: 'Multi-Voice Variety',
    description: 'Mix of all story types with all voices',
    icon: '🎭',
    category: 'general',
    frequency: 'daily',
    scheduleTime: '15:00',
    videosPerBatch: 6,
    sources: ['ai', 'reddit'],
    subreddits: ['r/AITA', 'r/nosleep', 'r/TIFU', 'r/confession'],
    backgrounds: ['minecraft', 'subway', 'food', 'worker'],
    voices: ['brian', 'adam', 'antoni', 'sarah', 'laura', 'rachel'],
    storyLength: '1 min+ (Cliffhanger)',
    showRedditUI: true,
    autoPostToTikTok: false,
  },
  {
    id: 'work-stories',
    templateName: 'Work Tales',
    description: 'Restaurant and tech support stories',
    icon: '💼',
    category: 'general',
    frequency: 'daily',
    scheduleTime: '18:00',
    videosPerBatch: 4,
    sources: ['ai', 'reddit'],
    subreddits: ['r/TalesFromYourServer', 'r/TalesFromTechSupport'],
    backgrounds: ['worker', 'food'],
    voices: ['adam', 'sarah'],
    storyLength: '1 min+ (Cliffhanger)',
    showRedditUI: true,
    autoPostToTikTok: false,
  },
  {
    id: 'revenge-stories',
    templateName: 'Pro Revenge',
    description: 'Satisfying revenge stories daily',
    icon: '😈',
    category: 'drama',
    frequency: 'daily',
    scheduleTime: '20:00',
    videosPerBatch: 3,
    sources: ['ai', 'reddit'],
    subreddits: ['r/ProRevenge'],
    backgrounds: ['minecraft', 'subway'],
    voices: ['brian', 'antoni', 'rachel'],
    storyLength: 'Full Story Length',
    showRedditUI: true,
    autoPostToTikTok: false,
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: CampaignTemplate['category']): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter(t => t.category === category);
}

/**
 * Convert template to campaign request (just add name)
 */
export function templateToCampaignRequest(
  template: CampaignTemplate,
  campaignName: string
): CreateCampaignRequest {
  return {
    name: campaignName,
    frequency: template.frequency,
    scheduleTime: template.scheduleTime,
    customScheduleTimes: template.customScheduleTimes,
    videosPerBatch: template.videosPerBatch,
    sources: template.sources,
    subreddits: template.subreddits,
    backgrounds: template.backgrounds,
    voices: template.voices,
    storyLength: template.storyLength,
    showRedditUI: template.showRedditUI,
    autoPostToTikTok: template.autoPostToTikTok,
  };
}

