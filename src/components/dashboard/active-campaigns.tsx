'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, Clock, Pause, Play, Edit, Trash2 } from 'lucide-react';
import { CampaignConfig } from '@/lib/campaigns/types';
import { Button } from '@/components/ui/button';

export function ActiveCampaigns() {
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'paused' }),
      });

      if (response.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Failed to pause campaign:', error);
    }
  };

  const handleResume = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });

      if (response.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Failed to resume campaign:', error);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  if (loading) {
    return (
      <div className="card-elevo">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-6 h-6 text-yellow-400" />
          <h2 className="text-2xl font-bold">Active Auto-Pilot Campaigns</h2>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          Loading campaigns...
        </div>
      </div>
    );
  }

  if (activeCampaigns.length === 0) {
    return (
      <div className="card-elevo">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-bold">Active Auto-Pilot Campaigns</h2>
          </div>
          <Link 
            href="/create/batch?tab=autopilot"
            className="text-primary hover:underline text-sm font-medium"
          >
            Create Campaign →
          </Link>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-muted-foreground">No active campaigns yet</p>
          <Link 
            href="/create/batch?tab=autopilot"
            className="inline-block mt-4 text-primary hover:underline text-sm"
          >
            Set up your first auto-pilot campaign
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevo">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-400" />
          <h2 className="text-2xl font-bold">Active Auto-Pilot Campaigns</h2>
        </div>
        <Link 
          href="/create/batch?tab=autopilot"
          className="text-primary hover:underline text-sm font-medium"
        >
          Create New →
        </Link>
      </div>

      <div className="space-y-4">
        {activeCampaigns.map((campaign) => {
          const nextRun = campaign.nextRunAt ? new Date(campaign.nextRunAt) : null;
          const timeUntilNext = nextRun ? nextRun.getTime() - Date.now() : 0;
          const hoursUntilNext = Math.floor(timeUntilNext / (1000 * 60 * 60));
          const minutesUntilNext = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));

          return (
            <div
              key={campaign.id}
              className="p-6 rounded-2xl bg-muted/50 border border-border hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{campaign.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>🎬 {campaign.videosPerBatch} videos per batch</span>
                    <span>📅 {campaign.frequency === 'daily' ? 'Daily' : 'Twice daily'}</span>
                    <span>🔄 {campaign.totalVideosGenerated} generated</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePause(campaign.id)}
                      className="hover:bg-primary/10"
                    >
                      <Pause className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResume(campaign.id)}
                      className="hover:bg-primary/10"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(campaign.id)}
                    className="hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {nextRun && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">
                    Next batch in <span className="text-foreground font-semibold">{hoursUntilNext}h {minutesUntilNext}m</span>
                    {' '}• {nextRun.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

