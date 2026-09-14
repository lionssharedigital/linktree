import http from 'node:http';
import crypto from 'node:crypto';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './lib/env.js';
import { loadLinks, saveLinks, flattenLinkItems, slugify, parseYoutubeId } from './lib/links.js';
import { recordClick, aggregateClicks } from './lib/clicks.js';
import { renderPage, renderStats } from './lib/render.js';
import { renderAdmin } from './lib/adminRender.js';
import { buildOgPng } from './lib/og.js';
import { SOCIAL_ICONS } from './lib/icons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
};

// data: URL mime -> file extension, for avatar/link-image uploads.
// Deliberately a closed allowlist (no arbitrary "image/*") since this
// decides what file extension gets written to disk.
const IMAGE_MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = 24 * 1024 * 1024; // room for several base64 images + JSON

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const ANALYTICS_ID_RE = /^[A-Za-z0-9-]{0,20}$/;

// Blank means "use the theme default"; anything non-blank must be a valid hex color.
function optionalHexColor(value, label) {
  if (!value) return '';
  if (!HEX_RE.test(value)) throw Object.assign(new Error(`Invalid ${label}`), { statusCode: 400 });
  return value;
}

// Adds utm_source/medium/campaign to an outbound link at redirect time —
// configured once in /admin rather than per-link. Only fills in params the
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

function sha256(str) {
  return crypto.createHash('sha256').update(String(str)).digest();
}

function safeEqual(a, b) {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

function checkBasicAuth(req, user, pass) {
  if (!user || !pass) return false;
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return false;
  return safeEqual(decoded.slice(0, idx), user) && safeEqual(decoded.slice(idx + 1), pass);
}

function requireAuth(req, res, user, pass, realm) {
  if (checkBasicAuth(req, user, pass)) return true;
  res.writeHead(401, {
    'WWW-Authenticate': `Basic realm="${realm}", charset="UTF-8"`,
    'Content-Type': 'text/plain',
  });
  res.end('Authentication required');
  return false;
}

async function readJsonBody(req, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const err = new Error('Request body too large');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON body');
    err.statusCode = 400;
    throw err;
  }
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(json);
}

async function serveStatic(req, res, urlPath) {
  const requested = decodeURIComponent(urlPath);
  const resolved = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(resolved)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  try {
    const data = await readFile(resolved);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(data);
  } catch {
    res.writeHead(500).end('Server error');
  }
}

function decodeImageUpload(upload) {
  const match = /^data:([\w./+-]+);base64,(.+)$/s.exec(upload?.dataUrl || '');
  if (!match) throw Object.assign(new Error('Invalid image upload'), { statusCode: 400 });
  const [, mime, base64] = match;
  const ext = IMAGE_MIME_EXT[mime];
  if (!ext) throw Object.assign(new Error(`Unsupported image type: ${mime}`), { statusCode: 400 });
  const buf = Buffer.from(base64, 'base64');
  if (buf.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Image file is too large (max 2 MB)'), { statusCode: 400 });
  }
  return { ext, buf };
}

// Decodes a client-submitted { filename, dataUrl } upload, writes it to
// public/<baseName>.<ext>, and removes a stale public/<baseName>.<otherExt>
// so old uploads don't pile up. Returns the new "/<baseName>.<ext>" path.
// Used for both the avatar and the favicon.
async function saveNamedImageUpload(upload, baseName, previousPath) {
  const { ext, buf } = decodeImageUpload(upload);
  const newPath = `/${baseName}.${ext}`;
  await writeFile(path.join(PUBLIC_DIR, `${baseName}.${ext}`), buf);

  if (
    previousPath &&
    previousPath !== newPath &&
    new RegExp(`^/${baseName}\\.\\w+$`).test(previousPath)
  ) {
    await unlink(path.join(PUBLIC_DIR, previousPath.slice(1))).catch(() => {});
  }
  return newPath;
}

