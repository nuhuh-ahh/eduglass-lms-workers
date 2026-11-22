/**
 * Cloudflare Workers Route — Quizzes, Question Bank & Assignments
 */
import {
  checkModuleEnabled,
  createNotification,
  errorResponse,
  getCurrentUser,
  jsonResponse,
  parseJsonBody,
  requireRoles,
} from '../core/http.js';
import { generateId, sanitizeText } from '../core/security.js';
import { gradeQuestion } from '../services/grading.js';

export async function handleQuizAssignmentRoutes(request, env, path) {
  if (!path.startsWith('/api/v1/quizzes') && !path.startsWith('/api/v1/assignments') && !path.startsWith('/api/v1/question-bank') && !path.startsWith('/api/v1/quiz-attempts')) {
    return null;
  }

  const authRes = await getCurrentUser(request, env);
  if (authRes.error) return authRes.error;
  const user = authRes.user;
  const method = request.method;

  if (path.startsWith('/api/v1/quizzes') || path.startsWith('/api/v1/question-bank') || path.startsWith('/api/v1/quiz-attempts')) {
    const modErr = await checkModuleEnabled(env, 'quiz');
    if (modErr) return modErr;
  }
  if (path.startsWith('/api/v1/assignments')) {
    const modErr = await checkModuleEnabled(env, 'assignment');
    if (modErr) return modErr;
  }

  // Quizzes List & Create
  if (path === '/api/v1/quizzes' && method === 'GET') {
    const quizzes = (await env.DB.prepare(
      `SELECT q.*, c.name AS classroom_name,
              (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
              (SELECT MAX(total_score) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.student_id = ? AND qa.status != 'in_progress') AS my_best_score
       FROM quizzes q JOIN classrooms c ON c.id = q.classroom_id ORDER BY q.created_at DESC`
    ).bind(user.id).all()).results || [];
    return jsonResponse({ quizzes });
  }

  if (path === '/api/v1/quizzes' && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    const qid = generateId('qz');
    await env.DB.prepare(
      `INSERT INTO quizzes (id, classroom_id, teacher_id, title, description, time_limit_minutes, due_date, max_score, max_attempts, show_answers_after_submit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(qid, body.classroom_id, user.id, sanitizeText(body.title), sanitizeText(body.description || ''), Number(body.time_limit_minutes || 30), body.due_date || null, Number(body.max_score || 100), Number(body.max_attempts || 2), body.show_answers_after_submit === false ? 0 : 1).run();
    for (const [idx, qq] of (body.questions || []).entries()) {
      await env.DB.prepare(
        `INSERT INTO quiz_questions (id, quiz_id, question_type, title, description, options_json, correct_answer_json, explanation, score, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(generateId('qq'), qid, qq.question_type || 'multiple_choice', sanitizeText(qq.title), sanitizeText(qq.description || ''), JSON.stringify(qq.options || []), JSON.stringify(qq.correct_answer ?? ''), sanitizeText(qq.explanation || ''), Number(qq.score || 1), idx).run();
    }
    return jsonResponse({ id: qid, message: 'Đã tạo đề kiểm tra.' }, 201);
  }

  const qDetail = path.match(/^\/api\/v1\/quizzes\/([^/]+)$/);
  if (qDetail && method === 'GET') {
    const qz = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(qDetail[1]).first();
    if (!qz) return errorResponse('Không tìm thấy đề kiểm tra.', 404);
    const isStaff = ['teacher', 'school_admin', 'super_admin'].includes(user.role_name);
    const questions = ((await env.DB.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC').bind(qDetail[1]).all()).results || []).map((q) => {
      const d = { ...q, options: JSON.parse(q.options_json || '[]') };
      delete d.options_json;
      if (isStaff) d.correct_answer = JSON.parse(q.correct_answer_json || 'null');
      delete d.correct_answer_json;
      return d;
    });
    const attempts = isStaff
      ? ((await env.DB.prepare('SELECT qa.*, u.full_name AS student_name FROM quiz_attempts qa JOIN users u ON u.id = qa.student_id WHERE qa.quiz_id = ? ORDER BY qa.started_at DESC').bind(qDetail[1]).all()).results || [])
      : ((await env.DB.prepare('SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ? ORDER BY attempt_number DESC').bind(qDetail[1], user.id).all()).results || []);
    return jsonResponse({ quiz: qz, questions, attempts });
  }

  const qAttempt = path.match(/^\/api\/v1\/quizzes\/([^/]+)\/attempt$/);
  if (qAttempt && method === 'POST') {
    const qid = qAttempt[1];
    const body = await parseJsonBody(request);
    const qz = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(qid).first();
    if (!qz) return errorResponse('Không tìm thấy đề kiểm tra.', 404);
    const answers = body.answers || {};
    const submit = body.submit !== false;
    const aid = generateId('qza');

    if (!submit) {
      await env.DB.prepare(
        `INSERT INTO quiz_attempts (id, quiz_id, student_id, attempt_number, status, answers_json) VALUES (?, ?, ?, 1, 'in_progress', ?)`
      ).bind(aid, qid, user.id, JSON.stringify(answers)).run();
      return jsonResponse({ attempt_id: aid, status: 'in_progress', message: 'Đã lưu bản nháp.' });
    }

    const questions = (await env.DB.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC').bind(qid).all()).results || [];
    let autoScore = 0;
    let correctCount = 0;
    let answeredCount = 0;
    let needsManual = false;
    const grading = {};

    for (const q of questions) {
      const ans = answers[q.id];
      const correctAns = JSON.parse(q.correct_answer_json || 'null');
      if (ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0)) answeredCount++;
      const res = gradeQuestion(q.question_type, correctAns, ans, q.score);
      if (res.isCorrect) correctCount++;
      if (res.requiresManual) needsManual = true;
      autoScore += res.scoreEarned;
      grading[q.id] = { is_correct: res.isCorrect, score_earned: res.scoreEarned, max_score: q.score };
    }

    const st = needsManual ? 'submitted' : 'graded';
    await env.DB.prepare(
      `INSERT INTO quiz_attempts (id, quiz_id, student_id, attempt_number, status, answers_json, grading_json, auto_score, total_score, correct_count, answered_count, submitted_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(aid, qid, user.id, st, JSON.stringify(answers), JSON.stringify(grading), autoScore, autoScore, correctCount, answeredCount).run();
    await createNotification(env, user.id, 'quiz_result', `Kết quả: ${qz.title}`, `Bạn đạt ${autoScore} điểm.`, '#quizzes');
    return jsonResponse({ attempt_id: aid, status: st, auto_score: autoScore, correct_count: correctCount, answered_count: answeredCount, grading });
  }

  // Assignments
  if (path === '/api/v1/assignments' && method === 'GET') {
    const assignments = (await env.DB.prepare(
      `SELECT a.*, c.name AS classroom_name,
              (SELECT status FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.student_id = ?) AS my_status,
              (SELECT score FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.student_id = ?) AS my_score,
              (SELECT COUNT(*) FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.status != 'draft') AS submission_count
       FROM assignments a JOIN classrooms c ON c.id = a.classroom_id ORDER BY a.created_at DESC`
    ).bind(user.id, user.id).all()).results || [];
    return jsonResponse({ assignments });
  }

  if (path === '/api/v1/assignments' && method === 'POST') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    const aid = generateId('asg');
    await env.DB.prepare(
      'INSERT INTO assignments (id, classroom_id, teacher_id, title, description, max_score, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(aid, body.classroom_id, user.id, sanitizeText(body.title), sanitizeText(body.description || ''), Number(body.max_score || 100), body.due_date || null).run();
    return jsonResponse({ id: aid, message: 'Đã giao bài tập.' }, 201);
  }

  const subAsg = path.match(/^\/api\/v1\/assignments\/([^/]+)\/submit$/);
  if (subAsg && method === 'POST') {
    const body = await parseJsonBody(request);
    const st = body.submit === false ? 'draft' : 'submitted';
    await env.DB.prepare(
      `INSERT INTO assignment_submissions (id, assignment_id, student_id, content, attachment_url, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'submitted' THEN datetime('now') ELSE NULL END)
       ON CONFLICT(assignment_id, student_id) DO UPDATE SET content = excluded.content, status = excluded.status, updated_at = datetime('now')`
    ).bind(generateId('sub'), subAsg[1], user.id, sanitizeText(body.content || ''), body.attachment_url || '', st, st).run();
    return jsonResponse({ status: st, message: 'Đã lưu bài tập.' });
  }

  const listSub = path.match(/^\/api\/v1\/assignments\/([^/]+)\/submissions$/);
  if (listSub && method === 'GET') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const submissions = (await env.DB.prepare(
      'SELECT s.*, u.full_name AS student_name, u.email AS student_email FROM assignment_submissions s JOIN users u ON u.id = s.student_id WHERE s.assignment_id = ?'
    ).bind(listSub[1]).all()).results || [];
    return jsonResponse({ submissions });
  }

  const gradeSub = path.match(/^\/api\/v1\/assignments\/submissions\/([^/]+)\/grade$/);
  if (gradeSub && method === 'PUT') {
    const roleErr = requireRoles(user, ['teacher', 'school_admin', 'super_admin']);
    if (roleErr) return roleErr;
    const body = await parseJsonBody(request);
    await env.DB.prepare(
      `UPDATE assignment_submissions SET score = ?, feedback = ?, status = 'graded', graded_at = datetime('now') WHERE id = ?`
    ).bind(Number(body.score || 0), sanitizeText(body.feedback || ''), gradeSub[1]).run();
    return jsonResponse({ submission_id: gradeSub[1], status: 'graded' });
  }

  return null;
}
