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
      
      // Wait if another creation is in flight (for explicit login flows)
      if (st.inFlight) {
        if (throwOnFailure) {
          // For explicit logins, wait for the in-flight request to complete
          console.log('Session creation already in flight, waiting...');
          let attempts = 0;
          while (st.inFlight && attempts < 50) { // Max 5 seconds
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          if (st.inFlight) {
            throw new Error('Session creation timed out');
          }
          // Check if the previous creation succeeded
          return st.lastOkAt > 0;
        }
        // For background refreshes, just skip
        return true;
      }
      
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
        // Create session in background (will wait if explicit login is in progress)
        await createSession(user);
        // NOTE: We DON'T redirect here. The explicit login functions (signIn, signUp, signInWithGoogle)
        // handle their own redirects after ensuring session is created with throwOnFailure.
        // This avoids race conditions and duplicate redirects.
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
    console.log('[signIn] Starting email/password sign-in...');
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('[signIn] Sign-in completed, user:', result.user.email);
    
    await createSession(result.user, { forceRefresh: true, throwOnFailure: true });
    console.log('[signIn] Session created successfully');
    
    // Small delay to ensure cookie is set in browser before redirect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const redirectPath = getRedirectPath();
    console.log('[signIn] Redirecting to:', redirectPath);
    router.replace(redirectPath);
  };

  const signUp = async (email: string, password: string) => {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }
    console.log('[signUp] Starting sign-up...');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('[signUp] Sign-up completed, user:', result.user.email);
    
    await createSession(result.user, { forceRefresh: true, throwOnFailure: true });
    console.log('[signUp] Session created successfully');
    
    // Small delay to ensure cookie is set in browser before redirect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const redirectPath = getRedirectPath();
    console.log('[signUp] Redirecting to:', redirectPath);
    router.replace(redirectPath);
  };

  const signInWithGoogle = async () => {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }
    console.log('[signInWithGoogle] Starting Google sign-in...');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    console.log('[signInWithGoogle] Popup completed, user:', result.user.email);
    
    await createSession(result.user, { forceRefresh: true, throwOnFailure: true });
    console.log('[signInWithGoogle] Session created successfully');
    
    // Small delay to ensure cookie is set in browser before redirect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const redirectPath = getRedirectPath();
    console.log('[signInWithGoogle] Redirecting to:', redirectPath);
    router.replace(redirectPath);
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