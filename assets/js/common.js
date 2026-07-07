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
    container.innerHTML = '<div class="top-communities-empty">Henüz topluluk yok</div>';
    return;
  }

  container.innerHTML = `
    <div class="top-communities-head">
      <div class="top-communities-kicker">Topluluk Sıralaması</div>
      <div class="top-communities-note">Üye sayısına göre</div>
    </div>
    <div class="top-communities-list">
      ${topCommunities.map((community, index) => {
        const memberCount = getCommunityMemberCount(community);
        const rank = index + 1;
        const category = getCommunityCategory(community);
        const description = getCommunityDescription(community);
        const postCount = community?.postCount || 0;
        return `
          <a href="topluluk.html?community=${encodeURIComponent(community.id)}" class="top-community-card top-community-rank-${rank}">
            <div class="top-community-row">
              <div class="top-community-rank">#${rank}</div>
              <div class="top-community-main">
                <div class="top-community-name">${getCommunityDisplayName(community)}</div>
                <div class="top-community-category">${category}</div>
              </div>
              <i class="fa-solid fa-chevron-right top-community-arrow" aria-hidden="true"></i>
            </div>
            <div class="top-community-desc">${description}</div>
            <div class="top-community-stats">
              <span><i class="fa-solid fa-users"></i> ${memberCount} üye</span>
              <span><i class="fa-solid fa-comments"></i> ${postCount} gönderi</span>
            </div>
          </a>
        `;
      }).join('')}
    </div>
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
