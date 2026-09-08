const CACHE = "ebb-pwa-v37";
const PREF_PATH = "__ebb-prefer-offline";
const PP_CACHE = "htms-pp-gate";
const ECON_PP_CACHE = "htms-econ-pp-gate";

let preferMem = null;
let ppMem = null;
let econPpMem = null;

function preferUrl() {
  return new URL(PREF_PATH, self.registration.scope).href;
}

function shouldHandle(url) {
  if (url.pathname.replace(/\/+$/, "").endsWith("/" + PREF_PATH) || url.pathname.endsWith(PREF_PATH)) return false;
  if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith("sw.js")) return false;
  if (/\/api(\/|$)/i.test(url.pathname)) return false;
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
  const url = new URL(request.url);
  if (fresh && fresh.ok && !isBafsPastPaperFile(url) && !isEconPastPaperFile(url)) {
    const cache = await caches.open(CACHE);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

function isBafsPastPaperFile(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname.replace(/\\/g, "/");
  return /\/past_papers\/bafs\//i.test(p);
}

function isEconPastPaperFile(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname.replace(/\\/g, "/");
  return /\/past_papers\/econ\/.+\.pdf$/i.test(p);
}

async function econPpAllowed() {
  if (econPpMem === true) return true;
  if (econPpMem === false) return false;
  try {
    const cache = await caches.open(ECON_PP_CACHE);
    const res = await cache.match("__ok");
    econPpMem = !!(res && (await res.text()) === "1");
  } catch (err) {
    econPpMem = false;
  }
  return econPpMem;
}

async function ppAllowed() {
  if (ppMem === true) return true;
  if (ppMem === false) return false;
  try {
    const cache = await caches.open(PP_CACHE);
    const res = await cache.match("__ok");
    ppMem = !!(res && (await res.text()) === "1");
  } catch (err) {
    ppMem = false;
  }
  return ppMem;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE && k !== PP_CACHE && k !== ECON_PP_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "preferOffline") {
    preferMem = !!event.data.value;
  }
  if (event.data && event.data.type === "ppUnlock") ppMem = true;
  if (event.data && event.data.type === "ppLock") ppMem = false;
  if (event.data && event.data.type === "econPpUnlock") econPpMem = true;
  if (event.data && event.data.type === "econPpLock") econPpMem = false;
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!shouldHandle(url)) return;
  event.respondWith((async () => {
    if (isBafsPastPaperFile(url)) {
      if (!await ppAllowed()) {
        return Response.redirect(new URL("index.html?pp=1", self.registration.scope), 302);
      }
      try {
        return await fetch(event.request);
      } catch (err) {
        throw err;
      }
    }
    if (isEconPastPaperFile(url)) {
      if (!await econPpAllowed()) {
        return Response.redirect(new URL("index.html?ppe=1", self.registration.scope), 302);
      }
      try {
        return await fetch(event.request);
      } catch (err) {
        throw err;
      }
    }
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
