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
        return {
            ...story,
            groupKey: story.groupKey || getStoryGroupKey(story)
        };
    }

    const VIEWED_GROUPS_KEY = 'slt_viewed_story_groups';

    function loadViewedGroups() {
        try {
            const raw = localStorage.getItem(VIEWED_GROUPS_KEY);
            if (!raw) return new Set();
            const arr = JSON.parse(raw);
            return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
        } catch (e) {
            return new Set();
        }
    }

    function saveViewedGroups(viewedGroups) {
        try {
            localStorage.setItem(VIEWED_GROUPS_KEY, JSON.stringify(Array.from(viewedGroups)));
        } catch (e) {}
    }

    const viewedGroups = loadViewedGroups();

    function markGroupViewed(groupKey) {
        if (!groupKey || viewedGroups.has(groupKey)) return;
        viewedGroups.add(groupKey);
        saveViewedGroups(viewedGroups);
        render();
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
        if (!hasFirestore() || !window.auth?.currentUser || !window.ref || !window.uploadBytes || !window.getDownloadURL || !window.storage) {
            throw new Error('Storage backend hazır değil');
        }
        const ext = file.name.split('.').pop();
        const storagePath = `stories/${window.auth.currentUser.uid}/${Date.now()}.${ext}`;
        const storageRef = window.ref(window.storage, storagePath);
        const snapshot = await window.uploadBytes(storageRef, file);
        return await window.getDownloadURL(snapshot.ref);
    }

    async function waitForBackendReady(timeout = 12000) {
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
            label: data.label || data.caption || '',
            user: data.authorName || data.author || data.user || 'Bilinmeyen',
            avatar: data.avatarUrl || data.authorAvatar || 'assets/img/strendsaydamv2.png',
            img: data.img || data.imageData || '',
            timestamp,
            comments: Array.isArray(data.comments) ? data.comments : [],
            authorUid: data.authorUid || null,
            groupKey: data.authorUid || data.authorName || data.author || data.user || 'unknown',
            expiresAt,
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
                storyMap.set(story.id, story);
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
        const currentUser = window.user || {};
        return {
            authorUid: window.auth?.currentUser?.uid || currentUser.uid || null,
            authorName: currentUser.displayName || currentUser.username || story.user || 'Sen',
            authorAvatar: currentUser.avatarUrl || story.avatar || 'assets/img/strendsaydamv2.png',
            label: story.label || '',
            caption: story.label || '',
            img: story.img,
            imageData: story.img,
            timestamp: window.serverTimestamp ? window.serverTimestamp() : new Date(),
            comments: Array.isArray(story.comments) ? story.comments : [],
            expiresAt: new Date(Date.now() + STORY_EXPIRY_MS),
        };
    }

    async function saveStoryToBackend(story) {
        if (!hasFirestore() || !window.auth?.currentUser || !story || story.type !== 'story') return null;
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
            return imageUrl;
        } catch (err) {
            console.warn('Hikaye uzak depoya kaydedilemedi:', err);
            return null;
        }
    }

    async function deleteRemoteStory(story) {
        if (!hasFirestore() || !window.auth?.currentUser || !story || !story.id) return;
        try {
            if (story.authorUid && story.authorUid !== window.auth.currentUser.uid) return;
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
        } catch (err) {
            console.warn('Remote story listener kurulamadı:', err);
            await loadRemoteStoriesOnce();
        }
    }

    // initialize stories with create card + loaded ones
    (function initStories() {
        const loaded = loadStories();
        stories = [{ id: 'create', type: 'create', label: 'Stori Oluştur', img: 'assets/img/strendsaydamv2.png' }].concat(loaded);
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
                grouped.set(key, { key, stories: [], preview: s });
            }
            const group = grouped.get(key);
            group.stories.push(s);
            if (s.timestamp > (group.preview.timestamp || 0)) {
                group.preview = s;
            }
        });

        const groupedStories = Array.from(grouped.values()).sort((a, b) => b.preview.timestamp - a.preview.timestamp);

        groupedStories.forEach(group => {
            const s = group.preview;
            const card = document.createElement('div');
            card.className = 'story-card';
            card.dataset.id = s.id;

            const img = document.createElement('img');
            img.className = 'story-cover';
            img.src = s.img;
            img.alt = s.label || 'Hikaye';
            card.appendChild(img);

            const avatar = document.createElement('img');
            avatar.className = 'story-small-avatar';
            avatar.src = s.avatar || s.img;
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

            const avatarClass = viewedGroups.has(group.key) ? 'story-small-avatar seen' : 'story-small-avatar unseen';
            avatar.className = avatarClass;
            card.addEventListener('click', () => {
                if (group.key) {
                    markGroupViewed(group.key);
                }
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
        let current = 0;

        let overlay = document.getElementById('story-viewer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'story-viewer-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);z-index:4000;padding:20px;';
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

            // progress
            const prog = document.createElement('div'); prog.className = 'story-viewer-progress';
            playlist.forEach((p, idx) => {
                const seg = document.createElement('div'); seg.className = 'seg'; seg.dataset.idx = idx;
                const fill = document.createElement('div'); fill.className = 'fill'; seg.appendChild(fill); prog.appendChild(seg);
            });

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
            const img = document.createElement('img'); img.src = item.img; img.alt = item.label || ''; img.className = 'story-viewer-photo';
            media.appendChild(img);

            const mediaActions = document.createElement('div'); mediaActions.className = 'story-media-actions';
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
            mediaActions.appendChild(expandBtn);
            mediaActions.appendChild(downloadBtn);
            mediaActions.appendChild(deleteBtn);
            media.appendChild(mediaActions);

            // nav
            const navLeft = document.createElement('button'); navLeft.className = 'story-nav left'; navLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            const navRight = document.createElement('button'); navRight.className = 'story-nav right'; navRight.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            navLeft.addEventListener('click', (ev) => { ev.stopPropagation(); prevStory(); });
            navRight.addEventListener('click', (ev) => { ev.stopPropagation(); nextStory(); });

            // footer
            const footer = document.createElement('div'); footer.className = 'story-viewer-footer';
            const footerTop = document.createElement('div'); footerTop.className = 'story-viewer-footer-top';
            footerTop.innerHTML = `<div class="story-viewer-footer-row"><div class="story-title-actions"><div class="story-viewer-title">${item.label || ''}</div><button type="button" class="story-edit-btn" title="Başlığı Düzenle"><i class="fa-solid fa-pen"></i></button></div><div class="story-viewer-countdown">${playlist.length > 1 ? '10 saniye sonra...' : 'Tek hikaye gösteriliyor'}</div><div class="story-viewer-time">${item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</div></div>`;
            const editBtn = footerTop.querySelector('.story-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    const newTitle = prompt('Stori başlığını girin:', item.label || '');
                    if (newTitle === null) return;
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

            inner.appendChild(prog);
            inner.appendChild(top);
            inner.appendChild(media);
            inner.appendChild(footer);
            viewer.appendChild(inner);
            viewer.appendChild(navLeft);
            viewer.appendChild(navRight);
            overlay.appendChild(viewer);

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
                    let remaining = totalSeconds;
                    if (curFill) { void curFill.offsetWidth; curFill.style.transition = 'width 10s linear'; curFill.style.width = '100%'; }
                    if (countdownLabelEl) {
                        countdownLabelEl.style.display = '';
                        countdownLabelEl.textContent = `10 saniyeden sonra sonraki hikayeye geçilecek...`;
                    }
                    const clearCountdown = () => {
                        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
                    };
                    clearTimers();
                    countdownTimer = setInterval(() => {
                        remaining -= 1;
                        if (countdownLabelEl) {
                            countdownLabelEl.textContent = `${remaining} saniye sonra sonraki hikayeye geçilecek...`;
                        }
                        if (remaining <= 0) {
                            clearCountdown();
                        }
                    }, 1000);
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
                    <div style="margin:8px 0 12px; color:var(--text-muted); font-size:0.95rem;">Görsel seç ve kısa bir başlık ekle.</div>
                    <input id="story-file-input" type="file" accept="image/*" style="display:none;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <button id="story-select-btn" class="post-action-btn icon-btn">Resim Seç</button>
                        <div id="story-preview-wrap" style="flex:1; min-width:160px;"></div>
                    </div>
                    <input id="story-caption" type="text" placeholder="Kısa başlık (opsiyonel)" style="width:100%; margin-top:10px; padding:10px; border-radius:10px; border:1px solid var(--border); background:var(--input-bg); color:var(--text-main);">
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
            const captionInput = modal.querySelector('#story-caption');
            const cancelBtn = modal.querySelector('#story-cancel-btn');
            const postBtn = modal.querySelector('#story-post-btn');
            let selectedDataUrl = '';
            let selectedFile = null;

            const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
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
                const caption = captionInput.value.trim();
                if (!imgData && selectedFile) {
                    try {
                        imgData = await readFileAsDataUrl(selectedFile);
                        selectedDataUrl = imgData;
                        previewWrap.innerHTML = `<img src="${imgData}" style="max-width:160px; max-height:120px; display:block; border-radius:8px;">`;
                    } catch (err) {
                        console.warn('Hikaye resmi okunamadı:', err);
                    }
                }
                if (!imgData) { alert('Lütfen bir görsel seçin.'); return; }
                const id = 's_' + Date.now();
                const authorUid = window.auth?.currentUser?.uid || (window.user && window.user.uid) || null;
                const authorName = (window.user && (window.user.displayName || window.user.username)) || 'Sen';
                const storyObj = {
                    id,
                    type: 'story',
                    label: caption || '',
                    user: authorName,
                    avatar: (window.user && window.user.avatarUrl) || 'assets/img/strendsaydamv2.png',
                    img: imgData,
                    file: selectedFile,
                    timestamp: Date.now(),
                    comments: [],
                    authorUid,
                    groupKey: authorUid || authorName
                };
                stories.push(storyObj);
                saveStories();
                const remoteUrl = await saveStoryToBackend(storyObj);
                if (remoteUrl) {
                    storyObj.remote = true;
                    storyObj.img = remoteUrl;
                    saveStories();
                }
                modal.remove();
                render();
            });
        }
    }

    render();
    initRemoteStories();
});
