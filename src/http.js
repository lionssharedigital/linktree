export function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

export function jsonResponse(statusCode, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function htmlResponse(request, html, statusCode = 200, headers = {}) {
  return new Response(request.method === 'HEAD' ? null : html, {
    status: statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

export function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export function methodNotAllowed(allow) {
  return new Response('Method not allowed', { status: 405, headers: { Allow: allow } });
}

// Every state-changing endpoint goes through here. Requiring an exact JSON
// content-type blocks the classic CSRF vector (a cross-site <form> POST can
// only send urlencoded/multipart/text-plain), and the Origin check is a
// second layer on top of the SameSite=Lax session cookie.
export async function readApiBody(request, app, maxBytes) {
  if (request.method !== 'POST') throw httpError(405, 'Method not allowed');
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (contentType !== 'application/json') throw httpError(415, 'Expected application/json');
  const origin = request.headers.get('Origin');
  if (origin && origin !== app.siteUrl && origin !== new URL(request.url).origin) {
    throw httpError(403, 'Cross-origin request blocked');
  }
  if (Number(request.headers.get('Content-Length') || 0) > maxBytes) throw httpError(413, 'Request body too large');
  const text = await request.text();
  if (text.length > maxBytes) throw httpError(413, 'Request body too large');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw httpError(400, 'Invalid JSON body');
  }
}
