import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'TikTok DNS Verification Information',
    dnsVerification: {
      type: 'TXT',
      name: '@',
      value: 'tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj',
      instructions: [
        '1. Open your DNS provider (Namecheap/Cloudflare/etc.)',
        '2. Add a TXT record on the apex (name @) with the above value',
        '3. If using Railway Domains, ensure taleo.media and www.taleo.media are verified',
        '4. Wait for DNS propagation (10–60 minutes)',
        '5. Retry TikTok verification once the TXT resolves'
      ]
    },
    fileVerification: {
      url: 'https://taleo.media/tiktok-developers-site-verification.txt',
      alternativeUrl: 'https://taleo.media/api/tiktok-developers-site-verification',
      content: '5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj'
    }
  });
} 