'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import { CampaignConfig, CampaignRun } from '@/lib/campaigns/types';
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Pause,
  Edit,
  Trash2,
  Plus,
  Calendar,
  Video,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignConfig[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignConfig | null>(null);
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchCampaignRuns(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
        if (data.campaigns && data.campaigns.length > 0) {
          setSelectedCampaign(data.campaigns[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignRuns = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/runs`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Failed to fetch campaign runs:', error);
    }
  };

  const handlePause = async (campaignId: string) => {
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'paused' }),
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to pause campaign:', error);
    }
  };

  const handleResume = async (campaignId: string) => {
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' }),
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to resume campaign:', error);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const stats = selectedCampaign ? [
    {
      label: 'Total Videos Generated',
      value: selectedCampaign.totalVideosGenerated,
      icon: Video,
      color: 'text-blue-400',
    },
    {
      label: 'Total Videos Posted',
      value: selectedCampaign.totalVideosPosted,
      icon: Upload,
      color: 'text-green-400',
    },
    {
      label: 'Failed Generations',
      value: selectedCampaign.failedGenerations,
      icon: XCircle,
      color: 'text-red-400',
    },
    {
      label: 'Success Rate',
      value: selectedCampaign.totalVideosGenerated > 0
        ? `${Math.round(((selectedCampaign.totalVideosGenerated - selectedCampaign.failedGenerations) / selectedCampaign.totalVideosGenerated) * 100)}%`
        : '0%',
      icon: TrendingUp,
      color: 'text-primary',
    },
  ] : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="section-py">
          <div className="container-wide">
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Campaign Analytics</h1>
              <p className="text-muted-foreground">Track and manage your auto-pilot campaigns</p>
            </div>
            <Link href="/create/batch?tab=autopilot" className="btn-orange hidden md:inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              New Campaign
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <div className="card-elevo text-center py-16">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-10 h-10 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">No Campaigns Yet</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first auto-pilot campaign to start generating videos automatically
              </p>
              <Link href="/create/batch?tab=autopilot" className="btn-orange inline-flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create Your First Campaign
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Campaign List */}
              <div className="lg:col-span-1">
                <div className="card-elevo">
                  <h2 className="text-xl font-bold mb-4">Your Campaigns</h2>
                  <div className="space-y-2">
                    {campaigns.map((campaign) => (
                      <button
                        key={campaign.id}
                        onClick={() => setSelectedCampaign(campaign)}
                        className={`w-full p-4 rounded-xl text-left transition-all ${
                          selectedCampaign?.id === campaign.id
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'bg-muted/30 border-2 border-transparent hover:border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold">{campaign.name}</h3>
                          <div className={`w-2 h-2 rounded-full ${
                            campaign.status === 'active' ? 'bg-green-400' :
                            campaign.status === 'paused' ? 'bg-yellow-400' :
                            'bg-red-400'
                          }`} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {campaign.totalVideosGenerated} videos generated
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Campaign Details */}
              {selectedCampaign && (
                <div className="lg:col-span-2 space-y-6">
                  {/* Campaign Info */}
                  <div className="card-elevo">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold mb-2">{selectedCampaign.name}</h2>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {selectedCampaign.frequency === 'daily' ? 'Daily' : 'Twice Daily'} at {selectedCampaign.scheduleTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Video className="w-4 h-4" />
                            {selectedCampaign.videosPerBatch} videos per batch
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedCampaign.status === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePause(selectedCampaign.id)}
                          >
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResume(selectedCampaign.id)}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Resume
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(selectedCampaign.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Next Run */}
                    {selectedCampaign.nextRunAt && selectedCampaign.status === 'active' && (
                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="text-muted-foreground">
                            Next batch:{' '}
                            <span className="text-foreground font-semibold">
                              {new Date(selectedCampaign.nextRunAt).toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {stats.map((stat) => (
                      <div key={stat.label} className="card-elevo">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                          </div>
                        </div>
                        <p className="text-3xl font-bold mb-1">{stat.value}</p>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Campaign Configuration */}
                  <div className="card-elevo">
                    <h3 className="text-lg font-bold mb-4">Configuration</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Subreddits ({selectedCampaign.subreddits.length})</p>
                        <p className="font-medium">{selectedCampaign.subreddits.join(', ')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Backgrounds ({selectedCampaign.backgrounds.length})</p>
                        <p className="font-medium">{selectedCampaign.backgrounds.join(', ')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Voices ({selectedCampaign.voices.length})</p>
                        <p className="font-medium">{selectedCampaign.voices.join(', ')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Auto-Post to TikTok</p>
                        <p className="font-medium">{selectedCampaign.autoPostToTikTok ? 'Enabled ✓' : 'Disabled'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Runs */}
                  <div className="card-elevo">
                    <h3 className="text-lg font-bold mb-4">Recent Runs</h3>
                    {runs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No runs yet</p>
                    ) : (
                      <div className="space-y-3">
                        {runs.map((run) => (
                          <div
                            key={run.id}
                            className="p-4 rounded-xl bg-muted/30 border border-border"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {run.status === 'completed' ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : run.status === 'failed' ? (
                                  <XCircle className="w-5 h-5 text-red-400" />
                                ) : (
                                  <Clock className="w-5 h-5 text-yellow-400" />
                                )}
                                <span className="font-medium">
                                  {run.completedVideos}/{run.totalVideos} videos
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(run.startedAt).toLocaleString()}
                              </span>
                            </div>
                            {run.failedVideos > 0 && (
                              <p className="text-xs text-red-400">
                                {run.failedVideos} failed
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}

