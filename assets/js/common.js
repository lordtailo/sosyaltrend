import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const TOP_COMMUNITIES_WIDGET_LIMIT = 3;

function getCommunityMemberCount(community) {
  if (!community || !Array.isArray(community.members)) return 0;
  return community.members.filter((member) => Boolean(typeof member === 'object' ? member.uid : member)).length;
}

function getCommunityDisplayName(community) {
  return community?.name || 'Topluluk';
}

function getCommunityCategory(community) {
  const category = community?.category;
  const labels = {
    teknoloji: 'Teknoloji',
    sanat: 'Sanat',
    spor: 'Spor',
    muzik: 'Müzik',
    egitim: 'Eğitim',
    oyunlar: 'Oyunlar',
    yemek: 'Yemek',
    seyahat: 'Seyahat',
    diger: 'Diğer'
  };
  return labels[category] || 'Genel';
}

function getCommunityDescription(community) {
  const description = (community?.description || '').toString().trim();
  return description.length > 70 ? `${description.slice(0, 67)}...` : description || 'Aktif topluluk';
}

function renderRecentCommunities(communities = []) {
  const container = document.getElementById('recentCommunitiesWidgetList');
  if (!container) return;

  const topCommunities = [...communities]
    .filter((community) => !community?.isPrivate)
    .sort((a, b) => getCommunityMemberCount(b) - getCommunityMemberCount(a))
    .slice(0, TOP_COMMUNITIES_WIDGET_LIMIT);

  if (!topCommunities.length) {
    container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:12px 6px; border:1px dashed var(--border); border-radius:14px;">Henüz topluluk yok</div>';
    return;
  }

  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; padding:0 2px;">
      <div style="font-size:0.76rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--primary);">Popüler Topluluklar</div>
      <div style="font-size:0.72rem; color:var(--text-muted);">Üye sayısına göre</div>
    </div>
    ${topCommunities.map((community, index) => {
      const memberCount = getCommunityMemberCount(community);
      const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '●';
      const accent = index === 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(255,255,255,0.04))' : index === 1 ? 'linear-gradient(135deg, rgba(148,163,184,0.16), rgba(255,255,255,0.04))' : index === 2 ? 'linear-gradient(135deg, rgba(234,179,8,0.16), rgba(255,255,255,0.04))' : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(255,255,255,0.04))';
      const category = getCommunityCategory(community);
      const description = getCommunityDescription(community);
      const postCount = community?.postCount || 0;
      return `
        <a href="topluluk.html?community=${encodeURIComponent(community.id)}" style="display:block; padding:12px 12px 10px; border:1px solid var(--border); border-radius:16px; background:${accent}; color:var(--text-main); text-decoration:none; box-shadow:0 8px 20px rgba(15,23,42,0.05); transition:transform 0.2s ease, box-shadow 0.2s ease; margin-bottom:8px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              <span style="font-size:0.95rem; width:20px; text-align:center;">${badge}</span>
              <div style="min-width:0;">
                <div style="font-size:0.82rem; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${getCommunityDisplayName(community)}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${category}</div>
              </div>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square" style="color:var(--primary); flex-shrink:0;"></i>
          </div>
          <div style="font-size:0.74rem; color:var(--text-muted); line-height:1.4; margin-bottom:8px;">${description}</div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:0.72rem; color:var(--text-muted);">
            <span><i class="fa-solid fa-users" style="margin-right:4px; color:var(--primary);"></i>${memberCount} üye</span>
            <span><i class="fa-solid fa-comments" style="margin-right:4px; color:var(--primary);"></i>${postCount} gönderi</span>
          </div>
        </a>
      `;
    }).join('')}
  `;
}

function loadRecentCommunitiesWidget() {
  const container = document.getElementById('recentCommunitiesWidgetList');
  if (!container) return;

  try {
    const communitiesCollection = collection(db, 'topluluklar');
    const recentQuery = query(communitiesCollection, orderBy('createdAt', 'desc'), limit(5));

    onSnapshot(recentQuery, (snapshot) => {
      const communities = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(comm => !comm.isPrivate);
      renderRecentCommunities(communities);
    }, (error) => {
      console.error('Son Açılan Topluluklar widget yükleme hatası:', error);
    });
  } catch (error) {
    console.error('Son Açılan Topluluklar widget başlatma hatası:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadRecentCommunitiesWidget);
} else {
  loadRecentCommunitiesWidget();
}
