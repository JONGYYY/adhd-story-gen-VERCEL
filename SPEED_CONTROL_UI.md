# Video Speed Control UI - User Guide

## ✅ Pushed to Production!

**Commit**: `1d39c3f` - User-adjustable video speed control

## What You'll See

### New Step 4: "Adjust Video Speed"

After selecting your voice, you'll see a new card with:

```
┌─────────────────────────────────────────────────────────┐
│  4  Adjust Video Speed                                   │
│     Make your video faster or slower for better engagement│
│                                                            │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐               │
│  │ 🐢 │  │ ▶️ │  │ ⚡ │  │ 🔥 │  │ 🚀 │              │
│  │0.9x│  │1.0x│  │1.2x│  │1.3x│  │1.5x│              │
│  │Slow│  │Norm│  │Smth│  │Recd│  │Fast│              │
│  └────┘  └────┘  └────┘  └────┘  └────┘               │
│                                                            │
│  ⚡ Custom Speed                            1.3x          │
│  ●────────●─────────────────────────────────             │
│  0.5x                                       2.0x          │
│                                                            │
│  🕐 Estimated Duration                                    │
│     60s video → 46s  •  90s video → 69s                  │
│                                                            │
│  🔥 Recommended for TikTok/Shorts - maximum engagement   │
└─────────────────────────────────────────────────────────┘
```

## Speed Presets

### 🐢 0.9x - Slower
- **10% slower** than normal
- **Use for**: Dramatic stories, emotional moments, serious topics
- **Duration**: 60s → 67s

### ▶️ 1.0x - Normal
- **Original speed** (no adjustment)
- **Use for**: When you want natural, unmodified pacing
- **Duration**: 60s → 60s (unchanged)

### ⚡ 1.2x - Smooth
- **20% faster**
- **Use for**: Subtle speedup, maintains very natural feel
- **Duration**: 60s → 50s

### 🔥 1.3x - Recommended (Default)
- **30% faster**
- **Use for**: Most content - perfect for TikTok/YouTube Shorts
- **Best engagement** based on platform trends
- **Duration**: 60s → 46s

### 🚀 1.5x - Fast
- **50% faster**
- **Use for**: Action stories, high-energy content, quick highlights
- **Duration**: 60s → 40s

## Custom Slider

### Range: 0.5x to 2.0x
- Drag the slider for precise control
- Any value between 0.5x (half speed) and 2.0x (double speed)
- Updates in 0.1x increments

### Visual Feedback
- **Gradient fill** shows your position on the slider
- **Large thumb** with shadow for easy grabbing
- **Hover effect** makes thumb grow slightly
- **Real-time value** displayed at the top: "1.3x"

## Duration Calculator

Shows how your speed affects video length:
- **60s example**: "60s video → 46s" (at 1.3x)
- **90s example**: "90s video → 69s" (at 1.3x)
- Updates instantly as you adjust the speed

## Smart Descriptions

The UI automatically shows context-appropriate descriptions:

- **< 1.0x**: "📖 Slower pace for dramatic, emotional stories"
- **= 1.0x**: "▶️ Normal speed - original pacing preserved"
- **1.0-1.3x**: "⚡ Smooth speedup - maintains natural feel"
- **1.3-1.5x**: "🔥 Recommended for TikTok/Shorts - maximum engagement"
- **≥ 1.5x**: "🚀 Fast-paced - great for action stories and highlights"

## How to Use

### Quick Select (Most Common)
1. Go to create page
2. Complete Steps 1-3 (Story, Background, Voice)
3. In Step 4, click one of the preset buttons:
   - Click **🔥 1.3x** for best engagement (recommended)
   - Click **▶️ 1.0x** for normal speed
   - Click **🚀 1.5x** for fast-paced content

### Custom Speed
1. Complete Steps 1-3
2. In Step 4, drag the slider to your desired speed
3. Watch the duration preview update
4. Read the description to understand the effect

### Generate
5. Click "Generate Video" button
6. Your video will be created at the selected speed!

## Technical Details

### What Gets Sped Up
✅ Background footage
✅ Voice narration (maintains pitch quality)
✅ Banner animations
✅ Caption timing (stays perfectly synced)
✅ All visual elements

### Audio Quality
- Uses FFmpeg's `atempo` filter
- **No chipmunk effect** - pitch is maintained
- Works perfectly from 0.5x to 2.0x
- Natural-sounding at all speeds

### Video Quality
- Uses FFmpeg's `setpts` filter
- Smooth playback, no frame drops
- All effects (captions, overlays) stay synced
- No quality degradation

## Integration Priority

The speed is applied in this order:
1. **User-selected speed** from UI (highest priority)
2. `VIDEO_SPEED_MULTIPLIER` environment variable
3. **Default 1.3x** if nothing set

This means:
- Your UI selection always wins
- Environment variable is a fallback
- Default ensures all videos are optimized

## Pro Tips

### For Different Content Types

**Drama/Relationships** (AITA, TrueOffMyChest)
- Use **1.2x - 1.3x**: Maintains emotion while keeping engagement

**Revenge Stories** (ProRevenge)
- Use **1.3x - 1.5x**: Faster pacing for dramatic reveals

**Horror Stories** (nosleep, ShortScaryStories)
- Use **0.9x - 1.0x**: Slower for suspense and atmosphere

**Life Stories** (TIFU, confession)
- Use **1.3x**: Standard engagement optimization

**Work Tales** (TalesFromTechSupport, TalesFromYourServer)
- Use **1.5x**: Fast-paced for comedy and action

### For Platform Optimization

**TikTok**
- Recommended: **1.3x - 1.5x**
- TikTok rewards fast-paced, engaging content
- Higher speeds = more replays

**YouTube Shorts**
- Recommended: **1.3x**
- Balanced between speed and comprehension
- Algorithm favors watch time completion

**Instagram Reels**
- Recommended: **1.2x - 1.3x**
- Slightly more conservative audience
- Quality over pure speed

## Testing Your Speed

### Quick Test
1. Generate a short test story (30-60s)
2. Try different speeds: 1.0x, 1.3x, 1.5x
3. Watch each version
4. Pick what feels best for your content style

### A/B Testing
Generate the same story at different speeds:
- Post 1.0x version on Monday
- Post 1.3x version on Tuesday
- Post 1.5x version on Wednesday
- Compare engagement metrics
- Optimize based on results

## Accessibility Note

While faster speeds improve engagement for most viewers, consider:
- **Non-native English speakers**: Might prefer 1.0x - 1.2x
- **Complex stories**: Keep at 1.0x - 1.3x for comprehension
- **Accessibility**: Some viewers need slower speeds

Balance engagement with accessibility based on your audience!

## Troubleshooting

### Speed Not Applied
- Check Railway deployment completed
- Verify speed shows in video generation logs
- Look for: `[speed] Using speed: 1.3x (source: user-selected)`

### Audio Sounds Distorted
- This shouldn't happen with atempo filter
- If it does, stay within 0.9x - 1.5x range
- Extreme speeds (0.5x, 2.0x) may sound unnatural

### Captions Out of Sync
- Shouldn't happen - captions are part of video stream
- If issues occur, check Railway logs for timing data
- Report if persistent
