# linkbio

A self-hosted Linktree replacement: one Node.js process, a JSON file as the
CMS (editable by hand or through a built-in `/admin` panel), first-party
click tracking, and Linktree-style sections/images/video embeds — all with
no third-party trackers unless you explicitly opt into Google Analytics/Ads
or the Meta (Facebook) Pixel.

## How it works

- **Content** lives in [`links.json`](links.json) — `name`, `bio`, `avatar`,
  colors, optional analytics IDs, and a `sections` array. Each section has a
  `title` (shown as a heading above it) and `items`, where each item is
  either:
  - a **link**: `title`, `url`, and either an `emoji` or an `image` (path to
    a thumbnail shown instead of the emoji), plus an auto-generated `slug`
    used for click tracking, or
  - a **video**: `title` (caption) and `youtubeId`, rendered as an inline,
    click-to-play YouTube embed.

  Separately, a top-level `socialLinks` array (`icon`, `url`, auto-generated
  `slug`) renders as a single row of icon-only buttons at the very bottom
  of the page, above the footer — for Spotify/Instagram/YouTube/etc. profile
  links. Icons come from a built-in library (see
  [`lib/icons.js`](lib/icons.js)); `/admin` has a dropdown listing every
  available one.

  Editing this file *is* the CMS — the page re-reads it on every request,
  so there's nothing to rebuild or restart. See the shape in the checked-in
  [`links.json`](links.json) for a working example.
- **The page** (`GET /`) is server-rendered HTML with embedded CSS —
  mobile-first, dark mode via `prefers-color-scheme` (overridable with your
  own page background, section/button, and content-box colors), subtle
  hover states. See [`lib/render.js`](lib/render.js). Optionally, everything
  (avatar, bio, sections, social row) can render inside a colored card —
  Linktree's boxed-card look — by setting a content box color in `/admin`;
  leave it blank for the flat, no-box layout.
- **Favicon**: falls back to the avatar if not set separately. Upload a
  dedicated favicon (PNG/ICO/SVG/WebP/JPG) in `/admin` if you want a
  different, simplified image for browser tabs.
- **SEO and social preview**: three independent, optional layers, each
  falling back to the next if left blank — on-page **name/bio** (what
  visitors see) → **SEO title/description** (the `<title>` tag and Google's
  search snippet) → **social preview title/description/image** (what shows
  when the link is shared on iMessage, Slack, Twitter/X, Facebook, etc.).
  The social preview image defaults to the auto-generated one (see below)
  but can be replaced with your own upload (recommended 1200×630) in
  `/admin`.
