/**
 * Cloudflare Workers Route — Teacher Sub-Accounts Management & Impersonation
 * Allows Teachers / Admins to create, list, manage, and directly log into student sub-accounts.
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
  generateJoinCode,
  hashPassword,
  sanitizeText,
} from '../core/security.js';

export async function handleSubAccountRoutes(request, env, path) {
  const method = request.method;

  // All sub-account routes require authentication
  if (!path.startsWith('/api/v1/teacher/sub-accounts')) return null;

  const authRes = await getCurrentUser(request, env);
  if (authRes.error) return authRes.error;
  const teacher = authRes.user;

  const isStaff = ['teacher', 'school_admin', 'super_admin'].includes(teacher.role_name);
  if (!isStaff) {
    return errorResponse('Chỉ có Giáo viên hoặc Quản trị viên mới có quyền quản lý tài khoản con.', 403);
  }

  // 1. GET /api/v1/teacher/sub-accounts — List sub-accounts
  if (path === '/api/v1/teacher/sub-accounts' && method === 'GET') {
    let rows;
    if (teacher.role_name === 'super_admin') {
      rows = (await env.DB.prepare(
        `SELECT u.id, u.email, u.full_name, u.display_name, u.role_name, u.is_active,
                u.created_at, u.last_login_at, u.student_code, u.raw_temp_password, u.created_by_id
         FROM users u
         WHERE u.role_name = 'student'
         ORDER BY u.created_at DESC`
      ).all()).results || [];
    } else {
      rows = (await env.DB.prepare(
        `SELECT DISTINCT u.id, u.email, u.full_name, u.display_name, u.role_name, u.is_active,
                u.created_at, u.last_login_at, u.student_code, u.raw_temp_password, u.created_by_id
         FROM users u
         LEFT JOIN classroom_members cm ON u.id = cm.user_id
         LEFT JOIN classrooms c ON cm.classroom_id = c.id
         WHERE u.role_name = 'student'
           AND (u.created_by_id = ? OR c.teacher_id = ?)
         ORDER BY u.created_at DESC`
      ).bind(teacher.id, teacher.id).all()).results || [];
    }

    // Attach classroom names for each student
    const result = [];
    for (const r of rows) {
      const classRows = (await env.DB.prepare(
        `SELECT c.id, c.name, c.code
         FROM classrooms c
         JOIN classroom_members cm ON c.id = cm.classroom_id
         WHERE cm.user_id = ?`
      ).bind(r.id).all()).results || [];

      result.push({
        ...r,
        is_active: Boolean(r.is_active),
        classrooms: classRows,
      });
    }

    return jsonResponse({ sub_accounts: result });
  }

  // 2. POST /api/v1/teacher/sub-accounts — Create a new sub-account
  if (path === '/api/v1/teacher/sub-accounts' && method === 'POST') {
    const body = await parseJsonBody(request);
    const fullName = sanitizeText(body.full_name || '');
    if (fullName.length < 2) {
      return errorResponse('Họ và tên học sinh phải có ít nhất 2 ký tự.', 400);
    }

    const studentCode = sanitizeText(body.student_code || generateJoinCode(6).toUpperCase());
    let email = String(body.email || '').trim().toLowerCase();
    if (!email) {
      // Auto-generate clean academic email if not provided
      const cleanSlug = studentCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `hs.${cleanSlug}@eduglass.local`;
    }

    const dup = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (dup) {
      return errorResponse(`Email hoặc tên đăng nhập '${email}' đã được sử dụng. Vui lòng chọn tên khác.`, 409);
    }

    const rawPassword = String(body.password || `HS@${generateJoinCode(6)}`).trim();
    if (rawPassword.length < 6) {
      return errorResponse('Mật khẩu tối thiểu phải 6 ký tự.', 400);
    }

    const studentRole = await env.DB.prepare('SELECT id FROM roles WHERE name = ?').bind('student').first();
    if (!studentRole) {
      return errorResponse('Không tìm thấy vai trò student trong hệ thống.', 500);
    }

    const studentId = generateId('usr');
    const pwdHash = await hashPassword(rawPassword);

    await env.DB.prepare(
      `INSERT INTO users (id, school_id, role_id, role_name, email, password_hash, full_name, display_name,
                          created_by_id, student_code, raw_temp_password, email_verified, is_active)
       VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, 1, 1)`
    ).bind(
      studentId,
      teacher.school_id || null,
      studentRole.id,
      email,
      pwdHash,
      fullName,
      fullName,
      teacher.id,
      studentCode,
      rawPassword
    ).run();

    // Default preferences
    await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(studentId).run();
    await env.DB.prepare('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)').bind(studentId).run();

    // Enroll in classroom if specified
    const classroomId = body.classroom_id ? String(body.classroom_id) : null;
    let enrolledClass = null;
    if (classroomId) {
      const cls = await env.DB.prepare('SELECT id, name FROM classrooms WHERE id = ?').bind(classroomId).first();
      if (cls) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO classroom_members (id, classroom_id, user_id, member_role)
           VALUES (?, ?, ?, 'student')`
        ).bind(generateId('cm'), cls.id, studentId).run();
        enrolledClass = cls;
      }
    }

    await writeAuditLog(env, 'teacher.create_sub_account', 'user', studentId, teacher.id);

    return jsonResponse({
      message: 'Tạo tài khoản học sinh thành công!',
      sub_account: {
        id: studentId,
        full_name: fullName,
        display_name: fullName,
        email,
        student_code: studentCode,
        raw_temp_password: rawPassword,
        role_name: 'student',
        classrooms: enrolledClass ? [enrolledClass] : [],
      },
    }, 201);
  }

  // 3. POST /api/v1/teacher/sub-accounts/:id/login-as — Impersonate student
  const loginAsMatch = path.match(/^\/api\/v1\/teacher\/sub-accounts\/([^/]+)\/login-as$/);
  if (loginAsMatch && method === 'POST') {
    const studentId = loginAsMatch[1];
    const student = await env.DB.prepare(
      `SELECT * FROM users WHERE id = ? AND role_name = 'student'`
    ).bind(studentId).first();

    if (!student) {
      return errorResponse('Tài khoản học sinh không tồn tại hoặc không hợp lệ.', 404);
    }

    // Verify permission: super_admin or creator or teacher of a class student is in
    if (teacher.role_name !== 'super_admin' && student.created_by_id !== teacher.id) {
      const inClass = await env.DB.prepare(
        `SELECT 1 FROM classroom_members cm
         JOIN classrooms c ON cm.classroom_id = c.id
         WHERE cm.user_id = ? AND c.teacher_id = ?`
      ).bind(studentId, teacher.id).first();

      if (!inClass) {
        return errorResponse('Bạn không có quyền đăng nhập vào tài khoản học sinh này.', 403);
      }
    }

    // Generate access token for the student
    const jti = generateId('jti');
    const { token } = await createAccessToken(getSecret(env), student.id, student.role_name, jti, false, env);

    await env.DB.prepare(
      `INSERT INTO user_sessions (id, user_id, token_jti, user_agent, ip_address, remember_me, expires_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).bind(
      generateId('ses'),
      student.id,
      jti,
      `Impersonated by ${teacher.display_name} (${teacher.email})`,
      request.headers.get('CF-Connecting-IP') || '',
      new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    ).run();

    await env.DB.prepare(
      `UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).bind(student.id).run();

    await writeAuditLog(env, 'auth.impersonate_student', 'user', student.id, teacher.id, 'warning');

    let prefs = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(student.id).first();
    if (!prefs) {
      await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(student.id).run();
      prefs = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(student.id).first();
    }

    return jsonResponse({
      message: `Đang đăng nhập với tư cách học sinh: ${student.display_name}`,
      access_token: token,
      token_type: 'bearer',
      user: {
        id: student.id,
        email: student.email,
        full_name: student.full_name,
        display_name: student.display_name,
        role_name: student.role_name,
        school_id: student.school_id,
        student_code: student.student_code,
      },
      preferences: prefs,
      impersonated: true,
      parent_teacher: {
        id: teacher.id,
        email: teacher.email,
        full_name: teacher.full_name,
        display_name: teacher.display_name,
        role_name: teacher.role_name,
      },
    });
  }

  // 4. POST /api/v1/teacher/sub-accounts/:id/magic-link — Generate instant login link for student
  const magicLinkMatch = path.match(/^\/api\/v1\/teacher\/sub-accounts\/([^/]+)\/magic-link$/);
  if (magicLinkMatch && method === 'POST') {
    const studentId = magicLinkMatch[1];
    const student = await env.DB.prepare(
      `SELECT * FROM users WHERE id = ? AND role_name = 'student'`
    ).bind(studentId).first();

    if (!student) return errorResponse('Không tìm thấy học sinh.', 404);

    let tokenRow = await env.DB.prepare(
      `SELECT token FROM magic_login_tokens WHERE user_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1`
    ).bind(studentId).first();

    let magicToken = tokenRow?.token;
    if (!magicToken) {
      magicToken = generateId('mlt') + '_' + generateJoinCode(12).toLowerCase();
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
      await env.DB.prepare(
        `INSERT INTO magic_login_tokens (id, user_id, token, created_by_id, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(generateId('mlid'), studentId, magicToken, teacher.id, expiresAt).run();
    }

    const origin = new URL(request.url).origin;
    const magicLink = `${origin}/#magic?token=${magicToken}`;

    return jsonResponse({
      magic_link: magicLink,
      token: magicToken,
      student_name: student.full_name,
      student_code: student.student_code,
    });
  }

  // 5. PUT /api/v1/teacher/sub-accounts/:id/reset-password — Reset student password
  const resetMatch = path.match(/^\/api\/v1\/teacher\/sub-accounts\/([^/]+)\/reset-password$/);
  if (resetMatch && method === 'PUT') {
    const studentId = resetMatch[1];
    const body = await parseJsonBody(request);
    const newPwd = String(body.new_password || `HS@${generateJoinCode(6)}`).trim();
    if (newPwd.length < 6) {
      return errorResponse('Mật khẩu tối thiểu phải 6 ký tự.', 400);
    }

    const student = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND role_name = ?').bind(studentId, 'student').first();
    if (!student) return errorResponse('Không tìm thấy học sinh.', 404);

    const pwdHash = await hashPassword(newPwd);
    await env.DB.prepare(
      `UPDATE users SET password_hash = ?, raw_temp_password = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(pwdHash, newPwd, studentId).run();

    await env.DB.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?').bind(studentId).run();
    await writeAuditLog(env, 'teacher.reset_student_password', 'user', studentId, teacher.id);

    return jsonResponse({
      message: 'Đặt lại mật khẩu học sinh thành công!',
      new_password: newPwd,
    });
  }

  // 5. DELETE /api/v1/teacher/sub-accounts/:id — Remove sub-account
  const delMatch = path.match(/^\/api\/v1\/teacher\/sub-accounts\/([^/]+)$/);
  if (delMatch && method === 'DELETE') {
    const studentId = delMatch[1];
    const student = await env.DB.prepare('SELECT id, created_by_id FROM users WHERE id = ? AND role_name = ?').bind(studentId, 'student').first();
    if (!student) return errorResponse('Không tìm thấy học sinh.', 404);

    if (teacher.role_name !== 'super_admin' && student.created_by_id !== teacher.id) {
      return errorResponse('Bạn chỉ có thể xóa tài khoản con do chính bạn tạo.', 403);
    }

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(studentId).run();
    await writeAuditLog(env, 'teacher.delete_sub_account', 'user', studentId, teacher.id);

    return jsonResponse({ message: 'Đã xóa tài khoản học sinh thành công.' });
  }

  return null;
}
