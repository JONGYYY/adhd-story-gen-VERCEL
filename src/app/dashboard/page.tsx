'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Footer } from '@/components/layout/Footer';
import { PlatformVideos } from '@/components/dashboard/platform-videos';
import { ActiveCampaigns } from '@/components/dashboard/active-campaigns';
import { SocialPlatform } from '@/lib/social-media/types';
import { 
  Video, 
  TrendingUp, 
  Eye, 
  Clock, 
  Plus, 
  Zap, 
  Sparkles,
  Grid3x3,
  Heart,
  Users,
  ChevronRight,
  TrendingDown,
  PlayCircle,
  BarChart3,
  Rocket,
  Target,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [greeting, setGreeting] = useState('Welcome back');

  useEffect(() => {
    setMounted(true);
    
    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const stats = [
    { 
      name: 'Total Views', 
      value: '450K', 
      change: '+12.3%', 
      trend: 'up' as const, 
      icon: Eye,
      color: 'from-blue-500 to-cyan-500',
      bgGlow: 'group-hover:shadow-blue-500/20',
    },
    { 
      name: 'Engagement Rate', 
      value: '8.7%', 
      change: '+2.1%', 
      trend: 'up' as const, 
      icon: Heart,
      color: 'from-pink-500 to-rose-500',
      bgGlow: 'group-hover:shadow-pink-500/20',
    },
    { 
      name: 'Videos Created', 
      value: '24', 
      change: '+4', 
      trend: 'up' as const, 
      icon: Video,
      color: 'from-purple-500 to-pink-500',
      bgGlow: 'group-hover:shadow-purple-500/20',
    },
    { 
      name: 'Watch Time', 
      value: '1.2K', 
      change: '+18.5%', 
      trend: 'up' as const, 
      icon: Clock,
      color: 'from-orange-500 to-amber-500',
      bgGlow: 'group-hover:shadow-orange-500/20',
    },
  ];

  const quickActions = [
    {
      title: 'Single Video',
      description: 'Create one unique video',
      icon: Sparkles,
      href: '/create',
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
      badge: null,
    },
    {
      title: 'Batch Creator',
      description: 'Generate multiple videos',
      icon: Grid3x3,
      href: '/create/batch',
      color: 'from-yellow-500/20 to-orange-500/20',
      iconColor: 'text-yellow-400',
      badge: 'PRO',
    },
    {
      title: 'Auto-Pilot',
      description: 'Automated campaigns',
      icon: Zap,
      href: '/create/batch?tab=autopilot',
      color: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
      badge: 'PRO',
    },
  ];

  const trendingStories = [
    {
      id: 1,
      title: 'Found a Hidden Room Behind My Closet',
      source: 'r/nosleep',
      upvotes: '15.2K',
      engagement: 92,
      category: 'Horror',
      categoryColor: 'from-red-500/20 to-orange-500/20',
    },
    {
      id: 2,
      title: "AITA for Exposing My Sister's Wedding Lie?",
      source: 'r/AmITheAsshole',
      upvotes: '8.7K',
      engagement: 88,
      category: 'Drama',
      categoryColor: 'from-purple-500/20 to-pink-500/20',
    },
    {
      id: 3,
      title: "The Package That Wasn't Meant for Me",
      source: 'AI Generated',
      upvotes: '92% prediction',
      engagement: 85,
      category: 'Mystery',
      categoryColor: 'from-blue-500/20 to-cyan-500/20',
    },
    {
      id: 4,
      title: "My Roommate's Mysterious Night Job",
      source: 'r/TrueOffMyChest',
      upvotes: '3.2K',
      engagement: 82,
      category: 'Confession',
      categoryColor: 'from-green-500/20 to-emerald-500/20',
    }
  ];

  const platforms: SocialPlatform[] = ['youtube', 'tiktok'];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        
        <div className="container-wide relative py-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Left: Welcome */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Rocket className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Creator Dashboard</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3">
                {greeting},{' '}
                <span className="text-gradient bg-gradient-to-r from-primary via-primary/80 to-primary/60">
                  {user?.email?.split('@')[0] || 'Creator'}
                </span>
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                Track your content performance and grow your audience
              </p>
              
              {/* Quick Stats Bar */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    <span className="font-bold text-foreground">24</span>
                    <span className="text-muted-foreground ml-1">Videos</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    <span className="font-bold text-foreground">450K</span>
                    <span className="text-muted-foreground ml-1">Views</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm">
                    <span className="font-bold text-green-400">+12.3%</span>
                    <span className="text-muted-foreground ml-1">Growth</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/create">
                <Button className="btn-orange gap-2 h-12 px-6">
                  <Plus className="w-5 h-5" />
                  Create Video
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="outline" className="gap-2 h-12 px-6 hover:bg-muted">
                  <BarChart3 className="w-5 h-5" />
                  Analytics
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="section-py">
        <div className="container-wide space-y-12">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.name}
                  className={cn(
                    'group relative card-elevo p-6 transition-all duration-300',
                    'hover:scale-105 hover:shadow-2xl cursor-pointer',
                    stat.bgGlow,
                    mounted ? 'animate-in fade-in slide-in-from-bottom-4' : 'opacity-0'
                  )}
                  style={{
                    animationDelay: mounted ? `${i * 100}ms` : '0ms',
                    animationFillMode: 'forwards'
                  }}
                >
                  {/* Gradient Glow */}
                  <div className={cn(
                    'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl',
                    stat.color
                  )} />

                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      'p-3 rounded-xl bg-gradient-to-br shadow-lg',
                      stat.color
                    )}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    <div className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                      stat.trend === 'up'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    )}>
                      {stat.trend === 'up' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {stat.change}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">
                      {stat.name}
                    </p>
                    <p className="text-3xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                  </div>

                  {/* Mini Sparkline */}
                  <div className="mt-4 h-12 flex items-end gap-1 opacity-30 group-hover:opacity-50 transition-opacity">
                    {[40, 60, 45, 70, 55, 80, 65, 90].map((height, i) => (
                      <div
                        key={i}
                        className={cn('flex-1 rounded-t bg-gradient-to-t', stat.color)}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Actions Grid */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold">Quick Actions</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className={cn(
                      'group relative p-6 rounded-2xl border border-border/50 bg-gradient-to-br hover:border-primary/30 transition-all duration-300',
                      action.color,
                      'hover:scale-105 hover:shadow-xl',
                      mounted ? 'animate-in fade-in slide-in-from-bottom-4' : 'opacity-0'
                    )}
                    style={{
                      animationDelay: mounted ? `${i * 100 + 400}ms` : '0ms',
                      animationFillMode: 'forwards'
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        'p-3 rounded-xl bg-background/50 backdrop-blur-sm',
                        action.iconColor
                      )}>
                        <Icon className="w-6 h-6" />
                      </div>
                      {action.badge && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30">
                          {action.badge}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {action.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                      Get Started
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Platform Videos */}
          <div className="space-y-8">
            {platforms.map((platform) => (
              <PlatformVideos key={platform} platform={platform} />
            ))}
          </div>

          {/* Active Campaigns */}
          <ActiveCampaigns />

          {/* Trending Stories */}
          <div className="card-elevo">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Trending Stories</h2>
                  <p className="text-sm text-muted-foreground">
                    High-engagement content ready for videos
                  </p>
                </div>
              </div>
              <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trendingStories.map((story, i) => (
                <Link
                  key={story.id}
                  href="/create"
                  className={cn(
                    'group p-6 rounded-2xl bg-gradient-to-br border border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer',
                    story.categoryColor,
                    'hover:scale-105',
                    mounted ? 'animate-in fade-in slide-in-from-bottom-4' : 'opacity-0'
                  )}
                  style={{
                    animationDelay: mounted ? `${i * 100 + 600}ms` : '0ms',
                    animationFillMode: 'forwards'
                  }}
                >
                  {/* Category Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-background/50 backdrop-blur-sm border border-border/50">
                      {story.category}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        story.engagement >= 90 ? 'bg-green-400' : story.engagement >= 80 ? 'bg-yellow-400' : 'bg-orange-400'
                      )} />
                      <span className={cn(
                        'text-sm font-bold',
                        story.engagement >= 90 ? 'text-green-400' : story.engagement >= 80 ? 'text-yellow-400' : 'text-orange-400'
                      )}>
                        {story.engagement}%
                      </span>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {story.title}
                  </h3>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">{story.source}</span>
                      <span>•</span>
                      <span>{story.upvotes} upvotes</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 px-3 hover:bg-background/50"
                    >
                      <PlayCircle className="w-4 h-4 mr-1" />
                      Create
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
