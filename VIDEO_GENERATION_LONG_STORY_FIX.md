# Video Generation Fix for Long Stories

## Problem
Video generation was failing for longer stories (multiple paragraphs) but working for short stories (single sentences).

## Root Causes Identified

### 1. **ElevenLabs TTS Character Limit**
- ElevenLabs API has a character limit per request (~5000 chars)
- Long stories exceeded this limit, causing TTS to fail
- **Fix**: Added character limit checking and truncation at word boundaries

### 2. **ASS Subtitle File Issues**
- Large ASS files (many words = many dialogue lines) could cause FFmpeg to fail
- Each word generates 2 dialogue lines (underlay + main), so 500 words = 1000 lines
- Special characters in user-pasted text could break ASS format
- **Fix**: 
  - Added comprehensive character escaping (backslashes, newlines, tabs, braces)
  - Added file size and line count limits (skip captions if > 10MB or > 10000 lines)
  - Added detailed diagnostics to log ASS file stats

### 3. **Word Timestamp Generation Failures**
- OpenAI Whisper API could timeout or fail on very long audio files
- Empty or invalid word timestamps would cause caption generation to crash
- **Fix**:
  - Added try-catch around word timestamp generation
  - Added fallback to heuristic timestamps if audio-based fails
  - Added validation to skip captions if no valid timestamps

### 4. **Insufficient Error Logging**
- Hard to diagnose what was failing
- **Fix**: Added comprehensive logging at every step:
  - TTS synthesis (character count, success/failure)
  - Word timestamp generation (count, validation)
  - ASS file creation (size, line count, sample content)
  - FFmpeg filter construction

## Changes Made

### `/railway-backend.js`

#### 1. Enhanced TTS Synthesis (`synthesizeVoiceEleven`)
```javascript
// Added character limit checking
const MAX_TTS_CHARS = 5000;
if (textLength > MAX_TTS_CHARS) {
  // Truncate at word boundary
  processedText = text.substring(0, MAX_TTS_CHARS);
  // ... smart truncation logic
}
```

#### 2. Better ASS Character Escaping (`writeAssWordCaptions`)
```javascript
// Before: Only escaped {} braces
const safe = txt.replace(/{/g, '\\{').replace(/}/g, '\\}');

// After: Comprehensive escaping
const safe = txt
  .replace(/\\/g, '\\\\')     // Backslash first!
  .replace(/{/g, '\\{')       // Braces
  .replace(/}/g, '\\}')
  .replace(/\n/g, '\\N')      // Newlines
  .replace(/\r/g, '')         // Remove CR
  .replace(/\t/g, ' ')        // Tabs to spaces
  .trim();
```

#### 3. ASS File Safety Limits
```javascript
const MAX_ASS_SIZE_MB = 10;
const MAX_DIALOGUE_LINES = 10000;

if (assStats.size > MAX_ASS_SIZE_MB * 1024 * 1024) {
  // Skip captions, use v_banner as final output
} else if (dialogueCount > MAX_DIALOGUE_LINES) {
  // Skip captions
} else {
  // Apply ass filter normally
}
```

#### 4. Word Timestamp Error Handling
```javascript
let wordTimestamps = [];
try {
  wordTimestamps = await buildWordTimestampsFromAudio(...);
} catch (err) {
  console.error('[captions] ERROR:', err.message);
  // Fallback to heuristic
  wordTimestamps = buildWordTimestamps(storyDur, storyText);
}

// Validation before using
if (!Array.isArray(wordTimestamps) || wordTimestamps.length === 0) {
  console.warn('[captions] No valid timestamps, skipping captions');
  // Skip caption overlay, use v_banner directly
}
```

## Testing Recommendations

### Test Cases
1. **Short story** (1 sentence, ~50 chars)
   - Should work normally with captions
   
2. **Medium story** (3-4 paragraphs, ~1000 chars)
   - Should work normally with captions
   
3. **Long story** (10+ paragraphs, ~3000-4000 chars)
   - Should work with captions
   - Check logs for TTS truncation warnings
   
4. **Very long story** (exceeds 5000 chars)
   - Should truncate TTS at word boundary
   - Should log warning
   - Video should still generate
   
5. **Story with special characters**
   - Test with: backslashes, quotes, newlines, tabs, braces
   - Should escape properly in captions
   
6. **Extremely long story** (would create > 10,000 dialogue lines)
   - Should skip captions entirely
   - Video should still generate with audio
   - Should log warning about skipping captions

### What to Monitor in Logs
- `[TTS] Text too long` - TTS truncation
- `[captions] Total words:` - Word count
- `[captions] ASS file size:` - File size in MB
- `[captions] ASS file dialogue count:` - Number of lines
- `[captions] WARNING: ASS file too large` - Caption skip
- `[captions] WARNING: Too many dialogue lines` - Caption skip
- `[captions] Skipping caption overlay` - Graceful degradation

## Graceful Degradation Strategy

Instead of failing completely, the system now degrades gracefully:

1. **If TTS text > 5000 chars**: Truncate text, continue with shorter audio
2. **If word timestamps fail**: Use heuristic timing fallback
3. **If ASS file too large**: Skip captions, use banner only
4. **If caption generation errors**: Continue without captions

This ensures videos are always generated, even if some features are reduced.

## Future Improvements (Optional)

1. **Chunked TTS**: Split very long stories into multiple TTS requests and concatenate
2. **Streaming ASS**: For extremely long stories, generate ASS incrementally
3. **Adaptive Caption Density**: Show fewer words per second for very long stories
4. **Better Whisper Handling**: Increase timeout or use streaming for long audio

## Deployment Notes

- All changes are in `/railway-backend.js`
- No environment variable changes needed
- No database changes needed
- Compatible with existing video generation flow
- Backward compatible (doesn't break short stories)
