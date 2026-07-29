import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBegJHqlfPagx8biFyS_FnE3iXOksgfoAU",
  authDomain: "sosyaltrend-21d21.firebaseapp.com",
  projectId: "sosyaltrend-21d21",
  storageBucket: "sosyaltrend-21d21.firebasestorage.app",
  messagingSenderId: "207734473261",
  appId: "1:207734473261:web:f31b6bf2908c6d88986ea4"
});

const db = getFirestore(app);
const STORAGE_KEY = 'sosyaltrend-added-videos';
const STORAGE_META_KEY = 'sosyaltrend-video-storage-meta';
const INTERACTIONS_STORAGE_KEY = 'sosyaltrend-video-interactions';
const REMOTE_COLLECTIONS = ['videoLibrary', 'videoLibraryBackup', 'videoLibraryArchive'];
const FIRESTORE_TIMEOUT_MS = 2500;
const INDEXED_DB_NAME = 'sosyaltrend-video-db';
const INDEXED_DB_STORE = 'videos';
let allVideos = [];
const state = {
    currentFilter: 'all',
    currentSearch: '',
    selectedVideo: null
};

function getVideoInteractions() {
    try {
        const raw = localStorage.getItem(INTERACTIONS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.warn('Video etkileşim verileri okunamadı:', error);
        return {};
    }
}

function saveVideoInteractions(interactions) {
    try {
        localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(interactions));
    } catch (error) {
        console.warn('Video etkileşim verileri kaydedilemedi:', error);
    }
}

function getStoredVideos() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn('Local video verileri okunamadı:', error);
        return [];
    }
}

function saveStoredVideos(videos) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    } catch (error) {
        console.warn('Local video verileri kaydedilemedi:', error);
    }
}

function openVideoDatabase() {
    return new Promise((resolve) => {
        if (!window.indexedDB) {
            resolve(null);
            return;
        }

        const request = window.indexedDB.open(INDEXED_DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
                db.createObjectStore(INDEXED_DB_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

async function saveVideosToIndexedDb(videos) {
    try {
        const db = await openVideoDatabase();
        if (!db) return;

        const transaction = db.transaction(INDEXED_DB_STORE, 'readwrite');
        const store = transaction.objectStore(INDEXED_DB_STORE);
        store.clear();
        videos.forEach(video => store.put(serializeVideo(video)));
        await new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('IndexedDB yazma hatası'));
        });
    } catch (error) {
        console.warn('IndexedDB depolama hatası:', error);
    }
}

async function getVideosFromIndexedDb() {
    try {
        const db = await openVideoDatabase();
        if (!db) return [];

        const transaction = db.transaction(INDEXED_DB_STORE, 'readonly');
        const store = transaction.objectStore(INDEXED_DB_STORE);
        return await new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => resolve((request.result || []).map(item => normalizeVideoRecord(item)));
            request.onerror = () => resolve([]);
        });
    } catch (error) {
        console.warn('IndexedDB okuma hatası:', error);
        return [];
    }
}

async function getPersistedVideos() {
    const localVideos = getStoredVideos().map(item => normalizeVideoRecord(item));
    const indexedDbVideos = await getVideosFromIndexedDb();
    const combined = [...localVideos, ...indexedDbVideos];
    const deduped = [];
    const seen = new Set();

    combined.forEach(item => {
        const normalized = normalizeVideoRecord(item);
        const key = normalized.id || `${normalized.title}-${normalized.author}-${normalized.vs?.type}-${normalized.vs?.id}`;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(normalized);
        }
    });

    return deduped;
}

function getCategoryLabel(category) {
    const labels = {
        teknoloji: 'Teknoloji',
        haber: 'Haber',
        müzik: 'Müzik',
        eğitim: 'Eğitim',
        eğlence: 'Eğlence',
        genel: 'Genel'
    };
    return labels[category] || 'Genel';
}

function createLocalVideo(url, title, description, category) {
    const vs = detectVideoSource(url);
    if (!vs) return null;

    const item = {
        id: `local-${Date.now()}-${vs.id}`,
        title: title || 'Yeni eklenen video',
        desc: description || 'Bu video kullanıcı tarafından videolar sayfasına eklendi.',
        vs,
        author: 'Sen',
        uid: '',
        avatar: '',
        time: new Date(),
        source: 'local'
    };
    item.category = category || detectVideoCategory(item);
    return item;
}

function getStorageMeta() {
    try {
        const raw = localStorage.getItem(STORAGE_META_KEY);
        return raw ? JSON.parse(raw) : { provider: 'local', safeMode: true };
    } catch (error) {
        console.warn('Depolama meta okunamadı:', error);
        return { provider: 'local', safeMode: true };
    }
}

function saveStorageMeta(meta) {
    try {
        localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
    } catch (error) {
        console.warn('Depolama meta kaydedilemedi:', error);
    }
}

