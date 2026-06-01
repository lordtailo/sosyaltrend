const CACHE_NAME = 'sosyaltrend-pwa-v2';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/partials/left-aside.html',
  '/partials/topbar.html',
  '/partials/right-aside.html',
  '/partials/header.html',
  '/partials/footer.html',
  '/assets/css/style.css',
  '/assets/css/chat-widget.css?v=20260240',
  '/assets/fontawesome/css/all.min.css',
  '/assets/img/strendsaydamv2.png',
  '/assets/img/strendsaydamv2.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
    ))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.includes('/chat_attachments') || requestUrl.pathname.includes('chat_attachments%2F')) {
    return;
  }

  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse));
      }
      return networkResponse;
    }).catch(() => caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match('/index.html')))
  );
});
