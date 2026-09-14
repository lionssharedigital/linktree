import { readFileSync, existsSync } from 'node:fs';

// Minimal .env loader — no dependency needed for KEY=VALUE files.
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(new URL('../.env', import.meta.url));

export const env = {
  PORT: Number(process.env.PORT || 3000),
  SITE_URL: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  STATS_USER: process.env.STATS_USER || '',
  STATS_PASS: process.env.STATS_PASS || '',
  // Admin credentials default to the stats ones so existing deployments
  // keep working with zero config changes; set ADMIN_USER/ADMIN_PASS in
  // .env to give the editor a separate login from analytics.
  ADMIN_USER: process.env.ADMIN_USER || process.env.STATS_USER || '',
  ADMIN_PASS: process.env.ADMIN_PASS || process.env.STATS_PASS || '',
};
