/**
 * EduGlass LMS (Cloudflare Workers) — HTTP Helpers, Auth/RBAC Guards & D1 Utilities
 */
import { decodeAccessToken, generateId } from './security.js';

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

export function errorResponse(detail, status = 400) {
  return jsonResponse({ detail }, status);
}

export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function getSecret(env) {
  const secret = env && env.EDUGLASS_SECRET_KEY;
  if (!secret || secret.length < 16) {
    throw new Error('EDUGLASS_SECRET_KEY chưa được thiết lập (hãy chạy wrangler secret put EDUGLASS_SECRET_KEY hoặc tạo .dev.vars).');
  }
  return secret;
}

export async function getCurrentUser(request, env) {
  const url = new URL(request.url);
  const auth = request.headers.get('Authorization') || '';
  let token = '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    token = auth.slice(7).trim();
  } else if (url.searchParams.get('token')) {
    token = url.searchParams.get('token');
  }
  if (!token) {
    return { error: errorResponse('Yêu cầu đăng nhập để truy cập tài nguyên này.', 401) };
  }

  let secret;
  try {
    secret = getSecret(env);
  } catch (err) {
    return { error: errorResponse(err.message, 500) };
  }

  const payload = await decodeAccessToken(secret, token);
  if (!payload) {
    return { error: errorResponse('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 401) };
  }

  const session = await env.DB.prepare(
    'SELECT * FROM user_sessions WHERE token_jti = ? AND is_revoked = 0'
  ).bind(payload.jti).first();
  if (!session) {
    return { error: errorResponse('Phiên đăng nhập đã bị thu hồi.', 401) };
  }

  const user = await env.DB.prepare(
    `SELECT id, school_id, role_id, role_name, email, full_name, display_name,
            avatar_url, bio, email_verified, is_active, last_login_at, created_at
     FROM users WHERE id = ?`
  ).bind(payload.sub).first();

  if (!user || !user.is_active) {
    return { error: errorResponse('Tài khoản không tồn tại hoặc đã bị khóa.', 403) };
  }

  return { user: { ...user, jti: payload.jti, email_verified: Boolean(user.email_verified) } };
}

export function requireRoles(user, roles) {
  if (!roles.includes(user.role_name)) {
    return errorResponse('Bạn không có quyền thực hiện thao tác này.', 403);
  }
  return null;
}

export async function checkModuleEnabled(env, moduleId) {
  const row = await env.DB.prepare(
    'SELECT is_enabled, name FROM module_registry WHERE id = ?'
  ).bind(moduleId).first();
  if (row && !row.is_enabled) {
    return errorResponse(`Module '${row.name}' hiện đang bị tắt bởi quản trị viên.`, 503);
  }
  return null;
}

export async function writeAuditLog(env, action, resourceType, resourceId = '', userId = null, severity = 'info', details = {}, ipAddress = '') {
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, severity, details_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    generateId('aud'),
    userId,
    action,
    resourceType,
    resourceId,
    severity,
    JSON.stringify(details || {}),
    ipAddress
  ).run();
}

export async function createNotification(env, userId, eventType, title, message, linkUrl = '') {
  const pref = await env.DB.prepare(
    'SELECT * FROM notification_preferences WHERE user_id = ?'
  ).bind(userId).first();
  if (pref && eventType in pref && !pref[eventType]) return;
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, event_type, title, message, link_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(generateId('ntf'), userId, eventType, title, message, linkUrl).run();
}
