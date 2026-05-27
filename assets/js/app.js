import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, updateDoc, setDoc, arrayUnion, arrayRemove, deleteDoc, getDoc, getDocs, limit, where, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// Track length for main post box (share)
function updatePostCount() {
    const input = document.getElementById('postInput');
    const counter = document.getElementById('post-charcount');
    if (!input || !counter) return;
    let text = input.innerText || input.textContent || '';
    // enforce max length
    if (text.length > 500) {
        input.innerText = text.substring(0, 500);
        text = input.innerText;
    }
    const len = text.length;
    counter.textContent = `${len}/500`;
}
window.updatePostCount = updatePostCount;

// tüm yerlerde kullanılabilecek genel yardımcı: HTML entitelerini çözerek
// gerçek karakter (örneğin emoji) haline getirir.
function decodeEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
}

// Request card'ı sil
function removeRequestCard(uid) {
    const card = document.getElementById(`friend-request-${uid}`);
    if (card) {
        card.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => card.remove(), 300);
    }
}

// Bileşenleri dinamik olarak yükleme fonksiyonu    
async function loadComponents() {

// Diğer header/footer yükleme kodların...
    await loadSuggestions();
    await loadTopTebrikList();
    
    // Avatar input listener'ı
    const fileInput = document.getElementById('fileAvatarInput');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            handleFileSelect(this);
        });
    }
    
    // Paylaş modalını önceden oluştur
    createShareModal();
    loadPollWidget();
}

// Expose delete functions for HTML onclicks
window.deleteVideo = deleteVideo;
window.deleteMusic = deleteMusic;

let pollWidgetUnsubscribe = null;
window.pollWidgetLatestPolls = [];

window.loadPollWidget = function() {
    const container = document.getElementById('poll-widget-content');
    if (!container) return;
    if (pollWidgetUnsubscribe) pollWidgetUnsubscribe();

    const pollQuery = query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(10));
    pollWidgetUnsubscribe = onSnapshot(pollQuery, (snap) => {
        const polls = [];
        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (!data) return;
            const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
            polls.push({ id: docSnap.id, ...data, expiresAt });
        });

        window.pollWidgetLatestPolls = polls;
        const now = new Date();
        const activePoll = polls.find(p => p.expiresAt > now) || null;
        const finishedPolls = polls.filter(p => p.expiresAt <= now).slice(0, 5);

        if (!activePoll && finishedPolls.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted);">Henüz anket yok.</div>';
            return;
        }

        if (activePoll) {
            renderActivePoll(container, activePoll, now, finishedPolls);
        } else {
            renderFinishedPollList(container, finishedPolls, now);
        }
    }, (error) => {
        console.error('Poll widget snapshot error:', error);
        const containerErr = document.getElementById('poll-widget-content');
        if (containerErr) containerErr.innerHTML = '<div style="color: var(--danger);">Anketler yüklenemedi.</div>';
    });
};

function renderActivePoll(container, activePoll, now, finishedPolls = []) {
    const pollExpired = activePoll.expiresAt <= now;
    const totalVotes = Object.values(activePoll.counts || {}).reduce((sum, count) => sum + (count || 0), 0);
    const userVoted = auth.currentUser && (activePoll.voters || []).some(v => v.uid === auth.currentUser.uid);
    const canVote = !pollExpired && auth.currentUser && !userVoted;

    const optionButtons = (activePoll.options || []).map(opt => {
        const count = activePoll.counts?.[opt.id] || 0;
        const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        return `
            <div style="margin-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; font-size:0.95rem;">
                    <span>${escapeHtml(opt.label)}</span>
                    <span>${count} oy</span>
                </div>
                <div style="height: 10px; background: var(--border); border-radius: 999px; overflow:hidden; margin-top:6px;">
                    <div style="width: ${percent}%; height:100%; background: linear-gradient(135deg, var(--primary), #8b5cf6);"></div>
                </div>
                ${canVote ? `<button onclick="votePoll('${activePoll.id}', '${opt.id}')" style="margin-top:10px; width:100%; background: var(--primary); color:white; border:none; border-radius:12px; padding:10px; cursor:pointer;">Oy ver</button>` : ''}
            </div>`;
    }).join('');

    const votersHtml = (activePoll.voters || []).slice(0, 12).map(v => `<span style="display:inline-flex; margin:2px 4px; padding:6px 10px; border-radius:999px; border:1px solid var(--border); background: rgba(99,102,241,0.08);">${escapeHtml(v.displayName || v.username || 'Anonim')}</span>`).join('') || '<div style="color: var(--text-muted);">Henüz oy kullanan yok.</div>';

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom: 10px;">
            <div>
                <strong style="font-size:0.95rem;">${escapeHtml(activePoll.question)}</strong>
                <div style="font-size:0.8rem; color: var(--text-muted); margin-top:4px;">${pollExpired ? 'Anket süresi doldu' : `Bitiş: ${activePoll.expiresAt.toLocaleString('tr-TR')}`}</div>
            </div>
            <div style="font-size:0.8rem; color: var(--text-muted);">${totalVotes} oy</div>
        </div>
        <div>${optionButtons}</div>
        <div style="font-size:0.85rem; color: var(--text-muted); margin-top: 8px;">Oy kullananlar:</div>
        <div style="margin-top: 8px; display:flex; flex-wrap:wrap; gap:4px;">${votersHtml}</div>
        ${!auth.currentUser ? '<div style="margin-top:10px; color:var(--danger); font-size:0.9rem;">Oy vermek için giriş yapın.</div>' : ''}
        ${auth.currentUser && userVoted && !pollExpired ? '<div style="margin-top:10px; color:var(--success); font-size:0.9rem;">Oyunuz kaydedildi. Sonuçları görebilirsiniz.</div>' : ''}
        ${finishedPolls.length ? `<div style="margin-top: 18px; font-size:0.92rem; font-weight:700; text-align:center;">Biten anketler</div>` : ''}
        ${finishedPolls.map(poll => {
            const total = Object.values(poll.counts || {}).reduce((sum, count) => sum + (count || 0), 0);
            return `
                <div style="margin-top: 10px; padding: 12px 14px; background: rgba(255,255,255,0.03); border-radius: 14px; border: 1px solid var(--border);">
                    <div style="font-size:0.92rem; font-weight:700; margin-bottom:6px;">${escapeHtml(poll.question)}</div>
                    <div style="font-size:0.8rem; color: var(--text-muted); margin-bottom: 8px;">Toplam oy: ${total} · Bitiş: ${poll.expiresAt.toLocaleString('tr-TR')}</div>
                    <button onclick="showPollResults('${poll.id}')" style="width:100%; background: var(--primary); color:white; border:none; border-radius:12px; padding:10px; cursor:pointer;">Sonuçları Göster</button>
                </div>`;
        }).join('')}
    `;
}

window.renderFinishedPollList = function(container, finishedPolls, now) {
    if (finishedPolls.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted);">Henüz tamamlanmış anket yok.</div>';
        return;
    }

    const listHtml = finishedPolls.map(poll => {
        const totalVotes = Object.values(poll.counts || {}).reduce((sum, count) => sum + (count || 0), 0);
        return `
            <div style="margin-bottom: 14px; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px solid var(--border);">
                <div style="font-size:0.95rem; font-weight:700; margin-bottom: 6px;">${escapeHtml(poll.question)}</div>
                <div style="font-size:0.82rem; color: var(--text-muted); margin-bottom: 10px;">Toplam oy: ${totalVotes} · Bitiş: ${poll.expiresAt.toLocaleString('tr-TR')}</div>
                <button onclick="showPollResults('${poll.id}')" style="width:100%; background: var(--primary); color:white; border:none; border-radius:12px; padding:10px; cursor:pointer;">Sonuçları Göster</button>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="margin-bottom: 12px; font-size:0.95rem; font-weight:700; text-align:center;"><span style="color: #22c55e;">Aktif anket bulunmuyor.</span><br>Geçmiş anketler aşağıdadır.</div>
        ${listHtml}
    `;
}

window.showPollResults = async function(pollId) {
    const container = document.getElementById('poll-widget-content');
    if (!container) return;

    try {
        const pollDoc = await getDoc(doc(db, 'polls', pollId));
        if (!pollDoc.exists()) {
            container.innerHTML = '<div style="color: var(--danger);">Anket bulunamadı.</div>';
            return;
        }

        const poll = pollDoc.data();
        const expiresAt = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : new Date(poll.expiresAt);
        const now = new Date();
        const totalVotes = Object.values(poll.counts || {}).reduce((sum, count) => sum + (count || 0), 0);
        const optionsHtml = (poll.options || []).map(opt => {
            const count = poll.counts?.[opt.id] || 0;
            const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            return `
                <div style="margin-bottom: 12px;">
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; font-size:0.95rem;">
                        <span>${escapeHtml(opt.label)}</span>
                        <span>${count} oy · ${percent}%</span>
                    </div>
                    <div style="height: 10px; background: var(--border); border-radius: 999px; overflow:hidden; margin-top:6px;">
                        <div style="width: ${percent}%; height:100%; background: linear-gradient(135deg, var(--primary), #8b5cf6);"></div>
                    </div>
                </div>`;
        }).join('');

        const votersHtml = (poll.voters || []).slice(0, 12).map(v => `<span style="display:inline-flex; margin:2px 4px; padding:6px 10px; border-radius:999px; border:1px solid var(--border); background: rgba(99,102,241,0.08);">${escapeHtml(v.displayName || v.username || 'Anonim')}</span>`).join('') || '<div style="color: var(--text-muted);">Henüz oy kullanan yok.</div>';

        container.innerHTML = `
            <div style="margin-bottom: 14px; display:flex; justify-content:space-between; align-items:flex-start; gap: 10px;">
                <div>
                    <strong style="font-size:0.95rem;">${escapeHtml(poll.question)}</strong>
                    <div style="font-size:0.8rem; color: var(--text-muted); margin-top:4px;">Bitiş: ${expiresAt.toLocaleString('tr-TR')}</div>
                </div>
                <button onclick="loadPollWidget()" style="background: transparent; color: var(--primary); border: 1px solid var(--primary); border-radius: 12px; padding: 8px 12px; cursor:pointer;">Geri</button>
            </div>
            <div style="font-size:0.85rem; color: var(--text-muted); margin-bottom: 12px;">Toplam oy: ${totalVotes}</div>
            <div>${optionsHtml}</div>
            <div style="font-size:0.85rem; color: var(--text-muted); margin-top: 10px;">Oy kullananlar:</div>
            <div style="margin-top: 10px; display:flex; flex-wrap:wrap; gap:4px;">${votersHtml}</div>
        `;
    } catch (error) {
        console.error('Sonuçlar yüklenirken hata:', error);
        container.innerHTML = '<div style="color: var(--danger);">Anket sonuçları yüklenemedi.</div>';
    }
};

window.votePoll = async function(pollId, optionId) {
    if (!auth.currentUser) {
        alert('Oy kullanmak için giriş yapın.');
        return;
    }
    try {
        const pollRef = doc(db, 'polls', pollId);
        const pollDoc = await getDoc(pollRef);
        if (!pollDoc.exists()) {
            alert('Anket bulunamadı.');
            return;
        }
        const poll = pollDoc.data();
        const expiresAt = poll.expiresAt?.toDate ? poll.expiresAt.toDate() : new Date(poll.expiresAt);
        if (expiresAt <= new Date()) {
            alert('Anket süresi dolmuş.');
            return;
        }
        if ((poll.voters || []).some(v => v.uid === auth.currentUser.uid)) {
            alert('Bu ankete zaten oy verdiniz.');
            return;
        }
        const voter = {
            uid: auth.currentUser.uid,
            username: user.username,
            displayName: user.displayName,
            optionId,
            votedAt: new Date()
        };
        await updateDoc(pollRef, {
            [`counts.${optionId}`]: increment(1),
            voters: arrayUnion(voter)
        });
        loadPollWidget();
    } catch (error) {
        console.error('Oy verme hatası:', error);
        alert('Oyunuz kaydedilemedi. Lütfen tekrar deneyin.');
    }
};

// Expose sendNotification for manual testing from console
window.sendNotification = sendNotification;
async function loadSuggestions() {
    const suggestionsContainer = document.getElementById('dynamic-suggestions-list');
    if (!suggestionsContainer) return;

    try {
        // Mevcut kullanıcının ID'sini al
        const currentUid = auth.currentUser ? auth.currentUser.uid : null;

        // Daha fazla kullanıcı çekip içinden eleme yapacağız (Daha iyi bir havuz için 20 kişi çektik)
        const q = query(collection(db, "users"), limit(20));
        const querySnapshot = await getDocs(q);
        
        let usersArray = [];
        querySnapshot.forEach((doc) => {
            // tüm kullanıcıları diziye ekle (kendimiz de dahil)
            usersArray.push({ id: doc.id, ...doc.data() });
        });

        // Diziyi rastgele karıştır (Her yenilemede farklı kişiler gelsin)
        usersArray.sort(() => Math.random() - 0.5);

        // Sadece ilk 5 kişiyi seç
        const selectedUsers = usersArray.slice(0, 5);
        // Eğer giriş yapan kullanıcı seçilmediyse en son elemana kendisini koy
        if (auth.currentUser) {
            const currentUid = auth.currentUser.uid;
            if (!selectedUsers.some(u => u.id === currentUid)) {
                const selfIdx = usersArray.findIndex(u => u.id === currentUid);
                if (selfIdx !== -1) {
                    selectedUsers[selectedUsers.length - 1] = usersArray[selfIdx];
                }
            }
        }

        suggestionsContainer.innerHTML = ''; // Temizle

        if (selectedUsers.length === 0) {
            suggestionsContainer.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted);">Önerilecek kullanıcı bulunamadı.</div>';
            return;
        }

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

        const friends = currentUserData.friends || [];
        const sentRequests = currentUserData.sentRequests || [];
        const incomingRequests = currentUserData.friendRequests || [];

        selectedUsers.forEach((user) => {
                    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random&color=fff`;
                    const userAvatar = user.avatarUrl || user.avatar || fallbackAvatar;

            const isFriend = friends.includes(user.id);
            const isSent = sentRequests.some(r => r.toUid === user.id);
            const isIncoming = incomingRequests.some(r => r.fromUid === user.id);
            const isSelf = auth.currentUser && user.id === auth.currentUser.uid;

            let btnLabel = 'Arkadaş Ol';
            let btnAttrs = 'style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.7rem; font-weight: 700; cursor: pointer;"';
            let btnOnclick = `onclick="sendFriendRequestToUid('${user.id}', '${user.username}')"`;

            if (isSelf) {
                btnLabel = 'Profilinize Gidin';
                btnAttrs = 'style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.7rem; font-weight: 700; cursor: pointer;"';
                btnOnclick = "onclick=\"window.location='profil.html'\"";
            } else if (isFriend) {
                btnLabel = 'Zaten Arkadaşsınız';
                btnAttrs = 'disabled style="opacity:0.6; cursor:default; background:#94a3b8; color:#fff; border:none; padding:6px 12px; border-radius:15px; font-size:0.7rem; font-weight:700;"';
                btnOnclick = '';
            } else if (isSent) {
                // allow cancellation from suggestions
                btnLabel = 'İsteği iptal et';
                btnAttrs = 'style="background: var(--primary); color: white; border: none; padding:6px 12px; border-radius:15px; font-size:0.7rem; font-weight:700; cursor:pointer;"';
                btnOnclick = `onclick="cancelFriendRequestToUid('${user.id}', '${user.username}')"`;
            } else if (isIncoming) {
                btnLabel = 'İstek Bekleniyor';
                btnAttrs = 'disabled style="opacity:0.6; cursor:default; background:#94a3b8; color:#fff; border:none; padding:6px 12px; border-radius:15px; font-size:0.7rem; font-weight:700;"';
                btnOnclick = '';
            }

            const userHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" 
                         onclick="window.location.href='${isSelf ? 'profil.html' : `profil.html?id=${encodeURIComponent(user.username)}`}'">                        <img src="${userAvatar}" 
                             alt="${user.displayName || 'User'}"
                             style="width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid var(--primary); object-fit: cover;">
                        <div style="max-width: 90px; overflow: hidden;">
                            <div style="font-size: 0.8rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${user.displayName || 'İsimsiz'}
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">
                                @${user.username || 'user'}
                            </div>
                        </div>
                    </div>
                    <button id="addFriendBtn_sugg_${user.id}" ${btnOnclick} ${btnAttrs}>
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
        suggestionsContainer.innerHTML = '<div style="font-size:0.7rem; color:red;">Kullanıcılar yüklenemedi.</div>';
    }
}

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

  // sidebar statistics (last user plus total count)
  async function updateSidebarStats() {
      const totalSpan = document.getElementById('sidebarTotalUsers');
      const recentList = document.getElementById('sidebarRecentList');
      console.log('updateSidebarStats called', { totalSpan, recentList });
      if (!totalSpan || !recentList) {
          console.error('Missing elements: totalSpan=', !!totalSpan, 'recentList=', !!recentList);
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
                  } else {
                      imgEl.src = 'assets/img/strendsaydamv2.png';
                  }
                  imgEl.onerror = function() { this.style.display = 'none'; };
                  item.appendChild(imgEl);
                  const tooltip = document.createElement('div');
                  tooltip.className = 'tooltip';
                  tooltip.innerText = name;
                  item.appendChild(tooltip);
                  const profileId = docData.username || uid;
                  item.onclick = () => { window.location.href = `profil.html?id=${encodeURIComponent(profileId)}`; };
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
  displayName: "Misafir",
  avatarUrl: "assets/img/strendsaydamv2.png",
  email: null,
  lastActiveAt: null,
  createdAt: null,
  friendCount: 0,
  pendingRequests: 0,
  isAdmin: false
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

const ADMIN_EMAIL = "officialfthuzun@gmail.com";

// Avatar sistemini otomatik olarak strendsaydamv2'ye initialize et
localStorage.setItem('st_avatar', 'strendsaydamv2');

onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
        localStorage.removeItem('st_isAdmin');
        if (typeof kontrolEtVeOtomatikPostAt === 'function') {
            kontrolEtVeOtomatikPostAt();
        }
        window.location.href = 'login.html';
        return;
    } else {
        // Kullanıcı bilgilerini güncelle
        user.username = fbUser.email.split('@')[0];
        user.email = fbUser.email;
        user.displayName = localStorage.getItem('st_displayName') || fbUser.displayName || user.username;
        
        // Avatar URL'i Firestore'dan çek
        let userData = null;
        try {
            const userRef = doc(db, "users", fbUser.uid);
            const userDoc = await getDoc(userRef);
            userData = userDoc.exists() ? userDoc.data() : null;
            
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
                if (data.createdAt) {
                    user.createdAt = data.createdAt;
                } else {
                    // if existing doc somehow lacks timestamp, write one
                    await setDoc(userRef, { createdAt: serverTimestamp() }, { merge: true });
                    user.createdAt = { seconds: Math.floor(Date.now() / 1000) };
                }
                user.friendCount = Array.isArray(data.friends) ? data.friends.length : 0;
                user.pendingRequests = Array.isArray(data.friendRequests) ? data.friendRequests.length : 0;
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
        // store flag for other scripts
        localStorage.setItem('st_isAdmin', user.isAdmin ? '1' : '0');
        
        // UI Güncelleme (Profil resmi, isimler vb.)
        updateUIWithUser();
        // also update sidebar statistics such as total users and last signup
        updateSidebarStats();
        loadPollWidget();
        loadTopTebrikList();
        updateBanOverlay(userData);
        // Ensure feed is loaded with current user context so profile tabs populate
        try { loadPostsFeed(); } catch(e) { console.warn('loadPostsFeed retry failed', e); }
        // also populate profile sections if on profile page
        if (typeof window.loadProfileSections === 'function') {
            try { window.loadProfileSections('all'); } catch(e) { console.warn('loadProfileSections call during auth state failed', e); }
        }
        // update tebrik badge for own profile
        if (typeof updateProfileTebrikUI === 'function' && user.username) updateProfileTebrikUI(user.username);
        
        // Real-time kullanıcı profili listener - Avatar değişikliklerini senkronize et
        onSnapshot(doc(db, "users", fbUser.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                // Avatar değişmişse güncelle
                if (userData.avatarUrl && userData.avatarUrl !== user.avatarUrl) {
                    user.avatarUrl = userData.avatarUrl;
                    localStorage.setItem('st_avatarUrl', userData.avatarUrl);
                    updateUIWithUser();
                }
                // Display name değişmişse güncelle
                if (userData.displayName && userData.displayName !== user.displayName) {
                    user.displayName = userData.displayName;
                    localStorage.setItem('st_displayName', userData.displayName);
                    updateUIWithUser();
                }
                if (Array.isArray(userData.friends)) {
                    user.friendCount = userData.friends.length;
                    updateUIWithUser();
                }
                if (Array.isArray(userData.friendRequests)) {
                    user.pendingRequests = userData.friendRequests.length;
                    updateUIWithUser();
                }
                // Bildirimleri (arkadaş istekleri + diğer bildirimler) güncelle
                loadNotifications(userData);
                updateBanOverlay(userData);
                if (typeof userData.isAdmin !== 'undefined') {
                    const newAdminStatus = userData.isAdmin === true || fbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                    if (newAdminStatus !== user.isAdmin) {
                        user.isAdmin = newAdminStatus;
                        localStorage.setItem('st_isAdmin', user.isAdmin ? '1' : '0');
                        updateUIWithUser();
                    }
                }
                // isPrivate değişmişse yerelde de sakla
                if (typeof userData.isPrivate !== 'undefined' && userData.isPrivate !== isPrivate) {
                    isPrivate = userData.isPrivate;
                    localStorage.setItem('st_isPrivate', isPrivate);
                    updateUIWithUser();
                }
            }
        });
        
        // Eski postların avatarlarını güncelle
        migrateOldAvatars();

        // ADMIN ÖZEL İŞLEMLERİ
        const adminBtn = document.getElementById('adminMenuBtn');
        if (user.isAdmin) {
            // İstatistikleri çek
            updateAdminStats();
            // HTML'deki admin butonunu görünür yap
            if (adminBtn) {
                adminBtn.style.display = 'flex'; // Veya 'block', tasarımınıza göre
            }
        } else {
            // Eğer admin değilse butonu gizle (Güvenlik için önlem)
            if (adminBtn) {
                adminBtn.style.display = 'none';
            }
        }
        const sidebarAdminBtn = document.getElementById('sidebarAdminBtn');
        if (sidebarAdminBtn) {
            sidebarAdminBtn.style.display = user.isAdmin ? 'flex' : 'none';
        }
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
    const params = new URLSearchParams(location.search);
    const visitedUsername = params.get('id');
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
    window.toggleEditProfile = () => {
        const form = document.getElementById('editProfileSection');
        if (form) {
            form.classList.toggle('active');
            
            // Mevcut değerleri doldur
            const nameInput = document.getElementById('newNameInput');
            if (nameInput) nameInput.value = user.displayName || "";
            
            const urlInput = document.getElementById('newAvatarUrlInput');
            if (urlInput && user.avatarUrl && user.avatarUrl.startsWith('http')) {
                urlInput.value = user.avatarUrl;
            }
            
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
    const name = document.getElementById('newNameInput').value.trim();

    if(name) { 
        user.displayName = name; 
        localStorage.setItem('st_displayName', name);
        
        // Firestore'da güncelle
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                displayName: name
            });
        } catch (err) {
            console.error("Display name güncelleme hatası:", err);
        }
        
        await updateProfile(auth.currentUser, { displayName: name }).catch(e => console.error(e));
    }

    finishUpdate();
  };

  function finishUpdate() {
    alert("Profil başarıyla güncellendi!");
    location.reload();
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
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedImageBase64 = event.target.result;
                const previewImg = document.getElementById('imagePreview');
                const previewContainer = document.getElementById('imagePreviewContainer');
                
                if(previewImg) previewImg.src = selectedImageBase64;
                if(previewContainer) previewContainer.style.display = 'block';
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
      postPlaceholder: "Neler oluyor?",
      shareBtn: "Paylaş",
      editProfileBtn: "Profili Düzenle",
      footerTagline: "Topluluğunuzla her zaman bir adım önde olun.",
      footerMenu: "Hızlı Menü",
      footerCorp: "Kurumsal",
      footerAbout: "Hakkımızda",
      footerCareer: "Kariyer",
      footerSupport: "Destek",
      footerContact: "İletişim",
      footerHelp: "Yardım Merkezi",
      footerRights: "Tüm Hakları Saklıdır.",
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
      sendBtn: "Mesajı Gönder"
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
      sendBtn: "Send Message"
    }
  };

  let currentLang = localStorage.getItem('st_lang') || 'tr';
  let isPrivate = localStorage.getItem('st_isPrivate') === 'true';

  window.changeLanguage = (lang) => {
    // Language changed
    currentLang = lang;
    localStorage.setItem('st_lang', lang);
    applyTranslations(); // Çevirileri uygula
  };

  function applyTranslations() {
    const t = translations[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) el.innerText = t[key];
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
  }
  applyTranslations();

