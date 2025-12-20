import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getPrivateKey(): string {
  const raw = requireEnv('FIREBASE_ADMIN_PRIVATE_KEY');
  // Handle Railway/Vercel escaping
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export async function initFirebaseAdmin() {
  if (adminAuth && adminDb) {
    return { auth: adminAuth, firestore: adminDb };
  }

  const apps = getApps();
  adminApp = apps.length
    ? apps[0]
    : initializeApp({
        credential: cert({
          projectId: requireEnv('FIREBASE_ADMIN_PROJECT_ID'),
          clientEmail: requireEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
          privateKey: getPrivateKey(),
        }),
      });

  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);

  return { auth: adminAuth, firestore: adminDb };
}

export async function verifySessionCookie(sessionCookie: string, checkRevoked = true) {
  try {
    const { auth } = await initFirebaseAdmin();
    return await auth.verifySessionCookie(sessionCookie, checkRevoked);
  } catch (e) {
    console.error('[firebase-admin] verifySessionCookie failed:', e);
    return null;
  }
}

export async function createSessionCookie(idToken: string, expiresInMs: number) {
  const { auth } = await initFirebaseAdmin();
  return await auth.createSessionCookie(idToken, { expiresIn: expiresInMs });
}

export async function getAdminFirestore() {
  const { firestore } = await initFirebaseAdmin();
  return firestore;
}
