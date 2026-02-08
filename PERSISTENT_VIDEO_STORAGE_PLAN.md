# Persistent Video Storage Solution

## Current Problem

### Ephemeral Storage Issues
- Videos stored in `public/videos/` on Railway filesystem
- Railway containers use **ephemeral storage** - wiped on:
  - Every deployment
  - Container restarts
  - Automatic scaling/migrations
- Video status stored in **in-memory Map** - lost on restart
- Result: Videos disappear after minutes/hours → 404 errors

## Recommended Solution: Cloudflare R2

### Why Cloudflare R2?

1. **Free Egress** - No bandwidth costs for video delivery
   - AWS S3 charges ~$0.09/GB for egress
   - With videos, egress is the largest cost
   - R2 = $0.00/GB egress (huge savings)

2. **S3-Compatible API**
   - Drop-in replacement for AWS S3 SDK
   - Backend already uses AWS SDK for backgrounds
   - Minimal code changes needed

3. **Cost-Effective Storage**
   - $0.015/GB/month (similar to S3)
   - Example: 100 videos × 10MB = 1GB = $0.015/month
   - 1000 videos = $0.15/month

4. **High Performance**
   - Fast global CDN
   - Automatic edge caching
   - Low latency worldwide

5. **Railway Integration**
   - Works seamlessly with Railway
   - Just add R2 credentials as env vars
   - No special Railway configuration needed

### Cost Comparison (1000 videos, 10MB each, 100K views/month)

| Provider | Storage | Egress | Total/Month |
|----------|---------|--------|-------------|
| **Cloudflare R2** | $0.15 | **$0.00** | **$0.15** |
| AWS S3 | $0.23 | $90.00 | **$90.23** |
| DigitalOcean Spaces | $5.00 | Included (1TB) | **$5.00** |
| Backblaze B2 | $0.06 | $10.00 | **$10.06** |

**Winner: Cloudflare R2** (600x cheaper than S3!)

## Alternative: AWS S3 with CloudFront CDN

### If you prefer AWS:
- Store videos in S3
- Serve via CloudFront CDN
- CloudFront has lower egress costs than direct S3
- More complex setup but battle-tested

## Implementation Plan

### Phase 1: Setup Cloudflare R2

1. **Create R2 Bucket**
   - Go to Cloudflare Dashboard → R2
   - Create bucket: `taleo-videos` (or your choice)
   - Set public access if needed

2. **Get API Credentials**
   - Generate R2 API token
   - Get Account ID, Access Key, Secret Key
   - Get R2 public URL domain

3. **Add to Railway Environment**
   ```bash
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key
   R2_SECRET_ACCESS_KEY=your_secret_key
   R2_BUCKET_NAME=taleo-videos
   R2_PUBLIC_URL=https://your-bucket.r2.dev
   ```

### Phase 2: Update Backend Code

#### 1. Upload Video to R2 After Generation
```javascript
async function uploadVideoToR2(videoPath, videoId) {
  const AWS = require('aws-sdk');
  
  // Configure for R2 (S3-compatible)
  const s3 = new AWS.S3({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
  });
  
  const videoBuffer = await fsp.readFile(videoPath);
  
  await s3.putObject({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: `videos/${videoId}.mp4`,
    Body: videoBuffer,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000', // Cache for 1 year
  }).promise();
  
  const publicUrl = `${process.env.R2_PUBLIC_URL}/videos/${videoId}.mp4`;
  return publicUrl;
}
```

#### 2. Store Video Metadata in Firestore
```javascript
async function saveVideoMetadata(videoId, metadata) {
  const admin = require('firebase-admin');
  const db = admin.firestore();
  
  await db.collection('videos').doc(videoId).set({
    videoId,
    userId: metadata.userId,
    status: 'completed',
    title: metadata.title,
    subreddit: metadata.subreddit,
    videoUrl: metadata.videoUrl, // R2 URL
    createdAt: Date.now(),
    updatedAt: Date.now(),
    duration: metadata.duration,
    speedMultiplier: metadata.speedMultiplier,
  });
}
```