function getAvatarUrl(avatarUrlOrSeed, type = 'user') {
    // If it's a string, try to interpret it correctly
    if (avatarUrlOrSeed && typeof avatarUrlOrSeed === 'string') {
        // Full URLs or base64
        if (avatarUrlOrSeed.startsWith('http') || avatarUrlOrSeed.startsWith('data:')) {
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
    const hAv = document.getElementById('headerAvatar');
    const mDn = document.getElementById('menuDisplayName');
    const mUn = document.getElementById('menuUsername');

    // Sol Menü
    const sAv = document.getElementById('sidebarAvatar');
    const sDn = document.getElementById('sidebarDisplayName');
    const sUn = document.getElementById('sidebarUsername');
    const sJd = document.getElementById('sidebarJoinDate');
    const sSi = document.getElementById('sidebarSignupInfo');
    const sLa = document.getElementById('sidebarLastActive');
    const sRo = document.getElementById('sidebarRole');
    const sMa = document.getElementById('sidebarMembershipAge');
    const sFc = document.getElementById('sidebarFriendCount');
    const sPr = document.getElementById('sidebarPendingRequests');
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
    if(hAv) hAv.src = avatarUrl;
    if(mDn) mDn.innerText = user.displayName;
    if(mUn) mUn.innerText = `@${user.username}`;

    // Sol Menü Güncelleme
    if(sAv) sAv.src = avatarUrl;
    if(sDn) sDn.innerText = user.displayName || 'Misafir';
    if(sUn) sUn.innerText = user.username ? `@${user.username}` : '@kullanici';
    if(sJd && !sJd.innerText) sJd.innerText = '—';
    if(pJd && !pJd.innerText) pJd.innerText = '—';
    if(sSi) sSi.innerText = user.email ? shortenEmail(user.email) : '—';
    if(pSi) pSi.innerText = user.email ? shortenEmail(user.email) : '—';
    if(sRo) sRo.innerText = user.isAdmin ? 'Admin' : 'Kullanıcı';
    if(pRo) pRo.innerText = user.isAdmin ? 'Admin' : 'Kullanıcı';
    if(sLa) sLa.innerText = '—';
    if(pLa) pLa.innerText = '—';
    if(sMa) sMa.innerText = '—';
    if(sFc) sFc.innerText = user.friendCount;
    if(pFc) pFc.innerText = user.friendCount;
    if(sPr) sPr.innerText = user.pendingRequests;
    if(pPr) pPr.innerText = user.pendingRequests;
    if(pVerified) pVerified.innerText = (user.emailVerified === true) ? 'Doğrulandı' : (user.emailVerified === false ? 'Doğrulanmadı' : '—');
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
    if (sJd) {
        const createdAt = user.createdAt;
        if (createdAt) {
            try {
                const createdAtDate = createdAt.toDate ? createdAt.toDate() :
                    (createdAt.seconds != null ? new Date(createdAt.seconds * 1000) : new Date(createdAt));
                const joinDate = createdAtDate.toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                const now = new Date();
                const diffMs = now - createdAtDate;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                let durationText = `${diffDays}gün`;
                if (diffDays >= 365) {
                    const years = Math.floor(diffDays / 365);
                    durationText = years === 1 ? '1yıl' : `${years}yıl`;
                } else if (diffDays >= 30) {
                    const months = Math.floor(diffDays / 30);
                    durationText = months === 1 ? '1ay' : `${months}ay`;
                }
                sJd.innerText = `${joinDate}/${durationText}`;
                if(pJd) pJd.innerText = `${joinDate}/${durationText}`;
            } catch (e) {
                console.error('Join date formatting error:', e);
                sJd.innerText = '—';
                if(pJd) pJd.innerText = '—';
            }
        } else {
            sJd.innerText = '—';
            if(pJd) pJd.innerText = '—';
        }
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
                if (pLa) pLa.innerText = sLa.innerText;
            } catch (e) {
                console.error('Last active formatting error:', e);
                sLa.innerText = '—';
                if (pLa) pLa.innerText = '—';
            }
        } else {
            sLa.innerText = '—';
            if (pLa) pLa.innerText = '—';
        }
    }

    // Profil Sayfası Güncelleme
    if(pAv) pAv.src = avatarUrl;
    if(pPn) pPn.innerText = user.displayName;
    if(pPh) pPh.innerText = `@${user.username}`;

    // Gizlilik Durumu Güncelleme
    if(pTg) pTg.checked = isPrivate;
    if(sPi) {
        // only show indicator when on own profile
        let showInd = isPrivate;
        const params = new URLSearchParams(location.search);
        const visitedUsername = params.get('id');
        if (visitedUsername && visitedUsername !== user.username) {
            showInd = false;
        }
        sPi.style.display = showInd ? 'block' : 'none';
    }
    const pBanner = document.getElementById('selfPrivateBanner');
    if(pBanner) {
        // only show banner when viewing own profile
        let showBanner = isPrivate;
        const params = new URLSearchParams(location.search);
        const visitedUsername = params.get('id');
        if (visitedUsername && visitedUsername !== user.username) {
            showBanner = false;
        }
        pBanner.style.display = showBanner ? 'block' : 'none';
    }
    
    // Kendi profilinde bannerleri gizle
    const params = new URLSearchParams(location.search);
    const visitedUsername = params.get('id');
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
        'profil.html': 'btn-profilim',
        'friends.html': 'btn-arkadaslarim',
        'gonderiler.html': 'btn-gonderiler',
        'begeniler.html': 'btn-begeniler',
        'kayitlar.html': 'btn-kayitlar',
        'arkadaslarim.html': 'btn-arkadaslarim',
        'bildirimler.html': 'btn-bildirimler',
        'blog.html': 'btn-tum-yazilar',
        'video.html': 'btn-video',
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
        { name: "Yardım Merkezi", link: "yardim.html", icon: "fa-life-ring" },
        { name: "Topluluk Kuralları", link: "kurallar.html", icon: "fa-gavel" },
        { name: "Hakkımızda", link: "hakkimizda.html", icon: "fa-info-circle" }
    ]
};

