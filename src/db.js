// All D1 queries. Every function takes the D1 binding (`db`) first.
import { normalizeContent } from './pages.js';
import { httpError } from './http.js';
import { randomToken, sha256Hex } from './auth.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_FAILURES = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const nowIso = () => new Date().toISOString();

function isUniqueViolation(err) {
  return /UNIQUE constraint failed/i.test(String(err?.message || err));
}

export function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(value) || value.length > 200) throw httpError(400, 'Enter a valid email address');
  return value;
}

// ---- Users ---------------------------------------------------------------

function toUser(row) {
  return row && {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    sessionVersion: row.session_version,
    createdAt: row.created_at,
  };
}

export async function getUser(db, id) {
  return toUser(await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first());
}

export async function getUserByEmail(db, email) {
  const needle = String(email || '').trim().toLowerCase();
  return toUser(await db.prepare('SELECT * FROM users WHERE email = ?').bind(needle).first());
}

export async function hasAdmin(db) {
  return Boolean(await db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").first());
}

// Every user, each with the list of (live) page slugs they can edit.
export async function listUsersWithPages(db) {
  const [{ results: users }, { results: members }] = await db.batch([
    db.prepare('SELECT * FROM users ORDER BY created_at'),
    db.prepare(
      'SELECT m.user_id, m.page_slug FROM page_members m JOIN pages p ON p.slug = m.page_slug WHERE p.archived_at IS NULL ORDER BY m.page_slug'
    ),
  ]);
  return users.map((row) => ({
    ...toUser(row),
    pages: members.filter((m) => m.user_id === row.id).map((m) => m.page_slug),
  }));
}

export async function createUser(db, { email, passwordHash, role, pages }) {
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    role: role === 'admin' ? 'admin' : 'artist',
    sessionVersion: 0,
    createdAt: nowIso(),
  };
  try {
    await db.batch([
      db
        .prepare('INSERT INTO users (id, email, password_hash, role, session_version, created_at) VALUES (?, ?, ?, ?, 0, ?)')
        .bind(user.id, user.email, user.passwordHash, user.role, user.createdAt),
      ...(pages || []).map((slug) =>
        db.prepare('INSERT OR IGNORE INTO page_members (user_id, page_slug) VALUES (?, ?)').bind(user.id, slug)
      ),
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) throw httpError(409, 'An account with that email already exists — log in instead');
    throw err;
  }
  return user;
}

// Sets a new password and bumps session_version (signing out other devices).
export async function setPassword(db, userId, passwordHash) {
  const row = await db
    .prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ? RETURNING *')
    .bind(passwordHash, userId)
    .first();
  if (!row) throw httpError(404, 'User not found');
  return toUser(row);
}

export async function promoteToAdmin(db, userId) {
  await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(userId).run();
}

export async function deleteUser(db, userId) {
  await db.batch([
    db.prepare('DELETE FROM page_members WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);
}

export async function grantPage(db, userId, slug) {
  await db.prepare('INSERT OR IGNORE INTO page_members (user_id, page_slug) VALUES (?, ?)').bind(userId, slug).run();
}

export async function revokePage(db, userId, slug) {
  await db.prepare('DELETE FROM page_members WHERE user_id = ? AND page_slug = ?').bind(userId, slug).run();
}

export async function canEditPage(db, user, slug) {
  if (!user) return false;
  if (user.role === 'admin') return pageExists(db, slug);
  const row = await db
    .prepare(
      'SELECT 1 FROM page_members m JOIN pages p ON p.slug = m.page_slug WHERE m.user_id = ? AND m.page_slug = ? AND p.archived_at IS NULL'
    )
    .bind(user.id, slug)
    .first();
  return Boolean(row);
}

// ---- Pages ---------------------------------------------------------------

export async function getPageContent(db, slug) {
  const row = await db
    .prepare('SELECT content, theme_id FROM pages WHERE slug = ? AND archived_at IS NULL')
    .bind(slug)
    .first();
  if (!row) return null;
  return { ...normalizeContent(JSON.parse(row.content)), themeId: row.theme_id || '' };
}

export async function pageExists(db, slug) {
  return Boolean(await db.prepare('SELECT 1 FROM pages WHERE slug = ? AND archived_at IS NULL').bind(slug).first());
}

// Live pages as [{ slug, name }], sorted by slug.
export async function listPages(db) {
  const { results } = await db
    .prepare("SELECT slug, json_extract(content, '$.name') AS name FROM pages WHERE archived_at IS NULL ORDER BY slug")
    .all();
  return results.map((r) => ({ slug: r.slug, name: r.name || r.slug }));
}

// Throws 409 if the slug is taken — including by an archived page, so an
// archived page can always be restored under its original URL.
export async function createPage(db, slug, content) {
  const now = nowIso();
  try {
    await db
      .prepare('INSERT INTO pages (slug, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(slug, JSON.stringify(normalizeContent(content)), now, now)
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) throw httpError(409, `/${slug} is already taken`);
    throw err;
  }
}

export async function savePageContent(db, slug, content) {
  const normalized = normalizeContent(content);
  const themeId = String(content.themeId || '');
  await db
    .prepare('UPDATE pages SET content = ?, theme_id = ?, updated_at = ? WHERE slug = ?')
    .bind(JSON.stringify(normalized), themeId, nowIso(), slug)
    .run();
  return { ...normalized, themeId };
}

// Takes the page offline and removes everyone's access and open invites.
// Content, uploads, and clicks are kept; restore with
//   UPDATE pages SET archived_at = NULL WHERE slug = '...'
export async function archivePage(db, slug) {
  if (!(await pageExists(db, slug))) throw httpError(404, 'Page not found');
  await db.batch([
    db.prepare('UPDATE pages SET archived_at = ? WHERE slug = ?').bind(nowIso(), slug),
    db.prepare('DELETE FROM page_members WHERE page_slug = ?').bind(slug),
    db.prepare('DELETE FROM invites WHERE page_slug = ?').bind(slug),
  ]);
}

// ---- Themes ---------------------------------------------------------------
// Admin-managed, reusable style presets. `config` is pre-validated by the
// caller (see worker.js parseStyleFields/parseThemeOnlyFields) before it
// reaches these functions — same division of labor as pages, where db.js
// only persists, and worker.js validates.

function toTheme(row) {
  return (
    row && {
      id: row.id,
      name: row.name,
      config: JSON.parse(row.config),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  );
}

export async function listThemes(db) {
  const { results } = await db.prepare('SELECT * FROM themes ORDER BY name').all();
  return results.map(toTheme);
}

export async function getTheme(db, id) {
  if (!id) return null;
  const row = await db.prepare('SELECT * FROM themes WHERE id = ?').bind(id).first();
  return toTheme(row);
}

export async function createTheme(db, { name, config }) {
  const id = crypto.randomUUID();
  const now = nowIso();
  await db
    .prepare('INSERT INTO themes (id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, name, JSON.stringify(config), now, now)
    .run();
  return { id, name, config, createdAt: now, updatedAt: now };
}

export async function updateTheme(db, id, { name, config }) {
  const now = nowIso();
  await db
    .prepare('UPDATE themes SET name = ?, config = ?, updated_at = ? WHERE id = ?')
    .bind(name, JSON.stringify(config), now, id)
    .run();
  return { id, name, config, updatedAt: now };
}

// Clears theme_id on any pages using this theme first (explicit app-level
// cascade, same approach archivePage uses) so no page is left pointing at a
// deleted theme.
export async function deleteTheme(db, id) {
  await db.batch([
    db.prepare("UPDATE pages SET theme_id = '' WHERE theme_id = ?").bind(id),
    db.prepare('DELETE FROM themes WHERE id = ?').bind(id),
  ]);
}

// ---- Invites -------------------------------------------------------------
// kind 'access': sign up (or, if already logged in, attach to an existing
//   account) with `role`, optionally granting `pageSlug`.
// kind 'reset': set a new password for `userId`.

function toInvite(row) {
  return row && {
    id: row.id,
    kind: row.kind,
    role: row.role,
    pageSlug: row.page_slug,
    email: row.email,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function listInvites(db) {
  const { results } = await db.prepare('SELECT * FROM invites WHERE expires_at > ? ORDER BY created_at').bind(nowIso()).all();
  return results.map(toInvite);
}

// Returns the raw token — the only time it's available.
export async function createInvite(db, { kind, role, pageSlug, email, userId, createdBy }) {
  const token = randomToken();
  const now = Date.now();
  const isReset = kind === 'reset';
  await db.batch([
    db.prepare('DELETE FROM invites WHERE expires_at <= ?').bind(new Date(now).toISOString()),
    // Only one live reset link per user at a time.
    ...(isReset ? [db.prepare("DELETE FROM invites WHERE kind = 'reset' AND user_id = ?").bind(userId)] : []),
    db
      .prepare(
        'INSERT INTO invites (id, token_hash, kind, role, page_slug, email, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        crypto.randomUUID(),
        await sha256Hex(token),
        isReset ? 'reset' : 'access',
        role === 'admin' ? 'admin' : 'artist',
        pageSlug || '',
        email || '',
        userId || '',
        createdBy || '',
        new Date(now).toISOString(),
        new Date(now + (isReset ? RESET_TTL_MS : INVITE_TTL_MS)).toISOString()
      ),
  ]);
  return token;
}

export async function findInvite(db, token) {
  if (!token) return null;
  const row = await db
    .prepare('SELECT * FROM invites WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256Hex(token), nowIso())
    .first();
  return toInvite(row);
}

// Atomically deletes and returns the invite, so two tabs racing on the same
// link can't both succeed.
export async function consumeInvite(db, token) {
  const row = await db
    .prepare('DELETE FROM invites WHERE token_hash = ? AND expires_at > ? RETURNING *')
    .bind(await sha256Hex(token), nowIso())
    .first();
  if (!row) throw httpError(410, 'This link is invalid, expired, or has already been used');
  return toInvite(row);
}

export async function revokeInvite(db, id) {
  await db.prepare('DELETE FROM invites WHERE id = ?').bind(id).run();
}

// ---- Clicks --------------------------------------------------------------

export async function recordClick(db, pageSlug, linkSlug, request) {
  await db
    .prepare('INSERT INTO clicks (page_slug, link_slug, ts, ref, ua) VALUES (?, ?, ?, ?, ?)')
    .bind(
      pageSlug,
      linkSlug,
      nowIso(),
      (request.headers.get('Referer') || '').slice(0, 300),
      (request.headers.get('User-Agent') || '').slice(0, 300)
    )
    .run();
}

export async function aggregateClicks(db, pageSlug) {
  const { results } = await db
    .prepare('SELECT link_slug, COUNT(*) AS count, MAX(ts) AS last FROM clicks WHERE page_slug = ? GROUP BY link_slug')
    .bind(pageSlug)
    .all();
  const bySlug = new Map(results.map((r) => [r.link_slug, { count: r.count, last: r.last }]));
  const total = results.reduce((sum, r) => sum + r.count, 0);
  return { total, bySlug };
}

// ---- Rate limiting -------------------------------------------------------
// Fixed window of *failed* password attempts per bucket+IP. Successful
// logins don't count, so artists sharing an office IP don't lock each other out.

export async function checkRateLimit(db, key) {
  const row = await db.prepare('SELECT count, reset_at FROM auth_failures WHERE key = ?').bind(key).first();
  if (row && row.reset_at > Date.now() && row.count >= RATE_MAX_FAILURES) {
    throw httpError(429, 'Too many attempts — try again in a few minutes');
  }
}

export async function recordFailedAttempt(db, key) {
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM auth_failures WHERE reset_at < ?').bind(now),
    db
      .prepare(
        'INSERT INTO auth_failures (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET count = count + 1'
      )
      .bind(key, now + RATE_WINDOW_MS),
  ]);
}
