-- EduGlass LMS — Zero-Card D1 Video Storage Fallback (v1.2.0)
-- Allows video storage and HTTP Range streaming directly via Cloudflare D1 (5GB Free)
-- No credit card or Cloudflare R2 activation required!

CREATE TABLE IF NOT EXISTS video_chunks (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,
    UNIQUE (video_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_vc_video ON video_chunks(video_id, chunk_index);
