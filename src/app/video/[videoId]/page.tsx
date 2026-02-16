'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { TikTokUploadModal } from '@/components/tiktok/TikTokUploadModal';
import { YouTubeUploadModal } from '@/components/youtube/YouTubeUploadModal';

type VideoStatus = {
  status: 'generating' | 'ready' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
  title?: string; // Story title for auto-filling upload modals
  duration?: number; // Video duration in seconds (for TikTok max duration check)
};

export default function VideoPage() {
  const params = useParams();
  const videoId = params.videoId as string;
  const [videoStatus, setVideoStatus] = useState<VideoStatus>({ status: 'generating' });
  const [videoError, setVideoError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingYouTube, setIsUploadingYouTube] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const checkStatusTimeoutRef = useRef<NodeJS.Timeout>();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/video-status/${videoId}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch video status');
        }
        const data = await response.json();
        // Normalize status and ensure absolute video URL for playback
        const uiStatus = (data.status === 'completed') ? 'ready' : (data.status === 'processing' ? 'generating' : data.status);
        let videoUrl = data.videoUrl as string | undefined;
        if (videoUrl && !videoUrl.startsWith('http')) {
          const API_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_URL || 'https://api.taleo.media';
          videoUrl = `${API_BASE}${videoUrl}`;
        }
        console.log('[Video Page] API response data:', { status: data.status, title: data.title, hasVideoUrl: !!data.videoUrl, duration: data.duration });
        
        setVideoStatus({
          status: uiStatus,
          progress: typeof data.progress === 'number' ? data.progress : (uiStatus === 'ready' ? 100 : 0),
          error: data.error,
          videoUrl: uiStatus === 'ready' ? videoUrl : undefined,
          title: data.title || undefined, // Include story title from backend
          duration: data.duration || undefined // Include video duration for TikTok validation
        });
        
        console.log('[Video Page] videoStatus updated with title:', data.title, 'duration:', data.duration);

        // If still generating, check again in 2 seconds
        if (data.status === 'generating' || data.status === 'processing') {
          checkStatusTimeoutRef.current = setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error('Status check error:', error);
        setVideoStatus({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to check video status',
        });
      }
    };

    checkStatus();

    // Cleanup timeout on unmount
    return () => {
      if (checkStatusTimeoutRef.current) {
        clearTimeout(checkStatusTimeoutRef.current);
      }
    };
  }, [videoId]);

  const handleVideoError = async (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video playback error:', e);
    
    // If we haven't retried too many times, try reloading the video
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      if (videoRef.current) {
        try {
          // Force reload the video source
          videoRef.current.load();
          await videoRef.current.play();
          setVideoError(null);
          return;
        } catch (err) {
          console.error('Retry failed:', err);
        }
      }
    }
    
    setVideoError('Failed to load video. Please try refreshing the page.');
  };

  const handleRetry = () => {
    setVideoError(null);
    setRetryCount(0);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handleDownload = async () => {
    if (!videoStatus.videoUrl) return;

    try {
      const response = await fetch(videoStatus.videoUrl);
      if (!response.ok) throw new Error('Failed to download video');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_${videoId}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      setVideoError('Failed to download video. Please try again.');
    }
  };

  const handleTikTokUpload = async (data: { 
    caption: string;
    privacyLevel: string;
    disableComment: boolean;
    disableDuet: boolean;
    disableStitch: boolean;
    brandContentToggle: boolean;
    brandOrganicType?: 'YOUR_BRAND' | 'BRANDED_CONTENT' | 'BOTH';
  }) => {
    if (!videoStatus.videoUrl) return;
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      // Get the video file
      const videoResponse = await fetch(videoStatus.videoUrl);
      if (!videoResponse.ok) throw new Error('Failed to fetch video');
      const videoBlob = await videoResponse.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('video', videoBlob, `video_${videoId}.mp4`);
      formData.append('title', data.caption);
      formData.append('privacy_level', data.privacyLevel);
      formData.append('disable_comment', data.disableComment.toString());
      formData.append('disable_duet', data.disableDuet.toString());
      formData.append('disable_stitch', data.disableStitch.toString());
      formData.append('brand_content_toggle', data.brandContentToggle.toString());
      if (data.brandOrganicType) {
        formData.append('brand_organic_type', data.brandOrganicType);
      }
      
      // Upload to TikTok
      const uploadResponse = await fetch('/api/social-media/tiktok/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(error || 'Failed to upload to TikTok');
      }
      
      const result = await uploadResponse.json();
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      // Close modal and show initial success message
      setShowUploadModal(false);
      
      // Show appropriate success message based on privacy level
      const privacyLabel = data.privacyLevel === 'PUBLIC_TO_EVERYONE' 
        ? 'PUBLIC' 
        : data.privacyLevel === 'MUTUAL_FOLLOW_FRIENDS'
        ? 'FRIENDS'
        : 'PRIVATE';
      const message = data.privacyLevel === 'PUBLIC_TO_EVERYONE' 
        ? 'Video uploaded to TikTok as PUBLIC! Checking status...' 
        : `Video uploaded to TikTok as ${privacyLabel}. Checking status...`;
      
      alert(message);
      
      // Point 5e: Poll publish status API to show users the status of their post
      if (result.result?.publish_id) {
        console.log('Starting TikTok publish status polling for publish_id:', result.result.publish_id);
        
        // Poll status multiple times until video is processed or fails
        const pollTikTokStatus = async (publishId: string, attempt = 1, maxAttempts = 20) => {
          try {
            console.log(`TikTok status poll attempt ${attempt}/${maxAttempts}`);
            
            const statusResponse = await fetch('/api/social-media/tiktok/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publishId })
            });
            
            if (!statusResponse.ok) {
              console.error('Status check failed:', statusResponse.status);
              return;
            }
            
            const statusData = await statusResponse.json();
            const status = statusData.data?.status || 'UNKNOWN';
            console.log(`TikTok publish status (attempt ${attempt}):`, status);
            
            // Terminal states - stop polling
            if (status === 'PUBLISH_COMPLETE') {
              alert('✅ Your video is now live on TikTok!');
              return;
            } else if (status === 'FAILED') {
              const failReason = statusData.data?.fail_reason || 'Unknown error';
              alert(`❌ TikTok upload failed: ${failReason}`);
              return;
            }
            
            // Processing states - continue polling
            if (status === 'PROCESSING_DOWNLOAD' || status === 'PROCESSING_UPLOAD' || status === 'PUBLISH_VIDEO_SUCCESS') {
              if (attempt === 1) {
                alert('⏳ Your video is uploading to TikTok. You\'ll be notified when it\'s live. Processing may take a few minutes.');
              }
              
              // Continue polling if we haven't reached max attempts
              if (attempt < maxAttempts) {
                // Exponential backoff: 3s, 5s, 8s, 10s, 10s...
                const delay = Math.min(3000 + (attempt * 1000), 10000);
                setTimeout(() => pollTikTokStatus(publishId, attempt + 1, maxAttempts), delay);
              } else {
                alert('⏰ Your video is still processing on TikTok. Check your profile in a few minutes.');
              }
              return;
            }
            
            // Unknown status - show info and continue polling
            console.warn('Unknown TikTok status:', status);
            if (attempt < maxAttempts) {
              setTimeout(() => pollTikTokStatus(publishId, attempt + 1, maxAttempts), 5000);
            }
            
          } catch (statusError) {
            console.error('Failed to check TikTok status:', statusError);
            // Don't show error to user - upload was successful, status check is just extra info
          }
        };
        
        // Start polling after 3 seconds (give TikTok time to initialize)
        setTimeout(() => pollTikTokStatus(result.result.publish_id), 3000);
      }
      
    } catch (error) {
      console.error('TikTok upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload to TikTok');
    } finally {
      setIsUploading(false);
    }
  };

  const handleYouTubeUpload = async (data: { 
    title: string; 
    description: string; 
    tags: string[]; 
    privacyStatus: 'public' | 'unlisted' | 'private' 
  }) => {
    if (!videoStatus.videoUrl) return;
    
    setIsUploadingYouTube(true);
    setUploadError(null);
    
    try {
      // Get the video file with better error handling
      console.log('Fetching video from:', videoStatus.videoUrl);
      const videoResponse = await fetch(videoStatus.videoUrl);
      if (!videoResponse.ok) {
        console.error('Video fetch failed:', videoResponse.status, videoResponse.statusText);
        throw new Error(`Failed to fetch video file: ${videoResponse.status} ${videoResponse.statusText}. The video may have expired or been deleted.`);
      }
      const videoBlob = await videoResponse.blob();
      console.log('Video blob retrieved, size:', videoBlob.size);
      
      // Add tags to description if provided
      const descriptionWithTags = data.tags.length > 0 
        ? `${data.description}\n\nTags: ${data.tags.join(', ')}`
        : data.description;
      
      // Create form data
      const formData = new FormData();
      formData.append('video', videoBlob, `video_${videoId}.mp4`);
      formData.append('title', data.title);
      formData.append('description', descriptionWithTags);
      formData.append('privacy_status', data.privacyStatus);
      
      // Upload to YouTube
      console.log('Uploading to YouTube API...');
      const uploadResponse = await fetch('/api/social-media/youtube/upload', {
        method: 'POST',
        body: formData
      });
      
      console.log('YouTube API response status:', uploadResponse.status);
      
      // Handle 502 Bad Gateway (Railway proxy timeout - upload likely still processing)
      if (uploadResponse.status === 502) {
        console.warn('⚠️ 502 Bad Gateway - Railway proxy timeout, but upload likely succeeded');
        setShowYouTubeModal(false);
        alert('⏳ Upload Processing\n\nYour video upload has been initiated! Large videos can take 2-5 minutes to process.\n\n✅ The upload is likely completing in the background.\n\n📺 Check your YouTube channel in a few minutes - your video should appear there!\n\n(This timeout is normal for large files)');
        setIsUploadingYouTube(false);
        return;
      }
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('YouTube upload failed:', error);
        
        // Check if error contains 502 info
        if (error.includes('502') || error.includes('Bad Gateway') || error.includes('Application failed to respond')) {
          console.warn('⚠️ 502 error in response body - upload likely succeeded');
          setShowYouTubeModal(false);
          alert('⏳ Upload Processing\n\nYour video upload has been initiated! Large videos can take 2-5 minutes to process.\n\n✅ The upload is likely completing in the background.\n\n📺 Check your YouTube channel in a few minutes - your video should appear there!');
          setIsUploadingYouTube(false);
          return;
        }
        
        throw new Error(error || `Failed to upload to YouTube (${uploadResponse.status})`);
      }
      
      const result = await uploadResponse.json();
      console.log('YouTube upload result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      // Close modal and show success message
      setShowYouTubeModal(false);
      
      const message = `✅ Video uploaded to YouTube as ${data.privacyStatus.toUpperCase()}!\n\nVideo URL: ${result.videoUrl}\n\nIt may take a few minutes to process on YouTube.`;
      alert(message);
      
    } catch (error) {
      console.error('YouTube upload error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload to YouTube';
      
      // Check if it's a timeout/502 error (upload likely succeeded)
      if (errorMsg.includes('502') || errorMsg.includes('Bad Gateway') || 
          errorMsg.includes('Application failed to respond') || errorMsg.includes('timeout') ||
          errorMsg.includes('timed out') || errorMsg.includes('ETIMEDOUT')) {
        console.warn('⚠️ Timeout error detected - upload likely succeeded in background');
        setShowYouTubeModal(false);
        alert('⏳ Upload Processing\n\nYour video upload has been initiated! Large videos can take 2-5 minutes to process.\n\n✅ The upload is likely completing in the background.\n\n📺 Check your YouTube channel in a few minutes - your video should appear there!\n\n(This timeout is normal for large files - Railway has a 60-120 second proxy limit)');
        setIsUploadingYouTube(false);
        return;
      }
      
      // Show user-friendly error for other issues
      if (errorMsg.includes('not connected')) {
        alert('❌ YouTube not connected!\n\nPlease go to Settings → Social Media and connect your YouTube account first.');
      } else if (errorMsg.includes('quotaExceeded')) {
        alert('❌ YouTube API quota exceeded!\n\nYouTube has daily upload limits. Try again tomorrow or request a quota increase from Google Cloud Console.');
      } else if (errorMsg.includes('expired')) {
        alert('❌ YouTube token expired!\n\nPlease go to Settings → Social Media, disconnect and reconnect your YouTube account.');
      } else {
        alert(`❌ Upload failed:\n\n${errorMsg}`);
      }
      
      setUploadError(errorMsg);
    } finally {
      setIsUploadingYouTube(false);
    }
  };

  return (
    <PageContainer>
      <TikTokUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUpload={handleTikTokUpload}
        isUploading={isUploading}
        videoUrl={videoStatus.videoUrl}
        videoDuration={videoStatus.duration}
      />
      
      <YouTubeUploadModal
        open={showYouTubeModal}
        onOpenChange={setShowYouTubeModal}
        onUpload={handleYouTubeUpload}
        isUploading={isUploadingYouTube}
        initialTitle={videoStatus.title || ''}
      />
      
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Your Video</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            {videoStatus.status === 'generating' && (
              <div className="text-center py-8">
                <div className="mb-4">
                  <div className="animate-spin text-4xl inline-block">⚙️</div>
                </div>
                <h2 className="text-xl font-semibold mb-2">Generating Your Video</h2>
                <p className="text-gray-400 mb-4">This may take a few minutes...</p>
                {videoStatus.progress !== undefined && (
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${videoStatus.progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {videoStatus.status === 'ready' && videoStatus.videoUrl && (
              <div className="text-center py-8">
                <div className="mb-4 text-4xl">🎉</div>
                <h2 className="text-xl font-semibold mb-4">Your Video is Ready!</h2>
                
                <div className="mb-6">
                  {videoError ? (
                    <div className="text-center">
                      <div className="text-red-400 mb-4">{videoError}</div>
                      <Button onClick={handleRetry} variant="outline" className="mb-4">
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      className="w-full rounded-lg"
                      controls
                      src={videoStatus.videoUrl}
                      onError={handleVideoError}
                    />
                  )}
                </div>

                {uploadError && (
                  <div className="text-red-400 mb-4">
                    {uploadError}
                  </div>
                )}

                <div className="flex justify-center gap-4">
                  <Button
                    onClick={handleDownload}
                    className="px-6"
                    disabled={!!videoError}
                  >
                    Download Video
                  </Button>
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    className="px-6"
                    disabled={!!videoError || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <span className="animate-spin mr-2">⚙️</span>
                        Uploading to TikTok...
                      </>
                    ) : (
                      'Upload to TikTok'
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      console.log('[Video Page] Opening YouTube modal with title:', videoStatus.title);
                      setShowYouTubeModal(true);
                    }}
                    className="px-6 bg-red-600 hover:bg-red-700"
                    disabled={!!videoError || isUploadingYouTube}
                  >
                    {isUploadingYouTube ? (
                      <>
                        <span className="animate-spin mr-2">⚙️</span>
                        Uploading to YouTube...
                      </>
                    ) : (
                      'Upload to YouTube'
                    )}
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/create'}
                    variant="outline"
                    className="px-6"
                  >
                    Create Another
                  </Button>
                </div>
              </div>
            )}

            {videoStatus.status === 'failed' && (
              <div className="text-center py-8">
                <div className="mb-4 text-4xl">❌</div>
                <h2 className="text-xl font-semibold mb-2">Video Generation Failed</h2>
                <p className="text-red-400 mb-4">{videoStatus.error || 'An error occurred'}</p>
                <Button
                  onClick={() => window.location.href = '/create'}
                  variant="outline"
                  className="px-6"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 