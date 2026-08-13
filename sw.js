const CACHE_NAME = "fqc-app-v24-event-operations";
const ASSETS = [
  "/assets/fqc-badge.png?v=24"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(async (keys) => {
        const isUpgrade = keys.some((key) => key.startsWith("fqc-app-") && key !== CACHE_NAME);
        await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
        await self.clients.claim();
        if (!isUpgrade) return;

        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.all(windowClients.map((client) => client.navigate(client.url)));
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
