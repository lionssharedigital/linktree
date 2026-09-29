// Imports a single-page install (the version that ran on the DigitalOcean
// droplet: links.json, public/ uploads, clicks.log) as one page.
// Copy that install's folder down first, e.g.:
//   rsync -a --exclude node_modules root@your-droplet:/opt/linkbio/ ./legacy-backup/
// then:
//   npm run import-legacy -- <slug> ./legacy-backup            (deployed site)
//   npm run import-legacy -- <slug> ./legacy-backup --local    (local dev)
// Set ROOT_PAGE=<slug> in wrangler.jsonc to also serve it at "/".
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUCKET_NAME, DATABASE_NAME, parseArgs, sql, wrangler } from './wrangler.mjs';

const { args, target } = parseArgs(process.argv.slice(2));
const [slug = '', legacyDir = ''] = args;
if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) || !legacyDir) {
  console.error('Usage: npm run import-legacy -- <slug> <path-to-old-install> [--local]');
  process.exit(1);
}
const linksPath = path.join(legacyDir, 'links.json');
if (!existsSync(linksPath)) {
  console.error(`No links.json found at ${linksPath}`);
  process.exit(1);
}
const data = JSON.parse(readFileSync(linksPath, 'utf8'));

// Built-in assets that are still shared from public/ rather than copied.
const SHARED = new Set(['/avatar.svg', '/featured-placeholder.svg']);
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function relocate(value) {
  if (!value || SHARED.has(value) || !/^\/[\w./-]+$/.test(value)) return value;
  const src = path.join(legacyDir, 'public', value.slice(1));
  if (!existsSync(src)) {
    console.warn(`  missing ${value} — left as-is`);
    return value;
  }
  const rel = value.slice(1); // e.g. "avatar.png" or "uploads/spotify.png"
  const type = TYPES[path.extname(rel).toLowerCase()] || 'application/octet-stream';
  wrangler(['r2', 'object', 'put', `${BUCKET_NAME}/${slug}/${rel}`, '--file', src, '--content-type', type, target], { quiet: true });
  console.log(`  uploaded ${value}`);
  return `/media/${slug}/${rel}`;
}

data.avatar = relocate(data.avatar) || '/avatar.svg';
data.favicon = relocate(data.favicon) || '';
data.ogImage = relocate(data.ogImage) || '';
data.ogGenerated = false; // regenerated in the browser on the first save
for (const section of data.sections || []) {
  for (const item of section.items || []) {
    if (item.image) item.image = relocate(item.image);
  }
}

const now = new Date().toISOString();
const statements = [
  `INSERT INTO pages (slug, content, created_at, updated_at) VALUES (${[slug, JSON.stringify(data), now, now].map(sql).join(', ')});`,
];
let clickCount = 0;
const clicksPath = path.join(legacyDir, 'clicks.log');
if (existsSync(clicksPath)) {
  for (const line of readFileSync(clicksPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const c = JSON.parse(line);
      statements.push(
        `INSERT INTO clicks (page_slug, link_slug, ts, ref, ua) VALUES (${[slug, c.slug, c.ts, c.ref || '', c.ua || ''].map(sql).join(', ')});`
      );
      clickCount++;
    } catch {
      // skip malformed line
    }
  }
}

const sqlFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'linkbio-import-')), 'import.sql');
writeFileSync(sqlFile, statements.join('\n') + '\n');
wrangler(['d1', 'execute', DATABASE_NAME, target, '--file', sqlFile, '--yes'], { quiet: true });
console.log(`  imported page content and ${clickCount} clicks`);
console.log(`\nImported as /${slug}. Open it once in the editor and click Save to generate its share image.`);
