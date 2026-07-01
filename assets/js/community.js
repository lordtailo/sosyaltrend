import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, arrayUnion, arrayRemove, serverTimestamp, getDoc, increment, getDocs, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBegJHqlfPagx8biFyS_FnE3iXOksgfoAU",
  authDomain: "sosyaltrend-21d21.firebaseapp.com",
  projectId: "sosyaltrend-21d21",
  storageBucket: "sosyaltrend-21d21.firebasestorage.app",
  messagingSenderId: "207734473261",
  appId: "1:207734473261:web:f31b6bf2908c6d88986ea4"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const communitiesCollection = collection(db, "topluluklar");

let currentUser = null;
let currentCommunityId = null;
let currentCommunityData = null;
let currentPostsUnsubscribe = null;

// Auth değişikliklerini dinle
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    console.log('Kullanıcı giriş yaptı:', user.email);
    loadCommunities();
  } else {
    console.log('Kullanıcı çıkış yaptı');
  }
});

// Toplulukları Firebase'den yükle
function publishTopCommunitiesWidget(snapshot) {
  const communities = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  window.dispatchEvent(new CustomEvent('topCommunitiesUpdated', { detail: communities }));
}

function loadCommunities() {
  try {
    onSnapshot(communitiesCollection, (snapshot) => {
      const container = document.getElementById('communitiesContainer');
      if (!container) return;
      
      container.innerHTML = '';

      if (snapshot.empty) {
        document.getElementById('emptyState').style.display = 'block';
        console.log('Hiç topluluk bulunamadı');
        return;
      }

      document.getElementById('emptyState').style.display = 'none';
      console.log('Topluluk sayısı:', snapshot.size);
      publishTopCommunitiesWidget(snapshot);

      snapshot.forEach((docSnap) => {
        try {
          const card = createCommunityCard(docSnap);
          if (card) container.appendChild(card);
        } catch (error) {
          console.error('Kart oluşturma hatası:', error);
        }
      });

      if (currentCommunityId) {
        const detailExists = snapshot.docs.some((docSnap) => docSnap.id === currentCommunityId);
        if (!detailExists) {
          showListView();
        }
      }
    }, (error) => {
      console.error('Topluluk yükleme hatası:', error);
    });
  } catch (error) {
    console.error('onSnapshot setup hatası:', error);
  }
}

// Topluluk kartı oluştur
function createCommunityCard(docSnap) {
  const data = docSnap.data();
  const communityId = docSnap.id;
  
  const isOwner = data.ownerUid === currentUser?.uid;
  const memberUids = getCommunityMemberUids(data);
  const invitedUids = getCommunityInvitedUids(data);
  const isJoined = currentUser && memberUids.includes(currentUser.uid);
  const memberCount = memberUids.length;
  const isAccessible = isCommunityVisibleToUser(data, currentUser);

  if (!isAccessible) return null;

  // Kategori rengini belirle
  const categoryColors = {
    teknoloji: { bg: 'linear-gradient(135deg, var(--primary), #818cf8)', icon: 'fa-code', color: 'var(--primary)' },
    sanat: { bg: 'linear-gradient(135deg, #ec4899, #f97316)', icon: 'fa-palette', color: '#ec4899' },
    spor: { bg: 'linear-gradient(135deg, #10b981, #14b8a6)', icon: 'fa-futbol', color: '#10b981' },
    muzik: { bg: 'linear-gradient(135deg, #8b5cf6, #d946ef)', icon: 'fa-music', color: '#8b5cf6' },
    egitim: { bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', icon: 'fa-book', color: '#f59e0b' },
    oyunlar: { bg: 'linear-gradient(135deg, #06b6d4, #0891b2)', icon: 'fa-gamepad', color: '#06b6d4' },
    yemek: { bg: 'linear-gradient(135deg, #ec4899, #f43f5e)', icon: 'fa-utensils', color: '#ec4899' },
    seyahat: { bg: 'linear-gradient(135deg, #06b6d4, #14b8a6)', icon: 'fa-map', color: '#06b6d4' },
    diger: { bg: 'linear-gradient(135deg, #6b7280, #9ca3af)', icon: 'fa-globe', color: '#6b7280' }
  };

  const categoryStyle = categoryColors[data.category] || categoryColors.diger;
  const postCount = data.postCount || 0;

  const card = document.createElement('div');
  card.className = 'glass-card community-card';
  card.style.cssText = 'overflow: hidden; transition: transform 0.2s, box-shadow 0.2s;';
  card.setAttribute('data-category', data.category || '');

  card.innerHTML = `
    <div style="height: 120px; background: ${categoryStyle.bg}; position: relative; overflow: hidden;">
      <div style="position: absolute; top: -10px; right: -10px; font-size: 3rem; opacity: 0.3;">
        <i class="fa-solid ${categoryStyle.icon}"></i>
      </div>
    </div>
    
    <div style="padding: 20px;">
      <div style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 15px;">
        <div style="width: 60px; height: 60px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: -40px; border: 3px solid var(--bg-primary);">
          <i class="fa-solid ${categoryStyle.icon}" style="font-size: 1.5rem; color: ${categoryStyle.color};"></i>
        </div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 5px 0; color: var(--text-main);">${data.name || 'İsimsiz Topluluk'}</h3>
          <span style="background: ${categoryStyle.color}; color: white; padding: 3px 10px; border-radius: 15px; font-size: 0.75rem; font-weight: bold;">
            ${capitalizeCategory(data.category)}
          </span>
        </div>
      </div>
      
      <p style="margin: 0 0 15px 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
        ${data.description || 'Açıklama yok'}
      </p>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid var(--border); gap: 8px; flex-wrap: wrap;">
        <div style="display: flex; gap: 15px;">
          <span style="color: var(--text-secondary); font-size: 0.85rem;">
            <i class="fa-solid fa-user-plus" style="color: ${categoryStyle.color}; margin-right: 5px;"></i>${memberCount}
          </span>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">
            <i class="fa-solid fa-comment" style="color: ${categoryStyle.color}; margin-right: 5px;"></i>${postCount}
          </span>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${isOwner ? `<button class="community-delete-btn" data-id="${communityId}" style="padding: 7px 12px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.82rem; box-shadow: 0 6px 16px rgba(239, 68, 68, 0.22); transition: transform 0.2s ease, box-shadow 0.2s ease;">🗑 Sil</button>` : ''}
          <button class="community-join-btn" data-id="${communityId}" data-joined="${isJoined}" style="padding: 7px 14px; background: ${isJoined ? 'linear-gradient(135deg, #10b981, #059669)' : `linear-gradient(135deg, ${categoryStyle.color}, ${categoryStyle.color})`}; color: white; border: none; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.82rem; box-shadow: 0 6px 16px ${isJoined ? 'rgba(16, 185, 129, 0.22)' : 'rgba(99, 102, 241, 0.20)'}; transition: transform 0.2s ease, box-shadow 0.2s ease;">
            ${isJoined ? '✓ Katıldı' : '➕ Katıl'}
          </button>
        </div>
      </div>
    </div>
  `;

  // Kart tıklamasıyla detay sayfası açılır
  card.addEventListener('click', (e) => {
    if (e.target.closest('.community-join-btn, .community-delete-btn')) return;
    openCommunityDetail(communityId);
  });

  // Katıl/Ayrıl butonu
  const joinBtn = card.querySelector('.community-join-btn');
  joinBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleCommunityMembership(communityId, isJoined);
  });

  // Sil butonu (yalnızca topluluğun sahibi görebilir)
  const deleteBtn = card.querySelector('.community-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteCommunity(communityId);
    });
  }

  return card;
}

