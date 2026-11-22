/**
 * EduGlass LMS — Privacy Policy Page (/policy)
 * Fully compliant with Google OAuth & API Services User Data Policy.
 */
import { escapeHtml } from '../core/store.js';

export function renderPolicyPage(container, navigate) {
  container.innerHTML = `
    <div class="page-enter" style="max-width:860px;margin:0 auto;padding:24px 16px;">
      <div class="card" style="padding:32px 28px;line-height:1.7;">
        <div class="flex-between" style="margin-bottom:20px;border-bottom:1px solid var(--border-subtle);padding-bottom:16px;">
          <div class="brand-lockup" style="padding:0;">
            <div class="brand-logo" aria-hidden="true">EG</div>
            <div>
              <div class="brand-title">EduGlass LMS</div>
              <div class="brand-sub">Chính sách bảo mật (Privacy Policy)</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-policy-back">← Quay lại Trang chủ</button>
        </div>

        <h1 style="font-size:1.6rem;margin-top:0;color:var(--text);margin-bottom:8px;">
          CHÍNH SÁCH BẢO MẬT (PRIVACY POLICY) — EDUGLASS LMS
        </h1>
        <p class="muted" style="font-size:0.84rem;margin-top:0;margin-bottom:24px;">
          Cập nhật lần cuối: Ngày 22 tháng 11 năm 2026 • Áp dụng cho trang web: <strong>https://eduglass-lms-workers.akumiyuukii.workers.dev</strong>
        </p>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">1. Thông tin chúng tôi thu thập</h2>
          <p>
            Ứng dụng <strong>EduGlass LMS</strong> sử dụng dịch vụ Google OAuth để hỗ trợ đăng nhập nhanh chóng, an toàn và thuận tiện. Chúng tôi chỉ yêu cầu và thu thập các thông tin cơ bản được cung cấp bởi Google khi bạn đồng ý ủy quyền, bao gồm:
          </p>
          <ul style="padding-left:22px;">
            <li><strong>Địa chỉ Email:</strong> Dùng để định danh tài khoản, liên lạc và nhận thông báo học tập.</li>
            <li><strong>Tên hiển thị (Họ và Tên):</strong> Dùng để hiển thị trong lớp học trực tuyến, bài kiểm tra và bảng xếp hạng.</li>
            <li><strong>Ảnh đại diện (Avatar URL):</strong> Hiển thị hồ sơ cá nhân trong hệ thống.</li>
            <li><strong>Quyền truy cập Google Drive chỉ đọc (Google Drive readonly):</strong> Chỉ sử dụng khi người dùng chủ động duyệt và chọn file video học tập từ Google Drive để gắn vào bài giảng. Chúng tôi không sửa đổi, không xóa và không tải nội dung ngoài phạm vi cho phép.</li>
          </ul>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">2. Cách chúng tôi sử dụng thông tin</h2>
          <p>Chúng tôi sử dụng các thông tin thu thập được hoàn toàn cho mục đích vận hành nền tảng học tập:</p>
          <ul style="padding-left:22px;">
            <li>Tạo và quản lý tài khoản người dùng trên hệ thống học tập EduGlass LMS.</li>
            <li>Hiển thị tên và ảnh đại diện của bạn trong lớp học trực tuyến và kết quả học tập.</li>
            <li>Gửi các thông báo liên quan đến khóa học, bài kiểm tra và hạn nộp bài tập (nếu có).</li>
            <li>Cho phép giáo viên lựa chọn học liệu video từ Google Drive để xây dựng bài giảng tương tác.</li>
          </ul>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">3. Chia sẻ thông tin với bên thứ ba</h2>
          <p>
            Chúng tôi cam kết <strong>bảo mật tuyệt đối</strong> thông tin cá nhân của bạn. EduGlass LMS <strong>không bán, không trao đổi, không cho thuê và không chia sẻ</strong> thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào vì mục đích thương mại hoặc quảng cáo.
          </p>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">4. Tuân thủ Chính sách Dữ liệu Người dùng của Google</h2>
          <p>
            Việc sử dụng và chuyển giao thông tin nhận được từ các API của Google cho bất kỳ ứng dụng nào khác của EduGlass LMS đều tuân thủ nghiêm ngặt theo 
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline;">
              Chính sách Dữ liệu Người dùng của Dịch vụ Google API (Google API Services User Data Policy)
            </a>, bao gồm các yêu cầu về Sử dụng Có giới hạn (Limited Use requirements).
          </p>
          <p>
            Chúng tôi cam kết <strong>không sử dụng dữ liệu người dùng Google để phát triển, tạo hoặc huấn luyện các mô hình AI/ML</strong> tổng quát hay bán cho các đơn vị trung gian.
          </p>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">5. Yêu cầu xóa dữ liệu (Data Deletion)</h2>
          <p>
            Nếu bạn không muốn tiếp tục sử dụng dịch vụ và muốn xóa toàn bộ dữ liệu cá nhân khỏi hệ thống của chúng tôi, vui lòng gửi yêu cầu đến email hỗ trợ chính thức của chúng tôi tại:
          </p>
          <div class="card" style="background:var(--surface-subtle);padding:14px;border-left:4px solid var(--accent);margin:12px 0;">
            <p style="margin:0;font-weight:600;">
              📧 Email hỗ trợ & tiếp nhận yêu cầu xóa dữ liệu: 
              <a href="mailto:akumiyuukii@gmail.com" style="color:var(--primary);">akumiyuukii@gmail.com</a>
            </p>
            <p class="muted" style="margin:4px 0 0;font-size:0.82rem;">
              Sau khi nhận được yêu cầu, chúng tôi sẽ xử lý và xóa vĩnh viễn toàn bộ dữ liệu liên quan đến tài khoản của bạn khỏi cơ sở dữ liệu trong vòng 24 đến 48 giờ làm việc.
            </p>
          </div>
        </section>

        <section style="margin-bottom:12px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">6. Liên hệ chúng tôi</h2>
          <p style="margin-bottom:0;">
            Nếu bạn có bất kỳ thắc mắc hoặc phản hồi nào về Chính sách bảo mật này, xin vui lòng liên hệ Ban quản trị EduGlass LMS qua email: 
            <a href="mailto:akumiyuukii@gmail.com" style="color:var(--primary);font-weight:600;">akumiyuukii@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  `;

  document.getElementById('btn-policy-back')?.addEventListener('click', () => {
    navigate('home');
  });
}
