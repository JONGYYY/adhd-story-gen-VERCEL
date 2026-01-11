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
  root: 'ofl' | 'apache';
  dir: string;
  preferredNames?: string[];
};

// Open-licensed sans fonts (Google Fonts: SIL OFL or Apache 2.0).
// These are safe to include in the repo and use like we do for caption fonts.
const SANS_OPEN_FONTS: FontSpec[] = [
  { root: 'ofl', dir: 'inter', preferredNames: ['Inter-VariableFont_slnt,wght.ttf', 'Inter[wght].ttf', 'Inter-VariableFont_wght.ttf', 'Inter-Regular.ttf'] },
  // NOTE: Roboto/Open Sans live under apache/robotoflex and apache/opensans in some mirrors; if a folder 404s,
  // we intentionally skip rather than guess paths. This list focuses on OFL families that consistently exist.
  { root: 'ofl', dir: 'notosans', preferredNames: ['NotoSans-VariableFont_wdth,wght.ttf', 'NotoSans[wght].ttf', 'NotoSans-Regular.ttf'] },
  { root: 'ofl', dir: 'montserrat', preferredNames: ['Montserrat-VariableFont_wght.ttf', 'Montserrat[wght].ttf', 'Montserrat-Regular.ttf'] },
  { root: 'ofl', dir: 'poppins', preferredNames: ['Poppins-Regular.ttf', 'Poppins-Medium.ttf', 'Poppins-SemiBold.ttf'] },
  { root: 'ofl', dir: 'nunito', preferredNames: ['Nunito-VariableFont_wght.ttf', 'Nunito[wght].ttf', 'Nunito-Regular.ttf'] },
  { root: 'ofl', dir: 'rubik', preferredNames: ['Rubik-VariableFont_wght.ttf', 'Rubik[wght].ttf', 'Rubik-Regular.ttf'] },
  { root: 'ofl', dir: 'worksans', preferredNames: ['WorkSans-VariableFont_wght.ttf', 'WorkSans[wght].ttf', 'WorkSans-Regular.ttf'] },
  { root: 'ofl', dir: 'raleway', preferredNames: ['Raleway-VariableFont_wght.ttf', 'Raleway[wght].ttf', 'Raleway-Regular.ttf'] },
  { root: 'ofl', dir: 'sourcesans3', preferredNames: ['SourceSans3-VariableFont_wght.ttf', 'SourceSans3[wght].ttf', 'SourceSans3-Regular.ttf'] },
  { root: 'ofl', dir: 'dmsans', preferredNames: ['DMSans-VariableFont_opsz,wght.ttf', 'DMSans[wght].ttf', 'DMSans-Regular.ttf'] },
  { root: 'ofl', dir: 'figtree', preferredNames: ['Figtree-VariableFont_wght.ttf', 'Figtree[wght].ttf', 'Figtree-Regular.ttf'] },
  { root: 'ofl', dir: 'manrope', preferredNames: ['Manrope-VariableFont_wght.ttf', 'Manrope[wght].ttf', 'Manrope-Regular.ttf'] },
];

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
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

  // Prefer variable fonts, then regular.
  const score = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('variablefont') || /\[[^\]]+\]/.test(lower)) return 0;
    if (lower.includes('regular')) return 1;
    if (lower.includes('medium')) return 2;
    if (lower.includes('semibold')) return 3;
    if (lower.includes('bold')) return 4;
    return 9;
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
      const staticDir = listing.find((x) => x.type === 'dir' && x.name.toLowerCase() === 'static');
      let candidates: GithubContent[] = listing;
      if (staticDir) candidates = await fetchJson<GithubContent[]>(staticDir.url);

      const chosen = pickBestTtf(candidates, spec.preferredNames);
      if (!chosen?.download_url) {
        results.push({ dir: `${spec.root}/${spec.dir}`, ok: false, reason: 'No .ttf file found' });
        continue;
      }

      const outName = `${spec.dir}-${chosen.name}`.replace(/\s+/g, '_');
      await downloadFile(chosen.download_url, path.join(outDir, outName));
      results.push({ dir: `${spec.root}/${spec.dir}`, file: outName, ok: true });
    } catch (e: any) {
      results.push({ dir: `${spec.root}/${spec.dir}`, ok: false, reason: e?.message || String(e) });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`Downloaded ${ok}/${results.length} open sans fonts to ${outDir}`);
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.log('Failures:');
    for (const f of failed) {
      // eslint-disable-next-line no-console
      console.log(`- ${f.dir}: ${f.reason}`);
    }
  }

  const manifest = results.filter((r) => r.ok && r.file).map((r) => r.file as string).sort();
  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ files: manifest }, null, 2), 'utf-8');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


