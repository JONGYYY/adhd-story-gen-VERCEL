# Cloudflare R2 Persistent Video Storage Setup

## Overview

This guide explains how to set up Cloudflare R2 for persistent video storage. Videos are now stored permanently and are only accessible to the user who created them.

## Why Cloudflare R2?

- **Free Egress**: No bandwidth charges (unlike AWS S3)
- **S3-Compatible**: Works with AWS SDK
- **Cost-Effective**: ~$0.015/GB/month storage
- **Persistent**: Videos survive container restarts/redeployments
- **Private**: User-isolated storage with Firestore metadata

## Setup Steps

### 1. Create Cloudflare R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage** in the sidebar
3. Click **Create bucket**
4. Choose a name (e.g., `adhd-story-gen-videos`)
5. Click **Create bucket**

### 2. Create R2 API Token

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API Token**
3. Configure permissions:
   - **Object Read & Write** on your bucket
4. Click **Create API Token**
5. **SAVE THESE CREDENTIALS** (shown only once):
   - Access Key ID
   - Secret Access Key
   - Account ID (also visible in R2 dashboard URL)

### 3. Configure Public Access (Optional)

For public video URLs without signed URLs:

1. Go to your R2 bucket settings
2. Click **Settings** → **Public Access**
3. Click **Connect Domain** and add a custom domain OR
4. Enable **Public Bucket** (not recommended for production)

Alternatively, use signed URLs (default behavior) for private access.

### 4. Add Environment Variables

Add these environment variables to your Railway deployment:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=adhd-story-gen-videos

# Public URL for R2 bucket (if using custom domain or public access)
R2_PUBLIC_URL=https://your-custom-domain.com
# OR for public bucket: https://pub-xxxxx.r2.dev

# Set to 'true' if using public bucket (no signed URLs)
R2_PUBLIC_ACCESS=false

# Railway Backend URL (for Next.js → Railway proxy)
RAILWAY_BACKEND_URL=https://your-railway-app.railway.app
```

### 5. Firebase Admin (Already Configured)

Ensure these are set (should already be configured):

```bash
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account-email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## How It Works

### Video Generation Flow

1. **User Creates Video**:
   - Frontend authenticates user via Firebase Auth
   - Next.js API route adds `userId` to request
   - Railway backend generates video locally

2. **Video Upload**:
   - After generation, video is uploaded to R2 at:
     ```
     users/{userId}/videos/{videoId}.mp4
     ```
   - Local ephemeral copy is kept temporarily for immediate access

3. **Metadata Storage**:
   - Video metadata stored in Firestore `videos` collection
   - Includes: `userId`, `videoId`, `status`, `title`, `videoUrl`, etc.

4. **Security**:
   - Users can only access videos with matching `userId`
   - Video status endpoint validates ownership
   - R2 paths are user-prefixed for organization

### Video Access Flow

1. **Status Check**:
   - Frontend polls `/api/video-status/:id`
   - Next.js API adds `userId` to query
   - Railway backend checks Firestore for ownership
   - Returns 404 if user doesn't own video

2. **Video Playback**:
   - Video URL points to R2 (public URL or signed URL)
   - Signed URLs expire after 1 hour by default
   - Can be refreshed on-demand

3. **Library View**:
   - Frontend calls `/api/library/videos`
   - Firestore query filters by `userId`
   - Returns only user's videos

## Migration from Ephemeral Storage

**Current State**:
- Videos stored in `public/videos/` (ephemeral)
- Status in memory Map (lost on restart)

**After R2 Setup**:
- Videos stored in R2 (persistent)
- Status in Firestore (persistent)
- Old videos (pre-R2) will be lost on next restart
- New videos will persist indefinitely

## Cost Estimate

For a typical user generating ~10 videos/month:

- **Storage**: 10 videos × 50MB × $0.015/GB = ~$0.0075/month
- **Class A Operations** (uploads): 10 × $0.0045/1000 = ~$0.00005/month
- **Class B Operations** (downloads): 100 views × $0.00036/1000 = ~$0.000036/month
- **Egress**: **FREE** (Cloudflare R2's main benefit)

**Total**: ~$0.01/month per user

## Verification

After setup, verify everything works:

1. Create a test video
2. Wait for completion
3. Reload the page (video should still be accessible)
4. Check Railway logs for:
   ```
   [r2] Upload successful: https://...
   [firestore] Metadata saved for video ...
   ```
5. Check Cloudflare R2 dashboard for uploaded video
6. Check Firestore console for video document

## Troubleshooting

### Videos still disappearing

- Check Railway logs for R2 upload errors
- Verify all environment variables are set correctly
- Ensure R2 API token has write permissions

### "Access denied" errors

- Check Firestore rules allow authenticated writes
- Verify `userId` is being passed correctly

### Video URLs not loading

- If using custom domain: verify DNS is configured
- If using signed URLs: check token hasn't expired
- Verify R2 bucket has correct CORS settings:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## Next Steps

1. Get R2 credentials from Cloudflare
2. Add environment variables to Railway
3. Redeploy application
4. Test video generation and persistence
5. Monitor costs in Cloudflare dashboard

## Firestore Index (If Needed)

If you see Firestore index errors, create this composite index:

- **Collection**: `videos`
- **Fields**:
  - `userId` (Ascending)
  - `createdAt` (Descending)

The Firebase console error message will include a direct link to create the index.
