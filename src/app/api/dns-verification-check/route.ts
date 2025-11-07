import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Current deployment: Railway with custom domain
    const domain = 'taleo.media';
    const wwwDomain = 'www.taleo.media';
    // Example TXT record used by TikTok site verification (kept for reference)
    const expectedTxtRecord = 'tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj';
    
    // Test DNS resolution
    let dnsResults = null;
    try {
      // Try to resolve TXT records (this might not work in Vercel edge runtime)
      const dns = await import('dns').catch(() => null);
      if (dns) {
        dnsResults = 'DNS module available - can check TXT records';
      } else {
        dnsResults = 'DNS module not available in edge runtime';
      }
    } catch (error) {
      dnsResults = `DNS check error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return NextResponse.json({
      success: true,
      message: 'DNS / Domain Setup Guide for Railway',
      domain,
      wwwDomain,
      expectedTxtRecord,
      dnsResults,
      instructions: {
        connectDomain: {
          title: 'Add Custom Domain in Railway',
          steps: [
            '1. Open your Railway project → Service → Domains',
            `2. Add ${domain} and ${wwwDomain}`,
            '3. Railway will show the exact DNS records to add'
          ]
        },
        dnsForWWW: {
          title: `DNS for ${wwwDomain} (CNAME)`,
          steps: [
            `1. Create CNAME record: host=www value=<your-service>.up.railway.app`,
            '2. TTL: Automatic/1m',
            '3. Remove any previous CNAMEs pointing to Vercel'
          ]
        },
        dnsForApex: {
          title: `DNS for ${domain} (apex)`,
          steps: [
            'Option A (preferred): If your DNS supports ALIAS/ANAME/flattened CNAME, point apex to <your-service>.up.railway.app',
            'Option B: Use the A/AAAA records Railway shows for apex in the Domains UI',
            'Remove any previous A/ALIAS pointing to other providers'
          ]
        },
        tiktokDnsTxt: {
          title: 'TikTok DNS TXT (optional)',
          steps: [
            'If TikTok requires DNS TXT verification, add a TXT record:',
            `- Name: @ (apex)   - Value: ${expectedTxtRecord}`,
            'Wait for propagation and retry verification'
          ]
        }
      },
      verificationUrls: [
        'https://taleo.media/tiktokhMSPsJuobxNxJR1v7TF8VLrQmTrREC4v.txt',
        'https://taleo.media/tiktok-developers-site-verification.txt',
        'https://taleo.media/5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj.txt'
      ],
      nextSteps: [
        'After setting DNS, wait for propagation (can take up to 30–60 minutes)',
        'Re-verify your domain in Railway (Domains tab) until TLS shows as provisioned',
        'Then run a health check: https://taleo.media/api/health should return 200'
      ]
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 