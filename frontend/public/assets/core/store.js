/**
 * EduGlass LMS — Global Store, Theme Engine, Localization & UI Feedback
 */
import { apiRequest, getToken, setToken } from './api.js';

const LOCAL_PREF_KEY = 'eduglass_local_preferences';

const DEFAULT_PREFS = {
  theme_mode: 'liquid-glass',
  language: 'vi',
  accent_color: '#0A84FF',
  wallpaper: 'aurora-prism',
  glass_opacity: 0.68,
  glass_blur: 22,
  animation_level: 'full',
  sound_enabled: true,
};

export const state = {
  user: null,
  preferences: { ...DEFAULT_PREFS },
  i18n: {},
  route: 'dashboard',
  routeParam: null,
  unreadNotifications: 0,
  modules: [],
};

let audioCtx = null;

export function playSound(type = 'tap') {
  if (!state.preferences.sound_enabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = type === 'success' ? 660 : type === 'error' ? 240 : 520;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.07);
  } catch {
    // Ignore audio context restriction before user gesture
  }
}

export function loadLocalPreferences() {
  try {
    const raw = localStorage.getItem(LOCAL_PREF_KEY);
    if (raw) {
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback to defaults
  }
  return { ...DEFAULT_PREFS };
}

export function saveLocalPreferences(prefs) {
  try {
    localStorage.setItem(LOCAL_PREF_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function applyPreferencesToDOM(prefs, animateTheme = false) {
  const html = document.documentElement;
  const prevTheme = html.getAttribute('data-theme');
  const changedTheme = prevTheme && prevTheme !== prefs.theme_mode;

  if (animateTheme && changedTheme && prefs.animation_level !== 'none') {
    const veil = document.getElementById('theme-transition-veil');
    if (veil) {
      veil.classList.add('active');
      setTimeout(() => veil.classList.remove('active'), 230);
    }
  }

  html.setAttribute('data-theme', prefs.theme_mode || 'liquid-glass');
  html.setAttribute('data-wallpaper', prefs.wallpaper || 'aurora-prism');
  html.setAttribute('lang', prefs.language || 'vi');

  // Auto-reduce effects on low-end hardware (<= 2 logical cores)
  const lowEnd = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  const effectiveMotion = lowEnd && prefs.animation_level === 'full' ? 'reduced' : (prefs.animation_level || 'full');
  html.setAttribute('data-motion', effectiveMotion);

  html.style.setProperty('--accent', prefs.accent_color || '#0A84FF');
  html.style.setProperty('--glass-opacity', String(prefs.glass_opacity ?? 0.68));
  html.style.setProperty('--glass-blur', `${lowEnd ? Math.min(10, prefs.glass_blur ?? 22) : (prefs.glass_blur ?? 22)}px`);
}

export async function updatePreferences(partial, syncServer = true) {
  const merged = { ...state.preferences, ...partial };
  state.preferences = merged;
  saveLocalPreferences(merged);
  applyPreferencesToDOM(merged, Boolean(partial.theme_mode));

  if (partial.language) {
    await loadLocale(partial.language);
  }
  if (syncServer && state.user && getToken()) {
    try {
      const res = await apiRequest('/api/v1/preferences', { method: 'PUT', body: merged });
      if (res && res.preferences) {
        state.preferences = { ...merged, ...res.preferences };
        saveLocalPreferences(state.preferences);
      }
    } catch {
      // Local preference already applied
    }
  }
}

export async function loadLocale(lang = 'vi') {
  try {
    const res = await fetch(`/shared/i18n/${lang}.json`);
    if (res.ok) {
      state.i18n = await res.json();
    }
  } catch {
    state.i18n = {};
  }
}

export function t(path, fallback = '') {
  const parts = path.split('.');
  let cur = state.i18n;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      return fallback || path;
    }
  }
  return typeof cur === 'string' ? cur : fallback || path;
}

export function showToast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const item = document.createElement('div');
  item.className = 'toast-item';
  const icon = type === 'success' ? '✓' : type === 'error' ? '!' : '✦';
  item.innerHTML = `<span class="pill pill-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'}">${icon}</span><span>${escapeHtml(message)}</span>`;
  root.appendChild(item);
  playSound(type);
  setTimeout(() => {
    item.style.opacity = '0';
    item.style.transform = 'translate3d(20px,0,0)';
    setTimeout(() => item.remove(), 220);
  }, 3400);
}

export function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-backdrop" id="active-modal-backdrop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-panel">
        <div class="flex-between" style="margin-bottom: 16px;">
          <h3 style="margin:0;">${escapeHtml(title)}</h3>
          <button class="btn btn-secondary btn-sm" id="close-modal-btn" aria-label="Đóng">✕</button>
        </div>
        <div id="modal-body-slot">${bodyHtml}</div>
      </div>
    </div>
  `;
  const close = () => { root.innerHTML = ''; };
  document.getElementById('close-modal-btn')?.addEventListener('click', close);
  document.getElementById('active-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'active-modal-backdrop') close();
  });
  if (typeof onMount === 'function') {
    onMount(document.getElementById('modal-body-slot'), close);
  }
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function bootstrapSession() {
  state.preferences = loadLocalPreferences();
  applyPreferencesToDOM(state.preferences, false);
  await loadLocale(state.preferences.language || 'vi');

  if (!getToken()) return false;
  try {
    const data = await apiRequest('/api/v1/auth/me');
    state.user = data.user;
    if (data.preferences) {
      state.preferences = { ...state.preferences, ...data.preferences };
      saveLocalPreferences(state.preferences);
      applyPreferencesToDOM(state.preferences, false);
      await loadLocale(state.preferences.language || 'vi');
    }
    return true;
  } catch {
    setToken('');
    state.user = null;
    return false;
  }
}
