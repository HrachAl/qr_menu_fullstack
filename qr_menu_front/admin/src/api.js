const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.origin) || 'http://localhost:8000';

/** Product image URL: backend serves static files under /build (e.g. /build/new_menu/1.png) */
export function productImageUrl(imgPath) {
  if (!imgPath) return '';
  const path = imgPath.startsWith('http') ? imgPath : `${API_BASE}/build/${imgPath}`;
  return path;
}

function getToken() {
  return localStorage.getItem('admin_token');
}

export async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = { ...options.headers, 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin_panel/#/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(await res.text().then(t => t || res.statusText));
  if (res.status === 204) return null;
  return res.json();
}

export async function login(email, password) {
  const data = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(r => { if (!r.ok) throw new Error(r.status === 401 ? 'Invalid email or password' : r.statusText); return r.json(); });
  return data;
}

export async function uploadFile(path, file) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  if (!res.ok) throw new Error(await res.text().then(t => t || res.statusText));
  return res.json();
}
