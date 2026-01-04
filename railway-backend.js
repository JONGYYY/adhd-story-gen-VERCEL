const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { v4: uuidv4 } = require('uuid');

console.log('Railway backend script started.'); // Added log

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`Attempting to start server on port: ${PORT}`); // Added log

// In-memory video status storage (for simplicity)
const videoStatus = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Ensure videos directory exists
async function ensureVideosDir() {
  const videosDir = path.join(__dirname, 'public', 'videos');
  await fsp.mkdir(videosDir, { recursive: true });
  return videosDir;
}

// Pick a sample background mp4 to copy (kept for reference/local assets)
async function resolveSampleMp4(preferredCategory) {
  const backgroundsRoot = path.join(__dirname, 'public', 'backgrounds');
  // Prefer smaller samples first to reduce copy time
  const orderedBySizeGuess = [
    'subway', 'asmr', 'cooking', 'workers', preferredCategory, 'minecraft'
  ].filter(Boolean);
  const seen = new Set();
  const candidates = orderedBySizeGuess.filter((c) => { if (seen.has(c)) return false; seen.add(c); return true; });
  for (const cat of candidates) {
    const candidate = path.join(backgroundsRoot, cat, '1.mp4');
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    const dirs = await fsp.readdir(backgroundsRoot);
    for (const dir of dirs) {
      const candidate = path.join(backgroundsRoot, dir, '1.mp4');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (e) {
    console.error('Failed to scan backgrounds directory:', e);
  }
  return null;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check requested.'); // Added log
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'railway-video-backend'
  });
});

// Root route: show basic info (avoid accidental redirects)
const FRONTEND_URL = process.env.FRONTEND_URL;
app.get('/', (req, res) => {
  res.status(200).send(
    FRONTEND_URL
      ? `StoryGen worker is running. Visit frontend at ${FRONTEND_URL}. Endpoints: /generate-video, /api/health.`
      : 'StoryGen worker is running. Endpoints: /generate-video, /api/health.'
  );
});

// External background mapping (S3/CDN preferred via BACKGROUND_BASE_URL, fallback to per-category envs, fallback to MDN sample)
function buildExternalBgMap() {
  const mdn = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
  const base = (process.env.BACKGROUND_BASE_URL || '').replace(/\/$/, '');
  const defaultFilename = process.env.BACKGROUND_FILENAME || '1.mp4';
  // Background categories supported by the UI/worker. Note: worker/food use S3 listing + montage.
  const categories = ['minecraft', 'subway', 'food', 'worker', 'workers'];
  
  const map = {};
  for (const cat of categories) {
    // Priority: explicit category env -> BACKGROUND_BASE_URL/category/filename -> MDN sample
    const envUrl = process.env[`BG_${cat.toUpperCase()}_URL`];
    const baseUrl = base ? `${base}/${cat}/${defaultFilename}` : null;
    map[cat] = envUrl || baseUrl || mdn;
  }
  // Random just picks one of the categories at runtime; keep a placeholder
  map.random = mdn;
  return map;
}
const EXTERNAL_BG = buildExternalBgMap();

// ElevenLabs
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_IDS = {
  brian: 'ThT5KcBeYPX3keUQqHPh',
  adam: 'pNInz6obpgDQGcFmaJgB',
  antoni: 'ErXwobaYiN019PkySvjV',
  sarah: 'EXAVITQu4vr4xnSDxMaL',
  laura: 'pFZP5JQG7iQjIQuC4Bku',
  rachel: '21m00Tcm4TlvDq8ikWAM'
};

