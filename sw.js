const CACHE_NAME = "fqc-app-v341-public-shell";
const ASSETS = [
  "/assets/fqc-app-icon-192.png?v=29"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    // First-install requests loaded before this worker took control. Cache the
    // public shell and its build entry points now so the first offline reopen works.
    const shell = await fetch('/', { cache: 'reload' });
    if (!shell.ok) throw new Error('Public app shell unavailable');
    const html = await shell.clone().text();
    const assets = [...html.matchAll(/(?:src|href)=["'](\.?\/assets\/[^"']+)["']/g)].map(match => new URL(match[1], self.location.origin).href);
    await cache.addAll([...new Set(assets)]);
    await cache.put('/offline-shell', shell);
  })());
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
    event.respondWith(fetch(event.request, { cache: "no-store", signal: AbortSignal.timeout(4000) }).then(async response=>{
      // Vite serves the same public shell to everyone; account data arrives only
      // through authenticated APIs and is never put in this cache.
      if(response.ok && ['/', '/about','/events','/hackathon','/index.html'].includes(requestUrl.pathname)){
        const cache=await caches.open(CACHE_NAME);await cache.put('/offline-shell',response.clone());
      }
      return response;
    }).catch(async()=>await caches.match('/offline-shell') || new Response('Connect once to load FQC, then you can reopen it offline.',{status:503,headers:{'Content-Type':'text/plain'}})));
    return;
  }

  // Hashed bundles are immutable. Serving an installed copy first also avoids
  // stalling startup while an unreliable mobile connection times out.
  if (/\/assets\/(?:index-[^/]+\.(?:js|css)|manifest-[^/]+\.webmanifest)$/.test(requestUrl.pathname)) {
    event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request)));
    return;
  }

  // Offline storage is for public build assets only, never account/API responses.
  if (!requestUrl.pathname.startsWith("/assets/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const contentType = response.headers.get("content-type") || "";
        const cacheControl = response.headers.get("cache-control") || "";
        if (response.ok && !contentType.includes("text/html") && !/no-store|private/i.test(cacheControl)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => await caches.match(event.request, { ignoreVary: true }) || new Response("", { status: 503 }))
  );
});
