import { BASE_STYLES } from './render.js';
import { esc, embedJson, ADMIN_STYLES } from './adminRender.js';

const THEME_STYLES = `
  .theme-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
  .theme-card {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    border: 1px solid var(--card-border); border-radius: 12px; background: var(--bg);
  }
  .theme-card .swatches { display: flex; gap: 4px; flex: none; }
  .theme-card .swatch { width: 20px; height: 20px; border-radius: 6px; border: 1px solid var(--card-border); }
  .theme-card .name { flex: 1; font-weight: 600; }
  .theme-card .actions { display: flex; gap: 6px; }

  .theme-editor-grid { display: grid; grid-template-columns: 1fr 260px; gap: 24px; align-items: start; }
  @media (max-width: 720px) { .theme-editor-grid { grid-template-columns: 1fr; } }

  .preview-frame {
    border: 1px solid var(--card-border); border-radius: 16px; overflow: hidden;
    position: sticky; top: 16px; background: #fff;
  }
  .preview-frame iframe { display: block; width: 100%; height: 480px; border: 0; }
`;

// A tiny, self-contained mock page rendered inside an <iframe> so the live
// preview gets its own document (and BASE_STYLES' :root variables don't leak
// into / get overridden by the parent admin page's own styles). The parent
// script postMessages the current field values in; this listens and rewrites
// its own <style> override, mirroring exactly what render.js's renderPage
// does server-side for the real page (see resolveSharpCorners/FONT_STACKS/
// cardStyle handling there — keep this in sync if that logic changes).
function previewDoc() {
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
${BASE_STYLES}
body { padding: 24px 16px; }
.page { max-width: 100%; }
</style>
<style id="override"></style>
</head>
<body>
  <div class="page">
    <div class="content-box">
      <img class="avatar" width="72" height="72" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='72' height='72' fill='%23888'/%3E%3C/svg%3E" alt="" />
      <h1>Preview Artist</h1>
      <p class="bio">This is what your bio looks like.</p>
      <div class="section">
        <div class="social-row" id="preview-social">
          <a class="social-icon" href="#" onclick="return false"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg></a>
          <a class="social-icon" href="#" onclick="return false"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg></a>
        </div>
      </div>
      <div class="section">
        <div class="items">
          <a class="link" href="#" onclick="return false"><span class="emoji">🔗</span><span class="title">A featured link</span></a>
          <a class="link" href="#" onclick="return false"><span class="emoji">🎵</span><span class="title">Another link</span></a>
        </div>
      </div>
    </div>
  </div>
  <script>
    function px(hex) { return /^#[0-9a-fA-F]{3,8}$/.test(hex || '') ? hex : null; }
    function luminanceFg(hex) {
      var c = hex.replace('#', '');
      var full = c.length === 3 ? c.split('').map(function (ch) { return ch + ch; }).join('') : c.slice(0, 6).padEnd(6, '0');
      var r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
      var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum > 0.6 ? { fg: '#141414', muted: '#5c5a57' } : { fg: '#f5f4f2', muted: '#a3a1a0' };
    }
    var FONT_STACKS = {
      poppins: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      mono: '"SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    };
    window.addEventListener('message', function (e) {
      var cfg = e.data || {};
      var overrides = [];
      if (px(cfg.accent)) overrides.push('--accent:' + cfg.accent + ';');
      if (px(cfg.backgroundColor)) {
        var pal = luminanceFg(cfg.backgroundColor);
        overrides.push('--bg:' + cfg.backgroundColor + ';--fg:' + pal.fg + ';--muted:' + pal.muted + ';');
      }
      if (px(cfg.sectionColor)) overrides.push('--card:' + cfg.sectionColor + ';');
      var css = overrides.length ? ':root{' + overrides.join('') + '}' : '';
      if (px(cfg.contentBoxColor)) {
        css += '.content-box{background:' + cfg.contentBoxColor + ';padding:24px 16px 20px;border-radius:20px;border:1px solid var(--card-border);box-shadow:var(--shadow);}';
      }
      if (cfg.cardStyle === 'flat') css += ':root{--card-border:transparent;--shadow:none;}';
      css += 'body.sharp-corners .link,body.sharp-corners .link .thumb{border-radius:0;}';
      css += 'body{font-family:' + (FONT_STACKS[cfg.fontStack] || FONT_STACKS.poppins) + ';}';
      document.getElementById('override').textContent = css;
      document.body.className = cfg.sharpCorners === 'true' ? 'sharp-corners' : '';
      document.getElementById('preview-social').className = cfg.socialIconStyle === 'outline' ? 'social-row outline' : 'social-row';
    });
  </script>
</body></html>`;
}

export function renderThemes({ themes, dashboardUrl }) {
  const listHtml = themes.length
    ? themes
        .map(
          (t) => `
        <div class="theme-card">
          <div class="swatches">
            <span class="swatch" style="background:${esc(t.config.accent || '#7c5cff')}"></span>
            <span class="swatch" style="background:${esc(t.config.backgroundColor || '#f6f5f3')}"></span>
            <span class="swatch" style="background:${esc(t.config.sectionColor || '#ffffff')}"></span>
          </div>
          <span class="name">${esc(t.name)}</span>
          <div class="actions">
            <button type="button" class="icon-btn" data-action="edit" data-id="${esc(t.id)}">Edit</button>
            <button type="button" class="icon-btn danger" data-action="delete" data-id="${esc(t.id)}">Delete</button>
          </div>
        </div>`
        )
        .join('')
    : `<p class="hint">No themes yet — create the first one below.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Themes</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    ${BASE_STYLES}
    ${ADMIN_STYLES}
    ${THEME_STYLES}
  </style>
</head>
<body>
  <div class="page admin">
    <p class="toplinks"><a href="${esc(dashboardUrl)}">← Dashboard</a></p>
    <h1>Themes</h1>
    <p class="toplinks">Reusable style presets. A page can select one in its editor's Appearance section; any color/style field the page leaves blank falls back to the theme.</p>

    <fieldset>
      <legend>Existing themes</legend>
      <div class="theme-list" id="theme-list">${listHtml}</div>
      <button type="button" class="add-section-btn" id="new-theme-btn">+ New theme</button>
    </fieldset>

    <fieldset id="editor" style="display:none;">
      <legend id="editor-legend">New theme</legend>
      <div class="theme-editor-grid">
        <div>
          <label for="f-name">Theme name</label>
          <input type="text" id="f-name" maxlength="60" placeholder="e.g. Dark &amp; Minimal" />

          <label for="f-accent">Accent color</label>
          <div class="color-field">
            <input type="color" id="f-accent-picker" />
            <input type="text" id="f-accent" maxlength="20" />
          </div>

          <label for="f-bg">Page background</label>
          <div class="color-field">
            <input type="color" id="f-bg-picker" />
            <input type="text" id="f-bg" maxlength="20" />
          </div>

          <label for="f-section">Section / button color</label>
          <div class="color-field">
            <input type="color" id="f-section-picker" />
            <input type="text" id="f-section" maxlength="20" />
          </div>

          <label for="f-box">Content box color</label>
          <div class="color-field">
            <input type="color" id="f-box-picker" />
            <input type="text" id="f-box" maxlength="20" placeholder="no box" />
            <button type="button" class="icon-btn" id="f-box-clear">No box</button>
          </div>

          <label for="f-avatar-style">Avatar style</label>
          <select id="f-avatar-style">
            <option value="circle">Circle</option>
            <option value="hero">Hero — large image fading into the background</option>
          </select>

          <label for="f-sharp-corners">Corners</label>
          <select id="f-sharp-corners">
            <option value="false">Rounded</option>
            <option value="true">Sharp (no rounding on link buttons)</option>
          </select>

          <label for="f-card-style">Card style</label>
          <select id="f-card-style">
            <option value="bordered">Bordered (default — border + shadow on cards)</option>
            <option value="flat">Flat / minimal (no border or shadow)</option>
          </select>

          <label for="f-social-style">Social icon style</label>
          <select id="f-social-style">
            <option value="filled">Filled circles (default)</option>
            <option value="outline">Outline / ghost icons</option>
          </select>

          <label for="f-font-stack">Font</label>
          <select id="f-font-stack">
            <option value="poppins">Poppins (default)</option>
            <option value="system">System sans</option>
            <option value="mono">Monospace</option>
          </select>

          <div class="savebar" style="margin-top: 18px;">
            <button type="button" class="save-btn" id="save-theme-btn">Save theme</button>
            <button type="button" class="icon-btn" id="cancel-edit-btn">Cancel</button>
            <span class="status" id="status"></span>
          </div>
        </div>
        <div class="preview-frame">
          <iframe id="preview-iframe" title="Live preview"></iframe>
        </div>
      </div>
    </fieldset>
  </div>

  <script>
    const THEMES = ${embedJson(themes)};
    const el = (id) => document.getElementById(id);
    const iframe = el('preview-iframe');
    let editingId = null;

    iframe.srcdoc = ${embedJson(previewDoc())};

    function currentConfig() {
      return {
        accent: el('f-accent').value.trim(),
        backgroundColor: el('f-bg').value.trim(),
        sectionColor: el('f-section').value.trim(),
        contentBoxColor: el('f-box').value.trim(),
        avatarStyle: el('f-avatar-style').value,
        sharpCorners: el('f-sharp-corners').value,
        cardStyle: el('f-card-style').value,
        socialIconStyle: el('f-social-style').value,
        fontStack: el('f-font-stack').value,
      };
    }

    function sendPreview() {
      iframe.contentWindow && iframe.contentWindow.postMessage(currentConfig(), '*');
    }
    iframe.addEventListener('load', sendPreview);

    function wireColor(textId, pickerId, clearId) {
      el(textId).addEventListener('input', (e) => {
        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) el(pickerId).value = e.target.value;
        sendPreview();
      });
      el(pickerId).addEventListener('input', (e) => {
        el(textId).value = e.target.value;
        sendPreview();
      });
      if (clearId) el(clearId).addEventListener('click', () => { el(textId).value = ''; sendPreview(); });
    }
    wireColor('f-accent', 'f-accent-picker', null);
    wireColor('f-bg', 'f-bg-picker', null);
    wireColor('f-section', 'f-section-picker', null);
    wireColor('f-box', 'f-box-picker', 'f-box-clear');
    ['f-avatar-style', 'f-sharp-corners', 'f-card-style', 'f-social-style', 'f-font-stack'].forEach((id) => {
      el(id).addEventListener('change', sendPreview);
    });

    function setStatus(message, kind) {
      el('status').textContent = message;
      el('status').className = 'status' + (kind ? ' ' + kind : '');
    }

    function openEditor(theme) {
      editingId = theme ? theme.id : null;
      el('editor-legend').textContent = theme ? 'Edit theme' : 'New theme';
      el('f-name').value = theme ? theme.name : '';
      const cfg = theme ? theme.config : {};
      el('f-accent').value = cfg.accent || '#7c5cff';
      el('f-accent-picker').value = /^#[0-9a-fA-F]{6}$/.test(cfg.accent || '') ? cfg.accent : '#7c5cff';
      el('f-bg').value = cfg.backgroundColor || '#f6f5f3';
      el('f-bg-picker').value = /^#[0-9a-fA-F]{6}$/.test(cfg.backgroundColor || '') ? cfg.backgroundColor : '#f6f5f3';
      el('f-section').value = cfg.sectionColor || '#ffffff';
      el('f-section-picker').value = /^#[0-9a-fA-F]{6}$/.test(cfg.sectionColor || '') ? cfg.sectionColor : '#ffffff';
      el('f-box').value = cfg.contentBoxColor || '';
      el('f-box-picker').value = /^#[0-9a-fA-F]{6}$/.test(cfg.contentBoxColor || '') ? cfg.contentBoxColor : '#ffffff';
      el('f-avatar-style').value = cfg.avatarStyle === 'hero' ? 'hero' : 'circle';
      el('f-sharp-corners').value = cfg.sharpCorners === 'true' ? 'true' : 'false';
      el('f-card-style').value = cfg.cardStyle === 'flat' ? 'flat' : 'bordered';
      el('f-social-style').value = cfg.socialIconStyle === 'outline' ? 'outline' : 'filled';
      el('f-font-stack').value = cfg.fontStack || 'poppins';
      el('editor').style.display = '';
      setStatus('', '');
      sendPreview();
      el('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    el('new-theme-btn').addEventListener('click', () => openEditor(null));
    el('cancel-edit-btn').addEventListener('click', () => { el('editor').style.display = 'none'; });

    el('theme-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') {
        openEditor(THEMES.find((t) => t.id === id));
      } else if (btn.dataset.action === 'delete') {
        if (!confirm('Delete this theme? Pages using it will fall back to their own colors.')) return;
        const res = await fetch('/admin/api/themes/' + id + '/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) { alert(body.error || 'Delete failed'); return; }
        location.reload();
      }
    });

    el('save-theme-btn').addEventListener('click', async () => {
      const name = el('f-name').value.trim();
      if (!name) { setStatus('Theme name is required.', 'err'); return; }
      setStatus('Saving…', '');
      el('save-theme-btn').disabled = true;
      try {
        const url = editingId ? '/admin/api/themes/' + editingId : '/admin/api/themes';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, ...currentConfig() }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || 'Save failed');
        location.reload();
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        el('save-theme-btn').disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
