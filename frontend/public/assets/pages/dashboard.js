/**
 * EduGlass LMS — Role-Aware Dashboard (Teacher/Admin & Student)
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, state } from '../core/store.js';
import { renderBarChart, renderDonutMetric } from '../components/charts.js';

export async function renderDashboardPage(container, navigate) {
  container.innerHTML = `<div class="card"><div class="skeleton" style="height:24px;width:40%;"></div><div class="skeleton" style="height:120px;margin-top:14px;"></div></div>`;

  try {
    const data = await apiRequest('/api/v1/dashboard/overview');

    if (data.role === 'student') {
      const w = data.widgets;
      container.innerHTML = `
        <div class="page-enter" style="display:flex;flex-direction:column;gap:20px;">
          <div class="flex-between">
            <div>
              <h2 style="margin:0;">Xin chào, ${escapeHtml(state.user.display_name)}</h2>
              <p class="muted" style="margin:4px 0 0;">Theo dõi tiến độ học tập, bài giảng tiếp tục và hạn nộp sắp tới.</p>
            </div>
            <button class="btn btn-primary" id="dash-go-classes">Tham gia lớp học</button>
          </div>

          <div class="grid-kpi">
            <div class="card"><div class="kpi-label">Khóa học của tôi</div><div class="kpi-value">${w.my_courses}</div></div>
            <div class="card"><div class="kpi-label">Tiến độ tổng thể</div><div class="kpi-value">${w.learning_progress_pct}%</div></div>
            <div class="card"><div class="kpi-label">Bài đã hoàn thành</div><div class="kpi-value">${w.completed_lessons}</div></div>
            <div class="card"><div class="kpi-label">Bài tập đang chờ</div><div class="kpi-value">${w.pending_assignments}</div></div>
            <div class="card"><div class="kpi-label">Tỷ lệ chính xác</div><div class="kpi-value">${w.accuracy_pct}%</div></div>
          </div>

          <div class="grid-2">
            <div class="card">
              <h3 style="margin-top:0;">Tiếp tục học video</h3>
              ${(data.continue_lessons || []).length ? data.continue_lessons.map((l) => `
                <div style="padding:12px 0;border-bottom:1px solid var(--border-subtle);">
                  <div class="flex-between">
                    <strong>${escapeHtml(l.title)}</strong>
                    <button class="btn btn-primary btn-sm" data-play-lesson="${l.id}">Học ngay</button>
                  </div>
                  <div class="muted" style="margin:4px 0 8px;">${escapeHtml(l.classroom_name)} • ${l.progress_pct}%</div>
                  <div class="progress-track"><div class="progress-fill" style="width:${l.progress_pct}%;"></div></div>
                </div>
              `).join('') : '<p class="muted">Chưa có bài giảng nào được giao.</p>'}
            </div>

            <div class="card">
              <h3 style="margin-top:0;">Hạn nộp sắp tới & Thành tích</h3>
              ${(data.upcoming_deadlines || []).length ? data.upcoming_deadlines.map((d) => `
                <div class="flex-between" style="padding:9px 0;border-bottom:1px solid var(--border-subtle);">
                  <div>
                    <div style="font-weight:600;">${escapeHtml(d.title)}</div>
                    <div class="muted">${escapeHtml(d.classroom_name)}</div>
                  </div>
                  <span class="pill pill-warning">${d.due_date ? d.due_date.slice(0, 10) : 'Mở'}</span>
                </div>
              `).join('') : '<p class="muted">Không có bài tập sắp đến hạn.</p>'}
              <div style="margin-top:16px;">
                <div class="kpi-label" style="margin-bottom:8px;">Huy hiệu thành tích</div>
                <div class="flex-row">
                  ${(data.achievements || []).map((a) => `
                    <span class="pill ${a.earned ? 'pill-success' : 'pill-info'}">${a.earned ? '★' : '○'} ${escapeHtml(a.title)}</span>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('dash-go-classes')?.addEventListener('click', () => navigate('classrooms'));
      container.querySelectorAll('[data-play-lesson]').forEach((btn) => {
        btn.addEventListener('click', () => navigate('player', btn.dataset.playLesson));
      });
      return;
    }

    // Teacher / School Admin / Super Admin Dashboard
    const w = data.widgets;
    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:20px;">
        <div class="flex-between">
          <div>
            <h2 style="margin:0;">Bảng điều khiển giảng dạy & quản lý</h2>
            <p class="muted" style="margin:4px 0 0;">Dữ liệu thời gian thực từ lớp học, Video Studio và hệ thống đánh giá.</p>
          </div>
          <div class="flex-row">
            <button class="btn btn-secondary" id="dash-new-class">Quản lý lớp</button>
            <button class="btn btn-primary" id="dash-open-studio">Mở Video Studio</button>
          </div>
        </div>

        <div class="grid-kpi">
          <div class="card"><div class="kpi-label">Tổng học sinh</div><div class="kpi-value">${w.total_students}</div></div>
          <div class="card"><div class="kpi-label">Lớp hoạt động</div><div class="kpi-value">${w.active_classes}</div></div>
          <div class="card"><div class="kpi-label">Bài giảng đã xuất bản</div><div class="kpi-value">${w.published_lessons}</div></div>
          <div class="card"><div class="kpi-label">Tổng lượt học</div><div class="kpi-value">${w.total_learning_sessions}</div></div>
          <div class="card"><div class="kpi-label">Tỷ lệ hoàn thành</div><div class="kpi-value">${w.completion_rate_pct}%</div></div>
          <div class="card"><div class="kpi-label">Độ chính xác TB</div><div class="kpi-value">${w.average_accuracy_pct}%</div></div>
          <div class="card"><div class="kpi-label">Bài tập chờ chấm</div><div class="kpi-value">${w.pending_assignments}</div></div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3 style="margin-top:0;">Tiến độ theo lớp học (%)</h3>
            ${renderBarChart(data.charts.class_progress, 'name', 'avg_progress', '%')}
          </div>
          <div class="card">
            <h3 style="margin-top:0;">Tỷ lệ hoàn thành & Độ chính xác</h3>
            <div style="display:flex;flex-direction:column;gap:18px;">
              ${renderDonutMetric(w.completion_rate_pct, 'Tỷ lệ hoàn thành bài giảng')}
              ${renderDonutMetric(w.average_accuracy_pct, 'Tỷ lệ trả lời đúng')}
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3 style="margin-top:0;">So sánh kết quả các bài giảng</h3>
            ${renderBarChart(data.charts.lesson_comparison, 'title', 'avg_progress', '%')}
          </div>
          <div class="card">
            <h3 style="margin-top:0;">Hoạt động gần đây</h3>
            ${(data.recent_activities || []).map((a) => `
              <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:0.86rem;">
                <span><strong>${escapeHtml(a.actor)}</strong> • ${escapeHtml(a.action)}</span>
                <span class="muted">${(a.created_at || '').slice(0, 16)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('dash-new-class')?.addEventListener('click', () => navigate('classrooms'));
    document.getElementById('dash-open-studio')?.addEventListener('click', () => navigate('studio'));
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="muted">Không thể tải dashboard: ${escapeHtml(err.message)}</p></div>`;
  }
}
