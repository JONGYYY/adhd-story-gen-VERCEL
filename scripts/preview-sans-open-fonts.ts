import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function escapeDrawtext(s: string): string {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
}

function run(cmd: string, args: string[]) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

async function main() {
  const out =
    getArg('--out') ||
    path.join(process.cwd(), 'public', 'font-previews', 'sans-open-fonts.mp4');
  const limit = Number(getArg('--limit') || 0);
  const perFontSeconds = Number(getArg('--per-font-seconds') || 0.6);
  const fps = Number(getArg('--fps') || 30);

  const fontsDir = path.join(process.cwd(), 'public', 'fonts', 'sans-open');
  const manifestPath = path.join(fontsDir, 'manifest.json');

  let files: string[] = [];
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    files = Array.isArray(manifest.files) ? manifest.files : [];
  } catch {
    const all = await fs.readdir(fontsDir);
    files = all.filter((f) => f.toLowerCase().endsWith('.ttf'));
  }

  files = files.filter((f) => f.toLowerCase().endsWith('.ttf'));
  files.sort();
  if (limit > 0) files = files.slice(0, limit);

  if (files.length === 0) {
    throw new Error(`No .ttf files found in ${fontsDir}. Run: npm run fonts:download:sans-open`);
  }

  await fs.mkdir(path.dirname(out), { recursive: true });

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-sans-open-fonts-'));
  const segDir = path.join(workDir, 'segs');
  await fs.mkdir(segDir, { recursive: true });

  const segPaths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const fontPath = path.join(fontsDir, filename);
    const segPath = path.join(segDir, `seg-${String(i).padStart(4, '0')}.mp4`);
    segPaths.push(segPath);

    const label = escapeDrawtext(filename.replace(/^.*?-/, '').replace(/\.ttf$/i, ''));
    const sample = escapeDrawtext('THE QUICK BROWN FOX 1234567890');
    const fontfileEsc = escapeDrawtext(fontPath);

    const vf =
      `drawtext=text='${label}':fontsize=62:fontcolor=white:borderw=10:bordercolor=black:x=(w-text_w)/2:y=h*0.33,` +
      `drawtext=fontfile='${fontfileEsc}':text='${sample}':fontsize=92:fontcolor=white:borderw=12:bordercolor=black:x=(w-text_w)/2:y=h*0.52,` +
      `drawtext=text='${String(i + 1)}/${String(files.length)}':fontsize=42:fontcolor=white@0.95:borderw=6:bordercolor=black:x=40:y=40`;

    run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=white:s=1080x1920:d=${perFontSeconds}`,
      '-vf',
      vf,
      '-r',
      String(fps),
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
    String(fps),
    '-movflags',
    '+faststart',
    out
  ]);

  // eslint-disable-next-line no-console
  console.log(`Wrote: ${out}`);
  // eslint-disable-next-line no-console
  console.log(`Fonts included: ${files.length} (from ${fontsDir})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