async function synthesizeVoiceEleven(text, voiceAlias) {
  if (!ELEVENLABS_API_KEY || !voiceAlias || !VOICE_IDS[voiceAlias]) {
    console.warn('TTS disabled or voice not found. Skipping.');
    return null;
  }
  const voiceId = VOICE_IDS[voiceAlias];
  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`ElevenLabs error ${resp.status}: ${t}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  return buf;
}

// Helpers to get audio duration with ffprobe and build word timestamps
async function getAudioDurationFromFile(audioPath) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const ffprobe = spawn('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath]);
    let output = '';
    ffprobe.stdout.on('data', (d) => (output += d.toString()));
    ffprobe.on('close', (code) => {
      if (code === 0) resolve(parseFloat(output.trim()));
      else reject(new Error(`ffprobe failed with code ${code}`));
    });
    ffprobe.on('error', reject);
  });
}

// Measure effective speech duration by trimming trailing silence using FFmpeg silencedetect
async function getEffectiveSpeechDuration(audioPath, thresholdDb = -35, minSilenceSec = 0.25) {
  const total = await getAudioDurationFromFile(audioPath).catch(() => 0);
  if (!isFinite(total) || total <= 0) return 0;
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const args = ['-hide_banner', '-nostats', '-i', audioPath, '-af', `silencedetect=n=${thresholdDb}dB:d=${minSilenceSec}`, '-f', 'null', '-'];
    const ff = spawn('ffmpeg', args);
    let stderr = '';
    ff.stderr.on('data', (d) => { stderr += d.toString(); });
    ff.on('close', () => {
      // Find last silence_start and prefer if near the end
      const starts = [...stderr.matchAll(/silence_start:\s*([0-9.]+)/g)].map(m => parseFloat(m[1])).filter(n => isFinite(n));
      let effective = total;
      if (starts.length > 0) {
        const lastStart = starts[starts.length - 1];
        // If the last silence begins within the last 1.5s, treat it as trailing silence
        if (total - lastStart >= minSilenceSec && total - lastStart <= 1.5 + minSilenceSec) {
          effective = Math.max(0, lastStart);
        }
      }
      // Safety bounds
      if (!isFinite(effective) || effective <= 0) effective = total;
      resolve(effective);
    });
    ff.on('error', () => resolve(total));
  });
}

// Build word timestamps weighted by approximate word length for more natural pacing
function buildWordTimestamps(totalDuration, text) {
  const words = (text || '').split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0 || !isFinite(totalDuration) || totalDuration <= 0) return [];
  // Weight by characters (strip punctuation), minimum weight 1
  const clean = words.map(w => w.replace(/[.,!?;:]+$/g, ''));
  const weights = clean.map(w => Math.max(1, w.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  const stamps = clean.map((w, i) => {
    const dur = (weights[i] / sum) * totalDuration;
    const start = t;
    const end = t + dur;
    t = end;
    return { text: w, start, end };
  });
  // Guard: ensure strictly increasing and end == totalDuration (floating errors)
  if (stamps.length > 0) {
    stamps[stamps.length - 1].end = totalDuration;
  }
  return stamps;
}

// Word-level timestamps from audio (preferred): OpenAI Whisper transcription with word timestamps.
// Falls back to heuristic timings if unavailable.
async function buildWordTimestampsFromAudio(audioPath, scriptText, fallbackDurationSec) {
  const mode = (process.env.CAPTION_ALIGN || 'openai').toLowerCase(); // openai | heuristic | off
  if (mode === 'off' || mode === 'heuristic') {
    return buildWordTimestamps(fallbackDurationSec, scriptText);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[captions] OPENAI_API_KEY missing; using heuristic timestamps');
    return buildWordTimestamps(fallbackDurationSec, scriptText);
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = fs.createReadStream(audioPath);

    // Request verbose JSON with word timestamps (Whisper)
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

    const words = (result && result.words) ? result.words : [];
    if (!Array.isArray(words) || words.length === 0) {
      console.warn('[captions] OpenAI returned no word timestamps; using heuristic');
      return buildWordTimestamps(fallbackDurationSec, scriptText);
    }

    const transcribed = words
      .map((w) => ({
        text: String(w.word || '').trim(),
        start: Number(w.start) || 0,
        end: Number(w.end) || 0
      }))
      .filter((w) => w.text.length > 0 && isFinite(w.start) && isFinite(w.end) && w.end > w.start);

    if (transcribed.length === 0) {
      console.warn('[captions] OpenAI word timestamps invalid; using heuristic');
      return buildWordTimestamps(fallbackDurationSec, scriptText);
    }

    // Try to keep the ORIGINAL script words (so captions match your story) if it aligns well with transcription.
    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const scriptWords = String(scriptText || '').split(/\s+/).filter(Boolean);
    const transWords = transcribed.map((w) => w.text);

    const minLen = Math.min(scriptWords.length, transWords.length);
    if (minLen > 0 && scriptWords.length === transWords.length) {
      let matches = 0;
      for (let i = 0; i < minLen; i++) {
        if (normalize(scriptWords[i]) === normalize(transWords[i])) matches++;
      }
      const ratio = matches / minLen;
      if (ratio >= 0.7) {
        // Use transcription timestamps but display the intended script tokens
        return transcribed.map((t, i) => ({
          text: scriptWords[i] || t.text,
          start: t.start,
          end: t.end
        }));
      }
    }

    // Otherwise, use transcription words as-is (best sync)
    return transcribed;
  } catch (e) {
    console.warn('[captions] OpenAI transcription failed; using heuristic:', e?.message || e);
    return buildWordTimestamps(fallbackDurationSec, scriptText);
  }
}

function secondsToAssTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100); // centiseconds
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

async function writeAssWordCaptions({ outPath, wordTimestamps, offsetSec = 0 }) {
  // Baloo 2 is a variable font in Google Fonts (Baloo2[wght].ttf). We default to the family name
  // and rely on the "Bold" style flag to select a heavy weight.
  const captionFont = String(process.env.CAPTION_FONT || 'Baloo 2').replace(/,/g, ' ').trim() || 'Arial';
  const captionFontSizeRaw = Number(process.env.CAPTION_FONT_SIZE || 140);
  const captionFontSize = Number.isFinite(captionFontSizeRaw) && captionFontSizeRaw > 0 ? captionFontSizeRaw : 140;
  const captionOutlineRaw = Number(process.env.CAPTION_OUTLINE || 5);
  const captionOutline = Number.isFinite(captionOutlineRaw) && captionOutlineRaw >= 0 ? captionOutlineRaw : 5;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${captionFont},${captionFontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,${captionOutline},0,5,10,10,960,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let body = '';
  // "Pop in" animation (CapCut-style) using ASS transforms:
  // - Start smaller + invisible
  // - Quickly overshoot to ~110%
  // - Settle back to 100%
  // Times are in milliseconds relative to each line's start.
  const popIn = `{\\fscx70\\fscy70\\alpha&HFF&\\t(0,80,\\fscx110\\fscy110\\alpha&H00&)\\t(80,140,\\fscx100\\fscy100&)}`;
  for (const w of wordTimestamps || []) {
    const st = secondsToAssTime((w.start || 0) + offsetSec);
    const en = secondsToAssTime((w.end || 0) + offsetSec);
    const txt = String(w.text || '').replace(/\r?\n/g, ' ').trim();
    if (!txt) continue;
    // Escape ASS special characters minimally
    const safe = txt.replace(/{/g, '\\{').replace(/}/g, '\\}');
    body += `Dialogue: 0,${st},${en},Default,,0,0,0,,${popIn}${safe.toUpperCase()}\n`;
  }
  await fsp.writeFile(outPath, header + body, 'utf-8');
  return outPath;
}

async function buildVideoWithFfmpeg({ title, story, backgroundCategory, voiceAlias, subreddit, author }, videoId) {
  const videosDir = await ensureVideosDir();
  const outPath = path.join(videosDir, `${videoId}.mp4`);

  const tmpDir = path.join(__dirname, 'tmp');
  await fsp.mkdir(tmpDir, { recursive: true });

  // Resolve background from S3 (preferred) with category-specific behavior:
  // - minecraft/subway: pick ONE random video (no 6s chopping)
  // - worker/food: build a montage of ceil(totalDur/6) clips of up to 6 seconds each
  async function resolveBackgroundForVideo(totalDurSec) {
    const AWS = require('aws-sdk');
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
    // BACKGROUND_BASE_URL should look like https://<bucket>.s3.<region>.amazonaws.com/backgrounds
    const baseUrlRaw = (process.env.BACKGROUND_BASE_URL || '').replace(/\/$/, '');
    const basePrefix = (process.env.BACKGROUND_PREFIX || 'backgrounds').replace(/^\/+/, '').replace(/\/+$/, '');
    const publicBase = (process.env.S3_PUBLIC_BASE_URL || baseUrlRaw.replace(/\/backgrounds$/i, '') || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/$/, '');

    const s3 = new AWS.S3({ region });

    const normalizeCat = (cat) => {
      if (!cat) return 'random';
      if (cat === 'workers') return 'worker';
      return cat;
    };
    const cat = normalizeCat(backgroundCategory);

    const prefixesFor = (c) => {
      // Handle worker vs workers ambiguity in S3 folder naming
      if (c === 'worker') return [`${basePrefix}/worker/`, `${basePrefix}/workers/`];
      return [`${basePrefix}/${c}/`];
    };

    const listMp4Keys = async (prefix) => {
      let token = undefined;
      const keys = [];
      for (;;) {
        const resp = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }).promise();
        for (const obj of resp.Contents || []) {
          const k = obj.Key;
          if (k && k.toLowerCase().endsWith('.mp4')) keys.push(k);
        }
        if (!resp.IsTruncated) break;
        token = resp.NextContinuationToken;
      }
      return keys;
    };

    const keyToUrl = (key) => `${publicBase}/${String(key).replace(/^\/+/, '')}`;

    const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const getVideoDurationSeconds = async (input) => {
      const { spawn } = require('child_process');
      return await new Promise((resolve) => {
        const p = spawn('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]);
        let out = '';
        p.stdout.on('data', (d) => (out += d.toString()));
        p.on('close', (code) => {
          if (code === 0) {
            const v = parseFloat(out.trim());
            resolve(isFinite(v) ? v : 0);
  } else {
            resolve(0);
          }
        });
        p.on('error', () => resolve(0));
      });
    };

    const runFfmpeg = async (args, label) => {
      const { spawn } = require('child_process');
      return await new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', args);
        let stderr = '';
        ff.stderr.on('data', (d) => { stderr += d.toString(); });
        ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${label} failed ${code}: ${stderr}`)));
        ff.on('error', reject);
      });
    };

    const buildMontage = async (keys, chunkSec = 6) => {
      const total = Math.max(0.1, Number(totalDurSec) || 0);
      const chunks = Math.max(1, Math.ceil(total / chunkSec));
      const segPaths = [];
      for (let i = 0; i < chunks; i++) {
        const remaining = total - (i * chunkSec);
        const thisDur = Math.max(0.1, Math.min(chunkSec, remaining));
        const key = pickRandom(keys);
        const url = keyToUrl(key);
        const srcDur = await getVideoDurationSeconds(url);
        const maxStart = Math.max(0, (srcDur || (thisDur + 0.5)) - thisDur);
        const start = maxStart > 0 ? (Math.random() * maxStart) : 0;
        const segPath = path.join(tmpDir, `bgseg-${videoId}-${i}.mp4`);
        await runFfmpeg([
          '-y',
          '-ss', `${start}`,
          '-t', `${thisDur}`,
          '-i', url,
          '-an',
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
          '-r', '30',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          segPath
        ], `bg-seg-${i}`);
        segPaths.push(segPath);
      }

      const listPath = path.join(tmpDir, `bgconcat-${videoId}.txt`);
      const listBody = segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
      await fsp.writeFile(listPath, listBody);

      const montagePath = path.join(tmpDir, `bgmontage-${videoId}.mp4`);
      await runFfmpeg([
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-an',
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        montagePath
      ], 'bg-concat');

      return montagePath;
    };

    // If S3 not configured, fall back to existing single-URL behavior
    if (!bucket) {
      console.warn('[bg] Missing S3_BUCKET; falling back to EXTERNAL_BG mapping');
      const fallbackUrl = EXTERNAL_BG[cat] || EXTERNAL_BG.random;
      return { bgPath: fallbackUrl, bgInfo: { mode: 'fallback_url', url: fallbackUrl } };
    }

    // Random category picks among known categories
    const effectiveCat = cat === 'random'
      ? pickRandom(['minecraft', 'subway', 'food', 'worker'])
      : cat;

    const prefixes = prefixesFor(effectiveCat);
    let keys = [];
    let usedPrefix = null;
    for (const pfx of prefixes) {
      try {
        const ks = await listMp4Keys(pfx);
        if (ks.length > 0) {
          keys = ks;
          usedPrefix = pfx;
          break;
        }
      } catch (e) {
        console.warn('[bg] listObjects failed for prefix', pfx, e?.message || e);
      }
    }

    if (!keys.length) {
      console.warn('[bg] No mp4 keys found in S3 for', effectiveCat, 'prefixes', prefixes, '; falling back to EXTERNAL_BG');
      const fallbackUrl = EXTERNAL_BG[effectiveCat] || EXTERNAL_BG.random;
      return { bgPath: fallbackUrl, bgInfo: { mode: 'fallback_url', url: fallbackUrl } };
    }

    console.log('[bg] category=', effectiveCat, 'prefix=', usedPrefix, 'files=', keys.length);

    // No split for minecraft/subway
    if (effectiveCat === 'minecraft' || effectiveCat === 'subway') {
      const key = pickRandom(keys);
      const url = keyToUrl(key);
      return { bgPath: url, bgInfo: { mode: 'single', key, url, count: keys.length } };
    }

    // Split montage for worker/food
    const montage = await buildMontage(keys, 6);
    return { bgPath: montage, bgInfo: { mode: 'montage', prefix: usedPrefix, count: keys.length, totalDurSec, montage } };
  }

  // Synthesize TTS for title and story segments
  const openingText = title || '';
  const storyText = (story || '').split('[BREAK]')[0].trim() || story || '';
  const openingBuf = await synthesizeVoiceEleven(openingText, voiceAlias).catch(() => null);
  const storyBuf = await synthesizeVoiceEleven(storyText, voiceAlias).catch(() => null);

  // Write audio to files
  const openingAudio = path.join(tmpDir, `open-${videoId}.mp3`);
  const storyAudio = path.join(tmpDir, `story-${videoId}.mp3`);
  if (openingBuf) await fsp.writeFile(openingAudio, openingBuf);
  if (storyBuf) await fsp.writeFile(storyAudio, storyBuf);

  // Durations
  // Use effective speech duration (trim trailing silence) so the banner hides exactly when the title ends
  const openingDurRaw = openingBuf ? await getAudioDurationFromFile(openingAudio) : 0;
  const openingDurEff = openingBuf ? await getEffectiveSpeechDuration(openingAudio).catch(() => openingDurRaw) : 0;
  let openingDur = Math.max(openingDurEff, 0);
  // If for some reason we couldn't detect, fall back to raw but cap with a small safety pad
  if (openingDur === 0 && openingDurRaw > 0) openingDur = openingDurRaw;
  // Ensure a tiny minimum so overlay shows briefly if title is ultra short
  openingDur = Math.max(openingDur, 0.6);
  // For caption pacing, also trim trailing silence from story
  const storyDurRaw = storyBuf ? await getAudioDurationFromFile(storyAudio) : 3.0;
  const storyDur = storyBuf ? await getEffectiveSpeechDuration(storyAudio).catch(() => storyDurRaw) : 3.0;

  // Resolve background with knowledge of final duration
  const totalDurSec = Math.max(0.1, openingDur + (storyDur || 0));
  const { bgPath, bgInfo } = await resolveBackgroundForVideo(totalDurSec);
  try { console.log('[bg] selected', JSON.stringify(bgInfo)); } catch {}

  // Word timestamps for captions (audio-based to avoid drift)
  const wordTimestamps = await buildWordTimestampsFromAudio(storyAudio, storyText, storyDur);

  // Banner images (overlay during opening)
  // Prefer pre-rounded assets if present to avoid brittle FFmpeg masking
  const bannerTopRounded = path.join(__dirname, 'public', 'banners', 'redditbannertop_rounded.png');
  const bannerBottomRounded = path.join(__dirname, 'public', 'banners', 'redditbannerbottom_rounded.png');
  const bannerTopPath = fs.existsSync(bannerTopRounded)
    ? bannerTopRounded
    : path.join(__dirname, 'public', 'banners', 'redditbannertop.png');
  const bannerBottomPath = fs.existsSync(bannerBottomRounded)
    ? bannerBottomRounded
    : path.join(__dirname, 'public', 'banners', 'redditbannerbottom.png');
  const hasTopBanner = fs.existsSync(bannerTopPath);
  const hasBottomBanner = fs.existsSync(bannerBottomPath);

  // Font fallback
  let fontPath = '';
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/Windows/Fonts/arial.ttf'
  ];
  for (const f of candidates) {
    try { if (fs.existsSync(f)) { fontPath = f; break; } } catch {}
  }

  // Prepare labels for top banner
  const subLabelRaw = (subreddit || '').trim();
  // Normalize subreddit safely without regex-in-template to avoid parser edge-cases
  const normalizedSub = subLabelRaw.startsWith('r/') ? subLabelRaw.slice(2) : subLabelRaw.replace(/^r\//, '');
  const subLabel = normalizedSub ? ('r/' + normalizedSub) : '';
  const authorLabel = (author || 'Anonymous').replace(/^@/, '');
  // Escape strings for FFmpeg filtergraph option values (drawtext in particular).
  // We are NOT going through a shell, so shell quoting doesn't apply; this is for FFmpeg's own parser.
  const esc = (s) => (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,');

  // FFmpeg expressions treat comma as an argument separator; escape commas to keep between() intact.
  const betweenEnable = (start, end) => `between(t\\,${Number(start).toFixed(2)}\\,${Number(end).toFixed(2)})`;

  // Prefer a font family (via fontconfig) if available; fallback to fontfile path.
  // Try PT Sans by default. You can override with env FONT_FAMILY.
  let fontOpt = '';
  try {
    const { execFileSync } = require('child_process');
    const preferredFamily = process.env.FONT_FAMILY || 'PT Sans';
    execFileSync('fc-match', [preferredFamily], { stdio: ['ignore', 'pipe', 'ignore'] });
    fontOpt = `font='${preferredFamily.replace(/'/g, "\\'")}'`;
    console.log('[ffmpeg] Using font family:', preferredFamily);
  } catch {
    if (fontPath) {
      fontOpt = `fontfile='${fontPath}'`;
      console.log('[ffmpeg] Using fontfile fallback:', fontPath);
    } else {
      console.log('[ffmpeg] No font configured; drawtext will use defaults');
    }
  }
  const fontOptPrefix = fontOpt ? `${fontOpt}:` : '';

  // Wrap title to fit inside the 900px-wide white box (with padding) and grow box height by lines.
  // This is an approximate wrap (character-based), but we also hard-break overlong words so nothing can exceed the box width.
  const wrapTitleForBox = (rawTitle, maxCharsPerLine = 26, maxLines = 6) => {
    const t = String(rawTitle || '').trim();
    if (!t) return { lines: [''], boxHeight: 200, lineHeight: 62, paddingTop: 20, paddingBottom: 20 };

    const breakLongWord = (word) => {
      const parts = [];
      let w = word;
      while (w.length > maxCharsPerLine) {
        parts.push(w.slice(0, maxCharsPerLine));
        w = w.slice(maxCharsPerLine);
      }
      if (w.length) parts.push(w);
      return parts;
    };

    const words = t.split(/\s+/).flatMap((w) => breakLongWord(w));
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length <= maxCharsPerLine) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);

    const minHeight = 200;
    const paddingTop = 20;
    const paddingBottom = 20;
    const lineHeight = 62; // tuned for fontsize 52-ish
    const boxHeight = Math.max(minHeight, paddingTop + paddingBottom + (lines.length * lineHeight));
    return { lines, boxHeight, lineHeight, paddingTop, paddingBottom };
  };

  const wrapped = wrapTitleForBox(title, 26, 6);

  const { spawn } = require('child_process');

  // Build filter_complex: scale+crop to 1080x1920 (base), overlays and captions will be appended
  let filter = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=brightness=0.05:contrast=1.1:saturation=1.1[bg]`;
  let current = 'bg';

  // Prepare inputs and determine indexes
  const args = ['-y', '-i', bgPath];
  let idx = 1;
  const topIdx = hasTopBanner ? idx++ : -1;
  const bottomIdx = hasBottomBanner ? idx++ : -1;
  // Synthetic white box as separate lavfi input (avoids drawbox issues)
  const wantWhiteBox = openingDur > 0;
  const whiteBoxIdx = wantWhiteBox ? idx++ : -1;
  const openingIdx = openingBuf ? idx++ : -1;
  const storyIdx = storyBuf ? idx++ : -1;
  if (hasTopBanner) args.push('-i', bannerTopPath);
  if (hasBottomBanner) args.push('-i', bannerBottomPath);
  if (wantWhiteBox) {
    // 900xH white box, duration equals opening duration (min height, grows with wrapped title)
    args.push('-f', 'lavfi', '-i', `color=c=white:s=900x${wrapped.boxHeight}:d=${openingDur.toFixed(2)}`);
  }
  if (openingBuf) args.push('-i', openingAudio);
  if (storyBuf) args.push('-i', storyAudio);

  // Compose a stacked banner: top + white box + bottom, then overlay as one unit
  // Scale top/bottom to 900 width first (use PNG’s native transparency; no masking)
  if (hasTopBanner) {
    // Scale top, then annotate with subreddit and @author at x=20
    filter += `;[${topIdx}:v]scale=900:-1[top0]`;
    const topDraw1 = `drawtext=${fontOptPrefix}text='${esc(subLabel)}':fontsize=44:fontcolor=black:x=190:y=36:shadowx=2:shadowy=2:shadowcolor=white@0.6`;
    const topDraw2 = `drawtext=${fontOptPrefix}text='@${esc(authorLabel)}':fontsize=36:fontcolor=black:x=190:y=(h-75-36):shadowx=2:shadowy=2:shadowcolor=white@0.6`;
    filter += `;[top0]${topDraw1}[top1];[top1]${topDraw2}[top]`;
  }
  if (hasBottomBanner) {
    filter += `;[${bottomIdx}:v]scale=900:-1[bot]`;
  }
  // Title text on the white box: left-aligned with padding (x=20,y=20)
  if (wantWhiteBox) {
    // Draw line-by-line instead of embedding \n (more robust for FFmpeg filter parsing)
    const lines = (wrapped.lines && wrapped.lines.length ? wrapped.lines : ['']).slice(0, 6);
    filter += `;[${whiteBoxIdx}:v]null[wb0]`;
    for (let i = 0; i < lines.length; i++) {
      const y = 20 + (i * (wrapped.lineHeight || 62));
      const lineText = esc(lines[i] || '');
      const drawLine = `drawtext=${fontOptPrefix}text='${lineText}':fontsize=52:fontcolor=black:x=20:y=${y}:shadowx=0:shadowy=0:box=0`;
      filter += `;[wb${i}]${drawLine}[wb${i + 1}]`;
    }
  }
  if (hasTopBanner && wantWhiteBox && hasBottomBanner) {
    const wbOut = `wb${((wrapped.lines && wrapped.lines.length) ? wrapped.lines.slice(0, 6).length : 1)}`;
    filter += `;[top][${wbOut}]vstack=inputs=2[tw];[tw][bot]vstack=inputs=2[banner]`;
    filter += `;[${current}][banner]overlay=(main_w-w)/2:(main_h-h)/2:enable=${betweenEnable(0, openingDur)}[v_banner]`;
    current = 'v_banner';
  } else if (hasTopBanner && wantWhiteBox) {
    const wbOut = `wb${((wrapped.lines && wrapped.lines.length) ? wrapped.lines.slice(0, 6).length : 1)}`;
    filter += `;[top][${wbOut}]vstack=inputs=2[banner]`;
    filter += `;[${current}][banner]overlay=(main_w-w)/2:(main_h-h)/2:enable=${betweenEnable(0, openingDur)}[v_banner]`;
    current = 'v_banner';
  } else if (wantWhiteBox && hasBottomBanner) {
    const wbOut = `wb${((wrapped.lines && wrapped.lines.length) ? wrapped.lines.slice(0, 6).length : 1)}`;
    filter += `;[${wbOut}][bot]vstack=inputs=2[banner]`;
    filter += `;[${current}][banner]overlay=(main_w-w)/2:(main_h-h)/2:enable=${betweenEnable(0, openingDur)}[v_banner]`;
    current = 'v_banner';
  } else if (hasTopBanner && hasBottomBanner) {
    filter += `;[top][bot]vstack=inputs=2[banner]`;
    filter += `;[${current}][banner]overlay=(main_w-w)/2:(main_h-h)/2:enable=${betweenEnable(0, openingDur)}[v_banner]`;
    current = 'v_banner';
  } else if (hasTopBanner) {
    filter += `;[${current}][top]overlay=(main_w-w)/2:(main_h-h)/2:enable=${betweenEnable(0, openingDur)}[v_banner]`;
    current = 'v_banner';
  } else if (hasBottomBanner) {
    filter += `;[${current}][bot]overlay=(main_w-w)/2:(main_h-h)/2:enable=${betweenEnable(0, openingDur)}[v_banner]`;
    current = 'v_banner';
  } else if (wantWhiteBox) {
    const wbOut = `wb${((wrapped.lines && wrapped.lines.length) ? wrapped.lines.slice(0, 6).length : 1)}`;
    filter += `;[${current}][${wbOut}]overlay=(main_w-w)/2:(main_h-h)/2:enable=${betweenEnable(0, openingDur)}[v_banner]`;
    current = 'v_banner';
  }

  // Draw per-word captions over the composed video
  // IMPORTANT: Use libass to render word captions from a file.
  // This avoids huge filtergraphs (one drawtext per word) that can fail on longer videos.
  const assPath = path.join(tmpDir, `captions-${videoId}.ass`);
  await writeAssWordCaptions({ outPath: assPath, wordTimestamps, offsetSec: openingDur });
  // Apply subtitles filter (libass)
  // Escape commas/colons for filtergraph option parsing.
  const assEsc = assPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/,/g, '\\,');
  const fontsDir = path.join(__dirname, 'public', 'fonts');
  const fontsDirExists = (() => { try { return fs.existsSync(fontsDir); } catch { return false; } })();
  const fontsDirEsc = fontsDir.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/,/g, '\\,');
  filter += `;[${current}]ass=filename=${assEsc}:original_size=1080x1920${fontsDirExists ? `:fontsdir=${fontsDirEsc}` : ''}[v_cap]`;
  current = 'v_cap';

  // Audio graph within the same filter_complex
  let haveAudio = false;
  if (openingIdx >= 0 && storyIdx >= 0) {
    haveAudio = true;
    filter += `;[${openingIdx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100,asetpts=PTS-STARTPTS[oa];` +
              `[${storyIdx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100,asetpts=PTS-STARTPTS[sa];` +
              `[oa][sa]concat=n=2:v=0:a=1[aout]`;
  } else if (openingIdx >= 0) {
    haveAudio = true;
    filter += `;[${openingIdx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100,asetpts=PTS-STARTPTS[aout]`;
  } else if (storyIdx >= 0) {
    haveAudio = true;
    filter += `;[${storyIdx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100,asetpts=PTS-STARTPTS[aout]`;
  }

  // Apply single filter_complex and proper mapping
  args.push(
    '-filter_complex', filter,
    '-map', `[${current}]`
  );
  if (haveAudio) args.push('-map', '[aout]');

  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-r', '30', '-pix_fmt', 'yuv420p', '-shortest', outPath
  );

  console.log('FFMPEG FILTER_COMPLEX =>', filter);
  console.log('FFMPEG ARGS =>', JSON.stringify(args));

  try {
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', args);
      let stderr = '';
      ff.stderr.on('data', (d) => { stderr += d.toString(); });
      ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg failed ${code}: ${stderr}`)));
    });
  } catch (err) {
    const allowFallback = (process.env.ALLOW_PLAIN_FALLBACK || '0') === '1';
    if (!allowFallback) {
      console.error('Primary ffmpeg graph failed (no fallback):', err.message);
      throw err;
    }

    console.error('Primary ffmpeg graph failed, falling back to simple compose (no banner/captions):', err.message);
    // Fallback: background + concatenated audio, no banner/captions
    const fallbackArgs = ['-y', '-i', bgPath];
    if (openingBuf) { fallbackArgs.push('-i', openingAudio); }
    if (storyBuf) { fallbackArgs.push('-i', storyAudio); }

    const audioInputs = openingBuf && storyBuf ? ['1:a', '2:a'] : (openingBuf ? ['1:a'] : (storyBuf ? ['1:a'] : []));
    const fallbackFilter = audioInputs.length === 2
      ? `[${audioInputs[0]}]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100[oa];[${audioInputs[1]}]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100[sa];[oa][sa]concat=n=2:v=0:a=1[aout]`
      : (audioInputs.length === 1 ? `[${audioInputs[0]}]aformat=sample_fmts=fltp:channel_layouts=stereo,aresample=44100[aout]` : 'anullsrc');

    if (audioInputs.length > 0) {
      fallbackArgs.push('-filter_complex', fallbackFilter, '-map', '0:v', '-map', '[aout]');
    } else {
      fallbackArgs.push('-map', '0:v');
    }

    fallbackArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-r', '30', '-pix_fmt', 'yuv420p', '-shortest', outPath);

    console.log('FFMPEG FALLBACK FILTER =>', fallbackFilter);
    console.log('FFMPEG FALLBACK ARGS =>', JSON.stringify(fallbackArgs));

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', fallbackArgs);
      let stderr = '';
      ff.stderr.on('data', (d) => { stderr += d.toString(); });
      ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`fallback ffmpeg failed ${code}: ${stderr}`)));
    });
  }

  return `/videos/${videoId}.mp4`;
}

