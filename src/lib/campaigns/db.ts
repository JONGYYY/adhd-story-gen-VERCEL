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

// Re-export scheduling utilities for convenience
export { 
  calculateDistributedTimes, 
  calculateNextRunTime 
} from './scheduling-utils';

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

