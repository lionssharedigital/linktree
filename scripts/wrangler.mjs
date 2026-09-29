// Shared helpers for the CLI scripts: read names out of wrangler.jsonc and
// run wrangler against local (`--local`) or deployed (default) resources.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');

function configValue(key) {
  const match = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(config);
  if (!match) throw new Error(`Couldn't find "${key}" in wrangler.jsonc`);
  return match[1];
}

export const DATABASE_NAME = configValue('database_name');
export const BUCKET_NAME = configValue('bucket_name');

// Splits argv into positional args and the --local flag.
export function parseArgs(argv) {
  const local = argv.includes('--local');
  return { local, args: argv.filter((a) => a !== '--local'), target: local ? '--local' : '--remote' };
}

export function siteUrl(local) {
  return local ? 'http://localhost:8787' : configValue('SITE_URL').replace(/\/$/, '');
}

export function sql(value) {
  return value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
}

export function wrangler(args, { quiet = false } = {}) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    if (quiet) process.stderr.write(result.stdout + result.stderr);
    throw new Error(`wrangler ${args.slice(0, 3).join(' ')} failed`);
  }
  return result.stdout;
}
