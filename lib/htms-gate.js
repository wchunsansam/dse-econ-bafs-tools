(function () {
  const KEY = "htms-unlock-day";
  const CODE = "HTMS";

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

  function unlock() {
    localStorage.setItem(KEY, today());
  }

  function langParam() {
    const q = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    if (q === "zh-hk" || q === "zh") return "zh-hk";
    return "en";
  }

  function homeUrl() {
    const path = location.pathname.replace(/\\/g, "/");
    const home = path.includes("/econ_notes/") || path.includes("/econ_tools/")
      ? "../index.html"
      : (path.endsWith("/") ? "./" : "index.html");
    return home + "?lang=" + langParam();
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

  window.HTMSGate = { KEY, CODE, today, unlocked, unlock, homeUrl, langParam, isHome, standalone };

  installPwa();

  if (!isHome() && !unlocked()) {
    location.replace(homeUrl());
  }
})();
