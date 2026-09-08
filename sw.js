const CACHE_NAME = "fqc-app-v313-map-touch-selection-guard";
const ASSETS = [
  "/assets/fqc-app-icon-192.png?v=29"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(async (keys) => {
        await Promise.all(keys.filter((key) => key.startsWith("fqc-app-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
        await self.clients.claim();
        // Never force all open tabs to navigate on activation. The new version
        // takes effect on each window's next normal reload or explicit update.
      })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const contentType = response.headers.get("content-type") || "";
        if (response.ok && !contentType.includes("text/html")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
