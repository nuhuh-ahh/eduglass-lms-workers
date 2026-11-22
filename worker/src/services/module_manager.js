/**
 * EduGlass LMS (Cloudflare Workers) — 12-Module Registry & Dependency Validator
 */

export const MODULE_MANIFESTS = [
  { id: 'authentication', name: 'Authentication Module', version: '1.0.0', core: true, dependencies: [], apiPrefix: '/api/v1/auth', description: 'Xác thực Web Crypto PBKDF2, JWT HS256, phiên đăng nhập & RBAC.' },
  { id: 'user_management', name: 'User Management Module', version: '1.0.0', core: true, dependencies: ['authentication'], apiPrefix: '/api/v1/admin/users', description: 'Quản lý tài khoản học sinh, giáo viên, quản trị trường.' },
  { id: 'classroom', name: 'Classroom Module', version: '1.0.0', core: false, dependencies: ['authentication', 'user_management'], apiPrefix: '/api/v1/classrooms', description: 'Tạo lớp học, mã tham gia, liên kết mời và thông báo lớp.' },
  { id: 'video_learning', name: 'Video Learning Module', version: '1.0.0', core: false, dependencies: ['authentication', 'classroom'], apiPrefix: '/api/v1/lessons', description: 'Video Studio, R2 Range streaming, câu hỏi timeline và Anti-Skip Engine.' },
  { id: 'quiz', name: 'Quiz Module', version: '1.0.0', core: false, dependencies: ['authentication', 'classroom'], apiPrefix: '/api/v1/quizzes', description: 'Ngân hàng câu hỏi, đề kiểm tra tự chấm điểm và chấm tự luận.' },
  { id: 'assignment', name: 'Assignment Module', version: '1.0.0', core: false, dependencies: ['authentication', 'classroom'], apiPrefix: '/api/v1/assignments', description: 'Giao bài tập, nộp bài trực tuyến và chấm điểm nhận xét.' },
  { id: 'analytics', name: 'Analytics Module', version: '1.0.0', core: false, dependencies: ['authentication', 'classroom', 'video_learning'], apiPrefix: '/api/v1/analytics', description: 'Thống kê lớp học, từng học sinh và công thức Accuracy chuẩn.' },
  { id: 'notification', name: 'Notification Module', version: '1.0.0', core: false, dependencies: ['authentication'], apiPrefix: '/api/v1/notifications', description: 'Thông báo sự kiện học tập và tùy chọn nhận thông báo.' },
  { id: 'calendar', name: 'Calendar Module', version: '1.0.0', core: false, dependencies: ['authentication', 'classroom'], apiPrefix: '/api/v1/calendar', description: 'Lịch học tập tổng hợp chế độ Tháng, Tuần, Ngày, Agenda.' },
  { id: 'report_export', name: 'Report Export Module', version: '1.0.0', core: false, dependencies: ['analytics'], apiPrefix: '/api/v1/reports', description: 'Xuất báo cáo CSV, Excel (.xlsx) và PDF thuần JS trực tiếp từ D1.' },
  { id: 'appearance', name: 'Appearance Module', version: '1.0.0', core: true, dependencies: ['authentication'], apiPrefix: '/api/v1/preferences', description: 'Giao diện kép Liquid Glass (iOS 27) & Classic Education đồng bộ tài khoản.' },
  { id: 'administration', name: 'Administration Module', version: '1.0.0', core: true, dependencies: ['authentication', 'user_management'], apiPrefix: '/api/v1/admin', description: 'Bảng điều khiển Super Admin, trường học, audit logs, sức khỏe D1 & R2.' },
];

export async function listModules(env) {
  const rows = await env.DB.prepare('SELECT * FROM module_registry ORDER BY is_core DESC, name ASC').all();
  return (rows.results || []).map((r) => ({
    ...r,
    dependencies: JSON.parse(r.dependencies_json || '[]'),
    manifest: JSON.parse(r.manifest_json || '{}'),
    is_enabled: Boolean(r.is_enabled),
    is_core: Boolean(r.is_core),
  }));
}

export async function toggleModule(env, moduleId, enable) {
  const target = await env.DB.prepare('SELECT * FROM module_registry WHERE id = ?').bind(moduleId).first();
  if (!target) throw new Error(`Module '${moduleId}' không tồn tại.`);
  if (!enable && target.is_core) throw new Error(`Không thể tắt module lõi '${target.name}'.`);

  const allRows = (await env.DB.prepare('SELECT * FROM module_registry').all()).results || [];
  const byId = Object.fromEntries(allRows.map((r) => [r.id, r]));

  if (enable) {
    const deps = JSON.parse(target.dependencies_json || '[]');
    const missing = deps.filter((d) => !byId[d] || !byId[d].is_enabled);
    if (missing.length) {
      throw new Error(`Không thể bật '${target.name}' vì thiếu dependency đang hoạt động: ${missing.join(', ')}.`);
    }
  } else {
    const dependents = allRows
      .filter((m) => m.id !== moduleId && m.is_enabled && JSON.parse(m.dependencies_json || '[]').includes(moduleId))
      .map((m) => m.name);
    if (dependents.length) {
      throw new Error(`Không thể tắt '${target.name}' vì các module sau đang phụ thuộc: ${dependents.join(', ')}.`);
    }
  }

  await env.DB.prepare(
    `UPDATE module_registry SET is_enabled = ?, status = ?, last_error = NULL, updated_at = datetime('now') WHERE id = ?`
  ).bind(enable ? 1 : 0, enable ? 'healthy' : 'disabled', moduleId).run();

  const updated = await env.DB.prepare('SELECT * FROM module_registry WHERE id = ?').bind(moduleId).first();
  return {
    ...updated,
    dependencies: JSON.parse(updated.dependencies_json || '[]'),
    manifest: JSON.parse(updated.manifest_json || '{}'),
    is_enabled: Boolean(updated.is_enabled),
    is_core: Boolean(updated.is_core),
  };
}
