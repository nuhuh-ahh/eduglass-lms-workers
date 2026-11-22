/**
 * Cloudflare Workers Route — Dashboards, Analytics & Real CSV/XLSX/PDF Reports
 */
import {
  checkModuleEnabled,
  getCurrentUser,
  jsonResponse,
  requireRoles,
  SECURITY_HEADERS,
} from '../core/http.js';
import { generateId } from '../core/security.js';
import { computeAccuracyPct } from '../services/grading.js';
import { exportCsv, exportPdf, exportXlsx } from '../services/report_exporter.js';

async function queryStudentAnalytics(env, { classroomId = null, studentId = null, teacherId = null } = {}) {
  const conds = [`cm.member_role = 'student'`];
  const params = [];
  if (classroomId) { conds.push('c.id = ?'); params.push(classroomId); }
  if (studentId) { conds.push('u.id = ?'); params.push(studentId); }
  if (teacherId) { conds.push('c.teacher_id = ?'); params.push(teacherId); }

  const members = (await env.DB.prepare(
    `SELECT DISTINCT u.id AS student_id, u.full_name, u.email, c.id AS classroom_id, c.name AS classroom_name
     FROM classroom_members cm
     JOIN users u ON u.id = cm.user_id
     JOIN classrooms c ON c.id = cm.classroom_id
     WHERE ${conds.join(' AND ')}
     ORDER BY c.name ASC, u.full_name ASC`
  ).bind(...params).all()).results || [];

  const rows = [];
  for (const m of members) {
    const totalLessons = (await env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM lessons WHERE classroom_id = ? AND status = 'published'`
    ).bind(m.classroom_id).first())?.cnt || 0;

    const sess = await env.DB.prepare(
      `SELECT COUNT(*) AS sessions_count,
              COALESCE(SUM(vws.total_watched_seconds), 0) AS watched_sec,
              COALESCE(SUM(CASE WHEN vws.is_completed = 1 THEN 1 ELSE 0 END), 0) AS completed_lessons,
              COALESCE(SUM(vws.suspicious_seek_count), 0) AS seek_anomalies
       FROM video_watch_sessions vws JOIN lessons l ON l.id = vws.lesson_id
       WHERE vws.student_id = ? AND l.classroom_id = ?`
    ).bind(m.student_id, m.classroom_id).first();

    const vq = await env.DB.prepare(
      `SELECT COUNT(*) AS answered, COALESCE(SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
       FROM question_attempts qa
       JOIN video_questions vq ON vq.id = qa.question_id
       JOIN lessons l ON l.id = vq.lesson_id
       WHERE qa.student_id = ? AND l.classroom_id = ?`
    ).bind(m.student_id, m.classroom_id).first();

    const qz = await env.DB.prepare(
      `SELECT COALESCE(SUM(qa.answered_count), 0) AS answered, COALESCE(SUM(qa.correct_count), 0) AS correct
       FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.student_id = ? AND q.classroom_id = ? AND qa.status != 'in_progress'`
    ).bind(m.student_id, m.classroom_id).first();

    const totalAnswered = Number(vq?.answered || 0) + Number(qz?.answered || 0);
    const totalCorrect = Number(vq?.correct || 0) + Number(qz?.correct || 0);
    const completed = Number(sess?.completed_lessons || 0);

    rows.push({
      student_id: m.student_id,
      full_name: m.full_name,
      email: m.email,
      classroom_id: m.classroom_id,
      classroom_name: m.classroom_name,
      sessions_count: Number(sess?.sessions_count || 0),
      study_minutes: Math.round((Number(sess?.watched_sec || 0) / 60) * 10) / 10,
      completed_lessons: completed,
      incomplete_lessons: Math.max(0, Number(totalLessons) - completed),
      correct_answers: totalCorrect,
      wrong_answers: Math.max(0, totalAnswered - totalCorrect),
      total_answered: totalAnswered,
      accuracy_pct: computeAccuracyPct(totalCorrect, totalAnswered),
      seek_anomalies: Number(sess?.seek_anomalies || 0),
    });
  }
  return rows;
}

export async function handleAnalyticsReportRoutes(request, env, path) {
  if (!path.startsWith('/api/v1/dashboard') && !path.startsWith('/api/v1/analytics') && !path.startsWith('/api/v1/reports')) {
    return null;
  }

  const authRes = await getCurrentUser(request, env);
  if (authRes.error) return authRes.error;
  const user = authRes.user;
  const url = new URL(request.url);

  if (path === '/api/v1/dashboard/overview' && request.method === 'GET') {
    const modErr = await checkModuleEnabled(env, 'analytics');
    if (modErr) return modErr;

    if (user.role_name === 'student') {
      const courses = (await env.DB.prepare(
        `SELECT c.id, c.name, c.code, c.subject, u.display_name AS teacher_name
         FROM classrooms c JOIN classroom_members cm ON cm.classroom_id = c.id JOIN users u ON u.id = c.teacher_id
         WHERE cm.user_id = ? AND cm.member_role = 'student'`
      ).bind(user.id).all()).results || [];

      const continueLessons = (await env.DB.prepare(
        `SELECT l.id, l.title, c.name AS classroom_name, COALESCE(vws.watch_progress_pct, 0) AS progress_pct, l.due_date
         FROM lessons l JOIN classrooms c ON c.id = l.classroom_id
         JOIN classroom_members cm ON cm.classroom_id = c.id AND cm.user_id = ?
         LEFT JOIN video_watch_sessions vws ON vws.lesson_id = l.id AND vws.student_id = ?
         WHERE l.status = 'published' ORDER BY l.created_at DESC LIMIT 6`
      ).bind(user.id, user.id).all()).results || [];

      const pendingAssignments = (await env.DB.prepare(
        `SELECT a.id, a.title, a.due_date, c.name AS classroom_name
         FROM assignments a JOIN classrooms c ON c.id = a.classroom_id
         JOIN classroom_members cm ON cm.classroom_id = c.id AND cm.user_id = ?
         LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
         WHERE a.status = 'published' AND (s.status IS NULL OR s.status = 'draft') LIMIT 8`
      ).bind(user.id, user.id).all()).results || [];

      const stats = await queryStudentAnalytics(env, { studentId: user.id });
      const totalCorrect = stats.reduce((a, r) => a + r.correct_answers, 0);
      const totalAnswered = stats.reduce((a, r) => a + r.total_answered, 0);
      const completed = stats.reduce((a, r) => a + r.completed_lessons, 0);
      const totalLes = stats.reduce((a, r) => a + r.completed_lessons + r.incomplete_lessons, 0);

      return jsonResponse({
        role: 'student',
        widgets: {
          my_courses: courses.length,
          learning_progress_pct: totalLes > 0 ? Math.round((completed / totalLes) * 1000) / 10 : 0,
          completed_lessons: completed,
          pending_assignments: pendingAssignments.length,
          study_minutes: Math.round(stats.reduce((a, r) => a + r.study_minutes, 0) * 10) / 10,
          accuracy_pct: computeAccuracyPct(totalCorrect, totalAnswered),
        },
        courses,
        continue_lessons: continueLessons,
        upcoming_deadlines: pendingAssignments,
        achievements: [
          { title: 'Người học tiên phong', earned: completed >= 1 },
          { title: 'Chính xác ≥ 80%', earned: computeAccuracyPct(totalCorrect, totalAnswered) >= 80 && totalAnswered > 0 },
          { title: 'Hoàn thành 5 bài giảng', earned: completed >= 5 },
        ],
      });
    }

    const teacherScope = user.role_name === 'teacher' ? user.id : null;
    const rows = await queryStudentAnalytics(env, { teacherId: teacherScope });
    const activeClasses = (await env.DB.prepare(teacherScope ? 'SELECT COUNT(*) AS c FROM classrooms WHERE teacher_id = ?' : 'SELECT COUNT(*) AS c FROM classrooms').bind(...(teacherScope ? [teacherScope] : [])).first())?.c || 0;
    const pubLessons = (await env.DB.prepare(teacherScope ? `SELECT COUNT(*) AS c FROM lessons WHERE teacher_id = ? AND status = 'published'` : `SELECT COUNT(*) AS c FROM lessons WHERE status = 'published'`).bind(...(teacherScope ? [teacherScope] : [])).first())?.c || 0;
    const totalCorrect = rows.reduce((a, r) => a + r.correct_answers, 0);
    const totalAnswered = rows.reduce((a, r) => a + r.total_answered, 0);
    const totalComp = rows.reduce((a, r) => a + r.completed_lessons, 0);
    const totalExp = rows.reduce((a, r) => a + r.completed_lessons + r.incomplete_lessons, 0);

    const classProgress = (await env.DB.prepare(
      `SELECT c.name, COALESCE(ROUND(AVG(vws.watch_progress_pct), 1), 0) AS avg_progress
       FROM classrooms c LEFT JOIN lessons l ON l.classroom_id = c.id LEFT JOIN video_watch_sessions vws ON vws.lesson_id = l.id
       GROUP BY c.id ORDER BY c.name ASC LIMIT 10`
    ).all()).results || [];

    const lessonComp = (await env.DB.prepare(
      `SELECT l.title, COALESCE(ROUND(AVG(vws.watch_progress_pct), 1), 0) AS avg_progress
       FROM lessons l LEFT JOIN video_watch_sessions vws ON vws.lesson_id = l.id
       GROUP BY l.id ORDER BY l.created_at DESC LIMIT 8`
    ).all()).results || [];

    const recent = (await env.DB.prepare(
      `SELECT a.action, a.resource_type, a.created_at, COALESCE(u.display_name, 'System') AS actor
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 8`
    ).all()).results || [];

    return jsonResponse({
      role: user.role_name,
      widgets: {
        total_students: new Set(rows.map((r) => r.student_id)).size,
        active_classes: activeClasses,
        published_lessons: pubLessons,
        total_learning_sessions: rows.reduce((a, r) => a + r.sessions_count, 0),
        completion_rate_pct: totalExp > 0 ? Math.round((totalComp / totalExp) * 1000) / 10 : 0,
        average_accuracy_pct: computeAccuracyPct(totalCorrect, totalAnswered),
        pending_assignments: 0,
      },
      charts: { class_progress: classProgress, lesson_comparison: lessonComp, daily_sessions: [] },
      recent_activities: recent,
    });
  }

  if (path === '/api/v1/analytics/students' && request.method === 'GET') {
    const modErr = await checkModuleEnabled(env, 'analytics');
    if (modErr) return modErr;
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;

    const rows = await queryStudentAnalytics(env, {
      classroomId: url.searchParams.get('classroom_id') || null,
      teacherId: user.role_name === 'teacher' ? user.id : null,
    });
    const participated = rows.filter((r) => r.sessions_count > 0).length;
    const totalComp = rows.reduce((a, r) => a + r.completed_lessons, 0);
    const totalExp = rows.reduce((a, r) => a + r.completed_lessons + r.incomplete_lessons, 0);
    const totalCorrect = rows.reduce((a, r) => a + r.correct_answers, 0);
    const totalAnswered = rows.reduce((a, r) => a + r.total_answered, 0);

    return jsonResponse({
      class_summary: {
        total_students: rows.length,
        participated_students: participated,
        not_participated_students: rows.length - participated,
        total_sessions: rows.reduce((a, r) => a + r.sessions_count, 0),
        completion_rate_pct: totalExp > 0 ? Math.round((totalComp / totalExp) * 1000) / 10 : 0,
        average_accuracy_pct: computeAccuracyPct(totalCorrect, totalAnswered),
      },
      students: rows,
      formula: 'Accuracy = Correct Answers / Total Answered Questions * 100%',
    });
  }

  if (path === '/api/v1/reports/export' && request.method === 'GET') {
    const modErr = await checkModuleEnabled(env, 'report_export');
    if (modErr) return modErr;
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;

    const fmt = (url.searchParams.get('fmt') || 'csv').toLowerCase();
    const classroomId = url.searchParams.get('classroom_id') || null;
    const rows = await queryStudentAnalytics(env, {
      classroomId,
      teacherId: user.role_name === 'teacher' ? user.id : null,
    });

    await env.DB.prepare(
      `INSERT INTO reports (id, requester_id, classroom_id, report_type, export_format, filters_json)
       VALUES (?, ?, ?, 'student_analytics', ?, ?)`
    ).bind(generateId('rpt'), user.id, classroomId, ['csv', 'xlsx', 'pdf'].includes(fmt) ? fmt : 'csv', JSON.stringify({ classroomId })).run();

    if (fmt === 'xlsx') {
      return new Response(exportXlsx(rows), {
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="eduglass-report.xlsx"',
        },
      });
    }
    if (fmt === 'pdf') {
      return new Response(exportPdf(rows), {
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="eduglass-report.pdf"',
        },
      });
    }
    return new Response(exportCsv(rows), {
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="eduglass-report.csv"',
      },
    });
  }

  return null;
}
