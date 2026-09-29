import starter from '../templates/starter.json';
import {
  isValidPageSlug,
  mediaUrl,
  generatedOgUrl,
  slugify,
  parseYoutubeId,
  parseSoundcloudUrl,
  parseBandsintownEmbed,
  flattenLinkItems,
  nextUniqueSlug,
  PAGE_SLUG_RE,
} from './pages.js';
import * as db from './db.js';
import { renderPage, renderStats } from './render.js';
import { renderAdmin } from './adminRender.js';
import { renderLogin, renderInvite, renderDashboard, renderMessage } from './dashboardRender.js';
import { SOCIAL_ICONS } from './icons.js';
import { hashPassword, verifyPassword, validateNewPassword, sessionCookie, clearSessionCookie, readSession } from './auth.js';
import { httpError, jsonResponse, htmlResponse, redirect, methodNotAllowed, readApiBody } from './http.js';

// data: URL mime -> file extension + served content type, for uploads.
// Deliberately a closed allowlist (no arbitrary "image/*") since this
// decides what gets stored and how it's served.
const IMAGE_TYPES = {
  'image/png': { ext: 'png', type: 'image/png' },
  'image/jpeg': { ext: 'jpg', type: 'image/jpeg' },
  'image/svg+xml': { ext: 'svg', type: 'image/svg+xml' },
  'image/webp': { ext: 'webp', type: 'image/webp' },
  'image/x-icon': { ext: 'ico', type: 'image/x-icon' },
  'image/vnd.microsoft.icon': { ext: 'ico', type: 'image/x-icon' },
};
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = 24 * 1024 * 1024; // room for several base64 images + JSON
const MAX_FORM_BYTES = 64 * 1024; // login/invite/admin API bodies

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const ANALYTICS_ID_RE = /^[A-Za-z0-9-]{0,20}$/;

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (err) {
      console.error(err);
      return new Response('Server error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  },
};

// Per-request context: bindings plus the config every handler needs.
function makeApp(request, env, ctx) {
  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not set — run `npx wrangler secret put SESSION_SECRET` (or add it to .dev.vars locally)');
  }
  const siteUrl = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  return {
    db: env.DB,
    media: env.MEDIA,
    ctx,
    siteUrl,
    secure: siteUrl.startsWith('https://'),
    secret: env.SESSION_SECRET,
    rootPage: String(env.ROOT_PAGE || '').trim().toLowerCase(),
  };
}

// Cloudflare sets CF-Connecting-IP itself; clients can't spoof it.
function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function notFound(request) {
  return htmlResponse(request, renderMessage({ title: 'Not found', message: "There's nothing at this address." }), 404);
}

// Only same-site relative paths, so ?next= can't bounce a user off-site.
function safeNext(next) {
  const value = String(next || '');
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/admin';
}

// Adds utm_source/medium/campaign to an outbound link at redirect time —
// configured once per page rather than per-link. Only fills in params the
// destination URL doesn't already set, so a link the editor already
// hand-tagged isn't silently overwritten.
function appendUtmParams(urlStr, data) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    return urlStr; // mailto:/tel: etc. — nothing to append params to
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return urlStr;
  const params = { utm_source: data.utmSource, utm_medium: data.utmMedium, utm_campaign: data.utmCampaign };
  for (const [key, value] of Object.entries(params)) {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}

// ---- Auth helpers ---------------------------------------------------------

async function currentUser(app, request) {
  const session = await readSession(app, request);
  if (!session) return null;
  const user = await db.getUser(app.db, session.userId);
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return user;
}

async function requireApiUser(app, request, { admin = false } = {}) {
  const user = await currentUser(app, request);
  if (!user) throw httpError(401, 'Your session has expired — log in again');
  if (admin && user.role !== 'admin') throw httpError(403, 'Admins only');
  return user;
}

// Runs a JSON API handler; its return value is sent as { ok: true, ...value }.
// A handler can return { headers } to add response headers (e.g. Set-Cookie).
async function handleApi(fn) {
  try {
    const { headers, ...result } = (await fn()) || {};
    return jsonResponse(200, { ok: true, ...result }, headers);
  } catch (err) {
    if (!err.statusCode) console.error(err);
    return jsonResponse(err.statusCode || 500, { ok: false, error: err.statusCode ? err.message : 'Something went wrong' });
  }
}

// ---- Media (R2) ---------------------------------------------------------------

