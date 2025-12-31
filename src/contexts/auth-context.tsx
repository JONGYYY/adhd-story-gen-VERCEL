'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { getClientAuth, Auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  logout: async () => {},
  signInWithGoogle: async () => {},
  resetPassword: async () => {},
});

// WARNING: This provider uses useSearchParams and must only be used in client components/pages.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionStateRef = useRef<{
    inFlight: boolean;
    lastOkAt: number;
    retryMs: number;
    timer: any;
  }>({ inFlight: false, lastOkAt: 0, retryMs: 0, timer: null });

  // Get the redirect URL from query params
  const getRedirectPath = () => searchParams.get('from') || '/create';

  // Create / refresh session cookie (retry on transient failure).
  // IMPORTANT: do NOT sign the user out if this fails; otherwise the UI can show "signed out"
  // while server-side session cookie still allows access.
  const createSession = async (
    user: User,
    opts?: { forceRefresh?: boolean; throwOnFailure?: boolean }
  ): Promise<boolean> => {
    try {
      const forceRefresh = Boolean(opts?.forceRefresh);
      const throwOnFailure = Boolean(opts?.throwOnFailure);
      const st = sessionStateRef.current;
      if (st.inFlight) return;
      // Throttle: avoid hammering /api/auth/session on every rerender/token change
      if (!forceRefresh && st.lastOkAt && Date.now() - st.lastOkAt < 10 * 60 * 1000) {
        return true;
      }

      st.inFlight = true;
      console.log('Getting ID token for session creation...');
      const idToken = await user.getIdToken(forceRefresh);
      console.log('ID token obtained, creating session...');
      
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Session creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create session');
      }

      console.log('Session created successfully');
      st.lastOkAt = Date.now();
      st.retryMs = 0;
      return true;
    } catch (error) {
      console.error('Error creating session:', error);
      if (opts?.throwOnFailure) {
        // Explicit login flows must hard-fail so we don't navigate to protected routes
        // without a session cookie (middleware will bounce us back to /auth/login).
        throw error;
      }
      // Schedule retry with exponential backoff; keep user signed in.
      const st = sessionStateRef.current;
      st.retryMs = Math.min(st.retryMs ? st.retryMs * 2 : 2000, 60_000);
      if (st.timer) clearTimeout(st.timer);
      st.timer = setTimeout(() => {
        // Force refresh on retry in case token was stale
        createSession(user, { forceRefresh: true }).catch(() => {});
      }, st.retryMs);
      return false;
    }
    finally {
      sessionStateRef.current.inFlight = false;
    }
  };

  // Handle auth state changes
  useEffect(() => {
    const auth = getClientAuth();
    // Check if Firebase auth is properly initialized
    if (!auth) {
      console.error('Firebase auth is not initialized');
      setLoading(false);
      return;
    }

    // Use onIdTokenChanged so we re-mint the session cookie on token refresh,
    // and avoid edge cases where auth state is still set but tokens rotated.
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setUser(user);

      if (user) {
        const ok = await createSession(user);
        // Only redirect if we're on an auth page
        const path = window.location.pathname;
        if (ok && path.startsWith('/auth/')) {
          router.replace(getRedirectPath());
        }
      }

      setLoading(false);
    });

    return () => {
      try { unsubscribe(); } catch {}
      const st = sessionStateRef.current;
      if (st.timer) clearTimeout(st.timer);
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createSession(result.user, { forceRefresh: true, throwOnFailure: true });
    router.replace(getRedirectPath());
  };

  const signUp = async (email: string, password: string) => {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createSession(result.user, { forceRefresh: true, throwOnFailure: true });
    router.replace(getRedirectPath());
  };

  const signInWithGoogle = async () => {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await createSession(result.user, { forceRefresh: true, throwOnFailure: true });
    router.replace(getRedirectPath());
  };

  const logout = async () => {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }
    await signOut(auth);
    // Clear the session cookie
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error clearing session cookie:', error);
    }
    router.push('/auth/login');
  };

  const resetPassword = async (email: string) => {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading,
        signIn, 
        signUp, 
        logout,
        signInWithGoogle,
        resetPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 