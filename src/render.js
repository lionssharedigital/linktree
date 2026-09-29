import { iconSvg } from './icons.js';

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

// Picks readable foreground/muted text colors for a custom background —
// without this, a light custom color under a dark-mode browser (or vice
// versa) would render near-invisible text.
function contrastPalette(hex) {
  if (!HEX_RE.test(hex || '')) return null;
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c.slice(0, 6).padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? { fg: '#141414', muted: '#5c5a57' } : { fg: '#f5f4f2', muted: '#a3a1a0' };
}

const FONT_STACKS = {
  poppins: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: '"SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

// sharpCorners/avatarStyle predate theme inheritance and used to always be a
// concrete boolean / enum — old stored values are treated as an explicit
// page-level choice (not blank/inherit) so pages saved before themes shipped
// render exactly as before. Only a genuinely blank value (only possible on
// pages saved after themes shipped) inherits from the theme.
function resolveSharpCorners(pageValue, themeValue) {
  if (pageValue === true || pageValue === 'true') return true;
  if (pageValue === false || pageValue === 'false') return false;
  return themeValue === true || themeValue === 'true';
}
function resolveAvatarStyle(pageValue, themeValue) {
  if (pageValue === 'hero' || pageValue === 'circle') return pageValue;
  if (themeValue === 'hero' || themeValue === 'circle') return themeValue;
  return 'circle';
}

export const BASE_STYLES = `
  :root {
    --bg: #f6f5f3;
    --fg: #1a1a1a;
    --muted: #62605c;
    --card: #ffffff;
    --card-border: rgba(0,0,0,0.08);
    --shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
    --accent: #7c5cff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #121214;
      --fg: #f2f1ef;
      --muted: #a3a1a0;
      --card: #1c1c1f;
      --card-border: rgba(255,255,255,0.08);
      --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35);
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    background: var(--bg);
    color: var(--fg);
    font-family: "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    justify-content: center;
    padding: 48px 20px 64px;
  }
  .page { width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; }
  .content-box { width: 100%; display: flex; flex-direction: column; align-items: center; }
  .avatar {
    width: 96px; height: 96px; border-radius: 50%;
    object-fit: cover; border: 3px solid var(--card);
    box-shadow: var(--shadow);
  }
  .avatar-hero {
    width: 100%; height: 260px; object-fit: cover; display: block;
    -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);
    mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);
  }
  h1 { font-size: 1.25rem; margin: 16px 0 4px; text-align: center; }
  .bio { color: var(--muted); text-align: center; font-size: 0.95rem; margin: 0 0 8px; line-height: 1.4; max-width: 340px; }

  .section { width: 100%; margin-top: 24px; }
  .section-title {
    font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--muted); margin: 0 0 12px 4px;
  }
  .items { width: 100%; display: flex; flex-direction: column; gap: 12px; }

  .carousel-wrap { position: relative; width: 100%; }
  .items.carousel {
    flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory;
    padding-bottom: 2px; scrollbar-width: none;
  }
  .items.carousel::-webkit-scrollbar { display: none; }
  .items.carousel > * { flex: none; width: 150px; scroll-snap-align: start; }
  .items.carousel .link-featured .title-featured { font-size: 0.85rem; }
  .carousel-arrow {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 1;
    width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--card-border);
    background: var(--card); color: var(--fg); box-shadow: var(--shadow); cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 1.1rem; padding: 0;
  }
  .carousel-prev { left: -6px; }
  .carousel-next { right: -6px; }
  @media (hover: none) { .carousel-arrow { display: none; } }

  .link {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 14px 18px; border-radius: 14px;
    background: var(--card); border: 1px solid var(--card-border);
    color: var(--fg); text-decoration: none; font-weight: 500; font-size: 0.98rem;
    box-shadow: var(--shadow);
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .link:hover { transform: translateY(-2px); border-color: var(--accent); }
  .link:active { transform: translateY(0); }
  .link .emoji { font-size: 1.15rem; line-height: 1; flex: none; }
  .link .thumb { width: 28px; height: 28px; border-radius: 7px; object-fit: cover; flex: none; }
  .link .title { flex: 1; }

  .link-featured {
    display: flex; flex-direction: column; width: 100%;
    text-decoration: none; color: var(--fg);
    animation: linkbio-pulse 2.6s ease-in-out infinite;
  }
  .link-featured .thumb-featured {
    width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 14px;
    border: 1px solid var(--card-border); box-shadow: var(--shadow); display: block;
  }
  .link-featured .title-featured {
    margin-top: 10px; font-weight: 600; font-size: 1rem; text-align: center;
  }
  @keyframes linkbio-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }
  @media (prefers-reduced-motion: reduce) {
    .link-featured { animation: none; }
  }

  body.sharp-corners .link,
  body.sharp-corners .link .thumb,
  body.sharp-corners .link-featured .thumb-featured {
    border-radius: 0;
  }

  .video-embed {
    position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 14px;
    overflow: hidden; background: var(--card); border: 1px solid var(--card-border); box-shadow: var(--shadow);
  }
  .video-embed iframe { width: 100%; height: 100%; border: 0; display: block; }
  .video-play {
    position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; cursor: pointer;
    background: #000;
  }
  .video-play img { width: 100%; height: 100%; object-fit: cover; opacity: 0.85; display: block; }
  .video-play .play-icon {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 56px; height: 56px; border-radius: 50%; background: rgba(0,0,0,0.65);
    color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;
  }
  .video-caption {
    margin-top: 8px; font-size: 0.85rem; font-weight: 500; color: var(--fg); text-align: center;
  }

  .soundcloud-embed {
    width: 100%; height: 166px; border-radius: 14px; overflow: hidden;
    background: var(--card); border: 1px solid var(--card-border); box-shadow: var(--shadow);
  }
  .soundcloud-embed iframe { width: 100%; height: 100%; border: 0; display: block; }
  .soundcloud-caption {
    margin-top: 8px; font-size: 0.85rem; font-weight: 500; color: var(--fg); text-align: center;
  }

  .bandsintown-embed {
    /* No background/border here — the widget renders its own chrome using
       whatever colors the artist picked in Bandsintown's widget builder. */
    width: 100%; border-radius: 14px; overflow: hidden;
  }
  .bandsintown-caption {
    margin-top: 8px; font-size: 0.85rem; font-weight: 500; color: var(--fg); text-align: center;
  }

  .show-card {
    display: flex; align-items: center; gap: 14px; width: 100%; padding: 12px 16px;
    border-radius: 14px; background: var(--card); border: 1px solid var(--card-border); box-shadow: var(--shadow);
  }
  .show-date {
    flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center;
    width: 54px; padding: 6px 0; border-radius: 10px; background: var(--bg); border: 1px solid var(--card-border);
  }
  .show-month { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; color: var(--accent); }
  .show-day { font-size: 1.3rem; font-weight: 700; line-height: 1.1; }
  .show-year { font-size: 0.65rem; color: var(--muted); }
  .show-info { flex: 1; min-width: 0; }
  .show-title { font-weight: 600; font-size: 0.95rem; }
  .show-venue { font-size: 0.82rem; color: var(--muted); margin-top: 2px; }
  .show-ticket {
    display: inline-block; margin-top: 8px; padding: 6px 14px; border-radius: 999px;
    background: var(--accent); color: #fff; font-size: 0.78rem; font-weight: 600;
    text-decoration: none;
  }
  .items.carousel .show-card { flex-direction: column; width: 160px; padding: 12px; text-align: center; }
  .items.carousel .show-info { width: 100%; }

  .track-card {
    width: 100%; padding: 12px 16px; border-radius: 14px;
    background: var(--card); border: 1px solid var(--card-border); box-shadow: var(--shadow);
  }
  .track-head { display: flex; align-items: center; gap: 12px; }
  .track-thumb { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex: none; }
  .track-text { flex: 1; min-width: 0; }
  .track-title { font-weight: 600; font-size: 0.95rem; }
  .track-subtitle { font-size: 0.8rem; color: var(--muted); margin-top: 1px; }
  .track-links { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .track-pill {
    padding: 5px 12px; border-radius: 999px; border: 1px solid var(--card-border);
    background: var(--bg); color: var(--fg); font-size: 0.76rem; font-weight: 600; text-decoration: none;
  }
  .track-pill:hover { border-color: var(--accent); color: var(--accent); }
  .items.carousel .track-card { width: 170px; }

  .social-row {
    width: 100%; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px;
  }
  .social-icon {
    display: flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; border-radius: 50%;
    background: var(--card); border: 1px solid var(--card-border); color: var(--fg);
    box-shadow: var(--shadow); transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .social-icon:hover { transform: translateY(-2px); border-color: var(--accent); }
  .social-icon:active { transform: translateY(0); }
  .social-icon svg { width: 20px; height: 20px; }
  .social-row.outline .social-icon { background: transparent; box-shadow: none; }

  footer { margin-top: 40px; color: var(--muted); font-size: 0.78rem; text-align: center; }
  footer a { color: inherit; }
`;

function renderLinkItem(item, basePath) {
  // A "featured" item with no image has nothing to feature, so it falls
  // back to the classic stacked-link treatment instead of rendering an
  // empty/broken card.
  if (item.style === 'featured' && item.image) {
    return `
      <a class="link-featured" href="${esc(basePath)}/go/${esc(item.slug)}" target="_blank" rel="noopener noreferrer">
        <img class="thumb-featured" src="${esc(item.image)}" alt="" loading="lazy" />
        <span class="title-featured">${esc(item.title)}</span>
      </a>`;
  }
  const icon = item.image
    ? `<img class="thumb" src="${esc(item.image)}" alt="" loading="lazy" />`
    : item.emoji
      ? `<span class="emoji">${esc(item.emoji)}</span>`
      : '';
  return `
      <a class="link" href="${esc(basePath)}/go/${esc(item.slug)}" target="_blank" rel="noopener noreferrer">
        ${icon}
        <span class="title">${esc(item.title)}</span>
      </a>`;
}

function renderVideoItem(item) {
  if (!item.youtubeId) return '';
  const caption = item.title
    ? `<div class="video-caption">${esc(item.title)}</div>`
    : '';
  return `
      <div>
        <div class="video-embed" data-yt="${esc(item.youtubeId)}">
          <button type="button" class="video-play" aria-label="Play video${item.title ? ': ' + esc(item.title) : ''}">
            <img src="https://i.ytimg.com/vi/${esc(item.youtubeId)}/hqdefault.jpg" alt="" loading="lazy" />
            <span class="play-icon">&#9658;</span>
          </button>
        </div>
        ${caption}
      </div>`;
}

function renderSoundcloudItem(item, accent) {
  if (!item.soundcloudUrl) return '';
  const caption = item.title
    ? `<div class="soundcloud-caption">${esc(item.title)}</div>`
    : '';
  const src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(item.soundcloudUrl) +
    '&color=' + encodeURIComponent(accent || '#7c5cff') +
    '&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false';
  return `
      <div>
        <div class="soundcloud-embed">
          <iframe src="${esc(src)}" loading="lazy" title="SoundCloud player${item.title ? ': ' + esc(item.title) : ''}" allow="autoplay"></iframe>
        </div>
        ${caption}
      </div>`;
}

function renderBandsintownItem(item) {
  const attrs = item.attrs || {};
  if (!attrs['artist-name'] || !attrs['app-id']) return '';
  const caption = item.title
    ? `<div class="bandsintown-caption">${esc(item.title)}</div>`
    : '';
  // Echoes back whatever attributes Bandsintown's widget-builder put in the
  // artist's own embed snippet (artist/app IDs, plus any color choices),
  // rather than us guessing which cosmetic options to hardcode.
  const attrHtml = Object.entries(attrs)
    .map(([key, value]) => `data-${key}="${esc(value)}"`)
    .join('\n            ');
  return `
      <div>
        <div class="bandsintown-embed">
          <a class="bit-widget-initializer" ${attrHtml}></a>
        </div>
        ${caption}
      </div>`;
}

const SHOW_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function renderTrackItem(item, basePath) {
  if (!item.links || !item.links.length) return '';
  const thumb = item.image ? `<img class="track-thumb" src="${esc(item.image)}" alt="" loading="lazy" />` : '';
  const pills = item.links
    .map(
      (l) =>
        `<a class="track-pill" href="${esc(basePath)}/go/${esc(l.slug)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`
    )
    .join('');
  return `
      <div class="track-card">
        <div class="track-head">
          ${thumb}
          <div class="track-text">
            <div class="track-title">${esc(item.title)}</div>
            ${item.subtitle ? `<div class="track-subtitle">${esc(item.subtitle)}</div>` : ''}
          </div>
        </div>
        <div class="track-links">${pills}</div>
      </div>`;
}

// Only today-or-later shows render, so the list never goes stale — no
// separate "past shows" UI. Uses UTC day boundaries since item.date is a
// plain "YYYY-MM-DD" with no timezone of its own.
function renderShowItem(item, basePath) {
  if (!item.date) return '';
  const d = new Date(item.date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (d < today) return '';
  const venueLine = [item.venue, item.location].filter(Boolean).join(' — ');
  const ticket =
    item.ticketUrl && item.slug
      ? `<a class="show-ticket" href="${esc(basePath)}/go/${esc(item.slug)}" target="_blank" rel="noopener noreferrer">Tickets</a>`
      : '';
  return `
      <div class="show-card">
        <div class="show-date">
          <span class="show-month">${SHOW_MONTHS[d.getUTCMonth()]}</span>
          <span class="show-day">${d.getUTCDate()}</span>
          <span class="show-year">${d.getUTCFullYear()}</span>
        </div>
        <div class="show-info">
          <div class="show-title">${esc(item.title)}</div>
          ${venueLine ? `<div class="show-venue">${esc(venueLine)}</div>` : ''}
          ${ticket}
        </div>
      </div>`;
}

function renderSections(sections, basePath, accent) {
  return sections
    .filter((s) => (s.items || []).length)
    .map((section) => {
      const items = section.items
        .map((item) => {
          if (item.type === 'video') return renderVideoItem(item);
          if (item.type === 'soundcloud') return renderSoundcloudItem(item, accent);
          if (item.type === 'bandsintown') return renderBandsintownItem(item);
          if (item.type === 'show') return renderShowItem(item, basePath);
          if (item.type === 'track') return renderTrackItem(item, basePath);
          return renderLinkItem(item, basePath);
        })
        .join('');
      const title = section.title ? `<div class="section-title">${esc(section.title)}</div>` : '';
      const itemsBlock =
        section.layout === 'carousel'
          ? `
      <div class="carousel-wrap">
        <button type="button" class="carousel-arrow carousel-prev" aria-label="Scroll left">&#8249;</button>
        <div class="items carousel">${items}</div>
        <button type="button" class="carousel-arrow carousel-next" aria-label="Scroll right">&#8250;</button>
      </div>`
          : `<div class="items">${items}</div>`;
      return `
    <div class="section">
      ${title}
      ${itemsBlock}
    </div>`;
    })
    .join('');
}

function renderSocialRow(socialLinks, basePath, socialIconStyle) {
  if (!socialLinks || !socialLinks.length) return '';
  const icons = socialLinks
    .map((s) => {
      const svg = iconSvg(s.icon);
      if (!svg) return '';
      return `<a class="social-icon" href="${esc(basePath)}/go/${esc(s.slug)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.icon)}">${svg}</a>`;
    })
    .join('');
  const rowClass = socialIconStyle === 'outline' ? 'social-row outline' : 'social-row';
  return `
    <div class="section">
      <div class="${rowClass}">${icons}</div>
    </div>`;
}

function renderAnalytics(googleAnalyticsId, googleAdsId) {
  const ids = [googleAnalyticsId, googleAdsId].filter(Boolean);
  if (!ids.length) return '';
  const loaderId = googleAnalyticsId || googleAdsId;
  const configs = ids.map((id) => `  gtag('config', '${esc(id)}');`).join('\n');
  return `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(loaderId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
${configs}
  </script>`;
}

function renderFacebookPixel(facebookPixelId) {
  if (!facebookPixelId) return '';
  const id = esc(facebookPixelId);
  return `
  <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${id}');
    fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1" alt="" /></noscript>`;
}

const CAROUSEL_SCRIPT = `
  document.querySelectorAll('.carousel-wrap').forEach(function (wrap) {
    var track = wrap.querySelector('.items.carousel');
    var prev = wrap.querySelector('.carousel-prev');
    var next = wrap.querySelector('.carousel-next');
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -320, behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: 320, behavior: 'smooth' }); });
  });
`;

const VIDEO_SCRIPT = `
  document.querySelectorAll('.video-play').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.video-embed');
      var id = wrap.getAttribute('data-yt');
      wrap.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
        '?autoplay=1" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    });
  });
`;

export function renderPage({
  name,
  bio,
  avatar,
  favicon,
  sections,
  socialLinks,
  siteUrl,
  basePath,
  canonicalUrl,
  seoTitle,
  seoDescription,
  ogTitle,
  ogDescription,
  ogImage,
  ogImageIsGenerated,
  accent,
  backgroundColor,
  sectionColor,
  contentBoxColor,
  sharpCorners,
  avatarStyle,
  theme,
  googleAnalyticsId,
  googleAdsId,
  facebookPixelId,
}) {
  // Three independently-overridable layers, each falling back to the next:
  // on-page name/bio -> SEO <title>/description -> OG/Twitter share text.
  const pageTitle = esc(seoTitle || name);
  const pageDescription = esc(seoDescription || bio);
  const title = esc(name);
  const description = esc(bio);
  const socialTitle = esc(ogTitle || seoTitle || name);
  const socialDescription = esc(ogDescription || seoDescription || bio);
  const ogImageUrl = `${siteUrl}${ogImage}`;
  // Only the auto-generated image is guaranteed to be exactly 1200x630 —
  // a custom upload could be any size, so omit the dimension hints for it
  // rather than risk lying to the crawler.
  const isGeneratedOgImage = Boolean(ogImageIsGenerated);
  const faviconHref = favicon || avatar;

  // A page's own field wins if set; otherwise the active theme's value;
  // otherwise the hardcoded fallback.
  const resolvedAccent = accent || theme?.accent || '';
  const resolvedBackgroundColor = backgroundColor || theme?.backgroundColor || '';
  const resolvedSectionColor = sectionColor || theme?.sectionColor || '';
  const resolvedContentBoxColor = contentBoxColor || theme?.contentBoxColor || '';
  const resolvedSharpCorners = resolveSharpCorners(sharpCorners, theme?.sharpCorners);
  const resolvedAvatarStyle = resolveAvatarStyle(avatarStyle, theme?.avatarStyle);
  const cardStyle = theme?.cardStyle === 'flat' ? 'flat' : 'bordered';
  const socialIconStyle = theme?.socialIconStyle === 'outline' ? 'outline' : 'filled';
  const fontFamily = FONT_STACKS[theme?.fontStack] || FONT_STACKS.poppins;

  const overrides = [];
  if (HEX_RE.test(resolvedAccent || '')) overrides.push(`--accent:${resolvedAccent};`);
  const bgPalette = contrastPalette(resolvedBackgroundColor);
  if (bgPalette) overrides.push(`--bg:${resolvedBackgroundColor};--fg:${bgPalette.fg};--muted:${bgPalette.muted};`);
  if (HEX_RE.test(resolvedSectionColor || '')) overrides.push(`--card:${resolvedSectionColor};`);
  let colorOverrideStyle = overrides.length ? `:root{${overrides.join('')}}` : '';
  if (HEX_RE.test(resolvedContentBoxColor || '')) {
    colorOverrideStyle += `.content-box{background:${resolvedContentBoxColor};padding:32px 20px 28px;border-radius:20px;border:1px solid var(--card-border);box-shadow:var(--shadow);}`;
  }
  if (cardStyle === 'flat') {
    colorOverrideStyle += `:root{--card-border:transparent;--shadow:none;}`;
  }
  if (theme?.fontStack && theme.fontStack !== 'poppins') {
    colorOverrideStyle += `body{font-family:${fontFamily};}`;
  }

  const hasVideo = (sections || []).some((s) => (s.items || []).some((i) => i.type === 'video'));
  const hasBandsintown = (sections || []).some((s) => (s.items || []).some((i) => i.type === 'bandsintown'));
  const hasCarousel = (sections || []).some((s) => s.layout === 'carousel');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}" />
  <link rel="canonical" href="${esc(canonicalUrl)}" />

  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${socialTitle}" />
  <meta property="og:description" content="${socialDescription}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:image" content="${esc(ogImageUrl)}" />
  ${isGeneratedOgImage ? '<meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />' : ''}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${socialTitle}" />
  <meta name="twitter:description" content="${socialDescription}" />
  <meta name="twitter:image" content="${esc(ogImageUrl)}" />

  <link rel="icon" href="${esc(faviconHref)}" />
  <style>${BASE_STYLES}${colorOverrideStyle}</style>
  ${renderAnalytics(googleAnalyticsId, googleAdsId)}
  ${renderFacebookPixel(facebookPixelId)}
</head>
<body${resolvedSharpCorners ? ' class="sharp-corners"' : ''}>
  <div class="page">
    <div class="content-box">
      ${
        resolvedAvatarStyle === 'hero'
          ? `<img class="avatar-hero" src="${esc(avatar)}" alt="${title}" />`
          : `<img class="avatar" src="${esc(avatar)}" alt="${title}" width="96" height="96" />`
      }
      <h1>${title}</h1>
      <p class="bio">${description}</p>
      ${renderSocialRow(socialLinks || [], basePath, socialIconStyle)}
      ${renderSections(sections || [], basePath, resolvedAccent)}
    </div>
    <footer>&copy; ${new Date().getFullYear()} ${title}</footer>
  </div>
  ${hasVideo ? `<script>${VIDEO_SCRIPT}</script>` : ''}
  ${hasCarousel ? `<script>${CAROUSEL_SCRIPT}</script>` : ''}
  ${hasBandsintown ? '<script defer src="https://widgetv3.bandsintown.com/main.min.js"></script>' : ''}
</body>
</html>`;
}

export function renderStats({ name, total, rows, backHref }) {
  const body = rows.length
    ? rows
        .map(
          (r) => `
      <tr>
        <td>${r.emoji ? esc(r.emoji) + ' ' : ''}${esc(r.title)}</td>
        <td><code>${esc(r.slug)}</code></td>
        <td class="num">${r.count}</td>
        <td>${r.last ? esc(new Date(r.last).toLocaleString()) : '—'}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="empty">No clicks recorded yet.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stats · ${esc(name)}</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    ${BASE_STYLES}
    body { align-items: flex-start; padding-top: 32px; }
    .page { max-width: 640px; align-items: stretch; }
    h1 { text-align: left; }
    .total { color: var(--muted); margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--card-border); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); }
    th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--card-border); font-size: 0.9rem; }
    th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em; }
    tr:last-child td { border-bottom: none; }
    .num { font-variant-numeric: tabular-nums; }
    .empty { text-align: center; color: var(--muted); padding: 24px; }
    code { font-size: 0.85em; color: var(--muted); }
  </style>
</head>
<body>
  <div class="page">
    <p class="total"><a href="${esc(backHref)}" style="color: var(--accent); text-decoration: none;">← Back</a></p>
    <h1>Click stats · ${esc(name)}</h1>
    <p class="total">${total} total click${total === 1 ? '' : 's'}</p>
    <table>
      <thead><tr><th>Link</th><th>Slug</th><th>Clicks</th><th>Last click</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</body>
</html>`;
}
