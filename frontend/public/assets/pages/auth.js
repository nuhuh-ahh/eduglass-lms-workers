/**
 * EduGlass LMS — Clean Production Authentication Page (Zero Demo Data)
 */
import { apiRequest, setToken } from '../core/api.js';
import { applyPreferencesToDOM, loadLocale, showToast, state, t, updatePreferences } from '../core/store.js';

export function renderAuthPage(container, onAuthenticated, initialMode = 'login', onBackToHome = null) {
  let mode = initialMode || 'login';

  function draw() {
    container.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card page-enter">
          ${onBackToHome ? `
            <div style="margin-bottom:12px;">
              <button class="btn btn-secondary btn-sm" id="auth-back-to-home" style="border:none;background:transparent;padding:0;color:var(--primary);font-size:0.82rem;font-weight:600;">
                ← Quay lại Trang chủ
              </button>
            </div>
          ` : ''}
          <div class="flex-between" style="margin-bottom:22px;">
            <div class="brand-lockup" style="padding:0;">
              <div class="brand-logo" aria-hidden="true">EG</div>
              <div>
                <div class="brand-title">${t('app.name', 'EduGlass LMS')}</div>
                <div class="brand-sub">${t('app.tagline', 'Học tập video tương tác')}</div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="auth-theme-toggle" title="Chuyển chế độ giao diện">
              ${state.preferences.theme_mode === 'liquid-glass' ? 'Classic' : 'Liquid Glass'}
            </button>
          </div>

          <div class="flex-row" style="margin-bottom:20px;">
            <button class="btn ${mode === 'login' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-auth-tab="login">${t('auth.login', 'Đăng nhập')}</button>
            <button class="btn ${mode === 'register' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-auth-tab="register">${t('auth.register', 'Đăng ký')}</button>
            <button class="btn ${mode === 'forgot' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-auth-tab="forgot">${t('auth.forgot', 'Quên mật khẩu')}</button>
          </div>

          ${mode === 'login' ? `
            <div class="card" style="padding:10px 14px;margin-bottom:16px;background:var(--surface-subtle);font-size:0.8rem;border-left:3px solid var(--accent);">
              💡 <strong>Hệ thống hỗ trợ:</strong> Đăng nhập bằng tài khoản Giáo viên, hoặc tài khoản Học sinh do Giáo viên cấp.
            </div>
            <form id="login-form">
              <div class="field">
                <label for="login-email">${t('auth.email', 'Email / Tên đăng nhập')}</label>
                <input class="input" id="login-email" type="text" autocomplete="username" required placeholder="Nhập địa chỉ email hoặc tên đăng nhập" />
              </div>
              <div class="field">
                <label for="login-password">${t('auth.password', 'Mật khẩu')}</label>
                <input class="input" id="login-password" type="password" autocomplete="current-password" required placeholder="Nhập mật khẩu" />
              </div>
              <label class="flex-row" style="font-size:0.84rem;margin-bottom:18px;cursor:pointer;">
                <input type="checkbox" id="login-remember" />
                <span>${t('auth.rememberMe', 'Ghi nhớ đăng nhập')}</span>
              </label>
              <button class="btn btn-primary" type="submit" style="width:100%;">${t('auth.login', 'Đăng nhập')}</button>
            </form>
          ` : mode === 'register' ? `
            <form id="register-form">
              <div class="field">
                <label for="reg-name">${t('auth.fullName', 'Họ và tên')}</label>
                <input class="input" id="reg-name" autocomplete="name" required placeholder="Nhập họ và tên của bạn" />
              </div>
              <div class="field">
                <label for="reg-email">${t('auth.email', 'Email')}</label>
                <input class="input" id="reg-email" type="email" autocomplete="email" required placeholder="Nhập địa chỉ email" />
              </div>
              <div class="field">
                <label for="reg-password">${t('auth.password', 'Mật khẩu')}</label>
                <input class="input" id="reg-password" type="password" autocomplete="new-password" minlength="6" required placeholder="Tối thiểu 6 ký tự" />
              </div>
              <div class="field">
                <label for="reg-role">${t('auth.role', 'Vai trò đăng ký')}</label>
                <select class="select" id="reg-role">
                  <option value="teacher">🧑‍🏫 Giáo viên (Tạo lớp, quản lý và cấp tài khoản cho học sinh)</option>
                  <option value="student">🧑‍🎓 Học sinh (Tham gia lớp học và làm bài tập)</option>
                </select>
              </div>
              <div class="card" style="padding:10px 12px;margin:0 0 14px;background:var(--surface-subtle);font-size:0.78rem;">
                <p class="muted" style="margin:0 0 4px;">• Tài khoản đầu tiên trên hệ thống mới sẽ tự động được cấp quyền Super Admin.</p>
                <p class="muted" style="margin:0;">• Khi đăng ký <strong>Giáo viên</strong>, bạn có thể tạo và đăng nhập trực tiếp vào các tài khoản con của học sinh.</p>
              </div>
              <button class="btn btn-primary" type="submit" style="width:100%;">${t('auth.register', 'Đăng ký Tài khoản')}</button>
            </form>
          ` : `
            <form id="forgot-form">
              <div class="field">
                <label for="forgot-email">Email tài khoản</label>
                <input class="input" id="forgot-email" type="email" required placeholder="Nhập email đã đăng ký" />
              </div>
              <button class="btn btn-primary" type="submit" style="width:100%;">Tạo mã đặt lại mật khẩu</button>
            </form>
            <div id="forgot-result" style="margin-top:12px;"></div>
          `}

          <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border-subtle);text-align:center;font-size:0.78rem;color:var(--text-muted);display:flex;justify-content:center;gap:14px;">
            <a href="/policy" id="auth-link-policy" style="color:inherit;text-decoration:underline;">Chính sách bảo mật</a>
            <span>•</span>
            <a href="/terms-of-service" id="auth-link-terms" style="color:inherit;text-decoration:underline;">Điều khoản dịch vụ</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('auth-back-to-home')?.addEventListener('click', () => {
      if (onBackToHome) onBackToHome();
    });

    container.querySelectorAll('[data-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.authTab;
        draw();
      });
    });

    document.getElementById('auth-theme-toggle')?.addEventListener('click', async () => {
      const next = state.preferences.theme_mode === 'liquid-glass' ? 'classic-education' : 'liquid-glass';
      await updatePreferences({ theme_mode: next }, false);
      draw();
    });

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await apiRequest('/api/v1/auth/login', {
          method: 'POST',
          body: {
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
            remember_me: document.getElementById('login-remember').checked,
          },
        });
        setToken(res.access_token);
        state.user = res.user;
        if (res.preferences) {
          state.preferences = { ...state.preferences, ...res.preferences };
          applyPreferencesToDOM(state.preferences, true);
          await loadLocale(state.preferences.language || 'vi');
        }
        showToast(`Chào mừng ${res.user.display_name}!`, 'success');
        onAuthenticated();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await apiRequest('/api/v1/auth/register', {
          method: 'POST',
          body: {
            full_name: document.getElementById('reg-name').value,
            email: document.getElementById('reg-email').value,
            password: document.getElementById('reg-password').value,
            role: document.getElementById('reg-role').value,
          },
        });
        setToken(res.access_token);
        state.user = res.user;
        showToast('Đăng ký tài khoản thành công!', 'success');
        onAuthenticated();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await apiRequest('/api/v1/auth/forgot-password', {
          method: 'POST',
          body: { email: document.getElementById('forgot-email').value },
        });
        document.getElementById('forgot-result').innerHTML = `
          <div class="card" style="padding:12px;">
            <p style="margin:0 0 8px;font-size:0.85rem;">${res.message}</p>
            ${res.reset_token_preview ? `<code style="font-size:0.78rem;word-break:break-all;">Token: ${res.reset_token_preview}</code>` : ''}
          </div>
        `;
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  draw();
}
