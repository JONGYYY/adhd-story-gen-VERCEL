'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Hash, Globe, Lock, Sparkles, X } from 'lucide-react';

interface TikTokUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (data: { caption: string; hashtags: string[]; privacyLevel: 'PUBLIC' | 'SELF_ONLY' }) => void;
  isUploading: boolean;
}

// Pre-written hashtag suggestions categorized
const HASHTAG_SUGGESTIONS = {
  trending: ['fyp', 'foryou', 'foryoupage', 'viral', 'trending'],
  story: ['storytime', 'redditstories', 'reddit', 'storytelling', 'truestory'],
  content: ['aita', 'dramastory', 'crazystory', 'nosleep', 'prorevenge'],
  engagement: ['mustwatch', 'watchuntilend', 'plottwist', 'shocking', 'unbelievable']
};

const CAPTION_MAX_LENGTH = 2200; // TikTok's caption limit

export function TikTokUploadModal({ open, onOpenChange, onUpload, isUploading }: TikTokUploadModalProps) {
  const [caption, setCaption] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [privacyLevel, setPrivacyLevel] = useState<'PUBLIC' | 'SELF_ONLY'>('PUBLIC');
  const [activeCategory, setActiveCategory] = useState<keyof typeof HASHTAG_SUGGESTIONS>('trending');

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCaption('');
      setSelectedHashtags([]);
      setPrivacyLevel('PUBLIC');
      setActiveCategory('trending');
    }
  }, [open]);

  const toggleHashtag = (hashtag: string) => {
    if (selectedHashtags.includes(hashtag)) {
      setSelectedHashtags(selectedHashtags.filter(h => h !== hashtag));
    } else {
      setSelectedHashtags([...selectedHashtags, hashtag]);
    }
  };

  const removeHashtag = (hashtag: string) => {
    setSelectedHashtags(selectedHashtags.filter(h => h !== hashtag));
  };

  const captionWithHashtags = () => {
    const hashtagString = selectedHashtags.map(h => `#${h}`).join(' ');
    return caption + (hashtagString ? `\n\n${hashtagString}` : '');
  };

  const finalCaption = captionWithHashtags();
  const isOverLimit = finalCaption.length > CAPTION_MAX_LENGTH;
  const characterCountColor = isOverLimit 
    ? 'text-red-500' 
    : finalCaption.length > CAPTION_MAX_LENGTH * 0.9 
    ? 'text-yellow-500' 
    : 'text-muted-foreground';

  const handleUpload = () => {
    if (isOverLimit) return;
    onUpload({
      caption: finalCaption,
      hashtags: selectedHashtags,
      privacyLevel
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-primary/20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header with gradient */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 to-purple-500/20 p-6 pb-8">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/10 to-purple-500/10"
              animate={{
                x: [0, 100, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </motion.div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white">Upload to TikTok</DialogTitle>
                  <DialogDescription className="text-gray-300">
                    Customize your caption and hashtags
                  </DialogDescription>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Caption */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="caption" className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Caption
                </Label>
                <motion.span
                  className={`text-sm font-medium ${characterCountColor}`}
                  animate={{ scale: isOverLimit ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {finalCaption.length} / {CAPTION_MAX_LENGTH}
                </motion.span>
              </div>
              <Textarea
                id="caption"
                placeholder="Write your caption here... ✨"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[120px] resize-none focus:ring-2 focus:ring-primary/50 transition-all"
                disabled={isUploading}
              />
            </div>

            {/* Selected Hashtags */}
            {selectedHashtags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  Selected Hashtags ({selectedHashtags.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {selectedHashtags.map((hashtag, index) => (
                    <motion.div
                      key={hashtag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Badge
                        variant="secondary"
                        className="pl-3 pr-2 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 cursor-pointer group"
                        onClick={() => removeHashtag(hashtag)}
                      >
                        #{hashtag}
                        <X className="w-3 h-3 ml-1.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Hashtag Categories */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Hashtag Suggestions</Label>
              
              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.keys(HASHTAG_SUGGESTIONS).map((category) => (
                  <motion.button
                    key={category}
                    onClick={() => setActiveCategory(category as keyof typeof HASHTAG_SUGGESTIONS)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      activeCategory === category
                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={isUploading}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </motion.button>
                ))}
              </div>

              {/* Hashtag Pills */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-wrap gap-2"
                >
                  {HASHTAG_SUGGESTIONS[activeCategory].map((hashtag, index) => {
                    const isSelected = selectedHashtags.includes(hashtag);
                    return (
                      <motion.button
                        key={hashtag}
                        onClick={() => toggleHashtag(hashtag)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-primary to-purple-600 text-white shadow-md shadow-primary/30'
                            : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                        }`}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        disabled={isUploading}
                      >
                        #{hashtag}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Privacy Level */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Privacy Level</Label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => setPrivacyLevel('PUBLIC')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    privacyLevel === 'PUBLIC'
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-border hover:border-border/80'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isUploading}
                >
                  <Globe className={`w-6 h-6 mb-2 ${privacyLevel === 'PUBLIC' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-sm font-semibold">Public</div>
                  <div className="text-xs text-muted-foreground mt-1">Everyone can see</div>
                </motion.button>
                
                <motion.button
                  onClick={() => setPrivacyLevel('SELF_ONLY')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    privacyLevel === 'SELF_ONLY'
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-border hover:border-border/80'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isUploading}
                >
                  <Lock className={`w-6 h-6 mb-2 ${privacyLevel === 'SELF_ONLY' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-sm font-semibold">Private</div>
                  <div className="text-xs text-muted-foreground mt-1">Only you can see</div>
                </motion.button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg shadow-primary/30"
                disabled={isUploading || isOverLimit}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    Upload to TikTok
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

