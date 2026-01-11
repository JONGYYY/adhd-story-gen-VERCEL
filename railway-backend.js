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
// In-memory font preview job status
const fontPreviewStatus = new Map();

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

async function ensureFontPreviewsDir() {
  const dir = path.join(__dirname, 'public', 'font-previews');
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

function listInstalledFontFaces({ match, limit } = {}) {
  const { execFileSync } = require('child_process');
  const re = match ? new RegExp(String(match), 'i') : null;
  const raw = execFileSync('fc-list', ['-f', '%{file}|%{family}|%{style}\n'], { encoding: 'utf-8' });
  const out = [];
  const seen = new Set();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const [fileRaw, famRaw, styleRaw] = t.split('|');
    const file = (fileRaw || '').trim();
    const familyRaw = (famRaw || '').trim();
    const style = (styleRaw || '').trim() || 'Regular';
    if (!file || !familyRaw) continue;
    for (const family of familyRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const label = `${family} (${style})`;
      if (re && !re.test(label)) continue;
      const key = `${file}||${family}||${style}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ file, family, style, label });
      if (limit && out.length >= limit) return out;
    }
  }
  return out;
}

function escapeDrawtext(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
}

async function generateFontsPreviewMp4({ outPath, match, limit = 180, perFontSeconds = 0.35, fps = 30 } = {}, jobId) {
  const { spawn } = require('child_process');
  const tmpDir = path.join(__dirname, 'tmp');
  await fsp.mkdir(tmpDir, { recursive: true });

  const faces = listInstalledFontFaces({ match, limit });
  if (!faces.length) throw new Error('No fonts matched (or fontconfig not available).');

  const workDir = await fsp.mkdtemp(path.join(tmpDir, `fontpreview-${jobId}-`));
  const segDir = path.join(workDir, 'segs');
  await fsp.mkdir(segDir, { recursive: true });

  const segPaths = [];
  const total = faces.length;

  const run = (args) => new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => { stderr += String(d); });
    p.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed ${code}: ${stderr.slice(-2000)}`));
    });
  });

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    const segPath = path.join(segDir, `seg-${String(i).padStart(4, '0')}.mp4`);
    segPaths.push(segPath);

    const label = escapeDrawtext(face.label);
    const sample = escapeDrawtext('THE QUICK BROWN FOX 1234567890');
    const fontfileEsc = escapeDrawtext(face.file);

    const vf =
      // White BG; label uses default font to stay readable.
      `drawtext=text='${label}':fontsize=58:fontcolor=white:borderw=10:bordercolor=black:x=(w-text_w)/2:y=h*0.33,` +
      // Sample uses the actual font file to avoid silent fallback.
      `drawtext=fontfile='${fontfileEsc}':text='${sample}':fontsize=92:fontcolor=white:borderw=12:bordercolor=black:x=(w-text_w)/2:y=h*0.52,` +
      `drawtext=text='${i + 1}/${total}':fontsize=42:fontcolor=white@0.95:borderw=6:bordercolor=black:x=40:y=40`;

    fontPreviewStatus.set(jobId, { status: 'processing', progress: Math.round((i / total) * 95), message: `Rendering font ${i + 1}/${total}` });

    await run([
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=white:s=1080x1920:d=${Number(perFontSeconds)}`,
      '-vf', vf,
      '-r', String(fps),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      segPath
    ]);
  }

  const concatList = segPaths.map((p) => `file '${String(p).replace(/'/g, "'\\''")}'`).join('\n') + '\n';
  const concatPath = path.join(workDir, 'concat.txt');
  await fsp.writeFile(concatPath, concatList, 'utf-8');

  fontPreviewStatus.set(jobId, { status: 'processing', progress: 96, message: 'Concatenating segments' });
  await run([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-movflags', '+faststart',
    outPath
  ]);

  fontPreviewStatus.set(jobId, { status: 'completed', progress: 100, message: 'Done', videoUrl: `/font-previews/${path.basename(outPath)}`, count: total });
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

