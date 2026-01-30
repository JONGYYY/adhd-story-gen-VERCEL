'use client';

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, 
  TrendingDown, 
  Video, 
  CheckCircle2, 
  Clock, 
  Users,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Zap,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Analytics() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [mounted, setMounted] = useState(false);
  const [tiktokStats, setTiktokStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchTiktokStats();
  }, []);

  const fetchTiktokStats = async () => {
    try {
      const response = await fetch('/api/social-media/tiktok/stats');
      if (response.ok) {
        const data = await response.json();
        setTiktokStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch TikTok stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // TODO: Replace with real Firestore data
  const appStats = {
    videosCreated: 24,
    videosCreatedChange: '+4',
    uploadSuccessRate: 95,
    uploadSuccessRateChange: '+2.1%',
    avgGenerationTime: 45,
    avgGenerationTimeChange: '-3s',
  };

  const stats = [
    {
      name: 'Videos Created',
      value: appStats.videosCreated.toString(),
      change: appStats.videosCreatedChange,
      trend: 'up' as const,
      icon: Video,
      color: 'from-blue-500 to-cyan-500',
      bgGlow: 'group-hover:shadow-blue-500/[0.02]',
      description: 'Total videos generated in your account',
    },
    {
      name: 'Upload Success Rate',
      value: `${appStats.uploadSuccessRate}%`,
      change: appStats.uploadSuccessRateChange,
      trend: 'up' as const,
      icon: CheckCircle2,
      color: 'from-green-500 to-emerald-500',
      bgGlow: 'group-hover:shadow-green-500/[0.02]',
      description: 'Successful uploads to social platforms',
    },
    {
      name: 'Avg Generation Time',
      value: `${appStats.avgGenerationTime}s`,
      change: appStats.avgGenerationTimeChange,
      trend: 'up' as const,
      icon: Clock,
      color: 'from-purple-500 to-pink-500',
      bgGlow: 'group-hover:shadow-purple-500/[0.02]',
      description: 'Average time to create a video',
    },
    {
      name: 'TikTok Followers',
      value: tiktokStats ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.follower_count) : loading ? '...' : 'N/A',
      change: 'Live',
      trend: 'up' as const,
      icon: Users,
      color: 'from-orange-500 to-amber-500',
      bgGlow: 'group-hover:shadow-orange-500/[0.02]',
      description: 'Your TikTok account follower count',
    },
  ];

  // Subreddit distribution chart data
  const subredditData = {
    labels: ['r/AITA', 'r/nosleep', 'r/relationships', 'r/TIFU', 'r/ProRevenge', 'Other'],
    datasets: [
      {
        data: [30, 25, 15, 12, 10, 8],
        backgroundColor: [
          'rgba(255, 107, 53, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderColor: [
          'rgb(255, 107, 53)',
          'rgb(139, 92, 246)',
          'rgb(236, 72, 153)',
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(156, 163, 175)',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Voice usage chart data
  const voiceData = {
    labels: ['Brian', 'Adam', 'Sarah', 'Laura', 'Rachel', 'Antoni'],
    datasets: [
      {
        label: 'Videos Created',
        data: [8, 6, 4, 3, 2, 1],
        backgroundColor: 'rgba(255, 107, 53, 0.8)',
        borderColor: 'rgb(255, 107, 53)',
        borderWidth: 2,
      },
    ],
  };

  // Creation timeline chart data
  const timelineData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Videos Created',
        data: [5, 7, 6, 6],
        borderColor: 'rgb(255, 107, 53)',
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgb(255, 107, 53)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          padding: 15,
          font: {
            size: 12,
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: 'white',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(255, 107, 53, 0.3)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} videos (${percentage}%)`;
          }
        }
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: 'white',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(255, 107, 53, 0.3)',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: {
            size: 12,
          },
          stepSize: 2,
        },
        border: {
          display: false,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: {
            size: 12,
          },
        },
        border: {
          display: false,
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: 'white',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(255, 107, 53, 0.3)',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: {
            size: 12,
          },
          stepSize: 2,
        },
        border: {
          display: false,
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: {
            size: 12,
          },
        },
        border: {
          display: false,
        },
      },
    },
  };

  const insights = [
    {
      icon: Target,
      title: 'Most Popular Content',
      description: 'AITA (Am I The Asshole) stories generate the most videos in your account.',
      action: 'Create AITA Video',
      href: '/create?subreddit=r/AITA',
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Zap,
      title: 'Fastest Voice',
      description: 'Brian voice has the fastest average generation time at 42 seconds.',
      action: 'Use Brian Voice',
      href: '/create?voice=brian',
      color: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
    },
    {
      icon: Sparkles,
      title: 'Upload Success',
      description: `Your upload success rate is ${appStats.uploadSuccessRate}%. Great job maintaining quality!`,
      action: 'View Library',
      href: '/library',
      color: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-400',
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        
        <div className="container-wide relative py-12">
          <div className="flex flex-col gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">App Analytics</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3">
                Performance Overview
              </h1>
              <p className="text-muted-foreground text-lg">
                Track your video creation activity and performance
              </p>
            </div>

            {/* Notice Banner */}
            <Alert className="border-primary/20 bg-primary/5">
              <AlertCircle className="h-5 w-5 text-primary" />
              <AlertDescription className="text-sm">
                <strong className="font-semibold text-foreground">Showing App Analytics</strong>
                <br />
                These metrics track your video creation activity. For detailed TikTok performance data 
                (views per video, watch time, demographics), you'll need to apply for TikTok Business API access.
                <Button
                  variant="link"
                  className="h-auto p-0 ml-2 text-primary hover:text-primary/80"
                  asChild
                >
                  <a 
                    href="https://developers.tiktok.com/products/business-api/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1"
                  >
                    Learn More <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>

      <div className="section-py">
        <div className="container-wide space-y-12">
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.name}
                  className={cn(
                    'group relative card-elevo p-6 transition-all duration-300',
                    'hover:scale-105 hover:shadow-md',
                    stat.bgGlow,
                    mounted ? 'animate-in fade-in slide-in-from-bottom-4' : 'opacity-0'
                  )}
                  style={{
                    animationDelay: mounted ? `${i * 100}ms` : '0ms',
                    animationFillMode: 'forwards'
                  }}
                >
                  {/* Gradient Border Effect */}
                  <div className={cn(
                    'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 -z-10 blur-xl',
                    stat.color
                  )} />

                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      'p-3 rounded-xl bg-gradient-to-br',
                      stat.color,
                      'shadow-lg'
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
                    <p className="text-3xl font-bold tracking-tight mb-2">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {stat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Charts */}
            <div className="lg:col-span-2 space-y-8">
              {/* Creation Timeline */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">Video Creation Timeline</h2>
                  <p className="text-sm text-muted-foreground">
                    Videos created over the past month
                  </p>
                </div>
                
                <div className="h-[300px] w-full">
                  <Line options={lineOptions} data={timelineData} />
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Subreddit Distribution */}
                <div className="card-elevo p-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold mb-1">Content Distribution</h2>
                    <p className="text-sm text-muted-foreground">
                      Videos by subreddit
                    </p>
                  </div>
                  
                  <div className="h-[300px] w-full">
                    <Doughnut options={doughnutOptions} data={subredditData} />
                  </div>
                </div>

                {/* Voice Usage */}
                <div className="card-elevo p-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold mb-1">Voice Usage</h2>
                    <p className="text-sm text-muted-foreground">
                      Videos by voice actor
                    </p>
                  </div>
                  
                  <div className="h-[300px] w-full">
                    <Bar options={barOptions} data={voiceData} />
                  </div>
                </div>
              </div>

              {/* TikTok Account Stats (if connected) */}
              {tiktokStats && (
                <div className="card-elevo p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-1">TikTok Account Stats</h2>
                    <p className="text-sm text-muted-foreground">
                      Live data from your connected TikTok account
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-sm text-muted-foreground mb-1">Followers</p>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.follower_count)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-sm text-muted-foreground mb-1">Following</p>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.following_count)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-sm text-muted-foreground mb-1">Total Likes</p>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.likes_count)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-sm text-muted-foreground mb-1">Videos</p>
                      <p className="text-2xl font-bold">
                        {tiktokStats.video_count}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-8">
              {/* Key Insights */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">Key Insights</h2>
                  <p className="text-sm text-muted-foreground">
                    Recommendations based on your activity
                  </p>
                </div>

                <div className="space-y-4">
                  {insights.map((insight, i) => {
                    const Icon = insight.icon;
                    return (
                      <div
                        key={i}
                        className={cn(
                          'relative p-4 rounded-xl border border-border/50 bg-gradient-to-br',
                          insight.color,
                          'hover:scale-105 transition-transform duration-300'
                        )}
                      >
                        <div className="flex gap-3 mb-3">
                          <div className={cn(
                            'p-2 rounded-lg bg-background/50 backdrop-blur-sm',
                            insight.iconColor
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm mb-1">
                              {insight.title}
                            </h3>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {insight.description}
                        </p>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="w-full text-xs h-8 hover:bg-background/50"
                          asChild
                        >
                          <a href={insight.href}>
                            {insight.action}
                          </a>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
