self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      if ("caches" in self) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }

      await self.registration.unregister();
    })(),
  );
});
