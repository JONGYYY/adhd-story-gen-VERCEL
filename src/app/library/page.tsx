'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import { SocialPlatform } from '@/lib/social-media/types';
import { useAuth } from '@/contexts/auth-context';
import { Grid3x3, List, Clock, Plus, Video, Eye, ThumbsUp, MessageSquare, ExternalLink } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

interface PlatformStatus {
  platform: SocialPlatform;
  isConnected: boolean;
  username: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  duration: string;
  url: string;
}

export default function Library() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | 'all'>('all');
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const platforms: SocialPlatform[] = ['youtube', 'tiktok'];

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      // Load platform statuses
      const statuses = await Promise.all(
        platforms.map(async (platform) => {
          try {
            const response = await fetch(`/api/social-media/credentials?platform=${platform}`);
            if (!response.ok) {
              return {
                platform,
                isConnected: false,
                username: ''
              };
            }
            
            const data = await response.json();
            return {
              platform,
              isConnected: data.connected,
              username: data.username || ''
            };
          } catch (error) {
            console.error(`Error fetching ${platform} credentials:`, error);
            return {
              platform,
              isConnected: false,
              username: ''
            };
          }
        })
      );

      setPlatformStatuses(statuses);

      // Fetch YouTube videos if connected
      const youtubeStatus = statuses.find(s => s.platform === 'youtube');
      if (youtubeStatus?.isConnected) {
        try {
          const response = await fetch('/api/social-media/youtube/videos');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.videos) {
              setYoutubeVideos(data.videos);
            }
          }
        } catch (error) {
          console.error('Error fetching YouTube videos:', error);
          setError('Failed to load YouTube videos');
        }
      }

      setIsLoading(false);
    }

    loadData();
  }, [user]);

  // Filter content based on platform
  const filteredVideos = selectedPlatform === 'all' || selectedPlatform === 'youtube'
    ? youtubeVideos
    : [];

  // Parse ISO 8601 duration (PT1M30S) to human-readable format
  const parseDuration = (duration: string): string => {
    if (!duration) return 'N/A';
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 'N/A';
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Content Library</h1>
              <p className="text-muted-foreground">Your published videos from connected platforms</p>
            </div>
            <Link href="/create" className="btn-orange hidden md:inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Video
            </Link>
          </div>

          {/* Filters & View Toggle */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedPlatform('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedPlatform === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All Platforms
              </button>
              {platforms.map((platform) => {
                const status = platformStatuses.find(s => s.platform === platform);
                return (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedPlatform === platform
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span className="capitalize">{platform}</span>
                    {status?.isConnected && status.username && (
                      <span className="ml-1 opacity-60">
                        (@{status.username})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Platform Connection Status */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {platformStatuses
              .filter(status => selectedPlatform === 'all' || status.platform === selectedPlatform)
              .map(status => (
                <div
                  key={status.platform}
                  className={`p-6 rounded-2xl border ${
                    status.isConnected
                      ? 'bg-green-500/5 border-green-500/20'
                      : 'bg-yellow-500/5 border-yellow-500/20'
                  }`}
                >
                  {status.isConnected ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold capitalize">
                            {status.platform}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                            Connected
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {status.username ? `@${status.username}` : 'Connected'}
                        </p>
                      </div>
                      <Link
                        href="/settings/social-media"
                        className="text-sm text-primary hover:underline"
                      >
                        Manage →
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold capitalize">
                            {status.platform}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                            Not Connected
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Connect to see your videos
                        </p>
                      </div>
                      <Link
                        href="/settings/social-media"
                        className="text-sm text-primary hover:underline"
                      >
                        Connect →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your content...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Video className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Error Loading Videos</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <button onClick={() => window.location.reload()} className="btn-orange">
                Try Again
              </button>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Plus className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
              <p className="text-muted-foreground mb-6">
                {platformStatuses.find(s => s.platform === 'youtube')?.isConnected
                  ? 'Upload videos to YouTube to see them here'
                  : 'Connect your YouTube account to see your videos'}
              </p>
              <Link href={
                platformStatuses.find(s => s.platform === 'youtube')?.isConnected
                  ? '/create'
                  : '/settings/social-media'
              } className="btn-orange inline-flex">
                {platformStatuses.find(s => s.platform === 'youtube')?.isConnected
                  ? 'Create Video'
                  : 'Connect YouTube'}
              </Link>
            </div>
          ) : (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }>
              {filteredVideos.map((video) => (
                <a
                  key={video.id}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`card-elevo overflow-hidden hover:border-primary/30 transition-all cursor-pointer group ${
                    viewMode === 'list' ? 'flex' : ''
                  }`}
                >
                  <div className={`relative ${viewMode === 'list' ? 'w-48 flex-shrink-0' : 'aspect-video'}`}>
                    {video.thumbnail ? (
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Duration overlay */}
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded">
                      {parseDuration(video.duration)}
                    </div>
                    {/* External link icon */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-4 h-4 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400">
                        YouTube
                      </span>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400">
                        Published
                      </span>
                    </div>
                    <h3 className="font-semibold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(video.views)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="w-4 h-4" />
                        <span>{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(video.likes)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        <span>{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(video.comments)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(video.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Mobile CTA */}
          <Link href="/create" className="btn-orange w-full mt-8 md:hidden flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" />
            Create Video
          </Link>
        </div>
      </div>

      <Footer />
      </div>
    </AppLayout>
  );
}