// Same idea as saveAvatarUpload but for per-link thumbnail images, named
// after the link's (already-deduped) slug and stored under public/uploads/.
async function saveLinkImageUpload(imageUpload, slug, previousImagePath) {
  const { ext, buf } = decodeImageUpload(imageUpload);
  await mkdir(UPLOADS_DIR, { recursive: true });
  const newPath = `/uploads/${slug}.${ext}`;
  await writeFile(path.join(PUBLIC_DIR, 'uploads', `${slug}.${ext}`), buf);

  if (
    previousImagePath &&
    previousImagePath !== newPath &&
    /^\/uploads\/[\w-]+\.\w+$/.test(previousImagePath)
  ) {
    await unlink(path.join(PUBLIC_DIR, previousImagePath.slice(1))).catch(() => {});
  }
  return newPath;
}

// Validates + persists (image uploads included) the admin-submitted
// sections tree, plus the flat social-icon row. Slugs are deduped here,
// once, across BOTH sections and social links (they share the /go/:slug
// namespace), so the filenames chosen for uploaded link images match
// exactly what saveLinks() will end up storing (saveLinks re-runs the same
// dedupe algorithm, which is idempotent over already-unique slugs).
async function sanitizeAndPersistContent(rawSections, rawSocialLinks, previousItemsBySlug) {
  if (!Array.isArray(rawSections)) {
    throw Object.assign(new Error('sections must be an array'), { statusCode: 400 });
  }
  if (!Array.isArray(rawSocialLinks)) {
    throw Object.assign(new Error('socialLinks must be an array'), { statusCode: 400 });
  }
  const seenSlugs = new Set();
  const images = {};
  const sections = [];

  for (const rawSection of rawSections) {
    const items = [];
    for (const rawItem of rawSection.items || []) {
      if (rawItem.type === 'video') {
        const id = parseYoutubeId(rawItem.youtubeId);
        if (!id) {
          throw Object.assign(
            new Error(`"${rawItem.title || 'Untitled video'}" has an invalid YouTube URL or ID`),
            { statusCode: 400 }
          );
        }
        items.push({ type: 'video', title: String(rawItem.title || '').trim().slice(0, 80), youtubeId: id });
        continue;
      }

      const title = String(rawItem.title || '').trim();
      if (!title) throw Object.assign(new Error('Every link needs a title'), { statusCode: 400 });
      let parsedUrl;
      try {
        parsedUrl = new URL(String(rawItem.url || '').trim());
      } catch {
        throw Object.assign(new Error(`"${title}" has an invalid URL`), { statusCode: 400 });
      }
      if (!ALLOWED_LINK_PROTOCOLS.has(parsedUrl.protocol)) {
        throw Object.assign(
          new Error(`"${title}" uses an unsupported link type (${parsedUrl.protocol})`),
          { statusCode: 400 }
        );
      }

      const emoji = String(rawItem.emoji || '').trim().slice(0, 8);
      const style = rawItem.style === 'featured' ? 'featured' : 'classic';
      const rawSlug = rawItem.slug ? slugify(String(rawItem.slug).trim().slice(0, 60)) : slugify(title);
      let unique = rawSlug;
      let i = 2;
      while (seenSlugs.has(unique)) unique = `${rawSlug}-${i++}`;
      seenSlugs.add(unique);

      let image = String(rawItem.image || '');
      if (rawItem.imageUpload && rawItem.imageUpload.dataUrl) {
        image = await saveLinkImageUpload(rawItem.imageUpload, unique, previousItemsBySlug.get(unique)?.image);
        images[unique] = image;
      }

      items.push({ type: 'link', style, title: title.slice(0, 80), url: parsedUrl.toString(), emoji, image, slug: unique });
    }
    sections.push({ title: String(rawSection.title || '').trim().slice(0, 60), items });
  }

  const socialLinks = [];
  for (const rawSocial of rawSocialLinks) {
    const icon = String(rawSocial.icon || '');
    if (!SOCIAL_ICONS[icon]) {
      throw Object.assign(new Error(`Unknown social icon: ${icon}`), { statusCode: 400 });
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(String(rawSocial.url || '').trim());
    } catch {
      throw Object.assign(new Error(`${SOCIAL_ICONS[icon].label} link has an invalid URL`), { statusCode: 400 });
    }
    if (!ALLOWED_LINK_PROTOCOLS.has(parsedUrl.protocol)) {
      throw Object.assign(
        new Error(`${SOCIAL_ICONS[icon].label} link uses an unsupported link type (${parsedUrl.protocol})`),
        { statusCode: 400 }
      );
    }
    const rawSlug = rawSocial.slug ? slugify(String(rawSocial.slug).trim().slice(0, 60)) : slugify(icon);
    let unique = rawSlug;
    let i = 2;
    while (seenSlugs.has(unique)) unique = `${rawSlug}-${i++}`;
    seenSlugs.add(unique);
    socialLinks.push({ icon, url: parsedUrl.toString(), slug: unique });
  }

  return { sections, socialLinks, images };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const { pathname } = url;

    if (pathname === '/') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
        return;
      }
      const data = loadLinks();
      const html = renderPage({
        name: data.name,
        bio: data.bio,
        avatar: data.avatar,
        favicon: data.favicon,
        sections: data.sections,
        socialLinks: data.socialLinks,
        siteUrl: env.SITE_URL,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        ogTitle: data.ogTitle,
        ogDescription: data.ogDescription,
        ogImage: data.ogImage || '/og.png',
        accent: data.accent,
        backgroundColor: data.backgroundColor,
        sectionColor: data.sectionColor,
        contentBoxColor: data.contentBoxColor,
        sharpCorners: data.sharpCorners,
        avatarStyle: data.avatarStyle,
        googleAnalyticsId: data.googleAnalyticsId,
        googleAdsId: data.googleAdsId,
        facebookPixelId: data.facebookPixelId,
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : html);
      return;
    }

    if (pathname.startsWith('/go/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
        return;
      }
      const slug = pathname.slice('/go/'.length);
      const data = loadLinks();
      const link = flattenLinkItems(data).find((l) => l.slug === slug);
      if (!link) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Link not found');
        return;
      }
      await recordClick(slug, req);
      const destination = appendUtmParams(link.url, data);
      res.writeHead(302, { Location: destination, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    if (pathname === '/stats') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
        return;
      }
      if (!requireAuth(req, res, env.STATS_USER, env.STATS_PASS, 'stats')) return;
      const data = loadLinks();
      const { total, bySlug } = await aggregateClicks();
      const rows = flattenLinkItems(data)
        .map((l) => ({
          title: l.title,
          slug: l.slug,
          emoji: l.emoji,
          count: bySlug.get(l.slug)?.count || 0,
          last: bySlug.get(l.slug)?.last || null,
        }))
        .sort((a, b) => b.count - a.count);
      const html = renderStats({ name: data.name, total, rows });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : html);
      return;
    }

    if (pathname === '/admin') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
        return;
      }
      if (!requireAuth(req, res, env.ADMIN_USER, env.ADMIN_PASS, 'admin')) return;
      const data = loadLinks();
      const html = renderAdmin({ name: data.name, siteUrl: env.SITE_URL, data });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : html);
      return;
    }

    if (pathname === '/admin/save') {
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' }).end('Method not allowed');
        return;
      }
      if (!requireAuth(req, res, env.ADMIN_USER, env.ADMIN_PASS, 'admin')) return;

      // Require an exact JSON content-type. A cross-site <form> POST can
      // only send application/x-www-form-urlencoded, multipart/form-data,
      // or text/plain — never application/json — so this alone blocks the
      // classic CSRF-via-auto-submitting-form attack against this endpoint.
      const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
      if (contentType !== 'application/json') {
        sendJson(res, 415, { ok: false, error: 'Expected application/json' });
        return;
      }

      let body;
      try {
        body = await readJsonBody(req, MAX_BODY_BYTES);
      } catch (err) {
        sendJson(res, err.statusCode || 400, { ok: false, error: err.message });
        return;
      }

      try {
        const current = loadLinks();
        const previousItemsBySlug = new Map(flattenLinkItems(current).map((l) => [l.slug, l]));

        const name = String(body.name || '').trim().slice(0, 80);
        if (!name) throw Object.assign(new Error('Name is required'), { statusCode: 400 });
        const bio = String(body.bio || '').trim().slice(0, 200);
        const seoTitle = String(body.seoTitle || '').trim().slice(0, 70);
        const seoDescription = String(body.seoDescription || '').trim().slice(0, 160);
        const ogTitle = String(body.ogTitle || '').trim().slice(0, 120);
        const ogDescription = String(body.ogDescription || '').trim().slice(0, 300);
        const accent = HEX_RE.test(body.accent || '') ? body.accent : current.accent;
        const backgroundColor = optionalHexColor(body.backgroundColor, 'background color');
        const sectionColor = optionalHexColor(body.sectionColor, 'section color');
        const contentBoxColor = optionalHexColor(body.contentBoxColor, 'content box color');
        const sharpCorners = Boolean(body.sharpCorners);
        const avatarStyle = body.avatarStyle === 'hero' ? 'hero' : 'circle';
        const utmSource = String(body.utmSource || '').trim().slice(0, 60);
        const utmMedium = String(body.utmMedium || '').trim().slice(0, 60);
        const utmCampaign = String(body.utmCampaign || '').trim().slice(0, 60);

        const googleAnalyticsId = String(body.googleAnalyticsId || '').trim();
        const googleAdsId = String(body.googleAdsId || '').trim();
        const facebookPixelId = String(body.facebookPixelId || '').trim();
        if (
          !ANALYTICS_ID_RE.test(googleAnalyticsId) ||
          !ANALYTICS_ID_RE.test(googleAdsId) ||
          !ANALYTICS_ID_RE.test(facebookPixelId)
        ) {
          throw Object.assign(new Error('Analytics IDs may only contain letters, numbers, and hyphens'), {
            statusCode: 400,
          });
        }

        const { sections, socialLinks, images } = await sanitizeAndPersistContent(
          body.sections,
          body.socialLinks || [],
          previousItemsBySlug
        );

        let avatar = current.avatar;
        if (body.avatarUpload && body.avatarUpload.dataUrl) {
          avatar = await saveNamedImageUpload(body.avatarUpload, 'avatar', current.avatar);
        }

        let favicon = current.favicon || '';
        if (body.faviconUpload && body.faviconUpload.dataUrl) {
          favicon = await saveNamedImageUpload(body.faviconUpload, 'favicon', current.favicon);
        }

        // Custom social preview image: upload takes priority; explicit
        // clearOgImage reverts to the auto-generated /og.png fallback.
        let ogImage = current.ogImage || '';
        if (body.ogImageUpload && body.ogImageUpload.dataUrl) {
          ogImage = await saveNamedImageUpload(body.ogImageUpload, 'og-custom', current.ogImage);
        } else if (body.clearOgImage) {
          if (ogImage && /^\/og-custom\.\w+$/.test(ogImage)) {
            await unlink(path.join(PUBLIC_DIR, ogImage.slice(1))).catch(() => {});
          }
          ogImage = '';
        }

        const saved = await saveLinks({
          name,
          bio,
          seoTitle,
          seoDescription,
          ogTitle,
          ogDescription,
          ogImage,
          accent,
          backgroundColor,
          sectionColor,
          contentBoxColor,
          sharpCorners,
          avatarStyle,
          utmSource,
          utmMedium,
          utmCampaign,
          avatar,
          favicon,
          googleAnalyticsId,
          googleAdsId,
          facebookPixelId,
          sections,
          socialLinks,
        });

        let ogRegenerated = false;
        try {
          const png = await buildOgPng({
            name: saved.ogTitle || saved.seoTitle || saved.name,
            bio: saved.ogDescription || saved.seoDescription || saved.bio,
            accent: saved.accent,
          });
          await writeFile(path.join(PUBLIC_DIR, 'og.png'), png);
          ogRegenerated = true;
        } catch (err) {
          console.warn('OG image regeneration skipped:', err.message);
        }

        sendJson(res, 200, {
          ok: true,
          avatar: saved.avatar,
          favicon: saved.favicon,
          ogImage: saved.ogImage,
          ogRegenerated,
          images,
        });
      } catch (err) {
        sendJson(res, err.statusCode || 500, { ok: false, error: err.message || 'Save failed' });
      }
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }

    // Static assets (avatar, og.png, uploads, favicon, ...)
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(env.PORT, () => {
  console.log(`link-in-bio listening on http://localhost:${env.PORT}`);
});
