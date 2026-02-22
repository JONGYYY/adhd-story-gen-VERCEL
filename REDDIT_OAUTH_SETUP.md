# Reddit OAuth Setup Guide

## Why Reddit Scraping Fails

Reddit aggressively blocks automated scraping. The error you're seeing happens because:

1. **Your refresh token expired** - Reddit refresh tokens expire periodically
2. **Rate limiting** - Too many requests without OAuth
3. **Bot detection** - Reddit blocks non-browser user agents

## Solution: Proper OAuth Setup

### Step 1: Create Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Scroll to bottom, click **"create another app..."** or **"create app"**
3. Fill in:
   - **Name:** `Taleo Video Generator` (or your app name)
   - **App type:** Select **"script"**
   - **Description:** `AI video generation tool`
   - **About URL:** `https://taleo.media` (your domain)
   - **Redirect URI:** `http://localhost:8080` (required but not used)
4. Click **"create app"**
5. Note down:
   - **Client ID:** (string below "personal use script")
   - **Client Secret:** (string next to "secret")

### Step 2: Get Refresh Token

**Option A: Using Python (Recommended)**

```python
import requests
import requests.auth

# Your app credentials from Step 1
CLIENT_ID = 'your_client_id_here'
CLIENT_SECRET = 'your_client_secret_here'

# Your Reddit username and password
REDDIT_USERNAME = 'your_reddit_username'
REDDIT_PASSWORD = 'your_reddit_password'

client_auth = requests.auth.HTTPBasicAuth(CLIENT_ID, CLIENT_SECRET)
post_data = {
    "grant_type": "password",
    "username": REDDIT_USERNAME,
    "password": REDDIT_PASSWORD
}
headers = {"User-Agent": "Taleo/1.0 by YourUsername"}

response = requests.post(
    "https://www.reddit.com/api/v1/access_token",
    auth=client_auth,
    data=post_data,
    headers=headers
)

print("Access Token:", response.json()["access_token"])
print("Refresh Token:", response.json()["refresh_token"])
```

**Option B: Using curl**

```bash
# Replace with your credentials
CLIENT_ID="your_client_id"
CLIENT_SECRET="your_client_secret"
USERNAME="your_reddit_username"
PASSWORD="your_reddit_password"

curl -X POST \
  -H "User-Agent: Taleo/1.0 by YourUsername" \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=password&username=$USERNAME&password=$PASSWORD" \
  https://www.reddit.com/api/v1/access_token
```

**Option C: Using Node.js**

```javascript
const clientId = 'your_client_id';
const clientSecret = 'your_client_secret';
const username = 'your_reddit_username';
const password = 'your_reddit_password';

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

fetch('https://www.reddit.com/api/v1/access_token', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Taleo/1.0 by YourUsername',
  },
  body: new URLSearchParams({
    grant_type: 'password',
    username: username,
    password: password,
  }).toString(),
})
.then(res => res.json())
.then(data => {
  console.log('Access Token:', data.access_token);
  console.log('Refresh Token:', data.refresh_token);
})
.catch(err => console.error('Error:', err));
```

### Step 3: Add to Railway Environment Variables

1. Go to your Railway project
2. Click on your service
3. Go to **"Variables"** tab
4. Add these 4 variables:

```bash
REDDIT_CLIENT_ID=your_client_id_from_step_1
REDDIT_CLIENT_SECRET=your_client_secret_from_step_1
REDDIT_REFRESH_TOKEN=your_refresh_token_from_step_2
REDDIT_USER_AGENT=web:taleo-media:v1.0.0 (by /u/your_reddit_username)
```

**CRITICAL:** Replace `your_reddit_username` in User-Agent with your actual Reddit username!

4. Click **"Deploy"** to restart with new variables

### Step 4: Verify It Works

Check your Railway logs after the next campaign run. You should see:

```
[reddit-scraper] ✅ Reddit OAuth access token obtained (expires in 3600 seconds, cached)
[reddit-scraper] ✅ Strategy 1 (OAuth) succeeded
```

## Troubleshooting

### Error: "400 Bad Request" on OAuth

**Causes:**
- Client ID or Secret is wrong
- Refresh token is invalid/expired
- Credentials have whitespace/newlines

**Fix:**
1. Copy credentials carefully (no extra spaces)
2. Generate a new refresh token (Step 2)
3. Make sure User-Agent is properly formatted

### Error: "429 Too Many Requests"

**Cause:** Rate limited

**Fix:**
1. OAuth gives 60 req/min (vs 10 without)
2. Wait 10-15 minutes
3. The scraper now caches tokens to reduce requests

### Error: "403 Forbidden" on all strategies

**Cause:** Reddit is blocking your IP/server

**Fix:**
1. Set up OAuth (required)
2. If still failing, Reddit may have blocked Railway's IP range temporarily
3. Wait 30-60 minutes
4. Consider using a proxy service (advanced)

### Refresh Token Expiration

Reddit refresh tokens can expire after:
- 30 days of inactivity
- Password change
- App re-authorization

**Fix:** Re-run Step 2 to generate a new refresh token

## Current Implementation

The scraper now tries **7 different strategies** in order:

1. ✅ **OAuth API** (oauth.reddit.com) - Most reliable, 60 req/min
2. ✅ **old.reddit.com** - Less bot detection
3. ✅ **Mobile user agent** - Sometimes bypasses checks
4. ✅ **Chrome/Mac headers** - Mimics real browser
5. ✅ **i.reddit.com** - Compact interface
6. ✅ **Wget-style** - Minimal headers
7. ✅ **RSS feed** - Last resort, basic parsing

With proper OAuth setup, Strategy 1 should work 99% of the time.

## Best Practices

1. **Keep refresh token secure** - Don't commit to git
2. **Update every 30 days** - Regenerate token monthly
3. **Monitor logs** - Check for OAuth failures
4. **Use unique User-Agent** - Include your Reddit username

## Testing OAuth Setup

Run this in Railway logs or locally:

```bash
# Test if OAuth credentials work
curl -X POST \
  -H "User-Agent: web:taleo-media:v1.0.0 (by /u/your_username)" \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN" \
  https://www.reddit.com/api/v1/access_token
```

Should return:
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "*"
}
```

---

**After setup, Reddit scraping should work reliably for your campaigns!**