#### 3. Update Video Status Endpoint
```javascript
async function videoStatusHandler(req, res) {
  const { videoId } = req.params;
  
  // Check in-memory first (for in-progress videos)
  const inMemoryStatus = videoStatus.get(videoId);
  if (inMemoryStatus && inMemoryStatus.status === 'processing') {
    return res.json({ success: true, ...inMemoryStatus });
  }
  
  // Check Firestore for completed videos
  const admin = require('firebase-admin');
  const db = admin.firestore();
  const doc = await db.collection('videos').doc(videoId).get();
  
  if (doc.exists) {
    const data = doc.data();
    return res.json({
      success: true,
      status: data.status,
      videoUrl: data.videoUrl,
      title: data.title,
      // ... other metadata
    });
  }
  
  return res.status(404).json({ success: false, error: 'Video not found' });
}
```

### Phase 3: Cleanup Strategy

#### Auto-Delete Local Files After Upload
```javascript
async function cleanupLocalVideo(videoPath) {
  try {
    await fsp.unlink(videoPath);
    console.log('[cleanup] Deleted local video after R2 upload:', videoPath);
  } catch (err) {
    console.warn('[cleanup] Failed to delete local video:', err.message);
  }
}
```

#### Optional: R2 Lifecycle Rules
- Set expiration for old videos (e.g., 30 days)
- Or keep forever (storage is cheap)

## Benefits of This Solution

### Reliability
✅ Videos never disappear
✅ Survives deployments and restarts
✅ Recoverable from database

### Performance
✅ Fast global CDN delivery
✅ No bandwidth costs
✅ Automatic caching

### Scalability
✅ Unlimited storage
✅ No Railway disk limits
✅ Handle millions of videos

### Cost
✅ ~$0.15/month for 1000 videos
✅ Free bandwidth (vs $90/month on S3)
✅ No surprises in billing

### User Experience
✅ Videos load instantly worldwide
✅ Reliable video playback
✅ Can revisit old videos anytime

## Migration Strategy

### For Existing Videos (If Any)
1. Videos in `public/videos/` can be manually uploaded to R2
2. Update Firestore with new R2 URLs
3. Or: Accept that old ephemeral videos are gone (fresh start)

### For New Videos
- All new videos automatically uploaded to R2
- Metadata stored in Firestore
- Local files cleaned up after upload

## Firestore Schema

### Collection: `videos`
```javascript
{
  videoId: 'uuid-here',
  userId: 'firebase-uid',
  status: 'completed' | 'failed' | 'processing',
  title: 'My Story Title',
  subreddit: 'r/AITA',
  videoUrl: 'https://bucket.r2.dev/videos/uuid.mp4',
  thumbnailUrl: 'https://bucket.r2.dev/thumbnails/uuid.jpg', // optional
  createdAt: 1234567890,
  updatedAt: 1234567890,
  duration: 46.5, // seconds
  speedMultiplier: 1.3,
  metadata: {
    background: 'minecraft',
    voice: 'adam',
    isCliffhanger: true,
    wordCount: 250,
    // ... other metadata
  }
}
```

### Indexes Needed
- `userId` + `createdAt` (for user's video history)
- `status` (for cleanup jobs)
- `createdAt` (for recent videos)

## Alternative: If You Already Have S3

If you're already paying for AWS and want to stick with S3:

1. Use existing S3 bucket
2. Same implementation as R2 (S3-compatible)
3. Consider CloudFront CDN to reduce egress costs
4. Still much better than ephemeral storage

## Implementation Steps

1. **Setup R2** (10 minutes)
   - Create bucket, get credentials
   
2. **Update Railway Backend** (30 minutes)
   - Add upload function
   - Integrate Firestore metadata
   - Update status endpoint
   
3. **Test** (15 minutes)
   - Generate test video
   - Verify upload to R2
   - Check Firestore entry
   - Restart Railway, verify video still accessible
   
4. **Deploy** (5 minutes)
   - Push changes
   - Add R2 env vars to Railway
   - Monitor first production video

Total: ~1 hour of work for permanent solution

## Next Steps

Let me know if you want me to:
1. **Implement full R2 integration** (recommended)
2. **Use AWS S3** instead (if you prefer)
3. **Explore other options** (DigitalOcean Spaces, Backblaze B2)

I recommend **Cloudflare R2** for the free bandwidth and simplicity!
