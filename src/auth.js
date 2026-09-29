// Password hashing, session cookies, and token helpers, all on Web Crypto
// (built into Workers — no dependencies).

export const MIN_PASSWORD_LENGTH = 10;
// Workers cap PBKDF2 at 100k iterations. Each login/password check costs
// roughly this much CPU, which is why the Workers Paid plan is recommended.
const PBKDF2_ITERATIONS = 100_000;
const SESSION_COOKIE = 'sid';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

export function toBase64Url(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomToken(byteLength = 24) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(str)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- Passwords -----------------------------------------------------------

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, saltB64, hashB64] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2-sha256' || !saltB64 || !hashB64) {
    // Unknown email: still do the same work, so response timing doesn't
    // reveal which emails have accounts.
    await pbkdf2(String(password), new Uint8Array(16), PBKDF2_ITERATIONS);
    return false;
  }
  const expected = fromBase64Url(hashB64);
  const actual = await pbkdf2(String(password), fromBase64Url(saltB64), Number(iterations));
  return actual.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(actual, expected);
}

export function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw Object.assign(new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`), {
      statusCode: 400,
    });
  }
  if (password.length > 200) {
    throw Object.assign(new Error('Password is too long'), { statusCode: 400 });
  }
}

// ---- Session cookies -----------------------------------------------------
// Stateless signed cookie: "<userId>.<expiresMs>.<sessionVersion>.<hmac>".
// Bumping a user's session_version (password change/reset) invalidates
// every cookie issued before it.

const keyCache = new Map();
function hmacKey(secret) {
  if (!keyCache.has(secret)) {
    keyCache.set(
      secret,
      crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    );
  }
  return keyCache.get(secret);
}

function cookieAttrs(maxAgeSeconds, secure) {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export async function sessionCookie(app, user) {
  const payload = `${user.id}.${Date.now() + SESSION_TTL_SECONDS * 1000}.${user.sessionVersion || 0}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(app.secret), encoder.encode(payload));
  return `${SESSION_COOKIE}=${payload}.${toBase64Url(sig)}; ${cookieAttrs(SESSION_TTL_SECONDS, app.secure)}`;
}

export function clearSessionCookie(app) {
  return `${SESSION_COOKIE}=; ${cookieAttrs(0, app.secure)}`;
}

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return '';
}

// Returns { userId, sessionVersion } for a valid, unexpired cookie, else null.
// The caller still has to load the user and compare sessionVersion.
export async function readSession(app, request) {
  const parts = readCookie(request, SESSION_COOKIE).split('.');
  if (parts.length !== 4) return null;
  const [userId, exp, version, sig] = parts;
  let sigBytes;
  try {
    sigBytes = fromBase64Url(sig);
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(app.secret), sigBytes, encoder.encode(`${userId}.${exp}.${version}`));
  if (!ok || !(Number(exp) > Date.now())) return null;
  return { userId, sessionVersion: Number(version) };
}
