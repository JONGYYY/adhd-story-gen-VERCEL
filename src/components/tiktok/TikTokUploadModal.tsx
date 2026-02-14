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
import { ToastNotification } from '@/components/ui/toast-notification';
import { 
  Loader2, 
  Sparkles, 
  X, 
  Globe, 
  Lock, 
  Users, 
  MessageSquare, 
  Copy, 
  Scissors,
  AlertCircle,
  Info,
  Play
} from 'lucide-react';

interface CreatorInfo {
  creator_avatar_url?: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

interface TikTokUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (data: { 
    caption: string;
    privacyLevel: string;
    disableComment: boolean;
    disableDuet: boolean;
    disableStitch: boolean;
    brandContentToggle: boolean;
    brandOrganicType?: 'YOUR_BRAND' | 'BRANDED_CONTENT' | 'BOTH';
  }) => void;
  isUploading: boolean;
  videoUrl?: string;
}

const CAPTION_MAX_LENGTH = 2200;

// Map TikTok API privacy levels to display labels
const PRIVACY_LABELS: Record<string, { label: string; icon: any; description: string }> = {
  'PUBLIC_TO_EVERYONE': { label: 'Public', icon: Globe, description: 'Everyone can see' },
  'MUTUAL_FOLLOW_FRIENDS': { label: 'Friends', icon: Users, description: 'Mutual followers' },
  'SELF_ONLY': { label: 'Private', icon: Lock, description: 'Only you' }
};

