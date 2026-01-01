import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Prefer an env var so the portal can be updated without code changes.
  const code =
    process.env.TIKTOK_DEVELOPERS_SITE_VERIFICATION ||
    process.env.TIKTOK_VERIFICATION_CODE ||
    'tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';

  return new NextResponse(code, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=300',
    },
  });
}


