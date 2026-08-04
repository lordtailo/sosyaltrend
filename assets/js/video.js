const STORAGE_KEY = 'st_video_local_v2';
const state = {
  filter: 'all',
  search: '',
  selectedVideo: null,
  videos: []
};

const starterVideos = []; 

const categories = {
  genel: 'Genel',
  teknoloji: 'Teknoloji',
  haber: 'Haber',
  müzik: 'Müzik',
  eğitim: 'Eğitim',
  eğlence: 'Eğlence'
};

function $(id) {
  return document.getElementById(id);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'Bilinmiyor';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function getStoredVideos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredVideos(videos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch {
    // ignore
  }
}

function extractUrlFromText(text) {
  const value = String(text || '').trim();
  const markdownMatch = value.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
  if (markdownMatch) return markdownMatch[1];
  const urlMatch = value.match(/https?:\/\/[^\s]+/i);
  return urlMatch ? urlMatch[0].replace(/[.,]+$/, '') : value;
}

function detectVideoType(url) {
  const normalized = extractUrlFromText(url);
  if (/(?:music\.)?youtube(?:-nocookie)?\.com|youtu\.be/i.test(normalized)) return 'youtube';
  if (/vimeo\.com/i.test(normalized)) return 'vimeo';
  return null;
}

function getYouTubeId(url) {
  const normalized = extractUrlFromText(url);
  const idPatterns = [
    /(?:\?v=|&v=)([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /music\.youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/shorts\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/v\/([\w-]{11})/
  ];
  for (const pattern of idPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) return match[1];
  }
  try {
    const parsed = new URL(normalized);
    return parsed.searchParams.get('v');
  } catch {
    return null;
  }
}

function getVideoEmbedUrl(video) {
  if (!video) return '';
  if (video.type === 'youtube') {
    const videoId = getYouTubeId(video.url);
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1` : '';
  }
  if (video.type === 'vimeo') {
    const match = video.url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : '';
  }
  return '';
}

function getCategoryLabel(key) {
  return categories[key] || 'Genel';
}

function prepareVideos() {
  const localVideos = getStoredVideos().map(video => ({ ...video, type: detectVideoType(video.url) || 'youtube' }));
  const all = [...starterVideos, ...localVideos];
  const unique = [];
  const seen = new Set();
  all.forEach(video => {
    const key = video.id || `${video.url}-${video.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(video);
    }
  });
  state.videos = unique.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function updateCounters() {
  const total = state.videos.length;
  const mine = state.videos.filter(video => video.source === 'local').length;
  const youtube = state.videos.filter(video => video.type === 'youtube').length;
  const vimeo = state.videos.filter(video => video.type === 'vimeo').length;

  const totalEl = $('heroTotalVideos');
  const mineEl = $('heroMyVideosCount');
  const youtubeEl = $('heroYoutubeCount');
  const vimeoEl = $('heroVimeoCount');

  if (totalEl) totalEl.textContent = `${total}`;
  if (mineEl) mineEl.textContent = `${mine}`;
  if (youtubeEl) youtubeEl.textContent = `${youtube}`;
  if (vimeoEl) vimeoEl.textContent = `${vimeo}`;
}

function buildVideoCard(video) {
  const isLocal = video.source === 'local';
  const badges = [`<span class="video-card__badge">${escapeHTML(getCategoryLabel(video.category))}</span>`];
  if (video.type) badges.push(`<span class="video-card__badge">${escapeHTML(video.type.toUpperCase())}</span>`);
  if (isLocal) badges.push('<span class="video-card__badge">Eklenmiş</span>');

  const youtubeId = video.type === 'youtube' ? ((video.url.match(/[?&]v=([\w-]{11})/) || video.url.match(/youtu\.be\/([\w-]{11})/)) || [])[1] : null;
  const thumbnail = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/0.jpg` : 'assets/img/video-placeholder.png';

  return `
    <article class="video-card" role="button" tabindex="0" onclick="openVideoModal('${video.id}')" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); openVideoModal('${video.id}'); }">
      <div class="video-thumbnail">
        <img src="${thumbnail}" alt="${escapeHTML(video.title)}">
        ${isLocal ? `<button class="video-card__delete" data-video-id="${video.id}" type="button" aria-label="Videoyu sil"><i class="fa-solid fa-trash"></i></button>` : ''}
        <div class="video-play-icon"><i class="fa-solid fa-play"></i></div>
      </div>
      <div class="video-card__content">
        <div class="video-card__badges">${badges.join('')}</div>
        <h3 class="video-card__title">${escapeHTML(video.title)}</h3>
        <p class="video-card__description">${escapeHTML(video.desc || 'Açıklama eklenmemiş.')}</p>
        <div class="video-card__meta">
          <div class="video-card__meta-author">
            <img class="video-avatar" src="${video.avatar || 'assets/img/strendsaydamv2.png'}" alt="${escapeHTML(video.author)}">
            <span>${escapeHTML(video.author)}</span>
          </div>
          <span>${formatDate(video.time)}</span>
        </div>
      </div>
    </article>
  `;
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":"&#39;" })[char]);
}

function filterVideos() {
  const query = (state.search || '').trim().toLowerCase();
  return state.videos.filter(video => {
    const matchesFilter = state.filter === 'all' || (state.filter === 'mine' ? video.source === 'local' : video.category === state.filter);
    const matchesSearch = query === '' || [video.title, video.desc, video.author, video.category].some(text => String(text || '').toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });
}

function renderVideos() {
  const grid = $('videosGrid');
  const noVideos = $('noVideosMessage');
  const videos = filterVideos();
  const summary = $('videoSummaryText');
  const countText = videos.length === 1 ? '1 sonuç' : `${videos.length} sonuç`;

  summary.textContent = videos.length ? `${countText} bulundu` : 'Eşleşen içerik yok';
  $('videoResultsCount').textContent = countText;

  if (!videos.length) {
    grid.innerHTML = '';
    noVideos.style.display = 'grid';
    return;
  }

  noVideos.style.display = 'none';
  grid.innerHTML = videos.map(buildVideoCard).join('');

  grid.querySelectorAll('.video-card__delete').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const videoId = button.dataset.videoId;
      if (videoId) deleteVideo(videoId);
    });
  });
}

function openVideoModal(id) {
  const video = state.videos.find(item => item.id === id);
  if (!video) return;
  state.selectedVideo = video;
  $('modalVideoTitle').textContent = video.title;
  $('modalVideoAuthor').textContent = video.author;
  $('modalVideoDate').textContent = formatDate(video.time);
  $('modalVideoSource').textContent = video.source || (video.type === 'youtube' ? 'YouTube' : 'Vimeo');
  $('modalVideoDescription').textContent = video.desc || 'Açıklama yok.';
  const embedUrl = getVideoEmbedUrl(video);
  $('videoPlayerContainer').innerHTML = embedUrl ? `<iframe src="${embedUrl}" title="${escapeHTML(video.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen style="width:100%;height:100%;"></iframe>` : `<div style="display:grid;place-items:center;height:100%;color:var(--text-muted);padding:24px;text-align:center;">
      <p style="margin:0 0 12px;font-weight:700;">Video kullanılamıyor.</p>
      <p style="margin:0 0 16px;">Lütfen bağlantıyı kontrol edin veya videoyu dışarıda açın.</p>
      <button class="video-action-btn" type="button" onclick="window.open('${escapeHTML(video.url)}','_blank')">Videoyu YouTube'da aç</button>
    </div>`;
  const deleteButton = $('deleteVideoButton');
  if (deleteButton) {
    deleteButton.style.display = video.source === 'local' ? 'inline-flex' : 'none';
  }
  $('videoModal').classList.add('active');
  $('videoModal').setAttribute('aria-hidden', 'false');
}

function closeVideoModal() {
  $('videoModal').classList.remove('active');
  $('videoModal').setAttribute('aria-hidden', 'true');
  $('videoPlayerContainer').innerHTML = '';
}

function openVideoSource() {
  if (!state.selectedVideo) return;
  window.open(state.selectedVideo.url, '_blank');
}

function deleteVideo(id) {
  const stored = getStoredVideos().filter(video => video.id !== id);
  saveStoredVideos(stored);
  prepareVideos();
  renderVideos();
  if (state.selectedVideo && state.selectedVideo.id === id) {
    closeVideoModal();
  }
}

function scrollToSection(id) {
  const section = $(id);
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleAddPanel() {
  $('videoAddPanel').classList.toggle('active');
}

function resetFilters() {
  state.filter = 'all';
  state.search = '';
  $('videoSearch').value = '';
  document.querySelectorAll('#videoFilters .filter-btn').forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
  renderVideos();
}

function saveVideoFromForm() {
  const urlInput = $('videoAddUrl').value.trim();
  const url = extractUrlFromText(urlInput);
  const title = $('videoAddTitle').value.trim() || 'Yeni Video';
  const desc = $('videoAddDesc').value.trim();
  const category = $('videoAddCategory').value;
  const type = detectVideoType(url);
  if (!url || !type) {
    alert('Lütfen geçerli bir YouTube veya Vimeo bağlantısı girin.');
    return;
  }

  const video = {
    id: `local-${Date.now()}`,
    title,
    desc,
    category,
    author: 'Sen',
    avatar: 'assets/img/strendsaydamv2.png',
    time: new Date().toISOString(),
    url,
    type,
    source: 'local'
  };

  const stored = getStoredVideos();
  stored.unshift(video);
  saveStoredVideos(stored);
  prepareVideos();
  updateCounters();
  renderVideos();
  toggleAddPanel();
  $('videoAddForm').reset();
}

function bindEvents() {
  $('videoSearchButton').addEventListener('click', () => {
    state.search = $('videoSearch').value.trim();
    renderVideos();
  });

  $('clearVideoFilters').addEventListener('click', () => {
    resetFilters();
  });

  $('openVideoAddButton').addEventListener('click', () => toggleAddPanel());
  $('videoAddClose').addEventListener('click', () => toggleAddPanel());
  $('emptyAddButton').addEventListener('click', () => toggleAddPanel());
  $('videoCommentList') && $('videoCommentList').addEventListener('click', event => event.stopPropagation());
  $('videoModalClose').addEventListener('click', closeVideoModal);
  $('closeVideoModalButton').addEventListener('click', closeVideoModal);
  $('openVideoSourceButton').addEventListener('click', openVideoSource);
  $('videoAddForm').addEventListener('submit', event => {
    event.preventDefault();
    saveVideoFromForm();
  });

  document.querySelectorAll('#videoFilters .filter-btn').forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll('#videoFilters .filter-btn').forEach(btn => btn.classList.toggle('active', btn === button));
      renderVideos();
    });
  });

  $('videoSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      state.search = $('videoSearch').value.trim();
      renderVideos();
    }
  });

  $('deleteVideoButton').addEventListener('click', () => {
    if (state.selectedVideo) deleteVideo(state.selectedVideo.id);
  });
}

function initPage() {
  prepareVideos();
  updateCounters();
  renderVideos();
  bindEvents();
  window.openVideoModal = openVideoModal;
  window.closeVideoModal = closeVideoModal;
  window.openVideoSource = openVideoSource;
  window.deleteVideo = deleteVideo;
  window.scrollToSection = scrollToSection;
}

window.addEventListener('DOMContentLoaded', initPage);