// Kategori adını Türkçeye çevir
function capitalizeCategory(category) {
  const categories = {
    teknoloji: 'Teknoloji',
    sanat: 'Sanat',
    spor: 'Spor',
    egitim: 'Eğitim',
    oyunlar: 'Oyunlar',
    muzik: 'Müzik',
    yemek: 'Yemek & Mutfak',
    seyahat: 'Seyahat',
    diger: 'Diğer'
  };
  return categories[category] || category;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCommunityUsername(authorName) {
  const raw = String(authorName || 'kullanici').trim();
  const withoutEmail = raw.includes('@') ? raw.split('@')[0] : raw;
  return withoutEmail
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'kullanici';
}

function getCommunityMemberUids(data = {}) {
  const members = Array.isArray(data.members) ? data.members : [];
  return members.map((member) => typeof member === 'object' ? member.uid : member).filter(Boolean);
}

function getCommunityInvitedUids(data = {}) {
  const invitedUsers = Array.isArray(data.invitedUsers) ? data.invitedUsers : [];
  return invitedUsers.map((entry) => typeof entry === 'object' ? entry.uid : entry).filter(Boolean);
}

function isCommunityVisibleToUser(data = {}, user = null) {
  if (!data?.isPrivate) return true;
  if (!user?.uid) return false;
  const memberUids = getCommunityMemberUids(data);
  const invitedUids = getCommunityInvitedUids(data);
  return data.ownerUid === user.uid || memberUids.includes(user.uid) || invitedUids.includes(user.uid);
}

function getCommunityProfileData(user) {
  const profile = window.user || {};
  const fallbackDisplayName = (profile.displayName || user?.displayName || '').trim();
  const fallbackUsername = (profile.username || user?.displayName || '').trim();
  const emailLocalPart = user?.email ? user.email.split('@')[0] : '';
  const displayName = fallbackDisplayName || fallbackUsername || emailLocalPart || 'Kullanıcı';
  const username = (profile.username || fallbackUsername || emailLocalPart || formatCommunityUsername(displayName)).trim();
  const avatarUrl = profile.avatarUrl || profile.photoURL || user?.photoURL || 'assets/img/strendsaydamv2.png';

  return {
    displayName,
    username,
    avatarUrl
  };
}

function getCommunityAvatarUrl(avatarUrl) {
  if (!avatarUrl) return 'assets/img/strendsaydamv2.png';
  if (typeof avatarUrl === 'string' && (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:') || avatarUrl.startsWith('assets/'))) {
    return avatarUrl;
  }
  return 'assets/img/strendsaydamv2.png';
}

function formatPostDate(timestamp) {
  if (!timestamp) return 'az önce';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderPostComments(container, comments) {
  if (!container) return;

  if (!comments.length) {
    container.innerHTML = '<div style="padding:8px 0; font-size:0.85rem; color:var(--text-secondary);">Henüz yorum yok.</div>';
    return;
  }

  container.innerHTML = comments.map((comment) => {
    const canManageComment = currentUser && (currentUser.uid === comment.authorUid || currentCommunityData?.ownerUid === currentUser?.uid);
    const commentDisplayName = comment.authorDisplayName || comment.authorName || 'Kullanıcı';
    const commentUsername = comment.authorUsername || formatCommunityUsername(commentDisplayName);
    const commentAvatar = getCommunityAvatarUrl(comment.authorAvatarUrl);
    return `
      <div class="comment-item" data-comment-id="${comment.id}" style="padding:10px 0; border-top:1px solid var(--border); display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
        <div style="display:flex; gap:8px; flex:1;">
          <img src="${escapeHtml(commentAvatar)}" alt="${escapeHtml(commentDisplayName)}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';">
          <div style="flex:1;">
            <div style="font-weight:600; color:var(--text-main); font-size:0.9rem;">${escapeHtml(commentDisplayName)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:3px;">@${escapeHtml(commentUsername)}</div>
            <div class="comment-content-view" style="color:var(--text-secondary); line-height:1.5; white-space:pre-wrap; font-size:0.9rem;">${escapeHtml(comment.content || '')}</div>
            <div class="comment-edit-area" style="display:none; margin-top:6px;">
              <textarea class="comment-edit-textarea" rows="2" style="width:100%; border:1px solid var(--border); border-radius:10px; padding:8px 10px; background:rgba(255,255,255,0.04); color:var(--text-main); resize:vertical; box-sizing:border-box;">${escapeHtml(comment.content || '')}</textarea>
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px;">
                <button class="comment-cancel-edit-btn" data-comment-id="${comment.id}" data-post-id="${comment.postId || ''}" style="padding:6px 10px; border:none; border-radius:999px; background:rgba(255,255,255,0.08); color:var(--text-main); cursor:pointer;">İptal</button>
                <button class="comment-save-edit-btn" data-comment-id="${comment.id}" data-post-id="${comment.postId || ''}" style="padding:6px 10px; border:none; border-radius:999px; background:var(--primary); color:white; cursor:pointer; font-weight:700;">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
        ${canManageComment ? `<div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;">
          <button class="community-action-btn community-action-btn--edit" data-comment-id="${comment.id}" data-post-id="${comment.postId || ''}" title="Düzenle" aria-label="Düzenle">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="community-action-btn community-action-btn--delete" data-comment-id="${comment.id}" data-post-id="${comment.postId || ''}" title="Sil" aria-label="Sil">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.community-action-btn--edit[data-comment-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const commentCard = button.closest('.comment-item');
      const contentView = commentCard?.querySelector('.comment-content-view');
      const editArea = commentCard?.querySelector('.comment-edit-area');
      if (contentView && editArea) {
        contentView.style.display = 'none';
        editArea.style.display = 'block';
      }
    });
  });

  container.querySelectorAll('.comment-cancel-edit-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const commentCard = button.closest('.comment-item');
      const contentView = commentCard?.querySelector('.comment-content-view');
      const editArea = commentCard?.querySelector('.comment-edit-area');
      if (contentView && editArea) {
        contentView.style.display = 'block';
        editArea.style.display = 'none';
      }
    });
  });

  container.querySelectorAll('.comment-save-edit-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const commentId = button.getAttribute('data-comment-id');
      const postId = button.getAttribute('data-post-id');
      const commentCard = button.closest('.comment-item');
      const textarea = commentCard?.querySelector('.comment-edit-textarea');
      const content = textarea?.value.trim();
      if (!content) {
        alert('Yorum içeriğini yazınız.');
        return;
      }
      try {
        await updateDoc(doc(db, 'topluluklar', currentCommunityId, 'gonderiler', postId, 'yorumlar', commentId), {
          content,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Yorum düzenlenirken hata:', error);
        alert('Yorum düzenlenemedi.');
      }
    });
  });

  container.querySelectorAll('.community-action-btn--delete[data-comment-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const commentId = button.getAttribute('data-comment-id');
      const postId = button.getAttribute('data-post-id');
      const confirmed = confirm('Bu yorumu silmek istediğinize emin misiniz?');
      if (!confirmed) return;
      try {
        await deleteDoc(doc(db, 'topluluklar', currentCommunityId, 'gonderiler', postId, 'yorumlar', commentId));
        await updateDoc(doc(communitiesCollection, currentCommunityId, 'gonderiler', postId), {
          commentsCount: increment(-1)
        });
      } catch (error) {
        console.error('Yorum silinirken hata:', error);
        alert('Yorum silinemedi.');
      }
    });
  });
}

function loadPostComments(container, communityId, postId) {
  if (!container || !communityId || !postId) return;

  const commentsCollection = collection(db, 'topluluklar', communityId, 'gonderiler', postId, 'yorumlar');
  onSnapshot(commentsCollection, (snapshot) => {
    const comments = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, postId, ...docSnap.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderPostComments(container, comments);
  }, (error) => {
    console.error('Yorumlar yüklenirken hata:', error);
  });
}

