'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CampaignConfig, CampaignFrequency } from '@/lib/campaigns/types';
import { X, Loader2 } from 'lucide-react';

interface CampaignEditModalProps {
  campaign: CampaignConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function CampaignEditModal({ campaign, isOpen, onClose, onSave }: CampaignEditModalProps) {
  const [name, setName] = useState(campaign.name);
  const [frequency, setFrequency] = useState<CampaignFrequency>(campaign.frequency);
  const [scheduleTime, setScheduleTime] = useState(campaign.scheduleTime);
  const [videosPerBatch, setVideosPerBatch] = useState(campaign.videosPerBatch);
  const [videoSpeed, setVideoSpeed] = useState(campaign.videoSpeed ?? 1.3);
  const [maxDuration, setMaxDuration] = useState(campaign.maxDuration ?? 75);
  const [autoPostToTikTok, setAutoPostToTikTok] = useState(campaign.autoPostToTikTok);
  const [autoPostToYouTube, setAutoPostToYouTube] = useState(campaign.autoPostToYouTube);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when campaign changes
  useEffect(() => {
    setName(campaign.name);
    setFrequency(campaign.frequency);
    setScheduleTime(campaign.scheduleTime);
    setVideosPerBatch(campaign.videosPerBatch);
    setVideoSpeed(campaign.videoSpeed ?? 1.3);
    setMaxDuration(campaign.maxDuration ?? 75);
    setAutoPostToTikTok(campaign.autoPostToTikTok);
    setAutoPostToYouTube(campaign.autoPostToYouTube);
  }, [campaign]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          frequency,
          scheduleTime,
          videosPerBatch,
          videoSpeed,
          maxDuration,
          autoPostToTikTok,
          autoPostToYouTube,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update campaign');
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Campaign</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
              {error}
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none"
              placeholder="My Campaign"
            />
          </div>

          {/* Schedule */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as CampaignFrequency)}
                className="w-full p-3 rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none"
              >
                <option value="daily">Daily</option>
                <option value="twice-daily">Twice Daily</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Schedule Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Videos Per Batch */}
          <div>
            <label className="block text-sm font-medium mb-2">Videos Per Batch</label>
            <input
              type="number"
              min="1"
              max="20"
              value={videosPerBatch}
              onChange={(e) => setVideosPerBatch(parseInt(e.target.value))}
              className="w-full p-3 rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none"
            />
          </div>

          {/* Video Speed */}
          <div>
            <label className="block text-sm font-medium mb-2">Video Speed</label>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border-2 border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">{videoSpeed}x</span>
                  <span className="text-xs text-muted-foreground">Speed Multiplier</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={videoSpeed}
                  onChange={(e) => setVideoSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>0.5x</span>
                  <span>1.3x (default)</span>
                  <span>2.0x</span>
                </div>
              </div>
            </div>
          </div>

          {/* Max Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">Maximum Video Duration</label>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border-2 border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">
                    {Math.floor(maxDuration / 60)}:{(maxDuration % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs text-muted-foreground">Max Length</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="5"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>0:30</span>
                  <span>1:15 (default)</span>
                  <span>3:00</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Videos will be cut at this length if the story is longer
                </p>
              </div>
            </div>
          </div>

          {/* Auto-posting */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Auto-posting</label>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoPostTikTok"
                checked={autoPostToTikTok}
                onChange={(e) => setAutoPostToTikTok(e.target.checked)}
                className="w-5 h-5 rounded accent-primary cursor-pointer"
              />
              <label htmlFor="autoPostTikTok" className="cursor-pointer">
                Auto-post to TikTok
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoPostYouTube"
                checked={autoPostToYouTube}
                onChange={(e) => setAutoPostToYouTube(e.target.checked)}
                className="w-5 h-5 rounded accent-primary cursor-pointer"
              />
              <label htmlFor="autoPostYouTube" className="cursor-pointer">
                Auto-post to YouTube
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-6 flex items-center justify-end gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="btn-orange"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
