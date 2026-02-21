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
import { AppLayout } from '@/components/layout/AppLayout';
import { TimeFrameExpander, TimeFrameOption } from '@/components/analytics/TimeFrameExpander';
import { ComparisonDatePicker } from '@/components/analytics/ComparisonDatePicker';
import { LayoutToggle, LayoutMode } from '@/components/analytics/LayoutToggle';
import { MiniMetricCard } from '@/components/analytics/MiniMetricCard';
import { TopContentTable } from '@/components/analytics/TopContentTable';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

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

// Video markers plugin will be registered per-chart

export default function Analytics() {
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('tiktok');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30d');
  const [mounted, setMounted] = useState(false);
  const [tiktokStats, setTiktokStats] = useState<any>(null);
  const [youtubeStats, setYoutubeStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [youtubeLoading, setYoutubeLoading] = useState(true);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  
  // New state for redesigned analytics
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'watchTime' | 'engagement' | 'subscribers'>('views');
  const [customTimeFrame, setCustomTimeFrame] = useState<TimeFrameOption>('1month');
  const [comparisonStartDate, setComparisonStartDate] = useState<string>('');
  const [comparisonEndDate, setComparisonEndDate] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    fetchUserStats();
    fetchTiktokStats();
    fetchYoutubeStats();
    fetchYoutubeVideos();
  }, []);

  const fetchYoutubeVideos = async () => {
    try {
      const response = await fetch('/api/social-media/youtube/videos');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.videos) {
          setYoutubeVideos(data.videos);
        }
      }
    } catch (error) {
      console.error('Failed to fetch YouTube videos:', error);
    }
  };

  // Map custom time frame to internal time frame
  useEffect(() => {
    const timeFrameMap: Record<TimeFrameOption, TimeFrame> = {
      'today': '7d',
      '1week': '7d',
      '1month': '30d',
      '1year': 'all',
    };
    setTimeFrame(timeFrameMap[customTimeFrame]);
  }, [customTimeFrame]);

  // Refetch data when time frame changes
  useEffect(() => {
    if (mounted) {
      fetchYoutubeStats();
    }
  }, [timeFrame]);

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

  // Helper function to calculate growth percentage from time series data
  const calculateGrowth = (timeSeriesData: any[], metricExtractor: (item: any) => number): number => {
    if (!timeSeriesData || timeSeriesData.length < 2) return 0;
    
    const halfPoint = Math.floor(timeSeriesData.length / 2);
    const firstHalf = timeSeriesData.slice(0, halfPoint);
    const secondHalf = timeSeriesData.slice(halfPoint);
    
    const firstHalfTotal = firstHalf.reduce((sum, item) => sum + metricExtractor(item), 0);
    const secondHalfTotal = secondHalf.reduce((sum, item) => sum + metricExtractor(item), 0);
    
    if (firstHalfTotal === 0) return secondHalfTotal > 0 ? 100 : 0;
    
    const growth = ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100;
    return Math.round(growth * 10) / 10; // Round to 1 decimal place
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

  // YouTube Subscriber Growth Chart with REAL data (OLD - kept for compatibility)
  const subscribersGainedData = getYouTubeTimeSeriesData('subscribersGained', timeFrame);
  const youtubeSubscriberGrowthData = {
    labels: subscribersGainedData.labels.length > 0 ? subscribersGainedData.labels : ['No Data'],
    datasets: [
      {
        label: 'New Subscribers',
        data: subscribersGainedData.data.length > 0 ? subscribersGainedData.data : [0],
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

  // Engagement time series (line chart for large view)
  const getEngagementTimeSeries = () => {
    if (!youtubeStats?.timeSeries?.[timeFrame]) {
      return { labels: [], data: [] };
    }

    const dataSource = youtubeStats.timeSeries[timeFrame];
    const labels = dataSource.map((item: any) => formatDateLabel(item.date));
    const data = dataSource.map((item: any) => (item.likes || 0) + (item.comments || 0) + (item.shares || 0));

    return { labels, data };
  };

  const engagementTimeSeriesData = getEngagementTimeSeries();
  const youtubeEngagementTimeSeriesData = {
    labels: engagementTimeSeriesData.labels.length > 0 ? engagementTimeSeriesData.labels : ['No Data'],
    datasets: [
      {
        label: 'Total Engagement',
        data: engagementTimeSeriesData.data.length > 0 ? engagementTimeSeriesData.data : [0],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(16, 185, 129)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        borderWidth: 3,
      },
    ],
  };

  // Engagement breakdown (doughnut chart)
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

  // Subscriber time series
  const getSubscribersTimeSeries = () => {
    if (!youtubeStats?.timeSeries?.[timeFrame]) {
      return { labels: [], data: [] };
    }

    const dataSource = youtubeStats.timeSeries[timeFrame];
    const labels = dataSource.map((item: any) => formatDateLabel(item.date));
    const data = dataSource.map((item: any) => (item.subscribersGained || 0) - (item.subscribersLost || 0));

    return { labels, data };
  };

  const subscribersTimeSeriesData = getSubscribersTimeSeries();
  const youtubeSubscribersTimeSeriesData = {
    labels: subscribersTimeSeriesData.labels.length > 0 ? subscribersTimeSeriesData.labels : ['No Data'],
    datasets: [
      {
        label: 'Net Subscribers',
        data: subscribersTimeSeriesData.data.length > 0 ? subscribersTimeSeriesData.data : [0],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        borderWidth: 3,
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
    dailyData.forEach((day: any, index: number) => {
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

  // Helper function to count videos posted on each day in the time series
  const getVideoPostCounts = () => {
    if (!youtubeVideos || !youtubeStats?.timeSeries?.[timeFrame]) {
      return {};
    }

    const counts: Record<string, number> = {};
    const timeSeriesLabels = youtubeStats.timeSeries[timeFrame].map((d: any) => formatDateLabel(d.date));

    youtubeVideos.forEach((video: any) => {
      const publishDate = new Date(video.publishedAt);
      const label = formatDateLabel(publishDate.toISOString());
      if (timeSeriesLabels.includes(label)) {
        counts[label] = (counts[label] || 0) + 1;
      }
    });

    return counts;
  };

  const videoPostCounts = getVideoPostCounts();

  // Chart.js plugin to draw video post markers
  const videoMarkersPlugin = {
    id: 'videoMarkers',
    afterDatasetsDraw(chart: any) {
      const { ctx, scales: { x, y }, chartArea: { bottom } } = chart;
      const labels = chart.data.labels || [];

      ctx.save();
      labels.forEach((label: string, index: number) => {
        const count = videoPostCounts[label];
        if (count && count > 0) {
          const xPos = x.getPixelForValue(index);
          const yPos = bottom + 25;

          // Draw circle marker
          ctx.beginPath();
          ctx.arc(xPos, yPos, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#EF4444';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw count text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(count.toString(), xPos, yPos);
        }
      });
      ctx.restore();
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
      videoMarkers: true,
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
    layout: {
      padding: {
        bottom: 40,
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
    <AppLayout>
      <div>
      {/* Redesigned Header */}
      <div className="border-b border-border/50 bg-background">
        <div className="container-wide py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left: Title + Channel Button */}
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-4xl font-bold">Analytics</h1>
              
              {/* Channel Link Button - Conditional */}
              {selectedPlatform === 'youtube' && youtubeStats?.channelId && (
                <Button
                  asChild
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 shadow-lg shadow-red-500/20"
                >
                  <Link 
                    href={`https://youtube.com/channel/${youtubeStats.channelId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    YouTube {youtubeStats.channelTitle ? `(${youtubeStats.channelTitle})` : ''}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </Button>
              )}
              
              {selectedPlatform === 'tiktok' && tiktokStats?.username && (
                <Button
                  asChild
                  className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:from-pink-600 hover:via-purple-600 hover:to-cyan-600 text-white border-0 shadow-lg"
                >
                  <Link 
                    href={`https://tiktok.com/@${tiktokStats.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    TikTok (@{tiktokStats.username})
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </Button>
              )}
            </div>

            {/* Right: Platform Selector */}
            <PlatformSelector
              selected={selectedPlatform}
              onSelect={setSelectedPlatform}
            />
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container-wide py-8">
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

          {/* Main Metrics Bar - Skeleton Loading */}
          {selectedPlatform === 'youtube' && youtubeLoading && (
            <div className="mt-8 flex gap-4 overflow-x-auto">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card-elevo p-6 min-w-[220px] flex-1">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <div className="flex items-end justify-between gap-4">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-16 flex-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Main Metrics Bar - 5 Mini Cards in Horizontal Row (Overview Only) */}
          {selectedPlatform === 'youtube' && youtubeStats && (
            <div className="mt-8 flex gap-4 overflow-x-auto">
              <MiniMetricCard
                title="Total Views"
                value={youtubeStats.totalViews?.toLocaleString() || '0'}
                data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => d.views || 0) || Array(30).fill(0)}
                growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => d.views || 0)}
                color="#EF4444"
                icon={Eye}
              />
              
              <MiniMetricCard
                title="Watch Time"
                value={`${Math.round((youtubeStats.last30Days?.watchTime || 0) / 60)}h`}
                data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => (d.watchTime || 0) / 60) || Array(30).fill(0)}
                growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => d.watchTime || 0)}
                color="#A855F7"
                icon={Clock}
              />
              
              <MiniMetricCard
                title="Engagement"
                value={((youtubeStats.last30Days?.likes || 0) + (youtubeStats.last30Days?.comments || 0)).toLocaleString()}
                data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => (d.likes || 0) + (d.comments || 0)) || Array(30).fill(0)}
                growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => (d.likes || 0) + (d.comments || 0) + (d.shares || 0))}
                color="#10B981"
                icon={ThumbsUp}
              />
              
              <MiniMetricCard
                title="Subscribers"
                value={youtubeStats.subscribers?.toLocaleString() || '0'}
                data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => (d.subscribersGained || 0) - (d.subscribersLost || 0)) || Array(30).fill(0)}
                growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => (d.subscribersGained || 0) - (d.subscribersLost || 0))}
                color="#3B82F6"
                icon={Users}
              />
              
              <MiniMetricCard
                title="Videos Posted"
                value={youtubeStats.totalVideos?.toString() || '0'}
                data={Array(30).fill(0)}
                growth={0}
                color="#FF7847"
                icon={Video}
              />
            </div>
          )}

          {/* TikTok metrics bar placeholder - to be implemented later */}
          {selectedPlatform === 'tiktok' && tiktokStats && (
            <div className="mt-8 card-elevo p-6 text-center text-muted-foreground">
              <p>TikTok metrics visualization coming soon</p>
            </div>
          )}

          {/* Time Controls & Layout Toggle - Only for YouTube */}
          {selectedPlatform === 'youtube' && youtubeStats && (
            <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left: Time Controls */}
              <div className="flex items-center gap-3">
                <TimeFrameExpander
                  selected={customTimeFrame}
                  onSelect={setCustomTimeFrame}
                />
                <ComparisonDatePicker
                  startDate={comparisonStartDate}
                  endDate={comparisonEndDate}
                  onDatesChange={(start, end) => {
                    setComparisonStartDate(start);
                    setComparisonEndDate(end);
                  }}
                  onClear={() => {
                    setComparisonStartDate('');
                    setComparisonEndDate('');
                  }}
                />
              </div>

              {/* Right: Layout Toggle */}
              <LayoutToggle
                selected={layoutMode}
                onSelect={setLayoutMode}
              />
            </div>
          )}

          {/* Single View Layout - Mini Metrics + Main Graph */}
          {selectedPlatform === 'youtube' && youtubeLoading && layoutMode === 'single' && (
            <div className="mt-8 space-y-6">
              {/* Skeleton Mini Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card-elevo p-6">
                    <Skeleton className="h-4 w-24 mb-4" />
                    <div className="flex items-end justify-between gap-4">
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-16 flex-1" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Skeleton Main Graph */}
              <div className="card-elevo p-6">
                <Skeleton className="h-7 w-48 mb-2" />
                <Skeleton className="h-4 w-64 mb-6" />
                <Skeleton className="h-[300px] w-full" />
              </div>
              
              {/* Skeleton Top Content */}
              <div className="card-elevo p-6">
                <Skeleton className="h-7 w-56 mb-6" />
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                      <Skeleton className="w-40 h-24 rounded-xl flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {selectedPlatform === 'youtube' && youtubeStats && layoutMode === 'single' && (
            <div className="mt-8 space-y-6">
              {/* Mini Metric Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MiniMetricCard
                  title="Views"
                  value={youtubeStats.last30Days?.views?.toLocaleString() || '0'}
                  data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => d.views || 0) || Array(30).fill(0)}
                  growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => d.views || 0)}
                  isSelected={selectedMetric === 'views'}
                  onClick={() => setSelectedMetric('views')}
                  color="#EF4444"
                />

                <MiniMetricCard
                  title="Watch Time"
                  value={`${Math.round((youtubeStats.last30Days?.watchTime || 0) / 60)}h`}
                  data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => (d.watchTime || 0) / 60) || Array(30).fill(0)}
                  growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => d.watchTime || 0)}
                  isSelected={selectedMetric === 'watchTime'}
                  onClick={() => setSelectedMetric('watchTime')}
                  color="#A855F7"
                />

                <MiniMetricCard
                  title="Engagement"
                  value={((youtubeStats.last30Days?.likes || 0) + (youtubeStats.last30Days?.comments || 0) + (youtubeStats.last30Days?.shares || 0)).toLocaleString()}
                  data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => (d.likes || 0) + (d.comments || 0) + (d.shares || 0)) || Array(30).fill(0)}
                  growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => (d.likes || 0) + (d.comments || 0) + (d.shares || 0))}
                  isSelected={selectedMetric === 'engagement'}
                  onClick={() => setSelectedMetric('engagement')}
                  color="#10B981"
                />

                <MiniMetricCard
                  title="Subscribers"
                  value={((youtubeStats.last30Days?.subscribersGained || 0) - (youtubeStats.last30Days?.subscribersLost || 0)).toLocaleString()}
                  data={youtubeStats.timeSeries?.[timeFrame]?.map((d: any) => (d.subscribersGained || 0) - (d.subscribersLost || 0)) || Array(30).fill(0)}
                  growth={calculateGrowth(youtubeStats.timeSeries?.[timeFrame] || [], (d) => (d.subscribersGained || 0) - (d.subscribersLost || 0))}
                  isSelected={selectedMetric === 'subscribers'}
                  onClick={() => setSelectedMetric('subscribers')}
                  color="#3B82F6"
                />
              </div>

              {/* Main Graph with existing views chart */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">
                    {selectedMetric === 'views' && 'Views Trend'}
                    {selectedMetric === 'watchTime' && 'Watch Time Trend'}
                    {selectedMetric === 'engagement' && 'Engagement Trend'}
                    {selectedMetric === 'subscribers' && 'Subscriber Growth'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedMetric === 'views' && 'Channel views over the selected period'}
                    {selectedMetric === 'watchTime' && 'Total watch hours over the selected period'}
                    {selectedMetric === 'engagement' && 'Likes and comments over the selected period'}
                    {selectedMetric === 'subscribers' && 'Net subscriber growth over the selected period'}
                  </p>
                </div>
                
                <div className="h-[300px] w-full">
                  {selectedMetric === 'views' && <Line options={lineOptions} data={youtubeViewsData} plugins={[videoMarkersPlugin]} />}
                  {selectedMetric === 'watchTime' && <Line options={lineOptions} data={youtubeWatchTimeDetailedData} plugins={[videoMarkersPlugin]} />}
                  {selectedMetric === 'engagement' && <Line options={lineOptions} data={youtubeEngagementTimeSeriesData} plugins={[videoMarkersPlugin]} />}
                  {selectedMetric === 'subscribers' && <Line options={lineOptions} data={youtubeSubscribersTimeSeriesData} plugins={[videoMarkersPlugin]} />}
                </div>
              </div>

              {/* Top Content Table */}
              <TopContentTable
                startDate={comparisonStartDate}
                endDate={comparisonEndDate}
              />
            </div>
          )}

          {/* Large View Layout - Skeleton */}
          {selectedPlatform === 'youtube' && youtubeLoading && layoutMode === 'large' && (
            <div className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card-elevo p-6">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-4" />
                    <Skeleton className="h-[250px] w-full" />
                  </div>
                ))}
              </div>
              
              {/* Skeleton Top Content */}
              <div className="card-elevo p-6">
                <Skeleton className="h-7 w-56 mb-6" />
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                      <Skeleton className="w-40 h-24 rounded-xl flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Large View Layout - 4 Equal Graphs in 2x2 Grid */}
          {selectedPlatform === 'youtube' && youtubeStats && layoutMode === 'large' && (
            <div className="mt-8">
              {/* 2x2 Grid of Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Top Left: Views */}
                <div className="card-elevo p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="w-5 h-5 text-red-400" />
                      <h2 className="text-xl font-bold">Views</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Channel views over the selected period
                    </p>
                  </div>
                  <div className="h-[250px] w-full">
                    <Line options={lineOptions} data={youtubeViewsData} plugins={[videoMarkersPlugin]} />
                  </div>
                </div>

                {/* Top Right: Watch Time */}
                <div className="card-elevo p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-5 h-5 text-purple-400" />
                      <h2 className="text-xl font-bold">Watch Time</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total watch time in minutes
                    </p>
                  </div>
                  <div className="h-[250px] w-full">
                    <Line options={lineOptions} data={youtubeWatchTimeDetailedData} plugins={[videoMarkersPlugin]} />
                  </div>
                </div>

                {/* Bottom Left: Engagement */}
                <div className="card-elevo p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ThumbsUp className="w-5 h-5 text-green-400" />
                      <h2 className="text-xl font-bold">Engagement</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total likes, comments, and shares over time
                    </p>
                  </div>
                  <div className="h-[250px] w-full">
                    <Line options={lineOptions} data={youtubeEngagementTimeSeriesData} plugins={[videoMarkersPlugin]} />
                  </div>
                </div>

                {/* Bottom Right: Subscribers */}
                <div className="card-elevo p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-blue-400" />
                      <h2 className="text-xl font-bold">Subscribers</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Net subscriber growth over time
                    </p>
                  </div>
                  <div className="h-[250px] w-full">
                    <Line options={lineOptions} data={youtubeSubscribersTimeSeriesData} plugins={[videoMarkersPlugin]} />
                  </div>
                </div>
              </div>

              {/* Top Content Table Below Graphs */}
              <TopContentTable
                startDate={comparisonStartDate}
                endDate={comparisonEndDate}
              />
            </div>
          )}

          {/* TikTok View - Always show old charts */}
          {selectedPlatform === 'tiktok' && (
            <div className="mt-8">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column - Charts */}
                <div className="lg:col-span-2 space-y-8">
              {/* Timeline Chart - TikTok */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-cyan-500/20">
                      <span className="text-2xl">🎵</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Video Creation Timeline</h2>
                      <p className="text-sm text-muted-foreground">
                        Videos created over the past month
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="h-[300px] w-full">
                  <Line options={lineOptions} data={timelineData} />
                </div>
              </div>

              {/* Charts Row - TikTok */}
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

              {/* TikTok Additional Charts placeholder */}
              {false && (
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

              {/* YouTube Channel Stats */}
              {youtubeStats && (
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
          )}

          {/* TikTok View - Always show old charts */}
          {selectedPlatform === 'tiktok' && (
            <div className="mt-8">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column - Charts */}
                <div className="lg:col-span-2 space-y-8">
              {/* Timeline Chart */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-cyan-500/20">
                      <span className="text-2xl">🎵</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Video Creation Timeline</h2>
                      <p className="text-sm text-muted-foreground">
                        Videos created over the past month
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="h-[300px] w-full">
                  <Line options={lineOptions} data={timelineData} />
                </div>
              </div>

              {/* Additional TikTok charts placeholder */}
              <div className="card-elevo p-6">
                <p className="text-center text-muted-foreground py-12">
                  Additional TikTok analytics charts coming soon
                </p>
                  </div>
                </div>

                {/* Right Column - Stats */}
                <div className="space-y-6">
                  <div className="card-elevo p-6">
                    <h2 className="text-xl font-bold mb-4">Quick Stats</h2>
                    <p className="text-sm text-muted-foreground">
                      TikTok stats overview
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
} 
