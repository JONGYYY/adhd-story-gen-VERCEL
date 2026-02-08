# Railway Environment Variables Setup

## Overview

You have **2 Railway services** in the same project:
1. **Worker Service** - Runs `railway-backend.js` (Express/FFmpeg)
2. **UI Service** - Runs Next.js frontend

## Environment Variables

### Worker Service

Add these to your **Worker Service** in Railway:

```bash
# ============================================
# CLOUDFLARE R2 (Persistent Video Storage)
# ============================================
# Get these from Cloudflare Dashboard → R2
R2_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-access-key-here
R2_SECRET_ACCESS_KEY=your-secret-key-here
R2_BUCKET_NAME=adhd-story-gen-videos
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxx.r2.dev
R2_PUBLIC_ACCESS=false

# ============================================
# FRONTEND URL (for CORS)
# ============================================
FRONTEND_URL=https://taleo.media

# ============================================
# FIREBASE ADMIN (should already be set)
# ============================================
FIREBASE_ADMIN_PROJECT_ID=redditstories-531a8
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-fbsvc@redditstories-531a8.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ============================================
# AI APIs (should already be set)
# ============================================
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=sk_...
```

### UI Service

Add these to your **UI Service** in Railway:

```bash
# ============================================
# WORKER SERVICE URL
# ============================================
# Option 1: Use Railway internal networking (faster, private)
NEXT_PUBLIC_RAILWAY_URL=https://worker-service-name.railway.internal

# Option 2: Use public Railway URL
# NEXT_PUBLIC_RAILWAY_URL=https://web-production-xyz.up.railway.app

# ============================================
# FIREBASE CLIENT (should already be set)
# ============================================
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=redditstories-531a8.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=redditstories-531a8
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=redditstories-531a8.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1055975893186
NEXT_PUBLIC_FIREBASE_APP_ID=1:1055975893186:web:347d158db344730e87f35b
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-H9ZPE8NQ83
```

## How to Get the Values

### 1. Cloudflare R2 Credentials

1. Go to https://dash.cloudflare.com
2. Click **R2** in the left sidebar
3. Click **Create bucket**
   - Name: `adhd-story-gen-videos`
   - Click **Create bucket**
4. Click **Manage R2 API Tokens** (top right)
5. Click **Create API Token**
   - Permissions: **Object Read & Write**
   - Click **Create API Token**
6. **Copy and save these** (shown only once):
   - `R2_ACCOUNT_ID` - In the dashboard URL or shown in token page
   - `R2_ACCESS_KEY_ID` - Access Key ID from token creation
   - `R2_SECRET_ACCESS_KEY` - Secret Access Key from token creation
7. Get public URL:
   - Go back to your bucket
   - Click **Settings** → **Public Access**
   - Click **Allow Access**
   - Copy the public URL shown (e.g., `https://pub-xxxxx.r2.dev`)
   - Use this for `R2_PUBLIC_URL`

### 2. Worker Service URL (for UI Service)

**Option A: Internal Railway URL (Recommended)**

1. Go to Railway dashboard
2. Click on your **Worker Service**
3. Look for the service name in the URL or top of the page
4. Format: `https://<service-name>.railway.internal`
5. Example: `https://backend-production.railway.internal`

**Option B: Public Railway URL**

1. Go to Railway dashboard
2. Click on your **Worker Service**
3. Go to **Settings** → **Networking** → **Public Domain**
4. Copy the URL (e.g., `https://web-production-abc123.up.railway.app`)

## Adding Variables to Railway

### Method 1: Railway Dashboard (Recommended)

1. Go to https://railway.app/dashboard
2. Click your project
3. Click the service (Worker or UI)
4. Click **Variables** tab
5. Click **+ New Variable**
6. Enter variable name and value
7. Click **Add**
8. Repeat for all variables
9. Railway will automatically redeploy

### Method 2: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Add variables
railway variables set R2_ACCOUNT_ID=your-value
railway variables set R2_ACCESS_KEY_ID=your-value
# ... etc
```

## Verification

After adding all variables:

1. Check Railway logs for Worker Service:
   ```
   [r2] Client initialized successfully
   [firebase-admin] Initialized successfully
   ```

2. Create a test video

3. Check logs for successful upload:
   ```
   [auth] User authenticated: {userId}
   [r2] Upload successful: https://...
   [firestore] Metadata saved for video ...
   ```

4. Reload the page - video should still be accessible!

## Troubleshooting

### R2 Not Initialized

**Error**: `[r2] Missing R2 configuration - videos will use ephemeral storage`

**Fix**: 
- Verify all R2 environment variables are set in Worker Service
- Check for typos in variable names (they're case-sensitive)
- Click "Redeploy" after adding variables

### Firebase Admin Failed

**Error**: `[firebase-admin] Failed to initialize`

**Fix**:
- Verify `FIREBASE_ADMIN_PRIVATE_KEY` includes `\n` for line breaks
- Make sure the private key is wrapped in quotes
- Check that all three Firebase Admin variables are set

### CORS Errors

**Error**: Browser console shows CORS errors when creating videos

**Fix**:
- Set `FRONTEND_URL=https://taleo.media` in Worker Service
- Make sure it matches your actual domain (no trailing slash)
- Redeploy Worker Service

### UI Can't Reach Worker

**Error**: Network errors when creating videos

**Fix**:
- Verify `NEXT_PUBLIC_RAILWAY_URL` is set in UI Service
- Try using the public URL instead of internal URL
- Check both services are running in Railway dashboard

### Videos Still Disappearing

**Error**: Videos return 404 after page reload

**Fix**:
- Verify R2 upload is successful in Worker logs
- Check Firestore console for video documents
- Make sure user is logged in (session cookie present)

## Security Notes

- Never commit `.env` files to git
- R2 credentials give full access to your bucket
- Firebase Admin credentials have elevated privileges
- Use Railway's secret variables for sensitive values
- CORS is configured to allow only your domain

## Cost Estimate

With R2 configured:

- **Storage**: $0.015/GB/month
- **Operations**: Minimal (few cents)
- **Bandwidth**: FREE (R2 has no egress charges!)

**Example**: 1000 users × 10 videos/month × 50MB = ~$10/month

Without R2 (ephemeral storage): Videos disappear on container restart
