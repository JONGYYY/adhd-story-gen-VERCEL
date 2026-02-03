import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/firebase-admin';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { secureJsonResponse } from '@/lib/security/headers';

// Ensure Node.js runtime for Firebase Admin
export const runtime = 'nodejs';
// Prevent static generation
export const dynamic = 'force-dynamic';

// Set session expiration to 5 days
const expiresIn = 60 * 60 * 24 * 5 * 1000;

// Helper to determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

function determineCookieDomain(hostHeader: string | null): string | undefined {
  if (!hostHeader) return undefined;
  const host = hostHeader.split(':')[0];
  // For localhost or IPs, omit domain so cookie is host-only
  if (host === 'localhost' || /^(\d+\.){3}\d+$/.test(host)) return undefined;
  const parts = host.split('.');
  if (parts.length >= 2) {
    const root = parts.slice(-2).join('.');
    return `.${root}`; // leading dot to allow subdomains
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Session creation request received');
    
    // SECURITY: Rate limiting for authentication (prevent brute force)
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.AUTH);
    if (rateLimitResponse) return rateLimitResponse;

    // SECURITY: Parse JSON body with error handling
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      console.error('Failed to parse JSON body');
      return secureJsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    console.log('Request body keys:', Object.keys(body || {}));

    const { idToken } = body || {};

    // SECURITY: Validate idToken
    if (!idToken || typeof idToken !== 'string') {
      console.error('Missing or invalid idToken');
      return secureJsonResponse({ error: 'Missing or invalid ID token' }, 400);
    }
    
    // SECURITY: Length validation to prevent malformed tokens
    if (idToken.length < 100 || idToken.length > 10000) {
      console.error('ID token length out of expected range:', idToken.length);
      return secureJsonResponse({ error: 'Invalid ID token format' }, 400);
    }

    console.log('ID token received, length:', idToken.length);
    console.log('Creating session cookie...');

    // Create a session cookie using Firebase Admin directly
    const sessionCookie = await createSessionCookie(idToken, expiresIn);

    if (!sessionCookie) {
      console.error('Failed to create session cookie - no cookie returned');
      return secureJsonResponse({ error: 'Failed to create session cookie' }, 500);
    }

    console.log('Session cookie created successfully, length:', sessionCookie.length);

    const hostHeader = request.headers.get('host');
    // For TikTok OAuth (www -> apex callback), we need session cookies shared across subdomains.
    const cookieDomain = isProduction ? determineCookieDomain(hostHeader) : undefined;
    console.log('Resolved cookie domain:', cookieDomain || '(host-only)');

    // Set cookie options
    const options = {
      name: 'session',
      value: sessionCookie,
      maxAge: expiresIn,
      httpOnly: true,
      secure: isProduction,
      path: '/',
      sameSite: 'lax' as const,
      domain: cookieDomain,
    };

    console.log('Cookie options:', {
      name: options.name,
      maxAge: options.maxAge,
      httpOnly: options.httpOnly,
      secure: options.secure,
      path: options.path,
      sameSite: options.sameSite,
      domain: options.domain || '(none)'
    });

    // Return the session cookie
    const response = new NextResponse(JSON.stringify({ status: 'success' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set the cookie
    response.cookies.set(options as any);
    console.log('Session cookie set in response');

    return response;
  } catch (error: any) {
    console.error('Failed to create session:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    // SECURITY: Don't expose internal error details in production
    const errorMessage = error.message || 'Failed to create session';
    const isDevelopment = process.env.NODE_ENV === 'development';

    return secureJsonResponse({
      error: 'Authentication failed',
      // Only expose details in development
      ...(isDevelopment ? { details: errorMessage, code: error.code } : {})
    }, 500);
  }
} 