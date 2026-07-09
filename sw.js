// Minimal service worker to satisfy registration; no caching behavior added.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Intentionally no fetch handler so network requests behave normally.
