'use client';

import { SocialPlatform } from '@/lib/social-media/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { 
  ExternalLink, 
  Youtube, 
  Video as VideoIcon,
  Clock,
  ChevronRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlatformVideo {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  date: string;
  duration: string;
}

interface PlatformVideosProps {
  platform: SocialPlatform;
}

export function PlatformVideos({ platform }: PlatformVideosProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState<PlatformVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function loadPlatformData() {
      try {
        if (!user) return;

        const response = await fetch(`/api/social-media/credentials?platform=${platform}`);
        
        if (!response.ok) {
          console.error('Failed to fetch credentials');
          return;
        }

        const data = await response.json();
        setIsConnected(data.connected);
        
        if (data.connected) {
          setUsername(data.username);
          // Sample data - replace with actual API call
          setVideos([
            {
              id: '1',
              title: 'AITA for not attending my sister\'s wedding after she uninvited my partner?',
              thumbnail: '/thumbnails/video1.jpg',
              url: '#',
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              duration: '0:45',
            },
            {
              id: '2',
              title: 'The mysterious package that showed up at my door changed everything',
              thumbnail: '/thumbnails/video2.jpg',
              url: '#',
              date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              duration: '0:45',
            },
          ]);
        }
      } catch (error) {
        console.error(`Error loading ${platform} data:`, error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPlatformData();
  }, [platform, user]);

  const platformConfig = {
    youtube: {
      name: 'YouTube',
      icon: Youtube,
      color: 'from-red-500 to-rose-500',
      bgGradient: 'from-red-500/20 to-rose-500/20',
    },
    tiktok: {
      name: 'TikTok',
      icon: VideoIcon,
      color: 'from-cyan-500 to-blue-500',
      bgGradient: 'from-cyan-500/20 to-blue-500/20',
    },
  };

  const config = platformConfig[platform];
  const Icon = config.icon;

  // Loading State
  if (isLoading) {
    return (
      <div className="card-elevo">
        <div className="flex items-center gap-3 mb-6">
          <div className={cn(
            'p-2 rounded-xl bg-gradient-to-br',
            config.bgGradient
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="h-6 w-32 bg-muted rounded animate-pulse mb-1" />
            <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4 animate-pulse">
              <div className="aspect-video rounded-xl bg-muted" />
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="flex gap-4">
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-3 bg-muted rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Not Connected State
  if (!isConnected) {
    return (
      <div className="card-elevo">
        <div className="flex items-center gap-3 mb-6">
          <div className={cn(
            'p-2 rounded-xl bg-gradient-to-br',
            config.bgGradient
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold">{config.name} Videos</h2>
        </div>

        <div className="text-center py-12">
          <div className={cn(
            'w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center mx-auto mb-4',
            config.bgGradient
          )}>
            <Icon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            Connect {config.name}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Link your {config.name} account to sync videos, track analytics, and auto-publish content.
          </p>
          <Link href="/settings">
            <Button className="btn-orange gap-2">
              <Icon className="w-4 h-4" />
              Connect {config.name}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Connected State
  return (
    <div className="card-elevo">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-xl bg-gradient-to-br',
            config.bgGradient
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{config.name} Videos</h2>
            <p className="text-sm text-muted-foreground">
              Connected as <span className="font-medium text-foreground">@{username}</span>
            </p>
          </div>
        </div>
        <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
          View Analytics
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <VideoIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">No videos found</p>
          <Link href="/create">
            <Button className="btn-orange gap-2">
              Create Your First Video
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((video) => {
            const daysAgo = Math.floor((Date.now() - new Date(video.date).getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block"
              >
                <div className="relative rounded-2xl overflow-hidden bg-muted/50 border border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <VideoIcon className="w-12 h-12 text-primary/50" />
                    </div>
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                        <ExternalLink className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    {/* Duration badge */}
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/80 backdrop-blur-sm text-xs font-medium text-white">
                      {video.duration}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    
                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
