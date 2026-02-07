# Reddit Link Scraper & Character Counter

## What You Should See

### Story Source Selection (Step 1)
You should now see **4 options** in a grid:

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ ✨ AI       │ 📱 Reddit   │ 🔗 Reddit   │ 📄 Paste    │
│ Generation  │ Stories     │ Link        │ Story       │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### When You Click "Reddit Link" (🔗)

You'll see:
```
Reddit Post URL
┌─────────────────────────────────────────────┬──────────────┐
│ https://reddit.com/r/...                    │ Fetch Story  │
└─────────────────────────────────────────────┴──────────────┘
Paste any Reddit post URL and we'll automatically extract...

[After fetching, shows preview box with scraped content]
```

### When You Click "Paste Story" (📄)

You'll see:
```
Story Title
┌────────────────────────────────────────────────────────────┐
│ Enter your story title                                      │
└────────────────────────────────────────────────────────────┘

Story Content
┌────────────────────────────────────────────────────────────┐
│ Paste your story here...                                    │
│                                                              │
│                                                              │
│                                                              │
│                                                      0/5000 │ ← Character Counter
└────────────────────────────────────────────────────────────┘
⚠️ Story exceeds 5000 characters. Text will be truncated for TTS.
   (Shows when > 5000 chars)
```

## Features Added

### 1. Reddit Link Scraper
- **Location**: Story Source selection (4th option)
- **How to use**:
  1. Click "Reddit Link" button
  2. Paste any Reddit post URL (e.g., `https://reddit.com/r/AITA/comments/xyz123/...`)
  3. Click "Fetch Story" button
  4. Title and story are automatically filled
  5. Preview shows scraped content with character count

### 2. Character Counter
- **Location**: Bottom right of story textarea
- **Format**: `{current}/5000`
- **Shows in**:
  - "Paste Story" text area (live counter)
  - "Reddit Link" preview box (after scraping)
- **Warning**: Red warning appears when > 5000 characters

## How the Reddit Scraper Works

### API Endpoint
- **Path**: `/api/scrape-reddit`
- **Method**: POST
- **Input**: `{ url: "https://reddit.com/..." }`
- **Output**: `{ success: true, title: "...", story: "...", subreddit: "r/...", author: "..." }`

### What It Does
1. Validates the URL is a valid Reddit post URL
2. Fetches post data from Reddit's public JSON API (no auth needed)
3. Extracts title and selftext (story content)
4. Cleans the text (removes extra newlines, etc.)
5. Returns structured data

### Supported URLs
- `https://reddit.com/r/subreddit/comments/postid/...`
- `https://www.reddit.com/r/subreddit/comments/postid/...`
- `https://old.reddit.com/r/subreddit/comments/postid/...`

### Error Handling
- Invalid URL format → Error message
- Post not found (404) → Error message
- Link/image post (no text) → Error message
- Network timeout (15s) → Error message

## Testing

### Test the Reddit Link Feature
1. Go to https://reddit.com/r/AmItheAsshole (or any story subreddit)
2. Find a text post (not a link or image post)
3. Copy the URL
4. Go to your create page
5. Click "Reddit Link"
6. Paste the URL
7. Click "Fetch Story"
8. Should see title and story preview

### Test the Character Counter
1. Click "Paste Story"
2. Type or paste text
3. Watch counter update in real-time (e.g., `0/5000` → `500/5000`)
4. If you paste > 5000 chars, should see red warning

### Example Reddit URLs to Test
- https://reddit.com/r/AmItheAsshole/comments/...
- https://reddit.com/r/ProRevenge/comments/...
- https://reddit.com/r/TrueOffMyChest/comments/...
- https://reddit.com/r/tifu/comments/...

## Files Changed

### Frontend
- `src/app/create/page.tsx` - Added Reddit Link UI, character counter, scraping logic

### Backend
- `src/app/api/scrape-reddit/route.ts` - New API endpoint for Reddit scraping

## Security Features

✅ Rate limiting (same as video generation)
✅ URL validation (regex check)
✅ Input sanitization (500 char limit on URL)
✅ Timeout protection (15 seconds)
✅ Error handling (graceful failures)

## User Experience

### Smooth Flow
1. Select "Reddit Link" → Input appears
2. Paste URL → Button enabled
3. Click "Fetch Story" → Loading spinner
4. Success → Preview box appears with scraped content
5. Character count displayed → User can see if truncation will occur
6. Select background/voice → Generate video

### Visual Feedback
- ✅ Check mark when "Reddit Link" selected
- 🔄 Loading spinner during scraping
- ⚠️ Warning when story exceeds 5000 chars
- 📊 Live character count updates
