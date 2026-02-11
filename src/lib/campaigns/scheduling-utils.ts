/**
 * Campaign scheduling utilities
 * Pure functions that can be used in both client and server contexts
 */

import { CampaignConfig } from './types';

/**
 * Calculate evenly distributed times for times-per-day frequency
 */
export function calculateDistributedTimes(timesPerDay: number): string[] {
  const interval = 24 / timesPerDay;
  const times: string[] = [];
  
  for (let i = 0; i < timesPerDay; i++) {
    const hours = Math.floor(i * interval);
    const minutes = 0;
    times.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  }
  
  return times;
}

/**
 * Find next distributed time from a list of times
 */
export function findNextDistributedTime(distributedTimes: string[]): number {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Convert times to minutes and find the next one
  const timesInMinutes = distributedTimes.map(time => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  });
  
  // Find next time today
  const nextTime = timesInMinutes.find(t => t > currentMinutes);
  
  if (nextTime !== undefined) {
    // Next time is today
    const nextRun = new Date();
    nextRun.setHours(Math.floor(nextTime / 60), nextTime % 60, 0, 0);
    return nextRun.getTime();
  } else {
    // All times passed today, use first time tomorrow
    const firstTime = timesInMinutes[0];
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(Math.floor(firstTime / 60), firstTime % 60, 0, 0);
    return nextRun.getTime();
  }
}

/**
 * Calculate next run time based on frequency
 * This is the main scheduling function used by both client (for preview) and server (for actual scheduling)
 */
export function calculateNextRunTime(
  frequency: CampaignConfig['frequency'],
  scheduleTime: string,
  customScheduleTimes?: string[],
  intervalHours?: number,
  timesPerDay?: number,
  distributedTimes?: string[],
  lastRunAt?: number
): number {
  const now = new Date();
  
  // Interval: Add X hours to last run time
  if (frequency === 'interval' && intervalHours) {
    const base = lastRunAt ? new Date(lastRunAt) : now;
    return base.getTime() + (intervalHours * 60 * 60 * 1000);
  }
  
  // Times per day: Find next distributed time
  if (frequency === 'times-per-day' && distributedTimes) {
    return findNextDistributedTime(distributedTimes);
  }
  
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  
  if (frequency === 'daily') {
    const nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return nextRun.getTime();
  }
  
  if (frequency === 'twice-daily') {
    // Run at scheduleTime and 12 hours later
    const morningRun = new Date();
    morningRun.setHours(hours, minutes, 0, 0);
    
    const eveningRun = new Date(morningRun);
    eveningRun.setHours(eveningRun.getHours() + 12);
    
    // Find next available time
    if (now < morningRun) {
      return morningRun.getTime();
    } else if (now < eveningRun) {
      return eveningRun.getTime();
    } else {
      // Both times passed, schedule morning run for tomorrow
      morningRun.setDate(morningRun.getDate() + 1);
      return morningRun.getTime();
    }
  }
  
  if (frequency === 'custom' && customScheduleTimes && customScheduleTimes.length > 0) {
    // Use the same logic as findNextDistributedTime for consistency
    return findNextDistributedTime(customScheduleTimes);
  }
  
  // Default: 24 hours from now
  return Date.now() + (24 * 60 * 60 * 1000);
}
