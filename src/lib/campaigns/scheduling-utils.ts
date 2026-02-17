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
 * 
 * @param distributedTimes - Array of "HH:MM" times in user's local timezone
 * @param userTimezoneOffset - User's timezone offset in minutes (from Date.getTimezoneOffset())
 *                             Positive values = west of UTC (e.g., PST = +480, EST = +300)
 *                             If undefined, assumes code is running in user's timezone (client-side)
 */
export function findNextDistributedTime(
  distributedTimes: string[], 
  userTimezoneOffset?: number
): number {
  const now = Date.now();
  
  // Convert schedule times to minutes since midnight
  const timesInMinutes = distributedTimes.map(time => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }).sort((a, b) => a - b); // Sort times chronologically
  
  console.log('findNextDistributedTime called:');
  console.log('  Input times:', distributedTimes);
  console.log('  Times in minutes (sorted):', timesInMinutes);
  console.log('  User timezone offset:', userTimezoneOffset, 'minutes');
  
  // Calculate current time in user's timezone
  let currentTimeInUserTz: Date;
  if (userTimezoneOffset !== undefined) {
    // Server-side: Convert UTC to user's local time
    // offset = minutes WEST of UTC, so we subtract to get user's local time
    currentTimeInUserTz = new Date(now - (userTimezoneOffset * 60 * 1000));
  } else {
    // Client-side: already in user's timezone
    currentTimeInUserTz = new Date(now);
  }
  
  const currentMinutes = currentTimeInUserTz.getHours() * 60 + currentTimeInUserTz.getMinutes();
  console.log('  Current time (user TZ):', currentTimeInUserTz.toISOString());
  console.log('  Current minutes:', currentMinutes);
  
  // Find next time today
  const nextTimeToday = timesInMinutes.find(t => t > currentMinutes);
  
  let nextRunInUserTz: Date;
  if (nextTimeToday !== undefined) {
    // Next run is today
    nextRunInUserTz = new Date(currentTimeInUserTz);
    nextRunInUserTz.setHours(Math.floor(nextTimeToday / 60), nextTimeToday % 60, 0, 0);
    console.log('  Next run is TODAY at', Math.floor(nextTimeToday / 60), ':', nextTimeToday % 60);
  } else {
    // All times passed today, use first time tomorrow
    nextRunInUserTz = new Date(currentTimeInUserTz);
    nextRunInUserTz.setDate(nextRunInUserTz.getDate() + 1);
    nextRunInUserTz.setHours(Math.floor(timesInMinutes[0] / 60), timesInMinutes[0] % 60, 0, 0);
    console.log('  Next run is TOMORROW at', Math.floor(timesInMinutes[0] / 60), ':', timesInMinutes[0] % 60);
  }
  
  // Convert back to UTC timestamp
  let nextRunUTC: number;
  if (userTimezoneOffset !== undefined) {
    // Server-side: Convert user's local time to UTC
    nextRunUTC = nextRunInUserTz.getTime() + (userTimezoneOffset * 60 * 1000);
  } else {
    // Client-side: already a valid timestamp
    nextRunUTC = nextRunInUserTz.getTime();
  }
  
  console.log('  Next run (user TZ):', nextRunInUserTz.toISOString());
  console.log('  Next run (UTC):', new Date(nextRunUTC).toISOString());
  
  return nextRunUTC;
}

/**
 * Calculate next run time based on frequency
 * This is the main scheduling function used by both client (for preview) and server (for actual scheduling)
 * 
 * @param userTimezoneOffset - User's timezone offset in minutes (from Date.getTimezoneOffset())
 *                             If not provided, assumes server and user are in the same timezone
 */
export function calculateNextRunTime(
  frequency: CampaignConfig['frequency'],
  scheduleTime: string,
  customScheduleTimes?: string[],
  intervalHours?: number,
  timesPerDay?: number,
  distributedTimes?: string[],
  lastRunAt?: number,
  userTimezoneOffset?: number
): number {
  const now = new Date();
  
  // Interval: Add X hours to last run time
  if (frequency === 'interval' && intervalHours) {
    const base = lastRunAt ? new Date(lastRunAt) : now;
    return base.getTime() + (intervalHours * 60 * 60 * 1000);
  }
  
  // Times per day: Find next distributed time
  if (frequency === 'times-per-day' && distributedTimes) {
    return findNextDistributedTime(distributedTimes, userTimezoneOffset);
  }
  
  // Custom schedule times
  if (frequency === 'custom' && customScheduleTimes && customScheduleTimes.length > 0) {
    return findNextDistributedTime(customScheduleTimes, userTimezoneOffset);
  }
  
  // For daily and twice-daily, parse the schedule time
  const [hours, minutes] = scheduleTime.split(':').map(Number);
  
  if (frequency === 'daily') {
    // Use the same approach as findNextDistributedTime for consistency
    return findNextDistributedTime([scheduleTime], userTimezoneOffset);
  }
  
  if (frequency === 'twice-daily') {
    // Run at scheduleTime and 12 hours later
    const secondHour = (hours + 12) % 24;
    const firstTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const secondTime = `${secondHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return findNextDistributedTime([firstTime, secondTime], userTimezoneOffset);
  }
  
  // Default: 24 hours from now
  return Date.now() + (24 * 60 * 60 * 1000);
}
