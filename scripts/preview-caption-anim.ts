import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

type Anim = 'pop' | 'bounce';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function secondsToAssTime(seconds: number): string {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100); // centiseconds
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAssText(s: string): string {
  return String(s || '')
    .replace(/\r?\n/g, ' ')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .trim();
}

function run(cmd: string, args: string[]) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function animTag(anim: Anim): string {
  if (anim === 'bounce') {
    // 0–80ms: scale up fast + fade in
    // 80–160ms: drop below 100%
    // 160–240ms: settle to 100%
    return `{\\fscx60\\fscy60\\alpha&HFF&` +
      `\\t(0,80,\\fscx120\\fscy120\\alpha&H00&)` +
      `\\t(80,160,\\fscx92\\fscy92&)` +
      `\\t(160,240,\\fscx100\\fscy100&)}`;
  }

  // pop
  return `{\\fscx70\\fscy70\\alpha&HFF&` +
    `\\t(0,80,\\fscx110\\fscy110\\alpha&H00&)` +
    `\\t(80,140,\\fscx100\\fscy100&)}`;
}

async function main() {
  const anim = (getArg('--anim') || 'pop') as Anim;
  if (anim !== 'pop' && anim !== 'bounce') throw new Error(`Invalid --anim: ${anim}`);

  const out =
    getArg('--out') ||
    path.join(process.cwd(), 'public', 'anim-previews', `caption-${anim}-in.mp4`);
  const font = String(getArg('--font') || 'Baloo 2').replace(/,/g, ' ').trim() || 'Arial';
  const fontsdir = getArg('--fontsdir') || path.join(process.cwd(), 'public', 'fonts');
  const duration = Number(getArg('--duration') || 6);

  await fs.mkdir(path.dirname(out), { recursive: true });

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `caption-anim-${anim}-`));
  const assPath = path.join(tmp, `caption-${anim}.ass`);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},200,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,8,0,5,10,10,960,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const words = ['THIS', 'IS', anim.toUpperCase(), 'IN'];
  const per = duration / words.length;
  let body = '';
  for (let i = 0; i < words.length; i++) {
    const st = secondsToAssTime(i * per);
    const en = secondsToAssTime((i + 1) * per);
    body += `Dialogue: 0,${st},${en},Default,,0,0,0,,${animTag(anim)}${escapeAssText(words[i])}\n`;
  }

  await fs.writeFile(assPath, header + body, 'utf-8');

  const assFilter = `ass=filename=${assPath}:fontsdir=${fontsdir}`;
  run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=white:s=1080x1920:d=${duration}`,
    '-vf',
    assFilter,
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    out
  ]);

  // eslint-disable-next-line no-console
  console.log(`Wrote: ${out}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


