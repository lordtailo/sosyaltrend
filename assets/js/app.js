import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, updateDoc, setDoc, arrayUnion, arrayRemove, deleteDoc, getDoc, getDocs, limit, where, increment, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ozelGunler, tarihteBugun, ramazanTakvimi } from "./calendarDays.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, updatePassword, sendPasswordResetEmail, updateProfile, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// HELPER FONKSİYONLAR
// Button'un "disabled/pending" durumuna koy
function disableButton(btn, text) {
    if (btn) {
        btn.innerHTML = text;
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
        btn.onclick = (e) => e.preventDefault();
    }
}

function enableButton(btn, text) {
    if (!btn) return;
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    if (text) btn.innerHTML = text;
}

// Update character counter below comment input
function updateCommentCount(postId) {
    const input = document.getElementById(`input-${postId}`);
    const counter = document.getElementById(`charcount-${postId}`);
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/500`;
}

window.updateCommentCount = updateCommentCount;
window.commentReplyContext = {};

window.prepareReply = function(button) {
    if (!button) return;
    const postId = button.dataset.postId;
    const commentTime = Number(button.dataset.commentTime);
    const author = button.dataset.commentAuthor || '';
    const snippet = button.dataset.commentSnippet ? decodeURIComponent(button.dataset.commentSnippet) : '';
    if (!postId || !commentTime) return;
    window.commentReplyContext[postId] = { commentTime, author, snippet };
    window.updateReplyTargetDisplay(postId);
    const input = document.getElementById(`input-${postId}`);
    if (input) {
        setTimeout(() => input.focus(), 80);
    }
};

window.clearReply = function(postId) {
    if (window.commentReplyContext[postId]) {
        delete window.commentReplyContext[postId];
        window.updateReplyTargetDisplay(postId);
    }
};

window.updateReplyTargetDisplay = function(postId) {
    const infoBox = document.getElementById(`reply-info-${postId}`);
    const input = document.getElementById(`input-${postId}`);
    if (!infoBox || !input) return;
    const ctx = window.commentReplyContext[postId];
    const defaultPlaceholder = input.dataset.defaultPlaceholder || getLangText('commentPlaceholder', 'Yorum yaz...');
    if (ctx && ctx.commentTime) {
        const snippet = ctx.snippet ? ` — ${escapeHtml(ctx.snippet)}` : '';
        infoBox.style.display = 'flex';
        infoBox.innerHTML = `
            <span><strong>${escapeHtml(ctx.author)}</strong> ${getLangText('replyingToText', 'yanıtlanıyor')}${snippet}</span>
            <button type="button" onclick="clearReply('${postId}')">${getLangText('cancelBtn', 'İptal')}</button>
        `;
        input.placeholder = `${defaultPlaceholder} (${getLangText('replyToPrefix', 'Yanıt')} @${ctx.author})`;
    } else {
        infoBox.style.display = 'none';
        infoBox.innerHTML = '';
        input.placeholder = defaultPlaceholder;
    }
};

function normalizePostText(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// Track length for main post box (share)
function updatePostCount() {
    const input = document.getElementById('postInput');
    const counter = document.getElementById('post-charcount') || document.querySelector('.post-charcount');
    const helpText = document.getElementById('post-help');
    if (!input || !counter) return;
    let text = normalizePostText(input.innerText || input.textContent || '');
    // enforce max length
    if (text.length > 1000) {
        input.innerText = text.substring(0, 1000);
        text = input.innerText;
        if (helpText) helpText.textContent = '1000 karakter sınırını aştınız. Lütfen kısaltın.';
    }
    const len = text.length;
    counter.textContent = `${len}/1000`;
    updateShareButtonState();
}
window.updatePostCount = updatePostCount;

// Poll feature removed

function updateShareButtonState() {
    const shareBtn = document.getElementById('shareBtn');
    const input = document.getElementById('postInput');
    if (!shareBtn || !input) return;
    const text = (input.innerText || input.textContent || '').trim();
    const enable = text.length > 0 || selectedImageBase64;
    shareBtn.disabled = !enable;
    shareBtn.style.opacity = enable ? '1' : '0.6';
    shareBtn.style.cursor = enable ? 'pointer' : 'not-allowed';
}
window.updateShareButtonState = updateShareButtonState;

// tüm yerlerde kullanılabilecek genel yardımcı: HTML entitelerini çözerek
// gerçek karakter (örneğin emoji) haline getirir.
function decodeEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
}

// YouTube URL'sinden video ID'sini çıkaran fonksiyon
function extractYoutubeVideoId(url) {
    if (!url) return null;
    
    // YouTube URL formatları
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    // youtube.com/watch?v=VIDEO_ID
    // youtu.be/VIDEO_ID
    
    const videoIdPatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /(?:^|[^=])v=([^&\n?#]+)/
    ];
    
    for (let pattern of videoIdPatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

// YouTube embed HTML'i oluşturan fonksiyon
function createYoutubeEmbed(videoId) {
    if (!videoId) return '';
    return `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 12px; margin-top: 16px;"></iframe>`;
}

// Gönderinin metin kısmındaki YouTube linklerini tespit et ve videolarını embed et
function extractAndRenderYoutubeVideos(text) {
    if (!text || typeof text !== 'string') return '';
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    const videoIds = [];
    const seenIds = new Set();
    
    for (const url of urls) {
        const id = extractYoutubeVideoId(url);
        if (id && !seenIds.has(id)) {
            seenIds.add(id);
            videoIds.push(id);
        }
    }
    
    if (!videoIds.length) return '';
    return videoIds.map(id => createYoutubeEmbed(id)).join('');
}

function stripYoutubeLinks(text) {
    if (!text || typeof text !== 'string') return '';
    const stripped = text.replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:[^\s]*)?|youtu\.be\/[A-Za-z0-9_-]{11}(?:[^\s]*)?|youtube\.com\/embed\/[A-Za-z0-9_-]{11}(?:[^\s]*)?)/gi, '');
    return stripped.replace(/\s{2,}/g, ' ').trim();
}

function getVisitedProfileUsername() {
    const params = new URLSearchParams(location.search);
    return params.get('id') || params.get('u') || params.get('username') || null;
}

function removeRetractTebrikButton() {
    const btn = document.getElementById('retractTebrikBtn');
    if (btn && btn.parentNode) {
        btn.parentNode.removeChild(btn);
    }
}

function renderRetractTebrikButton(targetUid, targetUsername) {
    if (!auth.currentUser || !targetUid) return;
    const existing = document.getElementById('retractTebrikBtn');
    if (existing) return existing;
    const referenceBtn = document.querySelector('button[onclick="window.openTebrikModalForProfile()"]');
    if (!referenceBtn || !referenceBtn.parentNode) return null;

    const btn = document.createElement('button');
    btn.id = 'retractTebrikBtn';
    btn.type = 'button';
    btn.className = 'admin-btn';
    btn.style.cssText = 'padding:8px 14px; font-size:0.8rem; white-space:nowrap; margin-left:8px; background:#ef4444;';
    btn.innerHTML = '<i class="fa-solid fa-undo"></i> Tebriği Geri Al';
    btn.onclick = () => window.retractTebrikFromProfile(targetUid, targetUsername);
    referenceBtn.parentNode.appendChild(btn);
    return btn;
}

// Initialize chat widget container (loader) — delegates implementation to assets/js/chat-widget.js
function initChatWidget() {
    // Prevent double-loading
    if (window.__chatWidgetLoaderInstalled) return;
    window.__chatWidgetLoaderInstalled = true;

    // If implementation already present, call it
    if (typeof window._initChatWidgetImpl === 'function') {
        window._initChatWidgetImpl();
        return;
    }

    // Dynamically load the chat widget implementation
    const existing = document.querySelector('script[data-chat-widget]');
    if (existing) {
        existing.addEventListener('load', () => {
            if (typeof window._initChatWidgetImpl === 'function') window._initChatWidgetImpl();
        });
        return;
    }

    const s = document.createElement('script');
    s.src = 'assets/js/chat-widget.js';
    s.async = true;
    s.dataset.chatWidget = '1';
    s.onload = () => {
        if (typeof window._initChatWidgetImpl === 'function') window._initChatWidgetImpl();
    };
    document.body.appendChild(s);
}

async function loadTopLikedPosts() {
    const container = document.getElementById('top-liked-posts-list');
    if (!container) return;

    container.innerHTML = `<div style="font-size:0.84rem; color: var(--text-muted); padding:6px 0;">Yükleniyor...</div>`;

    try {
        const snap = await getDocs(query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(10)));
        const posts = snap.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .filter((post) => !post.hidden)
            .sort((a, b) => ((Array.isArray(b.likes) ? b.likes.length : 0) - (Array.isArray(a.likes) ? a.likes.length : 0)) || (getPostSortTimestamp(b) - getPostSortTimestamp(a)));

        if (!posts.length) {
            container.innerHTML = `<div style="font-size:0.84rem; color: var(--text-muted); padding:6px 0;">Henüz beğeni alan gönderi yok.</div>`;
            return;
        }

        container.innerHTML = posts.slice(0, 5).map((post) => {
            const text = escapeHtml(String(post.content || '').replace(/\s+/g, ' ').trim());
            const preview = text.length > 70 ? `${text.slice(0, 67)}...` : text;
            const author = escapeHtml(post.displayName || post.name || post.username || 'Kullanıcı');
            const likes = Array.isArray(post.likes) ? post.likes.length : 0;
            return `
                <div style="padding:8px 0; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:4px;">
                    <div style="font-size:0.8rem; font-weight:700; color:var(--text-main);">${preview || 'Gönderi'}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${author} • ${likes} beğeni</div>
                </div>`;
        }).join('');
    } catch (err) {
        console.error('loadTopLikedPosts hatası:', err);
        container.innerHTML = `<div style="font-size:0.84rem; color: var(--text-muted); padding:6px 0;">Liste yüklenemedi.</div>`;
    }
}
window.loadTopLikedPosts = loadTopLikedPosts;

async function loadTopReadBlogs() {
    const mainContainer = document.getElementById('top-read-blogs');
    const sidebarContainer = document.getElementById('sidebar-top-read-blogs');
    const containers = [mainContainer, sidebarContainer].filter(Boolean);
    if (!containers.length) return;

    containers.forEach((container) => {
        const isSidebar = container.id === 'sidebar-top-read-blogs';
        container.innerHTML = isSidebar
            ? `<div style="font-size:0.76rem; color: var(--text-muted); text-align:center; padding:4px;">${getLangText('loadingText', 'Yükleniyor...')}</div>`
            : `<div style="font-size:0.9rem; color: var(--text-muted); text-align:center;">${getLangText('loadingText', 'Yükleniyor...')}</div>`;
    });

    try {
        const q = query(collection(db, 'blogs'), orderBy('views', 'desc'), limit(3));
        const snap = await getDocs(q);
        if (snap.empty) {
            containers.forEach((container) => {
                const isSidebar = container.id === 'sidebar-top-read-blogs';
                container.innerHTML = isSidebar
                    ? `<div style="font-size:0.76rem; color: var(--text-muted); text-align:center; padding:4px;">${getLangText('noBlogPostsYet', 'Henüz blog yazısı bulunamadı.')}</div>`
                    : `<div style="font-size:0.9rem; color: var(--text-muted); text-align:center;">${getLangText('noBlogPostsYet', 'Henüz blog yazısı bulunamadı.')}</div>`;
            });
            return;
        }

        const itemsData = snap.docs.map((docSnap, idx) => {
            const post = docSnap.data();
            const rawTitle = post.title || post.headline || getLangText('untitledPost', 'Başlıksız yazı');
            const cappedRawTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
            const title = escapeHtml(cappedRawTitle);
            const shortTitle = title.length > 56 ? `${title.substring(0, 53)}...` : title;
            const shortSidebarTitle = title.length > 40 ? `${title.substring(0, 37)}...` : title;
            const views = post.views || 0;
            const authorDisplay = post.authorDisplayName || post.author || post.displayName || post.name || '';
            const authorUsername = post.authorUsername || post.username || '';
            const authorName = escapeHtml(authorDisplay || authorUsername || getLangText('authorLabel', 'Yazar'));
            const authorIconHtml = `<i class="fa-solid fa-user" style="margin-right:6px; color:var(--primary);"></i>`;
            const authorLabelHtml = authorDisplay && authorUsername ? `${authorIconHtml}${authorName} · @${escapeHtml(authorUsername)}` : `${authorIconHtml}${authorName}`;
            const slug = post.slug || docSnap.id;
            const url = `blog.html?id=${encodeURIComponent(slug)}`;
            const postDate = formatPostTimestamp(post.createdAt || post.timestamp || post.publishedAt);
            return { idx, shortTitle, shortSidebarTitle, views, authorLabelHtml, url, postDate };
        });

        containers.forEach((container) => {
            const isSidebar = container.id === 'sidebar-top-read-blogs';
            const items = itemsData.map((item) => {
                if (isSidebar) {
                    return `
                        <a href="${item.url}" class="menu-style-btn nav-item" style="padding:8px 10px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                            <span style="display:flex; align-items:center; gap:8px; min-width:0;">
                                <span style="width:22px; height:22px; border-radius:7px; background:rgba(99,102,241,0.14); color:var(--primary); display:inline-flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:800;">${item.idx + 1}</span>
                                <span style="font-size:0.76rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.shortSidebarTitle}</span>
                            </span>
                            <span style="font-size:0.7rem; color:var(--success); font-weight:700; white-space:nowrap;">${item.views}</span>
                        </a>`;
                }

            return `
                <a href="${item.url}" style="display:flex; justify-content:space-between; align-items:center; gap:14px; text-decoration:none; color: inherit; padding:18px 18px; border-radius:22px; background: rgba(255,255,255,0.05); border:1px solid rgba(99,102,241,0.16); box-shadow: 0 20px 45px rgba(0,0,0,0.05); transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;">
                    <div style="display:flex; gap:14px; align-items:center; min-width:0; flex:1;">
                        <div style="width:38px; min-width:38px; height:38px; border-radius:14px; background: rgba(99,102,241,0.18); color: var(--primary); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.95rem;">${item.idx + 1}</div>
                        <div style="min-width:0;">
                            <div style="font-size:0.98rem; font-weight:700; line-height:1.35; color: var(--text-main); display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-newspaper" style="color:var(--primary); transform: translateY(1px);"></i>
                                <span>${item.shortTitle}</span>
                            </div>
                            <div style="font-size:0.78rem; color: var(--text-muted); margin-top:6px; display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-calendar-days" style="color:var(--primary);"></i>
                                <span>${item.postDate}</span>
                            </div>
                                <div style="font-size:0.78rem; color: var(--text-muted); margin-top:6px;">${item.authorLabelHtml}</div>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                        <div style="font-size:0.78rem; color: var(--success); margin-bottom:6px; text-align:center; width:100%; font-weight:700;">${item.views} ${getLangText('readCountLabel', 'okuma')}</div>
                        <span role="button" onclick="location.href='${item.url}'; event.stopPropagation();" style="background: var(--primary); color: #fff; padding:8px 12px; border-radius: 10px; font-weight:700; font-size:0.86rem; text-decoration:none; display:inline-flex; align-items:center; gap:8px; cursor:pointer;">${getLangText('readNowBtn', 'Hemen Oku')}</span>
                    </div>
                </a>`;
            });

            container.innerHTML = items.join('');
        });
    } catch (e) {
        console.error('loadTopReadBlogs hata:', e);
        containers.forEach((container) => {
            const isSidebar = container.id === 'sidebar-top-read-blogs';
            container.innerHTML = isSidebar
                ? `<div style="font-size:0.76rem; color: var(--danger); text-align:center; padding:4px;">${getLangText('blogRankingLoadError', 'Blog sıralaması yüklenemedi.')}</div>`
                : `<div style="font-size:0.9rem; color: var(--danger); text-align:center;">${getLangText('blogRankingLoadError', 'Blog sıralaması yüklenemedi.')}</div>`;
        });
    }
}

function isPollUserAuthenticated() {
    const currentUser = auth && auth.currentUser ? auth.currentUser : null;
    const profileUser = window.user || {};
    return Boolean(currentUser || profileUser.uid || profileUser.username || profileUser.displayName || profileUser.email);
}

function getCurrentPollVoterValues() {
    const currentUser = auth && auth.currentUser ? auth.currentUser : null;
    const profileUser = window.user || {};
    const username = profileUser.username || currentUser?.displayName || currentUser?.email?.split('@')[0] || '';
    const displayName = profileUser.displayName || currentUser?.displayName || username || '';
    const email = currentUser?.email || profileUser.email || '';
    const uid = currentUser?.uid || profileUser.uid || '';

    return [uid, username, displayName, email].filter(Boolean).map(value => String(value).toLowerCase());
}

function getPollVoteValues(vote) {
    if (!vote) return [];
    if (typeof vote === 'string') return [vote.toLowerCase()];

    return [
        vote.voterUid,
        vote.uid,
        vote.userId,
        vote.voter,
        vote.username,
        vote.displayName,
        vote.name
    ].filter(Boolean).map(value => String(value).toLowerCase());
}

function hasCurrentUserVotedForPoll(poll) {
    if (!poll || !Array.isArray(poll.votes)) return false;
    if (!isPollUserAuthenticated()) return false;

    const currentVoterValues = getCurrentPollVoterValues();
    return poll.votes.some(vote => getPollVoteValues(vote).some(value => currentVoterValues.includes(value)));
}

function hasCurrentUserVotedForPollOption(poll, optionIndex) {
    if (!poll || !Array.isArray(poll.votes) || !Number.isInteger(optionIndex)) return false;
    if (!isPollUserAuthenticated()) return false;

    const currentVoterValues = getCurrentPollVoterValues();
    return poll.votes.some(vote => vote.option === optionIndex && getPollVoteValues(vote).some(value => currentVoterValues.includes(value)));
}

const postVoteInProgress = new Set();

function refreshMainFeed() {
    if (currentPostsUnsubscribe) {
        // An active snapshot listener is already updating the feed.
        return;
    }
    if (typeof window.loadPostsFeed === 'function') {
        window.loadPostsFeed();
        return;
    }
    if (typeof loadPostsFeed === 'function') {
        loadPostsFeed();
    }
}

function getPostSortTimestamp(postData) {
    const candidates = [
        postData?.timestamp,
        postData?.createdAt,
        postData?.createdAtValue,
        postData?.pollCreatedAt,
        postData?.postedAt,
        postData?.time
    ];

    for (const candidate of candidates) {
        const numericValue = Number(candidate);
        if (Number.isFinite(numericValue) && numericValue > 0) {
            return numericValue;
        }
    }

    return 0;
}

function renderPostPoll(poll, postId) {
    if (!poll || !poll.question) return '';
    
    const now = Date.now();
    const endTime = poll.endTime;
    const isFinished = now > endTime;
    const userVoted = hasCurrentUserVotedForPoll(poll);
    
    let html = `
        <div class="post-poll" data-poll-id="${poll.question}">
            <div class="poll-question">
                <div class="poll-question-title">
                    <i class="fa-solid fa-chart-pie"></i>
                    <strong>${escapeHtml(poll.question)}</strong>
                </div>
                <span class="poll-status-pill">${isFinished ? getLangText('pollClosed', 'Kapalı') : getLangText('pollActive', 'Aktif')}</span>
            </div>
            <div class="poll-options">
    `;
    
    if (poll.options && Array.isArray(poll.options)) {
        const totalVotes = poll.votes ? poll.votes.length : 0;
        poll.options.forEach((opt, idx) => {
            const optionVotes = Array.isArray(poll.votes) ? poll.votes.filter(v => v.option === idx) : [];
            const optVotes = optionVotes.length;
            const percent = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
            const userVotedThisOption = hasCurrentUserVotedForPollOption(poll, idx);
            const voterAvatars = optionVotes.slice(0, 6).map(vote => {
                const avatarValue = vote.avatarUrl || vote.photoURL || vote.avatar || '';
                const avatarSrc = avatarValue ? getAvatarUrl(avatarValue, 'user') : getAvatarUrl(vote.displayName || vote.username || vote.voter || 'user', 'user');
                const altText = escapeHtml(vote.displayName || vote.username || vote.voter || 'Oy veren');
                return `<img src="${avatarSrc}" alt="${altText}" title="${altText}" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--border); margin-left: -6px; background: var(--surface);">`;
            }).join('');
            const avatarsHtml = optVotes > 0 ? `<span class="poll-voter-avatars">${voterAvatars}${optVotes > 6 ? `<span class="poll-voter-more">+${optVotes - 6}</span>` : ''}</span>` : '';
            html += `
                <div class="poll-option-card${userVotedThisOption ? ' selected' : ''}">
                    <div class="poll-option-head">
                        <span class="poll-option-label">${escapeHtml(opt)}</span>
                        <div class="poll-option-meta">
                            <span class="poll-option-count">${optVotes} ${getLangText('voteLabel', 'oy')}</span>
                            <span class="poll-option-percent">${percent}%</span>
                            ${avatarsHtml}
                        </div>
                    </div>
                    <div class="poll-progress-bar">
                        <div class="poll-progress-fill" style="width: ${percent}%;"></div>
                    </div>
            `;
            
            if (!isFinished && isPollUserAuthenticated() && !userVoted && !userVotedThisOption) {
                html += `<button class="poll-vote-btn" onclick="votePostPoll('${postId}', ${idx})"><i class="fa-solid fa-check-to-slot"></i> ${getLangText('voteBtn', 'Oy Ver')}</button>`;
            } else if (!isFinished && userVotedThisOption) {
                html += `<div class="poll-option-actions">
                    <button class="poll-vote-btn danger" onclick="removePostPollVote('${postId}')"><i class="fa-solid fa-rotate-left"></i> ${getLangText('retractVoteBtn', 'Oyumu Geri Al')}</button>
                </div>`;
            }
            
            html += `</div>`;
        });
    }
    
    const timeRemaining = isFinished ? getLangText('finishedLabel', 'Bitti') : `${Math.ceil((endTime - now) / (1000 * 60))} ${getLangText('minutesLeftLabel', 'dakika kaldı')}`;
    html += `
            </div>
            <div class="poll-footer">${timeRemaining}</div>
        </div>
    `;
    
    return html;
}

window.votePostPoll = async function(postId, optionId) {
    const currentUser = auth && auth.currentUser ? auth.currentUser : (window.user || null);
    if (!currentUser || !currentUser.uid) {
        alert('Oyla yapmak için giriş yapmalısınız.');
        return;
    }

    if (postVoteInProgress.has(postId)) {
        return;
    }
    postVoteInProgress.add(postId);

    try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) {
            throw new Error('post-not-found');
        }

        const post = postSnap.data();
        const poll = post.poll;
        if (!poll) {
            throw new Error('poll-not-found');
        }

        const currentVoterValues = getCurrentPollVoterValues();
        const voterLabel = (window.user?.username || currentUser.displayName || currentUser.email || 'Guest').toString();
        const votes = Array.isArray(poll.votes) ? poll.votes : [];
        const existingVote = votes.find(vote => getPollVoteValues(vote).some(value => currentVoterValues.includes(value)));
        if (existingVote) {
            throw new Error('already-voted');
        }

        const newVote = {
            voterUid: currentUser.uid,
            voter: voterLabel,
            username: window.user?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'user',
            displayName: window.user?.displayName || currentUser.displayName || voterLabel,
            avatarUrl: window.user?.avatarUrl || window.user?.photoURL || currentUser.photoURL || 'assets/img/strendsaydamv2.png',
            option: optionId,
            timestamp: Date.now()
        };

        await updateDoc(postRef, { 'poll.votes': [...votes, newVote] });
        refreshMainFeed();
    } catch (e) {
        console.error('Anket oy hatası:', e);
        if (e && e.message === 'already-voted') {
            alert('Zaten oy verdiniz.');
        } else if (e && e.message === 'post-not-found') {
            alert('Gönderi bulunamadı.');
        } else if (e && e.message === 'poll-not-found') {
            alert('Bu gönderiye anket bulunamadı.');
        } else if (e?.code === 'resource-exhausted') {
            alert('Firestore kotası aşıldı, lütfen birkaç saniye sonra tekrar deneyin.');
        } else {
            alert('Oy verilemedi.');
        }
    } finally {
        postVoteInProgress.delete(postId);
    }
};

window.finishPostPoll = async function(postId) {
    try {
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, { 'poll.endTime': Date.now() });
        refreshMainFeed();
    } catch (e) {
        console.error('Anket bitirme hatası:', e);
    }
};

window.removePostPollVote = async function(postId) {
    const currentUser = auth && auth.currentUser ? auth.currentUser : (window.user || null);
    if (!currentUser || !currentUser.uid) {
        alert('İşlem için giriş yapmalısınız.');
        return;
    }

    if (postVoteInProgress.has(postId)) {
        return;
    }
    postVoteInProgress.add(postId);
    
    try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) {
            throw new Error('post-not-found');
        }

        const post = postSnap.data();
        const poll = post.poll;
        if (!poll) {
            throw new Error('poll-not-found');
        }

        const currentVoterValues = getCurrentPollVoterValues();
        const votes = Array.isArray(poll.votes) ? poll.votes : [];
        const filtered = votes.filter(vote => !getPollVoteValues(vote).some(value => currentVoterValues.includes(value)));
        await updateDoc(postRef, { 'poll.votes': filtered });
        refreshMainFeed();
    } catch (e) {
        console.error('Oy silme hatası:', e);
        if (e?.code === 'resource-exhausted') {
            alert('Firestore kotası aşıldı, lütfen birkaç saniye sonra tekrar deneyin.');
        } else {
            alert('Oy geri alınamadı.');
        }
    } finally {
        postVoteInProgress.delete(postId);
    }
};

function getComposerPollElements() {
    return {
        pollToggleBtn: document.getElementById('pollToggle'),
        pollForm: document.getElementById('pollForm'),
        cancelPollBtn: document.getElementById('cancelPollBtn'),
        createPollButton: document.getElementById('createPollFromComposerBtn'),
        pollFormMessage: document.getElementById('pollFormMessage'),
        questionInput: document.getElementById('pollQuestionComposer'),
        optionInputs: [
            document.getElementById('pollOption1Composer'),
            document.getElementById('pollOption2Composer'),
            document.getElementById('pollOption3Composer'),
            document.getElementById('pollOption4Composer')
        ],
        daysInput: document.getElementById('pollDaysComposer'),
        hoursInput: document.getElementById('pollHoursComposer'),
        minutesInput: document.getElementById('pollMinutesComposer')
    };
}

function clearPollForm() {
    const {
        pollForm,
        pollToggleBtn,
        questionInput,
        optionInputs,
        daysInput,
        hoursInput,
        minutesInput,
        pollFormMessage
    } = getComposerPollElements();
    if (questionInput) questionInput.value = '';
    optionInputs.forEach(opt => { if (opt) opt.value = ''; });
    if (daysInput) daysInput.value = '0';
    if (hoursInput) hoursInput.value = '0';
    if (minutesInput) minutesInput.value = '30';
    if (pollFormMessage) pollFormMessage.textContent = '';
    if (pollForm) pollForm.style.display = 'none';
    if (pollToggleBtn) pollToggleBtn.classList.remove('active');
}

function initComposerPollControls() {
    if (window.__composerPollControlsInitialized) return;
    window.__composerPollControlsInitialized = true;

    const pollToggleBtn = document.getElementById('pollToggle');
    if (pollToggleBtn) {
        pollToggleBtn.addEventListener('click', togglePollForm);
    }

    const cancelPollBtn = document.getElementById('cancelPollBtn');
    if (cancelPollBtn) {
        cancelPollBtn.addEventListener('click', clearPollForm);
    }

    const createPollBtn = document.getElementById('createPollFromComposerBtn');
    if (createPollBtn) {
        createPollBtn.addEventListener('click', createPollPostFromComposer);
    }
}

function showPollForm() {
    const { pollForm, pollToggleBtn } = getComposerPollElements();
    if (pollForm) pollForm.style.display = 'block';
    if (pollToggleBtn) pollToggleBtn.classList.add('active');
}

function togglePollForm() {
    const { pollForm } = getComposerPollElements();
    if (!pollForm) return;
    if (pollForm.style.display === 'block') {
        clearPollForm();
    } else {
        showPollForm();
    }
}

function getComposerPollData() {
    const {
        questionInput,
        optionInputs,
        daysInput,
        hoursInput,
        minutesInput
    } = getComposerPollElements();
    
    const question = (questionInput ? questionInput.value.trim() : '').substring(0, 200);
    const options = optionInputs
        .map(inp => inp ? inp.value.trim() : '')
        .filter(opt => opt.length > 0)
        .slice(0, 4)
        .map(opt => opt.substring(0, 100));
    
    if (!question || options.length < 2) {
        return null;
    }
    
    const days = parseInt(daysInput ? daysInput.value : 0) || 0;
    const hours = parseInt(hoursInput ? hoursInput.value : 0) || 0;
    const minutes = parseInt(minutesInput ? minutesInput.value : 30) || 30;
    const totalMs = (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000;
    
    return {
        question,
        options,
        endTime: Date.now() + totalMs,
        votes: []
    };
}

async function createPollPostFromComposer() {
    if (!auth.currentUser) {
        alert('Anket oluşturmak için giriş yapmalısınız.');
        return;
    }
    
    const poll = getComposerPollData();
    if (!poll) {
        const { pollFormMessage } = getComposerPollElements();
        if (pollFormMessage) pollFormMessage.textContent = 'Soru ve en az 2 seçenek gereklidir.';
        return;
    }
    
    try {
        disableButton(document.getElementById('createPollFromComposerBtn'), 'Oluşturuluyor...');
        
        const postInput = document.getElementById('postInput');
        const text = postInput ? (postInput.innerText || '').trim() : '';
        
        const currentProfile = window.user || {};
        const createdAtValue = Date.now();
        const newPost = {
            uid: auth.currentUser.uid,
            name: currentProfile.displayName || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Kullanıcı',
            displayName: currentProfile.displayName || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Kullanıcı',
            username: currentProfile.username || auth.currentUser.email?.split('@')[0] || 'user',
            avatarUrl: currentProfile.avatarUrl || currentProfile.photoURL || auth.currentUser.photoURL || 'assets/img/strendsaydamv2.png',
            email: auth.currentUser.email,
            content: text,
            timestamp: createdAtValue,
            poll: {
                question: poll.question,
                options: poll.options,
                endTime: poll.endTime,
                votes: []
            },
            likes: [],
            comments: [],
            bookmarks: [],
            tebrikCount: 0,
            type: 'poll',
            pollCreatedAt: createdAtValue
        };
        
        const createdPostRef = await addDoc(collection(db, 'posts'), newPost);
        await queueContentModerationIfNeeded({
            contentType: 'post',
            contentId: createdPostRef.id,
            contentText: [newPost.content, newPost.poll?.question, ...(newPost.poll?.options || [])].filter(Boolean).join('\n'),
            authorUid: newPost.uid,
            authorUsername: newPost.username,
            authorDisplayName: newPost.displayName || newPost.name
        });
        
        if (postInput) postInput.innerText = '';
        clearPollForm();
        refreshMainFeed();
        alert('Anket oluşturuldu!');
        
        enableButton(document.getElementById('createPollFromComposerBtn'), 'Anket Oluştur');
    } catch (e) {
        console.error('Anket oluşturma hatası:', e);
        alert(`Anket oluşturulamadı: ${e?.message || 'Bilinmeyen hata'}`);
        enableButton(document.getElementById('createPollFromComposerBtn'), 'Anket Oluştur');
    }
}

// Additional poll function stubs
window.openSidebarPollCreator = function() { };
window.closeSidebarPollCreator = function() { };
window.createPollFromSidebar = async function() { };
window.loadPollWidget = function() { };

// Expose sendNotification for manual testing from console
window.sendNotification = sendNotification;
let suggestionsRenderRunId = 0;

async function loadSuggestions() {
    const suggestionsContainer = document.getElementById('dynamic-suggestions-list');
    if (!suggestionsContainer) return;

    const runId = ++suggestionsRenderRunId;

    try {
        const currentUid = auth.currentUser ? auth.currentUser.uid : null;

        // Daha iyi öneri havuzu için daha fazla kullanıcı çek
        const q = query(collection(db, "users"), limit(20));
        const querySnapshot = await getDocs(q);
        
        const usersArray = [];
        querySnapshot.forEach((doc) => {
            usersArray.push({ id: doc.id, ...doc.data() });
        });

        // Bu çağrıdan daha yeni bir çağrı başladıysa eski sonucu çizme.
        if (runId !== suggestionsRenderRunId) return;

        suggestionsContainer.innerHTML = ''; // Temizle

        // Eğer giriş yapan varsa, arkadaş/durum bilgilerini çek
        let currentUserData = {};
        if (auth.currentUser) {
            try {
                const curDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (curDoc.exists()) currentUserData = curDoc.data();
            } catch (e) {
                console.warn('Kullanıcı verisi alınamadı:', e);
            }
        }

        if (runId !== suggestionsRenderRunId) return;

        const friends = currentUserData.friends || [];
        const sentRequests = currentUserData.sentRequests || [];
        const incomingRequests = currentUserData.friendRequests || [];
        const currentUsername = String(currentUserData.username || '').trim().toLowerCase();
        const currentEmail = String(currentUserData.email || auth.currentUser?.email || '').trim().toLowerCase();

        const normalizeIdentityValue = (value) => String(value || '').trim().toLowerCase();

        // Aynı kişiyi (farklı kayıtlarla gelse bile) tek öneriye indir
        const dedupedUsers = [];
        const seenUserKeys = new Set();
        for (const user of usersArray) {
            const identityKeys = [
                user.id,
                user.uid,
                user.username,
                user.email,
                user.displayName
            ]
                .map(normalizeIdentityValue)
                .filter(Boolean);

            if (!identityKeys.length) {
                dedupedUsers.push(user);
                continue;
            }

            const hasExistingKey = identityKeys.some((key) => seenUserKeys.has(key));
            if (hasExistingKey) continue;

            identityKeys.forEach((key) => seenUserKeys.add(key));
            dedupedUsers.push(user);
        }

        // Geçersiz placeholder hesapları, kendimizi ve mevcut arkadaşları öneriden çıkar
        const filteredUsers = dedupedUsers.filter(u => {
            const displayName = String(u.displayName || '').trim();
            const username = String(u.username || '').trim();
            const email = String(u.email || '').trim().toLowerCase();
            const userUid = String(u.uid || u.id || '').trim();
            if (!displayName || !username) return false;
            if (username.toLowerCase() === 'user' || displayName.toLowerCase() === 'isimsiz') return false;
            // Kendimizi asla önermeyelim: doc id, uid, username ve email bazlı kontrol
            if (currentUid && (u.id === currentUid || userUid === currentUid)) return false;
            if (currentUsername && username.toLowerCase() === currentUsername) return false;
            if (currentEmail && email && email === currentEmail) return false;
            if (friends.includes(u.id)) return false;
            return true;
        });

        if (filteredUsers.length === 0) {
            suggestionsContainer.innerHTML = '<div class="suggestions-empty">Şimdilik yeni öneri yok.</div>';
            return;
        }

        // Hafif rastgelelik + tekrar yüklemede aynı görünüm için kullanıcı adına göre ikinci sıralama
        filteredUsers.sort(() => Math.random() - 0.5);
        const selectedUsers = [];
        const selectedSeen = new Set();
        for (const user of filteredUsers) {
            const identityKeys = [
                user.username,
                user.uid || user.id,
                user.email,
                user.displayName
            ]
                .map(normalizeIdentityValue)
                .filter(Boolean);

            const isDuplicateSelection = identityKeys.some((key) => selectedSeen.has(key));
            if (isDuplicateSelection) continue;

            identityKeys.forEach((key) => selectedSeen.add(key));
            selectedUsers.push(user);
            if (selectedUsers.length === 2) break;
        }

        selectedUsers.sort((a, b) => String(a.displayName || a.username || '').localeCompare(String(b.displayName || b.username || ''), 'tr'));

        const normalizeInterest = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');
        const splitInterests = (value) => String(value || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        const currentInterestSet = new Set(splitInterests(currentUserData.interests).map(normalizeInterest));
        const insertedSuggestionKeys = new Set();

        selectedUsers.forEach((user) => {
            const suggestionKey = [
                String(user.id || user.uid || ''),
                String(user.username || ''),
                String(user.email || ''),
                String(user.displayName || '')
            ]
                .map((value) => String(value).trim().toLowerCase())
                .filter(Boolean)
                .join('|');

            if (!suggestionKey || insertedSuggestionKeys.has(suggestionKey)) return;
            insertedSuggestionKeys.add(suggestionKey);

            const cardId = `sugg_card_${String(user.id || user.uid || user.username || user.displayName || '').trim().replace(/\s+/g, '_')}`;
            if (document.getElementById(cardId)) return;

            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random&color=fff`;
            const userAvatar = user.avatarUrl || user.avatar || fallbackAvatar;
            const safeDisplayName = escapeHtml(user.displayName || 'İsimsiz');
            const safeUsername = escapeHtml(user.username || 'user');
            const safeLocation = escapeHtml(user.location || 'Şehir belirtilmedi');
            const userInterests = splitInterests(user.interests || '');
            const commonInterestsCount = userInterests.filter((interest) => currentInterestSet.has(normalizeInterest(interest))).length;
            const compactMetaText = commonInterestsCount > 0
                ? `${commonInterestsCount} ortak ilgi`
                : safeLocation;

            const isFriend = friends.includes(user.id);
            const isSent = sentRequests.some(r => r.toUid === user.id);
            const isIncoming = incomingRequests.some(r => r.fromUid === user.id);
            const isSelf = currentUid && user.id === currentUid;

            let btnLabel = 'Arkadaş Ol';
            let btnClass = 'suggestion-add-btn';
            let btnDisabledAttr = '';
            let btnOnclick = `onclick="sendFriendRequestToUid('${user.id}', '${user.username}')"`;

            if (isFriend) {
                btnLabel = 'Zaten Arkadaşsınız';
                btnClass = 'suggestion-add-btn disabled';
                btnDisabledAttr = 'disabled';
                btnOnclick = '';
            } else if (isSent) {
                // allow cancellation from suggestions
                btnLabel = 'İsteği iptal et';
                btnClass = 'suggestion-add-btn pending';
                btnOnclick = `onclick="cancelFriendRequestToUid('${user.id}', '${user.username}')"`;
            } else if (isIncoming) {
                btnLabel = 'İstek Bekleniyor';
                btnClass = 'suggestion-add-btn disabled';
                btnDisabledAttr = 'disabled';
                btnOnclick = '';
            }

            const userHtml = `
                <div class="suggestion-card" id="sugg_card_${user.id}">
                    <div class="suggestion-main" onclick="window.location.href='${isSelf ? 'profil.html' : `profil.html?id=${encodeURIComponent(user.username)}`}'">
                        <img src="${userAvatar}" alt="${safeDisplayName}" class="suggestion-avatar">
                        <div class="suggestion-content">
                            <div class="suggestion-name">${safeDisplayName}</div>
                            <div class="suggestion-username">@${safeUsername}</div>
                            <div class="suggestion-meta-row">
                                <span class="suggestion-meta ${commonInterestsCount > 0 ? 'suggestion-meta-highlight' : ''}"><i class="fa-solid ${commonInterestsCount > 0 ? 'fa-fire' : 'fa-location-dot'}"></i> ${compactMetaText}</span>
                            </div>
                        </div>
                    </div>
                    <button id="addFriendBtn_sugg_${user.id}" class="${btnClass}" ${btnOnclick} ${btnDisabledAttr}>
                        ${btnLabel}
                    </button>
                </div>
            `;

            suggestionsContainer.insertAdjacentHTML('beforeend', userHtml);
            // programmatic binding in case inline onclick fails or global function missing
            if (isSent) {
                const btnEl = document.getElementById('addFriendBtn_sugg_' + user.id);
                if (btnEl) {
                    btnEl.onclick = () => cancelFriendRequestToUid(user.id, user.username);
                }
            }
        });
    } catch (error) {
        console.error("Öneriler yüklenirken hata:", error);
        suggestionsContainer.innerHTML = '<div class="suggestions-empty" style="color: var(--danger);">Kullanıcılar yüklenemedi.</div>';
    }
}

/* ════════════════════════════════════════════════════════
   DAVET MODAL
════════════════════════════════════════════════════════ */
window.openInviteModal = async function () {
    document.getElementById('invite-modal-overlay')?.remove();

    let username = 'kullanici';
    if (auth.currentUser) {
        try {
            const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (snap.exists()) username = snap.data().username || snap.data().displayName || username;
        } catch (_) { /* ignore */ }
    }

    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const inviteLink = `${base}index.html?ref=${encodeURIComponent(username)}`;
    const msg = `SosyaLTrend'e katılmak ister misin? Harika bir sosyal platform! ${inviteLink}`;

    const shareOptions = [
        { id: 'whatsapp',  icon: 'fa-brands fa-whatsapp',  label: 'WhatsApp',  color: '#25D366', url: `https://wa.me/?text=${encodeURIComponent(msg)}` },
        { id: 'telegram',  icon: 'fa-brands fa-telegram',  label: 'Telegram',  color: '#229ED9', url: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('SosyaLTrend\'e katılmak ister misin?')}` },
        { id: 'twitter',   icon: 'fa-brands fa-x-twitter', label: 'Twitter/X', color: '#000',    url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}` },
        { id: 'facebook',  icon: 'fa-brands fa-facebook',  label: 'Facebook',  color: '#1877F2', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}` },
        { id: 'email',     icon: 'fa-solid fa-envelope',   label: 'E-posta',   color: '#6366f1', url: `mailto:?subject=${encodeURIComponent('SosyaLTrend\'e Davetlisin!')}&body=${encodeURIComponent(msg)}` },
    ];

    const overlay = document.createElement('div');
    overlay.id = 'invite-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100010;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="background:var(--card-bg);border-radius:20px;padding:26px;width:min(440px,100%);box-shadow:0 24px 70px rgba(15,23,42,.25);position:relative;">
            <button onclick="document.getElementById('invite-modal-overlay').remove()" style="position:absolute;top:14px;right:14px;background:rgba(15,23,42,.06);border:none;border-radius:50%;width:34px;height:34px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-main);">×</button>
            <h3 style="margin:0 0 6px;font-size:1.1rem;color:var(--text-main);display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-user-plus" style="color:var(--primary);"></i> Arkadaşını Davet Et
            </h3>
            <p style="margin:0 0 16px;font-size:.9rem;color:var(--text-muted);">Davet linkini paylaşarak arkadaşlarını SosyaLTrend'e getir!</p>

            <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;padding:12px 14px;border-radius:12px;background:rgba(15,23,42,.05);border:1px solid var(--border,rgba(148,163,184,.2));">
                <code id="invite-link-display" style="flex:1;font-size:.8rem;color:var(--text-main);word-break:break-all;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(inviteLink)}</code>
                <button id="invite-copy-btn" onclick="window._copyInviteLink('${inviteLink}')" style="flex-shrink:0;padding:7px 12px;border:none;border-radius:10px;background:var(--primary);color:#fff;font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;">
                    <i class="fa-solid fa-copy"></i> Kopyala
                </button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
                ${shareOptions.map(o => `
                <a href="${o.url}" target="_blank" rel="noopener" onclick="window._recordInvite('${o.id}','${encodeURIComponent(inviteLink)}')"
                   style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:14px;background:rgba(15,23,42,.05);text-decoration:none;color:var(--text-main);font-size:.75rem;font-weight:700;transition:background .18s;"
                   onmouseover="this.style.background='rgba(15,23,42,.1)'" onmouseout="this.style.background='rgba(15,23,42,.05)'">
                    <i class="${o.icon}" style="font-size:1.5rem;color:${o.color};"></i>
                    ${escapeHtml(o.label)}
                </a>`).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    window._currentInviteLink = inviteLink;
    window._currentInviteUsername = username;
};

window.openPostRulesModal = function () {
    document.getElementById('postRulesModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'postRulesModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="glass-card" style="width:min(560px,100%); padding:24px; box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px;">
                <div>
                    <h3 style="margin:0 0 6px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-circle-info" style="color:var(--primary);"></i>
                        Gönderi yapma kuralları
                    </h3>
                    <p style="margin:0; color:var(--text-muted); font-size:0.92rem;">Paylaşım yapmadan önce kısa kuralları gözden geçirin.</p>
                </div>
                <button type="button" onclick="window.closePostRulesModal && window.closePostRulesModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-main); line-height:1;">&times;</button>
            </div>
            <div style="display:grid; gap:10px; color:var(--text-main); font-size:0.95rem; line-height:1.6;">
                <div style="padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.04);">1. Hakaret, küfür, tehdit, taciz ve aşağılayıcı içerik paylaşma.</div>
                <div style="padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.04);">2. Irkçılık, nefret söylemi, ayrımcılık ve kışkırtıcı içerik paylaşma.</div>
                <div style="padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.04);">3. Spam, tekrar eden gönderiler, sahte haberler ve yanıltıcı içerik paylaşma.</div>
                <div style="padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.04);">4. İzin almadan başkasına ait fotoğraf, özel bilgi, ekran görüntüsü veya kişisel veri paylaşma.</div>
                <div style="padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.04);">5. Cinsel içerik, şiddeti teşvik eden, yasa dışı veya topluluk düzenini bozan içerikler paylaşma.</div>
                <div style="padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.04);">6. Kurallara aykırı gönderiler silinebilir, hesabın uyarı alabilir veya erişimin kısıtlanabilir.</div>
                <div style="padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:rgba(255,255,255,0.04);">7. Paylaşım yaparak bu kuralları kabul etmiş sayılırsın.</div>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:18px;">
                <button type="button" onclick="window.closePostRulesModal && window.closePostRulesModal()" style="padding:10px 16px; border:none; border-radius:12px; background:var(--primary); color:#fff; font-weight:700; cursor:pointer;">Tamam</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
};

window.closePostRulesModal = function () {
    document.getElementById('postRulesModal')?.remove();
};

window.openLatestHomePosts = function() {
    const feed = document.getElementById('feed-items');
    const sharesPanel = document.getElementById('my-shares-panel');

    if (sharesPanel) {
        sharesPanel.style.display = 'none';
        sharesPanel.innerHTML = '';
    }
    if (feed) {
        feed.style.display = 'block';
    }

    currentFeedFilterMode = 'all';

    if (typeof window.loadPostsFeed === 'function') {
        window.loadPostsFeed(true);
    }
    if (feed) {
        feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

function getMySharesUsername() {
        const profileUser = window.user || {};
        const currentUser = auth && auth.currentUser ? auth.currentUser : null;
        return profileUser.username || currentUser?.displayName || currentUser?.email?.split('@')[0] || '';
}

function buildInlineShareCard(postId, postData) {
        const avatarUrl = getAvatarUrl(postData.avatarUrl || postData.avatarSeed || 'assets/img/strendsaydamv2.png', 'user');
        const authorName = postData.displayName || postData.name || postData.username || 'Anonim';
        const authorUsername = postData.username || '';
        const decodedContent = decodeEntities ? decodeEntities(postData.content || '') : (postData.content || '');
        const contentPreviewText = stripYoutubeLinks(decodedContent);
        const content = contentPreviewText.length > 240 ? `${contentPreviewText.slice(0, 240).trim()}...` : contentPreviewText;
        const imageHtml = postData.image ? `
            <div style="margin-top:10px; border-radius:14px; overflow:hidden; border:1px solid var(--border); background:#000; max-height:240px;">
                <img src="${postData.image}" alt="Gönderi görseli" style="width:100%; height:100%; object-fit:cover; display:block;">
            </div>` : '';
        const youtubeHtml = extractAndRenderYoutubeVideos(postData.content || '');
        const currentIdentity = getCurrentUserIdentity();
        const likeState = getBookmarkState(postData.likes, currentIdentity);
        const saveState = getBookmarkState(postData.savedBy, currentIdentity);
        const isMine = isCurrentUserPost(postData);
        const isLiked = likeState.isSaved;
        const isSaved = saveState.isSaved;
        const commentCount = Array.isArray(postData.comments) ? postData.comments.length : 0;
        const safePostContent = String(postData.content || '').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '\\n');

        return `
            <div class="glass-card post" data-post-id="${postId}" id="my-share-${postId}" style="position:relative; padding:16px; border-radius:18px; border:1px solid rgba(99,102,241,0.12); background:rgba(255,255,255,0.9); box-shadow:0 8px 20px rgba(15,23,42,0.05);">
                <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
                    <img src="${avatarUrl}" class="user-avatar" style="width:44px; height:44px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(authorUsername)}'">
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:800; display:flex; align-items:center; gap:6px; flex-wrap:wrap; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(authorUsername)}'">
                            <span>${authorName}</span>
                            <span class="post-time">• ${formatPostTimestamp(postData.timestamp)}</span>
                        </div>
                        <div style="font-size:0.78rem; color:var(--text-muted); cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(authorUsername)}'">@${authorUsername}</div>
                    </div>
                    ${isMine ? `<div style="display:flex; gap:6px;">
                        <button type="button" onclick="openEditModal('${postId}', '${safePostContent}', 'post')" style="background:none; border:none; color:var(--text-muted); cursor:pointer;" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="post-delete-btn" onclick="deletePost('${postId}')" style="position:static;" title="Sil"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>
                ${content ? `<div style="white-space:pre-wrap; color:var(--text-main); line-height:1.55; font-size:0.94rem;">${content}</div>` : ''}
                ${imageHtml}
                ${youtubeHtml}
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:12px;">
                    <button class="tool-btn icon-count" onclick="likePost('${postId}', this)" data-liked="${isLiked ? 'true' : 'false'}" aria-pressed="${isLiked ? 'true' : 'false'}" style="gap:3px; color:${isLiked ? '#ef4444' : ''}"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>(${likeState.normalizedSavedBy.length})</span></button>
                    <button class="tool-btn icon-count" onclick="toggleCommentSection('${postId}')" style="gap:3px;"><i class="fa-regular fa-comment"></i><span>(${commentCount})</span></button>
                    <button class="tool-btn icon-count" onclick="toggleBookmark('${postId}', this)" data-saved="${isSaved ? 'true' : 'false'}" aria-pressed="${isSaved ? 'true' : 'false'}" style="gap:3px; color:${isSaved ? '#f59e0b' : ''}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i><span>(${saveState.normalizedSavedBy.length})</span></button>
                    <button class="tool-btn" onclick="window.reportPost('${postId}', '${(authorUsername || '').replace(/'/g, "\\'")}' )" title="Gönderiyi bildir" style="gap:5px; margin-left:auto; color:#f59e0b;"><i class="fa-regular fa-flag"></i></button>
                    <button class="tool-btn" onclick="window.openShareMenu('${postId}')" style="gap:5px;"><i class="fa-solid fa-share"></i></button>
                </div>
                <div id="comments-${postId}" class="comment-area" style="display:none; margin-top:10px;">
                    <div id="list-${postId}">${(postData.comments || []).map((c) => `
                        <div class="comment-item" style="margin-bottom:8px;">
                            <div style="font-weight:700; font-size:0.85rem;">${escapeHtml(c.displayName || c.username || 'Kullanıcı')}</div>
                            <div style="font-size:0.9rem; color:var(--text-main);">${escapeHtml(c.text || '')}</div>
                        </div>
                    `).join('')}</div>
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <input type="text" id="input-${postId}" aria-label="Yorum girin" placeholder="Yorum yaz..." maxlength="200" style="flex:1; padding:8px 12px; border-radius:10px; border:1px solid var(--border); outline:none; background: var(--input-bg); color: var(--text-main);">
                        <button onclick="addComment('${postId}')" style="background:var(--primary); color:white; border:none; padding:0 15px; border-radius:10px; cursor:pointer;">Gönder</button>
                    </div>
                </div>
            </div>`;
}

window.renderMySharesInline = async function() {
        const uname = getMySharesUsername();
        const panel = document.getElementById('my-shares-panel') || document.getElementById('community-my-shares-panel');
        if (!panel) return false;

    const feed = document.getElementById('feed-items');
    if (feed) feed.style.display = 'none';
    panel.style.display = 'block';

        if (!uname) {
                panel.innerHTML = '<div style="padding:8px 2px; color:var(--text-secondary);">Paylaşımlarını göstermek için önce giriş yapmalısın.</div>';
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return true;
        }

        panel.innerHTML = '<div style="padding:8px 2px; color:var(--text-secondary);">Paylaşımların yükleniyor...</div>';

        try {
                const snap = await getDocs(query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(40)));
                const shares = [];

                snap.forEach((docSnap) => {
                        const post = docSnap.data();
                        const isMine = post.username === uname || post.adminUser === uname;
                        if (isMine) {
                                shares.push(buildInlineShareCard(docSnap.id, post));
                        }
                });

                if (!shares.length) {
                        panel.innerHTML = `
                            <div style="padding:8px 2px; color:var(--text-secondary);">
                                Henüz paylaşımın yok.
                            </div>`;
                } else {
                        panel.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                                <div style="font-size:0.95rem; font-weight:800; color:var(--text-main);">Benim Paylaşımlarım</div>
                                <div style="font-size:0.8rem; color:var(--text-secondary);">${shares.length} gönderi</div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:10px;">${shares.join('')}</div>`;
                }

                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return true;
        } catch (error) {
                console.error('Paylaşımlar yüklenemedi:', error);
                panel.innerHTML = '<div style="padding:8px 2px; color:var(--danger);">Paylaşımlar yüklenemedi.</div>';
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return false;
        }
};

window.openMyShares = function() {
        const feed = document.getElementById('feed-items');
        const sharesPanel = document.getElementById('my-shares-panel');

        if (sharesPanel) {
            sharesPanel.style.display = 'block';
            sharesPanel.innerHTML = '<div style="padding:8px 2px; color:var(--text-secondary);">Paylaşımların yükleniyor...</div>';
        }
        if (feed) {
            feed.style.display = 'none';
        }

        currentFeedFilterMode = 'mine';
        return window.renderMySharesInline();
};

document.addEventListener('DOMContentLoaded', () => {
    const postRulesTrigger = document.getElementById('postRulesTrigger');
    if (!postRulesTrigger) return;

    const openRules = (event) => {
        if (event) event.preventDefault();
        if (typeof window.openPostRulesModal === 'function') {
            window.openPostRulesModal();
        }
    };

    postRulesTrigger.addEventListener('click', openRules);
    postRulesTrigger.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            openRules(event);
        }
    });
});

window._copyInviteLink = async function (link) {
    try {
        await navigator.clipboard.writeText(link || window._currentInviteLink || '');
        const btn = document.getElementById('invite-copy-btn');
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-check"></i> Kopyalandı!'; btn.style.background = '#22c55e'; setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-copy"></i> Kopyala'; btn.style.background = 'var(--primary)'; }, 2000); }
    } catch (_) {
        alert('Link kopyalanamadı. Lütfen elle kopyalayın: ' + (link || ''));
    }
    window._recordInvite('copy', encodeURIComponent(link || window._currentInviteLink || ''));
};

window._recordInvite = async function (platform, encodedLink) {
    if (!auth.currentUser) return;
    try {
        await addDoc(collection(db, 'davetler'), {
            inviterUid:      auth.currentUser.uid,
            inviterUsername: window._currentInviteUsername || '',
            inviteLink:      decodeURIComponent(encodedLink || ''),
            platform,
            createdAt:       serverTimestamp(),
            accepted:        false,
            acceptedByUid:   null
        });
    } catch (e) {
        console.warn('Davet kaydedilemedi:', e);
    }
};

function loadComponents() {
    try {
        if (typeof initChatWidget === 'function') {
            initChatWidget();
        }
        if (typeof updateUIWithUser === 'function') {
            updateUIWithUser();
        }
        if (typeof updateSidebarStats === 'function') {
            updateSidebarStats();
        }
        if (typeof updateChatUnreadIndicator === 'function') {
            updateChatUnreadIndicator();
        }
        if (typeof loadTopReadBlogs === 'function') {
            loadTopReadBlogs();
        }
        if (typeof loadTopLikedPosts === 'function') {
            loadTopLikedPosts();
        }
    } catch (err) {
        console.warn('loadComponents hatası:', err);
    }
}
window.loadComponents = loadComponents;

// Sayfa yüklendiğinde çalıştır (parçalar yüklendikten sonra)
document.addEventListener('includesLoaded', () => {
    loadComponents();
    // sidebar elements may not exist until includes are injected, so update UI again
    if (typeof updateUIWithUser === 'function') updateUIWithUser();
    if (typeof updateSidebarStats === 'function') updateSidebarStats();
    if (typeof updateChatUnreadIndicator === 'function') updateChatUnreadIndicator();

    // Re-run blog page initialization once includes are loaded (for nav/button activation)
    if (document.getElementById('page-blog')) {
        const params = new URLSearchParams(window.location.search);
        const postId = params.get('id');
        const createMode = params.get('create') === '1';

        if (postId) {
            loadBlogPostById(postId);
        } else if (createMode) {
            showBlogView('create');
        } else {
            loadBlogPosts();
        }
    }
});

  const firebaseConfig = {
    apiKey: "AIzaSyBegJHqlfPagx8biFyS_FnE3iXOksgfoAU",
    authDomain: "sosyaltrend-21d21.firebaseapp.com",
    projectId: "sosyaltrend-21d21",
    storageBucket: "sosyaltrend-21d21.firebasestorage.app",
    messagingSenderId: "207734473261",
    appId: "1:207734473261:web:f31b6bf2908c6d88986ea4",
    measurementId: "G-5T2RCQL3MB"
  };

// Hızlı UID ile arkadaş isteği gönderme (suggestions içinden çağrılır)
async function sendFriendRequestToUid(targetUid, targetUsername) {

    // sendFriendRequestToUid - hızlı arkadaş isteği
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }
    // Kendinize istek gönderilmesini engelle
    if (targetUid === auth.currentUser.uid) {
        alert('Kendinize arkadaşlık isteği gönderemezsiniz.');
        return;
    }

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        const targetDoc = await getDoc(targetUserRef);
        if (!targetDoc.exists()) {
            alert('Kullanıcı bulunamadı');
            return;
        }

        const friendRequest = {
    fromUid: auth.currentUser.uid,
    fromUsername: user.username,
    fromName: user.displayName,
    fromAvatar: user.avatarUrl,
    timestamp: Date.now(), // serverTimestamp() yerine Date.now() kullanıldı
    status: 'pending'
};

        await updateDoc(targetUserRef, { friendRequests: arrayUnion(friendRequest) }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(targetUserRef, { friendRequests: [friendRequest] }, { merge: true });
            }
        });

        // serverTimestamp() yerine Date.now() kullanarak hatayı çözüyoruz
const requestData = { 
    toUid: targetUid, 
    toUsername: targetUsername, 
    toName: (targetDoc.data().displayName || targetUsername), 
    toAvatar: (targetDoc.data().avatarUrl || 'assets/img/strendsaydamv2.png'), 
    timestamp: Date.now() // DEĞİŞİKLİK BURADA
};

await updateDoc(currentUserRef, { 
    sentRequests: arrayUnion(requestData) 
}).catch(async (err) => {
    if (err.code === 'not-found') {
        await setDoc(currentUserRef, { 
            sentRequests: [requestData] // Burada da Date.now() içeren objeyi kullandık
        }, { merge: true });
    }
});

        // UI: butonu güncelle - iptal edilebilir hâle getir
        const btn = document.getElementById('addFriendBtn_sugg_' + targetUid);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İsteği iptal et';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.onclick = () => cancelFriendRequestToUid(targetUid, targetUsername);
        }

    } catch (err) {
        console.error('Hızlı arkadaş isteği gönderme hatası:', err);
        alert('İstek gönderilemedi: ' + err.message);
    }
}

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);

  async function handleCommunityInviteResponse(communityId, accept = true) {
      if (!auth.currentUser || !communityId) return;

      try {
          const communityRef = doc(db, 'topluluklar', communityId);
          const communitySnap = await getDoc(communityRef);
          if (!communitySnap.exists()) return;

          if (accept) {
              const memberData = {
                  uid: auth.currentUser.uid,
                  displayName: auth.currentUser.displayName || auth.currentUser.email || auth.currentUser.uid
              };
              await updateDoc(communityRef, {
                  members: arrayUnion(memberData),
                  invitedUsers: arrayRemove(auth.currentUser.uid)
              });
          } else {
              await updateDoc(communityRef, {
                  invitedUsers: arrayRemove(auth.currentUser.uid)
              });
          }

          const userRef = doc(db, 'users', auth.currentUser.uid);
          const userSnap = await getDoc(userRef);
          const notifications = Array.isArray(userSnap.data()?.notifications) ? userSnap.data().notifications : [];
          const updatedNotifications = notifications.filter((notification) => !(notification.type === 'community_invite' && notification.communityId === communityId));
          await updateDoc(userRef, {
              notifications: updatedNotifications
          });

          window.dispatchEvent(new Event('notifications:changed'));

          if (typeof window.openCommunityDetail === 'function' && window.location.pathname.includes('topluluk')) {
              await window.openCommunityDetail(communityId);
          }
      } catch (error) {
          console.error('Topluluk daveti yanıtlanırken hata:', error);
      }
  }

  window.handleCommunityInviteResponse = handleCommunityInviteResponse;
  window.acceptCommunityInvite = async function(communityId) {
      await handleCommunityInviteResponse(communityId, true);
  };
  window.rejectCommunityInvite = async function(communityId) {
      await handleCommunityInviteResponse(communityId, false);
  };

  // sidebar statistics (last user plus total count)
  async function updateSidebarStats() {
      const totalSpan = document.getElementById('sidebarTotalUsers');
      const recentList = document.getElementById('sidebarRecentList');
      console.log('updateSidebarStats called', { totalSpan, recentList });
      if (!totalSpan || !recentList) {
          if (totalSpan || recentList) {
              console.error('Missing sidebar stats elements: totalSpan=', !!totalSpan, 'recentList=', !!recentList);
          }
          return;
      }
      try {
          const usersCol = collection(db, 'users');
          const allSnap = await getDocs(usersCol);
          const total = allSnap.size;
          console.log('Total users:', total);
          // count-up animation
          if (totalSpan) {
              let current = 0;
              const step = Math.max(1, Math.floor(total / 30));
              const interval = setInterval(() => {
                  current += step;
                  if (current >= total) {
                      totalSpan.innerText = total;
                      clearInterval(interval);
                  } else {
                      totalSpan.innerText = current;
                  }
              }, 30);
          }

          // fetch most recent 10 users
          const latestQ = query(usersCol, orderBy('createdAt', 'desc'), limit(10));
          const latestSnap = await getDocs(latestQ);
          console.log('Recent users fetched:', latestSnap.size);
          recentList.innerHTML = '';
          if (!latestSnap.empty) {
              latestSnap.docs.forEach((docSnap, idx) => {
                  const docData = docSnap.data();
                  const name = docData.displayName || docData.username || '—';
                  const uid = docSnap.id;
                  const avatar = docData.avatarUrl || '';
                  const item = document.createElement('div');
                  item.className = 'recent-item-avatar';
                  item.style.animationDelay = `${idx * 0.1}s`;
                  const imgEl = document.createElement('img');
                  if (avatar) {
                      imgEl.src = avatar;
                      imgEl.alt = name;
                      imgEl.style.cursor = 'pointer';
                      imgEl.onclick = () => { window.location.href = `profil.html?id=${encodeURIComponent(uid)}`; };
                  } else {
                      imgEl.src = 'assets/img/strendsaydamv2.png';
                      imgEl.alt = name;
                  }
                  item.appendChild(imgEl);
                  recentList.appendChild(item);
                  console.log('Added user avatar:', name);
              });
          } else {
              console.warn('No recent users found');
              recentList.innerHTML = '<div class="no-recent">Henüz kullanıcı yok</div>';
          }
      } catch (e) {
          console.error('sidebar stats fetch error', e);
      }
  }

  let user = {
  uid: null,
  username: '',
  displayName: "Misafir",
  avatarUrl: "assets/img/strendsaydamv2.png",
  email: null,
  lastActiveAt: null,
  createdAt: null,
  friendCount: 0,
  pendingRequests: 0,
  tebrikCount: 0,
  website: '',
  facebook: '',
  twitter: '',
  youtube: '',
  bio: '',
  interests: '',
  isAdmin: false,
  isModerator: false
};

window.user = user;
window.db = typeof db !== 'undefined' ? db : undefined;
window.auth = typeof auth !== 'undefined' ? auth : undefined;
window.storage = typeof storage !== 'undefined' ? storage : undefined;
window.query = typeof query !== 'undefined' ? query : undefined;
window.collection = typeof collection !== 'undefined' ? collection : undefined;
window.doc = typeof doc !== 'undefined' ? doc : undefined;
window.getDoc = typeof getDoc !== 'undefined' ? getDoc : undefined;
window.getDocs = typeof getDocs !== 'undefined' ? getDocs : undefined;
window.where = typeof where !== 'undefined' ? where : undefined;
window.orderBy = typeof orderBy !== 'undefined' ? orderBy : undefined;
window.limit = typeof limit !== 'undefined' ? limit : undefined;
window.updateDoc = typeof updateDoc !== 'undefined' ? updateDoc : undefined;
window.setDoc = typeof setDoc !== 'undefined' ? setDoc : undefined;
window.addDoc = typeof addDoc !== 'undefined' ? addDoc : undefined;
window.deleteDoc = typeof deleteDoc !== 'undefined' ? deleteDoc : undefined;
window.onSnapshot = typeof onSnapshot !== 'undefined' ? onSnapshot : undefined;
window.serverTimestamp = typeof serverTimestamp !== 'undefined' ? serverTimestamp : undefined;
window.arrayUnion = typeof arrayUnion !== 'undefined' ? arrayUnion : undefined;
window.arrayRemove = typeof arrayRemove !== 'undefined' ? arrayRemove : undefined;
window.Timestamp = typeof Timestamp !== 'undefined' ? Timestamp : undefined;
window.ref = typeof ref !== 'undefined' ? ref : undefined;
window.uploadBytes = typeof uploadBytes !== 'undefined' ? uploadBytes : undefined;
window.getDownloadURL = typeof getDownloadURL !== 'undefined' ? getDownloadURL : undefined;
window.deleteObject = typeof deleteObject !== 'undefined' ? deleteObject : undefined;

function normalizeBookmarkIdentity(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.toLowerCase().split('@')[0];
}

function getCurrentBookmarkIdentity() {
    const candidates = [
        window.user?.username,
        window.user?.displayName,
        auth?.currentUser?.displayName,
        auth?.currentUser?.email,
        auth?.currentUser?.uid
    ];

    for (const candidate of candidates) {
        const normalized = normalizeBookmarkIdentity(candidate);
        if (normalized) return normalized;
    }

    return '';
}

function getBookmarkState(savedBy, currentIdentity) {
    const normalizedSavedBy = (Array.isArray(savedBy) ? savedBy : [])
        .map(normalizeBookmarkIdentity)
        .filter(Boolean);

    return {
        normalizedSavedBy,
        isSaved: Boolean(currentIdentity && normalizedSavedBy.includes(currentIdentity))
    };
}

function getCurrentUserIdentity() {
    return getCurrentBookmarkIdentity();
}

function isCurrentUserPost(post) {
    if (!post) return false;

    const currentIdentity = getCurrentUserIdentity();
    const currentUid = auth?.currentUser?.uid || user?.uid || null;
    const identityCandidates = [
        post.username,
        post.authorUsername,
        post.adminUser,
        post.authorUser,
        post.userName,
        post.ownerUsername
    ];

    const hasMatchingIdentity = identityCandidates.some((value) => {
        if (!value) return false;
        return normalizeBookmarkIdentity(value) === currentIdentity;
    });

    const hasMatchingUid = [post.authorUid, post.uid, post.userId, post.ownerUid].some((value) => {
        if (!value || !currentUid) return false;
        return String(value) === String(currentUid);
    });
    return hasMatchingIdentity || hasMatchingUid;
}

function buildAnnouncementCard(announcementId, data, currentUsername) {
    const content = (data.content || '').trim();
    if (!content) return null;

    let createdAt = 'Bilinmiyor';
    if (data.timestamp) {
        const date = data.timestamp.toDate();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        createdAt = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }

    const isLiked = currentUsername && data.likes ? data.likes.includes(currentUsername) : false;
    const savedState = getBookmarkState(data.savedBy, currentUsername);
    const isSaved = savedState.isSaved;
    const likeCount = data.likes ? data.likes.length : 0;
    const commentCount = data.comments ? data.comments.length : 0;
    const card = document.createElement('div');
    card.className = 'glass-card post-composer announcement-card';
    card.setAttribute('data-announcement-id', announcementId);
    card.setAttribute('data-announcement-data', JSON.stringify(data));

    card.innerHTML = `
        <div class="announcement-header">
            <div class="announcement-author">
                <div class="announcement-avatar"><i class="fa-solid fa-bullhorn"></i></div>
                <div class="announcement-details">
                    <div class="announcement-title">
                        SosyaLTrend Duyurusu
                        <span class="announcement-badge">Resmi</span>
                    </div>
                    <div class="announcement-subtitle">@official_system</div>
                </div>
            </div>
            <div class="announcement-meta">${createdAt}</div>
        </div>
        <div class="announcement-content">${content}</div>
        <div class="announcement-footer">
            <div class="announcement-stats"></div>
            <div class="announcement-actions">
                <button class="announcement-action-btn announcement-like-btn" type="button" data-liked="${isLiked ? 'true' : 'false'}" onclick="likeAnnouncement('${announcementId}', this)">
                    <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                    <span>${likeCount}</span>
                </button>
                <button id="comment-toggle-${announcementId}" class="announcement-action-btn announcement-comment-btn" type="button" onclick="toggleAnnouncementComments('${announcementId}')">
                    <i class="fa-regular fa-comment"></i>
                    <span class="announcement-comment-count">${commentCount}</span>
                </button>
            </div>
        </div>
        <div id="comments-ann-${announcementId}" class="comment-area announcement-comment-area">
            <div class="comment-input-area">
                <img src="${(window.user && window.user.avatarUrl) || 'assets/img/strendsaydamv2.png'}" alt="Avatar">
                <div class="comment-row-inner">
                    <input id="input-ann-${announcementId}" type="text" placeholder="Yorum yaz...">
                    <button class="comment-submit-btn" type="button" onclick="postAnnouncementComment('${announcementId}')">Gönder</button>
                </div>
            </div>
            <div id="list-ann-${announcementId}" class="announcement-comment-list"></div>
        </div>
    `;

    return card;
}

window.addAnnouncementsToFeed = async () => {
    try {
        const announcementContainer = document.getElementById('announcement-feed');
        if (!announcementContainer) return;

        const announcementsSnap = await getDocs(
            query(collection(db, "announcements"), orderBy("timestamp", "desc"), limit(10))
        );

        if (announcementsSnap.empty) {
            announcementContainer.innerHTML = '';
            return;
        }

        const currentUsername = getCurrentBookmarkIdentity();
        const existingAnnouncementIds = new Set(Array.from(announcementContainer.querySelectorAll('[data-announcement-id]')).map((card) => card.getAttribute('data-announcement-id')));
        const announcementElements = [];

        announcementsSnap.forEach((doc) => {
            const data = doc.data();
            const announcementId = doc.id;
            if (existingAnnouncementIds.has(announcementId)) return;

            const card = buildAnnouncementCard(announcementId, data, currentUsername);
            if (!card) return;

            announcementElements.push({ card, data, id: announcementId });
        });

        announcementElements.reverse().forEach((item) => {
            announcementContainer.insertBefore(item.card, announcementContainer.firstChild);
            if (item.data.comments && item.data.comments.length > 0) {
                renderAnnouncementComments(item.id, item.data.comments);
            }
        });
    } catch (e) {
        console.error('Feed duyuru ekleme hatası:', e);
    }
};

// Duyuru beğeni
window.likeAnnouncement = async (announcementId, btn) => {
    if (!auth.currentUser) {
        alert('Beğenmek için giriş yapmalısınız');
        return;
    }

    try {
        const ref = doc(db, "announcements", announcementId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data();
        const likes = Array.isArray(data.likes) ? [...data.likes] : [];
        const username = user.username || auth.currentUser.email;
        const isCurrentlyLiked = btn?.dataset.liked === 'true';

        let updatedLikes;
        if (isCurrentlyLiked) {
            updatedLikes = likes.filter(u => u !== username);
        } else {
            updatedLikes = likes.includes(username) ? likes : [...likes, username];
        }

        await updateDoc(ref, { likes: updatedLikes });

        // UI güncelle
        const newCount = updatedLikes.length;
        if (btn) {
            const icon = btn.querySelector('i');
            const count = btn.querySelector('span');

            if (count) {
                count.textContent = newCount;
            }

            btn.dataset.liked = String(!isCurrentlyLiked);
            if (isCurrentlyLiked) {
                icon?.classList.remove('fa-solid');
                icon?.classList.add('fa-regular');
                btn.style.color = '';
            } else {
                icon?.classList.remove('fa-regular');
                icon?.classList.add('fa-solid');
                btn.style.color = '#ef4444';
            }
        }
    } catch (e) {
        console.error('Duyuru beğeni hatası:', e);
    }
};

// Duyuru yorum
window.toggleAnnouncementComments = (announcementId) => {
    const commentArea = document.getElementById(`comments-ann-${announcementId}`);
    const toggleButton = document.getElementById(`comment-toggle-${announcementId}`);
    if (!commentArea) return;

    const isExpanded = commentArea.classList.toggle('expanded');
    if (toggleButton) {
        const commentCount = Number(document.querySelector(`[data-announcement-id="${announcementId}"] .announcement-comment-count`)?.textContent || 0);
        toggleButton.innerHTML = `
            <i class="fa-regular fa-comment"></i>
            <span class="announcement-comment-count">${commentCount}</span>
        `;
        toggleButton.title = isExpanded ? 'Yorumları gizle' : 'Yorumları göster';
    }
};

window.postAnnouncementComment = async (announcementId) => {
    if (!auth.currentUser) {
        alert('Yorum yapmak için giriş yapmalısınız');
        return;
    }
    
    const input = document.getElementById(`input-ann-${announcementId}`);
    if (!input || !input.value.trim()) return;
    
    const commentText = input.value.trim();
    
    try {
        const ref = doc(db, "announcements", announcementId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        
        const data = snap.data();
        const comments = data.comments || [];
        
        const newComment = {
            username: user.username || auth.currentUser.email,
            displayName: user.displayName || auth.currentUser.email,
            avatarUrl: user.avatarUrl || 'assets/img/strendsaydamv2.png',
            isAdmin: user.isAdmin || false,
            text: commentText,
            time: Date.now()
        };
        
        await updateDoc(ref, { comments: [...comments, newComment] });
        
        input.value = '';
        const updatedComments = [...comments, newComment];
        renderAnnouncementComments(announcementId, updatedComments);
        
        const announcementCard = document.querySelector(`[data-announcement-id="${announcementId}"]`);
        if (announcementCard) {
            const likeButton = announcementCard.querySelector('.announcement-like-btn span');
            const commentButton = document.getElementById(`comment-toggle-${announcementId}`);
            if (commentButton) {
                const commentCountText = updatedComments.length > 0 ? updatedComments.length : '';
                commentButton.innerHTML = `
                    <i class="fa-regular fa-comment"></i>
                    <span class="announcement-comment-count">${commentCountText}</span>
                `;
            }
            const commentArea = document.getElementById(`comments-ann-${announcementId}`);
            if (commentArea && !commentArea.classList.contains('expanded')) {
                commentArea.classList.add('expanded');
            }
        }
    } catch (e) {
        console.error('Duyuru yorum hatası:', e);
    }
};

window.renderAnnouncementComments = (announcementId, comments) => {
    const listDiv = document.getElementById(`list-ann-${announcementId}`);
    if (!listDiv) return;

    const currentUsername = getCurrentBookmarkIdentity();
    const canManageAll = window.user?.isAdmin;

    if (!Array.isArray(comments) || comments.length === 0) {
        listDiv.innerHTML = `<div class="comment-item"><p style="margin:0;color:var(--text-muted);font-size:0.92rem;">Henüz yorum yok. İlk yorumu sen yap!</p></div>`;
        return;
    }

    listDiv.innerHTML = comments.map((c, idx) => {
        const date = new Date(c.time);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const formattedTime = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        const allowDelete = Boolean(currentUsername && (currentUsername === c.username || canManageAll));

        return `
            <div class="comment-item">
                <div class="comment-header">
                    <div>
                        <span class="comment-author">${c.displayName || c.username}</span>
                        <span class="comment-username">@${c.username}</span>
                    </div>
                    ${allowDelete ? `<button class="comment-delete-btn" type="button" onclick="deleteAnnouncementComment('${announcementId}', ${idx})">Sil</button>` : ''}
                </div>
                <p>${c.text}</p>
                <div class="comment-time">${formattedTime}</div>
            </div>
        `;
    }).join('');
};

// Duyuru kaydet
window.bookmarkAnnouncement = async (announcementId, button) => {
    if (!auth.currentUser) {
        alert('Kaydetmek için giriş yapmalısınız');
        return;
    }

    try {
        const ref = doc(db, "announcements", announcementId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data();
        const currentIdentity = getCurrentBookmarkIdentity();
        if (!currentIdentity) {
            alert('Kaydetmek için giriş yapmalısınız');
            return;
        }

        const savedState = getBookmarkState(data.savedBy, currentIdentity);
        const nextSaved = !savedState.isSaved;
        const updatedSaved = nextSaved
            ? [...new Set([...savedState.normalizedSavedBy, currentIdentity])]
            : savedState.normalizedSavedBy.filter(u => u !== currentIdentity);

        await updateDoc(ref, { savedBy: updatedSaved });

        if (button) {
            const icon = button.querySelector('i');
            const count = button.querySelector('span');
            button.dataset.saved = String(nextSaved);
            button.setAttribute('aria-pressed', String(nextSaved));
            if (icon) {
                icon.classList.toggle('fa-solid', nextSaved);
                icon.classList.toggle('fa-regular', !nextSaved);
            }
            if (count) {
                count.textContent = `(${updatedSaved.length})`;
            }
            button.style.color = nextSaved ? '#f59e0b' : '';
        }
    } catch (e) {
        console.error('Duyuru kaydet hatası:', e);
    }
};

// Duyuru sil
window.deleteAnnouncement = async (announcementId) => {
    if (!auth.currentUser || !user.isAdmin) {
        alert('Sadece yöneticiler duyuru silebilir');
        return;
    }
    
    if (!confirm('Bu duyuruyu silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "announcements", announcementId));
        showToast('Duyuru başarıyla silindi', 'success');
    } catch (e) {
        console.error('Duyuru silme hatası:', e);
        showToast('Duyuru silinirken hata oluştu', 'error');
    }
};

// Duyuru düzenle
window.editAnnouncement = async (announcementId) => {
    if (!auth.currentUser || !user.isAdmin) {
        alert('Sadece yöneticiler duyuru düzenleyebilir');
        return;
    }
    
    try {
        const ref = doc(db, "announcements", announcementId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        
        const data = snap.data();
        const newContent = prompt('Duyuruyu düzenle:', data.content || '');
        
        if (newContent === null) return; // Kullanıcı cancel etti
        if (!newContent.trim()) {
            alert('Duyuru boş olamaz');
            return;
        }
        
        await updateDoc(ref, {
            content: newContent.trim(),
            updatedAt: serverTimestamp()
        });
        
        showToast('Duyuru başarıyla güncellendi', 'success');
    } catch (e) {
        console.error('Duyuru düzenleme hatası:', e);
        showToast('Duyuru düzenlenirken hata oluştu', 'error');
    }
};

window.deleteAnnouncementComment = async (announcementId, commentIndex) => {
    if (!auth.currentUser) {
        alert('Yorumu silmek için giriş yapmalısınız');
        return;
    }

    try {
        const ref = doc(db, "announcements", announcementId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data();
        const comments = Array.isArray(data.comments) ? [...data.comments] : [];
        const comment = comments[commentIndex];

        if (!comment) return;

        const currentUsername = getCurrentBookmarkIdentity();
        const canDelete = currentUsername && (currentUsername === comment.username || window.user?.isAdmin);
        if (!canDelete) {
            alert('Bu yorumu silme yetkiniz yok.');
            return;
        }

        if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) {
            return;
        }

        comments.splice(commentIndex, 1);
        await updateDoc(ref, { comments });

        renderAnnouncementComments(announcementId, comments);

        const commentButton = document.getElementById(`comment-toggle-${announcementId}`);
        if (commentButton) {
            const commentCountText = comments.length > 0 ? comments.length : '';
            commentButton.innerHTML = `
                <i class="fa-regular fa-comment"></i>
                <span class="announcement-comment-count">${commentCountText}</span>
            `;
        }

        showToast('Yorum başarıyla silindi', 'success');
    } catch (e) {
        console.error('Yorum silme hatası:', e);
        showToast('Yorum silinirken hata oluştu', 'error');
    }
};

// Feed real-time güncellemesi - duyuruları dinle
window.listenForAnnouncementChanges = () => {
    try {
        const announcementContainer = document.getElementById('announcement-feed');
        if (!announcementContainer) return;
        
        // User ready değilse, hata olmasın
        const currentUsername = (window.user && window.user.username) || (auth.currentUser && auth.currentUser.email.split('@')[0]) || null;
        
        onSnapshot(
            query(collection(db, "announcements"), orderBy("timestamp", "desc")),
            (snap) => {
                const existingIds = new Set(Array.from(announcementContainer.querySelectorAll('[data-announcement-id]')).map((card) => card.getAttribute('data-announcement-id')));
                const announcementElements = [];

                snap.forEach((doc) => {
                    const data = doc.data();
                    const content = (data.content || '').trim();
                    if (!content) return;

                    const announcementId = doc.id;
                    if (existingIds.has(announcementId)) return;

                    const card = buildAnnouncementCard(announcementId, data, currentUsername);
                    if (!card) return;

                    announcementElements.push({ card, data, id: announcementId });
                });

                announcementElements.reverse().forEach((item) => {
                    announcementContainer.insertBefore(item.card, announcementContainer.firstChild);
                });

                snap.forEach((doc) => {
                    const data = doc.data();
                    if (data.comments && data.comments.length > 0) {
                        renderAnnouncementComments(doc.id, data.comments);
                    }
                });
            },
            (error) => {
                console.error('Feed duyuru dinleme hatası:', error);
            }
        );
    } catch (e) {
        console.error('Feed duyuru dinleme başlatma hatası:', e);
    }
};

// Cache author avatars to avoid fetching multiple times
const blogAuthorAvatarCache = {};

// Track posts whose view count we've already incremented this session
const viewedPostIds = new Set();
// Track posts whose "okuyan" list we've already updated this session
const readersUpdatedPostIds = new Set();

// Utility: wait for a DOM selector to appear (returns element or null)
function waitForElement(selector, timeout = 5000, interval = 200) {
    return new Promise((resolve) => {
        const start = Date.now();
        (function check() {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            if (Date.now() - start > timeout) return resolve(null);
            setTimeout(check, interval);
        })();
    });
}

function parseDateValue(value) {
    if (!value) return null;
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        const parsed = value.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    if (typeof value === 'object' && value.seconds != null) {
        const seconds = Number(value.seconds);
        if (!Number.isNaN(seconds)) {
            return new Date(seconds * 1000);
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatJoinDate(value) {
    const date = parseDateValue(value);
    if (!date) return '—';
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

const ADMIN_EMAIL = "officialfthuzun@gmail.com";

const ADMIN_USERNAME = (ADMIN_EMAIL.split('@')[0] || '').toLowerCase();

function parseProfileUsernameFromUrlLike(text = '') {
    const match = String(text).match(/profil\.html\?id=([^'"\s&)]+)/i);
    if (!match || !match[1]) return '';
    try {
        return decodeURIComponent(match[1]).trim().toLowerCase();
    } catch (_) {
        return String(match[1]).trim().toLowerCase();
    }
}

function extractUsernameFromText(text = '') {
    const match = String(text).match(/@([a-zA-Z0-9._-]{2,})/);
    return match && match[1] ? match[1].toLowerCase() : '';
}

function inferAvatarUsername(imgEl) {
    if (!imgEl) return '';

    const directDataset = imgEl.dataset?.username || imgEl.closest('[data-username]')?.getAttribute('data-username') || '';
    if (directDataset) return directDataset.trim().toLowerCase();

    const profileAnchor = imgEl.closest('a[href*="profil.html?id="]');
    if (profileAnchor) {
        const fromHref = parseProfileUsernameFromUrlLike(profileAnchor.getAttribute('href') || '');
        if (fromHref) return fromHref;
    }

    const onclickHolder = imgEl.closest('[onclick*="profil.html?id="]');
    if (onclickHolder) {
        const fromOnclick = parseProfileUsernameFromUrlLike(onclickHolder.getAttribute('onclick') || '');
        if (fromOnclick) return fromOnclick;
    }

    const context = imgEl.closest('.post, .friends-dropdown-item, .chat-friend-item, .moderation-card, .user-row, .dropdown-menu-header, .profile-header, .profile-trigger') || imgEl.parentElement;
    const text = context?.textContent || '';
    const fromText = extractUsernameFromText(text);
    if (fromText) return fromText;

    return '';
}

function applyAdminCrownBadges(root = document) {
    const isCurrentUserAdmin = localStorage.getItem('st_isAdmin') === '1';
    const selector = [
        '.avatar-wrap img',
        '.chat-friend-avatar-wrap img',
        '.sidebar-profile-avatar img',
        '.friends-dropdown-avatar',
        '.post img.user-avatar',
        'img[id*="Avatar"]',
        'img[class*="avatar"]'
    ].join(',');

    const imgs = Array.from((root || document).querySelectorAll(selector));
    imgs.forEach((imgEl) => {
        const inferredUsername = inferAvatarUsername(imgEl);
        const isAdminAvatar = inferredUsername === ADMIN_USERNAME
            || (isCurrentUserAdmin && (imgEl.id === 'headerAvatar' || !!imgEl.closest('#profileTrigger, .profile-trigger, .dropdown-menu-header')));

        const badgeHost = imgEl.closest('.avatar-wrap, .chat-friend-avatar-wrap, .sidebar-profile-avatar') || imgEl.parentElement;
        if (!badgeHost) return;

        if (isAdminAvatar) {
            badgeHost.classList.add('admin-crown-badge');
        } else {
            badgeHost.classList.remove('admin-crown-badge');
        }
    });
}

function initAdminCrownBadgeSystem() {
    if (window.__adminCrownBadgeInitDone) return;
    window.__adminCrownBadgeInitDone = true;

    let rafId = 0;
    const scheduleApply = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            applyAdminCrownBadges(document);
        });
    };

    scheduleApply();

    const observer = new MutationObserver(() => {
        scheduleApply();
    });

    observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'class', 'href', 'onclick', 'data-username']
    });

    window.applyAdminCrownBadges = applyAdminCrownBadges;
}

initAdminCrownBadgeSystem();

// Avatar sistemini otomatik olarak strendsaydamv2'ye initialize et
localStorage.setItem('st_avatar', 'strendsaydamv2');

async function updateUserPresence(userRef, online) {
    if (!userRef) return;
    try {
        await setDoc(userRef, {
            isOnline: online,
            lastActiveAt: serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.warn('Kullanıcı çevrimiçi durumu güncellenemedi:', err);
    }
}

// Presence heartbeat to keep lastActiveAt updated periodically
let presenceHeartbeatInterval = null;
const PRESENCE_HEARTBEAT_INTERVAL = 20000; // 20 seconds

function startPresenceHeartbeat() {
    if (!auth.currentUser) return;
    stopPresenceHeartbeat();
    const userRef = doc(db, 'users', auth.currentUser.uid);
    // mark online immediately
    updateUserPresence(userRef, true).catch(() => {});
    presenceHeartbeatInterval = setInterval(() => {
        if (!auth.currentUser) return;
        const ref = doc(db, 'users', auth.currentUser.uid);
        updateUserPresence(ref, true).catch(() => {});
    }, PRESENCE_HEARTBEAT_INTERVAL);
}

function stopPresenceHeartbeat() {
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
}

window.setCurrentUserOnline = async function() {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateUserPresence(userRef, true);
    startPresenceHeartbeat();
};

window.setCurrentUserOffline = async function() {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateUserPresence(userRef, false);
    stopPresenceHeartbeat();
};

onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
        localStorage.removeItem('st_isAdmin');
        if (typeof kontrolEtVeOtomatikPostAt === 'function') {
            kontrolEtVeOtomatikPostAt();
        }
        window.location.href = 'login.html';
        return;
    } else {
        // Yönetici tarafından silinmiş (arşivlenmiş) hesapların tekrar açılmasını engelle.
        try {
            const deletedUserSnap = await getDoc(doc(db, 'deletedUsers', fbUser.uid));
            if (deletedUserSnap.exists()) {
                await signOut(auth).catch(() => {});
                alert('Hesabınız yönetici tarafından kapatılmıştır.');
                window.location.href = 'login.html';
                return;
            }
        } catch (deletedCheckError) {
            console.error('Deleted user check failed:', deletedCheckError);
        }

        // Kullanıcı bilgilerini güncelle
        user.uid = fbUser.uid;
        user.username = fbUser.email.split('@')[0];
        user.email = fbUser.email;
        user.displayName = localStorage.getItem('st_displayName') || fbUser.displayName || user.username;
        
        // Avatar URL'i Firestore'dan çek
        let userData = null;

        const hasBlockedIdentity = (profileData, authUser) => {
            const usernameRaw = String(profileData?.username || '').trim().toLowerCase();
            const displayNameRaw = String(profileData?.displayName || profileData?.name || '').trim().toLowerCase();
            const emailRaw = String(profileData?.email || authUser?.email || '').trim().toLowerCase();
            const emailLocal = emailRaw.includes('@') ? emailRaw.split('@')[0] : '';

            const blockedValues = new Set(['bilinmiyor', 'unknown', 'deleted_user', 'silinmis_kullanici', 'misafir']);

            if (!usernameRaw) return true;
            if (blockedValues.has(usernameRaw)) return true;
            if (displayNameRaw && blockedValues.has(displayNameRaw)) return true;
            if (emailLocal && blockedValues.has(emailLocal)) return true;
            return false;
        };

        try {
            const userRef = doc(db, "users", fbUser.uid);
            const userDoc = await getDoc(userRef);
            userData = userDoc.exists() ? userDoc.data() : null;

            if (userDoc.exists() && hasBlockedIdentity(userData, fbUser)) {
                await signOut(auth).catch(() => {});
                alert('Hesap bilgileriniz doğrulanamadığı için erişim engellendi. Lütfen yönetici ile iletişime geçin.');
                window.location.href = 'login.html';
                return;
            }
            
            if (userDoc.exists()) {
                const data = userData;
                // copy any relevant fields into our local user object
                if (data.avatarUrl) {
                    user.avatarUrl = data.avatarUrl;
                }
                if (data.displayName) {
                    user.displayName = data.displayName;
                }
                if (data.username) {
                    user.username = data.username;
                }
                if (data.email) {
                    user.email = data.email;
                }
                if (data.lastActiveAt) {
                    user.lastActiveAt = data.lastActiveAt;
                }
                if (data.location) {
                    user.location = data.location;
                }
                if (data.hometown) {
                    user.hometown = data.hometown;
                }
                if (data.dob) {
                    user.dob = data.dob;
                }
                if (typeof data.occupation !== 'undefined') {
                    user.occupation = data.occupation || '';
                }
                if (typeof data.website !== 'undefined') {
                    user.website = data.website || '';
                }
                if (typeof data.facebook !== 'undefined') {
                    user.facebook = data.facebook || '';
                }
                if (typeof data.twitter !== 'undefined') {
                    user.twitter = data.twitter || '';
                }
                if (typeof data.youtube !== 'undefined') {
                    user.youtube = data.youtube || '';
                }
                if (typeof data.bio !== 'undefined') {
                    user.bio = data.bio || '';
                }
                if (typeof data.interests !== 'undefined') {
                    user.interests = data.interests || '';
                }
                if (data.createdAt) {
                    user.createdAt = data.createdAt;
                } else if (userDoc.createTime) {
                    user.createdAt = userDoc.createTime;
                } else if (fbUser.metadata && fbUser.metadata.creationTime) {
                    user.createdAt = new Date(fbUser.metadata.creationTime);
                } else {
                    // if existing doc somehow lacks timestamp, write one
                    await setDoc(userRef, { createdAt: serverTimestamp() }, { merge: true });
                    user.createdAt = { seconds: Math.floor(Date.now() / 1000) };
                }
                user.friendCount = Array.isArray(data.friends) ? data.friends.length : 0;
                user.pendingRequests = Array.isArray(data.friendRequests) ? data.friendRequests.length : 0;
                user.tebrikCount = typeof data.tebrikCount === 'number' ? data.tebrikCount : 0;
            } else {
                // User document doesn't exist yet; create with timestamp
                user.avatarUrl = "assets/img/strendsaydamv2.png";
                try {
                    await setDoc(userRef, {
                        displayName: user.displayName,
                        avatarUrl: user.avatarUrl,
                        email: fbUser.email,
                        username: user.username,
                        createdAt: serverTimestamp()
                    }, { merge: true });
                    user.createdAt = { seconds: Math.floor(Date.now() / 1000) };
                } catch (e) {
                    // User already exists
                }
            }

            // Kullanıcının son aktif olduğu zamanı kaydet
            await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true });
                    // no privacy sync needed, revert to original behaviour

        } catch (err) {
            console.error("Avatar yükleme hatası:", err);
            user.avatarUrl = "assets/img/strendsaydamv2.png";
        }

        // Admin Kontrolü
        user.isAdmin = fbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || (userData && userData.isAdmin === true);
        // Moderator Kontrolü
        user.isModerator = (userData && userData.isModerator === true) || false;
        // store flag for other scripts
        localStorage.setItem('st_isAdmin', user.isAdmin ? '1' : '0');
        
        // UI Güncelleme (Profil resmi, isimler vb.)
        updateUIWithUser();
        applyAdminCrownBadges(document);
        updateSidebarCongratsPercent();
        // also update sidebar statistics such as total users and last signup
        updateSidebarStats();
        loadTopTebrikList();
        loadTopLikedPosts();
        loadTopReadBlogs();
        updateBanOverlay(userData);
        // Ensure feed is loaded with current user context so profile tabs populate
        try { loadPostsFeed(); } catch(e) { console.warn('loadPostsFeed retry failed', e); }
        // also populate profile sections if on profile page
        if (typeof window.loadProfileSections === 'function') {
            try {
                const visitedUsername = window.getVisitedProfileUsername ? window.getVisitedProfileUsername() : null;
                if (!window.location.pathname.endsWith('profil.html') || !visitedUsername) {
                    window.loadProfileSections('all');
                } else {
                    console.log('Skipping auth-state profile section load for visited profile:', visitedUsername);
                }
            } catch(e) {
                console.warn('loadProfileSections call during auth state failed', e);
            }
        }
        // update tebrik badge for own profile
        if (typeof updateProfileTebrikUI === 'function' && user.username) updateProfileTebrikUI(user.username);
        if (typeof window.loadHeaderFriendsList === 'function') {
            window.loadHeaderFriendsList();
        }
        
        // Real-time kullanıcı profili listener - Avatar değişikliklerini senkronize et
        onSnapshot(doc(db, "users", fbUser.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                // Avatar değişmişse güncelle
                if (userData.avatarUrl && userData.avatarUrl !== user.avatarUrl) {
                    user.avatarUrl = userData.avatarUrl;
                    localStorage.setItem('st_avatarUrl', userData.avatarUrl);
                    updateUIWithUser();
                    applyAdminCrownBadges(document);
                }
                // Display name değişmişse güncelle
                if (userData.displayName && userData.displayName !== user.displayName) {
                    user.displayName = userData.displayName;
                    localStorage.setItem('st_displayName', userData.displayName);
                    updateUIWithUser();
                    applyAdminCrownBadges(document);
                }
                if (Array.isArray(userData.friends)) {
                    user.friendCount = userData.friends.length;
                    updateUIWithUser();
                }
                if (Array.isArray(userData.friendRequests)) {
                    user.pendingRequests = userData.friendRequests.length;
                    updateUIWithUser();
                }
                if (typeof userData.tebrikCount === 'number') {
                    user.tebrikCount = userData.tebrikCount;
                    updateUIWithUser();
                }
                if (typeof userData.location !== 'undefined' && userData.location !== user.location) {
                    user.location = userData.location || '';
                    updateUIWithUser();
                }
                if (typeof userData.hometown !== 'undefined' && userData.hometown !== user.hometown) {
                    user.hometown = userData.hometown || '';
                    updateUIWithUser();
                }
                if (typeof userData.dob !== 'undefined' && userData.dob !== user.dob) {
                    user.dob = userData.dob || '';
                    updateUIWithUser();
                }
                if (typeof userData.website !== 'undefined' && userData.website !== user.website) {
                    user.website = userData.website || '';
                    updateUIWithUser();
                }
                if (typeof userData.facebook !== 'undefined' && userData.facebook !== user.facebook) {
                    user.facebook = userData.facebook || '';
                    updateUIWithUser();
                }
                if (typeof userData.twitter !== 'undefined' && userData.twitter !== user.twitter) {
                    user.twitter = userData.twitter || '';
                    updateUIWithUser();
                }
                if (typeof userData.youtube !== 'undefined' && userData.youtube !== user.youtube) {
                    user.youtube = userData.youtube || '';
                    updateUIWithUser();
                }
                if (typeof userData.bio !== 'undefined' && userData.bio !== user.bio) {
                    user.bio = userData.bio || '';
                    updateUIWithUser();
                }
                if (typeof userData.interests !== 'undefined' && userData.interests !== user.interests) {
                    user.interests = userData.interests || '';
                    updateUIWithUser();
                }
                // Bildirimleri (arkadaş istekleri + diğer bildirimler) güncelle
                loadNotifications(userData);
                if (typeof window.loadProfileNotifications === 'function') {
                    window.loadProfileNotifications();
                }
                updateBanOverlay(userData);
                if (typeof userData.isAdmin !== 'undefined') {
                    const newAdminStatus = userData.isAdmin === true || fbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                    if (newAdminStatus !== user.isAdmin) {
                        user.isAdmin = newAdminStatus;
                        localStorage.setItem('st_isAdmin', user.isAdmin ? '1' : '0');
                        updateUIWithUser();
                    }
                }
                if (typeof userData.isModerator !== 'undefined') {
                    const newModStatus = userData.isModerator === true;
                    if (newModStatus !== user.isModerator) {
                        user.isModerator = newModStatus;
                        updateUIWithUser();
                    }
                }
                // isPrivate değişmişse yerelde de sakla
                if (typeof userData.isPrivate !== 'undefined' && userData.isPrivate !== isPrivate) {
                    isPrivate = userData.isPrivate;
                    localStorage.setItem('st_isPrivate', isPrivate);
                    updateUIWithUser();
                }
                updateSidebarCongratsPercent();
            }
        });
        
        // Eski postların avatarlarını güncelle
        migrateOldAvatars();

        // ADMIN ÖZEL İŞLEMLERİ
        if (user.isAdmin) {
            // İstatistikleri çek
            updateAdminStats();
        }
        syncAdminUiVisibility();
        // NOTE: Moderatör butonu kaldırıldı; sadece admin butonu gösteriliyor.
    }
    
    // Profil sayfasında ziyaretçi profilini kontrol et
    loadVisitorProfile();

    function getTimestampDate(value) {
        if (!value) return null;
        if (typeof value.toDate === 'function') return value.toDate();
        if (typeof value.toMillis === 'function') return new Date(value.toMillis());
        if (value.seconds) return new Date(value.seconds * 1000);
        return new Date(value);
    }

    async function updateSidebarCongratsPercent() {
        const el = document.getElementById('sidebarCongratsRank');
        if (!el) return;
        const count = user.tebrikCount || 0;
        try {
            const topQ = query(collection(db, 'users'), orderBy('tebrikCount', 'desc'), limit(1));
            const topSnap = await getDocs(topQ);
            const topCount = topSnap.empty ? 0 : (topSnap.docs[0].data().tebrikCount || 0);
            const percent = topCount > 0 ? Math.min(100, Math.round((count / topCount) * 100)) : 0;
            el.innerText = `%${percent}`;
        } catch (e) {
            console.error('updateSidebarCongratsPercent hata:', e);
            el.innerText = '%0';
        }
    }

    function updateBanOverlay(userData) {
        const existing = document.getElementById('ban-overlay');
        const banUntilDate = getTimestampDate(userData?.banUntil);
        const now = new Date();
        const isPermanentBan = userData?.isBanned === true && !banUntilDate;
        const banActive = isPermanentBan || (userData?.isBanned === true && banUntilDate && banUntilDate > now);
        const banUntilDisplay = isPermanentBan ? 'Kalıcı' : (banUntilDate ? banUntilDate.toLocaleString('tr-TR') : 'Bilinmiyor');

        if (!banActive) {
            if (existing) {
                existing.remove();
                document.body.style.overflow = '';
            }
            return;
        }

        if (existing) {
            existing.querySelector('#banUntilText').textContent = banUntilDisplay;
            existing.querySelector('#banReasonText').textContent = userData.banReason || 'Sebep belirtilmedi';
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'ban-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.95);color:#f8fafc;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `
            <div style="max-width:600px; width:100%; background:rgba(15,23,42,0.98); border:1px solid rgba(148,163,184,0.18); border-radius:20px; padding:28px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <h2 style="margin:0 0 12px; font-size:1.9rem;">${isPermanentBan ? 'Kalıcı Uzaklaştırıldınız' : 'Uzaklaştırıldınız'}</h2>
                <p style="margin:0 0 18px; color:#cbd5e1; line-height:1.7;">Bu hesap şu anda siteden uzaklaştırılmıştır. ${isPermanentBan ? 'Ban kalıcı olduğu için erişim engeli süresizdir.' : 'Ban süresi boyunca sayfaya erişim engellenmiştir.'}</p>
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(148,163,184,0.18); border-radius:16px; padding:18px; margin-bottom:20px;">
                    <p style="margin:0 0 8px;"><strong>Ban nedeni:</strong> <span id="banReasonText">${escapeHtml(userData.banReason || 'Sebep belirtilmedi')}</span></p>
                    <p style="margin:0 0 8px;"><strong>Ban bitiş:</strong> <span id="banUntilText">${escapeHtml(banUntilDisplay)}</span></p>
                    <p style="margin:0; color:#94a3b8;"><strong>Yönetici:</strong> ${escapeHtml(userData.banBy || 'Admin')}</p>
                </div>
                <div style="display:grid; gap:12px; margin-top:16px;">
                    <button id="banAppealToggleBtn" style="width:100%; padding:14px 18px; border-radius:14px; border:none; background: #2563eb; color:white; font-weight:700; cursor:pointer;">İletişim Formunu Aç</button>
                    <button id="banLogoutBtn" style="width:100%; padding:14px 18px; border-radius:14px; border:none; background: #ef4444; color:white; font-weight:700; cursor:pointer;">Çıkış Yap</button>
                </div>
                <div id="banAppealForm" style="display:none; margin-top:20px;">
                    <textarea id="banAppealMessage" placeholder="Ban itirazınızı yazın..." style="width:100%; min-height:140px; padding:14px; border-radius:16px; border:1px solid rgba(148,163,184,0.35); background:rgba(15,23,42,0.9); color:#f8fafc; resize:vertical; outline:none;"></textarea>
                    <button id="banAppealSendBtn" style="width:100%; margin-top:14px; padding:14px 18px; border-radius:14px; border:none; background:#14b8a6; color:white; font-weight:700; cursor:pointer;">Mesaj Gönder</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const toggleBtn = overlay.querySelector('#banAppealToggleBtn');
        const logoutBtn = overlay.querySelector('#banLogoutBtn');
        const form = overlay.querySelector('#banAppealForm');
        const sendBtn = overlay.querySelector('#banAppealSendBtn');
        const messageEl = overlay.querySelector('#banAppealMessage');

        toggleBtn.addEventListener('click', () => {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            if (form.style.display === 'block') {
                messageEl.focus();
            }
        });

        logoutBtn.addEventListener('click', async () => {
            try {
                await window.setCurrentUserOffline();
                await signOut(auth);
            } catch (err) {
                console.error('Çıkış yapılamadı:', err);
                alert('Çıkış yapılırken hata oluştu. Lütfen tekrar deneyin.');
            }
        });

        sendBtn.addEventListener('click', async () => {
            const message = messageEl.value.trim();
            if (!message) {
                alert('Lütfen mesaj yazın.');
                return;
            }
            try {
                await addDoc(collection(db, 'banAppeals'), {
                    userId: auth.currentUser.uid,
                    username: userData.username || userData.email?.split('@')[0] || 'Bilinmeyen',
                    banReason: userData.banReason || '',
                    message,
                    sentAt: serverTimestamp(),
                    responded: false
                });
                alert('Ban itirazınız yöneticilere iletildi.');
                sendBtn.textContent = 'İtiraz Gönderildi';
                sendBtn.disabled = true;
                messageEl.value = '';
            } catch (err) {
                console.error('Ban itirazı gönderilemedi:', err);
                alert('Mesaj gönderilemedi.');
            }
        });
    }
    
    // Kendi profili açılıyorsa
    const visitedUsername = getVisitedProfileUsername();
    if (!visitedUsername || visitedUsername === user.username) {
        // localStorage'ı temizle
        localStorage.removeItem('visiting_username');
        
        // Arkadaş butonu gizle
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.style.display = 'none';
        }
        
        // Profili Düzenle butonunu göster
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.style.display = 'inline-block';
        }
        
        if (auth.currentUser) {
            // Kendi profilse tüm arkadaşları yükle ve varsayılan tabı açık bırak
            loadFriendsList(null, true);
            // Son tebrikleri preview'da göster
            if (typeof loadLatestTebriklerPreview === 'function') {
                setTimeout(() => loadLatestTebriklerPreview(), 100);
            }
        }
    } else {
        // Başka bir profil ziyareti
        if (auth.currentUser) {
            // otomatik 'Ortak Arkadaşlar' sekmesini aç
            const friendsTabBtn = document.getElementById('friends-tab-btn');
            if (friendsTabBtn) {
                friendsTabBtn.click();
            }
            // yükle (isOwnProfile=false)
            loadFriendsList(null, false);
        }
    }
});

window.addEventListener('beforeunload', () => {
    if (auth.currentUser) {
        window.setCurrentUserOffline();
    }
});

window.addEventListener('pagehide', () => {
    if (auth.currentUser) {
        window.setCurrentUserOffline();
    }
});

// Eski postların avatarlarını strendsaydamv2 ile güncellemek
async function migrateOldAvatars() {
    // Bir defa çalış
    if (localStorage.getItem('avatarsMigrated')) return;
    
    try {
        const postsSnap = await getDocs(collection(db, "posts"));
        
        postsSnap.forEach(async (postDoc) => {
            const post = postDoc.data();
            // Eğer avatarUrl yoksa, varsayılan URL'i ekle
            if (!post.avatarUrl) {
                await updateDoc(postDoc.ref, { 
                    avatarUrl: "assets/img/strendsaydamv2.png"
                });
            }
        });
        
        localStorage.setItem('avatarsMigrated', 'true');
    } catch (err) {
        console.error("Avatar migration hatası:", err);
    }
}

async function updateAdminStats() {
    if(!user.isAdmin) return;
    try {
        const postsSnap = await getDocs(collection(db, "posts"));
        // Elementler sayfada varsa güncelle
        const postStat = document.getElementById('stat-total-posts');
        if (postStat) postStat.innerText = postsSnap.size;
    } catch (error) {
        console.error("Admin istatistikleri yüklenirken hata:", error);
    }
}

// --- PROFIL DUZENLEME VE AVATAR FONKSIYONLARI ---
let tempAvatarBuffer = null;

function normalizeUsernameValue(value) {
    const raw = String(value || '').trim();
    const withoutAt = raw.replace(/^@+/, '').trim();
    return withoutAt.toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function formatUsernameHandle(value) {
    const normalized = normalizeUsernameValue(value);
    return normalized ? `@${normalized}` : '';
}

async function updateUsernameAcrossCollections(oldUsername, newUsername) {
    if (!oldUsername || !newUsername || oldUsername === newUsername) return;

    const collectionTargets = [
        { collectionName: 'posts', fieldName: 'username' },
        { collectionName: 'posts', fieldName: 'authorUsername' },
        { collectionName: 'blogs', fieldName: 'authorUsername' },
        { collectionName: 'videos', fieldName: 'authorUsername' },
        { collectionName: 'music', fieldName: 'authorUsername' }
    ];

    const updatePromises = [];

    for (const target of collectionTargets) {
        try {
            const q = query(collection(db, target.collectionName), where(target.fieldName, '==', oldUsername));
            const snap = await getDocs(q);
            snap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data[target.fieldName] === oldUsername) {
                    updatePromises.push(updateDoc(docSnap.ref, { [target.fieldName]: newUsername }));
                }
            });
        } catch (err) {
            console.warn(`Kullanıcı adı güncellenirken ${target.collectionName} koleksiyonu güncellenemedi:`, err);
        }
    }

    await Promise.allSettled(updatePromises);
}

    window.toggleEditProfile = () => {
        const visitedUsername = getVisitedProfileUsername();
        if (visitedUsername && window.user && visitedUsername !== window.user.username) {
            alert('Bu profili düzenleyemezsiniz.');
            return;
        }
        const form = document.getElementById('editProfileSection');
        if (form) {
            form.classList.toggle('active');
            
            // Mevcut değerleri doldur
            const nameInput = document.getElementById('newNameInput');
            if (nameInput) nameInput.value = user.displayName || "";

            const usernameInput = document.getElementById('newUsernameInput');
            if (usernameInput) usernameInput.value = user.username ? formatUsernameHandle(user.username) : "";
            
            const urlInput = document.getElementById('newAvatarUrlInput');
            if (urlInput && user.avatarUrl && user.avatarUrl.startsWith('http')) {
                urlInput.value = user.avatarUrl;
            }
            const locationInput = document.getElementById('newLocationInput');
            if (locationInput) locationInput.value = user.location || "";
            const hometownInput = document.getElementById('newHometownInput');
            if (hometownInput) hometownInput.value = user.hometown || "";
            const dobInput = document.getElementById('newDobInput');
            if (dobInput) dobInput.value = user.dob || "";
            const occupationInput = document.getElementById('newOccupationInput');
            if (occupationInput) occupationInput.value = user.occupation || "";
            const websiteInput = document.getElementById('newWebsiteInput');
            if (websiteInput) websiteInput.value = user.website || "";
            const facebookInput = document.getElementById('newFacebookInput');
            if (facebookInput) facebookInput.value = user.facebook || "";
            const twitterInput = document.getElementById('newTwitterInput');
            if (twitterInput) twitterInput.value = user.twitter || "";
            const youtubeInput = document.getElementById('newYoutubeInput');
            if (youtubeInput) youtubeInput.value = user.youtube || "";
            const bioInput = document.getElementById('newBioInput');
            if (bioInput) bioInput.value = user.bio || "";
            const interestsInput = document.getElementById('newInterestsInput');
            if (interestsInput) interestsInput.value = user.interests || "";
            
            tempAvatarBuffer = null;
        } else {
            console.warn("editProfileSection element bulunamadı!");
        }
    };

    // ----------------------------------
    // Ayarlar menüsü / gizlilik vs.
    // ----------------------------------
    window.toggleProfileSettings = () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.toggle('visible');
    };

    window.changePassword = async () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.remove('visible');
        if (!auth.currentUser) return alert('Giriş yapmalısınız');
        const newPass = prompt(translations[currentLang].changePassword + ':');
        if (newPass && newPass.length >= 6) {
            try {
                await updatePassword(auth.currentUser, newPass);
                alert('✅ Şifreniz güncellendi');
            } catch (e) {
                console.error(e);
                alert('❌ Şifre değiştirilemedi: ' + e.message);
            }
        } else if (newPass) {
            alert('Şifre en az 6 karakter olmalıdır');
        }
    };

    window.changeEmail = async () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.remove('visible');
        if (!auth.currentUser) return alert('Giriş yapmalısınız');
        const newEmail = prompt(translations[currentLang].changeEmail + ':');
        if (newEmail && newEmail.includes('@')) {
            try {
                await updateEmail(auth.currentUser, newEmail);
                alert('✅ E-posta adresiniz güncellendi');
            } catch (e) {
                console.error(e);
                alert('❌ E-posta değiştirilemedi: ' + e.message);
            }
        } else if (newEmail) {
            alert('Geçerli bir e-posta girin');
        }
    };

    async function archiveDeletedUserData(userId, userData, deletedBy) {
        try {
            await setDoc(doc(db, 'deletedUsers', userId), {
                ...userData,
                deletedBy: deletedBy || 'self',
                deletedAt: serverTimestamp(),
                originalUid: userId
            }, { merge: true });
        } catch (e) {
            console.error('Silinen kullanıcı verisi arşivlenemedi:', e);
        }
    }

    async function _cleanupUserPostsAndContent(uid, username) {
        const collectionsToDelete = [
            { name: 'posts', authorUidField: 'authorUid', authorUsernameField: 'username' },
            { name: 'videos', authorUidField: 'authorUid', authorUsernameField: 'authorUsername' },
            { name: 'music', authorUidField: 'authorUid', authorUsernameField: 'authorUsername' },
            { name: 'blogs', authorUidField: 'authorUid', authorUsernameField: 'authorUsername' }
        ];

        const deleteRefs = new Map();

        for (const collectionInfo of collectionsToDelete) {
            try {
                if (uid && collectionInfo.authorUidField) {
                    const snap = await getDocs(query(collection(db, collectionInfo.name), where(collectionInfo.authorUidField, '==', uid)));
                    snap.forEach((docSnap) => deleteRefs.set(`${collectionInfo.name}:${docSnap.id}`, docSnap.ref));
                }

                if (username && collectionInfo.authorUsernameField) {
                    const snap = await getDocs(query(collection(db, collectionInfo.name), where(collectionInfo.authorUsernameField, '==', username)));
                    snap.forEach((docSnap) => deleteRefs.set(`${collectionInfo.name}:${docSnap.id}`, docSnap.ref));
                }
            } catch (e) {
                console.error(`cleanup query failed for ${collectionInfo.name}`, e);
            }
        }

        for (const ref of deleteRefs.values()) {
            try {
                await deleteDoc(ref);
            } catch (e) {
                console.error('delete doc failed', e);
            }
        }
    }

    async function _cleanupUserPostInteractions(username) {
        if (!username) return;
        try {
            const postsSnap = await getDocs(collection(db, 'posts'));
            for (const postDoc of postsSnap.docs) {
                const postData = postDoc.data();
                let changed = false;
                const updates = {};

                if (Array.isArray(postData.likes) && postData.likes.includes(username)) {
                    updates.likes = postData.likes.filter((item) => item !== username);
                    changed = true;
                }

                if (Array.isArray(postData.savedBy) && postData.savedBy.includes(username)) {
                    updates.savedBy = postData.savedBy.filter((item) => item !== username);
                    changed = true;
                }

                if (Array.isArray(postData.comments) && postData.comments.length > 0) {
                    const cleanedComments = postData.comments.reduce((acc, comment) => {
                        if (comment.username === username) {
                            return acc;
                        }

                        const updatedComment = { ...comment };
                        if (Array.isArray(updatedComment.replies) && updatedComment.replies.length > 0) {
                            const filteredReplies = updatedComment.replies.filter((reply) => reply.username !== username);
                            if (filteredReplies.length !== updatedComment.replies.length) {
                                updatedComment.replies = filteredReplies;
                                changed = true;
                            }
                        }
                        acc.push(updatedComment);
                        return acc;
                    }, []);

                    if (cleanedComments.length !== postData.comments.length) {
                        updates.comments = cleanedComments;
                        changed = true;
                    }
                }

                if (changed) {
                    try {
                        await updateDoc(postDoc.ref, updates);
                    } catch (e) {
                        console.error('update post interactions failed', e);
                    }
                }
            }
        } catch (e) {
            console.error('cleanup user post interactions failed', e);
        }
    }

    async function _cleanupUserReferences(uid, username) {
        if (!uid) return;
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            for (const userDoc of usersSnap.docs) {
                if (userDoc.id === uid) continue;
                const data = userDoc.data();
                const updates = {};
                let changed = false;

                if (Array.isArray(data.friends) && data.friends.includes(uid)) {
                    updates.friends = data.friends.filter((item) => item !== uid);
                    changed = true;
                }

                if (Array.isArray(data.friendRequests)) {
                    const filtered = data.friendRequests.filter((req) => req.fromUid !== uid && req.toUid !== uid);
                    if (filtered.length !== data.friendRequests.length) {
                        updates.friendRequests = filtered;
                        changed = true;
                    }
                }

                if (Array.isArray(data.sentRequests)) {
                    const filtered = data.sentRequests.filter((req) => req.fromUid !== uid && req.toUid !== uid);
                    if (filtered.length !== data.sentRequests.length) {
                        updates.sentRequests = filtered;
                        changed = true;
                    }
                }

                if (Array.isArray(data.notifications)) {
                    const filtered = data.notifications.filter((notif) => notif.fromUid !== uid && notif.fromName !== username);
                    if (filtered.length !== data.notifications.length) {
                        updates.notifications = filtered;
                        changed = true;
                    }
                }

                if (changed) {
                    try {
                        await updateDoc(userDoc.ref, updates);
                    } catch (e) {
                        console.error('cleanup user references failed for', userDoc.id, e);
                    }
                }
            }
        } catch (e) {
            console.error('cleanup user references failed', e);
        }
    }

    window.deleteAccount = async () => {
        if (!auth.currentUser) {
            return alert('Hesap silme işlemi için giriş yapmalısınız.');
        }

        const currentUser = auth.currentUser;
        const confirmation = confirm('Hesabınızı silmek üzeresiniz. Bu işlem geri alınamaz ve tüm içerikleriniz kalıcı olarak silinir. Devam etmek istiyor musunuz?');
        if (!confirmation) return;

        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            return alert('Kullanıcı bilgileri bulunamadı. Lütfen tekrar giriş yapın.');
        }

        const username = userSnap.data().username || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : '');
        const deleteBtn = document.querySelector('button[onclick*="deleteAccount"]');
        if (deleteBtn) {
            disableButton(deleteBtn, 'Siliniyor...');
        }

        try {
            await archiveDeletedUserData(currentUser.uid, userSnap.data(), 'self');
            await _cleanupUserPostsAndContent(currentUser.uid, username);
            await _cleanupUserPostInteractions(username);
            await _cleanupUserReferences(currentUser.uid, username);
            await deleteDoc(userRef);

            try {
                await deleteUser(currentUser);
            } catch (authError) {
                console.error('deleteUser failed', authError);
                if (authError.code === 'auth/requires-recent-login') {
                    alert('Hesabınızı silmek için lütfen yeniden giriş yapın ve tekrar deneyin.');
                    return;
                }
                alert('Hesabınız silindi, ancak kimlik doğrulama hesabı silinemedi: ' + authError.message);
            }

            alert('Hesabınız ve ilişkili içerikler başarıyla silindi.');
            await signOut(auth).catch(() => {});
            window.location.href = 'login.html';
            setTimeout(() => { window.location.href = 'login.html'; }, 250);
        } catch (e) {
            console.error('deleteAccount error', e);
            alert('Hesap silme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.style.opacity = '1';
                deleteBtn.style.cursor = 'pointer';
            }
        }
    };

    window.toggleProfilePrivacy = async () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.remove('visible');
        isPrivate = !isPrivate;
        localStorage.setItem('st_isPrivate', isPrivate);
        // Firestore'a kaydetmek için
        if (auth.currentUser) {
            try {
                await updateDoc(doc(db, 'users', auth.currentUser.uid), { isPrivate });
            } catch (e) {
                console.error('privacy update error', e);
            }
        }
        updateUIWithUser();
        alert(isPrivate ? '✅ Profiliniz artık gizli.' : '✅ Profiliniz artık herkese açık.');
    };

    // global click listener menüyü kapatmak için
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('profileSettingsMenu');
        // if click is not inside the menu and not on the settings button (or its children)
        if (menu && !menu.contains(e.target) && !e.target.closest('#settingsBtn')) {
            menu.classList.remove('visible');
        }
    });

// Kullanıcının tüm eski postlarının avatarını güncelle
async function updateUserPostsAvatar(username, newAvatarUrl) {
    try {
        const postsSnap = await getDocs(
            query(collection(db, "posts"), where("username", "==", username))
        );
        
        postsSnap.forEach(async (postDoc) => {
            try {
                await updateDoc(postDoc.ref, {
                    avatarUrl: newAvatarUrl
                });
            } catch (err) {
                console.error("Post güncelleme hatası:", err);
            }
        });
        
        // Comment'leri de güncelle
        await updateUserCommentsAvatar(username, newAvatarUrl);
        
    } catch (error) {
        console.error("Post güncelleme sorgusi hatası:", error);
    }
}

// Kullanıcının tüm comment ve reply'larının avatarını güncelle
async function updateUserCommentsAvatar(username, newAvatarUrl) {
    try {
        const postsSnap = await getDocs(collection(db, "posts"));
        
        postsSnap.forEach(async (postDoc) => {
            const post = postDoc.data();
            if (!post.comments || post.comments.length === 0) return;
            
            let updated = false;
            const updatedComments = post.comments.map(comment => {
                let updatedComment = { ...comment };
                
                // Comment'in avatarını güncelle
                if (comment.username === username) {
                    updatedComment.avatarUrl = newAvatarUrl;
                    updated = true;
                }
                
                // Reply'ların avatarını güncelle
                if (comment.replies && comment.replies.length > 0) {
                    updatedComment.replies = comment.replies.map(reply => {
                        if (reply.username === username) {
                            updated = true;
                            return { ...reply, avatarUrl: newAvatarUrl };
                        }
                        return reply;
                    });
                }
                
                return updatedComment;
            });
            
            // Eğer bir değişiklik varsa Firestore'da update et
            if (updated) {
                try {
                    await updateDoc(postDoc.ref, {
                        comments: updatedComments
                    });
                } catch (err) {
                    console.error("Comment güncelleme hatası:", err);
                }
            }
        });
        
    } catch (error) {
        console.error("Comment güncelleme hatası:", error);
    }
}


/* Profil Resmini Değiştir */
window.handleFileSelect = async (input) => {
    const visitedUsername = getVisitedProfileUsername();
    if (visitedUsername && window.user && visitedUsername !== window.user.username) {
        alert('Bu profili düzenleyemezsiniz.');
        input.value = '';
        return;
    }
    const file = input.files[0];
    if (!file || !auth.currentUser) return;

    if (file.size > 1024 * 1024) {
        alert("Dosya 1MB'dan küçük olmalıdır!");
        input.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const base64Data = reader.result;
            const userRef = doc(db, "users", auth.currentUser.uid);
            
            // Dizi olmadığı için burada serverTimestamp() kullanmak güvenlidir.
            await updateDoc(userRef, {
                avatarUrl: base64Data,
                avatarType: "local",
                avatarUpdatedAt: serverTimestamp() 
            });
            
            user.avatarUrl = base64Data;
            updateUIWithUser();
            alert("✅ Profil resminiz güncellendi!");
            input.value = "";
        } catch (error) {
            console.error("Avatar hatası:", error);
            alert("❌ Hata: " + error.message);
        }
    };
    reader.readAsDataURL(file);
};

// export module-level function for HTML onclicks
window.sendFriendRequest = async () => {
    // delegate to the real implementation defined later in this module
    if (typeof sendFriendRequest === 'function') {
        return sendFriendRequest();
    }
    // fallback: do nothing
};

window.handleUrlInput = async (input) => {
    const visitedUsername = getVisitedProfileUsername();
    if (visitedUsername && window.user && visitedUsername !== window.user.username) {
        alert('Bu profili düzenleyemezsiniz.');
        input.value = '';
        return;
    }
    const url = input.value.trim();
    if (!url) return;
    
    // Auth kontrolü
    if (!auth.currentUser) {
        alert("Lütfen giriş yapın!");
        return;
    }
    
    // URL kontrolü
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert("Geçerli URL girin (http:// ile başlamalı)");
        return;
    }

    try {
        // Firestore'da kaydet
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            avatarUrl: url,
            avatarType: "url"
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(doc(db, "users", auth.currentUser.uid), {
                    avatarUrl: url,
                    avatarType: "url",
                    displayName: user.displayName,
                    email: auth.currentUser.email
                });
            } else {
                throw err;
            }
        });
        
        user.avatarUrl = url;
        updateUIWithUser();
        
        // Eski postları güncelle (background'da)
        updateUserPostsAvatar(user.username, url);
        
        alert("Avatar güncellendi!");
        input.value = "";
        
    } catch (error) {
        console.error("Hata:", error);
        alert("Hata: " + error.message);
    }
};

  window.promptDiceBear = async () => {
    const visitedUsername = getVisitedProfileUsername();
    if (visitedUsername && window.user && visitedUsername !== window.user.username) {
        alert('Bu profili düzenleyemezsiniz.');
        return;
    }
    // Auth kontrolü
    if (!auth.currentUser) {
        alert("Lütfen giriş yapın!");
        return;
    }
    
    const name = user.displayName || user.username;
    const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&size=256`;
    
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            avatarUrl: dicebearUrl,
            avatarType: "dicebear"
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(doc(db, "users", auth.currentUser.uid), {
                    avatarUrl: dicebearUrl,
                    avatarType: "dicebear",
                    displayName: user.displayName,
                    email: auth.currentUser.email
                });
            } else {
                throw err;
            }
        });
        
        user.avatarUrl = dicebearUrl;
        updateUIWithUser();
        
        // Eski postları güncelle (background'da)
        updateUserPostsAvatar(user.username, dicebearUrl);
        
        alert("Avatar oluşturuldu!");
        
    } catch (error) {
        console.error("Hata:", error);
        alert("Hata: " + error.message);
    }
  };

  window.saveProfileChanges = async () => {
    if (!auth.currentUser) {
      alert('Lütfen giriş yapın ve tekrar deneyin.');
      return;
    }

    const name = document.getElementById('newNameInput')?.value.trim();
    const rawUsername = document.getElementById('newUsernameInput')?.value || '';
    const usernameValue = normalizeUsernameValue(rawUsername);
    const location = document.getElementById('newLocationInput')?.value.trim();
    const hometown = document.getElementById('newHometownInput')?.value.trim();
    const dob = document.getElementById('newDobInput')?.value;

    const updates = {};
    if (name) {
        user.displayName = name;
        localStorage.setItem('st_displayName', name);
        updates.displayName = name;
        await updateProfile(auth.currentUser, { displayName: name }).catch((e) => {
          console.error('updateProfile error:', e);
        });
    }
    if (usernameValue && usernameValue !== (user.username || '').trim()) {
        if (!/^[a-z0-9._-]{3,20}$/.test(usernameValue)) {
            alert('Kullanıcı adı en az 3, en fazla 20 karakter olmalı. Yalnızca harf, rakam, nokta, alt çizgi ve tire kullanabilirsiniz.');
            return;
        }

        const existingUserSnap = await getDocs(query(collection(db, 'users'), where('username', '==', usernameValue), limit(1)));
        const isTakenByAnotherUser = existingUserSnap.docs.some((docSnap) => docSnap.id !== auth.currentUser.uid);
        if (isTakenByAnotherUser) {
            alert('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.');
            return;
        }

        const previousUsername = (user.username || '').trim();
        user.username = usernameValue;
        updates.username = usernameValue;
        localStorage.setItem('st_username', usernameValue);
        await updateUsernameAcrossCollections(previousUsername, usernameValue);
    }

    if (typeof location === 'string') {
        updates.location = location || null;
        user.location = location || '';
    }
    if (typeof hometown === 'string') {
        updates.hometown = hometown || null;
        user.hometown = hometown || '';
    }
    if (typeof dob === 'string') {
        updates.dob = dob || null;
        user.dob = dob || '';
    }
    const occupation = document.getElementById('newOccupationInput')?.value.trim();
    const website = document.getElementById('newWebsiteInput')?.value.trim();
    const facebook = document.getElementById('newFacebookInput')?.value.trim();
    const twitter = document.getElementById('newTwitterInput')?.value.trim();
    const youtube = document.getElementById('newYoutubeInput')?.value.trim();
    const bio = document.getElementById('newBioInput')?.value.trim();
    const interests = document.getElementById('newInterestsInput')?.value.trim();

    if (typeof occupation === 'string') {
        updates.occupation = occupation || null;
        user.occupation = occupation || '';
    }
    if (typeof website === 'string') {
        updates.website = website || null;
        user.website = website || '';
    }
    if (typeof facebook === 'string') {
        updates.facebook = facebook || null;
        user.facebook = facebook || '';
    }
    if (typeof twitter === 'string') {
        updates.twitter = twitter || null;
        user.twitter = twitter || '';
    }
    if (typeof youtube === 'string') {
        updates.youtube = youtube || null;
        user.youtube = youtube || '';
    }
    if (typeof bio === 'string') {
        updates.bio = bio || null;
        user.bio = bio || '';
    }
    if (typeof interests === 'string') {
        updates.interests = interests || null;
        user.interests = interests || '';
    }

    if (Object.keys(updates).length > 0) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        console.log('profile updates:', updates);
        try {
            await updateDoc(userRef, updates);
        } catch (err) {
            console.error("Profil güncelleme hatası:", err);
            if (err.code === 'not-found' || String(err.message).toLowerCase().includes('no document to update')) {
                try {
                    await setDoc(userRef, updates, { merge: true });
                } catch (mergeErr) {
                    console.error('Document merge failed:', mergeErr);
                    alert('Profil güncelleme sırasında bir hata oluştu. Lütfen tekrar deneyin.');
                    return;
                }
            } else {
                alert('Profil güncelleme sırasında bir hata oluştu. Lütfen tekrar deneyin.');
                return;
            }
        }
    }

    if (typeof updateUIWithUser === 'function') updateUIWithUser();
    if (typeof renderProfileHeader === 'function') renderProfileHeader(user, true);
    finishUpdate();
  };

  function finishUpdate() {
    alert("Profil başarıyla güncellendi!");
    const form = document.getElementById('editProfileSection');
    if (form) form.classList.remove('active');
  }


  window.updateUserEmail = async () => {
    const mail = prompt("Yeni e-posta:");
    if(mail && auth.currentUser) {
      try {
        await updateEmail(auth.currentUser, mail);
        alert("Başarılı! Lütfen yeni maille giriş yapın.");
        logout();
      } catch(e) { alert("Hata: " + e.message); }
    }
  };

  window.sendResetMail = async () => {
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      alert("Sıfırlama bağlantısı gönderildi.");
    } catch(e) { alert("Hata: " + e.message); }
  };

  window.logout = async () => {
    // clear admin marker on sign out
    localStorage.removeItem('st_isAdmin');
    if (auth.currentUser) {
      try {
        await window.setCurrentUserOffline();
      } catch (err) {
        console.warn('Çıkışta kullanıcı offline yaparken hata:', err);
      }
      await signOut(auth).catch(() => {});
    }
    window.location.href = 'login.html';
  };

let selectedImageBase64 = null;

// Görsel Seçme İşlemi
const imageInput = document.getElementById('imageInput');

// Sadece element sayfada varsa olay dinleyiciyi ekle
if (imageInput) {
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Base64 dönüşümü yapılırken boyut kontrolü kritik
            if (file.size > 1024 * 1024) { 
                alert("Lütfen 1MB'dan küçük bir fotoğraf seçin.");
                this.value = "";
                updateShareButtonState();
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedImageBase64 = event.target.result;
                const previewImg = document.getElementById('imagePreview');
                const previewContainer = document.getElementById('imagePreviewContainer');
                
                if(previewImg) previewImg.src = selectedImageBase64;
                if(previewContainer) previewContainer.style.display = 'block';
                updateShareButtonState();
            };
            reader.readAsDataURL(file);
        }
    });
}

// Önizleme Temizleme
window.clearImagePreview = () => {
    selectedImageBase64 = null;
    document.getElementById('imageInput').value = "";
    document.getElementById('imagePreviewContainer').style.display = 'none';
    updateShareButtonState();
};
  
// --- ÇEVİRİLER VE KAYDETME ÖZELLİĞİ ---
  const translations = {
    tr: {
      searchPlaceholder: "Arama",
      searchBtn: "Arama",
      menuProfile: "Profiliniz",
      menuSettings: "Ayarlar",
      menuTitle: "Sosyal Menü",
      navFeed: "Anasayfa",
      navBookmarks: "Kaydedilenler",
      navBookmarkss: "Kaydettiklerinizi bu sayfa altına topladık, buradan takip edebilir veya kaydettiklerinizi kaldırabilirsiniz.",
      navSubs: "Beğendiklerim",
      navSubss: "Beğendiğiniz içerikleri bu sayfa altına topladık, buradan takip edebilir veya beğenileri kaldırabilirsiniz.",
      navSearch: "Aramalar",
      searchHeading: "Arama Sonuçları",
      postPlaceholder: "Ne hakkında paylaşımda bulunmak istersiniz?",
      shareBtn: "Paylaş",
      editProfileBtn: "Profili Düzenle",
    footerTagline: "Platformumuza katıldığınızda her zaman bir adım önde olursunuz.",
      footerMenu: "Hızlı Menü",
      footerCorp: "Kurumsal",
      footerAbout: "Hakkımızda",
      footerCareer: "Kariyer",
      footerSupport: "Destek",
      footerContact: "İletişim",
      footerHelp: "Yardım Merkezi",
      footerRights: "Tüm Hakları Saklıdır.",
    footerNote: "Sosyal bağlantılarınızı güçlendirin, gündemi takip edin ve topluluğunuzu büyütün.",
    footerDiscoverCommunity: "Topluluğu Keşfet",
    footerFindFriends: "Arkadaş Bul",
    headerFriends: "Arkadaşlar",
    headerMyFriends: "Arkadaşlarım",
    headerFriendsLoading: "Arkadaşlar yükleniyor...",
    headerSeeAll: "Tümünü Gör",
    headerNotification: "Bildirim",
    headerInbox: "Bildirim Kutusu",
    headerNoNotifications: "Yeni bildirim yok",
    headerGoNotifications: "Bildirime Git",
    headerThemeShort: "Tema Seç",
    headerInviteShort: "Davet Et",
    navCommunities: "Topluluklar",
    profileCardTitle: "Profil Kartınız",
    membershipInfo: "Üyelik Bilgileriniz",
    emailLabel: "E-Posta",
    roleLabel: "Rol",
    roleUser: "Kullanıcı",
    friendsLabel: "Arkadaşlar",
    requestsLabel: "İstekler",
    myProfileBtn: "Profilim",
    adminPanel: "Yönetici Paneli",
    blogMenuTitle: "Blog Menü",
    allPosts: "Tüm Yazılar",
    myArticles: "Yazılarım",
    newArticle: "Yeni Yazı",
    profileMenuTitle: "Profil Menü",
    myPostsNav: "Gönderilerim",
    myLikes: "Beğenilerim",
    mySaves: "Kayıtlarım",
    myFriends: "Arkadaşlarım",
    incomingNotifications: "Gelen Bildirimler",
    mobileNavHome: "Ana",
    mobileNavSearch: "Ara",
    mobileNavNew: "Yeni",
    mobileNavChat: "Sohbet",
    logoutBtn: "Çıkış Yap",
      subBtn: "Abone Ol",
      unsubBtn: "Bırak",
      promptNewName: "Yeni Görünen Ad:",
      confirmDelete: "Bu gönderiyi silmek istediğine emin misin?",
      confirmDeletePage: "Bu sayfayı ve tüm verilerini silmek istediğine emin misin?",
      confirmDeleteComment: "Yorumu silmek istediğine emin misin?",
      myPostsTitle: "Paylaşımlarım",
      settingPrivate: "Gizli Profil",
      settingPrivateDesc: "Profilinizi ve paylaşımlarınızı diğer kullanıcılardan gizleyin.",
      settingTheme: "Koyu Tema",
      commentPlaceholder: "Yorum yaz...",
      sendComment: "Gönder",
      changePassword: "Şifreni Değiştir",
      changeEmail: "E-postanı Değiştir",
      privacyOption: "Profilini Gizle",
      privacyOptionShow: "Profilini Göster",
      privateLabel: "Gizli",
      privateBanner: "Profiliniz Gizli",
      profileHiddenMessage: "Bu profil gizlidir.",
      friendViewNote: "Profil sadece arkadaşlarına açık",
      helpHeading: "Yardım Merkezi",
      helpSub: "Sıkça Sorulan Sorular",
      helpText: "SosyalTrend kullanımı hakkında merak ettiğiniz her şey burada.",
      contactHeading: "İletişim",
      contactText: "Bizimle iletişime geçmek için officialfthuzun@gmail.com adresine mail atabilirsiniz.",
            sendBtn: "Mesajı Gönder",
            rightSearchTitle: "Arama",
            rightSearchPlaceholder: "Aramak istediğin şeyi yaz.",
            rightSearchBtn: "Ara",
            newConnectionsKicker: "Yeni Bağlantılar",
            newConnectionsTitle: "Arkadaş Bul",
            newConnectionsSubtitle: "İlgi alanına göre yeni kişiler keşfet.",
            featureSmartMatch: "Ortak ilgi alanlarına göre akıllı eşleşmeler",
            featureCityCommunity: "Şehir ve topluluk odaklı öneriler",
            friendFindPageBtn: "Arkadaş Bul Sayfası",
            discoverCommunitiesBtn: "Toplulukları Keşfet",
            calendarTitle: "Takvim",
            upcomingEventsTitle: "Yaklaşan Etkinlikler",
            noUpcomingEvents: "Yaklaşan etkinlik yok",
            topCommunitiesTitle: "En popüler 3 topluluk sayfası",
            friendSuggestionsTitle: "Arkadaş Önerileri",
            loadingText: "Yükleniyor...",
            friendFindBtn: "Arkadaş Bul",
            inviteFriendBtn: "Arkadaşını Davet Et",
            composerTitle: "Yeni paylaşım yapmaya hazır mısınız?",
            composerSubtitle: "Hikayenizi, fotoğrafınızı veya fikirlerinizi hemen arkadaşlarınızla paylaşın ve onlarla eğlenceli vakit geçirin.",
            photoBtn: "Fotoğraf",
            emojiBtn: "Emoji",
            pollBtn: "Anket",
            postHelpText: "Yazınızı yazın, resim ekleyin ve ardından hızlıca paylaşın.",
            pollQuestionLabel: "Anket sorusu",
            pollQuestionPlaceholder: "Anket sorusunu yazın...",
            pollOptionsLabel: "Seçenekler",
            pollOption1Placeholder: "Seçenek 1",
            pollOption2Placeholder: "Seçenek 2",
            pollOption3Placeholder: "Seçenek 3 (isteğe bağlı)",
            pollOption4Placeholder: "Seçenek 4 (isteğe bağlı)",
            pollDaysLabel: "Gün",
            pollHoursLabel: "Saat",
            pollMinutesLabel: "Dakika",
            cancelBtn: "İptal",
            createPollBtn: "Anket Oluştur",
            topLikedPostTitle: "En çok beğeni alan gönderi",
            topReadBlogsTitle: "Top 3 en çok okunan blog yazısı",
            editPostTitle: "Gönderiyi Düzenle",
            editPlaceholder: "Burada düzenleyin...",
                saveBtn: "Kaydet",
                replyingToText: "yanıtlanıyor",
                replyToPrefix: "Yanıt",
                noPostsYet: "Henüz paylaşım bulunamadı.",
                postSnippetFallback: "Görsel veya metin içerikli gönderi.",
                topCommentBySuffix: "yorum yaptı",
                topCommentLabel: "En beğenilen yorum",
                commentFallback: "Gönderiye bir yorum eklendi.",
                viewPostBtn: "Gönderiyi Gör",
                topLikesLoadError: "Beğeni sıralaması yüklenemedi.",
                noBlogPostsYet: "Henüz blog yazısı bulunamadı.",
                untitledPost: "Başlıksız yazı",
                authorLabel: "Yazar",
                readCountLabel: "okuma",
                readNowBtn: "Hemen Oku",
                blogRankingLoadError: "Blog sıralaması yüklenemedi.",
                pollClosed: "Kapalı",
                pollActive: "Aktif",
                voteLabel: "oy",
                voteBtn: "Oy Ver",
                retractVoteBtn: "Oyumu Geri Al",
                finishedLabel: "Bitti",
                minutesLeftLabel: "dakika kaldı",
                readMoreBtn: "Daha fazlasını gör",
                showLessBtn: "Daha az göster",
                editedLabel: "düzenlendi",
                editAction: "Düzenle",
                deleteAction: "Sil",
                replyBtn: "Yanıtla",
                postsLoadError: "Gönderiler yüklenirken bir hata oluştu.",
                loadMoreBtn: "Daha fazla yükle",
                sharingText: "Paylaşılıyor...",
                postedToast: "Gönderildi",
                    postFailedAlert: "Gönderi paylaşılamadı.",
                    translateToEnglishTitle: "İngilizceye çevir",
                    showOriginalTitle: "Orijinali göster",
                    translatingTitle: "Çevriliyor...",
                    translationFailedAlert: "İçerik çevrilemedi."
    },
    en: {
      searchPlaceholder: "Search pages or people...",
      searchBtn: "Search",
      menuProfile: "Your Profile",
      menuSettings: "Settings",
      menuTitle: "Menu",
      navFeed: "Feed",
      navBookmarks: "Bookmarks",
      navSubs: "Liked Posts",
      navSearch: "Search",
      searchHeading: "Search Results",
      postPlaceholder: "What's happening?",
      shareBtn: "Post",
      editProfileBtn: "Edit Profile",
      changePassword: "Change Password",
      changeEmail: "Change Email",
      privacyOption: "Hide Profile",
      privacyOptionShow: "Show Profile",
      privateLabel: "Private",
      profileHiddenMessage: "This profile is private.",
      privateBanner: "Your profile is private",
      friendViewNote: "Profile visible to friends",
      footerTagline: "Always stay ahead with your community.",
      footerMenu: "Quick Menu",
      footerCorp: "Corporate",
      footerAbout: "About Us",
      footerCareer: "Careers",
      footerSupport: "Support",
      footerContact: "Contact",
      footerHelp: "Help Center",
      footerRights: "All Rights Reserved.",
    footerNote: "Strengthen your social connections, follow trends, and grow your community.",
    footerDiscoverCommunity: "Discover Community",
    footerFindFriends: "Find Friends",
    headerFriends: "Friends",
    headerMyFriends: "My Friends",
    headerFriendsLoading: "Friends are loading...",
    headerSeeAll: "See All",
    headerNotification: "Notification",
    headerInbox: "Notification Inbox",
    headerNoNotifications: "No new notifications",
    headerGoNotifications: "Go to Notifications",
    headerThemeShort: "Theme",
    headerInviteShort: "Invite",
    navCommunities: "Communities",
    profileCardTitle: "Your Profile Card",
    membershipInfo: "Membership Information",
    emailLabel: "E-mail",
    roleLabel: "Role",
    roleUser: "User",
    friendsLabel: "Friends",
    requestsLabel: "Requests",
    myProfileBtn: "My Profile",
    adminPanel: "Admin Panel",
    blogMenuTitle: "Blog Menu",
    allPosts: "All Posts",
    myArticles: "My Articles",
    newArticle: "New Article",
    profileMenuTitle: "Profile Menu",
    myPostsNav: "My Posts",
    myLikes: "My Likes",
    mySaves: "My Saves",
    myFriends: "My Friends",
    incomingNotifications: "Incoming Notifications",
    mobileNavHome: "Home",
    mobileNavSearch: "Search",
    mobileNavNew: "New",
    mobileNavChat: "Chat",
    logoutBtn: "Log Out",
      subBtn: "Subscribe",
      unsubBtn: "Leave",
      promptNewName: "New Display Name:",
      confirmDelete: "Are sure you want to delete this post?",
      confirmDeletePage: "Are sure you want to delete this page and all its data?",
      confirmDeleteComment: "Are sure you want to delete this comment?",
      myPostsTitle: "My Posts",
      settingPrivate: "Private Profile",
      settingPrivateDesc: "Hide your profile and posts from other users.",
      settingTheme: "Dark Theme",
      commentPlaceholder: "Write a comment...",
      sendComment: "Send",
      helpHeading: "Help Center",
      helpSub: "Frequently Asked Questions",
      helpText: "Everything you wonder about using SosyalTrend is here.",
      contactHeading: "Contact",
      contactText: "To contact us, you can send an e-mail to officialfthuzun@gmail.com.",
            sendBtn: "Send Message",
            rightSearchTitle: "Search",
            rightSearchPlaceholder: "Type what you want to search.",
            rightSearchBtn: "Search",
            newConnectionsKicker: "New Connections",
            newConnectionsTitle: "Find Friends",
            newConnectionsSubtitle: "Discover new people based on your interests.",
            featureSmartMatch: "Smart matches by shared interests",
            featureCityCommunity: "City and community based suggestions",
            friendFindPageBtn: "Friend Finder Page",
            discoverCommunitiesBtn: "Discover Communities",
            calendarTitle: "Calendar",
            upcomingEventsTitle: "Upcoming Events",
            noUpcomingEvents: "No upcoming events",
            topCommunitiesTitle: "Top 3 most popular community pages",
            friendSuggestionsTitle: "Friend Suggestions",
            loadingText: "Loading...",
            friendFindBtn: "Find Friends",
            inviteFriendBtn: "Invite Your Friend",
            composerTitle: "Ready to share something new?",
            composerSubtitle: "Share your story, photo, or ideas with your friends right away and enjoy time together.",
            photoBtn: "Photo",
            emojiBtn: "Emoji",
            pollBtn: "Poll",
            postHelpText: "Write your post, add an image, and share quickly.",
            pollQuestionLabel: "Poll question",
            pollQuestionPlaceholder: "Type your poll question...",
            pollOptionsLabel: "Options",
            pollOption1Placeholder: "Option 1",
            pollOption2Placeholder: "Option 2",
            pollOption3Placeholder: "Option 3 (optional)",
            pollOption4Placeholder: "Option 4 (optional)",
            pollDaysLabel: "Days",
            pollHoursLabel: "Hours",
            pollMinutesLabel: "Minutes",
            cancelBtn: "Cancel",
            createPollBtn: "Create Poll",
            topLikedPostTitle: "Most liked post",
            topReadBlogsTitle: "Top 3 most read blog posts",
            editPostTitle: "Edit Post",
            editPlaceholder: "Edit here...",
                        saveBtn: "Save",
                        replyingToText: "is being replied to",
                        replyToPrefix: "Reply",
                        noPostsYet: "No posts yet.",
                        postSnippetFallback: "Post with image or text content.",
                        topCommentBySuffix: "commented",
                        topCommentLabel: "Top comment",
                        commentFallback: "A comment was added to this post.",
                        viewPostBtn: "View Post",
                        topLikesLoadError: "Could not load top liked post.",
                        noBlogPostsYet: "No blog posts found yet.",
                        untitledPost: "Untitled post",
                        authorLabel: "Author",
                        readCountLabel: "reads",
                        readNowBtn: "Read Now",
                        blogRankingLoadError: "Could not load blog ranking.",
                        pollClosed: "Closed",
                        pollActive: "Active",
                        voteLabel: "votes",
                        voteBtn: "Vote",
                        retractVoteBtn: "Retract Vote",
                        finishedLabel: "Finished",
                        minutesLeftLabel: "minutes left",
                        readMoreBtn: "Read more",
                        showLessBtn: "Show less",
                        editedLabel: "edited",
                        editAction: "Edit",
                        deleteAction: "Delete",
                        replyBtn: "Reply",
                        postsLoadError: "An error occurred while loading posts.",
                        loadMoreBtn: "Load more",
                        sharingText: "Posting...",
                        postedToast: "Posted",
                        postFailedAlert: "Post could not be shared.",
                        translateToEnglishTitle: "Translate to English",
                        showOriginalTitle: "Show original",
                        translatingTitle: "Translating...",
                        translationFailedAlert: "Content could not be translated."
    }
  };

  let currentLang = localStorage.getItem('st_lang') || 'tr';
  let isPrivate = localStorage.getItem('st_isPrivate') === 'true';

    function getLangText(key, fallback = '') {
        const dict = translations[currentLang] || {};
        return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : fallback;
    }

        const englishTranslationCache = new Map();

        async function translatePlainTextToEnglish(text) {
            const source = (text || '').trim();
            if (!source) return '';
            if (englishTranslationCache.has(source)) return englishTranslationCache.get(source);

            const chunks = [];
            const maxChunkLength = 3000;
            for (let i = 0; i < source.length; i += maxChunkLength) {
                chunks.push(source.slice(i, i + maxChunkLength));
            }

            let translatedText = '';
            for (const chunk of chunks) {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(chunk)}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('translate-http-error');
                const payload = await response.json();
                const translatedChunk = Array.isArray(payload?.[0])
                    ? payload[0].map((part) => part?.[0] || '').join('')
                    : '';
                translatedText += translatedChunk;
            }

            englishTranslationCache.set(source, translatedText || source);
            return translatedText || source;
        }

        async function translateWithMyMemory(text) {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('mymemory-http-error');
            const payload = await response.json();
            const result = payload?.responseData?.translatedText || '';
            if (!result) throw new Error('mymemory-empty-result');
            return result;
        }

        function resolveTranslateTarget(targetSelectorOrId) {
            if (!targetSelectorOrId) return null;

            if (typeof targetSelectorOrId === 'string' && targetSelectorOrId.startsWith('#')) {
                const id = targetSelectorOrId.slice(1);
                const byId = document.getElementById(id);
                if (byId) return byId;
                try {
                    return document.querySelector(targetSelectorOrId);
                } catch (_) {
                    return null;
                }
            }

            if (typeof targetSelectorOrId === 'string') {
                const byId = document.getElementById(targetSelectorOrId);
                if (byId) return byId;
                try {
                    return document.querySelector(targetSelectorOrId);
                } catch (_) {
                    return null;
                }
            }

            return null;
        }

        function updateTranslateButtonBadge(button, isTranslated) {
            if (!button) return;
            const nextLabel = isTranslated ? 'TR' : 'EN';
            button.innerHTML = `<span class="translate-lang-badge">${nextLabel}</span>`;
        }

        window.toggleTranslateContentToEnglish = async function(button, targetSelector) {
            const target = resolveTranslateTarget(targetSelector);
            if (!button || !target) return;

            if (!button.querySelector('.translate-lang-badge')) {
                updateTranslateButtonBadge(button, button.dataset.translated === '1');
            }
            const originalEncoded = target.dataset.originalEncoded || encodeURIComponent(target.textContent || '');
            target.dataset.originalEncoded = originalEncoded;
            const originalText = decodeURIComponent(originalEncoded);

            if (button.dataset.translated === '1') {
                target.textContent = originalText;
                button.dataset.translated = '0';
                button.title = getLangText('translateToEnglishTitle', 'İngilizceye çevir');
                updateTranslateButtonBadge(button, false);
                return;
            }

            const previousDisabled = button.disabled;
            button.disabled = true;
            button.title = getLangText('translatingTitle', 'Çevriliyor...');
            try {
                let translated = '';
                try {
                    translated = await translatePlainTextToEnglish(originalText);
                } catch (primaryError) {
                    console.warn('Primary translate endpoint failed, trying fallback:', primaryError);
                    translated = await translateWithMyMemory(originalText);
                }
                target.textContent = translated;
                button.dataset.translated = '1';
                button.title = getLangText('showOriginalTitle', 'Orijinali göster');
                updateTranslateButtonBadge(button, true);
            } catch (err) {
                console.error('Çeviri hatası:', err);
                alert(getLangText('translationFailedAlert', 'İçerik çevrilemedi.'));
                button.title = getLangText('translateToEnglishTitle', 'İngilizceye çevir');
                updateTranslateButtonBadge(button, false);
            } finally {
                button.disabled = previousDisabled;
            }
        };

        document.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-translate-target]');
            if (!btn) return;
            event.preventDefault();
            event.stopPropagation();
            const target = btn.getAttribute('data-translate-target');
            window.toggleTranslateContentToEnglish(btn, target);
        });

    function refreshDynamicLocalizedContent() {
        // Dynamic widgets and feed content are generated with JS templates,
        // so they must be re-rendered after language switch.
        if (document.getElementById('top-liked-posts-list')) loadTopLikedPosts();
        if (document.getElementById('top-read-blogs') || document.getElementById('sidebar-top-read-blogs')) loadTopReadBlogs();
        if (document.getElementById('dynamic-suggestions-list')) loadSuggestions();
        if (document.getElementById('feed-items') && typeof window.loadPostsFeed === 'function') {
            window.loadPostsFeed(showAllFeedPosts);
        }
    }

  window.changeLanguage = (lang) => {
    // Language changed
    currentLang = lang;
    localStorage.setItem('st_lang', lang);
    applyTranslations(); // Çevirileri uygula
  };

  function applyTranslations() {
    const t = translations[currentLang];
        document.documentElement.lang = currentLang === 'en' ? 'en' : 'tr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t[key]) {
        if ('placeholder' in el) {
          el.placeholder = t[key];
        } else {
          // for contenteditable divs we store value in data-placeholder
          el.setAttribute('data-placeholder', t[key]);
        }
      }
    });
    const trBtn = document.getElementById('lang-tr');
    const enBtn = document.getElementById('lang-en');
    if(trBtn) trBtn.className = currentLang === 'tr' ? 'active' : 'inactive';
    if(enBtn) enBtn.className = currentLang === 'en' ? 'active' : 'inactive';
    // after translations we might need to re-sync dynamic UI text like privacy
    updateUIWithUser();
        refreshDynamicLocalizedContent();
  }
    window.applyTranslations = applyTranslations;
  applyTranslations();

    document.addEventListener('includesLoaded', () => {
        applyTranslations();
    });

    if (window.includesLoaded) {
        applyTranslations();
    }

    window.addEventListener('storage', (event) => {
        if (event.key === 'st_lang' && event.newValue && event.newValue !== currentLang) {
            currentLang = event.newValue;
            applyTranslations();
        }
    });

function getAvatarUrl(avatarUrlOrSeed, type = 'user') {
    // If it's a string, try to interpret it correctly
    if (avatarUrlOrSeed && typeof avatarUrlOrSeed === 'string') {
        // Full URLs or base64
        if (avatarUrlOrSeed.startsWith('http') || avatarUrlOrSeed.startsWith('data:')) {
            return avatarUrlOrSeed;
        }
        // Base64 / data URI images should be returned directly
        if (avatarUrlOrSeed.startsWith('data:') || avatarUrlOrSeed.startsWith('blob:')) {
            return avatarUrlOrSeed;
        }

        // External image URLs should be returned directly
        if (avatarUrlOrSeed.startsWith('http://') || avatarUrlOrSeed.startsWith('https://')) {
            return avatarUrlOrSeed;
        }

        // Relative assets or absolute paths
        if (avatarUrlOrSeed.startsWith('assets/') || avatarUrlOrSeed.startsWith('/')) {
            return avatarUrlOrSeed;
        }

        // Admin-specific icon
        if (avatarUrlOrSeed === 'admin-shield') {
            return "https://api.dicebear.com/7.x/bottts/svg?seed=Admin";
        }

        // Treat the value as a seed for an avatar generator
        // (use different style depending on type)
        const style = type === 'page' ? 'adventurer' : 'bottts';
        return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(avatarUrlOrSeed)}`;
    }

    // Default avatar
    return "assets/img/strendsaydamv2.png";
}

  function updateUIWithUser() {
    const avatarUrl = getAvatarUrl(user.avatarUrl, 'user');
    
    // --- ELEMENT TANIMLAMALARI ---
    const welcomeEl = document.getElementById('welcomeMessage'); // Karşılama metni
    const hAvElements = document.querySelectorAll('#headerAvatar');
    const mobileProfileAvatar = document.getElementById('mobileProfileAvatar');
    const mDn = document.getElementById('menuDisplayName');
    const mUn = document.getElementById('menuUsername');

    // Sol Menü
    const sAv = document.getElementById('sidebarAvatar');
    const sDn = document.getElementById('sidebarDisplayName');
    const sUn = document.getElementById('sidebarUsername');
    const sSi = document.getElementById('sidebarSignupInfo');
    const sLa = document.getElementById('sidebarLastActive');
    const sRo = document.getElementById('sidebarRole');
    const sMa = document.getElementById('sidebarMembershipAge');
    const sFc = document.getElementById('sidebarFriendCount');
    const sPr = document.getElementById('sidebarPendingRequests');
    const sCr = document.getElementById('sidebarCongratsRank');
    const pJd = document.getElementById('profileJoinDate');
    const pSi = document.getElementById('profileSignupInfo');
    const pRo = document.getElementById('profileRole');
    const pRoleBadge = document.getElementById('profileRoleBadge');
    const pFc = document.getElementById('profileFriendCount');
    const pPr = document.getElementById('profilePendingRequests');
    const pLa = document.getElementById('profileLastActive');
    const pVerified = document.getElementById('profileVerified');

    // Profil Sayfası
    const pAv = document.getElementById('profilePageAvatar');
    const pPn = document.getElementById('profilePageName');
    const pPh = document.getElementById('profilePageHandle');
    const pLocation = document.getElementById('profileLocation');
    const pHometown = document.getElementById('profileHometown');
    const pDob = document.getElementById('profileDob');

    const visitedProfileUsername = getVisitedProfileUsername();
    const isOwnProfile = !visitedProfileUsername || visitedProfileUsername === user.username;

    // Gizlilik Ayarları
    const pTg = document.getElementById('privacyToggle');
    const sPi = document.getElementById('selfPrivateIndicator');
/* ============================ */

    // --- GÜNCELLEMELER ---
    // Üst Bar Karşılama Mesajı Güncelleme
    if (welcomeEl) {
        // user.displayName veya user.username kullanarak içeriği değiştiriyoruz
        const currentName = user.username || user.displayName || "misafir";
        welcomeEl.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size: 0.6rem; animation: pulse 2s infinite;"></i> ${currentName.toLowerCase()}`;
    }

    // Header Güncelleme
    hAvElements.forEach((imgEl) => { imgEl.src = avatarUrl; });
    if (mobileProfileAvatar) mobileProfileAvatar.src = avatarUrl;
    if(mDn) mDn.innerText = user.displayName;
    if(mUn) mUn.innerText = `@${user.username}`;

    // Sol Menü Güncelleme
    if(sAv) sAv.src = avatarUrl;
    if(sDn) sDn.innerText = user.displayName || 'Misafir';
    if(sUn) sUn.innerText = user.username ? `@${user.username}` : '@kullanici';

    // Post composer avatar güncelleme
    const composerAvatar = document.getElementById('composerAvatar');
    if (composerAvatar) composerAvatar.src = avatarUrl;
    if(pJd && !pJd.innerText) pJd.innerText = '—';
    if(sSi) sSi.innerText = user.email ? shortenEmail(user.email) : '—';
    if (isOwnProfile && pSi) pSi.innerText = user.email ? shortenEmail(user.email) : '—';
    if(sRo) sRo.innerText = user.isAdmin ? 'Admin' : 'Kullanıcı';
    if (isOwnProfile && pRo) pRo.innerText = user.isAdmin ? 'Admin' : 'Kullanıcı';
    if (isOwnProfile && pRoleBadge) pRoleBadge.innerText = user.isAdmin ? 'Admin' : 'Kullanıcı';
    if(sLa) sLa.innerText = '—';
    if (isOwnProfile && pLa) pLa.innerText = '—';
    if(sMa) sMa.innerText = '—';
    if(sFc) sFc.innerText = user.friendCount;
    if (isOwnProfile && pFc) pFc.innerText = user.friendCount;
    if(sPr) sPr.innerText = user.pendingRequests;
    if(sCr) sCr.innerText = '%0';
    if (isOwnProfile && pPr) pPr.innerText = user.pendingRequests;
    if (isOwnProfile && pVerified) pVerified.innerText = (user.emailVerified === true) ? 'Doğrulandı' : (user.emailVerified === false ? 'Doğrulanmadı' : '—');
    // show/hide blog creation and my posts links depending on auth state
    const blogNewLink = document.getElementById('btn-blog-new');
    const blogMineLink = document.getElementById('btn-blog-mine');
    if (blogNewLink) {
        blogNewLink.style.display = auth.currentUser ? 'block' : 'none';
    }
    if (blogMineLink) {
        blogMineLink.style.display = auth.currentUser ? 'block' : 'none';
    }

    // if we're on the create page, control the publish button state
    const publishBtn = document.getElementById('publishBlogBtn');
    if (publishBtn) {
        if (!auth.currentUser) {
            publishBtn.disabled = true;
            publishBtn.style.opacity = '0.5';
            publishBtn.title = 'Önce giriş yapmalısınız';
        } else {
            publishBtn.disabled = false;
            publishBtn.style.opacity = '';
            publishBtn.title = '';
        }
    }
    if (pJd) {
        const joinDate = formatJoinDate(user.createdAt || auth.currentUser?.metadata?.creationTime);
        if (isOwnProfile && pJd) pJd.innerText = joinDate;
    }
    if (sLa) {
        const lastActiveAt = user.lastActiveAt || user.createdAt;
        if (lastActiveAt) {
            try {
                const activeDate = lastActiveAt.toDate ? lastActiveAt.toDate() :
                    (lastActiveAt.seconds != null ? new Date(lastActiveAt.seconds * 1000) : new Date(lastActiveAt));
                sLa.innerText = activeDate.toLocaleString('tr-TR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                if (isOwnProfile && pLa) pLa.innerText = sLa.innerText;
            } catch (e) {
                console.error('Last active formatting error:', e);
                sLa.innerText = '—';
                if (isOwnProfile && pLa) pLa.innerText = '—';
            }
        } else {
            sLa.innerText = '—';
            if (isOwnProfile && pLa) pLa.innerText = '—';
        }
    }

    // Profil Sayfası Güncelleme
    if (isOwnProfile) {
        if(pAv) pAv.src = avatarUrl;
        if(pPn) pPn.innerText = user.displayName;
        if(pPh) pPh.innerText = `@${user.username}`;
        if(pLocation) pLocation.innerText = user.location || '—';
        if(pHometown) pHometown.innerText = user.hometown || '—';
        if(pDob) pDob.innerText = user.dob ? (typeof user.dob === 'string' && user.dob.includes('-') ? user.dob.split('-').reverse().join('.') : String(user.dob)) : '—';
        const pOccupation = document.getElementById('profileOccupation');
        const pWebsite = document.getElementById('profileWebsite');
        const pBio = document.getElementById('profileBio');
        const pInterests = document.getElementById('profileInterests');
        if (pOccupation) {
            pOccupation.innerText = user.occupation || '—';
        }
        if (pWebsite) {
            pWebsite.innerHTML = '<i class="fa-solid fa-earth-americas"></i>';
            if (user.website) {
                pWebsite.href = escapeHtml(user.website);
                pWebsite.target = '_blank';
                pWebsite.rel = 'noopener noreferrer';
                pWebsite.classList.remove('disabled');
                pWebsite.removeAttribute('aria-disabled');
                pWebsite.removeAttribute('tabindex');
            } else {
                pWebsite.removeAttribute('href');
                pWebsite.removeAttribute('target');
                pWebsite.removeAttribute('rel');
                pWebsite.classList.add('disabled');
                pWebsite.setAttribute('aria-disabled', 'true');
                pWebsite.setAttribute('tabindex', '-1');
            }
        }
        const pFacebook = document.getElementById('profileFacebook');
        const pTwitter = document.getElementById('profileTwitter');
        const pYoutube = document.getElementById('profileYoutube');
        if (pFacebook) {
            pFacebook.innerHTML = '<i class="fa-brands fa-facebook-f"></i>';
            if (user.facebook) {
                pFacebook.href = escapeHtml(user.facebook);
                pFacebook.target = '_blank';
                pFacebook.rel = 'noopener noreferrer';
                pFacebook.classList.remove('disabled');
                pFacebook.removeAttribute('aria-disabled');
                pFacebook.removeAttribute('tabindex');
            } else {
                pFacebook.removeAttribute('href');
                pFacebook.removeAttribute('target');
                pFacebook.removeAttribute('rel');
                pFacebook.classList.add('disabled');
                pFacebook.setAttribute('aria-disabled', 'true');
                pFacebook.setAttribute('tabindex', '-1');
            }
        }
        if (pTwitter) {
            pTwitter.innerHTML = '<i class="fa-brands fa-twitter"></i>';
            if (user.twitter) {
                pTwitter.href = escapeHtml(user.twitter);
                pTwitter.target = '_blank';
                pTwitter.rel = 'noopener noreferrer';
                pTwitter.classList.remove('disabled');
                pTwitter.removeAttribute('aria-disabled');
                pTwitter.removeAttribute('tabindex');
            } else {
                pTwitter.removeAttribute('href');
                pTwitter.removeAttribute('target');
                pTwitter.removeAttribute('rel');
                pTwitter.classList.add('disabled');
                pTwitter.setAttribute('aria-disabled', 'true');
                pTwitter.setAttribute('tabindex', '-1');
            }
        }
        if (pYoutube) {
            pYoutube.innerHTML = '<i class="fa-brands fa-youtube"></i>';
            if (user.youtube) {
                pYoutube.href = escapeHtml(user.youtube);
                pYoutube.target = '_blank';
                pYoutube.rel = 'noopener noreferrer';
                pYoutube.classList.remove('disabled');
                pYoutube.removeAttribute('aria-disabled');
                pYoutube.removeAttribute('tabindex');
                
                // YouTube video oynatıcısını göster
                const youtubeCard = document.getElementById('profileYoutubeCard');
                const youtubeContainer = document.getElementById('youtubeContainer');
                if (youtubeCard && youtubeContainer) {
                    const videoId = extractYoutubeVideoId(user.youtube);
                    if (videoId) {
                        youtubeContainer.innerHTML = createYoutubeEmbed(videoId);
                        youtubeCard.style.display = 'block';
                    }
                }
            } else {
                pYoutube.removeAttribute('href');
                pYoutube.removeAttribute('target');
                pYoutube.removeAttribute('rel');
                pYoutube.classList.add('disabled');
                pYoutube.setAttribute('aria-disabled', 'true');
                pYoutube.setAttribute('tabindex', '-1');
                
                // YouTube kartını gizle
                const youtubeCard = document.getElementById('profileYoutubeCard');
                if (youtubeCard) youtubeCard.style.display = 'none';
            }
        }
        if (pBio) {
            pBio.innerText = user.bio || '—';
        }
        if (pInterests) {
            pInterests.innerText = user.interests || '—';
        }
    }

    if(pTg) pTg.checked = isPrivate;
    if(sPi) {
        let showInd = isPrivate;
        const visitedUsername = getVisitedProfileUsername();
        if (visitedUsername && visitedUsername !== user.username) {
            showInd = false;
        }
        sPi.style.display = showInd ? 'block' : 'none';
    }
    const pBanner = document.getElementById('selfPrivateBanner');
    if(pBanner) {
        // only show banner when viewing own profile
        let showBanner = isPrivate;
        const visitedUsername = getVisitedProfileUsername();
        if (visitedUsername && visitedUsername !== user.username) {
            showBanner = false;
        }
        pBanner.style.display = showBanner ? 'block' : 'none';
    }
    
    // Kendi profilinde bannerleri gizle
    const visitedUsername = getVisitedProfileUsername();
    if (!visitedUsername || visitedUsername === user.username) {
        const privateNoticeCard = document.getElementById('privateNoticeCard');
        const friendViewNotice = document.getElementById('friendViewNotice');
        if (privateNoticeCard) privateNoticeCard.style.display = 'none';
        if (friendViewNotice) friendViewNotice.style.display = 'none';
    }
    
    // update simulate button label if present
    const simBtn = document.getElementById('simulateVisitorBtn');
    if (simBtn) {
        simBtn.innerText = isSimulatingVisitor() ? 'Simülasyonu Kapat' : 'Ziyaretçi Gözünden Gör';
    }

    // Ayarlar menüsündeki gizlilik metnini güncelle
    const privText = document.getElementById('privacyMenuText');
    if(privText) {
        privText.innerText = isPrivate
            ? (translations[currentLang].privacyOptionShow || 'Profilini Göster')
            : (translations[currentLang].privacyOption || 'Profilini Gizle');
    }
}

window.togglePrivacy = () => {
      isPrivate = document.getElementById('privacyToggle').checked;
      localStorage.setItem('st_isPrivate', isPrivate);
      updateUIWithUser();
  };

window.navigateTo = (pageId) => {
      // Navigate to page
      
      if(pageId === 'admin' && !user.isAdmin) {
          alert("Bu bölüme sadece yönetici erişebilir!");
          window.navigateTo('feed'); return;
        }

      // Sayfa içeriklerini gizle/göster
      document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
      const target = document.getElementById('page-' + pageId);
      if(target) target.classList.add('active');

      // Navigasyon butonlarını aktif yap
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById('btn-' + pageId);
      if(btn) btn.classList.add('active');
      
      
      window.scrollTo(0,0);
};

function setNavActiveByPath() {
    const currentPage = window.location.pathname.replace(/\\/g, '/').split('/').pop().toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);
    console.log('setNavActiveByPath called, currentPage:', currentPage, 'search:', window.location.search);
    let activeBtnId = null;

    const pageNav = {
        '': 'btn-feed',
        'index.html': 'btn-feed',
        'arkadas-bul.html': 'btn-arkadas-bul',
        'profil.html': 'btn-profilim',
        'friends.html': 'btn-arkadaslarim',
        'gonderiler.html': 'btn-gonderiler',
        'begeniler.html': 'btn-begeniler',
        'kayitlar.html': 'btn-kayitlar',
        'arkadaslarim.html': 'btn-arkadaslarim',
        'bildirimler.html': 'btn-bildirimler',
        'blog.html': 'btn-tum-yazilar',
        'music.html': 'btn-music'
    };

    activeBtnId = pageNav[currentPage];

    if (currentPage === 'profil.html') {
        const hash = window.location.hash.replace('#','');
        if (!hash) {
            activeBtnId = 'btn-profilim';
        } else if (hash === 'posts') {
            activeBtnId = 'btn-gonderiler';
        } else if (hash === 'likes') {
            activeBtnId = 'btn-begeniler';
        } else if (hash === 'saves') {
            activeBtnId = 'btn-kayitlar';
        } else if (hash === 'friends' || hash === 'my-friends-tab') {
            activeBtnId = 'btn-arkadaslarim';
        } else if (hash === 'notifs' || hash === 'my-notifs-tab') {
            activeBtnId = 'btn-bildirimler';
        } else {
            activeBtnId = 'btn-profilim';
        }
    }

    if (currentPage === 'blog.html') {
        const mine = urlParams.get('mine');
        const create = urlParams.get('create');
        if (mine === '1') {
            activeBtnId = 'btn-yazilarim';
        } else if (create === '1') {
            activeBtnId = 'btn-yeni-yazi';
        } else {
            activeBtnId = 'btn-tum-yazilar';
        }
    }

    if (!activeBtnId) return;

    console.log('Active button ID:', activeBtnId);
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(activeBtnId);
    console.log('Active button element:', activeBtn);
    if (activeBtn) activeBtn.classList.add('active');
}

function fixSidebarLinks() {
    const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    const isProfilSubpage = currentPath.includes('/profil/');

    document.querySelectorAll('.sidebar-container .nav-item').forEach((link) => {
        const originalHref = link.dataset.href || link.getAttribute('href');
        if (!originalHref) return;

        if (isProfilSubpage && !originalHref.startsWith('../') && !originalHref.startsWith('http') && !originalHref.startsWith('#')) {
            link.href = '../' + originalHref;
        } else {
            link.href = originalHref;
        }
    });
}

function getVideoCollection() {
    return collection(db, 'videos');
}

function formatVideoUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('youtube.com/watch') || trimmed.includes('youtu.be/')) {
        const videoIdMatch = trimmed.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (videoIdMatch) {
            return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
        }
        return trimmed;
    }
    return trimmed;
}

function createVideoCard(docSnap) {
    const data = docSnap.data();
    const url = data.url || '';
    const title = data.title || 'Başlıksız Video';
    const description = data.description || '';
    const author = data.authorDisplayName || data.authorUsername || 'Anonim';
    const authorUid = data.authorUid;
    const createdAt = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt || Date.now());
    const formattedDate = createdAt.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
    const embedUrl = formatVideoUrl(url);
    const isVideoFile = embedUrl.match(/\.(mp4|webm|ogg)(?:\?.*)?$/i);
    const isYouTube = embedUrl.includes('youtube.com/embed/');
    const isOwnVideo = auth.currentUser && authorUid === auth.currentUser.uid;

    const cardId = `video-card-${docSnap.id}`;

    return `
        <div class="glass-card" style="padding:18px;" id="${cardId}">
            <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start;">
                <div style="flex:1 1 320px; min-width:280px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <h3 style="margin:0;">${escapeHtml(title)}</h3>
                        ${isOwnVideo ? `<button onclick="deleteVideo('${docSnap.id}')" class="delete-btn" style="background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;" title="Videoyu Sil"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                    <div style="color: var(--text-muted); font-size:0.9rem; margin-bottom:12px;">${escapeHtml(author)} · ${escapeHtml(formattedDate)}</div>
                    <p style="margin:0 0 12px 0; color:var(--text-main); line-height:1.6;">${escapeHtml(description)}</p>
                </div>
                <div style="flex:1 1 320px; min-width:260px;">
                    ${isVideoFile ? `<video src="${escapeHtml(url)}" controls style="width:100%; border-radius:12px; background:#000;"></video>` : isYouTube ? `
                        <div style="text-align: center; padding: 20px; background: var(--bg-secondary); border-radius: 12px; border: 2px dashed var(--border);">
                            <i class="fab fa-youtube" style="font-size: 3rem; color: #ff0000; margin-bottom: 10px;"></i>
                            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">YouTube Videosu</div>
                            <div style="color: var(--text-muted); margin-bottom: 15px;">Bu video YouTube'da yayınlanıyor</div>
                            <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="mini-link-btn" style="background: #ff0000; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; display: inline-block; font-weight: 600; transition: all 0.2s ease;">
                                <i class="fab fa-youtube"></i> YouTube'da İzle
                            </a>
                        </div>
                    ` : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color: var(--primary);">Videoyu izle</a>`}
                </div>
            </div>
        </div>
    `;
}

async function deleteVideo(docId) {
    if (!auth.currentUser) {
        alert('Giriş yapmalısınız.');
        return;
    }

    if (!confirm('Bu videoyu silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        const docRef = doc(db, 'videos', docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert('Video bulunamadı.');
            return;
        }

        const data = docSnap.data();
        if (data.authorUid !== auth.currentUser.uid) {
            alert('Bu videoyu silme yetkiniz yok.');
            return;
        }

        // Eğer Firebase Storage'da bir dosya varsa sil
        if (data.url && data.url.includes('firebasestorage.googleapis.com')) {
            try {
                const storageRef = ref(storage, data.url);
                await deleteObject(storageRef);
            } catch (storageError) {
                console.warn('Dosya silinirken hata:', storageError);
            }
        }

        // Firestore'dan dokümanı sil
        await deleteDoc(docRef);

        // UI'dan kartı kaldır
        const cardElement = document.getElementById(`video-card-${docId}`);
        if (cardElement) {
            cardElement.remove();
        }

        alert('Video başarıyla silindi.');
    } catch (error) {
        console.error('Video silme hatası:', error);
        alert('Video silinirken hata oluştu.');
    }
}

async function deleteMusic(docId) {
    if (!auth.currentUser) {
        alert('Giriş yapmalısınız.');
        return;
    }

    if (!confirm('Bu müziği silmek istediğinizden emin misiniz?')) {
        return;
    }

    try {
        const docRef = doc(db, 'music', docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert('Müzik bulunamadı.');
            return;
        }

        const data = docSnap.data();
        if (data.authorUid !== auth.currentUser.uid) {
            alert('Bu müziği silme yetkiniz yok.');
            return;
        }

        // Eğer Firebase Storage'da bir dosya varsa sil
        if (data.url && data.url.includes('firebasestorage.googleapis.com')) {
            try {
                const storageRef = ref(storage, data.url);
                await deleteObject(storageRef);
            } catch (storageError) {
                console.warn('Dosya silinirken hata:', storageError);
            }
        }

        // Firestore'dan dokümanı sil
        await deleteDoc(docRef);

        // UI'dan kartı kaldır
        const cardElement = document.getElementById(`music-card-${docId}`);
        if (cardElement) {
            cardElement.remove();
        }

        alert('Müzik başarıyla silindi.');
    } catch (error) {
        console.error('Müzik silme hatası:', error);
        alert('Müzik silinirken hata oluştu.');
    }
}

async function uploadVideoFile(file) {
    if (!auth.currentUser) {
        throw new Error('Giriş yapmanız gerekiyor.');
    }
    const ext = file.name.split('.').pop();
    const storagePath = `videos/${auth.currentUser.uid}/${Date.now()}.${ext}`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
}

async function saveVideoMetadata(url, title, description) {
    const videosRef = getVideoCollection();
    await addDoc(videosRef, {
        title,
        description,
        url,
        authorUid: auth.currentUser.uid,
        authorUsername: auth.currentUser.displayName || auth.currentUser.email || 'Anonim',
        authorDisplayName: auth.currentUser.displayName || auth.currentUser.email || 'Anonim',
        createdAt: serverTimestamp()
    });
}

async function loadVideoItems() {
    const listEl = document.getElementById('videoList');
    const authNotice = document.getElementById('videoAuthNotice');
    if (!listEl) return;

    const q = query(getVideoCollection(), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
        if (!listEl) return;
        listEl.innerHTML = '';
        if (snapshot.empty) {
            listEl.innerHTML = '<div style="color: var(--text-muted);">Henüz video eklenmemiş.</div>';
            return;
        }
        snapshot.docs.forEach((docSnap) => {
            listEl.insertAdjacentHTML('beforeend', createVideoCard(docSnap));
        });
    }, (error) => {
        console.error('Video yükleme hatası:', error);
        if (listEl) listEl.innerHTML = '<div style="color: var(--text-danger);">Videolar yüklenemedi.</div>';
    });

    if (authNotice) {
        authNotice.style.display = auth.currentUser ? 'none' : 'block';
    }
}

async function handleVideoSubmit() {
    const titleEl = document.getElementById('videoTitle');
    const descEl = document.getElementById('videoDescription');
    const urlEl = document.getElementById('videoUrl');
    const fileEl = document.getElementById('videoFile');
    const statusEl = document.getElementById('videoStatus');

    if (!auth.currentUser) {
        if (statusEl) statusEl.innerText = 'Video yüklemek için giriş yapmalısınız.';
        return;
    }

    const title = titleEl?.value.trim() || 'Başlıksız Video';
    const description = descEl?.value.trim() || '';
    const externalUrl = urlEl?.value.trim();
    const file = fileEl?.files?.[0] || null;

    if (!externalUrl && !file) {
        if (statusEl) statusEl.innerText = 'Lütfen video URL veya dosya seçin.';
        return;
    }

    try {
        if (statusEl) {
            statusEl.innerText = 'Yükleniyor...';
        }
        let url = externalUrl;
        if (file) {
            url = await uploadVideoFile(file);
        }
        if (!url) {
            throw new Error('Video URL alınamadı.');
        }
        await saveVideoMetadata(url, title, description);
        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        if (urlEl) urlEl.value = '';
        if (fileEl) fileEl.value = '';
        if (statusEl) statusEl.innerText = 'Video başarıyla yüklendi.';
    } catch (error) {
        console.error('Video kaydetme hatası:', error);
        if (statusEl) statusEl.innerText = 'Video yüklenirken hata oluştu.';
    }
}

function initVideoPage() {
    const uploadButton = document.getElementById('videoSubmit');
    if (uploadButton) {
        uploadButton.addEventListener('click', (event) => {
            event.preventDefault();
            handleVideoSubmit();
        });
    }
    loadVideoItems();
}

// Müzik fonksiyonları
function getMusicCollection() {
    return collection(db, 'music');
}

function formatMusicUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('youtube.com/watch') || trimmed.includes('youtu.be/')) {
        const videoIdMatch = trimmed.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (videoIdMatch) {
            return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
        }
        return trimmed;
    }
    return trimmed;
}

function createMusicCard(docSnap) {
    const data = docSnap.data();
    const url = data.url || '';
    const title = data.title || 'Başlıksız Müzik';
    const description = data.description || '';
    const author = data.authorDisplayName || data.authorUsername || 'Anonim';
    const authorUid = data.authorUid;
    const createdAt = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt || Date.now());
    const formattedDate = createdAt.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
    const embedUrl = formatMusicUrl(url);
    const isAudioFile = embedUrl.match(/\.(mp3|wav|ogg|flac|m4a)(?:\?.*)?$/i);
    const isYouTube = embedUrl.includes('youtube.com/embed/');
    const isOwnMusic = auth.currentUser && authorUid === auth.currentUser.uid;

    const cardId = `music-card-${docSnap.id}`;

    return `
        <div class="glass-card" style="padding:18px;" id="${cardId}">
            <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start;">
                <div style="flex:1 1 320px; min-width:280px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <h3 style="margin:0;">${escapeHtml(title)}</h3>
                        ${isOwnMusic ? `<button onclick="deleteMusic('${docSnap.id}')" class="delete-btn" style="background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;" title="Müziği Sil"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                    <div style="color: var(--text-muted); font-size:0.9rem; margin-bottom:12px;">${escapeHtml(author)} · ${escapeHtml(formattedDate)}</div>
                    <p style="margin:0 0 12px 0; color:var(--text-main); line-height:1.6;">${escapeHtml(description)}</p>
                </div>
                <div style="flex:1 1 320px; min-width:260px;">
                    ${isAudioFile ? `<audio src="${escapeHtml(url)}" controls style="width:100%;"></audio>` : isYouTube ? `
                        <div style="text-align: center; padding: 20px; background: var(--bg-secondary); border-radius: 12px; border: 2px dashed var(--border);">
                            <i class="fab fa-youtube" style="font-size: 3rem; color: #ff0000; margin-bottom: 10px;"></i>
                            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">YouTube Müzik</div>
                            <div style="color: var(--text-muted); margin-bottom: 15px;">Bu müzik YouTube'da yayınlanıyor</div>
                            <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="mini-link-btn" style="background: #ff0000; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; display: inline-block; font-weight: 600; transition: all 0.2s ease;">
                                <i class="fab fa-youtube"></i> YouTube'da Dinle
                            </a>
                        </div>
                    ` : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color: var(--primary);">Müziği dinle</a>`}
                </div>
            </div>
        </div>
    `;
}

async function uploadMusicFile(file) {
    if (!auth.currentUser) {
        throw new Error('Giriş yapmanız gerekiyor.');
    }
    const ext = file.name.split('.').pop();
    const storagePath = `music/${auth.currentUser.uid}/${Date.now()}.${ext}`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
}

async function saveMusicMetadata(url, title, description) {
    const musicRef = getMusicCollection();
    await addDoc(musicRef, {
        title,
        description,
        url,
        authorUid: auth.currentUser.uid,
        authorUsername: auth.currentUser.displayName || auth.currentUser.email || 'Anonim',
        authorDisplayName: auth.currentUser.displayName || auth.currentUser.email || 'Anonim',
        createdAt: serverTimestamp()
    });
}

async function loadMusicItems() {
    const listEl = document.getElementById('musicList');
    const authNotice = document.getElementById('musicAuthNotice');
    if (!listEl) return;

    const q = query(getMusicCollection(), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
        if (!listEl) return;
        listEl.innerHTML = '';
        if (snapshot.empty) {
            listEl.innerHTML = '<div style="color: var(--text-muted);">Henüz müzik eklenmemiş.</div>';
            return;
        }
        snapshot.docs.forEach((docSnap) => {
            listEl.insertAdjacentHTML('beforeend', createMusicCard(docSnap));
        });
    }, (error) => {
        console.error('Müzik yükleme hatası:', error);
        if (listEl) listEl.innerHTML = '<div style="color: var(--text-danger);">Müzikler yüklenemedi.</div>';
    });

    if (authNotice) {
        authNotice.style.display = auth.currentUser ? 'none' : 'block';
    }
}

async function handleMusicSubmit() {
    const titleEl = document.getElementById('musicTitle');
    const descEl = document.getElementById('musicDescription');
    const urlEl = document.getElementById('musicUrl');
    const fileEl = document.getElementById('musicFile');
    const statusEl = document.getElementById('musicStatus');

    if (!auth.currentUser) {
        if (statusEl) statusEl.innerText = 'Müzik yüklemek için giriş yapmalısınız.';
        return;
    }

    const title = titleEl?.value.trim() || 'Başlıksız Müzik';
    const description = descEl?.value.trim() || '';
    const externalUrl = urlEl?.value.trim();
    const file = fileEl?.files?.[0] || null;

    if (!externalUrl && !file) {
        if (statusEl) statusEl.innerText = 'Lütfen müzik URL veya dosya seçin.';
        return;
    }

    try {
        if (statusEl) {
            statusEl.innerText = 'Yükleniyor...';
        }
        let url = externalUrl;
        if (file) {
            url = await uploadMusicFile(file);
        }
        if (!url) {
            throw new Error('Müzik URL alınamadı.');
        }
        await saveMusicMetadata(url, title, description);
        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        if (urlEl) urlEl.value = '';
        if (fileEl) fileEl.value = '';
        if (statusEl) statusEl.innerText = 'Müzik başarıyla yüklendi.';
    } catch (error) {
        console.error('Müzik kaydetme hatası:', error);
        if (statusEl) statusEl.innerText = 'Müzik yüklenirken hata oluştu.';
    }
}

function initMusicPage() {
    const uploadButton = document.getElementById('musicSubmit');
    if (uploadButton) {
        uploadButton.addEventListener('click', (event) => {
            event.preventDefault();
            handleMusicSubmit();
        });
    }
    loadMusicItems();
}

document.addEventListener('includesLoaded', () => {
    setNavActiveByPath();
    fixSidebarLinks();
    if (document.getElementById('page-video')) {
        initVideoPage();
    }
    if (document.getElementById('page-music')) {
        initMusicPage();
    }
});
window.addEventListener('load', () => {
    setNavActiveByPath();
    fixSidebarLinks();
    if (document.getElementById('page-video')) {
        initVideoPage();
    }
    if (document.getElementById('page-music')) {
        initMusicPage();
    }
});
window.addEventListener('hashchange', () => {
    setNavActiveByPath();
});


//* SEARCH ARAMA FONKSIYONLARI *//
const staticDatabase = {
    pages: [
        { name: "Ana Sayfa", link: "index.html", icon: "fa-house" },
        { name: "Blog", link: "blog.html", icon: "fa-newspaper" },
        { name: "İletişim", link: "contact.html", icon: "fa-envelope" },
        { name: "Kariyer", link: "kariyer.html", icon: "fa-briefcase" },
        { name: "Giriş", link: "login.html", icon: "fa-right-to-bracket" },
        { name: "Ayarlar", link: "settings.html", icon: "fa-gear" },
        { name: "Profil", link: "profil.html", icon: "fa-user" },
        { name: "Arama", link: "search.html", icon: "fa-magnifying-glass" },
        { name: "Yardım Merkezi", link: "yardim.html", icon: "fa-life-ring" },
        { name: "Topluluk Kuralları", link: "kurallar.html", icon: "fa-gavel" },
        { name: "Hakkımızda", link: "hakkimizda.html", icon: "fa-info-circle" }
    ]
};

function getSuggestionScore(value, queryStr = '') {
    const normalizedValue = (value || '').toString().toLowerCase().trim();
    const normalizedQuery = (queryStr || '').toString().toLowerCase().trim();
    if (!normalizedValue) return 0;
    if (!normalizedQuery) return 1;
    if (normalizedValue === normalizedQuery) return 120;
    if (normalizedValue.startsWith(normalizedQuery)) return 95;
    if (normalizedValue.includes(normalizedQuery)) return 70;
    return 20;
}

function selectTopFriendSuggestions(usersData, queryStr, limitCount = 4) {
    return (usersData || [])
        .map(item => {
            const username = (item.username || item.uid || '').toString();
            const displayName = (item.name || item.displayName || username || 'Kullanıcı').toString();
            const score = Math.max(
                getSuggestionScore(username, queryStr),
                getSuggestionScore(displayName, queryStr)
            );
            return { ...item, username, displayName, score };
        })
        .filter(item => {
            if (!item.username) return false;
            const currentUsername = (window.user?.username || '').toLowerCase();
            return item.username.toLowerCase() !== currentUsername;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limitCount);
}

function selectTopPageSuggestions(firebasePagesData, queryStr, limitCount = 4) {
    const firebaseSuggestions = (firebasePagesData || []).map(item => {
        const pageName = (item.name || item.title || item.pageName || 'Sayfa').toString();
        const score = getSuggestionScore(pageName, queryStr) + ((item.subscribers || []).length > 0 ? 10 : 0);
        return { ...item, _source: 'firebase', _pageName: pageName, _score: score };
    });

    const staticSuggestions = staticDatabase.pages.map(item => ({
        ...item,
        _source: 'static',
        _pageName: item.name,
        _score: getSuggestionScore(item.name, queryStr)
    }));

    return [...firebaseSuggestions, ...staticSuggestions]
        .sort((a, b) => b._score - a._score)
        .slice(0, limitCount);
}

function renderFriendSuggestionCards(suggestions, container) {
    if (!container) return;
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = suggestions.map(userItem => {
        const username = userItem.username || userItem.uid || 'kullanici';
        const displayName = userItem.displayName || username;
        const avatar = getAvatarUrl(userItem.avatarUrl || userItem.avatarSeed || userItem.avatar || 'default', 'user');
        return `
            <div class="search-user-card" style="margin-bottom:0;">
                <div class="search-user-avatar">
                    <img src="${avatar}" alt="${escapeHtml(displayName)} avatar">
                </div>
                <div class="search-user-info">
                    <div class="search-user-name">${escapeHtml(displayName)}</div>
                    <div class="search-user-handle">@${escapeHtml(username)}</div>
                </div>
                <div class="search-user-action">
                    <button class="btn-subscribe" onclick="window.location.href='profil.html?u=${encodeURIComponent(username)}'">Profili Aç</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderPageSuggestionCards(suggestions, container, t) {
    if (!container) return;
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = suggestions.map(item => {
        if (item._source === 'firebase') {
            const pageName = item._pageName || 'Sayfa';
            const followerCount = (item.subscribers || []).length;
            const isSub = (item.subscribers || []).includes(user?.username);
            const pageIconUrl = getAvatarUrl(item.avatarSeed || item.avatar || 'page', 'page');
            return `
                <div class="search-result-card" style="align-items:flex-start; padding:20px;">
                    <div class="search-result-card-icon" style="border-radius:16px; overflow:hidden; width:60px; height:60px;">
                        <img src="${pageIconUrl}" alt="${escapeHtml(pageName)} avatar" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div class="search-result-card-title">${escapeHtml(pageName)}</div>
                        <div class="search-result-card-subtitle">Sayfa önerisi • ${followerCount} takipçi</div>
                    </div>
                    <div style="margin-top:auto;">
                        <button class="btn-subscribe ${isSub ? 'subscribed' : ''}" onclick="toggleSubscription('${item.id}', ${isSub})">${isSub ? t.unsubBtn : t.subBtn}</button>
                    </div>
                </div>`;
        }

        return `
            <a href="${item.link}" class="search-result-card">
                <div class="search-result-card-icon"><i class="fa-solid ${item.icon}"></i></div>
                <div>
                    <div class="search-result-card-title">${escapeHtml(item.name)}</div>
                    <div class="search-result-card-subtitle">Hızlı erişim • ${escapeHtml(item.link)}</div>
                </div>
            </a>`;
    }).join('');
}

async function renderSearchSuggestionSections(queryStr = '', prefetchedUsers = null, prefetchedPages = null) {
    const secFriendSuggestions = document.getElementById('section-friend-suggestions');
    const secPageSuggestions = document.getElementById('section-page-suggestions');
    const friendSuggestionsContainer = document.getElementById('search-suggested-friends');
    const pageSuggestionsContainer = document.getElementById('search-suggested-pages');
    const t = translations[currentLang] || { subBtn: 'Takip Et', unsubBtn: 'Takibi Bırak' };

    if (!secFriendSuggestions || !secPageSuggestions || !friendSuggestionsContainer || !pageSuggestionsContainer) {
        return;
    }

    let usersData = Array.isArray(prefetchedUsers) ? prefetchedUsers : [];
    let pagesData = Array.isArray(prefetchedPages) ? prefetchedPages : [];

    if (!usersData.length) {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            usersData = usersSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        } catch (e) {
            console.warn('Arkadaş önerileri yüklenemedi:', e);
        }
    }

    if (!pagesData.length) {
        try {
            const pagesSnap = await getDocs(collection(db, 'pages'));
            pagesData = pagesSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        } catch (e) {
            console.warn('Sayfa önerileri yüklenemedi:', e);
        }
    }

    const friendSuggestions = selectTopFriendSuggestions(usersData, queryStr, 4);
    const pageSuggestions = selectTopPageSuggestions(pagesData, queryStr, 4);

    renderFriendSuggestionCards(friendSuggestions, friendSuggestionsContainer);
    renderPageSuggestionCards(pageSuggestions, pageSuggestionsContainer, t);

    secFriendSuggestions.style.display = friendSuggestions.length ? 'block' : 'none';
    secPageSuggestions.style.display = pageSuggestions.length ? 'block' : 'none';
}

// 2. Sayfa Yüklendiğinde Parametre Kontrolü
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery && window.location.pathname.includes('search.html')) {
        const globalSearchInput = document.getElementById('globalSearch') || document.getElementById('headerSearchInput');
        if(globalSearchInput) globalSearchInput.value = searchQuery;
        performGlobalSearch(searchQuery);
    } else if (window.location.pathname.includes('search.html')) {
        renderSearchSuggestionSections('');
    }

    const headerSearchInput = document.getElementById('headerSearchInput');
    if (headerSearchInput) {
        headerSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (window.location.pathname.includes('search.html')) {
                    performGlobalSearch();
                }
            }
        });
    }
});

// 3. Ana Arama Fonksiyonu (Dinamik & Statik)
window.performGlobalSearch = async (forcedQuery = null) => {
    const searchInput = document.getElementById('globalSearch') || document.getElementById('headerSearchInput');
    const queryStr = (forcedQuery || (searchInput?.value || '')).trim().toLowerCase();

    // Eğer arama sayfasında değilsek yönlendir
    if (!window.location.pathname.includes('search.html')) {
        window.location.href = queryStr
            ? `search.html?q=${encodeURIComponent(queryStr)}`
            : 'search.html';
        return;
    }

    // Element Seçimleri
    const usersContainer = document.getElementById('search-results-users');
    const secUsers = document.getElementById('section-users');
    const pagesContainer = document.getElementById('search-results-pages');
    const secPages = document.getElementById('section-pages');
    const friendSuggestionsContainer = document.getElementById('search-suggested-friends');
    const secFriendSuggestions = document.getElementById('section-friend-suggestions');
    const pageSuggestionsContainer = document.getElementById('search-suggested-pages');
    const secPageSuggestions = document.getElementById('section-page-suggestions');
    const noResults = document.getElementById('search-no-results');
    const status = document.getElementById('searchStatus');
    const resultText = document.getElementById('result-text');
    const t = translations[currentLang] || { subBtn: "Takip Et", unsubBtn: "Takibi Bırak" };

    // Arayüz Sıfırlama
    if(usersContainer) usersContainer.innerHTML = "";
    if(pagesContainer) pagesContainer.innerHTML = "";
    if(friendSuggestionsContainer) friendSuggestionsContainer.innerHTML = "";
    if(pageSuggestionsContainer) pageSuggestionsContainer.innerHTML = "";
    if(secUsers) secUsers.style.display = "none";
    if(secPages) secPages.style.display = "none";
    if(secFriendSuggestions) secFriendSuggestions.style.display = "none";
    if(secPageSuggestions) secPageSuggestions.style.display = "none";
    if(noResults) noResults.style.display = "none";

    if (!queryStr) {
        if(resultText) resultText.innerText = "Arama Sayfası";
        if(status) status.innerText = "";
        await renderSearchSuggestionSections('');
        return;
    }

    if(resultText) resultText.innerText = `"${queryStr}" için sonuçlar`;
    if(status) status.innerText = `Aranıyor...`;

    try {
        let totalFound = 0;

        // --- A. STATİK SAYFA FİLTRELEME ---
        const filteredStatic = staticDatabase.pages.filter(p => p.name.toLowerCase().includes(queryStr));
        filteredStatic.forEach(p => {
            totalFound++;
            if (secPages) secPages.style.display = "block";
            if (pagesContainer) {
                pagesContainer.innerHTML += `
                    <a href="${p.link}" class="search-result-card">
                        <div class="search-result-card-icon"><i class="fa-solid ${p.icon}"></i></div>
                        <div>
                            <div class="search-result-card-title">${p.name}</div>
                            <div class="search-result-card-subtitle">${p.link}</div>
                        </div>
                    </a>`;
            }
        });

        // --- B. FIREBASE SAYFA ARAMASI ---
        const pagesSnap = await getDocs(collection(db, "pages"));
        const pagesData = pagesSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        pagesData.forEach(data => {
    const pageId = data.id;
    
    // Sadece tam eşleşme istiyorsan .includes yerine === kullanabilirsin
    // Veya belirli bir sayfayı hariç tutmak istiyorsan: if (data.name === "İstemediğim Sayfa") return;

    const pageName = (data.name || data.title || data.pageName || '').trim();
    if (pageName && pageName.toLowerCase().includes(queryStr)) {
                totalFound++;
                secPages.style.display = "block";
                const isSub = (data.subscribers || []).includes(user?.username);
                const pageIconUrl = getAvatarUrl(data.avatarSeed || data.avatar || 'page', 'page');
                pagesContainer.innerHTML += `
                <div class="search-result-card" style="align-items:flex-start; padding:20px;">
                    <div class="search-result-card-icon" style="border-radius:16px; overflow:hidden; width:60px; height:60px;">
                        <img src="${pageIconUrl}" alt="${pageName} avatar" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div class="search-result-card-title">${pageName}</div>
                        <div class="search-result-card-subtitle">Sayfa • ${(data.subscribers || []).length} takipçi</div>
                    </div>
                    <div style="margin-top:auto;">
                        <button class="btn-subscribe ${isSub ? 'subscribed' : ''}" onclick="toggleSubscription('${pageId}', ${isSub})">${isSub ? t.unsubBtn : t.subBtn}</button>
                    </div>
                </div>`;
            }
        });

        // --- C. FIREBASE TOPLULUK ARAMASI ---
        const communitiesSnap = await getDocs(collection(db, "topluluklar"));
        communitiesSnap.forEach(docSnap => {
            const data = docSnap.data();
            const communityName = (data.name || '').trim();
            const communityDesc = (data.description || '').trim();
            const isPrivate = Boolean(data.isPrivate);
            if (isPrivate) return;

            const matchesName = communityName.toLowerCase().includes(queryStr);
            const matchesDesc = communityDesc.toLowerCase().includes(queryStr);
            if (matchesName || matchesDesc) {
                totalFound++;
                if (secPages) secPages.style.display = "block";
                if (pagesContainer) {
                    pagesContainer.innerHTML += `
                    <a href="topluluk.html?community=${encodeURIComponent(docSnap.id)}" class="search-result-card">
                        <div class="search-result-card-icon"><i class="fa-solid fa-users"></i></div>
                        <div>
                            <div class="search-result-card-title">${communityName || 'Topluluk'}</div>
                            <div class="search-result-card-subtitle">Topluluk • ${communityDesc ? communityDesc.substring(0, 60) : 'Açıklama yok'}</div>
                        </div>
                    </a>`;
                }
            }
        });

        // --- D. FIREBASE KULLANICI ARAMASI ---
        const usersSnap = await getDocs(collection(db, "users"));
        const usersData = usersSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        usersData.forEach(userData => {
            const username = userData.username || userData.uid || '';
            const name = userData.name || userData.displayName || '';
            const usernameMatch = username.toLowerCase().includes(queryStr);
            const nameMatch = name.toLowerCase().includes(queryStr);

            if ((usernameMatch || nameMatch) && secUsers && usersContainer) {
                totalFound++;
                secUsers.style.display = "block";
                usersContainer.innerHTML += `
                <div class="search-user-card">
                    <div class="search-user-avatar">
                        <img src="${getAvatarUrl(userData.avatarUrl || userData.avatarSeed || userData.avatar || 'default', 'user')}" alt="${name || username} avatar">
                    </div>
                    <div class="search-user-info">
                        <div class="search-user-name">${name || 'Kullanıcı'}</div>
                        <div class="search-user-handle">@${username}</div>
                    </div>
                    <div class="search-user-action">
                        <button class="btn-subscribe" onclick="window.location.href='profil.html?u=${username}'">Profiline Git</button>
                    </div>
                </div>`;
            }
        });

        await renderSearchSuggestionSections(queryStr, usersData, pagesData);

        // Sonuç Durumu Güncelleme
        if (totalFound === 0) {
            noResults.style.display = "block";
            status.innerText = "Eşleşen sonuç bulunamadı.";
        } else {
            status.innerText = `${totalFound} sonuç bulundu.`;
        }

    } catch (e) {
        console.error("Arama hatası:", e);
        if(status) status.innerText = "Arama sırasında bir hata oluşti.";
    }
};

// 3b. Arama önerileri
const searchSuggestionCache = { users: null, pages: null };
let searchSuggestionTimer = null;

async function loadSearchSuggestionData() {
    if (!searchSuggestionCache.pages) {
        try {
            const pagesSnap = await getDocs(collection(db, 'pages'));
            searchSuggestionCache.pages = pagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn('Search suggestion pages load failed:', e);
            searchSuggestionCache.pages = [];
        }
    }
    if (!searchSuggestionCache.users) {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            searchSuggestionCache.users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn('Search suggestion users load failed:', e);
            searchSuggestionCache.users = [];
        }
    }
}

function renderSearchSuggestions(suggestions, query) {
    const dropdown = document.getElementById('searchSuggestionDropdown');
    if (!dropdown) return;
    if (!suggestions || suggestions.length === 0) {
        dropdown.innerHTML = `<div class="search-suggestion-empty">${query ? 'Hiçbir öneri bulunamadı.' : 'Arama yaparken öneriler burada görüntülenecek.'}</div>`;
        dropdown.style.display = query ? 'block' : 'none';
        return;
    }
    dropdown.innerHTML = suggestions.map(item => `
        <div class="search-suggestion-item" data-type="${item.type}" data-value="${item.value}" onclick="handleSearchSuggestionClick(event)">
            <div class="search-suggestion-icon"><i class="fa-solid ${item.icon}"></i></div>
            <div class="search-suggestion-meta">
                <div class="search-suggestion-title">${item.title}</div>
                <div class="search-suggestion-subtitle">${item.subtitle}</div>
            </div>
        </div>
    `).join('');
    dropdown.style.display = 'block';
}

function hideSearchSuggestions() {
    const dropdown = document.getElementById('searchSuggestionDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

window.handleSearchSuggestionClick = (event) => {
    const itemEl = event.currentTarget;
    if (!itemEl) return;
    const type = itemEl.dataset.type;
    const value = itemEl.dataset.value;
    hideSearchSuggestions();
    if (type === 'user') {
        window.location.href = `profil.html?u=${encodeURIComponent(value)}`;
    } else if (type === 'page') {
        window.location.href = value;
    } else if (type === 'search') {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.value = value;
            performGlobalSearch();
        }
    }
};

async function getSearchSuggestions(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    await loadSearchSuggestionData();

    const suggestions = [];
    const staticMatches = staticDatabase.pages
        .filter(p => p.name.toLowerCase().includes(q))
        .slice(0, 4)
        .map(p => ({ type: 'page', title: p.name, subtitle: p.link, icon: p.icon, value: p.link }));

    const pageMatches = (searchSuggestionCache.pages || [])
        .filter(p => ((p.name || p.title || '').toLowerCase().includes(q) || (p.pageName || '').toLowerCase().includes(q)))
        .slice(0, 4)
        .map(p => ({ type: 'page', title: p.name || p.title || p.pageName || 'Sayfa', subtitle: `${(p.subscribers || []).length} takipçi`, icon: 'fa-book-open', value: `page.html?id=${encodeURIComponent(p.id)}` }));

    const userMatches = (searchSuggestionCache.users || [])
        .filter(u => {
            const username = (u.username || '').toLowerCase();
            const name = (u.name || u.displayName || '').toLowerCase();
            return username.includes(q) || name.includes(q);
        })
        .slice(0, 5)
        .map(u => ({ type: 'user', title: u.name || u.displayName || '@' + (u.username || 'kullanici'), subtitle: '@' + (u.username || 'kullanici'), icon: 'fa-user', value: u.username || u.uid }));

    suggestions.push(...userMatches, ...pageMatches, ...staticMatches);
    return suggestions.slice(0, 8);
}

function initSearchSuggestions() {
    const searchInput = document.getElementById('globalSearch');
    const dropdown = document.getElementById('searchSuggestionDropdown');
    if (!searchInput || !dropdown) return;
    const wrapper = searchInput.closest('.search-page-input-wrapper');
    if (wrapper) wrapper.style.position = 'relative';

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        if (searchSuggestionTimer) clearTimeout(searchSuggestionTimer);
        searchSuggestionTimer = setTimeout(async () => {
            if (!query) {
                hideSearchSuggestions();
                return;
            }
            const suggestions = await getSearchSuggestions(query);
            renderSearchSuggestions(suggestions, query);
        }, 200);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
            return;
        }
    });

    document.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) {
            hideSearchSuggestions();
        }
    });
}

// 4. Dinleyiciler ve Yardımcı Fonksiyonlar
const mainSearchBtn = document.getElementById('mainSearchBtn');
if(mainSearchBtn) mainSearchBtn.onclick = () => performGlobalSearch();

const gSearch = document.getElementById('globalSearch');
if(gSearch) {
    gSearch.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            performGlobalSearch();
        }
    });
}

window.addEventListener('DOMContentLoaded', initSearchSuggestions);

window.searchTrend = (tag) => { 
    const gSearch = document.getElementById('globalSearch');
    if(gSearch) {
        gSearch.value = tag.replace('#', ''); 
        performGlobalSearch();
    }
};

// Zaman formatlama fonksiyonun (Aynen korundu)
function formatTime(timestamp) {
    if (!timestamp) return "...";

    let date;
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000);
    } else {
        return "...";
    }

    try {
        const diff = Math.floor((new Date() - date) / 1000);
        const t = currentLang === 'tr' ? { s: 'sn', m: 'dk', h: 'sa', d: 'gn' } : { s: 's', m: 'm', h: 'h', d: 'd' };
        if (diff < 60) return `${diff}${t.s}`;
        if (diff < 3600) return `${Math.floor(diff / 60)}${t.m}`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}${t.h}`;
        return `${Math.floor(diff / 86400)}${t.d}`;
    } catch (e) {
        return "...";
    }
}

function formatPostTimestamp(timestamp) {
    if (!timestamp) return "...";

    let date;
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000);
    } else {
        return "...";
    }

    try {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        return "...";
    }
}

/* --- SEARCH SON --- */
    
window.likePost = async (id, isLikedOrButton, btn) => {
    const button = btn || (isLikedOrButton && typeof isLikedOrButton === 'object' ? isLikedOrButton : null);
    const currentIdentity = getCurrentUserIdentity();
    if (!currentIdentity) {
        alert('Beğenmek için giriş yapmalısınız');
        return;
    }

    const currentState = button ? button.dataset.liked === 'true' : Boolean(isLikedOrButton);
    const nextLiked = !currentState;

    if (button) {
        const icon = button.querySelector('i');
        const countSpan = button.querySelector('span');
        if (icon) {
            icon.classList.toggle('fa-solid', nextLiked);
            icon.classList.toggle('fa-regular', !nextLiked);
        }
        if (countSpan) {
            const current = parseInt(countSpan.textContent.replace(/[^0-9-]/g, ''), 10) || 0;
            countSpan.textContent = `(${Math.max(0, current + (nextLiked ? 1 : -1))})`;
        }
        button.dataset.liked = String(nextLiked);
        button.setAttribute('aria-pressed', String(nextLiked));
        button.style.color = nextLiked ? '#ef4444' : '';
    }

    try {
        const ref = doc(db, "posts", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const post = snap.data();
        const likes = Array.isArray(post.likes) ? post.likes : [];
        const normalizedLikes = likes.map(normalizeBookmarkIdentity).filter(Boolean);
        const updatedLikes = nextLiked
            ? [...new Set([...normalizedLikes, currentIdentity])]
            : normalizedLikes.filter((value) => value !== currentIdentity);

        await updateDoc(ref, { likes: updatedLikes });

        if (nextLiked && post.username && normalizeBookmarkIdentity(post.username) !== currentIdentity) {
            const uQuery = query(collection(db, "users"), where("username", "==", post.username), limit(1));
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
                const recipientUid = uSnap.docs[0].id;
                const postSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
                await sendNotification(recipientUid, 'post_like', user.displayName || currentIdentity, { postId: id, postContent: postSnippet });
            }
        }
    } catch (e) {
        console.error('likePost hatası:', e);
    }
};

window.toggleBookmark = async (id, isSavedOrButton, btn) => {
    const button = btn || (isSavedOrButton && typeof isSavedOrButton === 'object' ? isSavedOrButton : null);
    const currentIdentity = getCurrentUserIdentity();
    if (!currentIdentity) {
        alert('Kaydetmek için giriş yapmalısınız');
        return;
    }

    const currentState = button ? button.dataset.saved === 'true' : Boolean(isSavedOrButton);
    const saving = !currentState;

    try {
        const ref = doc(db, "posts", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const post = snap.data();
        const saved = Array.isArray(post.savedBy) ? post.savedBy : [];
        const normalizedSaved = saved.map(normalizeBookmarkIdentity).filter(Boolean);
        const updatedSaved = saving
            ? [...new Set([...normalizedSaved, currentIdentity])]
            : normalizedSaved.filter((value) => value !== currentIdentity);

        await updateDoc(ref, { savedBy: updatedSaved });

        if (button) {
            const icon = button.querySelector('i');
            const countSpan = button.querySelector('span');
            if (icon) {
                icon.classList.toggle('fa-solid', saving);
                icon.classList.toggle('fa-regular', !saving);
            }
            if (countSpan) {
                const current = parseInt(countSpan.textContent.replace(/[^0-9-]/g, ''), 10) || 0;
                countSpan.textContent = `(${Math.max(0, current + (saving ? 1 : -1))})`;
            }
            button.dataset.saved = String(saving);
            button.setAttribute('aria-pressed', String(saving));
            button.style.color = saving ? '#f59e0b' : '';
        }

        if (saving && post.username && normalizeBookmarkIdentity(post.username) !== currentIdentity) {
            const uQuery = query(collection(db, "users"), where("username", "==", post.username), limit(1));
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
                const recipientUid = uSnap.docs[0].id;
                const postSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
                await sendNotification(recipientUid, 'post_saved', user.displayName || currentIdentity, { postId: id, postContent: postSnippet });
            }
        }

        if (saving && auth.currentUser) {
            const meSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
            await sendNotification(auth.currentUser.uid, 'saved_self', user.displayName || currentIdentity, { postId: id, postContent: meSnippet });
        }

        if (window.location.pathname.endsWith('profil.html') && typeof window.loadProfileSections === 'function') {
            const hash = window.location.hash.replace('#', '');
            const section = hash || 'posts';
            setTimeout(() => window.loadProfileSections(section), 500);
        }
    } catch (e) {
        console.error('toggleBookmark hatası:', e);
    }
};  window.toggleCommentSection = (id) => { const el = document.getElementById(`comments-${id}`); if(el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
        // update counter when opened
        if (el.style.display === 'block') {
            updateCommentCount(id);
            setTimeout(() => {
                const inp = document.getElementById(`input-${id}`);
                if (inp) inp.focus();
            }, 80);
        }
    } };
  
  window.addComment = async (id) => {

      const input = document.getElementById(`input-${id}`);
      const text = input?.value.trim();
      if(!text) return;
      try {
          const postRef = doc(db, "posts", id);
          const postSnap = await getDoc(postRef);
          if (!postSnap.exists()) return;
          const postData = postSnap.data();
          const comments = Array.isArray(postData.comments) ? [...postData.comments] : [];
          const replyContext = window.commentReplyContext[id];

          if (replyContext && replyContext.commentTime) {
              const index = comments.findIndex(c => c.time === replyContext.commentTime);
              if (index !== -1) {
                  if (!Array.isArray(comments[index].replies)) comments[index].replies = [];
                  const replyObj = {
                      username: user.username,
                      displayName: user.displayName,
                      avatarUrl: user.avatarUrl,
                      isAdmin: user.isAdmin || false,
                      text: text,
                      time: Date.now()
                  };
                  comments[index].replies.push(replyObj);
                  await updateDoc(postRef, { comments: comments });

                  const parentComment = comments[index];
                  if (parentComment.username && parentComment.username !== user.username) {
                      try {
                          const uQuery = query(collection(db, "users"), where("username", "==", parentComment.username), limit(1));
                          const uSnap = await getDocs(uQuery);
                          if (!uSnap.empty) {
                              const recipientUid = uSnap.docs[0].id;
                              await sendNotification(recipientUid, 'comment_reply', user.displayName, { postId: id, commentText: text });
                          }
                      } catch (err) {
                          console.error('reply notification error:', err);
                      }
                  }
              } else {
                  // Fallback: hedef yorum bulunamadıysa normal yorum olarak ekle
                  const commentObj = {
                      username: user.username,
                      displayName: user.displayName,
                      avatarUrl: user.avatarUrl,
                      isAdmin: user.isAdmin || false,
                      text: text,
                      time: Date.now(),
                      replies: []
                  };
                  await updateDoc(postRef, { comments: arrayUnion(commentObj) });
              }
          } else {
              const commentObj = {
                  username: user.username,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                  text: text,
                  time: Date.now(),
                  replies: []
              };
              await updateDoc(postRef, { comments: arrayUnion(commentObj) });

              if (postData.username && postData.username !== user.username) {
                  const uQuery = query(collection(db, "users"), where("username", "==", postData.username), limit(1));
                  const uSnap = await getDocs(uQuery);
                  if (!uSnap.empty) {
                      const recipientUid = uSnap.docs[0].id;
                      await sendNotification(recipientUid, 'post_comment', user.displayName, { postId: id, commentText: text });
                  }
              }
          }

          input.value = "";
          window.clearReply(id);
          window.updateCommentCount(id);
      } catch (e) {
          console.error('addComment hatası:', e);
      }
  };

window.addReply = async (postId, commentTime, author = '', snippet = '') => {
      const input = document.getElementById(`input-${postId}`);
      if (!input) return;
      window.commentReplyContext[postId] = {
          commentTime,
          author,
          snippet: snippet ? decodeURIComponent(snippet) : ''
      };
      window.updateReplyTargetDisplay(postId);
      setTimeout(() => input.focus(), 80);
  };

window.deleteComment = async (postId, commentTime, commentText) => {
    if(confirm(translations[currentLang].confirmDeleteComment)) {
        const ref = doc(db, "posts", postId);
        const snap = await getDoc(ref);
        if(snap.exists()){
            const data = snap.data();
            const commentToRemove = data.comments.find(c => c.time === commentTime && c.text === commentText);
            if(commentToRemove) { await updateDoc(ref, { comments: arrayRemove(commentToRemove) }); }
        }
    }
  };

window.deleteReply = async (postId, commentTime, replyTime) => {
      if(confirm("Bu yanıtı silmek istediğinize emin misiniz?")) {
          const ref = doc(db, "posts", postId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
              const comments = snap.data().comments;
              const cIndex = comments.findIndex(c => c.time === commentTime);
              if (cIndex !== -1) {
                  comments[cIndex].replies = comments[cIndex].replies.filter(r => r.time !== replyTime);
                  await updateDoc(ref, { comments: comments });
              }
          }
      }
  };

window.deletePost = async (id) => {
    if (!confirm(translations[currentLang].confirmDelete)) return;
    try {
        await deleteDoc(doc(db, "posts", id));
        const card = document.querySelector(`[data-post-id="${id}"]`);
        if (card && card.parentNode) card.parentNode.removeChild(card);
        if (typeof window.loadPostsFeed === 'function') {
            setTimeout(() => window.loadPostsFeed(showAllFeedPosts), 250);
        }
    } catch (e) {
        console.error('deletePost hatası:', e);
    }
};

window.togglePostContent = function(postId) {
    const preview = document.getElementById(`post-preview-${postId}`);
    const button = document.getElementById(`toggle-${postId}`);
    if (!preview || !button) return;

    const isClamped = preview.classList.toggle('post-text-clamp');
    if (isClamped) {
        button.innerHTML = `<i class="fa-solid fa-chevron-down"></i> ${getLangText('readMoreBtn', 'Daha fazlasını gör')}`;
    } else {
        button.innerHTML = `<i class="fa-solid fa-chevron-up"></i> ${getLangText('showLessBtn', 'Daha az göster')}`;
    }
};

/* Pages feature removed */

/* GÖNDERİ AYARLARI */
let showAllFeedPosts = false;
let currentPostsUnsubscribe = null;
let currentFeedFilterMode = 'all';

window.loadPostsFeed = (showAll = false) => {
  if (showAll) showAllFeedPosts = true;
  if (currentPostsUnsubscribe) currentPostsUnsubscribe();
  
  const queryConstraints = [orderBy("timestamp", "desc")];
  if (!showAllFeedPosts) {
    queryConstraints.push(limit(8));
  }
  
  currentPostsUnsubscribe = onSnapshot(query(collection(db, "posts"), ...queryConstraints), (snap) => {
      try {
          const feed = document.getElementById('feed-items'),
                t = translations[currentLang];
          
          // accumulate HTML for feed only
          let feedHtml = '';

      let feedPostCount = 0;
      if (snap.empty) {
          console.warn('loadPostsFeed: empty snapshot');
          return;
      }
      const sortedDocs = [...snap.docs].sort((a, b) => {
          return getPostSortTimestamp(b.data()) - getPostSortTimestamp(a.data());
      });
      const mineUsername = getMySharesUsername();
      const filteredDocs = currentFeedFilterMode === 'mine'
          ? sortedDocs.filter((docSnap) => {
              const postData = docSnap.data() || {};
              return postData.username === mineUsername || postData.adminUser === mineUsername;
          })
          : sortedDocs;
      const docsToRender = showAllFeedPosts ? filteredDocs : filteredDocs.slice(0, 6);
      const feedHasMore = !showAllFeedPosts && filteredDocs.length > 6;
      docsToRender.forEach(d => {
          try {
              console.log('rendering post', d.id);
              const p = d.data();
              if (p.hidden === true) return;

              const isAdminLikePost = Boolean(
                  p.isAdmin === true ||
                  p.authorIsAdmin === true ||
                  p.username === 'official_system' ||
                  p.username === 'admin' ||
                  p.author === 'official_system' ||
                  p.author === 'admin' ||
                  p.authorUsername === 'official_system' ||
                  p.authorUsername === 'admin' ||
                  p.authorEmail === 'officialfthuzun@gmail.com' ||
                  p.adminUser === 'official_system' ||
                  p.adminUser === 'admin' ||
                  p.displayName === 'official_system' ||
                  p.displayName === 'admin' ||
                  p.name === 'official_system' ||
                  p.name === 'admin' ||
                  String(p.authorEmail || p.email || '').toLowerCase().includes('official') ||
                  String(p.authorEmail || p.email || '').toLowerCase().includes('admin') ||
                  String(p.username || p.authorUsername || p.author || p.displayName || p.name || '').toLowerCase().includes('official') ||
                  String(p.username || p.authorUsername || p.author || p.displayName || p.name || '').toLowerCase().includes('admin')
              );
              const isPage = Boolean(p.username?.startsWith('page_'));
              const currentIdentity = getCurrentUserIdentity();
              const likeState = getBookmarkState(p.likes, currentIdentity);
              const saveState = getBookmarkState(p.savedBy, currentIdentity);
              const isMine = isCurrentUserPost(p);
              const isLiked = likeState.isSaved;
              const isSaved = saveState.isSaved;
              
              // Decode content and prepare rendering
              const decoded = decodeEntities ? decodeEntities(p.content || "") : (p.content || "");
              const contentWithLinks = stripYoutubeLinks(decoded).replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
              const avatarUrl = getAvatarUrl(p.avatarUrl || p.avatarSeed || 'assets/img/strendsaydamv2.png', 'user');
              const authorDisplayName = escapeHtml(p.name || p.displayName || p.authorDisplayName || p.username || 'Kullanıcı');
              const authorUsername = p.username || p.authorUsername || p.displayName || 'kullanici';
          
          console.log(' post meta', { username: p.username, type: p.type, question: p.question });
              const targetNav = isMine ? 'profil' : (isPage ? 'pages' : 'feed');
              
             const postImageHtml = p.image ? `
    <div class="post-image-wrapper" style="
    margin: 12px auto;
    border-radius: 12px;
    overflow: hidden;
    background: rgb(0, 0, 0);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.3s ease-in-out;
    max-height: 103%;
    max-width: 50%;
    height: auto;
    width: 100%;
    ">
        <img src="${p.image}" 
             loading="lazy"
             style="
                width: 100%; 
                height: 100%; 
                object-fit: cover; 
                cursor: zoom-in;
                transition: all 0.3s ease;
             " 
             onclick="toggleImageExpand(this)"
             alt="Post görseli">
    </div>
` : "";

        const youtubeHtml = extractAndRenderYoutubeVideos(decoded);
        const pollHtml = p.poll ? renderPostPoll(p.poll, d.id) : '';
        const postContentHtml = decoded ? `
        <div class="post-content-block" style="margin-bottom:12px;${isAdminLikePost ? ' background: rgba(255,255,255,0.55); border: 1px solid rgba(99,102,241,0.16); border-radius: 16px; padding: 14px 16px;' : ''}">
            <p id="post-preview-${d.id}" data-original-encoded="${encodeURIComponent(decoded)}" class="post-text${decoded.length > 280 ? ' post-text-clamp' : ''}" style="white-space: pre-wrap; margin:0;${isAdminLikePost ? ' color: var(--text-main);' : ''}">${contentWithLinks}</p>
            ${decoded.length > 280 ? `<button id="toggle-${d.id}" class="read-more-btn" onclick="togglePostContent('${d.id}')" style="border:none; background:none; color: var(--primary); display:flex; align-items:center; gap:8px; font-weight:700; padding:0; margin-top:10px; cursor:pointer;"><i class="fa-solid fa-chevron-down"></i> ${getLangText('readMoreBtn', 'Daha fazlasını gör')}</button>` : ''}
            ${isAdminLikePost ? `<div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(99,102,241,0.16); font-size:0.82rem; color:var(--text-muted); line-height:1.5;"><span style="display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-crown" style="color:var(--primary);"></i>SosyaLTrend yönetici ekibi</span></div>` : ''}
        </div>` : '';

        const postHtmlBase = `
    <div class="glass-card post${isAdminLikePost ? ' admin-post-card' : ''}" data-post-id="${d.id}" style="position: relative;${isAdminLikePost ? ' background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(255, 255, 255, 0.06)); border: 1px solid rgba(99, 102, 241, 0.16); box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06); color: var(--text-main);' : ''}">
        <div style="position: absolute; top: 15px; right: 15px; display: flex; gap: 8px; z-index: 55; pointer-events: auto;">
             <button type="button" class="translate-content-btn" data-translate-target="post-preview-${d.id}" onclick="event.preventDefault(); event.stopPropagation(); toggleTranslateContentToEnglish(this, 'post-preview-${d.id}'); return false;" title="${getLangText('translateToEnglishTitle', 'İngilizceye çevir')}" style="background:rgba(99,102,241,0.08); border:1px solid var(--border); color:var(--primary); cursor:pointer; width:32px; height:32px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; position:relative; z-index:40; pointer-events:auto;">
                 <span class="translate-lang-badge">EN</span>
             </button>
             ${(isMine || user.isAdmin) ? `
                  <button onclick="openEditModal('${d.id}', \`${p.content.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'post')" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                      <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="post-delete-btn" style="position:static;" onclick="deletePost('${d.id}')">
                      <i class="fa-solid fa-trash"></i>
                  </button>
              ` : ''}
        </div>
        <div style="display:flex; gap:10px; margin-bottom:10px;">
              <img src="${avatarUrl}" class="${isPage ? 'page-avatar' : 'user-avatar'}" style="cursor:pointer;" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">
              <div>
                  <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;${isPage ? ' color: var(--text-main);' : ''}" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">
                      ${authorDisplayName} ${isPage ? '<i class="fa-solid fa-circle-check" style="color:var(--primary); font-size:0.7rem;"></i>' : ''}
                      <span class="post-time" style="${isPage ? 'color: var(--text-muted);' : ''}">• ${formatPostTimestamp(p.timestamp)}</span>
                      ${p.isEdited ? `<span style="font-size: 0.6rem; color: var(--text-muted); font-weight: normal;">(${getLangText('editedLabel', 'düzenlendi')})</span>` : ''}
                  </div>
                  <div style="font-size:0.75rem; color:${isPage ? 'var(--text-muted)' : 'var(--text-muted)'}; cursor:pointer;" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">@${authorUsername}</div>
              </div>
        </div>
        
        ${postContentHtml}${pollHtml}${postImageHtml}${youtubeHtml}

        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; min-height:28px;">
            <div id="likers-${d.id}" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"></div>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <button class="tool-btn icon-count" onclick="likePost('${d.id}', this)" data-liked="${isLiked ? 'true' : 'false'}" aria-pressed="${isLiked ? 'true' : 'false'}" style="gap:3px; color:${isLiked ? '#ef4444' : ''}"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>(${likeState.normalizedSavedBy.length})</span></button>
              <button class="tool-btn icon-count" onclick="toggleCommentSection('${d.id}')" style="gap:3px;"><i class="fa-regular fa-comment"></i><span>(${p.comments?.length || 0})</span></button>
              <button class="tool-btn icon-count" onclick="toggleBookmark('${d.id}', this)" data-saved="${isSaved ? 'true' : 'false'}" aria-pressed="${isSaved ? 'true' : 'false'}" style="gap:3px; color:${isSaved ? '#f59e0b' : ''}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i><span>(${saveState.normalizedSavedBy.length})</span></button>
              <button class="tool-btn" onclick="window.reportPost('${d.id}', '${authorUsername.replace(/'/g, "\\'")}')" title="Gönderiyi bildir" style="gap:5px; margin-left:auto; color:#f59e0b;"><i class="fa-regular fa-flag"></i></button>
              <button class="tool-btn" onclick="window.openShareMenu('${d.id}')" style="gap:5px;"><i class="fa-solid fa-share"></i></button>
        </div>
        
        <div id="comments-${d.id}" class="comment-area" style="display:none;">
              <div id="list-${d.id}">
                  ${(p.comments || []).map(c => `
                      <div class="comment-item">
                          <div class="comment-header">
                              <div class="comment-author">
                                  <img src="${getAvatarUrl(c.avatarUrl || c.avatarSeed || 'assets/img/strendsaydamv2.png', 'user')}" class="comment-author-avatar" style="width:32px; height:32px; border-radius:50%; cursor:pointer;" onclick="${c.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(c.username)}'`}">
                                  <div>
                                      <div>
                                          <span class="comment-meta" style="cursor:pointer;" onclick="${c.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(c.username)}'`}">${c.displayName}</span>
                                          <span class="comment-time">• ${formatTime(c.time)}</span>
                                      </div>
                                  </div>
                              </div>
                              <div class="comment-actions">
                                ${(c.username === user.username) ? `
                                    <button onclick="openEditModal('${d.id}', \`${c.text.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'comment', ${c.time})" title="${getLangText('editAction', 'Düzenle')}">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                ` : ''}
                                ${(c.username === user.username || user.isAdmin) ? `
                                    <button class="comment-del-btn" onclick="deleteComment('${d.id}', ${c.time}, '${c.text.replace(/'/g, "\\'")}')" title="${getLangText('deleteAction', 'Sil')}">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                ` : ''}
                              </div>
                          </div>
                          <div class="comment-body">${c.text}</div>
                          ${c.isEdited ? `<small style="font-size: 0.65rem; color: var(--text-muted);">(${getLangText('editedLabel', 'düzenlendi')})</small>` : ''}
                          <div>
                              ${(c.replies || []).map(r => `
                                  <div class="comment-reply">
                                      <img src="${getAvatarUrl(r.avatarUrl || r.avatarSeed || 'assets/img/strendsaydamv2.png', 'user')}" style="width: 22px; height: 22px; border-radius: 50%; cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">
                                      <div style="flex:1;">
                                          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                              <b style="color:var(--primary); cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">${r.displayName}</b>
                                              <span class="comment-time">• ${formatTime(r.time)}</span>
                                          </div>
                                          <div style="margin-top:4px; font-size:0.9rem; color:var(--text-main);">${r.text}</div>
                                          ${r.isEdited ? `<small style="font-size: 0.65rem; color: var(--text-muted);">(${getLangText('editedLabel', 'düzenlendi')})</small>` : ''}
                                      </div>
                                      <div class="comment-actions">
                                          ${(r.username === user.username) ? `
                                              <button onclick="openEditModal('${d.id}', \`${r.text.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'reply', ${c.time}, ${r.time})" title="${getLangText('editAction', 'Düzenle')}">
                                                  <i class="fa-solid fa-pen"></i>
                                              </button>
                                          ` : ''}
                                          ${(r.username === user.username || user.isAdmin) ? `
                                              <button class="comment-del-btn" onclick="deleteReply('${d.id}', ${c.time}, ${r.time})" title="${getLangText('deleteAction', 'Sil')}">
                                                  <i class="fa-solid fa-xmark"></i>
                                              </button>
                                          ` : ''}
                                      </div>
                                  </div>
                              `).join('')}
                          </div>
                          <button class="reply-btn" data-post-id="${d.id}" data-comment-time="${c.time}" data-comment-author="${escapeHtml(c.displayName)}" data-comment-snippet="${encodeURIComponent(c.text ? c.text.slice(0, 80) : '')}" onclick="prepareReply(this)">${getLangText('replyBtn', 'Yanıtla')}</button>
                      </div>`).join('')}
              </div>
              <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
                  <div id="reply-info-${d.id}" class="comment-reply-info"></div>
                  <div style="display:flex; gap:8px;">
                      <input type="text" id="input-${d.id}" aria-label="Yorum girin" data-default-placeholder="${t.commentPlaceholder}" placeholder="${t.commentPlaceholder}" oninput="updateCommentCount('${d.id}')" onkeydown="if(event.key==='Enter'){ addComment('${d.id}'); }" maxlength="200" style="flex:1; padding:8px 12px; border-radius:10px; border:1px solid var(--border); outline:none; background: var(--input-bg); color: var(--text-main);">
                      <button onclick="addComment('${d.id}')" style="background:var(--primary); color:white; border:none; padding:0 15px; border-radius:10px; cursor:pointer;">${t.sendComment}</button>
                  </div>
              </div>
        </div>
    </div>`;
          // Feed'e eklenen posta HTML'e benzersiz id ekleyelim (hash ile yönlendirme için)
          const postHtmlForFeed = postHtmlBase.replace('<div class="glass-card post"', `<div id="post-${d.id}" class="glass-card post"`);

          if(feed) feedHtml += postHtmlForFeed;
          
          // Likers preview'ı doldur
          try {
              if (window.populateLikersPreview) {
                  setTimeout(() => { window.populateLikersPreview(d.id, p.likes || []); }, 0);
              }
          } catch(e) { console.error('populateLikersPreview error', e); }
          feedPostCount++;
          } catch(err) {
              console.error('post render error', err, d.id);
          }
      });

      // populate feed only
      if (snap.size > 0 && feedHtml.trim() === '') {
          // no HTML generated despite documents present; show fallback message
          if (feed) {
              feed.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);">${getLangText('postsLoadError', 'Gönderiler yüklenirken bir hata oluştu.')}</div>`;
          }
      } else {
          if(feed) {
              // Duyuruları koru
              const announcements = Array.from(feed.querySelectorAll('[data-announcement-id]'));
              feed.innerHTML = feedHtml;
              // Duyuruları geri ekle (en başa)
              announcements.reverse().forEach(card => {
                  feed.insertBefore(card, feed.firstChild);
              });
          }
      }

      // Daha fazla yükle butonu
      if (feed && feedHasMore) {
        const morePostsBtn = document.createElement('div');
        morePostsBtn.style.cssText = `
          text-align: center;
          padding: 20px;
          margin-top: 15px;
        `;
        morePostsBtn.innerHTML = `
          <button onclick="window.loadPostsFeed(true);" style="
            background: linear-gradient(135deg, var(--primary), #8b5cf6);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 50px;
            font-weight: 700;
            cursor: pointer;
            font-size: 0.95rem;
            transition: all 0.3s ease;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fa-solid fa-chevron-down"></i> ${getLangText('loadMoreBtn', 'Daha fazla yükle')}
          </button>
        `;
        feed.appendChild(morePostsBtn);
      }
      
      // Feed render tamamlandıktan sonra varsa hash ile yönlendirmeyi gerçekleştir
      try {
        (async () => {
            try {
                const h = window.location.hash || '';
                if (!h.startsWith('#post-')) return;
                const id = h.slice(1);
                const el = await waitForElement(`#${id}`, 5000, 200);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const postId = h.replace('#post-', '');
                    const commentsEl = document.getElementById(`comments-${postId}`);
                    if (commentsEl) commentsEl.style.display = 'block';
                } else {
                    console.warn('Could not find element for hash', h);
                }
            } catch (e) { console.warn('Hash scroll helper error:', e); }
        })();
      } catch (e) { console.warn('Hash scroll hata:', e); }
  } catch (e) { console.error('loadPostsFeed snapshot error', e); }
  });
};

// setup DOMContentLoaded hooks for counters
window.addEventListener('DOMContentLoaded', () => {
    if (typeof updatePostCount === 'function') updatePostCount();
});

loadPostsFeed();
// also initialize post counter in case inputs already exist
if (typeof updatePostCount === 'function') updatePostCount();


  const shareBtn = document.getElementById('shareBtn');
  if(shareBtn) {
    shareBtn.onclick = async () => {
        const btn = shareBtn;
        const postInputEl = document.getElementById('postInput');
        let val = normalizePostText(postInputEl ? (postInputEl.innerText || postInputEl.textContent || '') : '');
        if (val.length > 1000) val = val.substring(0, 1000);
        if (!val && !selectedImageBase64) return;

        try {
            disableButton(btn, getLangText('sharingText', 'Paylaşılıyor...'));
                const createdPostRef = await addDoc(collection(db, "posts"), {
                    authorUid: auth.currentUser?.uid || null,
                    name: user.displayName,
                    username: user.username,
                    avatarUrl: user.avatarUrl || user.photoURL || 'assets/img/strendsaydamv2.png',
                    authorIsAdmin: user.isAdmin || false,
                    content: val,
                    image: selectedImageBase64 || null,
                    timestamp: serverTimestamp(),
                    likes: [],
                    savedBy: [],
                    comments: []
            });
            await queueContentModerationIfNeeded({
                contentType: 'post',
                contentId: createdPostRef.id,
                contentText: val,
                authorUid: auth.currentUser?.uid || null,
                authorUsername: user.username,
                authorDisplayName: user.displayName || user.name
            });

            document.getElementById('postInput').innerText = "";
            if (typeof updatePostCount === 'function') updatePostCount();
            window.clearImagePreview();
            // küçük onay bildirimi
            const t = document.createElement('div');
            t.innerText = getLangText('postedToast', 'Gönderildi');
            t.style.position = 'fixed'; t.style.right = '20px'; t.style.bottom = '20px'; t.style.background = 'rgba(0,0,0,0.8)'; t.style.color = '#fff'; t.style.padding = '8px 12px'; t.style.borderRadius = '8px'; t.style.zIndex = 99999;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 1800);

            // refresh feed shortly
            setTimeout(() => { if (typeof loadPostsFeed === 'function') loadPostsFeed(); }, 800);
        } catch (e) {
            console.error("Paylaşım hatası:", e);
            alert(getLangText('postFailedAlert', 'Gönderi paylaşılamadı.'));
        } finally {
            enableButton(btn, getLangText('shareBtn', 'Paylaş'));
        }
    };
}

  setInterval(() => {
    const n = new Date();
    const sH = document.getElementById('secHand');
    const mH = document.getElementById('minHand');
    const hH = document.getElementById('hourHand');
    const dC = document.getElementById('digiClock');
    const dD = document.getElementById('dateDisplay');

    if(sH) sH.style.transform = `translateX(-50%) rotate(${n.getSeconds()*6}deg)`;
    if(mH) mH.style.transform = `translateX(-50%) rotate(${n.getMinutes()*6}deg)`;
    if(hH) hH.style.transform = `translateX(-50%) rotate(${(n.getHours()*30)+(n.getMinutes()/2)}deg)`;
    if(dC) dC.innerText = n.toLocaleTimeString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
    
    if(dD) {
      const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      dD.innerText = n.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US', options);
    }
  }, 1000);

    const profileTriggers = document.querySelectorAll('#profileTrigger, #mobileProfileTrigger');
    profileTriggers.forEach((triggerEl) => {
        triggerEl.onclick = (e) => {
            e.stopPropagation();
            toggleProfileDropdown(triggerEl);
        };

        triggerEl.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggleProfileDropdown(triggerEl);
            }
        };
    });
/* ============================ */

/* Gündem özelliği kaldırıldı */

/* MOBİLE VERSİYONDA İÇERİK AYARLAMA */
const initMobilePanelsAndCalendar = () => {
    if (window.__mobilePanelsInitDone) return;
    window.__mobilePanelsInitDone = true;

    const leftBtn = document.getElementById('leftOpenBtn');
    const rightBtn = document.getElementById('rightOpenBtn');
    const leftAside = document.querySelector('aside');
    const rightAside = document.querySelector('.right-panel');
    const overlay = document.getElementById('sideOverlay');

    const toggleLeft = () => {
        if (leftAside && overlay) { // Güvenlik kontrolü
            leftAside.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    };

    const toggleRight = () => {
        if (rightAside && overlay) { // Güvenlik kontrolü
            rightAside.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    };

    const closeAll = () => {
        leftAside?.classList.remove('active');
        rightAside?.classList.remove('active');
        overlay?.classList.remove('active');
    };

    // BURASI ÖNEMLİ: Sadece eleman varsa olay ataması yap
    if (leftBtn) leftBtn.onclick = toggleLeft;
    if (rightBtn) rightBtn.onclick = toggleRight;
    if (overlay) overlay.onclick = closeAll;

    // Sağ panelde takvim (takvim widget'ı)
    const initRightCalendar = () => {
        const calendarEl = document.getElementById('rightCalendar');
        const navEl = document.getElementById('rightCalendarNav');
        if (!calendarEl || !navEl) return;

        // Özel günler (resmi, dini, hatırlatma vb.)
        // Veriler `assets/js/calendarDays.js` içinden geliyor.
        const buildSpecialDayMap = (year) => {
            const map = {};

                // 0) Ramazan takvimi (takvimde tüm Ramazan günlerini işaretlemek için)
            ramazanTakvimi.forEach((gun) => {
                const key = `${year}-${String(gun.ay + 1).padStart(2, '0')}-${String(gun.gun).padStart(2, '0')}`;
                // "Ramazan Başlangıcı" vb. daha özel açıklamaların üzerine yazılmasın
                if (!map[key]) map[key] = gun;
            });

            // 1) Resmi/özel/dini günler (calendarDays.js)
            ozelGunler.forEach((gun) => {
                const key = `${year}-${String(gun.ay + 1).padStart(2, '0')}-${String(gun.gun).padStart(2, '0')}`;
                map[key] = gun;
            });

            // 2) Tarihte Bugün (tarihteBugun listesi)
            // Tarih sabittir; hangi yıla bakılırsa bakılsın bu günler o günün tarihine denk gelecek
            tarihteBugun.forEach((olay) => {
                const key = `${year}-${String(olay.ay + 1).padStart(2, '0')}-${String(olay.gun).padStart(2, '0')}`;
                map[key] = {
                    baslik: olay.baslik || 'Tarihte Bugün',
                    mesaj: olay.mesaj || '',
                    emoji: '⏳',
                    kaynak: 'Tarihte Bugün'
                };
            });

            return map;
        };

        // Dini takvim hesaplaması yapılmıyor. Takvim verileri `assets/js/calendarDays.js` üzerinden geliyor.

        const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
        let viewDate = new Date();

        const render = () => {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const prevLastDay = new Date(year, month, 0).getDate();
            const startWeekday = (firstDay.getDay() + 6) % 7; // Pazartesi bazlı

            const daysInMonth = lastDay.getDate();
            const today = new Date();
            const isToday = (d) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

            const monthKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const specialDaysMap = buildSpecialDayMap(year);

            let html = dayNames.map(d => `<div class="day header">${d}</div>`).join('');

            for (let i = startWeekday - 1; i >= 0; i--) {
                html += `<div class="day other-month">${prevLastDay - i}</div>`;
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month, d);
                const key = monthKey(year, month, d);
                const special = specialDaysMap[key];
                const label = special?.baslik || '';
                const message = special?.mesaj || '';
                const source = special?.kaynak || '';

                const isSpecial = Boolean(special);
                const emoji = special?.emoji || '';
                const displayNumber = isSpecial ? `${emoji ? `${emoji} ` : ''}${d}` : d;

                const classes = ['day', isToday(date) ? 'today' : '', isSpecial ? 'special' : ''].filter(Boolean).join(' ');
                html += `<div class="${classes}" data-date="${key}" data-baslik="${label}" data-mesaj="${message}" data-source="${source}" title="${label}">${displayNumber}</div>`;
            }

            const totalCells = 7 * 6; // 6 satır
            const currentCount = startWeekday + daysInMonth + 7; // +7 header için
            const remaining = totalCells - currentCount;
            for (let i = 1; i <= remaining; i++) {
                html += `<div class="day other-month">${i}</div>`;
            }

            calendarEl.innerHTML = html;
            if (typeof window.renderOnlineFriendsWidget === 'function') {
                window.renderOnlineFriendsWidget();
            }

            // Özel güne tıklanınca bilgi göster
            calendarEl.querySelectorAll('.day.special').forEach((el) => {
                el.addEventListener('click', () => {
                    const baslik = el.getAttribute('data-baslik');
                    const mesaj = el.getAttribute('data-mesaj');
                    const source = el.getAttribute('data-source');
                    const dateKey = el.getAttribute('data-date');
                    if (baslik) {
                        let info = baslik;
                        if (mesaj) info += `\n${mesaj}`;
                        const sourceText = source ? `\n\nKaynak: ${source}` : '';
                        alert(`${dateKey} — ${info}${sourceText}`);
                    }
                });
            });

            navEl.innerHTML = `
                <button type="button" class="calendar-prev" aria-label="Önceki Ay">&lsaquo;</button>
                <div class="calendar-title">${viewDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}</div>
                <button type="button" class="calendar-next" aria-label="Sonraki Ay">&rsaquo;</button>
            `;

            navEl.querySelector('.calendar-prev')?.addEventListener('click', () => {
                viewDate.setMonth(viewDate.getMonth() - 1);
                render();
            });
            navEl.querySelector('.calendar-next')?.addEventListener('click', () => {
                viewDate.setMonth(viewDate.getMonth() + 1);
                render();
            });
        };

        window.renderOnlineFriendsWidget = async function() {
            const onlineContainer = document.getElementById('onlineFriendsWidget');
            if (!onlineContainer) return;
            onlineContainer.innerHTML = '';
            if (!auth.currentUser) {
                onlineContainer.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">Giriş yaparak çevrimiçi arkadaşları gör.</div>';
                return;
            }
            try {
                if (!window.headerFriendsListData) {
                    await window.loadHeaderFriendsList();
                }
                const friends = window.headerFriendsListData || [];
                const onlineFriends = friends.filter(f => f.presence && f.presence.status === 'online');
                const offlineFriends = friends.filter(f => !f.presence || f.presence.status !== 'online');
                const onlineGroup = document.createElement('div');
                onlineGroup.className = 'friend-status-group';
                onlineGroup.innerHTML = `
                    <div class="friend-status-group-title">
                        <span>Çevrim içi</span>
                        <span class="friend-count-badge">${onlineFriends.length}</span>
                    </div>
                `;
                onlineContainer.appendChild(onlineGroup);
                if (!onlineFriends.length) {
                    const emptyOnline = document.createElement('div');
                    emptyOnline.className = 'friend-status-empty';
                    emptyOnline.textContent = 'Çevrim içi arkadaş yok.';
                    onlineGroup.appendChild(emptyOnline);
                } else {
                    const onlineList = document.createElement('div');
                    onlineList.className = 'friend-list-grid';
                    onlineFriends.slice(0, 8).forEach((friend) => {
                        const card = document.createElement('div');
                        card.className = 'online-friend-card';
                        card.title = friend.displayName || 'Çevrimiçi arkadaş';
                        card.innerHTML = `\n                            <div class="online-friend-card-left">\n                                <img src="${friend.avatarUrl}" alt="${escapeHtml(friend.displayName)}">\n                                <div>\n                                    <div class="online-friend-name">${escapeHtml(friend.displayName)}</div>\n                                    <div class="online-friend-status">Çevrimiçi</div>\n                                </div>\n                            </div>\n                            <div class="friend-action-group">\n                                <button type="button" class="friend-action-btn friend-action-chat" title="Sohbet et"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i></button>\n                                <button type="button" class="friend-action-btn friend-action-profile" title="Profili aç"><i class="fa-solid fa-user" aria-hidden="true"></i></button>\n                            </div>\n                        `;
                        card.onclick = () => {
                            if (friend.profileUrl) {
                                window.location.href = friend.profileUrl;
                            }
                        };
                        const chatBtn = card.querySelector('.friend-action-chat');
                        if (chatBtn) {
                            chatBtn.addEventListener('click', event => {
                                event.stopPropagation();
                                if (typeof window.openChatWithFriend === 'function') {
                                    window.openChatWithFriend(friend.id, friend.displayName, friend.username);
                                }
                            });
                        }
                        const profileBtn = card.querySelector('.friend-action-profile');
                        if (profileBtn) {
                            profileBtn.addEventListener('click', event => {
                                event.stopPropagation();
                                if (friend.profileUrl) {
                                    window.location.href = friend.profileUrl;
                                }
                            });
                        }
                        onlineList.appendChild(card);
                    });
                    onlineGroup.appendChild(onlineList);
                }
                const offlineGroup = document.createElement('div');
                offlineGroup.className = 'friend-status-group';
                offlineGroup.innerHTML = `
                    <div class="friend-status-group-title">
                        <span>Çevrim dışı</span>
                        <span class="friend-count-badge offline-badge">${offlineFriends.length}</span>
                    </div>
                `;
                onlineContainer.appendChild(offlineGroup);
                if (offlineFriends.length === 0) {
                    const emptyOffline = document.createElement('div');
                    emptyOffline.className = 'friend-status-empty';
                    emptyOffline.textContent = 'Şu anda çevrim dışı arkadaş yok.';
                    offlineGroup.appendChild(emptyOffline);
                } else {
                    const offlineList = document.createElement('div');
                    offlineList.className = 'friend-list-grid';
                    offlineFriends.slice(0, 8).forEach((friend) => {
                        const card = document.createElement('div');
                        card.className = 'online-friend-card offline';
                        card.title = friend.displayName || 'Çevrim dışı arkadaş';
                        card.innerHTML = `
                            <div class="online-friend-card-left">
                                <img src="${friend.avatarUrl}" alt="${escapeHtml(friend.displayName)}">
                                <div>
                                    <div class="online-friend-name">${escapeHtml(friend.displayName)}</div>
                                    <div class="online-friend-status offline-status">Çevrim dışı${formatOfflineDays(friend.presence.lastActiveAt)}</div>
                                </div>
                            </div>
                            <div class="friend-action-group">
                                <button type="button" class="friend-action-btn friend-action-chat" title="Sohbet et"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i></button>
                                <button type="button" class="friend-action-btn friend-action-profile" title="Profili aç"><i class="fa-solid fa-user" aria-hidden="true"></i></button>
                            </div>
                        `;
                        card.onclick = () => {
                            if (friend.profileUrl) {
                                window.location.href = friend.profileUrl;
                            }
                        };
                        const chatBtn = card.querySelector('.friend-action-chat');
                        if (chatBtn) {
                            chatBtn.addEventListener('click', event => {
                                event.stopPropagation();
                                if (typeof window.openChatWithFriend === 'function') {
                                    window.openChatWithFriend(friend.id, friend.displayName, friend.username);
                                }
                            });
                        }
                        const profileBtn = card.querySelector('.friend-action-profile');
                        if (profileBtn) {
                            profileBtn.addEventListener('click', event => {
                                event.stopPropagation();
                                if (friend.profileUrl) {
                                    window.location.href = friend.profileUrl;
                                }
                            });
                        }
                        offlineList.appendChild(card);
                    });
                    offlineGroup.appendChild(offlineList);
                }
            } catch (error) {
                console.error('Çevrimiçi arkadaş widget yüklenirken hata:', error);
                onlineContainer.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">Çevrimiçi arkadaşlar yüklenemedi.</div>';
            }
        }

        render();
    };

    // bui yükle
    const loadUpcomingEvents = () => {
        const eventsList = document.getElementById('upcomingEventsList');
        if (!eventsList) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Yaklaşan 7 günün tarihlerini oluştur
        const upcomingDates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            upcomingDates.push(date);
        }

        // Özel günleri kontrol et
        let events = [];
        upcomingDates.forEach(date => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // ozelGunler, ramazanTakvimi, tarihteBugun verilerini kontrol et
            let foundEvent = null;

            // Ramazan takvimi
            if (!foundEvent) {
                foundEvent = ramazanTakvimi.find(g => 
                    g.ay === month && g.gun === day
                );
            }

            // Özel günler
            if (!foundEvent) {
                foundEvent = ozelGunler.find(g => 
                    g.ay === month && g.gun === day
                );
            }

            // Tarihte bugün
            if (!foundEvent) {
                foundEvent = tarihteBugun.find(g => 
                    g.ay === month && g.gun === day
                );
                if (foundEvent) {
                    foundEvent.emoji = '⏳';
                }
            }

            if (foundEvent) {
                events.push({
                    date: date,
                    title: foundEvent.baslik || foundEvent.baslik || 'Etkinlik',
                    emoji: foundEvent.emoji || '📅'
                });
            }
        });

        // HTML oluştur
        const titleEl = document.getElementById('upcomingEventsTitle');
        if (events.length === 0) {
            if (titleEl) titleEl.innerText = 'Yaklaşan Etkinlikler';
            eventsList.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 16px 8px;">Yaklaşan etkinlik yok</div>';
        } else {
            if (titleEl) titleEl.innerText = `Yaklaşan Etkinlikler (${events.length})`;
            eventsList.innerHTML = events.map((evt, idx) => {
                const dateStr = evt.date.toLocaleDateString('tr-TR', {
                    month: 'short',
                    day: 'numeric'
                });
                const isLast = idx === events.length - 1;
                return `
                    <div style="font-size: 0.8rem; padding: 10px 10px; background: rgba(99, 102, 241, 0.08); border-radius: 10px; border-left: 4px solid var(--primary); transition: all 0.2s ease; ${isLast ? 'margin-bottom: 0;' : 'margin-bottom: 12px;'}">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 1.1rem;">${evt.emoji}</span>
                            <span style="font-weight: 600; color: var(--text-main); flex: 1;">${evt.title}</span>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); padding-left: 20px;">${dateStr}</div>
                    </div>
                `;
            }).join('');
        }
    };

    initRightCalendar();
    loadUpcomingEvents();
};

// Run after DOM is ready and after includes have been injected
const runInitIfReady = () => {
    // If includes are already loaded (or never used), init directly
    if (window.includesLoaded || document.getElementById('rightCalendar')) {
        initMobilePanelsAndCalendar();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitIfReady);
} else {
    runInitIfReady();
}

document.addEventListener('includesLoaded', initMobilePanelsAndCalendar);
/* ============================   */

// visitor simulation helper
function isSimulatingVisitor() {
    return localStorage.getItem('simulateVisitor') === 'true';
}

window.toggleVisitorSimulation = () => {
    const current = isSimulatingVisitor();
    localStorage.setItem('simulateVisitor', current ? 'false' : 'true');
    const msg = current ? 'Simülasyon kapatıldı' : 'Ziyaretçi simülasyonu etkin. Sayfa yeniden yüklenecek.';
    alert(msg);
    location.reload();
};

// Ziyaretçi Profili Göster
async function loadVisitorProfile() {
    window.visitedProfileIsPrivate = false;
    let visitedUsername = getVisitedProfileUsername();
    const simulate = isSimulatingVisitor();
    if (simulate && (!visitedUsername || visitedUsername === user.username)) {
        // force visitor state on own profile
        visitedUsername = '__simulate__';
    }

    const myPostsList = document.getElementById('my-posts-list');
    const myLikesList = document.getElementById('my-liked-list');
    const bookmarkItems = document.getElementById('bookmark-items');
    const isVisitedProfile = Boolean(visitedUsername && visitedUsername !== user.username);
    if (isVisitedProfile) {
        if (myPostsList) myPostsList.innerHTML = '';
        if (myLikesList) myLikesList.innerHTML = '';
        if (bookmarkItems) bookmarkItems.innerHTML = '';
    }
    
    // Ziyaretçi modu değilse çık (kendi profili)
    if (!visitedUsername || visitedUsername === user.username) {
        // Kendi profili - button'ları düzenle
        const editBtn = document.getElementById('editProfileBtn');
        const addFriendBtn = document.getElementById('addFriendBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const tebrikProfileBtn = document.querySelector('button[onclick="window.openTebrikModalForProfile()"]');
        if (editBtn) editBtn.style.display = 'inline-block';
        if (addFriendBtn) addFriendBtn.style.display = 'none';
        if (settingsBtn) settingsBtn.style.display = 'inline-block';
        if (tebrikProfileBtn) tebrikProfileBtn.style.display = 'none';
        
        // Kendi profilinde bannerleri gizle
        const privateNoticeCard = document.getElementById('privateNoticeCard');
        if (privateNoticeCard) privateNoticeCard.style.display = 'none';
        const friendViewNotice = document.getElementById('friendViewNotice');
        if (friendViewNotice) friendViewNotice.style.display = 'none';
        
        // Kendi profilinde tüm sekmelerin butonlarını göster (içerik görünürlüğünü openTab ayarlasın)
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach((btn) => {
            btn.style.display = 'inline-block';
        });
        // aktif sekmeyi tetikleyerek yalnızca onun içeriğinin görüntülenmesini sağla
        const activeBtn = document.querySelector('.tab-btn.active');
        if (activeBtn) {
            activeBtn.click();
        }
        
        // Own profile buttons updated
        return;
    }
    
    // Ziyaretçi modu etkinleştir
    
    // localStorage'a ziyaretçinin username'ini kaydet
    localStorage.setItem('visiting_username', visitedUsername);
    
    // Profil düzenle butonunu gizle
    const editBtn = document.getElementById('editProfileBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    if (editBtn) {
        editBtn.style.display = 'none';
    }
    if (settingsBtn) {
        settingsBtn.style.display = 'none';
    }
    // Kişisel Bilgilerim altındaki düzenle düğmesini de gizle
    document.querySelectorAll('button[onclick="toggleEditProfile()"]').forEach(btn => {
        btn.style.display = 'none';
    });
    // Yeni inline düzenleme ikonlarını gizle
    document.querySelectorAll('.card-edit-btn').forEach(btn => {
        btn.style.display = 'none';
    });
    // Inline edit panellerini kapat
    document.querySelectorAll('.inline-edit-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    const avatarOverlay = document.querySelector('.avatar-camera-overlay');
    if (avatarOverlay) {
        avatarOverlay.style.display = 'none';
    }
    const fileAvatarInput = document.getElementById('fileAvatarInput');
    if (fileAvatarInput) {
        fileAvatarInput.disabled = true;
    }
    const newAvatarUrlInput = document.getElementById('newAvatarUrlInput');
    if (newAvatarUrlInput) {
        newAvatarUrlInput.disabled = true;
    }
    const settingsMenu = document.getElementById('profileSettingsMenu');
    if (settingsMenu) settingsMenu.classList.remove('visible');

    // Visitor profile only: hide tabs that show only the current user's likes/saves/notifications
    ['my-likes-tab','my-saves-tab','my-notifs-tab'].forEach(tabId => {
        const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        const tab = document.getElementById(tabId);
        if (btn) btn.style.display = 'none';
        if (tab) tab.style.display = 'none';
    });
    
    // Arkadaş Olarak Ekle butonunu HEMEN göster
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (addFriendBtn) {
        addFriendBtn.style.display = 'inline-block';
        addFriendBtn.style.visibility = 'visible';
        // Add friend button shown
    } else {
        // Add friend button not found in HTML
    }
    
    // Profil düzenle formunu gizle
    const editSection = document.getElementById('editProfileSection');
    if (editSection) editSection.style.display = 'none';
    
    // Ziyaretçi profilde varsayılan olarak sekmeler görünür durumda bırakılıyor.
    // Profil herkese açıksa tüm içerikler gösterilmeli.
    
    try {
        // Firestore'dan başka kullanıcının postlarını çek
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        
        let visitorDisplayName = visitedUsername;
        let visitorAvatar = null;
        let visitorPosts = [];
        let visitorUid = null;
        let visitedData = null;
        let isFriend = false;
        let isVisitedPrivate = false;
        
        snap.forEach(doc => {
            const p = doc.data();
            if (p.username === visitedUsername) {
                visitorPosts.push({ id: doc.id, ...p });
            }
        });

        // Ziyaretçi kullanıcının UID'ini bul
        const userQuery = query(collection(db, "users"), where("username", "==", visitedUsername));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
            visitorUid = userSnap.docs[0].id;
            visitedData = userSnap.docs[0].data();
                window.currentVisitedProfileUid = visitorUid;
            isVisitedPrivate = visitedData.isPrivate === true || visitedData.isPrivate === 'true';
            window.visitedProfileIsPrivate = isVisitedPrivate;

            // set display name & avatar from the user record (fall back to defaults)
            visitorDisplayName = visitedData.displayName || visitedData.name || visitedUsername;
            visitorAvatar = getAvatarUrl(visitedData.avatarUrl || visitedData.avatar || "strendsaydamv2.png", 'user');

            // determine friendship in both directions (visitedData may drop list when user goes private)
            if (auth.currentUser) {
                try {
                    const currentRef = doc(db, "users", auth.currentUser.uid);
                    const currentSnap = await getDoc(currentRef);
                    const currentData = currentSnap.data() || {};
                    const currentFriends = currentData.friends || [];
                    if (visitorUid && currentFriends.includes(visitorUid)) {
                        isFriend = true;
                    }
                } catch (e) {
                    console.warn('Could not fetch current user friends for privacy check', e);
                }
                // fallback: also check visitedData if available
                if (!isFriend && visitedData && visitedData.friends && Array.isArray(visitedData.friends)) {
                    isFriend = visitedData.friends.includes(auth.currentUser.uid);
                }
            }

            // gizlilik kontrolü: profil gizliyse ve ziyaretçi arkadaş değilse içerik göstermeyelim
            if (isVisitedPrivate) {
                if (!isFriend) {
                    // Gizli profil: profil başlığını güncelle
                    const profileName = document.getElementById('profilePageName');
                    if (profileName) profileName.innerText = visitorDisplayName;
                    
                    const profileHandle = document.getElementById('profilePageHandle');
                    if (profileHandle) profileHandle.innerText = `@${visitedUsername}`;
                    
                    const profileAvatar = document.getElementById('profilePageAvatar');
                    if (profileAvatar) {
                        profileAvatar.src = visitorAvatar || getAvatarUrl("strendsaydamv2", 'user');
                    }
                    
                    // Sol üste banner göster ve arkadaşlar sekmesini kapat
                    const privateNoticeCard = document.getElementById('privateNoticeCard');
                    if (privateNoticeCard) {
                        privateNoticeCard.style.display = 'block';
                    }
                    
                    const friendsTab = document.getElementById('my-friends-tab');
                    const friendsTabBtn = document.querySelector('.tab-btn[onclick*="my-friends-tab"]');
                    if (friendsTab) friendsTab.style.display = 'none';
                    if (friendsTabBtn) friendsTabBtn.style.display = 'none';
                    // gizli profilde yabancılara sohbet yeri gösterilmesin
                    const actionBtn = document.getElementById('profileActionBtn');
                    if (actionBtn) actionBtn.style.display = 'none';

                    // Gizli profilde, yabancı ziyaretçilere tüm profil içeriği gizlensin
                    const privateTabSelectors = [
                        '.tab-btn[onclick*="my-posts-tab"]',
                        '.tab-btn[onclick*="my-likes-tab"]',
                        '.tab-btn[onclick*="my-saves-tab"]',
                        '.tab-btn[onclick*="my-congrats-tab"]',
                        '.tab-btn[onclick*="my-friends-tab"]',
                        '.tab-btn[onclick*="my-notifs-tab"]'
                    ];
                    privateTabSelectors.forEach(selector => {
                        const button = document.querySelector(selector);
                        if (button) button.style.display = 'none';
                    });

                    const hiddenTabIds = ['my-posts-tab', 'my-likes-tab', 'my-saves-tab', 'my-congrats-tab', 'my-friends-tab', 'my-notifs-tab'];
                    hiddenTabIds.forEach(tabId => {
                        const tab = document.getElementById(tabId);
                        if (tab) tab.style.display = 'none';
                    });

                    // Özel profilde, ziyaretçi arkadaş değilse üyelik bilgilerini temizle
                    const pJd = document.getElementById('profileJoinDate');
                    const pSi = document.getElementById('profileSignupInfo');
                    const pRo = document.getElementById('profileRole');
                    const pRoleBadge = document.getElementById('profileRoleBadge');
                    const pFc = document.getElementById('profileFriendCount');
                    const pPr = document.getElementById('profilePendingRequests');
                    const pLa = document.getElementById('profileLastActive');
                    const pVerified = document.getElementById('profileVerified');
                    const isAdminProfile = visitedData?.isAdmin === true || String(visitedData?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
                    const roleText = isAdminProfile ? 'Admin' : 'Kullanıcı';
                    if (pSi) pSi.innerText = '—';
                    if (pRo) pRo.innerText = roleText;
                    if (pRoleBadge) pRoleBadge.innerText = roleText;
                    if (pFc) pFc.innerText = typeof visitedData?.friendCount === 'number' ? visitedData.friendCount : (Array.isArray(visitedData?.friends) ? visitedData.friends.length : 0);
                    if (pPr) pPr.innerText = visitedData?.pendingRequests || 0;
                    if (pJd) pJd.innerText = '—';
                    if (pLa) pLa.innerText = '—';
                    if (pVerified) pVerified.innerText = '—';
                    
                    return; // skip rest of visitor loading
                }
            }

        } else {
            console.warn('Ziyaret edilen kullanıcı bulunamadı:', visitedUsername);
            return;
        }
        
        // Profil başlığını güncelle
        const profileName = document.getElementById('profilePageName');
        if (profileName) profileName.innerText = visitorDisplayName;
        
        const profileHandle = document.getElementById('profilePageHandle');
        if (profileHandle) profileHandle.innerText = `@${visitedUsername}`;

        // Update tebrik badge for this profile
        if (typeof updateProfileTebrikUI === 'function') updateProfileTebrikUI(visitedUsername);

        const hasSentProfileTebrik = auth.currentUser && Array.isArray(visitedData.tebrikGivers) && visitedData.tebrikGivers.some(g => g.uid === auth.currentUser.uid && !g.postId);
        if (hasSentProfileTebrik) {
            renderRetractTebrikButton(visitorUid, visitedUsername);
        } else {
            removeRetractTebrikButton();
        }

        const profileAvatar = document.getElementById('profilePageAvatar');
        if (profileAvatar) {
            // use avatar that we determined above (already includes fallback)
            profileAvatar.src = visitorAvatar || getAvatarUrl("strendsaydamv2", 'user');
        }

        // Update membership/profile info card with visited user's data
        try {
            const pJd = document.getElementById('profileJoinDate');
            const pSi = document.getElementById('profileSignupInfo');
            const pRo = document.getElementById('profileRole');
            const pRoleBadge = document.getElementById('profileRoleBadge');
            const pFc = document.getElementById('profileFriendCount');
            const pPr = document.getElementById('profilePendingRequests');
            const pLa = document.getElementById('profileLastActive');
            const pVerified = document.getElementById('profileVerified');

            if (pSi) pSi.innerText = visitedData.email ? shortenEmail(visitedData.email) : '—';
            const isAdminProfile = visitedData.isAdmin === true || String(visitedData.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
            const roleText = isAdminProfile ? 'Admin' : 'Kullanıcı';
            if (pRo) pRo.innerText = roleText;
            if (pRoleBadge) pRoleBadge.innerText = roleText;
            const fc = typeof visitedData.friendCount === 'number' ? visitedData.friendCount : (Array.isArray(visitedData.friends) ? visitedData.friends.length : 0);
            if (pFc) pFc.innerText = fc;
            if (pPr) pPr.innerText = visitedData.pendingRequests || 0;

            // Calculate and show mutual friends count for visited profile
            if (auth.currentUser) {
                try {
                    const currentRef = doc(db, "users", auth.currentUser.uid);
                    const currentSnap = await getDoc(currentRef);
                    const currentData = currentSnap.data() || {};
                    const currentFriends = Array.isArray(currentData.friends) ? currentData.friends : [];
                    const visitedFriends = Array.isArray(visitedData.friends) ? visitedData.friends : [];
                    
                    // Find mutual friends (intersection of both arrays)
                    const mutualFriends = currentFriends.filter(uid => visitedFriends.includes(uid));
                    const mutualCount = mutualFriends.length;
                    
                    const mutualElement = document.getElementById('profileMutualFriends');
                    const mutualCountElement = document.getElementById('mutualFriendsCount');
                    
                    if (mutualElement && mutualCountElement) {
                        mutualCountElement.innerText = mutualCount;
                        mutualElement.style.display = 'inline-block';
                    }
                } catch (e) {
                    console.warn('Could not calculate mutual friends:', e);
                    if (mutualElement && mutualCountElement) {
                        mutualCountElement.innerText = '0';
                        mutualElement.style.display = 'inline-block';
                    }
                }
            } else {
                const mutualElement = document.getElementById('profileMutualFriends');
                const mutualCountElement = document.getElementById('mutualFriendsCount');
                if (mutualElement && mutualCountElement) {
                    mutualCountElement.innerText = '0';
                    mutualElement.style.display = 'inline-block';
                }
            }

            // join date formatting
            if (pJd) {
                const createdAt = visitedData.createdAt || visitedData.joinedAt || visitedData.created || userSnap.docs[0].createTime;
                pJd.innerText = formatJoinDate(createdAt);
            }

            // last active
            if (pLa) {
                try {
                    const lastActiveAt = visitedData.lastActiveAt || visitedData.lastSeen;
                    if (lastActiveAt) {
                        const ad = lastActiveAt.toDate ? lastActiveAt.toDate() : (lastActiveAt.seconds != null ? new Date(lastActiveAt.seconds * 1000) : new Date(lastActiveAt));
                        pLa.innerText = ad.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    } else {
                        pLa.innerText = '—';
                    }
                } catch (e) {
                    console.error('Visitor last active formatting error:', e);
                    pLa.innerText = '—';
                }
            }

            if (pVerified) {
                const ver = visitedData.emailVerified === true || visitedData.verified === true;
                pVerified.innerText = ver ? 'Doğrulandı' : (visitedData.emailVerified === false || visitedData.verified === false ? 'Doğrulanmadı' : '—');
            }
            const pLocation = document.getElementById('profileLocation');
            const pHometown = document.getElementById('profileHometown');
            const pDob = document.getElementById('profileDob');
            const pOccupation = document.getElementById('profileOccupation');
            const pBio = document.getElementById('profileBio');
            const pInterests = document.getElementById('profileInterests');
            if (pLocation) pLocation.innerText = visitedData.location || '—';
            if (pHometown) pHometown.innerText = visitedData.hometown || '—';
            if (pDob) pDob.innerText = visitedData.dob ? (typeof visitedData.dob === 'string' && visitedData.dob.includes('-') ? visitedData.dob.split('-').reverse().join('.') : visitedData.dob) : '—';
            if (pOccupation) pOccupation.innerText = visitedData.occupation || '—';
            if (pBio) pBio.innerText = visitedData.bio || '—';
            if (pInterests) pInterests.innerText = visitedData.interests || '—';

            const pWebsite = document.getElementById('profileWebsite');
            const pFacebook = document.getElementById('profileFacebook');
            const pTwitter = document.getElementById('profileTwitter');
            const pYoutube = document.getElementById('profileYoutube');
            if (pWebsite) {
                pWebsite.innerHTML = '<i class="fa-solid fa-earth-americas"></i>';
                if (visitedData.website) {
                    pWebsite.href = escapeHtml(visitedData.website);
                    pWebsite.target = '_blank';
                    pWebsite.rel = 'noopener noreferrer';
                    pWebsite.classList.remove('disabled');
                    pWebsite.removeAttribute('aria-disabled');
                    pWebsite.removeAttribute('tabindex');
                } else {
                    pWebsite.removeAttribute('href');
                    pWebsite.removeAttribute('target');
                    pWebsite.removeAttribute('rel');
                    pWebsite.classList.add('disabled');
                    pWebsite.setAttribute('aria-disabled', 'true');
                    pWebsite.setAttribute('tabindex', '-1');
                }
            }
            if (pFacebook) {
                pFacebook.innerHTML = '<i class="fa-brands fa-facebook-f"></i>';
                if (visitedData.facebook) {
                    pFacebook.href = escapeHtml(visitedData.facebook);
                    pFacebook.target = '_blank';
                    pFacebook.rel = 'noopener noreferrer';
                    pFacebook.classList.remove('disabled');
                    pFacebook.removeAttribute('aria-disabled');
                    pFacebook.removeAttribute('tabindex');
                } else {
                    pFacebook.removeAttribute('href');
                    pFacebook.removeAttribute('target');
                    pFacebook.removeAttribute('rel');
                    pFacebook.classList.add('disabled');
                    pFacebook.setAttribute('aria-disabled', 'true');
                    pFacebook.setAttribute('tabindex', '-1');
                }
            }
            if (pTwitter) {
                pTwitter.innerHTML = '<i class="fa-brands fa-twitter"></i>';
                if (visitedData.twitter) {
                    pTwitter.href = escapeHtml(visitedData.twitter);
                    pTwitter.target = '_blank';
                    pTwitter.rel = 'noopener noreferrer';
                    pTwitter.classList.remove('disabled');
                    pTwitter.removeAttribute('aria-disabled');
                    pTwitter.removeAttribute('tabindex');
                } else {
                    pTwitter.removeAttribute('href');
                    pTwitter.removeAttribute('target');
                    pTwitter.removeAttribute('rel');
                    pTwitter.classList.add('disabled');
                    pTwitter.setAttribute('aria-disabled', 'true');
                    pTwitter.setAttribute('tabindex', '-1');
                }
            }
            if (pYoutube) {
                pYoutube.innerHTML = '<i class="fa-brands fa-youtube"></i>';
                if (visitedData.youtube) {
                    pYoutube.href = escapeHtml(visitedData.youtube);
                    pYoutube.target = '_blank';
                    pYoutube.rel = 'noopener noreferrer';
                    pYoutube.classList.remove('disabled');
                    pYoutube.removeAttribute('aria-disabled');
                    pYoutube.removeAttribute('tabindex');
                    
                    // YouTube video oynatıcısını göster
                    const youtubeCard = document.getElementById('profileYoutubeCard');
                    const youtubeContainer = document.getElementById('youtubeContainer');
                    if (youtubeCard && youtubeContainer) {
                        const videoId = extractYoutubeVideoId(visitedData.youtube);
                        if (videoId) {
                            youtubeContainer.innerHTML = createYoutubeEmbed(videoId);
                            youtubeCard.style.display = 'block';
                        }
                    }
                } else {
                    pYoutube.removeAttribute('href');
                    pYoutube.removeAttribute('target');
                    pYoutube.removeAttribute('rel');
                    pYoutube.classList.add('disabled');
                    pYoutube.setAttribute('aria-disabled', 'true');
                    pYoutube.setAttribute('tabindex', '-1');
                    
                    // YouTube kartını gizle
                    const youtubeCard = document.getElementById('profileYoutubeCard');
                    if (youtubeCard) youtubeCard.style.display = 'none';
                }
            }
            try {
                const memSummary = document.getElementById('membershipSummaryText');
                const createdAtVal = visitedData.createdAt || visitedData.joinedAt || visitedData.created;
                let ageDays = 0;
                if (createdAtVal) {
                    const cd = createdAtVal.toDate ? createdAtVal.toDate() : (createdAtVal.seconds != null ? new Date(createdAtVal.seconds * 1000) : new Date(createdAtVal));
                    ageDays = Math.max(0, Math.floor((new Date() - cd) / (1000*60*60*24)));
                }
                const friendsCount = typeof visitedData.friendCount === 'number' ? visitedData.friendCount : (Array.isArray(visitedData.friends) ? visitedData.friends.length : 0);
                if (memSummary) memSummary.innerText = `Hesap: ${ageDays} gün · ${friendsCount} arkadaş`;
            } catch (e) {
                console.warn('Membership summary update failed', e);
            }
        } catch (e) {
            console.warn('Could not update visited profile membership card', e);
        }
        // "Arkadaş Olarak Ekle" butonunu göster/güncelle
        if (visitorUid && auth.currentUser) {
            const addFriendBtn = document.getElementById('addFriendBtn');
            if (addFriendBtn) {
                addFriendBtn.style.display = 'inline-block';
                await updateAddFriendButton(visitorUid);
            }
        } else {
            // Friend button update failed
        }

        // eğer profil gizliyse ve biz arkadaşsak bazı öğeleri gizle
        if (visitedData && isVisitedPrivate && isFriend) {
            // arkadaşlar sohbet edebilsin, sadece arkadaş ekleme butonunu sakla
            const addFriendBtn = document.getElementById('addFriendBtn');
            if (addFriendBtn) addFriendBtn.style.display = 'none';
            const notice = document.getElementById('friendViewNotice');
            if (notice) {
                const translatedNotice = translations[currentLang] && translations[currentLang].friendViewNote;
                if (translatedNotice) notice.innerText = translatedNotice;
                notice.style.display = 'block';
            }
        }
        
        // Ziyaretçinin postlarını göster
        const myPostsList = document.getElementById('my-posts-list');
        if (myPostsList) {
            myPostsList.innerHTML = "";
            if (visitorPosts.length === 0) {
                myPostsList.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <i class="fa-regular fa-newspaper" style="font-size:3rem; margin-bottom:15px;"></i>
                    <p>${visitorDisplayName} henüz gönderi paylaşmamış.</p>
                </div>`;
            } else {
                visitorPosts.forEach(post => {
                    const avatarUrl = getAvatarUrl(post.avatarUrl || post.avatarSeed || 'assets/img/strendsaydamv2.png', 'user');
                    // Gelen içerikte HTML-entity olarak girilmiş emojiler olabilir,
                    // decodeEntities kullanarak bunları dönüştürelim.
                    const decodedPost = decodeEntities ? decodeEntities(post.content || "") : (post.content || "");
                    const contentWithLinks = stripYoutubeLinks(decodedPost).replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
                    const postTextClass = decodedPost.length > 280 ? ' post-text-clamp' : '';
                    const postReadMoreButton = decodedPost.length > 280 ? `<button id="toggle-${post.id}" class="read-more-btn" onclick="togglePostContent('${post.id}')"><i class="fa-solid fa-chevron-down"></i> Daha fazlasını gör</button>` : '';
                    
                    const postImageHtml = post.image ? `
                        <div class="post-image-wrapper" style="margin: 12px auto; border-radius: 12px; overflow: hidden; background: rgb(0, 0, 0); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; max-height: 103%; max-width: 50%; height: auto; width: 100%;">
                            <img src="${post.image}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; cursor: zoom-in;" onclick="toggleImageExpand(this)" alt="Post görseli">
                        </div>
                    ` : "";
                    
                    const isLiked = post.likes?.includes(user.username);
                    const canReportPost = true;
                    
                    const postHtml = `
                        <div class="glass-card post" style="position: relative;">
                            <div style="display:flex; gap:10px; margin-bottom:10px;">
                                <img src="${avatarUrl}" class="user-avatar" style="cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">
                                <div>
                                    <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">
                                        ${post.name}
                                        <span class="post-time">• ${formatPostTimestamp(post.timestamp)}</span>
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">@${post.username}</div>
                                </div>
                            </div>
                            
                            <p id="post-preview-${post.id}" class="post-text${postTextClass}" style="white-space: pre-wrap; margin-bottom:10px;">${contentWithLinks}</p>
                            ${postReadMoreButton}
                            ${postImageHtml}
                            
                            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                                <button class="tool-btn icon-count" onclick="likePost('${post.id}', ${isLiked}, this)" style="gap:5px; color:${isLiked ? '#ef4444' : ''}">
                                    <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>(${post.likes?.length || 0})</span>
                                </button>
                                <button class="tool-btn icon-count" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>(${post.comments?.length || 0})</span></button>
                                <button class="tool-btn" onclick="window.reportPost('${post.id}', '${(post.username || '').replace(/'/g, "\\'")}')" title="Gönderiyi bildir" style="gap:5px; margin-left:auto; color:#f59e0b;"><i class="fa-regular fa-flag"></i></button>
                                <button class="tool-btn" onclick="window.openShareMenu('${post.id}')" style="gap:5px;"><i class="fa-solid fa-share"></i></button>
                            </div>
                        </div>
                    `;
                    
                    myPostsList.innerHTML += postHtml;
                });
            }
        }
        
        // Showing visitor profile posts
    } catch (err) {
        console.error("Ziyaretçi profili yüklenirken hata:", err);
    } finally {
        // Hata olsa bile, eğer ziyaretçi profiliyse arkadaş butonu görüntülensin
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn && addFriendBtn.style.display === 'none') {
            addFriendBtn.style.display = 'inline-block';
        }
    }
}

window.loadVisitorProfile = loadVisitorProfile;

// For profile page: load own posts/likes/bookmarks separately
// section param determines which part(s) should be updated; 'all' (default), 'posts', 'likes', 'saves'
window.loadProfileSections = async (section = 'all', showAllPosts = false, showAllLikes = false, showAllSaves = false, targetUsername = null) => {
    // console.log removed

    if (!auth.currentUser) {
        return;
    }
    
    const visitedUsername = typeof getVisitedProfileUsername === 'function' ? getVisitedProfileUsername() : null;
    const isVisitedProfile = Boolean(visitedUsername && (!user || visitedUsername !== user.username));

    if (isVisitedProfile && !targetUsername) {
        if (visitedUsername) {
            console.debug('loadProfileSections: falling back to visitedUsername', visitedUsername);
            targetUsername = visitedUsername;
        } else {
            console.debug('loadProfileSections: no visitedUsername available; aborting');
            return;
        }
    }

    if (!user || !user.username) {
        console.log('loadProfileSections: waiting for user initialization...', user);
        // Wait for user to be initialized
        await new Promise(resolve => {
            let attempts = 0;
            const checkUser = setInterval(() => {
                if (user && user.username) {
                    clearInterval(checkUser);
                    resolve();
                } else if (attempts > 30) { // 3 seconds max
                    clearInterval(checkUser);
                    console.warn('loadProfileSections: user initialization timeout');
                    resolve();
                }
                attempts++;
            }, 100);
        });
    }
    
    if ((!user || !user.username) && auth && auth.currentUser && db && doc && getDoc) {
        try {
            const currentUserRef = doc(db, 'users', auth.currentUser.uid);
            const currentUserDoc = await getDoc(currentUserRef);
            if (currentUserDoc.exists()) {
                const currentUserData = currentUserDoc.data();
                if (currentUserData.username) {
                    user.username = currentUserData.username;
                }
                if (currentUserData.displayName) {
                    user.displayName = currentUserData.displayName;
                }
            }
        } catch (fetchErr) {
            console.warn('loadProfileSections: error fetching current user doc for fallback', fetchErr);
        }
    }

    if ((!user || !user.username) && auth && auth.currentUser) {
        const fallbackUsername = auth.currentUser.email ? auth.currentUser.email.split('@')[0] : auth.currentUser.uid || '';
        if (fallbackUsername) {
            console.warn('loadProfileSections: using fallback username from auth.currentUser', fallbackUsername);
            user.username = fallbackUsername;
        }
    }

    // Calculate effectiveUsername AFTER all initialization attempts
    const effectiveUsername = targetUsername || (isVisitedProfile ? visitedUsername : (user && user.username ? user.username : null));
    const uname = effectiveUsername;
    if (!uname) {
        console.warn('loadProfileSections: user initialization timeout or missing username, aborting section load', user);
        return;
    }

    console.log('[loadProfileSections]', 'section:', section, 'uname:', uname, 'visitedUsername:', visitedUsername, 'targetUsername:', targetUsername, 'user:', user);

    // if a specific section is requested, ensure only its tab-content is visible
    if (section && section !== 'all') {
        const tabMap = {
            posts: 'my-posts-tab',
            likes: 'my-likes-tab',
            saves: 'my-saves-tab',
            tebrikler: 'my-congrats-tab',
            friends: 'my-friends-tab',
            notifs: 'my-notifs-tab',
            'my-posts-tab': 'my-posts-tab',
            'my-likes-tab': 'my-likes-tab',
            'my-saves-tab': 'my-saves-tab',
            'my-congrats-tab': 'my-congrats-tab',
            'my-friends-tab': 'my-friends-tab',
            'my-notifs-tab': 'my-notifs-tab'
        };
        const targetId = tabMap[section] || 'my-posts-tab';
        document.querySelectorAll('.tab-content').forEach(div => {
            if (div.id === targetId) {
                div.style.display = 'block';
                div.classList.add('active');
            } else {
                div.style.display = 'none';
                div.classList.remove('active');
            }
        });
    }

    const myPostsList = document.getElementById('my-posts-list');
    const myLikesList = document.getElementById('my-liked-list');
    const bookmarkList = document.getElementById('bookmark-items');
    const myCongratsList = document.getElementById('my-congrats-list');
    
    // always clear the containers to avoid stale content
    if (myPostsList && (section === 'all' || section === 'posts')) myPostsList.innerHTML = '';
    if (myLikesList && (section === 'all' || section === 'likes')) myLikesList.innerHTML = '';
    if (bookmarkList && (section === 'all' || section === 'saves')) bookmarkList.innerHTML = '';
    if (myCongratsList && (section === 'all' || section === 'tebrikler')) myCongratsList.innerHTML = '';

    if (section === 'tebrikler' || section === 'my-congrats-tab') {
        await loadProfileCongrats();
        return;
    }

    try {
        const q = query(collection(db, 'posts'), orderBy('timestamp','desc'));
        const snap = await getDocs(q);
        
        let myPostsAll = [], myLikesAll = [], mySavesAll = [];
        
        snap.forEach(d => {
            const p = d.data();
            const isMine = p.username === uname || p.adminUser === uname;
            const isLiked = p.likes?.includes(uname);
            const isSaved = p.savedBy?.includes(uname);
            const canReportPost = true;
            const decodedProfileContent = decodeEntities ? decodeEntities(p.content||"") : (p.content||"");
            const profileContentWithLinks = stripYoutubeLinks(decodedProfileContent).replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g,'<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
            const profileReadMoreBtn = decodedProfileContent.length > 280 ? `<button id="toggle-${d.id}" class="read-more-btn" onclick="togglePostContent('${d.id}')"><i class="fa-solid fa-chevron-down"></i> Daha fazlasını gör</button>` : '';
            const profileTextClass = decodedProfileContent.length > 280 ? ' post-text-clamp' : '';
            
            const postHtml = `
                <div class="glass-card post" style="position: relative;">
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <img src="${getAvatarUrl(p.avatarUrl||p.avatarSeed||'assets/img/strendsaydamv2.png','user')}" class="user-avatar" style="cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
                        <div>
                            <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
                                ${p.name}
                                <span class="post-time">• ${formatPostTimestamp(p.timestamp)}</span>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">@${p.username}</div>
                        </div>
                    </div>
                            <p id="post-preview-${d.id}" class="post-text${profileTextClass}" style="white-space: pre-wrap; margin-bottom:10px;">${profileContentWithLinks}</p>
                            ${profileReadMoreBtn}
                    ${p.image ? `
                    <div class="post-image-wrapper" style="
                        margin: 12px auto;
                        border-radius: 12px;
                        overflow: hidden;
                        background: rgb(0, 0, 0);
                        border: 1px solid var(--border);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: 0.3s ease-in-out;
                        max-height: 103%;
                        max-width: 50%;
                        height: auto;
                        width: 100%;
                    ">
                        <img src="${p.image}"
                             loading="lazy"
                             style="
                                width: 100%; 
                                height: 100%; 
                                object-fit: cover; 
                                cursor: zoom-in;
                                transition: all 0.3s ease;
                             " 
                             onclick="toggleImageExpand(this)"
                             alt="Post görseli">
                    </div>
                    ` : ''}
                    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                        <button class="tool-btn icon-count" onclick="likePost('${d.id}', ${isLiked}, this)" style="gap:3px; color:${isLiked?'#ef4444':''}"><i class="${isLiked?'fa-solid':'fa-regular'} fa-heart"></i><span>(${p.likes?.length||0})</span></button>
                        <button class="tool-btn icon-count" style="gap:3px;"><i class="fa-regular fa-comment"></i><span>(${p.comments?.length||0})</span></button>
                        <button class="tool-btn icon-count" onclick="toggleBookmark('${d.id}', ${isSaved})" style="gap:3px; color:${isSaved ? '#f59e0b' : ''}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i><span>(${p.savedBy?.length||0})</span></button>
                        <button class="tool-btn" onclick="window.reportPost('${d.id}', '${(p.username || '').replace(/'/g, "\\'")}')" title="Gönderiyi bildir" style="gap:5px; margin-left:auto; color:#f59e0b;"><i class="fa-regular fa-flag"></i></button>
                        <button class="tool-btn" onclick="window.openShareMenu('${d.id}')" style="gap:5px;"><i class="fa-solid fa-share"></i></button>
                    </div>
                </div>
            `;
            
            if (isMine) myPostsAll.push(postHtml);
            if (isLiked) myLikesAll.push(postHtml);
            if (isSaved) mySavesAll.push(postHtml);
        });

        // GÖNDERİLER
        if ((section === 'all' || section === 'posts') && myPostsList && myPostsAll.length > 0) {
            let postsToShow = showAllPosts ? myPostsAll.length : 5;
            let postsHtml = myPostsAll.slice(0, postsToShow).join('');
            myPostsList.innerHTML = postsHtml;
            
            if (myPostsAll.length > 5 && !showAllPosts) {
                const btn = document.createElement('div');
                btn.style.cssText = `text-align: center; padding: 20px; margin-top: 15px;`;
                btn.innerHTML = `
                    <button onclick="window.loadProfileSections('posts', true)" style="
                        background: linear-gradient(135deg, var(--primary), #8b5cf6);
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 50px;
                        font-weight: 700;
                        cursor: pointer;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fa-solid fa-chevron-down"></i> Daha fazla yükle
                    </button>
                `;
                myPostsList.appendChild(btn);
            }
        }

        // BEĞENİLER
        if ((section === 'all' || section === 'likes') && myLikesList && myLikesAll.length > 0) {
            // add clear button at top
            const clearLikesDiv = document.createElement('div');
            clearLikesDiv.style.textAlign = 'right';
            clearLikesDiv.style.marginBottom = '8px';
            clearLikesDiv.innerHTML = `<button onclick="clearAllLikes()" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;">Beğenilerin Hepsini Kaldır</button>`;
            myLikesList.appendChild(clearLikesDiv);

            let likesToShow = showAllLikes ? myLikesAll.length : 5;
            let likesHtml = myLikesAll.slice(0, likesToShow).join('');
            myLikesList.innerHTML += likesHtml;
            
            if (myLikesAll.length > 5 && !showAllLikes) {
                const btn = document.createElement('div');
                btn.style.cssText = `text-align: center; padding: 20px; margin-top: 15px;`;
                btn.innerHTML = `
                    <button onclick="window.loadProfileSections('likes', false, true)" style="
                        background: linear-gradient(135deg, var(--primary), #8b5cf6);
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 50px;
                        font-weight: 700;
                        cursor: pointer;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fa-solid fa-chevron-down"></i> Daha fazla yükle
                    </button>
                `;
                myLikesList.appendChild(btn);
            }
        }

        // KAYITLAR
        if ((section === 'all' || section === 'saves') && bookmarkList && mySavesAll.length > 0) {
            // add clear button for saves
            const clearSavesDiv = document.createElement('div');
            clearSavesDiv.style.textAlign = 'right';
            clearSavesDiv.style.marginBottom = '8px';
            clearSavesDiv.innerHTML = `<button onclick="clearAllSaves()" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;">Kayıtların Hepsini Kaldır</button>`;
            bookmarkList.appendChild(clearSavesDiv);

            let savesToShow = showAllSaves ? mySavesAll.length : 5;
            let savesHtml = mySavesAll.slice(0, savesToShow).join('');
            bookmarkList.innerHTML += savesHtml;
            
            if (mySavesAll.length > 5 && !showAllSaves) {
                const btn = document.createElement('div');
                btn.style.cssText = `text-align: center; padding: 20px; margin-top: 15px;`;
                btn.innerHTML = `
                    <button onclick="window.loadProfileSections('saves', false, false, true)" style="
                        background: linear-gradient(135deg, var(--primary), #8b5cf6);
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 50px;
                        font-weight: 700;
                        cursor: pointer;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fa-solid fa-chevron-down"></i> Daha fazla yükle
                    </button>
                `;
                bookmarkList.appendChild(btn);
            }
        }

        // show/hide empty messages
        const noPostsMsg = document.getElementById('no-posts-msg');
        if (noPostsMsg && (section === 'all' || section === 'posts')) {
            noPostsMsg.style.display = (myPostsAll.length === 0) ? 'block' : 'none';
        }
        const noLikesMsg = document.getElementById('no-likes-msg');
        if (noLikesMsg && (section === 'all' || section === 'likes')) {
            noLikesMsg.style.display = (myLikesAll.length === 0) ? 'block' : 'none';
        }
        const noSavesMsg = document.getElementById('no-saves-msg');
        if (noSavesMsg && (section === 'all' || section === 'saves')) {
            noSavesMsg.style.display = (mySavesAll.length === 0) ? 'block' : 'none';
        }
        
    } catch(e) {
        console.error('loadProfileSections error', e);
    }
};

// remove all likes usually used by clear button
window.clearAllLikes = async function() {
    if (!user || !user.username) return;
    const uname = user.username;
    try {
        const q = query(collection(db, 'posts'), where('likes', 'array-contains', uname));
        const snap = await getDocs(q);
        snap.forEach(async d => {
            await updateDoc(doc(db, 'posts', d.id), { likes: arrayRemove(uname) });
        });
        alert('Beğeniler kaldırıldı');
        window.loadProfileSections('all');
    } catch(e) {
        console.error('clearAllLikes error', e);
    }
};

// remove all saved posts
window.clearAllSaves = async function() {
    if (!user || !user.username) return;
    const uname = user.username;
    try {
        const q = query(collection(db, 'posts'), where('savedBy', 'array-contains', uname));
        const snap = await getDocs(q);
        snap.forEach(async d => {
            await updateDoc(doc(db, 'posts', d.id), { savedBy: arrayRemove(uname) });
        });
        alert('Kayıtlar kaldırıldı');
        window.loadProfileSections('all');
    } catch(e) {
        console.error('clearAllSaves error', e);
    }
};

// PROFİL YÖNLENDİRME
window.navigateTo = function (page, userId = null) {
    if (!page) return;

    const prefix = getPathPrefix();
    page = page.toLowerCase();

    if (page === 'profil' || page === 'profile') {
        const hash = userId && userId.startsWith('#') ? userId : '';
        const query = userId && !userId.startsWith('#') ? `?id=${encodeURIComponent(userId)}` : '';
        location.href = `${prefix}profil.html${query}${hash}`;
        return;
    }

    if (page === 'feed' || page === 'home' || page === 'index') {
        location.href = `${prefix}index.html`;
        return;
    }

    location.href = `${prefix}${page}.html`;
};

window.navigateToProfileHash = function(hash = '') {
    const prefix = getPathPrefix();
    if (!hash) {
        location.href = `${prefix}profil.html`;
    } else {
        location.href = `${prefix}profil.html#${hash}`;
    }
};

window.toggleMobileNavWidget = function(forceState = null, defaultMode = 'chooser') {
    const widget = document.getElementById('mobileComposeWidget');
    if (!widget) return;
    const isOpen = widget.classList.contains('active');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
    widget.classList.toggle('active', shouldOpen);
    if (shouldOpen) {
        openMobileComposeForm(defaultMode, true);
    }
};

window.openPostComposer = function() {
    const prefix = getPathPrefix();
    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath.endsWith('/index.html') || currentPath.endsWith('/')) {
        const postInput = document.getElementById('postInput');
        if (postInput) {
            postInput.focus();
            const offset = Math.max(window.scrollY + postInput.getBoundingClientRect().top - 96, 0);
            window.scrollTo({ top: offset, behavior: 'smooth' });
            return;
        }
    }
    location.href = `${prefix}index.html`;
};

window.toggleMobileSearchWidget = function(forceState = null) {
    const widget = document.getElementById('mobileSearchWidget');
    if (!widget) return;
    const isOpen = widget.classList.contains('active');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
    widget.classList.toggle('active', shouldOpen);
    if (shouldOpen) {
        const input = document.getElementById('mobileSearchInput');
        if (input) {
            input.value = '';
            if (!input.dataset.mobileSearchListener) {
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        window.runMobileSearch();
                    }
                });
                input.dataset.mobileSearchListener = '1';
            }
            setTimeout(() => input.focus(), 50);
        }
    }
};

window.runMobileSearch = function() {
    const input = document.getElementById('mobileSearchInput');
    if (!input) return;
    const query = (input.value || '').trim();
    if (!query) return;
    if (window.location.pathname.includes('search.html')) {
        performGlobalSearch(query);
        return;
    }
    window.location.href = `search.html?q=${encodeURIComponent(query)}`;
};

window.openBlogComposer = function() {
    toggleMobileNavWidget(true, 'blog');
};

window.openMobileComposeForm = function(mode, skipToggle = false) {
    const widget = document.getElementById('mobileComposeWidget');
    const chooser = document.getElementById('mobileComposeChooser');
    const content = document.getElementById('mobileComposeContent');
    const postView = document.getElementById('mobileComposePostView');
    const blogView = document.getElementById('mobileComposeBlogView');
    if (!widget || !chooser || !content || !postView || !blogView) return;

    const isWidgetOpen = widget.classList.contains('active');
    if (!skipToggle && !isWidgetOpen) {
        toggleMobileNavWidget(true, mode === 'post' ? 'post' : mode === 'blog' ? 'blog' : 'chooser');
        return;
    }

    if (mode === 'post') {
        chooser.style.display = 'none';
        content.style.display = 'grid';
        postView.style.display = 'block';
        blogView.style.display = 'none';
    } else if (mode === 'blog') {
        chooser.style.display = 'none';
        content.style.display = 'grid';
        postView.style.display = 'none';
        blogView.style.display = 'block';
    } else {
        chooser.style.display = 'grid';
        content.style.display = 'none';
        postView.style.display = 'none';
        blogView.style.display = 'none';
    }
};

window.setMobileComposeMode = function(mode) {
    openMobileComposeForm(mode, true);
};

window.publishMobilePost = async function() {
    const postInput = document.getElementById('mobilePostInput');
    const statusEl = document.getElementById('mobilePostStatus');
    if (!postInput || !statusEl) return;
    const text = (postInput.value || '').trim();
    if (!text) {
        statusEl.textContent = 'Lütfen bir şey yazın.';
        statusEl.style.color = '#ef4444';
        return;
    }
    if (!window.auth?.currentUser || !window.user) {
        statusEl.textContent = 'Önce giriş yapın.';
        statusEl.style.color = '#ef4444';
        return;
    }
    statusEl.textContent = 'Gönderiliyor...';
    statusEl.style.color = 'var(--text-muted)';
    try {
        const createdPostRef = await addDoc(collection(db, 'posts'), {
            authorUid: auth.currentUser.uid,
            name: user.displayName,
            username: user.username,
            avatarUrl: user.avatarUrl || user.photoURL || 'assets/img/strendsaydamv2.png',
            content: normalizePostText(text),
            image: null,
            timestamp: serverTimestamp(),
            likes: [],
            savedBy: [],
            comments: []
        });
        await queueContentModerationIfNeeded({
            contentType: 'post',
            contentId: createdPostRef.id,
            contentText: normalizePostText(text),
            authorUid: auth.currentUser.uid,
            authorUsername: user.username,
            authorDisplayName: user.displayName || user.name
        });
        postInput.value = '';
        statusEl.textContent = 'Gönderildi.';
        statusEl.style.color = '#10b981';
        setTimeout(() => {
            statusEl.textContent = '';
            toggleMobileNavWidget(false);
            if (typeof loadPostsFeed === 'function') loadPostsFeed();
        }, 1200);
    } catch (e) {
        console.error('publishMobilePost hata:', e);
        statusEl.textContent = 'Gönderi gönderilemedi.';
        statusEl.style.color = '#ef4444';
    }
};

window.publishMobileBlogPost = async function() {
    const titleEl = document.getElementById('mobileBlogTitle');
    const contentEl = document.getElementById('mobileBlogContent');
    const categoryEl = document.getElementById('mobileBlogCategory');
    const statusEl = document.getElementById('mobileBlogStatus');
    if (!titleEl || !contentEl || !categoryEl || !statusEl) return;
    const title = titleEl.value.trim();
    const content = contentEl.value.trim();
    const category = categoryEl.value || 'Genel';
    if (!title || !content) {
        statusEl.textContent = 'Başlık ve içerik gereklidir.';
        statusEl.style.color = '#ef4444';
        return;
    }
    if (!window.auth?.currentUser) {
        statusEl.textContent = 'Önce giriş yapın.';
        statusEl.style.color = '#ef4444';
        return;
    }
    statusEl.textContent = 'Yayınlanıyor...';
    statusEl.style.color = 'var(--text-muted)';
    try {
        const createdBlogRef = await addDoc(collection(db, 'blogs'), {
            title,
            content,
            category,
            authorUid: auth.currentUser.uid,
            authorUsername: (auth.currentUser.email || '').split('@')[0],
            authorEmail: auth.currentUser.email,
            authorAvatar: user.avatarUrl || 'assets/img/strendsaydamv2.png',
            status: 'published',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            views: 0,
            tebrikCount: 0
        });
        await queueContentModerationIfNeeded({
            contentType: 'blog',
            contentId: createdBlogRef.id,
            contentText: `${title}\n${content}`,
            authorUid: auth.currentUser.uid,
            authorUsername: (auth.currentUser.email || '').split('@')[0],
            authorDisplayName: user.displayName || user.name || (auth.currentUser.email || '').split('@')[0]
        });
        titleEl.value = '';
        contentEl.value = '';
        if (categoryEl) categoryEl.value = 'Genel';
        statusEl.textContent = 'Yayınlandı.';
        statusEl.style.color = '#10b981';
        setTimeout(() => {
            statusEl.textContent = '';
            toggleMobileNavWidget(false);
            window.location.href = getPathPrefix() + 'blog.html?mine=1';
        }, 1200);
    } catch (e) {
        console.error('publishMobileBlogPost hata:', e);
        statusEl.textContent = 'Blog yayınlanamadı.';
        statusEl.style.color = '#ef4444';
    }
};

window.setMobileComposeMode('post');

/* ============================   */

let currentEditType = null; 
let editTarget = {}; // { postId, commentTime, replyTime }

// Modalı Aç (Post, Comment ve Reply destekli)
window.openEditModal = function(postId, content, type = 'post', commentTime = null, replyTime = null) {
    currentEditType = type;
    editTarget = { postId, commentTime, replyTime };
    
    const modal = document.getElementById('editModal');
    const input = document.getElementById('editPostInput');
    const title = modal.querySelector('h3');

    if (modal && input) {
        // Başlığı tipe göre dinamik yapıyoruz
        if(type === 'post') title.innerText = "Gönderiyi Düzenle";
        else if(type === 'comment') title.innerText = "Yorumu Düzenle";
        else if(type === 'reply') title.innerText = "Yanıtı Düzenle";
        
        input.innerText = (typeof decodeEntities === 'function' && content) ? decodeEntities(content) : (content || '');
        modal.style.display = 'flex';
    }
};

window.closeEditModal = function() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
    currentEditType = null;
    editTarget = {};
};

// Ortak Kaydetme İşlemi
const saveEditBtn = document.getElementById('saveEditBtn');
if (saveEditBtn) {
    saveEditBtn.onclick = async () => {
        let newContent = document.getElementById('editPostInput').innerText.trim();
        if (newContent.length > 500) newContent = newContent.substring(0, 500);
        if (!newContent || !editTarget.postId) return;

    try {
        const postRef = doc(db, "posts", editTarget.postId);

        if (currentEditType === 'post') {
            // 1. GÖNDERİ GÜNCELLEME
            await updateDoc(postRef, {
                content: newContent,
                isEdited: true
            });
        } 
        else {
            // Yorum veya Yanıt güncellemek için önce belgeyi çekiyoruz
            const postSnap = await getDoc(postRef);
            if (postSnap.exists()) {
                const comments = postSnap.data().comments || [];
                
                const updatedComments = comments.map(c => {
                    // 2. YORUM GÜNCELLEME
                    if (currentEditType === 'comment' && c.time === editTarget.commentTime) {
                        return { ...c, text: newContent, isEdited: true };
                    }
                    
                    // 3. YANIT GÜNCELLEME (Yorumun içindeki yanıtlar dizisi)
                    if (currentEditType === 'reply' && c.time === editTarget.commentTime) {
                        const updatedReplies = (c.replies || []).map(r => 
                            r.time === editTarget.replyTime ? { ...r, text: newContent, isEdited: true } : r
                        );
                        return { ...c, replies: updatedReplies };
                    }
                    
                    return c;
                });

                await updateDoc(postRef, { comments: updatedComments });
            }
        }
        window.closeEditModal();
    } catch (error) {
        console.error("Güncelleme hatası:", error);
        alert("İşlem başarısız oldu.");
    }
  };
}

// Karşılama mesajı için global fonksiyon (app.js'den çağrılacak)
window.updateWelcomeMessage = (username) => {
    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) {
      const name = username ? username : "misafir";
      welcomeEl.innerText = `${name.toLowerCase()}`;
    }
  };
/* ============================ */

/* Header üst bar bilgi ekranı*/
function updateClock() {
    const now = new Date();

    // Tarih Ayarları (Örn: 31 Ocak 2026 Cumartesi)
    const dateOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    };

    // Saat Ayarları (Örn: 10:32:05)
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };

    const dateStr = now.toLocaleDateString('tr-TR', dateOptions);
    const timeStr = now.toLocaleTimeString('tr-TR', timeOptions);
    const timeElement = document.getElementById('topBarDateTime');
    if(timeElement) {
        // Tarih ve Saati farklı opasitelerle ayırarak daha okunaklı kıldık
        timeElement.innerHTML = `
            <span style="opacity: 0.7;">
                <i class="fa-regular fa-calendar-check"></i> ${dateStr}
            </span>
            <span style="margin: 0 8px; opacity: 0.3;">|</span>
            <span style="color: #fff; font-weight: 700;">
                <i class="fa-regular fa-clock"></i> ${timeStr}
            </span>
        `;
    }
  }

  // Her saniye güncelleme başlat
  setInterval(updateClock, 1000);
  updateClock();
/* ============================ */

// --- DARK MODE -- //
window.toggleDarkMode = () => {
    const btn = document.getElementById('themeToggleBtn');
    const mobileBtn = document.getElementById('themeToggleBtnMobile');
    const isDark = document.body.classList.toggle('dark-mode');

    const iconHtml = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    if (btn) btn.innerHTML = iconHtml;
    if (mobileBtn) mobileBtn.innerHTML = iconHtml + '<span>Tema</span>';

    localStorage.setItem('st_theme', isDark ? 'dark' : 'light');
};

function syncThemeButtonState() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const mobileBtn = document.getElementById('themeToggleBtnMobile');
    const isDark = document.body.classList.contains('dark-mode');
    const iconHtml = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    if (themeBtn) themeBtn.innerHTML = iconHtml;
    if (mobileBtn) mobileBtn.innerHTML = iconHtml + '<span>Tema</span>';
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('st_theme') === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    syncThemeButtonState();
    // Ensure mobile footer 'Tema' button (if present) is replaced with Chat button
    try {
        const mobileNav = document.getElementById('mobileBottomNav');
        if (mobileNav) {
            const themeBtn = mobileNav.querySelector('#themeToggleBtnMobile');
            if (themeBtn) {
                themeBtn.id = 'mobileChatBtn';
                themeBtn.classList.add('mobile-nav-item');
                themeBtn.onclick = () => { if (typeof openChatsList === 'function') openChatsList(); };
                themeBtn.setAttribute('aria-label', 'Sohbet');
                themeBtn.innerHTML = '<i class="fa-solid fa-comments"></i><span>Sohbet</span>';
            }
        }
    } catch (e) {
        console.warn('Failed to normalize mobile footer chat button', e);
    }

    // Floating theme button (right-middle) for mobile: wire events
    try {
        const floatBtn = document.getElementById('floatingThemeBtn');
        const floatMenu = document.getElementById('floatingThemeMenu');
        if (floatBtn && floatMenu) {
            // show button only on small screens
            const onResize = () => {
                if (window.innerWidth <= 768) {
                    floatBtn.style.display = 'inline-flex';
                } else {
                    floatBtn.style.display = 'none';
                    floatMenu.style.display = 'none';
                }
            };
            onResize();
            window.addEventListener('resize', onResize);

            floatBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                floatMenu.style.display = (floatMenu.style.display === 'flex') ? 'none' : 'flex';
            });

            floatMenu.querySelectorAll('button').forEach(b => {
                b.addEventListener('click', (ev) => {
                    const mode = b.dataset.theme;
                    if (!mode && b.id === 'themeToggleBtnMobile') {
                        if (typeof toggleDarkMode === 'function') toggleDarkMode();
                    } else if (mode === 'dark') {
                        document.body.classList.add('dark-mode');
                        localStorage.setItem('st_theme', 'dark');
                    } else if (mode === 'light') {
                        document.body.classList.remove('dark-mode');
                        localStorage.setItem('st_theme', 'light');
                    } else {
                        // auto
                        localStorage.removeItem('st_theme');
                        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
                    }
                    syncThemeButtonState();
                    floatMenu.style.display = 'none';
                });
            });

            // close menu on outside click
            document.addEventListener('click', (ev) => {
                if (!floatMenu.contains(ev.target) && !floatBtn.contains(ev.target)) {
                    floatMenu.style.display = 'none';
                }
            });
        }
    } catch (e) {
        console.warn('floating theme init failed', e);
    }
});
/* ============================ */

/* EMOJİ KODU */
// Emoji picker panelini basitleştirip daha güvenilir hale getiriyoruz.
// Panel, düğmenin altına sabitlenir ve içerik temizlenmiş şekilde yeniden çizilir.
document.addEventListener('DOMContentLoaded', () => {
    const emojiToggle = document.getElementById('emojiToggle');
    const emojiPickerPanel = document.getElementById('emojiPickerPanel');
    const postInput = document.getElementById('postInput');

    if (!emojiToggle || !emojiPickerPanel || !postInput) return;

    const emojis = [
        { symbol: '😊', keywords: ['gülen', 'smile', 'happy', 'mutlu'] },
        { symbol: '😂', keywords: ['gülmek', 'laugh', 'lol', 'komik'] },
        { symbol: '😢', keywords: ['ağlamak', 'cry', 'sad', 'üzgün'] },
        { symbol: '❤️', keywords: ['aşk', 'love', 'heart', 'kalp'] },
        { symbol: '👍', keywords: ['beğen', 'like', 'good', 'tamam'] },
        { symbol: '🔥', keywords: ['alev', 'fire', 'hot', 'harika'] },
        { symbol: '🚀', keywords: ['roket', 'rocket', 'hızlı', 'başarı'] },
        { symbol: '🎉', keywords: ['kutlama', 'party', 'celebrate', 'tebrik'] },
        { symbol: '🙏', keywords: ['dua', 'pray', 'thanks', 'teşekkür'] },
        { symbol: '✨', keywords: ['parıltı', 'sparkle', 'shine', 'ışıltı'] },
        { symbol: '😎', keywords: ['cool', 'sunglasses', 'havalı', 'karizma'] },
        { symbol: '💯', keywords: ['tam', 'perfect', '100', 'mükemmel'] },
        { symbol: '🙌', keywords: ['alkış', 'celebrate', 'tebrik', 'bağırma'] },
        { symbol: '😇', keywords: ['melek', 'angel', 'masum', 'iyi'] },
        { symbol: '🍕', keywords: ['pizza', 'yemek', 'food', 'lezzet'] },
        { symbol: '🥳', keywords: ['parti', 'party', 'kutlama', 'birthday'] },
        { symbol: '🥰', keywords: ['aşık', 'love', 'romantik', 'kalp'] },
        { symbol: '😅', keywords: ['gülmek', 'sweat', 'komik', 'utanç'] },
        { symbol: '🤩', keywords: ['hayran', 'starstruck', 'wow', 'şok'] },
        { symbol: '🫶', keywords: ['kalp', 'hands', 'love', 'sevgili'] },
        { symbol: '🥺', keywords: ['rica', 'please', 'cute', 'yakarmak'] },
        { symbol: '🌟', keywords: ['yıldız', 'star', 'parlak', 'başarı'] },
        { symbol: '🍔', keywords: ['burger', 'yemek', 'food', 'fast food'] },
        { symbol: '🍦', keywords: ['dondurma', 'ice cream', 'tatlı', 'şeker'] },
        { symbol: '🎶', keywords: ['müzik', 'music', 'şarkı', 'melodi'] },
        { symbol: '⚡', keywords: ['yıldırım', 'bolt', 'energy', 'güç'] },
        { symbol: '🧠', keywords: ['zihin', 'brain', 'akıl', 'beyin'] },
        { symbol: '💡', keywords: ['fikir', 'idea', 'akıl', 'ışık'] },
        { symbol: '🛠️', keywords: ['tool', 'araç', 'tamir', 'setup'] },
        { symbol: '📸', keywords: ['fotoğraf', 'camera', 'kamera', 'foto'] }
    ];

    const createPicker = () => {
        emojiPickerPanel.innerHTML = `
            <div class="emoji-picker-header">
                <div class="emoji-picker-title">Emoji seç</div>
                <button type="button" class="emoji-picker-close" aria-label="Kapat">×</button>
            </div>
            <input type="search" class="emoji-search" placeholder="Emoji ara..." autocomplete="off" />
            <div class="emoji-picker-grid"></div>
            <div class="emoji-picker-empty" style="display:none;">Eşleşen emoji bulunamadı.</div>
        `;

        const grid = emojiPickerPanel.querySelector('.emoji-picker-grid');
        const search = emojiPickerPanel.querySelector('.emoji-search');
        const closeBtn = emojiPickerPanel.querySelector('.emoji-picker-close');
        const emptyMessage = emojiPickerPanel.querySelector('.emoji-picker-empty');

        if (emojiPickerPanel.parentNode !== document.body) {
            document.body.appendChild(emojiPickerPanel);
        }

        const render = list => {
            grid.innerHTML = '';
            if (!list.length) {
                emptyMessage.style.display = 'block';
                return;
            }
            emptyMessage.style.display = 'none';
            list.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'emoji-picker-item';
                btn.textContent = item.symbol;
                btn.title = item.keywords.join(', ');
                grid.appendChild(btn);
            });
        };

        const filterEmojis = () => {
            const query = search.value.trim().toLowerCase();
            if (!query) return emojis;
            return emojis.filter(item => {
                if (item.symbol.includes(query)) return true;
                return item.keywords.some(keyword => keyword.toLowerCase().includes(query));
            });
        };

        render(emojis);

        const closePanel = () => {
            emojiPickerPanel.classList.remove('open');
            emojiPickerPanel.style.display = 'none';
            emojiPickerPanel.style.opacity = '0';
            emojiPickerPanel.style.visibility = 'hidden';
        };

        const openPanel = () => {
            emojiPickerPanel.style.position = 'fixed';
            emojiPickerPanel.style.display = 'grid';
            emojiPickerPanel.style.opacity = '1';
            emojiPickerPanel.style.visibility = 'visible';
            emojiPickerPanel.style.zIndex = '9999';
            emojiPickerPanel.classList.add('open');
            requestAnimationFrame(positionPicker);
        };

        const positionPicker = () => {
            const rect = emojiToggle.getBoundingClientRect();
            const pickerRect = emojiPickerPanel.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let left = rect.left;
            if (left + pickerRect.width + 12 > viewportWidth) {
                left = Math.max(viewportWidth - pickerRect.width - 12, 12);
            }

            let top = rect.bottom + 10;
            if (top + pickerRect.height + 12 > viewportHeight) {
                top = rect.top - pickerRect.height - 10;
                if (top < 12) top = 12;
            }

            emojiPickerPanel.style.left = `${left}px`;
            emojiPickerPanel.style.top = `${top}px`;
        };

        emojiToggle.addEventListener('click', event => {
            event.stopPropagation();
            if (emojiPickerPanel.classList.contains('open')) {
                closePanel();
            } else {
                openPanel();
            }
        });

        closeBtn.addEventListener('click', () => {
            closePanel();
        });

        search.addEventListener('input', () => render(filterEmojis()));

        grid.addEventListener('click', event => {
            const item = event.target.closest('.emoji-picker-item');
            if (!item) return;
            insertAtCaret(item.textContent || '');
            closePanel();
            postInput.focus();
            if (typeof updatePostCount === 'function') updatePostCount();
        });

        document.addEventListener('click', event => {
            if (!emojiPickerPanel.contains(event.target) && event.target !== emojiToggle) {
                closePanel();
            }
        });

        window.addEventListener('resize', () => {
            if (emojiPickerPanel.classList.contains('open')) {
                positionPicker();
            }
        });
    };

    const insertAtCaret = text => {
        postInput.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            postInput.innerText += text;
            return;
        }
        let range = selection.getRangeAt(0);
        if (!postInput.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(postInput);
            range.collapse(false);
        }
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    };

    createPicker();
    initComposerPollControls();
    });
/* ============================ */

async function kontrolEtVeOtomatikPostAt() {
    const simdi = new Date();
    const bugunGun = simdi.getDate();
    const bugunAy = simdi.getMonth();
    
    // Yarını kontrol et (Mübarek günler için 1 gün önceden)
    const yarin = new Date(simdi);
    yarin.setDate(simdi.getDate() + 1);
    const yarinGun = yarin.getDate();
    const yarinAy = yarin.getMonth();

    const sonKontrol = localStorage.getItem('last_auto_post_check');
    const bugunStr = simdi.toDateString();

    // Günde sadece 1 kez kontrol etmesini sağlayalım
    if (sonKontrol === bugunStr) return;

    // 1. Mübarek Gün Kontrolü (1 Gün Önceden)
    ozelGunler.forEach(async (gun) => {
        if (gun.gun === yarinGun && gun.ay === yarinAy) {
            await otomatikPostPaylas(`📢 HATIRLATMA: ${gun.baslik}`, gun.mesaj);
        }
    });

    // 2. Tarihte Bugün Kontrolü (O gün içinde)
    tarihteBugun.forEach(async (olay) => {
        if (olay.gun === bugunGun && olay.ay === bugunAy) {
            await otomatikPostPaylas(`⏳ Tarihte Bugün: ${olay.baslik}`, olay.mesaj);
        }
    });

    localStorage.setItem('last_auto_post_check', bugunStr);
}

// Firebase'e gönderi gönderen yardımcı fonksiyon
async function otomatikPostPaylas(baslik, icerik) {
    try {
        await addDoc(collection(db, "posts"), {
            author: "official_system",
            authorEmail: "officialfthuzun@gmail.com",
            authorImage: "assets/img/strendsaydamv2.ico", // Bot ikonu
            content: `${baslik}\n\n${icerik}`,
            timestamp: serverTimestamp(),
            likes: [],
            comments: []
        });
        // Auto post shared
    } catch (e) {
        console.error("Post paylaşılırken hata oluştu: ", e);
    }
}

/* RESİM BOYUTLANDIRMA */
window.toggleImageExpand = (img) => {
    const wrapper = img.parentElement;
    
    if (img.style.objectFit !== 'contain') {
        // TAM BOY MODU
        img.style.objectFit = 'contain';
        img.style.cursor = 'zoom-out';
        
        wrapper.style.height = 'auto';
        wrapper.style.maxHeight = '80vh'; // Ekran boyunu aşmasın
        wrapper.style.width = '100%';
        wrapper.style.maxWidth = '100%';    // Genişliği serbest bırak
        wrapper.style.backgroundColor = '#000';
        wrapper.style.margin = '12px auto'; // Dıştan ortala
    } else {
        // KARE (NORMAL) MOD
        img.style.objectFit = 'cover';
        img.style.cursor = 'zoom-in';
        
        wrapper.style.height = '399px';      // Senin istediğin yükseklik
        wrapper.style.width = '225px';       // Senin istediğin genişlik
        wrapper.style.maxWidth = '225px';
        wrapper.style.backgroundColor = '#0f172a';
        wrapper.style.margin = '12px auto';  // Akış içinde ortalı kalsın
    }
};


/**
 * SosyalTrend - Dinamik Bileşen Yükleyici ve Menü Yönetimi
 */

// 1. Bileşenleri (Header/Footer) Yükleyen Fonksiyon
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Dosya bulunamadı: ${filePath}`);
        
        const buffer = await response.arrayBuffer();
        let html = new TextDecoder('utf-8').decode(buffer);
        if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);
        const element = document.getElementById(elementId);
        
        if (element) {
            element.innerHTML = html;
            console.log(`loadComponent: loaded ${filePath} into #${elementId}`);

            if (typeof updateContent === 'function') updateContent();
            if (elementId === 'header-placeholder') {
                initHeaderInteractions();
                if (auth.currentUser) {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    getDoc(userRef).then(userSnap => {
                        if (userSnap.exists()) {
                            loadNotifications(userSnap.data());
                        }
                    }).catch((err) => {
                        console.warn('Header bildirimlerini yenileme hatası:', err);
                    });
                }
            }
        }
    } catch (error) {
        console.error("Bileşen yükleme hatası:", filePath, error);
    }
}

let headerInteractionsInitialized = false;

function closeProfileDropdown() {
    const wrapper = document.querySelector('.dropdown-menu-wrapper');
    const menu = document.getElementById('dropdownMenu');
    if (wrapper) {
        wrapper.classList.remove('active');
        wrapper.style.display = 'none';
    }
    if (menu) {
        menu.classList.remove('active');
        menu.style.display = 'none';
        menu.setAttribute('aria-hidden', 'true');
    }
}

function positionProfileDropdown(triggerEl) {
    const menu = document.getElementById('dropdownMenu');
    if (!menu || !triggerEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 8;
    const sidePadding = 12;

    const menuWidth = Math.min(420, Math.max(280, viewportWidth - 32));
    let left = triggerRect.right - menuWidth;
    left = Math.max(sidePadding, Math.min(left, viewportWidth - menuWidth - sidePadding));

    const maxHeight = Math.floor(viewportHeight * 0.66);
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.width = `${menuWidth}px`;

    let top = triggerRect.bottom + gap;
    const estimatedHeight = Math.min(maxHeight, menu.scrollHeight || maxHeight);
    if (top + estimatedHeight > viewportHeight - sidePadding) {
        top = Math.max(sidePadding, triggerRect.top - estimatedHeight - gap);
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function toggleProfileDropdown(triggerEl) {
    const wrapper = document.querySelector('.dropdown-menu-wrapper');
    const menu = document.getElementById('dropdownMenu');
    if (!wrapper || !menu) {
        setTimeout(() => toggleProfileDropdown(triggerEl), 100);
        return;
    }

    const shouldOpen = !menu.classList.contains('active');
    if (!shouldOpen) {
        closeProfileDropdown();
        return;
    }

    wrapper.style.display = 'block';
    wrapper.classList.add('active');
    menu.style.display = 'flex';
    menu.classList.add('active');
    menu.setAttribute('aria-hidden', 'false');
    positionProfileDropdown(triggerEl || document.getElementById('profileTrigger'));
}

window.toggleProfileDropdown = toggleProfileDropdown;
window.closeProfileDropdown = closeProfileDropdown;

function initHeaderInteractions() {
    const hasHeaderSearch = document.getElementById('headerSearchButton') && document.getElementById('headerSearchInput') && document.getElementById('headerSearchWrapper');
    if (headerInteractionsInitialized && hasHeaderSearch) return;
    headerInteractionsInitialized = true;

    const profileTriggers = document.querySelectorAll('#profileTrigger, #mobileProfileTrigger');
    profileTriggers.forEach((triggerEl) => {
        triggerEl.onclick = (e) => {
            e.stopPropagation();
            toggleProfileDropdown(triggerEl);
        };
    });

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.onclick = (e) => {
            e.preventDefault();
            window.toggleDarkMode?.();
        };
    }

    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.onclick = (e) => {
            e.preventDefault();
            window.toggleNotifications?.();
        };
    }

    const headerSearchBtn = document.getElementById('headerSearchButton');
    const headerSearchBox = document.getElementById('headerSearchBox');
    const headerSearchInput = document.getElementById('headerSearchInput');
    const headerSearchSubmit = document.getElementById('headerSearchSubmit');
    const headerSearchWrapper = document.getElementById('headerSearchWrapper');

    const openHeaderSearch = (open) => {
        if (!headerSearchBtn || !headerSearchBox) return;
        headerSearchBox.style.display = open ? 'flex' : 'none';
        headerSearchBtn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-magnifying-glass"></i>';
        if (open && headerSearchInput) headerSearchInput.focus();
    };

    const runHeaderSearch = (queryValue = null) => {
        const searchQuery = (queryValue || headerSearchInput?.value || '').trim();
        if (!searchQuery) {
            window.location.href = 'search.html';
            return;
        }
        if (window.location.pathname.includes('search.html')) {
            performGlobalSearch(searchQuery);
            return;
        }
        window.location.href = `search.html?q=${encodeURIComponent(searchQuery)}`;
    };

    if (headerSearchBtn && headerSearchBox && headerSearchInput && headerSearchWrapper) {
        headerSearchBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            openHeaderSearch(headerSearchBox.style.display !== 'flex');
        });

        headerSearchBox.addEventListener('click', (event) => event.stopPropagation());

        headerSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                openHeaderSearch(false);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                runHeaderSearch();
            }
        });

        if (headerSearchSubmit) {
            headerSearchSubmit.addEventListener('click', (event) => {
                event.preventDefault();
                runHeaderSearch();
            });
        }

        document.addEventListener('click', (event) => {
            if (!headerSearchWrapper.contains(event.target) && headerSearchBox.style.display === 'flex') {
                if (!headerSearchInput.value.trim()) {
                    openHeaderSearch(false);
                }
            }
        });
    }

    document.body.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.id === 'headerSearchSubmit') {
            event.preventDefault();
            const headerSearchInput = document.getElementById('headerSearchInput');
            if (headerSearchInput) {
                const query = headerSearchInput.value.trim();
                runHeaderSearch(query);
            }
        }
    });
}

window.initHeaderInteractions = initHeaderInteractions;

window.toggleHeaderSearch = function(event) {
    event = event || window.event;
    if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
    }
    const headerSearchBtn = document.getElementById('headerSearchButton');
    const headerSearchBox = document.getElementById('headerSearchBox');
    const headerSearchInput = document.getElementById('headerSearchInput');
    if (!headerSearchBtn || !headerSearchBox || !headerSearchInput) return;

    const open = headerSearchBox.style.display !== 'flex';
    headerSearchBox.style.display = open ? 'flex' : 'none';
    headerSearchBtn.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-magnifying-glass"></i>';
    if (open) {
        headerSearchInput.focus();
    }
};

window.performInlineHeaderSearch = async (forcedQuery = null) => {
    const searchQuery = (forcedQuery || document.getElementById('headerSearchInput')?.value || '').trim();
    if (!searchQuery) {
        window.location.href = 'search.html';
        return;
    }
    if (window.location.pathname.includes('search.html')) {
        performGlobalSearch(searchQuery);
        return;
    }
    window.location.href = `search.html?q=${encodeURIComponent(searchQuery)}`;
};

// 2. Sayfa Yüklendiğinde Başlat
function getPathPrefix() {
    const normalizedPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    return normalizedPath.includes('/profil/') ? '../' : '';
}

function getRelativePartialPath(fileName) {
    return `${getPathPrefix()}${fileName}`;
}

function normalizeIncludedLinks() {
    const prefix = getPathPrefix();
    if (!prefix) return;

    document.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http') || href.startsWith('javascript:') || href.startsWith('../')) {
            return;
        }
        if (href.endsWith('.html') || href === 'index.html' || href === 'profil.html') {
            link.setAttribute('href', prefix + href);
        }
    });

    document.querySelectorAll('img[src]').forEach((img) => {
        const src = img.getAttribute('src');
        if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('../') || src.startsWith('/')) {
            return;
        }
        if (src.startsWith('assets/')) {
            img.setAttribute('src', prefix + src);
        }
    });
}

function initPlaceholders() {
    const header = document.getElementById("header-placeholder");
    const footer = document.getElementById("footer-placeholder");
    const headerPath = getRelativePartialPath('partials/header.html');
    const footerPath = getRelativePartialPath('partials/footer.html');

    if (header && header.innerHTML.trim() === "") {
        loadComponent("header-placeholder", headerPath);
    }
    if (footer && footer.innerHTML.trim() === "") {
        loadComponent("footer-placeholder", footerPath);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initPlaceholders);
} else {
    initPlaceholders();
}

document.addEventListener('includesLoaded', normalizeIncludedLinks);
if (window.includesLoaded) {
    normalizeIncludedLinks();
}

document.addEventListener('includesLoaded', () => {
    initHeaderInteractions();
    syncThemeButtonState();
});
if (window.includesLoaded) {
    initHeaderInteractions();
    syncThemeButtonState();
}

// Fallback: if header search controls appear later, retry init once after a short delay
setTimeout(() => {
    if (document.getElementById('headerSearchButton') && document.getElementById('headerSearchInput')) {
        initHeaderInteractions();
    }
}, 1000);

// Safety: if header/footer didn't render (some environments block fetch), retry once after 700ms
setTimeout(() => {
    const headerEl = document.getElementById('header-placeholder');
    const footerEl = document.getElementById('footer-placeholder');
    const headerPath = getRelativePartialPath('partials/header.html');
    const footerPath = getRelativePartialPath('partials/footer.html');

    if (headerEl && headerEl.innerHTML.trim() === '') {
        console.warn('header-placeholder empty after initial load — retrying');
        loadComponent('header-placeholder', headerPath);
    }
    if (footerEl && footerEl.innerHTML.trim() === '') {
        console.warn('footer-placeholder empty after initial load — retrying');
        loadComponent('footer-placeholder', footerPath);
    }
}, 700);

// 3. Mobil Yan Menü Yönetimi
window.toggleLeftSidebar = function() {
    const sidebar = document.querySelector('aside');
    const overlay = document.getElementById('sideOverlay');
    if (!sidebar) return;
    if (sidebar.classList.contains('active')) {
        return;
    }
    sidebar.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('side-open');
    updatePanelCloseButton();
}

window.toggleRightSidebar = function() {
    const rightPanel = document.querySelector('.right-panel');
    const overlay = document.getElementById('sideOverlay');
    if (!rightPanel) return;
    if (rightPanel.classList.contains('active')) {
        return;
    }
    rightPanel.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('side-open');
    updatePanelCloseButton();
}

function updatePanelCloseButton() {
    const closeBtn = document.getElementById('closePanelBtn');
    const sidebar = document.querySelector('aside');
    const rightPanel = document.querySelector('.right-panel');
    const leftActive = sidebar && sidebar.classList.contains('active');
    const rightActive = rightPanel && rightPanel.classList.contains('active');
    if (!closeBtn) return;
    closeBtn.classList.toggle('active', !!(leftActive || rightActive));
    // Close button should appear on opposite side of the open panel
    closeBtn.classList.toggle('left-active', !!rightActive);
    closeBtn.classList.toggle('right-active', !!leftActive);
}

window.closeSideMenus = function() {
    const sidebar = document.querySelector('aside');
    const rightPanel = document.querySelector('.right-panel');
    const overlay = document.getElementById('sideOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (rightPanel) rightPanel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('side-open');
    updatePanelCloseButton();
}

// 4. Global Tıklama Dinleyicisi (Event Delegation)
// Bu yöntem, elemanlar fetch ile sonradan gelse bile tıklamayı yakalar.
document.addEventListener('click', (e) => {
    const dropdownMenu = document.getElementById('dropdownMenu');
    const profileTrigger = e.target.closest('#profileTrigger, #mobileProfileTrigger');

    // Profil tetikleyiciye tıklandıysa, kendi olayını kullanalım; dışarı kapatma işlemi yapmayalım.
    if (profileTrigger) {
        e.stopPropagation();
        return;
    }

    // Menü açıkken dışarıya tıklandıysa kapat
    if (dropdownMenu && dropdownMenu.classList.contains('active')) {
        if (!dropdownMenu.contains(e.target)) {
            closeProfileDropdown();
        }
    }
    
    // Bildirim dropdown'u
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const friendsBtn = document.getElementById('friendsBtn');
    const friendsDropdown = document.getElementById('friendsDropdown');
    const headerChatBtn = document.getElementById('headerChatBtn');
    const mobileChatBtn = document.getElementById('mobileChatBtn');
    const chatListsPanel = document.getElementById('chat-lists-panel');
    const chatWidget = document.getElementById('chat-widget-container');
    
    if (notificationsBtn?.contains(e.target) || friendsBtn?.contains(e.target) || headerChatBtn?.contains(e.target) || mobileChatBtn?.contains(e.target)) {
        e.stopPropagation();
    } else {
        if (notificationsDropdown && notificationsDropdown.style.display !== 'none' && !notificationsDropdown.contains(e.target)) {
            notificationsDropdown.style.display = 'none';
        }
        if (friendsDropdown && friendsDropdown.style.display !== 'none' && !friendsDropdown.contains(e.target)) {
            friendsDropdown.style.display = 'none';
            const friendsBtn = document.getElementById('friendsBtn');
            if (friendsBtn) {
                friendsBtn.classList.remove('active');
                friendsBtn.setAttribute('aria-expanded', 'false');
            }
        }
        // Chat lists panel: close when clicking outside (like notification widget)
        if (chatListsPanel && chatListsPanel.classList.contains('active') && !chatListsPanel.contains(e.target)) {
            chatListsPanel.classList.remove('active');
            document.body.classList.remove('chat-open');
        }
        // Conversation widget: close when clicking outside
        if (chatWidget && chatWidget.classList.contains('active') && !chatWidget.contains(e.target)) {
            chatWidget.classList.remove('active');
            document.body.classList.remove('chat-open');
        }
    }
});

window.addEventListener('resize', () => {
    const menu = document.getElementById('dropdownMenu');
    const trigger = document.getElementById('profileTrigger') || document.getElementById('mobileProfileTrigger');
    if (menu?.classList.contains('active') && trigger) {
        positionProfileDropdown(trigger);
    }
});

window.addEventListener('scroll', () => {
    const menu = document.getElementById('dropdownMenu');
    const trigger = document.getElementById('profileTrigger') || document.getElementById('mobileProfileTrigger');
    if (menu?.classList.contains('active') && trigger) {
        positionProfileDropdown(trigger);
    }
}, true);

// ====== ARKADAŞ SİSTEMİ ======
// Arkadaş isteği gönder - DÜZELTİLDİ
async function sendFriendRequest() {
    // Send friend request
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    const params = new URLSearchParams(location.search);
    const targetUsername = params.get('id') || localStorage.getItem('visiting_username');
    
    // user nesnesinin (giriş yapan kişi) mevcut olduğunu kontrol edelim
    if (!targetUsername || (typeof user !== 'undefined' && targetUsername === user.username)) {
        alert('Kendine arkadaş isteği gönderemezsin');
        return;
    }

    try {
        // Hedef kullanıcıyı kullanıcı adına göre bul
        const targetQuery = await getDocs(query(collection(db, "users"), where("username", "==", targetUsername)));
        
        if (targetQuery.empty) {
            alert('Kullanıcı bulunamadı');
            return;
        }

        const targetUid = targetQuery.docs[0].id;
        const targetUserData = targetQuery.docs[0].data();
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        // KRİTİK DÜZELTME: serverTimestamp() arrayUnion içinde çalışmaz. Date.now() kullanıyoruz.
        const timestampNow = Date.now();

        // 404 hatasını önlemek için güvenli avatar yolları
        const myAvatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=random`;
        const targetAvatar = targetUserData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetUsername)}&background=random`;

        // 1. Karşı tarafın "friendRequests" dizisine eklenecek veri
        const friendRequestObj = {
            fromUid: auth.currentUser.uid,
            fromUsername: user.username || 'user',
            fromName: user.displayName || 'SosyalTrend Kullanıcısı',
            fromAvatar: myAvatar,
            timestamp: timestampNow,
            status: 'pending'
        };

        // Hedef kullanıcının friendRequests dizisine ekle
        await updateDoc(targetUserRef, {
            friendRequests: arrayUnion(friendRequestObj)
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(targetUserRef, { friendRequests: [friendRequestObj] }, { merge: true });
            }
        });

        // 2. Kendi "sentRequests" dizimize eklenecek veri
        const sentRequestObj = {
            toUid: targetUid,
            toUsername: targetUsername,
            toName: targetUserData.displayName || targetUsername,
            toAvatar: targetAvatar,
            timestamp: timestampNow
        };

        await updateDoc(currentUserRef, {
            sentRequests: arrayUnion(sentRequestObj)
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(currentUserRef, { sentRequests: [sentRequestObj] }, { merge: true });
            }
        });

        // UI Güncelleme - Kullanıcı Deneyimi (UX)
        await updateAddFriendButton(targetUid);
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İsteği iptal et';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.onclick = () => cancelFriendRequest(targetUid);
        }


    } catch (error) {
        console.error("Arkadaş isteği gönderme hatası:", error);
        alert('❌ Arkadaş isteği gönderilemedi: ' + error.message);
    }
}

// Arkadaş isteğini onayla
async function acceptFriendRequest(requesterUid, requesterUsername) {
    if (!auth.currentUser) return;

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const requesterRef = doc(db, "users", requesterUid);
        const currentUserDoc = await getDoc(currentUserRef);
        const requesterDoc = await getDoc(requesterRef);

        // Arkadaş isteğini kaldır
        const updatedRequests = (currentUserDoc.data().friendRequests || [])
            .filter(req => req.fromUid !== requesterUid);

        await updateDoc(currentUserRef, {
            friendRequests: updatedRequests,
            friends: arrayUnion(requesterUid)
        });

        // Karşıya da ekle
        await updateDoc(requesterRef, {
            friends: arrayUnion(auth.currentUser.uid),
            sentRequests: ((requesterDoc.data().sentRequests || [])
                .filter(req => req.toUid !== auth.currentUser.uid))
        });

        // Onay bildirimini gönder
        await sendNotification(requesterUid, 'friend_accepted', user.displayName);
        
        // UI'da istek kartını kaldır
        const requestCard = document.getElementById(`friend-request-${requesterUid}`);
        if (requestCard) {
            requestCard.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => requestCard.remove(), 300);
        }
        
        loadFriendsList();
        checkIfNoRequests();
    } catch (error) {
        console.error("Onaylama hatası:", error);
        alert('Onaylama başarısız: ' + error.message);
    }
}


// Fonksiyonun dışarıdan (HTML'den) erişilebilir olmasını sağlar
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;

// Arkadaş isteğini reddet
async function rejectFriendRequest(requesterUid, requesterUsername) {
    if (!auth.currentUser) return;

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const requesterRef = doc(db, "users", requesterUid);
        const currentUserDoc = await getDoc(currentUserRef);
        const requesterDoc = await getDoc(requesterRef);

        // Arkadaş isteğini kaldır
        const updatedRequests = (currentUserDoc.data().friendRequests || [])
            .filter(req => req.fromUid !== requesterUid);

        await updateDoc(currentUserRef, {
            friendRequests: updatedRequests
        });

        // Gönderenden sentRequest'i de kaldır
        if (requesterDoc.exists()) {
            await updateDoc(requesterRef, {
                sentRequests: ((requesterDoc.data().sentRequests || [])
                    .filter(req => req.toUid !== auth.currentUser.uid))
            });
        }

        // Reddetme bildirimini gönder
        await sendNotification(requesterUid, 'friend_rejected', user.displayName);
        
        // UI'da istek kartını kaldır
        const requestCard = document.getElementById(`friend-request-${requesterUid}`);
        if (requestCard) {
            requestCard.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => requestCard.remove(), 300);
        }
        
        checkIfNoRequests();
    } catch (error) {
        console.error("Reddetme hatası:", error);
        alert('Reddetme başarısız: ' + error.message);
    }
}

// Bildirim gönder
async function sendNotification(recipientUid, type, fromName, extra = {}) {
    try {
        const recipientRef = doc(db, "users", recipientUid);
        const notification = {
            notificationId: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            type: type,
            fromName: fromName,
            fromUid: auth.currentUser ? auth.currentUser.uid : null,
            timestamp: Date.now(),
            read: false,
            title: extra.title || '',
            message: extra.message || extra.text || '',
            ...extra
        };

        await updateDoc(recipientRef, {
            notifications: arrayUnion(notification)
        }).catch(async (err) => {
            if (err && err.code === 'not-found') {
                await setDoc(recipientRef, {
                    notifications: [notification]
                }, { merge: true });
            }
        });

        try {
            window.dispatchEvent(new CustomEvent('notifications:changed'));
        } catch (e) {
            // ignore browser event errors
        }
    } catch (error) {
        console.error("Bildirim gönderme hatası:", error);
    }
}

async function getAdminRecipientIds() {
    const adminIds = new Set();
    const adminEmailNormalized = String(ADMIN_EMAIL || '').trim().toLowerCase();
    const adminUsername = adminEmailNormalized.includes('@') ? adminEmailNormalized.split('@')[0] : adminEmailNormalized;

    try {
        const adminFlagSnap = await getDocs(query(collection(db, 'users'), where('isAdmin', '==', true), limit(50)));
        adminFlagSnap.forEach((docSnap) => adminIds.add(docSnap.id));
    } catch (error) {
        console.warn('admin isAdmin sorgusu başarısız:', error);
    }

    try {
        const adminEmailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', ADMIN_EMAIL), limit(10)));
        adminEmailSnap.forEach((docSnap) => adminIds.add(docSnap.id));
    } catch (error) {
        console.warn('admin email sorgusu başarısız:', error);
    }

    try {
        const adminUsernameSnap = await getDocs(query(collection(db, 'users'), where('username', '==', adminUsername), limit(10)));
        adminUsernameSnap.forEach((docSnap) => adminIds.add(docSnap.id));
    } catch (error) {
        console.warn('admin username sorgusu başarısız:', error);
    }

    try {
        if (adminIds.size === 0) {
            const usersSnap = await getDocs(query(collection(db, 'users'), limit(200)));
            usersSnap.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const email = String(data.email || '').trim().toLowerCase();
                const username = String(data.username || '').trim().toLowerCase();
                if (email === adminEmailNormalized || username === adminUsername || data.isAdmin === true) {
                    adminIds.add(docSnap.id);
                }
            });
        }
    } catch (error) {
        console.warn('admin fallback sorgusu başarısız:', error);
    }

    return [...adminIds];
}

window.openModerationAlertTarget = function (notification) {
    try {
        const findingText = Array.isArray(notification?.moderationFindings) && notification.moderationFindings.length
            ? String(notification.moderationFindings[0])
            : '';
        const target = {
            contentId: notification?.moderationContentId || notification?.postId || notification?.contentId || '',
            contentType: notification?.moderationType || notification?.contentType || 'post',
            warningText: findingText
        };
        localStorage.setItem('st_moderationTarget', JSON.stringify(target));
        window.location.href = 'admin.html?tab=moderation#main-section-moderation';
    } catch (error) {
        console.warn('openModerationAlertTarget hatası:', error);
        window.location.href = 'admin.html?tab=moderation#main-section-moderation';
    }
};

function getAutomaticModerationFindings(text = '') {
    const lower = String(text || '').toLowerCase();
    if (!lower.trim()) return [];

    const rules = [
        { label: 'Küfür', terms: ['siktir', 'amk', 'aq', 'orospu', 'pezevenk', 'fuck', 'shit', 'bitch', 'ibne', 'göt'] },
        { label: 'Hakaret', terms: ['aptal', 'salak', 'gerizekalı', 'şerefsiz', 'zırva', 'alçak', 'argo'] },
        { label: 'Cinsel içerik (+18)', terms: ['seks', 'porn', 'mastürbasyon', 'erotik', '18+', 'xvideos', 'xnxx', 'pornhub', 'siki', 'amcık'] },
        { label: 'Irk / cins / cinsiyet ayrımı', terms: ['ırk', 'ırkçı', 'cinsiyet', 'cins ayrımı', 'ırk ayrımı', 'cinsiyet ayrımı'] }
    ];

    const findings = [];
    rules.forEach((rule) => {
        const match = rule.terms.find((term) => lower.includes(term));
        if (match) {
            findings.push({ category: rule.label, matchedTerm: match });
        }
    });

    return findings;
}

async function queueContentModerationIfNeeded(payload = {}) {
    try {
        const contentText = String(payload.contentText || '').trim();
        const findings = getAutomaticModerationFindings(contentText);
        if (!findings.length) return;

        const categories = [...new Set(findings.map((item) => item.category))];
        const matchedTerms = [...new Set(findings.map((item) => item.matchedTerm).filter(Boolean))];
        const nowMs = Date.now();

        const moderationRecord = {
            status: 'pending',
            source: 'auto',
            type: payload.contentType || 'post',
            contentId: payload.contentId || null,
            communityId: payload.communityId || null,
            authorUid: payload.authorUid || auth.currentUser?.uid || null,
            authorUsername: payload.authorUsername || window.user?.username || auth.currentUser?.email?.split('@')[0] || 'unknown',
            authorDisplayName: payload.authorDisplayName || window.user?.displayName || auth.currentUser?.displayName || 'Bilinmeyen kullanıcı',
            findings: findings.map((item) => `${item.category} ("${item.matchedTerm}")`),
            categories,
            matchedTerms,
            excerpt: contentText.substring(0, 280),
            timestamp: serverTimestamp(),
            createdAtMs: nowMs
        };

        await addDoc(collection(db, 'moderationAlerts'), moderationRecord);

        const adminIds = await getAdminRecipientIds();
        const authorName = moderationRecord.authorDisplayName;
        const authorUsername = moderationRecord.authorUsername;
        const typeLabel = payload.contentType === 'blog'
            ? 'blog yazısı'
            : payload.contentType === 'community'
                ? 'topluluk gönderisi'
                : 'gönderi';
        const adminMessage = `${authorName} (@${authorUsername}) tarafından paylaşılan ${typeLabel} otomatik uyarıya düştü.`;

        const notifyPromises = [];
        adminIds.forEach((adminId) => {
            notifyPromises.push(sendNotification(adminId, 'moderation_alert', 'Sistem / İçerik Denetimi', {
                title: 'Otomatik içerik uyarısı',
                message: adminMessage,
                moderationType: payload.contentType || 'post',
                moderationContentId: payload.contentId || null,
                moderationCommunityId: payload.communityId || null,
                moderationFindings: moderationRecord.findings,
                reportText: `${adminMessage} Bulgular: ${moderationRecord.findings.join(', ')}`
            }));
        });
        await Promise.allSettled(notifyPromises);
    } catch (error) {
        console.error('queueContentModerationIfNeeded hatası:', error);
    }
}

// helper: uygula arama filtresi (input veya liste güncelleme çağırır)
function applyFriendSearch() {
    const searchInput = document.getElementById('friendSearch');
    if (!searchInput) return;
    const q = searchInput.value.trim().toLowerCase();
    // debug log removed

    document.querySelectorAll('#friends-list .friend-card').forEach(card => {
        card.style.display = card.dataset.search && card.dataset.search.includes(q) ? '' : 'none';
    });
}

function syncAdminUiVisibility() {
    const adminBtn = document.getElementById('adminMenuBtn');
    const sidebarAdminBtn = document.getElementById('sidebarAdminBtn');
    const isAdmin = Boolean(
        window.user?.isAdmin === true ||
        (auth?.currentUser?.email && auth.currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())
    );

    [adminBtn, sidebarAdminBtn].forEach((btn) => {
        if (!btn) return;
        btn.style.display = isAdmin ? 'flex' : 'none';
        btn.style.visibility = isAdmin ? 'visible' : 'hidden';
        btn.setAttribute('aria-hidden', isAdmin ? 'false' : 'true');
    });
}
window.syncAdminUiVisibility = syncAdminUiVisibility;

// Arkadaşlar listesini yükle (isOwnProfile=true ise tüm arkadaşlar, false ise ortak arkadaşlar)
async function loadFriendsList(userRef, isOwnProfile = true) {
    // Koruma: aynı hedef için çok kısa sürede birden fazla çağrı gelirse tekrar işleme
    try {
        const visitedUsername = (new URLSearchParams(location.search)).get('id');
        const targetKey = isOwnProfile ? (window.user?.uid || 'me') : (visitedUsername || 'visited');
        window._friendsLoadMeta = window._friendsLoadMeta || { key: null, time: 0 };
        const currentKey = `${targetKey}_${isOwnProfile ? 'own' : 'visited'}`;
        if (window._friendsLoadMeta.key === currentKey && (Date.now() - window._friendsLoadMeta.time) < 800) {
            // kısa süreli tekrarlanan çağrı varsa atla
            return;
        }
        window._friendsLoadMeta.key = currentKey;
        window._friendsLoadMeta.time = Date.now();
    } catch (e) {
        // ignore guard errors
    }
    const friendsTab = document.getElementById('friends-list');
    const noFriendsMsg = document.getElementById('no-friends-msg');
    const friendsWidget = document.getElementById('friends-widget-list');
    const friendsWidgetEmpty = document.getElementById('friends-widget-empty');
    const friendsWidgetCount = document.getElementById('friendsWidgetCount');
    const friendsWidgetViewAll = document.getElementById('friendsWidgetViewAll');
    
    // ensure search input has handler every time we load list
    const searchInput = document.getElementById('friendSearch');
    if (searchInput) {
        searchInput.oninput = applyFriendSearch;
    }

    // Debug: DOM ve auth durumunu logla
    console.debug('loadFriendsList called', { friendsTabExists: !!friendsTab, friendsWidgetExists: !!friendsWidget, friendsWidgetEmptyExists: !!friendsWidgetEmpty, friendsWidgetCountExists: !!friendsWidgetCount, authPresent: typeof auth !== 'undefined', currentUser: auth?.currentUser || null, userGlobal: window.user || null, isOwnProfile });
    if (!friendsTab) {
        return;
    }
    if (!auth || !auth.currentUser) {
        console.warn('loadFriendsList: auth.currentUser yok, giriş yapılmamış olabilir');
        return;
    }

    try {
        let targetUserData = null;
        
        if (!isOwnProfile) {
            // Başka birinin profili - visitedUsername'dan bulmalıyız
            const visitedUsername = getVisitedProfileUsername();
            
            if (!visitedUsername) return;
            
            // Firebase'de username ile kullanıcı ara
            try {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('username', '==', visitedUsername));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.size > 0) {
                    targetUserData = querySnapshot.docs[0].data();
                } else {
                    if (noFriendsMsg) noFriendsMsg.style.display = 'block';
                    return;
                }
            } catch (e) {
                console.warn('Ziyaret edilen kullanıcı bulunamadı:', e);
                if (noFriendsMsg) noFriendsMsg.style.display = 'block';
                return;
            }
        } else {
            // Kendi profil
            if (!userRef && auth.currentUser) {
                userRef = doc(db, "users", auth.currentUser.uid);
            }
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                targetUserData = userDoc.data();
            }
        }
        
        if (!targetUserData) {
            console.warn('loadFriendsList: targetUserData yok');
            return;
        }
        
        const friends = targetUserData.friends || [];
        console.debug('loadFriendsList: targetUser:', targetUserData.username || targetUserData.displayName || targetUserData.email || targetUserData.uid, 'friendsRawCount:', friends.length, friends);

        // logged-in kullanıcının da arkadaş listesi (mutual hesapları için)
        let myFriends = [];
        if (auth && auth.currentUser) {
            try {
                const me = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (me.exists()) {
                    myFriends = me.data()?.friends || [];
                }
            } catch (e) {
                console.warn('Kendi arkadaş listesi alınamadı:', e);
            }
        }

        // Eğer başka profil ise sadece ortak arkadaşları filtrele
        let displayFriends = friends;
        if (!isOwnProfile) {
            displayFriends = friends.filter(f => myFriends.includes(f));
        }
        // Tekrarlayan UID'leri kaldır (DB'de çift kayıt varsa tekrar gösterimi önle)
        displayFriends = Array.isArray(displayFriends) ? Array.from(new Set(displayFriends)) : displayFriends;

        if (!Array.isArray(displayFriends) || displayFriends.length === 0) {
            friendsTab.innerHTML = '';
            if (friendsWidget) friendsWidget.innerHTML = '';
            if (friendsWidgetCount) friendsWidgetCount.innerText = '0 arkadaş';
            if (friendsWidgetEmpty) friendsWidgetEmpty.style.display = 'block';
            if (friendsWidgetViewAll) friendsWidgetViewAll.style.display = 'inline-block';
            noFriendsMsg.style.display = 'block';
            console.debug('loadFriendsList: displayFriends boş veya array değil', displayFriends);
            return;
        }

        noFriendsMsg.style.display = 'none';
        friendsTab.innerHTML = '';
        if (friendsWidget) {
            friendsWidget.innerHTML = '';
        }
        if (friendsWidgetEmpty) friendsWidgetEmpty.style.display = 'none';
        if (friendsWidgetCount) {
            const countLabel = isOwnProfile ? 'Arkadaş' : 'Ortak arkadaş';
            friendsWidgetCount.innerText = `${displayFriends.length} ${countLabel}`;
        }
        if (friendsWidgetViewAll) friendsWidgetViewAll.style.display = 'inline-block';

        const previewLimit = displayFriends.length > 9 ? 8 : 9;
        const widgetItems = [];
        // Her arkadaşın bilgisini çek - önce UID ile dene, yoksa username olarak sorgula
        for (const friendUidOrName of displayFriends) {
            let friendDoc = null;
            let friendData = null;
            try {
                // önce UID olarak dene
                const potentialRef = doc(db, "users", friendUidOrName);
                const potentialSnap = await getDoc(potentialRef);
                if (potentialSnap && potentialSnap.exists()) {
                    friendDoc = potentialSnap;
                    friendData = friendDoc.data();
                } else {
                    // UID yoksa username ile ara
                    try {
                        const usersRef = collection(db, 'users');
                        const q = query(usersRef, where('username', '==', friendUidOrName), limit(1));
                        const qSnap = await getDocs(q);
                        if (!qSnap.empty) {
                            friendDoc = qSnap.docs[0];
                            friendData = friendDoc.data();
                        }
                    } catch (innerErr) {
                        console.warn('Friend lookup by username failed', innerErr);
                    }
                }
            } catch (err) {
                console.warn('Friend lookup error for', friendUidOrName, err);
            }

            if (friendDoc && friendDoc.exists()) {
                // friendData already set above
                const rawUsername = String(friendData.username || friendData.userName || '').trim();
                const normalizedUsername = rawUsername.replace(/^@+/, '') || String(friendDoc.id || 'kullanici').trim();
                const displayName = String(friendData.displayName || '').trim() || normalizedUsername;
                const safeDisplayName = escapeHtml(displayName);
                const safeUsername = escapeHtml(normalizedUsername);

                // mutual friends sayısını hesapla
                let mutualCount = 0;
                if (myFriends.length && friendData.friends) {
                    mutualCount = friendData.friends.filter(f => myFriends.includes(f)).length;
                }

                const friendCard = document.createElement('div');
                friendCard.className = 'friend-card';
                friendCard.style.cssText = `
                    padding: 18px;
                    border-radius: 14px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    justify-content: center;
                    gap: 10px;
                    min-height: 220px;
                    color: var(--text-main);
                `;
                
                const mutualHtml = `<p class="friend-card-mutual" data-uid="${friendDoc.id}" 
                        style="margin:4px 0 0 0; color:var(--text-muted); font-size:0.75rem; ${mutualCount > 0 ? 'cursor:pointer;' : ''}">
                        🌐 ${mutualCount} ortak arkadaş
                    </p>`;

                friendCard.innerHTML = `
                    <div class="friend-card-identity" style="width:100%; min-width:0; text-align:center;">
                            <img src="${escapeHtml(friendData.avatarUrl || 'assets/img/strendsaydamv2.png')}" 
                                class="friend-card-avatar"
                                style="width: 80px; height: 80px; border-radius: 50%; border: none; object-fit: cover; margin-bottom: 10px; cursor:pointer; transition: transform 0.25s ease;"
                             onclick="window.location.href='profil.html?id=${encodeURIComponent(normalizedUsername)}'" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
                        <h4 class="friend-card-name" style="margin: 8px 0 2px; font-size: 0.95rem; font-weight: 800;">${safeDisplayName}</h4>
                        <p class="friend-card-username" style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">@${safeUsername}</p>
                    </div>
                    ${mutualHtml}
                    ${isOwnProfile ? `<button onclick="removeFriend('${friendDoc.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.75rem; margin-top: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                        <i class="fa-solid fa-trash"></i> Sonlandır
                    </button>` : ''}
                `;
                // bind mutual click (uses .friend-card-mutual)
                if (mutualCount > 0) {
                    const mutualEl = friendCard.querySelector('.friend-card-mutual');
                    if (mutualEl) mutualEl.addEventListener('click', () => showMutuals(friendDoc.id));
                }
                // store searchable text as data attribute (name+username)
                friendCard.dataset.search = (`${displayName} ${normalizedUsername}`).toLowerCase();
                
                friendsTab.appendChild(friendCard);
                if (widgetItems.length < previewLimit && friendsWidget) {
                    widgetItems.push({ uid: friendDoc.id, data: friendData, mutualCount });
                }
            }
        }

        if (displayFriends.length > previewLimit && friendsWidget) {
            widgetItems.push({ isMore: true, moreCount: displayFriends.length - previewLimit });
        }

        if (friendsWidget) {
            friendsWidget.innerHTML = '';
            widgetItems.forEach((item) => {
                if (item.isMore) {
                    const card = document.createElement('div');
                    card.className = 'friend-preview-more-card';
                    card.innerHTML = `
                        <div class="friend-preview-more-count">+${item.moreCount}</div>
                        <p class="friend-preview-more-text">Daha fazla</p>
                    `;
                    card.addEventListener('click', () => {
                        window.location.href = 'profil.html#friends';
                    });
                    friendsWidget.appendChild(card);
                    return;
                }

                const card = document.createElement('div');
                card.className = 'friend-preview-card';
                card.innerHTML = `
                    <img src="${item.data.avatarUrl || 'assets/img/strendsaydamv2.png'}" 
                        class="friend-preview-avatar" 
                        onclick="window.location.href='profil.html?id=${encodeURIComponent(item.data.username)}'">
                    <h4 class="friend-preview-name">${item.data.displayName || item.data.username}</h4>
                    <p class="friend-preview-mutual" style="font-size:0.7rem;">${item.mutualCount} ortak</p>
                `;
                friendsWidget.appendChild(card);
            });
        }
        // once all friend cards are appended, apply current search filter
        applyFriendSearch();
    } catch (error) {
        console.error("Arkadaşlar listesi yükleme hatası:", error);
    }
}

// Arkadaşlığı sonlandır
async function removeFriend(friendUid) {
    if (!confirm('Bu arkadaşlığı sonlandırmak istediğine emin misin?')) return;

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const friendRef = doc(db, "users", friendUid);

        // Her ikisinden de kaldır
        const currentUserDoc = await getDoc(currentUserRef);
        const friendDoc = await getDoc(friendRef);

        const userFriends = (currentUserDoc.data().friends || []).filter(f => f !== friendUid);
        const friendFriends = (friendDoc.data().friends || []).filter(f => f !== auth.currentUser.uid);

        await updateDoc(currentUserRef, { friends: userFriends });
        await updateDoc(friendRef, { friends: friendFriends });

        loadFriendsList(currentUserRef);
        alert('Arkadaşlık sonlandırıldı');
    } catch (error) {
        console.error("Arkadaşlık sonlandırma hatası:", error);
        alert('İşlem başarısız: ' + error.message);
    }
}

// Fonksiyonu HTML'den (onclick) erişilebilir hale getirir
window.removeFriend = removeFriend;
window.loadFriendsList = loadFriendsList;

// Bir arkadaş ile ortak olan arkadaşları gösteren modal
async function showMutuals(friendUid) {
    if (!auth?.currentUser) return;
    try {
        const meDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const friendDoc = await getDoc(doc(db, "users", friendUid));
        if (!meDoc.exists() || !friendDoc.exists()) return;

        const myFriends = meDoc.data().friends || [];
        const theirFriends = friendDoc.data().friends || [];
        const mutualIds = theirFriends.filter(id => myFriends.includes(id));

        // create overlay structure
        const overlay = document.createElement('div');
        overlay.id = 'mutualModal';
        overlay.className = 'modal-overlay';
        // position and full-screen background like other modals
        overlay.style.cssText = `
            display:flex;
            position:fixed;
            top:0;
            left:0;
            width:100%;
            height:100%;
            background:rgba(0,0,0,0.5);
            align-items:center;
            justify-content:center;
            z-index:3000;
        `;
        overlay.innerHTML = `
            <div class="glass-card" style="width:90%; max-width:500px; padding:20px; box-sizing:border-box;">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <h3 style="margin:0;">Ortak Arkadaşlar</h3>
                    <button id="closeMutualBtn" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-main);">&times;</button>
                </div>
                <div id="mutualListContainer" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;
                      max-height:60vh; overflow-y:auto;"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('closeMutualBtn').addEventListener('click', () => overlay.remove());

        const container = document.getElementById('mutualListContainer');
        if (mutualIds.length === 0) {
            container.innerHTML = '<p>Ortakh arkadaş bulunamadı.</p>';
            return;
        }

        for (const uid of mutualIds) {
            try {
                const uDoc = await getDoc(doc(db, "users", uid));
                if (!uDoc.exists()) continue;
                const u = uDoc.data();
                const card = document.createElement('div');
                card.style.cssText = `
                    background: var(--input-bg);
                    padding: 10px;
                    border-radius: 10px;
                    text-align: center;
                    /* cursor on card removed so only img is clickable */
                    transition: all 0.3s ease;
                    width: 72px;
                `;
                card.innerHTML = `
                    <div>
                        <img src="${u.avatarUrl || 'assets/img/strendsaydamv2.png'}" 
                                style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover; margin-bottom: 5px; cursor:pointer;"
                                onclick="window.location.href='profil.html?id=${encodeURIComponent(u.username)}'">
                        <p style="margin:0; font-size:0.75rem; word-break: break-word;">${u.displayName || u.username}</p>
                    </div>
                `;
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-3px)';
                    card.style.boxShadow = 'var(--shadow)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = 'none';
                });
                container.appendChild(card);
            } catch (e) {
                console.warn('Mutual friend fetch error', e);
            }
        }
        // after list render, reapply search filter in case user typed earlier
        applyFriendSearch();
    } catch (error) {
        console.error('showMutuals error:', error);
    }
}

// Fonksiyonu global erişime aç (kullanıldığı yerde onclick içinde olabilir)
window.showMutuals = showMutuals;

// Arkadaş isteklerini yükle ve bildirim dropdown'unda göster
async function loadFriendRequests(requests) {
    const requestsList = document.getElementById('friendRequestsList');
    const noNotificationsMsg = document.getElementById('noNotificationsMsg');
    
    if (!requestsList) return;

    if (!requests || requests.length === 0) {
        requestsList.innerHTML = '';
        noNotificationsMsg.style.display = 'block';
        return;
    }

    noNotificationsMsg.style.display = 'none';
    requestsList.innerHTML = '';

    for (const request of requests) {
        const requestDiv = document.createElement('div');
        requestDiv.id = `friend-request-${request.fromUid}`;
        requestDiv.style.cssText = `
            padding: 12px;
            margin: 8px 12px;
            border-radius: 8px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
            animation: slideIn 0.3s ease;
        `;

        requestDiv.innerHTML = `
            <img src="${request.fromAvatar || 'assets/img/strendsaydamv2.png'}" 
                 style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
            <div style="flex: 1; min-width: 0;">
                <p style="margin: 0; font-size: 0.85rem; font-weight: 600; word-break: break-word;">${request.fromName}</p>
                <p style="margin: 3px 0 0 0; font-size: 0.75rem; color: var(--text-muted);">@${request.fromUsername}</p>
                <p style="margin: 3px 0 0 0; font-size: 0.7rem; color: var(--text-muted); font-style: italic;">Arkadaş isteği gönderdi</p>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                <button onclick="acceptFriendRequest('${request.fromUid}', '${request.fromUsername}')" 
                        style="background: linear-gradient(135deg, var(--primary), #4f46e5); color: white; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s ease;">
                    <i class="fa-solid fa-check"></i> Onayla
                </button>
                <button onclick="rejectFriendRequest('${request.fromUid}', '${request.fromUsername}')" 
                        style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s ease;">
                    <i class="fa-solid fa-x"></i> Reddet
                </button>
            </div>
        `;

        // Hover efekti
        requestDiv.addEventListener('mouseenter', () => {
            requestDiv.style.boxShadow = 'var(--shadow)';
            requestDiv.style.transform = 'translateY(-2px)';
        });
        
        requestDiv.addEventListener('mouseleave', () => {
            requestDiv.style.boxShadow = 'none';
            requestDiv.style.transform = 'translateY(0)';
        });

        requestsList.appendChild(requestDiv);
    }
    
    // Eğer hiç istek kalmamışsa boş mesaj göster
    checkIfNoRequests();
}

function normalizeNotifications(notifications) {
    if (!Array.isArray(notifications)) return [];
    return notifications.filter(Boolean).map((n, index) => {
        const item = typeof n === 'object' ? n : { message: String(n) };
        const timestamp = item.timestamp;
        return {
            ...item,
            read: item.read === true,
            type: item.type || 'info',
            title: item.title || item.header || '',
            message: item.message || item.body || item.text || item.title || 'Yeni bildirim',
            notificationId: item.notificationId || item.id || `notif-${index}-${_normalizeTs(timestamp) || Date.now()}`
        };
    });
}

function getNotificationDisplayText(n) {
    if (!n) return 'Yeni bildirim';
    const title = String(n.title || n.header || '').trim();
    const message = String(n.message || n.body || n.text || '').trim();
    if (title) return title;
    if (message) return message;
    if (n.type === 'moderation_alert') return 'Otomatik içerik uyarısı';
    if (n.type === 'report_result') return 'Şikayet sonuçlandı';
    if (n.type === 'account_banned') return 'Hesabınız banlandı';
    if (n.type === 'warning') return 'Uyarı aldınız';
    if (n.type === 'account_deleted') return 'Hesabınız silindi';
    return n.fromName || 'Sistem';
}

function getNotificationDetailText(n) {
    if (!n) return '';
    const message = String(n.message || n.body || n.text || '').trim();
    if (n.postContent) return `"${n.postContent}${n.postContent.length > 50 ? '...' : ''}"`;
    if (n.commentText) return `"${n.commentText.slice(0, 60)}${n.commentText.length > 60 ? '...' : ''}"`;
    if (n.reportReason) return `Neden: ${n.reportReason}`;
    if (message && n.title) return message;
    if (message && !n.title) return message;
    return '';
}

async function refreshNotificationsUI() {
    if (!auth?.currentUser) return;
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            loadNotifications(userSnap.data());
            if (typeof window.loadProfileNotifications === 'function') {
                window.loadProfileNotifications();
            }
        }
    } catch (err) {
        console.warn('refreshNotificationsUI hatası:', err);
    }
}

window.refreshNotificationsUI = refreshNotificationsUI;
window.addEventListener('notifications:changed', () => {
    refreshNotificationsUI();
});

// Birleştirilmiş bildirim yükleyici: arkadaş istekleri + diğer bildirimler
async function loadNotifications(userData) {
    const requestsList = document.getElementById('friendRequestsList');
    const noNotificationsMsg = document.getElementById('noNotificationsMsg');

    // Eğer header partial hâlâ yüklenmediyse, birkaç kez dene (header fetch asenkron olabilir)
    if (!requestsList) {
        window._notifRetryCount = (window._notifRetryCount || 0) + 1;
        if (window._notifRetryCount <= 10) {
            setTimeout(() => loadNotifications(userData), 300);
            return;
        } else {
            return;
        }
    }

    const friendRequests = Array.isArray(userData.friendRequests) ? userData.friendRequests : [];
    const otherNotifs = normalizeNotifications(userData.notifications);

    const unreadOther = otherNotifs.filter(n => !n.read).length;
    const totalCount = friendRequests.length + unreadOther;
    // bildirimleri güncelle
    updateNotificationBadge(totalCount);

    if (totalCount === 0) {
        requestsList.innerHTML = '';
        if (noNotificationsMsg) noNotificationsMsg.style.display = 'flex';
        return;
    }

    if (noNotificationsMsg) noNotificationsMsg.style.display = 'none';
    requestsList.innerHTML = '';

    // Önce arkadaş isteklerini göster (onay/reddet butonlu)
    for (const request of friendRequests) {
        const requestDiv = document.createElement('div');
        requestDiv.id = `friend-request-${request.fromUid}`;
        requestDiv.style.cssText = `padding:12px; margin:8px 12px; border-radius:8px; background:var(--input-bg); border:1px solid var(--border); display:flex; align-items:center; gap:10px; transition:all 0.3s ease; animation: slideIn 0.3s ease;`;

        requestDiv.innerHTML = `
            <img src="${request.fromAvatar || 'assets/img/strendsaydamv2.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
            <div style="flex:1; min-width:0;">
                <p style="margin:0; font-size:0.85rem; font-weight:600;">${request.fromName}</p>
                <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-muted);">@${request.fromUsername}</p>
                <p style="margin:3px 0 0 0; font-size:0.7rem; color:var(--text-muted); font-style:italic;">Arkadaş isteği gönderdi</p>
            </div>
            <div style="display:flex; gap:6px; justify-content:flex-end;">
                <button onclick="acceptFriendRequest('${request.fromUid}', '${request.fromUsername}')" style="background:linear-gradient(135deg,var(--primary),#4f46e5); color:white; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600;"><i class="fa-solid fa-check"></i> Onayla</button>
                <button onclick="rejectFriendRequest('${request.fromUid}', '${request.fromUsername}')" style="background:linear-gradient(135deg,#ef4444,#dc2626); color:white; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600;"><i class="fa-solid fa-x"></i> Reddet</button>
            </div>
        `;

        requestDiv.addEventListener('mouseenter', () => { requestDiv.style.boxShadow = 'var(--shadow)'; requestDiv.style.transform = 'translateY(-2px)'; });
        requestDiv.addEventListener('mouseleave', () => { requestDiv.style.boxShadow = 'none'; requestDiv.style.transform = 'translateY(0)'; });

        requestsList.appendChild(requestDiv);
    }

    // Diğer bildirimleri göster — sadece okunmamış ve son 8 tanesini göster
    const maxNotifications = 8;
    const unreadNotifs = otherNotifs.filter(n => !n.read);
    const recentNotifs = unreadNotifs.slice(-maxNotifications);
    for (const n of recentNotifs) {
        const nDiv = document.createElement('div');
        nDiv.style.cssText = `padding:12px; margin:8px 12px; border-radius:8px; background:var(--input-bg); border:1px solid var(--border); display:flex; gap:10px; cursor:pointer; transition:all 0.2s ease;`;

        let icon = 'fa-info-circle';
        let text = '';
        let detail = '';

        if (n.type?.includes('friend_')) {
            if (n.type === 'friend_accepted') text = `${n.fromName} arkadaşlık isteğinizi kabul etti`;
            else if (n.type === 'friend_rejected') text = `${n.fromName} arkadaşlık isteğinizi reddetti`;
            else text = `${n.fromName} ile ilgili bir arkadaş bildirimi`;
            icon = 'fa-user-check';
        } else if (n.type === 'like' || n.type === 'post_like') {
            text = `${n.fromName} gönderinizi beğendi`;
            detail = getNotificationDetailText(n);
            icon = 'fa-heart';
        } else if (n.type === 'saved_self') {
            text = `Gönderiyi kaydettiniz`;
            detail = getNotificationDetailText(n);
            icon = 'fa-bookmark';
        } else if (n.type === 'saved' || n.type === 'post_saved') {
            text = `${n.fromName} gönderinizi kaydetti`;
            detail = getNotificationDetailText(n);
            icon = 'fa-bookmark';
        } else if (n.type === 'comment' || n.type === 'post_comment') {
            text = `${n.fromName} gönderinize yorum yaptı`;
            detail = getNotificationDetailText(n);
            icon = 'fa-comment';
        } else if (n.type === 'comment_reply') {
            text = `${n.fromName} yorumunuza yanıt yazdı`;
            detail = getNotificationDetailText(n);
            icon = 'fa-reply';
        } else if (n.type === 'message' || n.type === 'msg') {
            text = `${n.fromName} size mesaj gönderdi`;
            detail = getNotificationDetailText(n);
            icon = 'fa-envelope';
        } else if (n.type === 'community_invite') {
            text = `${n.fromName || 'Bir kullanıcı'} sizi "${n.communityName || 'topluluk'}" topluluğuna davet etti`;
            detail = 'Katılmak için daveti kabul edebilir veya reddedebilirsiniz.';
            icon = 'fa-user-group';
        } else if (n.type === 'moderation_alert' || n.type === 'report_result' || n.type === 'account_banned' || n.type === 'warning' || n.type === 'account_deleted') {
            text = getNotificationDisplayText(n);
            detail = n.message && n.title ? n.message : getNotificationDetailText(n);
            icon = 'fa-shield-halved';
        } else {
            text = getNotificationDisplayText(n);
            detail = getNotificationDetailText(n);
        }

        const timeStr = _formatNotificationTime(n.timestamp);

        const inviteActions = n.type === 'community_invite' ? `
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                <button class="notif-community-accept-btn" style="background:linear-gradient(135deg,var(--primary),#4f46e5); color:#fff; border:none; padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Kabul Et</button>
                <button class="notif-community-reject-btn" style="background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; border:none; padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Reddet</button>
            </div>
        ` : '';

        const moderationActions = n.type === 'moderation_alert' ? `
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                <button class="notif-go-warning-btn" style="background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border:none; padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Uyarıya Git</button>
            </div>
        ` : '';

        nDiv.innerHTML = `
            <i class="fa-solid ${icon}" style="font-size:1.1rem; width:34px; text-align:center; color:var(--primary);"></i>
            <div style="flex:1; min-width:0;">
                <p style="margin:0; font-size:0.85rem; font-weight:600;">${n.fromName || 'Sistem'}</p>
                <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-muted);">${text}</p>
                ${detail ? `<p style="margin:4px 0 0 0; font-size:0.7rem; color:var(--text-muted); font-style:italic;">${detail}</p>` : ''}
                ${inviteActions}
                ${moderationActions}
                <p style="margin:4px 0 0 0; font-size:0.7rem; color:var(--text-muted);">${timeStr}</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                <button class="notif-read-btn" style="background:var(--primary); color:#fff; border:none; padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Okundu</button>
                <button class="notif-hide-btn" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Sil</button>
                ${n.postId ? `<button class="notif-go-btn" style="background:transparent; border:1px solid var(--border); color:var(--text-main); padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Gönderiye Git</button>` : ''}
            </div>
        `;

        nDiv.addEventListener('mouseenter', () => { nDiv.style.boxShadow = 'var(--shadow)'; nDiv.style.transform = 'translateY(-2px)'; });
        nDiv.addEventListener('mouseleave', () => { nDiv.style.boxShadow = 'none'; nDiv.style.transform = 'translateY(0)'; });

        // Tıklamayla okundu yap ve dropdown kapat
        nDiv.onclick = async (e) => {
            if (e.target.closest('.notif-community-accept-btn, .notif-community-reject-btn, .notif-read-btn, .notif-hide-btn, .notif-go-btn')) {
                return;
            }
            e.stopPropagation();
            if (!n.read) {
                await markNotificationRead(n);
                if (auth.currentUser) {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        loadNotifications(userSnap.data());
                    }
                }
            }
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) dropdown.style.display = 'none';

            const chatUserId = n.fromUid || n.senderUid;
            if (n.type === 'message' && chatUserId) {
                openChatWithUser(chatUserId, n.fromName || 'Sohbet');
            } else if (n.postId) {
                window.location.href = `index.html#post-${n.postId}`;
            } else {
                if (!window.location.pathname.endsWith('profil.html')) {
                    window.location.href = 'profil.html#my-notifs-tab';
                } else {
                    const tabBtn = document.querySelector(".tab-btn[onclick*='my-notifs-tab']");
                    if (tabBtn) tabBtn.click();
                }
            }
        };

        requestsList.appendChild(nDiv);

        // Header için Okundu ve Sil butonlarını bağla (sadece dropdown'dan kaldıracak şekilde)
        const readBtn = nDiv.querySelector('.notif-read-btn');
        const hideBtn = nDiv.querySelector('.notif-hide-btn');
        const goBtn = nDiv.querySelector('.notif-go-btn');
        const acceptInviteBtn = nDiv.querySelector('.notif-community-accept-btn');
        const rejectInviteBtn = nDiv.querySelector('.notif-community-reject-btn');
        const goWarningBtn = nDiv.querySelector('.notif-go-warning-btn');

        if (readBtn) {
            readBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    // Mark as read in DB
                    await markNotificationRead(n);
                } catch (err) {
                    console.error('header read button error', err);
                }
                // Remove from dropdown immediately
                nDiv.remove();
                const remainingCount = Math.max(0, totalCount - 1);
                updateNotificationBadge(remainingCount);
            };
        }

        if (hideBtn) {
            hideBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    // Delete permanently from DB
                    await deleteNotification(n);
                } catch (err) {
                    console.error('header delete button error', err);
                }
                nDiv.remove();
                const remainingCount = Math.max(0, totalCount - 1);
                updateNotificationBadge(remainingCount);
            };
        }

        if (goBtn) {
            goBtn.onclick = (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('notificationsDropdown');
                if (dropdown) dropdown.style.display = 'none';
                window.location.href = `index.html#post-${n.postId}`;
            };
        }

        if (acceptInviteBtn) {
            acceptInviteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (typeof window.acceptCommunityInvite === 'function') {
                    await window.acceptCommunityInvite(n.communityId);
                }
            };
        }

        if (rejectInviteBtn) {
            rejectInviteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (typeof window.rejectCommunityInvite === 'function') {
                    await window.rejectCommunityInvite(n.communityId);
                }
            };
        }

        if (goWarningBtn) {
            goWarningBtn.onclick = async (e) => {
                e.stopPropagation();
                window.openModerationAlertTarget(n);
            };
        }
    }

    // Eğer daha fazla bildirim varsa "Tümünü Göster" butonu ekle
    if (unreadNotifs.length > maxNotifications) {
        const showAllBtn = document.createElement('div');
        showAllBtn.style.cssText = `padding:12px 15px; text-align:center; border-top:1px solid var(--border); cursor:pointer; color:var(--primary); font-weight:700; font-size:0.85rem; transition:0.2s;`;
        showAllBtn.innerText = `Tümünü Göster (${unreadNotifs.length - maxNotifications} daha)`;
        showAllBtn.onmouseenter = () => { showAllBtn.style.background = 'var(--input-bg)'; };
        showAllBtn.onmouseleave = () => { showAllBtn.style.background = 'none'; };
        showAllBtn.onclick = () => {
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) dropdown.style.display = 'none';
            window.location.href = 'profil.html#my-notifs-tab';
        };
        requestsList.appendChild(showAllBtn);
    }

    // Hepsini Okundu Yap butonu (gönderilerin altında)
    const markAllBtn = document.createElement('div');
    markAllBtn.style.cssText = `padding:12px 15px; text-align:center; border-top:1px solid var(--border); cursor:pointer; background:linear-gradient(135deg, var(--primary), #8b5cf6); color:white; font-weight:700; font-size:0.85rem; transition:all 0.2s; flex-shrink:0;`;
    markAllBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Hepsini Okundu Yap';
    markAllBtn.onmouseenter = () => { markAllBtn.style.opacity = '0.8'; };
    markAllBtn.onmouseleave = () => { markAllBtn.style.opacity = '1'; };
    markAllBtn.onclick = async () => {
        await markAllNotificationsRead();
        // Bildirimleri yenile
        if (auth.currentUser) {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                loadNotifications(userSnap.data());
            }
        }
    };
    requestsList.appendChild(markAllBtn);
}

// Hiç arkadaş isteği kalmamışsa mesaj göster
function checkIfNoRequests() {
    const requestsList = document.getElementById('friendRequestsList');
    const noNotificationsMsg = document.getElementById('noNotificationsMsg');
    
    if (requestsList && noNotificationsMsg) {
        const hasRequests = requestsList.children.length > 0;
        noNotificationsMsg.style.display = hasRequests ? 'none' : 'flex';
    }
}

// Yardımcı: iki bildirimin aynı olup olmadığını anlamak için normalize edilmiş zaman karşılaştırması
function _normalizeTs(ts) {
    if (!ts) return null;
    if (typeof ts === 'number') return ts;
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts && ts.seconds) return (ts.seconds * 1000) + Math.floor((ts.nanoseconds || 0) / 1000000);
    return null;
}

// Bildirim için insan okunur zaman formatı
function _formatNotificationTime(ts) {
    const ms = _normalizeTs(ts);
    if (!ms) return '';
    const now = Date.now();
    const diff = Math.floor((now - ms) / 1000);
    
    if (diff < 60) return 'şimdi';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
    
    const date = new Date(ms);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function _isSameNotification(a, b) {
    if (!a || !b) return false;
    if (a.notificationId && b.notificationId) {
        return a.notificationId === b.notificationId;
    }
    if (a.id && b.id) {
        return a.id === b.id;
    }
    const ta = _normalizeTs(a.timestamp);
    const tb = _normalizeTs(b.timestamp);
    return a.type === b.type && (a.fromUid || null) === (b.fromUid || null) && ta === tb && JSON.stringify(a.extra || a.postId || a.commentText || {}) === JSON.stringify(b.extra || b.postId || b.commentText || {});
}

// Profil sayfasındaki bildirimleri yükle
async function loadProfileNotifications() {
    const list = document.getElementById('profile-notifications-list');
    const noMsg = document.getElementById('profile-no-notifs');
    if (!list) return;

    try {
        if (!auth.currentUser) {
            list.innerHTML = '<div style="color:var(--text-muted);">Giriş yapın</div>';
            return;
        }

        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const allNotifs = normalizeNotifications(userSnap.exists() ? userSnap.data().notifications : []);

        list.innerHTML = '';
        if (allNotifs.length === 0) {
            noMsg.style.display = 'block';
            return;
        }
        noMsg.style.display = 'none';

        // En yeniden en eskiye sırala
        for (const n of allNotifs.slice().reverse()) {
            const nDiv = document.createElement('div');
            nDiv.style.cssText = `padding:15px; border-radius:12px; background:var(--input-bg); border:1px solid var(--border); display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:start; cursor:pointer; transition:all 0.2s ease; ${n.read ? 'opacity:0.65;' : 'background:var(--card-bg); border:1px solid var(--primary);'}`;

            const icon = (n.type === 'moderation_alert') ? 'fa-shield-halved' : ((n.type && n.type.includes('like')) ? 'fa-heart' : (n.type && n.type.includes('comment') ? 'fa-comment' : (n.type && n.type.includes('friend') ? 'fa-user-check' : 'fa-info-circle')));
            const iconColors = {
                'fa-heart': '#ef4444',
                'fa-comment': '#3b82f6',
                'fa-user-check': '#10b981',
                'fa-info-circle': '#8b5cf6',
                'fa-shield-halved': '#f59e0b'
            };
            const iconColor = iconColors[icon] || 'var(--primary)';

            let mainText = '';
            let detailText = '';

            if (n.type === 'post_like' || n.type === 'like') {
                mainText = `${n.fromName} gönderinizi beğendi`;
                detailText = n.postContent ? `"${n.postContent}${n.postContent.length >= 50 ? '...' : ''}"` : 'Gönderi hakkında daha fazla bilgi görmek için tıkla.';
            } else if (n.type === 'saved_self') {
                mainText = `Gönderiyi kaydettiniz`;
                detailText = n.postContent ? `"${n.postContent}${n.postContent.length >= 50 ? '...' : ''}"` : 'Gönderi hakkında daha fazla bilgi görmek için tıkla.';
            } else if (n.type === 'post_saved' || n.type === 'saved') {
                mainText = `${n.fromName} gönderinizi kaydetti`;
                detailText = n.postContent ? `"${n.postContent}${n.postContent.length >= 50 ? '...' : ''}"` : 'Gönderi hakkında daha fazla bilgi görmek için tıkla.';
            } else if (n.type === 'post_comment' || n.type === 'comment') {
                mainText = `${n.fromName} gönderinize yorum yaptı`;
                detailText = n.commentText ? `"${n.commentText.slice(0, 60)}${n.commentText.length > 60 ? '...' : ''}"` : '';
            } else if (n.type === 'friend_accepted') {
                mainText = `${n.fromName} arkadaşlık isteğinizi kabul etti`;
                detailText = 'Artık arkadaşsınız!';
            } else if (n.type === 'friend_rejected') {
                mainText = `${n.fromName} arkadaşlık isteğinizi reddetti`;
                detailText = '';
            } else if (n.type === 'moderation_alert') {
                mainText = n.title || 'Otomatik içerik uyarısı';
                detailText = n.reportText || n.message || 'İçerik denetimi için yöneticilere iletildi.';
            } else {
                mainText = n.fromName || 'Sistem';
                detailText = n.message || 'Yeni bildirim';
            }

            const timeStr = _formatNotificationTime(n.timestamp);

            nDiv.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center;">
                    <div style="width:50px; height:50px; border-radius:12px; background:${iconColor}20; display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid ${icon}" style="font-size:1.4rem; color:${iconColor};"></i>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="font-weight:800; font-size:0.95rem; color:var(--text-main);">${mainText}</div>
                    ${detailText ? `<div style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">${detailText}</div>` : ''}
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                        <i class="fa-regular fa-clock" style="margin-right:4px;"></i>${timeStr}
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                    ${!n.read ? `<button style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Okundu</button>` : `<div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">✓ Okundu</div>`}
                    <button style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Sil</button>
                    ${n.type === 'moderation_alert' ? `<button class="notif-go-warning-btn" style="background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Uyarıya Git</button>` : ''}
                    ${n.postId ? `<button style="background:transparent; border:1px solid var(--border); color:var(--text-main); padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Gönderiye Git</button>` : ''}
                </div>
            `;

            nDiv.addEventListener('mouseenter', () => { if (!n.read) nDiv.style.boxShadow = 'var(--shadow)'; });
            nDiv.addEventListener('mouseleave', () => { nDiv.style.boxShadow = 'none'; });

            list.appendChild(nDiv);

            // Sil butonu seçicisi - tüm butonları kontrol et ve "Sil" yazanı bul
            const buttons = nDiv.querySelectorAll('button');
            const editButton = nDiv.querySelector('.notif-go-warning-btn');
            for (const btn of buttons) {
                if (btn.textContent.trim() === 'Sil') {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        await deleteNotification(n);
                        loadProfileNotifications();
                    };
                }
                if (btn.textContent.trim() === 'Gönderiye Git') {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        window.location.href = `index.html#post-${n.postId}`;
                    };
                }
                if (btn.textContent.trim() === 'Okundu') {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        if (!n.read) {
                            await markNotificationRead(n);
                            setTimeout(() => loadProfileNotifications(), 100);
                        }
                    };
                }
            }

            if (editButton) {
                editButton.onclick = async (e) => {
                    e.stopPropagation();
                    window.openModerationAlertTarget(n);
                };
            }

            nDiv.onclick = async (e) => {
                if (!e.target.closest('button')) {
                    if (!n.read) {
                        await markNotificationRead(n);
                        setTimeout(() => loadProfileNotifications(), 100);
                    } else if (n.postId) {
                        window.location.href = `index.html#post-${n.postId}`;
                    }
                }
            };
        }

    } catch (e) {
        console.error('loadProfileNotifications hatası:', e);
    }
}

// Silinen bildirimleri yönetmek için helper
function saveDeletedNotification(notif) {
    const key = 'deletedNotifications_' + auth.currentUser.uid;
    const deleted = JSON.parse(localStorage.getItem(key)) || [];
    deleted.push({
        ...notif,
        deletedAt: Date.now()
    });
    localStorage.setItem(key, JSON.stringify(deleted));
}

// Tek bir bildirimi sil
async function deleteNotification(targetNotif) {
    if (!auth.currentUser) return;
    try {
        saveDeletedNotification(targetNotif);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const notifs = normalizeNotifications(userSnap.data().notifications);

        const updated = notifs.filter(n => !_isSameNotification(n, targetNotif));
        await updateDoc(userRef, { notifications: updated });
    } catch (e) {
        console.error('deleteNotification hata:', e);
    }
}

// Tek bir bildirimi okundu yap
async function markNotificationRead(targetNotif) {
    if (!auth.currentUser) return;
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const notifs = normalizeNotifications(userSnap.data().notifications);

        const updated = notifs.map(n => {
            if (_isSameNotification(n, targetNotif)) {
                return { ...n, read: true };
            }
            return n;
        });

        await updateDoc(userRef, { notifications: updated });
        // UI will refresh via onSnapshot listener
    } catch (e) {
        console.error('markNotificationRead hata:', e);
    }
}

// Tüm bildirimleri sil
async function deleteAllNotifications() {
    if (!auth.currentUser) return;
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const notifs = normalizeNotifications(userSnap.data().notifications);
            notifs.forEach(n => saveDeletedNotification(n));
        }
        await updateDoc(userRef, { notifications: [] });
        loadProfileNotifications();
    } catch (e) {
        console.error('deleteAllNotifications hata:', e);
    }
}

// Geri al modalını göster
function showRestoreModal() {
    if (!auth.currentUser) return;
    const key = 'deletedNotifications_' + auth.currentUser.uid;
    const deleted = JSON.parse(localStorage.getItem(key)) || [];
    const now = Date.now();
    const tenMin = deleted.filter(n => now - n.deletedAt < 10 * 60 * 1000);
    const oneHour = deleted.filter(n => now - n.deletedAt < 60 * 60 * 1000);
    const oneDay = deleted.filter(n => now - n.deletedAt < 24 * 60 * 60 * 1000);

    let modal = document.getElementById('restoreModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'restoreModal';
        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:5000; display:flex; align-items:center; justify-content:center;`;
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="glass-card" style="width:90%; max-width:400px; padding:20px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0; font-weight:800;">Silinen Bildirimleri Geri Al</h3>
                <button onclick="document.getElementById('restoreModal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button onclick="restoreNotifications(${JSON.stringify(tenMin).replace(/"/g, '&quot;')})" style="background:var(--primary); color:#fff; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; text-align:left; ${tenMin.length === 0 ? 'opacity:0.5; cursor:not-allowed;' : ''}"
                ${tenMin.length === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-clock"></i> Son 10 Dakika (${tenMin.length})
                </button>
                <button onclick="restoreNotifications(${JSON.stringify(oneHour).replace(/"/g, '&quot;')})" style="background:var(--primary); color:#fff; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; text-align:left; ${oneHour.length === 0 ? 'opacity:0.5; cursor:not-allowed;' : ''}"
                ${oneHour.length === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-hourglass-half"></i> Son 1 Saat (${oneHour.length})
                </button>
                <button onclick="restoreNotifications(${JSON.stringify(oneDay).replace(/"/g, '&quot;')})" style="background:var(--primary); color:#fff; border:none; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; text-align:left; ${oneDay.length === 0 ? 'opacity:0.5; cursor:not-allowed;' : ''}"
                ${oneDay.length === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-calendar-days"></i> Son 1 Gün (${oneDay.length})
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

// Bildirimleri geri al
async function restoreNotifications(notificationsToRestore) {
    if (!auth.currentUser || !notificationsToRestore || notificationsToRestore.length === 0) return;
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const notifs = normalizeNotifications(userSnap.data().notifications);
        
        const cleanedRestore = notificationsToRestore.map(({ deletedAt, ...n }) => n);
        const combined = [...notifs, ...cleanedRestore];
        
        await updateDoc(userRef, { notifications: combined });
        
        // Silinen listeden sil
        const key = 'deletedNotifications_' + auth.currentUser.uid;
        const deleted = JSON.parse(localStorage.getItem(key)) || [];
        const restored = deleted.filter(d => !notificationsToRestore.find(r => _isSameNotification(r, d)));
        localStorage.setItem(key, JSON.stringify(restored));
        
        document.getElementById('restoreModal').style.display = 'none';
        loadProfileNotifications();
    } catch (e) {
        console.error('restoreNotifications hata:', e);
    }
}

// Tüm bildirimleri okundu yap
async function markAllNotificationsRead() {
    if (!auth.currentUser) return;
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const notifs = normalizeNotifications(userSnap.data().notifications);
        if (notifs.length === 0) return;

        const updated = notifs.map(n => ({ ...n, read: true }));
        await updateDoc(userRef, { notifications: updated });
        // UI will refresh via onSnapshot
    } catch (e) {
        console.error('markAllNotificationsRead hata:', e);
    }
}

window.loadProfileNotifications = loadProfileNotifications;
window.markNotificationRead = markNotificationRead;
window.deleteNotification = deleteNotification;
window.deleteAllNotifications = deleteAllNotifications;
window.markAllNotificationsRead = markAllNotificationsRead;
window.showRestoreModal = showRestoreModal;
window.restoreNotifications = restoreNotifications;
window.sendNotification = sendNotification;

window.reportPost = async function(postId, fallbackTargetUsername = '') {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın.');
        return;
    }
    if (!postId) {
        alert('Şikayet edilecek gönderi bulunamadı.');
        return;
    }

    const reason = prompt('Gönderi şikayet nedenini yazın:\n\nÖrnek: Taciz, spam, uygunsuz içerik', '');
    if (!reason || !reason.trim()) {
        return;
    }

    try {
        const postSnap = await getDoc(doc(db, 'posts', postId));
        if (!postSnap.exists()) {
            alert('Gönderi bulunamadı.');
            return;
        }

        const post = postSnap.data() || {};
        const reporterUid = auth.currentUser.uid;
        const reporterSnap = await getDoc(doc(db, 'users', reporterUid));
        const reporterData = reporterSnap.exists() ? reporterSnap.data() : {};
        const targetUsername = post.username || post.authorUsername || fallbackTargetUsername || '';

        if (targetUsername && reporterData.username && targetUsername === reporterData.username) {
            alert('Kendi gönderinizi şikayet edemezsiniz.');
            return;
        }

        let targetUid = post.authorUid || post.uid || null;
        if (!targetUid && targetUsername) {
            const targetSnap = await getDocs(query(collection(db, 'users'), where('username', '==', targetUsername), limit(1)));
            if (!targetSnap.empty) {
                targetUid = targetSnap.docs[0].id;
            }
        }

        const reportDoc = {
            reporterUid,
            reporterName: reporterData.displayName || reporterData.name || reporterData.username || 'Bilinmeyen kullanıcı',
            reporterUsername: reporterData.username || '',
            targetUid: targetUid || null,
            targetUsername: targetUsername || null,
            reason: reason.trim(),
            createdAt: serverTimestamp(),
            status: 'pending',
            category: 'Gönderi',
            reportGroup: 'content_moderation',
            contentType: 'post',
            contentId: postId,
            postId,
            postContentPreview: String(post.content || '').slice(0, 200)
        };

        await addDoc(collection(db, 'reports'), reportDoc);

        const adminIds = await getAdminRecipientIds();
        const reportText = `Yeni gönderi şikayeti: ${reportDoc.reporterName} (@${reportDoc.reporterUsername || 'unknown'}) bir gönderiyi şikayet etti. Neden: ${reason.trim()}`;
        for (const adminId of adminIds) {
            if (adminId === reporterUid) continue;
            await sendNotification(adminId, 'user_report', reportDoc.reporterName, {
                reportReason: reason.trim(),
                targetUsername: targetUsername || '',
                targetUid: targetUid || '',
                contentType: 'post',
                contentId: postId,
                postId,
                reportText
            });
        }

        await sendNotification(reporterUid, 'report_submitted', 'Sistem / Yönetici', {
            title: 'Şikayetiniz iletildi',
            message: 'Gönderi şikayetinizi yöneticilere ilettik. İnceleme sonucunu bildirimlerden takip edebilirsiniz.',
            reportReason: reason.trim(),
            targetUsername: targetUsername || '',
            targetUid: targetUid || '',
            contentType: 'post',
            contentId: postId,
            postId,
            reportText
        });

        alert('Gönderi şikayetiniz yöneticilere iletildi.');
    } catch (error) {
        console.error('reportPost hatası:', error);
        alert('Şikayet gönderilirken bir hata oluştu.');
    }
};

window.reportUserFromProfile = async function() {
    const targetUid = window.currentVisitedProfileUid || null;
    const targetUsername = typeof getVisitedProfileUsername === 'function' ? getVisitedProfileUsername() : null;
    if (!targetUid || !auth.currentUser) {
        alert('Şikayet edilecek kullanıcı belirlenemedi.');
        return;
    }

    const reason = prompt('Şikayet nedenini yazın:\n\nÖrnek: Taciz, spam, uygunsuz içerik', '');
    if (!reason || !reason.trim()) {
        return;
    }

    try {
        const reporterUid = auth.currentUser.uid;
        const reporterRef = doc(db, 'users', reporterUid);
        const reporterSnap = await getDoc(reporterRef);
        const reporterData = reporterSnap.exists() ? reporterSnap.data() : {};
        const reportDoc = {
            reporterUid,
            reporterName: reporterData.displayName || reporterData.name || reporterData.username || 'Bilinmeyen kullanıcı',
            reporterUsername: reporterData.username || '',
            targetUid,
            targetUsername,
            reason: reason.trim(),
            createdAt: serverTimestamp(),
            status: 'pending'
        };

        const reportsRef = collection(db, 'reports');
        await addDoc(reportsRef, reportDoc);

        const adminIds = await getAdminRecipientIds();

        const reportText = `Yeni şikayet: ${reportDoc.reporterName} (@${reportDoc.reporterUsername || 'unknown'}) ${targetUsername ? 'kullanıcısını' : 'kullanıcıyı'} şikayet etti. Neden: ${reason.trim()}`;
        for (const adminId of adminIds) {
            if (adminId === reporterUid) continue;
            await sendNotification(adminId, 'user_report', reportDoc.reporterName, {
                reportReason: reason.trim(),
                targetUsername,
                targetUid,
                reportText
            });
        }

        await sendNotification(reporterUid, 'report_submitted', 'Sistem / Yönetici', {
            title: 'Şikayetiniz iletildi',
            message: 'Şikayetinizi yöneticilere ilettik. İnceleme sonuçlarını bildirimlerinizden takip edebilirsiniz.',
            reportReason: reason.trim(),
            targetUsername,
            targetUid,
            reportText
        });

        alert('Şikayetiniz yöneticilere iletildi.');
    } catch (error) {
        console.error('reportUserFromProfile hatası:', error);
        alert('Şikayet gönderilirken bir hata oluştu.');
    }
};

// Fonksiyonu window nesnesine bağlayarak HTML'den erişilebilir yapıyoruz
window.toggleNotifications = function() {
    const dropdown = document.getElementById('notificationsDropdown');
    const friendsDropdown = document.getElementById('friendsDropdown');
    if (friendsDropdown) {
        friendsDropdown.style.display = 'none';
    }
    if (dropdown) {
        // Mevcut durumu kontrol et ve tersine çevir
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'flex';
            dropdown.style.flexDirection = 'column';
            // Dropdown açılırken bildirimleri yenile (okunmuş olanlar kaybolur)
            if (auth.currentUser) {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                getDoc(userRef).then(userSnap => {
                    if (userSnap.exists()) {
                        loadNotifications(userSnap.data());
                    }
                });
            }
        } else {
            dropdown.style.display = 'none';
        }
    } else {
        console.warn("notificationsDropdown öğesi bulunamadı!");
    }
};

window.toggleFriendsDropdown = function() {
    const dropdown = document.getElementById('friendsDropdown');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const friendsBtn = document.getElementById('friendsBtn');
    const searchInput = document.getElementById('friendsSearchInput');
    if (!dropdown) return;
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }
    if (notificationsDropdown) {
        notificationsDropdown.style.display = 'none';
    }
    const isOpen = dropdown.style.display !== 'none' && dropdown.style.display !== '';
    if (!isOpen) {
        if (searchInput) searchInput.value = '';
        dropdown.style.display = 'flex';
        dropdown.style.flexDirection = 'column';
        if (friendsBtn) {
            friendsBtn.classList.add('active');
            friendsBtn.setAttribute('aria-expanded', 'true');
        }
        loadHeaderFriendsList();
    } else {
        dropdown.style.display = 'none';
        if (friendsBtn) {
            friendsBtn.classList.remove('active');
            friendsBtn.setAttribute('aria-expanded', 'false');
        }
    }
};

window.renderHeaderFriendsList = function(friends, totalCount) {
    const list = document.getElementById('headerFriendsList');
    const badge = document.getElementById('friendsCountBadge');
    if (badge) {
        badge.textContent = `${totalCount}`;
    }
    if (!list) return;
    if (!Array.isArray(friends) || friends.length === 0) {
        list.innerHTML = '<div class="friends-dropdown-empty">Arama sonuçlarına uygun arkadaş bulunamadı.</div>';
        return;
    }
    const html = friends.map(friend => {
        return `
            <div class="friends-dropdown-item" data-profile-url="${friend.profileUrl}">
                <div class="friends-dropdown-main">
                    <div class="avatar-wrap ${friend.presence.status}">
                        <img src="${friend.avatarUrl}" alt="${escapeHtml(friend.displayName)}" class="friends-dropdown-avatar" />
                        <span class="status-badge status-${friend.presence.status}"></span>
                    </div>
                    <div class="friends-dropdown-info">
                        <span class="friends-dropdown-name">${escapeHtml(friend.displayName)}</span>
                        ${friend.username ? `<small class="friends-dropdown-username">@${escapeHtml(friend.username)}</small>` : ''}
                        <p class="friends-dropdown-status">${escapeHtml(friend.presence.label)}</p>
                    </div>
                </div>
                <div class="friend-action-group header-friend-action-group">
                    <button type="button" class="friend-action-btn friend-action-chat" title="Sohbet et" data-friend-id="${friend.id}" data-friend-name="${escapeHtml(friend.displayName)}" data-friend-username="${escapeHtml(friend.username)}">
                        <i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="friend-action-btn friend-action-profile" title="Profili aç" data-profile-url="${friend.profileUrl}">
                        <i class="fa-solid fa-user" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    list.innerHTML = html;

    list.querySelectorAll('.friends-dropdown-item').forEach(item => {
        const profileUrl = item.dataset.profileUrl;
        if (profileUrl) {
            item.addEventListener('click', () => {
                window.location.href = profileUrl;
            });
        }

        const chatBtn = item.querySelector('.friend-action-chat');
        if (chatBtn) {
            chatBtn.addEventListener('click', event => {
                event.stopPropagation();
                const friendId = chatBtn.dataset.friendId;
                const displayName = chatBtn.dataset.friendName;
                const username = chatBtn.dataset.friendUsername;
                if (typeof window.openChatWithFriend === 'function') {
                    window.openChatWithFriend(friendId, displayName, username);
                }
            });
        }

        const profileBtn = item.querySelector('.friend-action-profile');
        if (profileBtn) {
            profileBtn.addEventListener('click', event => {
                event.stopPropagation();
                const profileUrlBtn = profileBtn.dataset.profileUrl;
                if (profileUrlBtn) {
                    window.location.href = profileUrlBtn;
                }
            });
        }
    });
};

window.filterHeaderFriends = function() {
    const searchInput = document.getElementById('friendsSearchInput');
    const filter = (searchInput?.value || '').trim().toLowerCase();
    const friends = window.headerFriendsListData || [];
    const filtered = !filter ? friends : friends.filter(friend => {
        const displayName = (friend.displayName || '').toLowerCase();
        const username = (friend.username || '').toLowerCase();
        return displayName.includes(filter) || username.includes(filter);
    });
    renderHeaderFriendsList(filtered, friends.length);
};

window.loadHeaderFriendsList = async function() {
    const list = document.getElementById('headerFriendsList');
    if (!list) return;
    list.innerHTML = '<div class="friends-dropdown-empty">Arkadaşlar yükleniyor...</div>';
    if (!auth.currentUser) {
        list.innerHTML = '<div class="friends-dropdown-empty">Lütfen giriş yapın.</div>';
        return;
    }
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            list.innerHTML = '<div class="friends-dropdown-empty">Arkadaş bilgisi bulunamadı.</div>';
            return;
        }
        const userData = userSnap.data();
        const friendsIds = Array.isArray(userData.friends) ? userData.friends : [];
        if (friendsIds.length === 0) {
            list.innerHTML = '<div class="friends-dropdown-empty">Henüz arkadaşınız yok.</div>';
            const badge = document.getElementById('friendsCountBadge');
            if (badge) badge.textContent = '0';
            const onlineBadge = document.getElementById('friendsOnlineCount');
            if (onlineBadge) onlineBadge.textContent = '(0)';
            window.headerFriendsListData = [];
            return;
        }
        const friendsData = [];
        let onlineCount = 0;
        for (const friendId of friendsIds) {
            try {
                const friendRef = doc(db, 'users', friendId);
                const friendSnap = await getDoc(friendRef);
                if (!friendSnap.exists()) continue;
                const friendData = friendSnap.data();
                const avatarUrl = getAvatarUrl(friendData.avatarUrl || friendData.avatarSeed || 'assets/img/strendsaydamv2.png', 'user');
                const displayName = friendData.displayName || friendData.username || friendId;
                const username = friendData.username || '';
                const presence = resolvePresenceStatus(friendData);
                const profileUrl = username ? `profil.html?id=${encodeURIComponent(username)}` : `profil.html?id=${encodeURIComponent(friendId)}`;
                if (presence.status === 'online') {
                    onlineCount += 1;
                }
                friendsData.push({
                    id: friendId,
                    displayName,
                    username,
                    avatarUrl,
                    presence,
                    profileUrl
                });
            } catch (error) {
                console.error('Arkadaş yüklenirken hata:', error);
            }
        }
        window.headerFriendsListData = friendsData;
        const onlineBadge = document.getElementById('friendsOnlineCount');
        if (onlineBadge) onlineBadge.textContent = `(${onlineCount})`;
        renderHeaderFriendsList(friendsData, friendsIds.length);
        if (typeof window.renderOnlineFriendsWidget === 'function') {
            window.renderOnlineFriendsWidget();
        }
    } catch (error) {
        console.error('Arkadaşlar yüklenirken hata:', error);
        list.innerHTML = '<div class="friends-dropdown-empty">Arkadaşlar yüklenemedi.</div>';
    }
};

// Bildirim badge'ini güncelle
function updateNotificationBadge(count) {
    const normalizedCount = Number(count);
    const safeCount = Number.isFinite(normalizedCount) && normalizedCount >= 0 ? normalizedCount : 0;
    const badge = document.getElementById('notificationBadge');

    if (badge) {
        if (safeCount > 0) {
            badge.style.display = 'inline-flex';
            badge.textContent = safeCount > 99 ? '99+' : `${safeCount}`;
        } else {
            badge.style.display = 'none';
            badge.textContent = '';
        }
    }

    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        if (safeCount > 0) {
            notificationsBtn.classList.add('has-unread');
        } else {
            notificationsBtn.classList.remove('has-unread');
        }
    }

    const headerBadges = document.querySelectorAll('.requestCountBadge');
    headerBadges.forEach((badge) => {
        badge.textContent = safeCount > 0 ? `${safeCount > 99 ? '99+' : safeCount} okunmamış` : '0';
    });

    if (safeCount > 0) {
        document.title = `(${safeCount}) SosyalTrend • Sosyal Ağ`;
    } else {
        document.title = 'SosyalTrend • Sosyal Ağ';
    }
}

// Profil sayfasında "Arkadaş Olarak Ekle" ve "Sohbet Et" butonunu göster/gizle
async function updateAddFriendButton(targetUid) {
    const addFriendBtn = document.getElementById('addFriendBtn');
    const chatBtn = document.getElementById('profileActionBtn');
    const reportBtn = document.getElementById('reportUserBtn');
    if (!addFriendBtn || !chatBtn || !auth.currentUser) return;

    // Eğer profil sahibi kendimizsek butonları düzenle
    if (targetUid === auth.currentUser.uid) {
        addFriendBtn.innerHTML = '<i class="fa-solid fa-user"></i> Bu sizsiniz';
        addFriendBtn.disabled = true;
        addFriendBtn.style.opacity = '0.6';
        addFriendBtn.style.cursor = 'default';
        addFriendBtn.style.display = 'inline-block';
        addFriendBtn.onclick = (e) => e.preventDefault();
        
        chatBtn.style.display = 'none'; // Kendimizle sohbet edemeyiz
        if (reportBtn) reportBtn.style.display = 'none';
        return;
    }

    if (reportBtn) {
        reportBtn.style.display = 'inline-flex';
        reportBtn.style.opacity = '1';
        reportBtn.style.cursor = 'pointer';
    }

    // chat button default setup -- always visible for other users (friend or not)
    chatBtn.style.display = 'inline-block';
    chatBtn.style.opacity = '1';
    chatBtn.style.cursor = 'pointer';
    chatBtn.innerHTML = '<i class="fa-solid fa-comment"></i> <span class="chat-btn-text">Sohbet Et</span>';
    chatBtn.onclick = () => {
        if (typeof openChatWithUser === 'function') {
            openChatWithUser(targetUid, targetUid);
        } else {
            alert("Sohbet sistemi şu anda yüklenemedi. Lütfen sayfayı yenileyin.");
            console.error("Critical: openChatWithUser function is missing.");
        }
    };

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const currentUserDoc = await getDoc(currentUserRef);
        const currentUserData = currentUserDoc.data() || {};

        const friends = currentUserData.friends || [];
        const friendRequests = currentUserData.friendRequests || [];
        const sentRequests = currentUserData.sentRequests || [];

        // Hedef kullanıcı bilgilerini al (Sohbet fonksiyonu için username gerekebilir)
        const targetUserRef = doc(db, "users", targetUid);
        const targetUserDoc = await getDoc(targetUserRef);
        const targetUserData = targetUserDoc.data() || {};
        const targetUsername = targetUserData.username || "Kullanıcı";

        // --- SOHBET BUTONU AYARI ---
        chatBtn.onclick = () => {
            if (typeof openChatWithUser === 'function') {
                openChatWithUser(targetUid, targetUsername);
            } else {
                alert("Sohbet sistemi şu anda yüklenemedi. Lütfen sayfayı yenileyin.");
                console.error("Critical: openChatWithUser function is missing.");
            }
        };

        // --- ARKADAŞLIK BUTONU DURUMLARI ---
        // Zaten arkadaş mı?
        if (friends.includes(targetUid)) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-user-minus"></i> Arkadaşlıktan Çıkar';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.onclick = async () => {
                await removeFriend(targetUid);
                await updateAddFriendButton(targetUid);
            };
        }
        // İstek gönderdik mi?
        else if (sentRequests.some(req => req.toUid === targetUid)) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İsteği iptal et';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.onclick = () => cancelFriendRequest(targetUid);
        }
        // İstek aldık mı?
        else if (friendRequests.some(req => req.fromUid === targetUid)) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İstek Bekleniyor';
            addFriendBtn.disabled = true;
            addFriendBtn.style.opacity = '0.6';
            addFriendBtn.style.cursor = 'default';
            addFriendBtn.onclick = (e) => e.preventDefault();
        }
        // Normal "Arkadaş Olarak Ekle"
        else {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaş Ol';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.onclick = () => sendFriendRequestToUid(targetUid, targetUsername);
        }
    } catch (error) {
        console.error("Buton güncelleme hatası:", error);
    }
}

// Profil sayfasında gönderilmiş isteği iptal etme
async function cancelFriendRequest(targetUid, targetUsername) {
    // targetUsername parameter is optional; not used currently
    if (!auth.currentUser) return;
    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        const meDoc = await getDoc(currentUserRef);
        const sent = (meDoc.data().sentRequests || []).filter(req => req.toUid !== targetUid);
        await updateDoc(currentUserRef, { sentRequests: sent });

        const themDoc = await getDoc(targetUserRef);
        const incoming = (themDoc.data().friendRequests || []).filter(req => req.fromUid !== auth.currentUser.uid);
        await updateDoc(targetUserRef, { friendRequests: incoming });

        // geri butonu geri al
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaş Ol';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.onclick = () => sendFriendRequest();
        }
    } catch (err) {
        console.error('İstek iptal etme hatası:', err);
        alert('İstek iptal edilemedi: ' + err.message);
    }
}

// Cancel helper for suggestion buttons
async function cancelFriendRequestToUid(targetUid, targetUsername) {
    // removed debug

    if (!auth.currentUser) return;
    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        const meDoc = await getDoc(currentUserRef);
        const sent = (meDoc.data().sentRequests || []).filter(req => req.toUid !== targetUid);
        await updateDoc(currentUserRef, { sentRequests: sent });

        const themDoc = await getDoc(targetUserRef);
        const incoming = (themDoc.data().friendRequests || []).filter(req => req.fromUid !== auth.currentUser.uid);
        await updateDoc(targetUserRef, { friendRequests: incoming });

        // feedback
        alert('✅ Arkadaşlık isteği iptal edildi.');

        const btn = document.getElementById('addFriendBtn_sugg_' + targetUid);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaş Ol';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.onclick = () => sendFriendRequestToUid(targetUid, targetUsername);
        }
    } catch (err) {
        console.error('Hızlı isteği iptal etme hatası:', err);
        alert('İstek iptal edilemedi: ' + err.message);
    }
}

// Profil sayfasını ziyaret ettiğiniz arkadaşın profilinizi açarsanız

function handleProfileAction() {
  const currentUser = auth.currentUser;
  const viewedUserId = new URLSearchParams(window.location.search).get('uid') || window.currentVisitedProfileUid;

  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  if (!viewedUserId || viewedUserId === currentUser.uid) {
    // KENDİ PROFİLİNDEYSE veya hedef bilinmiyorsa: Hiçbir şey yapma
    return;
  }

  if (typeof openChatWithUser === 'function') {
    openChatWithUser(viewedUserId, viewedUserId);
  }
}

function getGiftCardType(message) {
    if (!message) return null;
    const normalized = message.trim().toLowerCase();
    if (normalized === 'muhteşem yazıların için tebrikler!') return 'Muhteşem!';
    if (normalized === 'yazıların ilham veriyor, tebrikler!') return 'İlham Verici';
    if (normalized === 'paylaşımlarının çok değerli, başarılar!') return 'Değerli Paylaşımlar';
    return null;
}

function formatTebrikDate(value) {
    if (!value) return '';
    let date;
    if (typeof value.toDate === 'function') {
        date = value.toDate();
    } else if (value.seconds) {
        date = new Date(value.seconds * 1000);
    } else if (typeof value === 'number') {
        date = new Date(value);
    } else {
        date = new Date(value);
    }
    return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}



// --- Tebrik (congrats) feature REMOVED ---
// All tebrik/thanks functions stubbed to prevent runtime errors

window.sendTebrikToUid = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.sendBlogTebrikToAuthor = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.sendTebrikThanksForUser = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.retractTebrikFromProfile = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.sendTebrikByUsername = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.sendTebrikByUsernameWithMessage = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.openTebrikModal = function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.openTebrikModalForProfile = function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.closeTebrikModal = function() { };
window.sendTebrikFromModal = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.sendTebrikToUsernameQuick = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.sendTebrikCurrentProfile = async function() { alert('Tebrik özelliği devre dışı bırakılmıştır.'); };
window.loadTopTebrikList = async function() { };
window.updateProfileTebrikUI = async function() { };
window.toggleCongratsValueTable = function() { };
window.loadLatestTebriklerPreview = async function() { };
window.loadProfileCongrats = async function() { };
window.getGiftCardType = function() { return null; };
window.renderCongratsValueTable = function() { };


// Delegated input listener for character counts
// works even when elements are injected later
document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'postInput' && typeof updatePostCount === 'function') {
        updatePostCount();
    }
    if (t.id.startsWith('input-') && typeof updateCommentCount === 'function') {
        const postId = t.id.replace('input-', '');
        updateCommentCount(postId);
    }
});

// poll button next to share composer



// Paylaş Menüsü
window.openShareMenu = function(postId) {
    // always recreate the share modal so new options (like polls) appear even if it was built earlier
    const existing = document.getElementById('share-modal');
    if (existing) existing.remove();
    const modal = createShareModal();
    modal.style.display = 'flex';
    
    // Paylaş seçeneklerini güncelle
    const baseUrl = window.location.href.split('#')[0];
    const shareUrl = `${baseUrl}#${postId}`;
    const shareText = 'SosyaLTrend\'te bir gönderi gördüm. Sana da göstermek istiyorum!';
    
    try {
        document.getElementById('share-whatsapp').onclick = function() {
            const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
            modal.style.display = 'none';
        };
        
        document.getElementById('share-twitter').onclick = function() {
            const text = encodeURIComponent(shareText);
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
            modal.style.display = 'none';
        };
        
        document.getElementById('share-facebook').onclick = function() {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
            modal.style.display = 'none';
        };
        
        document.getElementById('share-copy-link').onclick = function() {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('Bağlantı kopyalandı!');
                modal.style.display = 'none';
            }).catch(() => {
                alert('Kopyalanamadı, lütfen elle kopyala: ' + shareUrl);
            });
        };
        
        document.getElementById('share-copy-embed').onclick = function() {
            const embedCode = `<iframe src="${shareUrl}" width="100%" height="400" frameborder="0" style="border-radius: 12px;"></iframe>`;
            navigator.clipboard.writeText(embedCode).then(() => {
                alert('Embed kodu kopyalandı!');
                modal.style.display = 'none';
            }).catch(() => {
                alert('Kopyalanamadı');
            });
        };
    } catch(e) {
        console.error('Share menu hata:', e);
    }

    // Hide mobile footer nav at absolute page bottom; show it again when user scrolls up.
    try {
        const mobileBottomNav = document.getElementById('mobileBottomNav');
        if (mobileBottomNav) {
            const updateMobileBottomNavVisibility = () => {
                if (window.innerWidth > 768) {
                    mobileBottomNav.classList.remove('is-at-page-bottom');
                    return;
                }

                const doc = document.documentElement;
                const scrollTop = window.pageYOffset || doc.scrollTop || 0;
                const viewportHeight = window.innerHeight || doc.clientHeight || 0;
                const pageHeight = Math.max(doc.scrollHeight, document.body?.scrollHeight || 0);
                const atPageBottom = (scrollTop + viewportHeight) >= (pageHeight - 2);

                mobileBottomNav.classList.toggle('is-at-page-bottom', atPageBottom);
            };

            updateMobileBottomNavVisibility();
            window.addEventListener('scroll', updateMobileBottomNavVisibility, { passive: true });
            window.addEventListener('resize', updateMobileBottomNavVisibility);
        }
    } catch (e) {
        console.warn('Mobile bottom nav scroll visibility init error', e);
    }
};

function createShareModal() {
    const modal = document.createElement('div');
    modal.id = 'share-modal';
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-modal-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="margin:0; font-weight:700;">Gönderiyi Paylaş</h3>
                <button onclick="document.getElementById('share-modal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">✕</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="share-whatsapp" class="share-option" style="background:rgba(37,211,102,0.1); color:#25d366; border:1px solid #25d366;">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp'de Paylaş
                </button>
                <button id="share-twitter" class="share-option" style="background:rgba(29,155,240,0.1); color:#1d9bf0; border:1px solid #1d9bf0;">
                    <i class="fa-brands fa-twitter"></i> Twitter'da Paylaş
                </button>
                <button id="share-facebook" class="share-option" style="background:rgba(59,89,152,0.1); color:#3b5998; border:1px solid #3b5998;">
                    <i class="fa-brands fa-facebook"></i> Facebook'da Paylaş
                </button>
                <button id="share-copy-link" class="share-option" style="background:var(--input-bg); color:var(--text);">
                    <i class="fa-solid fa-link"></i> Bağlantıyı Kopyala
                </button>
                <button id="share-copy-embed" class="share-option" style="background:var(--input-bg); color:var(--text);">
                    <i class="fa-solid fa-code"></i> Embed Kodunu Kopyala
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    return modal;
}

// Beğenenleri göster fonksiyonu - 3 avatar + "X Diğer" butonu
window.populateLikersPreview = async (postId, likes) => {
    try {
        const container = document.getElementById(`likers-${postId}`);
        if (!container) return;
        container.innerHTML = '';
        if (!likes || likes.length === 0) return;

        const preview = likes.slice(0, 3);
        const userDataMap = {};
        
        // Firestore'dan avatar bilgilerini çek
        try {
            const q = query(collection(db, 'users'), where('username', 'in', preview));
            const snap = await getDocs(q);
            snap.forEach(doc => { 
                userDataMap[doc.data().username] = doc.data(); 
            });
        } catch (e) {
            console.warn('Avatar query failed, using fallbacks', e);
        }

        // 3 avatarı göster
        preview.forEach(username => {
            const userData = userDataMap[username];
            const avatar = getAvatarUrl(userData?.avatarUrl || userData?.avatar);
            const img = document.createElement('img');
            img.src = avatar;
            img.title = userData?.displayName || username;
            img.style.cssText = 'width:28px;height:28px;border-radius:50%;border:2px solid var(--card-bg);object-fit:cover;cursor:pointer;';
            img.onclick = () => { window.location.href = `profil.html?id=${encodeURIComponent(username)}`; };
            container.appendChild(img);
        });

        // "X Diğer" butonu (3'ten fazla varsa)
        if (likes.length > 3) {
            const othersBtn = document.createElement('button');
            othersBtn.className = 'mini-link-btn';
            othersBtn.style.cssText = 'background:none;border:none;color:var(--primary);font-weight:700;cursor:pointer;font-size:0.85rem;padding:0;';
            othersBtn.textContent = `(${likes.length - 3}) diğer beğenen kişiler.`;
            othersBtn.onclick = () => { window.openLikersModal(postId); };
            container.appendChild(othersBtn);
        }
    } catch (e) {
        console.error('populateLikersPreview error:', e);
    }
};

// Beğenenleri gösteren modal
window.openLikersModal = async (postId) => {
    try {
        const modal = document.getElementById('likers-modal') || createLikersModal();
        modal.style.display = 'flex';

        // Gönderiden beğenenleri al
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) {
            document.getElementById('likers-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Gönderi bulunamadı</div>';
            return;
        }
        
        const likes = postSnap.data().likes || [];
        if (likes.length === 0) {
            document.getElementById('likers-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Henüz beğenen yok</div>';
            return;
        }

        // Batch ile kullanıcı verilerini çek (max 10 per query)
        const chunks = [];
        for (let i=0; i<likes.length; i+=10) {
            chunks.push(likes.slice(i, i+10));
        }
        
        const users = [];
        for (const chunk of chunks) {
            try {
                const q = query(collection(db, 'users'), where('username', 'in', chunk));
                const snap = await getDocs(q);
                snap.forEach(d => { 
                    users.push(d.data()); 
                });
            } catch(e) {
                console.warn('Batch query failed', e);
            }
        }

        // Map yap - order koru
        const userMap = {};
        users.forEach(u => { 
            if (u.username) userMap[u.username] = u; 
        });

        // HTML render et
        const listHtml = likes.map(username => {
            const userData = userMap[username];
            const avatar = getAvatarUrl(userData?.avatarUrl || userData?.avatar);
            const name = userData?.displayName || username;
            return `<div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); cursor:pointer;" onclick="window.location.href='profil.html?id=${encodeURIComponent(username)}'">
                        <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                        <div style="flex:1;">
                            <div style="font-weight:700; font-size:0.9rem;">${name}</div>
                            <div style="font-size:0.8rem;color:var(--text-muted)">@${username}</div>
                        </div>
                    </div>`;
        }).join('');

        document.getElementById('likers-list').innerHTML = listHtml;
    } catch (e) {
        console.error('openLikersModal error:', e);
        document.getElementById('likers-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Yüklenemedi</div>';
    }
};

// Likers modal'ı oluştur
function createLikersModal() {
    const modal = document.createElement('div');
    modal.id = 'likers-modal';
    modal.className = 'share-modal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div class="share-modal-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0; font-weight:700; font-size:1.1rem;">Beğenenler</h3>
                <button onclick="document.getElementById('likers-modal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">✕</button>
            </div>
            <div id="likers-list" style="max-height:60vh; overflow-y:auto; min-width:350px;">
                <div style="padding:20px;text-align:center;color:var(--text-muted)">Yükleniyor...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { 
        if (e.target === modal) modal.style.display = 'none'; 
    });
    return modal;
}

window.sendFriendRequestToUid = sendFriendRequestToUid;
// expose cancel helpers globally so inline onclick handlers can call them
window.cancelFriendRequest = cancelFriendRequest;
window.cancelFriendRequestToUid = cancelFriendRequestToUid;

// logging for debugging cache/availability
// debug removed



// ========================
// CHAT WIDGET FUNCTIONALITY
// ========================

let currentChatUserId = null;
let currentChatUsername = null;
let currentConversationId = null;
let currentConversationIsGroup = false;
let currentGroupMembers = [];
let chatInactivityTimer = null;
let messagesUnsubscribe = null;
let typingUnsubscribe = null;

function resetConversationListItemState(conversationId) {
    if (!conversationId) return;

    const items = document.querySelectorAll('.chat-friend-item[data-conversation-id]');
    items.forEach((item) => {
        if (item.dataset.conversationId !== String(conversationId)) return;

        const unreadBadge = item.querySelector('.chat-last-sender');
        if (unreadBadge) {
            unreadBadge.remove();
        }

        const actionButton = item.querySelector('.chat-friend-action.chat-friend-chat');
        if (actionButton) {
            actionButton.classList.remove('has-unread');
        }
    });
}

function getHiddenConversationListStorageKey() {
    return `chat-hidden-conversations:${auth.currentUser?.uid || 'guest'}`;
}

function getHiddenConversationIds() {
    try {
        const stored = localStorage.getItem(getHiddenConversationListStorageKey());
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
        console.warn('Gizlenen sohbetler okunamadı:', error);
        return [];
    }
}

function saveHiddenConversationIds(hiddenIds) {
    try {
        localStorage.setItem(getHiddenConversationListStorageKey(), JSON.stringify(hiddenIds));
    } catch (error) {
        console.warn('Gizlenen sohbetler kaydedilemedi:', error);
    }
}

function hideConversationFromRecentChats(conversationId) {
    if (!conversationId) return;
    const normalizedId = String(conversationId);
    const currentHiddenIds = getHiddenConversationIds();
    if (currentHiddenIds.includes(normalizedId)) return;
    const nextHiddenIds = [...currentHiddenIds, normalizedId];
    saveHiddenConversationIds(nextHiddenIds);
}

function shouldHideConversation(conversationId) {
    if (!conversationId) return false;
    return getHiddenConversationIds().includes(String(conversationId));
}

function unhideConversationFromRecentChats(conversationId) {
    if (!conversationId) return;
    const normalizedId = String(conversationId);
    const currentHiddenIds = getHiddenConversationIds();
    if (!currentHiddenIds.includes(normalizedId)) return;
    const nextHiddenIds = currentHiddenIds.filter(id => id !== normalizedId);
    saveHiddenConversationIds(nextHiddenIds);
}

async function markConversationAsRead(conversationId) {
    if (!conversationId || !auth.currentUser) return;

    try {
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
            [`unreadCount.${auth.currentUser.uid}`]: 0
        });
    } catch (error) {
        console.warn('Konuşma okunma durumu güncellenemedi:', error);
    }

    resetConversationListItemState(conversationId);
    if (typeof updateChatUnreadIndicator === 'function') {
        await updateChatUnreadIndicator();
    }
}

// Note: `initChatWidget` implementation moved to `assets/js/chat-widget.js`.
// Loader at the top of this file loads it dynamically; duplicate legacy definition removed.

function setGroupMembersBarVisible(visible) {
    const bar = document.getElementById('group-chat-members-bar');
    if (!bar) return;
    bar.style.display = visible ? 'flex' : 'none';
}

function setChatClearButtonVisibility(visible = false) {
    const clearBtn = document.getElementById('chat-clear-btn');
    if (clearBtn) {
        clearBtn.style.display = visible ? 'inline-flex' : 'none';
    }
}

function setGroupChatHeaderActionsVisibility(isGroup = false, ownerUid = null) {
    const actionsBar = document.getElementById('group-chat-actions-bar');
    const deleteBtn = document.getElementById('group-chat-delete-btn');
    const leaveBtn = document.getElementById('group-chat-leave-btn');
    const currentUserId = auth.currentUser?.uid;
    const canDelete = Boolean(isGroup && currentUserId && ownerUid && currentUserId === ownerUid);

    if (actionsBar) {
        actionsBar.style.display = isGroup ? 'flex' : 'none';
    }
    if (deleteBtn) {
        deleteBtn.style.display = canDelete ? 'inline-flex' : 'none';
    }
    if (leaveBtn) {
        leaveBtn.style.display = isGroup ? 'inline-flex' : 'none';
    }
    setChatClearButtonVisibility(Boolean(currentConversationId));
}

async function renderGroupChatMembersBar(participantIds = []) {
    const bar = document.getElementById('group-chat-members-bar');
    if (!bar) return;

    if (!currentConversationIsGroup || !participantIds.length) {
        currentGroupMembers = [];
        setGroupMembersBarVisible(false);
        bar.innerHTML = '';
        return;
    }

    const uniqueIds = Array.from(new Set(participantIds.filter(Boolean)));
    const members = [];
    const currentUserId = auth.currentUser?.uid;

    for (const memberId of uniqueIds) {
        if (currentUserId && memberId === currentUserId) continue;

        try {
            const userSnap = await getDoc(doc(db, 'users', memberId));
            if (userSnap.exists()) {
                const data = userSnap.data();
                const presence = resolvePresenceStatus(data);
                members.push({
                    uid: memberId,
                    displayName: data.displayName || data.username || memberId,
                    username: data.username || 'user',
                    avatarUrl: getAvatarUrl(data.avatarUrl || 'assets/img/strendsaydamv2.png', 'user'),
                    isOnline: presence.status === 'online',
                    presenceLabel: presence.label || 'Çevrimdışı'
                });
            }
        } catch (error) {
            console.warn('Grup üyesi yüklenirken hata:', error);
        }
    }

    currentGroupMembers = members;
    if (!members.length) {
        setGroupMembersBarVisible(false);
        bar.innerHTML = '';
        return;
    }

    const previewCount = 4;
    bar.innerHTML = `
        <div class="group-chat-members-list">
            ${members.slice(0, previewCount).map(member => `
                <div class="group-chat-member-avatar-wrap" title="${escapeHtml(member.displayName)} (${member.presenceLabel})">
                    <img src="${member.avatarUrl}" class="group-chat-member-avatar" alt="${escapeHtml(member.displayName)}">
                    <span class="group-chat-member-status ${member.isOnline ? 'online' : 'offline'}"></span>
                </div>
            `).join('')}
            ${members.length > previewCount ? `<span class="group-chat-member-more">+${members.length - previewCount}</span>` : ''}
        </div>
        <button type="button" class="group-chat-view-members-btn" onclick="window.showGroupMembersModal()">Tümünü gör</button>
    `;
    setGroupMembersBarVisible(true);
}

window.showGroupMembersModal = function() {
    if (!currentGroupMembers.length) return;

    const existingModal = document.getElementById('group-members-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'group-members-modal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:6000; display:flex; align-items:center; justify-content:center; padding:20px;';

    const card = document.createElement('div');
    card.style.cssText = 'width:min(480px, 100%); background:var(--card-bg, #fff); border-radius:16px; padding:18px; box-shadow:0 16px 48px rgba(0,0,0,0.25);';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px;">
            <h3 style="margin:0; font-size:1.02rem;">Grup Üyeleri</h3>
            <button type="button" onclick="document.getElementById('group-members-modal')?.remove()" style="background:none; border:none; font-size:1.3rem; cursor:pointer; color:var(--text-main);">×</button>
        </div>
        <div style="display:grid; gap:10px;">
            ${currentGroupMembers.map(member => `
                <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; background:rgba(255,255,255,0.04);">
                    <img src="${member.avatarUrl}" style="width:42px; height:42px; border-radius:50%; object-fit:cover;">
                    <div>
                        <div style="font-weight:700;">${escapeHtml(member.displayName)}</div>
                        <div style="font-size:0.85rem; color:var(--text-muted);">@${escapeHtml(member.username)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    modal.appendChild(card);
    document.body.appendChild(modal);
};

// Initialize chat lists panel
function initChatListsPanel() {
    if (document.getElementById('chat-lists-panel')) return;
    
    const chatListsPanel = document.createElement('div');
    chatListsPanel.id = 'chat-lists-panel';
    chatListsPanel.className = 'chat-lists-panel';
    chatListsPanel.innerHTML = `
        <div class="chat-lists-header">
            <h3><i class="fa-solid fa-comment-dots"></i> <span class="chat-btn-text">Sohbet Et</span></h3>
            <div class="chat-lists-header-actions">
                <button class="icon-btn" onclick="toggleChatSearch()" title="Sohbet ara">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </button>
                <button class="close-btn" onclick="closeChatsList()">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        </div>
        <div class="chat-lists-footer" style="padding:0 18px 12px;">
            <div class="chat-lists-footer-actions" style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 8px;">
                <button type="button" class="chat-action-btn chat-action-primary" onclick="loadRecentChats()" style="flex:1; min-width: 140px;">
                    <i class="fa-solid fa-clock-rotate-left"></i> Son Sohbetler
                </button>
                <button type="button" class="chat-action-btn chat-action-primary" onclick="loadChatFriends()" style="flex:1; min-width: 140px;">
                    <i class="fa-solid fa-users"></i> Arkadaşlarım
                </button>
            </div>
        </div>
        <div class="chat-lists-search" id="chat-lists-search" style="display:none; padding:0 18px 10px;">
            <input 
                type="text" 
                id="chat-friends-search" 
                placeholder="Sohbet ara..."
                oninput="filterChatFriends(this.value)"
            >
        </div>
        <div class="chat-load-more-toolbar" style="display:none; padding:0 18px 10px;">
            <button id="chat-load-more-btn" type="button" class="chat-action-secondary" onclick="showMoreRecentChats()" style="width:100%; justify-content:center;">
                <i class="fa-solid fa-chevron-down"></i> Daha fazla yükle
            </button>
        </div>
        <div class="chat-lists-content" id="chat-friends-list">
            <div class="chat-lists-empty">
                <i class="fa-solid fa-spinner"></i>
                <p>Arkadaşlar yükleniyor...</p>
            </div>
        </div>
        <div class="chat-lists-footer" style="padding:0 18px 12px;">
            <div style="border-top:1px solid var(--border, rgba(255,255,255,0.12)); padding-top:10px; display:grid; gap:8px;">
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="chat-action-btn chat-action-primary" onclick="window.showChatHistoryView()" style="flex:1; min-width:140px; justify-content:center;">
                        <i class="fa-solid fa-clock-rotate-left"></i> Sohbet Geçmişi
                    </button>
                </div>
            </div>
            <button id="chat-add-friend-btn" class="chat-action-btn chat-action-secondary" onclick="addFriendFromChat()" title="Arkadaş ekle" style="display:none; width:100%; justify-content:center; margin-top:10px;">
                <i class="fa-solid fa-user-plus"></i> Arkadaş ekle
            </button>
        </div>
    `;
    
    document.body.appendChild(chatListsPanel);
}

window.showChatHistoryView = function() {
    window.__chatHistoryPending = true;

    if (!document.getElementById('chat-widget-container')) {
        initChatWidget();
    }

    const widget = document.getElementById('chat-widget-container');
    if (widget) {
        widget.classList.add('active');
    }

    const titleEl = document.getElementById('chat-widget-title');
    if (titleEl) {
        titleEl.textContent = 'Sohbet Geçmişi';
    }

    const messagesContainer = document.getElementById('chat-widget-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="chat-empty"><i class="fa-regular fa-comment"></i><p>Sohbet geçmişi yükleniyor...</p></div>';
    }

    setChatWidgetInputVisible(false);
    setChatClearButtonVisibility(false);
    setGroupChatHeaderActionsVisibility(false);
    currentConversationId = null;
    currentChatUserId = null;
    currentChatUsername = null;
    currentConversationIsGroup = false;
    currentGroupMembers = [];

    document.body.classList.add('chat-open');
    window.closeChatsList && window.closeChatsList();

    const renderHistory = () => {
        const container = document.getElementById('chat-widget-messages');
        if (!container) {
            if (window.__chatHistoryPending) {
                setTimeout(renderHistory, 120);
            }
            return;
        }

        window.__chatHistoryPending = false;
        if (typeof window.renderChatHistoryInWidget === 'function') {
            window.renderChatHistoryInWidget();
        }
    };

    renderHistory();
};

function setChatWidgetInputVisible(visible = true) {
    const inputShell = document.querySelector('#chat-widget-container .chat-widget-input');
    if (inputShell) {
        inputShell.style.display = visible ? 'flex' : 'none';
    }
}

window.renderChatHistoryInWidget = async function() {
    const messagesContainer = document.getElementById('chat-widget-messages');
    const titleEl = document.getElementById('chat-widget-title');
    if (!messagesContainer) return;

    if (titleEl) {
        titleEl.textContent = 'Sohbet Geçmişi';
    }

    setChatWidgetInputVisible(false);
    setChatClearButtonVisibility(false);
    setGroupChatHeaderActionsVisibility(false);

    if (!auth.currentUser) {
        messagesContainer.innerHTML = '<div class="chat-empty"><i class="fa-solid fa-lock"></i><p>Lütfen giriş yapın</p></div>';
        return;
    }

    messagesContainer.innerHTML = '<div class="chat-empty"><i class="fa-solid fa-spinner"></i><p>Geçmiş yükleniyor...</p></div>';

    try {
        const currentUserId = auth.currentUser.uid;
        let convSnap;

        try {
            convSnap = await getDocs(query(
                collection(db, 'conversations'),
                where('participants', 'array-contains', currentUserId)
            ));
        } catch (queryError) {
            console.warn('Geçmiş sorgusu başarısız, yedek listeleme denenecek:', queryError);
            convSnap = await getDocs(collection(db, 'conversations'));
        }

        const conversations = (convSnap.docs || [])
            .filter((docSnap) => {
                const convData = docSnap.data() || {};
                const participants = Array.isArray(convData.participants) ? convData.participants : [];
                return participants.includes(currentUserId);
            })
            .sort((a, b) => {
                const aTime = a.data()?.lastMessageAt?.toDate ? a.data().lastMessageAt.toDate().getTime() : 0;
                const bTime = b.data()?.lastMessageAt?.toDate ? b.data().lastMessageAt.toDate().getTime() : 0;
                return bTime - aTime;
            });

        if (!conversations.length) {
            messagesContainer.innerHTML = '<div class="chat-empty"><i class="fa-regular fa-comment"></i><p>Henüz sohbet geçmişi yok</p></div>';
            return;
        }

        const historyHtml = [];
        for (const docSnap of conversations) {
            const convData = docSnap.data() || {};
            const conversationId = docSnap.id;
            const isGroup = Boolean(convData.group);
            const lastMessage = convData.lastMessage || 'Sohbet temizlendi';
            const lastSenderId = convData.lastSenderId || null;
            let displayName = 'Sohbet';
            let username = '';
            let avatarUrl = 'assets/img/strendsaydamv2.png';
            let previewLabel = 'Sohbet';

            if (isGroup) {
                displayName = convData.groupName || 'Grup Sohbeti';
                previewLabel = 'Grup';
            } else {
                const otherParticipantId = (convData.participants || []).find((id) => id !== currentUserId);
                if (otherParticipantId) {
                    try {
                        const friendSnap = await getDoc(doc(db, 'users', otherParticipantId));
                        if (friendSnap.exists()) {
                            const friendData = friendSnap.data();
                            avatarUrl = getAvatarUrl(friendData.avatarUrl || 'assets/img/strendsaydamv2.png', 'user');
                            displayName = friendData.displayName || friendData.username || otherParticipantId;
                            username = friendData.username || 'user';
                        }
                    } catch (error) {
                        console.warn('Geçmişte kullanıcı bilgisi alınamadı:', error);
                    }
                }
            }

            const previewText = lastSenderId === currentUserId
                ? `Sen: ${lastMessage || 'Mesaj yok'}`
                : `${isGroup ? 'Grup' : displayName}: ${lastMessage || 'Mesaj yok'}`;

            historyHtml.push(`
                <div class="chat-friend-item" style="cursor:pointer;" onclick="window.openConversationFromList('${conversationId}', '${displayName}', ${isGroup})">
                    <div class="chat-friend-avatar-wrap online">
                        <img src="${avatarUrl}" class="chat-friend-avatar" alt="">
                    </div>
                    <div class="chat-friend-info">
                        <p class="chat-friend-name">${escapeHtml(displayName)}</p>
                        <p class="chat-friend-lastmsg">${escapeHtml(previewText)}</p>
                    </div>
                </div>
            `);
        }

        messagesContainer.innerHTML = `
            <div style="display:grid; gap:8px; padding:4px 0;">
                ${historyHtml.join('')}
            </div>
        `;
    } catch (error) {
        console.error('Sohbet geçmişi yüklenirken hata:', error);
        messagesContainer.innerHTML = '<div class="chat-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Geçmiş yüklenemedi</p></div>';
    }
};

function ensureGroupCreateActionButton(container) {
    if (!container) return;
    let existing = container.querySelector('#chat-create-group-btn-wrap');
    if (existing) return;

    const wrap = document.createElement('div');
    wrap.id = 'chat-create-group-btn-wrap';
    wrap.style.cssText = 'padding: 10px 14px 0; border-top: 1px solid var(--border, rgba(255,255,255,0.12)); margin-top: 8px;';
    wrap.innerHTML = `
        <button type="button" class="chat-action-btn chat-action-primary" onclick="window.openCreateGroupChatModal()" style="width:100%; justify-content:center;">
            <i class="fa-solid fa-user-group"></i> + Grup Oluştur
        </button>
    `;
    container.appendChild(wrap);
}

function removeGroupCreateActionButton(container) {
    if (!container) return;
    const existing = container.querySelector('#chat-create-group-btn-wrap');
    if (existing) existing.remove();
}

window.openConversationFromList = async function(conversationId, displayName, isGroup) {
    if (!auth.currentUser) return;

    if (conversationId) {
        unhideConversationFromRecentChats(conversationId);
    }

    if (isGroup) {
        const normalizedConversationId = String(conversationId || '');
        const groupIdentifier = normalizedConversationId.replace(/^group_/, '');
        const existingConvRef = doc(db, 'conversations', normalizedConversationId);
        const existingConvSnap = await getDoc(existingConvRef);
        const existingParticipants = existingConvSnap.exists() ? (existingConvSnap.data().participants || []) : [];
        await window.openGroupChat(normalizedConversationId || groupIdentifier, displayName, existingParticipants);
    } else {
        const currentUserId = auth.currentUser.uid;
        const otherParticipantId = String(conversationId || '').split('_').find(id => id && id !== currentUserId);
        if (otherParticipantId) {
            await openChatWithUser(otherParticipantId, displayName);
        }
    }

    window.closeChatsList();
};

window.openCreateGroupChatModal = async function() {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    const currentUserId = auth.currentUser.uid;
    const userRef = doc(db, 'users', currentUserId);
    const userSnap = await getDoc(userRef);
    const friendsIds = Array.isArray(userSnap.exists() ? userSnap.data().friends : []) ? (userSnap.data().friends || []) : [];

    if (!friendsIds.length) {
        alert('Önce en az bir arkadaş ekleyin.');
        return;
    }

    const existingModal = document.getElementById('create-group-chat-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'create-group-chat-modal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000002; display:flex; align-items:center; justify-content:center; padding:20px;';

    const card = document.createElement('div');
    card.style.cssText = 'width:min(560px, 100%); max-height:80vh; overflow:auto; background:var(--card-bg, #fff); border-radius:16px; padding:18px; box-shadow:0 16px 48px rgba(0,0,0,0.25); position:relative; z-index:1000003;';

    const friendItems = [];
    for (const friendId of friendsIds) {
        try {
            const friendSnap = await getDoc(doc(db, 'users', friendId));
            if (!friendSnap.exists()) continue;
            const friendData = friendSnap.data();
            const displayName = friendData.displayName || friendData.username || friendId;
            const username = friendData.username || 'user';
            const avatarUrl = getAvatarUrl(friendData.avatarUrl || 'assets/img/strendsaydamv2.png', 'user');
            friendItems.push(`
                <label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--border, rgba(255,255,255,0.12)); border-radius:12px; cursor:pointer; background:rgba(255,255,255,0.03);">
                    <input type="checkbox" class="group-member-checkbox" value="${friendId}" style="accent-color: var(--primary, #6366f1);">
                    <img src="${avatarUrl}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <span style="display:flex; flex-direction:column; min-width:0;">
                        <strong style="font-size:0.92rem;">${escapeHtml(displayName)}</strong>
                        <small style="color:var(--text-muted);">@${escapeHtml(username)}</small>
                    </span>
                </label>
            `);
        } catch (error) {
            console.error('Grup arkadaşı yüklenirken hata:', error);
        }
    }

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px;">
            <div>
                <h3 style="margin:0; font-size:1.05rem;">Yeni Grup Sohbeti</h3>
                <p style="margin:4px 0 0; color:var(--text-muted); font-size:0.9rem;">İstediğin kadar arkadaş seçip grup sohbeti oluşturabilirsin.</p>
            </div>
            <button type="button" onclick="this.closest('#create-group-chat-modal').remove()" style="background:none; border:none; color:var(--text-main); font-size:1.3rem; cursor:pointer;">×</button>
        </div>
        <div style="display:grid; gap:10px; margin-bottom:12px;">
            <label style="font-weight:700; font-size:0.9rem;">Grup adı</label>
            <input id="group-chat-name-input" type="text" placeholder="Örn. Takım Sohbeti" style="width:100%; padding:10px 12px; border-radius:10px; border:1px solid var(--border, rgba(255,255,255,0.12)); background:var(--input-bg, rgba(255,255,255,0.05)); color:var(--text-main);">
        </div>
        <div style="display:grid; gap:8px; margin-bottom:12px;">
            ${friendItems.length ? friendItems.join('') : '<div style="color:var(--text-muted);">Arkadaş bulunamadı.</div>'}
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" onclick="document.getElementById('create-group-chat-modal')?.remove()" class="chat-action-btn chat-action-secondary">İptal</button>
            <button type="button" id="create-group-chat-btn" class="chat-action-btn chat-action-primary"><i class="fa-solid fa-comments"></i> Oluştur</button>
        </div>
    `;

    const createBtn = card.querySelector('#create-group-chat-btn');
    createBtn.onclick = async () => {
        const selectedIds = Array.from(card.querySelectorAll('.group-member-checkbox:checked')).map(el => el.value).filter(Boolean);
        if (!selectedIds.length) {
            alert('En az bir arkadaş seçin.');
            return;
        }
        const groupName = card.querySelector('#group-chat-name-input').value.trim() || 'Yeni Grup';
        const members = Array.from(new Set([currentUserId, ...selectedIds]));
        await window.openGroupChat(Date.now().toString(), groupName, members);
        modal.remove();
    };

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    modal.appendChild(card);
    document.body.appendChild(modal);
};

// Open or close chat friends list
window.openChatsList = async function(forceOpen = false) {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    if (!document.getElementById('chat-lists-panel')) {
        initChatListsPanel();
    }

    const panel = document.getElementById('chat-lists-panel');
    if (!panel) return;

    if (forceOpen || !panel.classList.contains('active')) {
        panel.classList.add('active');
        panel.style.display = 'flex';
        document.body.classList.add('chat-open');
        if (typeof loadRecentChats === 'function') {
            loadRecentChats();
        }
        return;
    }

    panel.classList.remove('active');
    panel.style.display = 'none';
    document.body.classList.remove('chat-open');
}

// Close chat lists
window.closeChatsList = function() {
    const panel = document.getElementById('chat-lists-panel');
    if (panel) {
        panel.classList.remove('active');
        panel.style.display = 'none';
    }
    document.body.classList.remove('chat-open');
}

// Load friends for chat

window.loadChatFriends = async function() {
    const friendsList = document.getElementById('chat-friends-list');
    const loadMoreToolbar = document.getElementById('chat-load-more-btn');
    if (loadMoreToolbar) loadMoreToolbar.style.display = 'none';
    if (!friendsList) return;
    if (!auth.currentUser) {
        const retryKey = '_loadFriendsRetry';
        window[retryKey] = (window[retryKey] || 0) + 1;
        if (window[retryKey] <= 3) {
            setTimeout(() => window.loadChatFriends(), 600);
            return;
        }
        window[retryKey] = 0;
        friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-lock"></i><p>Lütfen giriş yapın</p></div>';
        return;
    }
    window['_loadFriendsRetry'] = 0;
    
    try {
        removeGroupCreateActionButton(friendsList);
        const currentUserId = auth.currentUser.uid;
        const userRef = doc(db, 'users', currentUserId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-user-slash"></i><p>Arkadaş bulunamadı</p></div>';
            return;
        }
        
        const userData = userSnap.data();
        const friendsIds = userData.friends || [];
        
        if (friendsIds.length === 0) {
            friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-user-plus"></i><p>Henüz arkadaşınız yok</p></div>';
            return;
        }
        
        // Get friend details
        let friendsHtml = '';
        for (const friendId of friendsIds) {
            try {
                const friendRef = doc(db, 'users', friendId);
                const friendSnap = await getDoc(friendRef);
                
                if (friendSnap.exists()) {
                    const friendData = friendSnap.data();
                    const avatarUrl = getAvatarUrl(friendData.avatarUrl || 'assets/img/strendsaydamv2.png', 'user');
                    const displayName = friendData.displayName || friendData.username || friendId;
                    const username = friendData.username || 'user';
                    const presence = resolvePresenceStatus(friendData);
                    
                    friendsHtml += `
                        <div class="chat-friend-item" onclick="openChatWithFriend('${friendId}', '${displayName}', '${username}')">
                            <div class="chat-friend-avatar-wrap ${presence.status}">
                                <img src="${avatarUrl}" class="chat-friend-avatar" alt="">
                                <span class="status-badge status-${presence.status}"></span>
                            </div>
                            <div class="chat-friend-info">
                                <p class="chat-friend-name">${escapeHtml(displayName)}</p>
                                <p class="chat-friend-username">@${escapeHtml(username)}</p>
                                <p class="chat-friend-status">${escapeHtml(presence.label)}</p>
                            </div>
                            <div class="chat-friend-actions">
                                <button class="chat-friend-action chat-friend-chat" title="Mesaj yaz" onclick="event.stopPropagation(); openChatWithFriend('${friendId}', '${displayName}', '${username}')">
                                    <i class="fa-solid fa-comment-dots"></i>
                                </button>
                                <button class="chat-friend-action chat-friend-profile" title="Profili git" onclick="event.stopPropagation(); window.location.href='profil.html?id=${encodeURIComponent(username)}'">
                                    <i class="fa-solid fa-user"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Arkadaş yüklenirken hata:', error);
            }
        }
        
        const titleEl = document.querySelector('.chat-lists-title');
        if (titleEl) titleEl.textContent = 'Arkadaşlarım';
        friendsList.innerHTML = friendsHtml || '<div class="chat-lists-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Arkadaş yüklenemedi</p></div>';
        ensureGroupCreateActionButton(friendsList);
        
    } catch (error) {
        console.error('Arkadaşlar yüklenirken hata:', error);
        friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Arkadaşlar yüklenemedi</p></div>';
    }
}

async function conversationHasMessages(conversationId) {
    if (!conversationId) return false;
    try {
        const messagesQuery = query(
            collection(db, 'conversations', conversationId, 'messages'),
            limit(1)
        );
        const messagesSnap = await getDocs(messagesQuery);
        return !messagesSnap.empty;
    } catch (error) {
        console.warn('Konuşma mesaj durumu kontrol edilemedi:', error);
        return false;
    }
}

// Load recent chats when opening list
window.loadRecentChats = async function() {
    const friendsList = document.getElementById('chat-friends-list');
    const loadMoreToolbar = document.getElementById('chat-load-more-btn');
    if (loadMoreToolbar) loadMoreToolbar.style.display = 'none';
    if (!friendsList) return;
    if (!auth.currentUser) {
        /* Auth henüz hazır olmayabilir; 600ms sonra tekrar dene (max 3 deneme) */
        const retryKey = '_loadRecentRetry';
        window[retryKey] = (window[retryKey] || 0) + 1;
        if (window[retryKey] <= 3) {
            setTimeout(() => window.loadRecentChats(), 600);
            return;
        }
        window[retryKey] = 0;
        friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-lock"></i><p>Lütfen giriş yapın</p></div>';
        return;
    }
    window['_loadRecentRetry'] = 0;

    try {
        removeGroupCreateActionButton(friendsList);
        const currentUserId = auth.currentUser.uid;
        let convSnap;

        try {
            convSnap = await getDocs(query(
                collection(db, 'conversations'),
                where('participants', 'array-contains', currentUserId)
            ));
        } catch (queryError) {
            console.warn('array-contains sorgusu başarısız, yedek listeleme denenecek:', queryError);
            convSnap = await getDocs(collection(db, 'conversations'));
        }

        const conversations = (convSnap.docs || [])
            .filter((docSnap) => {
                const convData = docSnap.data() || {};
                const participants = Array.isArray(convData.participants) ? convData.participants : [];
                return participants.includes(currentUserId) && !shouldHideConversation(docSnap.id);
            })
            .sort((a, b) => {
                const aTime = a.data()?.lastMessageAt?.toDate ? a.data().lastMessageAt.toDate().getTime() : 0;
                const bTime = b.data()?.lastMessageAt?.toDate ? b.data().lastMessageAt.toDate().getTime() : 0;
                return bTime - aTime;
            })
            .slice(0, 20);

        if (!conversations.length) {
            friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-comment-slash"></i><p>Henüz sohbetiniz yok</p></div>';
            return;
        }

        const hiddenConversationIds = getHiddenConversationIds();
        const recentChats = [];
        for (const docSnap of conversations) {
            const convData = docSnap.data();
            const isGroup = !!convData.group;
            const conversationId = docSnap.id;
            const lastMessage = convData.lastMessage || 'Yeni sohbet';
            const lastSenderId = convData.lastSenderId || null;
            const unreadCount = convData.unreadCount?.[currentUserId] || 0;

            if (shouldHideConversation(conversationId)) {
                continue;
            }

            if (isGroup) {
                const groupName = convData.groupName || 'Grup Sohbeti';
                recentChats.push({
                    conversationId,
                    isGroup: true,
                    displayName: groupName,
                    username: 'group',
                    avatarUrl: 'assets/img/strendsaydamv2.png',
                    lastMessage,
                    lastSenderId,
                    unreadCount,
                    presence: { status: 'online', label: 'Grup' }
                });
                continue;
            }

            const otherParticipantId = (convData.participants || []).find(id => id !== currentUserId);
            if (!otherParticipantId) continue;

            try {
                const friendRef = doc(db, 'users', otherParticipantId);
                const friendSnap = await getDoc(friendRef);
                if (!friendSnap.exists()) continue;

                const friendData = friendSnap.data();
                const avatarUrl = getAvatarUrl(friendData.avatarUrl || 'assets/img/strendsaydamv2.png', 'user');
                const displayName = friendData.displayName || friendData.username || otherParticipantId;
                const username = friendData.username || 'user';
                const presence = resolvePresenceStatus(friendData);

                recentChats.push({ conversationId, otherParticipantId, displayName, username, avatarUrl, lastMessage, lastSenderId, unreadCount, presence, isGroup: false });
            } catch (error) {
                console.error('Sohbet kullanıcısı yüklenirken hata:', error);
            }
        }

        const titleEl = document.querySelector('.chat-lists-title');
        if (titleEl) titleEl.textContent = 'Sohbet Geçmişi';

        const loadMoreBtn = document.getElementById('chat-load-more-btn');
        if (recentChats.length > 2 && loadMoreBtn) {
            loadMoreBtn.style.display = 'inline-flex';
        }

        if (recentChats.length === 0) {
            friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-comment-slash"></i><p>Henüz sohbetiniz yok</p></div>';
            return;
        }

        let friendsHtml = '';
        for (let i = 0; i < recentChats.length; i++) {
            const chat = recentChats[i];
            const previewLabel = chat.lastSenderId === currentUserId ? 'Sen' : (chat.isGroup ? 'Grup' : chat.displayName);
            const previewText = `${previewLabel}: ${chat.lastMessage || 'Mesaj yok'}`;
            friendsHtml += `
                <div class="chat-friend-item" data-conversation-id="${chat.conversationId}" data-recent-index="${i}" onclick="window.openConversationFromList('${chat.conversationId}', '${chat.displayName}', ${chat.isGroup})">
                    <div class="chat-friend-avatar-wrap ${chat.presence?.status || 'offline'}">
                        <img src="${chat.avatarUrl}" class="chat-friend-avatar" alt="">
                        <span class="status-badge status-${chat.presence?.status || 'offline'}"></span>
                    </div>
                    <div class="chat-friend-info">
                        <p class="chat-friend-name">${escapeHtml(chat.displayName)}</p>
                        <p class="chat-friend-lastmsg">${escapeHtml(previewText)}</p>
                    </div>
                    <div class="chat-friend-meta">
                        ${chat.unreadCount > 0 ? `<span class="chat-last-sender"><strong>${chat.unreadCount}</strong> Yeni Mesaj</span>` : ''}
                        <div class="chat-friend-actions">
                            <button class="chat-friend-action chat-friend-chat${chat.isGroup ? ' group-conversation-action' : ''}${chat.unreadCount > 0 ? ' has-unread' : ''}" title="Mesaj yaz" onclick="event.stopPropagation(); window.openConversationFromList('${chat.conversationId}', '${chat.displayName}', ${chat.isGroup})">
                                <i class="fa-solid fa-comment-dots"></i>
                            </button>
                            ${!chat.isGroup ? `<button class="chat-friend-action chat-friend-profile" title="Profili git" onclick="event.stopPropagation(); window.location.href='profil.html?id=${encodeURIComponent(chat.username)}'">
                                <i class="fa-solid fa-user"></i>
                            </button>` : ''}
                            <button class="chat-friend-action chat-friend-close" title="Sohbeti kapat" onclick="event.stopPropagation(); window.closeConversationFromList(this)">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        friendsList.innerHTML = friendsHtml;
        if (recentChats.length > 2) {
            for (let i = 2; i < recentChats.length; i++) {
                const chat = recentChats[i];
                const previewLabel = chat.lastSenderId === currentUserId ? 'Sen' : (chat.isGroup ? 'Grup' : chat.displayName);
                const previewText = `${previewLabel}: ${chat.lastMessage || 'Mesaj yok'}`;
                const hiddenItem = document.createElement('div');
                hiddenItem.className = 'chat-friend-item hidden-recent';
                hiddenItem.style.display = 'none';
                hiddenItem.dataset.conversationId = chat.conversationId;
                hiddenItem.innerHTML = `
                    <div class="chat-friend-avatar-wrap ${chat.presence?.status || 'offline'}">
                        <img src="${chat.avatarUrl}" class="chat-friend-avatar" alt="">
                        <span class="status-badge status-${chat.presence?.status || 'offline'}"></span>
                    </div>
                    <div class="chat-friend-info">
                        <p class="chat-friend-name">${escapeHtml(chat.displayName)}</p>
                        <p class="chat-friend-lastmsg">${escapeHtml(previewText)}</p>
                    </div>
                    <div class="chat-friend-actions">
                        <button class="chat-friend-action chat-friend-chat${chat.isGroup ? ' group-conversation-action' : ''}${chat.unreadCount > 0 ? ' has-unread' : ''}" title="Mesaj yaz" onclick="event.stopPropagation(); window.openConversationFromList('${chat.conversationId}', '${chat.displayName}', ${chat.isGroup})">
                            <i class="fa-solid fa-comment-dots"></i>
                        </button>
                        ${!chat.isGroup ? `<button class="chat-friend-action chat-friend-profile" title="Profili git" onclick="event.stopPropagation(); window.location.href='profil.html?id=${encodeURIComponent(chat.username)}'">
                            <i class="fa-solid fa-user"></i>
                        </button>` : ''}
                        <button class="chat-friend-action chat-friend-close" title="Sohbeti kapat" onclick="event.stopPropagation(); window.closeConversationFromList(this)">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                `;
                hiddenItem.onclick = () => window.openConversationFromList(chat.conversationId, chat.displayName, chat.isGroup);
                friendsList.appendChild(hiddenItem);
            }
        }
    } catch (error) {
        console.error('Sohbetler yüklenirken hata:', error);
        friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Sohbetler yüklenemedi</p></div>';
    }
}

window.closeConversationFromList = function(buttonEl) {
    const item = buttonEl?.closest('.chat-friend-item');
    if (!item) return;

    const conversationId = item.dataset.conversationId;
    if (conversationId) {
        hideConversationFromRecentChats(conversationId);
    }

    item.remove();

    const friendsList = document.getElementById('chat-friends-list');
    if (!friendsList) return;

    const remainingItems = friendsList.querySelectorAll('.chat-friend-item');
    if (remainingItems.length === 0) {
        const titleEl = document.querySelector('.chat-lists-title');
        const emptyMessage = titleEl?.textContent?.includes('Arkadaşlar')
            ? '<div class="chat-lists-empty"><i class="fa-solid fa-user-check"></i><p>Liste temizlendi</p></div>'
            : '<div class="chat-lists-empty"><i class="fa-solid fa-comment-slash"></i><p>Henüz sohbetiniz yok</p></div>';
        friendsList.innerHTML = emptyMessage;
    }
};

window.showMoreRecentChats = function() {
    document.querySelectorAll('.chat-friend-item.hidden-recent').forEach(item => {
        item.style.display = 'flex';
        item.classList.remove('hidden-recent');
    });
    const loadMoreBtn = document.getElementById('chat-load-more-btn');
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
}

window.toggleChatSearch = function() {
    const searchRow = document.getElementById('chat-lists-search');
    const searchInput = document.getElementById('chat-friends-search');
    if (!searchRow) return;
    const isVisible = searchRow.style.display === 'block' || searchRow.style.display === 'flex';
    searchRow.style.display = isVisible ? 'none' : 'block';
    if (!isVisible && searchInput) {
        setTimeout(() => searchInput.focus(), 50);
    }
}

function setChatButtonUnreadState(hasUnread) {
    const headerBtn = document.getElementById('headerChatBtn');
    if (headerBtn) {
        headerBtn.classList.toggle('has-unread', hasUnread);
    }

    const mobileBtn = document.getElementById('mobileChatBtn');
    if (mobileBtn) {
        mobileBtn.classList.toggle('has-unread', hasUnread);
    }
}

async function updateChatUnreadIndicator() {
    if (!auth.currentUser) return;
    try {
        const currentUserId = auth.currentUser.uid;
        const conversationsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUserId)
        );
        const snap = await getDocs(conversationsQuery);
        const totalUnread = snap.docs.reduce((sum, convDoc) => {
            const data = convDoc.data();
            const unreadValue = data.unreadCount?.[currentUserId];
            const unread = Number(unreadValue || 0);
            return sum + (Number.isFinite(unread) ? unread : 0);
        }, 0);

        setChatButtonUnreadState(totalUnread > 0);

        const badge = document.getElementById('chat-unread-count');
        if (badge) {
            if (totalUnread > 0) {
                badge.style.display = 'inline-flex';
                badge.textContent = `${totalUnread} yeni`;
            } else {
                badge.style.display = 'none';
            }
        }

        const leftBadge = document.getElementById('chat-left-unread-count');
        if (leftBadge) {
            if (totalUnread > 0) {
                leftBadge.style.display = 'block';
                leftBadge.textContent = totalUnread === 1 ? '1 mesajınız var' : `${totalUnread} mesajınız var`;
            } else {
                leftBadge.style.display = 'none';
            }
        }

        const unreadBtn = document.getElementById('chat-unread-btn');
        if (unreadBtn) {
            if (totalUnread > 0) {
                unreadBtn.style.display = 'inline-flex';
                unreadBtn.innerHTML = `<i class="fa-solid fa-envelope-circle-check"></i> Okunmamış (${totalUnread})`;
            } else {
                unreadBtn.style.display = 'none';
            }
        }

        // Update header 'Sohbet Et' badge only if header button is still used for chat
        const headerBadge = document.getElementById('header-chat-unread');
        if (headerBadge) {
            if (totalUnread > 0) {
                headerBadge.style.display = 'inline-flex';
                headerBadge.textContent = totalUnread === 1 ? '1' : `${totalUnread}`;
            } else {
                headerBadge.style.display = 'none';
                headerBadge.textContent = '0';
            }
        }
    } catch (error) {
        console.warn('Okunmamış mesaj göstergesi güncellenirken hata:', error);
    }
}

window.loadUnreadChats = async function() {
    const friendsList = document.getElementById('chat-friends-list');
    const loadMoreToolbar = document.getElementById('chat-load-more-btn');
    if (loadMoreToolbar) loadMoreToolbar.style.display = 'none';
    if (!friendsList) return;
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    try {
        removeGroupCreateActionButton(friendsList);
        const currentUserId = auth.currentUser.uid;
        const conversationsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUserId),
            limit(50)
        );

        const convSnap = await getDocs(conversationsQuery);
        const unreadDocs = convSnap.docs
            .filter(docSnap => {
                const data = docSnap.data();
                return (data.unreadCount?.[currentUserId] || 0) > 0;
            })
            .sort((a, b) => {
            const aTime = a.data().lastMessageAt ? a.data().lastMessageAt.toMillis?.() || a.data().lastMessageAt : 0;
            const bTime = b.data().lastMessageAt ? b.data().lastMessageAt.toMillis?.() || b.data().lastMessageAt : 0;
            return bTime - aTime;
        });
        const titleEl = document.querySelector('.chat-lists-title');
        if (titleEl) titleEl.textContent = 'Okunmamış Mesajlar';

        if (convSnap.empty) {
            friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-envelope-open-text"></i><p>Okunmamış mesaj bulunmuyor</p></div>';
            return;
        }

        let friendsHtml = '';
        for (const docSnap of unreadDocs) {
            const convData = docSnap.data();
            const otherParticipantId = (convData.participants || []).find(id => id !== currentUserId);
            if (!otherParticipantId) continue;

            try {
                const friendRef = doc(db, 'users', otherParticipantId);
                const friendSnap = await getDoc(friendRef);
                if (!friendSnap.exists()) continue;

                const friendData = friendSnap.data();
                const avatarUrl = getAvatarUrl(friendData.avatarUrl || 'assets/img/strendsaydamv2.png', 'user');
                const displayName = friendData.displayName || friendData.username || otherParticipantId;
                const username = friendData.username || 'user';
                const lastMessage = convData.lastMessage || 'Yeni sohbet';
                const unreadCount = convData.unreadCount?.[currentUserId] || 0;

                friendsHtml += `
                    <div class="chat-friend-item" onclick="openChatWithFriend('${otherParticipantId}', '${displayName}', '${username}')">
                        <img src="${avatarUrl}" class="chat-friend-avatar" alt="">
                        <div class="chat-friend-info">
                            <p class="chat-friend-name">${escapeHtml(displayName)}</p>
                            <p class="chat-friend-lastmsg">${escapeHtml(lastMessage)}</p>
                        </div>
                        <div class="chat-friend-meta">
                            ${unreadCount > 0 ? `<span class="chat-last-sender"><strong>${unreadCount}</strong> Yeni Mesaj</span>` : ''}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Okunmamış sohbet kullanıcısı yüklenirken hata:', error);
            }
        }

        friendsList.innerHTML = friendsHtml || '<div class="chat-lists-empty"><i class="fa-solid fa-envelope-open-text"></i><p>Okunmamış mesaj bulunmuyor</p></div>';
    } catch (error) {
        console.error('Okunmamış sohbetler yüklenirken hata:', error);
        friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Okunmamış mesajlar yüklenemedi</p></div>';
    }
}

// Filter friends
window.filterChatFriends = function(query) {
    const items = document.querySelectorAll('.chat-friend-item');
    const searchQuery = query.toLowerCase();
    
    items.forEach(item => {
        const name = item.querySelector('.chat-friend-name')?.textContent.toLowerCase() || '';
        const username = item.querySelector('.chat-friend-username')?.textContent.toLowerCase() || '';
        const lastmsg = item.querySelector('.chat-friend-lastmsg')?.textContent.toLowerCase() || '';
        
        if (name.includes(searchQuery) || username.includes(searchQuery) || lastmsg.includes(searchQuery)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Open chat with friend from list
window.openChatWithFriend = async function(friendId, displayName, username) {
    await openChatWithUser(friendId, displayName);
    window.closeChatsList();
}

// helper to start chat by username
window.startChatWithUsername = async function() {
    const input = document.getElementById('chat-new-user-input');
    const username = input.value.trim();
    if (!username) return;
    try {
        const userQuery = query(collection(db, 'users'), where('username', '==', username));
        const userSnap = await getDocs(userQuery);
        if (userSnap.empty) {
            alert('Kullanıcı bulunamadı');
            return;
        }
        const userId = userSnap.docs[0].id;
        const userData = userSnap.docs[0].data();
        const displayName = userData.displayName || username;
        await openChatWithUser(userId, displayName);
        input.value = '';
        window.closeChatsList();
    } catch (error) {
        console.error('Kullanıcı açılırken hata:', error);
        alert('Kullanıcı açılırken bir hata oluştu');
    }
}

// Handle new user input
window.handleNewUserKeypress = async function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        window.startChatWithUsername();
    }
}

// Add friend button handler for chat input
window.addFriendFromChat = async function() {
    const input = document.getElementById('chat-new-user-input');
    let username = input.value.trim();
    if (!username) return;
    if (username.startsWith('@')) username = username.slice(1);
    try {
        const userQuery = query(collection(db,'users'), where('username','==',username));
        const userSnap = await getDocs(userQuery);
        if (userSnap.empty) {
            alert('Kullanıcı bulunamadı');
            return;
        }
        const userId = userSnap.docs[0].id;
        await sendFriendRequestToUid(userId, username);
        input.value = '';
        alert('Arkadaşlık isteği gönderildi.');
    } catch(e) {
        console.error('Arkadaş isteği gönderirken hata:', e);
        alert('İstek gönderilemedi: ' + (e.message || ''));        
    }
}

// Open chat with a user
window.openChatWithUser = async function(userId, displayName) {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }
    
    // Initialize widget if needed
    if (!document.getElementById('chat-widget-container')) {
        initChatWidget();
    }
    
    // If userId looks like username (not UID), find the actual UID from Firestore
    let actualUserId = userId;
    if (!userId.includes('aS9d') && userId.length < 20) { // Simple check if it looks like username
        try {
            const userQuery = query(collection(db, 'users'), where('username', '==', userId));
            const userSnap = await getDocs(userQuery);
            if (!userSnap.empty) {
                actualUserId = userSnap.docs[0].id; // Get the actual UID
                displayName = userSnap.docs[0].data().displayName || userId;
            }
        } catch (error) {
            console.warn('Username to UID conversion failed:', error);
        }
    }
    
    currentChatUserId = actualUserId;
    currentChatUsername = displayName || userId;
    
    try {
        // Create or get conversation
        const currentUserId = auth.currentUser.uid;
        const conversationId = [currentUserId, actualUserId].sort().join('_');
        
        const convRef = doc(db, 'conversations', conversationId);
        const convSnap = await getDoc(convRef);
        
        if (!convSnap.exists()) {
            // Create new conversation
            await setDoc(convRef, {
                participants: [currentUserId, actualUserId],
                lastMessage: '',
                lastMessageAt: serverTimestamp(),
                lastSenderId: '',
                unreadCount: {
                    [currentUserId]: 0,
                    [actualUserId]: 0
                },
                createdAt: serverTimestamp()
            });
        }
        
        currentConversationId = conversationId;
        await markConversationAsRead(conversationId);
        
        // Update widget header
        const titleEl = document.getElementById('chat-widget-title');
        if (titleEl) {
            titleEl.textContent = currentChatUsername;
        }
        await updateChatFriendActionButton(actualUserId, currentChatUsername);
        
        // Show widget
        const widgetEl = document.getElementById('chat-widget-container');
        widgetEl.classList.add('active');
        document.body.classList.add('chat-open');

        setChatClearButtonVisibility(true);
        setGroupChatHeaderActionsVisibility(false);
        
        // Load messages
        loadChatMessages(conversationId);
        
        // Reset inactivity timer
        resetChatInactivityTimer();
        
    } catch (error) {
        console.error('Chat açılırken hata:', error);
        alert('Sohbet açılırken bir hata oluştu');
    }
}

window.updateChatFriendActionButton = async function(targetUid, displayName) {
    const btn = document.getElementById('chat-widget-add-friend-btn');
    if (!btn) return;
    btn.style.display = 'none';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';

    if (!auth.currentUser || !targetUid || targetUid === auth.currentUser.uid) {
        return;
    }

    try {
        const currentUserRef = doc(db, 'users', auth.currentUser.uid);
        const currentUserSnap = await getDoc(currentUserRef);
        const userData = currentUserSnap.exists() ? currentUserSnap.data() : {};
        const friends = userData.friends || [];
        const sentRequests = userData.sentRequests || [];
        const friendRequests = userData.friendRequests || [];
        const isFriend = friends.includes(targetUid);
        const hasPending = sentRequests.some(req => req.toUid === targetUid) || friendRequests.some(req => req.fromUid === targetUid);

        if (!isFriend) {
            btn.style.display = 'inline-flex';
            if (hasPending) {
                btn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İstek Bekleniyor';
                btn.disabled = true;
                btn.style.cursor = 'default';
                btn.title = 'Arkadaşlık isteği bekleniyor';
            } else {
                btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaş Ekle';
                btn.disabled = false;
                btn.style.cursor = 'pointer';
                btn.title = 'Arkadaş ekle';
            }
        }
    } catch (error) {
        console.error('Chat arkadaş butonu güncellenirken hata:', error);
    }
};

window.addFriendToChatUser = async function() {
    if (!currentChatUserId || !auth.currentUser) return;
    if (currentChatUserId === auth.currentUser.uid) return;

    await sendFriendRequestToUid(currentChatUserId, currentChatUsername);
    const btn = document.getElementById('chat-widget-add-friend-btn');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İstek Bekleniyor';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'default';
    }
};

// Open group chat (hobi grubu sohbeti)
window.openGroupChat = async function(groupId, groupName, memberIds = [], ownerUid = null) {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    if (!document.getElementById('chat-widget-container')) {
        initChatWidget();
    }

    const currentUserId = auth.currentUser.uid;
    const normalizedGroupId = String(groupId || '').startsWith('group_') ? String(groupId) : `group_${groupId}`;
    const conversationId = normalizedGroupId;

    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    const existingParticipants = convSnap.exists() ? (convSnap.data().participants || []) : [];
    const shouldIncludeCurrentUser = !convSnap.exists() || existingParticipants.includes(currentUserId) || (memberIds || []).includes(currentUserId);

    // Ensure current user is part of participants only when the group conversation should still include them.
    const participants = Array.from(new Set([...(memberIds || []), ...existingParticipants, ...(shouldIncludeCurrentUser ? [currentUserId] : [])]));

    if (!convSnap.exists()) {
        const unreadCount = participants.reduce((acc, id) => ({ ...acc, [id]: 0 }), {});
        await setDoc(convRef, {
            participants,
            lastMessage: '',
            lastMessageAt: serverTimestamp(),
            lastSenderId: '',
            unreadCount,
            createdAt: serverTimestamp(),
            group: true,
            groupId,
            groupName: groupName || 'Hobi Grubu Sohbeti',
            ownerUid: ownerUid || currentUserId
        });
    } else {
        const existing = convSnap.data().participants || [];
        const missing = participants.filter(id => !existing.includes(id));
        if (missing.length) {
            await updateDoc(convRef, { participants: [...existing, ...missing] });
        }
    }

    const resolvedOwnerUid = convSnap.exists() ? (convSnap.data().ownerUid || ownerUid || currentUserId) : (ownerUid || currentUserId);

    currentConversationId = conversationId;
    currentChatUserId = conversationId;
    currentConversationIsGroup = true;
    currentGroupMembers = [];
    currentChatUsername = groupName || 'Hobi Grubu Sohbeti';
    await markConversationAsRead(conversationId);

    const titleEl = document.getElementById('chat-widget-title');
    if (titleEl) {
        titleEl.textContent = currentChatUsername;
    }

    const widgetEl = document.getElementById('chat-widget-container');
    widgetEl.classList.add('active');

    setChatClearButtonVisibility(true);

    setGroupChatHeaderActionsVisibility(true, resolvedOwnerUid);
    await renderGroupChatMembersBar(participants);
    loadChatMessages(conversationId);
    resetChatInactivityTimer();
};

window.deleteCurrentGroupChat = async function() {
    if (!currentConversationId || !auth.currentUser || !currentConversationIsGroup) return;

    const confirmed = confirm('Bu grubu silmek istediğinize emin misiniz?');
    if (!confirmed) return;

    try {
        const conversationRef = doc(db, 'conversations', currentConversationId);
        const conversationSnap = await getDoc(conversationRef);
        if (!conversationSnap.exists()) {
            alert('Bu grup bulunamadı.');
            return;
        }

        const conversationData = conversationSnap.data() || {};
        if (conversationData.ownerUid && conversationData.ownerUid !== auth.currentUser.uid) {
            alert('Sadece grup kurucusu bu grubu silebilir.');
            return;
        }

        await deleteDoc(conversationRef);
        window.closeChatWidget();
        alert('Grup silindi.');
    } catch (error) {
        console.error('Grup silme hatası:', error);
        alert('Grup silinemedi. Lütfen tekrar deneyin.');
    }
};

window.leaveCurrentGroupChat = async function() {
    if (!currentConversationId || !auth.currentUser || !currentConversationIsGroup) return;

    const confirmed = confirm('Bu gruptan ayrılmak istediğinize emin misiniz?');
    if (!confirmed) return;

    try {
        const conversationRef = doc(db, 'conversations', currentConversationId);
        const conversationSnap = await getDoc(conversationRef);
        if (!conversationSnap.exists()) {
            window.closeChatWidget();
            return;
        }

        const conversationData = conversationSnap.data() || {};
        const currentParticipants = Array.isArray(conversationData.participants) ? conversationData.participants : [];
        const remainingParticipants = currentParticipants.filter((participantId) => participantId !== auth.currentUser.uid);
        const unreadCount = { ...(conversationData.unreadCount || {}) };
        delete unreadCount[auth.currentUser.uid];

        if (!remainingParticipants.length) {
            await deleteDoc(conversationRef);
            window.closeChatWidget();
            alert('Grup silindi çünkü son üye sizdiniz.');
            return;
        }

        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const currentUserData = userSnap.exists() ? userSnap.data() : {};
        const leavingUserName = currentUserData.displayName || currentUserData.username || 'Kullanıcı';

        const systemMessage = {
            senderId: 'system',
            senderName: 'Sistem',
            senderAvatar: 'assets/img/strendsaydamv2.png',
            text: `${leavingUserName} sohbetten ayrıldı.`,
            createdAt: serverTimestamp()
        };

        const updates = {
            participants: remainingParticipants,
            unreadCount
        };

        if (conversationData.ownerUid === auth.currentUser.uid) {
            updates.ownerUid = remainingParticipants[0];
        }

        await Promise.all([
            addDoc(collection(db, 'conversations', currentConversationId, 'messages'), systemMessage),
            updateDoc(conversationRef, {
                ...updates,
                lastMessage: systemMessage.text,
                lastMessageAt: serverTimestamp(),
                lastSenderId: 'system'
            })
        ]);

        window.closeChatWidget();
        alert('Gruptan ayrıldınız.');
    } catch (error) {
        console.error('Grup ayrılma hatası:', error);
        alert('Gruptan ayrılırken bir hata oluştu.');
    }
};

// Load messages for current conversation
function loadChatMessages(conversationId) {
    const messagesContainer = document.getElementById('chat-widget-messages');
    
    // Unsubscribe from previous listener
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    
    const q = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(50)
    );
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <i class="fa-regular fa-comment"></i>
                    <p>Henüz mesaj yok</p>
                </div>
            `;
            return;
        }
        
        messagesContainer.innerHTML = '';
        
        snapshot.forEach(msgDoc => {
            const msg = msgDoc.data();
            const isOwn = msg.senderId === auth.currentUser.uid;
            
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${isOwn ? 'own' : ''}`;
            
            let controlsHtml = '';
            if (isOwn) {
                const safeText = msg.text.replace(/"/g, '&quot;');
                controlsHtml = `
                    <div class="chat-msg-controls">
                        <button class="chat-msg-edit" data-id="${msgDoc.id}" data-text="${safeText}" onclick="window.startEditMessage(this.dataset.id, this.dataset.text)" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                        <button class="chat-msg-delete" onclick="window.deleteMessage('${msgDoc.id}')" title="Sil"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            }
            
            messageEl.innerHTML = `
                <img src="${msg.senderAvatar || 'assets/img/strendsaydamv2.png'}" class="chat-message-avatar" alt="">
                <div class="chat-message-content">
                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); padding: 0 5px;">${escapeHtml(msg.senderName || 'Kullanıcı')}</div>
                    <div class="chat-message-bubble">
                        ${msg.attachmentUrl ? (msg.attachmentType && msg.attachmentType.startsWith('image/') ? `<img src="${msg.attachmentUrl}" onclick="window.showImageModal('${msg.attachmentUrl}')" style="max-width:200px; display:block; margin-bottom:5px; border-radius:8px; cursor:zoom-in;">` : `<audio controls src="${msg.attachmentUrl}" style="max-width:200px; display:block; margin-bottom:5px;"></audio>`) : ''}
                        ${escapeHtml(msg.text)}
                    </div>
                    <div class="chat-meta">
                        <div class="chat-message-time">${formatChatTime(msg.createdAt)}</div>
                        ${controlsHtml}
                    </div>
                </div>
            `;
            
            messagesContainer.appendChild(messageEl);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Mark as read and clear any persistent notification for this conversation
        updateDoc(doc(db, 'conversations', conversationId), {
            [`unreadCount.${auth.currentUser.uid}`]: 0
        }).catch(() => {});
        clearChatNotificationForConversation(conversationId);

        if (typeof updateChatUnreadIndicator === 'function') updateChatUnreadIndicator();
        
    }, (error) => {
        console.error('Mesajlar yüklenirken hata:', error);
    });
}

// Send chat message
let chatAttachmentData = null;
let chatAttachmentType = null;
let emojiPickerOpen = false;

window.sendChatMessage = async function() {
    if (!currentConversationId || !auth.currentUser) {
        console.error('Sohbet hazır değil:', { currentConversationId, currentUser: auth.currentUser?.uid });
        alert('Lütfen önce bir kullanıcıyı seçin');
        return;
    }
    
    const inputEl = document.getElementById('chat-widget-input');
    if (!inputEl) {
        console.error('Input element bulunamadı');
        return;
    }
    
    const text = inputEl.value.trim();
    
    // allow send if there's either text or an attachment
    if (!text && !chatAttachmentData) {
        return;
    }
    
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;
    
    try {
        const currentUserId = auth.currentUser.uid;
        
        // user data log removed

        
        const messageData = {
            senderId: currentUserId,
            senderName: user.displayName || user.username || 'Anonim',
            senderAvatar: user.avatarUrl || 'assets/img/strendsaydamv2.png',
            text: text,
            createdAt: serverTimestamp()
        };
        
        // upload attachment if present
        if (chatAttachmentData) {
            try {
                const resp = await fetch(chatAttachmentData);
                const blob = await resp.blob();
                const ext = chatAttachmentType && chatAttachmentType.split('/')[0];
                const storagePath = `chat_attachments/${currentConversationId}/${Date.now()}.${ext}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, blob);
                const url = await getDownloadURL(storageRef);
                messageData.attachmentUrl = url;
                messageData.attachmentType = chatAttachmentType;
            } catch (e) {
                console.error('Attachment upload error', e);
            }
            chatAttachmentData = null;
            chatAttachmentType = null;
            window.clearAttachmentPreview && window.clearAttachmentPreview();
        }
        // message send log removed

        
        await addDoc(
            collection(db, 'conversations', currentConversationId, 'messages'),
            messageData
        );
        
        // message sent log removed

        
        const conversationRef = doc(db, 'conversations', currentConversationId);
        const conversationSnap = await getDoc(conversationRef);
        const unreadUpdates = {};

        if (conversationSnap.exists()) {
            const convData = conversationSnap.data();
            const participants = convData.participants || [];
            const currentUnread = convData.unreadCount || {};

            participants.forEach((participantId) => {
                if (participantId === currentUserId) {
                    unreadUpdates[`unreadCount.${participantId}`] = 0;
                } else {
                    unreadUpdates[`unreadCount.${participantId}`] = (currentUnread[participantId] || 0) + 1;
                }
            });
        }

        await updateDoc(conversationRef, {
            lastMessage: text,
            lastMessageAt: serverTimestamp(),
            lastSenderId: currentUserId,
            ...unreadUpdates
        });

        // Send a header notification to other chat participants
        const participantIds = Object.keys(unreadUpdates).filter(id => id !== currentUserId);
        for (const participantId of participantIds) {
            await sendNotification(participantId, 'message', messageData.senderName, {
                message: text,
                conversationId: currentConversationId,
                senderUid: currentUserId
            });
        }
        
        inputEl.value = '';
        
        // Reset inactivity timer
        resetChatInactivityTimer();
        
    } catch (error) {
        console.error('Mesaj gönderirken hata:', error);
        alert('Mesaj gönderilemedi: ' + error.message);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Handle Enter key in input
window.handleChatKeypress = function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

// Close chat widget
window.closeChatWidget = function() {
    const widgetEl = document.getElementById('chat-widget-container');
    if (widgetEl) {
        widgetEl.classList.remove('active');
    }

    const panel = document.getElementById('chat-lists-panel');
    if (panel) {
        panel.classList.add('active');
        panel.style.display = 'flex';
    }
    document.body.classList.add('chat-open');

    const clearButton = document.getElementById('chat-clear-btn');
    if (clearButton) {
        clearButton.style.display = 'none';
    }
    
    currentChatUserId = null;
    currentChatUsername = null;
    currentConversationId = null;
    currentConversationIsGroup = false;
    currentGroupMembers = [];
    setGroupMembersBarVisible(false);
    setGroupChatHeaderActionsVisibility(false);
    
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    
    if (typingUnsubscribe) {
        typingUnsubscribe();
        typingUnsubscribe = null;
    }
    
    clearChatInactivityTimer();
};

// Reset inactivity timer (30 minutes)
function resetChatInactivityTimer() {
    clearChatInactivityTimer();
    
    chatInactivityTimer = setTimeout(() => {
        // inactive chat log removed

        window.closeChatWidget();
    }, 30 * 60 * 1000); // 30 minutes
}

// Clear inactivity timer
function clearChatInactivityTimer() {
    if (chatInactivityTimer) {
        clearTimeout(chatInactivityTimer);
        chatInactivityTimer = null;
    }
}

// NAVIGATION FROM CHAT TO FRIEND LIST
window.backToFriendList = function() {
    window.closeChatWidget();
    if (typeof window.openChatsList === 'function') {
        window.openChatsList(true);
    }
};

// Escape HTML special characters
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatRelativePresence(timestamp) {
    if (!timestamp) return 'Çevrimdışı';
    const date = timestamp.toDate ? timestamp.toDate() : (timestamp.seconds != null ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSeconds < 60) return 'şimdi';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}dk önce`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}sa önce`;
    return `${Math.floor(diffSeconds / 86400)}g önce`;
}

function isRecentActivity(timestamp, thresholdSeconds = 60) {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : (timestamp.seconds != null ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    return diffSeconds >= 0 && diffSeconds <= thresholdSeconds;
}

function resolvePresenceStatus(userData) {
    if (!userData) return { status: 'offline', label: 'Çevrimdışı' };
    const isOnline = userData.isOnline === true || userData.isOnline === 'true' || userData.online === true || userData.online === 'true' || userData.status === 'online' || userData.status === 'Online' || userData.presence === 'online';
    const lastActiveAt = userData.lastActiveAt || userData.lastSeen || userData.lastOnline;
    if (isOnline) {
        return { status: 'online', label: 'Çevrimiçi', lastActiveAt };
    }
    if (lastActiveAt) {
        const rel = formatRelativePresence(lastActiveAt);
        if (rel === 'şimdi' || isRecentActivity(lastActiveAt, 60)) {
            return { status: 'online', label: 'Çevrimiçi', lastActiveAt };
        }
        return { status: 'offline', label: `Son aktif ${rel}`, lastActiveAt };
    }
    return { status: 'offline', label: 'Çevrimdışı', lastActiveAt: null };
}

function formatOfflineDays(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : (timestamp.seconds != null ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSeconds < 60) return ' · şimdi';
    if (diffSeconds < 3600) return ` · ${Math.floor(diffSeconds / 60)}dk`;
    if (diffSeconds < 86400) return ` · ${Math.floor(diffSeconds / 3600)}s`;
    const days = Math.floor(diffSeconds / 86400);
    const hours = Math.floor((diffSeconds % 86400) / 3600);
    return ` · ${days}g${hours > 0 ? ` ${hours}s` : ''}`;
}

function shortenEmail(email) {
    if (!email || typeof email !== 'string') return '—';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const localPart = parts[0];
    const domain = parts[1].toLowerCase();
    let shortDomain = '...';
    if (domain.includes('gmail.com')) {
        shortDomain = 'gm..';
    } else if (domain.includes('hotmail.com')) {
        shortDomain = 'hm..';
    }
    return `${localPart}@${shortDomain}`;
}

// Format timestamp to readable time for chat
function formatChatTime(timestamp) {
    if (!timestamp) return '';

    let date;
    if (timestamp?.toDate) {
        date = timestamp.toDate();
    } else if (timestamp?.seconds != null) {
        date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else {
        return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Az önce';
    if (diffMinutes < 60) return `${diffMinutes} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;

    return date.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Listen for incoming messages
// keep track of last message id we notified for each conversation
const lastNotifiedMessage = {};
// conversations for which we've already processed the initial snapshot
const initializedConversations = new Set();

function listenForIncomingMessages() {
    if (!auth.currentUser) return;
    
    const currentUserId = auth.currentUser.uid;
    
    // Get all conversations for current user
    const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUserId)
    );
    
    onSnapshot(conversationsQuery, (snapshot) => {
        snapshot.forEach((convDoc) => {
            const convData = convDoc.data();
            const conversationId = convDoc.id;
            
            // Listen to messages in this conversation
            const messagesQuery = query(
                collection(db, 'conversations', conversationId, 'messages'),
                orderBy('createdAt', 'desc'),
                limit(1)
            );
            
            onSnapshot(messagesQuery, (msgSnapshot) => {
                if (!msgSnapshot.empty) {
                    const msgDoc = msgSnapshot.docs[0];
                    const lastMsg = msgDoc.data();

                    // skip notification for the very first message snapshot when conversation is initialized
                    if (!initializedConversations.has(conversationId)) {
                        initializedConversations.add(conversationId);
                        // record last message so future changes are compared
                        lastNotifiedMessage[conversationId] = msgDoc.id;
                        return;
                    }
                    
                    // ignore if we've already notified for this exact message
                    if (lastNotifiedMessage[conversationId] === msgDoc.id) {
                        return;
                    }
                    
                    // mark as seen
                    lastNotifiedMessage[conversationId] = msgDoc.id;
                    
                    // Eğer bu mesaj başkası tarafından gönderildiyse ve widget açık değilse bildir
                    if (lastMsg.senderId !== currentUserId) {
                        const isCurrentChatOpen = currentConversationId === conversationId;
                        
                        if (!isCurrentChatOpen) {
                            // Diğer katılımcıyı bul
                            const otherId = convData.participants.find(id => id !== currentUserId);
                            
                            // Bildirim göster
                            showMessageNotification(conversationId, otherId, lastMsg.senderName || 'Bilinmeyen Kullanıcı', lastMsg.text);
                            if (typeof updateChatUnreadIndicator === 'function') updateChatUnreadIndicator();
                        }
                    }
                }
            });
        });
    });
}

// Helpers for persistent chat notifications
function saveChatNotification(conversationId, senderId, data) {
    try {
        const payload = { conversationId, senderId, ...data };
        localStorage.setItem('chatNotif_' + conversationId, JSON.stringify(payload));
    } catch (e) {
        console.warn('notification storage failed', e);
    }
}

function removeChatNotification(elementId) {
    try {
        if (elementId.startsWith('notif-')) {
            const conversationId = elementId.replace('notif-', '');
            localStorage.removeItem('chatNotif_' + conversationId);
        }
        if (elementId.startsWith('toast-')) {
            const el = document.getElementById(elementId);
            if (el && el.dataset.conversationId) {
                localStorage.removeItem('chatNotif_' + el.dataset.conversationId);
            }
        }
    } catch (e) {}
    const el = document.getElementById(elementId);
    if (el) el.remove();
}

function clearChatNotificationForConversation(conversationId) {
    removeChatNotification(`notif-${conversationId}`);
    removeChatNotification(`toast-${conversationId}`);
}

function renderChatNotification(conversationId, senderId, senderName, messageText) {
    const widget = document.getElementById('chat-widget-container');
    const toastId = `toast-${conversationId}`;
    if (widget && widget.classList.contains('active')) {
        if (document.getElementById(toastId)) {
            document.getElementById(toastId).remove();
        }
        const toastDiv = document.createElement('div');
        toastDiv.id = toastId;
        toastDiv.className = 'chat-widget-toast';
        toastDiv.innerHTML = `
            <i class="fa-solid fa-envelope"></i>
            <div>
                <div style="font-weight:700;">${senderName}</div>
                <div style="font-size:0.8rem; opacity:0.9;">${messageText.slice(0, 50)}${messageText.length > 50 ? '...' : ''}</div>
            </div>
        `;
        toastDiv.dataset.senderId = senderId;
        toastDiv.dataset.conversationId = conversationId;
        toastDiv.onclick = async () => {
            try {
                const currentUserId = auth.currentUser.uid;
                await updateDoc(doc(db, 'conversations', conversationId), {
                    [`unreadCount.${currentUserId}`]: 0
                });
            } catch (e) {
                console.warn('Bildirim tıklanırken okunma işareti atamada hata:', e);
            }
            openChatWithUser(senderId, senderName);
            removeChatNotification(toastId);
        };
        document.body.appendChild(toastDiv);
        return;
    }

    if (document.getElementById(`notif-${conversationId}`)) {
        document.getElementById(`notif-${conversationId}`).remove();
    }
    const notifDiv = document.createElement('div');
    notifDiv.id = `notif-${conversationId}`;
    notifDiv.className = 'chat-notification-badge';
    notifDiv.innerHTML = `
        <i class="fa-solid fa-envelope"></i>
        <div>
            <div style="font-weight:700;">${senderName}</div>
            <div style="font-size:0.8rem; opacity:0.9;">${messageText.slice(0, 50)}${messageText.length > 50 ? '...' : ''}</div>
        </div>
    `;
    notifDiv.dataset.conversationId = conversationId;
    notifDiv.onclick = async () => {
        try {
            const currentUserId = auth.currentUser.uid;
            await updateDoc(doc(db, 'conversations', conversationId), {
                [`unreadCount.${currentUserId}`]: 0
            });
        } catch (e) {
            console.warn('Bildirim tıklanırken okunma işareti atamada hata:', e);
        }
        openChatWithUser(senderId, senderName);
        removeChatNotification(`notif-${conversationId}`);
    };
    document.body.appendChild(notifDiv);
}

function loadStoredChatNotifications() {
    // Local stored chat notifications are no longer shown as bottom-left toast badges.
    // Keep the stored keys if needed for compatibility, but do not render them.
}

async function restoreUnreadChatNotifications() {
    if (!auth.currentUser) return;
    try {
        const currentUserId = auth.currentUser.uid;
        const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUserId)
        );
        const convSnap = await getDocs(q);
        for (const convDoc of convSnap.docs) {
            const convData = convDoc.data();
            const unreadCount = convData.unreadCount?.[currentUserId] || 0;
            if (unreadCount <= 0) continue;
            const conversationId = convDoc.id;
            if (localStorage.getItem('chatNotif_' + conversationId)) continue;
            if (document.getElementById(`notif-${conversationId}`) || document.getElementById(`toast-${conversationId}`)) continue;
            if (currentConversationId === conversationId) continue;

            const otherParticipantId = (convData.participants || []).find(id => id !== currentUserId);
            if (!otherParticipantId) continue;

            let senderName = 'Bilinmeyen Kullanıcı';
            try {
                const userSnap = await getDoc(doc(db, 'users', otherParticipantId));
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    senderName = userData.displayName || userData.username || senderName;
                }
            } catch (e) {
                console.warn('Sohbet bildirimi için kullanıcı bilgisi alınamadı:', e);
            }

            const messageText = convData.lastMessage || 'Yeni mesaj';
            showMessageNotification(conversationId, otherParticipantId, senderName, messageText);
        }
    } catch (e) {
        console.warn('Offline gelen sohbet bildirimleri geri yüklenirken hata:', e);
    }
}

// --- emoji helper functions ---

window.toggleEmojiPicker = function() {
    // removed debug

    if (emojiPickerOpen) {
        window.closeEmojiPicker();
    } else {
        window.openEmojiPicker();
    }
}

window.openEmojiPicker = function() {
    // removed debug

    if (document.getElementById('emoji-picker')) return;
    const picker = document.createElement('div');
    picker.id = 'emoji-picker';
    picker.style.position = 'fixed';
    picker.style.width = '220px';
    picker.style.background = 'var(--card-bg)';
    picker.style.border = '1px solid var(--border)';
    picker.style.borderRadius = '12px';
    picker.style.padding = '10px';
    picker.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    picker.style.display = 'grid';
    picker.style.gridTemplateColumns = 'repeat(auto-fill, 30px)';
    picker.style.gridAutoRows = '30px';
    picker.style.gap = '8px';
    picker.style.zIndex = 10010;
    // always show above widget
    picker.style.bottom = '140px';
    picker.style.right = '20px';
    const emojis = ['😊','😂','😢','😍','👍','🎉','❤️','😮','😡','😎','😋','🤔','🙏','😉','😴','😇','🤩','🥳','😤','🙌'];
    emojis.forEach(e => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = e;
        btn.style.fontSize = '1.4rem';
        btn.style.lineHeight = '1';
        btn.style.padding = '4px';
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.onclick = () => {
            const input = document.getElementById('chat-widget-input');
            if (input) {
                input.value += e;
                input.focus();
            }
        };
        picker.appendChild(btn);
    });
    document.body.appendChild(picker);
    emojiPickerOpen = true;
    document.addEventListener('click', emojiPickerOutsideHandler);
}

window.closeEmojiPicker = function() {
    const p = document.getElementById('emoji-picker');
    if (p && p.parentNode) p.parentNode.removeChild(p);
    emojiPickerOpen = false;
    document.removeEventListener('click', emojiPickerOutsideHandler);
}

function emojiPickerOutsideHandler(e) {
    if (!e.target.closest('#emoji-picker') && e.target.id !== 'chat-emoji-btn' && !e.target.closest('#chat-emoji-btn')) {
        window.closeEmojiPicker();
    }
}

// display a full‑screen overlay with the clicked chat image
window.showImageModal = function(url) {
    if (document.getElementById('image-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'image-modal';
    overlay.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    const img = document.createElement('img');
    img.src = url;
    overlay.appendChild(img);
    document.body.appendChild(overlay);
}


// Show message notification
function showMessageNotification(conversationId, senderId, senderName, messageText) {
    // Disable local bottom-left chat toast notifications.
    // Incoming messages are handled via header notification dropdown only.
    if (typeof updateChatUnreadIndicator === 'function') {
        updateChatUnreadIndicator();
    }
}

// --- message editing / deletion helpers ---

let currentEditingMessageId = null;

window.startEditMessage = function(messageId, currentText) {
    const input = document.getElementById('chat-widget-input');
    if (input) {
        input.value = currentText;
        input.focus();
        currentEditingMessageId = messageId;
        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn) sendBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
}

window.deleteMessage = async function(messageId) {
    if (!currentConversationId || !auth.currentUser) return;
    if (!confirm('Mesajı gerçekten silmek istiyor musunuz?')) return;
    try {
        await deleteDoc(doc(db, 'conversations', currentConversationId, 'messages', messageId));
    } catch (e) {
        console.error('Mesaj silme hatası', e);
    }
}

window.clearChatHistory = async function() {
    if (!currentConversationId || !auth.currentUser) {
        alert('Önce bir sohbet seçin.');
        return;
    }

    if (!confirm('Sohbet geçmişini tamamen silmek istediğinize emin misiniz?')) {
        return;
    }

    const messagesContainer = document.getElementById('chat-widget-messages');
    const clearButton = document.getElementById('chat-clear-btn');
    const headerClearButton = document.getElementById('chat-clear-header-btn');
    if (clearButton) clearButton.disabled = true;
    if (headerClearButton) headerClearButton.disabled = true;

    try {
        const messagesQuery = query(collection(db, 'conversations', currentConversationId, 'messages'));
        const snapshot = await getDocs(messagesQuery);

        const deletePromises = [];
        snapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, 'conversations', currentConversationId, 'messages', docSnap.id)));
        });

        await Promise.all(deletePromises);
        await updateDoc(doc(db, 'conversations', currentConversationId), {
            lastMessage: 'Sohbet temizlendi',
            lastMessageAt: serverTimestamp(),
            lastSenderId: 'system'
        });

        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <i class="fa-regular fa-comment"></i>
                    <p>Sohbet geçmişi silindi.</p>
                </div>
            `;
        }
    } catch (e) {
        console.error('Sohbet geçmişi silme hatası', e);
        alert('Sohbet geçmişi silinirken bir hata oluştu.');
    } finally {
        if (clearButton) clearButton.disabled = false;
        if (headerClearButton) headerClearButton.disabled = false;
    }
}

function updateChatHeaderActions() {
    const headerActions = document.getElementById('chat-header-actions');
    if (!headerActions) return;

    const existingButton = document.getElementById('chat-clear-header-btn');
    if (existingButton) return;

    if (!currentConversationId) {
        headerActions.innerHTML = '';
        return;
    }

    const button = document.createElement('button');
    button.id = 'chat-clear-header-btn';
    button.className = 'chat-action-btn chat-action-secondary';
    button.type = 'button';
    button.title = 'Sohbeti temizle';
    button.innerHTML = '<i class="fa-solid fa-broom"></i>';
    button.onclick = () => {
        if (typeof window.clearChatHistory === 'function') {
            window.clearChatHistory();
        }
    };

    headerActions.appendChild(button);
}

// --- attachment helpers ---

window.handleChatAttachment = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    // removed debug

    // allow images and audio
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
        alert('Sadece görsel veya ses dosyası yükleyebilirsiniz');
        return;
    }
    chatAttachmentType = file.type;
    const reader = new FileReader();
    reader.onload = () => {
        chatAttachmentData = reader.result;
        window.showAttachmentPreview(chatAttachmentData, file.type);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

window.showAttachmentPreview = function(src, type) {
    let prev = document.getElementById('chat-attachment-preview');
    if (!prev) {
        prev = document.createElement('div');
        prev.id = 'chat-attachment-preview';
        prev.style.padding = '5px';
        prev.style.maxHeight = '100px';
        prev.style.overflow = 'hidden';
        prev.style.cursor = 'pointer';
        prev.title = 'Kaldırmak için tıklayın';
        if (type && type.startsWith('image/')) {
            const img = document.createElement('img');
            img.style.maxHeight = '80px';
            img.style.borderRadius = '8px';
            prev.appendChild(img);
        } else if (type && type.startsWith('audio/')) {
            const aud = document.createElement('audio');
            aud.controls = true;
            aud.style.maxWidth = '120px';
            prev.appendChild(aud);
        }
        prev.onclick = () => {
            chatAttachmentData = null;
            window.clearAttachmentPreview();
        };
        const chatInput = document.querySelector('.chat-widget-input');
        if (chatInput && chatInput.parentNode) {
            chatInput.parentNode.insertBefore(prev, chatInput);
        }
    }
    if (prev.querySelector('img')) prev.querySelector('img').src = src;
    if (prev.querySelector('audio')) prev.querySelector('audio').src = src;
}

window.clearAttachmentPreview = function() {
    const prev = document.getElementById('chat-attachment-preview');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
}

function setBlogNavActive({ all = false, mine = false, create = false }) {
    const btnAll = document.getElementById('btn-blog-all');
    const btnMine = document.getElementById('btn-blog-mine');
    const btnCreate = document.getElementById('btn-blog-create');

    const activeClass = 'active';
    if (btnAll) btnAll.classList.toggle(activeClass, all);
    if (btnMine) btnMine.classList.toggle(activeClass, mine);
    if (btnCreate) btnCreate.classList.toggle(activeClass, create);
}

function updateCreateViewAuthState() {
    const authNotice = document.getElementById('blogAuthNotice');
    const pubBtn = document.getElementById('publishBlogBtn');
    const isAuthed = auth && auth.currentUser;

    const userEmail = isAuthed ? auth.currentUser.email : null;
    const userLabel = isAuthed ? `${userEmail || 'Girişli kullanıcı'}` : null;

    if (authNotice) {
        if (isAuthed) {
            authNotice.textContent = `✅ ${userLabel} olarak giriş yapıldı.`;
            authNotice.style.color = 'var(--text-muted)';
        } else {
            authNotice.textContent = 'Yazı yayınlamak için giriş yapmalısınız.';
            authNotice.style.color = '#ef4444';
        }
    }

    const draftBtn = document.getElementById('saveDraftBtn');

    if (pubBtn) {
        if (isAuthed) {
            pubBtn.disabled = false;
            pubBtn.style.opacity = '';
            pubBtn.title = '';
        } else {
            pubBtn.disabled = true;
            pubBtn.style.opacity = '0.5';
            pubBtn.title = 'Önce giriş yapmalısınız';
        }
    }

    // Only show the "Taslak Olarak Kaydet" button to the admin user
    if (draftBtn) {
        if (isAuthed && user.isAdmin) {
            draftBtn.style.display = 'inline-block';
        } else {
            draftBtn.style.display = 'none';
        }
    }

    console.log('[blog] create view auth state:', {
        isAuthed,
        userEmail,
        isAdmin: user.isAdmin
    });
}

function showBlogView(view, options = {}) {
    const listView = document.getElementById('blogListView');
    const createView = document.getElementById('blogCreateView');
    const postView = document.getElementById('blogPostView');
    const titleEl = document.getElementById('blogPageTitle');

    const mineMode = options.mine || false;

    // Clear any pending edit state when navigating away from create mode
    if (view !== 'create') {
        editingBlogId = null;
    }

    if (listView) listView.style.display = view === 'list' ? '' : 'none';
    if (createView) createView.style.display = view === 'create' ? '' : 'none';
    if (postView) postView.style.display = view === 'post' ? '' : 'none';

    if (titleEl) {
        if (view === 'create') {
            titleEl.textContent = 'Yeni Normal Gönderi';
        } else if (view === 'post') {
            titleEl.textContent = 'Normal Gönderi';
        } else {
            titleEl.textContent = mineMode ? 'Yazılarım' : 'Blog Yazıları';
        }
    }

    setBlogNavActive({
        all: view === 'list' && !mineMode,
        mine: view === 'list' && mineMode,
        create: view === 'create'
    });

    if (view === 'create') {
        updateCreateViewAuthState();

        // If we're in create mode and not editing, reset form state
        const titleEl = document.getElementById('blogTitle');
        const contentEl = document.getElementById('blogContent');
        const status = document.getElementById('blogStatus');
        const publishBtn = document.getElementById('publishBlogBtn');
        const pageTitle = document.getElementById('blogPageTitle');

        if (!editingBlogId) {
            if (titleEl) titleEl.value = '';
            if (contentEl) contentEl.value = '';
            if (status) status.textContent = '';
            if (publishBtn) publishBtn.textContent = 'Yayınla';
            if (pageTitle) pageTitle.textContent = 'Yeni Normal Gönderi';
        }
    }
}

const BLOG_CATEGORIES = ['Genel', 'Teknoloji', 'Yaşam', 'Haber', 'Eğitim', 'Seyahat'];

function getBlogCategoryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    if (!category) return 'Tümü';
    return category;
}

function setBlogCategoryInUrl(category) {
    const params = new URLSearchParams(window.location.search);
    if (category && category !== 'Tümü') {
        params.set('category', category);
    } else {
        params.delete('category');
    }
    const base = window.location.pathname;
    const query = params.toString();
    history.replaceState({}, '', query ? `${base}?${query}` : base);
}

function renderBlogCategoryFilters(selectedCategory = 'Tümü') {
    const container = document.getElementById('blogCategoryFilters');
    if (!container) return;

    const categories = ['Tümü', ...BLOG_CATEGORIES];
    container.innerHTML = categories.map(cat => {
        const isActive = cat === selectedCategory;
        return `
            <div class="glass-card" style="padding: 12px 14px; cursor: pointer; border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; background: ${isActive ? 'rgba(99, 102, 241, 0.08)' : 'var(--card-bg)'};">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-tags" style="color: ${isActive ? 'var(--primary)' : 'var(--text-muted)'};"></i>
                    <span style="font-weight: 600;">${cat}</span>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.glass-card').forEach((card, idx) => {
        card.onclick = () => {
            const category = categories[idx];
            setBlogCategoryInUrl(category);
            loadBlogPosts({ category });
        };
    });
}

async function fetchAndUpdateAuthorAvatar(authorUid, postId) {
    if (!authorUid) return;
    if (blogAuthorAvatarCache[authorUid]) {
        const img = document.querySelector(`img[data-post-id="${postId}"]`);
        if (img) img.src = blogAuthorAvatarCache[authorUid];
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', authorUid));
        if (!userDoc.exists()) return;
        const userData = userDoc.data();
        const avatar = getAvatarUrl(userData.avatarUrl || userData.avatar || 'assets/img/strendsaydamv2.png', 'user');
        blogAuthorAvatarCache[authorUid] = avatar;

        const imgEls = document.querySelectorAll(`img[data-author-uid="${authorUid}"]`);
        imgEls.forEach(img => img.src = avatar);
    } catch (e) {
        console.warn('author avatar fetch hatası', e);
    }
}

async function renderMostReadPosts() {
    const mostReadContainer = document.getElementById('mostReadContainer');
    if (!mostReadContainer) return;

    try {
        const topSnap = await getDocs(query(collection(db, 'blogs'), orderBy('views', 'desc'), limit(7)));
        mostReadContainer.innerHTML = '';
        if (topSnap.empty) {
            mostReadContainer.innerHTML = '<div style="color:var(--text-muted);">Henüz okunma verisi yok.</div>';
            return;
        }

        // Tablo stili (başlık + satırlar) - kenarlıklar kapalı, sade görünüm
        mostReadContainer.innerHTML = `
            <table class="most-read-table" style="width:100%;">
                <thead>
                    <tr class="most-read-title">
                        <th colspan="5">En Çok Okunanlar</th>
                    </tr>
                    <tr>
                        <th>Başlık</th>
                        <th>Kategori</th>
                        <th>Gönderen</th>
                        <th>Yorumlar</th>
                        <th>Okunmalar</th>
                    </tr>
                </thead>
                <tbody id="mostReadBody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('mostReadBody');
        topSnap.docs.forEach(doc => {
            const data = doc.data();
            const title = data.title || 'Başlıksız';
            const views = data.views || 0;
            const category = data.category || 'Genel';
            const author = data.authorUsername || data.author || 'Anonim';
            const comments = Array.isArray(data.comments) ? data.comments.length : 0;
            const postId = doc.id;

            tbody.innerHTML += `
                <tr>
                    <td><a href="blog.html?id=${postId}" style="text-decoration:none;color:inherit;font-weight:600;">${escapeHtml(title)}</a></td>
                    <td style="color:var(--text-muted);">${escapeHtml(category)}</td>
                    <td style="color:var(--text-muted);">${escapeHtml(author)}</td>
                    <td style="color:var(--text-muted);">${comments}</td>
                    <td style="color:var(--text-muted);">${views}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.warn('Most read yüklenemedi:', e);
    }
}

function renderMyBlogSummary(posts = []) {
    const mostReadContainer = document.getElementById('mostReadContainer');
    if (!mostReadContainer) return;

    const user = auth.currentUser;
    const name = user?.displayName || (user?.email || '').split('@')[0] || 'Profilim';
    const email = user?.email || '';

    const totalPosts = posts.length;
    const mostReadPost = posts.reduce((best, doc) => {
        const data = doc.data();
        const views = data.views || 0;
        if (!best || views > best.views) {
            return { title: data.title || 'Başlıksız', views };
        }
        return best;
    }, null);

    mostReadContainer.innerHTML = `
        <div style="display:flex; flex-wrap:wrap; gap:16px; margin-bottom:18px;">
            <div class="glass-card" style="flex:1; min-width:220px; padding:16px;">
                <h4 style="margin:0 0 10px 0;">Profilim</h4>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:44px; height:44px; border-radius:50%; overflow:hidden; background:#f0f0f0;">
                        <img src="${getAvatarUrl(user?.avatarUrl || user?.photoURL || 'assets/img/strendsaydamv2.png', 'user')}" alt="avatar" style="width:100%; height:100%; object-fit:cover;" />
                    </div>
                    <div style="font-size:0.9rem;">
                        <div style="font-weight:700;">${escapeHtml(name)}</div>
                        <div style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(email)}</div>
                    </div>
                </div>
            </div>
            <div class="glass-card" style="flex:1; min-width:220px; padding:16px;">
                <h4 style="margin:0 0 10px 0;">İstatistikler</h4>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:0.9rem;">
                    <div>Normal gönderi sayısı: <strong>${totalPosts}</strong></div>
                    <div>En çok okunan yazınız: <strong>${escapeHtml(mostReadPost?.title || '—')}</strong> (${mostReadPost?.views || 0})</div>
                </div>
            </div>
        </div>
    `;
}

async function loadBlogPosts(options = {}) {
    const params = new URLSearchParams(window.location.search);
    const mineMode = params.get('mine') === '1';
    const category = options.category || getBlogCategoryFromUrl();

    showBlogView('list', { mine: mineMode });

    const container = document.getElementById('blogPostsContainer');
    if (!container) return;


    // If user wants to view their own posts, require auth
    if (mineMode && (!auth || !auth.currentUser)) {
        container.innerHTML = '<p style="color:var(--text-muted);">Lütfen önce giriş yapın.</p>';
        return;
    }

    try {
        const allSnap = await getDocs(query(collection(db, 'blogs'), orderBy('createdAt', 'desc')));
        container.innerHTML = '';

        // Show either the global "En Çok Okunanlar" table or the "Profilim" widget (mine view)
        const mostReadContainer = document.getElementById('mostReadContainer');

        if (!mineMode) {
            renderMostReadPosts();
        }

        if (allSnap.empty) {
            container.innerHTML = `<p style="color:var(--text-muted);">${mineMode ? 'Henüz kendi yazınız yok.' : 'Henüz yayımlanmış bir gönderi yok.'}</p>`;
            if (mineMode && mostReadContainer) {
                renderMyBlogSummary([]);
            }
            return;
        }

        // Filter posts (hide drafts from others unless author/admin)
        const filtered = allSnap.docs.filter(doc => {
            const data = doc.data();
            const isDraft = data.status === 'draft';
            const isLoggedIn = !!auth.currentUser;
            const uid = auth.currentUser?.uid;
            const username = (auth.currentUser?.email || '').split('@')[0];

            const isAuthor = isLoggedIn && (
                data.authorUid === uid ||
                data.authorEmail === auth.currentUser.email ||
                data.authorUsername === username ||
                data.author === username
            );

            // Hide drafts from non-authors/non-admins when not in "mine" view
            if (!mineMode && isDraft && !user.isAdmin && !isAuthor) {
                return false;
            }

            if (!mineMode) return true;

            const isMine = isAuthor;

            // If this is my post but missing authorUid, patch it for future queries
            if (isMine && !data.authorUid && uid) {
                updateDoc(doc.ref, { authorUid: uid }).catch(() => {});
            }

            return isMine;
        });

        // Show category filters
        renderBlogCategoryFilters(category);

        // Show profile/stat widget in "Yazılarım" view
        if (mineMode) {
            renderMyBlogSummary(filtered);
        }

        if (filtered.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);">${mineMode ? 'Henüz kendi yazınız yok.' : 'Henüz yayımlanmış bir gönderi yok.'}</p>`;
            return;
        }

        const selectedCategory = category || 'Tümü';
        let filteredByCategory = filtered;
        if (selectedCategory && selectedCategory !== 'Tümü') {
            filteredByCategory = filtered.filter(doc => {
                const data = doc.data();
                const postCategory = (data.category || 'Genel');
                return postCategory === selectedCategory;
            });
        }

        if (filteredByCategory.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);">${mineMode ? 'Bu kategoride henüz bir yazınız yok.' : 'Bu kategoride henüz yazı yok.'}</p>`;
            return;
        }

        filteredByCategory.forEach(doc => {
            const data = doc.data();
            const excerpt = (data.content || '').substring(0, 200).replace(/\n/g, ' ');
            const excerptDisplay = `${excerpt}${excerpt.length >= 200 ? '...' : ''}`;
            const authorLabel = data.authorUid === (auth?.currentUser?.uid) ? ' (Siz)' : '';

            const authorName = data.authorUsername || data.author || 'Anonim';
            const savedAvatar = data.authorAvatar || data.authorAvatarSeed || '';
            const cachedAvatar = data.authorUid ? blogAuthorAvatarCache[data.authorUid] : null;
            const avatarUrl = getAvatarUrl(cachedAvatar || savedAvatar || 'assets/img/strendsaydamv2.png', 'user');

            const isAuthor = Boolean(auth.currentUser) && (
                data.authorUid === auth.currentUser.uid ||
                data.authorEmail === auth.currentUser.email ||
                data.authorUsername === (auth.currentUser.email || '').split('@')[0] ||
                data.author === (auth.currentUser.email || '').split('@')[0]
            );

            const postHtml = `
                <div class="glass-card" style="padding:15px 20px; margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:34px; height:34px; border-radius:50%; overflow:hidden; background:#f0f0f0; flex-shrink:0;">
                                <img src="${avatarUrl}" alt="avatar" data-post-id="${doc.id}" data-author-uid="${data.authorUid || ''}" style="width:100%; height:100%; object-fit:cover;" />
                            </div>
                            <div style="font-size:0.85rem; color:var(--text-muted);">
                                <div style="font-weight:700;">${escapeHtml(authorName)}</div>
                                <div style="font-size:0.75rem;">Gönderildi: ${formatPostTimestamp(data.createdAt)}</div>
                            </div>
                        </div>
                        <div style="text-align:right; font-size:0.78rem; color:var(--text-muted);">
                            <div><i class="fa-solid fa-tag" style="margin-right:6px;"></i>Kategori: <strong>${escapeHtml(data.category || 'Genel')}</strong></div>
                            <div><i class="fa-solid fa-eye" style="margin-right:6px;"></i>Okundu Sayısı: <strong>${data.views || 0}</strong></div>
                        </div>
                    </div>
                    <h3 style="margin-top:0; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <i class="fa-solid fa-newspaper" style="font-size:1rem;"></i>
                        <a href="blog.html?id=${doc.id}" style="text-decoration:none;color:inherit;">${escapeHtml((data.title || '').charAt(0).toUpperCase() + (data.title || '').slice(1))}</a>${authorLabel}
                        ${data.status === 'draft' ? '<span style="background: rgba(245, 158, 11, 0.15); color: #92400e; padding: 2px 10px; border-radius: 999px; font-size: 0.75rem;">Taslak</span>' : ''}
                    </h3>
                    <p id="blog-excerpt-${doc.id}" data-original-encoded="${encodeURIComponent(excerptDisplay)}" style="color:var(--text-muted); font-size:0.95rem; line-height:1.6; margin-top:10px;">${escapeHtml(excerptDisplay)}</p>
                    <div class="post-action-row" style="margin-top:14px; gap:10px; align-items:center;">
                        <a href="blog.html?id=${doc.id}" class="mini-link-btn post-action-btn">
                            <i class="fa-solid fa-arrow-right" style="font-size:0.85rem;"></i>
                            <span>Devamını Oku</span>
                        </a>
                        <button class="mini-link-btn post-action-btn translate-content-btn" data-translate-target="blog-excerpt-${doc.id}" type="button" title="${getLangText('translateToEnglishTitle', 'İngilizceye çevir')}" onclick="event.preventDefault(); event.stopPropagation(); toggleTranslateContentToEnglish(this, 'blog-excerpt-${doc.id}'); return false;">
                            <span class="translate-lang-badge">EN</span>
                        </button>
                        ${!isAuthor ? `
                            <button class="mini-link-btn post-action-btn" type="button" title="Normal gönderiye tebrik gönder" onclick="window.sendBlogTebrikToAuthor('${data.authorUid || ''}', '${(data.authorUsername || data.author || '').replace(/'/g, "\\'")}', '${doc.id}')">
                                <i class="fa-solid fa-gift" style="font-size:0.85rem;"></i>
                            </button>
                        ` : ''}
                        ${isAuthor ? `
                            <button class="mini-link-btn post-action-btn" type="button" title="Düzenle" onclick="startEditingBlogPost('${doc.id}')">
                                <i class="fa-solid fa-pen" style="font-size:0.85rem;"></i>
                            </button>
                            <button class="mini-link-btn post-action-btn post-action-btn--danger" type="button" title="Sil" onclick="deleteBlogPost('${doc.id}')">
                                <i class="fa-solid fa-trash" style="font-size:0.85rem;"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>`;
            container.innerHTML += postHtml;

            // If no avatar stored or it's default, try fetching the author's real avatar from user profile
            if (data.authorUid && !savedAvatar) {
                fetchAndUpdateAuthorAvatar(data.authorUid, doc.id);
            }
        });
    } catch (e) {
        console.error('loadBlogPosts hata:', e);
        container.innerHTML = '<p style="color:var(--text-muted);">Yazılar yüklenemedi.</p>';
    }
}

async function loadBlogPostById(id) {
    showBlogView('post');

    const titleEl = document.getElementById('blogPostTitle');
    const contentEl = document.getElementById('blogPostContent');
    const actionsEl = document.getElementById('blogPostActions');

    if (titleEl) titleEl.textContent = 'Yükleniyor...';
    if (contentEl) contentEl.textContent = '';
    if (actionsEl) actionsEl.innerHTML = '';

    if (!id) {
        if (titleEl) titleEl.textContent = 'Yazı Bulunamadı';
        return;
    }

    try {
        const docRef = doc(db, 'blogs', id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            if (titleEl) titleEl.textContent = 'Yazı bulunamadı';
            if (contentEl) contentEl.textContent = '';
            return;
        }

        // Increment view count (safe even if field missing)
        // Ensure we only increment once per session per post to avoid +3 jumps on reload
        if (!viewedPostIds.has(id)) {
            viewedPostIds.add(id);
            updateDoc(docRef, { views: increment(1) }).catch(() => {});
        }

        // Add current user to "okuyanlar" list (show avatars)
        if (auth.currentUser && !readersUpdatedPostIds.has(id)) {
            readersUpdatedPostIds.add(id);
            const readerObj = {
                uid: auth.currentUser.uid,
                username: user.username || (auth.currentUser.email || '').split('@')[0],
                displayName: user.displayName || user.username || 'Anonim',
                avatarUrl: user.avatarUrl || 'assets/img/strendsaydamv2.png'
            };
            updateDoc(docRef, { readers: arrayUnion(readerObj) }).catch(() => {});
        }

        const data = snap.data();
        const categoryEl = document.getElementById('blogPostCategory');
        if (titleEl) titleEl.textContent = data.title || '';
        if (categoryEl) categoryEl.textContent = `Kategori: ${data.category || 'Genel'}`;
        if (contentEl) {
                contentEl.textContent = stripYoutubeLinks(data.content || '');
            
            // YouTube videolarını ekle
            const youtubeHtml = extractAndRenderYoutubeVideos(data.content || '');
            if (youtubeHtml) {
                contentEl.innerHTML += youtubeHtml;
            }
        }

        // show edit + delete icons for author (only one of each)
        if (actionsEl) {
            const alreadyRenderedFor = actionsEl.dataset.blogActionFor;
            const isAuthor = Boolean(auth.currentUser) && (
                data.authorUid === auth.currentUser.uid ||
                data.authorEmail === auth.currentUser.email ||
                data.authorUsername === (auth.currentUser.email || '').split('@')[0] ||
                data.author === (auth.currentUser.email || '').split('@')[0]
            );

            // Clear prior action buttons if switching posts or user is not author
            if (!isAuthor || alreadyRenderedFor !== id) {
                actionsEl.innerHTML = '';
                delete actionsEl.dataset.blogActionFor;
            }

            if (isAuthor && alreadyRenderedFor !== id) {
                const translateBtn = document.createElement('button');
                translateBtn.className = 'blog-action-btn';
                translateBtn.type = 'button';
                translateBtn.title = getLangText('translateToEnglishTitle', 'İngilizceye çevir');
                translateBtn.innerHTML = '<span class="translate-lang-badge">EN</span>';
                translateBtn.setAttribute('data-translate-target', 'blogPostContent');
                translateBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleTranslateContentToEnglish(translateBtn, 'blogPostContent');
                };

                const editBtn = document.createElement('button');
                editBtn.className = 'blog-action-btn';
                editBtn.title = 'Düzenle';
                editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
                editBtn.onclick = () => startEditingBlogPost(id, data);

                const delBtn = document.createElement('button');
                delBtn.className = 'blog-action-btn blog-action-delete';
                delBtn.title = 'Sil';
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                delBtn.onclick = async () => {
                    if (!confirm('Bu yazıyı silmek istediğinizden emin misiniz?')) return;
                    await deleteBlogPost(id);
                };

                actionsEl.appendChild(translateBtn);
                actionsEl.appendChild(editBtn);

                // If this is a draft, allow publishing directly from the post view
                if (data.status === 'draft') {
                    const publishDraftBtn = document.createElement('button');
                    publishDraftBtn.className = 'blog-action-btn';
                    publishDraftBtn.title = 'Yayınla';
                    publishDraftBtn.innerHTML = '<i class="fa-solid fa-upload"></i>';
                    publishDraftBtn.onclick = async () => {
                        await publishDraftPost(id);
                    };
                    actionsEl.appendChild(publishDraftBtn);
                }

                actionsEl.appendChild(delBtn);
                actionsEl.dataset.blogActionFor = id;
            }

            if (!isAuthor && actionsEl) {
                const translateBtn = document.createElement('button');
                translateBtn.className = 'blog-action-btn';
                translateBtn.type = 'button';
                translateBtn.title = getLangText('translateToEnglishTitle', 'İngilizceye çevir');
                translateBtn.innerHTML = '<span class="translate-lang-badge">EN</span>';
                translateBtn.setAttribute('data-translate-target', 'blogPostContent');
                translateBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleTranslateContentToEnglish(translateBtn, 'blogPostContent');
                };

                const blogTebrikBtn = document.createElement('button');
                blogTebrikBtn.className = 'blog-action-btn';
                blogTebrikBtn.title = 'Gönderi yazısına tebrik gönder';
                blogTebrikBtn.innerHTML = '<i class="fa-solid fa-gift"></i>';
                blogTebrikBtn.onclick = () => window.sendBlogTebrikToAuthor(data.authorUid, data.authorUsername || data.author || '', id);
                actionsEl.appendChild(translateBtn);
                actionsEl.appendChild(blogTebrikBtn);
            }
        }

        // Setup share / copy link buttons inside blog post view
        const copyBtn = document.getElementById('copyPostLinkBtn');
        const shareBtn = document.getElementById('shareBtn');
        const whatsappBtn = document.getElementById('shareWhatsAppBtn');
        const facebookBtn = document.getElementById('shareFacebookBtn');
        const xBtn = document.getElementById('shareXBtn');
        const copyStatus = document.getElementById('copyStatus');

        // Build a stable link that always points to this post (even if current URL has other query params)
        const url = new URL(window.location.href);
        url.searchParams.set('id', id);
        url.searchParams.delete('mine');
        url.searchParams.delete('create');
        const postUrl = url.toString();

        const shareText = (data.title || 'Bir içerik') + ' - SosyaLTrend';
        const encodedText = encodeURIComponent(shareText);
        const encodedUrl = encodeURIComponent(postUrl);

        const showStatus = (text) => {
            if (copyStatus) copyStatus.textContent = text;
            setTimeout(() => {
                if (copyStatus) copyStatus.textContent = '';
            }, 2200);
        };

        const openPopup = (link) => {
            window.open(link, '_blank', 'noopener,noreferrer,width=600,height=600');
        };

        if (shareBtn) {
            shareBtn.onclick = async () => {
                try {
                    if (navigator.share) {
                        await navigator.share({
                            title: data.title || 'Gönderi yazısı',
                            text: data.title || '',
                            url: postUrl
                        });
                        showStatus('Paylaşım açıldı.');
                        return;
                    }
                } catch (err) {
                    console.warn('Web Share API hata:', err);
                }

                // Fallback to opening share menu (X / Facebook / WhatsApp)
                openPopup(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`);
            };
        }

        if (whatsappBtn) {
            whatsappBtn.onclick = () => {
                openPopup(`https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`);
            };
        }

        if (facebookBtn) {
            facebookBtn.onclick = () => {
                openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
            };
        }

        if (xBtn) {
            xBtn.onclick = () => {
                openPopup(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`);
            };
        }

        if (copyBtn) {
            copyBtn.onclick = async () => {
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(postUrl);
                        showStatus('Link kopyalandı!');
                        return;
                    }

                    // Fallback for insecure contexts (file://) or old browsers
                    const tmp = document.createElement('textarea');
                    tmp.value = postUrl;
                    tmp.setAttribute('readonly', '');
                    tmp.style.position = 'absolute';
                    tmp.style.left = '-9999px';
                    document.body.appendChild(tmp);
                    tmp.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(tmp);

                    if (success) {
                        showStatus('Link kopyalandı!');
                    } else {
                        throw new Error('execCommand copy failed');
                    }
                } catch (err) {
                    console.warn('Link kopyalama/ paylaşma hatası', err);
                    showStatus('Kopyalama başarısız oldu.');
                    // Fallback: prompt user to copy manually
                    setTimeout(() => {
                        window.prompt('Bu linki kopyalayın:', postUrl);
                    }, 50);
                }
            };
        }

        // Render "okuyanlar" and comments sections below this post
        renderBlogReaders(id, data.readers || []);
        renderBlogComments(id, data.comments || []);
    } catch (e) {
        console.error('loadBlogPostById hata:', e);
        if (contentEl) contentEl.textContent = 'Yüklenirken hata oluştu.';
    }
}

function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'cmt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

async function addBlogComment(postId, text) {
    if (!auth.currentUser) throw new Error('Giriş yapılmamış.');
    const comment = {
        commentId: generateId(),
        username: user.username || (auth.currentUser.email || '').split('@')[0],
        displayName: user.displayName || user.username || 'Anonim',
        avatarUrl: user.avatarUrl || 'assets/img/strendsaydamv2.png',
        text: text.trim(),
        timestamp: Date.now()
    };

    const docRef = doc(db, 'blogs', postId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Yazı bulunamadı.');

    const data = snap.data();
    const comments = Array.isArray(data.comments) ? data.comments : [];

    // If comments field exists but is not an array, reset it safely
    if (!Array.isArray(data.comments)) {
        await setDoc(docRef, { comments: [...comments, comment] }, { merge: true });
    } else {
        await updateDoc(docRef, {
            comments: arrayUnion(comment)
        });
    }
}

async function deleteBlogComment(postId, commentId) {
    try {
        const docRef = doc(db, 'blogs', postId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const comment = (data.comments || []).find(c => c.commentId === commentId);
        if (!comment) return;
        await updateDoc(docRef, {
            comments: arrayRemove(comment)
        });
    } catch (e) {
        console.error('deleteBlogComment hata:', e);
    }
}

function renderBlogReaders(postId, readers = []) {
    const parent = document.getElementById('blogReadersList');
    if (!parent) return;

    const unique = [];
    const seen = new Set();
    (readers || []).forEach(r => {
        if (!r || !r.uid) return;
        if (seen.has(r.uid)) return;
        seen.add(r.uid);
        unique.push(r);
    });

    if (unique.length === 0) {
        parent.innerHTML = '<span style="color:var(--text-muted); font-size:0.9rem;">Henüz kimse okumadı.</span>';
        return;
    }

    const maxShow = 8;
    const shown = unique.slice(0, maxShow);

    parent.innerHTML = shown.map(r => {
        const avatar = getAvatarUrl(r.avatarUrl || 'assets/img/strendsaydamv2.png', 'user');
        const name = escapeHtml(r.displayName || r.username || 'Anonim');
        return `
            <div class="reader-avatar" title="${name}" style="width:32px; height:32px; border-radius:50%; overflow:hidden; border:1px solid var(--border);">
                <img src="${avatar}" alt="${name}" style="width:100%; height:100%; object-fit:cover;" />
            </div>
        `;
    }).join('');

    if (unique.length > maxShow) {
        parent.innerHTML += `<div style="display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; border:1px solid var(--border); background: rgba(0,0,0,0.06); font-size:0.75rem; color:var(--text-muted);">+${unique.length - maxShow}</div>`;
    }
}

function renderBlogComments(postId, comments = []) {
    const formContainer = document.getElementById('blogCommentForm');
    const listContainer = document.getElementById('blogCommentList');
    if (!formContainer || !listContainer) {
        console.warn('Yorum alanı bulunamadı (blogCommentForm/blogCommentList).');
        return;
    }

    console.log('renderBlogComments called', { postId, commentCount: (comments || []).length });

    const isLoggedIn = !!auth.currentUser;

    if (!isLoggedIn) {
        formContainer.innerHTML = '<div style="color:var(--text-muted);">Yorum yazmak için giriş yapın.</div>';
    } else {
        formContainer.innerHTML = `
            <textarea id="commentInput" placeholder="Yorumunuzu yazın..." rows="3" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:10px; resize:vertical;"></textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; gap:10px;">
                <span id="commentCharCount" style="color:var(--text-muted); font-size:0.9rem;">0/500</span>
                <button id="sendCommentBtn" class="mini-link-btn" type="button">Yorumu Gönder</button>
            </div>
        `;

        const input = document.getElementById('commentInput');
        const counter = document.getElementById('commentCharCount');
        const sendBtn = document.getElementById('sendCommentBtn');

        const updateCount = () => {
            if (!input || !counter) return;
            const len = input.value.length;
            counter.textContent = `${len}/500`;
            if (len > 500) {
                input.value = input.value.substring(0, 500);
            }
        };

        if (input) {
            input.addEventListener('input', updateCount);
        }

        if (sendBtn) {
            sendBtn.onclick = async () => {
                if (!input) return;
                const text = input.value.trim();
                if (!text) return;

                sendBtn.disabled = true;
                sendBtn.innerText = 'Gönderiliyor...';

                try {
                    await addBlogComment(postId, text);
                    input.value = '';
                    updateCount();
                    loadBlogPostById(postId);
                } catch (err) {
                    console.error('Yorum gönderme hatası:', err);
                    alert('Yorum gönderilemedi.');
                }

                sendBtn.disabled = false;
                sendBtn.innerText = 'Yorumu Gönder';
            };
        }
    }

    const sorted = (comments || []).slice().sort((a, b) => {
        const getMs = (ts) => {
            if (!ts) return 0;
            if (typeof ts === 'number') return ts;
            if (ts instanceof Date) return ts.getTime();
            if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
            if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
            return 0;
        };

        return getMs(a.timestamp) - getMs(b.timestamp);
    });

    if (sorted.length === 0) {
        listContainer.innerHTML = '<p style="color:var(--text-muted); margin:0;">Henüz yorum yok.</p>';
        return;
    }

    listContainer.innerHTML = sorted.map(comment => {
        const avatar = getAvatarUrl(comment.avatarUrl || 'assets/img/strendsaydamv2.png', 'user');
        const name = escapeHtml(comment.displayName || comment.username || 'Anonim');
        const time = formatTime(comment.timestamp);
        const text = escapeHtml(comment.text || '');
        const canDelete = auth.currentUser && comment.username === (user.username || '');

        return `
            <div class="comment-item" style="display:flex; gap:10px; padding:10px 0; border-bottom:1px solid var(--border);">
                <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0;">
                    <img src="${avatar}" alt="avatar" style="width:100%; height:100%; object-fit:cover;" />
                </div>
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:0.9rem;">
                        <div><strong>${name}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">${time}</span></div>
                        ${canDelete ? `<button class="mini-link-btn" style="padding:4px 10px;" data-comment-id="${comment.commentId}">Sil</button>` : ''}
                    </div>
                    <div style="margin-top:4px; white-space:pre-wrap; line-height:1.5; color:var(--text-main);">${text}</div>
                </div>
            </div>
        `;
    }).join('');

    // Attach delete handlers
    listContainer.querySelectorAll('button[data-comment-id]').forEach(btn => {
        btn.onclick = async () => {
            const commentId = btn.dataset.commentId;
            if (!commentId) return;
            if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return;
            await deleteBlogComment(postId, commentId);
            loadBlogPostById(postId);
        };
    });
}

async function deleteBlogPost(id) {
    try {
        await deleteDoc(doc(db, 'blogs', id));
        window.location.href = 'blog.html?mine=1';
    } catch (e) {
        console.error('deleteBlogPost hata:', e);
        alert('Yazı silinemedi: ' + (e.message || ''));
    }
}

async function publishDraftPost(id) {
    try {
        await updateDoc(doc(db, 'blogs', id), {
            status: 'published',
            publishedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        // reload the post view to reflect updated status
        window.location.href = `blog.html?id=${id}`;
    } catch (e) {
        console.error('publishDraftPost hata:', e);
        alert('Taslak yayına alınamadı: ' + (e.message || ''));
    }
}

let isPublishingBlogPost = false;
let editingBlogId = null;

async function startEditingBlogPost(id, data) {
    editingBlogId = id;
    showBlogView('create');

    // If caller did not provide post data, fetch it on demand (safe for inline onclick handlers)
    if (!data) {
        try {
            const snap = await getDoc(doc(db, 'blogs', id));
            data = snap.exists() ? snap.data() : {};
        } catch (e) {
            console.warn('startEditingBlogPost: veri çekilemedi', e);
            data = {};
        }
    }

    const titleEl = document.getElementById('blogTitle');
    const contentEl = document.getElementById('blogContent');
    const status = document.getElementById('blogStatus');
    const pageTitle = document.getElementById('blogPageTitle');
    const publishBtn = document.getElementById('publishBlogBtn');

    const categoryEl = document.getElementById('blogCategory');

    if (titleEl) titleEl.value = data.title || '';
    if (contentEl) contentEl.value = data.content || '';
    if (categoryEl) categoryEl.value = data.category || 'Genel';
    if (status) status.textContent = 'Düzenleme modunda. Kaydetmek için Güncelle\'ye basın.';
    if (pageTitle) pageTitle.textContent = 'Gönderi yazısını Düzenle';
    if (publishBtn) publishBtn.textContent = 'Güncelle';
}

async function publishBlogPost({ draft = false } = {}) {
    console.log('publishBlogPost invoked', { draft });
    const titleEl = document.getElementById('blogTitle');
    const contentEl = document.getElementById('blogContent');
    const status = document.getElementById('blogStatus');
    console.log('elements', { titleEl, contentEl, status });
    if (!titleEl || !contentEl || !status) {
        console.warn('missing elements for publish');
        return;
    }

    // Prevent double-submission (e.g. multiple event listeners / double click)
    if (isPublishingBlogPost) {
        console.warn('publishBlogPost already in progress, ignoring additional call.');
        return false;
    }
    isPublishingBlogPost = true;

    if (!auth.currentUser) {
        console.warn('user not authenticated');
        const savedName = localStorage.getItem('st_displayName');
        status.textContent = savedName
            ? `Görünüşe göre çıkış yapmışsınız. (${savedName})` 
            : 'Lütfen giriş yapın.';
        status.style.color = '#ef4444';
        isPublishingBlogPost = false;
        return;
    }
    const title = titleEl.value.trim();
    const content = contentEl.value.trim();
    const categoryEl = document.getElementById('blogCategory');
    const category = categoryEl ? categoryEl.value : 'Genel';
    console.log('title/content lengths', title.length, content.length);
    if (!title || !content) {
        status.textContent = 'Lütfen başlık ve içerik girin.';
        status.style.color = '#ef4444';
        isPublishingBlogPost = false;
        return;
    }

    status.textContent = draft ? 'Taslak olarak kaydediliyor...' : 'Yayınlanıyor...';
    status.style.color = 'var(--text-muted)';

    try {
        const dataToUpdate = {
            title,
            content,
            category,
            updatedAt: serverTimestamp(),
            status: draft ? 'draft' : 'published'
        };

        if (editingBlogId) {
            // Update existing post
            await updateDoc(doc(db, 'blogs', editingBlogId), dataToUpdate);

            status.textContent = draft ? '✅ Taslak kaydedildi.' : '✅ Yazınız güncellendi.';
            status.style.color = '#10b981';

            if (!draft) {
                // redirect to updated post view
                setTimeout(() => {
                    window.location.href = `blog.html?id=${editingBlogId}`;
                }, 900);
            }
        } else {
            // Create new post
            const newDoc = await addDoc(collection(db, 'blogs'), {
                ...dataToUpdate,
                authorUid: auth.currentUser.uid,
                authorUsername: (auth.currentUser.email || '').split('@')[0],
                authorEmail: auth.currentUser.email,
                authorAvatar: user.avatarUrl || 'assets/img/strendsaydamv2.png',
                createdAt: serverTimestamp()
            });
            await queueContentModerationIfNeeded({
                contentType: 'blog',
                contentId: newDoc.id,
                contentText: `${title}\n${content}`,
                authorUid: auth.currentUser.uid,
                authorUsername: (auth.currentUser.email || '').split('@')[0],
                authorDisplayName: user.displayName || user.name || (auth.currentUser.email || '').split('@')[0]
            });

            status.textContent = draft ? '✅ Taslak kaydedildi.' : '✅ Yazınız yayına alındı.';
            status.style.color = '#10b981';

            titleEl.value = '';
            contentEl.value = '';
            if (categoryEl) categoryEl.value = 'Genel';

            if (!draft) {
                // redirect to "my posts" after brief pause so user sees feedback
                setTimeout(() => {
                    window.location.href = 'blog.html?mine=1';
                }, 1200);
            } else {
                // Keep editing the draft if desired
                editingBlogId = newDoc.id;
            }
        }
        return true;
    } catch (e) {
        console.error('publishBlogPost hata:', e);
        status.textContent = '❌ Yayınlanamadı: ' + (e.message || '');
        status.style.color = '#ef4444';
        return false;
    } finally {
        isPublishingBlogPost = false;
        // clear edit state after attempt only when publishing (not saving draft)
        if (!draft) {
            editingBlogId = null;
        }
    }
}

// make function available globally for inline onclick
window.publishBlogPost = publishBlogPost;

async function saveBlogDraft() {
    return publishBlogPost({ draft: true });
}
window.saveBlogDraft = saveBlogDraft;

function updateBlogViewFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    const createMode = params.get('create') === '1';

    if (postId) {
        loadBlogPostById(postId);
        return;
    }

    if (createMode) {
        showBlogView('create');
        return;
    }

    // default list view (handles mine=1 internally)
    loadBlogPosts();
}

function attachBlogNavHandlers() {
    const getCurrentCategoryParam = () => {
        const category = getBlogCategoryFromUrl();
        return category && category !== 'Tümü' ? `&category=${encodeURIComponent(category)}` : '';
    };

    const navConfig = [
        { id: 'btn-blog-all', url: 'blog.html' },
        { id: 'btn-blog-mine', url: 'blog.html?mine=1' },
        { id: 'btn-blog-create', url: 'blog.html?create=1' }
    ];

    navConfig.forEach(cfg => {
        const btn = document.getElementById(cfg.id);
        if (!btn) return;
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            const catParam = getCurrentCategoryParam();
            const targetUrl = cfg.url + (cfg.url.includes('?') ? catParam : (catParam ? '?' + catParam.slice(1) : ''));
            if (window.location.pathname.endsWith('blog.html') && window.location.search === new URL(targetUrl, window.location.origin).search) {
                // Already on same view; no need to rerun
                return;
            }
            history.pushState({}, '', targetUrl);
            updateBlogViewFromUrl();
        });
    });

    window.addEventListener('popstate', () => {
        updateBlogViewFromUrl();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initChatWidget();
    initChatListsPanel();
    loadStoredChatNotifications();

    // blog page init
    if (document.getElementById('page-blog')) {
        updateBlogViewFromUrl();
        attachBlogNavHandlers();
    }

    // schedule delayed binding in case button is added later
    setTimeout(() => {
        const btn = document.getElementById('publishBlogBtn');
        console.log('DOMContentLoaded delayed check: publishBtn exists?', !!btn);
        if (btn) btn.addEventListener('click', publishBlogPost);
    }, 250);

    // Ensure publish button works even if listener binding didn't happen
    document.body.addEventListener('click', e => {
        if (e.target && e.target.id === 'publishBlogBtn') {
            console.log('body listener detected publish click');
            publishBlogPost();
        }
        if (e.target && e.target.id === 'saveDraftBtn') {
            console.log('body listener detected save draft click');
            saveBlogDraft();
        }
    });
});

// ensure publish button gets listener shortly after load
// (includesLoaded may fire before app.js loads, so use timeout fallback)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const pubBtn = document.getElementById('publishBlogBtn');
        console.log('delayed bind: publishBtn exists?', !!pubBtn);
        if (pubBtn) {
            pubBtn.addEventListener('click', publishBlogPost);
        }
    }, 250);
});

// Start listening for messages when user is authenticated
onAuthStateChanged(auth, (authUser) => {
    if (authUser) {
        setTimeout(() => {
            listenForIncomingMessages();
            if (typeof updateChatUnreadIndicator === 'function') {
                updateChatUnreadIndicator();
            }
            if (typeof restoreUnreadChatNotifications === 'function') {
                restoreUnreadChatNotifications();
            }
        }, 2000);
    }
    // Update create view UI when auth changes
    updateCreateViewAuthState();

    // If we're on the blog page, reload the appropriate view when auth changes (mine=1 filtering)
    if (window.location.pathname.includes('blog.html')) {
        const params = new URLSearchParams(window.location.search);
        const postId = params.get('id');
        const createMode = params.get('create') === '1';

        if (postId) {
            loadBlogPostById(postId);
        } else if (createMode) {
            showBlogView('create');
        } else {
            loadBlogPosts();
        }
    }
});

window.addEventListener('online', () => {
    if (typeof updateChatUnreadIndicator === 'function') {
        updateChatUnreadIndicator();
    }
    if (typeof restoreUnreadChatNotifications === 'function') {
        restoreUnreadChatNotifications();
    }
});

window.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        if (typeof updateChatUnreadIndicator === 'function') {
            updateChatUnreadIndicator();
        }
        if (typeof restoreUnreadChatNotifications === 'function') {
            restoreUnreadChatNotifications();
        }
    }
    // Toggle presence when page visibility changes to better reflect actual online state
    try {
        if (auth.currentUser) {
            if (document.hidden) {
                window.setCurrentUserOffline();
            } else {
                window.setCurrentUserOnline();
            }
        }
    } catch (e) {}
});

// The back button should return to the chat list panel instead of leaving the widget open.
const backBtnElem = document.getElementById('chat-back-btn');
if (backBtnElem) {
    backBtnElem.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.backToFriendList === 'function') {
            window.backToFriendList();
            return;
        }

        const widget = document.querySelector('.chat-widget-container');
        const panel = document.querySelector('.chat-lists-panel');
        if (widget) widget.classList.remove('active');
        if (panel) {
            panel.classList.add('active');
            panel.style.display = 'flex';
            document.body.classList.add('chat-open');
        }
    });
}

// Expose blog edit/delete helpers to global scope so inline onclicks work (module scope doesn't expose them by default)
window.startEditingBlogPost = startEditingBlogPost;
window.deleteBlogPost = deleteBlogPost;

/* ═══════════════════════════════════════════════════════
   Sohbet Sayfası — Header & Widget Management
═══════════════════════════════════════════════════════ */

/**
 * Sohbet sayfasında chat header'ı güncelle
 * @param {Object|null} participant - { name, avatar, online } veya null (gizle)
 */


