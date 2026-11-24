/**
 * EduGlass LMS — Role-Aware Dashboard (Teacher/Admin & Student)
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, state } from '../core/store.js';
import { renderBarChart, renderDonutMetric } from '../components/charts.js';
import { getGDriveState } from '../core/gdrive.js';

function renderGDriveQuotaCard(gdrive) {
  const devNotice = `
    <div class="card" style="border:1px solid rgba(245, 158, 11, 0.35);background:rgba(245, 158, 11, 0.06);padding:12px 14px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:1.3rem;line-height:1;">💡</span>
      <div style="font-size:0.8rem;line-height:1.5;">
        <strong style="color:#F59E0B;">Lưu ý cách dùng đơn giản nhất cho Giáo viên:</strong>
        Bạn <strong>chỉ cần tải video lên Google Drive</strong> cá nhân → Chuột phải chọn <em>"Chia sẻ" (Ai có liên kết đều xem được)</em> → <em>Sao chép link</em> dán vào bài giảng là phát được ngay!
        <div class="muted" style="margin-top:2px;font-size:0.75rem;">
          ⚙️ <em>Phần kết nối Google Drive API bên dưới là <strong>tùy chọn nâng cao dành cho Developer / Quản trị viên</strong> có hiểu biết kỹ thuật.</em>
        </div>
      </div>
    </div>
  `;

  if (!gdrive.isConnected || !gdrive.quota) {
    return `
      ${devNotice}
      <div class="card" style="border:1px solid rgba(10,132,255,0.2);background:linear-gradient(135deg, rgba(10,132,255,0.05), rgba(48,209,88,0.03));padding:16px 20px;">
        <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.06);font-size:22px;">
              📁
            </div>
            <div>
              <div style="font-weight:700;font-size:1.02rem;display:flex;align-items:center;gap:8px;">
                Kho Lưu Trữ Google Drive
                <span class="pill pill-warning" style="font-size:0.75rem;">● Tùy chọn Dev</span>
              </div>
              <div class="muted" style="font-size:0.82rem;margin-top:2px;">
                Kết nối tự động duyệt tệp (Dành cho Developer / Admin hiểu biết Google Cloud).
              </div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" data-gdrive-nav style="gap:6px;">
            ⚙ Cấu hình nâng cao (Dev)
          </button>
        </div>
      </div>
    `;
  }

  const q = gdrive.quota;
  return `
    ${devNotice}
    <div class="card" style="border:1px solid rgba(10,132,255,0.25);background:linear-gradient(135deg, rgba(10,132,255,0.06), rgba(48,209,88,0.04));padding:16px 20px;">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.06);font-size:22px;">
            📁
          </div>
          <div>
            <div style="font-weight:700;font-size:1.02rem;display:flex;align-items:center;gap:8px;">
              Kho Lưu Trữ Google Drive
              <span class="pill pill-success" style="font-size:0.75rem;">● Đã kết nối</span>
            </div>
            <div class="muted" style="font-size:0.82rem;margin-top:2px;">
              ${escapeHtml(gdrive.user?.email || '')} ${gdrive.user?.name ? `(${escapeHtml(gdrive.user.name)})` : ''}
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" data-gdrive-nav style="gap:6px;">
          📁 Mở kho tệp Google Drive
        </button>
      </div>

      <div style="margin-top:14px;">
        <div class="flex-between" style="font-size:0.84rem;margin-bottom:6px;">
          <span><strong>Tổng dung lượng đã dùng:</strong> ${q.usedStr} / ${q.totalStr} ${q.isUnlimited ? '' : `(${q.pctStr || `${q.pct}%`})`}</span>
          <span class="muted">Còn trống: ${q.freeStr}</span>
        </div>
        ${!q.isUnlimited ? `
          <div class="progress-track" style="height:9px;background:rgba(255,255,255,0.35);border-radius:999px;overflow:hidden;">
            <div class="progress-fill" style="width:${q.pct}%;height:100%;background:linear-gradient(90deg, #0A84FF, #30D158);border-radius:999px;transition:width 0.6s cubic-bezier(0.16,1,0.3,1);"></div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

export async function renderDashboardPage(container, navigate) {
  container.innerHTML = `<div class="card"><div class="skeleton" style="height:24px;width:40%;"></div><div class="skeleton" style="height:120px;margin-top:14px;"></div></div>`;

  try {
    const data = await apiRequest('/api/v1/dashboard/overview');
    const gdrive = getGDriveState();

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

          <div class="card" style="background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05));border:1px solid rgba(99,102,241,0.2);padding:16px 20px;">
            <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
              <div style="display:flex;align-items:center;gap:14px;">
                <div style="font-size:32px;line-height:1;">💎</div>
                <div>
                  <div style="font-weight:700;font-size:1.05rem;">Góc Học Tập Tích Lũy Gems</div>
                  <div class="muted" style="font-size:0.82rem;margin-top:2px;">
                    Xem trọn vẹn video nhận ngay <strong>+10 Gems</strong> và trả lời đúng mỗi câu hỏi dừng hình nhận <strong>+2 Gems</strong>!
                  </div>
                </div>
              </div>
              <div class="gem-badge" style="font-size:0.95rem;padding:6px 14px;">
                <span>💎 ${state.user.gem_balance || 0} Gems</span>
              </div>
            </div>
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
      container.querySelectorAll('[data-gdrive-nav]').forEach((btn) => {
        btn.addEventListener('click', () => navigate('gdrive'));
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

        ${renderGDriveQuotaCard(gdrive)}

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
    container.querySelectorAll('[data-gdrive-nav]').forEach((btn) => {
      btn.addEventListener('click', () => navigate('gdrive'));
    });
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="muted">Không thể tải dashboard: ${escapeHtml(err.message)}</p></div>`;
  }
}
