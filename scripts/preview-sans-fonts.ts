import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

type Args = {
  out: string;
  width: number;
  height: number;
  fps: number;
  perFontSeconds: number;
  limit: number; // 0 means unlimited
  match: string; // regex string (case-insensitive by default); applied to "family style"
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseArgs(): Args {
  const out = getArg('--out') || path.join(process.cwd(), 'public', 'font-previews', 'sans-fonts.mp4');
  const width = Number(getArg('--width') || 1080);
  const height = Number(getArg('--height') || 1920);
  const fps = Number(getArg('--fps') || 30);
  const perFontSeconds = Number(getArg('--per-font-seconds') || 1.25);
  const limit = Number(getArg('--limit') || 0);
  const match = String(getArg('--match') || 'sans');

  if (!Number.isFinite(width) || width <= 0) throw new Error(`Invalid --width: ${width}`);
  if (!Number.isFinite(height) || height <= 0) throw new Error(`Invalid --height: ${height}`);
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`Invalid --fps: ${fps}`);
  if (!Number.isFinite(perFontSeconds) || perFontSeconds <= 0) throw new Error(`Invalid --per-font-seconds: ${perFontSeconds}`);
  if (!Number.isFinite(limit) || limit < 0) throw new Error(`Invalid --limit: ${limit}`);
  if (!match) throw new Error('Invalid --match (empty).');

  return { out, width, height, fps, perFontSeconds, limit, match };
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function escapeAssLikeTextForDrawtext(s: string): string {
  // drawtext uses ':' as option separator; escape characters that break parsing.
  // We pass the filter as a single argument (no shell), but ffmpeg still parses drawtext.
  return s
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
}

function run(cmd: string, args: string[]) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

type FontFace = { family: string; style: string };

function uniqFaces(faces: FontFace[]): FontFace[] {
  const seen = new Set<string>();
  const out: FontFace[] = [];
  for (const f of faces) {
    const key = `${f.family}||${f.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function getMatchingFaces(match: string): FontFace[] {
  const re = new RegExp(match, 'i');
  // Use fontconfig to list font families + styles.
  // A single line can include multiple families separated by comma (styles usually not comma-separated, but handle anyway).
  const raw = execFileSync('fc-list', ['-f', '%{family}|%{style}\n'], { encoding: 'utf-8' });
  const faces: FontFace[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [famRaw, styleRaw] = trimmed.split('|');
    const style = (styleRaw || '').trim() || 'Regular';
    for (const fam of String(famRaw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      faces.push({ family: fam, style });
    }
  }

  const matching = faces.filter((f) => re.test(`${f.family} ${f.style}`));
  // Keep stable-ish order but dedupe, then sort for easier scanning.
  return uniqFaces(matching).sort((a, b) => {
    const c = a.family.localeCompare(b.family);
    if (c !== 0) return c;
    return a.style.localeCompare(b.style);
  });
}

async function main() {
  const args = parseArgs();
  const faces = getMatchingFaces(args.match);
  const selected = args.limit > 0 ? faces.slice(0, args.limit) : faces;

  if (selected.length === 0) {
    throw new Error(`No fonts matched /${args.match}/i via fc-list.`);
  }

  await fs.mkdir(path.dirname(args.out), { recursive: true });

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-font-preview-'));
  const segDir = path.join(workDir, 'segs');
  await fs.mkdir(segDir, { recursive: true });

  const segPaths: string[] = [];

  for (let i = 0; i < selected.length; i++) {
    const { family, style } = selected[i];
    const segPath = path.join(segDir, `seg-${String(i).padStart(4, '0')}.mp4`);
    segPaths.push(segPath);

    const familyEsc = escapeAssLikeTextForDrawtext(family);
    const styleEsc = escapeAssLikeTextForDrawtext(style);
    const fontPatternEsc = escapeAssLikeTextForDrawtext(`${family}:style=${style}`);

    const line1 = escapeAssLikeTextForDrawtext(`${family} (${style})`);
    const line2 = escapeAssLikeTextForDrawtext('The quick brown fox jumps over 1234567890');

    const vf =
      // White background + white text with black outline.
      // Render the FONT NAME line using the default font (no `font=`) so it's readable even if
      // the candidate font has missing glyphs (some "Sans" families can be symbol/icon fonts).
      `drawtext=text='${line1}':fontsize=72:fontcolor=white:borderw=8:bordercolor=black:x=(w-text_w)/2:y=h*0.35,` +
      `drawtext=font='${fontPatternEsc}':text='${line2}':fontsize=92:fontcolor=white:borderw=10:bordercolor=black:x=(w-text_w)/2:y=h*0.50,` +
      `drawtext=text='${String(i + 1)}/${String(selected.length)}':fontsize=44:fontcolor=white@0.95:borderw=6:bordercolor=black:x=40:y=40`;

    run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=white:s=${args.width}x${args.height}:d=${args.perFontSeconds}`,
      '-vf',
      vf,
      '-r',
      String(args.fps),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      segPath
    ]);
  }

  const listPath = path.join(workDir, 'concat.txt');
  const listBody = segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
  await fs.writeFile(listPath, listBody, 'utf-8');

  // Concatenate + re-encode into final mp4 for maximum compatibility.
  run('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(args.fps),
    '-movflags',
    '+faststart',
    args.out
  ]);

  // eslint-disable-next-line no-console
  console.log(`Wrote: ${args.out}`);
  // eslint-disable-next-line no-console
  console.log(`Fonts included: ${selected.length} (matched /${args.match}/i)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


