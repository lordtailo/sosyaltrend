// app.js - front-end logic for SosyalTrend (Node.js backend version)
// Firebase SDK removed; all data operations go through the /api endpoints.

import * as api from './api.js';

// ---------- static data (ramadan widget, special days, etc) ----------
const ozelGunler = [
  { ay: 0, gun: 1, baslik: "Yılbaşı", mesaj: "Yeni yılın tüm SosyalTrend ailesine huzur ve mutluluk getirmesini dileriz! 🎄✨" },
  { ay: 1, gun: 14, baslik: "Sevgililer Günü", mesaj: "Sevginin paylaştıkça çoğaldığı bir gün dileriz! ❤️" },
  { ay: 2, gun: 8, baslik: "Dünya Kadınlar Günü", mesaj: "Emeğiyle dünyayı güzelleştiren tüm kadınların günü kutlu olsun! 💐" },
  { ay: 2, gun: 18, baslik: "Çanakkale Zaferi", mesaj: "18 Mart Çanakkale Zaferi’nin yıl dönümünde şehitlerimizi minnetle anıyoruz. 🇹🇷" },
  { ay: 3, gun: 23, baslik: "Ulusal Egemenlik ve Çocuk Bayramı", mesaj: "23 Nisan kutlu olsun! Geleceğimiz çocuklara emanet. 🇹🇷" },
  { ay: 4, gun: 1, baslik: "Emek ve Dayanışma Günü", mesaj: "Tüm çalışanların 1 Mayıs işçi bayramı kutlu olsun! 🛠️" },
  { ay: 4, gun: 19, baslik: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", mesaj: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramımız kutlu olsun! 🇹🇷" },
  { ay: 6, gun: 15, baslik: "Demokrasi ve Milli Birlik Günü", mesaj: "15 Temmuz Demokrasi ve Milli Birlik Günü'nde şehitlerimizi anıyoruz." },
  { ay: 7, gun: 30, baslik: "Zafer Bayramı", mesaj: "30 Ağustos Zafer Bayramımız kutlu olsun! 🇹🇷" },
  { ay: 9, gun: 29, baslik: "Cumhuriyet Bayramı", mesaj: "Cumhuriyetimizin yeni yaşını gururla kutluyoruz! 29 Ekim kutlu olsun! 🇹🇷" },
  { ay: 10, gun: 10, baslik: "Atatürk'ü Anma Günü", mesaj: "Gazi Mustafa Kemal Atatürk'ü saygı ve özlemle anıyoruz. 🖤" },
  { ay: 11, gun: 24, baslik: "Öğretmenler Günü", mesaj: "Gelecek nesilleri yetiştiren tüm öğretmenlerimizin günü kutlu olsun! 🎓" },
  // dini günler
  { ay: 0, gun: 15, baslik: "Miraç Kandili", mesaj: "Miraç Kandiliniz mübarek olsun. 🤲" },
  { ay: 1, gun: 2, baslik: "Berat Kandili", mesaj: "Berat Kandilimiz mübarek olsun. 🌙" },
  { ay: 1, gun: 19, baslik: "Ramazan Başlangıcı", mesaj: "Hoş geldin Ya Şehr-i Ramazan! 🌙" },
  { ay: 2, gun: 16, baslik: "Kadir Gecesi", mesaj: "Kadir Geceniz mübarek olsun. 🙏" },
  { ay: 2, gun: 20, baslik: "Ramazan Bayramı (1. Gün)", mesaj: "Ramazan Bayramınız mübarek olsun! 🍬" },
  { ay: 4, gun: 27, baslik: "Kurban Bayramı (1. Gün)", mesaj: "Kurban Bayramınız kutlu olsun. Paylaşmanın ve dayanışmanın günü! 🐑" }
];

