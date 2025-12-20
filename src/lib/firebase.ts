import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let warnedMissing = false;

function isClient() {
  return typeof window !== 'undefined';
}

function getConfig(): FirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

function hasRequiredConfig(cfg: FirebaseConfig): boolean {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
  return required.every((k) => Boolean(cfg[k]));
}

function warnMissingConfig(cfg: FirebaseConfig) {
  if (warnedMissing) return;
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
  const missing = required.filter((k) => !cfg[k]);
  if (missing.length) {
    console.error('[firebase] Missing NEXT_PUBLIC Firebase config keys:', missing);
    warnedMissing = true;
  }
}

export function getClientApp(): FirebaseApp | null {
  if (!isClient()) return null;
  if (cachedApp) return cachedApp;

  const cfg = getConfig();
  if (!hasRequiredConfig(cfg)) {
    warnMissingConfig(cfg);
    return null;
  }

  try {
    cachedApp = getApps().length ? getApps()[0] : initializeApp(cfg as any);
    return cachedApp;
  } catch (e) {
    console.error('[firebase] initializeApp failed:', e);
    cachedApp = null;
    return null;
  }
}

export function getClientAuth(): Auth | null {
  if (!isClient()) return null;
  if (cachedAuth) return cachedAuth;

  const app = getClientApp();
  if (!app) return null;

  try {
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (e) {
    console.error('[firebase] getAuth failed:', e);
    cachedAuth = null;
    return null;
  }
}

export function getClientDb(): Firestore | null {
  if (!isClient()) return null;
  if (cachedDb) return cachedDb;

  const app = getClientApp();
  if (!app) return null;

  try {
    cachedDb = getFirestore(app);

    // Enable persistence best-effort (safe to ignore errors)
    enableIndexedDbPersistence(cachedDb).catch((err: any) => {
      if (err?.code === 'failed-precondition') {
        console.warn('[firebase] Persistence failed: multiple tabs open');
      } else if (err?.code === 'unimplemented') {
        console.warn('[firebase] Persistence not supported in this browser');
      } else {
        console.warn('[firebase] Persistence error:', err);
      }
    });

    return cachedDb;
  } catch (e) {
    console.error('[firebase] getFirestore failed:', e);
    cachedDb = null;
    return null;
  }
}

/**
 * Optional: call from a client component after mount if you want analytics.
 * This avoids weird SSR/client timing issues.
 */
export async function initClientAnalytics(): Promise<void> {
  if (!isClient()) return;
  const app = getClientApp();
  if (!app) return;

  try {
    const yes = await isSupported();
    if (yes) getAnalytics(app);
  } catch (e) {
    console.warn('[firebase] analytics init failed:', e);
  }
}

export type { Auth };
