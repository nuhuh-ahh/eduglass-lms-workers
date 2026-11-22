/**
 * EduGlass LMS — Lightweight SVG Data Visualization Components
 */
import { escapeHtml } from '../core/store.js';

export function renderBarChart(items, labelKey, valueKey, unit = '', emptyText = 'Chưa có dữ liệu') {
  if (!items || !items.length) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }
  const maxVal = Math.max(1, ...items.map((i) => Number(i[valueKey] || 0)));
  return `
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${items.map((item) => {
        const val = Number(item[valueKey] || 0);
        const pct = Math.min(100, Math.round((val / maxVal) * 100));
        return `
          <div>
            <div class="flex-between" style="font-size:0.84rem;margin-bottom:4px;">
              <span style="font-weight:600;">${escapeHtml(item[labelKey])}</span>
              <span style="font-weight:700;color:var(--accent);">${val}${unit}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderDonutMetric(percent, label) {
  const clamped = Math.max(0, Math.min(100, Number(percent || 0)));
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;
  return `
    <div style="display:flex;align-items:center;gap:16px;">
      <svg width="104" height="104" viewBox="0 0 104 104" aria-label="${escapeHtml(label)} ${clamped}%">
        <circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--surface-subtle)" stroke-width="10"></circle>
        <circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--accent)" stroke-width="10"
          stroke-linecap="round"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          transform="rotate(-90 52 52)"></circle>
        <text x="52" y="57" text-anchor="middle" fill="var(--text-primary)" font-size="18" font-weight="800">${clamped}%</text>
      </svg>
      <div>
        <div class="kpi-label">${escapeHtml(label)}</div>
        <div class="muted" style="margin-top:4px;">Dữ liệu đồng bộ trực tiếp từ cơ sở dữ liệu</div>
      </div>
    </div>
  `;
}
