/**
 * EduGlass LMS — Interactive Student Video Player + Backend Anti-Skip Engine
 */
import { apiRequest, getToken } from '../core/api.js';
import { escapeHtml, showToast } from '../core/store.js';

export async function renderVideoPlayerPage(container, lessonIdParam = null) {
  const lessonsRes = await apiRequest('/api/v1/lessons');
  const lessons = lessonsRes.lessons || [];
  let lessonId = lessonIdParam || (lessons[0] && lessons[0].id);

  if (!lessonId) {
    container.innerHTML = `<div class="card"><h3>Chưa có bài giảng video</h3><p class="muted">Hãy tham gia lớp học hoặc chờ giáo viên xuất bản bài giảng.</p></div>`;
    return;
  }

  const detail = await apiRequest(`/api/v1/lessons/${lessonId}`);
  let sessRes;
  try {
    sessRes = await apiRequest(`/api/v1/lessons/${lessonId}/session`, { method: 'POST' });
  } catch (err) {
    container.innerHTML = `
      <div class="page-enter card" style="text-align:center;padding:48px 24px;max-width:640px;margin:24px auto;">
        <div style="font-size:3.2rem;margin-bottom:12px;">⏳</div>
        <h3 style="margin:0 0 8px;">Phòng học video đang đầy</h3>
        <p class="muted" style="margin:0 auto 20px;line-height:1.6;font-size:0.92rem;">
          ${escapeHtml(err.message || 'Để bảo vệ đường truyền video Google Drive luôn mượt mà và không bị nghẽn mạng, hệ thống giới hạn 15–20 bạn xem đồng thời.')}
        </p>
        <div class="flex-row" style="justify-content:center;gap:12px;">
          <button class="btn btn-primary" id="btn-retry-session">🔄 Thử vào lại ngay</button>
          <button class="btn btn-secondary" id="btn-back-dashboard">Quay lại trang chủ</button>
        </div>
        <div class="muted" style="margin-top:16px;font-size:0.82rem;">Tự động thử lại sau <span id="retry-sec" style="font-weight:700;color:var(--primary);">10</span> giây...</div>
      </div>
    `;
    let secLeft = 10;
    const interval = setInterval(() => {
      secLeft--;
      const el = document.getElementById('retry-sec');
      if (el) el.textContent = secLeft;
      if (secLeft <= 0) {
        clearInterval(interval);
        renderVideoPlayerPage(container, lessonId);
      }
    }, 1000);
    document.getElementById('btn-retry-session')?.addEventListener('click', () => {
      clearInterval(interval);
      renderVideoPlayerPage(container, lessonId);
    });
    document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
      clearInterval(interval);
      location.hash = '#dashboard';
    });
    return;
  }
  const lesson = detail.lesson;
  const questions = detail.questions || [];
  const answeredIds = new Set((detail.question_attempts || []).map((a) => a.question_id));
  let verifiedFrontier = Number(sessRes.session.verified_frontier || 0);
  let lastAcceptedTime = Number(sessRes.session.current_timestamp || 0);
  let activeOverlayQuestion = null;
  const duration = Math.max(1, Number(lesson.duration_seconds || 12));

  container.innerHTML = `
    <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
      <div class="flex-between">
        <div>
          <h2 style="margin:0;">${escapeHtml(lesson.title)}</h2>
          <p class="muted" style="margin:4px 0 0;">${escapeHtml(lesson.classroom_name)} • Anti-Skip Engine đang bảo vệ tiến độ thực</p>
        </div>
        <select class="select" id="player-lesson-picker" style="width:260px;">
          ${lessons.map((l) => `<option value="${l.id}" ${l.id === lessonId ? 'selected' : ''}>${escapeHtml(l.title)}</option>`).join('')}
        </select>
      </div>

      <div class="card">
        <div class="video-stage">
          ${(() => {
            const key = lesson.storage_key || '';
            const yt = key.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            const drive = key.match(/drive\.google\.com\/(?:file\/(?:u\/\d+\/)?d\/|open\?id=|uc\?id=)([^"&?\/\s]+)/i);
            if (yt) {
              return `<iframe id="lms-yt-frame" src="https://www.youtube.com/embed/${yt[1]}?enablejsapi=1&rel=0"
                style="width:100%;aspect-ratio:16/9;border:none;border-radius:12px;"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>`;
            }
            if (drive) {
              return `<iframe id="lms-drive-frame" src="https://drive.google.com/file/d/${drive[1]}/preview"
                style="width:100%;aspect-ratio:16/9;border:none;border-radius:12px;"
                allow="autoplay" allowfullscreen></iframe>`;
            }
            return `<video id="lms-player" controls preload="metadata"
              src="${lesson.video_id ? `/api/v1/videos/${lesson.video_id}/stream?token=${encodeURIComponent(getToken())}` : ''}"></video>`;
          })()}
          <div id="question-overlay-host"></div>
        </div>

        <div class="timeline-track" style="cursor:default;">
          <div class="timeline-frontier" id="player-frontier-bar" style="width:${Math.min(100, (verifiedFrontier / duration) * 100)}%;"></div>
          ${questions.map((q, i) => {
            const left = Math.min(97, Math.max(3, (q.timestamp_seconds / duration) * 100));
            const done = answeredIds.has(q.id);
            return `<div class="timeline-marker ${q.is_required ? 'required' : ''}" style="left:${left}%;opacity:${done ? '0.55' : '1'};"
              title="${escapeHtml(q.title)} (${q.timestamp_seconds}s)">${done ? '✓' : i + 1}</div>`;
          }).join('')}
        </div>

        <div class="flex-between" style="margin-top:8px;">
          <div>
            <span class="pill pill-info" id="player-progress-pill">Tiến độ: ${sessRes.session.watch_progress_pct || 0}%</span>
            <span class="pill ${sessRes.session.is_completed ? 'pill-success' : 'pill-warning'}" id="player-status-pill">
              ${sessRes.session.is_completed ? 'Đã hoàn thành' : 'Đang học'}
            </span>
          </div>
          <div class="muted" id="player-frontier-label">Mốc đã xác thực: ${verifiedFrontier}s / ${Math.round(duration)}s</div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Các mốc câu hỏi trong bài (${questions.length})</h3>
        ${questions.map((q, i) => `
          <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border-subtle);">
            <span><strong>#${i + 1} (${q.timestamp_seconds}s)</strong> ${escapeHtml(q.title)}</span>
            <span class="pill ${answeredIds.has(q.id) ? 'pill-success' : q.is_required ? 'pill-warning' : 'pill-info'}">
              ${answeredIds.has(q.id) ? 'Đã trả lời' : q.is_required ? 'Bắt buộc' : 'Tùy chọn'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('player-lesson-picker')?.addEventListener('change', (e) => {
    renderVideoPlayerPage(container, e.target.value);
  });

  const video = document.getElementById('lms-player');
  const overlayHost = document.getElementById('question-overlay-host');

  if (video) {
    video.addEventListener('loadedmetadata', () => {
      if (lastAcceptedTime > 0 && lastAcceptedTime < video.duration) {
        video.currentTime = lastAcceptedTime;
      }
    });

    function showQuestionOverlay(q) {
      activeOverlayQuestion = q;
      video.pause();
      let inputHtml = '';
      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        inputHtml = (q.options || []).map((opt, idx) => `
          <label class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:8px;cursor:pointer;">
            <input type="radio" name="vq-choice" value="${escapeHtml(opt)}" ${idx === 0 ? 'required' : ''} />
            <span>${escapeHtml(opt)}</span>
          </label>
        `).join('');
      } else if (q.question_type === 'multiple_select') {
        inputHtml = (q.options || []).map((opt) => `
          <label class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:8px;cursor:pointer;">
            <input type="checkbox" name="vq-multi" value="${escapeHtml(opt)}" />
            <span>${escapeHtml(opt)}</span>
          </label>
        `).join('');
      } else {
        inputHtml = `<input class="input" id="vq-text-answer" required placeholder="Nhập câu trả lời của bạn..." />`;
      }

      overlayHost.innerHTML = `
        <div class="question-overlay" id="active-question-overlay">
          <div class="question-overlay-card">
            <div class="flex-between" style="margin-bottom:8px;">
              <span class="pill ${q.is_required ? 'pill-warning' : 'pill-info'}">${q.is_required ? 'Câu hỏi bắt buộc' : 'Câu hỏi tương tác'} • ${q.timestamp_seconds}s</span>
              <span class="muted">${q.score} điểm</span>
            </div>
            <h3 style="margin:6px 0 8px;">${escapeHtml(q.title)}</h3>
            ${q.description ? `<p class="muted" style="margin:0 0 12px;">${escapeHtml(q.description)}</p>` : ''}
            <form id="overlay-answer-form">
              ${inputHtml}
              <div id="overlay-feedback" style="margin:10px 0;"></div>
              <div class="flex-row" style="margin-top:12px;">
                <button class="btn btn-primary" type="submit" id="overlay-submit-btn">Gửi câu trả lời</button>
                ${!q.is_required ? `<button class="btn btn-secondary" type="button" id="overlay-skip-btn">Bỏ qua</button>` : ''}
              </div>
            </form>
          </div>
        </div>
      `;

      document.getElementById('overlay-skip-btn')?.addEventListener('click', () => {
        answeredIds.add(q.id);
        activeOverlayQuestion = null;
        overlayHost.innerHTML = '';
        video.play().catch(() => {});
      });

      document.getElementById('overlay-answer-form')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        let ans;
        if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
          const checked = overlayHost.querySelector('input[name="vq-choice"]:checked');
          ans = checked ? checked.value : '';
        } else if (q.question_type === 'multiple_select') {
          ans = [...overlayHost.querySelectorAll('input[name="vq-multi"]:checked')].map((i) => i.value);
        } else {
          ans = overlayHost.querySelector('#vq-text-answer')?.value || '';
        }

        const res = await apiRequest(`/api/v1/lessons/${lessonId}/questions/${q.id}/answer`, {
          method: 'POST',
          body: { answer: ans },
        });
        answeredIds.add(q.id);
        if (res.gems_earned > 0) {
          const topbarGem = document.getElementById('topbar-gem-count');
          if (topbarGem) {
            topbarGem.textContent = Number(topbarGem.textContent || 0) + res.gems_earned;
          }
          showToast(`💎 +${res.gems_earned} Gems! Trả lời đúng xuất sắc!`, 'success');
        }
        const fb = document.getElementById('overlay-feedback');
        fb.innerHTML = `
          <div class="pill ${res.is_correct ? 'pill-success' : 'pill-danger'}">
            ${res.is_correct ? `Chính xác! +${res.score_earned} điểm` : 'Chưa chính xác'}
          </div>
          ${res.explanation ? `<p style="margin:8px 0 0;font-size:0.88rem;">${escapeHtml(res.explanation)}</p>` : ''}
        `;
        const btn = document.getElementById('overlay-submit-btn');
        if (res.can_continue) {
          btn.textContent = 'Tiếp tục xem video →';
          btn.type = 'button';
          btn.onclick = () => {
            activeOverlayQuestion = null;
            overlayHost.innerHTML = '';
            video.play().catch(() => {});
          };
        }
      });
    }

    let lastHeartbeatSentAt = 0;
    async function sendHeartbeat(segStart, segEnd, cur) {
      try {
        const res = await apiRequest(`/api/v1/lessons/${lessonId}/heartbeat`, {
          method: 'POST',
          body: { segment_start: segStart, segment_end: segEnd, current_time: cur },
        });
        if (!res.accepted && res.forced_position !== null) {
          video.currentTime = res.forced_position;
          lastAcceptedTime = res.forced_position;
          showToast('Anti-Skip: Không thể tua vượt qua nội dung chưa xem hoặc câu hỏi bắt buộc.', 'error');
        } else if (res.accepted) {
          verifiedFrontier = res.verified_frontier;
          lastAcceptedTime = cur;
          document.getElementById('player-progress-pill').textContent = `Tiến độ: ${res.watch_progress_pct}%`;
          document.getElementById('player-frontier-label').textContent = `Mốc đã xác thực: ${verifiedFrontier}s / ${Math.round(duration)}s`;
          document.getElementById('player-frontier-bar').style.width = `${Math.min(100, (verifiedFrontier / duration) * 100)}%`;
          if (res.is_completed) {
            const st = document.getElementById('player-status-pill');
            st.className = 'pill pill-success';
            st.textContent = 'Đã hoàn thành';
            if (res.gems_earned > 0) {
              const topbarGem = document.getElementById('topbar-gem-count');
              if (topbarGem) {
                topbarGem.textContent = Number(topbarGem.textContent || 0) + res.gems_earned;
              }
              showToast(`🏆 +${res.gems_earned} 💎 Gems! Chúc mừng bạn đã hoàn thành bài giảng!`, 'success');
            }
          }
        }
      } catch {
        // Resilient to transient network drops; next heartbeat resumes cleanly
      }
    }

    video.addEventListener('seeking', () => {
      if (video.currentTime > verifiedFrontier + 2.5) {
        sendHeartbeat(lastAcceptedTime, video.currentTime, video.currentTime);
      }
    });

    video.addEventListener('timeupdate', () => {
      if (activeOverlayQuestion) {
        video.pause();
        return;
      }
      const cur = video.currentTime;
      const dueQuestion = questions.find(
        (q) => !answeredIds.has(q.id) && cur >= q.timestamp_seconds - 0.35 && cur <= q.timestamp_seconds + 2.0
      );
      if (dueQuestion) {
        showQuestionOverlay(dueQuestion);
        return;
      }
      const nowMs = Date.now();
      if (nowMs - lastHeartbeatSentAt >= 2000 && cur > lastAcceptedTime) {
        const start = lastAcceptedTime;
        lastHeartbeatSentAt = nowMs;
        sendHeartbeat(start, cur, cur);
      }
    });
  }
}
