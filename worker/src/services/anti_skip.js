/**
 * EduGlass LMS (Cloudflare Workers) — Backend Anti-Skip Engine on D1
 */
import { generateId } from '../core/security.js';

export function mergeIntervals(intervals, gapTolerance = 1.0) {
  const clean = intervals
    .map(([s, e]) => [Math.max(0, Number(s)), Math.max(0, Number(e))])
    .filter(([s, e]) => e >= s)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!clean.length) return [];
  const merged = [clean[0]];
  for (let i = 1; i < clean.length; i++) {
    const [start, end] = clean[i];
    const last = merged[merged.length - 1];
    if (start <= last[1] + gapTolerance) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

export function computeVerifiedFrontier(mergedSegments, startTolerance = 2.0) {
  if (!mergedSegments.length) return 0;
  const [firstStart, firstEnd] = mergedSegments[0];
  if (firstStart > startTolerance) return 0;
  return Math.round(firstEnd * 100) / 100;
}

export function computeTotalWatched(mergedSegments) {
  const total = mergedSegments.reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0);
  return Math.round(total * 100) / 100;
}

export async function getNextUnansweredRequiredQuestion(env, lessonId, studentId) {
  return env.DB.prepare(
    `SELECT vq.*
     FROM video_questions vq
     WHERE vq.lesson_id = ? AND vq.is_required = 1
       AND NOT EXISTS (
         SELECT 1 FROM question_attempts qa
         WHERE qa.question_id = vq.id AND qa.student_id = ?
       )
     ORDER BY vq.timestamp_seconds ASC, vq.order_index ASC
     LIMIT 1`
  ).bind(lessonId, studentId).first();
}

export async function processWatchHeartbeat(env, session, lessonId, studentId, segmentStart, segmentEnd, currentTime, videoDuration) {
  const sessionId = session.id;
  const frontier = Number(session.verified_frontier || 0);
  const tolerance = Number(env.EDUGLASS_ANTI_SKIP_TOLERANCE || 2.5);
  const maxDelta = Number(env.EDUGLASS_MAX_HEARTBEAT_DELTA || 15.0);

  const barrierQ = await getNextUnansweredRequiredQuestion(env, lessonId, studentId);
  let maxAllowed = frontier + tolerance;
  let barrierReason = null;
  if (barrierQ) {
    const qTs = Number(barrierQ.timestamp_seconds);
    if (qTs + 0.75 < maxAllowed) {
      maxAllowed = qTs + 0.75;
      barrierReason = `blocked_by_required_question:${barrierQ.id}`;
    }
  }

  const segStart = Math.max(0, Number(segmentStart));
  const segEnd = Math.max(segStart, Number(segmentEnd));
  const curT = Math.max(0, Number(currentTime));

  let anomalyReason = '';
  if (segStart > maxAllowed || curT > maxAllowed + maxDelta) {
    anomalyReason = barrierReason || 'seek_past_verified_frontier';
  } else if (segEnd - segStart > maxDelta) {
    anomalyReason = 'heartbeat_segment_too_large';
  } else if (barrierQ && segEnd > Number(barrierQ.timestamp_seconds) + 1.5) {
    anomalyReason = `skipped_required_question:${barrierQ.id}`;
  }

  if (anomalyReason) {
    await env.DB.prepare(
      `INSERT INTO seek_anomalies (id, session_id, from_sec, attempted_to_sec, verified_frontier, reason)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(generateId('sk'), sessionId, Number(session.current_timestamp || 0), curT, frontier, anomalyReason).run();

    await env.DB.prepare(
      `UPDATE video_watch_sessions
       SET suspicious_seek_count = suspicious_seek_count + 1,
           last_heartbeat_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(sessionId).run();

    const safePos = barrierQ ? Math.min(frontier, Number(barrierQ.timestamp_seconds)) : frontier;
    return {
      accepted: false,
      reason: anomalyReason,
      forced_position: Math.round(safePos * 100) / 100,
      verified_frontier: Math.round(frontier * 100) / 100,
      watch_progress_pct: Number(session.watch_progress_pct || 0),
      is_completed: Boolean(session.is_completed),
      blocking_question_id: barrierQ ? barrierQ.id : null,
    };
  }

  if (segEnd > segStart) {
    await env.DB.prepare(
      'INSERT INTO watched_segments (id, session_id, start_sec, end_sec) VALUES (?, ?, ?, ?)'
    ).bind(generateId('seg'), sessionId, segStart, segEnd).run();
  }

  const segRows = await env.DB.prepare(
    'SELECT start_sec, end_sec FROM watched_segments WHERE session_id = ?'
  ).bind(sessionId).all();
  const merged = mergeIntervals((segRows.results || []).map((r) => [r.start_sec, r.end_sec]));
  const newFrontier = Math.max(frontier, computeVerifiedFrontier(merged));
  const totalWatched = computeTotalWatched(merged);
  const duration = Math.max(Number(videoDuration || 0), 1.0);
  const progressPct = Math.min(100, Math.round((totalWatched / duration) * 10000) / 100);

  const remainingReq = await getNextUnansweredRequiredQuestion(env, lessonId, studentId);
  const isCompleted = Boolean(session.is_completed) || (progressPct >= 90 && !remainingReq);

  await env.DB.prepare(
    `UPDATE video_watch_sessions
     SET current_timestamp = ?,
         verified_frontier = ?,
         total_watched_seconds = ?,
         watch_progress_pct = ?,
         is_completed = ?,
         completed_at = CASE WHEN ? = 1 AND completed_at IS NULL THEN datetime('now') ELSE completed_at END,
         last_heartbeat_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    Math.round(Math.min(curT, newFrontier + tolerance) * 100) / 100,
    Math.round(newFrontier * 100) / 100,
    totalWatched,
    progressPct,
    isCompleted ? 1 : 0,
    isCompleted ? 1 : 0,
    sessionId
  ).run();

  return {
    accepted: true,
    reason: 'ok',
    forced_position: null,
    verified_frontier: Math.round(newFrontier * 100) / 100,
    total_watched_seconds: totalWatched,
    watch_progress_pct: progressPct,
    is_completed: isCompleted,
    merged_segments: merged,
    blocking_question_id: remainingReq ? remainingReq.id : null,
  };
}