// List fonts available on THIS worker (fontconfig)
app.get('/api/fonts', (req, res) => {
  try {
    const match = req.query.match ? String(req.query.match) : '';
    const limit = req.query.limit ? Number(req.query.limit) : 500;
    const faces = listInstalledFontFaces({ match, limit: isFinite(limit) ? limit : 500 });
    res.json({ success: true, count: faces.length, fonts: faces.map((f) => f.label) });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

// Generate a font preview MP4 from fonts available on THIS worker.
// Usage:
//   POST /api/fonts-preview/start?limit=180&per=0.35&match=sans
// Then poll:
//   GET  /api/fonts-preview/status/:jobId
app.post('/api/fonts-preview/start', async (req, res) => {
  try {
    const jobId = uuidv4();
    const limit = req.query.limit ? Number(req.query.limit) : 180;
    const per = req.query.per ? Number(req.query.per) : 0.35;
    const match = req.query.match ? String(req.query.match) : '';

    const dir = await ensureFontPreviewsDir();
    const outPath = path.join(dir, `railway-fonts-${jobId}.mp4`);
    fontPreviewStatus.set(jobId, { status: 'processing', progress: 0, message: 'Starting…' });

    (async () => {
      try {
        await generateFontsPreviewMp4(
          {
            outPath,
            match,
            limit: isFinite(limit) ? limit : 180,
            perFontSeconds: isFinite(per) ? per : 0.35
          },
          jobId
        );
      } catch (e) {
        console.error('Font preview generation failed:', e);
        fontPreviewStatus.set(jobId, { status: 'failed', error: e?.message || String(e) });
      }
    })();

    res.status(202).json({
      success: true,
      jobId,
      statusUrl: `/api/fonts-preview/status/${jobId}`,
      note: 'This runs on the worker. When completed, videoUrl will be under /font-previews/.'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

app.get('/api/fonts-preview/status/:jobId', (req, res) => {
  const st = fontPreviewStatus.get(req.params.jobId);
  if (!st) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, ...st });
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
    // Speed: transcode to small 16k mono Opus before uploading to Whisper.
    // This is usually much faster than uploading full-quality mp3.
    const tmpDir = path.join(__dirname, 'tmp');
    await fsp.mkdir(tmpDir, { recursive: true });
    const whisperInput = path.join(tmpDir, `whisper-${uuidv4()}.ogg`);
    try {
      const { spawn } = require('child_process');
      await new Promise((resolve) => {
        const p = spawn('ffmpeg', [
          '-y',
          '-i', audioPath,
          '-vn',
          '-ac', '1',
          '-ar', '16000',
          '-c:a', 'libopus',
          '-b:a', '24k',
          whisperInput
        ]);
        p.on('close', () => resolve());
        p.on('error', () => resolve());
      });
    } catch {}

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = fs.createReadStream(fs.existsSync(whisperInput) ? whisperInput : audioPath);

    // Request verbose JSON with word timestamps (Whisper)
    // Hard timeout so video generation never stalls on alignment.
    const timeoutMs = Number(process.env.CAPTION_ALIGN_TIMEOUT_MS || 20000);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), isFinite(timeoutMs) ? timeoutMs : 20000);
    const result = await openai.audio.transcriptions.create(
      {
        file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      },
      { signal: ac.signal }
    ).finally(() => clearTimeout(t));

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

    // Always try to display the ORIGINAL script words (so captions match your story),
    // while using Whisper timings for alignment. This prevents "missing words" when Whisper
    // drops tokens, and reduces drift by anchoring to matched words and interpolating the rest.
    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const scriptWords = String(scriptText || '').split(/\s+/).filter(Boolean);
    if (scriptWords.length === 0) return transcribed;

    const scriptNorm = scriptWords.map(normalize);
    const transNorm = transcribed.map((w) => normalize(w.text));

    const LOOKAHEAD = Number(process.env.CAPTION_ALIGN_LOOKAHEAD || 8);
    const mapIdx = new Array(scriptWords.length).fill(null); // script index -> transcribed index

    let i = 0;
    let j = 0;
    while (i < scriptWords.length && j < transcribed.length) {
      const a = scriptNorm[i];
      const b = transNorm[j];
      if (a && b && a === b) {
        mapIdx[i] = j;
        i++; j++;
        continue;
      }
      // Look ahead in transcription for the current script token.
      let foundJ = -1;
      for (let k = 1; k <= LOOKAHEAD && (j + k) < transcribed.length; k++) {
        if (a && transNorm[j + k] === a) { foundJ = j + k; break; }
      }
      if (foundJ !== -1) {
        j = foundJ;
        mapIdx[i] = j;
        i++; j++;
        continue;
      }
      // Look ahead in script for the current transcription token (script has extra words).
      let foundI = -1;
      for (let k = 1; k <= LOOKAHEAD && (i + k) < scriptWords.length; k++) {
        if (b && scriptNorm[i + k] === b) { foundI = i + k; break; }
      }
      if (foundI !== -1) {
        i = foundI;
        continue;
      }
      // Fallback: treat as substitution (keeps timing anchored).
      mapIdx[i] = j;
      i++; j++;
    }

    // Compute a reasonable default duration for interpolated/missing tokens.
    const durs = transcribed.map((t) => Math.max(0.01, (t.end - t.start))).filter((x) => isFinite(x));
    durs.sort((a, b) => a - b);
    const medianDur = durs.length ? durs[Math.floor(durs.length / 2)] : 0;
    const fallbackDur = isFinite(medianDur) && medianDur > 0 ? medianDur : Math.max(0.06, (fallbackDurationSec || 0) / Math.max(1, scriptWords.length));

    // Helper to find next mapped index >= start.
    const nextMapped = (startIdx) => {
      for (let k = startIdx; k < mapIdx.length; k++) if (mapIdx[k] !== null) return k;
      return -1;
    };

    const out = new Array(scriptWords.length);
    let prevMappedScript = -1;
    let prevEnd = 0;

    for (let sIdx = 0; sIdx < scriptWords.length; ) {
      if (mapIdx[sIdx] !== null) {
        const t = transcribed[mapIdx[sIdx]];
        const start = Math.max(0, Number(t.start) || 0);
        const end = Math.max(start + 0.01, Number(t.end) || start + fallbackDur);
        out[sIdx] = { text: scriptWords[sIdx], start, end };
        prevMappedScript = sIdx;
        prevEnd = end;
        sIdx++;
        continue;
      }

      // Fill a run of unmapped script words until next mapped anchor.
      const runStart = sIdx;
      let runEnd = runStart;
      while (runEnd < scriptWords.length && mapIdx[runEnd] === null) runEnd++;
      const runCount = runEnd - runStart;

      const nextScript = nextMapped(runEnd);
      let nextStart = null;
      if (nextScript !== -1) {
        const t = transcribed[mapIdx[nextScript]];
        nextStart = Math.max(0, Number(t.start) || 0);
      }

      if (nextStart !== null) {
        // Distribute into the gap between prevEnd and nextStart.
        const gapStart = Math.max(prevEnd, 0);
        const gapEnd = Math.max(nextStart, gapStart);
        const gap = gapEnd - gapStart;
        const per = gap > 0 ? Math.max(0.01, gap / runCount) : fallbackDur;
        let cur = gapStart;
        for (let k = 0; k < runCount; k++) {
          const st = cur;
          const en = Math.min(gapEnd, st + per);
          out[runStart + k] = { text: scriptWords[runStart + k], start: st, end: Math.max(st + 0.01, en) };
          cur = en;
        }
        prevEnd = out[runEnd - 1].end;
      } else {
        // No next anchor: place after prevEnd using fallbackDur.
        let cur = Math.max(prevEnd, 0);
        for (let k = 0; k < runCount; k++) {
          const st = cur;
          const en = st + fallbackDur;
          out[runStart + k] = { text: scriptWords[runStart + k], start: st, end: en };
          cur = en;
        }
        prevEnd = out[runEnd - 1].end;
      }

      sIdx = runEnd;
    }

    const aligned = out.filter(Boolean);
    if (process.env.CAPTION_DEBUG === '1') {
      const mappedCount = mapIdx.filter((x) => x !== null).length;
      console.log('[captions] alignment:', {
        scriptWords: scriptWords.length,
        transcribed: transcribed.length,
        mapped: mappedCount,
        lookahead: LOOKAHEAD
      });
    }
    return aligned;
  } catch (e) {
    console.warn('[captions] OpenAI transcription failed/timed out; using heuristic:', e?.message || e);
    return buildWordTimestamps(fallbackDurationSec, scriptText);
  }
}

function secondsToAssTime(seconds) {
  // ASS time precision is centiseconds. Use rounding (not floor) and handle carry
  // to avoid collapsing very short words into 0-length intervals (which can disappear).
  const s = Math.max(0, Number(seconds) || 0);
  let totalCs = Math.round(s * 100);
  if (!isFinite(totalCs) || totalCs < 0) totalCs = 0;
  const h = Math.floor(totalCs / (3600 * 100));
  totalCs -= h * 3600 * 100;
  const m = Math.floor(totalCs / (60 * 100));
  totalCs -= m * 60 * 100;
  const sec = Math.floor(totalCs / 100);
  const cs = totalCs - sec * 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

async function writeAssWordCaptions({ outPath, wordTimestamps, offsetSec = 0 }) {
  // Baloo 2 is a variable font in Google Fonts (Baloo2[wght].ttf). We default to the family name
  // and rely on the "Bold" style flag to select a heavy weight.
  const captionFont = String(process.env.CAPTION_FONT || 'Titan One').replace(/,/g, ' ').trim() || 'Arial';
  const captionFontSizeRaw = Number(process.env.CAPTION_FONT_SIZE || 110);
  const captionFontSize = Number.isFinite(captionFontSizeRaw) && captionFontSizeRaw > 0 ? captionFontSizeRaw : 110;
  const captionOutlineRaw = Number(process.env.CAPTION_OUTLINE || 9);
  const captionOutline = Number.isFinite(captionOutlineRaw) && captionOutlineRaw >= 0 ? captionOutlineRaw : 9;
  // "Inner thickness" hack: render a filled underlay (no outline) slightly larger behind the main text.
  // This makes the fill look thicker even when the font weight can't be reliably selected.
  const innerThickRaw = Number(process.env.CAPTION_INNER_THICKNESS || 4); // scale offset percentage points
  const innerThick = Number.isFinite(innerThickRaw) ? Math.max(0, Math.min(20, innerThickRaw)) : 4;
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
  // - Quickly overshoot
  // - Settle
  // Times are in milliseconds relative to each line's start.
  const popInTag = (scaleOffset = 0) => {
    const s0 = 70 + scaleOffset;
    const s1 = 110 + scaleOffset;
    const s2 = 100 + scaleOffset;
    return `{\\fscx${s0}\\fscy${s0}\\alpha&HFF&\\t(0,80,\\fscx${s1}\\fscy${s1}\\alpha&H00&)\\t(80,140,\\fscx${s2}\\fscy${s2}&)}`;
  };
  // Ensure every word is visible for at least ~1 frame and try to keep words sequential.
  // This avoids "missing" words when events are too short or overlapped.
  const minWordDurSecRaw = Number(process.env.CAPTION_MIN_WORD_DUR || 0.04);
  const minWordDurSec = isFinite(minWordDurSecRaw) && minWordDurSecRaw > 0 ? minWordDurSecRaw : 0.04;
  const minWordCs = Math.max(4, Math.round(minWordDurSec * 100)); // >= ~1 frame at 30fps (3.33cs)

  const items = (wordTimestamps || [])
    .map((w) => ({
      text: String(w.text || '').replace(/\r?\n/g, ' ').trim(),
      start: (Number(w.start) || 0) + (Number(offsetSec) || 0),
      end: (Number(w.end) || 0) + (Number(offsetSec) || 0),
    }))
    .filter((w) => w.text.length > 0 && isFinite(w.start) && isFinite(w.end));

  for (let idx = 0; idx < items.length; idx++) {
    const w = items[idx];
    const next = items[idx + 1];
    const startSec = Math.max(0, w.start);
    let endSec = Math.max(w.end, startSec + minWordDurSec);
    // Prefer sequential: don't extend past next word's start (when it exists and is sane).
    if (next && isFinite(next.start) && next.start > startSec) {
      endSec = Math.min(endSec, next.start);
    }

    // Convert to centiseconds and enforce minimum visible duration.
    let stCs = Math.round(startSec * 100);
    let enCs = Math.round(endSec * 100);
    if (!isFinite(stCs) || stCs < 0) stCs = 0;
    if (!isFinite(enCs) || enCs <= stCs) enCs = stCs + minWordCs;
    if (enCs < stCs + minWordCs) enCs = stCs + minWordCs;

    const st = secondsToAssTime(stCs / 100);
    const en = secondsToAssTime(enCs / 100);
    const txt = w.text;
    // Escape ASS special characters minimally
    const safe = txt.replace(/{/g, '\\{').replace(/}/g, '\\}');
    const upper = safe.toUpperCase();
    // Underlay (Layer 0): no outline, tiny blur, slightly larger scale to fake a heavier fill.
    // Keep it subtle so it doesn't look like a glow.
    const underlay = `{\\bord0\\shad0\\blur0.6}` + popInTag(innerThick);
    body += `Dialogue: 0,${st},${en},Default,,0,0,0,,${underlay}${upper}\n`;
    // Main (Layer 1): your outlined text.
    body += `Dialogue: 1,${st},${en},Default,,0,0,0,,${popInTag(0)}${upper}\n`;
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

  // Prepare label for top banner
  // We intentionally do NOT render the subreddit label anymore; only the user-set display name.
  const authorLabel = String(author || '').trim().replace(/^@/, '') || 'Anonymous';
  // Escape strings for FFmpeg filtergraph option values (drawtext in particular).
  // We are NOT going through a shell, so shell quoting doesn't apply; this is for FFmpeg's own parser.
  const esc = (s) => (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,');

  // FFmpeg expressions treat comma as an argument separator; escape commas to keep between() intact.
  const betweenEnable = (start, end) => `between(t\\,${Number(start).toFixed(2)}\\,${Number(end).toFixed(2)})`;

  // Banner/title font selection (match the caption-font approach: ship a font file in /public/fonts
  // and always use it via fontfile=... so Railway doesn't depend on system-installed fonts or env vars).
  //
  // We prefer open-licensed bundled fonts first (so it "just works"), then any optional licensed font files.
  const bannerFontCandidates = [
    // Preferred (bundled, open-licensed)
    path.join(__dirname, 'public', 'fonts', 'sans-open', 'poppins-Poppins-Regular.ttf'),
    path.join(__dirname, 'public', 'fonts', 'GillSans.ttf'),
    path.join(__dirname, 'public', 'fonts', 'GillSans.otf'),
    path.join(__dirname, 'public', 'fonts', 'GillSansMTPro-Bold.ttf'),
    path.join(__dirname, 'public', 'fonts', 'GillSansMTPro-Bold.otf'),
    path.join(__dirname, 'public', 'fonts', 'ArialRoundedMTBold.ttf'),
    path.join(__dirname, 'public', 'fonts', 'ArialRoundedMTBold.otf'),
    path.join(__dirname, 'public', 'fonts', 'TitanOne-Regular.ttf'),
    path.join(__dirname, 'public', 'fonts', 'Baloo2[wght].ttf'),
  ];
  let bannerFontFile = '';
  for (const f of bannerFontCandidates) {
    try { if (fs.existsSync(f)) { bannerFontFile = f; break; } } catch {}
  }
  // Final fallback to any system font file we can find (kept as last resort).
  if (!bannerFontFile && fontPath) bannerFontFile = fontPath;
  const fontOptPrefix = bannerFontFile
    ? `fontfile='${bannerFontFile.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}':`
    : '';
  console.log('[banner-font] using fontfile:', bannerFontFile || '(none)');

  // Badge: optional image displayed next to the author label
  // Be liberal in what we accept (case-sensitive FS on Linux).
  const badgeCandidates = [
    path.join(__dirname, 'public', 'Badge', 'badge.png'),
    path.join(__dirname, 'public', 'badge', 'badge.png'),
    path.join(__dirname, 'public', 'badge.png'),
  ];
  const badgePath = badgeCandidates.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  }) || '';
  const hasBadge = Boolean(badgePath);

  // Measure approximate author label width so we can place the badge right next to it.
  // We use a best-effort Canvas measurement; if unavailable, fallback to a heuristic.
  const AUTHOR_FONT_SIZE = 42;
  const AUTHOR_X = 190;
  const AUTHOR_Y_EXPR = `(h-75-${AUTHOR_FONT_SIZE}-5)`;
  const BADGE_GAP_PX = 10;
  let authorTextWidthPx = Math.ceil((authorLabel || '').length * (AUTHOR_FONT_SIZE * 0.55));
  try {
    // @napi-rs/canvas is already a dependency; if it fails to load on some envs, we keep heuristic.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require('@napi-rs/canvas');
    const c = createCanvas(10, 10);
    const ctx = c.getContext('2d');
    ctx.font = `${AUTHOR_FONT_SIZE}px ${preferredFamily}`;
    const m = ctx.measureText(authorLabel || '');
    if (m && isFinite(m.width)) authorTextWidthPx = Math.ceil(m.width);
  } catch {}
  console.log('[banner] authorLabel:', authorLabel, 'fontSize:', AUTHOR_FONT_SIZE, 'textWidthPx:', authorTextWidthPx);
  console.log('[banner] badge:', { hasBadge, badgePath });

  // If badge exists, compute its scaled width (so we can clamp X without FFmpeg expression parsing issues)
  let badgeScaledWidthPx = 0;
  if (hasBadge) {
    try {
      const { spawnSync } = require('child_process');
      const out = spawnSync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=p=0:s=x',
        badgePath
      ], { encoding: 'utf-8' });
      const txt = String(out.stdout || '').trim();
      const [bw, bh] = txt.split('x').map((n) => Number(n));
      if (bw > 0 && bh > 0) {
        badgeScaledWidthPx = Math.max(1, Math.round((AUTHOR_FONT_SIZE / bh) * bw));
      }
    } catch {}
  }

  // Banner title styling (used on the white box)
  const TITLE_FONT_SIZE = Number(process.env.BANNER_TITLE_FONT_SIZE || 48);
  const TITLE_FONT_SIZE_OK = Number.isFinite(TITLE_FONT_SIZE) && TITLE_FONT_SIZE > 0 ? TITLE_FONT_SIZE : 48;
  const TITLE_LINE_HEIGHT = Math.round(TITLE_FONT_SIZE_OK * 1.2);

  // Wrap title to fit inside the 900px-wide white box (with padding) and grow box height by lines.
  // This is an approximate wrap (character-based), but we also hard-break overlong words so nothing can exceed the box width.
  // The base tuning was fontsize ~52 with maxCharsPerLine ~26.
  // Scale chars/line inversely with font size so large titles don't overflow.
  const wrapTitleForBox = (rawTitle, maxCharsPerLine = Math.max(8, Math.round((26 * 52) / TITLE_FONT_SIZE_OK)), maxLines = 6) => {
    const t = String(rawTitle || '').trim();
    if (!t) return { lines: [''], boxHeight: 200, lineHeight: TITLE_LINE_HEIGHT, paddingTop: 20, paddingBottom: 20 };

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
    const lineHeight = TITLE_LINE_HEIGHT;
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
  const badgeIdx = hasBadge ? idx++ : -1;
  // Synthetic white box as separate lavfi input (avoids drawbox issues)
  const wantWhiteBox = openingDur > 0;
  const whiteBoxIdx = wantWhiteBox ? idx++ : -1;
  const openingIdx = openingBuf ? idx++ : -1;
  const storyIdx = storyBuf ? idx++ : -1;
  if (hasTopBanner) args.push('-i', bannerTopPath);
  if (hasBottomBanner) args.push('-i', bannerBottomPath);
  if (hasBadge) args.push('-i', badgePath);
  if (wantWhiteBox) {
    // 900xH white box, duration equals opening duration (min height, grows with wrapped title)
    args.push('-f', 'lavfi', '-i', `color=c=white:s=900x${wrapped.boxHeight}:d=${openingDur.toFixed(2)}`);
  }
  if (openingBuf) args.push('-i', openingAudio);
  if (storyBuf) args.push('-i', storyAudio);

  // Compose a stacked banner: top + white box + bottom, then overlay as one unit
  // Scale top/bottom to 900 width first (use PNG’s native transparency; no masking)
  if (hasTopBanner) {
    // Scale top, then annotate with author name (+ optional badge).
    filter += `;[${topIdx}:v]scale=900:-1[top0]`;
    // Author label (requested): Hiragino Sans, size 28, moved up 5px. Faux-bold by drawing twice.
    const nameDrawA = `drawtext=${fontOptPrefix}text='${esc(authorLabel)}':fontsize=${AUTHOR_FONT_SIZE}:fontcolor=black:x=${AUTHOR_X}:y=${AUTHOR_Y_EXPR}:shadowx=2:shadowy=2:shadowcolor=white@0.6`;
    const nameDrawB = `drawtext=${fontOptPrefix}text='${esc(authorLabel)}':fontsize=${AUTHOR_FONT_SIZE}:fontcolor=black:x=${AUTHOR_X + 1}:y=${AUTHOR_Y_EXPR}:shadowx=2:shadowy=2:shadowcolor=white@0.6`;
    filter += `;[top0]${nameDrawA}[top1];[top1]${nameDrawB}[top2]`;

    if (hasBadge) {
      // Scale badge to match name height, and place it 10px to the right of the measured name width.
      // Clamp to stay on-screen within the 900px-wide top banner (avoid expression parsing issues).
      const badgeX = AUTHOR_X + authorTextWidthPx + BADGE_GAP_PX;
      const badgeXClamped = Math.max(0, Math.min(badgeX, 900 - (badgeScaledWidthPx || AUTHOR_FONT_SIZE) - 10));
      console.log('[banner] badge placement:', { badgeX, badgeXClamped, badgeScaledWidthPx });
      filter += `;[${badgeIdx}:v]scale=-1:${AUTHOR_FONT_SIZE}:flags=lanczos,format=rgba[badge0]`;
      // Overlay badge LAST so it's always in the front layer.
      filter += `;[top2][badge0]overlay=x=${badgeXClamped}:y=${AUTHOR_Y_EXPR}[top]`;
    } else {
      filter += `;[top2]null[top]`;
    }
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
      // Title: bold + 5x font size (28 -> 140). Faux-bold by drawing twice with 1px offset.
      const drawLineA = `drawtext=${fontOptPrefix}text='${lineText}':fontsize=${TITLE_FONT_SIZE_OK}:fontcolor=black:x=44:y=${y}:shadowx=0:shadowy=0:box=0`;
      const drawLineB = `drawtext=${fontOptPrefix}text='${lineText}':fontsize=${TITLE_FONT_SIZE_OK}:fontcolor=black:x=45:y=${y}:shadowx=0:shadowy=0:box=0`;
      filter += `;[wb${i}]${drawLineA}[wb${i}a];[wb${i}a]${drawLineB}[wb${i + 1}]`;
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