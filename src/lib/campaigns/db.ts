/**
 * Campaign database operations using Firestore
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import { CampaignConfig, CampaignRun, CampaignStatus } from './types';

const CAMPAIGNS_COLLECTION = 'campaigns';
const CAMPAIGN_RUNS_COLLECTION = 'campaign_runs';

/**
 * Create a new campaign
 */
export async function createCampaign(campaign: Omit<CampaignConfig, 'id'>): Promise<string> {
  const db = await getAdminFirestore();
  const docRef = await db.collection(CAMPAIGNS_COLLECTION).add(campaign);
  return docRef.id;
}

/**
 * Get campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<CampaignConfig | null> {
  const db = await getAdminFirestore();
  const doc = await db.collection(CAMPAIGNS_COLLECTION).doc(campaignId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    ...doc.data(),
  } as CampaignConfig;
}

/**
 * Get all campaigns for a user
 */
export async function getUserCampaigns(userId: string): Promise<CampaignConfig[]> {
  const db = await getAdminFirestore();
  const snapshot = await db
    .collection(CAMPAIGNS_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CampaignConfig[];
}

/**
 * Get active campaigns (for scheduler)
 */
export async function getActiveCampaigns(): Promise<CampaignConfig[]> {
  const db = await getAdminFirestore();
  const snapshot = await db
    .collection(CAMPAIGNS_COLLECTION)
    .where('status', '==', 'active')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CampaignConfig[];
}

/**
 * Get campaigns due to run (nextRunAt <= now)
 */
export async function getCampaignsDueToRun(): Promise<CampaignConfig[]> {
  const db = await getAdminFirestore();
  const now = Date.now();
  
  const snapshot = await db
    .collection(CAMPAIGNS_COLLECTION)
    .where('status', '==', 'active')
    .where('nextRunAt', '<=', now)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CampaignConfig[];
}

/**
 * Update campaign
 */
export async function updateCampaign(
  campaignId: string, 
  updates: Partial<CampaignConfig>
): Promise<void> {
  const db = await getAdminFirestore();
  await db.collection(CAMPAIGNS_COLLECTION).doc(campaignId).update({
    ...updates,
    updatedAt: Date.now(),
  });
}

/**
 * Update campaign status
 */
export async function updateCampaignStatus(
  campaignId: string, 
  status: CampaignStatus
): Promise<void> {
  await updateCampaign(campaignId, { status });
}

/**
 * Delete campaign
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  const db = await getAdminFirestore();
  await db.collection(CAMPAIGNS_COLLECTION).doc(campaignId).delete();
}

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
function findNextDistributedTime(distributedTimes: string[]): number {
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
  
  if (frequency === 'custom' && customScheduleTimes) {
    // Find next scheduled time
    const times = customScheduleTimes.map(time => {
      const [h, m] = time.split(':').map(Number);
      const scheduledTime = new Date();
      scheduledTime.setHours(h, m, 0, 0);
      
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      return scheduledTime.getTime();
    });
    
    return Math.min(...times);
  }
  
  // Default: 24 hours from now
  return Date.now() + (24 * 60 * 60 * 1000);
}

/**
 * Record campaign run
 */
export async function createCampaignRun(run: Omit<CampaignRun, 'id'>): Promise<string> {
  const db = await getAdminFirestore();
  const docRef = await db.collection(CAMPAIGN_RUNS_COLLECTION).add(run);
  return docRef.id;
}

/**
 * Update campaign run
 */
export async function updateCampaignRun(
  runId: string,
  updates: Partial<CampaignRun>
): Promise<void> {
  const db = await getAdminFirestore();
  await db.collection(CAMPAIGN_RUNS_COLLECTION).doc(runId).update(updates);
}

/**
 * Get campaign runs
 */
export async function getCampaignRuns(campaignId: string, limit = 10): Promise<CampaignRun[]> {
  const db = await getAdminFirestore();
  const snapshot = await db
    .collection(CAMPAIGN_RUNS_COLLECTION)
    .where('campaignId', '==', campaignId)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CampaignRun[];
}

/**
 * Get recent campaign runs for user
 */
export async function getUserRecentRuns(userId: string, limit = 20): Promise<CampaignRun[]> {
  const db = await getAdminFirestore();
  const snapshot = await db
    .collection(CAMPAIGN_RUNS_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CampaignRun[];
}

/**
 * Get next Reddit URL for campaign (sequential)
 */
export async function getNextRedditUrl(campaignId: string): Promise<string | null> {
  const campaign = await getCampaign(campaignId);
  
  if (!campaign?.redditUrls || campaign.redditUrls.length === 0) {
    return null;
  }
  
  const currentIndex = campaign.currentUrlIndex || 0;
  
  // Check if we've exhausted the list
  if (currentIndex >= campaign.redditUrls.length) {
    return null;
  }
  
  return campaign.redditUrls[currentIndex];
}

/**
 * Increment URL index after successful generation
 */
export async function incrementUrlIndex(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  const newIndex = (campaign.currentUrlIndex || 0) + 1;
  
  await updateCampaign(campaignId, {
    currentUrlIndex: newIndex
  });
}

