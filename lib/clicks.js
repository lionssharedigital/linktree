import { appendFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const LOG_PATH = new URL('../clicks.log', import.meta.url);

// One JSON object per line — easy to append safely from concurrent
// requests (POSIX O_APPEND is atomic for small writes) and easy to parse.
export async function recordClick(slug, req) {
  const entry = {
    ts: new Date().toISOString(),
    slug,
    ref: (req.headers['referer'] || req.headers['referrer'] || '').slice(0, 300),
    ua: (req.headers['user-agent'] || '').slice(0, 300),
  };
  await appendFile(LOG_PATH, JSON.stringify(entry) + '\n');
}

export async function readClicks() {
  if (!existsSync(LOG_PATH)) return [];
  const text = await readFile(LOG_PATH, 'utf8');
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // skip malformed line
    }
  }
  return rows;
}

export async function aggregateClicks() {
  const rows = await readClicks();
  const bySlug = new Map();
  for (const row of rows) {
    const existing = bySlug.get(row.slug) || { count: 0, last: null };
    existing.count += 1;
    if (!existing.last || row.ts > existing.last) existing.last = row.ts;
    bySlug.set(row.slug, existing);
  }
  return { total: rows.length, bySlug };
}