// 2. Sayfa Yüklendiğinde Parametre Kontrolü
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery && window.location.pathname.includes('search.html')) {
        const globalSearchInput = document.getElementById('globalSearch');
        if(globalSearchInput) globalSearchInput.value = searchQuery;
        performGlobalSearch(searchQuery);
    }
});

// 3. Ana Arama Fonksiyonu (Dinamik & Statik)
window.performGlobalSearch = async (forcedQuery = null) => {
    const searchInput = document.getElementById('globalSearch');
    const queryStr = (forcedQuery || searchInput.value).trim().toLowerCase();
    
    if (!queryStr) return;

    // Eğer arama sayfasında değilsek yönlendir
    if (!window.location.pathname.includes('search.html')) {
        window.location.href = `search.html?q=${encodeURIComponent(queryStr)}`;
        return;
    }

    // Element Seçimleri
    const usersContainer = document.getElementById('search-results-users');
    const secUsers = document.getElementById('section-users');
    const noResults = document.getElementById('search-no-results');
    const status = document.getElementById('searchStatus');
    const resultText = document.getElementById('result-text');
    const t = translations[currentLang] || { subBtn: "Takip Et", unsubBtn: "Takibi Bırak" };

    // Arayüz Sıfırlama
    if(usersContainer) usersContainer.innerHTML = "";
    if(secUsers) secUsers.style.display = "none";
    if(noResults) noResults.style.display = "none";
    if(resultText) resultText.innerText = `"${queryStr}" için sonuçlar`;
    if(status) status.innerText = `Aranıyor...`;

    try {
        let totalFound = 0;

        // --- A. STATİK SAYFA FİLTRELEME ---
        const filteredStatic = staticDatabase.pages.filter(p => p.name.toLowerCase().includes(queryStr));
        filteredStatic.forEach(p => {
            totalFound++;
            secPages.style.display = "block";
            pagesContainer.innerHTML += `
                <div class="result-item" style="padding:15px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px;">
                    <i class="fa-solid ${p.icon}" style="color:var(--primary); font-size:1.2rem;"></i>
                    <a href="${p.link}" style="text-decoration:none; color:var(--text-main); font-weight:600;">${p.name}</a>
                </div>`;
        });

        // --- B. FIREBASE SAYFA ARAMASI ---
    const pagesSnap = await getDocs(collection(db, "pages"));
    pagesSnap.forEach(docSnap => {
    const data = docSnap.data();
    
    // Sadece tam eşleşme istiyorsan .includes yerine === kullanabilirsin
    // Veya belirli bir sayfayı hariç tutmak istiyorsan: if (data.name === "İstemediğim Sayfa") return;

    if (data.name && data.name.toLowerCase().includes(queryStr)) {
                totalFound++;
                secPages.style.display = "block";
                const isSub = (data.subscribers || []).includes(user?.username);
                pagesContainer.innerHTML += `
                <div class="glass-card page-card" style="margin-top:10px;">
                    <img src="${getAvatarUrl(data.avatarSeed, 'page')}" class="page-icon" style="width: 50px; height: 50px; border-radius: 8px; margin: 10px auto; display: block;">
                    <div style="font-weight:800; text-align:center;">${data.name}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:10px; text-align:center;">Topluluk • ${(data.subscribers || []).length} Takipçi</div>
                    <button class="btn-subscribe ${isSub ? 'subscribed' : ''}" onclick="toggleSubscription('${docSnap.id}', ${isSub})">${isSub ? t.unsubBtn : t.subBtn}</button>
                </div>`;
            }
        });

        // --- C. FIREBASE KULLANICI ARAMASI ---
        const postsSnap = await getDocs(collection(db, "posts"));
        let processedUsers = new Set();

        postsSnap.forEach(pDoc => {
            const p = pDoc.data();
            const usernameMatch = p.username && p.username.toLowerCase().includes(queryStr);
            const nameMatch = p.name && p.name.toLowerCase().includes(queryStr);
            
            if (p.username && !p.username.startsWith('page_') && (usernameMatch || nameMatch) && !processedUsers.has(p.username)) {
                processedUsers.add(p.username);
                totalFound++;
                secUsers.style.display = "block";
                usersContainer.innerHTML += `
                <div class="glass-card page-card" style="margin-top:10px;">
                    <img src="${getAvatarUrl(p.avatarSeed, 'user')}" class="page-icon" style="border-radius:50%; width: 50px; height: 50px; margin: 10px auto; display: block; cursor:pointer;" onclick="window.location.href='profil.html?u=${p.username}'">
                    <div style="font-weight:800; text-align:center;">${p.name || 'Kullanıcı'}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:10px; text-align:center;">@${p.username}</div>
                    <button class="btn-subscribe" onclick="window.location.href='profil.html?u=${p.username}'">Profiline Git</button>
                </div>`;
            }
        });

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

// 4. Dinleyiciler ve Yardımcı Fonksiyonlar
const mainSearchBtn = document.getElementById('mainSearchBtn');
if(mainSearchBtn) mainSearchBtn.onclick = () => performGlobalSearch();

const gSearch = document.getElementById('globalSearch');
if(gSearch) gSearch.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') performGlobalSearch();
});

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

/* --- SEARCH SON --- */
    
window.likePost = async (id, isLiked, btn) => {

    // optimistic UI toggle
    if(btn) {
        const icon = btn.querySelector('i');
        const countSpan = btn.querySelector('span');
        if(icon) icon.className = isLiked ? 'fa-regular fa-heart' : 'fa-solid fa-heart';
        if(countSpan) {
            const current = parseInt(countSpan.textContent) || 0;
            countSpan.textContent = isLiked ? current - 1 : current + 1;
        }
        btn.style.color = isLiked ? '' : '#ef4444';
    }
    try {
        const ref = doc(db, "posts", id);
        // önce gönderiyi oku (sahibi için bildirim göndermek üzere)
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const post = snap.data();

        const addingLike = !isLiked;
        // note: UI already adjusted above
        await updateDoc(ref, { likes: addingLike ? arrayUnion(user.username) : arrayRemove(user.username) });

        // Eğer beğenen kişi gönderi sahibi değilse ve beğenme ekleniyorsa bildirim gönder
        if (addingLike && post.username && post.username !== user.username) {
            // hedef kullanıcının UID'sini al
            const uQuery = query(collection(db, "users"), where("username", "==", post.username), limit(1));
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
                const recipientUid = uSnap.docs[0].id;
                // gönderi sahibine beğeni bildirimi gönder
                const postSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
                await sendNotification(recipientUid, 'post_like', user.displayName, { postId: id, postContent: postSnippet });
            }
        }
    } catch (e) {
        console.error('likePost hatası:', e);
    }
};
  // id: post id, isSaved: current state at render time, btn: HTML element that was clicked (optional)
  window.toggleBookmark = async (id, isSaved, btn) => {

    try {
        const ref = doc(db, "posts", id);
        // read post to know owner for notification
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const post = snap.data();

        const saving = !isSaved;
        await updateDoc(ref, { savedBy: saving ? arrayUnion(user.username) : arrayRemove(user.username) });

        // update button appearance immediately if element provided
        if (btn) {
            try {
                const icon = btn.querySelector('i');
                if (saving) {
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                    btn.style.color = '#f59e0b';
                } else {
                    icon.classList.remove('fa-solid');
                    icon.classList.add('fa-regular');
                    btn.style.color = '';
                }
            } catch(_) {}
        }

        // notify owner when someone else saves their post
        if (saving && post.username && post.username !== user.username) {
            const uQuery = query(collection(db, "users"), where("username", "==", post.username), limit(1));
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
                const recipientUid = uSnap.docs[0].id;
                const postSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
                await sendNotification(recipientUid, 'post_saved', user.displayName, { postId: id, postContent: postSnippet });
            }
        }
        // also send a small confirmation to ourselves so we see something
        if (saving && auth.currentUser) {
            const meSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
            await sendNotification(auth.currentUser.uid, 'saved_self', user.displayName, { postId: id, postContent: meSnippet });
        }

        // if we are on profile page, trigger a reload of section lists so counts update
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
        if (el.style.display === 'block') updateCommentCount(id);
    } };
  
  window.addComment = async (id) => {

      const input = document.getElementById(`input-${id}`);
      const text = input.value.trim();
      if(!text) return;
      try {
          const postRef = doc(db, "posts", id);
          const commentObj = {
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              text: text,
              time: Date.now(),
              replies: []
          };

          await updateDoc(postRef, { comments: arrayUnion(commentObj) });

          // Bildirim: gönderi sahibi farklıysa bildir
          const postSnap = await getDoc(postRef);
          if (postSnap.exists()) {
              const postData = postSnap.data();
              if (postData.username && postData.username !== user.username) {
                  const uQuery = query(collection(db, "users"), where("username", "==", postData.username), limit(1));
                  const uSnap = await getDocs(uQuery);
                  if (!uSnap.empty) {
                      const recipientUid = uSnap.docs[0].id;
                      // Send notification
                      await sendNotification(recipientUid, 'post_comment', user.displayName, { postId: id, commentText: text });
                  }
              }
          }

          input.value = "";
      } catch (e) {
          console.error('addComment hatası:', e);
      }
  };

