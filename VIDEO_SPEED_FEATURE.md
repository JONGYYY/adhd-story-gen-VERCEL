# Video Speed Multiplier Feature

## Overview
Videos are now automatically sped up by **1.3x (30% faster)** to make content more engaging and align with modern short-form video trends.

## How It Works

### Speed Application
- **Video**: Uses FFmpeg `setpts` filter to adjust video playback speed
- **Audio**: Uses FFmpeg `atempo` filter to adjust audio pitch and tempo
- **Synchronized**: Both video and audio are sped up by the same amount

### Default Speed
- **1.3x** (30% faster than original)
- This means:
  - A 60-second video becomes ~46 seconds
  - A 90-second video becomes ~69 seconds
  - Audio pitch is maintained (no chipmunk effect)

## Configuration

### Environment Variable
Set `VIDEO_SPEED_MULTIPLIER` in Railway to adjust the speed:

```bash
VIDEO_SPEED_MULTIPLIER=1.3  # 30% faster (default)
VIDEO_SPEED_MULTIPLIER=1.5  # 50% faster
VIDEO_SPEED_MULTIPLIER=1.2  # 20% faster
VIDEO_SPEED_MULTIPLIER=1.0  # Normal speed (no adjustment)
VIDEO_SPEED_MULTIPLIER=0.9  # 10% slower
```

### Valid Range
- **Minimum**: 0.5 (50% speed / half speed)
- **Maximum**: 2.0 (200% speed / double speed)
- **Default**: 1.3 (130% speed / 30% faster)

### How to Change

#### In Railway:
1. Go to Railway dashboard
2. Select your worker service
3. Go to **Variables** tab
4. Add/edit: `VIDEO_SPEED_MULTIPLIER` = `1.3` (or your desired value)
5. Redeploy the service

#### Local Development:
Add to your `.env` file:
```
VIDEO_SPEED_MULTIPLIER=1.3
```

## Technical Details

### FFmpeg Implementation

#### Video Speed
```bash
setpts=PTS/1.3
```
- Adjusts presentation timestamps to speed up video
- Applied at the end of the video filter chain
- Works with all video effects (captions, banner, etc.)

#### Audio Speed
```bash
atempo=1.3
```
- Changes audio tempo without affecting pitch
- Applied before audio concatenation
- Maintains voice quality and naturalness

### Applied To
✅ Opening audio (title)
✅ Story audio (narration)
✅ Background video
✅ Banner overlays
✅ Captions (automatically synced)
✅ Fallback mode (when main processing fails)

### Performance Impact
- **Minimal**: Speed adjustment is a simple filter
- **No additional encoding time**: Part of the same FFmpeg pass
- **File size**: Slightly smaller (shorter duration)

## Benefits

### User Engagement
- **Faster pacing** keeps viewers engaged
- Aligns with TikTok/YouTube Shorts viewing habits
- Reduces dead air and pauses

### Platform Optimization
- **TikTok**: Prefers snappy, fast-paced content
- **YouTube Shorts**: Faster = more replays in 60s limit
- Better retention rates with quicker delivery

### Flexibility
- Easy to adjust per campaign or trend
- Can slow down for dramatic stories (0.9x)
- Can speed up significantly for highlights (1.5x+)

## Examples

### Story Duration Changes

| Original | 1.2x | 1.3x (default) | 1.5x | 2.0x |
|----------|------|----------------|------|------|
| 60s      | 50s  | 46s            | 40s  | 30s  |
| 90s      | 75s  | 69s            | 60s  | 45s  |
| 120s     | 100s | 92s            | 80s  | 60s  |
| 180s     | 150s | 138s           | 120s | 90s  |

### Use Cases

**1.3x (Default)**: General stories, perfect for most content
**1.5x**: Action-packed stories, drama, revenge tales
**1.2x**: Subtle speedup, preserves naturalness
**1.0x**: No speedup, for serious/emotional content
**0.9x**: Slower, more dramatic delivery

## Quality Considerations

### Audio Quality
- FFmpeg's `atempo` filter maintains pitch
- No "chipmunk" or distorted voices
- Natural-sounding speedup
- Works well up to 1.5x

### Video Quality
- No frame dropping or stuttering
- Smooth playback at any speed
- Captions remain perfectly synchronized
- Background footage adapts seamlessly

## Logs

When speed is applied, you'll see in Railway logs:
```
[speed] Applying 1.3x speed to video and audio
```

If speed is 1.0 (disabled), no log appears.

## Disabling Speed

To return to normal speed:
1. Set `VIDEO_SPEED_MULTIPLIER=1.0` in Railway
2. Or remove the variable (defaults to 1.3x)

## Future Enhancements

Possible improvements:
- **User-selectable speed**: Add option in UI for users to choose speed
- **Per-subreddit speed**: Different speeds for different content types
- **Adaptive speed**: Analyze content and apply optimal speed
- **Speed ranges**: Different speeds for opening vs. story sections

## Testing

To test different speeds:
1. Generate a test video
2. Check duration in video metadata
3. Listen to audio quality
4. Verify caption synchronization
5. Adjust `VIDEO_SPEED_MULTIPLIER` as needed

## Troubleshooting

### Audio Sounds Weird
- Try lower multiplier (1.2x instead of 1.5x)
- Check that `atempo` is within 0.5-2.0 range

### Video and Audio Out of Sync
- This shouldn't happen if both use same multiplier
- Check Railway logs for speed application
- Verify both video and audio filters include speed

### Captions Off-Time
- Captions are overlaid on sped-up video, so they should sync
- If issues persist, check ASS file timestamps in logs
