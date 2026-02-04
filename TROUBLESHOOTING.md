# 🔧 Troubleshooting Guide

## "Failed to fetch" Error on YouTube Upload

### What's Happening

You're seeing "Upload failed: Failed to fetch" when trying to upload videos to YouTube.

### Root Cause

The error occurs when trying to download the video file from Railway:

```typescript
const videoResponse = await fetch(videoStatus.videoUrl);
// ^ This fetch is failing
```

### Possible Causes

1. **Video file doesn't exist** - Generation may have failed
2. **Video URL is expired** - URLs may be temporary
3. **CORS issue** - Railway backend blocking the request
4. **Network issue** - Connection problem

### How to Debug

**Open Browser Console** (F12) and try uploading again. You should see:

```
Fetching video from: https://api.taleo.media/videos/...
Video blob size: 12345678
```

**If you see:**
- ❌ `Failed to fetch` → Network/CORS issue
- ❌ `404` → Video file doesn't exist
- ❌ `403` → Permission denied
- ✅ `Video blob size: ...` → Video fetch worked, issue is elsewhere

### Solutions

#### Solution 1: Check Video Exists
1. Open the video page in your browser
2. Right-click the video player → "Inspect"
3. Find the video `src` URL
4. Try opening that URL directly in a new tab
5. If it doesn't load → video generation failed

#### Solution 2: Regenerate Video
1. If video is old, try generating a new one
2. Fresh videos have valid URLs

#### Solution 3: Check Railway Logs
1. Go to Railway dashboard
2. Click "View logs" on the deployment
3. Look for errors during video generation
4. Check if video file was created

#### Solution 4: Verify CORS (Already Fixed)
Railway backend has CORS enabled:
```javascript
app.use(cors()); // Allows all origins
```

### Recent Deployments

**Latest commits:**
```
3b834c8 - fix(youtube-upload): add detailed error logging
da20ec2 - chore: trigger railway deployment for security update
e650c5b - feat(security): comprehensive security hardening
```

**Railway should redeploy automatically** (~3-5 minutes after push)

### Security Update Status

✅ **Security hardening deployed** to GitHub:
- Rate limiting
- Input validation
- Security headers
- File validation

⏳ **Railway deployment in progress** - Check Railway dashboard

### Quick Checklist

Before trying to upload again:

- [ ] Video page loads without errors
- [ ] Video plays in browser
- [ ] You can see the video URL in page source
- [ ] Railway shows "Deployment successful"
- [ ] Browser console shows detailed logs (after latest deploy)

### Next Steps

1. **Wait 5 minutes** for Railway to redeploy
2. **Hard refresh** your site (Ctrl+Shift+R / Cmd+Shift+R)
3. **Generate a new test video**
4. **Try uploading** and check console for detailed logs
5. **Report error** with console logs if still failing

### If Still Not Working

Send me:
1. Screenshot of browser console (F12)
2. Video URL you're trying to upload
3. Railway deployment logs
4. Any error messages you see

I'll diagnose the specific issue!

---

## Security Features (Just Deployed)

**Rate Limits:**
- Authentication: 5 req/15min
- Video generation: 10 req/hour
- Uploads: 20 req/hour

**If you hit rate limits:**
- Error: `429 Too Many Requests`
- Response includes `Retry-After` header
- Wait for the specified time and try again

**Protected Endpoints:**
- `/api/auth/session`
- `/api/generate-video`
- `/api/social-media/youtube/upload`
- `/api/social-media/tiktok/upload`

---

## Common Errors

### "Not authenticated"
**Cause:** Session cookie expired  
**Fix:** Log out and log back in

### "Rate limit exceeded"
**Cause:** Too many requests  
**Fix:** Wait for the time specified in error message

### "Video generation service unavailable"
**Cause:** Railway backend down  
**Fix:** Check Railway dashboard, may need to restart

### "YouTube not connected"
**Cause:** YouTube OAuth not set up  
**Fix:** Go to Settings → Social Media → Connect YouTube

---

**Last Updated:** February 2026
