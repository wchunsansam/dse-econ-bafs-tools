(function () {
  const KEY = "htms-unlock-day";
  const ROLE_KEY = "htms-role";
  const CODE = "HTMS";
  const TEACHER_CODE = "HTMST";

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
    document.documentElement.classList.remove("htms-unlocked", "htms-student", "htms-teacher");
    applyRoleClass();
  }

  function hideAppUntilOk() {
    if (isHome()) return;
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
    if (isHome()) {
      showApp();
      if (unlocked()) document.documentElement.classList.add("htms-unlocked");
      else document.documentElement.classList.remove("htms-unlocked");
      return;
    }
    if (!unlocked()) {
      hideAppUntilOk();
      location.replace(homeUrl());
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

  window.HTMSGate = {
    KEY, ROLE_KEY, CODE, TEACHER_CODE,
    today, unlocked, unlock, lock, role, isTeacher,
    homeUrl, langParam, isHome, standalone, applyRoleClass, enforce
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
