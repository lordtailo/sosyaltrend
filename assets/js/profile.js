import './app.js';

const VISITOR_HIDDEN_TABS = ['likes', 'saves', 'notifs'];
const TAB_SECTION_IDS = {
  posts: 'my-posts-tab',
  stories: 'my-stories-tab',
  friends: 'my-friends-tab',
  likes: 'my-likes-tab',
  saves: 'my-saves-tab',
  notifs: 'my-notifs-tab'
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

let activeProfileContext = null;

function stripYoutubeLinks(text) {
  if (!text || typeof text !== 'string') return '';
  const stripped = text.replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:[^\s]*)?|youtu\.be\/[A-Za-z0-9_-]{11}(?:[^\s]*)?|youtube\.com\/embed\/[A-Za-z0-9_-]{11}(?:[^\s]*)?)/gi, '');
  return stripped.replace(/\s{2,}/g, ' ').trim();
}

function buildProfilePostActions(post) {
  const postId = String(post?.id || '').replace(/'/g, "\\'");
  const goToUrl = `index.html#post-${encodeURIComponent(post?.id || '')}`;
  const commentCount = Array.isArray(post?.comments) ? post.comments.length : 0;
  return `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
      <button type="button" class="tool-btn icon-count" onclick="window.openProfilePostComment('${postId}'); return false;" style="gap:3px; min-width:auto;">
        <i class="fa-regular fa-comment"></i><span>(${commentCount})</span>
      </button>
      <button type="button" onclick="window.location.href='${goToUrl}'; return false;" style="border:1px solid var(--border); border-radius:999px; padding:8px 12px; background:rgba(255,255,255,0.72); color:var(--text-main); font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> Gönderiye Git
      </button>
    </div>
  `;
}

function buildProfileCommentSection(post) {
  const postId = String(post?.id || '');
  const comments = Array.isArray(post?.comments) ? post.comments : [];
  const commentItems = comments.map((comment) => {
    const avatar = resolveAvatarUrl(comment.avatarUrl || comment.avatarSeed || DEFAULT_AVATAR_URL);
    const name = escapeHTML(comment.displayName || comment.username || 'Kullanıcı');
    const text = escapeHTML(comment.text || '');
    const time = comment.time ? new Date(comment.time).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'az önce';
    return `
      <div style="padding:10px 0; border-top:1px solid var(--border);">
        <div style="display:flex; gap:8px; align-items:flex-start;">
          <img src="${escapeHTML(avatar)}" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';" style="width:30px; height:30px; border-radius:50%; object-fit:cover; flex-shrink:0;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; color:var(--text-main); font-size:0.9rem;">${name}</div>
            <div style="font-size:0.74rem; color:var(--text-muted); margin-top:2px;">${escapeHTML(time)}</div>
            <div style="margin-top:6px; color:var(--text-main); font-size:0.92rem; white-space:pre-wrap;">${text}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div id="comments-${postId}" class="comment-area" style="display:none; margin-top:10px;">
      <div id="list-${postId}" style="display:grid; gap:4px;">
        ${comments.length ? commentItems : '<div style="padding:8px 0; color:var(--text-muted); font-size:0.9rem;">Henüz yorum yok.</div>'}
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
        <div id="reply-info-${postId}" class="comment-reply-info"></div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="input-${postId}" aria-label="Yorum girin" data-default-placeholder="Yorum yaz..." placeholder="Yorum yaz..." oninput="window.updateCommentCount && window.updateCommentCount('${postId}')" onkeydown="if(event.key==='Enter'){ window.addComment('${postId}'); }" maxlength="200" style="flex:1; padding:8px 12px; border-radius:10px; border:1px solid var(--border); outline:none; background: var(--input-bg); color: var(--text-main);">
          <button type="button" onclick="window.addComment('${postId}');" style="background:var(--primary); color:white; border:none; padding:0 15px; border-radius:10px; cursor:pointer;">Gönder</button>
        </div>
        <div id="charcount-${postId}" style="font-size:0.78rem; color:var(--text-muted);">0/500</div>
      </div>
    </div>
  `;
}

window.openProfilePostComment = function(postId) {
  if (!postId) return;
  const area = document.getElementById(`comments-${postId}`);
  if (area) {
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    if (area.style.display === 'block') {
      const input = document.getElementById(`input-${postId}`);
      if (input) {
        setTimeout(() => input.focus(), 80);
      }
    }
  }
};

function formatTimestamp(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : (value.seconds ? new Date(value.seconds * 1000) : new Date(value));
  return date.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function createPostCard(post, includeActions = false) {
  const content = escapeHTML(stripYoutubeLinks(post.content || ''));
  const linkedContent = content.replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link">$1</span>');
  const imageHtml = post.image ? `<div class="post-image-wrapper" style="margin:12px 0; border-radius:12px; overflow:hidden; border:1px solid var(--border); background:#f8fafc;"><img src="${escapeHTML(post.image)}" alt="Gönderi görseli" style="width:100%; height:auto; display:block;"></div>` : '';
  const avatarUrl = escapeHTML(resolveAvatarUrl(post.avatarUrl || post.avatar || post.avatarSeed || post.photoURL || DEFAULT_AVATAR_URL));
  const authorName = escapeHTML(post.name || post.displayName || post.username || 'Anonim');
  const authorUsername = escapeHTML(post.username || '');
  const actionsHtml = includeActions ? buildProfilePostActions(post) : '';
  const commentsHtml = includeActions ? buildProfileCommentSection(post) : '';
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
      ${actionsHtml}
      ${commentsHtml}
    </div>
  `;
}

function setActiveTab(tabKey, disableHashUpdate = false) {
  const tabs = document.querySelectorAll('.profile-tab-btn');
  const sections = document.querySelectorAll('.tab-content');
  tabs.forEach((tab) => {
    const tabValue = tab.dataset.tab || (tab.getAttribute('href') || '').replace('#', '');
    if (tabValue === tabKey || tabValue === TAB_SECTION_IDS[tabKey]) tab.classList.add('active');
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
    const button = document.querySelector(`.profile-tab-btn[data-tab="${tabKey}"]`);
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
  if (!window.db) return null;
  const usersQuery = window.query(window.collection(window.db, 'users'), window.where('username', '==', profileUsername), window.limit(1));
  const usersSnap = await window.getDocs(usersQuery);
  if (usersSnap.empty) return null;
  const userDoc = usersSnap.docs[0];
  return { uid: userDoc.id, ...userDoc.data() };
}

// Fallback: eğer kullanıcı adı ile bulunamadıysa, oturum açmış kullanıcının UID'si ile getir
async function loadProfileDataWithFallback(profileUsername) {
  let profile = await loadProfileData(profileUsername);
  if (!profile && window.user && window.user.uid) {
    try {
      const snap = await window.getDoc(window.doc(window.db, 'users', window.user.uid));
      if (snap && snap.exists()) {
        profile = { uid: snap.id, ...snap.data() };
      }
    } catch (err) {
      console.warn('Fallback profile fetch failed', err);
    }
  }
  return profile;
}

function sortPostsByTimestampDesc(posts) {
  return posts.sort((a, b) => {
    const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : (a.timestamp && a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime());
    const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : (b.timestamp && b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime());
    return tb - ta;
  });
}

function normalizeIdentityValue(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function resolveStoryTimestampValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  return 0;
}

function getStoryTimestamp(story) {
  return resolveStoryTimestampValue(story?.timestamp ?? story?.createdAt ?? story?.created_at ?? story?.created ?? story?.date) || 0;
}

function sortStoriesByTimestampDesc(stories) {
  return [...stories].sort((a, b) => getStoryTimestamp(b) - getStoryTimestamp(a));
}

function getProfileIdentityCandidates(profileData) {
  const candidates = [];
  const addCandidate = (value) => {
    const normalized = normalizeIdentityValue(value);
    if (!normalized) return;
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };

  addCandidate(profileData?.username);
  addCandidate(profileData?.userName);
  addCandidate(profileData?.displayName);
  addCandidate(profileData?.name);
  addCandidate(profileData?.uid);
  addCandidate(profileData?.id);
  addCandidate(window.user?.username);
  addCandidate(window.user?.userName);
  addCandidate(window.user?.displayName);
  addCandidate(window.user?.name);
  addCandidate(window.user?.uid);
  addCandidate(window.user?.id);
  addCandidate(window.auth?.currentUser?.email?.split('@')[0]);
  addCandidate(window.auth?.currentUser?.displayName);
  addCandidate(window.auth?.currentUser?.uid);

  return candidates;
}

function storyMatchesProfile(story, profileData) {
  if (!story) return false;
  const identityCandidates = getProfileIdentityCandidates(profileData);
  if (!identityCandidates.length) return true;

  const storyValues = [];
  const addStoryValue = (value) => {
    const normalized = normalizeIdentityValue(value);
    if (normalized) storyValues.push(normalized);
  };

  addStoryValue(story.authorUid);
  addStoryValue(story.uid);
  addStoryValue(story.username);
  addStoryValue(story.authorUsername);
  addStoryValue(story.userName);
  addStoryValue(story.user);
  addStoryValue(story.displayName);
  addStoryValue(story.authorName);
  addStoryValue(story.name);
  addStoryValue(story.authorEmail);
  addStoryValue(story.email);

  return storyValues.some((value) => identityCandidates.includes(value));
}

function readStoredStoriesFromLocalStorage(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function getLocalProfileStories(profileData) {
  const localSources = [];

  if (Array.isArray(window.__sltStoriesRuntime?.stories)) {
    localSources.push(...window.__sltStoriesRuntime.stories);
  }

  localSources.push(...readStoredStoriesFromLocalStorage('slt_stories'));
  localSources.push(...readStoredStoriesFromLocalStorage('slt_pending_stories'));

  const uniqueStories = [];
  const seenIds = new Set();

  localSources.forEach((story) => {
    if (!story || story.type !== 'story') return;
    const storyId = story.id || `${story.type || 'story'}:${story.timestamp || Date.now()}`;
    if (seenIds.has(storyId)) return;
    seenIds.add(storyId);
    uniqueStories.push(story);
  });

  return uniqueStories.filter((story) => storyMatchesProfile(story, profileData));
}

async function loadPosts(username) {
  try {
    if (!window.db || !window.collection || !window.query || !window.where || !window.getDocs) {
      return [];
    }

    const candidateUsernames = [username, username?.replace(/^@+/, '')].filter(Boolean);
    const posts = [];

    for (const candidate of candidateUsernames) {
      const postsQuery = window.query(window.collection(window.db, 'posts'), window.where('username', '==', candidate));
      const postsSnap = await window.getDocs(postsQuery);
      posts.push(...postsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    }

    const authorUsernamePostsQuery = window.query(window.collection(window.db, 'posts'), window.where('authorUsername', '==', username));
    const authorUsernamePostsSnap = await window.getDocs(authorUsernamePostsQuery);
    posts.push(...authorUsernamePostsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));

    const uniquePosts = posts.filter((post, index, all) => index === all.findIndex((item) => item.id === post.id));
    return sortPostsByTimestampDesc(uniquePosts);
  } catch (err) {
    console.error('loadPosts: sorgu hatası', err.message || err);
    return [];
  }
}

async function loadProfileStories(profileData) {
  try {
    const localStories = getLocalProfileStories(profileData);
    const remoteStories = [];

    if (window.db && window.collection && window.getDocs) {
      try {
        const q = window.query ? window.query(window.collection(window.db, 'stories')) : null;
        const snap = q ? await window.getDocs(q) : null;
        if (snap) {
          snap.forEach((docSnap) => {
            const story = { id: docSnap.id, ...docSnap.data() };
            if (storyMatchesProfile(story, profileData)) {
              remoteStories.push(story);
            }
          });
        }
      } catch (err) {
        console.warn('loadProfileStories: Firestore hikaye okuma hatası', err);
      }
    }

    const combinedStories = [...localStories, ...remoteStories];
    const uniqueStories = combinedStories.filter((story, index, all) => index === all.findIndex((item) => (item.id || '') === (story.id || '')));
    return sortStoriesByTimestampDesc(uniqueStories.map((story) => ({
      ...story,
      type: story.type || 'story',
      timestamp: getStoryTimestamp(story) || story.timestamp || story.createdAt || story.created || story.date || 0,
      title: story.title || story.label || story.content || story.body || story.text || '',
      content: story.content || story.body || story.text || '',
      label: story.label || story.title || story.content || story.body || story.text || ''
    })));
  } catch (err) {
    console.error('loadProfileStories: sorgu hatası', err.message || err);
    return [];
  }
}

async function loadLikes(username) {
  try {
    const likesQuery = window.query(window.collection(window.db, 'posts'), window.where('likes', 'array-contains', username));
    const likesSnap = await window.getDocs(likesQuery);
    const posts = likesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    return sortPostsByTimestampDesc(posts);
  } catch (err) {
    console.error('loadLikes: sorgu hatası', err.message || err);
    return [];
  }
}

async function loadSaves(username) {
  try {
    const savesQuery = window.query(window.collection(window.db, 'posts'), window.where('savedBy', 'array-contains', username));
    const savesSnap = await window.getDocs(savesQuery);
    const posts = savesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    return sortPostsByTimestampDesc(posts);
  } catch (err) {
    console.error('loadSaves: sorgu hatası', err.message || err);
    return [];
  }
}

async function loadFriendProfiles(profileData) {
  let friendUids = Array.isArray(profileData.friends) ? profileData.friends.slice(0, 12) : [];
  // Tekrarlayan UID'leri kaldır
  friendUids = Array.from(new Set(friendUids));
  if (!friendUids.length) return [];
  const friends = [];
  await Promise.all(friendUids.map(async (uid) => {
    try {
      const snap = await window.getDoc(window.doc(window.db, 'users', uid));
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
  const occupationEl = document.getElementById('profileOccupation');
  const websiteEl = document.getElementById('profileWebsite');
  const bioEl = document.getElementById('profileBio');
  const interestsEl = document.getElementById('profileInterests');
  if (occupationEl) occupationEl.textContent = profileData.occupation || '—';
  function setSocialAnchor(linkEl, iconHtml, url, title) {
    if (!linkEl) return;
    linkEl.innerHTML = iconHtml;
    linkEl.title = title;
    if (url) {
      linkEl.href = escapeHTML(url);
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
      linkEl.classList.remove('disabled');
      linkEl.removeAttribute('aria-disabled');
      linkEl.removeAttribute('tabindex');
    } else {
      linkEl.removeAttribute('href');
      linkEl.removeAttribute('target');
      linkEl.removeAttribute('rel');
      linkEl.classList.add('disabled');
      linkEl.setAttribute('aria-disabled', 'true');
      linkEl.setAttribute('tabindex', '-1');
    }
  }

  if (websiteEl) {
    setSocialAnchor(websiteEl, '<i class="fa-solid fa-earth-americas"></i>', profileData.website || '', 'Web Sitesi');
  }

  const facebookEl = document.getElementById('profileFacebook');
  if (facebookEl) {
    setSocialAnchor(facebookEl, '<i class="fa-brands fa-facebook-f"></i>', profileData.facebook || '', 'Facebook');
  }

  const twitterEl = document.getElementById('profileTwitter');
  if (twitterEl) {
    setSocialAnchor(twitterEl, '<i class="fa-brands fa-twitter"></i>', profileData.twitter || '', 'Twitter');
  }

  const youtubeEl = document.getElementById('profileYoutube');
  if (youtubeEl) {
    setSocialAnchor(youtubeEl, '<i class="fa-brands fa-youtube"></i>', profileData.youtube || '', 'YouTube');
  }

  if (bioEl) bioEl.textContent = profileData.bio || '—';
  if (interestsEl) interestsEl.textContent = profileData.interests || '—';

  const privacyNotice = document.getElementById('profilePrivacyNotice');
  const personalInfoCard = document.getElementById('profilePersonalInfoCard');
  const isPrivateProfile = [profileData.private, profileData.isPrivate, profileData.privateProfile].some((value) => value === true || value === 'true');
  if (privacyNotice) {
    privacyNotice.style.display = !isOwnProfile && isPrivateProfile ? 'block' : 'none';
  }
  if (personalInfoCard) {
    personalInfoCard.style.display = 'block';
  }

  if (editBtn) editBtn.style.display = isOwnProfile ? 'inline-flex' : 'none';
  if (avatarEdit) avatarEdit.style.display = isOwnProfile ? 'inline-flex' : 'none';
  if (chatBtn) {
    chatBtn.style.display = isOwnProfile ? 'none' : 'inline-flex';
    if (!isOwnProfile) {
      chatBtn.onclick = () => {
        if (typeof window.openChatWithUser === 'function') {
          const targetUserId = profileData.uid || profileData.userId || profileData.id || profileData.username;
          const targetDisplayName = profileData.displayName || profileData.name || profileData.username || 'Kullanıcı';
          window.openChatWithUser(targetUserId, targetDisplayName);
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

function renderStoriesSection(stories, profileData) {
  const list = document.getElementById('my-stories-list');
  const empty = document.getElementById('no-stories-msg');
  if (!list) return;

  const safeStories = Array.isArray(stories) ? stories : [];
  if (!safeStories.length) {
    list.innerHTML = `
      <div style="padding:18px; border:1px dashed var(--border); border-radius:16px; background:rgba(255,255,255,0.55); color:var(--text-muted); text-align:center;">
        Bu profilde henüz paylaşılmış hikaye yok.
      </div>
    `;
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  const storyCards = safeStories.map((story) => {
    const storyId = String(story.id || '').replace(/'/g, "\\'");
    const title = escapeHTML(story.title || story.label || story.content || 'Hikaye');
    const content = escapeHTML(stripYoutubeLinks(story.content || story.body || story.text || '')) || 'Hikaye içeriği eklenmedi.';
    const coverHtml = story.img
      ? `<img src="${escapeHTML(story.img)}" alt="${title}" style="width:100%; height:100%; object-fit:cover;">`
      : `<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; padding:10px; box-sizing:border-box; background:linear-gradient(135deg, rgba(99,102,241,0.95), rgba(139,92,246,0.92)); color:#fff; text-align:center; font-weight:700; font-size:0.84rem; line-height:1.3;">${title}</div>`;
    const likeCount = Number(story.likesCount || 0);
    const commentCount = Array.isArray(story.comments) ? story.comments.length : 0;
    const timestamp = formatTimestamp(story.timestamp);
    return `
      <div class="glass-card" data-story-id="${storyId}" style="padding:14px; display:flex; gap:14px; align-items:center; margin-bottom:12px; cursor:pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;">
        <div style="width:92px; height:92px; border-radius:14px; overflow:hidden; flex-shrink:0; background:rgba(99,102,241,0.08);">
          ${coverHtml}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:800; color:var(--text-main); margin-bottom:6px;">${title}</div>
          <div style="color:var(--text-muted); font-size:0.92rem; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${content}</div>
          <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px; color:var(--text-muted); font-size:0.82rem;">
            <span><i class="fa-solid fa-heart" style="margin-right:4px;"></i>${likeCount}</span>
            <span><i class="fa-regular fa-comment" style="margin-right:4px;"></i>${commentCount}</span>
            <span><i class="fa-regular fa-clock" style="margin-right:4px;"></i>${timestamp}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = `
    <div style="margin-bottom:12px; color:var(--text-muted); font-size:0.94rem; font-weight:700;">Bu profilde paylaştığınız hikayeler</div>
    ${storyCards}
  `;

  list.querySelectorAll('[data-story-id]').forEach((card) => {
    const storyId = card.getAttribute('data-story-id');
    card.addEventListener('click', () => {
      if (typeof window.openStoryViewerForId === 'function') {
        window.openStoryViewerForId(storyId);
      }
    });
  });
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
      <div class="friend-preview-card" onclick="location.href='profil.html?id=${encodeURIComponent((String(friend.username || friend.userName || '').trim().replace(/^@+/, '') || 'kullanici'))}'" style="cursor:pointer;">
        <img src="${escapeHTML(resolveAvatarUrl(friend.avatarUrl || friend.avatar || friend.photoURL || friend.avatarSeed || DEFAULT_AVATAR_URL))}" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';" class="friend-preview-avatar" alt="${escapeHTML(String(friend.displayName || '').trim() || String(friend.username || friend.userName || '').trim().replace(/^@+/, '') || 'Kullanıcı')}">
        <div class="friend-preview-name">${escapeHTML(String(friend.displayName || '').trim() || String(friend.username || friend.userName || '').trim().replace(/^@+/, '') || 'Kullanıcı')}</div>
        <div class="friend-preview-username">@${escapeHTML(String(friend.username || friend.userName || '').trim().replace(/^@+/, '') || 'kullanici')}</div>
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
      <img src="${escapeHTML(resolveAvatarUrl(friend.avatarUrl || friend.avatar || friend.photoURL || friend.avatarSeed || DEFAULT_AVATAR_URL))}" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';" class="friend-preview-avatar friend-card-avatar" alt="${escapeHTML(String(friend.displayName || '').trim() || String(friend.username || friend.userName || '').trim().replace(/^@+/, '') || 'Kullanıcı')}" style="margin-bottom:10px;">
      <div class="friend-card-name" style="font-weight:700;">${escapeHTML(String(friend.displayName || '').trim() || String(friend.username || friend.userName || '').trim().replace(/^@+/, '') || 'Kullanıcı')}</div>
      <div class="friend-card-username" style="color:var(--text-muted); font-size:0.88rem;">@${escapeHTML(String(friend.username || friend.userName || '').trim().replace(/^@+/, '') || 'kullanici')}</div>
    </div>
  `).join('');
}

async function renderLikes(username) {
  const likes = await loadLikes(username);
  const list = document.getElementById('my-liked-list') || document.getElementById('likes-list');
  const empty = document.getElementById('no-likes-msg') || document.getElementById('no-likes-message');
  if (!list) return;
  if (!likes || likes.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = likes.map((post) => createPostCard(post, true)).join('');
}

async function renderSaves(username) {
  const saves = await loadSaves(username);
  const list = document.getElementById('bookmark-items') || document.getElementById('saves-list');
  const empty = document.getElementById('no-saves-msg') || document.getElementById('no-saves-message');
  if (!list) return;
  if (!saves || saves.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = saves.map((post) => createPostCard(post, true)).join('');
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
  activeProfileContext = { profileData, isOwnProfile, tabKey };

  if (tabKey === 'posts') {
    const posts = await loadPosts(profileData.username);
    renderPosts(posts);
  }
  if (tabKey === 'stories') {
    const stories = await loadProfileStories(profileData);
    renderStoriesSection(stories, profileData);
    if (typeof window.refreshProfileStoriesList === 'function') {
      window.refreshProfileStoriesList(profileData);
    }
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

window.refreshProfileActiveTab = async function() {
  if (!activeProfileContext) return;
  const { profileData, isOwnProfile, tabKey } = activeProfileContext;
  await loadAndRenderTab(tabKey, profileData, isOwnProfile);
};

window.refreshProfileStoriesList = async function(profileData) {
  try {
    const stories = await loadProfileStories(profileData || activeProfileContext?.profileData);
    renderStoriesSection(stories, profileData || activeProfileContext?.profileData);
  } catch (err) {
    console.error('refreshProfileStoriesList hata:', err);
  }
};

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

  const profileData = await loadProfileDataWithFallback(targetUsername);
  if (!profileData) {
    showMessage('posts-list', `"${targetUsername}" adlı kullanıcı bulunamadı.`);
    return;
  }

  const isPrivateProfile = [profileData.private, profileData.isPrivate, profileData.privateProfile].some((v) => v === true || v === 'true');
  let isFriend = false;
  try {
    const friendsList = Array.isArray(profileData.friends) ? profileData.friends : [];
    if (window.user && window.user.uid) {
      isFriend = friendsList.includes(window.user.uid) || friendsList.includes(window.user.username) || friendsList.includes(window.user?.email);
    }
  } catch (e) {
    console.warn('Friend check hata:', e);
  }

  renderProfileHeader(profileData, isOwnProfile);
  updateTabVisibility(isOwnProfile || isFriend);

  const initialTab = selectInitialTab(isOwnProfile);
  setActiveTab(initialTab, true);
  await loadAndRenderTab(initialTab, profileData, isOwnProfile);
  if (initialTab === 'stories') {
    await window.refreshProfileStoriesList?.(profileData);
  }

  const tabButtons = document.querySelectorAll('.profile-tab-btn');
  tabButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      const tabKey = button.dataset.tab || (button.getAttribute('href') || '').replace('#', '');
      const normalizedTabKey = tabKey === 'posts' ? 'posts' : (tabKey === 'stories' ? 'stories' : tabKey);
      setActiveTab(normalizedTabKey);
      await loadAndRenderTab(normalizedTabKey, profileData, isOwnProfile);
      if (normalizedTabKey === 'stories') {
        await window.refreshProfileStoriesList?.(profileData);
      }
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    });
  });

  window.addEventListener('hashchange', async () => {
    const tabKey = selectInitialTab(isOwnProfile);
    setActiveTab(tabKey);
    await loadAndRenderTab(tabKey, profileData, isOwnProfile);
  });

  try {
    const tabsCard = document.querySelector('.profile-tabs-card');
    if (tabsCard) tabsCard.style.display = 'block';
  } catch (e) {
    console.warn('Gizli profil DOM güncelleme hatası:', e);
  }
}

document.addEventListener('DOMContentLoaded', initProfilePage);

window.openProfileTab = setActiveTab;
