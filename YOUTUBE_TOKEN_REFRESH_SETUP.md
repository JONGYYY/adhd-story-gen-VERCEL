# YouTube Token Auto-Refresh Setup Guide

## Overview

YouTube access tokens expire after **1 hour**. To ensure your scheduled campaigns can post to YouTube even when users aren't on the website, we've implemented automatic token refresh via a cron job.

## How It Works

1. **Cron Endpoint**: `/api/cron/refresh-youtube-tokens`
   - Runs every hour via external cron service
   - Finds all users with YouTube connected
   - Refreshes tokens that expire within 12 hours
   - Proactively prevents token expiration

2. **Background Refresh**: Happens automatically, no user action needed

3. **Secure**: Requires `CRON_SECRET` authentication header

---

## Setup Instructions

### Step 1: Set CRON_SECRET Environment Variable

In Railway dashboard:

1. Go to your project → Settings → Variables
2. Add new variable:
   ```
   CRON_SECRET=your_secure_random_string_here
   ```
3. Generate a secure random string (32+ characters):
   ```bash
   openssl rand -hex 32
   ```
4. Click "Deploy" to apply changes

### Step 2: Set Up External Cron Job

We recommend using **cron-job.org** (free, reliable):

#### Option A: cron-job.org (Recommended)

1. Go to https://cron-job.org/en/
2. Create free account
3. Click "Create cronjob"
4. Configure:

   **Title:** `YouTube Token Refresh - Taleo Media`
   
   **URL:** `https://taleo.media/api/cron/refresh-youtube-tokens`
   
   **Schedule:** Every 1 hour
   - Pattern: `0 * * * *` (runs at minute 0 of every hour)
   
   **Request Method:** `POST`
   
   **Request Headers:**
   ```
   Authorization: Bearer YOUR_CRON_SECRET_HERE
   Content-Type: application/json
   ```
   
   **Enable:** ✅ Activated

5. Save and activate

#### Option B: EasyCron

1. Go to https://www.easycron.com/
2. Sign up (free tier: 1 job)
3. Create cron job:
   - URL: `https://taleo.media/api/cron/refresh-youtube-tokens`
   - Cron Expression: `0 * * * *`
   - HTTP Method: POST
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`

#### Option C: Your Own Server

If you have your own server with cron:

```bash
# Add to crontab (crontab -e)
0 * * * * curl -X POST https://taleo.media/api/cron/refresh-youtube-tokens \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## Testing

### Manual Test (After Setup)

Test the endpoint manually:

```bash
curl -X POST https://taleo.media/api/cron/refresh-youtube-tokens \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "YouTube token refresh completed",
  "stats": {
    "totalUsers": 5,
    "tokensChecked": 5,
    "tokensRefreshed": 2,
    "errors": 0,
    "durationMs": 3421
  }
}
```

### Check Logs

In Railway:
1. Go to Deployments → Latest deployment
2. Click "View Logs"
3. Wait for next hour (or trigger manually)
4. Look for:
   ```
   === YouTube Token Refresh Cron Job Started ===
   ✅ Cron authentication verified
   Found X users with YouTube connected
   [User xxx] ⟳ Refreshing token...
   [User xxx] ✅ Token refreshed successfully
   === YouTube Token Refresh Cron Job Completed ===
   ```

---

## How Users Benefit

### Before (Without Auto-Refresh):
- User connects YouTube ✅
- Token expires after 1 hour ⏰
- Scheduled campaign tries to post → ❌ FAILS
- User must reconnect YouTube manually
- Posts fail silently until reconnection

### After (With Auto-Refresh):
- User connects YouTube ✅
- Token expires after 1 hour ⏰
- **Cron job automatically refreshes token** 🔄
- Scheduled campaign posts successfully → ✅ SUCCESS
- User never needs to reconnect (until refresh token expires after ~6 months)

---

## Token Lifecycle

1. **Initial Connection**: User connects YouTube
   - Access token: Valid for 1 hour
   - Refresh token: Valid for ~6 months

2. **First 12 Hours**: Token still valid
   - Cron checks but doesn't refresh (not needed yet)

3. **After 1 Hour - 12 Hours Buffer**: Token expiring soon
   - **Cron automatically refreshes** 🔄
   - New access token: Valid for 1 hour
   - Updates stored credentials

4. **Scheduled Post Time**: Campaign runs
   - Token is always fresh (< 12 hours old)
   - Post succeeds ✅

5. **6 Months Later**: Refresh token expires
   - User sees "Reconnect YouTube" message
   - One-time reconnection required

---

## Monitoring

### Success Metrics

Check these in cron-job.org dashboard:
- **Success Rate**: Should be 100%
- **Response Time**: Typically 1-5 seconds
- **HTTP Status**: Should always be 200

### What to Monitor

1. **Cron Job Dashboard** (cron-job.org):
   - Check execution history
   - Look for failed attempts
   - View response codes

2. **Railway Logs**:
   - Search for "YouTube Token Refresh Cron"
   - Check for errors
   - Verify users' tokens are being refreshed

3. **User Reports**:
   - If users report "YouTube disconnected" frequently
   - Check cron job is running
   - Verify CRON_SECRET is correct

---

## Troubleshooting

### Cron Job Returns 401 Unauthorized

**Cause**: Wrong or missing CRON_SECRET

**Fix**:
1. Check Railway environment variables
2. Verify CRON_SECRET matches in both places:
   - Railway: `CRON_SECRET` variable
   - Cron service: Authorization header
3. Redeploy Railway after changing

### Cron Job Returns 500 Error

**Cause**: Server error (check logs)

**Fix**:
1. Check Railway logs for detailed error
2. Verify Firebase credentials are set
3. Check if any users have corrupted YouTube credentials

### Tokens Still Expiring

**Cause**: Cron job not running or failing silently

**Fix**:
1. Check cron-job.org execution history
2. Test endpoint manually (see Testing section)
3. Verify cron schedule is correct: `0 * * * *`
4. Check if cron service is activated

### Users Need to Reconnect After 6 Months

**Expected Behavior**: This is normal!
- Refresh tokens expire after ~6 months
- Google requires periodic re-authorization
- Users will see "Reconnect YouTube" prompt
- One-click reconnection solves it

---

## Security Notes

1. **CRON_SECRET Protection**:
   - Never commit to git
   - Store only in Railway environment variables
   - Use strong random string (32+ chars)

2. **Rate Limiting**:
   - Endpoint is called once per hour
   - Processes all users in single request
   - Stays well under Google's rate limits

3. **Error Handling**:
   - Failed refreshes are logged but don't block others
   - Users with failed refreshes will see reconnect prompt
   - System continues working for other users

---

## Cost & Limits

- **cron-job.org Free Tier**: Unlimited cron jobs, perfect for this use case
- **Google API Quotas**: YouTube Analytics API has generous limits (10,000 requests/day)
- **Railway**: Cron execution time typically < 5 seconds, minimal resource usage

---

## Summary

✅ **One-time setup** (15 minutes)  
✅ **Automatic token refresh** every hour  
✅ **No user action needed** after initial connection  
✅ **Scheduled campaigns always work**  
✅ **Transparent to users**  

Your YouTube integration will now work reliably for scheduled posts, even when users aren't actively using the website!
