# Campaign Scheduler Setup Guide

## ⚠️ CRITICAL: Why Your Campaigns Aren't Running

**Problem**: Campaigns are scheduled in the database but never execute because there's no cron job calling the scheduler endpoint.

**Solution**: Set up an external cron job to call `/api/campaigns/run-scheduled` every 1-5 minutes.

---

## Overview

The campaign scheduler checks for campaigns that are due to run and executes them automatically. It needs to be triggered regularly by a cron job.

**Endpoint**: `/api/campaigns/run-scheduled`  
**Method**: POST  
**Frequency**: Every 1-5 minutes (recommended: every 1 minute for precision)  
**Authentication**: Requires `CRON_SECRET` header  

---

## Setup Instructions

### Step 1: Verify CRON_SECRET is Set

You should already have this from YouTube token refresh setup. Verify in Railway:

1. Go to your project → Settings → Variables
2. Confirm `CRON_SECRET` exists
3. If not, generate one:
   ```bash
   openssl rand -hex 32
   ```

### Step 2: Add Campaign Scheduler Cron Job

Go to **cron-job.org** (you should already have an account from YouTube setup):

1. Log into https://cron-job.org/en/
2. Click **"Create cronjob"**
3. Configure:

   **Title:** `Campaign Scheduler - Taleo Media`
   
   **URL:** `https://taleo.media/api/campaigns/run-scheduled`
   
   **Schedule:** Every 1 minute (for best precision)
   - Pattern: `* * * * *` (runs every minute)
   - Or `*/5 * * * *` for every 5 minutes (less precise but fewer requests)
   
   **Request Method:** `POST`
   
   **Request Headers:**
   ```
   Authorization: Bearer YOUR_CRON_SECRET_HERE
   Content-Type: application/json
   ```
   
   **Enable:** ✅ Activated

4. Save and activate

---

## How It Works

### Without Cron Job (Current State - BROKEN):
1. User creates campaign for 10:35 PM ✅
2. Campaign stored in database with nextRunAt = 10:35 PM ✅
3. 10:35 PM arrives ⏰
4. **NOTHING HAPPENS** ❌ (no cron job checking)
5. Campaign never runs ❌

### With Cron Job (Fixed):
1. User creates campaign for 10:35 PM ✅
2. Campaign stored in database with nextRunAt = 10:35 PM ✅
3. Cron job checks every minute 🔄
4. 10:35 PM arrives ⏰
5. Cron job finds campaign is due ✅
6. Generates video automatically 🎬
7. Posts to TikTok/YouTube (if enabled) 📤
8. Updates nextRunAt for next batch ✅

---

## Testing

### Manual Test

After setting up the cron job, test it manually:

```bash
curl -X POST https://taleo.media/api/campaigns/run-scheduled \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Campaign execution completed",
  "stats": {
    "campaignsChecked": 5,
    "campaignsRun": 1,
    "videosGenerated": 4,
    "videosPosted": 4,
    "errors": 0,
    "durationMs": 125340
  },
  "results": [
    {
      "campaignId": "abc123",
      "campaignName": "Daily Reddit Stories",
      "status": "success",
      "videosGenerated": 4,
      "videosPosted": 4
    }
  ]
}
```

### Check Railway Logs

After the cron runs, check Railway logs:

1. Go to Deployments → Latest deployment
2. Click "View Logs"
3. Look for:
   ```
   [Campaign Scheduler] Found 2 campaigns due to run
   [Campaign Scheduler] Running campaign: Daily Reddit Stories
   [Campaign Scheduler] ✅ Generated 4 videos
   [Campaign Scheduler] ✅ Posted 4 videos to TikTok
   [Campaign Scheduler] Campaign completed successfully
   ```

---

## Timing & Precision

### Cron Frequency Options:

| Pattern | Frequency | Precision | Use Case |
|---------|-----------|-----------|----------|
| `* * * * *` | Every 1 min | ±30 sec | Best for precise scheduling |
| `*/5 * * * *` | Every 5 min | ±2.5 min | Good balance |
| `*/10 * * * *` | Every 10 min | ±5 min | Less precise |

**Recommendation**: Use `* * * * *` (every minute) for best results.

### Why Every Minute?

- Campaign scheduled for 10:35:00 PM
- Cron runs at 10:35:15 PM (within 15 seconds) ✅
- Video generation starts immediately
- User gets video within ~3 minutes of scheduled time

### Why Not Less Frequent?

- Campaign scheduled for 10:35:00 PM
- Cron runs every 5 minutes: 10:30, 10:35, 10:40...
- If cron runs at 10:35:02, perfect! ✅
- If cron runs at 10:34:58, waits until 10:40:00 ❌ (5 min late)
- Average delay: 2.5 minutes