export function TikTokUploadModal({ open, onOpenChange, onUpload, isUploading, videoUrl }: TikTokUploadModalProps) {
  // Creator info state
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [loadingCreatorInfo, setLoadingCreatorInfo] = useState(false);
  const [creatorInfoError, setCreatorInfoError] = useState<string | null>(null);

  // Form state
  const [caption, setCaption] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<string>(''); // NO DEFAULT!
  
  // Interaction settings (default ALL enabled for user convenience)
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  
  // Commercial content
  const [commercialContentToggle, setCommercialContentToggle] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);

  // Notification
  const [showToast, setShowToast] = useState(false);

  // Fetch creator info when modal opens
  useEffect(() => {
    if (open && !creatorInfo) {
      fetchCreatorInfo();
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setCaption('');
      setPrivacyLevel('');
      setAllowComments(true);
      setAllowDuet(true);
      setAllowStitch(true);
      setCommercialContentToggle(false);
      setYourBrand(false);
      setBrandedContent(false);
      setCreatorInfoError(null);
    }
  }, [open]);

  // Handle commercial content toggle changes
  useEffect(() => {
    if (!commercialContentToggle) {
      setYourBrand(false);
      setBrandedContent(false);
    }
  }, [commercialContentToggle]);

  // Handle branded content privacy constraint
  useEffect(() => {
    if (brandedContent && privacyLevel === 'SELF_ONLY') {
      // Auto-switch to public when branded content is selected
      setPrivacyLevel('PUBLIC_TO_EVERYONE');
    }
  }, [brandedContent]);

  const fetchCreatorInfo = async () => {
    setLoadingCreatorInfo(true);
    setCreatorInfoError(null);
    
    try {
      const response = await fetch('/api/social-media/tiktok/creator-info', {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch creator info');
      }
      
      setCreatorInfo(data.data);
    } catch (error) {
      console.error('Failed to fetch creator info:', error);
      setCreatorInfoError(error instanceof Error ? error.message : 'Failed to load creator info');
    } finally {
      setLoadingCreatorInfo(false);
    }
  };

  const isOverLimit = caption.length > CAPTION_MAX_LENGTH;
  const characterCountColor = isOverLimit 
    ? 'text-red-500' 
    : caption.length > CAPTION_MAX_LENGTH * 0.9 
    ? 'text-yellow-500' 
    : 'text-muted-foreground';

  // Validation for publish button
  const canPublish = () => {
    if (isOverLimit) return false;
    if (!privacyLevel) return false; // Privacy is required
    if (commercialContentToggle && !yourBrand && !brandedContent) return false; // Need at least one when toggle is on
    return true;
  };

  // Get compliance declaration text
  const getComplianceText = () => {
    if (brandedContent) {
      return "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation";
    }
    return "By posting, you agree to TikTok's Music Usage Confirmation";
  };

  // Get brand organic type
  const getBrandOrganicType = (): 'YOUR_BRAND' | 'BRANDED_CONTENT' | 'BOTH' | undefined => {
    if (!commercialContentToggle) return undefined;
    if (yourBrand && brandedContent) return 'BOTH';
    if (yourBrand) return 'YOUR_BRAND';
    if (brandedContent) return 'BRANDED_CONTENT';
    return undefined;
  };

  const handleUpload = () => {
    if (!canPublish()) return;
    
    onUpload({
      caption,
      privacyLevel,
      disableComment: !allowComments,
      disableDuet: !allowDuet,
      disableStitch: !allowStitch,
      brandContentToggle: commercialContentToggle,
      brandOrganicType: getBrandOrganicType()
    });
    
    // Show notification after 2 seconds
    setTimeout(() => {
      setShowToast(true);
      onOpenChange(false);
      
      setTimeout(() => {
        setShowToast(false);
      }, 8000);
    }, 2000);
  };

  return (
    <>
      <ToastNotification
        message="🎬 Upload in progress! It may take a few minutes to process and appear on your profile."
        show={showToast}
        onClose={() => setShowToast(false)}
      />
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-primary/20 max-h-[90vh] overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 to-purple-500/20 p-6 pb-8">
              <div className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <motion.div
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20"
                  >
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </motion.div>
                  <div>
                    <DialogTitle className="text-2xl font-bold text-white">Upload to TikTok</DialogTitle>
                    <DialogDescription className="text-gray-300">
                      Customize your video details
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Creator Info Section */}
              {loadingCreatorInfo && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading creator info...</span>
                </div>
              )}
              
              {creatorInfoError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-500">{creatorInfoError}</p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-red-500 hover:text-red-600"
                      onClick={fetchCreatorInfo}
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              )}
              
              {creatorInfo && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold">
                    {creatorInfo.creator_nickname?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Posting to: @{creatorInfo.creator_username}</p>
                    <p className="text-xs text-muted-foreground">{creatorInfo.creator_nickname}</p>
                  </div>
                </div>
              )}

              {/* Video Preview */}
              {videoUrl && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Video Preview</Label>
                  <div className="relative aspect-[9/16] max-w-[300px] mx-auto bg-black rounded-lg overflow-hidden">
                    <video 
                      src={videoUrl} 
                      controls 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Caption */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="caption" className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Caption *
                  </Label>
                  <motion.span
                    className={`text-sm font-medium ${characterCountColor}`}
                    animate={{ scale: isOverLimit ? [1, 1.1, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {caption.length} / {CAPTION_MAX_LENGTH}
                  </motion.span>
                </div>
                <Textarea
                  id="caption"
                  placeholder="Write your caption here..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="min-h-[100px] resize-none focus:ring-2 focus:ring-primary/50 transition-all"
                  disabled={isUploading}
                />
              </div>

              {/* Privacy Level - NO DEFAULT! */}
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Privacy Level *
                </Label>
                {!privacyLevel && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Please select who can see your video
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {creatorInfo?.privacy_level_options.map((option) => {
                    const config = PRIVACY_LABELS[option];
                    if (!config) return null;
                    
                    const Icon = config.icon;
                    const isSelected = privacyLevel === option;
                    const isDisabled = brandedContent && option === 'SELF_ONLY';
                    
                    return (
                      <motion.button
                        key={option}
                        onClick={() => !isDisabled && setPrivacyLevel(option)}
                        className={`p-4 rounded-xl border-2 transition-all relative ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                            : isDisabled
                            ? 'border-border/50 bg-muted/30 opacity-50 cursor-not-allowed'
                            : 'border-border hover:border-border/80'
                        }`}
                        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                        disabled={isUploading || isDisabled}
                        title={isDisabled ? "Branded content visibility cannot be set to private" : ""}
                      >
                        <Icon className={`w-6 h-6 mb-2 mx-auto ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-sm font-semibold">{config.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{config.description}</div>
                        {isDisabled && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Interaction Settings */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Interaction Settings</Label>
                <p className="text-xs text-muted-foreground">Control who can interact with your video (enabled by default)</p>
                
                <div className="space-y-2">
                  {/* Allow Comments */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      id="allow-comments"
                      checked={allowComments}
                      onChange={(e) => setAllowComments(e.target.checked)}
                      disabled={isUploading || creatorInfo?.comment_disabled}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                    />
                    <Label 
                      htmlFor="allow-comments" 
                      className={`flex-1 cursor-pointer flex items-center gap-2 ${
                        creatorInfo?.comment_disabled ? 'opacity-50' : ''
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Allow Comments
                      {creatorInfo?.comment_disabled && (
                        <Badge variant="secondary" className="text-xs">Disabled in settings</Badge>
                      )}
                    </Label>
                  </div>

                  {/* Allow Duet */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      id="allow-duet"
                      checked={allowDuet}
                      onChange={(e) => setAllowDuet(e.target.checked)}
                      disabled={isUploading || creatorInfo?.duet_disabled}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                    />
                    <Label 
                      htmlFor="allow-duet" 
                      className={`flex-1 cursor-pointer flex items-center gap-2 ${
                        creatorInfo?.duet_disabled ? 'opacity-50' : ''
                      }`}
                    >
                      <Copy className="w-4 h-4" />
                      Allow Duet
                      {creatorInfo?.duet_disabled && (
                        <Badge variant="secondary" className="text-xs">Disabled in settings</Badge>
                      )}
                    </Label>
                  </div>

                  {/* Allow Stitch */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      id="allow-stitch"
                      checked={allowStitch}
                      onChange={(e) => setAllowStitch(e.target.checked)}
                      disabled={isUploading || creatorInfo?.stitch_disabled}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                    />
                    <Label 
                      htmlFor="allow-stitch" 
                      className={`flex-1 cursor-pointer flex items-center gap-2 ${
                        creatorInfo?.stitch_disabled ? 'opacity-50' : ''
                      }`}
                    >
                      <Scissors className="w-4 h-4" />
                      Allow Stitch
                      {creatorInfo?.stitch_disabled && (
                        <Badge variant="secondary" className="text-xs">Disabled in settings</Badge>
                      )}
                    </Label>
                  </div>
                </div>
              </div>

              {/* Commercial Content Disclosure */}
              <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Label className="text-base font-semibold">Commercial Content Disclosure</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Indicate if your content promotes yourself, a brand, product or service
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={commercialContentToggle}
                    onChange={(e) => setCommercialContentToggle(e.target.checked)}
                    disabled={isUploading}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                  />
                </div>

                {commercialContentToggle && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-3 border-t border-border"
                  >
                    <p className="text-xs text-muted-foreground">
                      Select at least one option to proceed with publishing
                    </p>

                    {/* Your Brand */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <input
                          type="checkbox"
                          id="your-brand"
                          checked={yourBrand}
                          onChange={(e) => setYourBrand(e.target.checked)}
                          disabled={isUploading}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="your-brand" className="flex-1 cursor-pointer">
                          <span className="font-medium">Your Brand</span>
                          <p className="text-xs text-muted-foreground">You are promoting yourself or your own business</p>
                        </Label>
                      </div>
                      {yourBrand && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            Your video will be labeled as "Promotional content"
                          </Badge>
                        </motion.div>
                      )}
                    </div>

                    {/* Branded Content */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <input
                          type="checkbox"
                          id="branded-content"
                          checked={brandedContent}
                          onChange={(e) => setBrandedContent(e.target.checked)}
                          disabled={isUploading}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="branded-content" className="flex-1 cursor-pointer">
                          <span className="font-medium">Branded Content</span>
                          <p className="text-xs text-muted-foreground">You are promoting another brand or a third party</p>
                        </Label>
                      </div>
                      {brandedContent && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-2"
                        >
                          <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                            Your video will be labeled as "Paid partnership"
                          </Badge>
                          {privacyLevel === 'SELF_ONLY' && (
                            <p className="text-xs text-amber-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Privacy automatically switched to Public (branded content cannot be private)
                            </p>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Compliance Declaration */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {getComplianceText()}
                </p>
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
                <div className="relative flex-1">
                  <Button
                    onClick={handleUpload}
                    className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg shadow-primary/30"
                    disabled={isUploading || !canPublish()}
                    title={
                      commercialContentToggle && !yourBrand && !brandedContent
                        ? "You need to indicate if your content promotes yourself, a third party, or both"
                        : !privacyLevel
                        ? "Please select a privacy level"
                        : ""
                    }
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
                        Post to TikTok
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
