-- EduGlass LMS — Teacher Sub-accounts Migration (v1.1.0)
-- Allows Teachers to create, manage, and directly log in as student sub-accounts

ALTER TABLE users ADD COLUMN created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN student_code TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN raw_temp_password TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by_id);
CREATE INDEX IF NOT EXISTS idx_users_student_code ON users(student_code);
