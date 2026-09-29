import { BASE_STYLES } from './render.js';
import { ADMIN_STYLES, esc } from './adminRender.js';
import { MIN_PASSWORD_LENGTH } from './auth.js';

const DASHBOARD_STYLES = `
  .narrow { max-width: 420px; }
  input[type=email], input[type=password], select.input {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    border: 1px solid var(--card-border); background: var(--bg); color: var(--fg);
    font-size: 0.95rem; font-family: inherit;
  }
  form .save-btn { margin-top: 16px; }
  form .status { display: block; margin-top: 10px; }
  .muted { color: var(--muted); font-size: 0.85rem; }
  .page-card { border: 1px solid var(--card-border); border-radius: 12px; padding: 14px; margin-bottom: 12px; background: var(--bg); }
  .page-card h3 { margin: 0 0 2px; font-size: 1.05rem; }
  .page-card .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .page-card .actions a, .btn-link {
    border: 1px solid var(--card-border); background: var(--card); color: var(--fg);
    border-radius: 8px; padding: 6px 10px; font-size: 0.82rem; text-decoration: none; cursor: pointer;
  }
  .page-card .actions a:hover { border-color: var(--accent); }
  .page-card .actions a.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .members { margin-top: 10px; font-size: 0.85rem; }
  .members li { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .members ul { list-style: none; padding: 0; margin: 4px 0 0; }
  .inline-form { display: inline; }
  .inline-form .status { display: inline; margin-left: 6px; }
  .row-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
  .row-form input, .row-form select { flex: 1; min-width: 140px; }
  .row-form .icon-btn { flex: none; }
  .link-output { display: none; margin-top: 10px; }
  .link-output.visible { display: flex; gap: 8px; }
  .link-output input { flex: 1; font-size: 0.8rem; }
  table.list { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  table.list td, table.list th { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--card-border); vertical-align: top; }
  table.list th { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; }
  table.list tr:last-child td { border-bottom: none; }
  .badge { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); }
  .table-scroll { overflow-x: auto; }
`;

// Every <form data-api="..."> posts its fields as JSON (the server rejects
// anything else, which is the CSRF defense), then follows `redirect`,
// shows a returned `link` for copying, or reloads.
const FORM_SCRIPT = `
  document.querySelectorAll('form[data-api]').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;
      var status = form.querySelector('.status');
      var button = form.querySelector('button[type=submit]');
      function show(msg, kind) { if (status) { status.textContent = msg; status.className = 'status' + (kind ? ' ' + kind : ''); } }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      if (button) button.disabled = true;
      show('Working…', '');
      try {
        var res = await fetch(form.dataset.api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        var body = await res.json().catch(function () { return {}; });
        if (!res.ok || !body.ok) throw new Error(body.error || ('Request failed (' + res.status + ')'));
        if (body.link) {
          var out = form.querySelector('.link-output') || form.parentNode.querySelector('.link-output');
          out.querySelector('input').value = body.link;
          out.classList.add('visible');
          show(body.message || 'Link created — copy it and send it to them. It will not be shown again.', 'ok');
        } else if (body.redirect) {
          location.href = body.redirect;
        } else {
          location.reload();
        }
      } catch (err) {
        show(err.message, 'err');
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = btn.parentNode.querySelector('input');
      input.select();
      navigator.clipboard.writeText(input.value).then(function () { btn.textContent = 'Copied'; });
    });
  });
`;

