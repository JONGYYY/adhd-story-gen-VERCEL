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
  Target,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlatformSelector } from '@/components/analytics/PlatformSelector';
import { TimeFrameSelector, TimeFrame } from '@/components/analytics/TimeFrameSelector';
import { SocialPlatform } from '@/lib/social-media/types';

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
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('tiktok');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30d');
  const [mounted, setMounted] = useState(false);
  const [tiktokStats, setTiktokStats] = useState<any>(null);
  const [youtubeStats, setYoutubeStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [youtubeLoading, setYoutubeLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchUserStats();
    fetchTiktokStats();
    fetchYoutubeStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/user-stats');
      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

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

  const fetchYoutubeStats = async () => {
    try {
      const response = await fetch('/api/social-media/youtube/analytics');
      const data = await response.json();
      
      if (response.ok && data.success && data.channel) {
        setYoutubeStats(data.channel);
      } else if (data.reconnectRequired) {
        console.error('YouTube reconnection required:', data.error);
        // Could show a toast/alert here
      }
    } catch (error) {
      console.error('Failed to fetch YouTube stats:', error);
    } finally {
      setYoutubeLoading(false);
    }
  };

  // Platform-specific stats
  const tiktokSpecificStats = [
    {
      name: 'TikTok Followers',
      value: tiktokStats ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.follower_count) : loading ? '...' : 'N/A',
      change: 'Live',
      trend: 'up' as const,
      icon: Users,
      color: 'from-pink-500 to-cyan-500',
      bgGlow: 'group-hover:shadow-pink-500/[0.02]',
      description: 'Your TikTok account follower count',
    },
  ];

  const youtubeSpecificStats = [
    {
      name: 'Channel Views',
      value: youtubeStats ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.totalViews) : youtubeLoading ? '...' : 'N/A',
      change: youtubeStats?.last30Days?.views ? `+${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.last30Days.views)} (30d)` : 'N/A',
      trend: 'up' as const,
      icon: Eye,
      color: 'from-red-500 to-red-600',
      bgGlow: 'group-hover:shadow-red-500/[0.02]',
      description: 'Total views across all videos',
    },
    {
      name: 'Subscribers',
      value: youtubeStats 
        ? (youtubeStats.subscribersHidden 
          ? 'Hidden' 
          : (youtubeStats.subscribers !== null 
            ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.subscribers) 
            : 'Hidden'))
        : youtubeLoading ? '...' : 'N/A',
      change: youtubeStats?.last30Days && !youtubeStats.subscribersHidden 
        ? `+${youtubeStats.last30Days.subscribersGained - youtubeStats.last30Days.subscribersLost} (30d)` 
        : youtubeStats?.subscribersHidden 
        ? 'Count is private' 
        : 'N/A',
      trend: 'up' as const,
      icon: Users,
      color: 'from-orange-500 to-amber-500',
      bgGlow: 'group-hover:shadow-orange-500/[0.02]',
      description: youtubeStats?.subscribersHidden 
        ? 'Subscriber count is set to private in channel settings' 
        : 'Your YouTube channel subscribers',
    },
    {
      name: 'Watch Time (30d)',
      value: youtubeStats?.last30Days?.watchTime ? `${Math.round(youtubeStats.last30Days.watchTime / 60)}h` : youtubeLoading ? '...' : 'N/A',
      change: youtubeStats?.last30Days?.averageViewDuration ? `${Math.round(youtubeStats.last30Days.averageViewDuration / 60)}m avg` : 'N/A',
      trend: 'up' as const,
      icon: Clock,
      color: 'from-purple-500 to-pink-500',
      bgGlow: 'group-hover:shadow-purple-500/[0.02]',
      description: 'Total watch time in last 30 days',
    },
    {
      name: 'Engagement (30d)',
      value: youtubeStats?.last30Days ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.last30Days.likes + youtubeStats.last30Days.comments) : youtubeLoading ? '...' : 'N/A',
      change: youtubeStats?.last30Days?.likes ? `${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.last30Days.likes)} likes` : 'N/A',
      trend: 'up' as const,
      icon: ThumbsUp,
      color: 'from-blue-500 to-cyan-500',
      bgGlow: 'group-hover:shadow-blue-500/[0.02]',
      description: 'Likes and comments in last 30 days',
    },
  ];

  // Use YouTube video count if on YouTube platform, otherwise use Firestore count
  const videosCreated = selectedPlatform === 'youtube' && youtubeStats?.totalVideos
    ? youtubeStats.totalVideos
    : (userStats?.videosCreated || 0);
  
  const baseStats = [
    {
      name: 'Videos Created',
      value: loading ? '...' : videosCreated.toString(),
      change: videosCreated > 0 ? `${videosCreated} ${selectedPlatform === 'youtube' ? 'on YouTube' : 'total'}` : 'Create your first!',
      trend: 'up' as const,
      icon: Video,
      color: 'from-blue-500 to-cyan-500',
      bgGlow: 'group-hover:shadow-blue-500/[0.02]',
      description: selectedPlatform === 'youtube' ? 'Total videos uploaded to YouTube' : 'Total videos generated in your account',
    },
  ];

  const stats = selectedPlatform === 'youtube' 
    ? [...youtubeSpecificStats, ...baseStats]
    : [...tiktokSpecificStats, ...baseStats];

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

  // Helper function to format date labels
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Helper function to get real YouTube time-series data based on time frame
  const getYouTubeTimeSeriesData = (metric: 'views' | 'watchTime' | 'subscribersGained', timeFrame: TimeFrame) => {
    if (!youtubeStats?.timeSeries) {
      return { labels: [], data: [] };
    }

    let dataSource: any[] = [];
    
    switch (timeFrame) {
      case '7d':
        dataSource = youtubeStats.timeSeries.last7Days || [];
        break;
      case '30d':
        dataSource = youtubeStats.timeSeries.last30Days || [];
        break;
      case '90d':
        dataSource = youtubeStats.timeSeries.last90Days || [];
        break;
      case 'all':
        dataSource = youtubeStats.timeSeries.last90Days || [];
        break;
      default:
        dataSource = youtubeStats.timeSeries.last30Days || [];
    }

    if (dataSource.length === 0) {
      return { labels: [], data: [] };
    }

    const labels = dataSource.map(item => formatDateLabel(item.date));
    const data = dataSource.map(item => item[metric] || 0);

    return { labels, data };
  };

  // YouTube-specific charts with REAL data
  const viewsTimeSeriesData = getYouTubeTimeSeriesData('views', timeFrame);
  const youtubeViewsData = {
    labels: viewsTimeSeriesData.labels.length > 0 ? viewsTimeSeriesData.labels : ['No Data'],
    datasets: [
      {
        label: 'Views',
        data: viewsTimeSeriesData.data.length > 0 ? viewsTimeSeriesData.data : [0],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(239, 68, 68)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        borderWidth: 3,
      },
    ],
  };

  // YouTube Subscriber Growth Chart with REAL data
  const subscribersTimeSeriesData = getYouTubeTimeSeriesData('subscribersGained', timeFrame);
  const youtubeSubscriberGrowthData = {
    labels: subscribersTimeSeriesData.labels.length > 0 ? subscribersTimeSeriesData.labels : ['No Data'],
    datasets: [
      {
        label: 'New Subscribers',
        data: subscribersTimeSeriesData.data.length > 0 ? subscribersTimeSeriesData.data : [0],
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(249, 115, 22)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        borderWidth: 3,
      },
    ],
  };

  // YouTube Watch Time Chart with REAL data
  const watchTimeTimeSeriesData = getYouTubeTimeSeriesData('watchTime', timeFrame);
  const youtubeWatchTimeDetailedData = {
    labels: watchTimeTimeSeriesData.labels.length > 0 ? watchTimeTimeSeriesData.labels : ['No Data'],
    datasets: [
      {
        label: 'Watch Time (minutes)',
        data: watchTimeTimeSeriesData.data.length > 0 ? watchTimeTimeSeriesData.data : [0],
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        borderWidth: 3,
      },
    ],
  };

  const youtubeEngagementData = {
    labels: ['Likes', 'Comments', 'Shares'],
    datasets: [
      {
        data: [
          youtubeStats?.last30Days?.likes || 0,
          youtubeStats?.last30Days?.comments || 0,
          youtubeStats?.last30Days?.shares || 0,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(168, 85, 247)',
          'rgb(34, 197, 94)',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Use real weekly watch time data (aggregate by week from daily data)
  const getWeeklyWatchTimeData = () => {
    if (!youtubeStats?.timeSeries?.last30Days || youtubeStats.timeSeries.last30Days.length === 0) {
      return { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], data: [0, 0, 0, 0] };
    }

    const dailyData = youtubeStats.timeSeries.last30Days;
    const weeks = [0, 0, 0, 0];
    
    // Aggregate data into 4 weeks
    dailyData.forEach((day, index) => {
      const weekIndex = Math.min(Math.floor(index / 7), 3); // Max 4 weeks
      weeks[weekIndex] += (day.watchTime || 0);
    });

    return {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      data: weeks.map(minutes => Math.round(minutes / 60)), // Convert to hours
    };
  };

  const weeklyWatchTime = getWeeklyWatchTimeData();
  const youtubeWatchTimeData = {
    labels: weeklyWatchTime.labels,
    datasets: [
      {
        label: 'Watch Time (hours)',
        data: weeklyWatchTime.data,
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderColor: 'rgb(249, 115, 22)',
        borderWidth: 2,
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

  const tiktokInsights = [
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
  ];

  const youtubeInsights = [
    {
      icon: Eye,
      title: 'Channel Performance',
      description: youtubeStats?.last30Days?.views 
        ? `${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.last30Days.views)} views in the last 30 days!`
        : 'Connect YouTube to see your channel performance.',
      action: youtubeStats ? 'View Channel' : 'Connect YouTube',
      href: youtubeStats ? `https://youtube.com/channel/${youtubeStats.channelId}` : '/settings/social-media',
      color: 'from-red-500/20 to-red-600/20',
      iconColor: 'text-red-400',
    },
    {
      icon: ThumbsUp,
      title: 'Audience Engagement',
      description: youtubeStats?.last30Days 
        ? `${new Intl.NumberFormat('en-US').format(youtubeStats.last30Days.likes)} likes and ${new Intl.NumberFormat('en-US').format(youtubeStats.last30Days.comments)} comments in 30 days.`
        : 'Great engagement with your audience!',
      action: 'Create Video',
      href: '/create',
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
    },
  ];

  const insights = selectedPlatform === 'youtube' ? youtubeInsights : tiktokInsights;

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        
        <div className="container-wide relative py-12">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Performance Analytics</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-3">
                    Performance Overview
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    Track your video creation activity and performance
                  </p>
                </div>

              {/* Platform Selector */}
              <PlatformSelector
                selected={selectedPlatform}
                onSelect={setSelectedPlatform}
              />
            </div>

            {/* Time Frame Selector - Only show for YouTube */}
            {selectedPlatform === 'youtube' && (
              <div className="flex justify-center md:justify-end">
                <TimeFrameSelector
                  selected={timeFrame}
                  onSelect={setTimeFrame}
                />
              </div>
            )}
            {/* Notice Banner */}
            {selectedPlatform === 'tiktok' ? (
              <Alert className="border-primary/20 bg-primary/5">
                <AlertCircle className="h-5 w-5 text-primary" />
                <AlertDescription className="text-sm">
                  <strong className="font-semibold text-foreground">TikTok Analytics Limited</strong>
                  <br />
                  For detailed TikTok performance data (views per video, watch time, demographics), 
                  you'll need to apply for TikTok Business API access (2-4 week approval).
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
            ) : (
              <Alert className="border-green-500/20 bg-green-500/5">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <AlertDescription className="text-sm">
                  <strong className="font-semibold text-foreground">YouTube Analytics Active</strong>
                  <br />
                  Real-time data from your YouTube channel. Stats update automatically every hour.
                  {!youtubeStats && !youtubeLoading && (
                    <>
                      {' '}Please connect your YouTube account in Settings to see analytics.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>

      <div className="py-8 md:py-12">
        <div className="container-wide space-y-8">
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
              {/* Timeline Chart - Platform Specific */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      'p-2 rounded-xl bg-gradient-to-br',
                      selectedPlatform === 'youtube' 
                        ? 'from-red-500/20 to-red-600/20'
                        : 'from-pink-500/20 to-cyan-500/20'
                    )}>
                      <span className="text-2xl">{selectedPlatform === 'youtube' ? '▶️' : '🎵'}</span>
                          </div>
                          <div>
                      <h2 className="text-2xl font-bold">
                        {selectedPlatform === 'youtube' ? 'YouTube Views (30d)' : 'Video Creation Timeline'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedPlatform === 'youtube' 
                          ? 'Channel views over the past month' 
                          : 'Videos created over the past month'}
                      </p>
                          </div>
                        </div>
                      </div>
                
                <div className="h-[300px] w-full">
                  {selectedPlatform === 'youtube' ? (
                    <Line options={lineOptions} data={youtubeViewsData} />
                  ) : (
                    <Line options={lineOptions} data={timelineData} />
                  )}
                </div>
              </div>

              {/* Charts Row - Platform Specific */}
              {selectedPlatform === 'youtube' ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* YouTube Engagement */}
                  <div className="card-elevo p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-bold mb-1">Engagement Breakdown</h2>
                      <p className="text-sm text-muted-foreground">
                        Likes, comments, and shares (30d)
                      </p>
                    </div>
                    
                    <div className="h-[300px] w-full">
                      <Doughnut options={doughnutOptions} data={youtubeEngagementData} />
                    </div>
                  </div>

                  {/* YouTube Watch Time */}
                  <div className="card-elevo p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-bold mb-1">Watch Time</h2>
                      <p className="text-sm text-muted-foreground">
                        Hours watched per week (30d)
                      </p>
                    </div>
                    
                    <div className="h-[300px] w-full">
                      <Bar options={barOptions} data={youtubeWatchTimeData} />
                    </div>
                  </div>
                </div>
              ) : (
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
              )}

              {/* YouTube Additional Charts - Subscriber Growth & Watch Time */}
              {selectedPlatform === 'youtube' && (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Subscriber Growth Chart */}
                  <div className="card-elevo p-6">
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                          <Users className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">Subscriber Growth</h2>
                          <p className="text-sm text-muted-foreground">
                            {timeFrame === '7d' && 'Daily growth over 7 days'}
                            {timeFrame === '30d' && 'Weekly growth over 30 days'}
                            {timeFrame === '90d' && 'Monthly growth over 90 days'}
                            {timeFrame === 'all' && 'Monthly growth over the year'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="h-[300px] w-full">
                      <Line options={lineOptions} data={youtubeSubscriberGrowthData} />
                    </div>
                    
                    {/* Summary Stats */}
                    {youtubeStats && (
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Gained</p>
                          <p className="text-lg font-bold text-green-400">
                            +{youtubeStats.last30Days?.subscribersGained || 0}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Lost</p>
                          <p className="text-lg font-bold text-red-400">
                            -{youtubeStats.last30Days?.subscribersLost || 0}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Watch Time Chart */}
                  <div className="card-elevo p-6">
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                          <Clock className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">Watch Time Trends</h2>
                          <p className="text-sm text-muted-foreground">
                            {timeFrame === '7d' && 'Daily watch hours over 7 days'}
                            {timeFrame === '30d' && 'Weekly watch hours over 30 days'}
                            {timeFrame === '90d' && 'Monthly watch hours over 90 days'}
                            {timeFrame === 'all' && 'Monthly watch hours over the year'}
                          </p>
              </div>
            </div>
          </div>

                    <div className="h-[300px] w-full">
                      <Line options={lineOptions} data={youtubeWatchTimeDetailedData} />
                    </div>
                    
                    {/* Summary Stats */}
                    {youtubeStats?.last30Days && (
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
                          <p className="text-lg font-bold text-purple-400">
                            {Math.round(youtubeStats.last30Days.watchTime / 60)}h
                          </p>
                  </div>
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Avg Duration</p>
                          <p className="text-lg font-bold text-blue-400">
                            {Math.round(youtubeStats.last30Days.averageViewDuration / 60)}m
                          </p>
              </div>
            </div>
                    )}
                  </div>
                </div>
              )}

              {/* Platform-Specific Account Stats */}
              {selectedPlatform === 'tiktok' && tiktokStats && (
                <div className="card-elevo p-6">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-cyan-500/20">
                        <span className="text-2xl">🎵</span>
                      </div>
                      <h2 className="text-2xl font-bold">TikTok Account Stats</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Live data from your connected TikTok account
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-pink-500/30 transition-all hover:scale-105">
                      <p className="text-sm text-muted-foreground mb-1">Followers</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-cyan-500 bg-clip-text text-transparent">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.follower_count)}
                      </p>
                    </div>
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-cyan-500/30 transition-all hover:scale-105">
                      <p className="text-sm text-muted-foreground mb-1">Following</p>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.following_count)}
                      </p>
                    </div>
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-pink-500/30 transition-all hover:scale-105">
                      <p className="text-sm text-muted-foreground mb-1">Total Likes</p>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(tiktokStats.likes_count)}
                      </p>
                    </div>
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-purple-500/30 transition-all hover:scale-105">
                      <p className="text-sm text-muted-foreground mb-1">Videos</p>
                      <p className="text-2xl font-bold">
                        {tiktokStats.video_count}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedPlatform === 'youtube' && youtubeStats && (
                <div className="card-elevo p-6">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20">
                        <span className="text-2xl">▶️</span>
                      </div>
                      <h2 className="text-2xl font-bold">YouTube Channel Stats</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Real-time data from {youtubeStats.channelName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-red-500/30 transition-all hover:scale-105">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-red-400" />
                        <p className="text-sm text-muted-foreground">Subscribers</p>
                      </div>
                      <p className="text-2xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                        {youtubeStats.subscribersHidden || youtubeStats.subscribers === null 
                          ? 'Hidden' 
                          : new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.subscribers)}
                      </p>
                      {!youtubeStats.subscribersHidden && youtubeStats.last30Days?.subscribersGained > 0 && (
                        <p className="text-xs text-green-400 mt-1">
                          +{youtubeStats.last30Days.subscribersGained} (30d)
                        </p>
                      )}
                      {youtubeStats.subscribersHidden && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Set to private
                        </p>
                      )}
                    </div>
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-orange-500/30 transition-all hover:scale-105">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="w-4 h-4 text-orange-400" />
                        <p className="text-sm text-muted-foreground">Total Views</p>
                      </div>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.totalViews)}
                      </p>
                      {youtubeStats.last30Days?.views > 0 && (
                        <p className="text-xs text-green-400 mt-1">
                          +{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.last30Days.views)} (30d)
                        </p>
                      )}
                    </div>
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-blue-500/30 transition-all hover:scale-105">
                      <div className="flex items-center gap-2 mb-1">
                        <ThumbsUp className="w-4 h-4 text-blue-400" />
                        <p className="text-sm text-muted-foreground">Likes (30d)</p>
                      </div>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.last30Days?.likes || 0)}
                      </p>
                    </div>
                    <div className="group p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-purple-500/30 transition-all hover:scale-105">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-purple-400" />
                        <p className="text-sm text-muted-foreground">Comments (30d)</p>
                      </div>
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(youtubeStats.last30Days?.comments || 0)}
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
