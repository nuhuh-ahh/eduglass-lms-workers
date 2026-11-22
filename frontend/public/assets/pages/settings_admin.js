/**
 * EduGlass LMS — Appearance/Settings, Module Manager & Super Admin Console
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, showToast, state, updatePreferences } from '../core/store.js';

export async function renderSettingsPage(container, onRerenderShell) {
  const sessRes = await apiRequest('/api/v1/auth/sessions');
  const p = state.preferences;

  container.innerHTML = `
    <div class="page-enter" style="display:flex;flex-direction:column;gap:20px;">
      <div>
        <h2 style="margin:0;">Giao diện, Hồ sơ & Cài đặt</h2>
        <p class="muted" style="margin:4px 0 0;">Chuyển đổi tức thì giữa Liquid Glass (iOS 27) và Classic Education — không tải lại trang, tự đồng bộ tài khoản.</p>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 style="margin-top:0;">Appearance — Chế độ giao diện</h3>
          <div class="grid-2" style="margin-bottom:16px;">
            <button class="btn ${p.theme_mode === 'liquid-glass' ? 'btn-primary' : 'btn-secondary'}" id="theme-btn-glass" style="padding:16px;flex-direction:column;">
              <strong>Liquid Glass Mode</strong>
              <span style="font-size:0.75rem;opacity:0.88;">Mặc định • iOS 27 Concept</span>
            </button>
            <button class="btn ${p.theme_mode === 'classic-education' ? 'btn-primary' : 'btn-secondary'}" id="theme-btn-classic" style="padding:16px;flex-direction:column;">
              <strong>Classic Education</strong>
              <span style="font-size:0.75rem;opacity:0.88;">Moodle / Canvas / Classroom</span>
            </button>
          </div>

          <div class="field">
            <label>Ngôn ngữ hệ thống (Localization)</label>
            <select class="select" id="pref-lang">
              <option value="vi" ${p.language === 'vi' ? 'selected' : ''}>Tiếng Việt (Mặc định)</option>
              <option value="en" ${p.language === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>

          <div class="field">
            <label>Wallpaper Liquid Glass</label>
            <select class="select" id="pref-wallpaper">
              <option value="aurora-prism" ${p.wallpaper === 'aurora-prism' ? 'selected' : ''}>Aurora Prism (Sáng trong)</option>
              <option value="pastel-sakura" ${p.wallpaper === 'pastel-sakura' ? 'selected' : ''}>Pastel Sakura (Hồng ngọc)</option>
              <option value="ocean-refraction" ${p.wallpaper === 'ocean-refraction' ? 'selected' : ''}>Ocean Refraction (Biển xanh)</option>
              <option value="midnight-crystal" ${p.wallpaper === 'midnight-crystal' ? 'selected' : ''}>Midnight Crystal (Kính đêm)</option>
            </select>
          </div>

          <div class="field">
            <label>Màu chủ đạo (Accent Color)</label>
            <div class="flex-row">
              ${['#0A84FF', '#7C3AED', '#EC4899', '#10B981', '#F59E0B', '#2563EB'].map((col) => `
                <button type="button" data-accent="${col}" style="width:32px;height:32px;border-radius:50%;border:2px solid ${p.accent_color === col ? 'var(--text-primary)' : 'transparent'};background:${col};cursor:pointer;" aria-label="Chọn màu ${col}"></button>
              `).join('')}
            </div>
          </div>

          <div class="field">
            <label>Độ trong suốt Liquid Glass: <strong id="val-opacity">${Math.round((p.glass_opacity ?? 0.68) * 100)}%</strong></label>
            <input type="range" id="pref-opacity" min="0.25" max="0.95" step="0.05" value="${p.glass_opacity ?? 0.68}" />
          </div>

          <div class="field">
            <label>Độ mờ nền (Backdrop Blur): <strong id="val-blur">${p.glass_blur ?? 22}px</strong></label>
            <input type="range" id="pref-blur" min="0" max="40" step="2" value="${p.glass_blur ?? 22}" />
          </div>

          <div class="field">
            <label>Mức độ Animation</label>
            <select class="select" id="pref-motion">
              <option value="full" ${p.animation_level === 'full' ? 'selected' : ''}>Đầy đủ (60 FPS)</option>
              <option value="reduced" ${p.animation_level === 'reduced' ? 'selected' : ''}>Giảm nhẹ (Thiết bị yếu)</option>
              <option value="none" ${p.animation_level === 'none' ? 'selected' : ''}>Tắt chuyển động</option>
            </select>
          </div>

          <label class="flex-row" style="cursor:pointer;">
            <input type="checkbox" id="pref-sound" ${p.sound_enabled ? 'checked' : ''} />
            <span>Bật âm thanh tương tác nhẹ</span>
          </label>
        </div>

        <div style="display:flex;flex-direction:column;gap:18px;">
          <div class="card">
            <h3 style="margin-top:0;">Hồ sơ cá nhân</h3>
            <form id="profile-form">
              <div class="field"><label>Tên hiển thị</label><input class="input" id="prof-display" value="${escapeHtml(state.user.display_name)}" required /></div>
              <div class="field"><label>Họ và tên</label><input class="input" id="prof-full" value="${escapeHtml(state.user.full_name)}" required /></div>
              <div class="field"><label>Avatar URL</label><input class="input" id="prof-avatar" value="${escapeHtml(state.user.avatar_url || '')}" placeholder="https://..." /></div>
              <div class="field"><label>Giới thiệu</label><textarea class="textarea" id="prof-bio">${escapeHtml(state.user.bio || '')}</textarea></div>
              <button class="btn btn-primary btn-sm" type="submit">Cập nhật hồ sơ</button>
            </form>
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Đổi mật khẩu</h3>
            <form id="pwd-form">
              <div class="field"><label>Mật khẩu hiện tại</label><input class="input" id="pwd-cur" type="password" required /></div>
              <div class="field"><label>Mật khẩu mới (≥ 6 ký tự)</label><input class="input" id="pwd-new" type="password" minlength="6" required /></div>
              <button class="btn btn-secondary btn-sm" type="submit">Đổi mật khẩu</button>
            </form>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Phiên đăng nhập đang hoạt động (${sessRes.sessions.length})</h3>
        ${sessRes.sessions.slice(0, 6).map((s) => `
          <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.84rem;">
            <div>
              <strong>${s.is_current ? 'Phiên hiện tại' : 'Thiết bị khác'}</strong>
              <span class="muted"> • IP: ${escapeHtml(s.ip_address || 'local')} • ${s.created_at.slice(0, 16)}</span>
            </div>
            ${!s.is_current && !s.is_revoked ? `<button class="btn btn-danger btn-sm" data-revoke-ses="${s.id}">Thu hồi</button>` : `<span class="pill ${s.is_revoked ? 'pill-danger' : 'pill-success'}">${s.is_revoked ? 'Đã thu hồi' : 'Đang dùng'}</span>`}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('theme-btn-glass')?.addEventListener('click', async () => {
    await updatePreferences({ theme_mode: 'liquid-glass' });
    showToast('Đã chuyển sang Liquid Glass Mode (iOS 27).', 'success');
    renderSettingsPage(container, onRerenderShell);
  });

  document.getElementById('theme-btn-classic')?.addEventListener('click', async () => {
    await updatePreferences({ theme_mode: 'classic-education' });
    showToast('Đã chuyển sang Classic Education Mode.', 'success');
    renderSettingsPage(container, onRerenderShell);
  });

  document.getElementById('pref-lang')?.addEventListener('change', async (e) => {
    await updatePreferences({ language: e.target.value });
    showToast('Đã cập nhật ngôn ngữ hệ thống.', 'success');
    if (typeof onRerenderShell === 'function') onRerenderShell();
  });

  document.getElementById('pref-wallpaper')?.addEventListener('change', async (e) => {
    await updatePreferences({ wallpaper: e.target.value });
  });

  container.querySelectorAll('[data-accent]').forEach((b) => {
    b.addEventListener('click', async () => {
      await updatePreferences({ accent_color: b.dataset.accent });
      renderSettingsPage(container, onRerenderShell);
    });
  });

  document.getElementById('pref-opacity')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.getElementById('val-opacity').textContent = `${Math.round(val * 100)}%`;
    updatePreferences({ glass_opacity: val });
  });

  document.getElementById('pref-blur')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.getElementById('val-blur').textContent = `${val}px`;
    updatePreferences({ glass_blur: val });
  });

  document.getElementById('pref-motion')?.addEventListener('change', (e) => {
    updatePreferences({ animation_level: e.target.value });
  });

  document.getElementById('pref-sound')?.addEventListener('change', (e) => {
    updatePreferences({ sound_enabled: e.target.checked });
  });

  document.getElementById('profile-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const res = await apiRequest('/api/v1/profile', {
      method: 'PUT',
      body: {
        display_name: document.getElementById('prof-display').value,
        full_name: document.getElementById('prof-full').value,
        avatar_url: document.getElementById('prof-avatar').value,
        bio: document.getElementById('prof-bio').value,
      },
    });
    state.user = { ...state.user, ...res.user };
    showToast('Đã lưu thông tin hồ sơ!', 'success');
    if (typeof onRerenderShell === 'function') onRerenderShell();
  });

  document.getElementById('pwd-form')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await apiRequest('/api/v1/auth/change-password', {
        method: 'POST',
        body: {
          current_password: document.getElementById('pwd-cur').value,
          new_password: document.getElementById('pwd-new').value,
        },
      });
      showToast('Đã đổi mật khẩu thành công!', 'success');
      ev.target.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  container.querySelectorAll('[data-revoke-ses]').forEach((b) => {
    b.addEventListener('click', async () => {
      await apiRequest(`/api/v1/auth/sessions/${b.dataset.revokeSes}`, { method: 'DELETE' });
      showToast('Đã thu hồi phiên đăng nhập.', 'success');
      renderSettingsPage(container, onRerenderShell);
    });
  });
}

export async function renderModulesPage(container) {
  async function draw() {
    const res = await apiRequest('/api/v1/admin/modules');
    const mods = res.modules || [];
    const isSuper = state.user.role_name === 'super_admin';

    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
        <div>
          <h2 style="margin:0;">Module Manager (${mods.length} modules)</h2>
          <p class="muted" style="margin:4px 0 0;">Quản lý kiến trúc module hóa, kiểm tra dependency và bật/tắt module có kiểm soát.</p>
        </div>

        <div class="grid-3">
          ${mods.map((m) => `
            <div class="card" style="display:flex;flex-direction:column;gap:10px;">
              <div class="flex-between">
                <span class="pill ${m.status === 'healthy' ? 'pill-success' : m.status === 'error' ? 'pill-danger' : 'pill-warning'}">${m.status} • v${m.version}</span>
                ${m.is_core ? '<span class="pill pill-info">Core</span>' : ''}
              </div>
              <h3 style="margin:0;">${escapeHtml(m.name)}</h3>
              <p class="muted" style="margin:0;flex:1;">${escapeHtml(m.description)}</p>
              <div class="muted" style="font-size:0.78rem;">Dependencies: ${m.dependencies.length ? m.dependencies.join(', ') : 'Không có'}</div>
              ${m.last_error ? `<div class="pill pill-danger">${escapeHtml(m.last_error)}</div>` : ''}
              ${isSuper ? `
                <button class="btn ${m.is_enabled ? 'btn-secondary' : 'btn-primary'} btn-sm"
                  data-toggle-mod="${m.id}" data-next="${!m.is_enabled}" ${m.is_core ? 'disabled' : ''}>
                  ${m.is_core ? 'Module lõi (Luôn bật)' : m.is_enabled ? 'Tắt module' : 'Bật module'}
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('[data-toggle-mod]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          await apiRequest(`/api/v1/admin/modules/${b.dataset.toggleMod}`, {
            method: 'PUT',
            body: { enabled: b.dataset.next === 'true' },
          });
          showToast('Đã cập nhật trạng thái module.', 'success');
          draw();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  draw();
}

export async function renderAdminPage(container) {
  const [usersRes, schoolsRes, healthRes] = await Promise.all([
    apiRequest('/api/v1/admin/users'),
    apiRequest('/api/v1/admin/schools'),
    apiRequest('/api/v1/admin/system-health'),
  ]);

  container.innerHTML = `
    <div class="page-enter" style="display:flex;flex-direction:column;gap:20px;">
      <div>
        <h2 style="margin:0;">Bảng điều khiển Quản trị Hệ thống</h2>
        <p class="muted" style="margin:4px 0 0;">Giám sát người dùng, trường học, sức khỏe cơ sở dữ liệu, dung lượng video và nhật ký kiểm toán.</p>
      </div>

      <div class="grid-kpi">
        <div class="card"><div class="kpi-label">Database</div><div class="kpi-value" style="font-size:1.25rem;">${healthRes.database.status.toUpperCase()}</div><div class="muted">${healthRes.database.table_count} bảng • ${(healthRes.database.size_bytes / 1024).toFixed(1)} KB</div></div>
        <div class="card"><div class="kpi-label">Storage Provider</div><div class="kpi-value" style="font-size:1.25rem;">${healthRes.storage.provider.toUpperCase()}</div><div class="muted">${healthRes.storage.file_count} tệp • ${healthRes.storage.used_mb} MB</div></div>
        <div class="card"><div class="kpi-label">Video lưu trữ</div><div class="kpi-value">${healthRes.video_metrics.total_videos}</div><div class="muted">${healthRes.video_metrics.total_mb} MB</div></div>
        <div class="card"><div class="kpi-label">Trường học</div><div class="kpi-value">${schoolsRes.schools.length}</div></div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Danh sách tài khoản (${usersRes.users.length})</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th></tr></thead>
            <tbody>
              ${usersRes.users.map((u) => `
                <tr>
                  <td><strong>${escapeHtml(u.full_name)}</strong></td>
                  <td>${escapeHtml(u.email)}</td>
                  <td><span class="pill pill-info">${u.role_name}</span></td>
                  <td><span class="pill ${u.is_active ? 'pill-success' : 'pill-danger'}">${u.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Nhật ký hệ thống & Audit Logs</h3>
        ${healthRes.audit_logs.slice(0, 12).map((l) => `
          <div class="flex-between" style="padding:7px 0;border-bottom:1px solid var(--border-subtle);font-size:0.84rem;">
            <span><span class="pill ${l.severity === 'error' ? 'pill-danger' : l.severity === 'warning' ? 'pill-warning' : 'pill-info'}">${l.severity}</span> <strong>${escapeHtml(l.actor_name)}</strong> • ${escapeHtml(l.action)} (${escapeHtml(l.resource_type)})</span>
            <span class="muted">${(l.created_at || '').slice(0, 19)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
