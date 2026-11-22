/**
 * EduGlass LMS — Google Drive Integration Engine
 * Connects directly to Google Drive API v3 using Google Identity Services (GIS)
 * Supports all account tiers: 15 GB Free, 100 GB, 2 TB, 5 TB, or Unlimited Workspace.
 * ZERO mock data — displays only verified account storage and user files.
 */

const STORAGE_KEYS = {
  CLIENT_ID: 'eduglass_gdrive_client_id',
  ACCESS_TOKEN: 'eduglass_gdrive_access_token',
  EXPIRES_AT: 'eduglass_gdrive_expires_at',
  USER_INFO: 'eduglass_gdrive_user_info',
  QUOTA: 'eduglass_gdrive_quota',
  CONNECTED: 'eduglass_gdrive_connected',
};

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'Không giới hạn';
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 1)} ${units[i]}`;
}

export function getGDriveState() {
  const isConnected = localStorage.getItem(STORAGE_KEYS.CONNECTED) === 'true';
  const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '';
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
  const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || 0);
  const isTokenValid = Boolean(token && (expiresAt === 0 || expiresAt > Date.now()));

  let quota = null;
  const rawQuota = localStorage.getItem(STORAGE_KEYS.QUOTA);
  if (rawQuota) {
    try {
      const q = JSON.parse(rawQuota);
      const isUnlimited = q.totalBytes === null || q.totalBytes === undefined || q.totalBytes <= 0;
      const pct = isUnlimited ? 0 : Math.min(100, Math.round((q.usedBytes / q.totalBytes) * 100));
      quota = {
        totalBytes: q.totalBytes,
        usedBytes: q.usedBytes,
        pct,
        usedStr: formatBytes(q.usedBytes),
        totalStr: formatBytes(q.totalBytes),
        freeStr: isUnlimited ? 'Không giới hạn' : formatBytes(Math.max(0, q.totalBytes - q.usedBytes)),
        isUnlimited,
      };
    } catch {
      quota = null;
    }
  }

  let user = null;
  const rawUser = localStorage.getItem(STORAGE_KEYS.USER_INFO);
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }

  return {
    isConnected: Boolean(isConnected && (user || quota || token)),
    clientId,
    token,
    isTokenValid,
    quota,
    user,
  };
}

export function setGDriveClientId(clientId) {
  localStorage.setItem(STORAGE_KEYS.CLIENT_ID, (clientId || '').trim());
}

export function saveGDriveSession(accessToken, expiresInSeconds, quotaData, userData) {
  localStorage.setItem(STORAGE_KEYS.CONNECTED, 'true');
  if (accessToken) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    const ttl = Number(expiresInSeconds) || 3600;
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(Date.now() + ttl * 1000));
  }
  if (quotaData) {
    localStorage.setItem(STORAGE_KEYS.QUOTA, JSON.stringify(quotaData));
  }
  if (userData) {
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData));
  }
}

export function disconnectGDrive() {
  localStorage.removeItem(STORAGE_KEYS.CONNECTED);
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.QUOTA);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
}

/**
 * Load Google Identity Services SDK dynamically
 */
export function loadGsiScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Lỗi tải Google SDK')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services SDK.'));
    document.head.appendChild(script);
  });
}

/**
 * Fetch real storage quota from Google Drive API v3
 */
export async function fetchLiveQuota(accessToken) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Phiên đăng nhập Google đã hết hạn. Vui lòng kết nối lại tài khoản.');
    }
    throw new Error(`Google Drive API lỗi HTTP ${res.status}`);
  }
  const data = await res.json();
  const q = data.storageQuota || {};
  const total = q.limit ? Number(q.limit) : null;
  const used = Number(q.usage || 0);
  const u = data.user || {};

  const quotaData = {
    totalBytes: total,
    usedBytes: used,
  };

  const userData = {
    email: u.emailAddress || '',
    name: u.displayName || 'Google User',
    photo: u.photoLink || '',
  };

  saveGDriveSession(accessToken, 3600, quotaData, userData);
  return { quota: quotaData, user: userData };
}

/**
 * Fetch real files & folders from Google Drive API v3
 */
export async function fetchLiveFiles(accessToken, folderId = 'root') {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType,size,thumbnailLink,webViewLink,videoMediaMetadata,iconLink)');
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Phiên đăng nhập Google đã hết hạn. Vui lòng kết nối lại tài khoản.');
    }
    throw new Error(`Không thể lấy danh sách file (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return data.files || [];
}