window.addReply = async (postId, commentTime) => {
      const replyText = prompt("Yanıtınızı yazın:");
      if (!replyText) return;

      const ref = doc(db, "posts", postId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
          const comments = snap.data().comments;
          const index = comments.findIndex(c => c.time === commentTime);
          if (index !== -1) {
              if (!comments[index].replies) comments[index].replies = [];
              comments[index].replies.push({
                  username: user.username,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                  text: replyText,
                  time: Date.now()
              });
              await updateDoc(ref, { comments: comments });

              // Bildirim: eğer yorum sahibi biz değilsek, ona bir reply bildirimi gönder
              const parentComment = comments[index];
              if (parentComment.username && parentComment.username !== user.username) {
                  try {
                      const uQuery = query(collection(db, "users"), where("username", "==", parentComment.username), limit(1));
                      const uSnap = await getDocs(uQuery);
                      if (!uSnap.empty) {
                          const recipientUid = uSnap.docs[0].id;
                          await sendNotification(recipientUid, 'comment_reply', user.displayName, { postId: postId, commentText: replyText });
                      }
                  } catch (err) {
                      console.error('reply notification error:', err);
                  }
              }
          }
      }
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

window.deletePost = async (id) => { if(confirm(translations[currentLang].confirmDelete)) await deleteDoc(doc(db, "posts", id)); }

window.togglePostContent = function(postId) {
    const preview = document.getElementById(`post-preview-${postId}`);
    const button = document.getElementById(`toggle-${postId}`);
    if (!preview || !button) return;

    const isClamped = preview.classList.toggle('post-text-clamp');
    if (isClamped) {
        button.innerHTML = `<i class="fa-solid fa-chevron-down"></i> Daha fazlasını gör`;
    } else {
        button.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Daha az göster`;
    }
};

/* Pages feature removed */

/* GÖNDERİ AYARLARI */
let showAllFeedPosts = false;
let currentPostsUnsubscribe = null;

window.loadPostsFeed = (showAll = false) => {
  if (showAll) showAllFeedPosts = true;
  if (currentPostsUnsubscribe) currentPostsUnsubscribe();
  
  const queryConstraints = [orderBy("timestamp", "desc")];
  if (!showAllFeedPosts) {
    queryConstraints.push(limit(7));
  }
  
  currentPostsUnsubscribe = onSnapshot(query(collection(db, "posts"), ...queryConstraints), (snap) => {
      try {
          const feed = document.getElementById('feed-items'),
                myPosts = document.getElementById('my-posts-list'),
                myLikes = document.getElementById('my-liked-list'),
                bookItems = document.getElementById('bookmark-items'),
                t = translations[currentLang];
          
          // accumulate HTML so we can replace in one shot
          let feedHtml = '';
          let myPostsHtml = '';
          let likesHtml = '';
          let bookHtml = '';

      let feedPostCount = 0;
      if (snap.empty) {
          console.warn('loadPostsFeed: empty snapshot');
          return;
      }
      snap.forEach(d => {
          try {
              console.log('rendering post', d.id);
              const p = d.data(), 
                    isPage = p.username?.startsWith('page_') || p.username === 'official_system', 
                    isMine = p.username === user.username || p.adminUser === user.username, 
                    isLiked = p.likes?.includes(user.username), 
                    isSaved = p.savedBy?.includes(user.username);
              console.log(' post meta', { username: p.username, type: p.type, question: p.question });
                  
              const avatarUrl = getAvatarUrl(p.avatarUrl || p.avatarSeed || "assets/img/strendsaydamv2.png", isPage ? 'page' : 'user');
              // içerikte varsa HTML entite formundaki emojileri çöz
              const decoded = (p.content || "");
              const contentWithLinks = decoded.replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
              // Profil linki: Kendi profili ise 'profil', başkasıysa 'profil.html?id=username'
              const profileLink = isMine ? "javascript:navigateTo('profil')" : `profil.html?id=${encodeURIComponent(p.username)}`;
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

        const postHtmlBase = `
    <div class="glass-card post" style="${p.username === 'official_system' ? 'border: 2px solid var(--primary); background: rgba(99, 102, 241, 0.05);' : ''}; position: relative;">
        <div style="position: absolute; top: 15px; right: 15px; display: flex; gap: 8px;">
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
                  <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">
                      ${p.name} ${isPage ? '<i class="fa-solid fa-circle-check" style="color:var(--primary); font-size:0.7rem;"></i>' : ''}
                      <span class="post-time">• ${formatTime(p.timestamp)}</span>
                      ${p.isEdited ? `<span style="font-size: 0.6rem; color: var(--text-muted); font-weight: normal;">(düzenlendi)</span>` : ''}
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">@${p.username}</div>
              </div>
        </div>
        
        <div class="post-content-block" style="margin-bottom:12px;">
            <p id="post-preview-${d.id}" class="post-text${decoded.length > 280 ? ' post-text-clamp' : ''}" style="white-space: pre-wrap; margin:0;">${contentWithLinks}</p>
            ${decoded.length > 280 ? `<button id="toggle-${d.id}" class="read-more-btn" onclick="togglePostContent('${d.id}')" style="border:none; background:none; color: var(--primary); display:flex; align-items:center; gap:8px; font-weight:700; padding:0; margin-top:10px; cursor:pointer;"><i class="fa-solid fa-chevron-down"></i> Daha fazlasını gör</button>` : ''}
        </div>${postImageHtml}

        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; min-height:28px;">
            <div id="likers-${d.id}" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"></div>
            ${(p.tebrikCount && p.tebrikCount > 0) ? `<div title="Tebrik sayısı: ${p.tebrikCount}" style="font-size:0.85rem; color:#f97316; font-weight:700; white-space:nowrap;">+${p.tebrikCount} tebrik</div>` : ''}
        </div>

        <div style="display:flex; gap:12px;">
              <button class="tool-btn" onclick="likePost('${d.id}', ${isLiked}, this)" style="gap:5px; color:${isLiked ? '#ef4444' : ''}"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${p.likes?.length || 0}</span></button>
              <button class="tool-btn" onclick="toggleCommentSection('${d.id}')" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${p.comments?.length || 0}</span></button>
              <button class="tool-btn" onclick="toggleBookmark('${d.id}', ${isSaved})" style="color:${isSaved ? '#f59e0b' : ''}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>
              <button class="tool-btn" onclick="window.openShareMenu('${d.id}')" style="gap:5px; margin-left:auto;"><i class="fa-solid fa-share"></i></button>
              <button class="tool-btn" onclick="sendTebrikToUsernameQuick('${p.username}', '${d.id}', this)" style="gap:5px; color:#f97316; margin-left:8px;"><i class="fa-solid fa-gift"></i></button>
        </div>
        
        <div id="comments-${d.id}" class="comment-area" style="display:none;">
              <div id="list-${d.id}">
                  ${(p.comments || []).map(c => `
                      <div class="comment-item" style="flex-direction: column; align-items: flex-start; gap: 5px;">
                          <div style="display: flex; align-items: center; width: 100%; gap: 10px;">
                              <img src="${getAvatarUrl(c.avatarUrl || c.avatarSeed || 'assets/img/strendsaydamv2.png', 'user')}" style="width: 24px; height: 24px; border-radius: 50%; cursor:pointer;" onclick="${c.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(c.username)}'`}">
                              <div style="flex: 1;">
                                  <span class="comment-meta" style="cursor:pointer;" onclick="${c.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(c.username)}'`}">${c.displayName}</span> 
                                  <span style="font-size: 0.8rem;">${c.text}</span>
                                  ${c.isEdited ? `<small style="font-size: 0.65rem; color: var(--text-muted); margin-left: 4px;">(düzenlendi)</small>` : ''}
                              </div>
                              <div class="comment-actions" style="display: flex; gap: 5px;">
                                ${(c.username === user.username) ? `
                                    <button onclick="openEditModal('${d.id}', \`${c.text.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'comment', ${c.time})" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem;">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                ` : ''}
                                ${(c.username === user.username || user.isAdmin) ? `
                                    <button class="comment-del-btn" onclick="deleteComment('${d.id}', ${c.time}, '${c.text.replace(/'/g, "\\'")}')">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                ` : ''}
                              </div>
                          </div>
                          <div style="margin-left: 34px; width: calc(100% - 34px);">
                              ${(c.replies || []).map(r => `
                                  <div class="comment-reply" style="display: flex; align-items: center; gap: 8px; margin-top: 5px; background: rgba(0,0,0,0.03); padding: 5px; border-radius: 8px;">
                                      <img src="${getAvatarUrl(r.avatarUrl || r.avatarSeed || 'assets/img/strendsaydamv2.png', 'user')}" style="width: 18px; height: 18px; border-radius: 50%; cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">
                                      <div style="font-size: 0.75rem; flex: 1;">
                                          <b style="color:var(--primary); cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">${r.displayName}</b> ${r.text}
                                          ${r.isEdited ? `<small style="font-size: 0.6rem; color: var(--text-muted); margin-left: 4px;">(düzenlendi)</small>` : ''}
                                      </div>
                                      <div class="comment-actions" style="display: flex; gap: 5px; align-items: center;">
                                          ${(r.username === user.username) ? `
                                              <button onclick="openEditModal('${d.id}', \`${r.text.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'reply', ${c.time}, ${r.time})" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.7rem;">
                                                  <i class="fa-solid fa-pen"></i>
                                              </button>
                                          ` : ''}
                                          ${(r.username === user.username || user.isAdmin) ? `
                                              <button class="comment-del-btn" style="font-size:0.6rem; position:static; background:none; border:none; color:#ef4444; cursor:pointer;" onclick="deleteReply('${d.id}', ${c.time}, ${r.time})">
                                                  <i class="fa-solid fa-xmark"></i>
                                              </button>
                                          ` : ''}
                                      </div>
                                  </div>
                              `).join('')}
                              <button class="reply-btn" onclick="addReply('${d.id}', ${c.time})" style="background:none; border:none; color:var(--text-muted); font-size:0.7rem; cursor:pointer; margin-top:5px; font-weight:bold;">Yanıtla</button>
                          </div>
                      </div>`).join('')}
              </div>
              <div style="display:flex; flex-direction:column; gap:4px; margin-top:10px;">
                  <div style="display:flex; gap:8px;">
                      <input type="text" id="input-${d.id}" placeholder="${t.commentPlaceholder}" oninput="updateCommentCount('${d.id}')" maxlength="200" style="flex:1; padding:8px 12px; border-radius:10px; border:1px solid var(--border); outline:none; background: var(--input-bg); color: var(--text-main);">
                      <button onclick="addComment('${d.id}')" style="background:var(--primary); color:white; border:none; padding:0 15px; border-radius:10px; cursor:pointer;">${t.sendComment}</button>
                  </div>
              <button class="tool-btn" onclick="window.openShareMenu('${d.id}')" style="gap:5px; margin-left:auto;"><i class="fa-solid fa-share"></i></button>
              <button class="tool-btn" onclick="sendTebrikToUsernameQuick('${p.username}', '${d.id}', this)" style="gap:5px; color:#f97316; margin-left:8px;" title="Tebrik Gönder"><i class="fa-solid fa-gift"></i></button>
              </div>
        </div>
    </div>`;
          // Feed'e eklenen posta HTML'e benzersiz id ekleyelim (hash ile yönlendirme için)
          const postHtmlForFeed = postHtmlBase.replace('<div class="glass-card post"', `<div id="post-${d.id}" class="glass-card post"`);

          if(feed) feedHtml += postHtmlForFeed;
          if(p.username === user.username && myPosts) myPostsHtml += postHtmlBase;
          if(isLiked && myLikes) likesHtml += postHtmlBase;
          if(isSaved && bookItems) bookHtml += postHtmlBase;
          
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
              feed.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Gönderiler yüklenirken bir hata oluştu.</div>';
          }
      } else {
          if(feed) {
              feed.innerHTML = feedHtml;
          }
      }

      // Diğer Gönderiler Butonu
      if (feed && feedPostCount >= 7) {
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
            <i class="fa-solid fa-ellipsis"></i> Diğer Gönderiler
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
        let val = document.getElementById('postInput').innerText.trim();
        if (val.length > 500) val = val.substring(0, 500);
        if (!val && !selectedImageBase64) return;

        try {
            disableButton(btn, 'Paylaşılıyor...');
            await addDoc(collection(db, "posts"), {
                    name: user.displayName,
                    username: user.username,
                    avatarUrl: user.avatarUrl,
                    content: val,
                    image: selectedImageBase64 || null,
                    timestamp: serverTimestamp(),
                    likes: [],
                    savedBy: [],
                    comments: []
            });

            document.getElementById('postInput').innerText = "";
            if (typeof updatePostCount === 'function') updatePostCount();
            window.clearImagePreview();
            // küçük onay bildirimi
            const t = document.createElement('div');
            t.innerText = 'Gönderildi';
            t.style.position = 'fixed'; t.style.right = '20px'; t.style.bottom = '20px'; t.style.background = 'rgba(0,0,0,0.8)'; t.style.color = '#fff'; t.style.padding = '8px 12px'; t.style.borderRadius = '8px'; t.style.zIndex = 99999;
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 1800);

            // refresh feed shortly
            setTimeout(() => { if (typeof loadPostsFeed === 'function') loadPostsFeed(); }, 800);
        } catch (e) {
            console.error("Paylaşım hatası:", e);
            alert("Gönderi paylaşılamadı.");
        } finally {
            enableButton(btn, 'Paylaş');
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

  const profileTrigger = document.getElementById('profileTrigger');
  if(profileTrigger) {
    profileTrigger.onclick = (e) => { 
      e.stopPropagation(); 
      const menu = document.getElementById('dropdownMenu');
      if(menu) menu.classList.toggle('active'); 
    };
  }

  window.onclick = () => {
    const menu = document.getElementById('dropdownMenu');
    if(menu) menu.classList.remove('active');
  };
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

        render();
    };

    // Yaklaşan etkinlikleri yükle
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
    const params = new URLSearchParams(location.search);
    let visitedUsername = params.get('id');
    const simulate = isSimulatingVisitor();
    if (simulate && (!visitedUsername || visitedUsername === user.username)) {
        // force visitor state on own profile
        visitedUsername = '__simulate__';
    }
    
    // Ziyaretçi modu değilse çık (kendi profili)
    if (!visitedUsername || visitedUsername === user.username) {
        // Kendi profili - button'ları düzenle
        const editBtn = document.getElementById('editProfileBtn');
        const addFriendBtn = document.getElementById('addFriendBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        if (editBtn) editBtn.style.display = 'inline-block';
        if (addFriendBtn) addFriendBtn.style.display = 'none';
        if (settingsBtn) settingsBtn.style.display = 'inline-block';
        
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
    const settingsMenu = document.getElementById('profileSettingsMenu');
    if (settingsMenu) settingsMenu.classList.remove('visible');
    
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
    
    // Beğendiklerim ve Kaydedilenler sekmelerini gizle
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn, idx) => {
        if (idx === 1 || idx === 2) { // 1 = Beğendiklerim, 2 = Kaydedilenler
            btn.style.display = 'none';
        }
        // ayrıca gönderiler ve bildirimler sekmelerini de gizle (ziyaretçi profili)
        if (idx === 0 || btn.getAttribute('onclick')?.includes('my-notifs-tab')) {
            btn.style.display = 'none';
        }
    });
    
    // Ilgili tab içeriklerini gizle
    const likedTab = document.getElementById('my-likes-tab');
    const savesTab = document.getElementById('my-saves-tab');
    const postsTab = document.getElementById('my-posts-tab');
    const notifsTab = document.getElementById('my-notifs-tab');
    if (likedTab) likedTab.style.display = 'none';
    if (savesTab) savesTab.style.display = 'none';
    if (postsTab) postsTab.style.display = 'none';
    if (notifsTab) notifsTab.style.display = 'none';
    
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
            // Visitor UID found

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
            if (visitedData.isPrivate) {
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
                    
                    return; // skip rest of visitor loading
                }
            }

        } else {
            // Visitor UID not found
        }
        
        // Profil başlığını güncelle
        const profileName = document.getElementById('profilePageName');
        if (profileName) profileName.innerText = visitorDisplayName;
        
        const profileHandle = document.getElementById('profilePageHandle');
        if (profileHandle) profileHandle.innerText = `@${visitedUsername}`;

        // Update tebrik badge for this profile
        if (typeof updateProfileTebrikUI === 'function') updateProfileTebrikUI(visitedUsername);
        
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
            const pFc = document.getElementById('profileFriendCount');
            const pPr = document.getElementById('profilePendingRequests');
            const pLa = document.getElementById('profileLastActive');
            const pVerified = document.getElementById('profileVerified');

            if (pSi) pSi.innerText = visitedData.email ? shortenEmail(visitedData.email) : '—';
            const roleText = visitedData.isAdmin ? 'Admin' : 'Kullanıcı';
            if (pRo) pRo.innerText = roleText;
            if (pRoleBadge) pRoleBadge.innerText = roleText;
            const fc = typeof visitedData.friendCount === 'number' ? visitedData.friendCount : (Array.isArray(visitedData.friends) ? visitedData.friends.length : 0);
            if (pFc) pFc.innerText = fc;
            if (pPr) pPr.innerText = visitedData.pendingRequests || 0;

            // join date formatting
            if (pJd) {
                try {
                    const createdAt = visitedData.createdAt || visitedData.joinedAt || visitedData.created;
                    if (createdAt) {
                        const d = createdAt.toDate ? createdAt.toDate() : (createdAt.seconds != null ? new Date(createdAt.seconds * 1000) : new Date(createdAt));
                        const day = String(d.getDate()).padStart(2,'0');
                        const month = String(d.getMonth()+1).padStart(2,'0');
                        const year = d.getFullYear();
                        const joinDate = `${day}.${month}.${year}`;
                        const now = new Date();
                        const diffMs = now - d;
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        let durationText = `${diffDays}gün`;
                        if (diffDays >= 365) {
                            const years = Math.floor(diffDays / 365);
                            durationText = years === 1 ? '1yıl' : `${years}yıl`;
                        } else if (diffDays >= 30) {
                            const months = Math.floor(diffDays / 30);
                            durationText = months === 1 ? '1ay' : `${months}ay`;
                        }
                        pJd.innerText = `${joinDate}/${durationText}`;
                    } else {
                        pJd.innerText = '—';
                    }
                } catch (e) {
                    console.error('Visitor join date formatting error:', e);
                    pJd.innerText = '—';
                }
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
            // Calculate membership percent and update progress (blend of friend count and account age)
            try {
                const memPercentEl = document.getElementById('membershipPercent');
                const memProgEl = document.getElementById('membershipProgress');
                const memSummary = document.getElementById('membershipSummaryText');

                // determine account age in days
                const createdAtVal = visitedData.createdAt || visitedData.joinedAt || visitedData.created;
                let ageDays = 0;
                if (createdAtVal) {
                    const cd = createdAtVal.toDate ? createdAtVal.toDate() : (createdAtVal.seconds != null ? new Date(createdAtVal.seconds * 1000) : new Date(createdAtVal));
                    ageDays = Math.max(0, Math.floor((new Date() - cd) / (1000*60*60*24)));
                }

                const friendsCount = typeof visitedData.friendCount === 'number' ? visitedData.friendCount : (Array.isArray(visitedData.friends) ? visitedData.friends.length : 0);
                // score: friends up to 100 -> weight 60%, age up to 365 days -> weight 40%
                const friendScore = Math.min(1, friendsCount / 100);
                const ageScore = Math.min(1, ageDays / 365);
                const membershipScore = Math.round((friendScore * 0.6 + ageScore * 0.4) * 100);

                if (memPercentEl) memPercentEl.innerText = `%${membershipScore}`;
                if (memProgEl) memProgEl.style.width = `${membershipScore}%`;
                if (memSummary) memSummary.innerText = `Hesap: ${ageDays} gün · ${friendsCount} arkadaş`;
            } catch (e) {
                console.warn('Membership percent update failed', e);
            }
        } catch (e) {
            console.warn('Could not update visited profile membership card', e);
        }
        // "Arkadaş Olarak Ekle" butonunu göster/güncelle
        if (visitorUid && auth.currentUser) {
            const addFriendBtn = document.getElementById('addFriendBtn');
            if (addFriendBtn) {
                // Updating friend button
                addFriendBtn.style.display = 'inline-block';
                await updateAddFriendButton(visitorUid);
                // Doğrudan UID ile hızlı gönderim için onclick'i UID tabanlı fonksiyona bağla
                addFriendBtn.onclick = () => sendFriendRequestToUid(visitorUid, visitedUsername);
            }
        } else {
            // Friend button update failed
        }

        // eğer profil gizliyse ve biz arkadaşsak bazı öğeleri gizle
        if (visitedData && visitedData.isPrivate && isFriend) {
            // arkadaşlar sohbet edebilsin, sadece arkadaş ekleme butonunu sakla
            const addFriendBtn = document.getElementById('addFriendBtn');
            if (addFriendBtn) addFriendBtn.style.display = 'none';
            const notice = document.getElementById('friendViewNotice');
            if (notice) notice.style.display = 'block';
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
                    const avatarUrl = getAvatarUrl(post.avatarSeed, 'user');
                    // Gelen içerikte HTML-entity olarak girilmiş emojiler olabilir,
                    // decodeEntities kullanarak bunları dönüştürelim.
                    const decodedPost = decodeEntities ? decodeEntities(post.content || "") : (post.content || "");
                    const contentWithLinks = decodedPost.replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
                    const postTextClass = decodedPost.length > 280 ? ' post-text-clamp' : '';
                    const postReadMoreButton = decodedPost.length > 280 ? `<button id="toggle-${post.id}" class="read-more-btn" onclick="togglePostContent('${post.id}')"><i class="fa-solid fa-chevron-down"></i> Daha fazlasını gör</button>` : '';
                    
                    const postImageHtml = post.image ? `
                        <div class="post-image-wrapper" style="margin: 12px auto; border-radius: 12px; overflow: hidden; background: rgb(0, 0, 0); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; max-height: 103%; max-width: 50%; height: auto; width: 100%;">
                            <img src="${post.image}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; cursor: zoom-in;" onclick="toggleImageExpand(this)" alt="Post görseli">
                        </div>
                    ` : "";
                    
                    const isLiked = post.likes?.includes(user.username);
                    
                    const postHtml = `
                        <div class="glass-card post" style="position: relative;">
                            <div style="display:flex; gap:10px; margin-bottom:10px;">
                                <img src="${avatarUrl}" class="user-avatar" style="cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">
                                <div>
                                    <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">
                                        ${post.name}
                                        <span class="post-time">• ${formatTime(post.timestamp)}</span>
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">@${post.username}</div>
                                </div>
                            </div>
                            
                            <p id="post-preview-${post.id}" class="post-text${postTextClass}" style="white-space: pre-wrap; margin-bottom:10px;">${contentWithLinks}</p>
                            ${postReadMoreButton}
                            ${postImageHtml}
                            ${(post.tebrikCount && post.tebrikCount > 0) ? `<div title="Tebrik sayısı: ${post.tebrikCount}" style="font-size:0.85rem; color:#f97316; font-weight:700; margin-bottom:8px;">+${post.tebrikCount} tebrik</div>` : ''}
                            
                            <div style="display:flex; gap:12px;">
                                <button class="tool-btn" onclick="likePost('${post.id}', ${isLiked}, this)" style="gap:5px; color:${isLiked ? '#ef4444' : ''}">
                                    <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${post.likes?.length || 0}</span>
                                </button>
                                <button class="tool-btn" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${post.comments?.length || 0}</span></button>
                                <button class="tool-btn" onclick="window.openShareMenu('${post.id}')" style="gap:5px; margin-left:auto;"><i class="fa-solid fa-share"></i></button>
                                <button class="tool-btn" onclick="sendTebrikToUsernameQuick('${post.username}', '${post.id}', this)" style="gap:5px; color:#f97316; margin-left:8px;" title="Tebrik Gönder"><i class="fa-solid fa-gift"></i></button>
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

// For profile page: load own posts/likes/bookmarks separately
// section param determines which part(s) should be updated; 'all' (default), 'posts', 'likes', 'saves'
window.loadProfileSections = async (section = 'all', showAllPosts = false, showAllLikes = false, showAllSaves = false) => {
    // console.log removed

    if (!auth.currentUser) {
        console.warn('loadProfileSections: no auth user');
        return;
    }
    
    if (!user || !user.username) {
        console.warn('loadProfileSections: user.username not initialized', user);
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
    
    const uname = user.username;
    console.log('[loadProfileSections]', 'section:', section, 'uname:', uname, 'user:', user);

    // if a specific section is requested, ensure only its tab-content is visible
    if (section && section !== 'all') {
        const tabMap = {
            posts: 'my-posts-tab',
            likes: 'my-likes-tab',
            saves: 'my-saves-tab',
            friends: 'my-friends-tab',
            notifs: 'my-notifs-tab',
            'my-posts-tab': 'my-posts-tab',
            'my-likes-tab': 'my-likes-tab',
            'my-saves-tab': 'my-saves-tab',
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
    
    // always clear the containers to avoid stale content
    if (myPostsList && (section === 'all' || section === 'posts')) myPostsList.innerHTML = '';
    if (myLikesList && (section === 'all' || section === 'likes')) myLikesList.innerHTML = '';
    if (bookmarkList && (section === 'all' || section === 'saves')) bookmarkList.innerHTML = '';

    try {
        const q = query(collection(db, 'posts'), orderBy('timestamp','desc'));
        const snap = await getDocs(q);
        
        let myPostsAll = [], myLikesAll = [], mySavesAll = [];
        
        snap.forEach(d => {
            const p = d.data();
            const isMine = p.username === uname || p.adminUser === uname;
            const isLiked = p.likes?.includes(uname);
            const isSaved = p.savedBy?.includes(uname);
            const decodedProfileContent = decodeEntities ? decodeEntities(p.content||"") : (p.content||"");
            const profileContentWithLinks = decodedProfileContent.replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g,'<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
            const profileReadMoreBtn = decodedProfileContent.length > 280 ? `<button id="toggle-${d.id}" class="read-more-btn" onclick="togglePostContent('${d.id}')"><i class="fa-solid fa-chevron-down"></i> Daha fazlasını gör</button>` : '';
            const profileTextClass = decodedProfileContent.length > 280 ? ' post-text-clamp' : '';
            
            const postHtml = `
                <div class="glass-card post" style="position: relative;">
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <img src="${getAvatarUrl(p.avatarUrl||p.avatarSeed||'assets/img/strendsaydamv2.png','user')}" class="user-avatar" style="cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
                        <div>
                            <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
                                ${p.name}
                                <span class="post-time">• ${formatTime(p.timestamp)}</span>
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
                    <div style="display:flex; gap:12px;">
                        <button class="tool-btn" onclick="likePost('${d.id}', ${isLiked}, this)" style="gap:5px; color:${isLiked?'#ef4444':''}"><i class="${isLiked?'fa-solid':'fa-regular'} fa-heart"></i><span>${p.likes?.length||0}</span></button>
                        <button class="tool-btn" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${p.comments?.length||0}</span></button>
                        <button class="tool-btn" onclick="toggleBookmark('${d.id}', ${isSaved})" style="color:${isSaved ? '#f59e0b' : ''}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>
                    </div>
                </div>
            `;
            
            if (isMine) myPostsAll.push(postHtml);
            if (isLiked) myLikesAll.push(postHtml);
            if (isSaved) mySavesAll.push(postHtml);
        });

        // GÖNDERİLER
        if ((section === 'all' || section === 'posts') && myPostsList && myPostsAll.length > 0) {
            let postsToShow = showAllPosts ? myPostsAll.length : 7;
            let postsHtml = myPostsAll.slice(0, postsToShow).join('');
            myPostsList.innerHTML = postsHtml;
            
            if (myPostsAll.length > 7 && !showAllPosts) {
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
                        <i class="fa-solid fa-ellipsis"></i> Diğer Gönderiler
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

            let likesToShow = showAllLikes ? myLikesAll.length : 7;
            let likesHtml = myLikesAll.slice(0, likesToShow).join('');
            myLikesList.innerHTML += likesHtml;
            
            if (myLikesAll.length > 7 && !showAllLikes) {
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
                        <i class="fa-solid fa-ellipsis"></i> Diğer Gönderiler
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

            let savesToShow = showAllSaves ? mySavesAll.length : 7;
            let savesHtml = mySavesAll.slice(0, savesToShow).join('');
            bookmarkList.innerHTML += savesHtml;
            
            if (mySavesAll.length > 7 && !showAllSaves) {
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
                        <i class="fa-solid fa-ellipsis"></i> Diğer Gönderiler
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
  const isDark = document.body.classList.toggle('dark-mode');

  if (btn) {
    btn.innerHTML = isDark
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  }

  localStorage.setItem('st_theme', isDark ? 'dark' : 'light');
};

function syncThemeButtonState() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;
    const isDark = document.body.classList.contains('dark-mode');
    themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('st_theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
    syncThemeButtonState();
});
/* ============================ */

/* EMOJİ KODU */
// Gönderi oluşturma alanındaki emoji picker dinamiğe taşındı ve kodlar
// düzgün şekilde çözümlenecek hâle getirildi. Böylece hem HTML içinde
// yanlışlıkla entite yazıldığında (&#128512; gibi) hem de normal yazımda
// kullanıcıya daima gerçek emoji karakteri giriliyor.
document.addEventListener('DOMContentLoaded', () => {
    const emojiToggle = document.getElementById('emojiToggle');
    const emojiPicker = document.getElementById('emojiPicker');
    const postInput = document.getElementById('postInput');

    if (!emojiToggle || !emojiPicker || !postInput) return;

    // Listeyi burada tutuyoruz; ileride ekleme/çıkarma kolay olsun.
    const postEmojis = [
        '😊','😁','😂','🤣','😡','😠','😭','❤️','💚','💙','💔','💘','💗','💝',
        '👍','👎','🙌','🙏','✨','📺','🎞️','🔒','🔥','🚀','🎉','💯','😇','🍏',
        '🍎','🍌','🍐','🍇','🍳','🍔','🚗','🚕','🚌','🚑','🚒','🚢','✈️'
    ];

    // Helper: HTML entitelerini metne çevirir
    const decodeEntities = str => {
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    };

    // picker içeriğini (varsa önceden yazılmış) yenileyelim
    emojiPicker.innerHTML = '';
    postEmojis.forEach(e => {
        const span = document.createElement('span');
        span.textContent = e;
        span.style.cursor = 'pointer';
        emojiPicker.appendChild(span);
    });

    emojiToggle.addEventListener('click', e => {
        e.stopPropagation();
        emojiPicker.style.display =
            emojiPicker.style.display === 'grid' ? 'none' : 'grid';
    });

    // tek bir listener, delegation kullanarak span'lara tıkı yönet
    emojiPicker.addEventListener('click', evt => {
        const target = evt.target;
        if (target && target.tagName === 'SPAN') {
            let val = target.textContent || target.innerText || '';
            if (val.includes('&#')) {
                val = decodeEntities(val);
            }
            // insert text at caret in contenteditable
            if (document.queryCommandSupported('insertText')) {
                document.execCommand('insertText', false, val);
            } else {
                postInput.innerText += val;
            }
            emojiPicker.style.display = 'none';
            postInput.focus();
            if (typeof updatePostCount === 'function') updatePostCount();
        }
    });

    document.addEventListener('click', () => {
        emojiPicker.style.display = 'none';
    });
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

function initHeaderInteractions() {
    const profileTrigger = document.getElementById('profileTrigger');
    if (profileTrigger) {
        profileTrigger.onclick = (e) => {
            e.stopPropagation();
            const menu = document.getElementById('dropdownMenu');
            if (menu) menu.classList.toggle('active');
        };
    }

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
}

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
    const isActive = sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active', isActive);
}

window.toggleRightSidebar = function() {
    const rightPanel = document.querySelector('.right-panel');
    const overlay = document.getElementById('sideOverlay');
    if (!rightPanel) return;
    const isActive = rightPanel.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active', isActive);
}

window.closeSideMenus = function() {
    const sidebar = document.querySelector('aside');
    const rightPanel = document.querySelector('.right-panel');
    const overlay = document.getElementById('sideOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (rightPanel) rightPanel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// 4. Global Tıklama Dinleyicisi (Event Delegation)
// Bu yöntem, elemanlar fetch ile sonradan gelse bile tıklamayı yakalar.
document.addEventListener('click', (e) => {
    const dropdownMenu = document.getElementById('dropdownMenu');
    const profileTrigger = e.target.closest('#profileTrigger');

    // Profil tetikleyiciye tıklandıysa
    if (profileTrigger) {
        if (dropdownMenu) {
            dropdownMenu.classList.toggle('active');
            e.stopPropagation(); // Tıklamanın dışarı sızmasını engelle
        }
    } 
    // Menü açıkken dışarıya tıklandıysa kapat
    else if (dropdownMenu && dropdownMenu.classList.contains('active')) {
        if (!dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('active');
        }
    }
    
    // Bildirim dropdown'u
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    
    if (notificationsBtn?.contains(e.target)) {
        e.stopPropagation();
    } else if (notificationsDropdown && notificationsDropdown.style.display !== 'none') {
        if (!notificationsDropdown.contains(e.target)) {
            notificationsDropdown.style.display = 'none';
        }
    }
});

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
    } catch (error) {
        console.error("Bildirim gönderme hatası:", error);
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

// Arkadaşlar listesini yükle (isOwnProfile=true ise tüm arkadaşlar, false ise ortak arkadaşlar)
async function loadFriendsList(userRef, isOwnProfile = true) {
    const friendsTab = document.getElementById('friends-list');
    const noFriendsMsg = document.getElementById('no-friends-msg');
    
    // ensure search input has handler every time we load list
    const searchInput = document.getElementById('friendSearch');
    if (searchInput) {
        searchInput.oninput = applyFriendSearch;
    }

    if (!friendsTab || !auth || !auth.currentUser) return;

    try {
        let targetUserData = null;
        
        if (!isOwnProfile) {
            // Başka birinin profili - visitedUsername'dan bulmalıyız
            const params = new URLSearchParams(location.search);
            const visitedUsername = params.get('id');
            
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
        
        if (!targetUserData) return;
        
        const friends = targetUserData.friends || [];

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

        if (displayFriends.length === 0) {
            friendsTab.innerHTML = '';
            noFriendsMsg.style.display = 'block';
            return;
        }

        noFriendsMsg.style.display = 'none';
        friendsTab.innerHTML = '';

        // Her arkadaşın bilgisini çek
        for (const friendUid of displayFriends) {
            const friendRef = doc(db, "users", friendUid);
            const friendDoc = await getDoc(friendRef);
            
            if (friendDoc.exists()) {
                const friendData = friendDoc.data();

                // mutual friends sayısını hesapla
                let mutualCount = 0;
                if (myFriends.length && friendData.friends) {
                    mutualCount = friendData.friends.filter(f => myFriends.includes(f)).length;
                }

                const friendCard = document.createElement('div');
                friendCard.className = 'friend-card';
                friendCard.style.cssText = `
                    background: var(--input-bg);
                    padding: 15px;
                    border-radius: 10px;
                    text-align: center;
                    /* no cursor:pointer; we only want avatar clickable */
                    transition: all 0.3s ease;
                `;
                
                let mutualHtml = '';
                if (mutualCount > 0) {
                    // make the mutual count clickable
                    mutualHtml = `<p class="mutual-info" data-uid="${friendUid}" 
                        style="margin:4px 0 0 0; color:var(--text-muted); font-size:0.75rem; cursor:pointer;">
                        🌐 ${mutualCount} ortak arkadaş
                    </p>`;
                }

                friendCard.innerHTML = `
                    <div>
                        <img src="${friendData.avatarUrl || 'assets/img/strendsaydamv2.png'}" 
                             style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover; margin-bottom: 10px; cursor:pointer;"
                             onclick="window.location.href='profil.html?id=${encodeURIComponent(friendData.username)}'">
                        <h4 style="margin: 8px 0; font-size: 0.9rem; word-break: break-word;">${friendData.displayName || friendData.username}</h4>
                        <p style="margin: 5px 0; color: var(--text-muted); font-size: 0.8rem;">@${friendData.username}</p>
                    </div>
                    ${mutualHtml}
                    ${isOwnProfile ? `<button onclick="removeFriend('${friendUid}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.75rem; margin-top: 10px;">
                        <i class="fa-solid fa-trash"></i> Arkadaşlığı Sonlandır
                    </button>` : ''}
                `;
                // attach searchable text
                friendCard.dataset.search = ((friendData.displayName || '') + ' ' + friendData.username).toLowerCase();
                // removed debug

                
                // only need to bind mutual click, propagation no longer matters
                if (mutualCount > 0) {
                    const mutualEl = friendCard.querySelector('.mutual-info');
                    if (mutualEl) {
                        mutualEl.addEventListener('click', () => {
                            showMutuals(friendUid);
                        });
                    }
                }

                // store searchable text as data attribute (name+username)
                friendCard.dataset.search = ((friendData.displayName || '') + ' ' + friendData.username).toLowerCase();
                
                friendCard.addEventListener('mouseenter', () => {
                    friendCard.style.transform = 'translateY(-5px)';
                    friendCard.style.boxShadow = 'var(--shadow)';
                });
                
                friendCard.addEventListener('mouseleave', () => {
                    friendCard.style.transform = 'translateY(0)';
                    friendCard.style.boxShadow = 'none';
                });
                
                friendsTab.appendChild(friendCard);
            }
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
                    width: 80px;
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
    const otherNotifs = Array.isArray(userData.notifications) ? userData.notifications : [];

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
            detail = n.postContent ? `"${n.postContent}${n.postContent.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-heart';
        } else if (n.type === 'saved_self') {
            text = `Gönderiyi kaydettiniz`;
            detail = n.postContent ? `"${n.postContent}${n.postContent.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-bookmark';
        } else if (n.type === 'saved' || n.type === 'post_saved') {
            text = `${n.fromName} gönderinizi kaydetti`;
            detail = n.postContent ? `"${n.postContent}${n.postContent.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-bookmark';
        } else if (n.type === 'comment' || n.type === 'post_comment') {
            text = `${n.fromName} gönderinize yorum yaptı`;
            detail = n.commentText ? `"${n.commentText.slice(0, 50)}${n.commentText.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-comment';
        } else if (n.type === 'comment_reply') {
            text = `${n.fromName} yorumunuza yanıt yazdı`;
            detail = n.commentText ? `"${n.commentText.slice(0, 50)}${n.commentText.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-reply';
        } else if (n.type === 'message' || n.type === 'msg') {
            text = `${n.fromName} size mesaj gönderdi`;
            detail = n.message ? `"${n.message.slice(0, 80)}${n.message.length > 80 ? '...' : ''}"` : '';
            icon = 'fa-envelope';
        } else {
            text = n.message || `${n.fromName || 'Birileri'} bir bildirim gönderdi`;
        }

        const timeStr = _formatNotificationTime(n.timestamp);

        nDiv.innerHTML = `
            <i class="fa-solid ${icon}" style="font-size:1.1rem; width:34px; text-align:center; color:var(--primary);"></i>
            <div style="flex:1; min-width:0;">
                <p style="margin:0; font-size:0.85rem; font-weight:600;">${n.fromName || 'Sistem'}</p>
                <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-muted);">${text}</p>
                ${detail ? `<p style="margin:4px 0 0 0; font-size:0.7rem; color:var(--text-muted); font-style:italic;">${detail}</p>` : ''}
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
            e.stopPropagation();
            if (!n.read) {
                await markNotificationRead(n);
                // Dropdown'u yenile (okunmuş bildirimi çıkar)
                if (auth.currentUser) {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        loadNotifications(userSnap.data());
                    }
                }
            }
            // Eğer gönderi id'si varsa gönderiye git, mesaj bildirimi ise sohbeti aç
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) dropdown.style.display = 'none';

            const chatUserId = n.fromUid || n.senderUid;
            if (n.type === 'message' && chatUserId) {
                openChatWithUser(chatUserId, n.fromName || 'Sohbet');
            } else if (n.postId) {
                window.location.href = `index.html#post-${n.postId}`;
            } else {
                // Açık profilden farklı bir sayfadaysak profil sayfasına git
                if (!window.location.pathname.endsWith('profil.html')) {
                    window.location.href = 'profil.html#my-notifs-tab';
                } else {
                    // Eğer zaten profil sayfasındaysak, açılacak sekmeyi ayarla
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
                // update badge
                const countBadge = document.getElementById('notificationCountBadge');
                const current = parseInt((countBadge && countBadge.textContent) || '0') || 0;
                updateNotificationBadge(Math.max(0, current - 1));
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
                const countBadge = document.getElementById('notificationCountBadge');
                const current = parseInt((countBadge && countBadge.textContent) || '0') || 0;
                updateNotificationBadge(Math.max(0, current - 1));
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
        const allNotifs = (userSnap.exists() && Array.isArray(userSnap.data().notifications)) ? userSnap.data().notifications : [];

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

            const icon = (n.type && n.type.includes('like')) ? 'fa-heart' : (n.type && n.type.includes('comment') ? 'fa-comment' : (n.type && n.type.includes('friend') ? 'fa-user-check' : 'fa-info-circle'));
            const iconColors = {
                'fa-heart': '#ef4444',
                'fa-comment': '#3b82f6',
                'fa-user-check': '#10b981',
                'fa-info-circle': '#8b5cf6'
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
                    ${n.postId ? `<button style="background:transparent; border:1px solid var(--border); color:var(--text-main); padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Gönderiye Git</button>` : ''}
                </div>
            `;

            nDiv.addEventListener('mouseenter', () => { if (!n.read) nDiv.style.boxShadow = 'var(--shadow)'; });
            nDiv.addEventListener('mouseleave', () => { nDiv.style.boxShadow = 'none'; });

            list.appendChild(nDiv);

            // Sil butonu seçicisi - tüm butonları kontrol et ve "Sil" yazanı bul
            const buttons = nDiv.querySelectorAll('button');
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
        const notifs = Array.isArray(userSnap.data().notifications) ? userSnap.data().notifications : [];

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
        const notifs = Array.isArray(userSnap.data().notifications) ? userSnap.data().notifications : [];

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
            const notifs = Array.isArray(userSnap.data().notifications) ? userSnap.data().notifications : [];
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
        const notifs = Array.isArray(userSnap.data().notifications) ? userSnap.data().notifications : [];
        
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
        const notifs = Array.isArray(userSnap.data().notifications) ? userSnap.data().notifications : [];
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

// Fonksiyonu window nesnesine bağlayarak HTML'den erişilebilir yapıyoruz
window.toggleNotifications = function() {
    const dropdown = document.getElementById('notificationsDropdown');
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

// Bildirim badge'ini güncelle
function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    const countBadge = document.getElementById('notificationCountBadge');

    if (badge) {
        if (count > 0) {
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (countBadge) {
        if (count > 0) {
            countBadge.textContent = `${count > 99 ? '99+' : count} okunmamış`;
            countBadge.style.display = 'inline-flex';
        } else {
            countBadge.style.display = 'none';
        }
    }

    const headerBadges = document.querySelectorAll('.requestCountBadge');
    headerBadges.forEach((badge) => {
        badge.textContent = count > 0 ? `${count > 99 ? '99+' : count} okunmamış` : '0';
    });

    // Page title'a bildirim sayısı ekle
    if (count > 0) {
        document.title = `(${count}) SosyalTrend • Sosyal Ağ`;
    } else {
        document.title = 'SosyalTrend • Sosyal Ağ';
    }
}

// Profil sayfasında "Arkadaş Olarak Ekle" ve "Sohbet Et" butonunu göster/gizle
async function updateAddFriendButton(targetUid) {
    const addFriendBtn = document.getElementById('addFriendBtn');
    const chatBtn = document.getElementById('profileActionBtn');
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
        return;
    }

    // chat button default setup -- always visible for other users (friend or not)
    chatBtn.style.display = 'inline-block';
    chatBtn.style.opacity = '1';
    chatBtn.style.cursor = 'pointer';
    chatBtn.innerHTML = '<i class="fa-solid fa-comment"></i> Sohbet Et';
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
chatBtn.style.display = 'inline-block';
chatBtn.innerHTML = '<i class="fa-solid fa-comment"></i> Sohbet Et';

chatBtn.addEventListener('click', () => {
    // Check if the required variables and function exist
    if (typeof openChatWithUser === 'function') {
        openChatWithUser(targetUid, targetUsername);
    } else {
        alert("Sohbet sistemi şu anda yüklenemedi. Lütfen sayfayı yenileyin.");
        console.error("Critical: openChatWithUser function is missing.");
    }
});

        // --- ARKADAŞLIK BUTONU DURUMLARI ---
        // Zaten arkadaş mı?
        if (friends.includes(targetUid)) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Zaten Arkadaşsınız';
            addFriendBtn.disabled = true;
            addFriendBtn.style.opacity = '0.6';
            addFriendBtn.style.cursor = 'default';
            addFriendBtn.onclick = (e) => e.preventDefault();
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
            addFriendBtn.onclick = () => sendFriendRequest();
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
  const viewedUserId = new URLSearchParams(window.location.search).get('uid'); // Profiline bakılan kişinin ID'si

  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  if (viewedUserId === currentUser.uid) {
    // KENDİ PROFİLİNDEYSE: Hiçbir şey yapma
    return;
  } else {
    // BAŞKASININ PROFİLİNDEYSE: Chat widget'ı aç
    if (typeof openChatWithUser === 'function') {
      openChatWithUser(viewedUserId, viewedUserId);
    }
  }
}

// --- Tebrik (congrats) feature ---
// Send a tebrik to a user by UID
// send tebrik with optional message
window.sendTebrikToUid = async function(targetUid, targetUsername, message = '') {
    if (!auth.currentUser) {
        alert('Tebrik göndermek için giriş yapın.');
        return;
    }
    if (!targetUid) {
        alert('Hedef kullanıcı bulunamadı.');
        return;
    }
    if (targetUid === auth.currentUser.uid) {
        alert('Kendinize tebrik gönderemezsiniz.');
        return;
    }
    try {
        const targetRef = doc(db, 'users', targetUid);
        // Prevent duplicate tebrik from same user
        const targetSnap = await getDoc(targetRef);
        const targetData = targetSnap.exists() ? targetSnap.data() : null;
        const givers = Array.isArray(targetData?.tebrikGivers) ? targetData.tebrikGivers : [];
        if (givers.some(g => g.uid === auth.currentUser.uid)) {
            alert('Zaten bu kullanıcıya tebrik gönderdiniz.');
            return;
        }

        const giverInfo = {
            uid: auth.currentUser.uid,
            username: user.username,
            displayName: user.displayName,
            message: message || '',
            at: serverTimestamp()
        };

        await updateDoc(targetRef, {
            tebrikCount: increment(1),
            tebrikGivers: arrayUnion(giverInfo),
            tebrikMessages: arrayUnion({ fromUid: auth.currentUser.uid, fromUsername: user.username, message: message || '', at: Timestamp.now() })
        });

        alert('Tebrik gönderildi — kullanıcı tebrik puanına sahip oldu.');
        // refresh UI
        loadTopTebrikList();
        // if currently viewing that profile, refresh its badge
        const visiting = localStorage.getItem('visiting_username');
        if (!visiting || visiting === targetUsername) {
            // reload profile UI
            if (typeof loadVisitorProfile === 'function') loadVisitorProfile();
        }
    } catch (e) {
        console.error('Tebrik gönderme hatası:', e);
        alert('Tebrik gönderilemedi. Lütfen tekrar deneyin.');
    }
};

// Send tebrik by username (used by quick prompt)
window.sendTebrikByUsername = async function(username) {
    if (!username) return;
    try {
        const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            alert('Kullanıcı bulunamadı: ' + username);
            return;
        }
        const docSnap = snap.docs[0];
        await window.sendTebrikToUid(docSnap.id, username);
    } catch (e) {
        console.error('sendTebrikByUsername hata:', e);
        alert('Tebrik gönderilirken hata oluştu.');
    }
};

// send by username with message
window.sendTebrikByUsernameWithMessage = async function(username, message) {
    if (!username) return;
    try {
        const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            alert('Kullanıcı bulunamadı: ' + username);
            return;
        }
        const docSnap = snap.docs[0];
        await window.sendTebrikToUid(docSnap.id, username, message);
    } catch (e) {
        console.error('sendTebrikByUsernameWithMessage hata:', e);
        alert('Tebrik gönderilirken hata oluştu.');
    }
};

// Open tebrik modal optionally prefilling username
window.openTebrikModal = function(prefillUsername) {
    const modal = document.getElementById('tebrikModal');
    if (!modal) return;
    const userInput = modal.querySelector('#tebrikTargetUsername');
    const msgArea = modal.querySelector('#tebrikMessage');
    if (userInput) userInput.value = prefillUsername || '';
    if (msgArea) msgArea.value = '';
    modal.style.display = 'flex';
};

window.openTebrikModalForProfile = function() {
    const params = new URLSearchParams(location.search);
    const visitedUsername = params.get('id');
    if (!visitedUsername) {
        alert('Bu profil için tebrik gönderilemez.');
        return;
    }
    openTebrikModal(visitedUsername);
};

window.closeTebrikModal = function() {
    const modal = document.getElementById('tebrikModal');
    if (!modal) return;
    modal.style.display = 'none';
};

window.sendTebrikFromModal = async function() {
    const modal = document.getElementById('tebrikModal');
    if (!modal) return;
    const userInput = modal.querySelector('#tebrikTargetUsername');
    const msgArea = modal.querySelector('#tebrikMessage');
    const username = userInput?.value?.trim();
    const message = msgArea?.value?.trim() || '';
    if (!username) { alert('Lütfen kullanıcı adını girin.'); return; }
    await sendTebrikByUsernameWithMessage(username, message);
    closeTebrikModal();
};

// Quick tebrik from post button - allows multiple clicks (increments each click)
window.sendTebrikToUsernameQuick = async function(username, postId, btnEl) {
    if (!auth.currentUser) {
        alert('Tebrik göndermek için giriş yapın.');
        return;
    }
    if (!username) return;
    try {
        // find user doc by username
        const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            alert('Kullanıcı bulunamadı.');
            return;
        }
        const userDoc = snap.docs[0];
        const targetRef = doc(db, 'users', userDoc.id);
        const targetData = userDoc.data() || {};
        const givers = Array.isArray(targetData.tebrikGivers) ? targetData.tebrikGivers : [];
        const msgs = Array.isArray(targetData.tebrikMessages) ? targetData.tebrikMessages : [];
        const existingTebrik = postId ? msgs.find(m => m.fromUid === auth.currentUser.uid && m.postId === postId) : givers.find(g => g.uid === auth.currentUser.uid);

        if (existingTebrik) {
            // remove tebrik on second click
            const updatedMsgs = msgs.filter(m => !(m.fromUid === auth.currentUser.uid && m.postId === postId));
            const updatedGivers = givers.filter(g => !(g.uid === auth.currentUser.uid && g.postId === postId));
            await updateDoc(targetRef, { tebrikCount: increment(-1), tebrikGivers: updatedGivers, tebrikMessages: updatedMsgs });
            if (postId) {
                try {
                    const postRef = doc(db, 'posts', postId);
                    await updateDoc(postRef, { tebrikCount: increment(-1) });
                } catch (e) {
                    console.warn('Post tebrik sayısı azaltılamadı:', e);
                }
            }
            loadTopTebrikList();
            if (typeof updateProfileTebrikUI === 'function') updateProfileTebrikUI(username);
            return;
        }

        const giverInfo = { uid: auth.currentUser.uid, username: user.username, displayName: user.displayName || '', message: '', at: Timestamp.now(), postId: postId || null };
        // increment tebrik count by 1 for the user and record giver
        await updateDoc(targetRef, { tebrikCount: increment(1), tebrikGivers: arrayUnion(giverInfo), tebrikMessages: arrayUnion({ fromUid: auth.currentUser.uid, fromUsername: user.username, message: '', at: Timestamp.now(), postId }) });
        // if a postId is provided, also increment tebrikCount on the post document
        if (postId) {
            try {
                const postRef = doc(db, 'posts', postId);
                await updateDoc(postRef, { tebrikCount: increment(1) });
            } catch (e) {
                console.warn('Post tebrik sayısı güncellenemedi:', e);
            }
        }

        // show +1 animation on top of the tebrik icon/button
        try {
            const el = btnEl || document.querySelector(`#post-${postId} .tool-btn`);
            if (el) {
                el.style.overflow = 'visible';
                if (el.parentElement) el.parentElement.style.overflow = 'visible';
                const prevPosition = el.style.position;
                if (!prevPosition || prevPosition === 'static') {
                    el.style.position = 'relative';
                }
                const plus = document.createElement('span');
                plus.className = 'tebrik-plus-page';
                plus.innerText = '+1';
                plus.style.position = 'absolute';
                plus.style.right = '-8px';
                plus.style.top = '-18px';
                plus.style.fontSize = '12px';
                plus.style.lineHeight = '14px';
                plus.style.padding = '2px 4px';
                plus.style.color = '#f97316';
                plus.style.fontWeight = '800';
                plus.style.background = 'rgba(255,255,255,0.95)';
                plus.style.borderRadius = '999px';
                plus.style.pointerEvents = 'none';
                plus.style.zIndex = 9999;
                plus.style.opacity = '1';
                plus.style.transition = 'transform 900ms cubic-bezier(.2,.9,.2,1), opacity 900ms ease';
                el.appendChild(plus);
                requestAnimationFrame(() => { plus.style.transform = 'translateY(-20px)'; plus.style.opacity = '0'; });
                setTimeout(() => {
                    try { plus.remove(); } catch(_){}
                    if (!prevPosition || prevPosition === 'static') el.style.position = prevPosition;
                }, 950);
            }
        } catch (e) { console.warn('Animasyon esnasında hata', e); }

        // refresh top list and profile badge
        loadTopTebrikList();
        if (typeof updateProfileTebrikUI === 'function') updateProfileTebrikUI(username);
    } catch (e) {
        console.error('Quick tebrik hatası:', e);
        alert('Tebrik gönderilemedi.');
    }
};