function renderCommunityPosts(container, posts) {
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = '<div style="padding:16px 0; color:var(--text-secondary); background:transparent; border:none; border-radius:0;">Henüz gönderi yok. İlk mesajı sen paylaş.</div>';
    return;
  }

  container.innerHTML = posts.map((post) => {
    const canManagePost = currentUser && (currentUser.uid === post.authorUid || currentCommunityData?.ownerUid === currentUser?.uid);
    const likes = Array.isArray(post.likes) ? post.likes : [];
    const commentsCount = post.commentsCount || 0;
    const isLiked = currentUser ? likes.includes(currentUser.uid) : false;
    const displayName = post.authorDisplayName || post.authorName || 'Kullanıcı';
    const username = post.authorUsername || formatCommunityUsername(displayName);
    const avatarUrl = getCommunityAvatarUrl(post.authorAvatarUrl);
    return `
      <article class="post" style="padding:20px; border-radius:18px; position:relative; margin-bottom:16px; background:linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)); border:1px solid var(--border); box-shadow:0 10px 28px rgba(15, 23, 42, 0.06);">
        <div style="position:absolute; top:14px; right:14px; display:flex; align-items:center; gap:8px; z-index:10;">
          ${canManagePost ? `
            <button class="community-action-btn community-action-btn--edit" data-post-id="${post.id}" title="Düzenle" aria-label="Düzenle">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="community-action-btn community-action-btn--delete" data-post-id="${post.id}" title="Sil" aria-label="Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>

        <div style="display:flex; gap:10px; margin-bottom:10px;">
          <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" onerror="this.onerror=null;this.src='assets/img/strendsaydamv2.png';">
          <div>
            <div style="font-weight:700; display:flex; align-items:center; gap:6px; color:var(--text-main);">
              <span>${escapeHtml(displayName)}</span>
              <span class="post-time">• ${formatPostDate(post.createdAt)}</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">@${escapeHtml(username)}</div>
          </div>
        </div>

        <div class="post-content-view" style="color:var(--text-main); line-height:1.7; white-space:pre-wrap; font-size:0.95rem; margin-bottom:10px;">${escapeHtml(post.content || '')}</div>
        <div class="post-edit-area" style="display:none; margin-top:8px;">
          <textarea class="post-edit-textarea" rows="3" style="width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; background:rgba(255,255,255,0.04); color:var(--text-main); resize:vertical; box-sizing:border-box;">${escapeHtml(post.content || '')}</textarea>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
            <button class="post-cancel-edit-btn" data-post-id="${post.id}" style="padding:8px 12px; border:none; border-radius:999px; background:rgba(255,255,255,0.08); color:var(--text-main); cursor:pointer;">İptal</button>
            <button class="post-save-edit-btn" data-post-id="${post.id}" style="padding:8px 12px; border:none; border-radius:999px; background:linear-gradient(135deg, var(--primary), #818cf8); color:white; cursor:pointer; font-weight:700;">Kaydet</button>
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
          <button class="post-like-btn tool-btn" data-post-id="${post.id}" type="button" style="width:auto; padding:0 12px; border-radius:999px; gap:6px; color:${isLiked ? '#ef4444' : ''};"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${likes.length} Beğeni</span></button>
          <button class="post-comment-btn tool-btn" data-post-id="${post.id}" type="button" style="width:auto; padding:0 12px; border-radius:999px; gap:6px;"><i class="fa-regular fa-comment"></i><span>${commentsCount > 0 ? `${commentsCount} Yorum` : 'Yorum'}</span></button>
          <button class="post-share-btn tool-btn" data-post-id="${post.id}" type="button" style="width:auto; padding:0 12px; border-radius:999px; gap:6px; margin-left:auto;"><i class="fa-solid fa-share"></i><span>Paylaş</span></button>
        </div>

        <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border);">
          <div class="post-comments-list" data-post-id="${post.id}" style="margin-bottom:12px;"></div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input class="comment-input" data-post-id="${post.id}" type="text" placeholder="Yorum yaz..." style="flex:1; border:1px solid var(--border); border-radius:999px; padding:8px 12px; background:rgba(255,255,255,0.04); color:var(--text-main);">
            <button class="comment-submit-btn" data-post-id="${post.id}" style="padding:8px 12px; border:none; border-radius:999px; background:var(--primary); color:white; cursor:pointer; font-weight:700;">Yorum</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.community-action-btn--edit[data-post-id]:not([data-comment-id])').forEach((button) => {
    button.addEventListener('click', () => {
      const postCard = button.closest('.post');
      const contentView = postCard?.querySelector('.post-content-view');
      const editArea = postCard?.querySelector('.post-edit-area');
      if (contentView && editArea) {
        contentView.style.display = 'none';
        editArea.style.display = 'block';
      }
    });
  });

  container.querySelectorAll('.post-cancel-edit-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const postCard = button.closest('.post');
      const contentView = postCard?.querySelector('.post-content-view');
      const editArea = postCard?.querySelector('.post-edit-area');
      if (contentView && editArea) {
        contentView.style.display = 'block';
        editArea.style.display = 'none';
      }
    });
  });

  container.querySelectorAll('.post-save-edit-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const postId = button.getAttribute('data-post-id');
      const postCard = button.closest('.post');
      const textarea = postCard?.querySelector('.post-edit-textarea');
      const content = textarea?.value.trim();
      if (!content) {
        alert('Gönderi içeriğini yazınız.');
        return;
      }
      try {
        await updateDoc(doc(communitiesCollection, currentCommunityId, 'gonderiler', postId), {
          content,
          updatedAt: serverTimestamp()
        });
        const contentView = postCard?.querySelector('.post-content-view');
        const editArea = postCard?.querySelector('.post-edit-area');
        if (contentView && editArea) {
          contentView.innerHTML = escapeHtml(content);
          contentView.style.display = 'block';
          editArea.style.display = 'none';
        }
      } catch (error) {
        console.error('Gönderi düzenlenirken hata:', error);
        alert('Gönderi düzenlenemedi.');
      }
    });
  });

  container.querySelectorAll('.community-action-btn--delete[data-post-id]:not([data-comment-id])').forEach((button) => {
    button.addEventListener('click', async () => {
      const postId = button.getAttribute('data-post-id');
      const confirmed = confirm('Bu gönderiyi silmek istediğinize emin misiniz?');
      if (!confirmed) return;
      try {
        await deleteDoc(doc(communitiesCollection, currentCommunityId, 'gonderiler', postId));
        await updateDoc(doc(communitiesCollection, currentCommunityId), {
          postCount: Math.max((currentCommunityData?.postCount || 1) - 1, 0),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Gönderi silinirken hata:', error);
        alert('Gönderi silinemedi.');
      }
    });
  });

  container.querySelectorAll('.post-like-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!currentUser) {
        alert('Lütfen önce giriş yapınız.');
        return;
      }
      const postId = button.getAttribute('data-post-id');
      const postRef = doc(communitiesCollection, currentCommunityId, 'gonderiler', postId);
      try {
        const snap = await getDoc(postRef);
        const data = snap.data() || {};
        const likes = Array.isArray(data.likes) ? data.likes : [];
        if (likes.includes(currentUser.uid)) {
          await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
        } else {
          await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
        }
      } catch (error) {
        console.error('Beğeni güncellenirken hata:', error);
        alert('Beğeni işlemi başarısız oldu.');
      }
    });
  });

  container.querySelectorAll('.post-comment-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const postId = button.getAttribute('data-post-id');
      const postCard = button.closest('.post');
      const input = postCard?.querySelector(`.comment-input[data-post-id="${postId}"]`);
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  container.querySelectorAll('.post-share-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const postId = button.getAttribute('data-post-id');
      const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#post-${postId}`;
      try {
        if (navigator.share) {
          await navigator.share({
            title: 'SosyaLTrend Topluluk Gönderisi',
            text: 'Bu gönderiyi görüntüle',
            url: shareUrl
          });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          alert('Bağlantı kopyalandı.');
        } else {
          alert('Paylaşım desteklenmiyor.');
        }
      } catch (error) {
        console.error('Paylaşım hatası:', error);
      }
    });
  });

  container.querySelectorAll('.comment-submit-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const postId = button.getAttribute('data-post-id');
      const postCard = button.closest('.post');
      const input = postCard?.querySelector(`.comment-input[data-post-id="${postId}"]`);
      const content = input?.value.trim();
      if (!content) {
        alert('Yorum içeriğini yazınız.');
        return;
      }
      try {
        const profile = getCommunityProfileData(currentUser);
        await addDoc(collection(db, 'topluluklar', currentCommunityId, 'gonderiler', postId, 'yorumlar'), {
          content,
          authorUid: currentUser.uid,
          authorName: profile.displayName,
          authorDisplayName: profile.displayName,
          authorUsername: profile.username,
          authorAvatarUrl: profile.avatarUrl,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(communitiesCollection, currentCommunityId, 'gonderiler', postId), {
          commentsCount: increment(1),
          updatedAt: serverTimestamp()
        });
        if (input) input.value = '';
      } catch (error) {
        console.error('Yorum eklenirken hata:', error);
        alert('Yorum eklenemedi.');
      }
    });
  });

  container.querySelectorAll('.post-comments-list').forEach((commentsList) => {
    const postId = commentsList.getAttribute('data-post-id');
    loadPostComments(commentsList, currentCommunityId, postId);
  });
}

