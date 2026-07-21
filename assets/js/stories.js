// Simple stories renderer and viewer
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('stories-row');
    if (!container) return;

    // stories array will contain the create card plus persisted stories
    let stories = [];

    function loadStories() {
        try {
            const raw = localStorage.getItem('slt_stories');
            if (!raw) return [];
            const arr = JSON.parse(raw);
            const now = Date.now();
            const day = 24 * 60 * 60 * 1000;
            // filter expired (older than 24 hours)
            const valid = arr.filter(s => s.timestamp && (now - s.timestamp) < day);
            return valid;
        } catch (e) {
            return [];
        }
    }

    function saveStories() {
        try {
            const toSave = stories.filter(s => s.type === 'story');
            localStorage.setItem('slt_stories', JSON.stringify(toSave));
        } catch (e) {}
    }

    // initialize stories with create card + loaded ones
    (function initStories() {
        const loaded = loadStories();
        stories = [{ id: 'create', type: 'create', label: 'Hikaye Oluştur', img: 'assets/img/strendsaydamv2.png' }].concat(loaded);
    })();

    function render() {
        container.innerHTML = '';
        stories.forEach(s => {
            const card = document.createElement('div');
            card.className = 'story-card';
            card.dataset.id = s.id;

            if (s.type === 'create') {
                card.innerHTML = `
                    <div class="story-create">
                        <div class="plus-btn">+</div>
                        <div class="story-label">${s.label}</div>
                    </div>`;
                card.addEventListener('click', () => {
                    openCreateModal();
                });
            } else {
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

                const grad = document.createElement('div');
                grad.className = 'overlay-gradient';
                card.appendChild(grad);

                const txt = document.createElement('div');
                txt.className = 'story-text-overlay';
                txt.innerHTML = `${s.user ? s.user + '<br/>' : ''}${s.label || ''}`;
                card.appendChild(txt);

                // delete button for own stories
                const currentName = (window.user && (window.user.displayName || window.user.username)) || null;
                    if (currentName && s.user && (s.user === currentName || s.user === 'Sen')) {
                        const delBtn = document.createElement('button');
                        delBtn.className = 'story-delete-btn';
                        delBtn.title = 'Hikayeyi sil';
                        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                        delBtn.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            if (!confirm('Bu hikayeyi silmek istediğinizden emin misiniz?')) return;
                            const idx = stories.findIndex(x => x.id === s.id);
                            if (idx >= 0) {
                                stories.splice(idx, 1);
                                saveStories();
                                render();
                            }
                        });
                        card.appendChild(delBtn);
                    }

                    card.addEventListener('click', () => openViewer(s));
            }

            container.appendChild(card);
        });

        // If there are no user stories (only the create card), show empty state
        const hasUserStories = stories.some(s => s.type === 'story');
        if (!hasUserStories) {
            const empty = document.createElement('div');
            empty.className = 'story-empty';
            empty.innerHTML = '<div class="story-empty-inner">Henüz hikaye oluşturulmadı</div>';
            container.appendChild(empty);
        }
    }

    function openViewer(story) {
        // Build playlist: all stories for this user
        const playlist = stories.filter(s => s.type === 'story' && s.user === story.user);
        if (!playlist || playlist.length === 0) return;
        let current = playlist.findIndex(s => s.id === story.id);
        if (current < 0) current = 0;

        let overlay = document.getElementById('story-viewer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'story-viewer-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);z-index:4000;padding:20px;';
            document.body.appendChild(overlay);
        }

        let autoTimer = null;

        function clearTimers() {
            if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
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
            const who = document.createElement('div'); who.innerHTML = `<div class="who">${item.user || ''}</div><div class="label">${item.label || ''}</div>`;
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
            expandBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                window.open(item.img, '_blank');
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
            mediaActions.appendChild(expandBtn);
            mediaActions.appendChild(downloadBtn);
            media.appendChild(mediaActions);

            // nav
            const navLeft = document.createElement('button'); navLeft.className = 'story-nav left'; navLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            const navRight = document.createElement('button'); navRight.className = 'story-nav right'; navRight.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            navLeft.addEventListener('click', (ev) => { ev.stopPropagation(); prevStory(); });
            navRight.addEventListener('click', (ev) => { ev.stopPropagation(); nextStory(); });

            // footer
            const footer = document.createElement('div'); footer.className = 'story-viewer-footer';
            const footerTop = document.createElement('div'); footerTop.className = 'story-viewer-footer-top';
            footerTop.innerHTML = `<div class="story-viewer-user">${item.user || ''}</div><div class="story-viewer-time">${item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</div>`;
            const comments = document.createElement('div'); comments.className = 'story-comments'; comments.innerHTML = renderCommentsHtml(item);
            const commentRow = document.createElement('div'); commentRow.className = 'comment-row';
            commentRow.innerHTML = `<input id="story-comment-input" placeholder="Yorum yaz..." /><button id="story-comment-btn" class="post-action-btn primary">Yorumu Gönder</button>`;
            footer.appendChild(footerTop);
            footer.appendChild(comments);
            footer.appendChild(commentRow);

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

            // comment posting
            const postBtn = overlay.querySelector('#story-comment-btn');
            const commentInput = overlay.querySelector('#story-comment-input');
            postBtn.addEventListener('click', () => {
                const text = commentInput.value.trim(); if (!text) return;
                item.comments = item.comments || [];
                const whoName = (window.user && (window.user.displayName || window.user.username)) || 'Sen';
                item.comments.push({ author: whoName, text, ts: Date.now() });
                const commentsDiv = overlay.querySelector('.story-comments'); if (commentsDiv) commentsDiv.innerHTML = renderCommentsHtml(item);
                commentInput.value = '';
                saveStories();
            });

            function startProgress() {
                const fills = overlay.querySelectorAll('.story-viewer-progress .seg .fill');
                fills.forEach((f, i) => { f.style.transition = 'none'; f.style.width = i < current ? '100%' : '0%'; });
                const curFill = overlay.querySelector(`.story-viewer-progress .seg[data-idx="${current}"] .fill`);
                if (curFill) { void curFill.offsetWidth; curFill.style.transition = 'width 5s linear'; curFill.style.width = '100%'; }
                clearTimers(); autoTimer = setTimeout(() => { nextStory(); }, 5000);
            }

            function nextStory() { clearTimers(); if (current < playlist.length - 1) { current++; renderViewer(); } }
            function prevStory() { clearTimers(); if (current > 0) { current--; renderViewer(); } }

            startProgress();
        }

        renderViewer();
    }

    function renderCommentsHtml(story) {
        if (!story.comments || story.comments.length === 0) return '<div style="color:var(--text-muted);">Henüz yorum yok.</div>';
        return story.comments.map(c => `<div style="padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="display:block">${escapeHtml(c.author)}</strong><div style="font-size:0.95rem">${escapeHtml(c.text)}</div></div>`).join('');
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
                    <h3>Hikaye Oluştur</h3>
                    <div style="margin:8px 0 12px; color:var(--text-muted); font-size:0.95rem;">Görsel seç ve kısa bir başlık ekle.</div>
                    <input id="story-file-input" type="file" accept="image/*" style="display:none;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button id="story-select-btn" class="post-action-btn icon-btn">Resim Seç</button>
                        <div id="story-preview-wrap" style="flex:1;"></div>
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
            const cancelBtn = modal.querySelector('#story-cancel-btn');
            const postBtn = modal.querySelector('#story-post-btn');

            selectBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    previewWrap.innerHTML = `<img src="${ev.target.result}" style="max-width:160px; max-height:120px; display:block; border-radius:8px;">`;
                    previewWrap.dataset.img = ev.target.result;
                };
                reader.readAsDataURL(file);
            });

            cancelBtn.addEventListener('click', () => modal.remove());
            postBtn.addEventListener('click', () => {
                const imgData = previewWrap.dataset.img;
                const caption = modal.querySelector('#story-caption').value.trim();
                if (!imgData) { alert('Lütfen bir görsel seçin.'); return; }
                // add story to array (with timestamp for expiry)
                const id = 's_' + Date.now();
                const storyObj = { id, type: 'story', label: caption || '', user: (window.user && window.user.displayName) || 'Sen', avatar: (window.user && window.user.avatarUrl) || 'assets/img/strendsaydamv2.png', img: imgData, timestamp: Date.now(), comments: [] };
                stories.push(storyObj);
                // persist and refresh
                saveStories();
                modal.remove();
                render();
            });
        }
    }

    render();
});
