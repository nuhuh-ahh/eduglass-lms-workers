/**
 * Cloudflare Workers Route — Notifications, Calendar, Module Manager & Super Admin
 */
import {
  checkModuleEnabled,
  errorResponse,
  getCurrentUser,
  jsonResponse,
  parseJsonBody,
  requireRoles,
  writeAuditLog,
} from '../core/http.js';
import { generateId, hashPassword, sanitizeText } from '../core/security.js';
import { listModules, toggleModule } from '../services/module_manager.js';

export async function handleMiscAdminRoutes(request, env, path) {
  if (!path.startsWith('/api/v1/notifications') && !path.startsWith('/api/v1/calendar') && !path.startsWith('/api/v1/admin')) {
    return null;
  }

  const authRes = await getCurrentUser(request, env);
  if (authRes.error) return authRes.error;
  const user = authRes.user;
  const method = request.method;

  // ── Notifications ──
  if (path.startsWith('/api/v1/notifications')) {
    const modErr = await checkModuleEnabled(env, 'notification');
    if (modErr) return modErr;

    if (path === '/api/v1/notifications' && method === 'GET') {
      const rows = (await env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all()).results || [];
      let pref = await env.DB.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').bind(user.id).first();
      if (!pref) {
        await env.DB.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').bind(user.id).run();
        pref = await env.DB.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').bind(user.id).first();
      }
      const prefsClean = {};
      for (const [k, v] of Object.entries(pref || {})) {
        if (k !== 'user_id') prefsClean[k] = Boolean(v);
      }
      return jsonResponse({
        notifications: rows.map((r) => ({ ...r, is_read: Boolean(r.is_read) })),
        unread_count: rows.filter((r) => !r.is_read).length,
        preferences: prefsClean,
      });
    }

    if (path === '/api/v1/notifications/read-all' && method === 'POST') {
      await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').bind(user.id).run();
      return jsonResponse({ message: 'Đã đánh dấu tất cả là đã đọc.' });
    }

    const readOne = path.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
    if (readOne && method === 'POST') {
      await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(readOne[1], user.id).run();
      return jsonResponse({ message: 'Đã đánh dấu đã đọc.' });
    }

    if (path === '/api/v1/notifications/preferences' && method === 'PUT') {
      const body = await parseJsonBody(request);
      await env.DB.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').bind(user.id).run();
      const cur = await env.DB.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').bind(user.id).first();
      const fields = ['new_lesson', 'new_assignment', 'deadline_reminder', 'lesson_completed', 'announcement', 'student_joined', 'quiz_result'];
      const vals = fields.map((f) => (body[f] !== undefined ? (body[f] ? 1 : 0) : cur[f]));
      await env.DB.prepare(
        `UPDATE notification_preferences SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE user_id = ?`
      ).bind(...vals, user.id).run();
      return jsonResponse({ message: 'Đã lưu cài đặt thông báo.' });
    }
  }

  // ── Calendar ──
  if (path.startsWith('/api/v1/calendar')) {
    const modErr = await checkModuleEnabled(env, 'calendar');
    if (modErr) return modErr;

    if (path === '/api/v1/calendar/events' && method === 'GET') {
      const custom = (await env.DB.prepare('SELECT * FROM calendar_events ORDER BY start_time ASC').all()).results || [];
      const lessons = (await env.DB.prepare(`SELECT id, classroom_id, title, due_date FROM lessons WHERE due_date IS NOT NULL AND status = 'published'`).all()).results || [];
      const quizzes = (await env.DB.prepare(`SELECT id, classroom_id, title, due_date FROM quizzes WHERE due_date IS NOT NULL AND status = 'published'`).all()).results || [];
      const assignments = (await env.DB.prepare(`SELECT id, classroom_id, title, due_date FROM assignments WHERE due_date IS NOT NULL AND status = 'published'`).all()).results || [];

      const events = [
        ...custom,
        ...lessons.map((l) => ({ id: `les_${l.id}`, classroom_id: l.classroom_id, event_type: 'lesson', title: `Bài giảng: ${l.title}`, description: 'Hạn hoàn thành video', start_time: l.due_date, end_time: l.due_date })),
        ...quizzes.map((q) => ({ id: `qz_${q.id}`, classroom_id: q.classroom_id, event_type: 'quiz', title: `Kiểm tra: ${q.title}`, description: 'Hạn nộp bài kiểm tra', start_time: q.due_date, end_time: q.due_date })),
        ...assignments.map((a) => ({ id: `asg_${a.id}`, classroom_id: a.classroom_id, event_type: 'deadline', title: `Hạn nộp: ${a.title}`, description: 'Bài tập lớp', start_time: a.due_date, end_time: a.due_date })),
      ].sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
      return jsonResponse({ events });
    }

    if (path === '/api/v1/calendar/events' && method === 'POST') {
      const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
      if (roleErr) return roleErr;
      const body = await parseJsonBody(request);
      const eid = generateId('evt');
      await env.DB.prepare(
        'INSERT INTO calendar_events (id, classroom_id, creator_id, event_type, title, description, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(eid, body.classroom_id || null, user.id, body.event_type || 'class_event', sanitizeText(body.title), sanitizeText(body.description || ''), body.start_time, body.end_time).run();
      return jsonResponse({ id: eid }, 201);
    }
  }

  // ── Module Manager & Admin ──
  if (path === '/api/v1/admin/modules' && method === 'GET') {
    return jsonResponse({ modules: await listModules(env) });
  }

  const modToggle = path.match(/^\/api\/v1\/admin\/modules\/([^/]+)$/);
  if (modToggle && method === 'PUT') {
    const roleErr = requireRoles(user, ['super_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    try {
      const mod = await toggleModule(env, modToggle[1], Boolean(body.enabled));
      await writeAuditLog(env, 'module.toggle', 'module', modToggle[1], user.id, 'info', { enabled: Boolean(body.enabled) });
      return jsonResponse({ module: mod });
    } catch (err) {
      return errorResponse(err.message, 400);
    }
  }

  if (path === '/api/v1/admin/users' && method === 'GET') {
    const roleErr = requireRoles(user, ['super_admin', 'school_admin']);
    if (roleErr) return roleErr;
    const users = (await env.DB.prepare(
      'SELECT id, school_id, role_name, email, full_name, display_name, is_active, email_verified, last_login_at, created_at FROM users ORDER BY created_at DESC'
    ).all()).results || [];
    return jsonResponse({ users });
  }

  if (path === '/api/v1/admin/users' && method === 'POST') {
    const roleErr = requireRoles(user, ['super_admin', 'school_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const roleRow = await env.DB.prepare('SELECT id FROM roles WHERE name = ?').bind(body.role_name || 'student').first();
    if (!roleRow) return errorResponse('Vai trò không hợp lệ.', 400);
    const uid = generateId('usr');
    const clean = sanitizeText(body.full_name || 'User');
    await env.DB.prepare(
      `INSERT INTO users (id, school_id, role_id, role_name, email, password_hash, full_name, display_name, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(uid, body.school_id || user.school_id || null, roleRow.id, body.role_name || 'student', email, await hashPassword(String(body.password || 'Pass@123')), clean, clean).run();
    return jsonResponse({ id: uid, email }, 201);
  }

  if (path === '/api/v1/admin/schools' && method === 'GET') {
    const roleErr = requireRoles(user, ['super_admin', 'school_admin']);
    if (roleErr) return roleErr;
    const schools = (await env.DB.prepare('SELECT * FROM schools ORDER BY created_at DESC').all()).results || [];
    return jsonResponse({ schools });
  }

  if (path === '/api/v1/admin/system-health' && method === 'GET') {
    const roleErr = requireRoles(user, ['super_admin', 'school_admin']);
    if (roleErr) return roleErr;
    const tables = (await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all()).results || [];
    const vidAgg = await env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(file_size_bytes), 0) AS bytes FROM videos').first();
    const logs = (await env.DB.prepare(
      `SELECT a.*, COALESCE(u.display_name, 'System') AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 40`
    ).all()).results || [];
    const configs = (await env.DB.prepare('SELECT * FROM system_config ORDER BY key ASC').all()).results || [];

    return jsonResponse({
      database: {
        engine: 'Cloudflare D1 (Distributed SQLite)',
        status: 'healthy',
        table_count: tables.length,
        size_bytes: 0,
      },
      storage: {
        provider: env.VIDEO_BUCKET ? 'cloudflare-r2' : 'unconfigured',
        status: env.VIDEO_BUCKET ? 'healthy' : 'warning',
        file_count: Number(vidAgg?.count || 0),
        used_mb: Math.round((Number(vidAgg?.bytes || 0) / (1024 * 1024)) * 100) / 100,
      },
      video_metrics: {
        total_videos: Number(vidAgg?.count || 0),
        total_bytes: Number(vidAgg?.bytes || 0),
        total_mb: Math.round((Number(vidAgg?.bytes || 0) / (1024 * 1024)) * 100) / 100,
      },
      configs,
      audit_logs: logs,
    });
  }

  return null;
}