function loadCommunityPosts(communityId) {
  const postsList = document.getElementById('communityPostsList');
  if (!communityId || !postsList) return;

  if (currentPostsUnsubscribe) {
    currentPostsUnsubscribe();
    currentPostsUnsubscribe = null;
  }

  const postsCollection = collection(db, 'topluluklar', communityId, 'gonderiler');
  currentPostsUnsubscribe = onSnapshot(postsCollection, (snapshot) => {
    const posts = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderCommunityPosts(postsList, posts);
  }, (error) => {
    console.error('Gönderiler yüklenirken hata:', error);
    postsList.innerHTML = '<div style="padding:16px; color:var(--text-secondary);">Gönderiler yüklenemedi.</div>';
  });
}

async function createCommunityPost(communityId) {
  if (!communityId) return;
  if (!currentUser) {
    alert('Lütfen önce giriş yapınız.');
    return;
  }

  const isOwner = currentCommunityData?.ownerUid === currentUser?.uid;
  const memberUids = Array.isArray(currentCommunityData?.members) ? currentCommunityData.members.map((member) => typeof member === 'object' ? member.uid : member) : [];
  const isJoined = currentUser && memberUids.includes(currentUser.uid);

  if (!isOwner && !isJoined) {
    alert('Gönderi paylaşmak için önce bu topluluğa katılmalısınız.');
    return;
  }

  const contentInput = document.getElementById('communityPostInput');
  const content = contentInput?.value.trim();
  if (!content) {
    alert('Gönderi içeriğini yazınız.');
    return;
  }

  try {
    const postsCollection = collection(db, 'topluluklar', communityId, 'gonderiler');
    const profile = getCommunityProfileData(currentUser);
    await addDoc(postsCollection, {
      content,
      authorUid: currentUser.uid,
      authorName: profile.displayName,
      authorDisplayName: profile.displayName,
      authorUsername: profile.username,
      authorAvatarUrl: profile.avatarUrl,
      commentsCount: 0,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(communitiesCollection, communityId), {
      postCount: increment(1),
      updatedAt: serverTimestamp()
    });

    if (contentInput) contentInput.value = '';
  } catch (error) {
    console.error('Gönderi paylaşılırken hata:', error);
    alert('Gönderi paylaşılırken bir hata oluştu.');
  }
}

// Topluluğa katıl/Ayrıl
async function toggleCommunityMembership(communityId, isJoined) {
  if (!currentUser) {
    alert('Lütfen önce giriş yapınız.');
    return;
  }

  try {
    const communityRef = doc(communitiesCollection, communityId);
    const communitySnap = await getDoc(communityRef);
    const communityData = communitySnap.exists() ? communitySnap.data() : {};
    const memberData = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email
    };

    if (isJoined) {
      await updateDoc(communityRef, {
        members: arrayRemove(memberData)
      });
      console.log('Topluluğundan ayrıldı:', communityId);
    } else {
      if (communityData.isPrivate && communityData.ownerUid !== currentUser.uid && !getCommunityInvitedUids(communityData).includes(currentUser.uid)) {
        alert('Bu özel topluluğa katılmak için davet almanız gerekir.');
        return;
      }
      await updateDoc(communityRef, {
        members: arrayUnion(memberData)
      });
      console.log('Topluluğa katıldı:', communityId);
    }
  } catch (error) {
    console.error('Üyelik güncellenirken hata:', error);
    alert('İşlem başarısız. Lütfen tekrar deneyin.');
  }
}

// Topluluğu sil (yalnızca sahibi)
async function deleteCommunity(communityId) {
  if (!currentUser) {
    alert('Lütfen önce giriş yapınız.');
    return;
  }

  const confirmed = confirm('Bu topluluğu silmek istediğinize emin misiniz?');
  if (!confirmed) return;

  try {
    await deleteDoc(doc(communitiesCollection, communityId));
    if (currentCommunityId === communityId) {
      showListView();
    }
    console.log('Topluluk silindi:', communityId);
  } catch (error) {
    console.error('Topluluk silinirken hata:', error);
    alert('Topluluk silinemedi. Lütfen tekrar deneyin.');
  }
}

