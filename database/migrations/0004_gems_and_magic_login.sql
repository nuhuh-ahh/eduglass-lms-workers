-- EduGlass LMS — Migration 0004: Gem Rewards & Magic Login Links for Sub-Accounts

ALTER TABLE users ADD COLUMN gem_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lessons ADD COLUMN reward_gems_video INTEGER NOT NULL DEFAULT 10;
ALTER TABLE video_questions ADD COLUMN reward_gems INTEGER NOT NULL DEFAULT 2;
ALTER TABLE video_watch_sessions ADD COLUMN video_gems_awarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE question_attempts ADD COLUMN gems_awarded INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS gem_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    source TEXT NOT NULL,
    reference_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gem_user ON gem_transactions(user_id);

CREATE TABLE IF NOT EXISTS magic_login_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mlt_token ON magic_login_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mlt_user ON magic_login_tokens(user_id);
