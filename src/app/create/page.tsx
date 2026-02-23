'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/Footer';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { ModeToggle } from '@/components/create/ModeToggle';
import { VideoOptions, VoiceOption, VideoBackground } from '@/lib/video-generator/types';
import { Progress } from '@/components/ui/progress';
import { Sparkles, FileText, Image, Mic, Play, Loader2, Check, Zap, Clock } from 'lucide-react';

type Voice = {
  id: VoiceOption['id'];
  name: string;
  preview: string;
  description: string;
  previewText: string;
  gender: VoiceOption['gender'];
};

export default function Create() {
  const [storySource, setStorySource] = useState<'ai' | 'reddit' | 'paste' | 'link' | null>(null);
  const [selectedSubreddit, setSelectedSubreddit] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [redditUrl, setRedditUrl] = useState('');
  const [isScrapingReddit, setIsScrapingReddit] = useState(false);
  const [isEditingRedditContent, setIsEditingRedditContent] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [storyLength, setStoryLength] = useState<'1 min+ (Cliffhanger)' | 'Full Story Length'>('1 min+ (Cliffhanger)');
  const [captionStyle, setCaptionStyle] = useState('modern');
  const [showRedditUI, setShowRedditUI] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [storyIdeas, setStoryIdeas] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<string | null>(null);
  const [videoSpeed, setVideoSpeed] = useState<number>(1.3); // Default 1.3x speed
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handlePreviewVoice = async (voiceId: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      if (previewingVoice === voiceId) {
        setPreviewingVoice(null);
        return;
      }

      setIsLoadingPreview(voiceId);

      const audio = new Audio();
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        setPreviewingVoice(null);
        setIsLoadingPreview(null);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setPreviewingVoice(null);
        setIsLoadingPreview(null);
      });

      const response = await fetch(`/api/preview-voice?voiceId=${voiceId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load preview: ${errorText}`);
      }

      const blob = await response.blob();
      audio.src = URL.createObjectURL(blob);

      await audio.play();
      setPreviewingVoice(voiceId);
      setIsLoadingPreview(null);
    } catch (error) {
      console.error('Failed to play voice preview:', error);
      setPreviewingVoice(null);
      setIsLoadingPreview(null);
    }
  };

  const handleScrapeReddit = async () => {
    try {
      setError(null);
      setIsScrapingReddit(true);

      if (!redditUrl.trim()) {
        setError('Please enter a Reddit URL.');
        return;
      }

      console.log('[reddit-link] Scraping URL:', redditUrl);

      const response = await fetch('/api/scrape-reddit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: redditUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to scrape Reddit post');
        return;
      }

      // Auto-fill the title and story from scraped data
      setStoryTitle(data.title);
      setStoryText(data.story);
      setSelectedSubreddit(data.subreddit || 'r/stories');
      setIsEditingRedditContent(false); // Reset to preview mode when fetching new content

      console.log('[reddit-link] Scraped successfully:', {
        title: data.title.substring(0, 50) + '...',
        storyLength: data.story.length,
        subreddit: data.subreddit
      });

    } catch (error) {
      console.error('[reddit-link] Scraping failed:', error);
      setError('Failed to scrape Reddit post. Please check the URL and try again.');
    } finally {
      setIsScrapingReddit(false);
    }
  };

  const handleGenerateVideo = async () => {
    try {
      setError(null);
      setIsGenerating(true);
      setProgress(0);

      if (!selectedBackground || !selectedVoice) {
        setError('Please select a background and voice before generating.');
        return;
      }

      const selectedVoiceData = voices.find(v => v.id === selectedVoice);
      if (!selectedVoiceData) {
        setError('Selected voice not found.');
        return;
      }

      let storyData: {
        title: string;
        story: string;
        subreddit?: string;
      } | undefined;

      if (storySource === 'paste' || storySource === 'link') {
        if (!storyTitle.trim() || !storyText.trim()) {
          setError('Please enter both a title and story content.');
          return;
        }
        storyData = {
          title: storyTitle,
          story: storyText,
          subreddit: selectedSubreddit || 'r/stories',
        };
      } else if (!selectedSubreddit) {
        setError('Please select a subreddit before generating.');
        return;
      }

      const options: VideoOptions = {
        subreddit: selectedSubreddit?.startsWith('r/') ? selectedSubreddit : `r/${selectedSubreddit}` || 'r/stories',
        isCliffhanger: storyLength === '1 min+ (Cliffhanger)',
        background: {
          category: selectedBackground as VideoBackground['category'],
          speedMultiplier: videoSpeed,
        },
        voice: {
          id: selectedVoice,
          gender: selectedVoiceData.gender,
        },
        captionStyle: {
          font: 'Arial-Bold',
          size: 72,
          color: 'white',
          outlineColor: 'black',
          outlineWidth: 4,
          shadowColor: 'black',
          shadowOffset: 2,
          position: 'center',
        },
        uiOverlay: {
          showSubreddit: true,
          showRedditUI: showRedditUI,
          showBanner: true,
        },
        customStory: storyData,
      };

      let response;
      try {
        response = await fetch(`/api/generate-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(options),
        });
      } catch (fetchError) {
        console.error('Network error during video generation request:', fetchError);
        setError(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Failed to connect to server'}. Please check your internet connection and try again.`);
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      if (!response.ok) {
        let errorMessage;
        try {
          const errorText = await response.text();
          errorMessage = `Video generation failed (${response.status}): ${errorText}`;
        } catch (parseError) {
          errorMessage = `Video generation failed (${response.status}): ${response.statusText}`;
        }
        setError(errorMessage);
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        setError('Invalid response from server. Please try again.');
        setIsGenerating(false);
        setProgress(0);
        return;
      }
      
      if (!data.success) {
        setError(data.error || 'Video generation failed. Please try again.');
        setIsGenerating(false);
        setProgress(0);
        return;
      }
      
      if (!data.videoId) {
        setError('Invalid response from server: missing video ID. Please try again.');
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      let pollCount = 0;
      const maxPolls = 300;
      
      const pollInterval = setInterval(async () => {
        try {
          pollCount++;
          
          if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            setError('Video generation timed out. This might be due to high server load. Please try again.');
            setIsGenerating(false);
            setProgress(0);
            return;
          }
          
          let statusResponse;
          try {
            // WORKAROUND: Poll Worker directly to bypass UI service proxy response.json() hang issue
            // The UI service's fetch to Worker gets 200 OK but response.json() hangs indefinitely (Railway proxy streaming bug)
            // Direct browser → Worker communication works perfectly
            const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API_URL || 'https://api.taleo.media';
            statusResponse = await fetch(`${RAILWAY_API}/video-status/${data.videoId}`, {
              method: 'GET',
              cache: 'no-cache',
              credentials: 'include', // Send session cookie for user validation
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
          } catch (fetchError) {
            throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'}`);
          }
          
          if (!statusResponse.ok) {
            throw new Error(`Failed to get video status: ${statusResponse.status} ${statusResponse.statusText}`);
          }

          const statusData = await statusResponse.json();
          
          if (typeof statusData.progress === 'number') {
            setProgress(statusData.progress);
          }
          
          if (statusData.status === 'ready' || statusData.status === 'completed') {
            clearInterval(pollInterval);
            
            setTimeout(() => {
              window.location.href = `/video/${data.videoId}`;
            }, 500);
            
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setError(`Video generation failed: ${statusData.error || 'Unknown error'}`);
            setIsGenerating(false);
            setProgress(0);
            
          } else if (statusData.status === 'not_found') {
            if (pollCount > 15) {
              clearInterval(pollInterval);
              setError('Video generation status lost. This might be a server issue. Please try again.');
              setIsGenerating(false);
              setProgress(0);
            }
          }
          
        } catch (error) {
          if (pollCount < 5) {
            return;
          }
          
          clearInterval(pollInterval);
          setError(`Failed to check video status: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
          setIsGenerating(false);
          setProgress(0);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to generate video:', error);
      setError('Failed to generate video. Please try again.');
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <>
      {/* Mobile Menu (Hamburger) */}
      <MobileMenu isOpen={mobileMenuOpen} onToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-creator">
          {/* Mode Toggle */}
          <ModeToggle currentMode="single" />

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Create Your Video</h1>
            <p className="text-lg text-muted-foreground">
              Generate engaging story videos in minutes
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
                  <h3 className="font-semibold mb-2">Generating your video...</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This usually takes 1-3 minutes
                  </p>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}% complete</p>
                </div>
              </div>
            </div>
          )}

          {/* Configuration */}
          {!isGenerating && (
            <div className="space-y-8">
              {/* Step 1: Story Source */}
              <div className="card-elevo">
                <div className="flex items-center gap-3 mb-6">
                  <div className="number-badge">1</div>
                  <div>
                    <h2 className="text-2xl font-bold">Choose Story Source</h2>
                    <p className="text-sm text-muted-foreground">Select how you want to create your content</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => setStorySource('ai')}
                    className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                      storySource === 'ai'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <Sparkles className="w-8 h-8 mb-3 text-primary" />
                    <h3 className="font-semibold mb-2">AI Generation</h3>
                    <p className="text-sm text-muted-foreground">
                      Create unique stories with AI
                    </p>
                    {storySource === 'ai' && (
                      <Check className="absolute top-4 right-4 w-6 h-6 text-primary" />
                    )}
                  </button>

                  <button
                    onClick={() => setStorySource('reddit')}
                    className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                      storySource === 'reddit'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="w-8 h-8 mb-3 flex items-center justify-center text-2xl">📱</div>
                    <h3 className="font-semibold mb-2">Reddit Stories</h3>
                    <p className="text-sm text-muted-foreground">
                      Use trending Reddit content
                    </p>
                    {storySource === 'reddit' && (
                      <Check className="absolute top-4 right-4 w-6 h-6 text-primary" />
                    )}
                  </button>

                  <button
                    onClick={() => setStorySource('link')}
                    className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                      storySource === 'link'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="w-8 h-8 mb-3 flex items-center justify-center text-2xl">🔗</div>
                    <h3 className="font-semibold mb-2">Reddit Link</h3>
                    <p className="text-sm text-muted-foreground">
                      Paste a Reddit post URL
                    </p>
                    {storySource === 'link' && (
                      <Check className="absolute top-4 right-4 w-6 h-6 text-primary" />
                    )}
                  </button>

                  <button
                    onClick={() => setStorySource('paste')}
                    className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                      storySource === 'paste'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <FileText className="w-8 h-8 mb-3 text-primary" />
                    <h3 className="font-semibold mb-2">Paste Story</h3>
                    <p className="text-sm text-muted-foreground">
                      Use your own story text
                    </p>
                    {storySource === 'paste' && (
                      <Check className="absolute top-4 right-4 w-6 h-6 text-primary" />
                    )}
                  </button>
                </div>

                {/* Subreddit Selection */}
                {(storySource === 'ai' || storySource === 'reddit') && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-3">Select Subreddit</label>
                    <div className="space-y-4">
                      {Object.entries(subredditCategories).map(([category, subs]) => (
                        <div key={category}>
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2">{category}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {subs.map((sub) => (
                              <button
                                key={sub.name}
                                onClick={() => setSelectedSubreddit(sub.name)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                  selectedSubreddit === sub.name
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/30'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{sub.icon}</span>
                                  <span className="text-sm font-medium">{sub.name}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-2">Story Length</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setStoryLength('1 min+ (Cliffhanger)')}
                          className={`p-4 rounded-xl border-2 transition-all ${
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
                          className={`p-4 rounded-xl border-2 transition-all ${
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
                  </div>
                )}

                {/* Reddit Link Scraper */}
                {storySource === 'link' && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Reddit Post URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={redditUrl}
                          onChange={(e) => setRedditUrl(e.target.value)}
                          placeholder="https://reddit.com/r/subreddit/comments/..."
                          className="input-elevo flex-1"
                        />
                        <Button
                          onClick={handleScrapeReddit}
                          disabled={isScrapingReddit || !redditUrl.trim()}
                          className="btn-orange gap-2 whitespace-nowrap"
                        >
                          {isScrapingReddit ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Scraping...
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4" />
                              Fetch Story
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Paste any Reddit post URL and we'll automatically extract the title and story content
                      </p>
                    </div>

                    {/* Show scraped content (preview or edit mode) */}
                    {storyTitle && storyText && (
                      <div className="space-y-4">
                        {!isEditingRedditContent ? (
                          // Preview mode (read-only)
                          <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
                                <p className="text-sm font-semibold">{storyTitle}</p>
                              </div>
                              <Button
                                onClick={() => setIsEditingRedditContent(true)}
                                variant="outline"
                                size="sm"
                                className="ml-4"
                              >
                                Edit
                              </Button>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">Story Preview</label>
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {storyText}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {storyText.length}/5000 characters
                                </p>
                                {storyText.length > 5000 && (
                                  <p className="text-xs text-red-400">
                                    ⚠️ Will be truncated
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Edit mode (editable fields)
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Story Title</label>
                              <input
                                type="text"
                                value={storyTitle}
                                onChange={(e) => setStoryTitle(e.target.value)}
                                placeholder="Enter your story title"
                                className="input-elevo"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Story Content</label>
                              <div className="relative">
                                <textarea
                                  value={storyText}
                                  onChange={(e) => setStoryText(e.target.value)}
                                  placeholder="Edit your story here..."
                                  rows={8}
                                  className="input-elevo resize-none"
                                />
                                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                                  {storyText.length}/5000
                                </div>
                              </div>
                              {storyText.length > 5000 && (
                                <p className="text-xs text-red-400 mt-1">
                                  ⚠️ Story exceeds 5000 characters. Text will be truncated for TTS.
                                </p>
                              )}
                            </div>
                            <Button
                              onClick={() => setIsEditingRedditContent(false)}
                              className="btn-orange"
                            >
                              Save Changes
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Paste Story */}
                {storySource === 'paste' && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Story Title</label>
                      <input
                        type="text"
                        value={storyTitle}
                        onChange={(e) => setStoryTitle(e.target.value)}
                        placeholder="Enter your story title"
                        className="input-elevo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Story Content</label>
                      <div className="relative">
                        <textarea
                          value={storyText}
                          onChange={(e) => setStoryText(e.target.value)}
                          placeholder="Paste your story here..."
                          rows={8}
                          className="input-elevo resize-none"
                        />
                        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                          {storyText.length}/5000
                        </div>
                      </div>
                      {storyText.length > 5000 && (
                        <p className="text-xs text-red-400 mt-1">
                          ⚠️ Story exceeds 5000 characters. Text will be truncated for TTS.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Background */}
              <div className="card-elevo">
                <div className="flex items-center gap-3 mb-6">
                  <div className="number-badge">2</div>
                  <div>
                    <h2 className="text-2xl font-bold">Choose Background</h2>
                    <p className="text-sm text-muted-foreground">Select the visual backdrop for your video</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {backgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setSelectedBackground(bg.id)}
                      className={`relative group rounded-2xl overflow-hidden border-2 transition-all ${
                        selectedBackground === bg.id
                          ? 'border-primary'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="aspect-[9/16] bg-muted">
                        {/* Placeholder for thumbnail */}
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-12 h-12 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="p-3 bg-card border-t border-border">
                        <h4 className="font-semibold text-sm">{bg.name}</h4>
                        <p className="text-xs text-muted-foreground">{bg.category}</p>
                      </div>
                      {selectedBackground === bg.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Voice */}
              <div className="card-elevo">
                <div className="flex items-center gap-3 mb-6">
                  <div className="number-badge">3</div>
                  <div>
                    <h2 className="text-2xl font-bold">Select Voice</h2>
                    <p className="text-sm text-muted-foreground">Choose the narrator for your story</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {voices.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`relative p-4 rounded-2xl border-2 transition-all text-left ${
                        selectedVoice === voice.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold mb-1">{voice.name}</h4>
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            {voice.gender}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewVoice(voice.id);
                          }}
                          className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          {isLoadingPreview === voice.id ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : previewingVoice === voice.id ? (
                            <div className="w-4 h-4 flex items-center justify-center">
                              <div className="w-2 h-2 bg-primary animate-pulse" />
                            </div>
                          ) : (
                            <Play className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">{voice.description}</p>
                      {selectedVoice === voice.id && (
                        <Check className="absolute top-4 right-4 w-6 h-6 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Video Speed */}
              <div className="card-elevo">
                <div className="flex items-center gap-3 mb-6">
                  <div className="number-badge">4</div>
                  <div>
                    <h2 className="text-2xl font-bold">Adjust Video Speed</h2>
                    <p className="text-sm text-muted-foreground">Make your video faster or slower for better engagement</p>
                  </div>
                </div>

                {/* Speed Presets */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {[
                    { value: 0.9, label: '0.9x', desc: 'Slower', icon: '🐢' },
                    { value: 1.0, label: '1.0x', desc: 'Normal', icon: '▶️' },
                    { value: 1.2, label: '1.2x', desc: 'Smooth', icon: '⚡' },
                    { value: 1.3, label: '1.3x', desc: 'Recommended', icon: '🔥' },
                    { value: 1.5, label: '1.5x', desc: 'Fast', icon: '🚀' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setVideoSpeed(preset.value)}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        videoSpeed === preset.value
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="text-2xl mb-1">{preset.icon}</div>
                      <div className="font-bold text-lg">{preset.label}</div>
                      <div className="text-xs text-muted-foreground">{preset.desc}</div>
                      {videoSpeed === preset.value && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Speed Slider */}
                <div className="space-y-4 p-6 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Custom Speed
                    </label>
                    <span className="text-lg font-bold text-primary">{videoSpeed.toFixed(1)}x</span>
                  </div>
                  
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={videoSpeed}
                    onChange={(e) => setVideoSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    style={{
                      background: `linear-gradient(to right, rgb(var(--primary)) 0%, rgb(var(--primary)) ${((videoSpeed - 0.5) / (2.0 - 0.5)) * 100}%, hsl(var(--muted)) ${((videoSpeed - 0.5) / (2.0 - 0.5)) * 100}%, hsl(var(--muted)) 100%)`
                    }}
                  />
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>0.5x (Half speed)</span>
                    <span>2.0x (Double speed)</span>
                  </div>

                  {/* Duration Preview */}
                  <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-sm font-medium mb-1">Estimated Duration</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>60s video → <span className="text-primary font-semibold">{Math.round(60 / videoSpeed)}s</span></span>
                        <span>•</span>
                        <span>90s video → <span className="text-primary font-semibold">{Math.round(90 / videoSpeed)}s</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Speed Description */}
                  <div className="text-xs text-muted-foreground bg-background/50 p-3 rounded-lg">
                    {videoSpeed < 1.0 && '📖 Slower pace for dramatic, emotional stories'}
                    {videoSpeed === 1.0 && '▶️ Normal speed - original pacing preserved'}
                    {videoSpeed > 1.0 && videoSpeed < 1.3 && '⚡ Smooth speedup - maintains natural feel'}
                    {videoSpeed >= 1.3 && videoSpeed < 1.5 && '🔥 Recommended for TikTok/Shorts - maximum engagement'}
                    {videoSpeed >= 1.5 && '🚀 Fast-paced - great for action stories and highlights'}
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateVideo}
                disabled={!storySource || !selectedBackground || !selectedVoice || (storySource !== 'paste' && storySource !== 'link' && !selectedSubreddit)}
                className="btn-orange w-full text-lg py-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Video
              </button>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
    </>
  );
}