const tarihteBugun = [
  { ay: 0, gun: 29, baslik: "Tarihte Bugün", mesaj: "1923: Mustafa Kemal Atatürk, ilk Türkiye Cumhurbaşkanı seçildi. 🗳️" },
  { ay: 1, gun: 5, baslik: "Tarihte Bugün", mesaj: "1924: Türkiye'de ilk kadın avukat Süreyya Ağaoğlu görevine başladı. ⚖️" },
  { ay: 2, gun: 12, baslik: "Tarihte Bugün", mesaj: "1930: Türk parasının değerini koruma kanunu kabul edildi. ₺" },
  { ay: 3, gun: 25, baslik: "Tarihte Bugün", mesaj: "1915: Çanakkale Kara Savaşları başladı. 🛡️" },
  { ay: 4, gun: 29, baslik: "Tarihte Bugün", mesaj: "1953: Türkiye'nin ilk yerli uçağı 'Nu.D.38' Ankara'dan İstanbul'a uçtu. ✈️" },
  { ay: 8, gun: 9, baslik: "Tarihte Bugün", mesaj: "1928: Harf Devrimi'nin ilk adımı atıldı; yeni Türk alfabesi tanıtıldı. ✍️" },
  { ay: 11, gun: 5, baslik: "Tarihte Bugün", mesaj: "1934: Türk kadınına seçme ve seçilme hakkı tanındı! 🗳️" }
];

// --------------- global state ----------------
let user = { displayName: "Misafir", avatarUrl: "assets/img/strendsaydamv2.png", isAdmin: false, username: '' };

