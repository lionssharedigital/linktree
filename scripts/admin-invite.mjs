// Prints a one-time link that creates an admin account (or, opened while
// logged in, promotes that account to admin). Use it to set up the first
// admin, or to get back in if every admin is locked out.
//   npm run admin-invite                          (deployed site)
//   npm run admin-invite -- you@example.com       (locks the link to that email)
//   npm run admin-invite -- --local               (local `npm run dev` site)
import crypto from 'node:crypto';
import { DATABASE_NAME, parseArgs, siteUrl, sql, wrangler } from './wrangler.mjs';

const { local, args, target } = parseArgs(process.argv.slice(2));
const email = (args[0] || '').trim().toLowerCase();

const token = crypto.randomBytes(24).toString('base64url');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const now = Date.now();
const insert = `INSERT INTO invites (id, token_hash, kind, role, email, created_by, created_at, expires_at) VALUES (${[
  crypto.randomUUID(),
  tokenHash,
  'access',
  'admin',
  email,
  'cli',
  new Date(now).toISOString(),
  new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
]
  .map(sql)
  .join(', ')})`;

wrangler(['d1', 'execute', DATABASE_NAME, target, '--command', insert], { quiet: true });
console.log(`Admin setup link (valid 7 days, single use):\n\n  ${siteUrl(local)}/invite/${token}\n`);
