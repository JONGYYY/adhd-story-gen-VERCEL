'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/Footer';
import { ModeToggle } from '@/components/create/ModeToggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { CAMPAIGN_TEMPLATES, getTemplateById } from '@/lib/campaigns/templates';
import { 
  Sparkles, 
  FileText, 
  Image, 
  Mic, 
  Play, 
  Loader2, 
  Check, 
  Grid3x3,
  Clock,
  Calendar,
  Zap,
  CheckCircle2,
  Settings2,
  Wand2
} from 'lucide-react';

type Voice = {
  id: string;
  name: string;
  preview: string;
  description: string;
  previewText: string;
  gender: 'male' | 'female';
};

export default function BatchCreate() {
  const [batchMode, setBatchMode] = useState<'manual' | 'autopilot'>('manual');
  const [selectedSources, setSelectedSources] = useState<Set<'ai' | 'reddit'>>(new Set());
  const [selectedSubreddits, setSelectedSubreddits] = useState<Set<string>>(new Set());
  const [selectedBackgrounds, setSelectedBackgrounds] = useState<Set<string>>(new Set());
  const [selectedVoices, setSelectedVoices] = useState<Set<string>>(new Set());
  const [numVideos, setNumVideos] = useState(5);
  const [storyLength, setStoryLength] = useState<'1 min+ (Cliffhanger)' | 'Full Story Length'>('1 min+ (Cliffhanger)');
  const [showRedditUI, setShowRedditUI] = useState(true);
  
  // Auto-pilot specific states
  const [campaignName, setCampaignName] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'twice-daily' | 'custom'>('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [autoPostToTikTok, setAutoPostToTikTok] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Apply template when selected
  const applyTemplate = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    setCampaignName(template.templateName);
    setFrequency(template.frequency);
    setScheduleTime(template.scheduleTime);
    setNumVideos(template.videosPerBatch);
    setSelectedSources(new Set(template.sources));
    setSelectedSubreddits(new Set(template.subreddits));
    setSelectedBackgrounds(new Set(template.backgrounds));
    setSelectedVoices(new Set(template.voices));
    setStoryLength(template.storyLength);
    setShowRedditUI(template.showRedditUI);
    setAutoPostToTikTok(template.autoPostToTikTok);
  };

  const subredditCategories = {
    'Drama & Relationships': [
      { name: 'r/AITA', description: 'Am I The Asshole - Moral dilemmas and conflicts', icon: '⚖️' },
      { name: 'r/relationships', description: 'Relationship advice and stories', icon: '❤️' },
      { name: 'r/TrueOffMyChest', description: 'Personal confessions and experiences', icon: '💭' },
    ],
    'Horror & Supernatural': [
      { name: 'r/nosleep', description: 'Horror stories and supernatural experiences', icon: '👻' },
      { name: 'r/ShortScaryStories', description: 'Brief horror tales', icon: '🔪' },
    ],
    'Life Stories': [
      { name: 'r/confession', description: 'Anonymous confessions', icon: '🤫' },
      { name: 'r/TIFU', description: 'Today I Fucked Up - Personal mistakes', icon: '😅' },
      { name: 'r/ProRevenge', description: 'Professional revenge stories', icon: '😈' },
    ],
    'Work Tales': [
      { name: 'r/TalesFromYourServer', description: 'Restaurant service stories', icon: '🍽️' },
      { name: 'r/TalesFromTechSupport', description: 'IT and tech support stories', icon: '💻' },
    ],
  };

  const backgrounds: Array<{
    id: string;
    name: string;
    thumbnail: string;
    category: string;
    description?: string;
  }> = [
    {
      id: 'minecraft',
      name: 'Minecraft Parkour',
      thumbnail: '/backgrounds/minecraft.jpg',
      category: 'Gaming',
    },
    {
      id: 'subway',
      name: 'Subway Surfers',
      thumbnail: '/backgrounds/subway.jpg',
      category: 'Gaming',
    },
    {
      id: 'food',
      name: 'Food',
      thumbnail: '/backgrounds/food.jpg',
      category: 'Lifestyle',
    },
    {
      id: 'worker',
      name: 'Worker',
      thumbnail: '/backgrounds/workers.jpg',
      category: 'Lifestyle',
    }
  ];

  const voices: Voice[] = [
    {
      id: 'brian',
      name: 'Brian',
      preview: '/api/preview-voice?voiceId=brian',
      description: 'Deep, authoritative male voice',
      previewText: 'Perfect for serious stories',
      gender: 'male',
    },
    {
      id: 'adam',
      name: 'Adam',
      preview: '/api/preview-voice?voiceId=adam',
      description: 'Friendly, casual male voice',
      previewText: 'Great for relatable stories',
      gender: 'male',
    },
    {
      id: 'antoni',
      name: 'Antoni',
      preview: '/api/preview-voice?voiceId=antoni',
      description: 'Energetic, expressive male voice',
      previewText: 'Perfect for humorous tales',
      gender: 'male',
    },
    {
      id: 'sarah',
      name: 'Sarah',
      preview: '/api/preview-voice?voiceId=sarah',
      description: 'Professional, articulate female voice',
      previewText: 'Ideal for clear narratives',
      gender: 'female',
    },
    {
      id: 'laura',
      name: 'Laura',
      preview: '/api/preview-voice?voiceId=laura',
      description: 'Warm, empathetic female voice',
      previewText: 'Great for emotional stories',
      gender: 'female',
    },
    {
      id: 'rachel',
      name: 'Rachel',
      preview: '/api/preview-voice?voiceId=rachel',
      description: 'Dynamic, engaging female voice',
      previewText: 'Perfect for dramatic stories',
      gender: 'female',
    },
  ];

  const toggleSource = (source: 'ai' | 'reddit') => {
    const newSources = new Set(selectedSources);
    if (newSources.has(source)) {
      newSources.delete(source);
    } else {
      newSources.add(source);
    }
    setSelectedSources(newSources);
  };

  const toggleSubreddit = (subreddit: string) => {
    const newSubreddits = new Set(selectedSubreddits);
    if (newSubreddits.has(subreddit)) {
      newSubreddits.delete(subreddit);
    } else {
      newSubreddits.add(subreddit);
    }
    setSelectedSubreddits(newSubreddits);
  };

  const toggleBackground = (background: string) => {
    const newBackgrounds = new Set(selectedBackgrounds);
    if (newBackgrounds.has(background)) {
      newBackgrounds.delete(background);
    } else {
      newBackgrounds.add(background);
    }
    setSelectedBackgrounds(newBackgrounds);
  };

  const toggleVoice = (voice: string) => {
    const newVoices = new Set(selectedVoices);
    if (newVoices.has(voice)) {
      newVoices.delete(voice);
    } else {
      newVoices.add(voice);
    }
    setSelectedVoices(newVoices);
  };

  const handleGenerateBatch = async () => {
    setError(null);
    setIsGenerating(true);
    setProgress(0);

    try {
      if (batchMode === 'manual') {
        // Manual batch generation
        const response = await fetch('/api/batch/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            videosPerBatch: numVideos,
            sources: Array.from(selectedSources),
            subreddits: Array.from(selectedSubreddits),
            backgrounds: Array.from(selectedBackgrounds),
            voices: Array.from(selectedVoices),
            storyLength,
            showRedditUI,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate batch');
        }

        // Redirect to library or show success
        alert(`Successfully started batch generation! ${data.videoIds.length} videos queued.`);
        window.location.href = '/library';

      } else {
        // Auto-pilot campaign creation
        const response = await fetch('/api/campaigns', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: campaignName,
            frequency,
            scheduleTime,
            videosPerBatch: numVideos,
            sources: Array.from(selectedSources),
            subreddits: Array.from(selectedSubreddits),
            backgrounds: Array.from(selectedBackgrounds),
            voices: Array.from(selectedVoices),
            storyLength,
            showRedditUI,
            autoPostToTikTok,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create campaign');
        }

        // Show success and redirect
        const nextRun = new Date(data.nextRunAt);
        alert(`Auto-pilot campaign created! First batch will run at ${nextRun.toLocaleString()}`);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Failed to start batch:', error);
      setError(error instanceof Error ? error.message : 'Failed to start batch generation');
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-creator">
          {/* Mode Toggle */}
          <ModeToggle currentMode="batch" />

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Batch Video Creator</h1>
            <p className="text-lg text-muted-foreground">
              Create multiple videos at once with smart automation
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              {error}
            </div>
          )}

          {/* Generating State */}
          {isGenerating && (
            <div className="mb-8 card-elevo">
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <div>
                  <h3 className="font-semibold mb-2">Generating your batch...</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Creating {numVideos} videos ({Math.round(numVideos * 2)} - {Math.round(numVideos * 3)} minutes)
                  </p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}% complete</p>
                </div>
              </div>
            </div>
          )}

          {/* Configuration */}
          {!isGenerating && (
            <Tabs defaultValue="manual" value={batchMode} onValueChange={(v) => setBatchMode(v as 'manual' | 'autopilot')} className="space-y-8">
              <TabsList className="grid w-full max-w-[600px] mx-auto grid-cols-2 h-auto p-1">
                <TabsTrigger value="manual" className="flex items-center gap-2 py-3">
                  <Grid3x3 className="w-4 h-4" />
                  Manual Batch
                </TabsTrigger>
                <TabsTrigger value="autopilot" className="flex items-center gap-2 py-3">
                  <Zap className="w-4 h-4" />
                  Auto-Pilot
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30">
                    PRO
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* Manual Batch Tab */}
              <TabsContent value="manual" className="space-y-8">
                {/* Number of Videos */}
                <div className="card-elevo">
                  <h2 className="text-2xl font-bold mb-2">Batch Size</h2>
                  <p className="text-sm text-muted-foreground mb-6">How many videos do you want to create?</p>
                  
                  <div className="space-y-4">
                    <input
                      type="range"
                      min="2"
                      max="20"
                      value={numVideos}
                      onChange={(e) => setNumVideos(parseInt(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">2 videos</span>
                      <div className="flex items-center gap-2">
                        <span className="text-4xl font-bold text-primary">{numVideos}</span>
                        <span className="text-muted-foreground">videos</span>
                      </div>
                      <span className="text-sm text-muted-foreground">20 videos</span>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Estimated time: {Math.round(numVideos * 2)}-{Math.round(numVideos * 3)} minutes
                    </p>
        </div>
      </div>

                {/* Story Sources & Subreddits - Combined */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">1</div>
          <div>
                      <h2 className="text-2xl font-bold">Content Selection</h2>
                      <p className="text-sm text-muted-foreground">Choose story sources and topics (Select multiple to rotate)</p>
                    </div>
                  </div>

                  {/* Story Sources */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-3">Story Sources</label>
                    <div className="grid md:grid-cols-2 gap-4">
              <button
                        onClick={() => toggleSource('ai')}
                        className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                          selectedSources.has('ai')
                    ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <Sparkles className="w-8 h-8 mb-3 text-primary" />
                        <h3 className="font-semibold mb-2">AI Generation</h3>
                        <p className="text-sm text-muted-foreground">
                          Create unique stories with AI
                        </p>
                        {selectedSources.has('ai') && (
                          <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-primary" />
                        )}
              </button>

              <button
                        onClick={() => toggleSource('reddit')}
                        className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                          selectedSources.has('reddit')
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="w-8 h-8 mb-3 flex items-center justify-center text-2xl">📱</div>
                        <h3 className="font-semibold mb-2">Reddit Stories</h3>
                        <p className="text-sm text-muted-foreground">
                          Use trending Reddit content
                        </p>
                        {selectedSources.has('reddit') && (
                          <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-primary" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Subreddit Selection */}
                  {(selectedSources.has('ai') || selectedSources.has('reddit')) && (
                    <div>
                      <label className="block text-sm font-medium mb-3">Select Subreddits (will rotate across videos)</label>
                      <div className="space-y-4">
                        {Object.entries(subredditCategories).map(([category, subs]) => (
                          <div key={category}>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">{category}</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                              {subs.map((sub) => (
                                <button
                                  key={sub.name}
                                  onClick={() => toggleSubreddit(sub.name)}
                                  className={`p-3 rounded-xl border text-left transition-all relative ${
                                    selectedSubreddits.has(sub.name)
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border hover:border-primary/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{sub.icon}</span>
                                    <span className="text-sm font-medium">{sub.name}</span>
                                  </div>
                                  {selectedSubreddits.has(sub.name) && (
                                    <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedSubreddits.size > 0 && (
                        <p className="text-xs text-muted-foreground mt-3">
                          ✓ {selectedSubreddits.size} subreddit{selectedSubreddits.size > 1 ? 's' : ''} selected - will rotate across videos
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Backgrounds */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">2</div>
                    <div>
                      <h2 className="text-2xl font-bold">Background Videos</h2>
                      <p className="text-sm text-muted-foreground">Select multiple to rotate across videos</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {backgrounds.map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() => toggleBackground(bg.id)}
                        className={`relative group rounded-2xl overflow-hidden border-2 transition-all ${
                          selectedBackgrounds.has(bg.id)
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="aspect-video relative">
                          <img
                            src={bg.thumbnail}
                            alt={bg.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <h4 className="font-semibold text-white text-sm">{bg.name}</h4>
                            <p className="text-xs text-gray-300">{bg.category}</p>
                          </div>
                          {selectedBackgrounds.has(bg.id) && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedBackgrounds.size > 0 && (
                    <p className="text-xs text-muted-foreground mt-3">
                      ✓ {selectedBackgrounds.size} background{selectedBackgrounds.size > 1 ? 's' : ''} selected - will rotate across videos
                    </p>
                  )}
                </div>

                {/* Voices */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">3</div>
                    <div>
                      <h2 className="text-2xl font-bold">Voice Selection</h2>
                      <p className="text-sm text-muted-foreground">Select multiple to rotate across videos</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {voices.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => toggleVoice(voice.id)}
                        className={`relative p-5 rounded-2xl border-2 text-left transition-all group ${
                          selectedVoices.has(voice.id)
                    ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Mic className="w-5 h-5 text-primary" />
                          </div>
                          {selectedVoices.has(voice.id) && (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <h3 className="font-semibold mb-1">{voice.name}</h3>
                        <p className="text-xs text-muted-foreground mb-2">{voice.description}</p>
                        <p className="text-xs text-muted-foreground italic">{voice.previewText}</p>
                      </button>
                    ))}
                  </div>
                  {selectedVoices.size > 0 && (
                    <p className="text-xs text-muted-foreground mt-3">
                      ✓ {selectedVoices.size} voice{selectedVoices.size > 1 ? 's' : ''} selected - will rotate across videos
                    </p>
                  )}
                </div>

                {/* Additional Options */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">4</div>
                    <div>
                      <h2 className="text-2xl font-bold">Video Settings</h2>
                      <p className="text-sm text-muted-foreground">Configure video options</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Story Length</label>
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={() => setStoryLength('1 min+ (Cliffhanger)')}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            storyLength === '1 min+ (Cliffhanger)'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <h4 className="font-semibold mb-1">Cliffhanger (1 min+)</h4>
                          <p className="text-xs text-muted-foreground">Perfect for engagement</p>
                        </button>
                        <button
                          onClick={() => setStoryLength('Full Story Length')}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            storyLength === 'Full Story Length'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <h4 className="font-semibold mb-1">Full Story</h4>
                          <p className="text-xs text-muted-foreground">Complete narrative</p>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Reddit UI Overlay</label>
                      <button
                        onClick={() => setShowRedditUI(!showRedditUI)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          showRedditUI
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold mb-1">Show Reddit Banner</h4>
                            <p className="text-xs text-muted-foreground">Display subreddit info</p>
                          </div>
                          <div className={`w-12 h-6 rounded-full transition-colors ${
                            showRedditUI ? 'bg-primary' : 'bg-muted'
                          }`}>
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                              showRedditUI ? 'translate-x-6' : 'translate-x-0.5'
                            } mt-0.5`} />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <Button 
                  onClick={handleGenerateBatch}
                  className="w-full py-8 text-lg font-semibold btn-orange"
                  disabled={
                    selectedSources.size === 0 ||
                    selectedSubreddits.size === 0 ||
                    selectedBackgrounds.size === 0 ||
                    selectedVoices.size === 0
                  }
                >
                  <Grid3x3 className="w-5 h-5 mr-2" />
                  Generate {numVideos} Videos
                </Button>
              </TabsContent>

              {/* Auto-Pilot Tab */}
              <TabsContent value="autopilot" className="space-y-8">
                {/* Templates Quick Start */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <Wand2 className="w-6 h-6 text-primary" />
                    <div>
                      <h2 className="text-2xl font-bold">Quick Start Templates</h2>
                      <p className="text-sm text-muted-foreground">Choose a preset or customize your own</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CAMPAIGN_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template.id)}
                        className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                          selectedTemplate === template.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="text-3xl mb-3">{template.icon}</div>
                        <h3 className="font-semibold mb-2">{template.templateName}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>🎬 {template.videosPerBatch} videos</span>
                          <span>•</span>
                          <span>📅 {template.frequency === 'daily' ? 'Daily' : 'Twice daily'}</span>
                        </div>
                        {selectedTemplate === template.id && (
                          <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedTemplate && (
                    <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-sm text-muted-foreground">
                        ✓ Template applied! You can customize the settings below or start the campaign now.
                      </p>
                    </div>
                  )}
                </div>

                {/* Campaign Name */}
                <div className="card-elevo">
                  <h2 className="text-2xl font-bold mb-2">Campaign Name</h2>
                  <p className="text-sm text-muted-foreground mb-6">Give your auto-pilot campaign a memorable name</p>
                  
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., Daily Horror Mix"
                    className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                {/* Scheduling */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">1</div>
                    <div>
                      <h2 className="text-2xl font-bold">Schedule & Frequency</h2>
                      <p className="text-sm text-muted-foreground">When and how often to generate videos</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Frequency */}
                    <div>
                      <label className="block text-sm font-medium mb-3">Frequency</label>
                      <div className="space-y-3">
                        <button
                          onClick={() => setFrequency('daily')}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                            frequency === 'daily'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            <div>
                              <h4 className="font-semibold">Daily</h4>
                              <p className="text-xs text-muted-foreground">Once per day</p>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setFrequency('twice-daily')}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                            frequency === 'twice-daily'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            <div>
                              <h4 className="font-semibold">Twice Daily</h4>
                              <p className="text-xs text-muted-foreground">12 hours apart</p>
                            </div>
                          </div>
              </button>
            </div>
          </div>

                    {/* Time */}
            <div>
                      <label className="block text-sm font-medium mb-3">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary focus:outline-none transition-colors"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {frequency === 'twice-daily' 
                          ? 'First run time (second run will be 12 hours later)'
                          : 'Daily run time'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Batch Size */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-3">Videos per batch</label>
              <input
                type="range"
                min="1"
                      max="10"
                value={numVideos}
                onChange={(e) => setNumVideos(parseInt(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-muted-foreground">1 video</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-primary">{numVideos}</span>
                        <span className="text-muted-foreground">videos</span>
                      </div>
                      <span className="text-sm text-muted-foreground">10 videos</span>
                    </div>
                  </div>
                </div>

                {/* Content Selection (same as manual) */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">2</div>
                    <div>
                      <h2 className="text-2xl font-bold">Content Rotation</h2>
                      <p className="text-sm text-muted-foreground">Select multiple options for variety</p>
              </div>
            </div>

          {/* Story Sources */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-3">Story Sources</label>
                    <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => toggleSource('ai')}
                        className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                  selectedSources.has('ai')
                    ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <Sparkles className="w-8 h-8 mb-3 text-primary" />
                        <h3 className="font-semibold mb-2">AI Generation</h3>
                        <p className="text-sm text-muted-foreground">Create unique stories</p>
                        {selectedSources.has('ai') && (
                          <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-primary" />
                        )}
              </button>

              <button
                onClick={() => toggleSource('reddit')}
                        className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                  selectedSources.has('reddit')
                    ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="w-8 h-8 mb-3 flex items-center justify-center text-2xl">📱</div>
                        <h3 className="font-semibold mb-2">Reddit Stories</h3>
                        <p className="text-sm text-muted-foreground">Trending content</p>
                        {selectedSources.has('reddit') && (
                          <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-primary" />
                        )}
              </button>
            </div>
          </div>

                  {/* Subreddits */}
                  {(selectedSources.has('ai') || selectedSources.has('reddit')) && (
            <div>
                      <label className="block text-sm font-medium mb-3">Subreddits</label>
                      <div className="space-y-4">
                        {Object.entries(subredditCategories).map(([category, subs]) => (
                          <div key={category}>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">{category}</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                              {subs.map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => toggleSubreddit(sub.name)}
                                  className={`p-3 rounded-xl border text-left transition-all relative ${
                      selectedSubreddits.has(sub.name)
                        ? 'border-primary bg-primary/5'
                                      : 'border-border hover:border-primary/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{sub.icon}</span>
                                    <span className="text-sm font-medium">{sub.name}</span>
                                  </div>
                                  {selectedSubreddits.has(sub.name) && (
                                    <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
                                  )}
                  </button>
                              ))}
                            </div>
                          </div>
                ))}
              </div>
            </div>
          )}
                </div>

                {/* Backgrounds & Voices (combined) */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">3</div>
                    <div>
                      <h2 className="text-2xl font-bold">Media Selection</h2>
                      <p className="text-sm text-muted-foreground">Backgrounds and voices</p>
                    </div>
                  </div>

                  <div className="space-y-6">
          {/* Backgrounds */}
          <div>
                      <label className="block text-sm font-medium mb-3">Backgrounds</label>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => toggleBackground(bg.id)}
                            className={`relative group rounded-2xl overflow-hidden border-2 transition-all ${
                    selectedBackgrounds.has(bg.id)
                                ? 'border-primary ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <div className="aspect-video relative">
                              <img src={bg.thumbnail} alt={bg.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <h4 className="font-semibold text-white text-sm">{bg.name}</h4>
                              </div>
                              {selectedBackgrounds.has(bg.id) && (
                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Voices */}
          <div>
                      <label className="block text-sm font-medium mb-3">Voices</label>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {voices.map((voice) => (
                          <button
                  key={voice.id}
                            onClick={() => toggleVoice(voice.id)}
                            className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                    selectedVoices.has(voice.id)
                      ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Mic className="w-5 h-5 text-primary" />
                              </div>
                              {selectedVoices.has(voice.id) && (
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <h3 className="font-semibold mb-1">{voice.name}</h3>
                            <p className="text-xs text-muted-foreground">{voice.description}</p>
                    </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Auto-Posting Options */}
                <div className="card-elevo">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="number-badge">4</div>
                    <div>
                      <h2 className="text-2xl font-bold">Auto-Posting</h2>
                      <p className="text-sm text-muted-foreground">Automatically post to platforms</p>
            </div>
          </div>

                  <button
                    onClick={() => setAutoPostToTikTok(!autoPostToTikTok)}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                      autoPostToTikTok
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
                          📱
              </div>
              <div>
                          <h3 className="font-semibold mb-1">Auto-Post to TikTok</h3>
                          <p className="text-xs text-muted-foreground">Automatically upload videos to TikTok</p>
                        </div>
              </div>
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        autoPostToTikTok ? 'bg-primary' : 'bg-muted'
                      }`}>
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                          autoPostToTikTok ? 'translate-x-6' : 'translate-x-0.5'
                        } mt-0.5`} />
              </div>
            </div>
                  </button>
          </div>

                {/* Start Campaign Button */}
                <Button 
                  onClick={handleGenerateBatch}
                  className="w-full py-8 text-lg font-semibold btn-orange"
                  disabled={
                    !campaignName.trim() ||
                    selectedSources.size === 0 ||
                    selectedSubreddits.size === 0 ||
                    selectedBackgrounds.size === 0 ||
                    selectedVoices.size === 0
                  }
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Start Auto-Pilot Campaign
          </Button>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
} 