// Simple video generation function
async function generateVideoSimple(options, videoId) {
  console.log(`Generating video for ID: ${videoId} with options:`, options); // Added log
  videoStatus.set(videoId, { status: 'processing', progress: 0, message: 'Video generation started.' });

  await new Promise((r) => setTimeout(r, 300));
  videoStatus.set(videoId, { status: 'processing', progress: 25, message: 'Generating voice-over...' });
  await new Promise((r) => setTimeout(r, 300));
  videoStatus.set(videoId, { status: 'processing', progress: 50, message: 'Compositing video...' });
  await new Promise((r) => setTimeout(r, 300));
  videoStatus.set(videoId, { status: 'processing', progress: 75, message: 'Finalizing...' });

  try {
    // FFmpeg fallback path (no Remotion)
    const videoUrl = await buildVideoWithFfmpeg({
      title: options?.customStory?.title || '',
      story: options?.customStory?.story || '',
      backgroundCategory: options?.background?.category || 'random',
      voiceAlias: options?.voice?.id || 'adam',
      subreddit: options?.customStory?.subreddit || '',
      author: options?.customStory?.author || 'Anonymous'
    }, videoId);
    videoStatus.set(videoId, { status: 'completed', progress: 100, message: 'Video generation complete.', videoUrl });
    console.log(`Video generation completed for ID: ${videoId}`);
  } catch (err) {
    console.error('Video build failed (FFmpeg fallback):', err);
    const msg = err instanceof Error ? err.message : String(err);
    videoStatus.set(videoId, { status: 'failed', error: msg || 'Video build failed' });
  }
}

