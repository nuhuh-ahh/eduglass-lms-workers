/**
 * EduGlass LMS — Notifications Center & Multi-View Calendar (Month/Week/Day/Agenda)
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, openModal, showToast, state } from '../core/store.js';

export async function renderNotificationsPage(container, onUnreadChange) {
  async function draw() {
    const res = await apiRequest('/api/v1/notifications');
    const items = res.notifications || [];
    const prefs = res.preferences || {};
    state.unreadNotifications = res.unread_count || 0;
    if (typeof onUnreadChange === 'function') onUnreadChange(state.unreadNotifications);

    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
        <div class="flex-between">
          <div>
            <h2 style="margin:0;">Trung tâm thông báo</h2>
            <p class="muted" style="margin:4px 0 0;">${res.unread_count} thông báo chưa đọc.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-mark-all-read">Đánh dấu tất cả đã đọc</button>
        </div>

        <div class="grid-2" style="grid-template-columns: 1.4fr 1fr;">
          <div class="card">
            <h3 style="margin-top:0;">Lịch sử thông báo</h3>
            ${items.map((n) => `
              <div class="flex-between" style="padding:11px 0;border-bottom:1px solid var(--border-subtle);opacity:${n.is_read ? '0.72' : '1'};">
                <div>
                  <span class="pill ${n.is_read ? 'pill-info' : 'pill-warning'}">${n.is_read ? 'Đã đọc' : 'Mới'}</span>
                  <strong style="margin-left:6px;">${escapeHtml(n.title)}</strong>
                  <div class="muted" style="margin-top:3px;">${escapeHtml(n.message)}</div>
                </div>
                ${!n.is_read ? `<button class="btn btn-secondary btn-sm" data-read-ntf="${n.id}">Đã đọc</button>` : ''}
              </div>
            `).join('') || '<p class="muted">Chưa có thông báo nào.</p>'}
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Tùy chọn nhận thông báo</h3>
            ${Object.entries({
              new_lesson: 'Bài giảng mới',
              new_assignment: 'Bài tập & Kiểm tra mới',
              deadline_reminder: 'Nhắc hạn nộp sắp tới',
              lesson_completed: 'Hoàn thành bài giảng',
              announcement: 'Thông báo từ giáo viên',
              student_joined: 'Học sinh tham gia lớp',
              quiz_result: 'Kết quả kiểm tra mới',
            }).map(([key, label]) => `
              <label class="flex-between" style="padding:9px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer;">
                <span>${label}</span>
                <input type="checkbox" data-ntf-pref="${key}" ${prefs[key] ? 'checked' : ''} />
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
      await apiRequest('/api/v1/notifications/read-all', { method: 'POST' });
      showToast('Đã đánh dấu toàn bộ thông báo là đã đọc.', 'success');
      draw();
    });

    container.querySelectorAll('[data-read-ntf]').forEach((b) => {
      b.addEventListener('click', async () => {
        await apiRequest(`/api/v1/notifications/${b.dataset.readNtf}/read`, { method: 'POST' });
        draw();
      });
    });

    container.querySelectorAll('[data-ntf-pref]').forEach((chk) => {
      chk.addEventListener('change', async () => {
        await apiRequest('/api/v1/notifications/preferences', {
          method: 'PUT',
          body: { [chk.dataset.ntfPref]: chk.checked },
        });
        showToast('Đã lưu cài đặt thông báo.', 'success');
      });
    });
  }

  draw();
}

export async function renderCalendarPage(container) {
  let viewMode = 'month';
  const isStaff = ['teacher', 'school_admin', 'super_admin'].includes(state.user.role_name);

  async function draw() {
    const res = await apiRequest('/api/v1/calendar/events');
    const events = res.events || [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let bodyHtml = '';
    if (viewMode === 'month') {
      const cells = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = events.filter((e) => (e.start_time || '').startsWith(dayStr));
        cells.push(`
          <div style="min-height:82px;padding:8px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--surface-subtle);">
            <div style="font-weight:700;font-size:0.82rem;">${d}</div>
            ${dayEvents.map((ev) => `<div class="pill pill-info" style="margin-top:4px;font-size:0.68rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ev.title)}</div>`).join('')}
          </div>
        `);
      }
      bodyHtml = `
        <h3 style="margin-top:0;">Tháng ${month + 1} / ${year}</h3>
        <div style="display:grid;grid-template-columns:repeat(7, minmax(0, 1fr));gap:8px;">${cells.join('')}</div>
      `;
    } else {
      const labelMap = { week: 'Chế độ Tuần (7 ngày tới)', day: 'Chế độ Hôm nay', agenda: 'Danh sách toàn bộ sự kiện (Agenda)' };
      bodyHtml = `
        <h3 style="margin-top:0;">${labelMap[viewMode]}</h3>
        ${events.map((e) => `
          <div class="flex-between" style="padding:11px 0;border-bottom:1px solid var(--border-subtle);">
            <div>
              <span class="pill pill-info">${escapeHtml(e.event_type)}</span>
              <strong style="margin-left:8px;">${escapeHtml(e.title)}</strong>
              <div class="muted" style="margin-top:3px;">${escapeHtml(e.description || '')}</div>
            </div>
            <span class="muted">${(e.start_time || '').slice(0, 16).replace('T', ' ')}</span>
          </div>
        `).join('') || '<p class="muted">Chưa có sự kiện lịch học nào.</p>'}
      `;
    }

    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
        <div class="flex-between">
          <div>
            <h2 style="margin:0;">Lịch học tập & Deadline</h2>
            <p class="muted" style="margin:4px 0 0;">Tự động đồng bộ lịch bài giảng, kiểm tra, hạn nộp và sự kiện lớp học.</p>
          </div>
          <div class="flex-row">
            ${['month', 'week', 'day', 'agenda'].map((m) => `
              <button class="btn ${viewMode === m ? 'btn-primary' : 'btn-secondary'} btn-sm" data-cal-view="${m}">
                ${m === 'month' ? 'Tháng' : m === 'week' ? 'Tuần' : m === 'day' ? 'Ngày' : 'Agenda'}
              </button>
            `).join('')}
            ${isStaff ? `<button class="btn btn-primary btn-sm" id="btn-add-cal-event">+ Sự kiện lớp</button>` : ''}
          </div>
        </div>
        <div class="card">${bodyHtml}</div>
      </div>
    `;

    container.querySelectorAll('[data-cal-view]').forEach((b) => {
      b.addEventListener('click', () => {
        viewMode = b.dataset.calView;
        draw();
      });
    });

    document.getElementById('btn-add-cal-event')?.addEventListener('click', () => {
      openModal('Thêm sự kiện lịch học', `
        <form id="cal-evt-form">
          <div class="field"><label>Tiêu đề sự kiện</label><input class="input" id="ce-title" required /></div>
          <div class="field"><label>Mô tả</label><input class="input" id="ce-desc" /></div>
          <div class="grid-2">
            <div class="field"><label>Bắt đầu</label><input class="input" id="ce-start" type="datetime-local" required /></div>
            <div class="field"><label>Kết thúc</label><input class="input" id="ce-end" type="datetime-local" required /></div>
          </div>
          <button class="btn btn-primary" type="submit">Lưu sự kiện</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#cal-evt-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          await apiRequest('/api/v1/calendar/events', {
            method: 'POST',
            body: {
              title: slot.querySelector('#ce-title').value,
              description: slot.querySelector('#ce-desc').value,
              start_time: slot.querySelector('#ce-start').value,
              end_time: slot.querySelector('#ce-end').value,
            },
          });
          close();
          showToast('Đã thêm sự kiện vào lịch.', 'success');
          draw();
        });
      });
    });
  }

  draw();
}
