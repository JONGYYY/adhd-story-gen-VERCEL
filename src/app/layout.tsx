// This is a server component
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '@/components/theme-provider';
import { Navigation } from '@/components/Navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { ClientOnlyWithSuspense } from '@/components/client-only';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

export const metadata: Metadata = {
  title: 'Taleo Shorts AI - Generate Viral Stories with AI',
  description: 'Transform trending Reddit stories or generate original content into engaging short-form videos. Perfect for content creators looking to scale their production.',
  keywords: ['AI story generation', 'viral content', 'short-form videos', 'content creation', 'Reddit stories'],
  authors: [{ name: 'Taleo Shorts AI Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://taleo.media',
    title: 'Taleo Shorts AI - Generate Viral Stories with AI',
    description: 'Transform trending Reddit stories or generate original content into engaging short-form videos.',
    siteName: 'Taleo Shorts AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taleo Shorts AI - Generate Viral Stories with AI',
    description: 'Transform trending Reddit stories or generate original content into engaging short-form videos.',
    creator: '@storygen_ai',
  },
  other: {
    'tiktok-developers-site-verification':
      process.env.TIKTOK_DEVELOPERS_SITE_VERIFICATION ||
      process.env.TIKTOK_VERIFICATION_CODE ||
      'tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <meta
          name="tiktok-developers-site-verification"
          content={
            process.env.TIKTOK_DEVELOPERS_SITE_VERIFICATION ||
            process.env.TIKTOK_VERIFICATION_CODE ||
            'tiktok-developers-site-verification=5Kt6Vq9a21F6XcwGsCk9MrAw2mymMuFj'
          }
        />
        <meta name="google-site-verification" content="pEngX_433qIiPYTJ0dmUrX-QATENPiqtWhH2eLNUWPU" />
      </head>
      <body className={GeistSans.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ClientOnlyWithSuspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          }>
            <AuthProvider>
              <div className="relative min-h-screen flex flex-col bg-background">
                <Navigation />
                <main className="flex-1 pt-16">{children}</main>
              </div>
            </AuthProvider>
          </ClientOnlyWithSuspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
