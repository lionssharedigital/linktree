-- Accounts. Passwords are PBKDF2-SHA256 hashes (see src/auth.js); bumping
-- session_version invalidates every session cookie issued before it.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'artist')),
  session_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- One row per artist page. `content` is the page as a JSON document — the
-- same shape the old links.json had (see templates/starter.json).
-- Archived pages keep their row (and slug) so they can be restored.
CREATE TABLE pages (
  slug TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

-- Which artists can edit which pages (admins can edit every page).
CREATE TABLE page_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  PRIMARY KEY (user_id, page_slug)
);

-- Invite and password-reset links. Only the SHA-256 of the token is stored.
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('access', 'reset')),
  role TEXT NOT NULL DEFAULT 'artist',
  page_slug TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE clicks (
  id INTEGER PRIMARY KEY,
  page_slug TEXT NOT NULL,
  link_slug TEXT NOT NULL,
  ts TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  ua TEXT NOT NULL DEFAULT ''
);
CREATE INDEX clicks_by_page ON clicks (page_slug, link_slug);

-- Failed password attempts per IP, for rate limiting (fixed window).
CREATE TABLE auth_failures (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
