'use client';

import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import { PlatformVideos } from '@/components/dashboard/platform-videos';
import { SocialPlatform } from '@/lib/social-media/types';
import { Video, TrendingUp, Eye, Clock, Plus } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { name: 'Total Views', value: '450K', change: '+12.3%', trend: 'up' as const, icon: Eye },
    { name: 'Engagement Rate', value: '8.7%', change: '+2.1%', trend: 'up' as const, icon: TrendingUp },
    { name: 'Videos Created', value: '24', change: '+4', trend: 'up' as const, icon: Video },
    { name: 'Avg. Watch Time', value: '73%', change: '-1.2%', trend: 'down' as const, icon: Clock },
  ];

  const trendingStories = [
    {
      id: 1,
      title: 'Found a Hidden Room Behind My Closet',
      source: 'r/nosleep',
      upvotes: '15.2K upvotes',
      engagement: '92%'
    },
    {
      id: 2,
      title: "AITA for Exposing My Sister's Wedding Lie?",
      source: 'r/AmITheAsshole',
      upvotes: '8.7K upvotes',
      engagement: '88%'
    },
    {
      id: 3,
      title: "The Package That Wasn't Meant for Me",
      source: 'AI Generated',
      upvotes: '92% prediction',
      engagement: '85%'
    },
    {
      id: 4,
      title: "My Roommate's Mysterious Night Job",
      source: 'r/TrueOffMyChest',
      upvotes: '3.2K upvotes',
      engagement: '82%'
    }
  ];

  const platforms: SocialPlatform[] = ['youtube', 'tiktok'];

  return (
    <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Dashboard</h1>
              <p className="text-muted-foreground">Welcome back! Here's your content performance overview.</p>
            </div>
            <Link href="/create" className="btn-orange hidden md:inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Video
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {stats.map((stat) => (
              <div key={stat.name} className="card-elevo">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      stat.trend === 'up'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {stat.change}
                    {stat.trend === 'up' ? '↑' : '↓'}
                  </span>
                </div>
                <div>
                  <p className="text-3xl font-bold mb-1">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Platform Videos */}
          <div className="space-y-8 mb-12">
            {platforms.map((platform) => (
              <PlatformVideos key={platform} platform={platform} />
            ))}
          </div>

          {/* Trending Stories */}
          <div className="card-elevo">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold mb-1">Trending Stories</h2>
                <p className="text-sm text-muted-foreground">High-engagement stories ready to turn into videos</p>
              </div>
              <Link href="/stories" className="text-primary hover:underline text-sm font-medium">
                View All →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trendingStories.map((story) => (
                <div
                  key={story.id}
                  className="p-6 rounded-2xl bg-muted/50 border border-border hover:border-primary/30 transition-all cursor-pointer group"
                >
                  <h3 className="font-semibold mb-3 group-hover:text-primary transition-colors">
                    {story.title}
                  </h3>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">{story.source}</span>
                      <span>•</span>
                      <span>{story.upvotes}</span>
                    </div>
                    <span className="text-green-400 font-semibold">{story.engagement}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile CTA */}
          <Link href="/create" className="btn-orange w-full mt-8 md:hidden flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" />
            Create Video
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
