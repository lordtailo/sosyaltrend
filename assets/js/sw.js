const CACHE_NAME = 'sosyaltrend-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Yükleme sırasında dosyaları önbelleğe al
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// İnternet olmasa da önbellekten çalıştır
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