---

## Cost & Resource Usage

### cron-job.org Free Tier:
- ✅ Unlimited cron jobs
- ✅ 1 minute intervals supported
- ✅ No credit card required

### Railway Resource Usage:

**If no campaigns due:**
- Response time: ~100ms
- Memory: Negligible
- Cost: Nearly $0

**If campaign runs:**
- Response time: 2-5 minutes (video generation)
- Memory: ~500MB during generation
- Cost: Normal campaign execution cost

**Monthly Estimate:**
- Cron checks: 60 × 24 × 30 = 43,200 requests/month
- Most checks return immediately (no campaigns due)
- Actual cost: Only when campaigns run

---

## Monitoring

### In cron-job.org Dashboard:

Check these metrics:
- **Success Rate**: Should be 100%
- **Response Time**: 
  - 100-500ms when no campaigns due
  - 2-5 min when campaign runs
- **HTTP Status**: Should be 200

### In Railway Logs:

Search for:
- `[Campaign Scheduler] Found X campaigns due to run`
- Campaign names and execution results
- Any errors or failures

---

## Troubleshooting

### Campaigns Still Not Running

**Check 1**: Is cron job activated?
- Log into cron-job.org
- Verify job is enabled (green checkmark)
- Check "Last execution" timestamp

**Check 2**: Is CRON_SECRET correct?
- Test manually with curl (see Testing section)
- Should return 200, not 401

**Check 3**: Is campaign actually scheduled?
- Check campaign details in dashboard
- Verify status = "active"
- Check nextRunAt timestamp is in the past

**Check 4**: Check Railway logs
- Look for error messages
- Verify cron is hitting the endpoint
- Check for Firebase/Firestore errors

### Campaigns Run But Videos Fail

**Check 1**: Railway generation
- Verify videos generate when you do it manually
- Check if Railway video gen API is working

**Check 2**: Social media credentials
- TikTok/YouTube tokens may be expired
- Check connection status in settings

### Cron Returns 401 Unauthorized

**Cause**: Wrong CRON_SECRET

**Fix**:
1. Check Railway environment variables
2. Check cron-job.org Authorization header
3. They must match exactly
4. Redeploy Railway after any changes

### Cron Returns 500 Error

**Cause**: Server error

**Fix**:
1. Check Railway logs for detailed error
2. Test endpoint manually
3. Check Firebase credentials
4. Verify database connectivity

---

## Important Notes

### Multiple Campaigns at Same Time

If multiple campaigns are scheduled for the same time:
- All will run in sequence (not parallel)
- Each campaign waits for the previous to complete
- Total time = sum of all campaign durations
- **This is by design** to avoid overloading Railway

### Campaign Execution Time

Typical execution times:
- 1 video: ~60 seconds
- 4 videos: ~3-4 minutes
- 10 videos: ~8-10 minutes

If a campaign takes longer than 5 minutes:
- Cron may timeout on the HTTP request
- **Campaign will still complete** (runs in background)
- Next cron run will see campaign finished
- No videos are lost

### Timezone Handling

The scheduler automatically handles timezones:
- Campaign scheduled in user's local time ✅
- Stored as UTC in database ✅
- Scheduler checks UTC time ✅
- Runs when UTC time matches ✅

---

## Security

1. **CRON_SECRET Protection**:
   - Never commit to git ✅
   - Store only in Railway variables ✅
   - Use strong random string (32+ chars) ✅

2. **Rate Limiting**:
   - Endpoint has NO rate limiting (cron needs access)
   - Protected by CRON_SECRET authentication
   - Only authorized cron services can call it

3. **Campaign Isolation**:
   - Each user's campaigns run independently
   - One failed campaign doesn't affect others
   - Errors are logged and emailed to user

---

## Summary

✅ **One-time setup** (5 minutes)  
✅ **Automatic campaign execution**  
✅ **Runs every minute for precision**  
✅ **No user action needed**  
✅ **Works 24/7**  

**Your scheduled campaigns will now actually run!** 🎉

---

## Quick Setup Checklist

- [ ] Verify `CRON_SECRET` exists in Railway
- [ ] Log into cron-job.org
- [ ] Create new cron job
- [ ] Set URL: `https://taleo.media/api/campaigns/run-scheduled`
- [ ] Set schedule: `* * * * *` (every minute)
- [ ] Add Authorization header with CRON_SECRET
- [ ] Activate cron job
- [ ] Test manually with curl
- [ ] Check Railway logs
- [ ] Create test campaign and verify it runs
- [ ] Monitor cron-job.org dashboard

Done! Your campaigns will now run automatically. 🚀