// Called from profile page button — sends tebrik to currently visited profile
window.sendTebrikCurrentProfile = async function() {
    const params = new URLSearchParams(location.search);
    const visitedUsername = params.get('id');
    if (!visitedUsername) {
        alert('Bu kullanıcı için tebrik gönderilemez.');
        return;
    }
    try {
        const q = query(collection(db, 'users'), where('username', '==', visitedUsername), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            alert('Kullanıcı bulunamadı.');
            return;
        }
        const docSnap = snap.docs[0];
        await window.sendTebrikToUid(docSnap.id, visitedUsername);
    } catch (e) {
        console.error('sendTebrikCurrentProfile hata:', e);
        alert('Tebrik gönderilemedi.');
    }
};

// Load Top 10 tebrik list and render into right-aside
window.loadTopTebrikList = async function() {
    const container = document.getElementById('top-tebrik-list');
    if (!container) return;
    try {
        const q = query(collection(db, 'users'), orderBy('tebrikCount', 'desc'), limit(10));
        const snap = await getDocs(q);
        if (snap.empty) {
            container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center;">Henüz tebrik alan kullanıcı yok.</div>';
            return;
        }
        const users = [];
        snap.forEach(d => users.push({ id: d.id, ...d.data() }));
        const max = users[0].tebrikCount || 1;
        container.innerHTML = '';
        users.forEach((u, idx) => {
            const pct = Math.round(((u.tebrikCount || 0) / max) * 100);
            const avatar = u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName||u.username||'User')}&background=random&color=fff`;
            const el = document.createElement('div');
            el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'space-between'; el.style.gap = '8px';
            el.innerHTML = `
                <div style="display:flex; gap:8px; align-items:center;">
                    <img src="${avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid var(--border);cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(u.username)}'">
                    <div style="font-size:0.85rem;">
                        <div style="font-weight:700;">${escapeHtml(u.displayName||u.username)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">%${pct} · ${u.tebrikCount||0} tebrik</div>
                    </div>
                </div>
                <div style="font-size:0.85rem; font-weight:700; color:var(--primary);">#${idx+1}</div>
            `;
            container.appendChild(el);
        });
    } catch (e) {
        console.error('loadTopTebrikList hata:', e);
    }
};

// Update tebrik badge in profile header (shows raw count and percent relative to top)
window.updateProfileTebrikUI = async function(username) {
    try {
        const badgeCount = document.getElementById('tebrikCount');
        const badgePercent = document.getElementById('tebrikPercent');
        if (!badgeCount || !badgePercent) return;
        // find user doc
        const q = query(collection(db, 'users'), where('username','==', username), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            badgeCount.innerText = '0';
            badgePercent.innerText = '%0';
            return;
        }
        const data = snap.docs[0].data();
        const count = data.tebrikCount || 0;
        badgeCount.innerText = count;
        // get top value
        const topQ = query(collection(db, 'users'), orderBy('tebrikCount','desc'), limit(1));
        const topSnap = await getDocs(topQ);
        const topCount = topSnap.empty ? 0 : (topSnap.docs[0].data().tebrikCount || 0);
        const pct = topCount > 0 ? Math.round((count / topCount) * 100) : (count > 0 ? 100 : 0);
        badgePercent.innerText = `%${pct}`;
        const progress = document.getElementById('tebrikProgress');
        if (progress) {
            progress.style.width = `${pct}%`;
            if (pct >= 80) {
                progress.style.background = 'linear-gradient(135deg, #10b981, #22c55e)';
            } else if (pct >= 50) {
                progress.style.background = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
            } else {
                progress.style.background = 'linear-gradient(135deg, #6366f1, #a855f7)';
            }
        }
        const summary = document.getElementById('tebrikSummaryText');
        const levelLabel = document.getElementById('tebrikLevel');
        const rank = document.getElementById('tebrikRank');
        if (rank) {
            if (count > 0) {
                const rankQ = query(collection(db, 'users'), where('tebrikCount', '>', count));
                const rankSnap = await getDocs(rankQ);
                rank.innerText = `#${rankSnap.size + 1}`;
            } else {
                rank.innerText = '#--';
            }
        }
        if (summary) {
            if (count === 0) {
                summary.innerText = 'Henüz tebrik almadı. Şimdi ilk tebriği gönder!';
            } else if (pct >= 80) {
                summary.innerText = 'Zirveye yaklaştın, tebriklerin yükselişte.';
            } else if (pct >= 50) {
                summary.innerText = 'Profilin güçlü; kısa sürede daha yukarı çıkabilirsin.';
            } else {
                summary.innerText = 'Tebrik sayını artırmak için paylaşımlarını büyüt.';
            }
        }
        if (levelLabel) {
            if (pct >= 80) {
                levelLabel.innerText = 'Efsane';
                levelLabel.className = 'tebrik-card-tag tebrik-level-pill success';
            } else if (pct >= 50) {
                levelLabel.innerText = 'Yıldız';
                levelLabel.className = 'tebrik-card-tag tebrik-level-pill warning';
            } else if (pct > 0) {
                levelLabel.innerText = 'Yükselen';
                levelLabel.className = 'tebrik-card-tag tebrik-level-pill';
            } else {
                levelLabel.innerText = 'Yeni Başlayan';
                levelLabel.className = 'tebrik-card-tag tebrik-level-pill';
            }
        }
    } catch (e) {
        console.error('updateProfileTebrikUI hata:', e);
    }
};

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
let chatInactivityTimer = null;
let messagesUnsubscribe = null;
let typingUnsubscribe = null;

