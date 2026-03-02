// Basic service worker stub
// Prevents 404 when registering. Add caching logic as needed.
self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

// Intercept fetch requests (optional, currently passthrough)
self.addEventListener('fetch', function(event) {
    const requestUrl = new URL(event.request.url);

    // explicitly bypass any chat attachment requests (these are stored on Firebase storage)
    if (requestUrl.pathname.includes('/chat_attachments') ||
        requestUrl.pathname.includes('chat_attachments%2F')) {
        // do not intercept or cache these binary files; allow normal loading
        return;
    }

    // Ignore cross-origin requests to prevent CORB warnings and unintended handling.
    if (requestUrl.origin !== self.location.origin) {
        // let browser handle it normally
        return;
    }

    // If you eventually add caching logic, handle same-origin requests below
    // event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
