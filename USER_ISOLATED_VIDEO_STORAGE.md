# User-Isolated Video Storage Implementation

## Overview

This document describes the implementation of persistent, user-isolated video storage using **Cloudflare R2** (object storage) and **Firebase Firestore** (metadata database).

## Problem Solved

**Before**: 
- Videos stored in Railway's ephemeral filesystem → Lost on container restart/redeploy
- Video status stored in memory Map → Lost on restart
- Users could potentially access other users' videos
- Videos returned 404 after reloading

**After**:
- Videos stored in Cloudflare R2 → Persistent and scalable
- Metadata stored in Firestore → Queryable and persistent
- **Security**: Users can ONLY access their own videos
- Videos persist indefinitely and survive restarts

## Architecture

### Storage Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                   │
│  - Requires authentication for all video operations    │
│  - Passes userId automatically to backend              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Proxy)                 │
│  - /api/generate-video → Add userId                    │
│  - /api/video-status/:id → Add userId for validation   │
│  - /api/library/videos → Filter by userId              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Railway Backend (Express)                  │
│  - Generate video locally with FFmpeg                   │
│  - Upload to R2: users/{userId}/videos/{videoId}.mp4   │
│  - Save metadata to Firestore with userId              │
│  - Validate userId on all status checks                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├─────────────────┐
                   ▼                 ▼
         ┌──────────────────┐   ┌────────────────────┐
         │  Cloudflare R2   │   │    Firestore       │
         │  (Video Files)   │   │    (Metadata)      │
         │                  │   │                    │
         │  users/          │   │  videos/           │
         │    {userId}/     │   │    {videoId}       │
         │      videos/     │   │      - userId      │
         │        {id}.mp4  │   │      - videoUrl    │
         └──────────────────┘   │      - status      │
                                │      - title       │
                                └────────────────────┘
```

### Security Model

1. **Authentication Required**: All video operations require valid Firebase session cookie
2. **User Isolation**: 
   - Videos stored at `users/{userId}/videos/{videoId}.mp4`
   - Firestore documents include `userId` field
   - All queries filter by authenticated user's `userId`
3. **Access Validation**: 
   - Video status endpoint validates `userId` matches video owner
   - Returns 404 if user attempts to access another user's video
   - Library endpoint only returns authenticated user's videos

## Files Changed/Created

### Backend (Railway)

#### `railway-backend.js`
**Changes**:
- Added R2 client initialization (AWS S3 SDK)
- Added Firebase Admin initialization
- Added `uploadVideoToR2()` function
- Added `saveVideoMetadata()` function
- Added `getVideoMetadata()` function with userId validation
- Modified `generateVideoHandler()` to require and use `userId`
- Modified `generateVideoSimple()` to upload to R2 after generation
- Modified `videoStatusHandler()` to check Firestore with userId validation

**Key Functions**:
```javascript
// Upload video to R2 with user prefix
uploadVideoToR2(videoPath, videoId, userId)
  → Returns: R2 public URL

// Save metadata to Firestore
saveVideoMetadata(videoId, userId, data)
  → Stores: status, title, videoUrl, error, timestamps

// Get metadata with security validation
getVideoMetadata(videoId, userId)
  → Returns: metadata if user owns video
  → Returns: null if user doesn't own video
```

### Frontend (Next.js)

#### New Files Created

1. **`src/lib/storage/r2.ts`**
   - R2 client wrapper functions
   - Upload, download, and existence check utilities
   - Supports both public and signed URLs

2. **`src/lib/storage/video-metadata.ts`**
   - Firestore metadata management
   - CRUD operations for video documents
   - User isolation enforcement
   - Functions:
     - `saveVideoMetadata()`
     - `getVideoMetadata()` (with ownership validation)
     - `getUserVideos()` (filtered by userId)
     - `updateVideoStatus()`
     - `checkVideoAccess()`

3. **`src/lib/auth/get-user.ts`**
   - Authentication helper for API routes
   - `getCurrentUser()`: Returns user or null
   - `requireCurrentUser()`: Throws if not authenticated

4. **`src/app/api/generate-video/route.ts`**
   - Proxy to Railway backend
   - Adds `userId` from session to request
   - Requires authentication

5. **`src/app/api/video-status/[id]/route.ts`**
   - Proxy to Railway backend
   - Adds `userId` to query parameters
   - Validates user owns the video

6. **`src/app/api/library/videos/route.ts`**
   - Fetches user's videos from Firestore
   - Returns only videos owned by authenticated user
   - Formats data for frontend consumption

7. **`CLOUDFLARE_R2_SETUP.md`**
   - Comprehensive setup guide
   - Environment variable documentation
   - Troubleshooting tips
   - Cost estimates

## Environment Variables

### New Required Variables

```bash
# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=adhd-story-gen-videos
R2_PUBLIC_URL=https://your-custom-domain.com
R2_PUBLIC_ACCESS=false  # true for public bucket, false for signed URLs

