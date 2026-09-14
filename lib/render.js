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

  footer { margin-top: 40px; color: var(--muted); font-size: 0.78rem; text-align: center; }
  footer a { color: inherit; }
`;

function renderLinkItem(item) {
  // A "featured" item with no image has nothing to feature, so it falls
  // back to the classic stacked-link treatment instead of rendering an
  // empty/broken card.
  if (item.style === 'featured' && item.image) {
    return `
      <a class="link-featured" href="/go/${esc(item.slug)}" target="_blank" rel="noopener noreferrer">
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
      <a class="link" href="/go/${esc(item.slug)}" target="_blank" rel="noopener noreferrer">
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

function renderSections(sections) {
  return sections
    .filter((s) => (s.items || []).length)
    .map((section) => {
      const items = section.items
        .map((item) => (item.type === 'video' ? renderVideoItem(item) : renderLinkItem(item)))
        .join('');
      const title = section.title ? `<div class="section-title">${esc(section.title)}</div>` : '';
      return `
    <div class="section">
      ${title}
      <div class="items">${items}</div>
    </div>`;
    })
    .join('');
}

function renderSocialRow(socialLinks) {
  if (!socialLinks || !socialLinks.length) return '';
  const icons = socialLinks
    .map((s) => {
      const svg = iconSvg(s.icon);
      if (!svg) return '';
      return `<a class="social-icon" href="/go/${esc(s.slug)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.icon)}">${svg}</a>`;
    })
    .join('');
  return `
    <div class="section">
      <div class="social-row">${icons}</div>
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
  const isGeneratedOgImage = ogImage === '/og.png';
  const faviconHref = favicon || avatar;

  const overrides = [];
  if (HEX_RE.test(accent || '')) overrides.push(`--accent:${accent};`);
  const bgPalette = contrastPalette(backgroundColor);
  if (bgPalette) overrides.push(`--bg:${backgroundColor};--fg:${bgPalette.fg};--muted:${bgPalette.muted};`);
  if (HEX_RE.test(sectionColor || '')) overrides.push(`--card:${sectionColor};`);
  let colorOverrideStyle = overrides.length ? `:root{${overrides.join('')}}` : '';
  if (HEX_RE.test(contentBoxColor || '')) {
    colorOverrideStyle += `.content-box{background:${contentBoxColor};padding:32px 20px 28px;border-radius:20px;border:1px solid var(--card-border);box-shadow:var(--shadow);}`;
  }

  const hasVideo = (sections || []).some((s) => (s.items || []).some((i) => i.type === 'video'));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}" />
  <link rel="canonical" href="${esc(siteUrl)}/" />

  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${socialTitle}" />
  <meta property="og:description" content="${socialDescription}" />
  <meta property="og:url" content="${esc(siteUrl)}/" />
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
<body${sharpCorners ? ' class="sharp-corners"' : ''}>
  <div class="page">
    <div class="content-box">
      ${
        avatarStyle === 'hero'
          ? `<img class="avatar-hero" src="${esc(avatar)}" alt="${title}" />`
          : `<img class="avatar" src="${esc(avatar)}" alt="${title}" width="96" height="96" />`
      }
      <h1>${title}</h1>
      <p class="bio">${description}</p>
      ${renderSections(sections || [])}
      ${renderSocialRow(socialLinks || [])}
    </div>
    <footer>&copy; ${new Date().getFullYear()} ${title}</footer>
  </div>
  ${hasVideo ? `<script>${VIDEO_SCRIPT}</script>` : ''}
</body>
</html>`;
}

export function renderStats({ name, total, rows }) {
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
    <h1>Click stats</h1>
    <p class="total">${total} total click${total === 1 ? '' : 's'}</p>
    <table>
      <thead><tr><th>Link</th><th>Slug</th><th>Clicks</th><th>Last click</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</body>
</html>`;
}
