// Simple stories renderer and viewer
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('stories-row');
    if (!container) return;

    // stories array will contain the create card plus persisted stories
    let stories = [];

    function getStoryGroupKey(story) {
        return story.authorUid || story.user || 'unknown';
    }

    function prepareStory(story) {
        const title = story.title || story.label || '';
        const content = story.content || story.body || story.text || '';
        return {
            ...story,
            title,
            content,
            label: title || content || story.label || '',
            groupKey: story.groupKey || getStoryGroupKey(story),
            likesCount: Number(story.likesCount || 0),
            likedBy: Array.isArray(story.likedBy) ? story.likedBy : [],
            textStyle: {
                fontFamily: story.textStyle?.fontFamily || 'system-ui, sans-serif',
                bgColor: story.textStyle?.bgColor || 'rgba(15,23,42,0.92)',
                textColor: story.textStyle?.textColor || '#ffffff'
            }
        };
    }

    const VIEWED_GROUPS_KEY = 'slt_viewed_story_groups';
    const PENDING_STORIES_KEY = 'slt_pending_stories';
    let pendingRemoteSyncTimer = null;
    let pendingRemoteSyncInFlight = false;

    function loadViewedGroups() {
        try {
            const raw = localStorage.getItem(VIEWED_GROUPS_KEY);
            if (!raw) return new Map();
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return new Map();
            return new Map(Object.entries(data).filter(([key, value]) => key && typeof value === 'number'));
        } catch (e) {
            return new Map();
        }
    }

    function saveViewedGroups(viewedGroups) {
        try {
            const obj = Object.fromEntries(viewedGroups);
            localStorage.setItem(VIEWED_GROUPS_KEY, JSON.stringify(obj));
        } catch (e) {}
    }

    const viewedGroups = loadViewedGroups();

    function markGroupViewed(groupKey, viewedAt = Date.now()) {
        if (!groupKey) return;
        const previous = viewedGroups.get(groupKey) || 0;
        if (viewedAt <= previous) return;
        viewedGroups.set(groupKey, viewedAt);
        saveViewedGroups(viewedGroups);
        render();
    }

    function getCurrentUserUid() {
        const directUid = window.auth?.currentUser?.uid || window.user?.uid || null;
        if (directUid) return directUid;

        const fallbackIdentity = window.auth?.currentUser?.email || window.user?.email || window.user?.username || window.user?.displayName || null;
        if (fallbackIdentity && String(fallbackIdentity).trim()) {
            const normalized = String(fallbackIdentity).trim();
            const lower = normalized.toLowerCase();
            if (lower !== 'misafir' && lower !== 'guest') {
                return normalized;
            }
        }

        return null;
    }

    function waitForCurrentUserUid(timeoutMs = 4000) {
        const initialUid = getCurrentUserUid();
        if (initialUid) return Promise.resolve(initialUid);

        return new Promise((resolve) => {
            const startedAt = Date.now();
            const check = () => {
                const currentUid = getCurrentUserUid();
                if (currentUid) {
                    resolve(currentUid);
                    return;
                }
                if (Date.now() - startedAt >= timeoutMs) {
                    resolve(null);
                    return;
                }
                setTimeout(check, 200);
            };
            check();
        });
    }

    function getCurrentUserContext() {
        const authUser = window.auth?.currentUser || null;
        const userData = window.user || {};
        const uid = authUser?.uid || userData.uid || null;
        return {
            uid,
            displayName: authUser?.displayName || userData.displayName || userData.username || authUser?.email?.split('@')[0] || 'Sen',
            username: userData.username || authUser?.email?.split('@')[0] || '',
            avatarUrl: userData.avatarUrl || authUser?.photoURL || 'assets/img/strendsaydamv2.png'
        };
    }

    function loadPendingStories() {
        try {
            const raw = localStorage.getItem(PENDING_STORIES_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function savePendingStories(pendingStories) {
        try {
            localStorage.setItem(PENDING_STORIES_KEY, JSON.stringify(pendingStories));
        } catch (e) {}
    }

    function enqueuePendingStory(story) {
        if (!story || story.type !== 'story') return;
        const pendingStories = loadPendingStories();
        const alreadyQueued = pendingStories.some(item => item.id === story.id);
        if (!alreadyQueued) {
            pendingStories.push({ ...story, pendingAt: Date.now() });
            savePendingStories(pendingStories);
        }
    }

    function schedulePendingStorySync() {
        if (pendingRemoteSyncTimer) clearTimeout(pendingRemoteSyncTimer);
        pendingRemoteSyncTimer = setTimeout(() => {
            void syncPendingStoriesToBackend();
        }, 1500);
    }

    async function syncPendingStoriesToBackend() {
        if (pendingRemoteSyncInFlight) return;
        const pendingStories = loadPendingStories();
        if (!pendingStories.length) return;
        if (!hasFirestore()) {
            schedulePendingStorySync();
            return;
        }
        pendingRemoteSyncInFlight = true;
        try {
            const stillPending = [];
            for (const pendingStory of pendingStories) {
                if (!pendingStory || pendingStory.type !== 'story') continue;
                const remoteUrl = await saveStoryToBackend({ ...pendingStory }, { skipLocalUpdate: true });
                if (remoteUrl === null) {
                    stillPending.push(pendingStory);
                }
            }
            savePendingStories(stillPending);
        } finally {
            pendingRemoteSyncInFlight = false;
            if (loadPendingStories().length) {
                schedulePendingStorySync();
            }
        }
    }

    function isStoryLikedByCurrentUser(story) {
        const currentUid = getCurrentUserUid();
        return currentUid && Array.isArray(story.likedBy) && story.likedBy.includes(currentUid);
    }

    async function saveStoryMetadataToRemote(story) {
        if (!hasFirestore() || !story.remote || !story.id || !window.updateDoc || !window.doc || !window.collection || !window.db) return;
        try {
            await window.updateDoc(window.doc(window.db, STORY_COLLECTION, story.id), {
                likesCount: Number(story.likesCount || 0),
                likedBy: Array.isArray(story.likedBy) ? story.likedBy : []
            });
        } catch (err) {
            console.warn('Story metadata remote update failed:', err);
        }
    }

    async function toggleStoryLike(story) {
        const currentUid = await waitForCurrentUserUid();
        if (!currentUid) {
            alert('Beğeni gönderebilmek için lütfen giriş yapın.');
            return;
        }
        if (!story || !story.id) return;
        if (story.authorUid && story.authorUid === currentUid) {
            alert('Kendi hikayenizi beğenemezsiniz.');
            return;
        }
        const liked = isStoryLikedByCurrentUser(story);
        if (liked) {
            story.likedBy = story.likedBy.filter(uid => uid !== currentUid);
            story.likesCount = Math.max(0, Number(story.likesCount || 1) - 1);
        } else {
            story.likedBy = Array.isArray(story.likedBy) ? story.likedBy.slice() : [];
            story.likedBy.push(currentUid);
            story.likesCount = Number(story.likesCount || 0) + 1;
            if (story.authorUid && window.sendNotification) {
                const fromName = (window.user && (window.user.displayName || window.user.username)) || 'Bir kullanıcı';
                window.sendNotification(story.authorUid, 'story_like', fromName, {
                    title: 'Hikayen beğenildi',
                    message: `${fromName} hikayeni "${story.label || 'hikaye'}" ile beğendi.`,
                    storyId: story.id,
                    storyLabel: story.label || '',
                    fromUid: currentUid
                });
            }
        }
        saveStories();
        await saveStoryMetadataToRemote(story);
    }

    async function reportStory(story) {
        const currentUid = getCurrentUserUid();
        if (!currentUid) {
            alert('Şikayet gönderebilmek için lütfen giriş yapın.');
            return;
        }
        const reporterName = (window.user && (window.user.displayName || window.user.username)) || 'Bir kullanıcı';
        const reason = prompt('Bu hikayeyi neden şikayet ediyorsunuz?\n\nÖrnek: spam, taciz, uygunsuz içerik', '');
        if (!reason || !reason.trim()) return;
        const reportDoc = {
            reporterUid: currentUid,
            reporterName,
            targetUid: story.authorUid || null,
            targetUsername: story.user || null,
            contentType: 'story',
            contentId: story.id,
            storyLabel: story.label || '',
            reason: reason.trim(),
            createdAt: window.serverTimestamp ? window.serverTimestamp() : new Date(),
            status: 'pending'
        };
        if (hasFirestore() && window.addDoc && window.collection && window.db) {
            try {
                await window.addDoc(window.collection(window.db, 'reports'), reportDoc);
            } catch (err) {
                console.warn('Story report kaydedilemedi:', err);
            }
        }
        if (window.sendNotification) {
            window.sendNotification(currentUid, 'story_report_submitted', 'Sistem / Yönetici', {
                title: 'Şikayetiniz iletildi',
                message: `"${story.label || 'hikaye'}" için şikayetiniz alındı.`,
                storyId: story.id,
                storyLabel: story.label || ''
            });
        }
        alert('Şikayetiniz alındı. İnceleme için iletildi.');
    }

    function loadStories() {
        try {
            const raw = localStorage.getItem('slt_stories');
            if (!raw) return [];
            const arr = JSON.parse(raw);
            const now = Date.now();
            const day = 24 * 60 * 60 * 1000;
            // filter expired (older than 24 hours)
            const valid = arr.filter(s => s.timestamp && (now - s.timestamp) < day).map(prepareStory);
            return valid;
        } catch (e) {
            return [];
        }
    }

    const STORY_COLLECTION = 'stories';
    const STORY_EXPIRY_MS = 24 * 60 * 60 * 1000;
    let remoteListenerAttached = false;

    function nowMs() {
        return Date.now();
    }

    function isExpired(story) {
        return story.timestamp && (nowMs() - story.timestamp) >= STORY_EXPIRY_MS;
    }

    async function removeExpiredStories() {
        const activeStories = stories.filter((story) => story.type === 'story' && !isExpired(story));
        const expiredStories = stories.filter((story) => story.type === 'story' && isExpired(story));
        if (!expiredStories.length) return;
        stories = [{ id: 'create', type: 'create', label: 'Stori Oluştur', img: 'assets/img/strendsaydamv2.png' }].concat(activeStories);
        saveStories();
        render();
        for (const expiredStory of expiredStories) {
            if (expiredStory.id && hasFirestore() && expiredStory.remote) {
                try {
                    await deleteRemoteStory(expiredStory);
                } catch (err) {
                    console.warn('Süresi dolan hikaye silinemedi:', err);
                }
            }
        }
    }

    function saveStories() {
        try {
            const toSave = stories.filter(s => s.type === 'story').map((story) => {
                const clone = { ...story };
                delete clone.file;
                return clone;
            });
            localStorage.setItem('slt_stories', JSON.stringify(toSave));
        } catch (e) {}
    }

    async function uploadStoryImageFile(file) {
        if (!hasFirestore() || !window.ref || !window.uploadBytes || !window.getDownloadURL || !window.storage) {
            throw new Error('Storage backend hazır değil');
        }
        const ext = file.name.split('.').pop() || 'jpg';
        const ownerId = window.auth?.currentUser?.uid || (window.user && window.user.uid) || 'public';
        const storagePath = `stories/${ownerId}/${Date.now()}.${ext}`;
        const storageRef = window.ref(window.storage, storagePath);
        const snapshot = await window.uploadBytes(storageRef, file);
        return await window.getDownloadURL(snapshot.ref);
    }

    async function waitForBackendReady(timeout = 20000) {
        const start = nowMs();
        return new Promise((resolve) => {
            const check = () => {
                if (window.db && window.collection && window.doc && window.setDoc && window.getDocs) {
                    resolve(true);
                } else if (nowMs() - start >= timeout) {
                    resolve(false);
                } else {
                    setTimeout(check, 200);
                }
            };
            check();
        });
    }

    function hasFirestore() {
        return window.db && window.collection && window.doc && window.setDoc && window.getDocs;
    }

    function normalizeRemoteStory(docId, data) {
        if (!data || !data.timestamp) return null;
        const timestamp = data.timestamp && typeof data.timestamp.toMillis === 'function'
            ? data.timestamp.toMillis()
            : (typeof data.timestamp === 'number' ? data.timestamp : nowMs());
        const expiresAt = data.expiresAt && typeof data.expiresAt.toMillis === 'function'
            ? data.expiresAt.toMillis()
            : (data.expiresAt instanceof Date ? data.expiresAt.getTime() : timestamp + STORY_EXPIRY_MS);
        if (nowMs() >= expiresAt) return null;
        return {
            id: docId,
            type: 'story',
            remote: true,
            title: data.title || data.storyTitle || data.label || data.caption || '',
            content: data.content || data.storyContent || data.body || data.caption || '',
            label: data.title || data.content || data.label || data.caption || '',
            user: data.authorName || data.author || data.user || 'Bilinmeyen',
            avatar: data.avatarUrl || data.authorAvatar || 'assets/img/strendsaydamv2.png',
            img: data.img || data.imageData || '',
            timestamp,
            comments: Array.isArray(data.comments) ? data.comments : [],
            authorUid: data.authorUid || null,
            groupKey: data.authorUid || data.authorName || data.author || data.user || 'unknown',
            likesCount: Number(data.likesCount || 0),
            likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
            expiresAt,
        };
    }

    function mergeStoryLikeState(localStory, remoteStory) {
        const localLikedBy = Array.isArray(localStory?.likedBy) ? localStory.likedBy : [];
        const remoteLikedBy = Array.isArray(remoteStory?.likedBy) ? remoteStory.likedBy : [];
        const mergedLikedBy = Array.from(new Set([...remoteLikedBy, ...localLikedBy]));
        const remoteLikesCount = Number(remoteStory?.likesCount || 0);
        const localLikesCount = Number(localStory?.likesCount || 0);
        return {
            likesCount: Math.max(remoteLikesCount, localLikesCount, mergedLikedBy.length),
            likedBy: mergedLikedBy
        };
    }

    function mergeRemoteStories(remoteStories) {
        const localStories = loadStories();
        const merged = [{ id: 'create', type: 'create', label: 'Stori Oluştur', img: 'assets/img/strendsaydamv2.png' }];
        const storyMap = new Map();

        localStories.forEach((story) => {
            if (!isExpired(story)) {
                storyMap.set(story.id, story);
            }
        });

        remoteStories.forEach((story) => {
            if (story && story.id && !isExpired(story)) {
                const existing = storyMap.get(story.id);
                if (existing) {
                    const likeState = mergeStoryLikeState(existing, story);
                    storyMap.set(story.id, {
                        ...existing,
                        ...story,
                        ...likeState,
                        remote: story.remote || existing.remote || false
                    });
                } else {
                    storyMap.set(story.id, story);
                }
            }
        });

        const sortedStories = Array.from(storyMap.values()).sort((a, b) => b.timestamp - a.timestamp);
        stories = merged.concat(sortedStories);
        saveStories();
        render();
    }

    async function loadRemoteStoriesOnce() {
        if (!hasFirestore()) return;
        try {
            const q = window.query(window.collection(window.db, STORY_COLLECTION), window.orderBy('timestamp', 'desc'), window.limit(100));
            const snap = await window.getDocs(q);
            const remoteDocs = [];
            snap.forEach((docSnap) => {
                const story = normalizeRemoteStory(docSnap.id, docSnap.data());
                if (story) remoteDocs.push(story);
            });
            mergeRemoteStories(remoteDocs);
        } catch (err) {
            console.warn('Remote stories yüklenemedi:', err);
        }
    }

    function getStoryDocRef(storyId) {
        return window.doc(window.db, STORY_COLLECTION, storyId);
    }

    function buildFirestoreStory(story) {
        const currentUser = getCurrentUserContext();
        return {
            authorUid: currentUser.uid || story.authorUid || null,
            authorName: currentUser.displayName || story.user || 'Sen',
            authorAvatar: currentUser.avatarUrl || story.avatar || 'assets/img/strendsaydamv2.png',
            title: story.title || story.label || '',
            content: story.content || '',
            label: story.title || story.content || story.label || '',
            caption: story.content || story.label || '',
            img: story.img,
            imageData: story.img,
            likesCount: Number(story.likesCount || 0),
            likedBy: Array.isArray(story.likedBy) ? story.likedBy : [],
            textStyle: {
                fontFamily: story.textStyle?.fontFamily || 'system-ui, sans-serif',
                bgColor: story.textStyle?.bgColor || 'rgba(15,23,42,0.92)',
                textColor: story.textStyle?.textColor || '#ffffff'
            },
            timestamp: window.serverTimestamp ? window.serverTimestamp() : new Date(),
            comments: Array.isArray(story.comments) ? story.comments : [],
            expiresAt: new Date(Date.now() + STORY_EXPIRY_MS),
        };
    }

    async function saveStoryToBackend(story, options = {}) {
        const maxAttempts = 4;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            await waitForBackendReady(8000);
            if (!hasFirestore() || !story || story.type !== 'story') {
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    continue;
                }
                if (!options.skipLocalUpdate) {
                    enqueuePendingStory(story);
                }
                return null;
            }
            try {
                const id = story.id || ('s_' + Date.now());
                let imageUrl = story.img;
                if (story.file) {
                    try {
                        imageUrl = await uploadStoryImageFile(story.file);
                    } catch (uploadErr) {
                        console.warn('Hikaye resmi yüklenemedi, yerelde kalacak:', uploadErr);
                    }
                }
                const storyRef = getStoryDocRef(id);
                await window.setDoc(storyRef, buildFirestoreStory({ ...story, img: imageUrl }));
                story.id = id;
                story.remote = true;
                if (imageUrl) {
                    story.img = imageUrl;
                }
                if (!options.skipLocalUpdate) {
                    saveStories();
                }
                return imageUrl;
            } catch (err) {
                console.warn('Hikaye uzak depoya kaydedilemedi:', err);
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    continue;
                }
                if (!options.skipLocalUpdate) {
                    enqueuePendingStory(story);
                }
                return null;
            }
        }
        return null;
    }

    async function deleteRemoteStory(story) {
        if (!hasFirestore() || !story || !story.id) return;
        try {
            const currentUid = getCurrentUserUid();
            if (story.authorUid && currentUid && story.authorUid !== currentUid) return;
            const storyRef = getStoryDocRef(story.id);
            await window.deleteDoc(storyRef);
        } catch (err) {
            console.warn('Uzak hikaye silme hatası:', err);
        }
    }

    function handleRemoteSnapshot(snapshot) {
        const remoteDocs = [];
        snapshot.forEach((docSnap) => {
            const story = normalizeRemoteStory(docSnap.id, docSnap.data());
            if (story) remoteDocs.push(story);
        });
        mergeRemoteStories(remoteDocs);
    }

    async function initRemoteStories() {
        const backendReady = await waitForBackendReady();
        if (!backendReady || !hasFirestore()) return;
        if (remoteListenerAttached || !window.onSnapshot) {
            await loadRemoteStoriesOnce();
            return;
        }
        const q = window.query(window.collection(window.db, STORY_COLLECTION), window.orderBy('timestamp', 'desc'), window.limit(100));
        try {
            window.onSnapshot(q, handleRemoteSnapshot);
            remoteListenerAttached = true;
            await loadRemoteStoriesOnce();
        } catch (err) {
            console.warn('Remote story listener kurulamadı:', err);
            await loadRemoteStoriesOnce();
        }
    }

    function attachStorySyncListeners() {
        if (window.auth && typeof window.auth.onAuthStateChanged === 'function' && !window.__storyAuthListenerAttached) {
            window.__storyAuthListenerAttached = true;
            window.auth.onAuthStateChanged(() => {
                schedulePendingStorySync();
                void initRemoteStories();
            });
        }
        if (!window.__storyVisibilityListenerAttached) {
            window.__storyVisibilityListenerAttached = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    schedulePendingStorySync();
                }
            });
            window.addEventListener('focus', () => {
                schedulePendingStorySync();
            });
        }
    }

    // initialize stories with create card + loaded ones
    (function initStories() {
        const loaded = loadStories();
        stories = [{ id: 'create', type: 'create', label: 'Stori Oluştur', img: 'assets/img/strandsaydamv2.png' }].concat(loaded);
    })();

    function render() {
        container.innerHTML = '';
        const createCard = document.createElement('div');
        createCard.className = 'story-card';
        createCard.dataset.id = 'create';
        createCard.innerHTML = `
            <div class="story-create">
                <div class="plus-btn">+</div>
                <div class="story-label">Stori Oluştur</div>
            </div>`;
        createCard.addEventListener('click', () => openCreateModal());
        container.appendChild(createCard);

        const grouped = new Map();
        stories.filter(s => s.type === 'story').forEach((s) => {
            const key = s.groupKey || getStoryGroupKey(s);
            if (!grouped.has(key)) {
                grouped.set(key, { key, stories: [], preview: s, latestTimestamp: s.timestamp || 0 });
            }
            const group = grouped.get(key);
            group.stories.push(s);
            group.latestTimestamp = Math.max(group.latestTimestamp || 0, s.timestamp || 0);
            if (s.timestamp < (group.preview.timestamp || Infinity)) {
                group.preview = s;
            }
        });

        const groupedStories = Array.from(grouped.values()).sort((a, b) => b.preview.timestamp - a.preview.timestamp);

        groupedStories.forEach(group => {
            const s = group.preview;
            const card = document.createElement('div');
            card.className = 'story-card';
            card.dataset.id = s.id;

            if (s.img) {
                const img = document.createElement('img');
                img.className = 'story-cover';
                img.src = s.img;
                img.alt = s.label || 'Hikaye';
                card.appendChild(img);
            } else {
                const textCover = document.createElement('div');
                textCover.className = 'story-text-cover';
                textCover.style.background = s.textStyle?.bgColor || 'rgba(15,23,42,0.92)';
                textCover.style.color = s.textStyle?.textColor || '#ffffff';
                textCover.style.fontFamily = s.textStyle?.fontFamily || 'system-ui, sans-serif';
                textCover.style.display = 'flex';
                textCover.style.flexDirection = 'column';
                textCover.style.alignItems = 'center';
                textCover.style.justifyContent = 'center';
                textCover.style.gap = '6px';
                textCover.style.padding = '16px';
                const titleText = (s.title || '').trim();
                const contentText = (s.content || '').trim();
                if (titleText) {
                    const titleEl = document.createElement('div');
                    titleEl.className = 'story-preview-title';
                    titleEl.textContent = titleText;
                    textCover.appendChild(titleEl);
                }
                if (contentText) {
                    const contentEl = document.createElement('div');
                    contentEl.className = 'story-preview-content';
                    contentEl.textContent = contentText;
                    textCover.appendChild(contentEl);
                }
                if (!titleText && !contentText) {
                    const fallback = document.createElement('div');
                    fallback.textContent = s.label || 'Hikaye';
                    textCover.appendChild(fallback);
                }
                card.appendChild(textCover);
            }

            const avatar = document.createElement('img');
            avatar.className = 'story-small-avatar';
            avatar.src = s.avatar || s.img || 'assets/img/strendsaydamv2.png';
            avatar.alt = s.user || '';
            card.appendChild(avatar);

            const countBadge = document.createElement('div');
            countBadge.className = 'story-count-badge';
            countBadge.textContent = `${group.stories.length} hikaye`;
            card.appendChild(countBadge);

            const grad = document.createElement('div');
            grad.className = 'overlay-gradient';
            card.appendChild(grad);

            const currentUid = window.auth?.currentUser?.uid;
            const isOwnStory = currentUid && currentUid === s.authorUid;
            const txt = document.createElement('div');
            txt.className = 'story-text-overlay';
            txt.innerHTML = `${s.user ? escapeHtml(s.user) : ''}${isOwnStory ? `<br/>${escapeHtml(s.label || '')}` : ''}`;
            card.appendChild(txt);

            if (group.stories.length > 1) {
                const countBadge = document.createElement('div');
                countBadge.className = 'story-group-count';
                countBadge.textContent = `${group.stories.length} hikaye`;
                card.appendChild(countBadge);
            }

            const lastViewedAt = viewedGroups.get(group.key) || 0;
            const avatarClass = lastViewedAt >= (group.latestTimestamp || 0) ? 'story-small-avatar seen' : 'story-small-avatar unseen';
            avatar.className = avatarClass;
            card.addEventListener('click', () => {
                openViewer(s);
            });
            container.appendChild(card);
        });

        const hasUserStories = groupedStories.length > 0;
        if (!hasUserStories) {
            const empty = document.createElement('div');
            empty.className = 'story-empty';
            empty.innerHTML = '<div class="story-empty-inner">Henüz hikaye oluşturulmadı</div>';
            container.appendChild(empty);
        }
    }

    function openViewer(story) {
        // Build playlist: all stories for this author group and show the oldest first
        const playlist = stories
            .filter(s => s.type === 'story' && s.groupKey === story.groupKey)
            .sort((a, b) => a.timestamp - b.timestamp);
        if (!playlist || playlist.length === 0) return;
        let current = playlist.findIndex((p) => p.id === story.id);
        if (current < 0) current = 0;

        let overlay = document.getElementById('story-viewer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'story-viewer-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);z-index:2147483647;padding:20px;isolation:isolate;';
            document.body.appendChild(overlay);
        }

        let autoTimer = null;
        let countdownTimer = null;

        function clearTimers() {
            if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
            if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        }

        function renderViewer() {
            clearTimers();
            const item = playlist[current];
            overlay.innerHTML = '';

            const viewer = document.createElement('div'); viewer.className = 'story-viewer';
            const inner = document.createElement('div'); inner.className = 'story-viewer-inner';

            // top
            const top = document.createElement('div'); top.className = 'story-viewer-top';
            const meta = document.createElement('div'); meta.className = 'meta';
            const avatar = document.createElement('img'); avatar.src = item.avatar || 'assets/img/strendsaydamv2.png';
            const who = document.createElement('div'); who.innerHTML = `<div class="who">${item.user || ''}</div>`;
            meta.appendChild(avatar); meta.appendChild(who);
            const right = document.createElement('div');
            const closeBtn = document.createElement('button'); closeBtn.className = 'story-viewer-close'; closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => { clearTimers(); overlay.remove(); });
            right.appendChild(closeBtn);
            top.appendChild(meta); top.appendChild(right);

            // media
            const media = document.createElement('div'); media.className = 'story-viewer-media';
            const prog = document.createElement('div'); prog.className = 'story-viewer-progress';
            playlist.forEach((p, idx) => {
                const seg = document.createElement('div'); seg.className = 'seg'; seg.dataset.idx = idx;
                const fill = document.createElement('div'); fill.className = 'fill'; seg.appendChild(fill); prog.appendChild(seg);
            });
            media.appendChild(prog);

            const currentUid = getCurrentUserUid();
            const isOwner = currentUid && item.authorUid && currentUid === item.authorUid;
            const liked = isStoryLikedByCurrentUser(item);
            const createActionButton = (className, title, html, handler) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `story-action-btn ${className}`;
                btn.title = title;
                btn.innerHTML = html;
                btn.addEventListener('click', handler);
                return btn;
            };

            if (item.img) {
                const img = document.createElement('img'); img.src = item.img; img.alt = item.label || ''; img.className = 'story-viewer-photo';
                media.appendChild(img);
            } else {
                const textBlock = document.createElement('div');
                textBlock.className = 'story-viewer-text';
                textBlock.style.background = item.textStyle?.bgColor || 'rgba(255,255,255,0.95)';
                textBlock.style.color = item.textStyle?.textColor || 'var(--text-main)';
                textBlock.style.fontFamily = item.textStyle?.fontFamily || 'system-ui, sans-serif';
                textBlock.style.display = 'flex';
                textBlock.style.flexDirection = 'column';
                textBlock.style.alignItems = 'center';
                textBlock.style.justifyContent = 'center';
                textBlock.style.gap = '10px';
                textBlock.style.padding = '24px';
                textBlock.style.textAlign = 'center';
                const storyBody = (item.content || item.label || '').trim();
                if (storyBody) {
                    const contentEl = document.createElement('div');
                    contentEl.className = 'story-viewer-content-text';
                    contentEl.textContent = storyBody;
                    textBlock.appendChild(contentEl);
                } else if (item.title) {
                    textBlock.textContent = 'İçerik eklenmedi';
                } else {
                    textBlock.textContent = 'Hikaye';
                }
                media.appendChild(textBlock);
            }

            const mediaActions = document.createElement('div'); mediaActions.className = 'story-media-actions';
            const leftActions = document.createElement('div'); leftActions.className = 'story-media-actions-left';
            const rightActions = document.createElement('div'); rightActions.className = 'story-media-actions-right';
            const likeBtn = document.createElement('button'); likeBtn.type = 'button'; likeBtn.className = `story-action-btn story-like-btn${liked ? ' liked' : ''}`;
            likeBtn.title = 'Beğen';
            likeBtn.innerHTML = `<i class="fa-solid fa-heart"></i><span class="like-count">${Number(item.likesCount || 0)}</span>`;
            likeBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                await toggleStoryLike(item);
                renderViewer();
            });
            const reportBtn = document.createElement('button'); reportBtn.type = 'button'; reportBtn.className = 'story-action-btn story-report-btn'; reportBtn.title = 'Şikayet et'; reportBtn.innerHTML = '<i class="fa-solid fa-flag"></i>';
            reportBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                await reportStory(item);
            });
            const expandBtn = document.createElement('button'); expandBtn.type = 'button'; expandBtn.className = 'story-action-btn'; expandBtn.title = 'Resmi büyüt'; expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            expandBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const openUrl = async (href) => {
                    const link = document.createElement('a');
                    link.href = href;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                };

                if (typeof item.img === 'string' && item.img.startsWith('data:image/')) {
                    try {
                        const parts = item.img.split(',');
                        const mime = parts[0].match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
                        const byteString = atob(parts[1] || '');
                        const array = new Uint8Array(byteString.length);
                        for (let i = 0; i < byteString.length; i += 1) {
                            array[i] = byteString.charCodeAt(i);
                        }
                        const blob = new Blob([array], { type: mime });
                        const objectUrl = URL.createObjectURL(blob);
                        await openUrl(objectUrl);
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
                        return;
                    } catch (innerErr) {
                        console.warn('Data URI açılırken hata:', innerErr);
                    }
                }

                await openUrl(item.img);
            });
            const downloadBtn = document.createElement('button'); downloadBtn.type = 'button'; downloadBtn.className = 'story-action-btn'; downloadBtn.title = 'Resmi indir'; downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
            downloadBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const link = document.createElement('a');
                link.href = item.img;
                link.download = (item.label ? item.label.replace(/[^a-z0-9\.\-_ ]/gi, '') : 'story') + '.jpg';
                document.body.appendChild(link);
                link.click();
                link.remove();
            });
            const editTextBtn = document.createElement('button'); editTextBtn.type = 'button'; editTextBtn.className = 'story-action-btn'; editTextBtn.title = 'Yazıyı düzenle'; editTextBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
            editTextBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const newText = prompt('Hikaye içeriğini düzenleyin:', item.content || item.label || '');
                if (newText === null) return;
                item.content = newText.trim();
                item.label = newText.trim();
                saveStories();
                if (item.remote) {
                    try {
                        const storyRef = getStoryDocRef(item.id);
                        await window.setDoc(storyRef, buildFirestoreStory(item));
                    } catch (err) {
                        console.warn('Yazı hikayesi uzaktan kaydedilemedi:', err);
                    }
                }
                renderViewer();
            });
            const deleteBtn = document.createElement('button'); deleteBtn.type = 'button'; deleteBtn.className = 'story-action-btn'; deleteBtn.title = 'Bu storiyi sil'; deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                if (!confirm('Bu storiyi silmek istediğinizden emin misiniz?')) return;
                const removedId = item.id;
                const idx = stories.findIndex(s => s.id === removedId);
                if (idx >= 0) {
                    const removedStory = stories[idx];
                    stories.splice(idx, 1);
                    saveStories();
                    await deleteRemoteStory(removedStory);
                    if (playlist.length > 1) {
                        playlist.splice(current, 1);
                        if (current >= playlist.length) current = playlist.length - 1;
                        renderViewer();
                    } else {
                        clearTimers();
                        overlay.remove();
                    }
                    render();
                }
            });
            leftActions.appendChild(likeBtn);
            leftActions.appendChild(reportBtn);
            if (item.img) {
                rightActions.appendChild(expandBtn);
                rightActions.appendChild(downloadBtn);
            }
            if (isOwner && !item.img) {
                rightActions.appendChild(editTextBtn);
            }
            if (isOwner) {
                rightActions.appendChild(deleteBtn);
            }
            mediaActions.appendChild(leftActions);
            mediaActions.appendChild(rightActions);
            media.appendChild(mediaActions);

            // nav
            const navLeft = document.createElement('button'); navLeft.className = 'story-nav left'; navLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            const navRight = document.createElement('button'); navRight.className = 'story-nav right'; navRight.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            navLeft.addEventListener('click', (ev) => { ev.stopPropagation(); prevStory(); });
            navRight.addEventListener('click', (ev) => { ev.stopPropagation(); nextStory(); });

            // footer
            const footer = document.createElement('div'); footer.className = 'story-viewer-footer';
            const footerTop = document.createElement('div'); footerTop.className = 'story-viewer-footer-top';
            const viewerTitle = (item.title || item.label || '').trim();
            footerTop.innerHTML = `<div class="story-viewer-footer-row"><div class="story-title-actions"><div class="story-viewer-title">${escapeHtml(viewerTitle)}</div>${isOwner ? '<button type="button" class="story-edit-btn" title="Başlığı Düzenle"><i class="fa-solid fa-pen"></i></button>' : ''}</div><div class="story-viewer-time">${item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</div></div>`;
            const editBtn = footerTop.querySelector('.story-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    const newTitle = prompt('Stori başlığını girin:', item.title || item.label || '');
                    if (newTitle === null) return;
                    item.title = newTitle.trim();
                    item.label = newTitle.trim();
                    saveStories();
                    if (item.remote) {
                        try {
                            const storyRef = getStoryDocRef(item.id);
                            await window.setDoc(storyRef, buildFirestoreStory(item));
                        } catch (err) {
                            console.warn('Başlık uzak depoya kaydedilemedi:', err);
                        }
                    }
                    renderViewer();
                });
            }
            footer.appendChild(footerTop);

            inner.appendChild(top);
            inner.appendChild(media);
            inner.appendChild(footer);
            viewer.appendChild(inner);
            viewer.appendChild(navLeft);
            viewer.appendChild(navRight);
            overlay.appendChild(viewer);

            if (current === playlist.length - 1 && item.groupKey) {
                markGroupViewed(item.groupKey, item.timestamp || Date.now());
            }

            // prevent overlay close when clicking viewer
            viewer.addEventListener('click', (ev) => ev.stopPropagation());
            overlay.addEventListener('click', (ev) => { if (ev.target === overlay) { clearTimers(); overlay.remove(); } });

            function startProgress() {
                const fills = overlay.querySelectorAll('.story-viewer-progress .seg .fill');
                fills.forEach((f, i) => { f.style.transition = 'none'; f.style.width = i < current ? '100%' : '0%'; });
                const curFill = overlay.querySelector(`.story-viewer-progress .seg[data-idx="${current}"] .fill`);
                const countdownLabelEl = overlay.querySelector('.story-viewer-countdown');
                const totalSeconds = 10;
                const hasNext = playlist.length > 1 && current < playlist.length - 1;

                if (hasNext) {
                    if (curFill) { void curFill.offsetWidth; curFill.style.transition = 'width 10s linear'; curFill.style.width = '100%'; }
                    if (countdownLabelEl) {
                        countdownLabelEl.style.display = 'none';
                    }
                    clearTimers();
                    autoTimer = setTimeout(() => { nextStory(); }, totalSeconds * 1000);
                } else {
                    if (curFill) { curFill.style.width = '100%'; }
                    if (countdownLabelEl) {
                        countdownLabelEl.style.display = 'none';
                    }
                    clearTimers();
                }
            }

            function nextStory() { clearTimers(); if (current < playlist.length - 1) { current++; renderViewer(); } }
            function prevStory() { clearTimers(); if (current > 0) { current--; renderViewer(); } }

            startProgress();
        }

        renderViewer();
    }


    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* Story create modal and handlers */
    function openCreateModal() {
        let modal = document.getElementById('story-upload-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'story-upload-modal';
            modal.className = 'story-upload-modal';
            modal.innerHTML = `
                <div class="story-upload-modal-inner" role="dialog" aria-modal="true">
                    <h3>Stori Oluştur</h3>
                    <div style="margin:8px 0 12px; color:var(--text-muted); font-size:0.95rem;">Bir seçenek seçip ona göre içerik oluşturabilirsin.</div>
                    <div id="story-mode-picker" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                        <button type="button" data-mode="image" class="post-action-btn icon-btn story-mode-btn">Resim</button>
                        <button type="button" data-mode="text" class="post-action-btn icon-btn story-mode-btn">Metin</button>
                    </div>
                    <div id="story-title-wrap" style="display:none; margin-bottom:10px;">
                        <label style="display:block; margin-bottom:6px; font-weight:700; color:var(--text-main);">Başlık</label>
                        <input id="story-title-input" type="text" placeholder="Stori başlığını yazın" style="width:100%; padding:12px 14px; border-radius:12px; border:1px solid var(--border); background:var(--input-bg); color:var(--text-main); font-size:1rem; box-sizing:border-box;">
                    </div>
                    <div id="story-image-panel" style="display:none;">
                        <input id="story-file-input" type="file" accept="image/*" style="display:none;">
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <button id="story-select-btn" class="post-action-btn icon-btn">Resim Seç</button>
                            <div id="story-preview-wrap" style="flex:1; min-width:160px;"></div>
                        </div>
                    </div>
                    <div id="story-text-panel" style="display:none;">
                        <label style="display:block; margin-bottom:6px; font-weight:700; color:var(--text-main);">İçerik</label>
                        <textarea id="story-content-input" rows="5" placeholder="Hikaye içeriğini yazın" style="width:100%; padding:12px 14px; border-radius:12px; border:1px solid var(--border); background:var(--input-bg); color:var(--text-main); font-size:1rem; box-sizing:border-box; resize:vertical;"></textarea>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                        <button id="story-cancel-btn" class="post-action-btn">İptal</button>
                        <button id="story-post-btn" class="post-action-btn primary">Gönder</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            // event wiring
            const fileInput = modal.querySelector('#story-file-input');
            const selectBtn = modal.querySelector('#story-select-btn');
            const previewWrap = modal.querySelector('#story-preview-wrap');
            const titleInput = modal.querySelector('#story-title-input');
            const contentInput = modal.querySelector('#story-content-input');
            const titleWrap = modal.querySelector('#story-title-wrap');
            const imagePanel = modal.querySelector('#story-image-panel');
            const textPanel = modal.querySelector('#story-text-panel');
            const modeButtons = modal.querySelectorAll('.story-mode-btn');
            const cancelBtn = modal.querySelector('#story-cancel-btn');
            const postBtn = modal.querySelector('#story-post-btn');
            let selectedDataUrl = '';
            let selectedFile = null;
            let activeMode = null;

            const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            modeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    activeMode = btn.dataset.mode;
                    modeButtons.forEach(item => item.classList.toggle('active', item === btn));
                    titleWrap.style.display = 'block';
                    if (activeMode === 'image') {
                        imagePanel.style.display = 'block';
                        textPanel.style.display = 'none';
                    } else {
                        imagePanel.style.display = 'none';
                        textPanel.style.display = 'block';
                    }
                });
            });

            selectBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                selectedFile = file;
                try {
                    selectedDataUrl = await readFileAsDataUrl(file);
                    previewWrap.innerHTML = `<img src="${selectedDataUrl}" style="max-width:160px; max-height:120px; display:block; border-radius:8px;">`;
                    previewWrap.dataset.img = selectedDataUrl;
                } catch (err) {
                    console.warn('Hikaye resmi okunamadı:', err);
                    alert('Resim yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
                }
            });


            cancelBtn.addEventListener('click', () => modal.remove());
            postBtn.addEventListener('click', async () => {
                let imgData = previewWrap.dataset.img || selectedDataUrl;
                const title = titleInput.value.trim();
                const content = contentInput ? contentInput.value.trim() : '';
                const storyText = title || content || '';
                if (activeMode === 'image' && !imgData && selectedFile) {
                    try {
                        imgData = await readFileAsDataUrl(selectedFile);
                        selectedDataUrl = imgData;
                        previewWrap.innerHTML = `<img src="${imgData}" style="max-width:160px; max-height:120px; display:block; border-radius:8px;">`;
                    } catch (err) {
                        console.warn('Hikaye resmi okunamadı:', err);
                    }
                }
                if (!activeMode) { alert('Lütfen bir seçenek seçin.'); return; }
                if (activeMode === 'image' && !imgData) { alert('Lütfen bir görsel seçin.'); return; }
                if (activeMode === 'text' && !storyText) { alert('Lütfen başlık ya da içerik girin.'); return; }
                const id = 's_' + Date.now();
                const authorUid = window.auth?.currentUser?.uid || (window.user && window.user.uid) || null;
                const authorName = (window.user && (window.user.displayName || window.user.username)) || 'Sen';
                const storyObj = {
                    id,
                    type: 'story',
                    title: title || '',
                    content: content || '',
                    label: activeMode === 'text' ? (content || title || '') : (title || content || ''),
                    user: authorName,
                    avatar: (window.user && window.user.avatarUrl) || 'assets/img/strendsaydamv2.png',
                    img: activeMode === 'image' ? (imgData || '') : '',
                    file: activeMode === 'image' ? selectedFile : null,
                    timestamp: Date.now(),
                    comments: [],
                    likesCount: 0,
                    likedBy: [],
                    textStyle: {
                        fontFamily: 'system-ui, sans-serif',
                        bgColor: '#0f172a',
                        textColor: '#ffffff'
                    },
                    authorUid,
                    groupKey: authorUid || authorName
                };
                if (selectedFile && !imgData) {
                    try {
                        storyObj.img = await readFileAsDataUrl(selectedFile);
                    } catch (err) {
                        console.warn('Seçilen dosya önbelleğe alınamadı:', err);
                    }
                }
                stories.push(storyObj);
                saveStories();
                enqueuePendingStory(storyObj);
                const remoteUrl = await saveStoryToBackend(storyObj);
                if (remoteUrl) {
                    storyObj.remote = true;
                    storyObj.img = remoteUrl;
                    saveStories();
                } else if (storyObj.img) {
                    storyObj.remote = false;
                    saveStories();
                }
                modal.remove();
                render();
            });
        }
    }

    render();
    void removeExpiredStories();
    attachStorySyncListeners();
    schedulePendingStorySync();
    void initRemoteStories();
});
