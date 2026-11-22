# EduGlass LMS — Cloudflare Workers 24/7 Clean Production Edition

Phiên bản **EduGlass LMS** chạy **24/7 trên Cloudflare Workers + D1 + R2** hoàn toàn sạch (không nhúng sẵn tài khoản mẫu, không dữ liệu giả, không khóa bí mật cứng):
- **Liquid Glass Mode (iOS 27 mặc định)**: Hiệu ứng kính đa lớp, phản chiếu ánh sáng specular theo vị trí chuột, animation 60 FPS mượt mà (stagger cards, spring modals, bounce toasts), tương phản chuẩn trên cả 4 wallpaper kể cả chế độ kính đêm.
- **Classic Education Mode**: Giao diện LMS học thuật phẳng, sắc nét, không lẫn hiệu ứng kính khi chuyển đổi.
- **Dữ liệu sạch hoàn toàn**: Chỉ khởi tạo 4 vai trò hệ thống (`roles`) và 12 module (`module_registry`). **Tài khoản đầu tiên đăng ký trên web sẽ tự động trở thành Super Admin.**

## Triển khai 24/7 lên Cloudflare Workers (Windows PowerShell)

```powershell
# 1. Cài Wrangler CLI
npm install

# 2. Đăng nhập Cloudflare
npx wrangler login

# 3. Tạo D1 database & R2 bucket (chỉ làm 1 lần)
npx wrangler d1 create eduglass-lms-db
npx wrangler r2 bucket create eduglass-lms-videos
```
> Dán `database_id` vừa tạo vào tệp `wrangler.toml`.

```powershell
# 4. Thiết lập khóa bí mật JWT của riêng bạn
npx wrangler secret put EDUGLASS_SECRET_KEY

# 5. Chạy migration & khởi tạo roles + 12 modules sạch trên D1
npm run db:migrate:remote
npm run db:seed:remote

# 6. Deploy chạy 24/7!
npm run deploy
```

Sau khi deploy, mở link `*.workers.dev`, nhấn tab **Đăng ký** để tạo tài khoản **Super Admin** đầu tiên của riêng bạn!
