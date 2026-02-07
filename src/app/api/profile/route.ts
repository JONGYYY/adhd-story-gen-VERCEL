import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie, getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTION = 'profiles';

async function getUserIdFromSession(request: NextRequest): Promise<string | null> {
  const sessionCookie = request.cookies.get('session')?.value;
  if (!sessionCookie) return null;
  const decoded = await verifySessionCookie(sessionCookie);
  return decoded?.uid || null;
}

export async function GET(request: NextRequest) {
  try {
    const uid = await getUserIdFromSession(request);
    if (!uid) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = await getAdminFirestore();
    const snap = await db.collection(COLLECTION).doc(uid).get();
    const data = snap.exists ? (snap.data() as any) : {};

    return new Response(JSON.stringify({
      displayName: typeof data.displayName === 'string' ? data.displayName : '',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to load profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to load profile' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getUserIdFromSession(request);
    if (!uid) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const displayNameRaw = typeof body?.displayName === 'string' ? body.displayName : '';
    const displayName = displayNameRaw.trim().slice(0, 40); // keep it short for banner

    const db = await getAdminFirestore();
    await db.collection(COLLECTION).doc(uid).set(
      {
        displayName,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return new Response(JSON.stringify({ success: true, displayName }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to save profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to save profile' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


