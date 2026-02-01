import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

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

// Fonts that are both rounded AND thick/bold
const fontConfigs = [
  // Sans-Open: Rounded fonts
  { dir: 'sans-open', file: 'comfortaa-Comfortaa[wght].ttf', name: 'Comfortaa (Very Rounded)' },
  { dir: 'sans-open', file: 'quicksand-Quicksand[wght].ttf', name: 'Quicksand (Rounded)' },
  { dir: 'sans-open', file: 'nunito-Nunito[wght].ttf', name: 'Nunito (Soft Rounded)' },
  { dir: 'sans-open', file: 'nunitosans-NunitoSans-Italic[YTLC,opsz,wdth,wght].ttf', name: 'Nunito Sans (Rounded)' },
  { dir: 'sans-open', file: 'rubik-Rubik[wght].ttf', name: 'Rubik (Rounded Corners)' },
  { dir: 'sans-open', file: 'varela-Varela-Regular.ttf', name: 'Varela (Simple Round)' },
  { dir: 'sans-open', file: 'manrope-Manrope[wght].ttf', name: 'Manrope (Geometric Round)' },
  
  // Cartoon: Thick & Rounded fonts
  { dir: 'cartoon', file: 'titanone-TitanOne-Regular.ttf', name: 'Titan One ⭐ (VERY THICK)' },
  { dir: 'cartoon', file: 'fredoka-Fredoka[wdth,wght].ttf', name: 'Fredoka (Thick Rounded)' },
  { dir: 'cartoon', file: 'chango-Chango-Regular.ttf', name: 'Chango (Heavy Rounded)' },
  { dir: 'cartoon', file: 'bowlbyonesc-BowlbyOneSC-Regular.ttf', name: 'Bowlby One SC (Bold Round)' },
  { dir: 'cartoon', file: 'bubblegumsans-BubblegumSans-Regular.ttf', name: 'Bubblegum Sans (Bubbly)' },
  { dir: 'cartoon', file: 'chewy-Chewy-Regular.ttf', name: 'Chewy (Chunky)' },
  { dir: 'cartoon', file: 'gorditas-Gorditas-Bold.ttf', name: 'Gorditas Bold (Fat)' },
  { dir: 'cartoon', file: 'lilitaone-LilitaOne-Regular.ttf', name: 'Lilita One (Round Bold)' },
  { dir: 'cartoon', file: 'luckiestguy-LuckiestGuy-Regular.ttf', name: 'Luckiest Guy (Extra Bold)' },
  { dir: 'cartoon', file: 'bangers-Bangers-Regular.ttf', name: 'Bangers (Comic Bold)' },
  
  // Also from root fonts
  { dir: '', file: 'Baloo2[wght].ttf', name: 'Baloo 2 (Playful Round)' },
  { dir: '', file: 'TitanOne-Regular.ttf', name: 'Titan One (Root) ⭐' },
];

async function main() {
  const out =
    path.join(process.cwd(), 'public', 'font-previews', 'round-thick-fonts.mp4');
  const perFontSeconds = 2;
  const fps = 30;

  const fontsBaseDir = path.join(process.cwd(), 'public', 'fonts');

  // Verify all fonts exist
  const availableFonts = [];
  for (const config of fontConfigs) {
    const fontPath = config.dir 
      ? path.join(fontsBaseDir, config.dir, config.file)
      : path.join(fontsBaseDir, config.file);
    
    try {
      await fs.access(fontPath);
      availableFonts.push({ ...config, path: fontPath });
    } catch {
      console.log(`Skipping ${config.name} - file not found at ${fontPath}`);
    }
  }

  if (availableFonts.length === 0) {
    throw new Error(`No fonts found in ${fontsBaseDir}`);
  }

  console.log(`Found ${availableFonts.length} round & thick fonts to preview`);

  await fs.mkdir(path.dirname(out), { recursive: true });

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-round-thick-'));
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
  console.log('\nRound & Thick fonts available:');
  availableFonts.forEach((f, i) => console.log(`  ${i + 1}. ${f.name}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

