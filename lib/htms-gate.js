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

  window.HTMSGate = { KEY, CODE, today, unlocked, unlock, homeUrl, langParam, isHome };

  if (!isHome() && !unlocked()) {
    location.replace(homeUrl());
  }
})();
