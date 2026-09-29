# Gravitas links

A multi-artist Linktree replacement for Gravitas Recordings, running on
Cloudflare Workers: a link-in-bio page per artist at
`links.gravitasrecordings.com/<artist>`, each with its own login-protected
editor, first-party click tracking, and Linktree-style sections/images/video
embeds — with no servers to manage and no third-party trackers unless an
artist explicitly opts into Google Analytics/Ads or the Meta (Facebook)
Pixel.

An **admin** creates pages and hands out invite links; each **artist**
opens their link, sets a password, and from then on manages their own page.

## Accounts and roles

| | Admin | Artist |
|---|---|---|
| Edit pages | every page | only pages they've been given |
| See click stats | every page | only their pages |
| Create / archive pages | ✓ | |
| Invite artists and admins, give/remove page access | ✓ | |
| Make password-reset links, delete users | ✓ | |

**Provisioning an artist:**

1. In `/admin`, **Create a page** — display name and URL (e.g. `dj-nova` →
   `yourdomain.com/dj-nova`). It starts from
   [`templates/starter.json`](templates/starter.json).
2. On that page's card, **Create invite link** (optionally locked to the
   artist's email). Copy it and send it however you like — text, email,
   DM. There's no outbound email provider involved.
3. The artist opens the link, sets their email + password, and lands in the
   editor for their page.

Invite links are single-use and expire after 7 days. They're stored only
as hashes, so each link is shown exactly once, at creation; if one goes
missing, revoke it and make a new one. One person can manage several pages
(e.g. a manager with multiple artists): send another invite while they're
logged in and it's added to their existing account, or use **Give access**
in the Users table.

**Forgotten passwords:** an admin clicks **Password reset link** next to
the user (valid 24 hours). Setting a new password — or changing it from
the dashboard — signs that user out everywhere else.

**Archiving** a page takes it offline and removes everyone's access and open
invites, but nothing is deleted — content, uploads, and click history are
kept, and the URL stays reserved. To restore one:

```bash
npx wrangler d1 execute gravitaslink --remote --command "UPDATE pages SET archived_at = NULL WHERE slug = 'the-slug'"
```

then give its artist access again from the dashboard.

## How it works

- **Content** for each page is a JSON document (the `content` column of the
  `pages` table in D1) — `name`, `bio`, `avatar`,
  colors, optional analytics IDs, and a `sections` array. Each section has a
  `title` (shown as a heading above it) and `items`, where each item is
  either:
  - a **link**: `title`, `url`, either an `emoji` or an `image` (path to a
    thumbnail), a `style` (`"classic"` — small square thumbnail, whole row
    clickable; or `"featured"` — large 16:9 image with the title below and a
    gentle looping pulse animation, meant for your top 1–2 links; falls back
    to classic if a featured item has no image), plus an auto-generated
    `slug` used for click tracking, or
  - a **video**: `title` (caption) and `youtubeId`, rendered as an inline,
    click-to-play YouTube embed.

  Separately, a top-level `socialLinks` array (`icon`, `url`, auto-generated
  `slug`) renders as a single row of icon-only buttons at the very bottom
  of the page, above the footer — for Spotify/Instagram/YouTube/etc. profile
  links. Icons come from a built-in library (see
  [`src/icons.js`](src/icons.js)); `/admin` has a dropdown listing every
  available one.

  See [`templates/starter.json`](templates/starter.json) — what every new
  page starts from — for the shape.
- **Storage** is two Cloudflare services, bound to the Worker in
  [`wrangler.jsonc`](wrangler.jsonc):
  - **D1** (`gravitaslink`, SQLite) — users, invites, page content,
    page access, clicks, and failed-login counters. Schema:
    [`migrations/0001_init.sql`](migrations/0001_init.sql).
  - **R2** (`gravitaslink-bucket`) — uploads, keyed `<slug>/<file>` and
    served at `/media/<slug>/<file>`.

  Shared built-in files in [`public/`](public/) (default avatar, placeholder
  image) are served by Cloudflare's static assets, before the Worker runs.
- **The page** (`GET /<slug>`) is server-rendered HTML with embedded CSS —
  mobile-first, dark mode via `prefers-color-scheme` (overridable with your
  own page background, section/button, and content-box colors), subtle
  hover states. See [`src/render.js`](src/render.js). Optionally, everything
  (avatar, bio, sections, social row) can render inside a colored card —
  Linktree's boxed-card look — by setting a content box color in `/admin`;
  leave it blank for the flat, no-box layout.