// Initialize chat widget container
function initChatWidget() {
    // Check if widget already exists
    if (document.getElementById('chat-widget-container')) return;
    
    const chatWidget = document.createElement('div');
    chatWidget.id = 'chat-widget-container';
    chatWidget.className = 'chat-widget-container';
    chatWidget.innerHTML = `
        <div class="chat-widget-header">
 <div class="chat-header-left">
            <button class="back-btn" id="chat-back-btn" onclick="backToFriendList()" title="Geri Dön">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div style="display:flex; align-items:center; gap:8px;">
                <h3 id="chat-widget-title">Sohbet</h3>
                <span id="chat-unread-count" class="chat-unread-badge" style="display:none;">0 yeni</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button id="chat-clear-btn" type="button" onclick="window.clearChatHistory()" style="display:none; align-items:center; gap:6px; padding:8px 12px; border:none; border-radius:999px; background: linear-gradient(90deg,#ef4444,#fb7185); color:white; font-size:0.85rem; cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i> Geçmişi Sil
                </button>
            </div>
        </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button class="close-btn" onclick="closeChatWidget()">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        </div>
        <div class="chat-widget-messages" id="chat-widget-messages">
            <div class="chat-empty">
                <i class="fa-regular fa-comment"></i>
                <p>Henüz mesaj yok</p>
            </div>
        </div>
        <div class="chat-widget-input">
            <button id="chat-attach-btn" onclick="document.getElementById('chat-attachment-input').click()" title="Resim ekle" class="attach-btn">
                <i class="fa-solid fa-paperclip"></i>
            </button>
            <input 
                type="text" 
                id="chat-widget-input" 
                placeholder="Mesaj yaz..."
                onkeypress="handleChatKeypress(event)"
            >
            <button id="chat-emoji-btn" onclick="window.toggleEmojiPicker()" title="Emoji ekle" class="emoji-btn">
                <i class="fa-solid fa-face-smile"></i>
            </button>
            <button onclick="sendChatMessage()" id="chat-send-btn">
                <i class="fa-solid fa-paper-plane"></i>
            </button>
            <input type="file" id="chat-attachment-input" accept="image/*,audio/*" style="display:none;" onchange="window.handleChatAttachment(event)">
        </div>
    `;
    
    // Add CSS link if not already added
    if (!document.querySelector('link[href*="chat-widget.css"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'assets/css/chat-widget.css?v=20260240';
        document.head.appendChild(cssLink);
    }
    
    document.body.appendChild(chatWidget);

    if (auth.currentUser && typeof updateChatUnreadIndicator === 'function') {
        updateChatUnreadIndicator();
    }
}

// Initialize chat lists panel
function initChatListsPanel() {
    if (document.getElementById('chat-lists-panel')) return;
    
    const chatListsPanel = document.createElement('div');
    chatListsPanel.id = 'chat-lists-panel';
    chatListsPanel.className = 'chat-lists-panel';
    chatListsPanel.innerHTML = `
        <div class="chat-lists-header">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <h3 style="margin: 0;">Sohbet Et</h3>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="close-btn" onclick="closeChatsList()">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
        <div class="chat-lists-actions" style="display:flex; gap:10px; align-items:center; padding:5px 5px 0px;">
            <button type="button" onclick="loadRecentChats()" style="flex:1; padding:10px 14px; border:none; border-radius: 12px; background: var(--primary); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-clock-rotate-left"></i> Son Sohbetler
            </button>
            <button id="chat-unread-btn" type="button" onclick="loadUnreadChats()" style="flex:1; padding:10px 14px; border:none; border-radius: 12px; background:#ef4444; color:white; cursor:pointer; display:none; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-envelope-circle-check"></i> Okunmamış
            </button>
            <button type="button" onclick="loadChatFriends()" style="flex:1; padding:10px 14px; border:none; border-radius: 12px; background: var(--primary); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-users"></i> Arkadaşlarım
            </button>
        </div>
        <div class="chat-lists-search">
            <input 
                type="text" 
                id="chat-friends-search" 
                placeholder="Sohbet ara..."
                oninput="filterChatFriends(this.value)"
            >
        </div>
        <div class="chat-lists-title" style="padding:10px 12px; font-weight:600; color:var(--text);">Son Sohbetler</div>
        <div class="chat-lists-content" id="chat-friends-list">
            <div class="chat-lists-empty">
                <i class="fa-solid fa-spinner"></i>
                <p>Arkadaşlar yükleniyor...</p>
            </div>
        </div>
        <div class="chat-lists-footer" style="display:flex; gap:8px; align-items:center;">
            <input 
                type="text" 
                id="chat-new-user-input" 
                placeholder="Kullanıcı adı yazınız.."
                onkeypress="handleNewUserKeypress(event)"
                style="flex:1;"
            >
            <button id="chat-start-btn" onclick="startChatWithUsername()" style="display:flex; align-items:center; gap:4px; padding:8px 12px; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem;" title="Sohbete Et">
                <i class="fa-solid fa-paper-plane"></i><span>Sohbete Et</span>
            </button>
            <button id="chat-add-friend-btn" onclick="addFriendFromChat()" style="padding:8px 12px; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem;" title="Arkadaş ekle">
                <i class="fa-solid fa-user-plus"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(chatListsPanel);
}

// Open or close chat friends list
window.openChatsList = async function() {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }
    
    if (!document.getElementById('chat-lists-panel')) {
        initChatListsPanel();
    }
    
    const panel = document.getElementById('chat-lists-panel');
    if (panel.classList.contains('active')) {
        panel.classList.remove('active');
        return;
    }
    
    panel.classList.add('active');
    loadRecentChats();
}

// Close chat lists
window.closeChatsList = function() {
    const panel = document.getElementById('chat-lists-panel');
    if (panel) {
        panel.classList.remove('active');
    }
}

window.openUnreadChatsPanel = async function() {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }
    if (!document.getElementById('chat-lists-panel')) {
        initChatListsPanel();
    }
    const panel = document.getElementById('chat-lists-panel');
    if (panel && !panel.classList.contains('active')) {
        panel.classList.add('active');
    }
    await loadUnreadChats();
}

// Load friends for chat

window.loadChatFriends = async function() {
    const friendsList = document.getElementById('chat-friends-list');
    if (!friendsList) return;
    
    try {
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
                    
                    friendsHtml += `
                        <div class="chat-friend-item" onclick="openChatWithFriend('${friendId}', '${displayName}', '${username}')">
                            <img src="${avatarUrl}" class="chat-friend-avatar" alt="">
                            <div class="chat-friend-info">
                                <p class="chat-friend-name">${escapeHtml(displayName)}</p>
                                <p class="chat-friend-username">@${escapeHtml(username)}</p>
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
        
    } catch (error) {
        console.error('Arkadaşlar yüklenirken hata:', error);
        friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Arkadaşlar yüklenemedi</p></div>';
    }
}