// Remotion renderer setup (use bundler + renderer)
const {bundle} = require('@remotion/bundler');
const {renderMedia, getCompositions} = require('@remotion/renderer');
const os = require('os');
const {execFileSync} = require('child_process');
const OpenAI = require('openai');

function resolveChromiumExecutable() {
  const envPath = process.env.BROWSER_EXECUTABLE;
  if (envPath && fs.existsSync(envPath)) {
    console.log('[chromium] Using BROWSER_EXECUTABLE env:', envPath);
    return envPath;
  }
  const candidates = ['chromium', 'google-chrome-stable', 'google-chrome', 'chromium-browser'];
  for (const bin of candidates) {
    try {
      const resolved = execFileSync('which', [bin], {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
      if (resolved && fs.existsSync(resolved)) {
        console.log('[chromium] Found via which:', resolved);
        return resolved;
      }
    } catch {}
  }
  console.warn('[chromium] No system Chromium found; falling back to Remotion auto-download');
  return null;
}

async function generateVideoWithRemotion({ title, story, backgroundCategory, voiceAlias }, videoId) {
  const tmpDir = path.join(__dirname, 'tmp');
  await fsp.mkdir(tmpDir, { recursive: true });

  // 1) Resolve inputs (banner, background, audio)
  // Background: pass remote URL directly so Remotion can fetch it
  let bgUrl = EXTERNAL_BG[backgroundCategory] || EXTERNAL_BG.random;

  // Banner assets: use staticFile in composition, so no need to pass file paths

  // Audio via ElevenLabs (optional)
  const openingText = title || '';
  const storyText = (story || '').split('[BREAK]')[0].trim() || story || '';
  const openingBuf = await synthesizeVoiceEleven(openingText, voiceAlias).catch(() => null);
  const storyBuf = await synthesizeVoiceEleven(storyText, voiceAlias).catch(() => null);
  // Also prepare data URLs for Remotion to consume directly
  const openingDataUrl = openingBuf ? `data:audio/mpeg;base64,${openingBuf.toString('base64')}` : '';
  const storyDataUrl = storyBuf ? `data:audio/mpeg;base64,${storyBuf.toString('base64')}` : '';
  // Still write to disk for measuring durations
  const openingAudio = path.join(tmpDir, `open-${videoId}.mp3`);
  const storyAudio = path.join(tmpDir, `story-${videoId}.mp3`);
  if (openingBuf) await fsp.writeFile(openingAudio, openingBuf);
  if (storyBuf) await fsp.writeFile(storyAudio, storyBuf);

  // Durations (opening should be minimum 2.5s)
  const openingDurMs = openingBuf ? Math.round((await getAudioDurationFromFile(openingAudio)) * 1000) : 0;
  const storyDurMs = storyBuf ? Math.round((await getAudioDurationFromFile(storyAudio)) * 1000) : 0;
  const narrationPath = null; // We will pass split tracks (data URLs) to Remotion

  // Compute rough alignment for STORY only (per-word evenly distributed over story audio duration)
  let alignment = { words: [], sampleRate: 16000 };
  if (storyBuf) {
    const totalDur = (storyDurMs || 3000) / 1000;
    const words = storyText.split(/\s+/).filter(w => w.length > 0);
    const avg = words.length > 0 ? (totalDur / words.length) : 0.2;
    alignment.words = words.map((w, i) => ({
      word: w.replace(/[.,!?;:]+$/, ''),
      startMs: Math.round((i * avg) * 1000),
      endMs: Math.round(((i + 1) * avg) * 1000),
      confidence: 0.8
    }));
  }

  // 2) Bundle the Remotion project
  const entry = path.join(__dirname, 'apps', 'renderer', 'src', 'index.ts');
  console.log('Bundling Remotion project from', entry);
  const bundled = await bundle(entry);

  // Determine duration in frames based on opening + story + tail pad (fallback 60s)
  const fps = 30;
  const width = 1080;
  const height = 1920;
  const totalMs = (openingDurMs || 0) + (storyDurMs || 0) + 1500;
  let durationInSeconds = Math.max(totalMs / 1000, 5);
  const durationInFrames = Math.ceil(durationInSeconds * fps);

  // 3) Render with Remotion
  const outPath = path.join(await ensureVideosDir(), `${videoId}.mp4`);
  console.log('Rendering Remotion video to', outPath);
  const browserExec = resolveChromiumExecutable();
  await renderMedia({
    composition: {
      id: 'StoryVideo',
      width,
      height,
      fps,
      durationInFrames,
      defaultProps: {}
    },
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outPath,
    // Prefer system Chromium; if not found, pass null to auto-download
    browserExecutable: browserExec,
    chromiumOptions: {
      gl: 'angle',
      disableWebSecurity: true,
      // Common flags to run in containers + enforce new headless mode
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--headless=new']
    },
    inputProps: {
      bannerPng: '', // legacy unused
      bannerTopPng: '', // use staticFile in composition
      bannerBottomPng: '', // use staticFile in composition
      bannerTitleText: openingText,
      openingDurationMs: openingDurMs,
      bgVideo: bgUrl, // remote URL
      narrationWav: '',
      openingWav: openingDataUrl,
      storyWav: storyDataUrl,
      alignment,
      safeZone: { left: 120, right: 120, top: 320, bottom: 320 },
      fps,
      width,
      height
    }
  });

  return `/videos/${videoId}.mp4`;
}

// Video generation endpoint (handler reused by /api/* alias)
async function generateVideoHandler(req, res) {
	try {
		console.log('Received video generation request.'); // Added log
		const { customStory, voice, background, isCliffhanger } = req.body;
		const videoId = uuidv4();

		// Set initial processing status so /video-status does not 404
		videoStatus.set(videoId, { status: 'processing', progress: 0, message: 'Video generation started.' });

		// Start video generation in the background (FFmpeg-only; Remotion disabled for production stability)
		(async () => {
				try {
					await generateVideoSimple({ customStory, voice, background, isCliffhanger }, videoId);
			} catch (e) {
				console.error('FFmpeg generation failed:', e);
				videoStatus.set(videoId, { status: 'failed', error: (e instanceof Error ? e.message : 'Video build failed') });
			}
		})();

		res.status(202).json({ success: true, message: 'Video generation started.', videoId, statusUrl: `/video-status/${videoId}` });
	} catch (error) {
		console.error('Video generation error:', error); // Added log
		res.status(500).json({ success: false, error: error.message || 'Failed to start video generation' });
	}
}
app.post('/generate-video', generateVideoHandler);

// Aliases for compatibility with /api/* paths
app.post('/api/generate-video', generateVideoHandler);

// Video status endpoint (handler reused by /api/* alias)
async function videoStatusHandler(req, res) {
  try {
    const { videoId } = req.params;
    console.log(`Video status requested for ID: ${videoId}`); // Added log
    const status = videoStatus.get(videoId);

    if (!status) {
      return res.status(404).json({ success: false, error: 'Video ID not found.' });
    }

    res.json(status);
  } catch (error) {
    console.error('Video status error:', error); // Added log
    res.status(500).json({ success: false, error: error.message || 'Failed to get video status' });
  }
}
app.get('/video-status/:videoId', videoStatusHandler);
app.get('/api/video-status/:videoId', videoStatusHandler);

// Serve generated videos
app.get('/videos/:filename', (req, res) => {
  const filename = req.params.filename;
  const videoPath = path.join(__dirname, 'public', 'videos', filename);
  
  if (fs.existsSync(videoPath)) {
    res.sendFile(videoPath);
  } else {
    res.status(404).json({ error: 'Video not found' });
  }
});

// Debug endpoint: Generate r/test story via OpenAI to inspect output
app.all('/debug-story', async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    let subreddit = 'r/test';
    let isCliffhanger = false;
    let narratorGender = 'male';
    if (method === 'GET') {
      subreddit = String(req.query.subreddit || 'r/test');
      isCliffhanger = String(req.query.isCliffhanger || 'false') === 'true';
      narratorGender = (String(req.query.narratorGender || 'male') === 'female') ? 'female' : 'male';
    } else if (method === 'POST') {
      subreddit = String((req.body && req.body.subreddit) || 'r/test');
      isCliffhanger = Boolean(req.body && req.body.isCliffhanger);
      narratorGender = ((req.body && req.body.narratorGender) === 'female') ? 'female' : 'male';
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not set on worker' });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Minimal reproduction of test prompts
    const TEST_PROMPTS = {
      'r/test': {
        cliffhanger:
`Generate a very short test story in the following format:

Title: [title up to 6 words]
Story: [short story with [BREAK] tag, maximum 15 words total]

Example:
Title: Cat Ate My Homework Today
Story: My cat shredded my homework. [BREAK] Now I'm in trouble.

Rules:
1. Title MUST be 6 words or less
2. Story MUST be 15 words or less INCLUDING the [BREAK] tag
3. MUST include [BREAK] tag in the middle of the story
4. Keep it simple and clean
5. Do not include any other text or formatting
6. Do not include the brackets []
7. Do not include any line breaks in the story
8. Do not include any punctuation at the end of the title
9. Do not include any text before Title: or Story:
10. Do not include any text after the story
11. Do not include any empty lines between Title: and Story:`,
        full:
`Generate a very short test story in the following format:

Title: [title up to 6 words]
Story: [short story, maximum 15 words]

Example:
Title: Cat Ate My Homework Today
Story: My cat shredded my homework right before class today.

Rules:
1. Title MUST be 6 words or less
2. Story MUST be 15 words or less
3. Keep it simple and clean
4. Do not include any other text or formatting
5. Do not include the brackets []
6. Do not include any line breaks in the story
7. Do not include any punctuation at the end of the title
8. Do not include any text before Title: or Story:
9. Do not include any text after the story
10. Do not include any empty lines between Title: and Story:`}
    };

    const promptTemplate = (TEST_PROMPTS[subreddit] || TEST_PROMPTS['r/test'])[isCliffhanger ? 'cliffhanger' : 'full'];
    const system = `You are a creative writer who specializes in generating engaging Reddit stories. Follow the prompt exactly as given, including all formatting requirements. Write in a style that would be natural for a ${narratorGender} narrator to tell.${isCliffhanger ? '\n\nIMPORTANT: This is a cliffhanger story. You MUST include a [BREAK] tag.' : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: promptTemplate }
      ],
      temperature: 0.9,
      max_tokens: 500
    });
    const content = completion.choices?.[0]?.message?.content || '';

    // Attempt to parse Title and Story like UI route
    const titleMatch = content.match(/Title:\s*(.+?)(?:\n|$)/);
    const storyMatch = content.match(/Story:\s*(.+?)(?:\n|$)/);
    const title = titleMatch ? titleMatch[1].trim() : null;
    const story = storyMatch ? storyMatch[1].trim() : null;

    return res.json({
      success: true,
      raw: content,
      parsed: { title, story, subreddit, isCliffhanger, narratorGender }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err && err.message) || String(err) });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Railway backend server running on port ${PORT}`); // Added log
});

module.exports = app; 