# Railway Backend URL
RAILWAY_BACKEND_URL=https://your-railway-app.railway.app
```

### Existing Variables (Must Be Set)

```bash
# Firebase Admin (Already configured)
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
```

## Data Flow

### Video Generation

```
1. User clicks "Generate Video"
   ↓
2. Frontend: Check authentication
   ↓
3. Next.js API: /api/generate-video
   - Extract userId from session cookie
   - Add userId to request body
   ↓
4. Railway Backend: Generate video with FFmpeg
   - Save initial metadata to Firestore (status: processing)
   - Generate video in public/videos/ (temporary)
   ↓
5. Upload to R2
   - Key: users/{userId}/videos/{videoId}.mp4
   - Returns: R2 URL
   ↓
6. Update Firestore
   - Set status: completed
   - Set videoUrl: R2 URL
   ↓
7. Frontend: Poll /api/video-status/{videoId}
   - Backend validates userId matches video owner
   - Returns video URL when ready
```

### Video Status Check

```
1. Frontend polls: /api/video-status/{videoId}
   ↓
2. Next.js API: Extract userId from session
   ↓
3. Railway Backend:
   - Check Firestore for video document
   - Validate userId matches document.userId
   - Return 404 if not owned by user
   ↓
4. Return status + videoUrl (if completed)
```

### Library View

```
1. User visits /library
   ↓
2. Frontend: GET /api/library/videos
   ↓
3. Next.js API: Extract userId from session
   ↓
4. Firestore Query:
   - WHERE userId == {current_user_uid}
   - ORDER BY createdAt DESC
   - LIMIT 50
   ↓
5. Return formatted video list
```

## Security Features

### 1. Authentication Enforcement
- All API routes use `requireCurrentUser()` helper
- Returns 401 if no valid session cookie
- No video operations allowed without authentication

### 2. User Isolation
- R2 storage path includes userId: `users/{userId}/videos/`
- Firestore documents include `userId` field
- All queries filter by authenticated user

### 3. Access Validation
```typescript
// Example from video-metadata.ts
export async function getVideoMetadata(videoId: string, userId: string) {
  const doc = await db.collection('videos').doc(videoId).get();
  const data = doc.data();
  
  // SECURITY: Verify user owns this video
  if (data.userId !== userId) {
    console.warn(`Access denied: User ${userId} attempted to access video ${videoId}`);
    throw new Error('Access denied');
  }
  
  return data;
}
```

### 4. No Public Access to Videos List
- `/api/library/videos` requires authentication
- Returns empty list for unauthenticated users
- Cannot enumerate other users' videos

## Firestore Schema

### Collection: `videos`

```typescript
{
  videoId: string;          // Primary key (document ID)
  userId: string;           // Video owner (indexed)
  status: 'processing' | 'completed' | 'failed';
  title: string;
  subreddit: string;
  videoUrl?: string;        // R2 URL (set when completed)
  thumbnailUrl?: string;    // Optional thumbnail
  error?: string;           // Error message if failed
  createdAt: number;        // Unix timestamp (indexed)
  updatedAt: number;        // Unix timestamp
  duration?: number;        // Video duration in seconds
  metadata?: {
    background?: string;
    voice?: string;
    speedMultiplier?: number;
    isCliffhanger?: boolean;
    wordCount?: number;
    storyLength?: number;
  };
}
```

### Required Firestore Index

```
Collection: videos
Fields:
  - userId (Ascending)
  - createdAt (Descending)