function updateStorageStatus(text) {
    const el = document.getElementById('videoStorageStatus');
    if (el) el.textContent = text;
}

function withTimeout(promise, timeoutMs, fallbackValue) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallbackValue), timeoutMs))
    ]);
}

function sanitizeVideoTitle(title) {
    if (!title) return '';
    let sanitized = String(title).trim();
    sanitized = sanitized.replace(/^#{1,6}\s*/, '').trim();
    sanitized = sanitized.replace(/^['"“”‘]+|['"“”‘]+$/g, '').trim();
    return sanitized;
}

function resolveVideoTitle(title, fallback) {
    const sanitizedTitle = sanitizeVideoTitle(title);
    if (sanitizedTitle && !/^(video|blog videosu|topluluk videosu|depolanan video)$/i.test(sanitizedTitle)) {
        return sanitizedTitle;
    }
    const sanitizedFallback = sanitizeVideoTitle(fallback);
    if (sanitizedFallback && !/^video$/i.test(sanitizedFallback)) {
        return sanitizedFallback;
    }
    return sanitizedTitle || sanitizedFallback || 'Paylaşılan video';
}

function detectVideoCategory(video) {
    const text = `${video.title || ''} ${video.desc || ''} ${video.content || ''}`.toLowerCase();
    if (/teknoloji|teknolojik|cpu|yazılım|software|donanım|hardware|kod|programlama|internet|ai|yapay zeka|robot|gadget|startup|siber/.test(text)) {
        return 'teknoloji';
    }
    if (/haber|gündem|son dakika|politika|ekonomi|dünya|siyaset|spor haber|magazin/.test(text)) {
        return 'haber';
    }
    if (/müzik|şarkı|klip|albüm|sanatçı|konser|melodi|beat|soundtrack|audio/.test(text)) {
        return 'müzik';
    }
    if (/eğitim|ders|öğren|kurs|üniversite|okul|kodlama|tutorial|anlatım|rehber|ödev/.test(text)) {
        return 'eğitim';
    }
    if (/eğlence|komedi|şaka|dizi|film|mizah|stand up|oyun|gaming|game|challenge|trending/.test(text)) {
        return 'eğlence';
    }
    return 'genel';
}

function normalizeVideoRecord(item) {
    const normalized = { ...item };
    normalized.time = normalizeTimestamp(item.time);
    normalized.vs = normalized.vs || detectVideoSource(item.url || item.link || item.sourceUrl || '');
    if (!normalized.vs) normalized.vs = { type: 'video', id: '' };
    normalized.title = resolveVideoTitle(normalized.title, normalized.desc || normalized.content || '');
    normalized.category = normalized.category || detectVideoCategory(normalized);
    return normalized;
}

function serializeVideo(video) {
    return {
        id: video.id,
        title: video.title,
        desc: video.desc,
        vs: video.vs,
        author: video.author,
        uid: video.uid,
        avatar: video.avatar,
        time: video.time instanceof Date ? video.time.toISOString() : video.time,
        source: video.source || 'local',
        storageProvider: video.storageProvider || 'local',
        storageMode: video.storageMode || 'local'
    };
}

function getStarterVideos() {
    return [];
}

async function persistVideoToCloud(video) {
    const payload = serializeVideo(video);
    const errors = [];

    for (const collectionName of REMOTE_COLLECTIONS) {
        try {
            const docRef = await addDoc(collection(db, collectionName), {
                ...payload,
                createdAt: serverTimestamp(),
                storageProvider: collectionName
            });
            saveStorageMeta({ provider: collectionName, safeMode: true, lastSavedAt: new Date().toISOString(), docId: docRef.id });
            return { success: true, provider: collectionName, docId: docRef.id };
        } catch (error) {
            errors.push(`${collectionName}: ${error.message || error}`);
        }
    }

    throw new Error(errors.join(' | '));
}

async function addLocalVideo(video) {
    const stored = getStoredVideos();
    const existing = stored.some(item => item.id === video.id);
    if (!existing) {
        stored.unshift(video);
        await saveStoredVideos(stored);
        await saveVideosToIndexedDb(stored);
    }

    allVideos = [video, ...allVideos.filter(item => item.id !== video.id)];
    renderVideos();
    updateSummary();
    refreshHeroStats();

    try {
        const result = await persistVideoToCloud(video);
        updateStorageStatus(`Kalıcı depolama aktif • ${result.provider}`);
        return { success: true, provider: result.provider };
    } catch (error) {
        console.warn('Bulut depolama başarısız, yerel yedek kullanılıyor:', error);
        updateStorageStatus('Yerel yedek aktif • videolar cihazda saklanıyor');
        return { success: true, provider: 'local' };
    }
}

function detectVideoSource(url) {
    if (!url) return null;
    const normalized = String(url).trim();
    const youtubeMatch = normalized.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
    const youtubeQuery = normalized.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
    const youtubeId = youtubeMatch?.[1] || youtubeQuery?.[1];
    if (youtubeId) return { type: 'youtube', id: youtubeId };

    const vimeoMatch = normalized.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vimeoMatch?.[1]) return { type: 'vimeo', id: vimeoMatch[1] };
    return null;
}

function createVideoEmbed(vs) {
    if (!vs) return '';
    if (vs.type === 'youtube') {
        return `<iframe title="YouTube video" loading="lazy" src="https://www.youtube.com/embed/${vs.id}?rel=0&modestbranding=1&playsinline=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    }
    if (vs.type === 'vimeo') {
        return `<iframe title="Vimeo video" loading="lazy" src="https://player.vimeo.com/video/${vs.id}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
    return '';
}

function normalizeTimestamp(value) {
    if (!value) return new Date(0);
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function formatTime(value) {
    const date = normalizeTimestamp(value);
    const diff = Date.now() - date.getTime();
    if (diff <= 0) return 'az önce';
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    return m < 60 ? `${m} dk` : h < 24 ? `${h} sa` : `${d} gün`;
}

function formatNum(n) {
    const value = Number(n) || 0;
    return value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : value >= 1000 ? (value / 1000).toFixed(1) + 'K' : value;
}

function esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

function getThumbnail(vs) {
    if (!vs) return 'assets/img/strendsaydamv2.png';
    return vs.type === 'youtube' ? `https://img.youtube.com/vi/${vs.id}/hqdefault.jpg` : 'assets/img/strendsaydamv2.png';
}

function getAvatar(value) {
    return value || 'assets/img/strendsaydamv2.png';
}

function getSourceLabel(vs) {
    return vs?.type === 'youtube' ? 'YouTube' : vs?.type === 'vimeo' ? 'Vimeo' : 'Video';
}

function getSourceUrl(vs) {
    if (!vs) return '#';
    if (vs.type === 'youtube') return `https://www.youtube.com/watch?v=${vs.id}`;
    if (vs.type === 'vimeo') return `https://vimeo.com/${vs.id}`;
    return '#';
}

function getVideoInteractionRecord(videoId) {
    const interactions = getVideoInteractions();
    const record = interactions[videoId] || { likes: 0, views: 0, liked: false, comments: [] };
    if (!Array.isArray(record.comments)) record.comments = [];
    interactions[videoId] = record;
    saveVideoInteractions(interactions);
    return record;
}

function getVideoInteractionSummary(video) {
    if (!video?.id) return { likes: 0, views: 0, comments: 0, liked: false };
    const record = getVideoInteractionRecord(video.id);
    return {
        likes: Number(record.likes) || 0,
        views: Number(record.views) || 0,
        comments: Array.isArray(record.comments) ? record.comments.length : 0,
        liked: Boolean(record.liked)
    };
}

function updateModalVideoStats(video) {
    const stats = getVideoInteractionSummary(video);
    const likesEl = document.getElementById('modalVideoLikes');
    const commentsEl = document.getElementById('modalVideoComments');
    const viewsEl = document.getElementById('modalVideoViews');
    if (likesEl) likesEl.innerHTML = `<strong>${stats.likes}</strong> beğeni`;
    if (commentsEl) commentsEl.innerHTML = `<strong>${stats.comments}</strong> yorum`;
    if (viewsEl) viewsEl.innerHTML = `<strong>${stats.views}</strong> izleme`;

    const likeButton = document.getElementById('likeVideoButton');
    if (likeButton) {
        likeButton.innerHTML = stats.liked ? '<i class="fa-solid fa-heart"></i> Beğeniyi kaldır' : '<i class="fa-regular fa-heart"></i> Beğen';
        likeButton.classList.toggle('active', stats.liked);
    }
}

function renderVideoComments(video) {
    const listEl = document.getElementById('videoCommentList');
    if (!listEl) return;
    const record = getVideoInteractionRecord(video?.id);
    const comments = Array.isArray(record.comments) ? record.comments : [];
    if (!comments.length) {
        listEl.innerHTML = '<div class="video-comment-empty">Henüz yorum yok. İlk yorumu sen yaz.</div>';
        return;
    }

    listEl.innerHTML = comments.map(comment => `
        <div class="video-comment-item">
            <div class="video-comment-meta">
                <strong>${esc(comment.author || 'Sen')}</strong>
                <span>${esc(comment.time || 'az önce')}</span>
            </div>
            <div>${esc(comment.text || '')}</div>
        </div>
    `).join('');
}

function updateVideoModalContent(video) {
    if (!video) return;
    updateModalVideoStats(video);
    renderVideoComments(video);
}

function getVideoCommentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function getPopularity(video) {
    const timeScore = normalizeTimestamp(video.time).getTime();
    const lengthScore = (video.desc || '').length * 3;
    return timeScore + lengthScore + (video.vs.type === 'youtube' ? 100 : 0);
}

function setLoadingState(loading) {
    const grid = document.getElementById('videosGrid');
    const noVideos = document.getElementById('noVideosMessage');
    const summary = document.getElementById('videoSummaryText');
    if (!grid || !noVideos) return;

    if (loading) {
        grid.style.display = 'grid';
        grid.innerHTML = `
            <div class="video-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Videolar yükleniyor...</p>
            </div>
        `;
        noVideos.style.display = 'none';
        if (summary) summary.textContent = 'Videolar yükleniyor...';
        return;
    }

    if (summary) {
        const count = allVideos.length;
        const label = count === 1 ? '1 video' : `${count} video`;
        summary.textContent = count ? `${label} bulundu` : 'Henüz video yok';
    }
}

function getVideoBadges(video) {
    const badges = [];
    if (video.source === 'local') badges.push('Eklenmiş');
    if (video.source === 'starter') badges.push('Önerilen');
    if (video.vs?.type === 'youtube') badges.push('YouTube');
    if (video.vs?.type === 'vimeo') badges.push('Vimeo');
    return badges;
}

function getVideoMetaPill(video) {
    if (video.source === 'local') return 'Kullanıcı ekledi';
    if (video.source === 'starter') return 'Öne çıkan';
    return '';
}

function getCurrentUserId() {
    try {
        if (window?.auth?.currentUser?.uid) return window.auth.currentUser.uid;
        if (window?.currentUser?.uid) return window.currentUser.uid;
        for (const key of ['slt_current_user_uid', 'currentUserId', 'activeUserUid']) {
            const value = localStorage.getItem(key);
            if (value) return value;
        }
    } catch (error) {
        console.warn('Kullanıcı kimliği okunamadı:', error);
    }
    return '';
}

function isOwnVideo(video) {
    if (!video) return false;
    const currentUid = getCurrentUserId();
    return video.source === 'local' || video.author === 'Sen' || (Boolean(currentUid) && video.uid === currentUid);
}

function renderFeaturedHighlights(videos = []) {
    const container = document.getElementById('videoHighlights');
    if (!container) return;

    const featured = (videos || []).slice(0, 3);
    if (!featured.length) {
        container.innerHTML = '<div class="video-spotlight-card"><div><strong>Henüz içerik yok</strong><span>İlk videoyu ekleyerek akışı başlat.</span></div><button type="button" onclick="document.getElementById(\'openVideoAddButton\')?.click()">Ekle</button></div>';
        return;
    }

    container.innerHTML = featured.map(video => `
        <div class="video-spotlight-card">
            <div>
                <strong>${esc(video.title || 'Video')}</strong>
                <span>${esc(video.author || 'Kullanıcı')} • ${esc(getCategoryLabel(video.category || 'genel'))}</span>
            </div>
            <button type="button" onclick="event.stopPropagation(); openVideoModal('${video.id}')">İzle</button>
        </div>
    `).join('');
}

function renderVideos() {
    const grid = document.getElementById('videosGrid');
    const noVideos = document.getElementById('noVideosMessage');
    if (!grid || !noVideos) return;

    let videos = [...allVideos];
    if (state.currentFilter === 'mine') {
        videos = videos.filter(x => isOwnVideo(x));
    } else if (state.currentFilter === 'youtube') {
        videos = videos.filter(x => x.vs.type === 'youtube');
    } else if (state.currentFilter === 'vimeo') {
        videos = videos.filter(x => x.vs.type === 'vimeo');
    }

    const search = state.currentSearch.trim().toLowerCase();
    if (state.currentFilter && state.currentFilter !== 'all' && !['mine', 'youtube', 'vimeo', 'recent', 'popular'].includes(state.currentFilter)) {
        videos = videos.filter(x => (x.category || '').toLowerCase() === state.currentFilter.toLowerCase());
    }
    if (search) {
        videos = videos.filter(x => (x.title || '').toLowerCase().includes(search) || (x.author || '').toLowerCase().includes(search));
    }

    if (state.currentFilter === 'recent') {
        videos.sort((a, b) => normalizeTimestamp(b.time).getTime() - normalizeTimestamp(a.time).getTime());
    } else if (state.currentFilter === 'popular') {
        videos.sort((a, b) => getPopularity(b) - getPopularity(a));
    } else {
        videos.sort((a, b) => normalizeTimestamp(b.time).getTime() - normalizeTimestamp(a.time).getTime());
    }

    renderFeaturedHighlights(videos);

    if (!videos.length) {
        grid.style.display = 'none';
        grid.innerHTML = '';
        noVideos.style.display = 'grid';
        noVideos.innerHTML = `
            <div class="video-empty-illustration"><i class="fa-solid fa-video-slash"></i></div>
            <h3>Bu filtrede video yok</h3>
            <p>Başka bir filtre seçin ya da yeni bir video paylaşın.</p>
            <button type="button" class="video-action-btn" onclick="document.getElementById('openVideoAddButton')?.click()">İlk videoyu ekle</button>
        `;
        updateSummary([]);
        return;
    }

    grid.style.display = 'grid';
    noVideos.style.display = 'none';
    grid.innerHTML = videos.map(x => {
        const stats = getVideoInteractionSummary(x);
        return `
        <div class="video-card" role="button" tabindex="0" onclick="openVideoModal('${x.id}')" onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openVideoModal('${x.id}'); }">
            <div class="video-thumbnail">
                <img src="${getThumbnail(x.vs)}" alt="${esc(x.title)}" onerror="this.src='assets/img/strendsaydamv2.png'">
                <div class="video-play-icon"><i class="fa-solid fa-play"></i></div>
                <div style="position:absolute; inset:10px 10px auto auto; display:flex; flex-direction:column; gap:6px; align-items:flex-end; z-index:2;">
                    <span class="video-source-badge">${x.vs.type.toUpperCase()}</span>
                    <span class="video-card__meta-pill">${esc(getVideoMetaPill(x))}</span>
                </div>
            </div>
            <div class="video-info">
                <div class="video-card-badges">
                    <span class="video-card-category"><i class="fa-solid fa-tags"></i>${esc((x.category || 'Genel').replace(/^./, c => c.toUpperCase()))}</span>
                    ${getVideoBadges(x).map(b => `<span class="video-card-badge"><i class="fa-solid fa-circle"></i>${esc(b)}</span>`).join('')}
                </div>
                <h3 class="video-title">${esc(x.title)}</h3>
                <p class="video-card__description">${esc((x.desc || '').trim().slice(0, 140))}${(x.desc || '').trim().length > 140 ? '…' : ''}</p>
                <div class="video-meta">
                    <img src="${getAvatar(x.avatar)}" class="video-avatar" alt="${esc(x.author)}">
                    <div class="video-meta-text">
                        <a class="video-author" href="${x.uid ? `profil.html?id=${x.uid}` : '#'}">${esc(x.author)}</a>
                        <span class="video-date">${formatTime(x.time)}</span>
                    </div>
                </div>
                <div class="video-stats">
                    <span class="video-stat"><i class="fa-solid fa-eye"></i>${formatNum(stats.views)}</span>
                    <span class="video-stat"><i class="fa-solid fa-thumbs-up"></i>${formatNum(stats.likes)}</span>
                    <span class="video-stat"><i class="fa-solid fa-comment"></i>${formatNum(stats.comments)}</span>
                </div>
                <div class="video-card__footer">
                    <span><i class="fa-solid fa-clock"></i> ${formatTime(x.time)}</span>
                    <button class="video-card__action" type="button" onclick="event.stopPropagation(); openVideoModal('${x.id}')"><i class="fa-solid fa-play"></i> İzle</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
    updateSummary(videos);
}

function setActiveFilter(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.dataset.filter || 'all') === filter);
    });
}

function updateSummary(visibleVideos = allVideos) {
    const summary = document.getElementById('videoSummaryText');
    const countEl = document.getElementById('videoResultsCount');
    if (!summary) return;

    const activeLabel = state.currentFilter === 'mine' ? 'Benim videolarım' : state.currentFilter === 'teknoloji' ? 'Teknoloji' : state.currentFilter === 'haber' ? 'Haber' : state.currentFilter === 'müzik' ? 'Müzik' : state.currentFilter === 'eğitim' ? 'Eğitim' : state.currentFilter === 'eğlence' ? 'Eğlence' : state.currentFilter === 'genel' ? 'Genel' : 'Tümü';
    const totalCount = allVideos.length;
    const visibleCount = Array.isArray(visibleVideos) ? visibleVideos.length : totalCount;
    const label = totalCount === 1 ? '1 video' : `${totalCount} video`;
    summary.textContent = visibleCount ? `${visibleCount} gösteriliyor • ${activeLabel}` : 'Henüz video yok';
    if (countEl) {
        countEl.textContent = visibleCount ? `${visibleCount} sonuç` : '0 sonuç';
    }
    if (!totalCount) {
        summary.textContent = 'Henüz video yok';
        if (countEl) countEl.textContent = '0 sonuç';
    }
}

function refreshHeroStats() {
    const totalEl = document.getElementById('heroTotalVideos');
    const youtubeEl = document.getElementById('heroYoutubeCount');
    const vimeoEl = document.getElementById('heroVimeoCount');

    if (!totalEl || !youtubeEl || !vimeoEl) return;

    const youtubeCount = allVideos.filter(v => v.vs.type === 'youtube').length;
    const vimeoCount = allVideos.filter(v => v.vs.type === 'vimeo').length;

    totalEl.textContent = `${allVideos.length} içerik`;
    youtubeEl.textContent = `${youtubeCount} YouTube`;
    vimeoEl.textContent = `${vimeoCount} Vimeo`;
}

async function loadRemoteVideos() {
    const remoteVideos = [];
    const seen = new Set();

    for (const collectionName of REMOTE_COLLECTIONS) {
        try {
            const snapshot = await withTimeout(getDocs(collection(db, collectionName)), FIRESTORE_TIMEOUT_MS, null);
            if (!snapshot) continue;
            snapshot.forEach(doc => {
                const item = doc.data();
                if (!item || !item.vs) return;
                const id = `${collectionName}-${doc.id}`;
                if (seen.has(id)) return;
                seen.add(id);
                remoteVideos.push(normalizeVideoRecord({
                    ...item,
                    id,
                    title: resolveVideoTitle(item.title, item.desc || item.content || ''),
                    desc: item.desc || item.content || '',
                    author: item.author || 'Kullanıcı',
                    uid: item.uid || '',
                    avatar: item.avatar || '',
                    time: item.time || item.createdAt || new Date()
                }));
            });
        } catch (error) {
            console.warn(`Depolama koleksiyonu yüklenemedi (${collectionName}):`, error);
        }
    }

    return remoteVideos;
}

async function loadVideos() {
    setLoadingState(true);
    const starterVideos = getStarterVideos();
    allVideos = starterVideos;
    refreshHeroStats();
    updateSummary();
    renderVideos();
    updateStorageStatus('Depolama hazırlanıyor…');

    try {
        const videos = [];
        const seen = new Set();

        const postsSnapshot = await withTimeout(getDocs(query(collection(db, 'posts'), orderBy('timestamp', 'desc'))), FIRESTORE_TIMEOUT_MS, null);
        if (postsSnapshot) {
            postsSnapshot.forEach(doc => {
                const post = doc.data();
                const text = `${post.content || ''} ${post.title || ''}`;
                const urls = text.match(/https?:\/\/[^\s]+/g) || [];
                urls.forEach(url => {
                    const vs = detectVideoSource(url);
                    if (vs && !seen.has(vs.id)) {
                        seen.add(vs.id);
                        videos.push({
                            id: `post-${doc.id}-${vs.id}`,
                            title: resolveVideoTitle(post.title, post.content),
                            desc: String(post.content || '').substring(0, 180),
                            vs,
                            author: post.name || 'Kullanıcı',
                            uid: post.authorUid || '',
                            avatar: post.avatarUrl || '',
                            time: normalizeTimestamp(post.timestamp)
                        });
                    }
                });
            });
        }

        try {
            const blogsSnapshot = await withTimeout(getDocs(collection(db, 'blogs')), FIRESTORE_TIMEOUT_MS, null);
            if (blogsSnapshot) {
                blogsSnapshot.forEach(doc => {
                    const blog = doc.data();
                    const text = `${blog.content || ''} ${blog.title || ''}`;
                    (text.match(/https?:\/\/[^\s]+/g) || []).forEach(url => {
                        const vs = detectVideoSource(url);
                        if (vs && !seen.has(vs.id)) {
                            seen.add(vs.id);
                            videos.push({
                                id: `blog-${doc.id}-${vs.id}`,
                                title: resolveVideoTitle(blog.title, blog.content),
                                desc: String(blog.content || '').substring(0, 180),
                                vs,
                                author: blog.author || 'Yazar',
                                uid: blog.authorUid || '',
                                avatar: blog.authorAvatar || '',
                                time: normalizeTimestamp(blog.createdAt)
                            });
                        }
                    });
                });
            }
        } catch (error) {
            console.warn('Blog videoları yüklenemedi:', error);
        }

        try {
            const communitiesSnapshot = await withTimeout(getDocs(collection(db, 'communityPosts')), FIRESTORE_TIMEOUT_MS, null);
            if (communitiesSnapshot) {
                communitiesSnapshot.forEach(doc => {
                    const community = doc.data();
                    const text = `${community.content || ''} ${community.title || ''}`;
                    (text.match(/https?:\/\/[^\s]+/g) || []).forEach(url => {
                        const vs = detectVideoSource(url);
                        if (vs && !seen.has(vs.id)) {
                            seen.add(vs.id);
                            videos.push({
                                id: `community-${doc.id}-${vs.id}`,
                                title: resolveVideoTitle(community.title, community.content),
                                desc: String(community.content || '').substring(0, 180),
                                vs,
                                author: community.author || 'Üye',
                                uid: community.authorUid || '',
                                avatar: community.authorAvatarUrl || '',
                                time: normalizeTimestamp(community.createdAt)
                            });
                        }
                    });
                });
            }
        } catch (error) {
            console.warn('Topluluk videoları yüklenemedi:', error);
        }

        const remoteVideos = await loadRemoteVideos();
        const storedVideos = await getPersistedVideos();
        const combinedVideos = [...videos, ...remoteVideos, ...storedVideos];
        const deduped = [];
        const seenIds = new Set();

        combinedVideos.forEach(item => {
            const normalized = normalizeVideoRecord(item);
            const key = normalized.id || `${normalized.title}-${normalized.author}-${normalized.vs?.type}-${normalized.vs?.id}`;
            if (!seenIds.has(key)) {
                seenIds.add(key);
                deduped.push(normalized);
            }
        });

        const mergedVideos = [...starterVideos, ...deduped];
        const mergedSeen = new Set();
        const finalVideos = [];
        mergedVideos.forEach(item => {
            const normalized = normalizeVideoRecord(item);
            const key = normalized.id || `${normalized.title}-${normalized.author}-${normalized.vs?.type}-${normalized.vs?.id}`;
            if (!mergedSeen.has(key)) {
                mergedSeen.add(key);
                finalVideos.push(normalized);
            }
        });
        finalVideos.sort((a, b) => normalizeTimestamp(b.time).getTime() - normalizeTimestamp(a.time).getTime());
        allVideos = finalVideos.length ? finalVideos : starterVideos;
        updateStorageStatus(`Depolama hazır • ${getStorageMeta().provider || 'yerel'} / ${allVideos.length} video`);
        setLoadingState(false);
        refreshHeroStats();
        updateSummary();
        renderVideos();
    } catch (error) {
        console.error('Video yükleme hatası:', error);
        allVideos = starterVideos;
        updateStorageStatus('Yerel yedek aktif • videolar cihazda saklanıyor');
        setLoadingState(false);
        refreshHeroStats();
        updateSummary();
        renderVideos();
    }
}

window.openVideoModal = function(id) {
    const video = allVideos.find(x => x.id === id);
    if (!video) return;

    const container = document.getElementById('videoPlayerContainer');
    const modal = document.getElementById('videoModal');
    if (!container || !modal) return;

    container.innerHTML = createVideoEmbed(video.vs);
    document.getElementById('modalVideoTitle').textContent = video.title;
    document.getElementById('modalVideoAuthor').textContent = video.author;
    document.getElementById('modalVideoAuthor').href = video.uid ? `profil.html?id=${video.uid}` : '#';
    document.getElementById('modalVideoAvatar').src = getAvatar(video.avatar);
    document.getElementById('modalVideoDate').textContent = formatTime(video.time);
    document.getElementById('modalVideoDescription').textContent = video.desc || 'Bu videonun açıklaması yok.';
    document.getElementById('modalVideoDescription').style.whiteSpace = 'pre-wrap';
    document.getElementById('modalVideoSource').textContent = getSourceLabel(video.vs);
    state.selectedVideo = video;
    const interactionsMap = getVideoInteractions();
    const record = interactionsMap[video.id] || { likes: 0, views: 0, liked: false, comments: [] };
    record.views = (Number(record.views) || 0) + 1;
    interactionsMap[video.id] = record;
    saveVideoInteractions(interactionsMap);
    updateVideoModalContent(video);
    document.getElementById('videoModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeVideoModal = function() {
    const modal = document.getElementById('videoModal');
    const container = document.getElementById('videoPlayerContainer');
    if (!modal || !container) return;
    modal.classList.remove('active');
    container.innerHTML = '';
    state.selectedVideo = null;
    document.body.style.overflow = '';
};

window.likeVideo = function() {
    const video = state.selectedVideo;
    if (!video) return;
    const interactions = getVideoInteractions();
    const record = interactions[video.id] || { likes: 0, views: 0, liked: false, comments: [] };
    const wasLiked = Boolean(record.liked);
    record.liked = !wasLiked;
    record.likes = Math.max(0, Number(record.likes) || 0) + (wasLiked ? -1 : 1);
    interactions[video.id] = record;
    saveVideoInteractions(interactions);
    updateModalVideoStats(video);
};

window.watchVideoSource = function() {
    if (!state.selectedVideo) return;
    const video = state.selectedVideo;
    const interactions = getVideoInteractions();
    const record = interactions[video.id] || { likes: 0, views: 0, liked: false, comments: [] };
    record.views = (Number(record.views) || 0) + 1;
    interactions[video.id] = record;
    saveVideoInteractions(interactions);
    updateModalVideoStats(video);
    window.open(getSourceUrl(video.vs), '_blank', 'noopener,noreferrer');
};

window.addVideoComment = function() {
    const video = state.selectedVideo;
    if (!video) return;
    const input = document.getElementById('videoCommentInput');
    const text = input?.value?.trim();
    if (!text) {
        input?.focus();
        return;
    }

    const interactions = getVideoInteractions();
    const record = interactions[video.id] || { likes: 0, views: 0, liked: false, comments: [] };
    record.comments = Array.isArray(record.comments) ? record.comments : [];
    record.comments.unshift({
        id: `${video.id}-${Date.now()}`,
        text,
        author: 'Sen',
        time: getVideoCommentTime()
    });
    interactions[video.id] = record;
    saveVideoInteractions(interactions);
    updateModalVideoStats(video);
    renderVideoComments(video);
    if (input) input.value = '';
};

window.shareVideo = function() {
    const title = document.getElementById('modalVideoTitle').textContent;
    if (navigator.share) {
        navigator.share({ title, url: window.location.href });
    } else {
        navigator.clipboard?.writeText(window.location.href).then(() => alert('Video linki kopyalandı')).catch(() => alert('Video URL: ' + window.location.href));
    }
};

window.filterVideos = function(filter) {
    state.currentFilter = filter;
    setActiveFilter(filter);
    updateSummary();
    renderVideos();
};

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('videoSearch');
    const searchButton = document.getElementById('videoSearchButton');
    const clearButton = document.getElementById('clearVideoFilters');
    const toggleButton = document.getElementById('toggleVideoAdd');
    const floatingButton = document.getElementById('floatingVideoAddButton');
    const addPanel = document.getElementById('videoAddPanel');
    const addForm = document.getElementById('videoAddForm');
    const addStatus = document.getElementById('videoAddStatus');
    const closeButton = document.getElementById('videoAddClose');

    const toggleVideoAddPanel = (forceOpen) => {
        if (!addPanel) return;
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !addPanel.classList.contains('active');
        addPanel.classList.toggle('active', shouldOpen);
        if (!shouldOpen && addStatus) addStatus.textContent = '';
        if (shouldOpen) {
            requestAnimationFrame(() => document.getElementById('videoAddUrl')?.focus());
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', e => {
            state.currentSearch = e.target.value || '';
            updateSummary();
            renderVideos();
        });
    }

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            if (!searchInput) return;
            state.currentSearch = searchInput.value || '';
            updateSummary();
            renderVideos();
            searchInput.focus();
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            state.currentFilter = 'all';
            state.currentSearch = '';
            if (searchInput) searchInput.value = '';
            setActiveFilter('all');
            updateSummary();
            renderVideos();
        });
    }

    if (toggleButton) {
        toggleButton.addEventListener('click', () => toggleVideoAddPanel());
    }

    if (floatingButton) {
        floatingButton.addEventListener('click', () => toggleVideoAddPanel());
    }

    document.querySelectorAll('.video-add-toggle').forEach(button => {
        if (button.id !== 'toggleVideoAdd') {
            button.addEventListener('click', () => toggleVideoAddPanel());
        }
    });

    if (closeButton) {
        closeButton.addEventListener('click', () => toggleVideoAddPanel(false));
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && addPanel?.classList.contains('active')) {
            toggleVideoAddPanel(false);
        }
    });

    if (addForm) {
        addForm.addEventListener('submit', async event => {
            event.preventDefault();
            const url = document.getElementById('videoAddUrl')?.value?.trim();
            const title = document.getElementById('videoAddTitle')?.value?.trim();
            const description = document.getElementById('videoAddDesc')?.value?.trim();
            const selectedCategory = document.getElementById('videoAddCategory')?.value || 'genel';
            const predictedCategory = detectVideoCategory({ title: title || '', desc: description || '' });

            if (!url) {
                if (addStatus) addStatus.textContent = 'Lütfen bir bağlantı girin.';
                return;
            }

            if (selectedCategory !== predictedCategory) {
                const proceed = confirm(
                    `Seçtiğin kategori "${getCategoryLabel(selectedCategory)}". Bu video sistemin tahmini olarak "${getCategoryLabel(predictedCategory)}" kategorisine daha uygun. Yine de devam etmek istiyor musun?`
                );
                if (!proceed) {
                    return;
                }
            }

            const submitBtn = addForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Ekleniyor...';
            }

            const video = createLocalVideo(url, title, description, selectedCategory);
            if (!video) {
                if (addStatus) addStatus.textContent = 'Geçerli bir YouTube veya Vimeo bağlantısı değil.';
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Videoyu ekle';
                }
                return;
            }

            if (addStatus) addStatus.textContent = 'Video kaydediliyor...';
            const result = await addLocalVideo(video);
            if (addForm) addForm.reset();
            if (addStatus) addStatus.textContent = result.provider === 'local' ? 'Video yerel olarak kaydedildi.' : 'Video kalıcı depolamaya kaydedildi.';
            state.currentFilter = 'all';
            state.currentSearch = '';
            if (searchInput) searchInput.value = '';
            setActiveFilter('all');
            updateSummary();
            renderVideos();
            toggleVideoAddPanel(false);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Videoyu ekle';
            }
        });
    }

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            window.filterVideos(button.dataset.filter || 'all');
        });
    });

    document.getElementById('videoModal')?.addEventListener('click', e => {
        if (e.target.id === 'videoModal') window.closeVideoModal();
    });

    setActiveFilter(state.currentFilter);
    updateSummary();
    loadVideos();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') window.closeVideoModal?.();
});
