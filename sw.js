const CACHE = "ebb-pwa-v3";
const PREF_PATH = "__ebb-prefer-offline";

let preferMem = null;

function preferUrl() {
  return new URL(PREF_PATH, self.registration.scope).href;
}

function shouldHandle(url) {
  if (url.pathname.replace(/\/+$/, "").endsWith("/" + PREF_PATH) || url.pathname.endsWith(PREF_PATH)) return false;
  if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith("sw.js")) return false;
  if (url.origin === self.location.origin) return true;
  return [
    "cdn.jsdelivr.net",
    "cdn.tailwindcss.com",
    "unpkg.com",
    "cdn.sheetjs.com"
  ].indexOf(url.hostname) !== -1;
}

async function matchCached(request) {
  const exact = await caches.match(request);
  if (exact) return exact;
  return caches.match(request, { ignoreSearch: true });
}

async function preferOffline() {
  if (preferMem !== null) return preferMem;
  try {
    const cache = await caches.open(CACHE);
    const res = await cache.match(preferUrl());
    preferMem = !!(res && (await res.text()) === "1");
  } catch (err) {
    preferMem = false;
  }
  return preferMem;
}

async function fromNetwork(request) {
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "preferOffline") {
    preferMem = !!event.data.value;
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!shouldHandle(url)) return;
  event.respondWith((async () => {
    const bypass = event.request.cache === "reload" || event.request.cache === "no-store";
    if (!bypass && await preferOffline()) {
      const cached = await matchCached(event.request);
      if (cached) return cached;
    }
    try {
      return await fromNetwork(event.request);
    } catch (err) {
      const cached = await matchCached(event.request);
      if (cached) return cached;
      throw err;
    }
  })());
});
