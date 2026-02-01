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

// Font display configurations - showing what's actually available
const fontConfigs = [
  // Variable fonts (will render with default weight, which is usually regular/medium)
  { file: 'montserrat-Montserrat[wght].ttf', name: 'Montserrat' },
  { file: 'worksans-WorkSans[wght].ttf', name: 'Work Sans' },
  { file: 'sourcesans3-SourceSans3[wght].ttf', name: 'Source Sans 3' },
  { file: 'rubik-Rubik[wght].ttf', name: 'Rubik' },
  { file: 'inter-Inter-Italic[opsz,wght].ttf', name: 'Inter' },
  { file: 'nunito-Nunito[wght].ttf', name: 'Nunito' },
  { file: 'raleway-Raleway[wght].ttf', name: 'Raleway' },
  { file: 'quicksand-Quicksand[wght].ttf', name: 'Quicksand' },
  { file: 'manrope-Manrope[wght].ttf', name: 'Manrope' },
  { file: 'comfortaa-Comfortaa[wght].ttf', name: 'Comfortaa' },
  { file: 'oswald-Oswald[wght].ttf', name: 'Oswald' },
  { file: 'figtree-Figtree[wght].ttf', name: 'Figtree' },
  { file: 'mulish-Mulish-Italic[wght].ttf', name: 'Mulish' },
  { file: 'opensans-OpenSans-Italic[wdth,wght].ttf', name: 'Open Sans' },
  { file: 'roboto-Roboto-Italic[wdth,wght].ttf', name: 'Roboto' },
  { file: 'nunitosans-NunitoSans-Italic[YTLC,opsz,wdth,wght].ttf', name: 'Nunito Sans' },
  
  // Static fonts
  { file: 'poppins-Poppins-Regular.ttf', name: 'Poppins' },
  { file: 'lato-Lato-Regular.ttf', name: 'Lato' },
  { file: 'ptsans-PT_Sans-Web-Regular.ttf', name: 'PT Sans' },
  { file: 'firasans-FiraSans-Regular.ttf', name: 'Fira Sans' },
  { file: 'varela-Varela-Regular.ttf', name: 'Varela' },
];

async function main() {
  const out =
    getArg('--out') ||
    path.join(process.cwd(), 'public', 'font-previews', 'usable-sans-fonts.mp4');
  const perFontSeconds = Number(getArg('--per-font-seconds') || 2);
  const fps = Number(getArg('--fps') || 30);

  const fontsDir = path.join(process.cwd(), 'public', 'fonts', 'sans-open');

  // Verify all fonts exist
  const availableFonts = [];
  for (const config of fontConfigs) {
    const fontPath = path.join(fontsDir, config.file);
    try {
      await fs.access(fontPath);
      availableFonts.push({ ...config, path: fontPath });
    } catch {
      console.log(`Skipping ${config.name} - file not found`);
    }
  }

  if (availableFonts.length === 0) {
    throw new Error(`No fonts found in ${fontsDir}`);
  }

  console.log(`Found ${availableFonts.length} fonts to preview`);

  await fs.mkdir(path.dirname(out), { recursive: true });

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-usable-sans-'));
  const segDir = path.join(workDir, 'segs');
  await fs.mkdir(segDir, { recursive: true });

  const segPaths: string[] = [];

  for (let i = 0; i < availableFonts.length; i++) {
    const font = availableFonts[i];
    const segPath = path.join(segDir, `seg-${String(i).padStart(4, '0')}.mp4`);
    segPaths.push(segPath);

    const label = escapeDrawtext(font.name);
    const sample = escapeDrawtext('The Quick Brown Fox Jumps 1234567890');
    const fontfileEsc = escapeDrawtext(font.path);

    const vf =
      // Font name (using default font for reliability)
      `drawtext=text='${label}':fontsize=52:fontcolor=white:borderw=8:bordercolor=black:x=(w-text_w)/2:y=h*0.35,` +
      // Sample text (using the actual font file)
      `drawtext=fontfile='${fontfileEsc}':text='${sample}':fontsize=80:fontcolor=white:borderw=10:bordercolor=black:x=(w-text_w)/2:y=h*0.50,` +
      // Counter
      `drawtext=text='${String(i + 1)}/${String(availableFonts.length)}':fontsize=40:fontcolor=white@0.95:borderw=6:bordercolor=black:x=40:y=40`;

    console.log(`Rendering ${i + 1}/${availableFonts.length}: ${font.name}`);

    run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=#111111:s=1080x1920:d=${perFontSeconds}`,
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

  console.log('Concatenating segments...');
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

  console.log(`✅ Created: ${out}`);
  console.log(`📝 Fonts included: ${availableFonts.length}`);
  console.log('\nAvailable fonts:');
  availableFonts.forEach((f, i) => console.log(`  ${i + 1}. ${f.name}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

