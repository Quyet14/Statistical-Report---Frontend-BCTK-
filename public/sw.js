// Only these public, account-independent assets enter CacheStorage.
const CACHE_NAME = "careops-offline-shell-v2";
const OFFLINE_URL = "/offline.html";
const SHELL = [
  OFFLINE_URL,
  "/offline.css",
  "/offline-app.js",
  "/offline-vault.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of SHELL) {
        const response = await fetch(url, {
          cache: "reload",
          credentials: "omit",
        });
        if (!response.ok || response.redirected)
          throw Error("Offline shell unavailable");
        await cache.put(url, response);
      }
      await self.skipWaiting();
    }),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("careops-offline-shell-") && key !== CACHE_NAME)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (SHELL.includes(url.pathname) && !url.search) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then(
          async (cache) => (await cache.match(url.pathname)) || fetch(request),
        ),
    );
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match(OFFLINE_URL)) || Response.error(),
      ),
    );
  }
});