- **Appearance options** in `/admin` (all optional, all default to the
  existing look so nothing changes unless you opt in):
  - **Avatar style**: circle (default, 96px) or hero — a large image at the
    top that fades into the background via a CSS mask, with your name/bio
    centered below it.
  - **Sharp corners**: turns off `border-radius` on link buttons/cards only
    (not the avatar, social icons, or content box) for a flat, editorial
    look instead of the default rounded pills.
  - Font stack leads with **Poppins**, falling back to the system font on
    any device that doesn't have it installed — no external font request is
    made, so this stays consistent with the zero-third-party-by-default
    posture.
- **Campaign tracking**: optional `utmSource`/`utmMedium`/`utmCampaign` in
  the editor get appended as `utm_*` query params to every outbound link and
  social-icon click at redirect time (`/<page>/go/:slug`), so link clicks show up
  tagged in whatever analytics you're already using. A destination URL that
  already sets one of those params keeps its own value — this only fills in
  what's missing.
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
- **`/admin`** is the logged-in dashboard: the list of pages you can edit,
  plus (for admins) page creation, invites, and user management. Each
  page's editor is at `/admin/pages/<slug>` — see
  [Page editor](#page-editor) below.
- **Click tracking**: every link button goes through `/<page>/go/<slug>`,
  which issues a `302` to the real URL and, after responding, records the
  click (timestamp, slug, referrer, user-agent) in D1. Video embeds aren't
  tracked this way — they play inline and never redirect.
- **Click stats** for a page are at `/admin/pages/<slug>/stats`, visible to
  that page's editors and admins.
- **OG image**: every time a page is saved, the editor draws a 1200×630
  share card (initials on the accent color, name, bio) on a `<canvas>` in
  the browser and uploads it as `og.png` — Workers have no image library,
  so the server only stores it. Link previews in iMessage/Slack/Twitter/etc.
  then show it. A page that has never been saved uses its avatar instead.

No framework and no runtime dependencies — just the Workers runtime and Web
Crypto. **Third-party network calls only happen if you
opt in**: YouTube's own servers when a visitor presses play on a video
embed (unavoidable — that's what "embed a video" means), and Google's
gtag.js and/or Meta's fbevents.js if you fill in a Google Analytics, Google
Ads, or Meta Pixel ID in `/admin`. All three are blank/off by default.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars      # local SITE_URL + SESSION_SECRET
npm run db:migrate:local            # create the tables in local D1
npm run dev                         # http://localhost:8787
npm run admin-invite -- --local     # in another terminal: one-time admin setup link
```

`wrangler dev` simulates D1 and R2 on your machine (in `.wrangler/`), so
nothing touches the live site. Open the printed link to create your local
admin.

## Page editor

`/admin/pages/<slug>` is a single-page editor for one artist's page.
From it they can:

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
- Click **Save changes** — the page is live the moment the request
  completes, with no build or deploy step for content edits.

**Security notes:**
- Logins use PBKDF2-SHA256 password hashes (100k iterations, the Workers
  maximum) and a signed, `HttpOnly`, `SameSite=Lax`, `Secure` session
  cookie. Failed password attempts are rate-limited per IP (10 per 15
  minutes).
- Every state-changing endpoint only accepts `Content-Type:
  application/json`, which a plain HTML form (the classic CSRF vector)
  cannot send, and rejects mismatched `Origin` headers — don't loosen
  either check.
- Artists can only read or write their own pages. That's enforced
  server-side on every request, not just hidden in the UI.
- Uploads are restricted to an image-type allowlist and a 2 MB cap, and are
  served from `/media/…` with a sandboxing `Content-Security-Policy`, so a
  malicious SVG from one artist can't run script as the site (and so can't
  act on an admin's session). Link URLs are restricted to `http:`,
  `https:`, `mailto:`, and `tel:`.
- Invite and reset tokens are stored only as SHA-256 hashes, and are
  consumed atomically so a link can't be used twice.

## Deploying to Cloudflare

Needs a Cloudflare account that has `gravitasrecordings.com` as a zone. The
**Workers Paid plan** ($5/month) is recommended: every login and password
check runs 100k PBKDF2 rounds, which can exceed the free plan's 10 ms CPU
limit per request. D1 and R2 usage for a site like this fits well within
the included free allowances.

### First deploy

```bash
npx wrangler login                                  # opens the browser
npx wrangler d1 create gravitaslink               # copy the database_id it prints…
#   …into "database_id" in wrangler.jsonc
npx wrangler r2 bucket create gravitaslink-bucket
npm run db:migrate                                  # create the tables in live D1
npx wrangler secret put SESSION_SECRET              # paste a long random string, e.g. from: openssl rand -base64 32
npm run deploy
npm run admin-invite -- you@gravitasrecordings.com  # one-time admin setup link
```

`npm run deploy` also attaches `links.gravitasrecordings.com` as a Custom
Domain (DNS record and certificate are created automatically). If a DNS
record for `links` already exists in the zone, delete it first or the
deploy will refuse to take over the hostname.

### Shipping updates

```bash
npm run deploy
```

Content edits never need a deploy — they're live as soon as they're saved.
If a future change adds a file to `migrations/`, run `npm run db:migrate`
before deploying.

### Logs and backups

- `npx wrangler tail` streams live logs; they're also in the dashboard
  (Workers → gravitas-links → Logs).
- D1 Time Travel can restore the database to any point in the last 30 days
  on the paid plan (7 on free) — `npx wrangler d1 time-travel`.
  For an off-Cloudflare copy: `npx wrangler d1 export gravitaslink --remote --output backup.sql`.

## Moving over from the DigitalOcean droplet

The droplet runs the older single-page version (`links.json`, uploads in
`public/`, `clicks.log`). After the first deploy above:

```bash
# 1. Copy the live install down (legacy-backup/ is gitignored).
#    /opt/linkbio is where the old README's deploy steps put it — adjust if yours differs.
rsync -a --exclude node_modules root@YOUR_DROPLET_IP:/opt/linkbio/ ./legacy-backup/

# 2. Import it as a page — uploads go to R2, content and clicks to D1
npm run import-legacy -- your-slug ./legacy-backup
```

3. Open `/admin/pages/your-slug` and click **Save** once, to generate its
   share image.
4. Optionally set `"ROOT_PAGE": "your-slug"` in `wrangler.jsonc` and
   `npm run deploy`, so `links.gravitasrecordings.com/` shows it too (old
   `/go/<link>` URLs keep working as well).
5. Once you're happy, point any links that used the droplet's domain at
   the new URLs, then shut down the droplet.

## Rotating credentials

Artists change their own passwords from the dashboard; admins can issue
reset links. To sign **everyone** out at once, set a new secret with
`npx wrangler secret put SESSION_SECRET`.

## Roadmap

Built so far: multi-artist pages with admin/artist logins and invite
links, sections, classic and featured link cards, YouTube video
embeds, a social icon row, custom colors/fonts/corners, avatar/favicon/OG
image uploads, SEO and social-preview overrides, optional Google/Meta
analytics, and UTM campaign tagging on every outbound click.

Not yet built (each needs a real design/provider decision before it's
worth building, rather than a half-working stub):

- **Horizontal carousel** — swipeable row of square cards (e.g. podcast
  episodes)
- **Rich embed link** — paste a Spotify/YouTube/SoundCloud URL and
  auto-pull its title/thumbnail (oEmbed) with an inline player, instead of
  manually filling in a title/thumbnail yourself
- **Community link card** — a distinctly-styled Discord/Slack invite card
- **Contact/booking form** — needs an outbound email provider decision
  (SMTP relay? a transactional email API?) before it can actually notify
  anyone
- **Email / SMS signup blocks** — needs an ESP/Google Sheets integration
  choice for email, and an SMS provider (e.g. Twilio) for phone — the
  latter also has compliance requirements (TCPA consent language, opt-out
  handling) worth getting right rather than shipping fast
- **Shop preview strip** — a small teaser row linking out to a full shop
  page

("Section header + group" from that spec is already covered by the
existing `sections` feature — a titled heading grouping a set of links.)

- **Custom domains per artist** — serving `links.artistname.com` from the
  same Worker (Host-header routing + Cloudflare for SaaS custom hostnames)
- **Emailed invites/resets** — currently the admin copies and sends links
  by hand; wiring in a transactional email provider would automate it
- **Renaming a page URL** — slugs are fixed at creation, since uploaded
  media paths and shared links depend on them
