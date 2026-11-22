/**
 * Cloudflare Workers Route — Auth, Sessions, Profile & Appearance Preferences
 * Clean production flow: first registered user on an empty database becomes super_admin.
 */
import {
  errorResponse,
  getCurrentUser,
  getSecret,
  jsonResponse,
  parseJsonBody,
  writeAuditLog,
} from '../core/http.js';
import {
  createAccessToken,
  generateId,
  hashPassword,
  sanitizeText,
  verifyPassword,
} from '../core/security.js';

async function getPrefs(env, userId) {
  let row = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(userId).first();
  if (!row) {
    await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(userId).run();
    row = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(userId).first();
  }
  return { ...row, sound_enabled: Boolean(row.sound_enabled) };
}

export async function handleAuthRoutes(request, env, path) {
  const method = request.method;

  if (path === '/api/v1/auth/register' && method === 'POST') {
    const body = await parseJsonBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = sanitizeText(body.full_name || '');
    if (!email.includes('@') || fullName.length < 2 || password.length < 6) {
      return errorResponse('Thông tin đăng ký không hợp lệ (mật khẩu tối thiểu 6 ký tự).', 400);
    }

    const dup = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (dup) return errorResponse('Email đã được đăng ký.', 409);

    // Promote the very first registered user on a clean database to super_admin
    const userCount = (await env.DB.prepare('SELECT COUNT(*) AS cnt FROM users').first())?.cnt || 0;
    const roleName = userCount === 0
      ? 'super_admin'
      : (['teacher', 'student'].includes(body.role) ? body.role : 'student');

    const roleRow = await env.DB.prepare('SELECT id FROM roles WHERE name = ?').bind(roleName).first();
    if (!roleRow) return errorResponse('Cơ sở dữ liệu chưa chạy seed hệ thống (roles/modules).', 500);

    const userId = generateId('usr');
    const verToken = generateId('ver');
    const pwdHash = await hashPassword(password);

    await env.DB.prepare(
      `INSERT INTO users (id, school_id, role_id, role_name, email, password_hash, full_name, display_name, verification_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, body.school_id || null, roleRow.id, roleName, email, pwdHash, fullName, fullName, verToken).run();

    await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(userId).run();
    await env.DB.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').bind(userId).run();

    const jti = generateId('jti');
    const { token, exp } = await createAccessToken(getSecret(env), userId, roleName, jti, false, env);
    await env.DB.prepare(
      `INSERT INTO user_sessions (id, user_id, token_jti, user_agent, ip_address, remember_me, expires_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).bind(
      generateId('ses'),
      userId,
      jti,
      (request.headers.get('User-Agent') || '').slice(0, 240),
      request.headers.get('CF-Connecting-IP') || '',
      new Date(exp * 1000).toISOString()
    ).run();

    await writeAuditLog(env, 'auth.register', 'user', userId, userId);
    const prefs = await getPrefs(env, userId);
    return jsonResponse({
      access_token: token,
      token_type: 'bearer',
      verification_token: verToken,
      user: { id: userId, email, full_name: fullName, display_name: fullName, role_name: roleName },
      preferences: prefs,
    }, 201);
  }

  if (path === '/api/v1/auth/login' && method === 'POST') {
    const body = await parseJsonBody(request);
    const identifier = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ? OR student_code = ? OR lower(display_name) = ?'
    ).bind(identifier, identifier, identifier).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await writeAuditLog(env, 'auth.login_failed', 'user', identifier, null, 'warning');
      return errorResponse('Email hoặc mật khẩu không chính xác.', 401);
    }
    if (!user.is_active) return errorResponse('Tài khoản đã bị khóa.', 403);

    const jti = generateId('jti');
    const rememberMe = Boolean(body.remember_me);
    const { token, exp } = await createAccessToken(getSecret(env), user.id, user.role_name, jti, rememberMe, env);
    await env.DB.prepare(
      `INSERT INTO user_sessions (id, user_id, token_jti, user_agent, ip_address, remember_me, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      generateId('ses'),
      user.id,
      jti,
      (request.headers.get('User-Agent') || '').slice(0, 240),
      request.headers.get('CF-Connecting-IP') || '',
      rememberMe ? 1 : 0,
      new Date(exp * 1000).toISOString()
    ).run();

    await env.DB.prepare(`UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(user.id).run();
    await writeAuditLog(env, 'auth.login', 'user', user.id, user.id);
    const prefs = await getPrefs(env, user.id);

    return jsonResponse({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        display_name: user.display_name,
        role_name: user.role_name,
        school_id: user.school_id,
        avatar_url: user.avatar_url,
        bio: user.bio,
        email_verified: Boolean(user.email_verified),
      },
      preferences: prefs,
    });
  }

  if (path === '/api/v1/auth/forgot-password' && method === 'POST') {
    const body = await parseJsonBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (!user) return jsonResponse({ message: 'Nếu email tồn tại trong hệ thống, mã khôi phục đã được tạo.' });
    const resetToken = generateId('rst');
    const expIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await env.DB.prepare('UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?').bind(resetToken, expIso, user.id).run();
    return jsonResponse({ message: 'Đã tạo mã khôi phục mật khẩu (30 phút).', reset_token_preview: resetToken });
  }

  if (path === '/api/v1/auth/reset-password' && method === 'POST') {
    const body = await parseJsonBody(request);
    const user = await env.DB.prepare('SELECT id FROM users WHERE reset_token = ?').bind(String(body.reset_token || '')).first();
    if (!user) return errorResponse('Mã khôi phục không hợp lệ.', 400);
    const pwdHash = await hashPassword(String(body.new_password || ''));
    await env.DB.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = datetime('now') WHERE id = ?`).bind(pwdHash, user.id).run();
    await env.DB.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?').bind(user.id).run();
    return jsonResponse({ message: 'Đặt lại mật khẩu thành công.' });
  }

  const authRes = await getCurrentUser(request, env);
  if (authRes.error) return authRes.error;
  const user = authRes.user;

  if (path === '/api/v1/auth/logout' && method === 'POST') {
    await env.DB.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE token_jti = ?').bind(user.jti).run();
    return jsonResponse({ message: 'Đã đăng xuất thành công.' });
  }

  if (path === '/api/v1/auth/me' && method === 'GET') {
    return jsonResponse({ user, preferences: await getPrefs(env, user.id) });
  }

  if (path === '/api/v1/auth/change-password' && method === 'POST') {
    const body = await parseJsonBody(request);
    const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
    if (!row || !(await verifyPassword(String(body.current_password || ''), row.password_hash))) {
      return errorResponse('Mật khẩu hiện tại không đúng.', 400);
    }
    const newHash = await hashPassword(String(body.new_password || ''));
    await env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).bind(newHash, user.id).run();
    return jsonResponse({ message: 'Đã đổi mật khẩu thành công.' });
  }

  if (path === '/api/v1/auth/sessions' && method === 'GET') {
    const rows = (await env.DB.prepare(
      'SELECT id, token_jti, user_agent, ip_address, remember_me, is_revoked, expires_at, created_at FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
    ).bind(user.id).all()).results || [];
    return jsonResponse({
      sessions: rows.map((r) => ({
        ...r,
        is_current: r.token_jti === user.jti,
        remember_me: Boolean(r.remember_me),
        is_revoked: Boolean(r.is_revoked),
      })),
    });
  }

  const revokeMatch = path.match(/^\/api\/v1\/auth\/sessions\/([^/]+)$/);
  if (revokeMatch && method === 'DELETE') {
    await env.DB.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ? AND user_id = ?').bind(revokeMatch[1], user.id).run();
    return jsonResponse({ message: 'Đã thu hồi phiên đăng nhập.' });
  }

  if (path === '/api/v1/profile' && method === 'PUT') {
    const body = await parseJsonBody(request);
    await env.DB.prepare(
      `UPDATE users SET full_name = ?, display_name = ?, avatar_url = ?, bio = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(
      body.full_name ? sanitizeText(body.full_name) : user.full_name,
      body.display_name ? sanitizeText(body.display_name) : user.display_name,
      body.avatar_url !== undefined ? String(body.avatar_url) : user.avatar_url,
      body.bio !== undefined ? sanitizeText(body.bio) : user.bio,
      user.id
    ).run();
    const updated = await env.DB.prepare('SELECT id, email, full_name, display_name, role_name, avatar_url, bio FROM users WHERE id = ?').bind(user.id).first();
    return jsonResponse({ user: updated });
  }

  if (path === '/api/v1/preferences' && method === 'GET') {
    return jsonResponse({ preferences: await getPrefs(env, user.id) });
  }

  if (path === '/api/v1/preferences' && method === 'PUT') {
    const body = await parseJsonBody(request);
    const cur = await getPrefs(env, user.id);
    const themeMode = ['liquid-glass', 'classic-education'].includes(body.theme_mode) ? body.theme_mode : cur.theme_mode;
    const language = ['vi', 'en'].includes(body.language) ? body.language : cur.language;
    const accent = body.accent_color || cur.accent_color;
    const wallpaper = body.wallpaper || cur.wallpaper;
    const opacity = body.glass_opacity !== undefined ? Math.min(0.95, Math.max(0.2, Number(body.glass_opacity))) : cur.glass_opacity;
    const blur = body.glass_blur !== undefined ? Math.min(40, Math.max(0, Number(body.glass_blur))) : cur.glass_blur;
    const anim = ['full', 'reduced', 'none'].includes(body.animation_level) ? body.animation_level : cur.animation_level;
    const sound = body.sound_enabled !== undefined ? Boolean(body.sound_enabled) : cur.sound_enabled;

    await env.DB.prepare(
      `UPDATE user_preferences
       SET theme_mode = ?, language = ?, accent_color = ?, wallpaper = ?, glass_opacity = ?, glass_blur = ?, animation_level = ?, sound_enabled = ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).bind(themeMode, language, accent, wallpaper, opacity, blur, anim, sound ? 1 : 0, user.id).run();
    return jsonResponse({ preferences: await getPrefs(env, user.id) });
  }

  return null;
}