// helpers
function waitForElement(selector, timeout = 5000, interval = 200) {
  return new Promise(resolve => {
    const start = Date.now();
    (function check() {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, interval);
    })();
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function getAvatarUrl(url, type = 'user') {
  if (!url) return 'assets/img/strendsaydamv2.png';
  return url;
}

// simple UI helpers
function disableButton(btn, text) {
  if (btn) {
    btn.innerHTML = text;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'default';
  }
}

// simple UI helpers (could be expanded)
window.toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark');
};

window.toggleNotifications = () => {
  const dd = document.getElementById('notificationsDropdown');
  if (dd) dd.style.display = (dd.style.display === 'flex' ? 'none' : 'flex');
};

window.navigateTo = (page) => {
  // simple wrapper to change pages; default behaviour is to just navigate
  // to the href of clicked link which is already set, so we intentionally
  // return true to allow default.
  return true;
};

// -------- authentication ----------
async function initAuth() {
  try {
    const current = await api.getCurrentUser();
    window.currentUser = current;
    user.id = current.id;
    user.username = current.username || current.email.split('@')[0];
    user.displayName = current.displayName || user.username;
    user.avatarUrl = current.avatarUrl || user.avatarUrl;
    user.isAdmin = current.role === 'admin';
    updateUIWithUser();
    loadPostsFeed();
  } catch (err) {
    window.location.href = '/auth/login.html';
  }
}

function updateUIWithUser() {
  const welcome = document.getElementById('welcomeMessage');
  const avatar = document.getElementById('headerAvatar');
  const display = document.getElementById('menuDisplayName');
  const uname = document.getElementById('menuUsername');
  if (welcome) welcome.innerText = `Hoş geldin, ${user.displayName || user.username}`;
  if (avatar) avatar.src = user.avatarUrl;
  if (display) display.innerText = user.displayName;
  if (uname) uname.innerText = '@' + user.username;
}

async function logout() {
  // try remote logout; if it fails just proceed anyway
  try { await api.logout(); } catch {}
  // clear offline session data
  sessionStorage.removeItem('st_current_user');
  window.location.href = '/auth/login.html';
}

// ---------- suggestions / friends ----------
async function loadSuggestions() {
  const container = document.getElementById('dynamic-suggestions-list');
  if (!container) return;
  container.innerHTML = '';
  try {
    const list = await api.getSuggestions();
    list.forEach(u => {
      if (u.id === user.id) return;
      const html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="window.location.href='profil.html?id=${encodeURIComponent(u.username)}'">
             <img src="${getAvatarUrl(u.avatarUrl)}" style="width:38px;height:38px;border-radius:50%;border:1.5px solid var(--primary);object-fit:cover;">
             <div style="max-width:90px;overflow:hidden;">
               <div style="font-size:0.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.displayName||'İsimsiz'}</div>
               <div style="font-size:0.7rem;color:var(--text-muted);">@${u.username}</div>
             </div>
          </div>
          <button class="tool-btn" onclick="sendFriendRequestToUid('${u.id}','${u.username}')">+ Arkadaş</button>
      </div>`;
      container.insertAdjacentHTML('beforeend', html);
    });
  } catch (e) {
    console.error(e);
  }
}

async function sendFriendRequestToUid(uid, username) {
  try {
    await api.sendFriendRequest(user.id, uid);
    alert('İstek gönderildi');
    loadSuggestions();
  } catch (e) {
    console.error(e);
    alert('Gönderilemedi: ' + e.message);
  }
}

async function cancelFriendRequestToUid(uid) {
  try {
    await api.cancelFriendRequest(user.id, uid);
    loadSuggestions();
  } catch (e) {
    console.error(e);
  }
}

// ---------- posts / feed ----------
let showAllFeedPosts = false;

async function loadPostsFeed(showAll = false) {
  if (showAll) showAllFeedPosts = true;
  try {
    let posts = await api.getPosts();
    posts.sort((a,b)=>b.timestamp - a.timestamp);
    if (!showAllFeedPosts) posts = posts.slice(0, 7);
    renderFeed(posts);
  } catch (e) {
    console.error('Gönderiler yüklenirken hata', e);
  }
}

function renderFeed(posts) {
  const feed = document.getElementById('feed-items');
  if (!feed) return;
  if (!posts || posts.length === 0) {
    feed.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Henüz gönderi yok.</div>';
    return;
  }
  let html = '';
  posts.forEach(p => {
    const isMine = p.username === user.username;
    const isLiked = p.likes?.includes(user.username);
    const avatarUrl = getAvatarUrl(p.avatarUrl);
    const contentWithLinks = (p.content||'').replace(/(#[\wığüğşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
    const postImageHtml = p.image ? `<div class="post-image-wrapper" style="margin:12px auto;max-width:50%;"><img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;" onclick="toggleImageExpand(this)" alt="Post görseli"></div>` : '';
    html += `<div class="glass-card post" style="position: relative;">
        <div style="display:flex;gap:10px;margin-bottom:10px;">
           <img src="${avatarUrl}" class="user-avatar" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
           <div>
              <div style="font-weight:700;display:flex;align-items:center;gap:5px;cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">${p.displayName||p.username} <span class="post-time">• ${formatTime(p.timestamp)}</span></div>
              <div style="font-size:0.75rem;color:var(--text-muted);" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">@${p.username}</div>
           </div>
        </div>
        <p style="white-space:pre-wrap;margin-bottom:10px;">${contentWithLinks}</p>${postImageHtml}
        <div style="display:flex;gap:12px;">
           <button class="tool-btn" onclick="likePost('${p.id}', ${isLiked})" style="gap:5px;color:${isLiked?'#ef4444':''}"><i class="${isLiked?'fa-solid':'fa-regular'} fa-heart"></i><span>${p.likes?.length||0}</span></button>
           <button class="tool-btn" onclick="toggleCommentSection('${p.id}')" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${p.comments?.length||0}</span></button>
           <button class="tool-btn" onclick="toggleBookmark('${p.id}', ${p.savedBy?.includes(user.username)})" style="color:${p.savedBy?.includes(user.username)?'#f59e0b':''}"><i class="${p.savedBy?.includes(user.username)?'fa-solid':'fa-regular'} fa-bookmark"></i></button>
           <button class="tool-btn" onclick="window.openShareMenu('${p.id}')" style="gap:5px;margin-left:auto;"><i class="fa-solid fa-share"></i></button>
        </div>
        <div id="comments-${p.id}" class="comment-area" style="display:none;"></div>
    </div>`;
  });
  feed.innerHTML = html;
}

async function sharePost() {
  const textarea = document.getElementById('postInput');
  const content = textarea.value.trim();
  if (!content) return;
  const obj = {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    content,
    timestamp: Date.now(),
    likes: [],
    comments: [],
    savedBy: []
  };
  // image support: if an <input type=file id="imageInput"> exists
  const fileInput = document.getElementById('imageInput');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    obj.image = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }
  try {
    await api.createPost(obj);
    textarea.value = '';
    loadPostsFeed();
  } catch (e) { console.error(e); }
}

async function likePost(id, currentlyLiked) {
  try {
    const posts = await api.getPosts();
    const post = posts.find(p=>p.id===id);
    if (!post) return;
    let likes = post.likes || [];
    if (currentlyLiked) likes = likes.filter(u=>u!==user.username);
    else likes.push(user.username);
    await api.updatePost(id, { likes });
    loadPostsFeed(showAllFeedPosts);
  } catch (e) { console.error(e); }
}

// TODO: toggleCommentSection, toggleBookmark, openShareMenu, other helpers
function toggleCommentSection(id) {
  const el = document.getElementById(`comments-${id}`);
  if (el) el.style.display = (el.style.display === 'none' ? 'block' : 'none');
}
function toggleBookmark(id, currently) {
  // simply send update without much handling
  api.updatePost(id, { savedBy: currently ? [] : [user.username] }).then(() => loadPostsFeed(showAllFeedPosts));
}
function openShareMenu(id) {
  alert('Bağlantı kopyalandı: ' + window.location.origin + '/index.html#post-' + id);
}

// --------- page setup ---------
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('shareBtn')?.addEventListener('click', sharePost);
  document.getElementById('postInput')?.addEventListener('input', updatePostCount);
});

