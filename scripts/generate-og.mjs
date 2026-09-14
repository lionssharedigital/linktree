// Generates public/og.png (1200x630) from links.json.
// The server also calls buildOgPng() directly to regenerate this
// automatically when the admin panel saves changes — this script is just
// a manual/CI-friendly entry point for the same logic.
//   npm install
//   npm run og
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOgPng } from '../lib/og.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const data = JSON.parse(readFileSync(path.join(root, 'links.json'), 'utf8'));
const buf = await buildOgPng({
  name: data.name || 'Your Name',
  bio: data.bio || '',
  accent: data.accent,
});

const outPath = path.join(root, 'public', 'og.png');
writeFileSync(outPath, buf);
console.log(`Wrote ${path.relative(root, outPath)}`);
