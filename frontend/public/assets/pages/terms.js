/**
 * EduGlass LMS — Terms of Service Page (/terms-of-service)
 */
export function renderTermsPage(container, navigate) {
  container.innerHTML = `
    <div class="page-enter" style="max-width:860px;margin:0 auto;padding:24px 16px;">
      <div class="card" style="padding:32px 28px;line-height:1.7;">
        <div class="flex-between" style="margin-bottom:20px;border-bottom:1px solid var(--border-subtle);padding-bottom:16px;">
          <div class="brand-lockup" style="padding:0;">
            <div class="brand-logo" aria-hidden="true">EG</div>
            <div>
              <div class="brand-title">EduGlass LMS</div>
              <div class="brand-sub">Điều khoản dịch vụ (Terms of Service)</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-terms-back">← Quay lại Trang chủ</button>
        </div>

        <h1 style="font-size:1.6rem;margin-top:0;color:var(--text);margin-bottom:8px;">
          ĐIỀU KHOẢN DỊCH VỤ (TERMS OF SERVICE) — EDUGLASS LMS
        </h1>
        <p class="muted" style="font-size:0.84rem;margin-top:0;margin-bottom:24px;">
          Cập nhật lần cuối: Ngày 22 tháng 11 năm 2026 • Áp dụng cho: <strong>https://eduglass-lms-workers.akumiyuukii.workers.dev</strong>
        </p>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">1. Giới thiệu và Chấp thuận Điều khoản</h2>
          <p>
            Chào mừng bạn đến với <strong>EduGlass LMS</strong> (gọi tắt là "Hệ thống" hoặc "Chúng tôi"). Bằng việc truy cập hoặc sử dụng trang web tại 
            <strong>https://eduglass-lms-workers.akumiyuukii.workers.dev</strong>, bạn đồng ý tuân thủ và chịu sự ràng buộc của các Điều khoản Dịch vụ này cùng Chính sách bảo mật của chúng tôi. Nếu bạn không đồng ý với bất kỳ phần nào của điều khoản, vui lòng ngừng sử dụng dịch vụ.
          </p>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">2. Mô tả Dịch vụ</h2>
          <p>
            EduGlass LMS là nền tảng quản lý học tập và giảng dạy video tương tác trực tuyến, cung cấp cho người dạy và người học các tiện ích:
          </p>
          <ul style="padding-left:22px;">
            <li>Biên tập video học tập với câu hỏi tương tác dừng hình thông minh trên timeline (Video Learning Studio).</li>
            <li>Cơ chế chống tua gian lận (Anti-Skip Engine) và tích lũy phần thưởng Gems.</li>
            <li>Hệ thống bài kiểm tra tự động chấm điểm, ngân hàng câu hỏi và báo cáo thống kê tiến độ học tập.</li>
            <li>Tích hợp lưu trữ học liệu từ Google Drive, YouTube và bộ lưu trữ đám mây tốc độ cao.</li>
          </ul>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">3. Tài khoản và Bảo mật</h2>
          <p>
            Khi đăng ký tài khoản hoặc đăng nhập thông qua Google OAuth, bạn cam kết cung cấp thông tin chính xác, trung thực. Bạn có trách nhiệm bảo mật thông tin đăng nhập cá nhân và chịu trách nhiệm cho mọi hoạt động diễn ra dưới tài khoản của mình.
          </p>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">4. Quyền Sở hữu Trí tuệ</h2>
          <p>
            Tất cả các tài liệu bài giảng, video clip, câu hỏi kiểm tra do giáo viên tải lên hoặc tạo ra đều thuộc quyền sở hữu của người tạo hoặc đơn vị giáo dục tương ứng. Giao diện người dùng, mã nguồn hệ sinh thái EduGlass LMS thuộc bản quyền của đội ngũ phát triển EduGlass.
          </p>
        </section>

        <section style="margin-bottom:24px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">5. Giới hạn Trách nhiệm</h2>
          <p>
            EduGlass LMS được vận hành trên hạ tầng đám mây phân tán toàn cầu của Cloudflare Workers nhằm bảo đảm tính liên tục và độ ổn định cao nhất. Tuy nhiên, chúng tôi không chịu trách nhiệm đối với sự cố gián đoạn phát sinh từ sự cố mạng viễn thông cục bộ hoặc lỗi từ dịch vụ của bên thứ ba nằm ngoài tầm kiểm soát.
          </p>
        </section>

        <section style="margin-bottom:12px;">
          <h2 style="font-size:1.15rem;color:var(--primary);margin-bottom:8px;">6. Thông tin Liên hệ</h2>
          <p style="margin-bottom:0;">
            Mọi thắc mắc hoặc yêu cầu hỗ trợ liên quan đến Điều khoản Dịch vụ, vui lòng liên hệ với chúng tôi qua email: 
            <a href="mailto:akumiyuukii@gmail.com" style="color:var(--primary);font-weight:600;">akumiyuukii@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  `;

  document.getElementById('btn-terms-back')?.addEventListener('click', () => {
    navigate('home');
  });
}
