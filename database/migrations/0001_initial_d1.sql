-- EduGlass LMS — Initial SQLite Schema Migration (v1.0.0)

CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT DEFAULT '',
    contact_email TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (name IN ('super_admin', 'school_admin', 'teacher', 'student')),
    display_name TEXT NOT NULL,
    permissions_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
    role_id TEXT NOT NULL REFERENCES roles(id),
    role_name TEXT NOT NULL CHECK (role_name IN ('super_admin', 'school_admin', 'teacher', 'student')),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    email_verified INTEGER NOT NULL DEFAULT 0,
    verification_token TEXT DEFAULT NULL,
    reset_token TEXT DEFAULT NULL,
    reset_token_expires_at TEXT DEFAULT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_name);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti TEXT NOT NULL UNIQUE,
    user_agent TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    remember_me INTEGER NOT NULL DEFAULT 0,
    is_revoked INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON user_sessions(token_jti);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme_mode TEXT NOT NULL DEFAULT 'liquid-glass' CHECK (theme_mode IN ('liquid-glass', 'classic-education')),
    language TEXT NOT NULL DEFAULT 'vi' CHECK (language IN ('vi', 'en')),
    accent_color TEXT NOT NULL DEFAULT '#0A84FF',
    wallpaper TEXT NOT NULL DEFAULT 'aurora-prism',
    glass_opacity REAL NOT NULL DEFAULT 0.68 CHECK (glass_opacity >= 0.2 AND glass_opacity <= 0.95),
    glass_blur INTEGER NOT NULL DEFAULT 22 CHECK (glass_blur >= 0 AND glass_blur <= 40),
    animation_level TEXT NOT NULL DEFAULT 'full' CHECK (animation_level IN ('full', 'reduced', 'none')),
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classrooms (
    id TEXT PRIMARY KEY,
    school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
    teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    invite_token TEXT NOT NULL UNIQUE,
    invite_link_enabled INTEGER NOT NULL DEFAULT 1,
    allow_student_leave INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_code ON classrooms(code);

CREATE TABLE IF NOT EXISTS classroom_members (
    id TEXT PRIMARY KEY,
    classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_role TEXT NOT NULL DEFAULT 'student' CHECK (member_role IN ('teacher', 'assistant', 'student')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (classroom_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cm_classroom ON classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_cm_user ON classroom_members(user_id);

CREATE TABLE IF NOT EXISTS classroom_announcements (
    id TEXT PRIMARY KEY,
    classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ca_classroom ON classroom_announcements(classroom_id);

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'local',
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    duration_seconds REAL NOT NULL DEFAULT 0,
    thumbnail_url TEXT DEFAULT '',
    processing_status TEXT NOT NULL DEFAULT 'ready' CHECK (processing_status IN ('uploading', 'processing', 'ready', 'failed')),
    checksum_sha256 TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_videos_uploader ON videos(uploader_id);

CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    version INTEGER NOT NULL DEFAULT 1,
    allow_continue_on_wrong INTEGER NOT NULL DEFAULT 1,
    due_date TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lessons_classroom ON lessons(classroom_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);

CREATE TABLE IF NOT EXISTS video_questions (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'multiple_select', 'fill_blank', 'short_answer', 'matching')),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    options_json TEXT NOT NULL DEFAULT '[]',
    correct_answer_json TEXT NOT NULL,
    explanation TEXT DEFAULT '',
    score REAL NOT NULL DEFAULT 1.0,
    is_required INTEGER NOT NULL DEFAULT 1,
    timestamp_seconds REAL NOT NULL CHECK (timestamp_seconds >= 0),
    time_limit_seconds INTEGER DEFAULT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vq_lesson ON video_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_vq_timestamp ON video_questions(lesson_id, timestamp_seconds);

CREATE TABLE IF NOT EXISTS video_watch_sessions (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_timestamp REAL NOT NULL DEFAULT 0,
    verified_frontier REAL NOT NULL DEFAULT 0,
    total_watched_seconds REAL NOT NULL DEFAULT 0,
    watch_progress_pct REAL NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT DEFAULT NULL,
    suspicious_seek_count INTEGER NOT NULL DEFAULT 0,
    last_heartbeat_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (lesson_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_vws_student ON video_watch_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_vws_lesson ON video_watch_sessions(lesson_id);

CREATE TABLE IF NOT EXISTS watched_segments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES video_watch_sessions(id) ON DELETE CASCADE,
    start_sec REAL NOT NULL,
    end_sec REAL NOT NULL CHECK (end_sec >= start_sec),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ws_session ON watched_segments(session_id);

CREATE TABLE IF NOT EXISTS seek_anomalies (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES video_watch_sessions(id) ON DELETE CASCADE,
    from_sec REAL NOT NULL,
    attempted_to_sec REAL NOT NULL,
    verified_frontier REAL NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sa_session ON seek_anomalies(session_id);

CREATE TABLE IF NOT EXISTS question_attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES video_watch_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES video_questions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer_json TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    score_earned REAL NOT NULL DEFAULT 0,
    answered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_qa_student ON question_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_question ON question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_qa_session ON question_attempts(session_id);

CREATE TABLE IF NOT EXISTS question_bank (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT DEFAULT '',
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'multiple_select', 'fill_blank', 'short_answer', 'matching')),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    options_json TEXT NOT NULL DEFAULT '[]',
    correct_answer_json TEXT NOT NULL,
    explanation TEXT DEFAULT '',
    default_score REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    max_score REAL NOT NULL DEFAULT 100.0,
    due_date TEXT DEFAULT NULL,
    allow_resubmit INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assign_classroom ON assignments(classroom_id);

CREATE TABLE IF NOT EXISTS assignment_submissions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    attachment_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded')),
    score REAL DEFAULT NULL,
    feedback TEXT DEFAULT '',
    submitted_at TEXT DEFAULT NULL,
    graded_at TEXT DEFAULT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    time_limit_minutes INTEGER DEFAULT 30,
    due_date TEXT DEFAULT NULL,
    max_score REAL NOT NULL DEFAULT 100.0,
    max_attempts INTEGER NOT NULL DEFAULT 2,
    show_answers_after_submit INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quizzes_classroom ON quizzes(classroom_id);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    bank_question_id TEXT REFERENCES question_bank(id) ON DELETE SET NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'multiple_select', 'fill_blank', 'short_answer', 'matching')),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    options_json TEXT NOT NULL DEFAULT '[]',
    correct_answer_json TEXT NOT NULL,
    explanation TEXT DEFAULT '',
    score REAL NOT NULL DEFAULT 1.0,
    order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_qq_quiz ON quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
    answers_json TEXT NOT NULL DEFAULT '{}',
    grading_json TEXT NOT NULL DEFAULT '{}',
    auto_score REAL NOT NULL DEFAULT 0,
    manual_score REAL NOT NULL DEFAULT 0,
    total_score REAL NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    answered_count INTEGER NOT NULL DEFAULT 0,
    teacher_feedback TEXT DEFAULT '',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    submitted_at TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_qza_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_qza_student ON quiz_attempts(student_id);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    new_lesson INTEGER NOT NULL DEFAULT 1,
    new_assignment INTEGER NOT NULL DEFAULT 1,
    deadline_reminder INTEGER NOT NULL DEFAULT 1,
    lesson_completed INTEGER NOT NULL DEFAULT 1,
    announcement INTEGER NOT NULL DEFAULT 1,
    student_joined INTEGER NOT NULL DEFAULT 1,
    quiz_result INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('lesson', 'quiz', 'deadline', 'class_event', 'completion')),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    reference_id TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cal_start ON calendar_events(start_time);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL,
    export_format TEXT NOT NULL CHECK (export_format IN ('csv', 'xlsx', 'pdf')),
    filters_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT DEFAULT '',
    dependencies_json TEXT NOT NULL DEFAULT '[]',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_core INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'disabled', 'error')),
    last_error TEXT DEFAULT NULL,
    manifest_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
    details_json TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