// Load recent chats when opening list
window.loadRecentChats = async function() {
    const friendsList = document.getElementById('chat-friends-list');
    if (!friendsList) return;

    try {
        const currentUserId = auth.currentUser.uid;
        const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUserId),
            orderBy('lastMessageAt', 'desc'),
            limit(20)
        );

        const convSnap = await getDocs(q);
        if (convSnap.empty) {
            friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-comment-slash"></i><p>Henüz sohbetiniz yok</p></div>';
            return;
        }

        const recentChats = [];
        for (const docSnap of convSnap.docs) {
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

                recentChats.push({ otherParticipantId, displayName, username, avatarUrl, lastMessage, unreadCount });
            } catch (error) {
                console.error('Sohbet kullanıcısı yüklenirken hata:', error);
            }
        }

        const titleEl = document.querySelector('.chat-lists-title');
        if (titleEl) titleEl.textContent = 'Son Sohbetler';

        if (recentChats.length === 0) {
            friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-comment-slash"></i><p>Henüz sohbetiniz yok</p></div>';
            return;
        }

        let friendsHtml = '';
        for (let i = 0; i < recentChats.length; i++) {
            const chat = recentChats[i];
            if (i === 2) {
                friendsHtml += `
                    <div class="chat-friend-item chat-load-more" onclick="showMoreRecentChats()">
                        <div class="chat-friend-info" style="width:100%; text-align:center; padding: 8px 0;">
                            <p class="chat-friend-name" style="margin:0; font-size:0.85rem;">Daha fazla yükle</p>
                        </div>
                    </div>
                `;
                break;
            }
            friendsHtml += `
                <div class="chat-friend-item" data-recent-index="${i}" onclick="openChatWithFriend('${chat.otherParticipantId}', '${chat.displayName}', '${chat.username}')">
                    <img src="${chat.avatarUrl}" class="chat-friend-avatar" alt="">
                    <div class="chat-friend-info">
                        <p class="chat-friend-name">${escapeHtml(chat.displayName)}</p>
                        <p class="chat-friend-lastmsg">${escapeHtml(chat.lastMessage)}</p>
                    </div>
                    <div class="chat-friend-meta">
                        ${chat.unreadCount > 0 ? `<span class="chat-last-sender">Yeni Mesaj</span>` : ''}
                    </div>
                </div>
            `;
        }

        friendsList.innerHTML = friendsHtml;
        if (recentChats.length > 2) {
            for (let i = 2; i < recentChats.length; i++) {
                const chat = recentChats[i];
                const hiddenItem = document.createElement('div');
                hiddenItem.className = 'chat-friend-item hidden-recent';
                hiddenItem.style.display = 'none';
                hiddenItem.innerHTML = `
                    <img src="${chat.avatarUrl}" class="chat-friend-avatar" alt="">
                    <div class="chat-friend-info">
                        <p class="chat-friend-name">${escapeHtml(chat.displayName)}</p>
                        <p class="chat-friend-lastmsg">${escapeHtml(chat.lastMessage)}</p>
                    </div>
                `;
                hiddenItem.onclick = () => openChatWithFriend(chat.otherParticipantId, chat.displayName, chat.username);
                friendsList.appendChild(hiddenItem);
            }
        }
    } catch (error) {
        console.error('Sohbetler yüklenirken hata:', error);
        friendsList.innerHTML = '<div class="chat-lists-empty"><i class="fa-solid fa-circle-exclamation"></i><p>Sohbetler yüklenemedi</p></div>';
    }
}

