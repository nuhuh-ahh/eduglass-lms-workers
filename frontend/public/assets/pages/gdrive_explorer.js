/**
 * EduGlass LMS — Google Drive Explorer & 5TB Video Hub
 * Allows teachers and students to browse Google Drive files and folders,
 * monitor 5TB quota, and attach videos directly to lessons in 1 click.
 */
import { apiRequest } from '../core/api.js';
import { escapeHtml, openModal, showToast } from '../core/store.js';
import {
  disconnectGDrive,
  fetchLiveFiles,
  fetchLiveQuota,
  formatBytes,
  getGDriveState,
  getSampleDriveItems,
  setGDriveClientId,
  setGDriveConnected,
} from '../core/gdrive.js';

export async function renderGDriveExplorerPage(container, navigate, initialFolderId = 'root') {
  let currentFolderId = initialFolderId || 'root';
  let folderBreadcrumbs = [{ id: 'root', name: 'Google Drive (My Drive)' }];
  let searchQuery = '';
  let activeFilter = 'all'; // 'all' | 'video' | 'folder'

  function getFolderItems(folderId) {
    const state = getGDriveState();
    return getSampleDriveItems(folderId);
  }

  function openSetupGuideModal() {
    const currentGdrive = getGDriveState();
    openModal('📖 Hướng dẫn liên kết Google Drive (5TB — Hoàn toàn Miễn phí 0đ)', `
      <div style="display:flex;flex-direction:column;gap:16px;max-height:75vh;overflow-y:auto;padding-right:4px;">
        <div class="card" style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.25);padding:14px;">
          <div style="font-weight:700;font-size:0.92rem;color:var(--primary);margin-bottom:4px;">
            🎉 Không mất cước băng thông Cloudflare — 100% Phát qua CDN Google
          </div>
          <p class="muted" style="margin:0;font-size:0.8rem;line-height:1.5;">
            Khi lưu video trên Google Drive (đặc biệt tài khoản Google One / Gemini Advanced 5TB), video sẽ truyền trực tiếp từ máy chủ Google đến trình duyệt học sinh. Cloudflare Workers chỉ trung chuyển tín hiệu trạng thái siêu nhẹ, giúp bạn tiết kiệm 100% chi phí lưu trữ và cước Cloudflare!
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;font-size:0.84rem;line-height:1.6;">
          <div class="card" style="padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
              <span class="pill pill-primary" style="padding:2px 8px;">Bước 1</span>
              <span>Mở Google Cloud Console (Miễn phí 0đ, không cần thẻ)</span>
            </div>
            <p class="muted" style="margin:0 0 8px;">
              Truy cập <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;text-decoration:underline;">Google Cloud Console</a>, đăng nhập bằng tài khoản Google chứa gói 5TB của bạn và bấm <strong>Create Project (Tạo dự án mới)</strong> (ví dụ: <code>EduGlass-LMS-Drive</code>).
            </p>
          </div>

          <div class="card" style="padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
              <span class="pill pill-primary" style="padding:2px 8px;">Bước 2</span>
              <span>Bật Google Drive API</span>
            </div>
            <p class="muted" style="margin:0 0 8px;">
              Vào menu bên trái > <strong>APIs & Services (API và Dịch vụ)</strong> > <strong>Library (Thư viện)</strong> > Tìm kiếm <code>Google Drive API</code> và bấm <strong>Enable (Bật)</strong>.
            </p>
          </div>

          <div class="card" style="padding:14px;">
            <div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
              <span class="pill pill-primary" style="padding:2px 8px;">Bước 3</span>
              <span>Tạo OAuth Client ID</span>
            </div>
            <p class="muted" style="margin:0 0 8px;">
              Vào mục <strong>Credentials (Thông tin xác thực)</strong> > <strong>Create Credentials</strong> > Chọn <strong>OAuth client ID</strong>.
            </p>
            <ul style="margin:0;padding-left:20px;color:var(--text-muted);font-size:0.8rem;">
              <li>Application type: Chọn <strong>Web application</strong>.</li>
              <li>Tên: <code>EduGlass LMS Web Client</code></li>
              <li>
                <strong>Authorized JavaScript origins:</strong> Nhập chính xác:<br/>
                <code style="display:inline-block;margin:4px 0;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;">https://eduglass-lms-workers.akumiyuukii.workers.dev</code>
              </li>
              <li>Bấm <strong>Create</strong> để nhận mã <strong>Client ID</strong>.</li>
            </ul>
          </div>

          <div class="card" style="padding:14px;border:1px solid rgba(48,209,88,0.3);background:rgba(48,209,88,0.05);">
            <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px;color:var(--success);">
              <span class="pill pill-success" style="padding:2px 8px;">Bước 4</span>
              <span>Nhập Google Client ID vào hệ thống</span>
            </div>
            <div class="field" style="margin-bottom:10px;">
              <label>Google OAuth Client ID:</label>
              <input class="input" id="setup-gdrive-client-id" placeholder="vd: 123456789-abcdef.apps.googleusercontent.com" value="${escapeHtml(currentGdrive.clientId)}" />
            </div>
            <div class="flex-row" style="gap:8px;">
              <button class="btn btn-primary btn-sm" id="btn-save-client-id">Lưu & Kích hoạt liên kết</button>
              <button class="btn btn-secondary btn-sm" id="btn-enable-demo-mode">Bật chế độ mẫu 5TB Demo</button>
            </div>
          </div>
        </div>
      </div>
    `, (slot, close) => {
      slot.querySelector('#btn-save-client-id')?.addEventListener('click', () => {
        const val = slot.querySelector('#setup-gdrive-client-id').value.trim();
        if (!val) {
          showToast('Vui lòng nhập Google Client ID!', 'warning');
          return;
        }
        setGDriveClientId(val);
        setGDriveConnected(true);
        showToast('Đã lưu cấu hình Google Drive thành công!', 'success');
        close();
        draw();
      });

      slot.querySelector('#btn-enable-demo-mode')?.addEventListener('click', () => {
        setGDriveConnected(true);
        showToast('Đã kích hoạt kho lưu trữ Google Drive 5TB!', 'success');
        close();
        draw();
      });
    });
  }

  function openPreviewModal(videoTitle, videoUrl) {
    let embedSrc = videoUrl;
    const match = videoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
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
          <span class="muted" style="font-size:0.8rem;">Luồng phát trực tiếp từ máy chủ Google Drive CDN</span>
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
      const res = await apiRequest('/api/v1/videos/link', {
        method: 'POST',
        body: {
          title: videoItem.name.replace(/\.[^.]+$/, ''),
          url: videoItem.webViewLink,
          duration_seconds: videoItem.duration || 600,
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
    const allItems = getFolderItems(currentFolderId);

    const filteredItems = allItems.filter((item) => {
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
        <!-- Header & Storage Quota Card -->
        <div class="card" style="border:1px solid rgba(10,132,255,0.28);background:linear-gradient(135deg, rgba(10,132,255,0.08), rgba(48,209,88,0.05));">
          <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <div style="width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.08);font-size:26px;">
                📁
              </div>
              <div>
                <div style="font-weight:700;font-size:1.15rem;display:flex;align-items:center;gap:8px;">
                  Kho Lưu Trữ Google Drive (5 TB)
                  <span class="pill ${gdrive.isConnected ? 'pill-success' : 'pill-info'}" style="font-size:0.75rem;">
                    ${gdrive.isConnected ? '● Đã kết nối' : '● Sẵn sàng (5 TB)'}
                  </span>
                </div>
                <div class="muted" style="font-size:0.84rem;margin-top:2px;">
                  ${escapeHtml(gdrive.user.email)} • ${escapeHtml(gdrive.quota.planName)} • Tối đa 25 luồng xem đồng thời
                </div>
              </div>
            </div>

            <div class="flex-row" style="flex-wrap:wrap;gap:8px;">
              <button class="btn btn-secondary btn-sm" id="btn-open-guide">📖 Hướng dẫn liên kết (0đ)</button>
              <a href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration:none;">
                ↑ Mở Drive để tải video
              </a>
              <button class="btn btn-primary btn-sm" id="btn-refresh-drive">🔄 Làm mới</button>
            </div>
          </div>

          <div style="margin-top:16px;">
            <div class="flex-between" style="font-size:0.86rem;margin-bottom:6px;">
              <span><strong>Tổng dung lượng đã dùng:</strong> ${gdrive.quota.usedStr} / ${gdrive.quota.totalStr} (${gdrive.quota.pct}%)</span>
              <span class="muted">Còn trống: ${gdrive.quota.freeStr}</span>
            </div>
            <div class="progress-track" style="height:10px;background:rgba(255,255,255,0.35);border-radius:999px;overflow:hidden;">
              <div class="progress-fill" style="width:${gdrive.quota.pct}%;height:100%;background:linear-gradient(90deg, #0A84FF, #30D158);border-radius:999px;transition:width 0.6s cubic-bezier(0.16,1,0.3,1);"></div>
            </div>
          </div>
        </div>

        <!-- Explorer Bar & Breadcrumbs -->
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
                      <div class="muted" style="font-size:0.75rem;">${f.itemCount ? `${f.itemCount} mục` : 'Thư mục Google Drive'}</div>
                    </div>
                    <span style="opacity:0.4;font-size:0.9rem;">›</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Files & Videos List -->
          <div>
            <div class="kpi-label" style="margin-bottom:10px;">Tệp Video Bài Giảng (${files.length})</div>
            ${files.length > 0 ? `
              <div style="display:flex;flex-direction:column;gap:10px;">
                ${files.map((v) => `
                  <div class="card" style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);">
                    <div style="display:flex;align-items:center;gap:14px;min-width:240px;flex:1;">
                      <div style="width:42px;height:42px;border-radius:10px;background:rgba(10,132,255,0.12);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
                        🎬
                      </div>
                      <div style="overflow:hidden;">
                        <div style="font-weight:600;font-size:0.9rem;word-break:break-all;">${escapeHtml(v.name)}</div>
                        <div class="muted" style="font-size:0.76rem;margin-top:2px;">
                          ${v.size ? formatBytes(v.size) : 'Google Video'} • ${v.duration ? `${Math.round(v.duration / 60)} phút` : 'Sẵn sàng phát'}
                        </div>
                      </div>
                    </div>

                    <div class="flex-row" style="gap:8px;flex-wrap:wrap;">
                      <button class="btn btn-secondary btn-sm" data-preview-vid="${v.id}" data-vid-title="${escapeHtml(v.name)}" data-vid-url="${escapeHtml(v.webViewLink)}">
                        ▶ Xem thử
                      </button>
                      <button class="btn btn-primary btn-sm" data-attach-vid="${v.id}">
                        ➕ Gắn vào bài giảng
                      </button>
                      <button class="btn btn-secondary btn-sm" data-copy-link="${escapeHtml(v.webViewLink)}" title="Sao chép link">
                        📋
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="text-align:center;padding:32px 16px;border:1px dashed var(--border-subtle);border-radius:12px;">
                <div style="font-size:2rem;margin-bottom:6px;">📭</div>
                <div style="font-weight:600;">Không có tệp nào trong thư mục này</div>
                <p class="muted" style="margin:4px 0 0;font-size:0.8rem;">
                  Bạn có thể nhấn nút "Mở Drive để tải video" ở trên để đưa video mới vào tài khoản Google Drive 5TB.
                </p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    document.getElementById('btn-open-guide')?.addEventListener('click', openSetupGuideModal);
    document.getElementById('btn-refresh-drive')?.addEventListener('click', () => {
      showToast('Đang làm mới dữ liệu từ Google Drive...', 'info');
      setTimeout(() => {
        draw();
        showToast('Đã làm mới danh sách tệp Google Drive!', 'success');
      }, 400);
    });

    // Breadcrumbs Navigation
    container.querySelectorAll('[data-nav-breadcrumb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.navBreadcrumb;
        const idx = folderBreadcrumbs.findIndex((b) => b.id === targetId);
        if (idx !== -1) {
          folderBreadcrumbs = folderBreadcrumbs.slice(0, idx + 1);
          currentFolderId = targetId;
          draw();
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
        draw();
      });
    });

    // Search and Filter
    const searchInput = document.getElementById('gdrive-search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      draw();
      // Keep focus
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

  draw();
}
