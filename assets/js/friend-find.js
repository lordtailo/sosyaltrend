import './app.js';
import {
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  startAfter,
  documentId,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function avatarUrlFor(userData) {
  return userData.avatarUrl || userData.photoURL || 'assets/img/strendsaydamv2.png';
}

function splitInterests(value) {
  return String(value || '')
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 1);
}

function sortUsers(list) {
  return [...list].sort((a, b) => {
    const aKey = (a.displayName || a.username || a.email || '').toLowerCase();
    const bKey = (b.displayName || b.username || b.email || '').toLowerCase();
    return aKey.localeCompare(bKey, 'tr');
  });
}

function normalizeForCompare(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

function collectUniqueFieldValues(users, fieldName) {
  const values = users
    .map((user) => String(user?.[fieldName] || '').trim())
    .filter(Boolean);

  const unique = [];
  const seen = new Set();

  values.forEach((value) => {
    const key = normalizeForCompare(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(value);
  });

  return unique.sort((a, b) => a.localeCompare(b, 'tr'));
}

function setSelectOptions(selectEl, values, selectedValue) {
  if (!selectEl) return;

  const list = [...values];
  const selected = String(selectedValue || '').trim();
  if (selected && !list.includes(selected)) {
    list.unshift(selected);
  }

  const optionsHtml = ['<option value="">Tümü</option>']
    .concat(list.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`))
    .join('');

  selectEl.innerHTML = optionsHtml;
  selectEl.value = selected;
}

function matchesAdvancedFilters(user, advancedFilters) {
  if (!advancedFilters) return true;

  const locationFilter = normalizeForCompare(advancedFilters.location);
  const hometownFilter = normalizeForCompare(advancedFilters.hometown);
  const occupationFilter = normalizeForCompare(advancedFilters.occupation);
  const interestsFilter = normalizeForCompare(advancedFilters.interests);

  const userLocation = normalizeForCompare(user.location);
  const userHometown = normalizeForCompare(user.hometown);
  const userOccupation = normalizeForCompare(user.occupation);
  const userInterests = normalizeForCompare(user.interests);

  if (locationFilter && userLocation !== locationFilter) return false;
  if (hometownFilter && userHometown !== hometownFilter) return false;
  if (occupationFilter && userOccupation !== occupationFilter) return false;
  if (interestsFilter && !userInterests.includes(interestsFilter)) return false;

  return true;
}

async function waitForAppReady() {
  const startedAt = Date.now();
  while ((!window.db || !window.auth) && Date.now() - startedAt < 12000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function showLoginRequiredState(listEl, statusEl, countEl) {
  statusEl.innerHTML = '<i class="fa-solid fa-lock"></i> Arkadaş bulmak için önce giriş yapmalısın.';
  listEl.innerHTML = '<div class="friend-empty">Hesabına giriş yaptıktan sonra kullanıcılar listelenecek.</div>';
  countEl.textContent = '0 kişi';
}

async function getCurrentUserData() {
  if (!window.auth?.currentUser || !window.db) return null;
  const ref = doc(window.db, 'users', window.auth.currentUser.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function requestStateFor(currentUid, currentData, candidate) {
  const friends = Array.isArray(currentData?.friends) ? currentData.friends : [];
  if (friends.includes(candidate.uid)) return 'friend';

  const requests = Array.isArray(candidate.friendRequests) ? candidate.friendRequests : [];
  const alreadySent = requests.some((req) => req && req.fromUid === currentUid);
  return alreadySent ? 'sent' : 'none';
}

function renderList(
  listEl,
  statusEl,
  countEl,
  summaryEl,
  loadMoreWrapEl,
  loadMoreBtnEl,
  loadMetaEl,
  users,
  currentUid,
  currentData,
  term,
  activeFilter,
  advancedFilters,
  hasMoreFromServer
) {
  const normalized = normalizeForCompare(term);
  const textFiltered = users.filter((u) => {
    const haystack = normalizeForCompare(`${u.displayName || ''} ${u.username || ''} ${u.email || ''} ${u.location || ''} ${u.hometown || ''} ${u.occupation || ''} ${u.interests || ''}`);
    return haystack.includes(normalized);
  });

  const withState = textFiltered.map((u) => ({
    user: u,
    state: requestStateFor(currentUid, currentData, u)
  }));

  const filtered = activeFilter === 'all'
    ? withState
    : withState.filter((item) => item.state === activeFilter);

  const advancedFiltered = filtered.filter((item) => matchesAdvancedFilters(item.user, advancedFilters));
  const filterLabels = {
    all: 'Tüm Sonuçlar',
    none: 'Yeni Kişiler',
    sent: 'Bekleyenler',
    friend: 'Arkadaşlar'
  };
  const activeFilterLabel = filterLabels[activeFilter] || 'Tüm Sonuçlar';

  countEl.textContent = `${advancedFiltered.length} kişi`;
  if (summaryEl) {
    summaryEl.innerHTML = `<span class="friend-find-summary-kicker"><i class="fa-solid fa-compass"></i> ${activeFilterLabel}</span><strong>${advancedFiltered.length} sonuç</strong><span>${users.length} kişi yüklendi</span>`;
  }

  if (loadMoreWrapEl && loadMoreBtnEl) {
    loadMoreWrapEl.style.display = hasMoreFromServer ? 'flex' : 'none';
    loadMoreBtnEl.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Daha fazla yükle';
  }

  if (loadMetaEl) {
    loadMetaEl.textContent = hasMoreFromServer
      ? 'Daha fazla kullanıcı görmek için yüklemeye devam et.'
      : '';
  }

  if (!advancedFiltered.length) {
    statusEl.style.display = 'flex';
    listEl.innerHTML = '<div class="friend-empty">Eşleşen kişi bulunamadı.</div>';
    statusEl.innerHTML = '<i class="fa-regular fa-face-frown"></i> Sonuç bulunamadı.';
    return;
  }

  statusEl.innerHTML = '';
  statusEl.style.display = 'none';

  listEl.innerHTML = advancedFiltered.map((item) => {
    const u = item.user;
    const state = item.state;
    let buttonHtml = '';

    if (state === 'friend') {
      buttonHtml = '<button type="button" class="friend-btn success" disabled><i class="fa-solid fa-check"></i> Arkadaş</button>';
    } else if (state === 'sent') {
      buttonHtml = `<button type="button" class="friend-btn warning" data-action="cancel" data-uid="${u.uid}" data-username="${escapeHtml(u.username || '')}"><i class="fa-solid fa-clock-rotate-left"></i> İsteği İptal Et</button>`;
    } else {
      buttonHtml = `<button type="button" class="friend-btn primary" data-action="add" data-uid="${u.uid}" data-username="${escapeHtml(u.username || '')}"><i class="fa-solid fa-user-plus"></i> Arkadaş Ekle</button>`;
    }

    const safeName = escapeHtml(u.displayName || u.username || 'Kullanıcı');
    const safeUsername = escapeHtml(u.username || 'kullanici');
    const locationText = escapeHtml(u.location || 'Belirtilmedi');
    const hometownText = escapeHtml(u.hometown || 'Belirtilmedi');
    const occupationText = escapeHtml(u.occupation || 'Belirtilmedi');
    const placeText = locationText === hometownText ? locationText : `${locationText} • ${hometownText}`;
    const interestItems = splitInterests(u.interests);
    const interestMarkup = interestItems.length
      ? interestItems.map((interest) => `<span class="friend-card-chip"><i class="fa-solid fa-hashtag"></i> ${escapeHtml(interest)}</span>`).join('')
      : '';

    return `
      <div class="friend-card">
        <div class="friend-card-top">
          <div class="friend-card-main">
            <img src="${avatarUrlFor(u)}" alt="${safeName}" class="friend-card-avatar" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';" />
            <div class="friend-card-identity">
              <div class="friend-card-name">${safeName}</div>
              <div class="friend-card-username">@${safeUsername}</div>
              <div class="friend-card-meta-line">
                <span><i class="fa-solid fa-location-dot"></i> ${placeText}</span>
                <span><i class="fa-solid fa-briefcase"></i> ${occupationText}</span>
              </div>
              ${interestMarkup ? `<div class="friend-card-chip-row">${interestMarkup}</div>` : ''}
            </div>
          </div>
          <div class="friend-card-actions">
            <a href="profil.html?id=${encodeURIComponent(u.username || '')}" class="friend-btn secondary"><i class="fa-solid fa-user"></i> Profili Gör</a>
            ${buttonHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function initFriendFindPage() {
  const listEl = document.getElementById('friendFindList');
  const statusEl = document.getElementById('friendFindStatus');
  const summaryEl = document.getElementById('friendFindSummary');
  const loadMoreWrapEl = document.getElementById('friendLoadMoreWrap');
  const loadMoreBtnEl = document.getElementById('friendLoadMoreBtn');
  const loadMetaEl = document.getElementById('friendLoadMeta');
  const inputEl = document.getElementById('friendFindInput');
  const locationFilterEl = document.getElementById('friendFilterLocation');
  const hometownFilterEl = document.getElementById('friendFilterHometown');
  const occupationFilterEl = document.getElementById('friendFilterOccupation');
  const interestsFilterEl = document.getElementById('friendFilterInterests');
  const clearFiltersEl = document.getElementById('friendFilterClear');
  const refreshEl = document.getElementById('friendFindRefresh');
  const countEl = document.getElementById('friendFindCount');
  const filterButtons = Array.from(document.querySelectorAll('.friend-filter-btn'));

  if (
    !listEl ||
    !statusEl ||
    !inputEl ||
    !locationFilterEl ||
    !hometownFilterEl ||
    !occupationFilterEl ||
    !interestsFilterEl ||
    !clearFiltersEl ||
    !refreshEl ||
    !countEl ||
    !summaryEl ||
    !loadMoreWrapEl ||
    !loadMoreBtnEl ||
    !loadMetaEl
  ) {
    return;
  }

  await waitForAppReady();

  if (!window.auth || !window.db) {
    showLoginRequiredState(listEl, statusEl, countEl);
    return;
  }

  let users = [];
  let currentData = await getCurrentUserData();
  const pageSize = 12;
  let activeFilter = 'all';
  const advancedFilters = {
    location: '',
    hometown: '',
    occupation: '',
    interests: ''
  };
  let lastVisibleDoc = null;
  let hasMoreFromServer = true;

  const renderCurrentState = () => {
    if (!window.auth?.currentUser) return;
    const currentUid = window.auth.currentUser.uid;
    renderList(
      listEl,
      statusEl,
      countEl,
      summaryEl,
      loadMoreWrapEl,
      loadMoreBtnEl,
      loadMetaEl,
      users,
      currentUid,
      currentData,
      inputEl.value,
      activeFilter,
      advancedFilters,
      hasMoreFromServer
    );
  };

  const updateAdvancedFilterOptions = () => {
    const locations = collectUniqueFieldValues(users, 'location');
    const hometowns = collectUniqueFieldValues(users, 'hometown');
    const occupations = collectUniqueFieldValues(users, 'occupation');

    setSelectOptions(locationFilterEl, locations, advancedFilters.location);
    setSelectOptions(hometownFilterEl, hometowns, advancedFilters.hometown);
    setSelectOptions(occupationFilterEl, occupations, advancedFilters.occupation);
  };

  const mergeUsers = (incoming, currentUid) => {
    const existing = new Set(users.map((u) => u.uid));
    incoming.forEach((u) => {
      if (!u || !u.uid || u.uid === currentUid || existing.has(u.uid)) return;
      users.push(u);
      existing.add(u.uid);
    });
    users = sortUsers(users);
  };

  const loadUsersPage = async (reset = false) => {
    if (!window.auth?.currentUser) {
      showLoginRequiredState(listEl, statusEl, countEl);
      return;
    }

    if (reset) {
      users = [];
      lastVisibleDoc = null;
      hasMoreFromServer = true;
    }

    if (!hasMoreFromServer && !reset) {
      updateAdvancedFilterOptions();
      renderCurrentState();
      return;
    }

    statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Kullanıcı listesi yenileniyor...';

    const constraints = [orderBy(documentId()), limit(pageSize)];
    if (lastVisibleDoc) {
      constraints.unshift(startAfter(lastVisibleDoc));
    }

    const snap = await getDocs(query(collection(window.db, 'users'), ...constraints));
    const currentUid = window.auth.currentUser.uid;

    const mapped = snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }))
      .filter((u) => (u.username || u.displayName || u.email));

    mergeUsers(mapped, currentUid);
    currentData = await getCurrentUserData();

    if (snap.docs.length > 0) {
      lastVisibleDoc = snap.docs[snap.docs.length - 1];
    }

    if (snap.docs.length < pageSize) {
      hasMoreFromServer = false;
    }

    updateAdvancedFilterOptions();
    renderCurrentState();
  };

  // Auth state netleşmeden erken "giriş yap" mesajı göstermemek için ilk tetiklemeyi dinleyiciyle yap.
  onAuthStateChanged(window.auth, async (fbUser) => {
    if (!fbUser) {
      showLoginRequiredState(listEl, statusEl, countEl);
      return;
    }
    await loadUsersPage(true);
  });

  inputEl.addEventListener('input', () => {
    renderCurrentState();
  });

  locationFilterEl.addEventListener('change', () => {
    advancedFilters.location = locationFilterEl.value || '';
    renderCurrentState();
  });

  hometownFilterEl.addEventListener('change', () => {
    advancedFilters.hometown = hometownFilterEl.value || '';
    renderCurrentState();
  });

  occupationFilterEl.addEventListener('change', () => {
    advancedFilters.occupation = occupationFilterEl.value || '';
    renderCurrentState();
  });

  interestsFilterEl.addEventListener('input', () => {
    advancedFilters.interests = interestsFilterEl.value || '';
    renderCurrentState();
  });

  clearFiltersEl.addEventListener('click', () => {
    advancedFilters.location = '';
    advancedFilters.hometown = '';
    advancedFilters.occupation = '';
    advancedFilters.interests = '';
    locationFilterEl.value = '';
    hometownFilterEl.value = '';
    occupationFilterEl.value = '';
    interestsFilterEl.value = '';
    renderCurrentState();
  });

  refreshEl.addEventListener('click', async () => {
    await loadUsersPage(true);
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter || 'all';
      filterButtons.forEach((el) => el.classList.remove('active'));
      btn.classList.add('active');
      renderCurrentState();
    });
  });

  loadMoreBtnEl.addEventListener('click', async () => {
    if (!window.auth?.currentUser) return;
    await loadUsersPage(false);
  });

  listEl.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const targetUid = btn.dataset.uid;
    const targetUsername = btn.dataset.username || '';

    if (!targetUid) return;

    btn.disabled = true;
    const prevHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
      if (action === 'add' && typeof window.sendFriendRequestToUid === 'function') {
        await window.sendFriendRequestToUid(targetUid, targetUsername);
      } else if (action === 'cancel' && typeof window.cancelFriendRequestToUid === 'function') {
        await window.cancelFriendRequestToUid(targetUid, targetUsername);
      }
      await loadUsersPage(true);
    } catch (err) {
      console.error('Friend action failed:', err);
      btn.disabled = false;
      btn.innerHTML = prevHtml;
      statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);"></i> İşlem sırasında bir hata oluştu.';
    }
  });
}

document.addEventListener('DOMContentLoaded', initFriendFindPage);