document.addEventListener('includesLoaded', async () => {
  await loadComponents();
  // don't force auth check on login or forgot pages (they redirect otherwise)
  const path = window.location.pathname;
  if (!path.endsWith('/auth/login.html') && !path.endsWith('/auth/forgot.html') && !path.endsWith('/auth/register.html')) {
    await initAuth();
  }
  if (window.location.pathname.endsWith('search.html')) {
     runSearch();
  }
});

async function loadComponents() {
  await loadSuggestions();
}

function updatePostCount() {
  const input = document.getElementById('postInput');
  const counter = document.getElementById('post-charcount');
  if (!input || !counter) return;
  counter.textContent = `${input.value.length}/500`;
}

// The ramadan widget and other UI functions can be copied or left as is

// small helper stubs
function searchTrend(tag) {
  window.location.href = `search.html?q=${encodeURIComponent(tag)}`;
}

// basic search page implementation
async function runSearch() {
  const params = new URLSearchParams(window.location.search);
  const q = (params.get('q') || '').trim().toLowerCase();
  const statusEl = document.getElementById('searchStatus');
  const usersContainer = document.getElementById('search-results-users');
  const sectionUsers = document.getElementById('section-users');
  const noResults = document.getElementById('search-no-results');
  if (!q) {
    if (statusEl) statusEl.innerText = 'Arama terimi giriniz.';
    return;
  }
  try {
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Arama yapılıyor...';
    const allUsers = await api.getUsers();
    const matched = allUsers.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q)
    );
    if (matched.length) {
      sectionUsers.style.display = 'block';
      usersContainer.innerHTML = matched.map(u => `
        <div class="user-card" onclick="window.location='profil.html?id=${encodeURIComponent(u.username)}'">
          <img src="${getAvatarUrl(u.avatarUrl)}" alt="">
          <div class="info"><strong>${u.displayName||u.username}</strong><br>@${u.username}</div>
        </div>
      `).join('');
    } else {
      noResults.style.display = 'block';
    }
  } catch (e) {
    console.error('search error', e);
    if (statusEl) statusEl.innerText = 'Arama sırasında hata oluştu';
  }
}

