/**
 * EduGlass LMS — Main SPA Shell, Router & Liquid Glass Pointer Specular Engine
 */
import { apiRequest, setToken } from './core/api.js';
import { bootstrapSession, escapeHtml, showToast, state, t, updatePreferences } from './core/store.js';
import { renderAuthPage } from './pages/auth.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderClassroomsPage } from './pages/classrooms.js';
import { renderVideoStudioPage } from './pages/video_studio.js';
import { renderVideoPlayerPage } from './pages/video_player.js';
import { renderQuizzesPage } from './pages/quizzes.js';
import { renderAnalyticsPage } from './pages/analytics.js';
import { renderCalendarPage, renderNotificationsPage } from './pages/calendar_notifications.js';
import { renderAdminPage, renderModulesPage, renderSettingsPage } from './pages/settings_admin.js';
import { renderSubAccountsPage } from './pages/sub_accounts.js';

const appRoot = document.getElementById('app');

// High-performance hardware-throttled specular sheen for Liquid Glass cards
let lastMoveTime = 0;
let activeCard = null;
let activeCardRect = null;

window.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - lastMoveTime < 25) return; // Cap at ~40 FPS to avoid UI stutter
  lastMoveTime = now;

  if (document.documentElement.getAttribute('data-theme') !== 'liquid-glass') return;
  if (document.documentElement.getAttribute('data-motion') === 'none') return;

  const target = e.target;
  if (!target) return;
  // Never compute reflections inside video stage or controls
  if (target.closest && (target.closest('.video-stage') || target.closest('video'))) return;

  const card = target.closest ? target.closest('.card, .stat-card, .auth-card') : null;
  if (!card) {
    activeCard = null;
    activeCardRect = null;
    return;
  }

  if (activeCard !== card) {
    activeCard = card;
    activeCardRect = card.getBoundingClientRect();
  }

  if (activeCardRect) {
    card.style.setProperty('--mx', `${e.clientX - activeCardRect.left}px`);
    card.style.setProperty('--my', `${e.clientY - activeCardRect.top}px`);
  }
}, { passive: true });

window.addEventListener('scroll', () => { activeCard = null; activeCardRect = null; }, { passive: true });

function getNavItems(role) {
  const isStaff = ['teacher', 'school_admin', 'super_admin'].includes(role);
  const isAdmin = ['school_admin', 'super_admin'].includes(role);
  return [
    { id: 'dashboard', label: t('nav.dashboard', 'Tổng quan'), icon: '◈' },
    { id: 'classrooms', label: t('nav.classrooms', 'Lớp học'), icon: '▦' },
    ...(isStaff ? [{ id: 'subaccounts', label: 'Tài khoản Học sinh', icon: '👥' }] : []),
    ...(isStaff ? [{ id: 'studio', label: t('nav.studio', 'Video Studio'), icon: '▶' }] : []),
    { id: 'player', label: t('nav.player', 'Học Video'), icon: '◉' },
    { id: 'quizzes', label: t('nav.quizzes', 'Kiểm tra & Bài tập'), icon: '✎' },
    ...(isStaff ? [{ id: 'analytics', label: t('nav.analytics', 'Thống kê & Báo cáo'), icon: '◔' }] : []),
    { id: 'calendar', label: t('nav.calendar', 'Lịch học'), icon: '◫' },
    { id: 'notifications', label: t('nav.notifications', 'Thông báo'), icon: '◎', badge: state.unreadNotifications },
    { id: 'settings', label: t('nav.settings', 'Giao diện & Cài đặt'), icon: '⚙' },
    { id: 'modules', label: t('nav.modules', 'Quản lý Module'), icon: '❖' },
    ...(isAdmin ? [{ id: 'admin', label: t('nav.admin', 'Quản trị Hệ thống'), icon: '⌘' }] : []),
  ];
}

function navigate(route, param = null) {
  state.route = route;
  state.routeParam = param;
  window.location.hash = param ? `#${route}/${param}` : `#${route}`;
  renderActiveView();
  updateActiveNavHighlight();
}

