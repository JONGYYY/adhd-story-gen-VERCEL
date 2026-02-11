/**
 * Format campaign frequency for display
 */

import { CampaignConfig } from './types';

export function formatCampaignFrequency(campaign: CampaignConfig): string {
  switch (campaign.frequency) {
    case 'daily':
      return `Daily at ${campaign.scheduleTime || '09:00'}`;
    
    case 'twice-daily':
      return `Twice Daily at ${campaign.scheduleTime || '09:00'}`;
    
    case 'interval':
      return `Every ${campaign.intervalHours || 4} hours`;
    
    case 'times-per-day':
      return `${campaign.timesPerDay || 3} times daily`;
    
    case 'custom':
      if (campaign.customScheduleTimes && campaign.customScheduleTimes.length > 0) {
        return `Custom (${campaign.customScheduleTimes.length} times)`;
      }
      return 'Custom schedule';
    
    default:
      return 'Unknown schedule';
  }
}

export function formatCampaignFrequencyShort(campaign: CampaignConfig): string {
  switch (campaign.frequency) {
    case 'daily':
      return 'Daily';
    
    case 'twice-daily':
      return 'Twice Daily';
    
    case 'interval':
      return `Every ${campaign.intervalHours || 4}h`;
    
    case 'times-per-day':
      return `${campaign.timesPerDay}x daily`;
    
    case 'custom':
      return campaign.customScheduleTimes 
        ? `${campaign.customScheduleTimes.length}x daily`
        : 'Custom';
    
    default:
      return campaign.frequency;
  }
}
