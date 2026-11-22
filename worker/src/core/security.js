/**
 * EduGlass LMS (Cloudflare Workers) — Web Crypto Security Engine
 * Uses native crypto.subtle (PBKDF2-SHA256 & HMAC-SHA256 JWT) — zero dependencies.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64Url(bytes) {
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(str) {
  const padded = str.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return fromBase64(padded);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password) {
  if (!password || password.length < 6) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2_sha256$100000$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, storedHash) {
  try {
    const parts = String(storedHash || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
    const iterations = Number(parts[1]);
    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      256
    );
    return timingSafeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

export async function createAccessToken(secret, userId, role, jti, rememberMe = false, env = {}) {
  const now = Math.floor(Date.now() / 1000);
  const hours = Number(env.EDUGLASS_JWT_EXPIRE_HOURS || 24);
  const days = Number(env.EDUGLASS_JWT_REMEMBER_DAYS || 30);
  const ttl = rememberMe ? days * 86400 : hours * 3600;
  const exp = now + ttl;

  const headerB64 = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify({ sub: userId, role, jti, iat: now, exp })));
  const signingInput = `${headerB64}.${payloadB64}`;

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(signingInput));
  return { token: `${signingInput}.${toBase64Url(new Uint8Array(sig))}`, exp };
}

export async function decodeAccessToken(secret, token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSig = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, enc.encode(signingInput)));
    const actualSig = fromBase64Url(sigB64);
    if (!timingSafeEqual(expectedSig, actualSig)) return null;
    const payload = JSON.parse(dec.decode(fromBase64Url(payloadB64)));
    if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function generateId(prefix = '') {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}_${hex}` : hex;
}

export function generateJoinCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const buckets = new Map();
export function checkRateLimit(key, maxRequests = 180, windowMs = 60000) {
  const now = Date.now();
  const list = buckets.get(key) || [];
  const fresh = list.filter((ts) => now - ts < windowMs);
  if (fresh.length >= maxRequests) {
    buckets.set(key, fresh);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - fresh[0])) / 1000)) };
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return { allowed: true, retryAfter: 0 };
}
