/**
 * EduGlass LMS — HTTP API Client
 */

const TOKEN_KEY = 'eduglass_access_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options = { ...options, body: JSON.stringify(options.body) };
  }

  const res = await fetch(path, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    let message = (data && data.detail) || '';
    if (!message) {
      if (res.status === 413) {
        message = 'Tệp quá lớn so với giới hạn tải lên trực tiếp (HTTP 413 Payload Too Large). Vui lòng dùng Tải lên phân đoạn hoặc gắn link Google Drive.';
      } else if (res.status === 400) {
        message = 'Yêu cầu không hợp lệ (HTTP 400). Vui lòng kiểm tra lại định dạng dữ liệu.';
      } else {
        message = `HTTP ${res.status}`;
      }
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    const token = getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed);
        } else {
          let msg = parsed.detail;
          if (!msg && xhr.status === 413) {
            msg = 'Tệp quá lớn so với giới hạn tải lên trực tiếp (HTTP 413 Payload Too Large). Vui lòng dùng Tải lên phân đoạn hoặc gắn link Google Drive.';
          }
          reject(new Error(msg || `Upload failed (${xhr.status})`));
        }
      } catch (e) {
        if (xhr.status === 413) {
          reject(new Error('Tệp quá lớn so với giới hạn Cloudflare Workers (HTTP 413). Vui lòng dùng Tải lên phân đoạn hoặc gắn link Google Drive.'));
        } else {
          reject(new Error(`Phản hồi máy chủ không hợp lệ (HTTP ${xhr.status}).`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Lỗi kết nối khi tải video lên.'));
    xhr.send(formData);
  });
}

export async function downloadAuthenticatedFile(url, filename) {
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Không thể xuất báo cáo.');
  }
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}
