/**
 * Subscription tier validation
 * For now, this is a placeholder - in production, integrate with Stripe/payment processor
 */

import { getAdminFirestore } from '@/lib/firebase-admin';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  isActive: boolean;
  startDate: number;
  endDate?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

/**
 * Get user's subscription status
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const db = await getAdminFirestore();
  const doc = await db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId).get();
  
  if (!doc.exists) {
    // Return default free tier
    return {
      userId,
      tier: 'free',
      isActive: true,
      startDate: Date.now(),
    };
  }
  
  return doc.data() as UserSubscription;
}

/**
 * Check if user has Pro access
 */
export async function hasProAccess(userId: string): Promise<boolean> {
  // TESTING: Always return true to disable pro plan checks
  return true;
  
  /* Original logic (commented out for testing)
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return false;
  }
  
  // Check if subscription is active and tier is pro or enterprise
  if (!subscription.isActive) {
    return false;
  }
  
  if (subscription.tier === 'free') {
    return false;
  }
  
  // Check if subscription has expired
  if (subscription.endDate && subscription.endDate < Date.now()) {
    return false;
  }
  
  return subscription.tier === 'pro' || subscription.tier === 'enterprise';
  */
}

/**
 * Get feature limits based on tier
 */
export function getFeatureLimits(tier: SubscriptionTier) {
  switch (tier) {
    case 'free':
      return {
        videosPerDay: 5,
        batchSize: 0, // No batch creation
        autoPilot: false,
        autoPostToTikTok: false,
        customFonts: false,
        priorityQueue: false,
      };
    
    case 'pro':
      return {
        videosPerDay: 50,
        batchSize: 20,
        autoPilot: true,
        autoPostToTikTok: true,
        customFonts: true,
        priorityQueue: true,
      };
    
    case 'enterprise':
      return {
        videosPerDay: -1, // Unlimited
        batchSize: 50,
        autoPilot: true,
        autoPostToTikTok: true,
        customFonts: true,
        priorityQueue: true,
      };
    
    default:
      return getFeatureLimits('free');
  }
}

/**
 * Validate if user can create batch
 */
export async function canCreateBatch(userId: string, batchSize: number): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  // TESTING: Always allow batch creation
  return { allowed: true };
  
  /* Original logic (commented out for testing)
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return {
      allowed: false,
      reason: 'Unable to verify subscription',
    };
  }
  
  const limits = getFeatureLimits(subscription.tier);
  
  if (limits.batchSize === 0) {
    return {
      allowed: false,
      reason: 'Batch creation requires Pro plan',
    };
  }
  
  if (batchSize > limits.batchSize) {
    return {
      allowed: false,
      reason: `Batch size exceeds limit (${limits.batchSize} videos max)`,
    };
  }
  
  return { allowed: true };
  */
}

/**
 * Validate if user can use auto-pilot
 */
export async function canUseAutoPilot(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  // TESTING: Always allow auto-pilot
  return { allowed: true };
  
  /* Original logic (commented out for testing)
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return {
      allowed: false,
      reason: 'Unable to verify subscription',
    };
  }
  
  const limits = getFeatureLimits(subscription.tier);
  
  if (!limits.autoPilot) {
    return {
      allowed: false,
      reason: 'Auto-pilot requires Pro plan',
    };
  }
  
  return { allowed: true };
  */
}

/**
 * Set user subscription (for testing/admin)
 */
export async function setUserSubscription(subscription: UserSubscription): Promise<void> {
  const db = await getAdminFirestore();
  await db.collection(SUBSCRIPTIONS_COLLECTION).doc(subscription.userId).set(subscription);
}