function setCommunityRoute(communityId, push = false) {
  const url = new URL(window.location.href);
  if (communityId) {
    url.searchParams.set('community', communityId);
  } else {
    url.searchParams.delete('community');
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (push) {
    window.history.pushState({}, '', nextUrl);
  } else {
    window.history.replaceState({}, '', nextUrl);
  }
}

function showListView() {
  const listContainer = document.getElementById('communitiesContainer');
  const detailView = document.getElementById('communityDetailView');
  if (currentPostsUnsubscribe) {
    currentPostsUnsubscribe();
    currentPostsUnsubscribe = null;
  }
  if (listContainer) {
    listContainer.style.display = 'grid';
  }
  if (detailView) {
    detailView.style.display = 'none';
    detailView.innerHTML = '';
  }
  currentCommunityId = null;
  currentCommunityData = null;
  setCommunityRoute('', false);
}

async function openCommunityDetail(communityId) {
  if (!communityId) return;
  const detailView = document.getElementById('communityDetailView');
  const listContainer = document.getElementById('communitiesContainer');
  if (!detailView || !listContainer) return;

  currentCommunityId = communityId;
  currentCommunityData = null;
  setCommunityRoute(communityId, true);
  listContainer.style.display = 'none';
  detailView.style.display = 'block';
  detailView.innerHTML = '<div style="padding: 20px; color: var(--text-secondary);">Yükleniyor...</div>';

  try {
    const snap = await getDoc(doc(communitiesCollection, communityId));
    if (!snap.exists()) {
      detailView.innerHTML = '<div style="padding: 20px; color: var(--text-secondary);">Bu topluluk bulunamadı.</div>';
      return;
    }

    const data = snap.data();
    const memberUids = getCommunityMemberUids(data);
    const invitedUids = getCommunityInvitedUids(data);
    const isAccessible = isCommunityVisibleToUser(data, currentUser);
    if (data.isPrivate && !isAccessible) {
      detailView.innerHTML = '<div style="padding: 20px; color: var(--text-secondary);">Bu özel topluluk sadece davet edilen kişiler tarafından görülebilir.</div>';
      currentCommunityData = { id: snap.id, ...data, memberUids, invitedUids };
      return;
    }

    currentCommunityData = { id: snap.id, ...data, memberUids, invitedUids };
    const memberCount = memberUids.length;
    const isOwner = data.ownerUid === currentUser?.uid;
    const isJoined = currentUser && memberUids.includes(currentUser.uid);
    const categoryColors = {
      teknoloji: { bg: 'linear-gradient(135deg, var(--primary), #818cf8)', icon: 'fa-code', color: 'var(--primary)' },
      sanat: { bg: 'linear-gradient(135deg, #ec4899, #f97316)', icon: 'fa-palette', color: '#ec4899' },
      spor: { bg: 'linear-gradient(135deg, #10b981, #14b8a6)', icon: 'fa-futbol', color: '#10b981' },
      muzik: { bg: 'linear-gradient(135deg, #8b5cf6, #d946ef)', icon: 'fa-music', color: '#8b5cf6' },
      egitim: { bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', icon: 'fa-book', color: '#f59e0b' },
      oyunlar: { bg: 'linear-gradient(135deg, #06b6d4, #0891b2)', icon: 'fa-gamepad', color: '#06b6d4' },
      yemek: { bg: 'linear-gradient(135deg, #ec4899, #f43f5e)', icon: 'fa-utensils', color: '#ec4899' },
      seyahat: { bg: 'linear-gradient(135deg, #06b6d4, #14b8a6)', icon: 'fa-map', color: '#06b6d4' },
      diger: { bg: 'linear-gradient(135deg, #6b7280, #9ca3af)', icon: 'fa-globe', color: '#6b7280' }
    };
    const categoryStyle = categoryColors[data.category] || categoryColors.diger;

    detailView.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
        <button onclick="showListView()" style="padding:8px 14px; border:none; border-radius:16px; background:var(--bg-secondary); color:var(--text-main); cursor:pointer;">
          <i class="fa-solid fa-arrow-left"></i> Listeye dön
        </button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${isOwner ? `<button onclick="window.openEditCommunityModalFromDetail('${communityId}')" style="padding:8px 14px; border:none; border-radius:999px; background:linear-gradient(135deg, var(--primary), #818cf8); color:white; cursor:pointer; font-weight:700; box-shadow:0 6px 16px rgba(99,102,241,0.20);">✏️ Düzenle</button>` : ''}
          ${isOwner ? `<button onclick="window.deleteCommunity('${communityId}')" style="padding:8px 14px; border:none; border-radius:999px; background:linear-gradient(135deg, #ef4444, #dc2626); color:white; cursor:pointer; font-weight:700; box-shadow:0 6px 16px rgba(239,68,68,0.22);">🗑 Sil</button>` : ''}
          <button onclick="window.toggleCommunityMembership('${communityId}', ${isJoined})" style="padding:8px 14px; border:none; border-radius:999px; background:${isJoined ? 'linear-gradient(135deg, #10b981, #059669)' : `linear-gradient(135deg, ${categoryStyle.color}, ${categoryStyle.color})`}; color:white; cursor:pointer; font-weight:700; box-shadow:0 6px 16px ${isJoined ? 'rgba(16,185,129,0.22)' : 'rgba(99,102,241,0.20)'};">${isJoined ? '✓ Katıldı' : '➕ Katıl'}</button>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:20px;">
        <div class="glass-card" style="padding:0; border:1px solid rgba(99,102,241,0.16); width:100%; overflow:hidden; box-shadow:0 16px 40px rgba(15, 23, 42, 0.12);">
          <div style="height:210px; width:100%; background:${categoryStyle.bg}; position:relative; overflow:hidden;">
            <div style="position:absolute; inset:0; background:linear-gradient(90deg, rgba(255,255,255,0.20), transparent 55%, rgba(0,0,0,0.16));"></div>
            <div style="position:absolute; top:18px; right:20px; font-size:3.4rem; opacity:0.28;"><i class="fa-solid ${categoryStyle.icon}"></i></div>
            <div style="position:absolute; left:24px; bottom:24px; right:24px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-end;">
              <div>
                <div style="display:inline-block; background:rgba(255,255,255,0.16); backdrop-filter:blur(6px); padding:6px 12px; border-radius:999px; color:white; font-size:0.8rem; font-weight:700; margin-bottom:8px;">${capitalizeCategory(data.category)}</div>
                <h2 style="margin:0; color:white; font-size:1.8rem; font-weight:800;">${data.name || 'İsimsiz Topluluk'}</h2>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" onclick="window.openCommunityGroupChat('${communityId}', '${escapeHtml(data.name || 'Topluluk')}')" style="border:none; border-radius:999px; background:rgba(255,255,255,0.20); backdrop-filter:blur(8px); color:white; padding:8px 14px; cursor:pointer; font-weight:700; box-shadow:0 8px 22px rgba(15,23,42,0.16);">
                  <i class="fa-solid fa-comments" style="margin-right:6px;"></i>Sohbet Et
                </button>
                <button type="button" onclick="window.toggleCommunityMembersView('${communityId}')" style="border:none; border-radius:999px; background:rgba(255,255,255,0.20); backdrop-filter:blur(8px); color:white; padding:8px 14px; cursor:pointer; font-weight:700; box-shadow:0 8px 22px rgba(15,23,42,0.16);">
                  <i class="fa-solid fa-users" style="margin-right:6px;"></i>Üyeler (${memberCount})
                </button>
              </div>
            </div>
          </div>
          <div style="padding:20px 24px 24px; display:flex; justify-content:space-between; gap:18px; flex-wrap:wrap; align-items:flex-start;">
            <div style="display:flex; flex-direction:column; gap:8px; color:var(--text-secondary); flex:1; min-width:260px;">
              <p style="margin:0; line-height:1.7; font-size:0.97rem;">${data.description || 'Açıklama yok.'}</p>
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <span style="font-size:0.9rem; color:var(--text-main); font-weight:600;">${data.isPrivate ? 'Özel' : 'Herkese açık'}</span>
                ${(isOwner || isJoined) ? `<button type="button" onclick="window.openCommunityInvitePrompt('${communityId}')" style="padding:6px 10px; border:none; border-radius:999px; background:rgba(99,102,241,0.12); color:var(--primary); cursor:pointer; font-weight:700; font-size:0.8rem;">Davet Et</button>` : ''}
              </div>
            </div>
          </div>
        </div>

        <div id="communityMembersSection" style="display:none; padding:20px; border:1px solid rgba(99,102,241,0.16); border-radius:20px; background:linear-gradient(135deg, rgba(99,102,241,0.10), rgba(255,255,255,0.03)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
            <div>
              <h3 style="margin:0; color:var(--text-main);">Topluluk üyeleri</h3>
              <div style="margin-top:4px; font-size:0.85rem; color:var(--text-secondary);">Bu topluluğa katılan kişiler burada görünür.</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="padding:6px 10px; border-radius:999px; background:rgba(99,102,241,0.12); color:var(--primary); font-size:0.8rem; font-weight:700;">${memberCount} kişi</span>
              <button type="button" onclick="window.toggleCommunityMembersView('${communityId}')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:0.95rem;">Kapat</button>
            </div>
          </div>
          <div id="communityMembersList" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;"></div>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="glass-card" style="padding:20px; border:1px solid rgba(99,102,241,0.16); background:linear-gradient(135deg, rgba(99,102,241,0.10), rgba(255,255,255,0.03));">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; color:var(--text-main);">Gönderi paylaş</h3>
              </div>
              <textarea id="communityPostInput" rows="4" placeholder="Bu toplulukta neler paylaşmak istersin?" style="width:100%; border:1px solid var(--border); border-radius:14px; padding:12px 14px; background:rgba(255,255,255,0.04); color:var(--text-main); resize:vertical; box-sizing:border-box; min-height:96px;"></textarea>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:10px; flex-wrap:wrap;">
                <span style="font-size:0.85rem; color:var(--text-secondary);">Katılınca gönderi paylaşabilirsin.</span>
                <button onclick="window.createCommunityPost('${communityId}')" style="padding:10px 16px; border:none; border-radius:999px; background:linear-gradient(135deg, var(--primary), #818cf8); color:white; cursor:pointer; font-weight:700; box-shadow:0 8px 22px rgba(99,102,241,0.20);">Gönder</button>
              </div>
            </div>

            <div style="padding:20px 0; border:none; background:transparent;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px; flex-wrap:wrap;">
                <button type="button" style="display:inline-flex; align-items:center; gap:6px; border:1px solid rgba(99,102,241,0.16); background:linear-gradient(135deg, rgba(99,102,241,0.12), rgba(255,255,255,0.06)); color:var(--text-main); padding:8px 12px; border-radius:999px; font-size:0.8rem; font-weight:700; cursor:default; box-shadow:0 6px 16px rgba(15, 23, 42, 0.06);">
                  <i class="fa-solid fa-comments"></i>
                  <span>Gönderiler</span>
                </button>
                <button type="button" style="display:inline-flex; align-items:center; gap:6px; border:1px solid rgba(99,102,241,0.16); background:linear-gradient(135deg, rgba(99,102,241,0.12), rgba(255,255,255,0.06)); color:var(--text-main); padding:8px 12px; border-radius:999px; font-size:0.8rem; font-weight:700; cursor:default; box-shadow:0 6px 16px rgba(15, 23, 42, 0.06);">
                  <i class="fa-solid fa-clock-rotate-left"></i>
                  <span>Son paylaşım</span>
                </button>
              </div>
              <div id="communityPostsList" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
          </div>
        </div>
    `;

    loadCommunityPosts(communityId);
  } catch (error) {
    console.error('Topluluk detayı yüklenirken hata:', error);
    detailView.innerHTML = '<div style="padding: 20px; color: var(--text-secondary);">Topluluk detayı yüklenemedi.</div>';
  }
}

async function openCommunityGroupChat(communityId, communityName) {
  if (!communityId) return;

  if (!currentUser) {
    alert('Lütfen giriş yapın.');
    return;
  }

  try {
    const snap = await getDoc(doc(communitiesCollection, communityId));
    if (!snap.exists()) {
      alert('Bu topluluk bulunamadı.');
      return;
    }

    const data = snap.data();
    const memberUids = Array.isArray(data.members)
      ? data.members
          .map((member) => typeof member === 'object' ? member.uid : member)
          .filter(Boolean)
      : [];
    const participants = Array.from(new Set([...(memberUids || []), currentUser.uid, data.ownerUid].filter(Boolean)));

    if (typeof window.openGroupChat === 'function') {
      await window.openGroupChat(communityId, communityName || data.name || 'Topluluk Sohbeti', participants, data.ownerUid || currentUser.uid);
    } else {
      alert('Sohbet sistemi şu anda hazır değil.');
    }
  } catch (error) {
    console.error('Topluluk sohbeti açılırken hata:', error);
    alert('Grup sohbeti açılırken bir hata oluştu.');
  }
}

function renderCommunityMembersList(memberUids = []) {
  const membersList = document.getElementById('communityMembersList');
  if (!membersList) return;

  if (!memberUids.length) {
    membersList.innerHTML = '<div style="padding:16px; border:1px dashed var(--border); border-radius:14px; text-align:center; color:var(--text-secondary);">Henüz üye yok.</div>';
    return;
  }

  const memberItems = memberUids.map((member) => {
    const uid = typeof member === 'object' ? member.uid : member;
    const displayName = typeof member === 'object' ? (member.displayName || 'Üye') : 'Üye';
    const isOwner = uid === currentCommunityData?.ownerUid;
    const isCurrentUser = uid === currentUser?.uid;
    const roleLabel = isOwner ? 'Yönetici' : isCurrentUser ? 'Sen' : 'Üye';
    const roleText = isOwner ? 'Topluluğun kurucusu' : isCurrentUser ? 'Bu topluluğun üyesisin' : 'Katılan üye';
    const badgeStyle = isOwner
      ? 'background:rgba(99,102,241,0.14); color:var(--primary);'
      : isCurrentUser
        ? 'background:rgba(16,185,129,0.16); color:#10b981;'
        : 'background:rgba(255,255,255,0.06); color:var(--text-secondary);';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid rgba(99,102,241,0.12); border-radius:16px; background:rgba(255,255,255,0.05); box-shadow:0 6px 16px rgba(15,23,42,0.04);">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, var(--primary), #818cf8); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; flex-shrink:0;">
            ${displayName.charAt(0).toUpperCase()}
          </div>
          <div style="min-width:0;">
            <div style="font-weight:700; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(displayName)}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(roleText)}</div>
          </div>
        </div>
        <span style="padding:4px 8px; border-radius:999px; font-size:0.75rem; font-weight:700; ${badgeStyle}">${escapeHtml(roleLabel)}</span>
      </div>
    `;
  }).join('');

  membersList.innerHTML = memberItems;
}

function toggleCommunityMembersView(communityId) {
  const section = document.getElementById('communityMembersSection');
  if (!section) return;

  const isVisible = section.style.display === 'block';
  section.style.display = isVisible ? 'none' : 'block';

  if (!isVisible && communityId) {
    const data = currentCommunityData || {};
    const memberUids = Array.isArray(data.members)
      ? data.members.map((member) => typeof member === 'object' ? member : { uid: member, displayName: 'Üye' })
      : [];
    renderCommunityMembersList(memberUids);
  }
}

async function inviteUserToCommunity(communityRef, communityData, targetUid) {
  if (!targetUid || targetUid === currentUser?.uid) {
    return { success: false, message: 'Kendinizi davet edemezsiniz.' };
  }

  const memberUids = getCommunityMemberUids(communityData);
  const invitedUids = getCommunityInvitedUids(communityData);
  if (memberUids.includes(targetUid) || invitedUids.includes(targetUid)) {
    return { success: false, message: 'Bu kullanıcı zaten davet edilmiş ya da topluluğa üye.' };
  }

  await updateDoc(communityRef, {
    invitedUsers: arrayUnion(targetUid)
  });

  const inviterName = currentUser?.displayName || currentUser?.email || 'Bir kullanıcı';
  if (typeof window.sendNotification === 'function') {
    await window.sendNotification(targetUid, 'community_invite', inviterName, {
      title: 'Topluluk daveti',
      message: `${inviterName} sizi "${communityData.name || 'Topluluk'}" topluluğuna davet etti.`,
      communityId: communityRef.id,
      communityName: communityData.name || 'Topluluk',
      fromUid: currentUser?.uid,
      fromName: inviterName,
      fromUsername: currentUser?.displayName || currentUser?.email || '',
      read: false
    });
  } else {
    const targetUserRef = doc(db, 'users', targetUid);
    const targetUserSnap = await getDoc(targetUserRef);
    const existingNotifications = Array.isArray(targetUserSnap.data()?.notifications) ? targetUserSnap.data().notifications : [];
    const inviteNotification = {
      type: 'community_invite',
      title: 'Topluluk daveti',
      message: `${inviterName} sizi "${communityData.name || 'Topluluk'}" topluluğuna davet etti.`,
      communityId: communityRef.id,
      communityName: communityData.name || 'Topluluk',
      fromUid: currentUser?.uid,
      fromName: inviterName,
      fromUsername: currentUser?.displayName || currentUser?.email || '',
      timestamp: Date.now(),
      read: false
    };
    await setDoc(targetUserRef, {
      notifications: [...existingNotifications, inviteNotification]
    }, { merge: true });
  }

  return { success: true, message: 'Davet gönderildi.' };
}

async function retractCommunityInvite(communityRef, communityData, targetUid) {
  if (!targetUid || !currentUser?.uid) {
    return { success: false, message: 'Davet geri alınamadı.' };
  }

  const invitedUids = getCommunityInvitedUids(communityData);
  if (!invitedUids.includes(targetUid)) {
    return { success: false, message: 'Bu davet zaten bulunmuyor.' };
  }

  await updateDoc(communityRef, {
    invitedUsers: arrayRemove(targetUid)
  });

  const targetUserRef = doc(db, 'users', targetUid);
  const targetUserSnap = await getDoc(targetUserRef);
  const notifications = Array.isArray(targetUserSnap.data()?.notifications) ? targetUserSnap.data().notifications : [];
  const updatedNotifications = notifications.filter((notification) => !(notification.type === 'community_invite' && notification.communityId === communityRef.id && notification.fromUid === currentUser.uid));
  await updateDoc(targetUserRef, { notifications: updatedNotifications });

  return { success: true, message: 'Davet geri alındı.' };
}

async function openCommunityInvitePrompt(communityId) {
  if (!communityId || !currentUser) return;

  try {
    const communityRef = doc(communitiesCollection, communityId);
    const communitySnap = await getDoc(communityRef);
    if (!communitySnap.exists()) {
      alert('Bu topluluk bulunamadı.');
      return;
    }

    const communityData = communitySnap.data();
    const memberUids = getCommunityMemberUids(communityData);
    const isOwner = communityData.ownerUid === currentUser.uid;
    const isMember = memberUids.includes(currentUser.uid);
    if (!isOwner && !isMember) {
      alert('Yalnızca topluluk sahibi veya üyesi davet edebilir.');
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(255,255,255,0.96); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });

    const modal = document.createElement('div');
    modal.style.cssText = 'width:min(560px, 100%); max-height:85vh; overflow:auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:24px; box-shadow:0 24px 60px rgba(15, 23, 42, 0.12); padding:20px; color:#111827; backdrop-filter:blur(16px);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px;';
    header.innerHTML = `
      <div>
        <div style="font-size:1.1rem; font-weight:800;">Topluluğa davet et</div>
        <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">Arkadaşlarından seç veya arkadaş olmayan bir kullanıcıyı davet et.</div>
      </div>
      <button type="button" id="communityInviteCloseBtn" style="border:none; width:38px; height:38px; border-radius:50%; background:#f3f4f6; color:#111827; cursor:pointer; font-size:1rem;">✕</button>
    `;

    const searchBox = document.createElement('input');
    searchBox.id = 'communityInviteSearch';
    searchBox.placeholder = 'Arkadaş ara...';
    searchBox.style.cssText = 'width:100%; box-sizing:border-box; border:1px solid #d1d5db; border-radius:999px; padding:10px 12px; margin-bottom:12px; background:#f9fafb; color:#111827;';

    const friendsList = document.createElement('div');
    friendsList.id = 'communityInviteFriendsList';
    friendsList.style.cssText = 'display:grid; gap:8px; max-height:260px; overflow:auto; margin-bottom:12px;';

    const manualSection = document.createElement('div');
    manualSection.style.cssText = 'border-top:1px solid #e5e7eb; padding-top:12px;';
    manualSection.innerHTML = `
      <div style="font-size:0.9rem; font-weight:700; margin-bottom:8px;">Arkadaş olmayanı davet et</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <input id="communityInviteIdentifier" placeholder="Kullanıcı adı veya e-posta" style="flex:1; min-width:220px; box-sizing:border-box; border:1px solid #d1d5db; border-radius:999px; padding:10px 12px; background:#f9fafb; color:#111827;" />
        <button type="button" id="communityInviteManualBtn" style="padding:10px 14px; border:none; border-radius:999px; background:linear-gradient(135deg, var(--primary), #818cf8); color:white; font-weight:700; cursor:pointer;">Davet Et</button>
      </div>
    `;

    modal.appendChild(header);
    modal.appendChild(searchBox);
    modal.appendChild(friendsList);
    modal.appendChild(manualSection);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('communityInviteCloseBtn');
    closeBtn?.addEventListener('click', () => overlay.remove());

    let inviteCommunityData = { ...communityData };
    const meSnap = await getDoc(doc(db, 'users', currentUser.uid));
    const currentUserData = meSnap.exists() ? meSnap.data() : {};
    const friendUids = Array.isArray(currentUserData.friends) ? currentUserData.friends : [];
    const friendProfiles = [];

    for (const friendUid of friendUids) {
      if (!friendUid) continue;
      const friendSnap = await getDoc(doc(db, 'users', friendUid));
      if (friendSnap.exists()) {
        const friendData = friendSnap.data();
        friendProfiles.push({ uid: friendSnap.id, displayName: friendData.displayName || friendData.username || friendData.email || 'Kullanıcı', username: friendData.username || '', email: friendData.email || '' });
      }
    }

    const renderFriends = () => {
      const term = searchBox.value.trim().toLowerCase();
      const memberUids = getCommunityMemberUids(inviteCommunityData);
      const invitedUids = getCommunityInvitedUids(inviteCommunityData);
      const filteredFriends = friendProfiles.filter((friend) => {
        const haystack = `${friend.displayName} ${friend.username} ${friend.email}`.toLowerCase();
        return haystack.includes(term);
      });

      if (!filteredFriends.length) {
        friendsList.innerHTML = '<div style="padding:12px; border:1px dashed #d1d5db; border-radius:16px; color:#6b7280;">Henüz arkadaşın yok veya arama sonucu boş.</div>';
        return;
      }

      friendsList.innerHTML = filteredFriends.map((friend) => {
        const isMember = memberUids.includes(friend.uid);
        const isInvited = invitedUids.includes(friend.uid);
        const disabled = isMember;
        const label = isMember ? 'Üye' : isInvited ? 'Geri al' : 'Davet et';
        const background = isMember ? '#f3f4f6' : isInvited ? '#fef2f2' : '#eef2ff';
        const textColor = isMember ? '#6b7280' : isInvited ? '#dc2626' : '#4338ca';
        return `
          <button type="button" class="community-invite-friend-btn" data-uid="${friend.uid}" ${disabled ? 'disabled' : ''} style="display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%; padding:10px 12px; border:1px solid ${isInvited ? '#fecaca' : '#e5e7eb'}; border-radius:16px; background:${background}; color:#111827; cursor:${disabled ? 'not-allowed' : 'pointer'}; text-align:left;">
            <div>
              <div style="font-weight:700;">${escapeHtml(friend.displayName)}</div>
              <div style="font-size:0.78rem; color:#6b7280;">${escapeHtml(friend.username || friend.email || '')}</div>
            </div>
            <span style="font-size:0.8rem; font-weight:700; color:${textColor};">${escapeHtml(label)}</span>
          </button>
        `;
      }).join('');

      friendsList.querySelectorAll('.community-invite-friend-btn').forEach((button) => {
        button.addEventListener('click', async () => {
          const uid = button.getAttribute('data-uid');
          const memberUidsNow = getCommunityMemberUids(inviteCommunityData);
          const invitedUidsNow = getCommunityInvitedUids(inviteCommunityData);
          const isInvitedNow = invitedUidsNow.includes(uid);
          const isMemberNow = memberUidsNow.includes(uid);
          if (isMemberNow) {
            return;
          }
          const result = isInvitedNow
            ? await retractCommunityInvite(communityRef, inviteCommunityData, uid)
            : await inviteUserToCommunity(communityRef, inviteCommunityData, uid);
          if (result.success) {
            if (isInvitedNow) {
              inviteCommunityData = {
                ...inviteCommunityData,
                invitedUsers: Array.isArray(inviteCommunityData.invitedUsers) ? inviteCommunityData.invitedUsers.filter((value) => value !== uid) : []
              };
            } else {
              inviteCommunityData = {
                ...inviteCommunityData,
                invitedUsers: Array.isArray(inviteCommunityData.invitedUsers) ? [...new Set([...(inviteCommunityData.invitedUsers || []), uid])] : [uid]
              };
            }
            renderFriends();
            if (currentCommunityId === communityId) {
              await openCommunityDetail(communityId);
            }
          } else {
            alert(result.message);
          }
        });
      });
    };

    renderFriends();
    searchBox.addEventListener('input', renderFriends);

    const manualBtn = document.getElementById('communityInviteManualBtn');
    const manualInput = document.getElementById('communityInviteIdentifier');
    manualBtn?.addEventListener('click', async () => {
      const identifier = manualInput?.value.trim();
      if (!identifier) {
        alert('Lütfen bir kullanıcı adı veya e-posta girin.');
        return;
      }

      const normalizedIdentifier = identifier.toLowerCase();
      const userQuery = query(collection(db, 'users'), where('username', '==', normalizedIdentifier));
      const userSnap = await getDocs(userQuery);
      let targetUserDoc = !userSnap.empty ? userSnap.docs[0] : null;

      if (!targetUserDoc) {
        const emailQuery = query(collection(db, 'users'), where('email', '==', normalizedIdentifier));
        const emailSnap = await getDocs(emailQuery);
        targetUserDoc = !emailSnap.empty ? emailSnap.docs[0] : null;
      }

      if (!targetUserDoc) {
        alert('Bu kullanıcı bulunamadı.');
        return;
      }

      const result = await inviteUserToCommunity(communityRef, inviteCommunityData, targetUserDoc.id);
      if (result.success) {
        inviteCommunityData = {
          ...inviteCommunityData,
          invitedUsers: Array.isArray(inviteCommunityData.invitedUsers) ? [...new Set([...(inviteCommunityData.invitedUsers || []), targetUserDoc.id])] : [targetUserDoc.id]
        };
        overlay.remove();
        alert(result.message);
        if (currentCommunityId === communityId) {
          await openCommunityDetail(communityId);
        }
      } else {
        alert(result.message);
      }
    });
  } catch (error) {
    console.error('Davet gönderilirken hata:', error);
    alert('Davet gönderilemedi.');
  }
}