window.showMoreRecentChats = function() {
    document.querySelectorAll('.chat-friend-item.hidden-recent').forEach(item => {
        item.style.display = 'flex';
    });
    const loadMoreBtn = document.querySelector('.chat-load-more');
    if (loadMoreBtn) loadMoreBtn.remove();
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
            const unread = data.unreadCount?.[currentUserId] || 0;
            return sum + (typeof unread === 'number' ? unread : 0);
        }, 0);

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
    } catch (error) {
        console.warn('Okunmamış mesaj göstergesi güncellenirken hata:', error);
    }
}

window.loadUnreadChats = async function() {
    const friendsList = document.getElementById('chat-friends-list');
    if (!friendsList) return;
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    try {
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
                            ${unreadCount > 0 ? `<span class="chat-last-sender">Yeni Mesaj</span>` : ''}
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
        
        // Update widget header
        const titleEl = document.getElementById('chat-widget-title');
        if (titleEl) {
            titleEl.textContent = currentChatUsername;
        }
        
        // Show widget
        const widgetEl = document.getElementById('chat-widget-container');
        widgetEl.classList.add('active');

        const clearButton = document.getElementById('chat-clear-btn');
        if (clearButton) {
            clearButton.style.display = 'inline-flex';
        }
        
        // Load messages
        loadChatMessages(conversationId);
        
        // Reset inactivity timer
        resetChatInactivityTimer();
        
    } catch (error) {
        console.error('Chat açılırken hata:', error);
        alert('Sohbet açılırken bir hata oluştu');
    }
}

// Open group chat (hobi grubu sohbeti)
window.openGroupChat = async function(groupId, groupName, memberIds = []) {
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    if (!document.getElementById('chat-widget-container')) {
        initChatWidget();
    }

    const currentUserId = auth.currentUser.uid;
    const conversationId = `group_${groupId}`;

    // Ensure current user is part of participants
    const participants = Array.from(new Set([...(memberIds || []), currentUserId]));

    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);

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
            groupName: groupName || 'Hobi Grubu Sohbeti'
        });
    } else {
        const existing = convSnap.data().participants || [];
        const missing = participants.filter(id => !existing.includes(id));
        if (missing.length) {
            await updateDoc(convRef, { participants: [...existing, ...missing] });
        }
    }

    currentConversationId = conversationId;
    currentChatUserId = conversationId;
    currentChatUsername = groupName || 'Hobi Grubu Sohbeti';

    const titleEl = document.getElementById('chat-widget-title');
    if (titleEl) {
        titleEl.textContent = currentChatUsername;
    }

    const widgetEl = document.getElementById('chat-widget-container');
    widgetEl.classList.add('active');

    const clearButton = document.getElementById('chat-clear-btn');
    if (clearButton) {
        clearButton.style.display = 'inline-flex';
    }

    loadChatMessages(conversationId);
    resetChatInactivityTimer();
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

    const clearButton = document.getElementById('chat-clear-btn');
    if (clearButton) {
        clearButton.style.display = 'none';
    }
    
    currentChatUserId = null;
    currentChatUsername = null;
    currentConversationId = null;
    
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
    // close current conversation widget and show the friends list panel
    window.closeChatWidget();
    window.openChatsList();
};

// Escape HTML special characters
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else {
        return '';
    }
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes}d önce`;
    if (hours < 24) return `${hours}s önce`;
    if (days < 7) return `${days}g önce`;
    
    return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
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
    if (clearButton) clearButton.disabled = true;

    try {
        const messagesQuery = query(collection(db, 'conversations', currentConversationId, 'messages'));
        const snapshot = await getDocs(messagesQuery);

        const deletePromises = [];
        snapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, 'conversations', currentConversationId, 'messages', docSnap.id)));
        });

        await Promise.all(deletePromises);
        await updateDoc(doc(db, 'conversations', currentConversationId), {
            lastMessage: '',
            lastMessageAt: serverTimestamp(),
            lastSenderId: ''
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
    }
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
            titleEl.textContent = 'Yeni Blog Yazısı';
        } else if (view === 'post') {
            titleEl.textContent = 'Blog Yazısı';
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
            if (pageTitle) pageTitle.textContent = 'Yeni Blog Yazısı';
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
                    <div>Blog yazısı sayısı: <strong>${totalPosts}</strong></div>
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
            container.innerHTML = `<p style="color:var(--text-muted);">${mineMode ? 'Henüz kendi yazınız yok.' : 'Henüz yayımlanmış bir blog yazısı yok.'}</p>`;
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
            container.innerHTML = `<p style="color:var(--text-muted);">${mineMode ? 'Henüz kendi yazınız yok.' : 'Henüz yayımlanmış bir blog yazısı yok.'}</p>`;
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
                                <div style="font-size:0.75rem;">Gönderildi: ${formatTime(data.createdAt)}</div>
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
                    <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.6; margin-top:10px;">${escapeHtml(excerpt)}${excerpt.length>=200?'...':''}</p>
                    <div class="post-action-row" style="margin-top:14px;">
                        <a href="blog.html?id=${doc.id}" class="mini-link-btn post-action-btn">
                            <i class="fa-solid fa-arrow-right" style="font-size:0.85rem;"></i>
                            <span>Devamını Oku</span>
                        </a>
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
        if (contentEl) contentEl.textContent = data.content || '';

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
                            title: data.title || 'Blog Yazısı',
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
    if (pageTitle) pageTitle.textContent = 'Blog Yazısını Düzenle';
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
});

// The back button has an inline onclick attribute that calls backToFriendList().
// Add listener only if element already exists to avoid null errors.
const backBtnElem = document.getElementById('chat-back-btn');
if (backBtnElem) {
    backBtnElem.addEventListener('click', () => {
        // Sohbet penceresini gizle
        document.querySelector('.chat-widget-container').classList.remove('active');
        // Arkadaş listesini göster
        document.querySelector('.chat-lists-panel').classList.add('active');
    });
}

// Expose blog edit/delete helpers to global scope so inline onclicks work (module scope doesn't expose them by default)
window.startEditingBlogPost = startEditingBlogPost;
window.deleteBlogPost = deleteBlogPost;

