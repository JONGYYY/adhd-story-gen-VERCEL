'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import { SocialPlatform } from '@/lib/social-media/types';
import { useAuth } from '@/contexts/auth-context';
import { Grid3x3, List, Eye, Heart, Plus } from 'lucide-react';

interface PlatformStatus {
  platform: SocialPlatform;
  isConnected: boolean;
  username: string;
}

export default function Library() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | 'all'>('all');
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const platforms: SocialPlatform[] = ['youtube', 'tiktok'];

  useEffect(() => {
    async function loadPlatformStatuses() {
      if (!user) return;

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
      setIsLoading(false);
    }

    loadPlatformStatuses();
  }, [user]);

  const content = [
    {
      id: 1,
      title: 'AITA for not attending my sister\'s wedding?',
      thumbnail: '/thumbnails/video1.jpg',
      views: 125000,
      likes: 12500,
      platform: 'tiktok' as SocialPlatform,
      status: 'published',
      date: '2024-03-15',
    },
    {
      id: 2,
      title: 'The Mysterious Package That Arrived at 3 AM',
      thumbnail: '/thumbnails/video2.jpg',
      views: 75000,
      likes: 8200,
      platform: 'youtube' as SocialPlatform,
      status: 'published',
      date: '2024-03-16',
    },
  ];

  const filteredContent = content.filter(
    (item) => selectedPlatform === 'all' || item.platform === selectedPlatform
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Content Library</h1>
              <p className="text-muted-foreground">Manage and track your published videos</p>
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
                    {status?.isConnected && (
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
                          @{status.username}
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
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Plus className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
              <p className="text-muted-foreground mb-6">Create your first video to get started</p>
              <Link href="/create" className="btn-orange inline-flex">
                Create Video
              </Link>
            </div>
          ) : (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }>
              {filteredContent.map((item) => (
                <div
                  key={item.id}
                  className={`card-elevo overflow-hidden hover:border-primary/30 transition-all cursor-pointer ${
                    viewMode === 'list' ? 'flex' : ''
                  }`}
                >
                  <div className={`bg-muted ${viewMode === 'list' ? 'w-48 flex-shrink-0' : 'aspect-[9/16]'}`}>
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center">
                        <Eye className="w-8 h-8 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        item.platform === 'youtube' ? 'bg-red-500/10 text-red-400' :
                        item.platform === 'tiktok' ? 'bg-pink-500/10 text-pink-400' :
                        'bg-purple-500/10 text-purple-400'
                      }`}>
                        {item.platform}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        item.status === 'published' ? 'bg-green-500/10 text-green-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-3 line-clamp-2">{item.title}</h3>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{(item.views / 1000).toFixed(0)}K</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          <span>{(item.likes / 1000).toFixed(1)}K</span>
                        </div>
                      </div>
                      <span>{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
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
    </main>
  );
}
