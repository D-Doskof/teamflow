// Minimal service worker — its only job is to satisfy the browser's installability
// requirement (a registered SW with a fetch handler). No offline caching: every
// request just passes straight through to the network, so this never masks a stale
// build or serves outdated data in a real-time collaborative app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
