import './app.js';

const VISITOR_HIDDEN_TABS = ['likes', 'saves', 'notifs'];
const TAB_SECTION_IDS = {
  posts: 'posts-tab',
  friends: 'friends-tab',
  likes: 'likes-tab',
  saves: 'saves-tab',
  notifs: 'notifs-tab'
};

function getQueryUsername() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || params.get('u') || params.get('username') || null;
}

function waitFor(predicate, interval = 50, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const handle = setInterval(() => {
      if (predicate()) {
        clearInterval(handle);
        resolve(true);
      } else if (Date.now() - start > timeout) {
        clearInterval(handle);
        reject(new Error('Zaman aşımı: bekleme süresi doldu.'));
      }
    }, interval);
  });
}

async function waitForAppReady() {
  await waitFor(() => window.db && window.auth && typeof window.user !== 'undefined', 100, 10000);
}

async function waitForIncludes() {
  if (window.includesLoaded) return;
  await waitFor(() => window.includesLoaded === true, 100, 10000).catch(() => {});
}

const DEFAULT_AVATAR_URL = 'assets/img/strendsaydamv2.png';

function resolveAvatarUrl(value) {
  const avatar = value || DEFAULT_AVATAR_URL;
  if (typeof window.getAvatarUrl === 'function') {
    return window.getAvatarUrl(avatar, 'user');
  }
  if (typeof avatar === 'string') {
    if (avatar.startsWith('http') || avatar.startsWith('data:') || avatar.startsWith('assets/') || avatar.startsWith('/')) {
      return avatar;
    }
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatar)}`;
  }
  return DEFAULT_AVATAR_URL;
}

function escapeHTML(value) {
  return String(value || '').replace(/[&"'<>]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function formatTimestamp(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : (value.seconds ? new Date(value.seconds * 1000) : new Date(value));
  return date.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function createPostCard(post) {
  const content = escapeHTML(post.content || '');
  const linkedContent = content.replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link">$1</span>');
  const imageHtml = post.image ? `<div class="post-image-wrapper" style="margin:12px 0; border-radius:12px; overflow:hidden; border:1px solid var(--border); background:#f8fafc;"><img src="${escapeHTML(post.image)}" alt="Gönderi görseli" style="width:100%; height:auto; display:block;"></div>` : '';
  const avatarUrl = escapeHTML(resolveAvatarUrl(post.avatarUrl || post.avatar || post.avatarSeed || post.photoURL || DEFAULT_AVATAR_URL));
  const authorName = escapeHTML(post.name || post.displayName || post.username || 'Anonim');
  const authorUsername = escapeHTML(post.username || '');
  return `
    <div class="glass-card post" style="position: relative; margin-bottom:18px;">
      <div style="display:flex; gap:10px; margin-bottom:12px; align-items:center;">
        <img src="${avatarUrl}" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';" class="user-avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(authorUsername)}'">
        <div>
          <div style="font-weight:700; display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(authorUsername)}'">
            ${authorName}
            <span class="post-time" style="font-weight:400; color:var(--text-muted); font-size:0.85rem;">• ${formatTimestamp(post.timestamp)}</span>
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(authorUsername)}'">@${authorUsername}</div>
        </div>
      </div>
      <p style="white-space: pre-wrap; margin:0 0 12px; color:var(--text-main);">${linkedContent}</p>
      ${imageHtml}
    </div>
  `;
}

function setActiveTab(tabKey, disableHashUpdate = false) {
  const tabs = document.querySelectorAll('.profile-tab');
  const sections = document.querySelectorAll('.tab-content');
  tabs.forEach((tab) => {
    if (tab.dataset.tab === tabKey) tab.classList.add('active');
    else tab.classList.remove('active');
  });
  sections.forEach((section) => {
    if (section.id === TAB_SECTION_IDS[tabKey]) {
      section.style.display = 'block';
      section.classList.add('active');
    } else {
      section.style.display = 'none';
      section.classList.remove('active');
    }
  });
  if (!disableHashUpdate) {
    window.history.replaceState(null, '', `#${tabKey}`);
  }
}

function updateTabVisibility(isOwnProfile) {
  VISITOR_HIDDEN_TABS.forEach((tabKey) => {
    const button = document.querySelector(`.profile-tab[data-tab="${tabKey}"]`);
    if (button) {
      button.style.display = isOwnProfile ? 'inline-flex' : 'none';
    }
  });
}

