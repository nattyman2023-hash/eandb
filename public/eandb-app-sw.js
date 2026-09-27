// Retired. This URL used to serve the service worker for the old installable
// booking/CRM app. Browsers that still have it registered fetch this file on their
// next visit; it clears the old caches, unregisters itself and reloads open tabs so
// they load the current marketing site from the network.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach((client) => client.navigate(client.url));
  })());
});
