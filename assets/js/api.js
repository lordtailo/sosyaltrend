// api.js - simple wrapper for the Node/Express backend
// every function returns a promise that resolves with parsed json or
// rejects with an Error when the response is not ok.

async function request(path, options = {}) {
  const opts = { ...options };
  opts.credentials = 'include';
  if (opts.body && typeof opts.body === 'object') {
    opts.headers = opts.headers || {};
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return {};
  return res.json();
}

// helpers for offline/local storage backup
function getLocalUsers() {
  try { return JSON.parse(localStorage.getItem('st_users') || '{}'); }
  catch { return {}; }
}
function setLocalUsers(db) {
  localStorage.setItem('st_users', JSON.stringify(db));
}
function storeCurrentUser(user) {
  sessionStorage.setItem('st_current_user', JSON.stringify(user));
}
function getStoredCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('st_current_user')); }
  catch { return null; }
}

// helper to hash a password with SHA-256 (client-side)
async function hashPassword(pw) {
  if (!pw) return pw;
  const enc = new TextEncoder();
  const data = await crypto.subtle.digest('SHA-256', enc.encode(pw));
  return Array.from(new Uint8Array(data)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// auth
export async function login(email, password) {
  const hp = await hashPassword(password);
  try {
    const user = await request('/api/auth/login', { method: 'POST', body: { email, password: hp } });
    return user;
  } catch (e) {
    // network error? fall back to local storage
    if (e.message && e.message.toLowerCase().includes('failed to fetch')) {
      const db = getLocalUsers();
      const u = db[email];
      if (u && u.password === hp) {
        const offlineUser = { email: u.email, username: u.username, displayName: u.displayName };
        storeCurrentUser(offlineUser);
        return offlineUser;
      }
      throw new Error('Invalid credentials (offline)');
    }
    throw e;
  }
}
export function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}
export async function getCurrentUser() {
  try {
    return await request('/api/auth/me');
  } catch (e) {
    if (e.message && e.message.toLowerCase().includes('failed to fetch')) {
      return getStoredCurrentUser();
    }
    throw e;
  }
}
export async function register(data) {
  const payload = { ...data };
  if (payload.password) payload.password = await hashPassword(payload.password);
  try {
    const user = await request('/api/auth/register', { method: 'POST', body: payload });
    return user;
  } catch (e) {
    if (e.message && e.message.toLowerCase().includes('failed to fetch')) {
      const db = getLocalUsers();
      if (db[payload.email]) throw new Error('email exists (offline)');
      db[payload.email] = payload;
      setLocalUsers(db);
      const offlineUser = { email: payload.email, username: payload.username, displayName: payload.displayName };
      storeCurrentUser(offlineUser);
      return offlineUser;
    }
    throw e;
  }
}
export async function changePassword(newPassword) {
  const hp = await hashPassword(newPassword);
  return request('/api/auth/change-password', { method: 'POST', body: { newPassword: hp } });
}
export function changeEmail(newEmail) {
  return request('/api/auth/change-email', { method: 'POST', body: { newEmail } });
}
export function resetPassword(email) {
  return request('/api/auth/reset-password', { method: 'POST', body: { email } });
}

// users
export function getUsers(params = {}) {
  let url = '/api/users';
  const q = new URLSearchParams(params).toString();
  if (q) url += '?' + q;
  return request(url);
}
export function getUserById(uid) {
  return request(`/api/users/${uid}`);
}
export function updateUser(uid, changes) {
  return request(`/api/users/${uid}`, { method: 'PUT', body: changes });
}
export function getSuggestions(limit = 20) {
  return request(`/api/users/suggestions?limit=${limit}`);
}
export function sendFriendRequest(fromUid, toUid) {
  return request('/api/friends/request', { method: 'POST', body: { fromUid, toUid } });
}
export function cancelFriendRequest(fromUid, toUid) {
  return request('/api/friends/cancel', { method: 'POST', body: { fromUid, toUid } });
}

// posts
export function getPosts(params = {}) {
  let url = '/api/posts';
  const q = new URLSearchParams(params).toString();
  if (q) url += '?' + q;
  return request(url);
}
export function createPost(post) {
  return request('/api/posts', { method: 'POST', body: post });
}
export function updatePost(id, changes) {
  return request(`/api/posts/${id}`, { method: 'PUT', body: changes });
}
export function deletePost(id) {
  return request(`/api/posts/${id}`, { method: 'DELETE' });
}

// other helpers could be added as needed
