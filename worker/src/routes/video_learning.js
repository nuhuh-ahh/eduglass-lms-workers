/**
 * Cloudflare Workers Route — Video Learning Studio, R2 Range Streaming & Anti-Skip Engine
 */
import {
  checkModuleEnabled,
  createNotification,
  errorResponse,
  getCurrentUser,
  jsonResponse,
  parseJsonBody,
  requireRoles,
  SECURITY_HEADERS,
  writeAuditLog,
} from '../core/http.js';
import { generateId, sanitizeText } from '../core/security.js';
import { processWatchHeartbeat } from '../services/anti_skip.js';
import { gradeQuestion } from '../services/grading.js';

const ALLOWED_EXT = ['.mp4', '.webm', '.ogv'];

export async function handleVideoLearningRoutes(request, env, path) {
  if (!path.startsWith('/api/v1/videos') && !path.startsWith('/api/v1/lessons')) return null;

  const modErr = await checkModuleEnabled(env, 'video_learning');
  if (modErr) return modErr;

  const authRes = await getCurrentUser(request, env);
  if (authRes.error) return authRes.error;
  const user = authRes.user;
  const method = request.method;

  // ── Videos (Cloudflare R2) ──
  if (path === '/api/v1/videos' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT * FROM videos ORDER BY created_at DESC').all()).results || [];
    return jsonResponse({ videos: rows });
  }

  if (path === '/api/v1/videos/upload' && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return errorResponse('Thiếu tệp video.', 400);
    }
    const filename = file.name || 'video.mp4';
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return errorResponse('Chỉ hỗ trợ định dạng MP4, WebM, OGV.', 400);
    }
    const maxMb = Number(env.EDUGLASS_MAX_VIDEO_MB || 2048);
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      return errorResponse(`Dung lượng video vượt giới hạn ${maxMb} MB (tối đa 2GB).`, 400);
    }

    const vid = generateId('vid');
    const storageKey = `videos/${vid}${ext}`;
    const buf = await file.arrayBuffer();
    let provider = 'd1';

    if (env.VIDEO_BUCKET) {
      provider = 'r2';
      await env.VIDEO_BUCKET.put(storageKey, buf, {
        httpMetadata: { contentType: file.type || 'video/mp4' },
      });
    } else {
      // Zero-Card Mode: Store directly in D1 Database in 512KB chunks (5GB Free, No Card required)
      const CHUNK_SIZE = 512 * 1024;
      const totalBytes = buf.byteLength;
      const numChunks = Math.ceil(totalBytes / CHUNK_SIZE);
      const stmts = [];
      for (let i = 0; i < numChunks; i++) {
        const slice = buf.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        stmts.push(
          env.DB.prepare(
            'INSERT INTO video_chunks (id, video_id, chunk_index, data) VALUES (?, ?, ?, ?)'
          ).bind(generateId('chk'), vid, i, new Uint8Array(slice))
        );
      }
      // Execute in batches of 25
      for (let b = 0; b < stmts.length; b += 25) {
        await env.DB.batch(stmts.slice(b, b + 25));
      }
    }

    const title = sanitizeText(form.get('title') || filename.replace(/\.[^.]+$/, ''));
    const duration = Math.max(1, Number(form.get('duration_seconds') || 120));
    await env.DB.prepare(
      `INSERT INTO videos (id, uploader_id, title, original_filename, storage_provider, storage_key, mime_type, file_size_bytes, duration_seconds, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')`
    ).bind(vid, user.id, title, sanitizeText(filename), provider, storageKey, file.type || 'video/mp4', file.size, duration).run();
    await writeAuditLog(env, 'video.upload', 'video', vid, user.id);
    const video = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(vid).first();
    return jsonResponse({ video }, 201);
  }

  const streamMatch = path.match(/^\/api\/v1\/videos\/([^/]+)\/stream$/);
  if (streamMatch && method === 'GET') {
    const vid = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(streamMatch[1]).first();
    if (!vid) return errorResponse('Không tìm thấy video.', 404);

    let total = Number(vid.file_size_bytes || 0);

    // If R2 storage is used and available
    if (vid.storage_provider === 'r2' && env.VIDEO_BUCKET) {
      if (total <= 0) {
        try {
          const headObj = await env.VIDEO_BUCKET.head(vid.storage_key);
          if (headObj && headObj.size) {
            total = Number(headObj.size);
            await env.DB.prepare('UPDATE videos SET file_size_bytes = ? WHERE id = ?').bind(total, vid.id).run();
          }
        } catch { /* ignore */ }
      }

      const rangeHeader = request.headers.get('Range');
      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace('bytes=', '').trim().split('-');
        const start = parts[0] ? parseInt(parts[0], 10) : 0;
        const defaultChunk = 4 * 1024 * 1024;
        let end = parts[1] ? parseInt(parts[1], 10) : (total > 0 ? Math.min(start + defaultChunk - 1, total - 1) : start + defaultChunk - 1);
        if (total > 0 && end >= total) end = total - 1;
        const length = Math.max(1, end - start + 1);

        const obj = await env.VIDEO_BUCKET.get(vid.storage_key, { range: { offset: start, length } });
        if (!obj) return errorResponse('Tệp video không tồn tại trên Cloudflare R2.', 404);

        const completeTotal = total > 0 ? String(total) : '*';
        return new Response(obj.body, {
          status: 206,
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': vid.mime_type || 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${completeTotal}`,
            'Content-Length': String(length),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      const obj = await env.VIDEO_BUCKET.get(vid.storage_key);
      if (!obj) return errorResponse('Tệp video không tồn tại trên Cloudflare R2.', 404);
      const finalSize = total > 0 ? total : obj.size;
      return new Response(obj.body, {
        status: 200,
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': vid.mime_type || 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Content-Length': String(finalSize),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Zero-Card D1 Storage Fallback (5GB Free, No Credit Card needed)
    const CHUNK_SIZE = 512 * 1024;
    const rangeHeader = request.headers.get('Range');
    let start = 0;
    let end = total > 0 ? total - 1 : 0;
    let isRange = false;

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      isRange = true;
      const parts = rangeHeader.replace('bytes=', '').trim().split('-');
      start = parts[0] ? parseInt(parts[0], 10) : 0;
      const defaultSlice = 2 * 1024 * 1024; // 2MB slice
      end = parts[1] ? parseInt(parts[1], 10) : (total > 0 ? Math.min(start + defaultSlice - 1, total - 1) : start + defaultSlice - 1);
      if (total > 0 && end >= total) end = total - 1;
    }

    const length = Math.max(1, end - start + 1);
    const startChunkIdx = Math.floor(start / CHUNK_SIZE);
    const endChunkIdx = Math.floor(end / CHUNK_SIZE);

    const chunkRows = (await env.DB.prepare(
      'SELECT chunk_index, data FROM video_chunks WHERE video_id = ? AND chunk_index >= ? AND chunk_index <= ? ORDER BY chunk_index ASC'
    ).bind(vid.id, startChunkIdx, endChunkIdx).all()).results || [];

    const out = new Uint8Array(length);
    let outOffset = 0;
    for (const r of chunkRows) {
      const raw = new Uint8Array(r.data);
      const cStart = r.chunk_index * CHUNK_SIZE;
      const sStart = Math.max(0, start - cStart);
      const sEnd = Math.min(raw.length, end - cStart + 1);
      if (sEnd > sStart && outOffset < length) {
        const slice = raw.subarray(sStart, sEnd);
        const toCopy = Math.min(slice.length, length - outOffset);
        out.set(slice.subarray(0, toCopy), outOffset);
        outOffset += toCopy;
      }
    }

    const completeTotal = total > 0 ? String(total) : String(outOffset);
    return new Response(out, {
      status: isRange ? 206 : 200,
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': vid.mime_type || 'video/mp4',
        'Accept-Ranges': 'bytes',
        ...(isRange ? { 'Content-Range': `bytes ${start}-${end}/${completeTotal}` } : {}),
        'Content-Length': String(length),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // ── Lessons ──
  if (path === '/api/v1/lessons' && method === 'GET') {
    let where = 'WHERE 1=1';
    const params = [user.id, user.id];
    if (user.role_name === 'student') {
      where += ` AND l.status = 'published' AND EXISTS (SELECT 1 FROM classroom_members cm WHERE cm.classroom_id = l.classroom_id AND cm.user_id = ?)`;
      params.push(user.id);
    } else if (user.role_name === 'teacher') {
      where += ' AND l.teacher_id = ?';
      params.push(user.id);
    }
    const lessons = (await env.DB.prepare(
      `SELECT l.*, c.name AS classroom_name, v.duration_seconds, v.title AS video_title,
              (SELECT COUNT(*) FROM video_questions vq WHERE vq.lesson_id = l.id) AS question_count,
              (SELECT watch_progress_pct FROM video_watch_sessions vws WHERE vws.lesson_id = l.id AND vws.student_id = ?) AS my_progress_pct,
              (SELECT is_completed FROM video_watch_sessions vws WHERE vws.lesson_id = l.id AND vws.student_id = ?) AS my_completed
       FROM lessons l JOIN classrooms c ON c.id = l.classroom_id LEFT JOIN videos v ON v.id = l.video_id
       ${where} ORDER BY l.updated_at DESC`
    ).bind(...params).all()).results || [];
    return jsonResponse({ lessons });
  }

  if (path === '/api/v1/lessons' && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    const lid = generateId('les');
    const st = ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'draft';
    await env.DB.prepare(
      `INSERT INTO lessons (id, classroom_id, teacher_id, video_id, title, description, thumbnail_url, status, allow_continue_on_wrong, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      lid, body.classroom_id, user.id, body.video_id || null, sanitizeText(body.title),
      sanitizeText(body.description || ''), body.thumbnail_url || '', st,
      body.allow_continue_on_wrong === false ? 0 : 1, body.due_date || null
    ).run();
    const lesson = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(lid).first();
    return jsonResponse({ lesson }, 201);
  }

  const lessonMatch = path.match(/^\/api\/v1\/lessons\/([^/]+)$/);
  if (lessonMatch && method === 'GET') {
    const lid = lessonMatch[1];
    const lesson = await env.DB.prepare(
      `SELECT l.*, c.name AS classroom_name, v.duration_seconds, v.mime_type, v.title AS video_title
       FROM lessons l JOIN classrooms c ON c.id = l.classroom_id LEFT JOIN videos v ON v.id = l.video_id WHERE l.id = ?`
    ).bind(lid).first();
    if (!lesson) return errorResponse('Không tìm thấy bài giảng.', 404);
    const isStaff = ['teacher', 'school_admin', 'super_admin'].includes(user.role_name);
    const qRows = (await env.DB.prepare('SELECT * FROM video_questions WHERE lesson_id = ? ORDER BY timestamp_seconds ASC, order_index ASC').bind(lid).all()).results || [];
    const questions = qRows.map((q) => {
      const out = { ...q, options: JSON.parse(q.options_json || '[]'), is_required: Boolean(q.is_required) };
      delete out.options_json;
      if (isStaff) out.correct_answer = JSON.parse(q.correct_answer_json || 'null');
      delete out.correct_answer_json;
      return out;
    });
    const session = await env.DB.prepare('SELECT * FROM video_watch_sessions WHERE lesson_id = ? AND student_id = ?').bind(lid, user.id).first();
    const attempts = session
      ? ((await env.DB.prepare('SELECT question_id, answer_json, is_correct, score_earned, answered_at FROM question_attempts WHERE session_id = ?').bind(session.id).all()).results || []).map((a) => ({
          ...a, answer: JSON.parse(a.answer_json || 'null'), is_correct: Boolean(a.is_correct),
        }))
      : [];
    return jsonResponse({ lesson, questions, watch_session: session || null, question_attempts: attempts });
  }

  if (lessonMatch && method === 'PUT') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const lid = lessonMatch[1];
    const cur = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(lid).first();
    if (!cur) return errorResponse('Không tìm thấy bài giảng.', 404);
    const body = await parseJsonBody(request);
    await env.DB.prepare(
      `UPDATE lessons SET title = ?, description = ?, status = ?, version = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(
      body.title ? sanitizeText(body.title) : cur.title,
      body.description !== undefined ? sanitizeText(body.description) : cur.description,
      ['draft', 'published', 'archived'].includes(body.status) ? body.status : cur.status,
      cur.version + (body.bump_version ? 1 : 0),
      lid
    ).run();
    return jsonResponse({ lesson: await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(lid).first() });
  }

  // ── Video Questions CRUD ──
  const addQMatch = path.match(/^\/api\/v1\/lessons\/([^/]+)\/questions$/);
  if (addQMatch && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const lid = addQMatch[1];
    const body = await parseJsonBody(request);
    const qid = generateId('vq');
    await env.DB.prepare(
      `INSERT INTO video_questions (id, lesson_id, question_type, title, description, options_json, correct_answer_json, explanation, score, is_required, timestamp_seconds, time_limit_seconds, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      qid, lid, body.question_type || 'multiple_choice', sanitizeText(body.title), sanitizeText(body.description || ''),
      JSON.stringify(body.options || []), JSON.stringify(body.correct_answer ?? ''), sanitizeText(body.explanation || ''),
      Number(body.score ?? 1), body.is_required === false ? 0 : 1, Number(body.timestamp_seconds || 0),
      body.time_limit_seconds ?? null, Number(body.order_index || 0)
    ).run();
    return jsonResponse({ question: { id: qid, lesson_id: lid, title: sanitizeText(body.title) } }, 201);
  }

  const updQMatch = path.match(/^\/api\/v1\/lessons\/([^/]+)\/questions\/([^/]+)$/);
  if (updQMatch && method === 'PUT') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    await env.DB.prepare(
      `UPDATE video_questions SET question_type = ?, title = ?, description = ?, options_json = ?, correct_answer_json = ?, explanation = ?, score = ?, is_required = ?, timestamp_seconds = ?, updated_at = datetime('now') WHERE id = ? AND lesson_id = ?`
    ).bind(
      body.question_type || 'multiple_choice', sanitizeText(body.title), sanitizeText(body.description || ''),
      JSON.stringify(body.options || []), JSON.stringify(body.correct_answer ?? ''), sanitizeText(body.explanation || ''),
      Number(body.score ?? 1), body.is_required === false ? 0 : 1, Number(body.timestamp_seconds || 0),
      updQMatch[2], updQMatch[1]
    ).run();
    return jsonResponse({ message: 'Đã cập nhật câu hỏi.' });
  }

  if (updQMatch && method === 'DELETE') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    await env.DB.prepare('DELETE FROM video_questions WHERE id = ? AND lesson_id = ?').bind(updQMatch[2], updQMatch[1]).run();
    return jsonResponse({ message: 'Đã xóa câu hỏi.' });
  }

  const dupQMatch = path.match(/^\/api\/v1\/lessons\/([^/]+)\/questions\/([^/]+)\/duplicate$/);
  if (dupQMatch && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const src = await env.DB.prepare('SELECT * FROM video_questions WHERE id = ? AND lesson_id = ?').bind(dupQMatch[2], dupQMatch[1]).first();
    if (!src) return errorResponse('Không tìm thấy câu hỏi.', 404);
    const nid = generateId('vq');
    await env.DB.prepare(
      `INSERT INTO video_questions (id, lesson_id, question_type, title, description, options_json, correct_answer_json, explanation, score, is_required, timestamp_seconds, time_limit_seconds, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(nid, src.lesson_id, src.question_type, `${src.title} (Bản sao)`, src.description, src.options_json, src.correct_answer_json, src.explanation, src.score, src.is_required, Number(src.timestamp_seconds) + 5, src.time_limit_seconds, src.order_index + 1).run();
    return jsonResponse({ id: nid }, 201);
  }

  // ── Watch Session, Anti-Skip Heartbeat & Answer Question ──
  const sessMatch = path.match(/^\/api\/v1\/lessons\/([^/]+)\/session$/);
  if (sessMatch && method === 'POST') {
    const lid = sessMatch[1];
    let session = await env.DB.prepare('SELECT * FROM video_watch_sessions WHERE lesson_id = ? AND student_id = ?').bind(lid, user.id).first();
    if (!session) {
      const sid = generateId('vws');
      await env.DB.prepare('INSERT INTO video_watch_sessions (id, lesson_id, student_id) VALUES (?, ?, ?)').bind(sid, lid, user.id).run();
      session = await env.DB.prepare('SELECT * FROM video_watch_sessions WHERE id = ?').bind(sid).first();
    }
    const segs = (await env.DB.prepare('SELECT start_sec, end_sec FROM watched_segments WHERE session_id = ? ORDER BY start_sec ASC').bind(session.id).all()).results || [];
    return jsonResponse({ session, segments: segs.map((s) => [s.start_sec, s.end_sec]) });
  }

  const hbMatch = path.match(/^\/api\/v1\/lessons\/([^/]+)\/heartbeat$/);
  if (hbMatch && method === 'POST') {
    const lid = hbMatch[1];
    const body = await parseJsonBody(request);
    const les = await env.DB.prepare(
      'SELECT l.*, COALESCE(v.duration_seconds, 120.0) AS duration_seconds FROM lessons l LEFT JOIN videos v ON v.id = l.video_id WHERE l.id = ?'
    ).bind(lid).first();
    if (!les) return errorResponse('Không tìm thấy bài giảng.', 404);

    let session = await env.DB.prepare('SELECT * FROM video_watch_sessions WHERE lesson_id = ? AND student_id = ?').bind(lid, user.id).first();
    if (!session) {
      const sid = generateId('vws');
      await env.DB.prepare('INSERT INTO video_watch_sessions (id, lesson_id, student_id) VALUES (?, ?, ?)').bind(sid, lid, user.id).run();
      session = await env.DB.prepare('SELECT * FROM video_watch_sessions WHERE id = ?').bind(sid).first();
    }
    const wasDone = Boolean(session.is_completed);
    const res = await processWatchHeartbeat(env, session, lid, user.id, body.segment_start, body.segment_end, body.current_time, les.duration_seconds);
    if (res.is_completed && !wasDone) {
      await createNotification(env, user.id, 'lesson_completed', 'Hoàn thành bài giảng', `Bạn đã hoàn thành '${les.title}'.`, `#player/${lid}`);
    }
    return jsonResponse(res);
  }

  const ansMatch = path.match(/^\/api\/v1\/lessons\/([^/]+)\/questions\/([^/]+)\/answer$/);
  if (ansMatch && method === 'POST') {
    const [, lid, qid] = ansMatch;
    const body = await parseJsonBody(request);
    const les = await env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(lid).first();
    const q = await env.DB.prepare('SELECT * FROM video_questions WHERE id = ? AND lesson_id = ?').bind(qid, lid).first();
    if (!les || !q) return errorResponse('Không tìm thấy câu hỏi.', 404);
    let session = await env.DB.prepare('SELECT * FROM video_watch_sessions WHERE lesson_id = ? AND student_id = ?').bind(lid, user.id).first();
    if (!session) {
      const sid = generateId('vws');
      await env.DB.prepare('INSERT INTO video_watch_sessions (id, lesson_id, student_id) VALUES (?, ?, ?)').bind(sid, lid, user.id).run();
      session = await env.DB.prepare('SELECT * FROM video_watch_sessions WHERE id = ?').bind(sid).first();
    }
    const correctAns = JSON.parse(q.correct_answer_json || 'null');
    const { isCorrect, scoreEarned } = gradeQuestion(q.question_type, correctAns, body.answer, q.score);
    await env.DB.prepare(
      'INSERT INTO question_attempts (id, session_id, question_id, student_id, answer_json, is_correct, score_earned) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(generateId('qa'), session.id, qid, user.id, JSON.stringify(body.answer ?? null), isCorrect ? 1 : 0, scoreEarned).run();
    return jsonResponse({
      question_id: qid,
      is_correct: isCorrect,
      score_earned: scoreEarned,
      max_score: Number(q.score),
      explanation: q.explanation,
      correct_answer: correctAns,
      can_continue: Boolean(isCorrect || les.allow_continue_on_wrong),
    });
  }

  return null;
}
