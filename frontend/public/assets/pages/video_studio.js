/**
 * EduGlass LMS — Teacher Video Learning Studio
 * Upload MP4/WebM, manage lessons & versions, drag-and-drop Timeline Question Editor.
 */
import { apiRequest, getToken, uploadWithProgress } from '../core/api.js';
import { escapeHtml, openModal, showToast } from '../core/store.js';
import { detectAudioCodec, transcodeAudioToAAC } from '../core/audio_checker.js';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Trắc nghiệm 1 đáp án (Multiple Choice)' },
  { value: 'true_false', label: 'Đúng / Sai (True / False)' },
  { value: 'multiple_select', label: 'Chọn nhiều đáp án (Multiple Select)' },
  { value: 'fill_blank', label: 'Điền vào chỗ trống (Fill in the Blank)' },
  { value: 'short_answer', label: 'Trả lời ngắn (Short Answer)' },
  { value: 'matching', label: 'Ghép cặp (Matching JSON)' },
];

export async function renderVideoStudioPage(container, navigate) {
  let selectedLessonId = null;

  async function draw() {
    const [clsRes, vidRes, lesRes] = await Promise.all([
      apiRequest('/api/v1/classrooms'),
      apiRequest('/api/v1/videos'),
      apiRequest('/api/v1/lessons'),
    ]);
    const classrooms = clsRes.items || [];
    const videos = vidRes.videos || [];
    const lessons = lesRes.lessons || [];
    if (!selectedLessonId && lessons.length) {
      selectedLessonId = lessons[0].id;
    }

    let detail = null;
    if (selectedLessonId) {
      try {
        detail = await apiRequest(`/api/v1/lessons/${selectedLessonId}`);
      } catch {
        selectedLessonId = null;
      }
    }

    const duration = Math.max(1, Number(detail?.lesson?.duration_seconds || 12));

    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
        <div class="flex-between">
          <div>
            <h2 style="margin:0;">Video Learning Studio</h2>
            <p class="muted" style="margin:4px 0 0;">Tải video MP4/WebM, gắn câu hỏi tương tác trực tiếp lên timeline và xem trước bài giảng.</p>
          </div>
          <div class="flex-row">
            <button class="btn btn-secondary" id="btn-upload-video">↑ Tải video lên</button>
            <button class="btn btn-primary" id="btn-new-lesson">+ Tạo bài giảng</button>
          </div>
        </div>

        <div class="grid-2" style="grid-template-columns: 310px 1fr;">
          <div class="card" style="display:flex;flex-direction:column;gap:10px;">
            <h3 style="margin:0;">Danh sách bài giảng (${lessons.length})</h3>
            ${lessons.map((l) => `
              <button class="nav-item ${l.id === selectedLessonId ? 'active' : ''}" data-select-les="${l.id}" style="flex-direction:column;align-items:flex-start;gap:4px;">
                <span>${escapeHtml(l.title)}</span>
                <span style="font-size:0.74rem;opacity:0.85;">${escapeHtml(l.classroom_name)} • ${l.question_count} câu hỏi • ${l.status}</span>
              </button>
            `).join('') || '<p class="muted">Chưa có bài giảng nào.</p>'}

            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-subtle);">
              <div class="kpi-label" style="margin-bottom:8px;">Thư viện video (${videos.length})</div>
              ${videos.map((v) => `
                <div class="flex-between" style="font-size:0.8rem;padding:5px 0;">
                  <span>${escapeHtml(v.title)}</span>
                  <span class="muted">${Math.round(v.duration_seconds)}s</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            ${detail ? `
              <div class="flex-between" style="margin-bottom:12px;">
                <div>
                  <h3 style="margin:0;">${escapeHtml(detail.lesson.title)}</h3>
                  <span class="pill ${detail.lesson.status === 'published' ? 'pill-success' : 'pill-warning'}">${detail.lesson.status} • v${detail.lesson.version}</span>
                </div>
                <div class="flex-row">
                  <button class="btn btn-secondary btn-sm" id="btn-toggle-publish">
                    ${detail.lesson.status === 'published' ? 'Chuyển nháp' : 'Xuất bản bài giảng'}
                  </button>
                  <button class="btn btn-primary btn-sm" id="btn-preview-player">Phát thử bài giảng</button>
                </div>
              </div>

              <div class="video-stage">
                <video id="studio-video" controls preload="metadata"
                  src="${detail.lesson.video_id ? `/api/v1/videos/${detail.lesson.video_id}/stream?token=${encodeURIComponent(getToken())}` : ''}"></video>
              </div>

              <div style="margin-top:14px;">
                <div class="flex-between">
                  <strong>Timeline câu hỏi tương tác (Nhấn lên thanh để thêm hoặc kéo marker để đổi giây)</strong>
                  <button class="btn btn-primary btn-sm" id="btn-add-vq">+ Thêm câu hỏi tại vị trí hiện tại</button>
                </div>
                <div class="timeline-track" id="studio-timeline" data-duration="${duration}" title="Nhấn để tạo câu hỏi tại timestamp này">
                  ${detail.questions.map((q, idx) => {
                    const leftPct = Math.min(97, Math.max(3, (q.timestamp_seconds / duration) * 100));
                    return `<div class="timeline-marker ${q.is_required ? 'required' : ''}" draggable="true"
                      data-marker-id="${q.id}" style="left:${leftPct}%;"
                      title="${escapeHtml(q.title)} (${q.timestamp_seconds}s)">${idx + 1}</div>`;
                  }).join('')}
                </div>
              </div>

              <h4 style="margin:14px 0 8px;">Danh sách câu hỏi (${detail.questions.length})</h4>
              ${detail.questions.map((q, idx) => `
                <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-subtle);">
                  <div>
                    <span class="pill pill-info">#${idx + 1} • ${q.timestamp_seconds}s</span>
                    <span class="pill ${q.is_required ? 'pill-warning' : 'pill-success'}">${q.is_required ? 'Bắt buộc' : 'Tùy chọn'}</span>
                    <strong style="margin-left:6px;">${escapeHtml(q.title)}</strong>
                    <div class="muted" style="margin-top:3px;">Loại: ${q.question_type} • Điểm: ${q.score}</div>
                  </div>
                  <div class="flex-row">
                    <button class="btn btn-secondary btn-sm" data-dup-vq="${q.id}">Nhân bản</button>
                    <button class="btn btn-danger btn-sm" data-del-vq="${q.id}">Xóa</button>
                  </div>
                </div>
              `).join('') || '<p class="muted">Chưa có câu hỏi nào trên timeline.</p>'}
            ` : '<p class="muted">Chọn hoặc tạo mới một bài giảng để bắt đầu thiết kế.</p>'}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-select-les]').forEach((b) => {
      b.addEventListener('click', () => {
        selectedLessonId = b.dataset.selectLes;
        draw();
      });
    });

    document.getElementById('btn-preview-player')?.addEventListener('click', () => {
      navigate('player', selectedLessonId);
    });

    document.getElementById('btn-toggle-publish')?.addEventListener('click', async () => {
      const next = detail.lesson.status === 'published' ? 'draft' : 'published';
      await apiRequest(`/api/v1/lessons/${selectedLessonId}`, {
        method: 'PUT',
        body: { status: next, bump_version: next === 'published' },
      });
      showToast(`Đã cập nhật trạng thái: ${next}`, 'success');
      draw();
    });

    document.getElementById('btn-upload-video')?.addEventListener('click', () => {
      openModal('Tải video bài giảng lên (Tối đa 2GB — MP4 / WebM)', `
        <form id="upload-vid-form">
          <div class="field"><label>Tiêu đề video</label><input class="input" id="uv-title" required /></div>
          <div class="field">
            <label>Chọn tệp video (.mp4, .webm — Tối đa 2GB)</label>
            <input class="input" id="uv-file" type="file" accept="video/mp4,video/webm" required />
          </div>
          <div id="uv-audio-status" style="margin-top:-6px;margin-bottom:12px;"></div>
          <div class="field">
            <label>Thời lượng (giây — tự động tính khi chọn video)</label>
            <input class="input" id="uv-dur" type="number" value="60" min="1" />
          </div>
          <div class="progress-track" style="margin-bottom:12px;"><div class="progress-fill" id="uv-prog" style="width:0%;"></div></div>
          <div class="muted" id="uv-status-text" style="font-size:0.8rem;margin-bottom:12px;display:none;"></div>
          <button class="btn btn-primary" type="submit" id="btn-submit-upload">Bắt đầu tải lên</button>
        </form>
      `, (slot, close) => {
        let activeFile = null;
        const fileInput = slot.querySelector('#uv-file');
        const audioStatusHost = slot.querySelector('#uv-audio-status');
        const statusText = slot.querySelector('#uv-status-text');
        const submitBtn = slot.querySelector('#btn-submit-upload');

        fileInput.addEventListener('change', async () => {
          const f = fileInput.files[0];
          if (!f) return;
          activeFile = f;

          if (!slot.querySelector('#uv-title').value) {
            slot.querySelector('#uv-title').value = f.name.replace(/\.[^.]+$/, '');
          }

          audioStatusHost.innerHTML = `
            <div class="pill pill-info" style="width:100%;padding:7px 12px;font-size:0.78rem;">
              <span>🔍 Đang quét và kiểm tra luồng âm thanh...</span>
            </div>
          `;

          try {
            const meta = await detectAudioCodec(f);
            const durInput = slot.querySelector('#uv-dur');
            if (durInput && meta.duration) {
              durInput.value = Math.round(meta.duration);
            }

            if (meta.isCompatible) {
              audioStatusHost.innerHTML = `
                <div class="pill pill-success" style="width:100%;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
                  <span>✅ ${escapeHtml(meta.message)}</span>
                  <span style="font-family:var(--font-mono);font-size:0.75rem;">${escapeHtml(meta.badge)}</span>
                </div>
              `;
            } else {
              audioStatusHost.innerHTML = `
                <div class="card" style="padding:12px;border-left:4px solid var(--warning);background:rgba(245, 158, 11, 0.1);">
                  <div style="font-weight:700;color:var(--warning);font-size:0.86rem;margin-bottom:4px;">
                    ⚠️ ${escapeHtml(meta.message)}
                  </div>
                  <p class="muted" style="margin:0 0 10px;font-size:0.78rem;">
                    Âm thanh ${escapeHtml(meta.codec)} có thể bị câm tiếng trên trình duyệt. Bạn có thể tự động chuyển đổi sang AAC chuẩn bằng FFmpeg Web ngay tại đây mà vẫn giữ nguyên 100% video gốc.
                  </p>
                  <button class="btn btn-secondary btn-sm" id="btn-transcode-aac" type="button" style="background:#F59E0B;color:#fff;border:none;font-weight:700;">
                    ⚡ Tự động chuyển đổi âm thanh sang AAC bằng FFmpeg Web
                  </button>
                </div>
              `;

              slot.querySelector('#btn-transcode-aac')?.addEventListener('click', async () => {
                const transBtn = slot.querySelector('#btn-transcode-aac');
                if (transBtn) {
                  transBtn.disabled = true;
                  transBtn.textContent = '⏳ Đang khởi động FFmpeg Web...';
                }
                statusText.style.display = 'block';

                try {
                  const transcoded = await transcodeAudioToAAC(f, (pct, msg) => {
                    slot.querySelector('#uv-prog').style.width = `${pct}%`;
                    statusText.textContent = msg;
                    if (transBtn) transBtn.textContent = `⏳ ${msg}`;
                  });

                  activeFile = transcoded;
                  showToast('Đã chuyển đổi âm thanh sang AAC thành công!', 'success');
                  audioStatusHost.innerHTML = `
                    <div class="pill pill-success" style="width:100%;padding:8px 12px;">
                      <span>✅ Đã chuyển đổi âm thanh sang AAC Stereo chuẩn Web! Sẵn sàng tải lên.</span>
                    </div>
                  `;
                  statusText.style.display = 'none';
                  slot.querySelector('#uv-prog').style.width = '0%';
                } catch (err) {
                  showToast(err.message, 'error');
                  if (transBtn) {
                    transBtn.disabled = false;
                    transBtn.textContent = '⚡ Thử lại chuyển đổi AAC';
                  }
                  statusText.textContent = `Lỗi: ${err.message}`;
                }
              });
            }
          } catch {
            audioStatusHost.innerHTML = '';
          }
        });

        slot.querySelector('#upload-vid-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const fileToUpload = activeFile || fileInput.files[0];
          if (!fileToUpload) return;

          submitBtn.disabled = true;
          submitBtn.textContent = 'Đang tải lên...';
          statusText.style.display = 'block';
          statusText.textContent = `Đang tải lên (${(fileToUpload.size / (1024 * 1024)).toFixed(1)} MB)...`;

          const fd = new FormData();
          fd.append('file', fileToUpload);
          fd.append('title', slot.querySelector('#uv-title').value);
          fd.append('duration_seconds', slot.querySelector('#uv-dur').value);

          try {
            await uploadWithProgress('/api/v1/videos/upload', fd, (pct) => {
              slot.querySelector('#uv-prog').style.width = `${pct}%`;
              statusText.textContent = `Đang tải lên: ${pct}%...`;
            });
            close();
            showToast('Tải video lên thành công!', 'success');
            draw();
          } catch (err) {
            showToast(err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Bắt đầu tải lên';
            statusText.textContent = `Lỗi: ${err.message}`;
          }
        });
      });
    });

    document.getElementById('btn-new-lesson')?.addEventListener('click', () => {
      openModal('Tạo bài giảng video mới', `
        <form id="new-les-form">
          <div class="field"><label>Lớp học</label>
            <select class="select" id="nl-cls">${classrooms.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Chọn video từ thư viện</label>
            <select class="select" id="nl-vid">${videos.map((v) => `<option value="${v.id}">${escapeHtml(v.title)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Tên bài giảng</label><input class="input" id="nl-title" required /></div>
          <div class="field"><label>Mô tả</label><textarea class="textarea" id="nl-desc"></textarea></div>
          <div class="field"><label>Trạng thái</label>
            <select class="select" id="nl-status"><option value="published">Xuất bản ngay</option><option value="draft">Bản nháp</option></select>
          </div>
          <button class="btn btn-primary" type="submit">Tạo bài giảng</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#new-les-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            const r = await apiRequest('/api/v1/lessons', {
              method: 'POST',
              body: {
                classroom_id: slot.querySelector('#nl-cls').value,
                video_id: slot.querySelector('#nl-vid').value || null,
                title: slot.querySelector('#nl-title').value,
                description: slot.querySelector('#nl-desc').value,
                status: slot.querySelector('#nl-status').value,
              },
            });
            selectedLessonId = r.lesson.id;
            close();
            showToast('Đã tạo bài giảng mới!', 'success');
            draw();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    });

    function openQuestionEditorModal(initialTs) {
      openModal('Thêm câu hỏi tương tác trên Timeline', `
        <form id="vq-form">
          <div class="grid-2">
            <div class="field"><label>Loại câu hỏi</label>
              <select class="select" id="vq-type">${QUESTION_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Timestamp (giây)</label>
              <input class="input" id="vq-ts" type="number" step="0.5" min="0" value="${initialTs}" required />
            </div>
          </div>
          <div class="field"><label>Nội dung câu hỏi</label><input class="input" id="vq-title" required /></div>
          <div class="field"><label>Các lựa chọn (mỗi dòng 1 đáp án)</label><textarea class="textarea" id="vq-opts" placeholder="Đáp án A&#10;Đáp án B&#10;Đáp án C"></textarea></div>
          <div class="field"><label>Đáp án đúng (Multiple Select nhập cách nhau bởi dấu phẩy)</label><input class="input" id="vq-ans" required /></div>
          <div class="field"><label>Giải thích sau khi trả lời</label><input class="input" id="vq-exp" /></div>
          <div class="grid-2">
            <div class="field"><label>Điểm số</label><input class="input" id="vq-score" type="number" step="0.5" value="2" /></div>
            <div class="field"><label>Giới hạn thời gian (giây, tùy chọn)</label><input class="input" id="vq-limit" type="number" placeholder="30" /></div>
          </div>
          <label class="flex-row" style="margin-bottom:14px;"><input type="checkbox" id="vq-req" checked /> <span>Câu hỏi bắt buộc (học sinh không thể bỏ qua)</span></label>
          <button class="btn btn-primary" type="submit">Lưu câu hỏi</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#vq-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const qtype = slot.querySelector('#vq-type').value;
          const rawOpts = slot.querySelector('#vq-opts').value.split('\n').map((s) => s.trim()).filter(Boolean);
          const rawAns = slot.querySelector('#vq-ans').value.trim();
          let parsedAns = rawAns;
          if (qtype === 'multiple_select') {
            parsedAns = rawAns.split(',').map((s) => s.trim()).filter(Boolean);
          } else if (qtype === 'matching') {
            try { parsedAns = JSON.parse(rawAns); } catch { parsedAns = { A: rawAns }; }
          }
          try {
            await apiRequest(`/api/v1/lessons/${selectedLessonId}/questions`, {
              method: 'POST',
              body: {
                question_type: qtype,
                title: slot.querySelector('#vq-title').value,
                options: rawOpts,
                correct_answer: parsedAns,
                explanation: slot.querySelector('#vq-exp').value,
                score: Number(slot.querySelector('#vq-score').value || 1),
                is_required: slot.querySelector('#vq-req').checked,
                timestamp_seconds: Number(slot.querySelector('#vq-ts').value || 0),
                time_limit_seconds: slot.querySelector('#vq-limit').value ? Number(slot.querySelector('#vq-limit').value) : null,
              },
            });
            close();
            showToast('Đã gắn câu hỏi lên timeline!', 'success');
            draw();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    }

    document.getElementById('btn-add-vq')?.addEventListener('click', () => {
      const vid = document.getElementById('studio-video');
      const ts = vid ? Math.round((vid.currentTime || 4) * 10) / 10 : 4;
      openQuestionEditorModal(ts);
    });

    const timeline = document.getElementById('studio-timeline');
    timeline?.addEventListener('click', (e) => {
      if (e.target.classList.contains('timeline-marker')) return;
      const rect = timeline.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      openQuestionEditorModal(Math.round(ratio * duration * 10) / 10);
    });

    // Drag-and-drop reposition question markers on timeline
    let draggedId = null;
    timeline?.querySelectorAll('.timeline-marker').forEach((m) => {
      m.addEventListener('dragstart', () => { draggedId = m.dataset.markerId; });
    });
    timeline?.addEventListener('dragover', (e) => e.preventDefault());
    timeline?.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!draggedId || !detail) return;
      const rect = timeline.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTs = Math.round(ratio * duration * 10) / 10;
      const q = detail.questions.find((item) => item.id === draggedId);
      if (!q) return;
      await apiRequest(`/api/v1/lessons/${selectedLessonId}/questions/${q.id}`, {
        method: 'PUT',
        body: {
          question_type: q.question_type,
          title: q.title,
          description: q.description,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          score: q.score,
          is_required: q.is_required,
          timestamp_seconds: newTs,
          time_limit_seconds: q.time_limit_seconds,
          order_index: q.order_index,
        },
      });
      showToast(`Đã di chuyển câu hỏi tới ${newTs}s`, 'success');
      draw();
    });

    container.querySelectorAll('[data-dup-vq]').forEach((b) => {
      b.addEventListener('click', async () => {
        await apiRequest(`/api/v1/lessons/${selectedLessonId}/questions/${b.dataset.dupVq}/duplicate`, { method: 'POST' });
        showToast('Đã nhân bản câu hỏi.', 'success');
        draw();
      });
    });

    container.querySelectorAll('[data-del-vq]').forEach((b) => {
      b.addEventListener('click', async () => {
        await apiRequest(`/api/v1/lessons/${selectedLessonId}/questions/${b.dataset.delVq}`, { method: 'DELETE' });
        showToast('Đã xóa câu hỏi.', 'success');
        draw();
      });
    });
  }

  draw();
}
