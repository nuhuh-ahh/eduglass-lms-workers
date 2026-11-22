/**
 * Cloudflare Workers Route — Classroom Management
 */
import {
  checkModuleEnabled,
  createNotification,
  errorResponse,
  getCurrentUser,
  jsonResponse,
  parseJsonBody,
  requireRoles,
  writeAuditLog,
} from '../core/http.js';
import { generateId, generateJoinCode, sanitizeText } from '../core/security.js';

export async function handleClassroomRoutes(request, env, path) {
  if (!path.startsWith('/api/v1/classrooms')) return null;

  const modErr = await checkModuleEnabled(env, 'classroom');
  if (modErr) return modErr;

  const authRes = await getCurrentUser(request, env);
  if (authRes.error) return authRes.error;
  const user = authRes.user;
  const method = request.method;
  const url = new URL(request.url);

  if (path === '/api/v1/classrooms' && method === 'GET') {
    const search = (url.searchParams.get('search') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') || 20)));
    const offset = (page - 1) * pageSize;
    const like = `%${search}%`;

    let where = 'WHERE (c.name LIKE ? OR c.code LIKE ? OR c.subject LIKE ?)';
    let params = [like, like, like];
    if (user.role_name === 'teacher') {
      where = 'WHERE c.teacher_id = ? AND (c.name LIKE ? OR c.code LIKE ? OR c.subject LIKE ?)';
      params = [user.id, like, like, like];
    } else if (user.role_name === 'student') {
      where = `WHERE EXISTS (SELECT 1 FROM classroom_members cm WHERE cm.classroom_id = c.id AND cm.user_id = ?) AND (c.name LIKE ? OR c.code LIKE ? OR c.subject LIKE ?)`;
      params = [user.id, like, like, like];
    }

    const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS cnt FROM classrooms c ${where}`).bind(...params).first();
    const items = (await env.DB.prepare(
      `SELECT c.*, u.display_name AS teacher_name,
              (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id AND cm.member_role = 'student') AS student_count,
              (SELECT COUNT(*) FROM lessons l WHERE l.classroom_id = c.id AND l.status = 'published') AS lesson_count
       FROM classrooms c JOIN users u ON u.id = c.teacher_id
       ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all()).results || [];

    return jsonResponse({ items, total: totalRow?.cnt || 0, page, page_size: pageSize });
  }

  if (path === '/api/v1/classrooms' && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    const cid = generateId('cls');
    const code = (body.code || generateJoinCode(6)).trim().toUpperCase();
    const dup = await env.DB.prepare('SELECT id FROM classrooms WHERE code = ?').bind(code).first();
    if (dup) return errorResponse('Mã lớp đã tồn tại.', 409);

    await env.DB.prepare(
      `INSERT INTO classrooms (id, school_id, teacher_id, name, code, description, subject, invite_token, invite_link_enabled, allow_student_leave)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      cid, user.school_id || null, user.id, sanitizeText(body.name || 'Lớp mới'), code,
      sanitizeText(body.description || ''), sanitizeText(body.subject || ''), generateId('inv'),
      body.invite_link_enabled === false ? 0 : 1, body.allow_student_leave === false ? 0 : 1
    ).run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO classroom_members (id, classroom_id, user_id, member_role) VALUES (?, ?, ?, 'teacher')`
    ).bind(generateId('cm'), cid, user.id).run();
    await writeAuditLog(env, 'classroom.create', 'classroom', cid, user.id);
    const classroom = await env.DB.prepare('SELECT * FROM classrooms WHERE id = ?').bind(cid).first();
    return jsonResponse({ classroom }, 201);
  }

  if (path === '/api/v1/classrooms/join' && method === 'POST') {
    const body = await parseJsonBody(request);
    let cls = null;
    if (body.code) {
      cls = await env.DB.prepare('SELECT * FROM classrooms WHERE UPPER(code) = ? AND is_archived = 0').bind(String(body.code).trim().toUpperCase()).first();
    } else if (body.invite_token) {
      cls = await env.DB.prepare('SELECT * FROM classrooms WHERE invite_token = ? AND invite_link_enabled = 1 AND is_archived = 0').bind(String(body.invite_token).trim()).first();
    }
    if (!cls) return errorResponse('Mã lớp hoặc liên kết mời không hợp lệ.', 404);

    const existing = await env.DB.prepare('SELECT id FROM classroom_members WHERE classroom_id = ? AND user_id = ?').bind(cls.id, user.id).first();
    if (!existing) {
      await env.DB.prepare(`INSERT INTO classroom_members (id, classroom_id, user_id, member_role) VALUES (?, ?, ?, 'student')`).bind(generateId('cm'), cls.id, user.id).run();
      await createNotification(env, cls.teacher_id, 'student_joined', 'Học sinh mới tham gia lớp', `${user.display_name} đã tham gia lớp ${cls.name}.`, `#classrooms/${cls.id}`);
    }
    return jsonResponse({ message: `Đã tham gia lớp ${cls.name}.`, classroom: cls });
  }

  const detailMatch = path.match(/^\/api\/v1\/classrooms\/([^/]+)$/);
  if (detailMatch && method === 'GET') {
    const cid = detailMatch[1];
    const classroom = await env.DB.prepare('SELECT c.*, u.display_name AS teacher_name FROM classrooms c JOIN users u ON u.id = c.teacher_id WHERE c.id = ?').bind(cid).first();
    if (!classroom) return errorResponse('Không tìm thấy lớp học.', 404);
    const members = (await env.DB.prepare(
      `SELECT cm.id, cm.member_role, cm.joined_at, u.id AS user_id, u.full_name, u.display_name, u.email, u.avatar_url
       FROM classroom_members cm JOIN users u ON u.id = cm.user_id WHERE cm.classroom_id = ? ORDER BY cm.member_role DESC, u.full_name ASC`
    ).bind(cid).all()).results || [];
    const announcements = (await env.DB.prepare(
      `SELECT ca.*, u.display_name AS author_name FROM classroom_announcements ca JOIN users u ON u.id = ca.author_id WHERE ca.classroom_id = ? ORDER BY ca.created_at DESC`
    ).bind(cid).all()).results || [];
    const lessons = (await env.DB.prepare('SELECT * FROM lessons WHERE classroom_id = ? ORDER BY created_at DESC').bind(cid).all()).results || [];
    return jsonResponse({ classroom, members, announcements, lessons });
  }

  const leaveMatch = path.match(/^\/api\/v1\/classrooms\/([^/]+)\/leave$/);
  if (leaveMatch && method === 'POST') {
    const cid = leaveMatch[1];
    const cls = await env.DB.prepare('SELECT allow_student_leave FROM classrooms WHERE id = ?').bind(cid).first();
    if (!cls) return errorResponse('Không tìm thấy lớp học.', 404);
    if (!cls.allow_student_leave) return errorResponse('Lớp học này không cho phép tự rời lớp.', 403);
    await env.DB.prepare(`DELETE FROM classroom_members WHERE classroom_id = ? AND user_id = ? AND member_role = 'student'`).bind(cid, user.id).run();
    return jsonResponse({ message: 'Đã rời khỏi lớp học.' });
  }

  const addMemMatch = path.match(/^\/api\/v1\/classrooms\/([^/]+)\/members$/);
  if (addMemMatch && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const cid = addMemMatch[1];
    const body = await parseJsonBody(request);
    const target = await env.DB.prepare('SELECT id, display_name FROM users WHERE email = ?').bind(String(body.email || '').trim().toLowerCase()).first();
    if (!target) return errorResponse('Không tìm thấy tài khoản với email này.', 404);
    await env.DB.prepare(`INSERT OR IGNORE INTO classroom_members (id, classroom_id, user_id, member_role) VALUES (?, ?, ?, 'student')`).bind(generateId('cm'), cid, target.id).run();
    return jsonResponse({ message: `Đã thêm ${target.display_name} vào lớp.` });
  }

  const rmMemMatch = path.match(/^\/api\/v1\/classrooms\/([^/]+)\/members\/([^/]+)$/);
  if (rmMemMatch && method === 'DELETE') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    await env.DB.prepare(`DELETE FROM classroom_members WHERE classroom_id = ? AND user_id = ? AND member_role = 'student'`).bind(rmMemMatch[1], rmMemMatch[2]).run();
    return jsonResponse({ message: 'Đã xóa học sinh khỏi lớp.' });
  }

  const annMatch = path.match(/^\/api\/v1\/classrooms\/([^/]+)\/announcements$/);
  if (annMatch && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const cid = annMatch[1];
    const body = await parseJsonBody(request);
    const aid = generateId('ann');
    await env.DB.prepare('INSERT INTO classroom_announcements (id, classroom_id, author_id, title, content) VALUES (?, ?, ?, ?, ?)').bind(
      aid, cid, user.id, sanitizeText(body.title), sanitizeText(body.content)
    ).run();
    const students = (await env.DB.prepare(`SELECT user_id FROM classroom_members WHERE classroom_id = ? AND member_role = 'student'`).bind(cid).all()).results || [];
    for (const s of students) {
      await createNotification(env, s.user_id, 'announcement', 'Thông báo lớp học', sanitizeText(body.title), `#classrooms/${cid}`);
    }
    return jsonResponse({ id: aid, message: 'Đã đăng thông báo lớp.' }, 201);
  }

  return null;
}
