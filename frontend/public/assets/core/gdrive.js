/**
 * EduGlass LMS — Google Drive Integration Engine (5TB Edition)
 * Handles Google OAuth 2.0, Drive API v3 (Quota & File/Folder Explorer),
 * and 1-click video lesson binding.
 */

const STORAGE_KEYS = {
  CLIENT_ID: 'eduglass_gdrive_client_id',
  ACCESS_TOKEN: 'eduglass_gdrive_access_token',
  EXPIRES_AT: 'eduglass_gdrive_expires_at',
  USER_INFO: 'eduglass_gdrive_user_info',
  QUOTA: 'eduglass_gdrive_quota',
  CONNECTED: 'eduglass_gdrive_connected',
};

// Default Demo / 5TB Preset
const DEFAULT_5TB_QUOTA = {
  totalBytes: 5 * 1024 * 1024 * 1024 * 1024, // 5 TB
  usedBytes: 1.18 * 1024 * 1024 * 1024 * 1024, // 1.18 TB
  planName: 'Google One / Workspace (5 TB)',
  accountEmail: 'akumiyuukii@gmail.com',
  displayName: 'Google Drive 5TB',
};

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 4 ? 2 : 1)} ${units[i]}`;
}

export function getGDriveState() {
  const isConnected = localStorage.getItem(STORAGE_KEYS.CONNECTED) === 'true';
  const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '';
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
  const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || 0);
  const rawQuota = localStorage.getItem(STORAGE_KEYS.QUOTA);
  const rawUser = localStorage.getItem(STORAGE_KEYS.USER_INFO);

  let quota = DEFAULT_5TB_QUOTA;
  if (rawQuota) {
    try { quota = JSON.parse(rawQuota); } catch { /* ignore */ }
  }

  let user = { email: quota.accountEmail, name: quota.displayName };
  if (rawUser) {
    try { user = JSON.parse(rawUser); } catch { /* ignore */ }
  }

  const pct = Math.min(100, Math.round((quota.usedBytes / quota.totalBytes) * 100));

  return {
    isConnected,
    clientId,
    token,
    isTokenValid: Boolean(token && expiresAt > Date.now()),
    quota: {
      ...quota,
      pct,
      usedStr: formatBytes(quota.usedBytes),
      totalStr: formatBytes(quota.totalBytes),
      freeStr: formatBytes(quota.totalBytes - quota.usedBytes),
    },
    user,
  };
}

export function setGDriveConnected(connected, quotaData = null, userData = null) {
  localStorage.setItem(STORAGE_KEYS.CONNECTED, connected ? 'true' : 'false');
  if (quotaData) {
    localStorage.setItem(STORAGE_KEYS.QUOTA, JSON.stringify(quotaData));
  }
  if (userData) {
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData));
  }
}

export function setGDriveClientId(clientId) {
  localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());
}

export function disconnectGDrive() {
  localStorage.removeItem(STORAGE_KEYS.CONNECTED);
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.QUOTA);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
}

/**
 * Fetch real storage quota from Google Drive API v3
 */
export async function fetchLiveQuota(accessToken) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Không thể tải thông tin dung lượng từ Google Drive API.');
  const data = await res.json();
  const q = data.storageQuota || {};
  const total = Number(q.limit || DEFAULT_5TB_QUOTA.totalBytes);
  const used = Number(q.usage || DEFAULT_5TB_QUOTA.usedBytes);
  const user = data.user || {};

  const quotaData = {
    totalBytes: total,
    usedBytes: used,
    planName: total >= 4.5 * 1024 * 1024 * 1024 * 1024 ? 'Google One / Workspace (5 TB)' : 'Google Drive Storage',
    accountEmail: user.emailAddress || 'akumiyuukii@gmail.com',
    displayName: user.displayName || 'Google Drive User',
  };

  setGDriveConnected(true, quotaData, { email: user.emailAddress, name: user.displayName, photo: user.photoLink });
  return quotaData;
}

/**
 * Fetch real files & folders from Google Drive API v3
 */
export async function fetchLiveFiles(accessToken, folderId = 'root') {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType,size,thumbnailLink,webViewLink,videoMediaMetadata,iconLink)');
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=folder,name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Không thể tải danh sách tệp từ Google Drive API.');
  const data = await res.json();
  return data.files || [];
}

/**
 * Default sample files & folders for 5TB Drive (used for demo or when testing)
 */
export function getSampleDriveItems(folderId = 'root') {
  if (folderId === 'folder_lop10') {
    return [
      {
        id: 'vid_gdrive_1',
        name: 'Bai_01_Dai_So_Menh_De_Tap_Hop.mp4',
        mimeType: 'video/mp4',
        size: 485 * 1024 * 1024,
        duration: 840,
        webViewLink: 'https://drive.google.com/file/d/1A2B3C_SAMPLE_ID_1/view?usp=sharing',
      },
      {
        id: 'vid_gdrive_2',
        name: 'Bai_02_Bat_Phuong_Trinh_Bac_Nhat.mp4',
        mimeType: 'video/mp4',
        size: 620 * 1024 * 1024,
        duration: 1120,
        webViewLink: 'https://drive.google.com/file/d/1A2B3C_SAMPLE_ID_2/view?usp=sharing',
      },
    ];
  }

  return [
    {
      id: 'folder_lop10',
      name: '📁 Kho Bài Giảng Lớp 10 (Toán & Tin)',
      mimeType: 'application/vnd.google-apps.folder',
      size: null,
      itemCount: 8,
    },
    {
      id: 'folder_lop11',
      name: '📁 Kho Bài Giảng Lớp 11 (Vật Lý & Hóa)',
      mimeType: 'application/vnd.google-apps.folder',
      size: null,
      itemCount: 14,
    },
    {
      id: 'folder_tongon',
      name: '📁 Video Tổng Ôn Thi Đại Học (4K 60FPS)',
      mimeType: 'application/vnd.google-apps.folder',
      size: null,
      itemCount: 22,
    },
    {
      id: 'vid_master_demo',
      name: 'EduGlass_Bai_Giang_Mau_5TB_Drive.mp4',
      mimeType: 'video/mp4',
      size: 920 * 1024 * 1024,
      duration: 1450,
      webViewLink: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing',
    },
  ];
}
