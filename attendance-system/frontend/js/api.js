const API_BASE = '/api';

function getToken() { return localStorage.getItem('att_token'); }
function getUser() {
  const raw = localStorage.getItem('att_user');
  return raw ? JSON.parse(raw) : null;
}
function setSession(token, user) {
  localStorage.setItem('att_token', token);
  localStorage.setItem('att_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('att_token');
  localStorage.removeItem('att_user');
}
function requireAuth() {
  if (!getToken()) window.location.href = '/pages/login.html';
}

async function api(path, options = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/pages/login.html';
    return null;
  }

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const message = (data && data.error) ? data.error : 'Request failed';
    throw new Error(message);
  }
  return data;
}

function logout() {
  clearSession();
  window.location.href = '/pages/login.html';
}

function renderTopbar(activePage) {
  const user = getUser();
  if (!user) return;
  const el = document.getElementById('topbar-who');
  if (el) {
    el.innerHTML = `<span>${user.name} · ${user.role.toUpperCase()}</span>` +
      `<button class="logout" onclick="logout()">Sign out</button>`;
  }
}
