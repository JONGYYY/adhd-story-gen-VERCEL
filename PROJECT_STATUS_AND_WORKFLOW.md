# 🚀 Project Status & Workflow Guide

## 📌 **CRITICAL: Git Workflow**

### **Repository Location**
```bash
Local: /Users/jonathanshan/adhd-story-gen VERCEL
GitHub: https://github.com/JONGYYY/adhd-story-gen-VERCEL.git
Branch: main
```

### **How to Commit Changes**
```bash
# Always run from project root
cd "/Users/jonathanshan/adhd-story-gen VERCEL"

# Stage all changes
git add -A

# Check status
git status

# Commit with detailed message
git commit -m "feat(feature-name): Description

USER REQUEST:
\"exact user quote\"

WHAT'S NEW:
✅ Feature 1
✅ Feature 2

FILES CREATED:
- path/to/file1.ts
- path/to/file2.tsx

FILES MODIFIED:
- path/to/modified1.ts
- path/to/modified2.tsx

RESULT:
✅ Success criteria
✅ No linter errors"

# Push to GitHub (triggers Railway auto-deploy)
git push origin main
```

### **IMPORTANT: Deployment Platform**
- ❌ **NOT using Vercel** (despite folder name)
- ✅ **Using Railway** for deployment
- Railway watches the `main` branch
- Auto-deploys on push to `main`
- Two services: UI (Next.js) + Worker (Node.js Express)

---

## 🏗️ **Project Architecture**

### **Tech Stack**
- **Frontend**: Next.js 14 (App Router)
- **Backend Worker**: Node.js Express (Railway)
- **Database**: Firestore
- **Authentication**: Firebase Auth (client + admin SDK)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Animations**: Framer Motion
- **Charts**: Chart.js + react-chartjs-2
- **Video Processing**: FFmpeg (on Railway worker)
- **TTS**: ElevenLabs API
- **AI**: OpenAI GPT-4
- **Storage**: AWS S3 (backgrounds, fonts, banners)

