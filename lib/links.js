import { readFileSync } from 'node:fs';
import { writeFile, rename, unlink } from 'node:fs/promises';
import { SOCIAL_ICONS } from './icons.js';

const LINKS_PATH = new URL('../links.json', import.meta.url);
const LINKS_TMP_PATH = new URL('../links.json.tmp', import.meta.url);

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

// Old flat `links: [...]` files (pre-sections) get wrapped into a single
// untitled section so existing deployments keep working without a manual
// migration step.
function migrateToSections(data) {
  if (Array.isArray(data.links) && !data.sections) {
    return {
      ...data,
      sections: [{ title: '', items: data.links.map((l) => ({ type: 'link', ...l })) }],
    };
  }
  return data;
}

function nextUniqueSlug(rawSlug, seenSlugs) {
  let unique = rawSlug;
  let i = 2;
  while (seenSlugs.has(unique)) unique = `${rawSlug}-${i++}`;
  seenSlugs.add(unique);
  return unique;
}

// `seenSlugs` is shared across sections AND social icons, since both go
// through the same /go/:slug click-tracking namespace.
function normalizeSections(sections, seenSlugs) {
  return (sections || []).map((section) => ({
    title: section.title || '',
    items: (section.items || []).map((item) => {
      if (item.type === 'video') {
        return { type: 'video', title: item.title || '', youtubeId: item.youtubeId || '' };
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

// Re-read links.json on every call so editing the JSON is the whole CMS —
// no restart required to publish a change.
export function loadLinks() {
  const raw = readFileSync(LINKS_PATH, 'utf8');
  const data = migrateToSections(JSON.parse(raw));
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

export function findLink(slug) {
  const data = loadLinks();
  return flattenLinkItems(data).find((l) => l.slug === slug) || null;
}

// Atomic write: write to a temp file then rename over the real file, so a
// crash or concurrent read never sees a half-written links.json.
export async function saveLinks(data) {
  const seenSlugs = new Set();
  const toSave = {
    ...data,
    sections: normalizeSections(data.sections, seenSlugs),
    socialLinks: normalizeSocialLinks(data.socialLinks, seenSlugs),
  };
  delete toSave.links;
  const json = JSON.stringify(toSave, null, 2) + '\n';
  await writeFile(LINKS_TMP_PATH, json, 'utf8');
  try {
    await rename(LINKS_TMP_PATH, LINKS_PATH);
  } catch (err) {
    await unlink(LINKS_TMP_PATH).catch(() => {});
    throw err;
  }
  return toSave;
}
