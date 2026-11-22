-- EduGlass LMS — Clean System Bootstrap SQL for Cloudflare D1
-- Initializes ONLY system roles, 12 modules, and default config (ZERO demo users or fake data).
INSERT OR IGNORE INTO roles (id, name, display_name, permissions_json) VALUES
  ('role_super_admin', 'super_admin', 'Super Admin', '["*"]'),
  ('role_school_admin', 'school_admin', 'School Admin', '["school.*","classroom.*","user.manage"]'),
  ('role_teacher', 'teacher', 'Giáo viên', '["classroom.manage","lesson.manage","quiz.manage","analytics.view"]'),
  ('role_student', 'student', 'Học sinh', '["classroom.join","lesson.watch","quiz.attempt"]');

INSERT OR IGNORE INTO system_config (key, value, description) VALUES
  ('site_name', 'EduGlass LMS', 'Tên nền tảng'),
  ('default_theme', 'liquid-glass', 'Giao diện mặc định'),
  ('default_language', 'vi', 'Ngôn ngữ mặc định');

INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('authentication', 'Authentication Module', '1.0.0', 'Xác thực Web Crypto PBKDF2, JWT HS256, phiên đăng nhập & RBAC.', '[]', 1, 1, 'healthy', '{"id":"authentication","name":"Authentication Module","version":"1.0.0","core":true,"dependencies":[],"apiPrefix":"/api/v1/auth","description":"Xác thực Web Crypto PBKDF2, JWT HS256, phiên đăng nhập & RBAC."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('user_management', 'User Management Module', '1.0.0', 'Quản lý tài khoản học sinh, giáo viên, quản trị trường.', '["authentication"]', 1, 1, 'healthy', '{"id":"user_management","name":"User Management Module","version":"1.0.0","core":true,"dependencies":["authentication"],"apiPrefix":"/api/v1/admin/users","description":"Quản lý tài khoản học sinh, giáo viên, quản trị trường."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('classroom', 'Classroom Module', '1.0.0', 'Tạo lớp học, mã tham gia, liên kết mời và thông báo lớp.', '["authentication","user_management"]', 1, 0, 'healthy', '{"id":"classroom","name":"Classroom Module","version":"1.0.0","core":false,"dependencies":["authentication","user_management"],"apiPrefix":"/api/v1/classrooms","description":"Tạo lớp học, mã tham gia, liên kết mời và thông báo lớp."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('video_learning', 'Video Learning Module', '1.0.0', 'Video Studio, R2 Range streaming, câu hỏi timeline và Anti-Skip Engine.', '["authentication","classroom"]', 1, 0, 'healthy', '{"id":"video_learning","name":"Video Learning Module","version":"1.0.0","core":false,"dependencies":["authentication","classroom"],"apiPrefix":"/api/v1/lessons","description":"Video Studio, R2 Range streaming, câu hỏi timeline và Anti-Skip Engine."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('quiz', 'Quiz Module', '1.0.0', 'Ngân hàng câu hỏi, đề kiểm tra tự chấm điểm và chấm tự luận.', '["authentication","classroom"]', 1, 0, 'healthy', '{"id":"quiz","name":"Quiz Module","version":"1.0.0","core":false,"dependencies":["authentication","classroom"],"apiPrefix":"/api/v1/quizzes","description":"Ngân hàng câu hỏi, đề kiểm tra tự chấm điểm và chấm tự luận."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('assignment', 'Assignment Module', '1.0.0', 'Giao bài tập, nộp bài trực tuyến và chấm điểm nhận xét.', '["authentication","classroom"]', 1, 0, 'healthy', '{"id":"assignment","name":"Assignment Module","version":"1.0.0","core":false,"dependencies":["authentication","classroom"],"apiPrefix":"/api/v1/assignments","description":"Giao bài tập, nộp bài trực tuyến và chấm điểm nhận xét."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('analytics', 'Analytics Module', '1.0.0', 'Thống kê lớp học, từng học sinh và công thức Accuracy chuẩn.', '["authentication","classroom","video_learning"]', 1, 0, 'healthy', '{"id":"analytics","name":"Analytics Module","version":"1.0.0","core":false,"dependencies":["authentication","classroom","video_learning"],"apiPrefix":"/api/v1/analytics","description":"Thống kê lớp học, từng học sinh và công thức Accuracy chuẩn."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('notification', 'Notification Module', '1.0.0', 'Thông báo sự kiện học tập và tùy chọn nhận thông báo.', '["authentication"]', 1, 0, 'healthy', '{"id":"notification","name":"Notification Module","version":"1.0.0","core":false,"dependencies":["authentication"],"apiPrefix":"/api/v1/notifications","description":"Thông báo sự kiện học tập và tùy chọn nhận thông báo."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('calendar', 'Calendar Module', '1.0.0', 'Lịch học tập tổng hợp chế độ Tháng, Tuần, Ngày, Agenda.', '["authentication","classroom"]', 1, 0, 'healthy', '{"id":"calendar","name":"Calendar Module","version":"1.0.0","core":false,"dependencies":["authentication","classroom"],"apiPrefix":"/api/v1/calendar","description":"Lịch học tập tổng hợp chế độ Tháng, Tuần, Ngày, Agenda."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('report_export', 'Report Export Module', '1.0.0', 'Xuất báo cáo CSV, Excel (.xlsx) và PDF thuần JS trực tiếp từ D1.', '["analytics"]', 1, 0, 'healthy', '{"id":"report_export","name":"Report Export Module","version":"1.0.0","core":false,"dependencies":["analytics"],"apiPrefix":"/api/v1/reports","description":"Xuất báo cáo CSV, Excel (.xlsx) và PDF thuần JS trực tiếp từ D1."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('appearance', 'Appearance Module', '1.0.0', 'Giao diện kép Liquid Glass (iOS 27) & Classic Education đồng bộ tài khoản.', '["authentication"]', 1, 1, 'healthy', '{"id":"appearance","name":"Appearance Module","version":"1.0.0","core":true,"dependencies":["authentication"],"apiPrefix":"/api/v1/preferences","description":"Giao diện kép Liquid Glass (iOS 27) & Classic Education đồng bộ tài khoản."}');
INSERT OR IGNORE INTO module_registry (id, name, version, description, dependencies_json, is_enabled, is_core, status, manifest_json) VALUES ('administration', 'Administration Module', '1.0.0', 'Bảng điều khiển Super Admin, trường học, audit logs, sức khỏe D1 & R2.', '["authentication","user_management"]', 1, 1, 'healthy', '{"id":"administration","name":"Administration Module","version":"1.0.0","core":true,"dependencies":["authentication","user_management"],"apiPrefix":"/api/v1/admin","description":"Bảng điều khiển Super Admin, trường học, audit logs, sức khỏe D1 & R2."}');

-- Super Admin Account (admin / admin123)
INSERT OR IGNORE INTO users (
  id, school_id, role_id, role_name, email, password_hash, full_name, display_name, email_verified, is_active, created_at, updated_at
) VALUES (
  'usr_admin_default',
  NULL,
  'role_super_admin',
  'super_admin',
  'admin',
  'pbkdf2_sha256$100000$JAOVgryXKbJyYt+2NeQ15g==$IVoRRCdRKCXLYPqMAhB+hjzW0SwjrYVxRQSTZF3p6ws=',
  'Quản Trị Viên Hệ Thống',
  'admin',
  1,
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO user_preferences (user_id, theme, language, sound_enabled) VALUES
  ('usr_admin_default', 'liquid-glass', 'vi', 1);