function layout({ title, body, narrow }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="robots" content="noindex, nofollow" />
  <style>
    ${BASE_STYLES}
    ${ADMIN_STYLES}
    ${DASHBOARD_STYLES}
  </style>
</head>
<body>
  <div class="page admin${narrow ? ' narrow' : ''}">
    ${body}
  </div>
  <script>${FORM_SCRIPT}</script>
</body>
</html>`;
}

const linkOutput = `
  <div class="link-output">
    <input type="text" readonly />
    <button type="button" class="icon-btn" data-copy>Copy</button>
  </div>`;

function date(iso) {
  return iso ? esc(new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : '—';
}

export function renderMessage({ title, message, linkHref, linkLabel }) {
  return layout({
    title,
    narrow: true,
    body: `
    <h1>${esc(title)}</h1>
    <p class="muted">${esc(message)}</p>
    ${linkHref ? `<p><a class="btn-link" href="${esc(linkHref)}">${esc(linkLabel)}</a></p>` : ''}`,
  });
}

export function renderLogin({ next }) {
  return layout({
    title: 'Log in',
    narrow: true,
    body: `
    <h1>Log in</h1>
    <fieldset>
      <form data-api="/login">
        <input type="hidden" name="next" value="${esc(next || '')}" />
        <label for="email">Email</label>
        <input type="email" id="email" name="email" autocomplete="username" required autofocus />
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required />
        <button type="submit" class="save-btn">Log in</button>
        <span class="status"></span>
      </form>
    </fieldset>
    <p class="muted">Forgot your password? Ask your admin for a reset link.</p>`,
  });
}

// `invite` is the stored invite; `currentUser` is set if someone's already
// logged in (they can then attach the invite to their existing account).
export function renderInvite({ token, invite, pageName, currentUser }) {
  const api = `/invite/${encodeURIComponent(token)}`;

  if (invite.kind === 'reset') {
    return layout({
      title: 'Set a new password',
      narrow: true,
      body: `
    <h1>Set a new password</h1>
    <fieldset>
      <form data-api="${esc(api)}">
        <label for="password">New password</label>
        <input type="password" id="password" name="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required autofocus />
        <div class="hint">At least ${MIN_PASSWORD_LENGTH} characters.</div>
        <button type="submit" class="save-btn">Save password</button>
        <span class="status"></span>
      </form>
    </fieldset>`,
    });
  }

  const what =
    invite.role === 'admin'
      ? 'admin access to manage every page'
      : `access to edit <strong>${esc(pageName || invite.pageSlug)}</strong>`;

  if (currentUser) {
    return layout({
      title: "You're invited",
      narrow: true,
      body: `
    <h1>You're invited</h1>
    <p class="muted">This link gives ${what}.</p>
    <fieldset>
      <form data-api="${esc(api)}">
        <p style="margin: 0;">Add it to your account, <strong>${esc(currentUser.email)}</strong>?</p>
        <button type="submit" class="save-btn">Accept invite</button>
        <span class="status"></span>
      </form>
    </fieldset>
    <p class="muted">Not you? <a href="#" onclick="fetch('/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(){location.reload()});return false;">Log out</a> first.</p>`,
    });
  }

  return layout({
    title: 'Create your account',
    narrow: true,
    body: `
    <h1>Create your account</h1>
    <p class="muted">This link gives ${what}. Already have an account? <a href="/login?next=${esc(encodeURIComponent(api))}">Log in</a> first, then open this link again.</p>
    <fieldset>
      <form data-api="${esc(api)}">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" autocomplete="username" required value="${esc(invite.email)}"${invite.email ? ' readonly' : ' autofocus'} />
        <label for="password">Password</label>
        <input type="password" id="password" name="password" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required${invite.email ? ' autofocus' : ''} />
        <div class="hint">At least ${MIN_PASSWORD_LENGTH} characters.</div>
        <button type="submit" class="save-btn">Create account</button>
        <span class="status"></span>
      </form>
    </fieldset>`,
  });
}

function renderPageCard(page, { isAdmin, siteUrl }) {
  const enc = encodeURIComponent(page.slug);
  const memberList = page.members.length
    ? `<ul>${page.members
        .map(
          (m) => `<li>${esc(m.email)}${
            isAdmin
              ? ` <form class="inline-form" data-api="/admin/api/users/${esc(m.id)}/revoke" data-confirm="Remove ${esc(m.email)}'s access to /${esc(page.slug)}?">
                  <input type="hidden" name="page" value="${esc(page.slug)}" />
                  <button type="submit" class="icon-btn danger">Remove</button><span class="status"></span>
                </form>`
              : ''
          }</li>`
        )
        .join('')}</ul>`
    : `<div class="muted">No one yet${isAdmin ? ' — send an invite below.' : '.'}</div>`;

  const adminTools = isAdmin
    ? `
      <div class="members"><span class="badge">Editors</span>${memberList}</div>
      <form data-api="/admin/api/invites" class="row-form">
        <input type="hidden" name="page" value="${esc(page.slug)}" />
        <input type="email" name="email" placeholder="Artist's email (optional — locks the invite to it)" />
        <button type="submit" class="icon-btn">Create invite link</button>
        <span class="status"></span>
        ${linkOutput}
      </form>`
    : '';

  return `
    <div class="page-card">
      <h3>${esc(page.name)}</h3>
      <div class="muted"><a href="/${esc(page.slug)}" target="_blank" rel="noopener" style="color: inherit;">${esc(siteUrl.replace(/^https?:\/\//, ''))}/${esc(page.slug)}</a></div>
      <div class="actions">
        <a class="primary" href="/admin/pages/${enc}">Edit page</a>
        <a href="/admin/pages/${enc}/stats">Click stats</a>
        <a href="/${esc(page.slug)}" target="_blank" rel="noopener">View ↗</a>
      </div>
      ${adminTools}
    </div>`;
}

export function renderDashboard({ user, pages, users, invites, pageNames, siteUrl }) {
  const isAdmin = user.role === 'admin';

  const pagesBlock = pages.length
    ? pages.map((p) => renderPageCard(p, { isAdmin, siteUrl })).join('')
    : `<p class="muted">${isAdmin ? 'No pages yet — create the first one below.' : "You don't have access to any pages yet. Ask your admin for an invite link."}</p>`;

  const createPageBlock = isAdmin
    ? `
    <fieldset>
      <legend>Create a page</legend>
      <form data-api="/admin/api/pages">
        <label for="new-name">Artist / display name</label>
        <input type="text" id="new-name" name="name" maxlength="80" required />
        <label for="new-slug">Page URL</label>
        <div class="row-inline"><span class="muted">${esc(siteUrl.replace(/^https?:\/\//, ''))}/</span><input type="text" id="new-slug" name="slug" maxlength="40" pattern="[a-z0-9-]+" placeholder="artist-name" required /></div>
        <div class="hint">Lowercase letters, numbers, and hyphens. This can't be changed later.</div>
        <button type="submit" class="save-btn">Create page</button>
        <span class="status"></span>
      </form>
    </fieldset>`
    : '';

  const pageOptions = (selected) =>
    Object.entries(pageNames)
      .map(([slug, name]) => `<option value="${esc(slug)}"${slug === selected ? ' selected' : ''}>${esc(name)} (/${esc(slug)})</option>`)
      .join('');

  const usersBlock = isAdmin
    ? `
    <fieldset>
      <legend>Users</legend>
      <div class="table-scroll">
      <table class="list">
        <thead><tr><th>Email</th><th>Role</th><th>Pages</th><th></th></tr></thead>
        <tbody>
          ${users
            .map(
              (u) => `
          <tr>
            <td>${esc(u.email)}<div class="muted">since ${date(u.createdAt)}</div></td>
            <td><span class="badge">${esc(u.role)}</span></td>
            <td>${u.role === 'admin' ? '<span class="muted">all</span>' : (u.pages || []).map((p) => '/' + esc(p)).join('<br>') || '<span class="muted">none</span>'}
              ${
                u.role !== 'admin' && Object.keys(pageNames).length
                  ? `<form class="row-form" data-api="/admin/api/users/${esc(u.id)}/grant">
                      <select name="page" class="input">${pageOptions('')}</select>
                      <button type="submit" class="icon-btn">Give access</button><span class="status"></span>
                    </form>`
                  : ''
              }
            </td>
            <td>
              <form data-api="/admin/api/users/${esc(u.id)}/reset" class="inline-form">
                <button type="submit" class="icon-btn">Password reset link</button><span class="status"></span>${linkOutput}
              </form>
              ${
                u.id === user.id
                  ? ''
                  : `<form class="inline-form" data-api="/admin/api/users/${esc(u.id)}/delete" data-confirm="Delete ${esc(u.email)}? Their pages stay; they just lose their login.">
                      <button type="submit" class="icon-btn danger">Delete</button><span class="status"></span>
                    </form>`
              }
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
      </div>
      <form data-api="/admin/api/invites" class="row-form">
        <input type="hidden" name="role" value="admin" />
        <input type="email" name="email" placeholder="Email (optional)" />
        <button type="submit" class="icon-btn">Invite another admin</button>
        <span class="status"></span>
        ${linkOutput}
      </form>
    </fieldset>`
    : '';

  const invitesBlock =
    isAdmin && invites.length
      ? `
    <fieldset>
      <legend>Open invite &amp; reset links</legend>
      <div class="table-scroll">
      <table class="list">
        <thead><tr><th>For</th><th>Grants</th><th>Expires</th><th></th></tr></thead>
        <tbody>
          ${invites
            .map(
              (i) => `
          <tr>
            <td>${esc(i.email || (i.kind === 'reset' ? users.find((u) => u.id === i.userId)?.email || '' : '') || 'anyone with the link')}</td>
            <td>${i.kind === 'reset' ? 'password reset' : i.role === 'admin' ? 'admin' : '/' + esc(i.pageSlug)}</td>
            <td>${date(i.expiresAt)}</td>
            <td><form class="inline-form" data-api="/admin/api/invites/${esc(i.id)}/revoke"><button type="submit" class="icon-btn danger">Revoke</button><span class="status"></span></form></td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
      </div>
      <div class="hint">Links are shown only once, when created. If one was lost, revoke it and make a new one.</div>
    </fieldset>`
      : '';

  const archiveBlock = isAdmin && pages.length
    ? `
    <fieldset>
      <legend>Archive a page</legend>
      <form data-api="/admin/api/pages/archive" class="row-form" data-confirm="Archive this page? It goes offline immediately and everyone loses edit access. The files are kept in data/archive on the server.">
        <select name="page" class="input">${pageOptions('')}</select>
        <button type="submit" class="icon-btn danger">Archive</button>
        <span class="status"></span>
      </form>
    </fieldset>`
    : '';

  const themesBlock = isAdmin
    ? `
    <fieldset>
      <legend>Themes</legend>
      <p class="hint">Reusable style presets pages can apply.</p>
      <a class="icon-btn" href="/admin/themes">Manage themes →</a>
    </fieldset>`
    : '';

  return layout({
    title: 'Dashboard',
    body: `
    <p class="toplinks">Signed in as ${esc(user.email)}${isAdmin ? ' (admin)' : ''} ·
      <a href="#" onclick="fetch('/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(){location.href='/login'});return false;">Log out</a></p>
    <h1>${isAdmin ? 'Pages' : 'Your pages'}</h1>
    ${pagesBlock}
    ${createPageBlock}
    ${themesBlock}
    ${usersBlock}
    ${invitesBlock}
    ${archiveBlock}
    <fieldset>
      <legend>Change your password</legend>
      <form data-api="/account/password">
        <label for="cur-pw">Current password</label>
        <input type="password" id="cur-pw" name="currentPassword" autocomplete="current-password" required />
        <label for="new-pw">New password</label>
        <input type="password" id="new-pw" name="newPassword" minlength="${MIN_PASSWORD_LENGTH}" autocomplete="new-password" required />
        <button type="submit" class="save-btn">Update password</button>
        <span class="status"></span>
      </form>
    </fieldset>`,
  });
}
