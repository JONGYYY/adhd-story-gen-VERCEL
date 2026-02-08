import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * Get current authenticated user from session cookie
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<{ uid: string } | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
      return null;
    }

    const auth = await getAdminAuth();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    return { uid: decodedClaims.uid };
  } catch (error) {
    console.error('[auth] Failed to get current user:', error);
    return null;
  }
}

/**
 * Get current user or throw error (for protected routes)
 */
export async function requireCurrentUser(): Promise<{ uid: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
