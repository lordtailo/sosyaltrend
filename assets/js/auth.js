// auth.js - shared logic for login, register and forgot pages
import * as api from './api.js';

// perform initial redirect if already logged in
(async () => {
  try {
    const cur = await api.getCurrentUser();
    if (cur) window.location.href = '/index.html';
  } catch {};
})();

function showStatus(el, text, color) {
  if (!el) return;
  el.innerText = text;
  if (color) el.style.color = color;
}
function handleError(el, err) {
  console.error(err);
  showStatus(el, err.message || err, '#ef4444');
}

// login form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    try {
      showStatus(msg, 'Giriş yapılıyor...', '#4f46e5');
      await api.login(email, pass);
      showStatus(msg, 'Başarılı! Yönlendiriliyorsunuz...', '#10b981');
      setTimeout(() => window.location.href = '/index.html', 1200);
    } catch (err) {
      handleError(msg, err);
    }
  });
}

// register form
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;
    const name = document.getElementById('regName').value.trim();
    const uname = document.getElementById('regUsername').value.trim();
    const msg = document.getElementById('regMsg');
    if (pass.length < 6) return showStatus(msg, 'Şifre en az 6 karakter olmalıdır.', '#ef4444');
    try {
      showStatus(msg, 'Hesap oluşturuluyor...', '#4f46e5');
      await api.register({ email, password: pass, displayName: name, username: uname });
      showStatus(msg, 'Başarılı! Hoş geldiniz.', '#10b981');
      setTimeout(() => window.location.href = '/index.html', 1200);
    } catch (err) {
      handleError(msg, err);
    }
  });
}

// forgot form
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.trim();
    const msg = document.getElementById('resetMsg');
    try {
      showStatus(msg, 'İşlem gerçekleştiriliyor...', '#4f46e5');
      const res = await api.resetPassword(email);
      showStatus(msg, 'Yeni şifre: ' + res.newPassword, '#10b981');
    } catch (err) {
      handleError(msg, err);
    }
  });
}