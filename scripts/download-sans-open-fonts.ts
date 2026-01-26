import path from 'node:path';
import fs from 'node:fs/promises';

type GithubContent = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  url: string;
};

type FontSpec = {
  root: 'ofl' | 'apache'; // folder under google/fonts/<root>/
  dir: string;
  preferredNames?: string[]; // prefer these filenames if present (case-insensitive)
};

// Curated list of high-quality open-licensed sans-serif fonts from Google Fonts
const SANS_OPEN_FONTS: FontSpec[] = [
  // Popular, clean sans-serifs
  { root: 'ofl', dir: 'roboto', preferredNames: ['Roboto-Regular.ttf'] },
  { root: 'ofl', dir: 'opensans', preferredNames: ['OpenSans-Regular.ttf'] },
  { root: 'ofl', dir: 'lato', preferredNames: ['Lato-Regular.ttf'] },
  { root: 'ofl', dir: 'montserrat', preferredNames: ['Montserrat-Regular.ttf'] },
  { root: 'ofl', dir: 'poppins', preferredNames: ['Poppins-Regular.ttf'] },
  { root: 'ofl', dir: 'inter', preferredNames: ['Inter-Regular.ttf'] },
  { root: 'ofl', dir: 'sourcesans3', preferredNames: ['SourceSans3-Regular.ttf'] },
  { root: 'ofl', dir: 'raleway', preferredNames: ['Raleway-Regular.ttf'] },
  { root: 'ofl', dir: 'ubuntusans', preferredNames: ['UbuntuSans-Regular.ttf'] },
  { root: 'ofl', dir: 'nunitosans', preferredNames: ['NunitoSans-Regular.ttf'] },
  
  // Rounded/friendly sans-serifs
  { root: 'ofl', dir: 'quicksand', preferredNames: ['Quicksand-Regular.ttf'] },
  { root: 'ofl', dir: 'nunito', preferredNames: ['Nunito-Regular.ttf'] },
  { root: 'ofl', dir: 'comfortaa', preferredNames: ['Comfortaa-Regular.ttf'] },
  { root: 'ofl', dir: 'varela', preferredNames: ['Varela-Regular.ttf'] },
  
  // Geometric sans-serifs
  { root: 'ofl', dir: 'worksans', preferredNames: ['WorkSans-Regular.ttf'] },
  { root: 'ofl', dir: 'ptsans', preferredNames: ['PTSans-Regular.ttf'] },
  { root: 'ofl', dir: 'mulish', preferredNames: ['Mulish-Regular.ttf'] },
  { root: 'ofl', dir: 'dmsans', preferredNames: ['DMSans-Regular.ttf'] },
  
  // Condensed/display sans
  { root: 'ofl', dir: 'oswald', preferredNames: ['Oswald-Regular.ttf'] },
  { root: 'ofl', dir: 'firasans', preferredNames: ['FiraSans-Regular.ttf'] },
];

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'adhd-story-gen-font-downloader'
    }
  });
  if (!resp.ok) throw new Error(`GitHub API error ${resp.status} for ${url}`);
  return (await resp.json()) as T;
}

function pickBestTtf(files: GithubContent[], preferredNames?: string[]): GithubContent | null {
  const ttf = files.filter((f) => f.type === 'file' && f.name.toLowerCase().endsWith('.ttf') && f.download_url);
  if (ttf.length === 0) return null;

  const byName = (n: string) => ttf.find((f) => f.name.toLowerCase() === n.toLowerCase()) || null;
  for (const pref of preferredNames || []) {
    const hit = byName(pref);
    if (hit) return hit;
  }

  // Prefer Regular weight if present.
  const weightOrder = ['regular', 'medium', 'normal', 'book'];
  const score = (name: string) => {
    const lower = name.toLowerCase();
    const idx = weightOrder.findIndex((w) => lower.includes(w));
    return idx === -1 ? 999 : idx;
  };
  return [...ttf].sort((a, b) => score(a.name) - score(b.name) || a.name.localeCompare(b.name))[0];
}

async function downloadFile(url: string, outPath: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed ${resp.status} for ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'fonts', 'sans-open');
  await fs.mkdir(outDir, { recursive: true });

  const results: Array<{ dir: string; file?: string; ok: boolean; reason?: string }> = [];

  for (const spec of SANS_OPEN_FONTS) {
    const baseApi = `https://api.github.com/repos/google/fonts/contents/${spec.root}/${spec.dir}`;
    try {
      const listing = await fetchJson<GithubContent[]>(baseApi);

      // Prefer static folder when present (it usually contains Regular files).
      const staticDir = listing.find((x) => x.type === 'dir' && x.name.toLowerCase() === 'static');
      let candidates: GithubContent[] = listing;
      if (staticDir) {
        candidates = await fetchJson<GithubContent[]>(staticDir.url);
      }

      const chosen = pickBestTtf(candidates, spec.preferredNames);
      if (!chosen?.download_url) {
        results.push({ dir: `${spec.root}/${spec.dir}`, ok: false, reason: 'No .ttf file found' });
        continue;
      }

      const outName = `${spec.dir}-${chosen.name}`.replace(/\s+/g, '_');
      const dest = path.join(outDir, outName);
      await downloadFile(chosen.download_url, dest);
      results.push({ dir: `${spec.root}/${spec.dir}`, file: outName, ok: true });
    } catch (e: any) {
      results.push({ dir: `${spec.root}/${spec.dir}`, ok: false, reason: e?.message || String(e) });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  // eslint-disable-next-line no-console
  console.log(`Downloaded ${ok}/${results.length} open-licensed sans fonts to ${outDir}`);
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.log('Failures:');
    for (const f of failed) {
      // eslint-disable-next-line no-console
      console.log(`- ${f.dir}: ${f.reason}`);
    }
  }

  // Write a small manifest for the preview script.
  const manifest = results.filter((r) => r.ok && r.file).map((r) => r.file as string).sort();
  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ files: manifest }, null, 2), 'utf-8');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