function updateActiveNavHighlight() {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === state.route);
  });
}

async function renderActiveView() {
  const slot = document.getElementById('page-content');
  if (!slot) return;
  switch (state.route) {
    case 'dashboard': await renderDashboardPage(slot, navigate); break;
    case 'classrooms': await renderClassroomsPage(slot, navigate, state.routeParam); break;
    case 'subaccounts': await renderSubAccountsPage(slot, navigate, renderAppShell); break;
    case 'studio': await renderVideoStudioPage(slot, navigate); break;
    case 'player': await renderVideoPlayerPage(slot, state.routeParam); break;
    case 'quizzes': await renderQuizzesPage(slot); break;
    case 'analytics': await renderAnalyticsPage(slot); break;
    case 'calendar': await renderCalendarPage(slot); break;
    case 'notifications':
      await renderNotificationsPage(slot, (cnt) => {
        const badge = document.getElementById('nav-unread-badge');
        if (badge) {
          badge.textContent = cnt > 0 ? String(cnt) : '';
          badge.style.display = cnt > 0 ? 'inline-flex' : 'none';
        }
      });
      break;
    case 'settings': await renderSettingsPage(slot, renderAppShell); break;
    case 'modules': await renderModulesPage(slot); break;
    case 'admin': await renderAdminPage(slot); break;
    default: await renderDashboardPage(slot, navigate);
  }
}

async function refreshUnreadBadge() {
  try {
    const res = await apiRequest('/api/v1/notifications');
    state.unreadNotifications = res.unread_count || 0;
  } catch {
    state.unreadNotifications = 0;
  }
}