function showMessage(containerId, text) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div style="text-align:center; padding:30px 0; color:var(--text-muted);"><i class="fa-regular fa-circle-info" style="font-size:2.2rem; margin-bottom:12px; display:block;"></i><p style="margin:0;">${escapeHTML(text)}</p></div>`;
  }
}

async function loadProfileData(profileUsername) {
  const usersQuery = window.query(window.collection(db, 'users'), window.where('username', '==', profileUsername), window.limit(1));
  const usersSnap = await window.getDocs(usersQuery);
  if (usersSnap.empty) return null;
  const userDoc = usersSnap.docs[0];
  return { uid: userDoc.id, ...userDoc.data() };
}

async function loadPosts(username) {
  // Preferred server-side ordered query
  try {
      const postsQuery = window.query(window.collection(db, 'posts'), window.where('username', '==', username), window.orderBy('timestamp', 'desc'));
      const postsSnap = await window.getDocs(postsQuery);
    const posts = postsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    if (posts.length > 0) return posts;
  } catch (err) {
    // If an index is required, Firestore will throw. Fall back to client-side sorting below.
    console.warn('loadPosts: ordered query failed, falling back to client-side sort', err.message || err);
  }

  // Fallback: try other field then client-side sort to avoid needing a composite index
  try {
    const fallbackQuery = window.query(window.collection(db, 'posts'), window.where('authorUsername', '==', username));
    const fallbackSnap = await window.getDocs(fallbackQuery);
    let posts = fallbackSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    posts.sort((a, b) => {
      const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : (a.timestamp && a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime());
      const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : (b.timestamp && b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime());
      return tb - ta;
    });
    if (posts.length > 0) return posts;
  } catch (err) {
    console.warn('loadPosts fallback query failed', err.message || err);
  }

  // Final fallback: fetch all posts for the username without any order and sort client-side
  try {
    const anyQuery = window.query(window.collection(db, 'posts'), window.where('username', '==', username));
    const anySnap = await window.getDocs(anyQuery);
    const posts = anySnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    posts.sort((a, b) => {
      const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : (a.timestamp && a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime());
      const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : (b.timestamp && b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime());
      return tb - ta;
    });
    return posts;
  } catch (err) {
    console.error('loadPosts: tüm fallbackler başarısız', err);
    return [];
  }
}

async function loadLikes(username) {
  try {
      const likesQuery = window.query(window.collection(db, 'posts'), window.where('likes', 'array-contains', username), window.orderBy('timestamp', 'desc'));
      const likesSnap = await window.getDocs(likesQuery);
    return likesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn('loadLikes: ordered query failed, falling back to client-side sort', err.message || err);
    try {
      const likesQuery = window.query(window.collection(db, 'posts'), window.where('likes', 'array-contains', username));
      const likesSnap = await window.getDocs(likesQuery);
      const posts = likesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      posts.sort((a, b) => {
        const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : (a.timestamp && a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime());
        const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : (b.timestamp && b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime());
        return tb - ta;
      });
      return posts;
    } catch (err2) {
      console.error('loadLikes fallback failed', err2);
      return [];
    }
  }
}

async function loadSaves(username) {
  try {
      const savesQuery = window.query(window.collection(db, 'posts'), window.where('savedBy', 'array-contains', username), window.orderBy('timestamp', 'desc'));
      const savesSnap = await window.getDocs(savesQuery);
    return savesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn('loadSaves: ordered query failed, falling back to client-side sort', err.message || err);
    try {
      const savesQuery = window.query(window.collection(db, 'posts'), window.where('savedBy', 'array-contains', username));
      const savesSnap = await window.getDocs(savesQuery);
      const posts = savesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      posts.sort((a, b) => {
        const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : (a.timestamp && a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime());
        const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : (b.timestamp && b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime());
        return tb - ta;
      });
      return posts;
    } catch (err2) {
      console.error('loadSaves fallback failed', err2);
      return [];
    }
  }
}

async function loadFriendProfiles(profileData) {
  const friendUids = Array.isArray(profileData.friends) ? profileData.friends.slice(0, 12) : [];
  if (!friendUids.length) return [];
  const friends = [];
  await Promise.all(friendUids.map(async (uid) => {
    try {
      const snap = await window.getDoc(window.doc(db, 'users', uid));
      if (snap.exists()) friends.push({ uid: snap.id, ...snap.data() });
    } catch (error) {
      console.warn('Friend fetch error', error);
    }
  }));
  return friends;
}

function renderProfileHeader(profileData, isOwnProfile) {
  const avatar = document.getElementById('profilePageAvatar');
  const name = document.getElementById('profilePageName');
  const handle = document.getElementById('profilePageHandle');
  const friendCount = document.getElementById('profileFriendCount');
  const joinDate = document.getElementById('profileJoinDate');
  const locationEl = document.getElementById('profileLocation');
  const hometownEl = document.getElementById('profileHometown');
  const dobEl = document.getElementById('profileDob');
  const editBtn = document.getElementById('editProfileBtn');
  const chatBtn = document.getElementById('profileActionBtn');
  const avatarEdit = document.getElementById('profileAvatarEdit');

  if (avatar) avatar.src = resolveAvatarUrl(profileData.avatarUrl || profileData.avatar || profileData.photoURL || profileData.avatarSeed || DEFAULT_AVATAR_URL);
  if (name) name.textContent = profileData.displayName || profileData.name || profileData.username;
  if (handle) handle.textContent = `@${profileData.username}`;
  if (friendCount) {
    const count = typeof profileData.friendCount === 'number' ? profileData.friendCount : (Array.isArray(profileData.friends) ? profileData.friends.length : 0);
    friendCount.textContent = count;
  }
  if (joinDate) joinDate.textContent = formatTimestamp(profileData.createdAt || profileData.joinedAt || profileData.created);
  if (locationEl) locationEl.textContent = profileData.location || '—';
  if (hometownEl) hometownEl.textContent = profileData.hometown || '—';
  if (dobEl) dobEl.textContent = profileData.dob || '—';

  const privacyNotice = document.getElementById('profilePrivacyNotice');
  const isPrivateProfile = profileData.private || profileData.isPrivate || profileData.privateProfile;
  if (privacyNotice) {
    privacyNotice.style.display = !isOwnProfile && isPrivateProfile ? 'block' : 'none';
  }

  if (editBtn) editBtn.style.display = isOwnProfile ? 'inline-flex' : 'none';
  if (avatarEdit) avatarEdit.style.display = isOwnProfile ? 'inline-flex' : 'none';
  if (chatBtn) {
    chatBtn.style.display = isOwnProfile ? 'none' : 'inline-flex';
    if (!isOwnProfile) {
      chatBtn.onclick = () => {
        if (typeof window.openChatWithUser === 'function') {
          window.openChatWithUser(profileData.username, profileData.uid);
        }
      };
    }
  }
}

function renderPosts(posts) {
  const list = document.getElementById('posts-list');
  const empty = document.getElementById('no-posts-message');
  if (!list) return;
  if (!posts || posts.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = posts.map(createPostCard).join('');
}

function renderFriendsPreview(friends) {
  const widget = document.getElementById('friends-widget-list');
  const widgetEmpty = document.getElementById('friends-widget-empty');
  if (!widget) return;
  if (!friends || friends.length === 0) {
    widget.innerHTML = '';
    if (widgetEmpty) widgetEmpty.style.display = 'block';
    return;
  }
  if (widgetEmpty) widgetEmpty.style.display = 'none';
  widget.innerHTML = friends.slice(0, 6).map((friend) => `
    <div class="friend-preview-card" onclick="location.href='profil.html?id=${encodeURIComponent(friend.username)}'" style="cursor:pointer;">
      <img src="${escapeHTML(resolveAvatarUrl(friend.avatarUrl || friend.avatar || friend.photoURL || friend.avatarSeed || DEFAULT_AVATAR_URL))}" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';" class="friend-preview-avatar" alt="${escapeHTML(friend.displayName || friend.username)}">
      <div class="friend-preview-name">${escapeHTML(friend.displayName || friend.username)}</div>
      <div class="friend-preview-username">@${escapeHTML(friend.username)}</div>
    </div>
  `).join('');
}

function renderFriendsList(friends) {
  const list = document.getElementById('friends-list');
  const empty = document.getElementById('no-friends-message');
  if (!list) return;
  if (!friends || friends.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = friends.map((friend) => `
    <div class="friend-card" style="padding:18px; text-align:center;">
      <img src="${escapeHTML(resolveAvatarUrl(friend.avatarUrl || friend.avatar || friend.photoURL || friend.avatarSeed || DEFAULT_AVATAR_URL))}" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';" class="friend-preview-avatar" alt="${escapeHTML(friend.displayName || friend.username)}" style="margin-bottom:10px;">
      <div style="font-weight:700;">${escapeHTML(friend.displayName || friend.username)}</div>
      <div style="color:var(--text-muted); font-size:0.88rem;">@${escapeHTML(friend.username)}</div>
    </div>
  `).join('');
}

async function renderLikes(username) {
  const likes = await loadLikes(username);
  const list = document.getElementById('likes-list');
  const empty = document.getElementById('no-likes-message');
  if (!list) return;
  if (!likes || likes.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = likes.map(createPostCard).join('');
}

async function renderSaves(username) {
  const saves = await loadSaves(username);
  const list = document.getElementById('saves-list');
  const empty = document.getElementById('no-saves-message');
  if (!list) return;
  if (!saves || saves.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = saves.map(createPostCard).join('');
}

function renderNotifications(notifications) {
  const list = document.getElementById('notifs-list');
  const empty = document.getElementById('no-notifs-message');
  if (!list) return;
  if (!notifications || notifications.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = notifications.map((note) => `
    <div class="content-card" style="padding:14px; margin-bottom:10px;">
      <div style="font-size:0.95rem; color:var(--text-main);">${escapeHTML(note.title || note.message || 'Bildirim')}</div>
      <div style="color:var(--text-muted); font-size:0.88rem; margin-top:6px;">${escapeHTML(note.time || '')}</div>
    </div>
  `).join('');
}

async function loadAndRenderTab(tabKey, profileData, isOwnProfile) {
  if (tabKey === 'posts') {
    const posts = await loadPosts(profileData.username);
    renderPosts(posts);
  }
  if (tabKey === 'friends') {
    const friends = await loadFriendProfiles(profileData);
    renderFriendsList(friends);
    renderFriendsPreview(friends);
  }
  if (tabKey === 'likes' && isOwnProfile) {
    await renderLikes(profileData.username);
  }
  if (tabKey === 'saves' && isOwnProfile) {
    await renderSaves(profileData.username);
  }
  if (tabKey === 'notifs' && isOwnProfile) {
    renderNotifications([]);
  }
}

function selectInitialTab(isOwnProfile) {
  const urlHash = window.location.hash.replace('#', '');
  if (!urlHash) return 'posts';
  if (!isOwnProfile && VISITOR_HIDDEN_TABS.includes(urlHash)) return 'posts';
  return Object.keys(TAB_SECTION_IDS).includes(urlHash) ? urlHash : 'posts';
}

async function initProfilePage() {
  try {
    await waitForAppReady();
  } catch (error) {
    console.warn('Profil sayfası için app hazır değil:', error);
  }

  await waitForIncludes();

  const profileUsername = getQueryUsername();
  const isOwnProfile = !profileUsername || (window.user && profileUsername === window.user.username);
  const targetUsername = profileUsername || window.user?.username;
  if (!targetUsername) {
    showMessage('posts-list', 'Profil için kullanıcı adı bulunamadı.');
    return;
  }

  const profileData = await loadProfileData(targetUsername);
  if (!profileData) {
    showMessage('posts-list', `"${targetUsername}" adlı kullanıcı bulunamadı.`);
    return;
  }

  renderProfileHeader(profileData, isOwnProfile);
  updateTabVisibility(isOwnProfile);

  const initialTab = selectInitialTab(isOwnProfile);
  setActiveTab(initialTab, true);
  await loadAndRenderTab(initialTab, profileData, isOwnProfile);

  const tabButtons = document.querySelectorAll('.profile-tab');
  tabButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const tabKey = button.dataset.tab;
      setActiveTab(tabKey);
      await loadAndRenderTab(tabKey, profileData, isOwnProfile);
    });
  });

  window.addEventListener('hashchange', async () => {
    const tabKey = selectInitialTab(isOwnProfile);
    setActiveTab(tabKey);
    await loadAndRenderTab(tabKey, profileData, isOwnProfile);
  });
}

document.addEventListener('DOMContentLoaded', initProfilePage);

window.openProfileTab = setActiveTab;
