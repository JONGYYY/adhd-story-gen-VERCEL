'use client';

import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import { PlatformVideos } from '@/components/dashboard/platform-videos';
import { SocialPlatform } from '@/lib/social-media/types';
import { Video, TrendingUp, Eye, Clock, Plus, Zap, ChevronDown, Grid3x3, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const stats = [
    { name: 'Total Views', value: '450K', change: '+12.3%', trend: 'up' as const, icon: Eye },
    { name: 'Engagement Rate', value: '8.7%', change: '+2.1%', trend: 'up' as const, icon: TrendingUp },
    { name: 'Videos Created', value: '24', change: '+4', trend: 'up' as const, icon: Video },
    { name: 'Auto-Pilot', value: 'Inactive', change: 'Start Now', trend: 'neutral' as const, icon: Zap, isPro: true },
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="btn-orange hidden md:inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Video
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card/98 backdrop-blur-xl border-border/50">
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-primary/10 transition-colors">
                  <Link href="/create" className="flex items-center gap-2 py-2">
                    <Sparkles className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Single Video</div>
                      <div className="text-xs text-muted-foreground">Create one video</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer hover:bg-primary/10 transition-colors">
                  <Link href="/create/batch" className="flex items-center gap-2 py-2">
                    <Grid3x3 className="w-4 h-4" />
                    <div>
                      <div className="font-medium flex items-center gap-1">
                        Batch Creator
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30">
                          PRO
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">Create multiple videos</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {stats.map((stat) => {
              const isAutoPilot = stat.name === 'Auto-Pilot';
              const CardWrapper = isAutoPilot ? Link : 'div';
              const cardProps = isAutoPilot ? { href: '/create/batch?tab=autopilot' } : {};
              
              return (
                <CardWrapper 
                  key={stat.name} 
                  className={`card-elevo ${isAutoPilot ? 'cursor-pointer hover:border-yellow-500/30 transition-all group' : ''}`}
                  {...cardProps}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isAutoPilot ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20' : 'bg-primary/10'
                    }`}>
                      <stat.icon className={`w-6 h-6 ${isAutoPilot ? 'text-yellow-400' : 'text-primary'}`} />
                    </div>
                    {!isAutoPilot ? (
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
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30">
                        PRO
                      </span>
                    )}
                  </div>
                  <div>
                    <p className={`text-3xl font-bold mb-1 ${isAutoPilot ? 'text-yellow-400' : ''}`}>{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.name}</p>
                    {isAutoPilot && (
                      <p className="text-xs text-primary mt-2 group-hover:underline">{stat.change} →</p>
                    )}
                  </div>
                </CardWrapper>
              );
            })}
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
          <div className="mt-8 md:hidden space-y-3">
            <Link href="/create" className="btn-orange w-full flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Create Single Video
            </Link>
            <Link href="/create/batch" className="btn-secondary w-full flex items-center justify-center gap-2 border border-border bg-muted/30">
              <Grid3x3 className="w-5 h-5" />
              Batch Creator
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30">
                PRO
              </span>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