function decodeImageUpload(upload) {
  const match = /^data:([\w./+-]+);base64,(.+)$/s.exec(upload?.dataUrl || '');
  if (!match) throw httpError(400, 'Invalid image upload');
  const [, mime, base64] = match;
  const info = IMAGE_TYPES[mime];
  if (!info) throw httpError(400, `Unsupported image type: ${mime}`);
  let bytes;
  try {
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    throw httpError(400, 'Invalid image upload');
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw httpError(400, 'Image file is too large (max 2 MB)');
  return { ...info, bytes };
}

function isOwnMediaPath(pageSlug, value, subPattern) {
  return new RegExp(`^/media/${pageSlug}/${subPattern}$`).test(value || '');
}

async function putMedia(app, pageSlug, file, { bytes, type }) {
  await app.media.put(`${pageSlug}/${file}`, bytes, { httpMetadata: { contentType: type } });
  return mediaUrl(pageSlug, file);
}

async function deleteMedia(app, publicPath) {
  await app.media.delete(publicPath.replace(/^\/media\//, '')).catch(() => {});
}

// Stores an uploaded { dataUrl } as <baseName>.<ext> and removes a stale
// <baseName>.<otherExt> so old uploads don't pile up. Used for the avatar,
// favicon, and custom social preview image.
async function saveNamedImageUpload(app, pageSlug, upload, baseName, previousPath) {
  const image = decodeImageUpload(upload);
  const newPath = await putMedia(app, pageSlug, `${baseName}.${image.ext}`, image);
  if (previousPath && previousPath !== newPath && isOwnMediaPath(pageSlug, previousPath, `${baseName}\\.\\w+`)) {
    await deleteMedia(app, previousPath);
  }
  return newPath;
}

// Same idea for per-link thumbnails, named after the link's (already
// deduped) slug under uploads/.
async function saveLinkImageUpload(app, pageSlug, upload, linkSlug, previousImagePath) {
  const image = decodeImageUpload(upload);
  const newPath = await putMedia(app, pageSlug, `uploads/${linkSlug}.${image.ext}`, image);
  if (previousImagePath && previousImagePath !== newPath && isOwnMediaPath(pageSlug, previousImagePath, 'uploads/[\\w-]+\\.\\w+')) {
    await deleteMedia(app, previousImagePath);
  }
  return newPath;
}

// Uploads are artist-controlled (SVG can carry script), so they're served
// under a sandboxing CSP: opened directly, nothing in them can run with
// this site's origin (and so can't act on a logged-in admin's session).
async function serveMedia(app, request, key) {
  const object = request.method === 'HEAD' ? await app.media.head(key) : await app.media.get(key);
  if (!object) return notFound(request);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}

// ---- Page editor save -----------------------------------------------------------

// Optional hex: blank means "use the theme default".
function optionalHexColor(value, label) {
  if (!value) return '';
  if (!HEX_RE.test(value)) throw httpError(400, `Invalid ${label}`);
  return value;
}

// A link's existing `image` must be this page's own upload or a shared
// built-in asset from public/ — never another page's media or an arbitrary URL.
function sanitizeExistingImage(pageSlug, value) {
  const image = String(value || '');
  if (!image) return '';
  if (isOwnMediaPath(pageSlug, image, 'uploads/[\\w-]+\\.\\w+')) return image;
  if (/^\/[\w-]+\.(svg|png|jpe?g|webp)$/.test(image)) return image;
  return '';
}

function parseLinkUrl(raw, label) {
  let parsedUrl;
  try {
    parsedUrl = new URL(String(raw || '').trim());
  } catch {
    throw httpError(400, `${label} has an invalid URL`);
  }
  if (!ALLOWED_LINK_PROTOCOLS.has(parsedUrl.protocol)) {
    throw httpError(400, `${label} uses an unsupported link type (${parsedUrl.protocol})`);
  }
  return parsedUrl.toString();
}

// Validates + persists (image uploads included) the submitted sections
// tree, plus the flat social-icon row. Slugs are deduped here, once, across
// BOTH sections and social links (they share the /<page>/go/:slug
// namespace), so the filenames chosen for uploaded link images match
// exactly what normalizeContent() will end up storing (it re-runs the same
// dedupe algorithm, which is idempotent over already-unique slugs).
async function sanitizeAndPersistContent(app, pageSlug, rawSections, rawSocialLinks, previousItemsBySlug) {
  if (!Array.isArray(rawSections)) throw httpError(400, 'sections must be an array');
  if (!Array.isArray(rawSocialLinks)) throw httpError(400, 'socialLinks must be an array');
  const seenSlugs = new Set();
  const images = {};
  const sections = [];

  for (const rawSection of rawSections) {
    const items = [];
    for (const rawItem of rawSection.items || []) {
      if (rawItem.type === 'video') {
        const id = parseYoutubeId(rawItem.youtubeId);
        if (!id) throw httpError(400, `"${rawItem.title || 'Untitled video'}" has an invalid YouTube URL or ID`);
        items.push({ type: 'video', title: String(rawItem.title || '').trim().slice(0, 80), youtubeId: id });
        continue;
      }

      if (rawItem.type === 'soundcloud') {
        const soundcloudUrl = parseSoundcloudUrl(rawItem.soundcloudUrl);
        if (!soundcloudUrl) throw httpError(400, `"${rawItem.title || 'Untitled track'}" has an invalid SoundCloud URL`);
        items.push({ type: 'soundcloud', title: String(rawItem.title || '').trim().slice(0, 80), soundcloudUrl });
        continue;
      }

      if (rawItem.type === 'bandsintown') {
        const attrs = parseBandsintownEmbed(rawItem.bandsintownEmbed);
        if (!attrs) {
          throw httpError(
            400,
            'Paste the full Bandsintown embed code (from Bandsintown\'s widget tool) — couldn\'t find the artist and app IDs in it'
          );
        }
        items.push({ type: 'bandsintown', title: String(rawItem.title || '').trim().slice(0, 80), attrs });
        continue;
      }

      const title = String(rawItem.title || '').trim();
      if (!title) throw httpError(400, 'Every link needs a title');
      const url = parseLinkUrl(rawItem.url, `"${title}"`);
      const emoji = String(rawItem.emoji || '').trim().slice(0, 8);
      const style = rawItem.style === 'featured' ? 'featured' : 'classic';
      const rawSlug = rawItem.slug ? slugify(String(rawItem.slug).trim().slice(0, 60)) : slugify(title);
      const unique = nextUniqueSlug(rawSlug, seenSlugs);

      let image = sanitizeExistingImage(pageSlug, rawItem.image);
      if (rawItem.imageUpload && rawItem.imageUpload.dataUrl) {
        image = await saveLinkImageUpload(app, pageSlug, rawItem.imageUpload, unique, previousItemsBySlug.get(unique)?.image);
        images[unique] = image;
      }

      items.push({ type: 'link', style, title: title.slice(0, 80), url, emoji, image, slug: unique });
    }
    sections.push({ title: String(rawSection.title || '').trim().slice(0, 60), items });
  }

  const socialLinks = [];
  for (const rawSocial of rawSocialLinks) {
    const icon = String(rawSocial.icon || '');
    if (!SOCIAL_ICONS[icon]) throw httpError(400, `Unknown social icon: ${icon}`);
    const url = parseLinkUrl(rawSocial.url, `${SOCIAL_ICONS[icon].label} link`);
    const rawSlug = rawSocial.slug ? slugify(String(rawSocial.slug).trim().slice(0, 60)) : slugify(icon);
    socialLinks.push({ icon, url, slug: nextUniqueSlug(rawSlug, seenSlugs) });
  }

  return { sections, socialLinks, images };
}

async function savePage(app, pageSlug, body) {
  const current = await db.getPageContent(app.db, pageSlug);
  const previousItemsBySlug = new Map(flattenLinkItems(current).map((l) => [l.slug, l]));

  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) throw httpError(400, 'Name is required');
  const googleAnalyticsId = String(body.googleAnalyticsId || '').trim();
  const googleAdsId = String(body.googleAdsId || '').trim();
  const facebookPixelId = String(body.facebookPixelId || '').trim();
  if (![googleAnalyticsId, googleAdsId, facebookPixelId].every((id) => ANALYTICS_ID_RE.test(id))) {
    throw httpError(400, 'Analytics IDs may only contain letters, numbers, and hyphens');
  }

  const fields = {
    name,
    bio: String(body.bio || '').trim().slice(0, 200),
    seoTitle: String(body.seoTitle || '').trim().slice(0, 70),
    seoDescription: String(body.seoDescription || '').trim().slice(0, 160),
    ogTitle: String(body.ogTitle || '').trim().slice(0, 120),
    ogDescription: String(body.ogDescription || '').trim().slice(0, 300),
    accent: HEX_RE.test(body.accent || '') ? body.accent : current.accent,
    backgroundColor: optionalHexColor(body.backgroundColor, 'background color'),
    sectionColor: optionalHexColor(body.sectionColor, 'section color'),
    contentBoxColor: optionalHexColor(body.contentBoxColor, 'content box color'),
    sharpCorners: Boolean(body.sharpCorners),
    avatarStyle: body.avatarStyle === 'hero' ? 'hero' : 'circle',
    utmSource: String(body.utmSource || '').trim().slice(0, 60),
    utmMedium: String(body.utmMedium || '').trim().slice(0, 60),
    utmCampaign: String(body.utmCampaign || '').trim().slice(0, 60),
    googleAnalyticsId,
    googleAdsId,
    facebookPixelId,
  };

  const { sections, socialLinks, images } = await sanitizeAndPersistContent(
    app,
    pageSlug,
    body.sections,
    body.socialLinks || [],
    previousItemsBySlug
  );

  let avatar = current.avatar;
  if (body.avatarUpload && body.avatarUpload.dataUrl) {
    avatar = await saveNamedImageUpload(app, pageSlug, body.avatarUpload, 'avatar', current.avatar);
  }

  let favicon = current.favicon || '';
  if (body.faviconUpload && body.faviconUpload.dataUrl) {
    favicon = await saveNamedImageUpload(app, pageSlug, body.faviconUpload, 'favicon', current.favicon);
  }

  // Custom social preview image: upload takes priority; explicit
  // clearOgImage reverts to the auto-generated og.png fallback.
  let ogImage = current.ogImage || '';
  if (body.ogImageUpload && body.ogImageUpload.dataUrl) {
    ogImage = await saveNamedImageUpload(app, pageSlug, body.ogImageUpload, 'og-custom', current.ogImage);
  } else if (body.clearOgImage) {
    if (isOwnMediaPath(pageSlug, ogImage, 'og-custom\\.\\w+')) await deleteMedia(app, ogImage);
    ogImage = '';
  }

  // The editor draws the auto-generated preview image in the browser (there's
  // no image library on Workers) and sends it along with every save.
  let ogGenerated = Boolean(current.ogGenerated);
  if (body.ogGeneratedUpload && body.ogGeneratedUpload.dataUrl) {
    const image = decodeImageUpload(body.ogGeneratedUpload);
    if (image.ext !== 'png') throw httpError(400, 'Generated preview image must be a PNG');
    await putMedia(app, pageSlug, 'og.png', image);
    ogGenerated = true;
  }

  const saved = await db.savePageContent(app.db, pageSlug, {
    ...fields,
    ogImage,
    ogGenerated,
    avatar,
    favicon,
    sections,
    socialLinks,
  });

  return {
    avatar: saved.avatar,
    favicon: saved.favicon,
    ogImage: saved.ogImage,
    ogRegenerated: Boolean(body.ogGeneratedUpload),
    images,
  };
}

// ---- Public page ------------------------------------------------------------

async function renderPublicPage(app, request, pageSlug, { atRoot = false } = {}) {
  const data = await db.getPageContent(app.db, pageSlug);
  if (!data) return notFound(request);
  // Fallback chain for the share image: custom upload -> generated card ->
  // avatar (for a page that hasn't been saved in the editor yet).
  const ogImage = data.ogImage || (data.ogGenerated ? generatedOgUrl(pageSlug) : data.avatar);
  const html = renderPage({
    ...data,
    siteUrl: app.siteUrl,
    basePath: `/${pageSlug}`,
    canonicalUrl: atRoot ? `${app.siteUrl}/` : `${app.siteUrl}/${pageSlug}`,
    ogImage,
    ogImageIsGenerated: !data.ogImage && Boolean(data.ogGenerated),
  });
  return htmlResponse(request, html);
}

async function handleClick(app, request, pageSlug, linkSlug) {
  const data = PAGE_SLUG_RE.test(pageSlug) ? await db.getPageContent(app.db, pageSlug) : null;
  const link = data && flattenLinkItems(data).find((l) => l.slug === linkSlug);
  if (!link) return notFound(request);
  // Log after responding, so the visitor isn't kept waiting on the write.
  app.ctx.waitUntil(db.recordClick(app.db, pageSlug, linkSlug, request).catch((err) => console.error(err)));
  return redirect(appendUtmParams(link.url, data));
}

// ---- Dashboard ----------------------------------------------------------------

async function renderDashboardFor(app, user) {
  const isAdmin = user.role === 'admin';
  const [users, allPages, invites] = await Promise.all([
    db.listUsersWithPages(app.db),
    db.listPages(app.db),
    isAdmin ? db.listInvites(app.db) : [],
  ]);
  const me = users.find((u) => u.id === user.id);
  const visible = isAdmin ? allPages : allPages.filter((p) => me.pages.includes(p.slug));
  const pages = visible.map((p) => ({
    ...p,
    members: users.filter((u) => u.role !== 'admin' && u.pages.includes(p.slug)),
  }));
  return renderDashboard({
    user,
    pages,
    users: isAdmin ? users : [],
    invites,
    pageNames: isAdmin ? Object.fromEntries(pages.map((p) => [p.slug, p.name])) : {},
    siteUrl: app.siteUrl,
  });
}

// Routes under /admin/api/... — all admin-only JSON endpoints.
function handleAdminApi(app, request, parts) {
  return handleApi(async () => {
    const body = await readApiBody(request, app, MAX_FORM_BYTES);
    const admin = await requireApiUser(app, request, { admin: true });
    const [resource, id, action] = parts;

    if (resource === 'pages' && !id) {
      const slug = String(body.slug || '').trim().toLowerCase();
      const name = String(body.name || '').trim().slice(0, 80);
      if (!name) throw httpError(400, 'Display name is required');
      if (!isValidPageSlug(slug)) {
        throw httpError(400, 'Page URL must be 1–40 lowercase letters, numbers, or hyphens (and not a reserved word)');
      }
      await db.createPage(app.db, slug, { ...starter, name });
      return {};
    }

    if (resource === 'pages' && id === 'archive') {
      await db.archivePage(app.db, String(body.page || ''));
      return {};
    }

    if (resource === 'invites' && !id) {
      const role = body.role === 'admin' ? 'admin' : 'artist';
      const pageSlug = role === 'admin' ? '' : String(body.page || '');
      if (role === 'artist' && !(await db.pageExists(app.db, pageSlug))) throw httpError(400, 'Pick a page for this invite');
      const email = body.email ? db.normalizeEmail(body.email) : '';
      const token = await db.createInvite(app.db, { kind: 'access', role, pageSlug, email, createdBy: admin.id });
      return { link: `${app.siteUrl}/invite/${token}` };
    }

    if (resource === 'invites' && action === 'revoke') {
      await db.revokeInvite(app.db, id);
      return {};
    }

    if (resource === 'users' && id) {
      const target = await db.getUser(app.db, id);
      if (!target) throw httpError(404, 'User not found');

      if (action === 'reset') {
        const token = await db.createInvite(app.db, { kind: 'reset', userId: target.id, email: target.email, createdBy: admin.id });
        return {
          link: `${app.siteUrl}/invite/${token}`,
          message: 'Reset link created (valid 24 hours) — send it to them. It will not be shown again.',
        };
      }
      if (action === 'delete') {
        if (target.id === admin.id) throw httpError(400, "You can't delete your own account");
        await db.deleteUser(app.db, target.id);
        return {};
      }
      if (action === 'grant') {
        const slug = String(body.page || '');
        if (!(await db.pageExists(app.db, slug))) throw httpError(400, 'Page not found');
        await db.grantPage(app.db, target.id, slug);
        return {};
      }
      if (action === 'revoke') {
        await db.revokePage(app.db, target.id, String(body.page || ''));
        return {};
      }
    }

    throw httpError(404, 'Unknown endpoint');
  });
}

async function handleInvite(app, request, token) {
  const invite = await db.findInvite(app.db, token);
  const pageGone = invite && invite.kind === 'access' && invite.pageSlug && !(await db.pageExists(app.db, invite.pageSlug));

  if (request.method === 'GET' || request.method === 'HEAD') {
    if (!invite || pageGone) {
      return htmlResponse(
        request,
        renderMessage({
          title: 'Link expired',
          message: 'This link is invalid, expired, or has already been used. Ask your admin for a new one.',
          linkHref: '/login',
          linkLabel: 'Go to login',
        }),
        410
      );
    }
    const user = invite.kind === 'access' ? await currentUser(app, request) : null;
    const page = invite.pageSlug ? await db.getPageContent(app.db, invite.pageSlug) : null;
    return htmlResponse(request, renderInvite({ token, invite, pageName: page?.name || '', currentUser: user }), 200, {
      'Cache-Control': 'no-store',
    });
  }

  return handleApi(async () => {
    const body = await readApiBody(request, app, MAX_FORM_BYTES);
    if (!invite || pageGone) throw httpError(410, 'This link is invalid, expired, or has already been used');
    const destination = invite.pageSlug ? `/admin/pages/${invite.pageSlug}` : '/admin';

    if (invite.kind === 'reset') {
      validateNewPassword(body.password);
      const passwordHash = await hashPassword(body.password);
      await db.consumeInvite(app.db, token);
      const user = await db.setPassword(app.db, invite.userId, passwordHash);
      return { redirect: '/admin', headers: { 'Set-Cookie': await sessionCookie(app, user) } };
    }

    // Logged in already: attach the invite to this account.
    const me = await currentUser(app, request);
    if (me) {
      if (invite.email && invite.email !== me.email) {
        throw httpError(403, `This invite was sent to ${invite.email} — log out and use that account`);
      }
      await db.consumeInvite(app.db, token);
      if (invite.role === 'admin') await db.promoteToAdmin(app.db, me.id);
      if (invite.pageSlug) await db.grantPage(app.db, me.id, invite.pageSlug);
      return { redirect: destination };
    }

    // New account.
    const email = db.normalizeEmail(invite.email || body.email);
    validateNewPassword(body.password);
    if (await db.getUserByEmail(app.db, email)) {
      throw httpError(409, 'An account with that email already exists — log in first, then open this link again');
    }
    const passwordHash = await hashPassword(body.password);
    await db.consumeInvite(app.db, token);
    const user = await db.createUser(app.db, {
      email,
      passwordHash,
      role: invite.role,
      pages: invite.pageSlug ? [invite.pageSlug] : [],
    });
    return { redirect: destination, headers: { 'Set-Cookie': await sessionCookie(app, user) } };
  });
}

// ---- Router -------------------------------------------------------------------

async function route(request, env, ctx) {
  const app = makeApp(request, env, ctx);
  const url = new URL(request.url);
  const { pathname } = url;
  const parts = pathname.split('/').filter(Boolean);
  const isRead = request.method === 'GET' || request.method === 'HEAD';

  if (pathname === '/') {
    if (!isRead) return methodNotAllowed('GET, HEAD');
    if (app.rootPage && (await db.pageExists(app.db, app.rootPage))) {
      return renderPublicPage(app, request, app.rootPage, { atRoot: true });
    }
    return redirect('/admin');
  }

  // --- Auth ---
  if (pathname === '/login') {
    if (isRead) {
      if (await currentUser(app, request)) return redirect(safeNext(url.searchParams.get('next')));
      return htmlResponse(request, renderLogin({ next: url.searchParams.get('next') || '' }));
    }
    return handleApi(async () => {
      const body = await readApiBody(request, app, MAX_FORM_BYTES);
      const rateKey = `login:${clientIp(request)}`;
      await db.checkRateLimit(app.db, rateKey);
      const user = await db.getUserByEmail(app.db, body.email);
      const ok = await verifyPassword(String(body.password || ''), user?.passwordHash);
      if (!user || !ok) {
        await db.recordFailedAttempt(app.db, rateKey);
        throw httpError(401, 'Wrong email or password');
      }
      return { redirect: safeNext(body.next), headers: { 'Set-Cookie': await sessionCookie(app, user) } };
    });
  }

  if (pathname === '/logout') {
    return handleApi(async () => {
      await readApiBody(request, app, MAX_FORM_BYTES);
      return { headers: { 'Set-Cookie': clearSessionCookie(app) } };
    });
  }

  if (parts[0] === 'invite' && parts.length === 2) {
    return handleInvite(app, request, parts[1]);
  }

  if (pathname === '/account/password') {
    return handleApi(async () => {
      const body = await readApiBody(request, app, MAX_FORM_BYTES);
      const user = await requireApiUser(app, request);
      const rateKey = `password:${clientIp(request)}`;
      await db.checkRateLimit(app.db, rateKey);
      if (!(await verifyPassword(String(body.currentPassword || ''), user.passwordHash))) {
        await db.recordFailedAttempt(app.db, rateKey);
        throw httpError(400, 'Current password is incorrect');
      }
      validateNewPassword(body.newPassword);
      // setPassword bumps session_version, signing out every other device.
      const updated = await db.setPassword(app.db, user.id, await hashPassword(body.newPassword));
      return { headers: { 'Set-Cookie': await sessionCookie(app, updated) } };
    });
  }

  // --- Dashboard & editor ---
  if (parts[0] === 'admin') {
    if (parts[1] === 'api') return handleAdminApi(app, request, parts.slice(2));

    if (parts.length === 1) {
      if (!isRead) return methodNotAllowed('GET, HEAD');
      const user = await currentUser(app, request);
      if (!user) {
        if (!(await db.hasAdmin(app.db))) {
          return htmlResponse(
            request,
            renderMessage({
              title: 'Setup needed',
              message: 'No admin account exists yet. From the project folder, run "npm run admin-invite" and open the link it prints.',
            })
          );
        }
        return redirect('/login?next=/admin');
      }
      return htmlResponse(request, await renderDashboardFor(app, user), 200, { 'Cache-Control': 'no-store' });
    }

    if (parts[1] === 'pages' && parts[2]) {
      const pageSlug = parts[2];
      const sub = parts[3] || '';

      if (sub === 'save') {
        return handleApi(async () => {
          const body = await readApiBody(request, app, MAX_BODY_BYTES);
          const me = await requireApiUser(app, request);
          if (!(await db.canEditPage(app.db, me, pageSlug))) throw httpError(404, 'Page not found');
          return savePage(app, pageSlug, body);
        });
      }

      if (!isRead) return methodNotAllowed('GET, HEAD');
      const user = await currentUser(app, request);
      if (!user) return redirect(`/login?next=${encodeURIComponent(pathname)}`);
      if (parts.length > 4 || !(await db.canEditPage(app.db, user, pageSlug))) return notFound(request);

      const data = await db.getPageContent(app.db, pageSlug);
      if (!sub) {
        const html = renderAdmin({
          data,
          pageUrl: `/${pageSlug}`,
          saveUrl: `/admin/pages/${pageSlug}/save`,
          statsUrl: `/admin/pages/${pageSlug}/stats`,
          dashboardUrl: '/admin',
          generatedOgUrl: generatedOgUrl(pageSlug),
          ogPreviewSrc: data.ogImage || (data.ogGenerated ? generatedOgUrl(pageSlug) : data.avatar),
        });
        return htmlResponse(request, html, 200, { 'Cache-Control': 'no-store' });
      }

      if (sub === 'stats') {
        const { total, bySlug } = await db.aggregateClicks(app.db, pageSlug);
        const rows = flattenLinkItems(data)
          .map((l) => ({
            title: l.title,
            slug: l.slug,
            emoji: l.emoji,
            count: bySlug.get(l.slug)?.count || 0,
            last: bySlug.get(l.slug)?.last || null,
          }))
          .sort((a, b) => b.count - a.count);
        return htmlResponse(request, renderStats({ name: data.name, total, rows, backHref: `/admin/pages/${pageSlug}` }), 200, {
          'Cache-Control': 'no-store',
        });
      }
    }

    return notFound(request);
  }

  if (!isRead) return methodNotAllowed('GET, HEAD');

  // Old single-page URLs.
  if (pathname === '/stats') return redirect('/admin');
  if (parts[0] === 'go' && parts.length === 2 && app.rootPage) {
    return handleClick(app, request, app.rootPage, parts[1]);
  }

  // --- Uploaded media: /media/<page>/<file...> (R2 key "<page>/<file...>") ---
  if (parts[0] === 'media' && parts.length >= 3 && PAGE_SLUG_RE.test(parts[1])) {
    const rest = parts.slice(2);
    if (rest.some((p) => !/^[\w][\w.-]*$/.test(p))) return notFound(request);
    return serveMedia(app, request, `${parts[1]}/${rest.join('/')}`);
  }

  // Shared static files in public/ are served by Cloudflare before the Worker
  // runs, so anything with a dot that reaches here doesn't exist.
  if (parts.length === 1 && parts[0].includes('.')) return notFound(request);

  // --- Artist pages: /<page> and /<page>/go/<link> ---
  if (parts.length === 1 && PAGE_SLUG_RE.test(parts[0])) return renderPublicPage(app, request, parts[0]);
  if (parts.length === 3 && parts[1] === 'go') return handleClick(app, request, parts[0], parts[2]);

  return notFound(request);
}
