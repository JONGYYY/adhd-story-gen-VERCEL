import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 5 days in milliseconds for Firebase, but cookies need seconds
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000;
const EXPIRES_IN_SECONDS = Math.floor(EXPIRES_IN_MS / 1000);

const isProduction = process.env.NODE_ENV === 'production';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const idToken = body?.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid ID token' }, { status: 400 });
    }

    const sessionCookie = await createSessionCookie(idToken, EXPIRES_IN_MS);

    const res = NextResponse.json({ status: 'success' });

    res.cookies.set({
      name: 'session',
      value: sessionCookie,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: EXPIRES_IN_SECONDS, // ✅ seconds
      expires: new Date(Date.now() + EXPIRES_IN_MS),
      // host-only cookie by omitting domain
    });

    return res;
  } catch (error: any) {
    console.error('[api/auth/session] error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN',
      },
      { status: 500 }
    );
  }
}
