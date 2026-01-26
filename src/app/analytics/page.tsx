'use client';

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Heart, 
  Clock, 
  Users,
  Target,
  Zap,
  Calendar,
  Download,
  BarChart3,
  VideoIcon,
  MessageCircle,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Analytics() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [chartData, setChartData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const now = new Date();
    let start = new Date();
    
    switch (dateRange) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, [dateRange]);

  useEffect(() => {
    if (startDate && endDate) {
      const data = generateChartData();
      setChartData(data);
    }
  }, [startDate, endDate]);

  // Generate sample data based on date range
  const generateChartData = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const labels = Array.from({ length: days }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Views',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 50000 + 10000)),
          borderColor: 'rgb(255, 107, 53)',
          backgroundColor: 'rgba(255, 107, 53, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: 'rgb(255, 107, 53)',
          pointHoverBorderColor: 'white',
          pointHoverBorderWidth: 2,
        },
        {
          label: 'Engagement',
          data: Array.from({ length: days }, () => Math.floor(Math.random() * 5000 + 1000)),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: 'rgb(99, 102, 241)',
          pointHoverBorderColor: 'white',
          pointHoverBorderWidth: 2,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          padding: 20,
          font: {
            size: 13,
            weight: '500',
          },
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleColor: 'white',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(255, 107, 53, 0.3)',
        borderWidth: 1,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: 1
              }).format(context.parsed.y);
            }
            return label;
          }
        }
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
          callback: function(value: any) {
            return new Intl.NumberFormat('en-US', {
              notation: 'compact',
              maximumFractionDigits: 1
            }).format(value);
          }
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
          maxRotation: 0,
        },
        border: {
          display: false,
        },
      },
    },
  };

  const stats = [
    {
      name: 'Total Views',
      value: '2.4M',
      change: '+21.3%',
      trend: 'up' as const,
      icon: Eye,
      color: 'from-blue-500 to-cyan-500',
      bgGlow: 'group-hover:shadow-blue-500/5',
    },
    {
      name: 'Watch Time',
      value: '82.5%',
      change: '+4.2%',
      trend: 'up' as const,
      icon: Clock,
      color: 'from-purple-500 to-pink-500',
      bgGlow: 'group-hover:shadow-purple-500/5',
    },
    {
      name: 'Engagement',
      value: '12.3%',
      change: '-2.1%',
      trend: 'down' as const,
      icon: Heart,
      color: 'from-pink-500 to-rose-500',
      bgGlow: 'group-hover:shadow-pink-500/5',
    },
    {
      name: 'Followers',
      value: '15.2K',
      change: '+8.7%',
      trend: 'up' as const,
      icon: Users,
      color: 'from-orange-500 to-amber-500',
      bgGlow: 'group-hover:shadow-orange-500/5',
    },
  ];

  const topVideos = [
    {
      id: 1,
      title: 'AITA for not attending my sister\'s wedding?',
      views: 425000,
      likes: 42500,
      comments: 1200,
      shares: 3200,
      platform: 'TikTok',
      thumbnail: '/thumbnails/video1.jpg',
      engagement: 11.2,
    },
    {
      id: 2,
      title: 'The Mysterious Package That Changed Everything',
      views: 315000,
      likes: 42800,
      comments: 980,
      shares: 2800,
      platform: 'TikTok',
      thumbnail: '/thumbnails/video2.jpg',
      engagement: 14.6,
    },
  ];

  const insights = [
    {
      icon: Target,
      title: 'Peak Performance Time',
      description: 'Your content performs best between 7-9 PM EST. Schedule future posts during this window for maximum reach.',
      action: 'Set Auto-Schedule',
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Zap,
      title: 'Content Theme Success',
      description: 'Mystery and suspense stories generate 2x more engagement than other categories.',
      action: 'View Top Themes',
      color: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
    },
    {
      icon: BarChart3,
      title: 'Viral Potential',
      description: 'Videos with dramatic reveals in the first 3 seconds have 40% higher completion rates.',
      action: 'Learn More',
      color: 'from-orange-500/20 to-amber-500/20',
      iconColor: 'text-orange-400',
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        
        <div className="container-wide relative py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Analytics Dashboard</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3">
                Performance Overview
              </h1>
              <p className="text-muted-foreground text-lg">
                Track your content performance and audience insights
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/50">
                {[
                  { label: '7 Days', value: '7d' as const },
                  { label: '30 Days', value: '30d' as const },
                  { label: '90 Days', value: '90d' as const },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateRange(option.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      dateRange === option.value
                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Export Button */}
              <Button variant="outline" className="gap-2 hidden sm:flex">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
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
                    'hover:scale-105 hover:shadow-lg',
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
                    'absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl',
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
                    <p className="text-3xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                  </div>

                  {/* Mini Sparkline Effect */}
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

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Performance Chart - Spans 2 columns */}
            <div className="lg:col-span-2 space-y-8">
              {/* Chart Card */}
              <div className="card-elevo p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Performance Trends</h2>
                    <p className="text-sm text-muted-foreground">
                      Views and engagement over time
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {startDate} - {endDate}
                    </span>
                  </div>
                </div>
                
                <div className="h-[400px] w-full">
                  {chartData && <Line options={chartOptions} data={chartData} />}
                </div>
              </div>

              {/* Top Performing Videos */}
              <div className="card-elevo p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Top Performing Videos</h2>
                    <p className="text-sm text-muted-foreground">
                      Your best content this period
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                    View All
                  </Button>
                </div>

                <div className="space-y-4">
                  {topVideos.map((video) => (
                    <div
                      key={video.id}
                      className="group relative p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all duration-300"
                    >
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <VideoIcon className="w-8 h-8 text-primary/50" />
                          </div>
                          <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-medium">
                            {video.platform}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                            {video.title}
                          </h3>
                          
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Eye className="w-3 h-3" />
                                Views
                              </div>
                              <p className="text-sm font-semibold">
                                {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(video.views)}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Heart className="w-3 h-3" />
                                Likes
                              </div>
                              <p className="text-sm font-semibold">
                                {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(video.likes)}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <MessageCircle className="w-3 h-3" />
                                Comments
                              </div>
                              <p className="text-sm font-semibold">
                                {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(video.comments)}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Share2 className="w-3 h-3" />
                                Shares
                              </div>
                              <p className="text-sm font-semibold">
                                {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(video.shares)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Engagement Badge */}
                        <div className="flex flex-col items-end justify-center">
                          <div className="text-xs text-muted-foreground mb-1">Engagement</div>
                          <div className="text-2xl font-bold text-primary">
                            {video.engagement}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-8">
              {/* Key Insights */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">Key Insights</h2>
                  <p className="text-sm text-muted-foreground">
                    AI-powered recommendations
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
                        <Button size="sm" variant="ghost" className="w-full text-xs h-8 hover:bg-background/50">
                          {insight.action}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audience Demographics */}
              <div className="card-elevo p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-1">Audience</h2>
                  <p className="text-sm text-muted-foreground">
                    Age distribution
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    { age: '18-24', percent: 45, color: 'bg-blue-500' },
                    { age: '25-34', percent: 30, color: 'bg-purple-500' },
                    { age: '35-44', percent: 15, color: 'bg-pink-500' },
                    { age: '45+', percent: 10, color: 'bg-orange-500' },
                  ].map((demo, i) => (
                    <div key={demo.age}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Age {demo.age}</span>
                        <span className="text-muted-foreground">{demo.percent}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-1000 ease-out',
                            demo.color
                          )}
                          style={{
                            width: mounted ? `${demo.percent}%` : '0%',
                            transitionDelay: `${i * 100}ms`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Audience */}
                <div className="mt-6 pt-6 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Reach</p>
                      <p className="text-2xl font-bold">524.8K</p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
