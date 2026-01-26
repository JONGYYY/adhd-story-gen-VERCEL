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
 * Calculate next run time based on frequency
 */
export function calculateNextRunTime(
  frequency: CampaignConfig['frequency'],
  scheduleTime: string,
  customScheduleTimes?: string[]
): number {
  const now = new Date();
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

