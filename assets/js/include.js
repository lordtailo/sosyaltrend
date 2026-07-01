const TOP_COMMUNITIES_WIDGET_LIMIT = 3;

function getCommunityMemberCount(communityData) {
  if (!communityData || !Array.isArray(communityData.members)) return 0;
  return communityData.members.filter((member) => Boolean(typeof member === 'object' ? member.uid : member)).length;
}

function getCommunityDisplayName(communityData) {
  return communityData?.name || 'Topluluk';
}

function getCommunityCategory(communityData) {
  const category = communityData?.category;
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

function getCommunityDescription(communityData) {
  const description = (communityData?.description || '').toString().trim();
  return description.length > 70 ? `${description.slice(0, 67)}...` : description || 'Aktif topluluk';
}

function renderTopCommunitiesWidget(communities = []) {
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

function safelyInjectIncludedScript(sourceScript, targetContainer) {
  if (!sourceScript || !sourceScript.src) return false;

  try {
    const scriptTag = document.createElement('script');
    scriptTag.src = sourceScript.src;
    if (sourceScript.type) scriptTag.type = sourceScript.type;
    if (sourceScript.async) scriptTag.async = true;
    if (sourceScript.defer) scriptTag.defer = true;
    scriptTag.dataset.includeInjected = 'true';
    targetContainer.appendChild(scriptTag);
    return true;
  } catch (err) {
    console.warn('Included external script could not be injected safely:', err);
    return false;
  }
}

async function loadPlaceholder(placeholderId, partialPath) {
  const placeholder = document.getElementById(placeholderId);
  if (!placeholder) return;
  
  try {
    const res = await fetch(partialPath);
    if (!res.ok) throw new Error(`Failed to load ${partialPath}: ${res.status}`);
    const buffer = await res.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buffer);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    
    const safeHtml = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    placeholder.innerHTML = safeHtml;
    
    const scripts = Array.from(placeholder.querySelectorAll('script'));
    const targetContainer = document.body || document.documentElement;
    scripts.forEach((s) => {
      safelyInjectIncludedScript(s, targetContainer);
      s.remove();
    });
  } catch (err) {
    console.error('Placeholder load error:', partialPath, err);
  }
}

async function runIncludes() {
  const includes = Array.from(document.querySelectorAll('[data-include]'));
  await Promise.all(includes.map(async (el) => {
    const url = el.getAttribute('data-include');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      const buffer = await res.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      const safeHtml = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      el.innerHTML = safeHtml;

      const scripts = Array.from(el.querySelectorAll('script'));
      const targetContainer = document.body || document.documentElement;
      scripts.forEach((s) => {
        safelyInjectIncludedScript(s, targetContainer);
        s.remove();
      });
    } catch (err) {
      console.error('Include error:', url, err);
    }
  }));

  // Load header and footer placeholders
  await Promise.all([
    loadPlaceholder('header-placeholder', 'partials/header.html'),
    loadPlaceholder('footer-placeholder', 'partials/footer.html')
  ]);

  // signal that all includes have been processed so other scripts can act
  document.dispatchEvent(new Event('includesLoaded'));
  // mark globally so late listeners can still act
  window.includesLoaded = true;
}

window.addEventListener('topCommunitiesUpdated', (event) => {
  renderTopCommunitiesWidget(event.detail || []);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    runIncludes();
  });
} else {
  runIncludes();
}
