# Simplified Setup - Direct Railway Backend Integration

## Architecture Change

**Previous Complex Setup** (Removed):
- Next.js API routes proxy to Railway
- Required `RAILWAY_BACKEND_URL` environment variable
- Extra network hop for every request

**New Simplified Setup**:
- Frontend calls Railway backend directly
- Session cookie sent with `credentials: 'include'`
- Railway backend validates session and extracts `userId`
- No proxy needed!

## Environment Variables Needed

### Railway Backend

Add these to your **Railway** deployment:

```bash
# Cloudflare R2 (for persistent video storage)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=adhd-story-gen-videos
R2_PUBLIC_URL=https://your-r2-public-url.com
R2_PUBLIC_ACCESS=false

# Firebase Admin (already configured)
FIREBASE_ADMIN_PROJECT_ID=redditstories-531a8
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@....iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Frontend URL (for CORS)
FRONTEND_URL=https://taleo.media

# Other existing variables
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
```

### Vercel Frontend

Your frontend already has the Firebase config. No changes needed!

## How It Works Now

### 1. User Authentication Flow

```
User logs in → Firebase Auth → Session cookie set (.taleo.media)
```

### 2. Video Generation Flow

```
Frontend → POST /api/generate-video (with credentials: 'include')
  ↓
Railway Backend:
  1. Read session cookie from request
  2. Verify with Firebase Admin: admin.auth().verifySessionCookie()
  3. Extract userId from decoded claims
  4. Generate video with FFmpeg
  5. Upload to R2: users/{userId}/videos/{videoId}.mp4
  6. Save metadata to Firestore with userId
  ↓
Response: { videoId, statusUrl }
```

### 3. Video Status Check

```
Frontend → GET /api/video-status/{videoId} (with credentials: 'include')
  ↓
Railway Backend:
  1. Read session cookie from request
  2. Extract userId
  3. Query Firestore for video metadata
  4. Validate userId matches video owner
  5. Return status OR 404 if wrong user
  ↓
Response: { status, videoUrl, ... }
```

## Security Features

✅ **Cookie-based authentication**: Session cookie sent automatically  
✅ **User isolation**: Videos stored per-user in R2  
✅ **Access validation**: Backend checks userId matches video owner  
✅ **CORS protection**: Only allowed frontend domain can call backend  

## Frontend API Calls

Your existing code already works correctly! No changes needed:

```typescript
// Generate Video (create/page.tsx - already correct)
const response = await fetch(`/api/generate-video`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ✅ Sends session cookie
  body: JSON.stringify(options),
});

// Check Status (create/page.tsx - already correct)
const statusResponse = await fetch(`/api/video-status/${videoId}`, {
  method: 'GET',
  credentials: 'include', // ✅ Sends session cookie (ADD THIS)
});
```

## How Frontend Connects to Backend

✅ **Already configured!** The frontend uses Next.js rewrites to proxy API calls.

In `next.config.js`:
```javascript
async rewrites() {
  const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_URL || 'http://localhost:3000';
  return [
    {
      source: '/api/generate-video',
      destination: `${railwayUrl}/api/generate-video`,
    },
    {
      source: '/api/video-status/:videoId',
      destination: `${railwayUrl}/api/video-status/:videoId`,
    },
  ];
}
```

This means:
- Frontend calls `/api/generate-video` (relative URL)
- Next.js automatically proxies to Railway backend
- **No frontend code changes needed!**

## Finding Your Railway URL

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click on your project
3. Click on your service
4. Look for "Settings" → "Domains"
5. You'll see something like: `web-production-c05f.up.railway.app`
6. Copy that URL (with `https://`)

## Setup Steps

### 1. Find Your Railway URL

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click your project → Click your service
3. Go to **Settings** → **Networking** → **Public Domain**
4. Copy the URL (example: `web-production-c05f.up.railway.app`)

### 2. Add Environment Variables

**Vercel** (Frontend):
```bash
NEXT_PUBLIC_RAILWAY_URL=https://web-production-c05f.up.railway.app
```

**Railway** (Backend):
```bash
# R2 Storage (get from Cloudflare - see CLOUDFLARE_R2_SETUP.md)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=adhd-story-gen-videos
R2_PUBLIC_URL=https://your-r2-url.com

# CORS Configuration
FRONTEND_URL=https://taleo.media

# Firebase Admin (already set)
FIREBASE_ADMIN_PROJECT_ID=redditstories-531a8
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="..."

# Other APIs (already set)
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
```

### 3. Get Cloudflare R2 Credentials

Follow the guide in `CLOUDFLARE_R2_SETUP.md` to:
1. Create R2 bucket
2. Generate API token
3. Add credentials to Railway

### 4. Deploy

```bash
git add .
git commit -m "Add persistent video storage with user isolation"
git push origin main
```

Both Vercel and Railway will auto-deploy!

## Testing

1. Log in to your app
2. Create a test video
3. Check browser DevTools → Network tab:
   - Request should include `Cookie: session=...`
   - Response should be successful
4. Check Railway logs:
   ```
   [auth] User authenticated: {userId}
   [r2] Upload successful: https://...
   [firestore] Metadata saved for video ...
   ```

## Troubleshooting

### "userId is required" error

**Cause**: Session cookie not being sent or not valid

**Fix**:
1. Check cookie domain in browser DevTools (should be `.taleo.media`)
2. Ensure `credentials: 'include'` in all fetch calls
3. Verify `FRONTEND_URL` matches your actual frontend domain
4. Check Railway logs for `[auth] Session verification failed` errors

### CORS errors

**Cause**: Railway backend not allowing your frontend domain

**Fix**:
1. Set `FRONTEND_URL=https://taleo.media` in Railway
2. Redeploy Railway backend
3. Clear browser cache

### Videos still disappearing

**Cause**: R2 not configured or upload failing

**Fix**:
1. Add all R2 environment variables to Railway
2. Check Railway logs for `[r2] Upload successful`
3. Verify R2 credentials are correct

## Benefits of This Approach

✅ **Simpler**: No proxy layer, direct communication  
✅ **Faster**: One less network hop  
✅ **Secure**: Session validation on backend  
✅ **Scalable**: Railway backend handles all video logic  
✅ **No RAILWAY_BACKEND_URL needed**: Frontend uses Railway's public URL directly  

## Cost

Same as before: ~$0.01/month per active user with R2 storage