async function handleCommunityInviteResponse(communityId, accept = true) {
  if (!currentUser || !communityId) return;

  try {
    const communityRef = doc(communitiesCollection, communityId);
    const communitySnap = await getDoc(communityRef);
    if (!communitySnap.exists()) return;

    if (accept) {
      const memberData = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email
      };
      await updateDoc(communityRef, {
        members: arrayUnion(memberData),
        invitedUsers: arrayRemove(currentUser.uid)
      });
      alert('Topluluğa katılma daveti kabul edildi.');
    } else {
      await updateDoc(communityRef, {
        invitedUsers: arrayRemove(currentUser.uid)
      });
      alert('Topluluk daveti reddedildi.');
    }

    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    const notifications = Array.isArray(userSnap.data()?.notifications) ? userSnap.data().notifications : [];
    const updatedNotifications = notifications.filter((notification) => !(notification.type === 'community_invite' && notification.communityId === communityId));
    await updateDoc(userRef, {
      notifications: updatedNotifications
    });

    window.dispatchEvent(new Event('notifications:changed'));

    if (currentCommunityId === communityId) {
      await openCommunityDetail(communityId);
    }
  } catch (error) {
    console.error('Topluluk daveti yanıtlanırken hata:', error);
  }
}

window.acceptCommunityInvite = async function(communityId) {
  await handleCommunityInviteResponse(communityId, true);
};

