/**
 * EduGlass LMS — Quizzes, Question Bank & Assignments Page
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, openModal, showToast, state } from '../core/store.js';

export async function renderQuizzesPage(container) {
  const isStaff = ['teacher', 'school_admin', 'super_admin'].includes(state.user.role_name);

  async function draw() {
    const [qzRes, asgRes, clsRes] = await Promise.all([
      apiRequest('/api/v1/quizzes'),
      apiRequest('/api/v1/assignments'),
      apiRequest('/api/v1/classrooms'),
    ]);
    const quizzes = qzRes.quizzes || [];
    const assignments = asgRes.assignments || [];
    const classrooms = clsRes.items || [];

    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:20px;">
        <div class="flex-between">
          <div>
            <h2 style="margin:0;">Đề kiểm tra & Bài tập</h2>
            <p class="muted" style="margin:4px 0 0;">Chấm điểm tự động cho câu hỏi khách quan và hỗ trợ chấm tự luận trực tuyến.</p>
          </div>
          ${isStaff ? `
            <div class="flex-row">
              <button class="btn btn-secondary" id="btn-new-asg">+ Giao bài tập</button>
              <button class="btn btn-primary" id="btn-new-quiz">+ Tạo đề kiểm tra</button>
            </div>
          ` : ''}
        </div>

        <div class="grid-2">
          <div class="card">
            <h3 style="margin-top:0;">Đề kiểm tra trực tuyến (${quizzes.length})</h3>
            ${quizzes.map((q) => `
              <div style="padding:12px 0;border-bottom:1px solid var(--border-subtle);">
                <div class="flex-between">
                  <strong>${escapeHtml(q.title)}</strong>
                  <button class="btn btn-primary btn-sm" data-open-quiz="${q.id}">
                    ${isStaff ? 'Xem & Chấm bài' : 'Làm bài'}
                  </button>
                </div>
                <div class="muted" style="margin-top:4px;">
                  ${escapeHtml(q.classroom_name)} • ${q.question_count} câu • ${q.time_limit_minutes} phút • Tối đa ${q.max_attempts} lượt
                </div>
                ${!isStaff && q.my_best_score !== null ? `<span class="pill pill-success" style="margin-top:6px;">Điểm cao nhất: ${q.my_best_score}</span>` : ''}
              </div>
            `).join('') || '<p class="muted">Chưa có đề kiểm tra.</p>'}
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Bài tập tự luận & thực hành (${assignments.length})</h3>
            ${assignments.map((a) => `
              <div style="padding:12px 0;border-bottom:1px solid var(--border-subtle);">
                <div class="flex-between">
                  <strong>${escapeHtml(a.title)}</strong>
                  <button class="btn btn-secondary btn-sm" data-open-asg="${a.id}" data-asg-title="${escapeHtml(a.title)}">
                    ${isStaff ? `Chấm bài (${a.submission_count})` : (a.my_status === 'graded' ? `Điểm: ${a.my_score}` : 'Nộp bài')}
                  </button>
                </div>
                <div class="muted" style="margin-top:4px;">
                  ${escapeHtml(a.classroom_name)} • Điểm tối đa: ${a.max_score} • Hạn: ${a.due_date ? a.due_date.slice(0, 10) : 'Không giới hạn'}
                </div>
              </div>
            `).join('') || '<p class="muted">Chưa có bài tập.</p>'}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-new-asg')?.addEventListener('click', () => {
      openModal('Giao bài tập mới', `
        <form id="new-asg-form">
          <div class="field"><label>Lớp học</label>
            <select class="select" id="na-cls">${classrooms.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Tiêu đề bài tập</label><input class="input" id="na-title" required /></div>
          <div class="field"><label>Yêu cầu chi tiết</label><textarea class="textarea" id="na-desc"></textarea></div>
          <div class="grid-2">
            <div class="field"><label>Điểm tối đa</label><input class="input" id="na-max" type="number" value="100" /></div>
            <div class="field"><label>Hạn nộp</label><input class="input" id="na-due" type="datetime-local" /></div>
          </div>
          <button class="btn btn-primary" type="submit">Giao bài tập</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#new-asg-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          await apiRequest('/api/v1/assignments', {
            method: 'POST',
            body: {
              classroom_id: slot.querySelector('#na-cls').value,
              title: slot.querySelector('#na-title').value,
              description: slot.querySelector('#na-desc').value,
              max_score: Number(slot.querySelector('#na-max').value || 100),
              due_date: slot.querySelector('#na-due').value || null,
            },
          });
          close();
          showToast('Đã giao bài tập cho lớp!', 'success');
          draw();
        });
      });
    });

    document.getElementById('btn-new-quiz')?.addEventListener('click', () => {
      openModal('Tạo đề kiểm tra nhanh', `
        <form id="new-qz-form">
          <div class="field"><label>Lớp học</label>
            <select class="select" id="nq-cls">${classrooms.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Tên đề kiểm tra</label><input class="input" id="nq-title" required /></div>
          <div class="grid-2">
            <div class="field"><label>Thời gian (phút)</label><input class="input" id="nq-time" type="number" value="15" /></div>
            <div class="field"><label>Số lần làm lại</label><input class="input" id="nq-att" type="number" value="2" /></div>
          </div>
          <div class="field"><label>Câu hỏi mẫu 1 (Trắc nghiệm)</label><input class="input" id="nq-q1" required placeholder="2 + 2 bằng bao nhiêu?" /></div>
          <div class="field"><label>Đáp án (cách nhau bằng dấu phẩy)</label><input class="input" id="nq-o1" value="3, 4, 5" required /></div>
          <div class="field"><label>Đáp án đúng</label><input class="input" id="nq-a1" value="4" required /></div>
          <button class="btn btn-primary" type="submit">Tạo đề kiểm tra</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#new-qz-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          await apiRequest('/api/v1/quizzes', {
            method: 'POST',
            body: {
              classroom_id: slot.querySelector('#nq-cls').value,
              title: slot.querySelector('#nq-title').value,
              time_limit_minutes: Number(slot.querySelector('#nq-time').value || 15),
              max_attempts: Number(slot.querySelector('#nq-att').value || 2),
              questions: [
                {
                  question_type: 'multiple_choice',
                  title: slot.querySelector('#nq-q1').value,
                  options: slot.querySelector('#nq-o1').value.split(',').map((s) => s.trim()),
                  correct_answer: slot.querySelector('#nq-a1').value.trim(),
                  score: 10,
                },
              ],
            },
          });
          close();
          showToast('Đã tạo đề kiểm tra!', 'success');
          draw();
        });
      });
    });

    container.querySelectorAll('[data-open-quiz]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const qid = btn.dataset.openQuiz;
        const d = await apiRequest(`/api/v1/quizzes/${qid}`);
        if (isStaff) {
          openModal(`Kết quả: ${d.quiz.title}`, `
            ${d.attempts.map((a) => `
              <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border-subtle);">
                <div><strong>${escapeHtml(a.student_name)}</strong> • Lượt ${a.attempt_number}</div>
                <span class="pill pill-info">${a.total_score} điểm (${a.status})</span>
              </div>
            `).join('') || '<p class="muted">Chưa có học sinh nộp bài.</p>'}
          `);
          return;
        }
        openModal(`Làm bài: ${d.quiz.title}`, `
          <form id="take-quiz-form">
            ${d.questions.map((q, idx) => `
              <div class="card" style="padding:14px;margin-bottom:12px;">
                <strong>Câu ${idx + 1}: ${escapeHtml(q.title)}</strong>
                <div style="margin-top:8px;">
                  ${q.question_type === 'multiple_select'
                    ? q.options.map((o) => `<label style="display:block;margin:4px 0;"><input type="checkbox" name="q_${q.id}" value="${escapeHtml(o)}" /> ${escapeHtml(o)}</label>`).join('')
                    : q.options.length
                      ? q.options.map((o) => `<label style="display:block;margin:4px 0;"><input type="radio" name="q_${q.id}" value="${escapeHtml(o)}" /> ${escapeHtml(o)}</label>`).join('')
                      : `<input class="input" name="q_${q.id}" placeholder="Nhập câu trả lời..." />`}
                </div>
              </div>
            `).join('')}
            <div class="flex-row">
              <button class="btn btn-secondary" type="button" id="btn-save-quiz-draft">Lưu bản nháp</button>
              <button class="btn btn-primary" type="submit">Nộp bài kiểm tra</button>
            </div>
          </form>
        `, (slot, close) => {
          function collectAnswers() {
            const ans = {};
            for (const q of d.questions) {
              if (q.question_type === 'multiple_select') {
                ans[q.id] = [...slot.querySelectorAll(`input[name="q_${q.id}"]:checked`)].map((i) => i.value);
              } else if (q.options.length) {
                const c = slot.querySelector(`input[name="q_${q.id}"]:checked`);
                if (c) ans[q.id] = c.value;
              } else {
                const inp = slot.querySelector(`input[name="q_${q.id}"]`);
                if (inp && inp.value.trim()) ans[q.id] = inp.value.trim();
              }
            }
            return ans;
          }
          slot.querySelector('#btn-save-quiz-draft').addEventListener('click', async () => {
            await apiRequest(`/api/v1/quizzes/${qid}/attempt`, { method: 'POST', body: { answers: collectAnswers(), submit: false } });
            showToast('Đã lưu bản nháp bài làm.', 'success');
          });
          slot.querySelector('#take-quiz-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            try {
              const r = await apiRequest(`/api/v1/quizzes/${qid}/attempt`, { method: 'POST', body: { answers: collectAnswers(), submit: true } });
              close();
              showToast(`Đã nộp bài! Điểm tự động: ${r.auto_score} (${r.correct_count}/${r.answered_count} câu đúng).`, 'success');
              draw();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        });
      });
    });

    container.querySelectorAll('[data-open-asg]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const aid = btn.dataset.openAsg;
        const title = btn.dataset.asgTitle;
        if (isStaff) {
          const r = await apiRequest(`/api/v1/assignments/${aid}/submissions`);
          openModal(`Bài nộp: ${title}`, `
            ${r.submissions.map((s) => `
              <div class="card" style="padding:12px;margin-bottom:10px;">
                <div class="flex-between"><strong>${escapeHtml(s.student_name)}</strong><span class="pill pill-info">${s.status}</span></div>
                <p style="margin:6px 0;">${escapeHtml(s.content)}</p>
                <div class="flex-row">
                  <input class="input" type="number" id="sc_${s.id}" value="${s.score ?? 90}" style="width:100px;" />
                  <input class="input" id="fb_${s.id}" value="${escapeHtml(s.feedback || 'Làm bài tốt!')}" style="flex:1;" />
                  <button class="btn btn-primary btn-sm" data-grade-sub="${s.id}">Lưu điểm</button>
                </div>
              </div>
            `).join('') || '<p class="muted">Chưa có bài nộp.</p>'}
          `, (slot, close) => {
            slot.querySelectorAll('[data-grade-sub]').forEach((g) => {
              g.addEventListener('click', async () => {
                const sid = g.dataset.gradeSub;
                await apiRequest(`/api/v1/assignments/submissions/${sid}/grade`, {
                  method: 'PUT',
                  body: {
                    score: Number(slot.querySelector(`#sc_${sid}`).value),
                    feedback: slot.querySelector(`#fb_${sid}`).value,
                  },
                });
                close();
                showToast('Đã chấm điểm bài tập!', 'success');
                draw();
              });
            });
          });
        } else {
          openModal(`Nộp bài tập: ${title}`, `
            <form id="sub-asg-form">
              <div class="field"><label>Nội dung bài làm</label><textarea class="textarea" id="sa-content" required></textarea></div>
              <div class="flex-row">
                <button class="btn btn-secondary" type="button" id="sa-draft">Lưu nháp</button>
                <button class="btn btn-primary" type="submit">Nộp bài</button>
              </div>
            </form>
          `, (slot, close) => {
            slot.querySelector('#sa-draft').addEventListener('click', async () => {
              await apiRequest(`/api/v1/assignments/${aid}/submit`, {
                method: 'POST',
                body: { content: slot.querySelector('#sa-content').value, submit: false },
              });
              showToast('Đã lưu bản nháp.', 'success');
            });
            slot.querySelector('#sub-asg-form').addEventListener('submit', async (ev) => {
              ev.preventDefault();
              await apiRequest(`/api/v1/assignments/${aid}/submit`, {
                method: 'POST',
                body: { content: slot.querySelector('#sa-content').value, submit: true },
              });
              close();
              showToast('Đã nộp bài tập thành công!', 'success');
              draw();
            });
          });
        }
      });
    });
  }

  draw();
}