### **Deployment**
- **UI Service**: Railway (Next.js)
- **Worker Service**: Railway (Express server with FFmpeg)
- **Build System**: Nixpacks (Railway's builder)
- **Domain**: taleo.media (custom domain)

---

## 📁 **Project Structure**

```
adhd-story-gen VERCEL/
├── src/
│   ├── app/                          # Next.js app router
│   │   ├── api/                      # API routes
│   │   │   ├── auth/                 # Auth endpoints
│   │   │   │   ├── google/           # Google OAuth
│   │   │   │   ├── tiktok/           # TikTok OAuth
│   │   │   │   └── youtube/          # YouTube OAuth
│   │   │   ├── social-media/         # Social media integrations
│   │   │   │   ├── tiktok/           # TikTok upload/stats
│   │   │   │   └── youtube/          # YouTube upload/analytics
│   │   │   └── video/                # Video generation
│   │   ├── dashboard/                # Dashboard page
│   │   ├── analytics/                # Analytics page
│   │   ├── library/                  # Video library
│   │   ├── create/                   # Video creation flow
│   │   ├── settings/                 # Settings pages
│   │   └── video/[videoId]/          # Video detail page
│   ├── components/
│   │   ├── analytics/                # Analytics components
│   │   │   ├── PlatformSelector.tsx  # Platform toggle (NEW)
│   │   │   └── TimeFrameSelector.tsx # Time filter (NEW)
│   │   ├── dashboard/                # Dashboard components
│   │   ├── layout/                   # Layout components
│   │   └── ui/                       # Shadcn/ui components
│   ├── lib/
│   │   ├── social-media/             # Social media integrations
│   │   │   ├── tiktok.ts             # TikTok API client
│   │   │   ├── youtube.ts            # YouTube API client
│   │   │   └── schema.ts             # Firestore schemas
│   │   ├── prompts/                  # AI prompts by subreddit
│   │   ├── firebase-admin.ts         # Firebase Admin SDK
│   │   └── utils.ts                  # Utility functions
│   └── contexts/
│       └── auth-context.tsx          # Auth state management
├── railway-backend.js                # Worker server (FFmpeg)
├── public/
│   ├── banners/                      # Reddit banner images
│   ├── fonts/                        # Custom fonts for videos
│   └── font-previews/                # Font preview videos
├── nixpacks.toml                     # Railway build config
└── package.json
```

---

## 🎯 **Current Project Status**

### ✅ **Completed Features**

#### **1. Video Generation System**
- ✅ Reddit story generation (GPT-4)
- ✅ Text-to-speech (ElevenLabs)
- ✅ Background video selection (S3)
- ✅ FFmpeg video composition
- ✅ Banner overlays with custom fonts
- ✅ Word-level caption synchronization
- ✅ Multiple subreddit support (AITA, nosleep, ProRevenge, etc.)
- ✅ Voice selection (6 voices)
- ✅ Background selection (minecraft, subway, workers, food)
- ✅ Cliffhanger mode (1min+ videos)

#### **2. Social Media Integrations**

**TikTok**:
- ✅ OAuth 2.0 authentication
- ✅ Video upload (drafts to inbox)
- ✅ Account stats (followers, likes, videos)
- ✅ Custom upload modal with hashtags
- ✅ Privacy level selection
- ⏳ **Waiting for audit** (2-4 weeks for public uploads)

**YouTube**:
- ✅ OAuth 2.0 authentication
- ✅ Video upload (public/private/unlisted)
- ✅ Channel analytics (subscribers, views, watch time)
- ✅ Per-video analytics (views, likes, comments)
- ✅ 30-day metrics
- ✅ Real-time data

#### **3. Dashboard & Analytics**
- ✅ Beautiful redesigned UI (Elevo-inspired)
- ✅ Platform selector with brand SVG icons (TikTok/YouTube)
- ✅ Time frame selector (7D/30D/90D/All) - YouTube only
- ✅ Dynamic stats cards per platform
- ✅ Video creation metrics
- ✅ Upload success tracking
- ✅ Subscriber growth chart (YouTube)
- ✅ Watch time trends chart (YouTube)
- ✅ Engagement breakdown charts
- ✅ Platform-specific insights

#### **4. UI/UX Design**
- ✅ Modern SaaS design system
- ✅ Consistent typography, spacing, colors
- ✅ Animated components (Framer Motion)
- ✅ Glassmorphism effects
- ✅ Hover states and micro-interactions
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Dark theme with gradients

#### **5. Authentication & User Management**
- ✅ Firebase Auth (email/password)
- ✅ Google OAuth
- ✅ Session cookies (server-side)
- ✅ Protected routes
- ✅ User profile (display name)
- ✅ Settings page

#### **6. Campaign System (Auto-Pilot)**
- ✅ Batch video generation
- ✅ Campaign scheduling
- ✅ Auto-posting to TikTok
- ✅ Subscription-based limits
- ✅ Campaign templates
- ✅ Campaign analytics

---

## 🔧 **Recent Changes (This Session)**

### **Session 1: YouTube Analytics System**
- Added YouTube Analytics API route
- Added `yt-analytics.readonly` scope
- Fetched channel-level and per-video analytics
- Created platform selector (emoji icons)
- Integrated analytics into Dashboard and Analytics pages

### **Session 2: UI/UX Redesign** (LATEST)
- **Redesigned Platform Selector**:
  - Removed emoji icons
  - Added brand-inspired SVG icons
  - Added animated path drawing
  - Added shimmer effects
  - Added glassmorphism
- **Added Time Frame Selector**:
  - 4 options: 7D, 30D, 90D, All
  - Animated slider
  - Hover tooltips
- **Added Subscriber Growth Chart**:
  - Line chart with time frame filtering
  - Summary cards (gained/lost)
- **Added Watch Time Trends Chart**:
  - Line chart with time frame filtering
  - Summary cards (total/average)

---

## 🔑 **Environment Variables**

### **Required on Railway**
```bash
# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# OpenAI
OPENAI_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=

# TikTok
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# YouTube
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://www.taleo.media
```

---

## 🎨 **Design System**

### **Colors**
- **Primary**: Orange (#FF6B35)
- **TikTok**: Pink (#FF0050) to Cyan (#00F2EA)
- **YouTube**: Red (#FF0000) to Dark Red (#CC0000)
- **Background**: Black with subtle gradient
- **Muted**: Gray variants

### **Typography**
- **Font**: Geist Sans (primary), Geist Mono (code)
- **Banner Font**: Lilita One (titles), Titan One (captions)

### **Animations**
- **Spring**: stiffness 300-400, damping 25-30
- **Duration**: 0.2-0.6s
- **Easing**: easeInOut, easeOut

---

## 🐛 **Known Issues & Fixes**

### **Fixed Issues**
1. ✅ Video generation timeouts → Added `spawnWithTimeout`
2. ✅ FFmpeg input indexing bug → Reordered inputs
3. ✅ Videos ending early → Removed `-shortest`, fixed story text
4. ✅ TikTok upload hanging → Added fetch timeouts
5. ✅ Caption timing drift → Using Whisper word timestamps
6. ✅ Response body consumption → Using plain `Response` objects
7. ✅ Gzipped responses → Using `.json()` directly

### **Current Limitations**
- TikTok: Only draft uploads (waiting for audit)
- TikTok: No per-video analytics (need Business API)
- YouTube: Quota limits (10K units/day = ~6 videos)

---

## 📋 **Common Tasks**

### **Adding a New Subreddit**
1. Create prompt file: `src/lib/prompts/new-subreddit.ts`
2. Update subreddit list in create page
3. Add to prompt loader in `railway-backend.js`

### **Adding a New Voice**
1. Get ElevenLabs voice ID
2. Update voice list in create page
3. Add to `VOICES` map in `railway-backend.js`

### **Adding a New Background**
1. Upload video(s) to S3 bucket
2. Update `BACKGROUND_CONFIGS` in `railway-backend.js`

### **Updating Social Media Scopes**
1. Update scope in `src/lib/social-media/{platform}.ts`
2. Update OAuth consent screen (Google/TikTok developer portal)
3. Users must disconnect and reconnect

---

## 🚨 **Important Notes**

### **Deployment**
- **DO NOT** use `vercel deploy` (not on Vercel!)
- Changes auto-deploy on `git push origin main`
- Railway watches the GitHub repo
- Build takes ~3-5 minutes
- Check Railway logs for errors

### **Database**
- Firestore collections:
  - `users` - User profiles
  - `social_media_credentials` - OAuth tokens
  - `campaigns` - Auto-pilot campaigns
  - `videos` - Video metadata and analytics

### **FFmpeg on Railway**
- FFmpeg 7.1.1 installed via Nixpacks
- ImageMagick installed for rounded backgrounds
- Custom fonts loaded from S3
- Timeout: 10 minutes per video

### **Testing**
- Test video generation: `/create`
- Test analytics: `/analytics` (requires YouTube connected)
- Test uploads: Generate video → Upload from `/video/[videoId]`

---

## 🎯 **Next Steps / Roadmap**

### **High Priority**
- [ ] Wait for TikTok audit approval (2-4 weeks)
- [ ] Request YouTube quota increase (if needed)
- [ ] Add per-video analytics display (YouTube)
- [ ] Add traffic source breakdown (YouTube)

### **Medium Priority**
- [ ] Add video editing capabilities
- [ ] Add thumbnail customization
- [ ] Add scheduled posting
- [ ] Add A/B testing for titles/hashtags

### **Low Priority**
- [ ] Add Instagram integration
- [ ] Add Twitter/X integration
- [ ] Add bulk editing tools
- [ ] Add team collaboration features

---

## 📞 **Quick Reference**

### **Key Files to Know**
- `railway-backend.js` - Video generation worker
- `src/app/api/video/generate/route.ts` - Video generation API
- `src/lib/social-media/tiktok.ts` - TikTok integration
- `src/lib/social-media/youtube.ts` - YouTube integration
- `src/app/analytics/page.tsx` - Analytics dashboard
- `src/components/analytics/PlatformSelector.tsx` - Platform toggle
- `src/components/analytics/TimeFrameSelector.tsx` - Time filter

### **Common Commands**
```bash
# Install dependencies
npm install

# Run dev server (UI only)
npm run dev

# Run worker locally
node railway-backend.js

# Lint
npm run lint

# Check types
npm run type-check

# Build
npm run build
```

### **Useful Firestore Queries**
```javascript
// Get user profile
db.collection('users').doc(userId).get()

// Get social media credentials
db.collection('social_media_credentials').doc(`${userId}_youtube`).get()

// Get campaigns
db.collection('campaigns').where('userId', '==', userId).get()
```

---

## 🎓 **Developer Notes**

### **Code Style**
- TypeScript strict mode
- ESLint + Prettier
- Tailwind CSS utilities
- Shadcn/ui components
- Framer Motion for animations

### **Naming Conventions**
- Components: PascalCase
- Files: kebab-case or camelCase
- API routes: kebab-case
- Database: snake_case

### **Git Commit Format**
```
feat(scope): Short description

USER REQUEST:
"user's exact quote"

WHAT'S NEW:
- Feature 1
- Feature 2

RESULT:
✅ Success criteria
```

---

## 🆘 **Troubleshooting**

### **Video Generation Fails**
1. Check Railway worker logs
2. Verify FFmpeg timeout settings
3. Check S3 credentials
4. Verify ElevenLabs API key

### **OAuth Fails**
1. Verify redirect URIs in provider console
2. Check environment variables
3. Verify scopes in consent screen
4. Ask user to revoke and reconnect

### **Analytics Not Showing**
1. Check if YouTube connected
2. Verify analytics scope granted
3. Check API quota limits
4. Look for errors in browser console

---

## 📚 **Resources**

- **GitHub**: https://github.com/JONGYYY/adhd-story-gen-VERCEL.git
- **Railway Dashboard**: https://railway.app/
- **TikTok Developers**: https://developers.tiktok.com/
- **Google Cloud Console**: https://console.cloud.google.com/
- **Firebase Console**: https://console.firebase.google.com/

---

## ✅ **Current Status Summary**

**Project Name**: Taleo Shorts AI (formerly StoryGen AI)
**Status**: ✅ Production-ready
**Last Updated**: 2026-02-03
**Latest Feature**: Redesigned analytics with time frame filtering
**Deployment**: Railway (auto-deploy on push)
**Domain**: https://www.taleo.media

**Active Integrations**:
- ✅ YouTube (full analytics)
- ⏳ TikTok (draft uploads only, waiting for audit)

**All Systems**: ✅ Operational
**Known Issues**: None critical
**Build Status**: ✅ Passing

---

**Ready for new chat session! 🚀**