- **`/admin`** is a small editor UI (protected by its own Basic Auth
  credentials) for people who shouldn't have to touch JSON or a terminal —
  see [Admin panel](#admin-panel-for-non-technical-editors) below.
- **Click tracking**: every link button goes through `/go/<slug>`, which
  appends one JSON line to `clicks.log` (timestamp, slug, referrer,
  user-agent) and issues a `302` to the real URL. Video embeds aren't
  tracked this way — they play inline and never redirect. See
  [`lib/clicks.js`](lib/clicks.js).
- **`/stats`** is protected by HTTP Basic Auth (credentials from `.env`) and
  shows clicks per link, aggregated from `clicks.log`.
- **OG image**: [`lib/og.js`](lib/og.js) renders `public/og.png`
  (1200×630) from `links.json`, so link previews in iMessage/Slack/
  Twitter/etc. show your name, initials, and bio. It regenerates
  automatically whenever `/admin` saves a change to name/bio/accent, and
  can also be run manually via `npm run og`.

No database, no framework — just Node's built-in `http` module plus
`sharp` (for the OG image). **Third-party network calls only happen if you
opt in**: YouTube's own servers when a visitor presses play on a video
embed (unavoidable — that's what "embed a video" means), and Google's
gtag.js and/or Meta's fbevents.js if you fill in a Google Analytics, Google
Ads, or Meta Pixel ID in `/admin`. All three are blank/off by default.

## Local setup

```bash
cp .env.example .env        # then edit STATS_USER/PASS and ADMIN_USER/PASS
npm install
npm run og                  # generates public/og.png from links.json
npm start                   # http://localhost:3000
```

Edit `links.json` and `public/avatar.svg` directly, or open `/admin` and log
in with `ADMIN_USER`/`ADMIN_PASS` to edit everything through a form instead
(see below).

Visit `/stats` and log in with `STATS_USER`/`STATS_PASS` to see click
counts.

## Admin panel (for non-technical editors)

`/admin` is a single-page editor, protected by HTTP Basic Auth using
`ADMIN_USER`/`ADMIN_PASS` from `.env` (falls back to the `/stats` creds if
those aren't set, so nothing breaks if you skip configuring them — but for
a marketing editor who shouldn't see click analytics, set separate
`ADMIN_USER`/`ADMIN_PASS` values).

From the page they can:

- Edit name, bio, accent color, and separately override the page background,
  section/button, and content-box colors (leave any blank to keep following
  the visitor's light/dark mode automatically, or no box at all for content
  box)
- Upload a new avatar image (PNG/JPG/SVG/WebP, up to 2 MB) and/or a separate
  favicon (PNG/ICO/SVG/WebP/JPG), each with a live preview
- Set an SEO title/description (for search results) and, separately, a
  social preview title/description/image (for link-share previews) —
  each optional, each falling back down the chain to the one before it
- Add, remove, and reorder (↑/↓) whole **sections**, each with its own
  optional title
- Within a section, add, remove, reorder, and edit **links** (title, URL,
  emoji or an uploaded thumbnail image, and an optional custom slug) or
  **YouTube videos** (paste any YouTube URL or a bare video ID — it's
  normalized automatically)
- Add, remove, and reorder **social icons** — pick a platform from a
  dropdown (Spotify, Instagram, YouTube, SoundCloud, TikTok, X, Facebook,
  Apple Music, Bandcamp, Twitch, Discord, LinkedIn, Telegram, WhatsApp,
  Snapchat, Pinterest, Threads) and paste the profile URL; they render as a
  single row of icon buttons at the bottom of the page
- Optionally set a Google Analytics measurement ID, Google Ads conversion
  ID, and/or Meta (Facebook) Pixel ID — leaving all three blank (the
  default) keeps the page free of third-party trackers
- Click **Save changes** to write straight to `links.json` (atomically —
  readers never see a half-written file) and regenerate `public/og.png`

There's no separate build or deploy step for content edits — the save
happens directly against the file the running server reads. A link "Save"
edit is live the moment the request completes.

**Security notes:**
- The save endpoint only accepts `Content-Type: application/json`, which a
  plain HTML form (the classic CSRF vector) cannot send — this is the
  endpoint's CSRF defense, so don't loosen that content-type check.
- Uploaded avatars are restricted to an image-type allowlist and a 2 MB
  cap; link URLs are restricted to `http:`, `https:`, `mailto:`, and
  `tel:` schemes to block `javascript:`-style injection.
- Run this behind HTTPS in production (see deploy steps below) — Basic
  Auth sends credentials on every request, unencrypted without TLS.

## Deploying to a plain VPS

These steps assume a fresh Ubuntu/Debian VPS and a domain already pointed
at its IP address.

### 1. Install Node.js and create a service user

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
sudo useradd --system --home /opt/linkbio --shell /usr/sbin/nologin linkbio
```

### 2. Ship the code

```bash
sudo mkdir -p /opt/linkbio
sudo rsync -a --exclude node_modules --exclude .git ./ root@your-vps:/opt/linkbio/
# on the VPS:
cd /opt/linkbio
sudo cp .env.example .env && sudo vim .env     # set real STATS_/ADMIN_ USER/PASS + SITE_URL
sudo npm install
sudo npm run og
sudo chown -R linkbio:linkbio /opt/linkbio
```

### 3. Run it as a systemd service

```bash
sudo cp deploy/linkbio.service /etc/systemd/system/linkbio.service
sudo systemctl daemon-reload
sudo systemctl enable --now linkbio
sudo systemctl status linkbio      # should show "active (running)"
```

The service listens on `127.0.0.1:3000` only — it's not exposed directly to
the internet. That's what the reverse proxy in front of it is for.

### 4a. Reverse proxy + TLS with Caddy (recommended — auto HTTPS)

```bash
sudo apt-get install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
# edit the domain inside the file first
sudo systemctl reload caddy
```

That's it — Caddy requests and renews a Let's Encrypt certificate
automatically.

### 4b. Reverse proxy + TLS with nginx + certbot

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/linkbio
sudo ln -s /etc/nginx/sites-available/linkbio /etc/nginx/sites-enabled/
# edit server_name inside the file first
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d links.example.com
```

### 5. Publish content updates

Day-to-day edits (for a marketing editor or anyone else) happen at
`https://links.example.com/admin` — no server access needed, and the OG
image regenerates itself on save.

For edits made locally instead (e.g. scripting a bulk change to
`links.json`), sync the file over and regenerate the OG image on the VPS:

```bash
rsync -a links.json root@your-vps:/opt/linkbio/links.json
ssh root@your-vps "cd /opt/linkbio && npm run og"
```

## Rotating credentials

Edit `STATS_USER`/`STATS_PASS` and/or `ADMIN_USER`/`ADMIN_PASS` in
`/opt/linkbio/.env` on the VPS, then `sudo systemctl restart linkbio`.

## Log rotation

`clicks.log` grows forever by default. If you care about it long-term,
either rotate it with `logrotate` (it's a plain append-only text file, so
standard rotation works) or periodically archive/prune it — nothing in the
app depends on old entries staying in place.
