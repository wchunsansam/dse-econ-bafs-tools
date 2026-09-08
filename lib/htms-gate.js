(function () {
  const KEY = "htms-unlock-day";
  const ROLE_KEY = "htms-role";
  const CODE = "HTMS";
  const TEACHER_CODE = "HTMST";
  const PP_COOKIE = "htms-pp";
  const PP_CODE = "4321";
  const ECON_PP_COOKIE = "htms-econ-pp";
  const ECON_PP_CODE = "HTMSECON";
  const ECON_PP_CACHE = "htms-econ-pp-gate";
  const CANONICAL_HOST = "dse-econ-bafs-tools.vercel.app";

  function isLocalHost(host) {
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
      || /^\d{1,3}(\.\d{1,3}){3}$/.test(host || "");
  }

  function needsCanonicalBounce() {
    const host = (location.hostname || "").toLowerCase();
    if (!host || isLocalHost(host)) return false;
    if (!/\.vercel\.app$/i.test(host)) return false;
    return host !== CANONICAL_HOST;
  }

  function bounceToCanonical() {
    if (!needsCanonicalBounce()) return false;
    try {
      location.replace("https://" + CANONICAL_HOST + location.pathname + location.search + location.hash);
      return true;
    } catch {
      return false;
    }
  }

  if (bounceToCanonical()) return;

  function today() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function unlocked() {
    try {
      return localStorage.getItem(KEY) === today();
    } catch {
      return false;
    }
  }

  function role() {
    if (!unlocked()) return null;
    try {
      return localStorage.getItem(ROLE_KEY) === "teacher" ? "teacher" : "student";
    } catch {
      return "student";
    }
  }

  function isTeacher() {
    return role() === "teacher";
  }

  function unlock(which) {
    localStorage.setItem(KEY, today());
    localStorage.setItem(ROLE_KEY, which === "teacher" ? "teacher" : "student");
    applyRoleClass();
  }

  function lock() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(ROLE_KEY);
    } catch {}
    ppLock();
    econPpLock();
    document.documentElement.classList.remove("htms-unlocked", "htms-student", "htms-teacher");
    applyRoleClass();
  }

  function readCookie(name) {
    try {
      const parts = (document.cookie || "").split(";");
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.indexOf(name + "=") === 0) return decodeURIComponent(p.slice(name.length + 1));
      }
    } catch {}
    return "";
  }

  function ppUnlocked() {
    return readCookie(PP_COOKIE) === "1";
  }

  function ppUnlock() {
    document.cookie = PP_COOKIE + "=1; path=/; SameSite=Lax";
    return setPpCache(true);
  }

  function ppLock() {
    document.cookie = PP_COOKIE + "=; path=/; max-age=0; SameSite=Lax";
    return setPpCache(false);
  }

  function setPpCache(on) {
    return setNamedPpCache("htms-pp-gate", on ? "ppUnlock" : "ppLock", on);
  }

  function econPpUnlocked() {
    return readCookie(ECON_PP_COOKIE) === "1";
  }

  function econPpUnlock() {
    document.cookie = ECON_PP_COOKIE + "=1; path=/; SameSite=Lax";
    return setEconPpCache(true);
  }

  function econPpLock() {
    document.cookie = ECON_PP_COOKIE + "=; path=/; max-age=0; SameSite=Lax";
    return setEconPpCache(false);
  }

  function setEconPpCache(on) {
    return setNamedPpCache(ECON_PP_CACHE, on ? "econPpUnlock" : "econPpLock", on);
  }

  function setNamedPpCache(cacheName, msgType, on) {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: msgType });
      }
    } catch {}
    if (!("caches" in window)) return Promise.resolve();
    try {
      if (on) {
        return caches.open(cacheName).then(function (c) {
          return c.put("__ok", new Response("1"));
        });
      }
      return caches.delete(cacheName);
    } catch {
      return Promise.resolve();
    }
  }

  function isPastPaperSurface() {
    if (window.HTMS_PAGE === "past-paper" || window.HTMS_PAGE === "econ-past-paper") return true;
    const path = location.pathname.replace(/\\/g, "/");
    return /\/past_papers(_econ)?\.html$/i.test(path) || /\/past_papers\//i.test(path);
  }

  function isEconPastPaperPage() {
    if (window.HTMS_PAGE === "econ-past-paper") return true;
    const path = location.pathname.replace(/\\/g, "/");
    return /\/past_papers_econ\.html$/i.test(path);
  }

  function isBafsPastPaperPage() {
    if (window.HTMS_PAGE === "past-paper") return true;
    const path = location.pathname.replace(/\\/g, "/");
    return /\/past_papers\.html$/i.test(path);
  }

  function isBafsPastPaperFile() {
    const path = location.pathname.replace(/\\/g, "/");
    return /\/past_papers\/bafs\//i.test(path);
  }

  function isEconPastPaperFile() {
    const path = location.pathname.replace(/\\/g, "/");
    return /\/past_papers\/econ\/.+\.pdf$/i.test(path);
  }

  function hideAppUntilOk() {
    if (isHome() || isMcGrader()) return;
    document.documentElement.classList.add("htms-wait");
    if (document.getElementById("htms-wait-style")) return;
    const s = document.createElement("style");
    s.id = "htms-wait-style";
    s.textContent = "html.htms-wait{visibility:hidden!important}";
    (document.head || document.documentElement).appendChild(s);
  }

  function showApp() {
    document.documentElement.classList.remove("htms-wait");
  }

  function enforce() {
    applyRoleClass();
    if (isHome() || isMcGrader()) {
      showApp();
      if (unlocked()) document.documentElement.classList.add("htms-unlocked");
      else document.documentElement.classList.remove("htms-unlocked");
      if (!ppUnlocked()) setPpCache(false);
      if (!econPpUnlocked()) setEconPpCache(false);
      return;
    }
    if (!unlocked()) {
      hideAppUntilOk();
      if (isBafsPastPaperFile() || isBafsPastPaperPage()) location.replace(homeUrl() + "&pp=1");
      else if (isEconPastPaperFile() || isEconPastPaperPage()) location.replace(homeUrl() + "&ppe=1");
      else location.replace(homeUrl());
      return;
    }
    if ((isBafsPastPaperFile() || isBafsPastPaperPage()) && !ppUnlocked()) {
      hideAppUntilOk();
      location.replace(homeUrl() + "&pp=1");
      return;
    }
    if ((isEconPastPaperFile() || isEconPastPaperPage()) && !econPpUnlocked()) {
      hideAppUntilOk();
      location.replace(homeUrl() + "&ppe=1");
      return;
    }
    showApp();
  }

  function applyRoleClass() {
    document.documentElement.classList.remove("htms-student", "htms-teacher");
    if (!unlocked()) return;
    document.documentElement.classList.add(isTeacher() ? "htms-teacher" : "htms-student");
  }

  function langParam() {
    const q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    if (q === "zh-hk" || q === "zh") return "zh-hk";
    return "en";
  }

  function homeOrigin() {
    if (location.protocol === "file:") return "";
    if (isLocalHost(location.hostname)) return location.origin;
    return "https://" + CANONICAL_HOST;
  }

  function homeUrl() {
    const origin = homeOrigin();
    if (!origin) {
      return "index.html?lang=" + langParam();
    }
    return origin + "/index.html?lang=" + langParam();
  }

  function isMcGrader() {
    if (window.HTMS_PAGE === "mc-grader") return true;
    const path = location.pathname.replace(/\\/g, "/");
    return /\/mc_grader\.html$/i.test(path);
  }

  function isHome() {
    return window.HTMS_PAGE === "home";
  }

  function siteRoot() {
    const el = document.querySelector('script[src*="htms-gate.js"]');
    const src = el ? el.getAttribute("src") : "../lib/htms-gate.js";
    return new URL(src, location.href).href.replace(/lib\/htms-gate\.js(\?.*)?$/, "");
  }

  function standalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  }

  function ensureMeta(attr, key, content) {
    if (document.querySelector("meta[" + attr + '="' + key + '"]')) return;
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    m.content = content;
    document.head.appendChild(m);
  }

  function ensureLink(rel, href, extra) {
    if (document.querySelector('link[rel="' + rel + '"]')) return;
    const l = document.createElement("link");
    l.rel = rel;
    l.href = href;
    if (extra) Object.keys(extra).forEach(k => l.setAttribute(k, extra[k]));
    document.head.appendChild(l);
  }

  function installPwa() {
    if (needsCanonicalBounce()) return;
    const root = siteRoot();
    ensureLink("manifest", root + "manifest.webmanifest");
    ensureLink("apple-touch-icon", root + "icons/apple-touch-icon.png", { sizes: "180x180" });
    ensureMeta("name", "theme-color", "#2563eb");
    ensureMeta("name", "mobile-web-app-capable", "yes");
    ensureMeta("name", "apple-mobile-web-app-capable", "yes");
    ensureMeta("name", "apple-mobile-web-app-title", "ECON BAFS");
    ensureMeta("name", "apple-mobile-web-app-status-bar-style", "default");
    if (standalone()) document.documentElement.classList.add("pwa-standalone");
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      window._pwaPrompt = e;
      document.documentElement.classList.add("pwa-can-install");
    });
    window.addEventListener("appinstalled", function () {
      window._pwaPrompt = null;
      document.documentElement.classList.remove("pwa-can-install");
    });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(root + "sw.js").catch(function () {});
    }
  }

  window.HTMSGate = {
    KEY, ROLE_KEY, CODE, TEACHER_CODE, PP_COOKIE, PP_CODE,
    ECON_PP_COOKIE, ECON_PP_CODE,
    today, unlocked, unlock, lock, role, isTeacher,
    ppUnlocked, ppUnlock, ppLock, isPastPaperSurface, isBafsPastPaperFile,
    econPpUnlocked, econPpUnlock, econPpLock, isEconPastPaperFile, isEconPastPaperPage,
    homeUrl, langParam, isHome, standalone, applyRoleClass, enforce,
    CANONICAL_HOST, bounceToCanonical, needsCanonicalBounce
  };

  hideAppUntilOk();
  installPwa();
  enforce();

  window.addEventListener("pageshow", enforce);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") enforce();
  });
  window.addEventListener("storage", function (e) {
    if (e.key && e.key !== KEY && e.key !== ROLE_KEY) return;
    enforce();
  });
})();
