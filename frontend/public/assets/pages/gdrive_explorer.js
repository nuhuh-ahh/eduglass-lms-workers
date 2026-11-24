/**
 * EduGlass LMS — Google Drive Explorer
 * Connects directly to real Google Drive via Google Drive API v3.
 * Dynamic storage quota (15 GB Free, 100 GB, 2 TB, 5 TB, or Workspace Unlimited).
 * ZERO mock data — loads live folders and files from the user's authentic account.
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, openModal, showToast } from '../core/store.js';
import {
  disconnectGDrive,
  fetchLiveFiles,
  fetchLiveQuota,
  formatBytes,
  getGDriveState,
  loadGsiScript,
  saveGDriveSession,
  setGDriveClientId,
} from '../core/gdrive.js';

export async function renderGDriveExplorerPage(container, navigate, initialFolderId = 'root') {
  let currentFolderId = initialFolderId || 'root';
  let folderBreadcrumbs = [{ id: 'root', name: 'Google Drive (My Drive)' }];
  let searchQuery = '';
  let activeFilter = 'all'; // 'all' | 'video' | 'folder'
  let liveItems = [];
  let isLoading = false;
  let loadError = null;

  async function loadCurrentFolder() {
    const gdrive = getGDriveState();
    if (!gdrive.isConnected || !gdrive.token) {
      liveItems = [];
      isLoading = false;
      loadError = null;
      draw();
      return;
    }

    isLoading = true;
    loadError = null;
    draw();

    try {
      liveItems = await fetchLiveFiles(gdrive.token, currentFolderId);
    } catch (err) {
      loadError = err.message;
      liveItems = [];
    } finally {
      isLoading = false;
      draw();
    }
  }

  function openSetupGuideModal() {
    const currentGdrive = getGDriveState();
    openModal('Liên kết tài khoản Google Drive (Tất cả gói: 15 GB, 100 GB, 2 TB, 5 TB)', `
      <div style="display:flex;flex-direction:column;gap:16px;max-height:75vh;overflow-y:auto;padding-right:4px;">
        <div class="card" style="background:rgba(245, 158, 11, 0.1);border:1px solid rgba(245, 158, 11, 0.4);padding:14px;">
          <div style="font-weight:700;font-size:0.92rem;color:#F59E0B;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
            <span>⚠️</span> CẢNH BÁO: CHỈ DÀNH CHO DEVELOPER & NGƯỜI AM HIỂU CÔNG NGHỆ
          </div>
          <p style="margin:0 0 8px;font-size:0.82rem;line-height:1.5;">
            Các bước dưới đây yêu cầu thao tác kỹ thuật tại Google Cloud Console (dành cho lập trình viên/admin muốn kết nối duyệt toàn bộ thư mục).
          </p>
          <div style="background:rgba(0,0,0,0.2);padding:10px 14px;border-radius:8px;font-size:0.8rem;line-height:1.5;">
            <strong style="color:var(--success);">💡 Cách đơn giản nhất cho Giáo viên & Người dùng:</strong><br/>
            Bạn <strong>chỉ cần tải video lên Google Drive</strong> cá nhân → Chuột phải chọn <em>"Chia sẻ" (Ai có liên kết đều xem được)</em> → <em>Sao chép liên kết</em> → Sang <strong>Video Studio</strong> dán link vào là bài giảng tự động phát mượt mà! <strong>Hoàn toàn không cần làm các bước cài đặt API phức tạp!</strong>
          </div>
        </div>

        <div class="card" style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.25);padding:14px;">
          <div style="font-weight:700;font-size:0.92rem;color:var(--primary);margin-bottom:4px;">
            🎉 Tiết kiệm 100% cước băng thông — Phát trực tiếp từ CDN Google
          </div>
          <p class="muted" style="margin:0;font-size:0.8rem;line-height:1.5;">
            Hệ thống hỗ trợ mọi gói tài khoản Google Drive: từ tài khoản <strong>miễn phí 15 GB</strong> đến các gói Google One (100 GB, 2 TB, 5 TB) hoặc Workspace. Video được stream trực tiếp từ máy chủ Google đến trình duyệt người học mà không tiêu tốn tài nguyên Cloudflare.
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;font-size:0.84rem;line-height:1.6;">
          <div class="card" style="padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
              <span class="pill pill-primary" style="padding:2px 8px;">Bước 1</span>
              <span>Tạo Google Cloud Project (0đ, không cần thẻ)</span>
            </div>
            <p class="muted" style="margin:0;">
              Truy cập <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;text-decoration:underline;">Google Cloud Console</a>, đăng nhập tài khoản Google của bạn và tạo 1 Project mới (ví dụ: <code>EduGlass-LMS</code>).
            </p>
          </div>

          <div class="card" style="padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
              <span class="pill pill-primary" style="padding:2px 8px;">Bước 2</span>
              <span>Bật Google Drive API</span>
            </div>
            <p class="muted" style="margin:0;">
              Vào menu <strong>APIs & Services</strong> > <strong>Library</strong> > Tìm kiếm <code>Google Drive API</code> và bấm <strong>Enable (Bật)</strong>.
            </p>
          </div>

          <div class="card" style="padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
              <span class="pill pill-primary" style="padding:2px 8px;">Bước 3</span>
              <span>Tạo OAuth Client ID</span>
            </div>
            <p class="muted" style="margin:0 0 6px;">
              Vào <strong>Credentials</strong> > <strong>Create Credentials</strong> > <strong>OAuth client ID</strong>:
            </p>
            <ul style="margin:0;padding-left:20px;color:var(--text-muted);font-size:0.8rem;">
              <li>Application type: <strong>Web application</strong>.</li>
              <li>
                <strong>Authorized JavaScript origins:</strong> Nhập chính xác:<br/>
                <code style="display:inline-block;margin:4px 0;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;">https://eduglass-lms-workers.akumiyuukii.workers.dev</code>
              </li>
            </ul>
          </div>

          <div class="card" style="padding:14px;border:1px solid rgba(48,209,88,0.3);background:rgba(48,209,88,0.05);">
            <div style="font-weight:700;margin-bottom:8px;color:var(--success);">
              Bước 4: Kết nối tài khoản Google Drive
            </div>
            <div class="field" style="margin-bottom:10px;">
              <label>Google OAuth Client ID:</label>
              <input class="input" id="setup-gdrive-client-id" placeholder="vd: 123456789-abcdef.apps.googleusercontent.com" value="${escapeHtml(currentGdrive.clientId)}" />
            </div>
            <div class="flex-row" style="gap:8px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" id="btn-login-google-popup">
                🚀 Đăng nhập bằng Google (Popup Ủy quyền)
              </button>
              ${currentGdrive.isConnected ? `
                <button class="btn btn-secondary btn-sm" id="btn-disconnect-gdrive" style="color:var(--danger);">
                  Ngắt kết nối
                </button>
              ` : ''}
            </div>

            <div style="margin-top:14px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.15);">
              <label style="font-size:0.78rem;font-weight:600;" class="muted">Hoặc dán Access Token trực tiếp (dành cho thử nghiệm nhanh):</label>
              <div style="display:flex;gap:8px;margin-top:4px;">
                <input class="input" id="setup-manual-token" placeholder="ya29.a0Ac..." style="font-size:0.8rem;" />
                <button class="btn btn-secondary btn-sm" id="btn-save-manual-token">Lưu Token</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `, (slot, close) => {
      slot.querySelector('#btn-disconnect-gdrive')?.addEventListener('click', () => {
        disconnectGDrive();
        showToast('Đã ngắt kết nối Google Drive!', 'info');
        close();
        draw();
      });

      slot.querySelector('#btn-save-manual-token')?.addEventListener('click', async () => {
        const token = slot.querySelector('#setup-manual-token').value.trim();
        if (!token) {
          showToast('Vui lòng nhập Access Token!', 'warning');
          return;
        }
        try {
          showToast('Đang kiểm tra quyền truy cập và dung lượng Google Drive...', 'info');
          await fetchLiveQuota(token);
          showToast('Liên kết tài khoản Google Drive thành công!', 'success');
          close();
          loadCurrentFolder();
        } catch (err) {
          showToast(`Lỗi: ${err.message}`, 'error');
        }
      });

      slot.querySelector('#btn-login-google-popup')?.addEventListener('click', async () => {
        const cId = slot.querySelector('#setup-gdrive-client-id').value.trim();
        if (!cId) {
          showToast('Vui lòng nhập Google Client ID ở ô trên trước!', 'warning');
          return;
        }
        setGDriveClientId(cId);

        try {
          showToast('Đang tải thư viện Google Identity Services...', 'info');
          await loadGsiScript();

          if (!window.google?.accounts?.oauth2) {
            showToast('Không thể khởi tạo Google OAuth SDK.', 'error');
            return;
          }

          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: cId,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            callback: async (resp) => {
              if (resp.error) {
                showToast(`Lỗi đăng nhập Google: ${resp.error}`, 'error');
                return;
              }
              if (resp.access_token) {
                try {
                  showToast('Đang đồng bộ dung lượng và thông tin tài khoản...', 'info');
                  await fetchLiveQuota(resp.access_token);
                  showToast('Đã kết nối tài khoản Google Drive thành công!', 'success');
                  close();
                  loadCurrentFolder();
                } catch (err) {
                  showToast(`Lỗi đồng bộ: ${err.message}`, 'error');
                }
              }
            },
          });

          tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (err) {
          showToast(`Không thể mở cửa sổ Google: ${err.message}`, 'error');
        }
      });
    });
  }

  function openPreviewModal(videoTitle, videoUrl) {
    let embedSrc = videoUrl;
    const match = (videoUrl || '').match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      embedSrc = `https://drive.google.com/file/d/${match[1]}/preview`;
    }

    openModal(`▶ Xem thử: ${escapeHtml(videoTitle)}`, `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="position:relative;padding-top:56.25%;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
          ${embedSrc.includes('preview') ? `
            <iframe src="${escapeHtml(embedSrc)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allow="autoplay" allowfullscreen></iframe>
          ` : `
            <video src="${escapeHtml(embedSrc)}" controls autoplay style="position:absolute;top:0;left:0;width:100%;height:100%;"></video>
          `}
        </div>
        <div class="flex-between">
          <span class="muted" style="font-size:0.8rem;">Phát trực tiếp từ Google Drive CDN</span>
          <button class="btn btn-secondary btn-sm" id="btn-copy-preview-link">📋 Sao chép link</button>
        </div>
      </div>
    `, (slot) => {
      slot.querySelector('#btn-copy-preview-link')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(videoUrl);
        showToast('Đã sao chép link video vào clipboard!', 'success');
      });
    });
  }

  async function attachVideoToLesson(videoItem) {
    try {
      showToast('Đang thêm video vào thư viện bài giảng...', 'info');
      const shareUrl = videoItem.webViewLink || `https://drive.google.com/file/d/${videoItem.id}/view?usp=sharing`;
      await apiRequest('/api/v1/videos/link', {
        method: 'POST',
        body: {
          title: videoItem.name.replace(/\.[^.]+$/, ''),
          url: shareUrl,
          duration_seconds: 600,
        },
      });

      showToast(`Đã thêm video "${videoItem.name}" vào thư viện! Đang chuyển sang Video Studio...`, 'success');
      setTimeout(() => {
        navigate('studio');
      }, 700);
    } catch (err) {
      showToast(`Lỗi gắn video: ${err.message}`, 'error');
    }
  }

  function draw() {
    const gdrive = getGDriveState();

    const filteredItems = (liveItems || []).filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q)) return false;
      }
      if (activeFilter === 'video') return item.mimeType?.startsWith('video/');
      if (activeFilter === 'folder') return item.mimeType === 'application/vnd.google-apps.folder';
      return true;
    });

    const folders = filteredItems.filter((i) => i.mimeType === 'application/vnd.google-apps.folder');
    const files = filteredItems.filter((i) => i.mimeType !== 'application/vnd.google-apps.folder');

    container.innerHTML = `
      <div class="page-enter" style="display:flex;flex-direction:column;gap:20px;">
        <!-- Developer & Technical Warning Banner -->
        <div class="card" style="border:1px solid rgba(245, 158, 11, 0.4);background:rgba(245, 158, 11, 0.08);padding:14px 18px;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="font-size:1.6rem;line-height:1;">⚠️</div>
            <div style="flex:1;">
              <div style="font-weight:700;color:#F59E0B;font-size:0.92rem;margin-bottom:4px;">
                TÙY CHỌN NÂNG CAO — CHỈ DÀNH CHO DEVELOPER & QUẢN TRỊ VIÊN
              </div>
              <p style="margin:0 0 8px;font-size:0.82rem;line-height:1.5;color:var(--text);">
                Tính năng này kết nối trực tiếp Google Drive API v3 để duyệt thư mục và tệp. <strong>Học sinh và Giáo viên thông thường KHÔNG CẦN phải thực hiện các bước này!</strong>
              </p>
              <div style="background:rgba(0,0,0,0.15);padding:10px 14px;border-radius:8px;font-size:0.8rem;line-height:1.5;">
                <strong style="color:var(--success);">💡 Cách dùng chuẩn & nhanh nhất:</strong><br/>
                Bạn <strong>chỉ cần tải video lên Google Drive → bật chia sẻ link → copy dán vào bài giảng</strong> ở Video Studio là xong ngay! Video sẽ phát trực tiếp qua CDN Google tốc độ cao mà không cần bất kỳ cài đặt nào.
              </div>
            </div>
          </div>
        </div>

        <!-- Header & Storage Quota Card -->
        <div class="card" style="border:1px solid rgba(10,132,255,0.28);background:linear-gradient(135deg, rgba(10,132,255,0.08), rgba(48,209,88,0.05));">
          <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <div style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.08);font-size:26px;">
                📁
              </div>
              <div>
                <div style="font-weight:700;font-size:1.15rem;display:flex;align-items:center;gap:8px;">
                  Kho Lưu Trữ Google Drive
                  <span class="pill ${gdrive.isConnected ? 'pill-success' : 'pill-warning'}" style="font-size:0.75rem;">
                    ${gdrive.isConnected ? '● Đã kết nối' : '● Chưa kết nối'}
                  </span>
                </div>
                <div class="muted" style="font-size:0.84rem;margin-top:2px;">
                  ${gdrive.user?.email ? `${escapeHtml(gdrive.user.email)} • ` : ''}
                  ${gdrive.quota ? `Đã dùng ${gdrive.quota.usedStr} / ${gdrive.quota.totalStr}` : 'Hỗ trợ gói Miễn phí 15 GB, Google One và Workspace'}
                </div>
              </div>
            </div>

            <div class="flex-row" style="flex-wrap:wrap;gap:8px;">
              <button class="btn btn-secondary btn-sm" id="btn-open-guide">
                ${gdrive.isConnected ? '⚙ Cài đặt kết nối' : '🔗 Liên kết Google Drive'}
              </button>
              <a href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration:none;">
                ↑ Mở Google Drive
              </a>
              ${gdrive.isConnected ? `
                <button class="btn btn-primary btn-sm" id="btn-refresh-drive">🔄 Làm mới</button>
              ` : ''}
            </div>
          </div>

          ${gdrive.quota ? `
            <div style="margin-top:16px;">
              <div class="flex-between" style="font-size:0.86rem;margin-bottom:6px;">
                <span><strong>Tổng dung lượng đã dùng:</strong> ${gdrive.quota.usedStr} / ${gdrive.quota.totalStr} ${gdrive.quota.isUnlimited ? '' : `(${gdrive.quota.pctStr || `${gdrive.quota.pct}%`})`}</span>
                <span class="muted">Còn trống: ${gdrive.quota.freeStr}</span>
              </div>
              ${!gdrive.quota.isUnlimited ? `
                <div class="progress-track" style="height:10px;background:rgba(255,255,255,0.35);border-radius:999px;overflow:hidden;">
                  <div class="progress-fill" style="width:${gdrive.quota.pct}%;height:100%;background:linear-gradient(90deg, #0A84FF, #30D158);border-radius:999px;transition:width 0.6s cubic-bezier(0.16,1,0.3,1);"></div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        ${!gdrive.isConnected ? `
          <!-- Unconnected Empty State -->
          <div class="card" style="padding:48px 24px;text-align:center;background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);border-radius:16px;">
            <div style="font-size:3.2rem;margin-bottom:12px;">📁</div>
            <h3 style="margin:0 0 8px;">Chưa liên kết tài khoản Google Drive</h3>
            <p class="muted" style="margin:0 auto 20px;max-width:540px;font-size:0.86rem;line-height:1.6;">
              Kết nối tài khoản Google Drive của bạn (dù là tài khoản miễn phí 15 GB hay các gói Google One / Workspace) để duyệt tệp, gắn video trực tiếp vào bài giảng mà không tốn dung lượng máy chủ.
            </p>
            <div class="flex-row" style="justify-content:center;gap:12px;">
              <button class="btn btn-primary" id="btn-empty-connect">🔗 Liên kết tài khoản Google Drive</button>
            </div>
          </div>
        ` : `
          <!-- Connected Explorer View -->
          <div class="card" style="padding:14px 18px;">
            <div class="flex-between" style="flex-wrap:wrap;gap:12px;margin-bottom:12px;">
              <!-- Breadcrumbs -->
              <div style="display:flex;align-items:center;gap:6px;font-size:0.88rem;flex-wrap:wrap;">
                ${folderBreadcrumbs.map((b, idx) => `
                  <button class="btn btn-secondary btn-sm" data-nav-breadcrumb="${b.id}" style="border:none;background:${idx === folderBreadcrumbs.length - 1 ? 'rgba(255,255,255,0.1)' : 'transparent'};font-weight:${idx === folderBreadcrumbs.length - 1 ? '700' : '400'};">
                    ${escapeHtml(b.name)}
                  </button>
                  ${idx < folderBreadcrumbs.length - 1 ? '<span class="muted">/</span>' : ''}
                `).join('')}
              </div>

              <!-- Search & Filters -->
              <div class="flex-row" style="gap:8px;">
                <input class="input" id="gdrive-search-input" placeholder="🔍 Tìm kiếm file / thư mục..." value="${escapeHtml(searchQuery)}" style="width:220px;padding:6px 12px;font-size:0.82rem;" />
                <select class="select" id="gdrive-filter-select" style="width:auto;padding:6px 10px;font-size:0.82rem;">
                  <option value="all" ${activeFilter === 'all' ? 'selected' : ''}>Tất cả</option>
                  <option value="video" ${activeFilter === 'video' ? 'selected' : ''}>Chỉ video</option>
                  <option value="folder" ${activeFilter === 'folder' ? 'selected' : ''}>Chỉ thư mục</option>
                </select>
              </div>
            </div>

            ${isLoading ? `
              <div style="text-align:center;padding:40px 16px;">
                <div class="skeleton" style="height:32px;width:50%;margin:0 auto 12px;"></div>
                <div class="skeleton" style="height:80px;width:100%;margin-bottom:12px;"></div>
                <div class="skeleton" style="height:80px;width:100%;"></div>
                <p class="muted" style="margin-top:12px;font-size:0.82rem;">Đang tải danh sách tệp thực tế từ Google Drive API...</p>
              </div>
            ` : loadError ? `
              <div class="card" style="padding:24px;text-align:center;border-left:4px solid var(--danger);">
                <div style="font-weight:700;color:var(--danger);margin-bottom:6px;">⚠️ Không thể tải tệp từ Google Drive</div>
                <p class="muted" style="margin:0 0 14px;font-size:0.84rem;">${escapeHtml(loadError)}</p>
                <button class="btn btn-secondary btn-sm" id="btn-reauth">Kết nối lại tài khoản</button>
              </div>
            ` : `
              <!-- Folders Grid -->
              ${folders.length > 0 ? `
                <div style="margin-bottom:18px;">
                  <div class="kpi-label" style="margin-bottom:10px;">Thư mục (${folders.length})</div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:12px;">
                    ${folders.map((f) => `
                      <div class="card" data-open-folder="${f.id}" data-folder-name="${escapeHtml(f.name)}" style="padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.2s cubic-bezier(0.16,1,0.3,1);background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);">
                        <div style="font-size:1.8rem;">📁</div>
                        <div style="overflow:hidden;flex:1;">
                          <div style="font-weight:600;font-size:0.88rem;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${escapeHtml(f.name)}</div>
                          <div class="muted" style="font-size:0.75rem;">Thư mục Google Drive</div>
                        </div>
                        <span style="opacity:0.4;font-size:0.9rem;">›</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Files & Videos List -->
              <div>
                <div class="kpi-label" style="margin-bottom:10px;">Tệp Tải Lên (${files.length})</div>
                ${files.length > 0 ? `
                  <div style="display:flex;flex-direction:column;gap:10px;">
                    ${files.map((v) => {
                      const isVid = v.mimeType?.startsWith('video/');
                      const shareLink = v.webViewLink || `https://drive.google.com/file/d/${v.id}/view?usp=sharing`;
                      return `
                        <div class="card" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);">
                          <div style="display:flex;align-items:center;gap:14px;min-width:240px;flex:1;">
                            <div style="width:42px;height:42px;border-radius:10px;background:${isVid ? 'rgba(10,132,255,0.12)' : 'rgba(255,255,255,0.05)'};color:${isVid ? 'var(--primary)' : 'inherit'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
                              ${isVid ? '🎬' : '📄'}
                            </div>
                            <div style="overflow:hidden;">
                              <div style="font-weight:600;font-size:0.9rem;word-break:break-all;">${escapeHtml(v.name)}</div>
                              <div class="muted" style="font-size:0.76rem;margin-top:2px;">
                                ${v.size ? formatBytes(Number(v.size)) : 'Tệp Google'} • ${escapeHtml(v.mimeType || '')}
                              </div>
                            </div>
                          </div>

                          <div class="flex-row" style="gap:8px;flex-wrap:wrap;">
                            ${isVid ? `
                              <button class="btn btn-secondary btn-sm" data-preview-vid="${v.id}" data-vid-title="${escapeHtml(v.name)}" data-vid-url="${escapeHtml(shareLink)}">
                                ▶ Xem thử
                              </button>
                              <button class="btn btn-primary btn-sm" data-attach-vid="${v.id}">
                                ➕ Gắn vào bài giảng
                              </button>
                            ` : ''}
                            <button class="btn btn-secondary btn-sm" data-copy-link="${escapeHtml(shareLink)}" title="Sao chép link">
                              📋 Sao chép link
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div style="text-align:center;padding:32px 16px;border:1px dashed var(--border-subtle);border-radius:12px;">
                    <div style="font-size:2rem;margin-bottom:6px;">📭</div>
                    <div style="font-weight:600;">Không có tệp nào trong thư mục này</div>
                    <p class="muted" style="margin:4px 0 0;font-size:0.8rem;">
                      Bạn có thể nhấn nút "Mở Google Drive" ở trên để tải tệp hoặc video mới vào tài khoản của bạn.
                    </p>
                  </div>
                `}
              </div>
            `}
          </div>
        `}
      </div>
    `;

    // Event Listeners
    document.getElementById('btn-open-guide')?.addEventListener('click', openSetupGuideModal);
    document.getElementById('btn-empty-connect')?.addEventListener('click', openSetupGuideModal);
    document.getElementById('btn-reauth')?.addEventListener('click', openSetupGuideModal);

    document.getElementById('btn-refresh-drive')?.addEventListener('click', async () => {
      showToast('Đang làm mới dữ liệu từ Google Drive...', 'info');
      if (gdrive.token) {
        try {
          await fetchLiveQuota(gdrive.token);
        } catch { /* ignore */ }
      }
      loadCurrentFolder();
    });

    // Breadcrumbs Navigation
    container.querySelectorAll('[data-nav-breadcrumb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.navBreadcrumb;
        const idx = folderBreadcrumbs.findIndex((b) => b.id === targetId);
        if (idx !== -1) {
          folderBreadcrumbs = folderBreadcrumbs.slice(0, idx + 1);
          currentFolderId = targetId;
          loadCurrentFolder();
        }
      });
    });

    // Open Folder
    container.querySelectorAll('[data-open-folder]').forEach((card) => {
      card.addEventListener('click', () => {
        const fId = card.dataset.openFolder;
        const fName = card.dataset.folderName;
        folderBreadcrumbs.push({ id: fId, name: fName });
        currentFolderId = fId;
        loadCurrentFolder();
      });
    });

    // Search and Filter
    const searchInput = document.getElementById('gdrive-search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      draw();
      const updatedInput = document.getElementById('gdrive-search-input');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(updatedInput.value.length, updatedInput.value.length);
      }
    });

    const filterSelect = document.getElementById('gdrive-filter-select');
    filterSelect?.addEventListener('change', (e) => {
      activeFilter = e.target.value;
      draw();
    });

    // Video Actions
    container.querySelectorAll('[data-preview-vid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openPreviewModal(btn.dataset.vidTitle, btn.dataset.vidUrl);
      });
    });

    container.querySelectorAll('[data-copy-link]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(btn.dataset.copyLink);
        showToast('Đã sao chép liên kết video!', 'success');
      });
    });

    container.querySelectorAll('[data-attach-vid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vidId = btn.dataset.attachVid;
        const item = files.find((f) => f.id === vidId);
        if (item) attachVideoToLesson(item);
      });
    });
  }

  // Initial load
  loadCurrentFolder();
}
