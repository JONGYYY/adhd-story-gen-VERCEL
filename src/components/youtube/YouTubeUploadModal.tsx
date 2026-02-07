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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Tag, Globe, Lock, Eye, Sparkles } from 'lucide-react';

interface YouTubeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (data: { 
    title: string; 
    description: string; 
    tags: string[]; 
    privacyStatus: 'public' | 'unlisted' | 'private' 
  }) => void;
  isUploading: boolean;
  initialTitle?: string; // Story title to auto-fill
}

// Pre-written tag suggestions categorized
const TAG_SUGGESTIONS = {
  trending: ['viral', 'trending', 'shorts', 'fyp', 'mustwatch'],
  story: ['storytime', 'reddit stories', 'reddit', 'true story', 'storytelling'],
  content: ['aita', 'am i the asshole', 'drama', 'crazy story', 'nosleep'],
  engagement: ['watch til end', 'plot twist', 'shocking', 'unbelievable', 'real story']
};

const TITLE_MAX_LENGTH = 100; // YouTube's title limit
const DESCRIPTION_MAX_LENGTH = 5000; // YouTube's description limit
const MAX_TAGS = 15; // YouTube's tag limit

export function YouTubeUploadModal({ open, onOpenChange, onUpload, isUploading, initialTitle }: YouTubeUploadModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('public');
  const [activeCategory, setActiveCategory] = useState<keyof typeof TAG_SUGGESTIONS>('trending');

  // Auto-fill title when modal opens with story title
  // IMPORTANT: Set title whenever modal opens (not just when title is empty)
  useEffect(() => {
    if (open && initialTitle) {
      // Truncate title to YouTube's 100 char limit
      const truncatedTitle = initialTitle.length > TITLE_MAX_LENGTH 
        ? initialTitle.substring(0, TITLE_MAX_LENGTH) 
        : initialTitle;
      setTitle(truncatedTitle);
      console.log('[YouTube Modal] Auto-filled title:', truncatedTitle);
    } else if (open && !initialTitle) {
      console.warn('[YouTube Modal] Modal opened but no title provided');
    }
  }, [open, initialTitle]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setSelectedTags([]);
      setPrivacyStatus('public');
      setActiveCategory('trending');
    }
  }, [open]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < MAX_TAGS) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const isTitleOverLimit = title.length > TITLE_MAX_LENGTH;
  const isDescriptionOverLimit = description.length > DESCRIPTION_MAX_LENGTH;
  
  const titleCountColor = isTitleOverLimit 
    ? 'text-red-500' 
    : title.length > TITLE_MAX_LENGTH * 0.9 
    ? 'text-yellow-500' 
    : 'text-muted-foreground';
    
  const descriptionCountColor = isDescriptionOverLimit 
    ? 'text-red-500' 
    : description.length > DESCRIPTION_MAX_LENGTH * 0.9 
    ? 'text-yellow-500' 
    : 'text-muted-foreground';

  const handleUpload = () => {
    if (isTitleOverLimit || isDescriptionOverLimit || !title.trim()) return;
    onUpload({
      title: title.trim(),
      description: description.trim(),
      tags: selectedTags,
      privacyStatus
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-red-500/20 max-h-[90vh] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header with gradient */}
          <div className="relative overflow-hidden bg-gradient-to-br from-red-500/20 to-red-600/20 p-6 pb-8 sticky top-0 z-10">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-red-600/10"
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
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </motion.div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white">Upload to YouTube</DialogTitle>
                  <DialogDescription className="text-gray-300">
                    Customize your video details
                  </DialogDescription>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title" className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-red-500" />
                  Title *
                </Label>
                <motion.span
                  className={`text-sm font-medium ${titleCountColor}`}
                  animate={{ scale: isTitleOverLimit ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {title.length} / {TITLE_MAX_LENGTH}
                </motion.span>
              </div>
              <Input
                id="title"
                placeholder="Enter your video title... ✨"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="focus:ring-2 focus:ring-red-500/50 transition-all"
                disabled={isUploading}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description" className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-red-500" />
                  Description
                </Label>
                <motion.span
                  className={`text-sm font-medium ${descriptionCountColor}`}
                  animate={{ scale: isDescriptionOverLimit ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {description.length} / {DESCRIPTION_MAX_LENGTH}
                </motion.span>
              </div>
              <Textarea
                id="description"
                placeholder="Write your video description here... (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] resize-none focus:ring-2 focus:ring-red-500/50 transition-all"
                disabled={isUploading}
              />
            </div>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-red-500" />
                  Selected Tags ({selectedTags.length}/{MAX_TAGS})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag, index) => (
                    <motion.div
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Badge
                        variant="secondary"
                        className="pl-3 pr-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 cursor-pointer group"
                        onClick={() => removeTag(tag)}
                      >
                        {tag}
                        <X className="w-3 h-3 ml-1.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tag Categories */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Tag Suggestions</Label>
              
              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.keys(TAG_SUGGESTIONS).map((category) => (
                  <motion.button
                    key={category}
                    onClick={() => setActiveCategory(category as keyof typeof TAG_SUGGESTIONS)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      activeCategory === category
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
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

              {/* Tag Pills */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-wrap gap-2"
                >
                  {TAG_SUGGESTIONS[activeCategory].map((tag, index) => {
                    const isSelected = selectedTags.includes(tag);
                    const isDisabled = !isSelected && selectedTags.length >= MAX_TAGS;
                    return (
                      <motion.button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md shadow-red-500/30'
                            : isDisabled
                            ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
                            : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                        }`}
                        whileHover={{ scale: isDisabled ? 1 : 1.05, y: isDisabled ? 0 : -2 }}
                        whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        disabled={isUploading || isDisabled}
                      >
                        {tag}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Privacy Level */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Privacy Level</Label>
              <div className="grid grid-cols-3 gap-3">
                <motion.button
                  onClick={() => setPrivacyStatus('public')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    privacyStatus === 'public'
                      ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                      : 'border-border hover:border-border/80'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isUploading}
                >
                  <Globe className={`w-6 h-6 mb-2 mx-auto ${privacyStatus === 'public' ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <div className="text-sm font-semibold">Public</div>
                  <div className="text-xs text-muted-foreground mt-1">Everyone</div>
                </motion.button>
                
                <motion.button
                  onClick={() => setPrivacyStatus('unlisted')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    privacyStatus === 'unlisted'
                      ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                      : 'border-border hover:border-border/80'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isUploading}
                >
                  <Eye className={`w-6 h-6 mb-2 mx-auto ${privacyStatus === 'unlisted' ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <div className="text-sm font-semibold">Unlisted</div>
                  <div className="text-xs text-muted-foreground mt-1">Link only</div>
                </motion.button>
                
                <motion.button
                  onClick={() => setPrivacyStatus('private')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    privacyStatus === 'private'
                      ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                      : 'border-border hover:border-border/80'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isUploading}
                >
                  <Lock className={`w-6 h-6 mb-2 mx-auto ${privacyStatus === 'private' ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <div className="text-sm font-semibold">Private</div>
                  <div className="text-xs text-muted-foreground mt-1">Only you</div>
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
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-500/90 hover:to-red-600/90 text-white shadow-lg shadow-red-500/30"
                disabled={isUploading || isTitleOverLimit || isDescriptionOverLimit || !title.trim()}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Upload to YouTube
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
