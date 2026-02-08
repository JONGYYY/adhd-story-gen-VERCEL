# Quick Start - User-Isolated Video Storage

## What Was Built

Your videos now:
- ✅ **Never disappear** - Stored permanently in Cloudflare R2
- ✅ **User-isolated** - Each user can ONLY see their own videos
- ✅ **Secure** - Authentication required for all video operations
- ✅ **Cost-effective** - ~$0.01/month per active user

## What You Need to Do

### 1. Get Your Railway URL ⚡

1. Go to https://railway.app/dashboard
2. Click your project
3. Look for "Domains" or "Settings" → "Networking"
4. Copy your URL (example: `web-production-c05f.up.railway.app`)

### 2. Add to Vercel Environment Variables

In [Vercel Dashboard](https://vercel.com/dashboard):

```bash
NEXT_PUBLIC_RAILWAY_URL=https://web-production-c05f.up.railway.app
```
(Use YOUR Railway URL from step 1)

### 3. Get Cloudflare R2 Credentials 🔐

1. Go to https://dash.cloudflare.com
2. Click **R2** in sidebar
3. Click **Create bucket** → Name it `adhd-story-gen-videos`
4. Click **Manage R2 API Tokens** → **Create API Token**
5. Give it **Object Read & Write** permission
6. **SAVE THESE** (shown only once):
   - Account ID
   - Access Key ID
   - Secret Access Key

### 4. Add to Railway Environment Variables

In [Railway Dashboard](https://railway.app/dashboard):

```bash
R2_ACCOUNT_ID=<from step 3>
R2_ACCESS_KEY_ID=<from step 3>
R2_SECRET_ACCESS_KEY=<from step 3>
R2_BUCKET_NAME=adhd-story-gen-videos
R2_PUBLIC_URL=https://pub-YOUR_ID.r2.dev
FRONTEND_URL=https://taleo.media
```

To get `R2_PUBLIC_URL`:
1. Go to your R2 bucket in Cloudflare
2. Click **Settings** → **Public Access**
3. Click **Allow Access** → Copy the public URL shown
4. **OR** use your custom domain if you set one up

### 5. Deploy 🚀

```bash
git add .
git commit -m "Add persistent user-isolated video storage"
git push origin main
```

Both Vercel and Railway will auto-deploy!

## Testing

1. Create a test video
2. **Reload the page** - Video should still be there! ✨
3. Check Railway logs for:
   ```
   [r2] Upload successful: https://...
   [firestore] Metadata saved for video ...
   ```

## That's It! 🎉

Your videos are now:
- Stored permanently in Cloudflare R2
- Only accessible to the user who created them
- Will survive all container restarts

## Cost

**Per active user (10 videos/month)**: ~$0.01/month  
**1000 active users**: ~$10/month  
**Bandwidth**: FREE (R2 has no egress charges!)

## Need Help?

See detailed docs:
- `SIMPLIFIED_SETUP.md` - Full technical explanation
- `CLOUDFLARE_R2_SETUP.md` - Detailed R2 setup guide
- `USER_ISOLATED_VIDEO_STORAGE.md` - Complete architecture docs

## Troubleshooting

### Videos still disappearing?
- Check Railway logs for R2 upload errors
- Verify all R2 environment variables are set
- Make sure you clicked "Redeploy" in Railway after adding variables

### "Access denied" errors?
- User must be logged in
- Check session cookie in browser DevTools
- Verify `FRONTEND_URL` matches your actual domain

### Can't find Railway URL?
Railway Dashboard → Your Project → Settings → Networking → Public Domain
