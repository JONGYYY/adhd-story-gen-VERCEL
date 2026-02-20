'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, TrendingUp, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  views: number;
  averageViewDuration?: number;
  url: string;
}

interface TopContentTableProps {
  startDate?: string;
  endDate?: string;
}

export function TopContentTable({ startDate, endDate }: TopContentTableProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopVideos();
  }, [startDate, endDate]);

  const fetchTopVideos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/social-media/youtube/videos');
      if (response.ok) {
        const data = await response.json();
        // Sort by views and take top 10
        const sortedVideos = (data.videos || [])
          .sort((a: Video, b: Video) => b.views - a.views)
          .slice(0, 10);
        setVideos(sortedVideos);
      }
    } catch (error) {
      console.error('Failed to fetch top videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: string) => {
    // Duration is in ISO 8601 format (e.g., "PT1M30S")
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatAvgDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="card-elevo p-6">
        <h2 className="text-2xl font-bold mb-6">Your Top Content</h2>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex gap-4">
              <div className="w-40 h-24 bg-muted rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevo p-6">
      <h2 className="text-2xl font-bold mb-6">Your Top Content in This Period</h2>
      
      {videos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No videos found for this period</p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video, index) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex gap-4 p-4 rounded-xl border-2 border-border',
                'hover:border-primary hover:bg-muted/30 hover:scale-[1.01]',
                'transition-all duration-200'
              )}
            >
              {/* Rank Badge */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">#{index + 1}</span>
              </div>

              {/* Thumbnail */}
              <div className="relative flex-shrink-0 w-40 h-24 rounded-xl overflow-hidden bg-muted">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
                  {formatDuration(video.duration)}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                  {video.title}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {new Date(video.publishedAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
                
                {/* Stats */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    <span className="font-medium">{video.views.toLocaleString()}</span>
                  </div>
                  {video.averageViewDuration && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium">{formatAvgDuration(video.averageViewDuration)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* External Link Icon */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
