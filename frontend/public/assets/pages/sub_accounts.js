/**
 * EduGlass LMS — Teacher Sub-Accounts Management & Impersonation Page
 * Allows teachers to create student accounts, manage passwords, assign classes,
 * and directly log into sub-accounts to view the platform from a student's perspective.
 */
import { apiRequest, getToken, setToken } from '../core/api.js';
import { escapeHtml, showToast, state, t } from '../core/store.js';

export async function renderSubAccountsPage(container, navigate, onAccountSwitched) {
  let subAccounts = [];
  let classrooms = [];
  let searchQuery = '';

  async function loadData() {
    try {
      const [resSub, resCls] = await Promise.all([
        apiRequest('/api/v1/teacher/sub-accounts'),
        apiRequest('/api/v1/classrooms').catch(() => ({ classrooms: [] })),
      ]);
      subAccounts = resSub.sub_accounts || [];
      classrooms = resCls.classrooms || [];
      render();
    } catch (err) {
      container.innerHTML = `
        <div class="card" style="padding:24px;text-align:center;">
          <p class="muted">${escapeHtml(err.message)}</p>
          <button class="btn btn-secondary btn-sm" id="btn-retry">Thử lại</button>
        </div>
      `;
      document.getElementById('btn-retry')?.addEventListener('click', loadData);
    }
  }

  function render() {
    const filtered = subAccounts.filter((s) => {
      const q = searchQuery.toLowerCase();
      return (
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.student_code?.toLowerCase().includes(q)
      );
    });

    const activeCount = subAccounts.filter((s) => s.is_active).length;
    const totalCount = subAccounts.length;

    container.innerHTML = `
      <div class="page-enter">
        <div class="flex-between" style="margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h1 style="margin:0 0 6px;font-size:1.45rem;">Quản lý Tài khoản Học sinh</h1>
            <p class="muted" style="margin:0;font-size:0.86rem;">
              Tạo tài khoản con cho học sinh, cấp mật khẩu ban đầu và đăng nhập trực tiếp để kiểm tra bài học.
            </p>
          </div>
          <div class="flex-row">
            <button class="btn btn-primary" id="btn-create-sub">
              + Tạo Học sinh Mới
            </button>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="grid-3" style="margin-bottom:22px;">
          <div class="card stat-card">
            <div class="stat-number">${totalCount}</div>
            <div class="stat-label">Tổng số Học sinh con</div>
          </div>
          <div class="card stat-card">
            <div class="stat-number" style="color:var(--success);">${activeCount}</div>
            <div class="stat-label">Đang Hoạt động</div>
          </div>
          <div class="card stat-card">
            <div class="stat-number" style="color:var(--accent);">${classrooms.length}</div>
            <div class="stat-label">Lớp học Phụ trách</div>
          </div>
        </div>

        <!-- Filter & Search -->
        <div class="card flex-between" style="padding:14px 18px;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
          <div class="flex-row" style="flex:1;min-width:240px;">
            <input class="input" id="sub-search" placeholder="Tìm theo tên, email hoặc mã học sinh..." value="${escapeHtml(searchQuery)}" />
          </div>
          <div class="muted" style="font-size:0.82rem;">
            Hiển thị <strong>${filtered.length}</strong> / ${totalCount} học sinh
          </div>
        </div>

        <!-- Sub-accounts List -->
        ${filtered.length === 0 ? `
          <div class="card" style="padding:48px 24px;text-align:center;">
            <div style="font-size:2.8rem;margin-bottom:12px;" aria-hidden="true">👥</div>
            <h3 style="margin:0 0 8px;">Chưa có tài khoản học sinh con nào</h3>
            <p class="muted" style="margin:0 0 18px;font-size:0.88rem;">
              Bấm nút "Tạo Học sinh Mới" để tạo tài khoản, sinh mật khẩu và gán học sinh vào lớp học ngay lập tức.
            </p>
            <button class="btn btn-primary btn-sm" id="btn-create-sub-empty">+ Tạo Học sinh Đầu tiên</button>
          </div>
        ` : `
          <div class="card table-wrap" style="padding:0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Mã số</th>
                  <th>Tài khoản / Email</th>
                  <th>Mật khẩu ban đầu</th>
                  <th>Lớp học tham gia</th>
                  <th>Đăng nhập gần nhất</th>
                  <th style="text-align:right;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map((s) => `
                  <tr>
                    <td>
                      <div class="flex-row" style="gap:10px;">
                        <div class="user-avatar" style="width:34px;height:34px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-weight:700;font-size:0.8rem;">
                          ${(s.full_name || 'H').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div style="font-weight:700;">${escapeHtml(s.full_name)}</div>
                          <div class="muted" style="font-size:0.75rem;">${s.is_active ? '<span style="color:var(--success);">● Hoạt động</span>' : '<span style="color:var(--danger);">● Khóa</span>'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="pill pill-info" style="font-size:0.75rem;font-family:var(--font-mono);">${escapeHtml(s.student_code || '---')}</span>
                    </td>
                    <td>
                      <code style="font-size:0.82rem;font-family:var(--font-mono);">${escapeHtml(s.email)}</code>
                    </td>
                    <td>
                      <div class="flex-row" style="gap:6px;">
                        <code style="font-size:0.82rem;font-family:var(--font-mono);background:var(--surface-subtle);padding:3px 8px;border-radius:6px;">
                          ${escapeHtml(s.raw_temp_password || '******')}
                        </code>
                        <button class="btn btn-secondary btn-sm" data-copy="${escapeHtml(s.raw_temp_password || '')}" title="Sao chép mật khẩu" style="padding:4px 8px;font-size:0.72rem;">
                          📋
                        </button>
                      </div>
                    </td>
                    <td>
                      ${(s.classrooms || []).length > 0
                        ? s.classrooms.map((c) => `<span class="pill pill-warning" style="font-size:0.72rem;margin-right:4px;">${escapeHtml(c.name)}</span>`).join('')
                        : '<span class="muted" style="font-size:0.78rem;">Chưa vào lớp</span>'}
                    </td>
                    <td>
                      <span class="muted" style="font-size:0.8rem;">
                        ${s.last_login_at ? new Date(s.last_login_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Chưa đăng nhập'}
                      </span>
                    </td>
                    <td style="text-align:right;">
                      <div class="flex-row" style="justify-content:flex-end;gap:6px;">
                        <button class="btn btn-primary btn-sm" data-login-as="${s.id}" data-name="${escapeHtml(s.full_name)}" title="Đăng nhập trực tiếp với tư cách học sinh này">
                          🔑 Đăng nhập
                        </button>
                        <button class="btn btn-secondary btn-sm" data-reset-pwd="${s.id}" data-name="${escapeHtml(s.full_name)}" title="Đặt lại mật khẩu">
                          🔄
                        </button>
                        <button class="btn btn-danger btn-sm" data-del-sub="${s.id}" data-name="${escapeHtml(s.full_name)}" title="Xóa tài khoản con">
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Create Sub-Account Modal Container -->
      <div id="sub-modal-root"></div>
    `;

    // Event listeners
    document.getElementById('sub-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    document.getElementById('btn-create-sub')?.addEventListener('click', openCreateModal);
    document.getElementById('btn-create-sub-empty')?.addEventListener('click', openCreateModal);

    // Copy password
    container.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.copy;
        if (!val) return;
        navigator.clipboard.writeText(val).then(() => {
          showToast('Đã sao chép mật khẩu!', 'success');
        }).catch(() => {
          showToast(`Mật khẩu: ${val}`, 'info');
        });
      });
    });

    // Impersonate / Login as Student
    container.querySelectorAll('[data-login-as]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const studentId = btn.dataset.loginAs;
        const studentName = btn.dataset.name;
        if (!confirm(`Bạn có chắc muốn chuyển sang đăng nhập với tư cách học sinh "${studentName}"?`)) {
          return;
        }

        try {
          btn.disabled = true;
          btn.textContent = 'Đang chuyển...';

          const currentToken = getToken();
          const currentTeacher = state.user;

          const res = await apiRequest(`/api/v1/teacher/sub-accounts/${studentId}/login-as`, {
            method: 'POST',
          });

          // Store parent teacher session in localStorage so we can switch back anytime!
          localStorage.setItem(
            'eduglass_parent_teacher',
            JSON.stringify({
              token: currentToken,
              teacher: currentTeacher,
              switched_at: new Date().toISOString(),
            })
          );

          // Set the student's access token
          setToken(res.access_token);
          state.user = res.user;

          showToast(`Đã chuyển sang tài khoản học sinh: ${res.user.display_name}!`, 'success');

          // Trigger app shell reload
          if (onAccountSwitched) {
            onAccountSwitched();
          } else {
            window.location.hash = '#dashboard';
            window.location.reload();
          }
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = '🔑 Đăng nhập';
        }
      });
    });

    // Reset Password
    container.querySelectorAll('[data-reset-pwd]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const studentId = btn.dataset.resetPwd;
        const studentName = btn.dataset.name;
        const newPwd = prompt(`Nhập mật khẩu mới cho học sinh "${studentName}" (để trống để hệ thống tự tạo ngẫu nhiên):`, '');
        if (newPwd === null) return; // cancelled

        try {
          const res = await apiRequest(`/api/v1/teacher/sub-accounts/${studentId}/reset-password`, {
            method: 'PUT',
            body: { new_password: newPwd.trim() || undefined },
          });
          showToast(`Đã đổi mật khẩu! Mật khẩu mới: ${res.new_password}`, 'success');
          await loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Delete sub-account
    container.querySelectorAll('[data-del-sub]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const studentId = btn.dataset.delSub;
        const studentName = btn.dataset.name;
        if (!confirm(`Bạn có chắc muốn xóa tài khoản học sinh "${studentName}"? Thao tác này không thể hoàn tác.`)) {
          return;
        }

        try {
          await apiRequest(`/api/v1/teacher/sub-accounts/${studentId}`, { method: 'DELETE' });
          showToast(`Đã xóa tài khoản học sinh ${studentName}!`, 'success');
          await loadData();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function openCreateModal() {
    const modalRoot = document.getElementById('sub-modal-root');
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="modal-sub-bg">
        <div class="modal-panel card" style="max-width:540px;">
          <div class="flex-between" style="margin-bottom:18px;">
            <h2 style="margin:0;font-size:1.25rem;">+ Thêm Tài khoản Học sinh Mới</h2>
            <button class="btn btn-secondary btn-sm" id="btn-close-modal">✕</button>
          </div>

          <form id="form-create-sub">
            <div class="field">
              <label for="new-sub-name">Họ và tên học sinh *</label>
              <input class="input" id="new-sub-name" required placeholder="Ví dụ: Nguyễn Văn An" autofocus />
            </div>

            <div class="grid-2">
              <div class="field">
                <label for="new-sub-code">Mã số học sinh (tùy chọn)</label>
                <input class="input" id="new-sub-code" placeholder="Tự sinh nếu để trống (VD: HS001)" />
              </div>
              <div class="field">
                <label for="new-sub-class">Gán vào Lớp học</label>
                <select class="select" id="new-sub-class">
                  <option value="">-- Chưa gán lớp --</option>
                  ${classrooms.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="field">
              <label for="new-sub-email">Email / Tên đăng nhập (tùy chọn)</label>
              <input class="input" id="new-sub-email" type="email" placeholder="Tự sinh nếu để trống (hs.mã@eduglass.local)" />
            </div>

            <div class="field">
              <label for="new-sub-pwd">Mật khẩu ban đầu (tùy chọn)</label>
              <input class="input" id="new-sub-pwd" minlength="6" placeholder="Tự sinh ngẫu nhiên nếu để trống (VD: HS@9X7K2A)" />
            </div>

            <div class="card" style="padding:12px;margin:16px 0;background:var(--surface-subtle);font-size:0.8rem;">
              <span style="color:var(--accent);font-weight:700;">💡 Gợi ý cho Giáo viên:</span> Bạn có thể để trống Mã số, Email và Mật khẩu — hệ thống sẽ tự động sinh tài khoản chuẩn và hiển thị mật khẩu để bạn gửi cho học sinh!
            </div>

            <div class="flex-between" style="margin-top:20px;">
              <button class="btn btn-secondary" type="button" id="btn-cancel-modal">Hủy</button>
              <button class="btn btn-primary" type="submit" id="btn-submit-sub">Tạo Tài khoản</button>
            </div>
          </form>
        </div>
      </div>
    `;

    function closeModal() {
      modalRoot.innerHTML = '';
    }

    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal')?.addEventListener('click', closeModal);

    document.getElementById('form-create-sub')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-sub');
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang tạo...';

        const name = document.getElementById('new-sub-name').value;
        const code = document.getElementById('new-sub-code').value;
        const email = document.getElementById('new-sub-email').value;
        const pwd = document.getElementById('new-sub-pwd').value;
        const classId = document.getElementById('new-sub-class').value;

        const res = await apiRequest('/api/v1/teacher/sub-accounts', {
          method: 'POST',
          body: {
            full_name: name,
            student_code: code || undefined,
            email: email || undefined,
            password: pwd || undefined,
            classroom_id: classId || undefined,
          },
        });

        showToast(`Đã tạo học sinh: ${res.sub_account.full_name}! MK: ${res.sub_account.raw_temp_password}`, 'success');
        closeModal();
        await loadData();
      } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Tạo Tài khoản';
      }
    });
  }

  await loadData();
}
