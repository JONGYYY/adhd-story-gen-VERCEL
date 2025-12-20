'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function mintSessionCookie(user: User): Promise<void> {
  // Force refresh so we don’t mint with an about-to-expire token
  const idToken = await user.getIdToken(true);

  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // important for cookie reliability
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    let details: any = null;
    try {
      details = await res.json();
    } catch {
      // ignore
    }
    const msg =
      details?.error ||
      details?.details ||
      `Failed to create session (HTTP ${res.status})`;
    throw new Error(msg);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Keep latest searchParams value without re-subscribing auth listener unnecessarily
  const redirectPath = useMemo(() => searchParams.get('from') || '/create', [searchParams]);

  // Avoid double-minting session cookies on initial auth state + manual sign-in
  const didMintForUidRef = useRef<string | null>(null);

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) {
      console.error('[AuthProvider] Firebase Auth not initialized (check NEXT_PUBLIC_FIREBASE_* env vars)');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        didMintForUidRef.current = null;
        setLoading(false);
        return;
      }

      try {
        // Mint session cookie once per UID per page load
        if (didMintForUidRef.current !== nextUser.uid) {
          await mintSessionCookie(nextUser);
          didMintForUidRef.current = nextUser.uid;
        }

        // Only redirect from auth pages
        const path = window.location.pathname;
        if (path.startsWith('/auth/')) {
          router.replace(redirectPath);
        }
      } catch (e) {
        console.error('[AuthProvider] Session mint failed, signing out:', e);
        try {
          await signOut(auth);
        } catch {}
        setUser(null);
        didMintForUidRef.current = null;
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, redirectPath]);

  const signIn = async (email: string, password: string) => {
    const auth = getClientAuth();
    if (!auth) throw new Error('Firebase Auth not initialized');

    const result = await signInWithEmailAndPassword(auth, email, password);

    // Mint now so SSR pages read cookie immediately
    await mintSessionCookie(result.user);
    didMintForUidRef.current = result.user.uid;

    router.replace(redirectPath);
  };

  const signUp = async (email: string, password: string) => {
    const auth = getClientAuth();
    if (!auth) throw new Error('Firebase Auth not initialized');

    const result = await createUserWithEmailAndPassword(auth, email, password);

    await mintSessionCookie(result.user);
    didMintForUidRef.current = result.user.uid;

    router.replace(redirectPath);
  };

  const signInWithGoogle = async () => {
    const auth = getClientAuth();
    if (!auth) throw new Error('Firebase Auth not initialized');

    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    await mintSessionCookie(result.user);
    didMintForUidRef.current = result.user.uid;

    router.replace(redirectPath);
  };

  const logout = async () => {
    const auth = getClientAuth();
    if (!auth) throw new Error('Firebase Auth not initialized');

    await signOut(auth);

    // Clear server session cookie if you have an endpoint
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('[AuthProvider] Failed to clear server cookie:', e);
    }

    didMintForUidRef.current = null;
    router.replace('/auth/login');
  };

  const resetPassword = async (email: string) => {
    const auth = getClientAuth();
    if (!auth) throw new Error('Firebase Auth not initialized');
    await sendPasswordResetEmail(auth, email);
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    logout,
    signInWithGoogle,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