```

## Backward Compatibility

### In-Memory Fallback
The implementation maintains backward compatibility for active processing:

1. **During Video Generation**:
   - Status stored in both memory Map AND Firestore
   - Active polling uses memory Map for real-time updates
   - Completed videos transition to Firestore

2. **After Restart**:
   - In-memory Map is empty
   - All status checks hit Firestore
   - Persistent videos remain accessible

### Migration Path

**Pre-R2 Videos** (generated before R2 setup):
- Still stored in ephemeral filesystem
- Status in memory only
- **Will be lost** on next container restart
- No automatic migration (would require downloading from memory before restart)

**Post-R2 Videos** (generated after R2 setup):
- Stored in R2 permanently
- Metadata in Firestore
- Survive all restarts/redeploys
- Accessible indefinitely

## Testing Checklist

### Setup Verification
- [ ] R2 bucket created
- [ ] R2 API token generated
- [ ] All environment variables set in Railway
- [ ] Application redeployed

### Functional Testing
- [ ] Create a test video
- [ ] Verify video uploads to R2 (check Cloudflare dashboard)
- [ ] Verify metadata saved to Firestore (check Firebase console)
- [ ] Video accessible after completion
- [ ] Reload page → Video still accessible (persistence test)
- [ ] Restart Railway container → Video still accessible

### Security Testing
- [ ] Create video as User A
- [ ] Log in as User B
- [ ] Attempt to access User A's video by videoId → Should return 404
- [ ] Check /library → Should only show User B's videos
- [ ] Attempt API call without authentication → Should return 401

### Cost Monitoring
- [ ] Check R2 dashboard for storage usage
- [ ] Monitor operation counts (uploads/downloads)
- [ ] Verify egress is free (no bandwidth charges)

## Troubleshooting

### Videos Still Disappearing

**Symptom**: Videos return 404 after reload

**Possible Causes**:
1. R2 not configured (check environment variables)
2. R2 upload failing (check Railway logs for errors)
3. Firestore not saving metadata

**Debug**:
```bash
# Check Railway logs for:
[r2] Upload successful: https://...
[firestore] Metadata saved for video ...

# If missing, check environment variables
```

### Access Denied Errors

**Symptom**: "Access denied: You do not own this video"

**Possible Causes**:
1. User not authenticated
2. Attempting to access another user's video
3. userId mismatch in database

**Debug**:
```bash
# Check Firestore document
{
  "videoId": "...",
  "userId": "should-match-current-user-uid",
  ...
}
```

### Video URLs Not Loading

**Symptom**: R2 URL returns 403 or CORS error

**Possible Causes**:
1. R2 bucket not public (if using public URLs)
2. Signed URL expired (if using signed URLs)
3. CORS not configured

**Solution**: Add CORS rules to R2 bucket:
```json
[
  {
    "AllowedOrigins": ["https://taleo.media"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## Dependencies Added

```json
{
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/s3-request-presigner": "^3.x"
}
```

Already installed:
- `firebase-admin` (for Firestore)
- `@google-cloud/firestore` (Firestore client)

## Cost Estimate

### Per User (10 videos/month)

- **Storage**: ~$0.0075/month
- **Class A Ops** (uploads): ~$0.00005/month
- **Class B Ops** (views): ~$0.000036/month
- **Egress**: **FREE**
- **Firestore Reads** (100/day): Free tier
- **Firestore Writes** (10/day): Free tier

**Total**: ~$0.01/month per active user

### Scaling (1000 active users)

- **Storage** (10GB): $0.15/month
- **Operations**: $0.05/month
- **Egress**: **FREE**
- **Firestore**: Free tier covers most usage

**Total**: ~$10/month for 1000 active users

## Next Steps

1. **Get R2 Credentials**:
   - Log in to Cloudflare
   - Create R2 bucket
   - Generate API token

2. **Deploy to Railway**:
   - Add environment variables
   - Redeploy application
   - Monitor logs for successful R2 uploads

3. **Test Thoroughly**:
   - Generate test video
   - Verify persistence (reload page)
   - Test with multiple users

4. **Monitor Costs**:
   - Check Cloudflare R2 dashboard weekly
   - Set up billing alerts if needed

5. **Optional Enhancements**:
   - Add thumbnail generation
   - Implement video deletion (with R2 cleanup)
   - Add video analytics (view counts)
   - Implement video sharing (public URLs with tokens)

## Support

For issues:
1. Check Railway logs
2. Check Cloudflare R2 dashboard
3. Check Firestore console
4. Review error messages in browser console
5. Consult `CLOUDFLARE_R2_SETUP.md` for detailed setup

---

**Implementation Date**: February 2026
**Status**: Ready for deployment (requires R2 credentials)
