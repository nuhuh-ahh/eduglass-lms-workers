/**
 * EduGlass LMS (Cloudflare Workers) — 6-Type Grading Engine & Accuracy Formula
 */

function norm(v) {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function gradeQuestion(questionType, correctAnswer, submittedAnswer, maxScore) {
  if (submittedAnswer === null || submittedAnswer === undefined || submittedAnswer === '' || (Array.isArray(submittedAnswer) && !submittedAnswer.length)) {
    return { isCorrect: false, scoreEarned: 0, requiresManual: false };
  }
  const qt = String(questionType || '').toLowerCase();
  const max = Number(maxScore || 0);

  if (qt === 'multiple_choice' || qt === 'true_false') {
    const ok = norm(correctAnswer) === norm(submittedAnswer);
    return { isCorrect: ok, scoreEarned: ok ? max : 0, requiresManual: false };
  }

  if (qt === 'multiple_select') {
    const exp = new Set((Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]).map(norm));
    const act = new Set((Array.isArray(submittedAnswer) ? submittedAnswer : [submittedAnswer]).map(norm));
    const ok = exp.size > 0 && exp.size === act.size && [...exp].every((x) => act.has(x));
    return { isCorrect: ok, scoreEarned: ok ? max : 0, requiresManual: false };
  }

  if (qt === 'fill_blank') {
    const accepted = (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]).map(norm);
    const ok = accepted.includes(norm(submittedAnswer));
    return { isCorrect: ok, scoreEarned: ok ? max : 0, requiresManual: false };
  }

  if (qt === 'matching') {
    if (correctAnswer && typeof correctAnswer === 'object' && submittedAnswer && typeof submittedAnswer === 'object') {
      const keys = Object.keys(correctAnswer);
      if (!keys.length) return { isCorrect: false, scoreEarned: 0, requiresManual: false };
      const matches = keys.filter((k) => norm(submittedAnswer[k]) === norm(correctAnswer[k])).length;
      const ok = matches === keys.length;
      return {
        isCorrect: ok,
        scoreEarned: ok ? max : Math.round((matches / keys.length) * max * 100) / 100,
        requiresManual: false,
      };
    }
    return { isCorrect: false, scoreEarned: 0, requiresManual: false };
  }

  if (qt === 'short_answer') {
    if (correctAnswer) {
      const keywords = (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]).map(norm).filter(Boolean);
      const act = norm(submittedAnswer);
      if (keywords.some((k) => act.includes(k))) {
        return { isCorrect: true, scoreEarned: max, requiresManual: false };
      }
    }
    return { isCorrect: false, scoreEarned: 0, requiresManual: true };
  }

  return { isCorrect: false, scoreEarned: 0, requiresManual: false };
}

export function computeAccuracyPct(correctAnswers, totalAnswered) {
  if (!totalAnswered || totalAnswered <= 0) return 0;
  return Math.round((correctAnswers / totalAnswered) * 10000) / 100;
}