async function renderAppShell() {
  if (!state.user) {
    renderAuthPage(appRoot, () => renderAppShell());
    return;
  }

  await refreshUnreadBadge();
  const navItems = getNavItems(state.user.role_name);
  const isGlass = state.preferences.theme_mode === 'liquid-glass';

  const parentTeacherRaw = localStorage.getItem('eduglass_parent_teacher');
  let parentTeacher = null;
  if (parentTeacherRaw) {
    try { parentTeacher = JSON.parse(parentTeacherRaw); } catch { /* ignore */ }
  }

  appRoot.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Điều hướng chính">
        <div class="brand-lockup">
          <div class="brand-logo" aria-hidden="true">EG</div>
          <div>
            <div class="brand-title">${t('app.name', 'EduGlass LMS')}</div>
            <div class="brand-sub" id="sidebar-theme-label">${isGlass ? 'Liquid Glass iOS 27' : 'Classic Education'}</div>
          </div>
        </div>

        <nav class="nav-list">
          ${navItems.map((item) => `
            <button class="nav-item ${item.id === state.route ? 'active' : ''}" data-nav="${item.id}">
              <span aria-hidden="true">${item.icon}</span>
              <span>${escapeHtml(item.label)}</span>
              ${item.id === 'notifications'
                ? `<span class="nav-badge" id="nav-unread-badge" style="display:${item.badge > 0 ? 'inline-flex' : 'none'};">${item.badge || ''}</span>`
                : ''}
            </button>
          `).join('')}
        </nav>

        <div style="padding-top:12px;border-top:1px solid var(--border-subtle);margin-top:12px;">
          <div style="font-size:0.86rem;font-weight:700;">${escapeHtml(state.user.display_name)}</div>
          <div class="muted" style="font-size:0.75rem;margin-bottom:8px;">${escapeHtml(state.user.role_name)}</div>
          <button class="btn btn-secondary btn-sm" id="btn-logout" style="width:100%;">${t('nav.logout', 'Đăng xuất')}</button>
        </div>
      </aside>

      <div class="main-column">
        ${parentTeacher ? `
          <div class="impersonation-banner" style="margin:16px 20px 0;">
            <div class="flex-row" style="gap:10px;">
              <span class="pulse-dot" aria-hidden="true"></span>
              <span>
                <strong>Đang xem với tư cách học sinh:</strong>
                ${escapeHtml(state.user.display_name)} (${escapeHtml(state.user.email)})
              </span>
              <span class="pill" style="font-size:0.75rem;background:rgba(255,255,255,0.25);color:#fff;">
                Tài khoản con
              </span>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-switch-back" style="background:#fff;color:#B45309;font-weight:700;border:none;">
              ↩ Quay lại Giáo viên (${escapeHtml(parentTeacher.teacher?.display_name || 'Thầy/Cô')})
            </button>
          </div>
        ` : ''}

        <header class="topbar">
          <div class="flex-row">
            <span class="pill pill-info" id="topbar-theme-pill">${isGlass ? '✦ Liquid Glass' : '▣ Classic LMS'}</span>
            <span class="muted" style="font-size:0.84rem;">${escapeHtml(state.user.email)}</span>
          </div>
          <div class="flex-row">
            <button class="btn btn-secondary btn-sm" id="quick-theme-switch" title="Chuyển nhanh giữa Liquid Glass và Classic Education">
              ${isGlass ? 'Chuyển Classic' : 'Chuyển Liquid Glass'}
            </button>
            <button class="btn btn-secondary btn-sm" id="quick-lang-switch">
              ${state.preferences.language === 'vi' ? 'EN' : 'VI'}
            </button>
          </div>
        </header>

        <main id="page-content" class="page-content"></main>
      </div>

      <nav class="mobile-tabbar" aria-label="Điều hướng di động">
        ${navItems.slice(0, 5).map((item) => `
          <button class="${item.id === state.route ? 'active' : ''}" data-nav="${item.id}">${item.icon} ${escapeHtml(item.label.split(' ')[0])}</button>
        `).join('')}
      </nav>
    </div>
  `;

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  document.getElementById('quick-theme-switch')?.addEventListener('click', async () => {
    const next = state.preferences.theme_mode === 'liquid-glass' ? 'classic-education' : 'liquid-glass';
    await updatePreferences({ theme_mode: next });
    const nowGlass = next === 'liquid-glass';
    const btn = document.getElementById('quick-theme-switch');
    const pill = document.getElementById('topbar-theme-pill');
    const sub = document.getElementById('sidebar-theme-label');
    if (btn) btn.textContent = nowGlass ? 'Chuyển Classic' : 'Chuyển Liquid Glass';
    if (pill) pill.textContent = nowGlass ? '✦ Liquid Glass' : '▣ Classic LMS';
    if (sub) sub.textContent = nowGlass ? 'Liquid Glass iOS 27' : 'Classic Education';
    showToast(`Đã chuyển sang ${nowGlass ? 'Liquid Glass Mode' : 'Classic Education Mode'}.`, 'success');
  });

  document.getElementById('quick-lang-switch')?.addEventListener('click', async () => {
    const next = state.preferences.language === 'vi' ? 'en' : 'vi';
    await updatePreferences({ language: next });
    renderAppShell();
  });

  document.getElementById('btn-switch-back')?.addEventListener('click', async () => {
    const raw = localStorage.getItem('eduglass_parent_teacher');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      setToken(data.token);
      localStorage.removeItem('eduglass_parent_teacher');
      const meRes = await apiRequest('/api/v1/auth/me');
      state.user = meRes.user;
      showToast(`Đã quay trở lại tài khoản Giáo viên: ${state.user.display_name}!`, 'success');
      state.route = 'subaccounts';
      await renderAppShell();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try { await apiRequest('/api/v1/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setToken('');
    localStorage.removeItem('eduglass_parent_teacher');
    state.user = null;
    renderAppShell();
  });

  await renderActiveView();
}

async function init() {
  const hash = (window.location.hash || '#dashboard').replace(/^#/, '');
  const [route, param] = hash.split('/');
  if (route) {
    state.route = route;
    state.routeParam = param || null;
  }
  await bootstrapSession();
  await renderAppShell();
}

init();
