/**
 * EduGlass LMS — Public Landing Page
 * Removes the forced Login Wall for Google OAuth Branding Compliance.
 * Features: App introduction, Google Login CTA, Features overview, and Footer with /policy and /terms-of-service links.
 */
import { escapeHtml, state, updatePreferences } from '../core/store.js';
import { loadGsiScript } from '../core/gdrive.js';

export function renderLandingPage(container, navigate, onOpenAuth) {
  const isGlass = state.preferences.theme_mode === 'liquid-glass';

  container.innerHTML = `
    <div class="page-enter" style="display:flex;flex-direction:column;min-height:100vh;">
      <!-- Public Navbar -->
      <header class="topbar" style="position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:rgba(255,255,255,0.06);border-bottom:1px solid var(--border-subtle);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;">
        <div class="brand-lockup" style="padding:0;cursor:pointer;" id="landing-brand-logo">
          <div class="brand-logo" aria-hidden="true">EG</div>
          <div>
            <div class="brand-title">EduGlass LMS</div>
            <div class="brand-sub">Nền tảng quản lý học tập thông minh</div>
          </div>
        </div>

        <nav class="flex-row" style="gap:14px;align-items:center;">
          <a href="#features" class="btn btn-secondary btn-sm" style="text-decoration:none;border:none;">Tính năng</a>
          <a href="/policy" class="btn btn-secondary btn-sm" id="nav-link-policy" style="text-decoration:none;border:none;">Chính sách bảo mật</a>
          <a href="/terms-of-service" class="btn btn-secondary btn-sm" id="nav-link-terms" style="text-decoration:none;border:none;">Điều khoản</a>
          <button class="btn btn-secondary btn-sm" id="landing-theme-toggle" title="Chuyển chế độ giao diện">
            ${isGlass ? 'Classic' : 'Liquid Glass'}
          </button>
          <button class="btn btn-primary btn-sm" id="landing-btn-login">Đăng nhập</button>
        </nav>
      </header>

      <!-- Hero Section -->
      <main style="flex:1;max-width:1120px;margin:0 auto;padding:48px 20px;display:flex;flex-direction:column;gap:56px;">
        <section style="text-align:center;padding:40px 10px 20px;">
          <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(10,132,255,0.1);border:1px solid rgba(10,132,255,0.25);color:var(--primary);font-size:0.84rem;font-weight:600;margin-bottom:18px;">
            <span>✦</span> Nền tảng học tập video tương tác thế hệ mới
          </div>

          <h1 style="font-size:clamp(1.9rem, 4vw, 2.8rem);font-weight:800;line-height:1.25;margin:0 auto 18px;max-width:850px;letter-spacing:-0.02em;">
            Chào mừng đến với EduGlass LMS — Nền tảng quản lý học tập thông minh
          </h1>

          <p class="muted" style="font-size:clamp(0.95rem, 1.8vw, 1.12rem);max-width:680px;margin:0 auto 32px;line-height:1.65;">
            Trải nghiệm học tập video thông minh với công nghệ dừng hình trả lời câu hỏi trực tiếp trên dòng thời gian, cơ chế chống tua gian lận, gamification Gems và tích hợp liền mạch kho video Google Drive & YouTube.
          </p>

          <div class="flex-row" style="justify-content:center;gap:14px;flex-wrap:wrap;">
            <!-- Google OAuth Login CTA -->
            <button class="btn btn-primary" id="btn-hero-google-login" style="padding:12px 22px;font-size:0.96rem;display:flex;align-items:center;gap:10px;box-shadow:0 8px 20px rgba(10,132,255,0.25);">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Đăng nhập bằng Google</span>
            </button>

            <button class="btn btn-secondary" id="btn-hero-standard-login" style="padding:12px 20px;font-size:0.96rem;">
              🔑 Đăng nhập Hệ thống / Đăng ký
            </button>

            <a href="/policy" id="btn-hero-policy" class="btn btn-secondary" style="padding:12px 20px;font-size:0.96rem;text-decoration:none;">
              📖 Xem Chính sách bảo mật
            </a>
          </div>
        </section>

        <!-- Feature Highlights -->
        <section id="features" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(310px, 1fr));gap:20px;">
          <div class="card" style="padding:24px;border:1px solid var(--border-subtle);background:rgba(255,255,255,0.03);">
            <div style="font-size:2.2rem;margin-bottom:12px;">🎬</div>
            <h3 style="margin:0 0 8px;font-size:1.15rem;">Video Learning Studio</h3>
            <p class="muted" style="margin:0;font-size:0.86rem;line-height:1.6;">
              Gắn câu hỏi tương tác trực tiếp lên từng giây của bài giảng. Video tự động dừng hình, bắt buộc học sinh trả lời trước khi tiếp tục.
            </p>
          </div>

          <div class="card" style="padding:24px;border:1px solid var(--border-subtle);background:rgba(255,255,255,0.03);">
            <div style="font-size:2.2rem;margin-bottom:12px;">📁</div>
            <h3 style="margin:0 0 8px;font-size:1.15rem;">Tích Hợp Google Drive & YouTube</h3>
            <p class="muted" style="margin:0;font-size:0.86rem;line-height:1.6;">
              Phát trực tiếp từ CDN Google tốc độ cao, hỗ trợ tài khoản Google Drive 15 GB miễn phí đến các gói dung lượng lớn với 0đ chi phí băng thông.
            </p>
          </div>

          <div class="card" style="padding:24px;border:1px solid var(--border-subtle);background:rgba(255,255,255,0.03);">
            <div style="font-size:2.2rem;margin-bottom:12px;">💎</div>
            <h3 style="margin:0 0 8px;font-size:1.15rem;">Gamification Gems Engine</h3>
            <p class="muted" style="margin:0;font-size:0.86rem;line-height:1.6;">
              Thưởng Gems lấp lánh khi xem trọn vẹn bài giảng và giải đúng câu hỏi, tạo động lực thi đua học tập cho học sinh.
            </p>
          </div>

          <div class="card" style="padding:24px;border:1px solid var(--border-subtle);background:rgba(255,255,255,0.03);">
            <div style="font-size:2.2rem;margin-bottom:12px;">👥</div>
            <h3 style="margin:0 0 8px;font-size:1.15rem;">Tài Khoản Con & Link Nhanh</h3>
            <p class="muted" style="margin:0;font-size:0.86rem;line-height:1.6;">
              Giáo viên quản lý toàn bộ học sinh lớp mình, cấp link đăng nhập 1 chạm không cần tài khoản hay mật khẩu phức tạp.
            </p>
          </div>

          <div class="card" style="padding:24px;border:1px solid var(--border-subtle);background:rgba(255,255,255,0.03);">
            <div style="font-size:2.2rem;margin-bottom:12px;">⚡</div>
            <h3 style="margin:0 0 8px;font-size:1.15rem;">Cloudflare Workers 24/7</h3>
            <p class="muted" style="margin:0;font-size:0.86rem;line-height:1.6;">
              Vận hành trên mạng lưới đám mây phân tán toàn cầu của Cloudflare. Thời gian phản hồi tính bằng mili-giây, uptime 99.99%.
            </p>
          </div>

          <div class="card" style="padding:24px;border:1px solid var(--border-subtle);background:rgba(255,255,255,0.03);">
            <div style="font-size:2.2rem;margin-bottom:12px;">✦</div>
            <h3 style="margin:0 0 8px;font-size:1.15rem;">Liquid Glass Design System</h3>
            <p class="muted" style="margin:0;font-size:0.86rem;line-height:1.6;">
              Giao diện kính mờ Liquid Glass thế hệ mới với hiệu ứng phản quang trỏ chuột, de-blur quang học và haptic phản hồi xúc giác.
            </p>
          </div>
        </section>
      </main>

      <!-- Footer Required for Google Verification -->
      <footer style="margin-top:auto;border-top:1px solid var(--border-subtle);background:rgba(0,0,0,0.15);padding:36px 24px 28px;">
        <div style="max-width:1120px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px;align-items:flex-start;">
          <div style="max-width:380px;">
            <div class="brand-lockup" style="padding:0;margin-bottom:8px;">
              <div class="brand-logo" aria-hidden="true">EG</div>
              <div class="brand-title">EduGlass LMS</div>
            </div>
            <p class="muted" style="font-size:0.82rem;line-height:1.6;margin:0;">
              EduGlass LMS là nền tảng quản lý học tập thông minh, hỗ trợ giáo viên và học sinh học tập video tương tác trên nền tảng đám mây không máy chủ.
            </p>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px;color:var(--text);">Chính Sách & Pháp Lý</div>
            <a href="/policy" id="footer-policy-link" style="color:var(--text-muted);font-size:0.84rem;text-decoration:none;transition:color 0.2s ease;">
              🔒 Chính sách bảo mật (Privacy Policy)
            </a>
            <a href="/terms-of-service" id="footer-terms-link" style="color:var(--text-muted);font-size:0.84rem;text-decoration:none;transition:color 0.2s ease;">
              📋 Điều khoản dịch vụ (Terms of Service)
            </a>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px;color:var(--text);">Hỗ Trợ & Liên Hệ</div>
            <div style="font-size:0.84rem;color:var(--text-muted);">
              Email: <a href="mailto:akumiyuukii@gmail.com" style="color:var(--primary);text-decoration:none;">akumiyuukii@gmail.com</a>
            </div>
            <div style="font-size:0.84rem;color:var(--text-muted);">
              Địa chỉ: https://eduglass-lms-workers.akumiyuukii.workers.dev
            </div>
          </div>
        </div>

        <div style="max-width:1120px;margin:24px auto 0;padding-top:16px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;font-size:0.78rem;" class="muted">
          <div>© 2026 EduGlass LMS. Nền tảng quản lý học tập thông minh. All rights reserved.</div>
          <div class="flex-row" style="gap:14px;">
            <a href="/policy" style="color:inherit;text-decoration:underline;">Chính sách bảo mật</a>
            <span>•</span>
            <a href="/terms-of-service" style="color:inherit;text-decoration:underline;">Điều khoản dịch vụ</a>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Event Listeners
  document.getElementById('landing-btn-login')?.addEventListener('click', () => onOpenAuth('login'));
  document.getElementById('btn-hero-standard-login')?.addEventListener('click', () => onOpenAuth('login'));

  document.getElementById('btn-hero-google-login')?.addEventListener('click', async () => {
    try {
      await loadGsiScript();
      const clientId = localStorage.getItem('eduglass_gdrive_client_id');
      if (clientId && window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile https://www.googleapis.com/auth/drive.readonly',
          callback: (res) => {
            if (res.access_token) {
              onOpenAuth('google', res.access_token);
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        // Direct to standard login which includes Google options
        onOpenAuth('login');
      }
    } catch {
      onOpenAuth('login');
    }
  });

  document.getElementById('nav-link-policy')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('policy');
  });

  document.getElementById('nav-link-terms')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('terms-of-service');
  });

  document.getElementById('btn-hero-policy')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('policy');
  });

  document.getElementById('footer-policy-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('policy');
  });

  document.getElementById('footer-terms-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('terms-of-service');
  });

  document.getElementById('landing-theme-toggle')?.addEventListener('click', async () => {
    const next = state.preferences.theme_mode === 'liquid-glass' ? 'classic-education' : 'liquid-glass';
    await updatePreferences({ theme_mode: next }, false);
    renderLandingPage(container, navigate, onOpenAuth);
  });
}