window.rejectCommunityInvite = async function(communityId) {
  await handleCommunityInviteResponse(communityId, false);
};

window.openCommunityInvitePrompt = openCommunityInvitePrompt;

function openEditCommunityModal(communityId, data) {
  if (!communityId || !data) return;
  currentCommunityId = communityId;
  currentCommunityData = data;
  const modal = document.getElementById('editCommunityModal');
  if (!modal) return;
  document.getElementById('editCommunityName').value = data.name || '';
  document.getElementById('editCommunityCategory').value = data.category || '';
  document.getElementById('editCommunityDescription').value = data.description || '';
  modal.style.display = 'flex';
}

function closeEditCommunityModal() {
  const modal = document.getElementById('editCommunityModal');
  if (modal) modal.style.display = 'none';
  currentCommunityId = null;
  currentCommunityData = null;
}

async function saveEditedCommunity() {
  if (!currentCommunityId || !currentUser) return;
  const name = document.getElementById('editCommunityName').value.trim();
  const category = document.getElementById('editCommunityCategory').value;
  const description = document.getElementById('editCommunityDescription').value.trim();

  if (!name || !category || !description) {
    alert('Lütfen tüm alanları doldurunuz.');
    return;
  }

  try {
    await updateDoc(doc(communitiesCollection, currentCommunityId), {
      name,
      category,
      description,
      updatedAt: serverTimestamp()
    });
    closeEditCommunityModal();
    if (currentCommunityId) {
      await openCommunityDetail(currentCommunityId);
    }
  } catch (error) {
    console.error('Topluluk düzenlenirken hata:', error);
    alert('Topluluk düzenlenemedi. Lütfen tekrar deneyin.');
  }
}

