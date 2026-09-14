// Builds the 1200x630 OG image SVG and rasterizes it to PNG via `sharp`.
// Used both by the `npm run og` CLI script and by the admin panel, which
// regenerates the image automatically whenever name/bio/accent change.
function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Simple manual word-wrap for the bio line since SVG has no text reflow.
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, 2);
}

export function buildOgSvg({ name, bio, accent }) {
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accent || '') ? accent : '#7c5cff';
  const initials = (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const bioLines = wrap(bio || '', 48);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121214" />
      <stop offset="100%" stop-color="#1c1c24" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <circle cx="600" cy="220" r="90" fill="${safeAccent}" />
  <text x="600" y="245" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(initials)}</text>
  <text x="600" y="370" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="52" font-weight="700" fill="#f2f1ef" text-anchor="middle">${esc(name)}</text>
  ${bioLines
    .map(
      (line, i) =>
        `<text x="600" y="${420 + i * 38}" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="28" fill="#a3a1a0" text-anchor="middle">${esc(line)}</text>`
    )
    .join('\n  ')}
</svg>`;
}

// Returns a PNG Buffer, or throws if `sharp` isn't installed. Callers that
// want graceful degradation (e.g. the admin panel) should catch and warn
// rather than fail the whole save.
export async function buildOgPng(data) {
  const { default: sharp } = await import('sharp');
  const svg = buildOgSvg(data);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
