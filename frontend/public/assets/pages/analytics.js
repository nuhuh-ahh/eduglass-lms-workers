/**
 * EduGlass LMS — Analytics & Real Report Export (CSV, Excel XLSX, PDF)
 */
import { apiRequest, downloadAuthenticatedFile } from '../core/api.js';
import { escapeHtml, showToast } from '../core/store.js';

export async function renderAnalyticsPage(container) {
  let selectedClass = '';

  async function draw() {
    const [clsRes, anRes] = await Promise.all([
      apiRequest('/api/v1/classrooms'),
      apiRequest(`/api/v1/analytics/students${selectedClass ? `?classroom_id=${encodeURIComponent(selectedClass)}` : ''}`),
    ]);
    const classrooms = clsRes.items || [];
    const sum = anRes.class_summary;
    const students = anRes.students || [];

    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:18px;">
        <div class="flex-between">
          <div>
            <h2 style="margin:0;">Thống kê & Xuất báo cáo học tập</h2>
            <p class="muted" style="margin:4px 0 0;">Công thức chuẩn: <code>Accuracy = Correct Answers / Total Answered Questions × 100%</code> (không tính câu chưa trả lời vào mẫu số).</p>
          </div>
          <div class="flex-row">
            <select class="select" id="an-cls-filter" style="width:220px;">
              <option value="">Tất cả lớp học</option>
              ${classrooms.map((c) => `<option value="${c.id}" ${c.id === selectedClass ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-sm" data-export="csv">Xuất CSV</button>
            <button class="btn btn-secondary btn-sm" data-export="xlsx">Xuất Excel (.xlsx)</button>
            <button class="btn btn-primary btn-sm" data-export="pdf">Xuất PDF</button>
          </div>
        </div>

        <div class="grid-kpi">
          <div class="card"><div class="kpi-label">Tổng học sinh</div><div class="kpi-value">${sum.total_students}</div></div>
          <div class="card"><div class="kpi-label">Đã tham gia học</div><div class="kpi-value">${sum.participated_students}</div></div>
          <div class="card"><div class="kpi-label">Chưa tham gia</div><div class="kpi-value">${sum.not_participated_students}</div></div>
          <div class="card"><div class="kpi-label">Tỷ lệ hoàn thành</div><div class="kpi-value">${sum.completion_rate_pct}%</div></div>
          <div class="card"><div class="kpi-label">Độ chính xác TB</div><div class="kpi-value">${sum.average_accuracy_pct}%</div></div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Chi tiết theo từng học sinh</h3>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Lớp</th>
                  <th>Lượt học</th>
                  <th>Thời gian (phút)</th>
                  <th>Hoàn thành</th>
                  <th>Chưa xong</th>
                  <th>Đúng / Sai</th>
                  <th>Độ chính xác</th>
                  <th>Cảnh báo tua</th>
                </tr>
              </thead>
              <tbody>
                ${students.map((s) => `
                  <tr>
                    <td><strong>${escapeHtml(s.full_name)}</strong><div class="muted">${escapeHtml(s.email)}</div></td>
                    <td>${escapeHtml(s.classroom_name)}</td>
                    <td>${s.sessions_count}</td>
                    <td>${s.study_minutes}</td>
                    <td><span class="pill pill-success">${s.completed_lessons}</span></td>
                    <td><span class="pill pill-warning">${s.incomplete_lessons}</span></td>
                    <td>${s.correct_answers} / ${s.wrong_answers}</td>
                    <td><strong>${s.accuracy_pct}%</strong></td>
                    <td>${s.seek_anomalies > 0 ? `<span class="pill pill-danger">${s.seek_anomalies}</span>` : '0'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="9" class="muted">Chưa có dữ liệu học sinh.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('an-cls-filter')?.addEventListener('change', (e) => {
      selectedClass = e.target.value;
      draw();
    });

    container.querySelectorAll('[data-export]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const fmt = btn.dataset.export;
        const qs = new URLSearchParams({ fmt });
        if (selectedClass) qs.set('classroom_id', selectedClass);
        try {
          await downloadAuthenticatedFile(`/api/v1/reports/export?${qs.toString()}`, `eduglass-report.${fmt}`);
          showToast(`Đã tải xuống báo cáo ${fmt.toUpperCase()} từ dữ liệu thực.`, 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  draw();
}