// Yeni topluluk oluştur
async function createNewCommunity() {
  if (!currentUser) {
    alert('Lütfen önce giriş yapınız.');
    return;
  }

  const name = document.getElementById('communityName').value.trim();
  const category = document.getElementById('communityCategory').value;
  const description = document.getElementById('communityDescription').value.trim();
  const isPrivate = document.getElementById('communityPrivate').checked;

  if (!name || !category || !description) {
    alert('Lütfen tüm alanları doldurunuz.');
    return;
  }

  try {
    await addDoc(communitiesCollection, {
      name: name,
      category: category,
      description: description,
      isPrivate: isPrivate,
      ownerUid: currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email,
      invitedUsers: [],
      members: [
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.email
        }
      ],
      postCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    alert('Topluluk başarıyla oluşturuldu!');
    closeCommunityModal();
  } catch (error) {
    console.error('Topluluk oluşturulurken hata:', error);
    alert('Topluluk oluşturulamadı. Lütfen tekrar deneyin.');
  }
}

// Modal işlemleri
window.openCommunityModal = function() {
  const modal = document.getElementById('createCommunityModal');
  if (modal) modal.style.display = 'flex';
};

window.closeCommunityModal = function() {
  const modal = document.getElementById('createCommunityModal');
  if (modal) modal.style.display = 'none';
  document.getElementById('communityName').value = '';
  document.getElementById('communityCategory').value = '';
  document.getElementById('communityDescription').value = '';
  document.getElementById('communityPrivate').checked = false;
};

window.showListView = showListView;
window.openCommunityDetail = openCommunityDetail;
window.openEditCommunityModal = openEditCommunityModal;
window.openEditCommunityModalFromDetail = function(communityId) {
  openEditCommunityModal(communityId, currentCommunityData);
};
window.closeEditCommunityModal = closeEditCommunityModal;
window.saveEditedCommunity = saveEditedCommunity;
window.createNewCommunity = createNewCommunity;
window.deleteCommunity = deleteCommunity;
window.toggleCommunityMembership = toggleCommunityMembership;
window.createCommunityPost = createCommunityPost;
window.openCommunityGroupChat = openCommunityGroupChat;
window.toggleCommunityMembersView = toggleCommunityMembersView;

// Arama ve Filtreleme
function setupSearchAndFilter() {
  const searchInput = document.getElementById('searchCommunities');
  const categoryFilter = document.getElementById('categoriesFilter');
  const createBtn = document.getElementById('createCommunityBtn');

  if (searchInput) searchInput.addEventListener('input', filterCommunities);
  if (categoryFilter) categoryFilter.addEventListener('change', filterCommunities);
  if (createBtn) createBtn.addEventListener('click', window.openCommunityModal);
}

function filterCommunities() {
  const searchTerm = (document.getElementById('searchCommunities')?.value || '').toLowerCase();
  const selectedCategory = (document.getElementById('categoriesFilter')?.value || '').toLowerCase();
  const cards = document.querySelectorAll('.community-card');
  let visibleCount = 0;

  cards.forEach(card => {
    const titleEl = card.querySelector('h3');
    const descEl = card.querySelector('p');
    const categoryEl = card.querySelector('span');

    const title = titleEl ? titleEl.textContent.toLowerCase() : '';
    const description = descEl ? descEl.textContent.toLowerCase() : '';
    const cardCategory = categoryEl ? categoryEl.textContent.toLowerCase() : '';

    const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
    const matchesCategory = !selectedCategory || cardCategory.includes(selectedCategory);

    if (matchesSearch && matchesCategory) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  const emptyState = document.getElementById('emptyState');
  if (emptyState) {
    emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
  }
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  console.log('Community.js yüklendi');
  setupSearchAndFilter();
  const initialCommunityId = new URLSearchParams(window.location.search).get('community');
  if (initialCommunityId) {
    openCommunityDetail(initialCommunityId);
  } else {
    showListView();
  }
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(window.location.search).get('community');
    if (id) {
      openCommunityDetail(id);
    } else {
      showListView();
    }
  });
});
