import { BASE_STYLES } from './render.js';
import { SOCIAL_ICONS } from './icons.js';

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Safe to embed inside a <script> tag: escapes "<" so a malicious title
// like "</script><script>..." in links.json can't break out of the tag.
function embedJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const ADMIN_STYLES = `
  .admin { max-width: 680px; align-items: stretch; }
  h1 { text-align: left; }
  .toplinks { color: var(--muted); font-size: 0.85rem; margin: 0 0 28px; }
  .toplinks a { color: var(--accent); text-decoration: none; }
  .toplinks a:hover { text-decoration: underline; }

  fieldset { border: 1px solid var(--card-border); border-radius: 14px; padding: 18px; margin: 0 0 20px; background: var(--card); box-shadow: var(--shadow); }
  legend { padding: 0 6px; font-weight: 600; font-size: 0.9rem; color: var(--muted); }
  label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--muted); margin: 12px 0 4px; }
  label:first-of-type { margin-top: 0; }
  input[type=text], input[type=url], textarea {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    border: 1px solid var(--card-border); background: var(--bg); color: var(--fg);
    font-size: 0.95rem; font-family: inherit;
  }
  input[type=color] { width: 44px; height: 32px; padding: 0; border: 1px solid var(--card-border); border-radius: 8px; background: none; vertical-align: middle; }
  textarea { resize: vertical; min-height: 60px; }
  .row-inline { display: flex; gap: 10px; align-items: center; }
  .color-field { display: flex; gap: 8px; align-items: center; }
  .color-field input[type=text] { max-width: 120px; }
  .hint { font-size: 0.78rem; color: var(--muted); margin-top: 4px; }

  .avatar-row { display: flex; align-items: center; gap: 16px; }
  .avatar-row img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid var(--card-border); }

  .section-block { border: 1px solid var(--card-border); border-radius: 12px; padding: 14px; margin-bottom: 14px; background: var(--bg); }
  .section-header { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
  .section-header input[type=text] { flex: 1; font-weight: 600; }

  .item-card { border: 1px solid var(--card-border); border-radius: 12px; padding: 12px; margin-bottom: 10px; background: var(--card); }
  .item-type-badge { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); margin-bottom: 8px; display: block; }
  .item-card .fields { display: grid; grid-template-columns: 56px 1fr; gap: 8px 10px; }
  .item-card .fields .full { grid-column: 1 / -1; }
  .item-card .fields input { font-size: 0.9rem; }
  .emoji-input { text-align: center; }
  .thumb-row { display: flex; align-items: center; gap: 10px; grid-column: 1 / -1; }
  .thumb-row img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; border: 1px solid var(--card-border); background: var(--bg); }
  .thumb-row input[type=file] { font-size: 0.78rem; max-width: 200px; }

  .controls { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
  .icon-btn {
    border: 1px solid var(--card-border); background: var(--card); color: var(--fg);
    border-radius: 8px; padding: 6px 10px; font-size: 0.82rem; cursor: pointer;
  }
  .icon-btn:hover { border-color: var(--accent); }
  .icon-btn.danger:hover { border-color: #e5484d; color: #e5484d; }

  .add-row { display: flex; gap: 8px; margin-top: 4px; }
  .add-btn {
    flex: 1; padding: 10px; border-radius: 10px; border: 1px dashed var(--card-border);
    background: transparent; color: var(--muted); font-weight: 600; cursor: pointer; font-size: 0.85rem;
  }
  .add-btn:hover { border-color: var(--accent); color: var(--accent); }
  .add-section-btn {
    width: 100%; padding: 12px; border-radius: 12px; border: 1px dashed var(--card-border);
    background: transparent; color: var(--muted); font-weight: 600; cursor: pointer; margin-top: 4px;
  }
  .add-section-btn:hover { border-color: var(--accent); color: var(--accent); }

  .social-row-editor { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .social-row-editor .social-icon-preview {
    width: 32px; height: 32px; border-radius: 50%; flex: none;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg); border: 1px solid var(--card-border); color: var(--fg);
  }
  .social-row-editor .social-icon-preview svg { width: 16px; height: 16px; }
  .social-row-editor select {
    padding: 8px 10px; border-radius: 10px; border: 1px solid var(--card-border);
    background: var(--bg); color: var(--fg); font-size: 0.88rem; flex: none;
  }
  .social-row-editor input[type=url] { flex: 1; }

  .savebar {
    position: sticky; bottom: 16px; display: flex; align-items: center; gap: 12px;
    background: var(--card); border: 1px solid var(--card-border); border-radius: 14px;
    padding: 12px 16px; box-shadow: var(--shadow); margin-top: 8px;
  }
  .save-btn {
    background: var(--accent); color: #fff; border: none; border-radius: 10px;
    padding: 10px 20px; font-weight: 600; font-size: 0.95rem; cursor: pointer;
  }
  .save-btn:disabled { opacity: 0.6; cursor: default; }
  .status { font-size: 0.85rem; flex: 1; }
  .status.ok { color: #2f9e44; }
  .status.err { color: #e5484d; }
`;

