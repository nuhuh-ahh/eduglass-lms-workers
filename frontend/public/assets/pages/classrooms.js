/**
 * EduGlass LMS — Classroom Management Page
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, openModal, showToast, state } from '../core/store.js';

export async function renderClassroomsPage(container, navigate, selectedId = null) {
  let search = '';
  let page = 1;
  const isStaff = ['teacher', 'school_admin', 'super_admin'].includes(state.user.role_name);

  async function drawList() {
    const res = await apiRequest(`/api/v1/classrooms?search=${encodeURIComponent(search)}&page=${page}&page_size=12`);
    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
        <div class="flex-between">
          <div>
            <h2 style="margin:0;">Quản lý lớp học</h2>
            <p class="muted" style="margin:4px 0 0;">Tổng số ${res.total} lớp học đang hoạt động.</p>
          </div>
          <div class="flex-row">
            <input class="input" id="cls-search" value="${escapeHtml(search)}" placeholder="Tìm theo tên, mã lớp, môn..." style="width:240px;" />
            ${isStaff
              ? `<button class="btn btn-primary" id="btn-create-class">+ Tạo lớp mới</button>`
              : `<button class="btn btn-primary" id="btn-join-class">+ Tham gia lớp bằng mã</button>`}
          </div>
        </div>

        <div class="grid-3">
          ${res.items.length ? res.items.map((c) => `
            <div class="card" style="display:flex;flex-direction:column;gap:10px;">
              <div class="flex-between">
                <span class="pill pill-info">${escapeHtml(c.code)}</span>
                <span class="muted">${escapeHtml(c.subject || 'Tổng hợp')}</span>
              </div>
              <h3 style="margin:0;">${escapeHtml(c.name)}</h3>
              <p class="muted" style="margin:0;flex:1;">${escapeHtml(c.description || 'Chưa có mô tả.')}</p>
              <div class="flex-between" style="font-size:0.84rem;">
                <span>GV: <strong>${escapeHtml(c.teacher_name)}</strong></span>
                <span>${c.student_count} HS • ${c.lesson_count} bài</span>
              </div>
              <button class="btn btn-secondary" data-open-class="${c.id}">Mở lớp học</button>
            </div>
          `).join('') : '<div class="card"><p class="muted">Chưa có lớp học nào phù hợp.</p></div>'}
        </div>
      </div>
    `;

    let debounceTimer;
    document.getElementById('cls-search')?.addEventListener('input', (e) => {
      search = e.target.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(drawList, 250);
    });

    container.querySelectorAll('[data-open-class]').forEach((btn) => {
      btn.addEventListener('click', () => drawDetail(btn.dataset.openClass));
    });

    document.getElementById('btn-create-class')?.addEventListener('click', () => {
      openModal('Tạo lớp học mới', `
        <form id="create-cls-form">
          <div class="field"><label>Tên lớp học</label><input class="input" id="c-name" required placeholder="VD: Vật Lý 10A2" /></div>
          <div class="field"><label>Mã lớp (để trống để tự sinh)</label><input class="input" id="c-code" placeholder="PHYS10A" /></div>
          <div class="field"><label>Môn học</label><input class="input" id="c-subj" placeholder="Vật lý" /></div>
          <div class="field"><label>Mô tả</label><textarea class="textarea" id="c-desc"></textarea></div>
          <button class="btn btn-primary" type="submit">Tạo lớp</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#create-cls-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            await apiRequest('/api/v1/classrooms', {
              method: 'POST',
              body: {
                name: slot.querySelector('#c-name').value,
                code: slot.querySelector('#c-code').value || null,
                subject: slot.querySelector('#c-subj').value,
                description: slot.querySelector('#c-desc').value,
              },
            });
            close();
            showToast('Đã tạo lớp học thành công!', 'success');
            drawList();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    });

    document.getElementById('btn-join-class')?.addEventListener('click', () => {
      openModal('Tham gia lớp học', `
        <form id="join-cls-form">
          <div class="field"><label>Nhập mã lớp (VD: MATH10A)</label><input class="input" id="j-code" required /></div>
          <button class="btn btn-primary" type="submit">Tham gia ngay</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#join-cls-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            const r = await apiRequest('/api/v1/classrooms/join', {
              method: 'POST',
              body: { code: slot.querySelector('#j-code').value },
            });
            close();
            showToast(r.message, 'success');
            drawList();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    });
  }

  async function drawDetail(cid) {
    const data = await apiRequest(`/api/v1/classrooms/${cid}`);
    const c = data.classroom;
    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
        <div class="flex-between">
          <div class="flex-row">
            <button class="btn btn-secondary btn-sm" id="cls-back">← Danh sách lớp</button>
            <h2 style="margin:0;">${escapeHtml(c.name)}</h2>
            <span class="pill pill-info">Mã lớp: ${escapeHtml(c.code)}</span>
          </div>
          <div class="flex-row">
            ${isStaff ? `<button class="btn btn-secondary btn-sm" id="btn-copy-invite">Sao chép link mời</button>` : `<button class="btn btn-danger btn-sm" id="btn-leave-class">Rời lớp</button>`}
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="flex-between" style="margin-bottom:12px;">
              <h3 style="margin:0;">Bài giảng video (${data.lessons.length})</h3>
              ${isStaff ? `<button class="btn btn-primary btn-sm" id="cls-go-studio">+ Tạo bài giảng</button>` : ''}
            </div>
            ${data.lessons.length ? data.lessons.map((l) => `
              <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-subtle);">
                <div>
                  <div style="font-weight:600;">${escapeHtml(l.title)}</div>
                  <span class="pill ${l.status === 'published' ? 'pill-success' : 'pill-warning'}">${l.status} • v${l.version}</span>
                </div>
                <button class="btn btn-primary btn-sm" data-watch-les="${l.id}">Mở bài giảng</button>
              </div>
            `).join('') : '<p class="muted">Chưa có bài giảng nào trong lớp này.</p>'}
          </div>

          <div class="card">
            <div class="flex-between" style="margin-bottom:12px;">
              <h3 style="margin:0;">Thành viên (${data.members.length})</h3>
              ${isStaff ? `<button class="btn btn-secondary btn-sm" id="btn-add-student">+ Thêm học sinh</button>` : ''}
            </div>
            ${data.members.map((m) => `
              <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.88rem;">
                <div>
                  <strong>${escapeHtml(m.full_name)}</strong>
                  <div class="muted">${escapeHtml(m.email)}</div>
                </div>
                <div class="flex-row">
                  <span class="pill pill-info">${m.member_role}</span>
                  ${isStaff && m.member_role === 'student' ? `<button class="btn btn-danger btn-sm" data-rm-stu="${m.user_id}">Xóa</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="flex-between" style="margin-bottom:12px;">
            <h3 style="margin:0;">Thông báo lớp học</h3>
            ${isStaff ? `<button class="btn btn-primary btn-sm" id="btn-post-ann">+ Đăng thông báo</button>` : ''}
          </div>
          ${data.announcements.length ? data.announcements.map((a) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border-subtle);">
              <strong>${escapeHtml(a.title)}</strong> <span class="muted">• ${escapeHtml(a.author_name)}</span>
              <p style="margin:4px 0 0;">${escapeHtml(a.content)}</p>
            </div>
          `).join('') : '<p class="muted">Chưa có thông báo nào.</p>'}
        </div>
      </div>
    `;

    document.getElementById('cls-back')?.addEventListener('click', drawList);
    document.getElementById('cls-go-studio')?.addEventListener('click', () => navigate('studio'));
    container.querySelectorAll('[data-watch-les]').forEach((b) => {
      b.addEventListener('click', () => navigate('player', b.dataset.watchLes));
    });

    document.getElementById('btn-copy-invite')?.addEventListener('click', async () => {
      const link = `${window.location.origin}/#join/${c.invite_token}`;
      try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
      showToast(`Đã sao chép liên kết mời: ${c.invite_token}`, 'success');
    });

    document.getElementById('btn-leave-class')?.addEventListener('click', async () => {
      try {
        await apiRequest(`/api/v1/classrooms/${cid}/leave`, { method: 'POST' });
        showToast('Đã rời khỏi lớp học.', 'success');
        drawList();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    container.querySelectorAll('[data-rm-stu]').forEach((b) => {
      b.addEventListener('click', async () => {
        await apiRequest(`/api/v1/classrooms/${cid}/members/${b.dataset.rmStu}`, { method: 'DELETE' });
        showToast('Đã xóa học sinh khỏi lớp.', 'success');
        drawDetail(cid);
      });
    });

    document.getElementById('btn-add-student')?.addEventListener('click', () => {
      openModal('Thêm học sinh bằng email', `
        <form id="add-stu-form">
          <div class="field"><label>Email học sinh</label><input class="input" id="stu-email" type="email" required /></div>
          <button class="btn btn-primary" type="submit">Thêm vào lớp</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#add-stu-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            const r = await apiRequest(`/api/v1/classrooms/${cid}/members`, {
              method: 'POST',
              body: { email: slot.querySelector('#stu-email').value },
            });
            close();
            showToast(r.message, 'success');
            drawDetail(cid);
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    });

    document.getElementById('btn-post-ann')?.addEventListener('click', () => {
      openModal('Đăng thông báo lớp', `
        <form id="ann-form">
          <div class="field"><label>Tiêu đề</label><input class="input" id="ann-title" required /></div>
          <div class="field"><label>Nội dung</label><textarea class="textarea" id="ann-content" required></textarea></div>
          <button class="btn btn-primary" type="submit">Đăng thông báo</button>
        </form>
      `, (slot, close) => {
        slot.querySelector('#ann-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          await apiRequest(`/api/v1/classrooms/${cid}/announcements`, {
            method: 'POST',
            body: {
              title: slot.querySelector('#ann-title').value,
              content: slot.querySelector('#ann-content').value,
            },
          });
          close();
          showToast('Đã gửi thông báo đến toàn bộ học sinh trong lớp.', 'success');
          drawDetail(cid);
        });
      });
    });
  }

  if (selectedId) {
    drawDetail(selectedId);
  } else {
    drawList();
  }
}
