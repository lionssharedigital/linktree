import { SOCIAL_ICONS } from './icons.js';

// Page content is a JSON document stored in D1 (pages.content) with the
// same shape the old links.json had; uploads live in R2 under "<slug>/...",
// served publicly at /media/<slug>/...

export const PAGE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

// Top-level paths the router owns, so no page can shadow them.
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'account', 'assets', 'go', 'help', 'invite', 'login', 'logout',
  'media', 'public', 'register', 'reset', 'settings', 'setup', 'signup', 'static',
  'stats', 'uploads', 'www',
]);

export function isValidPageSlug(slug) {
  return PAGE_SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function mediaUrl(slug, file) {
  return `/media/${slug}/${file}`;
}

export function generatedOgUrl(slug) {
  return mediaUrl(slug, 'og.png');
}

export function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Accepts a full YouTube URL (watch/embed/youtu.be/shorts) or a bare
// 11-character video ID and returns just the ID, or null if unrecognized.
export function parseYoutubeId(input) {
  const str = String(input || '').trim();
  if (/^[\w-]{11}$/.test(str)) return str;
  try {
    const url = new URL(str);
    if (/(^|\.)youtu\.be$/.test(url.hostname)) {
      const id = url.pathname.slice(1);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)) {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id && /^[\w-]{11}$/.test(id) ? id : null;
      }
      const match = /^\/(embed|shorts)\/([\w-]{11})/.exec(url.pathname);
      if (match) return match[2];
    }
  } catch {
    // not a URL
  }
  return null;
}

// Accepts a soundcloud.com (or on.soundcloud.com share link) track/playlist/
// user URL and returns it normalized, or null if it's not a SoundCloud URL.
export function parseSoundcloudUrl(input) {
  const str = String(input || '').trim();
  try {
    const url = new URL(str);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!/(^|\.)(soundcloud\.com|on\.soundcloud\.com)$/.test(url.hostname)) return null;
    if (url.pathname === '/' || url.pathname === '') return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Bandsintown's own widget-builder tool generates a full embed snippet per
// artist — a required data-artist-name (often "id_<digits>", not a plain
// name) and data-app-id, plus whatever color attributes the artist picked
// (data-background-color, data-text-color, etc.). Rather than guess which
// cosmetic attributes exist, this pulls every data-* attribute off the
// pasted <a class="bit-widget-initializer"> tag and echoes them back as-is.
export function sanitizeBandsintownAttrs(raw) {
  const attrs = {};
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      if (!/^[a-z-]{1,40}$/.test(key)) continue;
      if (Object.keys(attrs).length >= 20) break;
      attrs[key] = String(value ?? '').trim().slice(0, 200);
    }
  }
  return attrs;
}

const BANDSINTOWN_ATTR_RE = /data-([a-z-]+)\s*=\s*["']([^"']*)["']/g;

export function parseBandsintownEmbed(input) {
  const str = String(input || '').slice(0, 4000);
  const attrs = {};
  let match;
  BANDSINTOWN_ATTR_RE.lastIndex = 0;
  while ((match = BANDSINTOWN_ATTR_RE.exec(str))) {
    if (Object.keys(attrs).length >= 20) break;
    attrs[match[1]] = match[2].trim().slice(0, 200);
  }
  if (!attrs['artist-name'] || !attrs['app-id']) return null;
  return attrs;
}

// Old flat `links: [...]` files (pre-sections) get wrapped into a single
// untitled section so imported legacy content keeps working.
function migrateToSections(data) {
  if (Array.isArray(data.links) && !data.sections) {
    return {
      ...data,
      sections: [{ title: '', items: data.links.map((l) => ({ type: 'link', ...l })) }],
    };
  }
  return data;
}

export function nextUniqueSlug(rawSlug, seenSlugs) {
  let unique = rawSlug;
  let i = 2;
  while (seenSlugs.has(unique)) unique = `${rawSlug}-${i++}`;
  seenSlugs.add(unique);
  return unique;
}

// `seenSlugs` is shared across sections AND social icons, since both go
// through the same /<page>/go/:slug click-tracking namespace.
function normalizeSections(sections, seenSlugs) {
  return (sections || []).map((section) => ({
    title: section.title || '',
    items: (section.items || []).map((item) => {
      if (item.type === 'video') {
        return { type: 'video', title: item.title || '', youtubeId: item.youtubeId || '' };
      }
      if (item.type === 'soundcloud') {
        return { type: 'soundcloud', title: item.title || '', soundcloudUrl: item.soundcloudUrl || '' };
      }
      if (item.type === 'bandsintown') {
        return { type: 'bandsintown', title: item.title || '', attrs: sanitizeBandsintownAttrs(item.attrs) };
      }
      const rawSlug = item.slug ? slugify(item.slug) : slugify(item.title || '');
      return {
        type: 'link',
        style: item.style === 'featured' ? 'featured' : 'classic',
        title: item.title || '',
        url: item.url || '',
        emoji: item.emoji || '',
        image: item.image || '',
        slug: nextUniqueSlug(rawSlug, seenSlugs),
      };
    }),
  }));
}

function normalizeSocialLinks(socialLinks, seenSlugs) {
  return (socialLinks || [])
    .filter((s) => SOCIAL_ICONS[s.icon])
    .map((s) => {
      const rawSlug = s.slug ? slugify(s.slug) : slugify(s.icon);
      return { icon: s.icon, url: s.url || '', slug: nextUniqueSlug(rawSlug, seenSlugs) };
    });
}

// Normalizes page content on every read and write, so hand-edited or
// imported JSON always renders with unique link slugs.
export function normalizeContent(raw) {
  const data = migrateToSections({ ...raw });
  const seenSlugs = new Set();
  data.sections = normalizeSections(data.sections, seenSlugs);
  data.socialLinks = normalizeSocialLinks(data.socialLinks, seenSlugs);
  delete data.links;
  return data;
}

export function flattenLinkItems(data) {
  const items = [];
  for (const section of data.sections || []) {
    for (const item of section.items || []) {
      if (item.type === 'link') items.push(item);
    }
  }
  for (const social of data.socialLinks || []) {
    items.push({
      title: SOCIAL_ICONS[social.icon]?.label || social.icon,
      url: social.url,
      emoji: '',
      slug: social.slug,
    });
  }
  return items;
}