export function renderAdmin({ name, siteUrl, data }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin · ${esc(name)}</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    ${BASE_STYLES}
    ${ADMIN_STYLES}
  </style>
</head>
<body>
  <div class="page admin">
    <h1>Edit page</h1>
    <p class="toplinks">
      <a href="/" target="_blank" rel="noopener">View live page ↗</a> ·
      <a href="/stats" target="_blank" rel="noopener">View click stats ↗</a>
    </p>

    <fieldset>
      <legend>Profile</legend>

      <label for="f-avatar">Avatar</label>
      <div class="avatar-row">
        <img id="avatar-preview" src="${esc(data.avatar)}" alt="Avatar preview" />
        <div>
          <input type="file" id="f-avatar" accept="image/png,image/jpeg,image/svg+xml,image/webp" />
          <div class="hint">PNG, JPG, SVG or WebP, up to 2&nbsp;MB.</div>
        </div>
      </div>

      <label for="f-favicon">Favicon</label>
      <div class="avatar-row">
        <img id="favicon-preview" src="${esc(data.favicon || data.avatar)}" alt="Favicon preview" style="width: 32px; height: 32px; border-radius: 6px;" />
        <div>
          <input type="file" id="f-favicon" accept="image/png,image/x-icon,image/svg+xml,image/webp,image/jpeg" />
          <div class="hint">PNG, ICO, SVG, WebP or JPG, up to 2&nbsp;MB. Falls back to the avatar if not set.</div>
        </div>
      </div>

      <label for="f-name">Name</label>
      <input type="text" id="f-name" maxlength="80" />

      <label for="f-bio">Bio</label>
      <textarea id="f-bio" maxlength="200"></textarea>
    </fieldset>

    <fieldset>
      <legend>SEO &amp; social preview</legend>
      <div class="hint" style="margin: 0 0 12px;">All optional — separate from the name/bio shown on the page itself.</div>

      <label for="f-seo-title">SEO title</label>
      <input type="text" id="f-seo-title" maxlength="70" placeholder="Defaults to Name" />
      <div class="hint">The browser tab title and Google search result title. Keep it under ~60 characters.</div>

      <label for="f-seo-desc">SEO description</label>
      <textarea id="f-seo-desc" maxlength="160" placeholder="Defaults to Bio"></textarea>
      <div class="hint">Shown as the snippet under your link in Google search results. Keep it under ~155 characters.</div>

      <label for="f-og-title">Preview title</label>
      <input type="text" id="f-og-title" maxlength="120" placeholder="Defaults to SEO title" />
      <div class="hint">How the title looks when the link is shared on iMessage, Slack, Twitter/X, Facebook, etc.</div>

      <label for="f-og-desc">Preview description</label>
      <textarea id="f-og-desc" maxlength="300" placeholder="Defaults to SEO description"></textarea>

      <label for="f-og-image">Preview image</label>
      <div class="avatar-row">
        <img id="og-image-preview" src="${esc(data.ogImage || '/og.png')}" alt="Preview image" style="width: 96px; height: 50px; border-radius: 8px; object-fit: cover;" />
        <div>
          <input type="file" id="f-og-image" accept="image/png,image/jpeg,image/webp" />
          <div class="hint">Recommended 1200&times;630. PNG, JPG or WebP, up to 2&nbsp;MB.</div>
          <button type="button" class="icon-btn" id="og-image-clear" style="margin-top: 6px;${data.ogImage ? '' : ' display: none;'}">Use auto-generated instead</button>
        </div>
      </div>
      <div class="hint">Leave unset to use the image generated automatically from your name/bio/accent color.</div>
    </fieldset>

    <fieldset>
      <legend>Appearance</legend>

      <label for="f-accent">Accent color</label>
      <div class="color-field">
        <input type="color" id="f-accent-picker" />
        <input type="text" id="f-accent" maxlength="20" />
      </div>
      <div class="hint">Used for hover states and the OG preview image.</div>

      <label for="f-bg">Page background</label>
      <div class="color-field">
        <input type="color" id="f-bg-picker" />
        <input type="text" id="f-bg" maxlength="20" placeholder="theme default" />
        <button type="button" class="icon-btn" id="f-bg-clear">Use theme default</button>
      </div>

      <label for="f-section">Section / button color</label>
      <div class="color-field">
        <input type="color" id="f-section-picker" />
        <input type="text" id="f-section" maxlength="20" placeholder="theme default" />
        <button type="button" class="icon-btn" id="f-section-clear">Use theme default</button>
      </div>

      <label for="f-box">Content box color</label>
      <div class="color-field">
        <input type="color" id="f-box-picker" />
        <input type="text" id="f-box" maxlength="20" placeholder="no box" />
        <button type="button" class="icon-btn" id="f-box-clear">No box</button>
      </div>
      <div class="hint">Wraps your avatar, bio, and links in a colored card, like Linktree's card layout. Leave blank for no box.</div>
      <div class="hint">Leave background/section/box blank to keep following the visitor's light/dark mode automatically.</div>
    </fieldset>

    <fieldset>
      <legend>Sections</legend>
      <div id="sections-list"></div>
      <button type="button" class="add-section-btn" id="add-section">+ Add section</button>
    </fieldset>

    <fieldset>
      <legend>Social icons</legend>
      <div class="hint" style="margin: 0 0 12px;">Shown as a single row of icon buttons at the bottom of the page.</div>
      <div id="social-list"></div>
      <button type="button" class="add-section-btn" id="add-social">+ Add social icon</button>
    </fieldset>

    <fieldset>
      <legend>Analytics (optional)</legend>
      <label for="f-ga">Google Analytics measurement ID</label>
      <input type="text" id="f-ga" placeholder="G-XXXXXXXXXX" maxlength="20" />

      <label for="f-ads">Google Ads / conversion ID</label>
      <input type="text" id="f-ads" placeholder="AW-XXXXXXXXX" maxlength="20" />

      <label for="f-fbpixel">Meta / Facebook Pixel ID</label>
      <input type="text" id="f-fbpixel" placeholder="123456789012345" maxlength="20" />
      <div class="hint">Leave these blank to keep the page free of third-party trackers (the default). Setting any of them loads the corresponding tracking script on every visit.</div>
    </fieldset>

    <div class="savebar">
      <span class="status" id="status"></span>
      <button type="button" class="save-btn" id="save-btn">Save changes</button>
    </div>
  </div>

  <script>
    const ICONS = ${embedJson(SOCIAL_ICONS)};
    const initial = ${embedJson(data)};
    const state = {
      name: initial.name || '',
      bio: initial.bio || '',
      accent: initial.accent || '#7c5cff',
      backgroundColor: initial.backgroundColor || '',
      sectionColor: initial.sectionColor || '',
      contentBoxColor: initial.contentBoxColor || '',
      avatar: initial.avatar || '',
      avatarUpload: null,
      favicon: initial.favicon || '',
      faviconUpload: null,
      seoTitle: initial.seoTitle || '',
      seoDescription: initial.seoDescription || '',
      ogTitle: initial.ogTitle || '',
      ogDescription: initial.ogDescription || '',
      ogImage: initial.ogImage || '',
      ogImageUpload: null,
      clearOgImage: false,
      googleAnalyticsId: initial.googleAnalyticsId || '',
      googleAdsId: initial.googleAdsId || '',
      facebookPixelId: initial.facebookPixelId || '',
      sections: (initial.sections || []).map((s) => ({
        title: s.title || '',
        items: (s.items || []).map((it) =>
          it.type === 'video'
            ? { type: 'video', title: it.title || '', youtubeId: it.youtubeId || '' }
            : {
                type: 'link', title: it.title || '', url: it.url || '', emoji: it.emoji || '',
                image: it.image || '', imageUpload: null, slug: it.slug || '',
              }
        ),
      })),
      socialLinks: (initial.socialLinks || []).map((s) => ({
        icon: s.icon || Object.keys(ICONS)[0], url: s.url || '', slug: s.slug || '',
      })),
    };

    const el = (id) => document.getElementById(id);
    const sectionsList = el('sections-list');
    const socialList = el('social-list');
    const statusEl = el('status');
    const saveBtn = el('save-btn');

    function setStatus(message, kind) {
      statusEl.textContent = message;
      statusEl.className = 'status' + (kind ? ' ' + kind : '');
    }

    function escAttr(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function iconSvg(key) {
      const icon = ICONS[key];
      if (!icon) return '';
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + icon.path + '"/></svg>';
    }

    function renderSocialList() {
      socialList.innerHTML = '';
      state.socialLinks.forEach((social, i) => {
        const row = document.createElement('div');
        row.className = 'social-row-editor';
        const options = Object.keys(ICONS)
          .map((key) => \`<option value="\${key}"\${key === social.icon ? ' selected' : ''}>\${escAttr(ICONS[key].label)}</option>\`)
          .join('');
        row.innerHTML = \`
          <span class="social-icon-preview">\${iconSvg(social.icon)}</span>
          <select data-role="icon">\${options}</select>
          <input type="url" placeholder="https://open.spotify.com/artist/..." value="\${escAttr(social.url)}" data-role="url" />
          <button type="button" class="icon-btn" data-action="up">↑</button>
          <button type="button" class="icon-btn" data-action="down">↓</button>
          <button type="button" class="icon-btn danger" data-action="remove">Remove</button>\`;

        row.querySelector('[data-role="icon"]').addEventListener('change', (e) => {
          social.icon = e.target.value;
          renderSocialList();
        });
        row.querySelector('[data-role="url"]').addEventListener('input', (e) => { social.url = e.target.value; });
        row.querySelector('[data-action="up"]').addEventListener('click', () => {
          if (i === 0) return;
          [state.socialLinks[i - 1], state.socialLinks[i]] = [state.socialLinks[i], state.socialLinks[i - 1]];
          renderSocialList();
        });
        row.querySelector('[data-action="down"]').addEventListener('click', () => {
          if (i === state.socialLinks.length - 1) return;
          [state.socialLinks[i + 1], state.socialLinks[i]] = [state.socialLinks[i], state.socialLinks[i + 1]];
          renderSocialList();
        });
        row.querySelector('[data-action="remove"]').addEventListener('click', () => {
          state.socialLinks.splice(i, 1);
          renderSocialList();
        });

        socialList.appendChild(row);
      });
    }

    function renderSections() {
      sectionsList.innerHTML = '';
      state.sections.forEach((section, si) => {
        const block = document.createElement('div');
        block.className = 'section-block';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = \`
          <input type="text" placeholder="Section title (optional)" maxlength="60" value="\${escAttr(section.title)}" />
          <button type="button" class="icon-btn" data-action="sec-up">↑</button>
          <button type="button" class="icon-btn" data-action="sec-down">↓</button>
          <button type="button" class="icon-btn danger" data-action="sec-remove">Remove section</button>\`;
        header.querySelector('input').addEventListener('input', (e) => { section.title = e.target.value; });
        header.querySelector('[data-action="sec-up"]').addEventListener('click', () => {
          if (si === 0) return;
          [state.sections[si - 1], state.sections[si]] = [state.sections[si], state.sections[si - 1]];
          renderSections();
        });
        header.querySelector('[data-action="sec-down"]').addEventListener('click', () => {
          if (si === state.sections.length - 1) return;
          [state.sections[si + 1], state.sections[si]] = [state.sections[si], state.sections[si + 1]];
          renderSections();
        });
        header.querySelector('[data-action="sec-remove"]').addEventListener('click', () => {
          state.sections.splice(si, 1);
          renderSections();
        });
        block.appendChild(header);

        section.items.forEach((item, ii) => {
          block.appendChild(renderItemCard(section, si, item, ii));
        });

        const addRow = document.createElement('div');
        addRow.className = 'add-row';
        addRow.innerHTML = \`
          <button type="button" class="add-btn" data-action="add-link">+ Add link</button>
          <button type="button" class="add-btn" data-action="add-video">+ Add YouTube video</button>\`;
        addRow.querySelector('[data-action="add-link"]').addEventListener('click', () => {
          section.items.push({ type: 'link', title: '', url: '', emoji: '', image: '', imageUpload: null, slug: '' });
          renderSections();
        });
        addRow.querySelector('[data-action="add-video"]').addEventListener('click', () => {
          section.items.push({ type: 'video', title: '', youtubeId: '' });
          renderSections();
        });
        block.appendChild(addRow);

        sectionsList.appendChild(block);
      });
    }

    function renderItemCard(section, si, item, ii) {
      const card = document.createElement('div');
      card.className = 'item-card';

      if (item.type === 'video') {
        card.innerHTML = \`
          <span class="item-type-badge">▶ Video</span>
          <div class="fields">
            <input type="text" class="full" placeholder="Caption (optional)" maxlength="80" value="\${escAttr(item.title)}" data-field="title" />
            <input type="text" class="full" placeholder="YouTube URL or video ID" value="\${escAttr(item.youtubeId)}" data-field="youtubeId" />
          </div>
          <div class="controls">
            <button type="button" class="icon-btn" data-action="up">↑</button>
            <button type="button" class="icon-btn" data-action="down">↓</button>
            <button type="button" class="icon-btn danger" data-action="remove">Remove</button>
          </div>\`;
      } else {
        const preview = item.imageUpload ? item.imageUpload.dataUrl : item.image;
        card.innerHTML = \`
          <span class="item-type-badge">🔗 Link</span>
          <div class="fields">
            <input type="text" class="emoji-input" placeholder="🔗" maxlength="8" value="\${escAttr(item.emoji)}" data-field="emoji" />
            <input type="text" placeholder="Link title" maxlength="80" value="\${escAttr(item.title)}" data-field="title" />
            <div class="thumb-row">
              \${preview ? \`<img src="\${escAttr(preview)}" alt="" />\` : ''}
              <input type="file" accept="image/png,image/jpeg,image/webp" data-role="image-input" />
              \${preview ? '<button type="button" class="icon-btn" data-action="remove-image">Remove image</button>' : ''}
            </div>
            <input type="url" class="full" placeholder="https://example.com" value="\${escAttr(item.url)}" data-field="url" />
            <input type="text" class="full" placeholder="slug (optional, auto from title — keep stable to preserve click history)" maxlength="60" value="\${escAttr(item.slug)}" data-field="slug" />
          </div>
          <div class="controls">
            <button type="button" class="icon-btn" data-action="up">↑</button>
            <button type="button" class="icon-btn" data-action="down">↓</button>
            <button type="button" class="icon-btn danger" data-action="remove">Remove</button>
          </div>\`;

        const fileInput = card.querySelector('[data-role="image-input"]');
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            setStatus('Image must be under 2 MB.', 'err');
            e.target.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            item.imageUpload = { filename: file.name, dataUrl: reader.result };
            item.image = '';
            renderSections();
          };
          reader.readAsDataURL(file);
        });
        const removeImageBtn = card.querySelector('[data-action="remove-image"]');
        if (removeImageBtn) {
          removeImageBtn.addEventListener('click', () => {
            item.image = '';
            item.imageUpload = null;
            renderSections();
          });
        }
      }

      card.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('input', () => { item[input.dataset.field] = input.value; });
      });
      card.querySelector('[data-action="up"]').addEventListener('click', () => {
        if (ii === 0) return;
        [section.items[ii - 1], section.items[ii]] = [section.items[ii], section.items[ii - 1]];
        renderSections();
      });
      card.querySelector('[data-action="down"]').addEventListener('click', () => {
        if (ii === section.items.length - 1) return;
        [section.items[ii + 1], section.items[ii]] = [section.items[ii], section.items[ii + 1]];
        renderSections();
      });
      card.querySelector('[data-action="remove"]').addEventListener('click', () => {
        section.items.splice(ii, 1);
        renderSections();
      });

      return card;
    }

    el('f-name').value = state.name;
    el('f-bio').value = state.bio;
    el('f-seo-title').value = state.seoTitle;
    el('f-seo-desc').value = state.seoDescription;
    el('f-og-title').value = state.ogTitle;
    el('f-og-desc').value = state.ogDescription;
    el('f-accent').value = state.accent;
    el('f-accent-picker').value = /^#[0-9a-fA-F]{6}$/.test(state.accent) ? state.accent : '#7c5cff';
    el('f-bg').value = state.backgroundColor;
    el('f-bg-picker').value = /^#[0-9a-fA-F]{6}$/.test(state.backgroundColor) ? state.backgroundColor : '#121214';
    el('f-section').value = state.sectionColor;
    el('f-section-picker').value = /^#[0-9a-fA-F]{6}$/.test(state.sectionColor) ? state.sectionColor : '#1c1c1f';
    el('f-box').value = state.contentBoxColor;
    el('f-box-picker').value = /^#[0-9a-fA-F]{6}$/.test(state.contentBoxColor) ? state.contentBoxColor : '#1c1c1f';
    el('f-ga').value = state.googleAnalyticsId;
    el('f-ads').value = state.googleAdsId;
    el('f-fbpixel').value = state.facebookPixelId;

    el('f-name').addEventListener('input', (e) => { state.name = e.target.value; });
    el('f-bio').addEventListener('input', (e) => { state.bio = e.target.value; });
    el('f-seo-title').addEventListener('input', (e) => { state.seoTitle = e.target.value; });
    el('f-seo-desc').addEventListener('input', (e) => { state.seoDescription = e.target.value; });
    el('f-og-title').addEventListener('input', (e) => { state.ogTitle = e.target.value; });
    el('f-og-desc').addEventListener('input', (e) => { state.ogDescription = e.target.value; });
    el('f-ga').addEventListener('input', (e) => { state.googleAnalyticsId = e.target.value.trim(); });
    el('f-ads').addEventListener('input', (e) => { state.googleAdsId = e.target.value.trim(); });
    el('f-fbpixel').addEventListener('input', (e) => { state.facebookPixelId = e.target.value.trim(); });

    function wireColor(textId, pickerId, clearId, key) {
      el(textId).addEventListener('input', (e) => {
        state[key] = e.target.value;
        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) el(pickerId).value = e.target.value;
      });
      el(pickerId).addEventListener('input', (e) => {
        state[key] = e.target.value;
        el(textId).value = e.target.value;
      });
      if (clearId) {
        el(clearId).addEventListener('click', () => {
          state[key] = '';
          el(textId).value = '';
        });
      }
    }
    wireColor('f-accent', 'f-accent-picker', null, 'accent');
    wireColor('f-bg', 'f-bg-picker', 'f-bg-clear', 'backgroundColor');
    wireColor('f-section', 'f-section-picker', 'f-section-clear', 'sectionColor');
    wireColor('f-box', 'f-box-picker', 'f-box-clear', 'contentBoxColor');

    function wireImageUpload(inputId, previewId, maxLabel, stateKey) {
      el(inputId).addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          setStatus(maxLabel + ' must be under 2 MB.', 'err');
          e.target.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          state[stateKey] = { filename: file.name, dataUrl: reader.result };
          el(previewId).src = reader.result;
          setStatus('New ' + maxLabel.toLowerCase() + ' ready — click Save to publish it.', '');
        };
        reader.readAsDataURL(file);
      });
    }
    wireImageUpload('f-avatar', 'avatar-preview', 'Avatar', 'avatarUpload');
    wireImageUpload('f-favicon', 'favicon-preview', 'Favicon', 'faviconUpload');

    el('f-og-image').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setStatus('Preview image must be under 2 MB.', 'err');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        state.ogImageUpload = { filename: file.name, dataUrl: reader.result };
        state.clearOgImage = false;
        el('og-image-preview').src = reader.result;
        el('og-image-clear').style.display = '';
        setStatus('New preview image ready — click Save to publish it.', '');
      };
      reader.readAsDataURL(file);
    });

    el('og-image-clear').addEventListener('click', () => {
      state.ogImage = '';
      state.ogImageUpload = null;
      state.clearOgImage = true;
      el('f-og-image').value = '';
      el('og-image-preview').src = '/og.png';
      el('og-image-clear').style.display = 'none';
      setStatus('Will use the auto-generated preview image — click Save.', '');
    });

    el('add-section').addEventListener('click', () => {
      state.sections.push({ title: '', items: [] });
      renderSections();
    });

    el('add-social').addEventListener('click', () => {
      state.socialLinks.push({ icon: Object.keys(ICONS)[0], url: '', slug: '' });
      renderSocialList();
    });

    el('save-btn').addEventListener('click', async () => {
      setStatus('Saving…', '');
      saveBtn.disabled = true;
      try {
        if (!state.name.trim()) throw new Error('Name is required.');
        for (const section of state.sections) {
          for (const item of section.items) {
            if (item.type === 'link') {
              if (!item.title.trim()) throw new Error('Every link needs a title.');
              try { new URL(item.url); } catch { throw new Error('"' + item.title + '" has an invalid URL.'); }
            } else if (item.type === 'video') {
              if (!item.youtubeId.trim()) throw new Error('Every video needs a YouTube URL or ID.');
            }
          }
        }
        for (const social of state.socialLinks) {
          try { new URL(social.url); } catch { throw new Error(ICONS[social.icon].label + ' link has an invalid URL.'); }
        }
        const res = await fetch('/admin/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || ('Save failed (' + res.status + ')'));

        state.avatar = body.avatar || state.avatar;
        state.avatarUpload = null;
        el('avatar-preview').src = state.avatar;
        state.favicon = body.favicon || state.favicon;
        state.faviconUpload = null;
        el('favicon-preview').src = state.favicon || state.avatar;
        state.ogImage = body.ogImage !== undefined ? body.ogImage : state.ogImage;
        state.ogImageUpload = null;
        state.clearOgImage = false;
        el('og-image-preview').src = state.ogImage || ('/og.png?t=' + Date.now());
        el('og-image-clear').style.display = state.ogImage ? '' : 'none';
        if (body.images) {
          for (const section of state.sections) {
            for (const item of section.items) {
              if (item.type === 'link' && item.imageUpload && body.images[item.slug]) {
                item.image = body.images[item.slug];
                item.imageUpload = null;
              }
            }
          }
          renderSections();
        }
        setStatus(
          body.ogRegenerated
            ? 'Saved. Preview image updated.'
            : 'Saved. (Preview image not regenerated — run "npm run og" on the server.)',
          'ok'
        );
      } catch (err) {
        setStatus(err.message || 'Save failed.', 'err');
      } finally {
        saveBtn.disabled = false;
      }
    });

    renderSections();
    renderSocialList();
  </script>
</body>
</html>`;
}
