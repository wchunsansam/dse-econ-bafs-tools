(function (global) {
  const CACHE = "ebb-pwa-v3";
  const KEY_AT = "ebb-offline-at";
  const KEY_PREF = "ebb-prefer-offline";
  const PREF_PATH = "__ebb-prefer-offline";

  function rootUrl() {
    return new URL("./", location.href);
  }

  function packList() {
    const root = rootUrl();
    const local = [
      "",
      "index.html",
      "past_papers.html",
      "manifest.webmanifest",
      "sw.js",
      "lib/htms-gate.js",
      "lib/offline-pack.js",
      "icons/apple-touch-icon.png",
      "icons/icon-192.png",
      "icons/icon-512.png",
      "icons/icon-maskable-512.png",
      "econ_notes/ch01_basic_concepts.html",
      "econ_notes/bafs_501_financial_analysis.html",
      "econ_notes/bafs_502_budgeting.html",
      "econ_notes/pdf_mark.html",
      "econ_notes/lib/notes.css",
      "econ_notes/lib/notes.js",
      "econ_notes/lib/ink-layer.js",
      "econ_notes/lib/pdf_mark.css",
      "econ_notes/lib/pdf_mark.js",
      "econ_notes/lib/visual-chrome.js",
      "econ_notes/img/ch01-scarcity.jpg",
      "econ_notes/img/ch01-fullcost.jpg",
      "econ_notes/img/ch01-micro-macro.jpg",
      "econ_notes/img/ch01-wants.jpg",
      "econ_notes/img/ch01-wants.jpg?v=2",
      "econ_notes/img/ch01-interest.jpg",
      "econ_notes/img/ch01-interest.jpg?v=2",
      "econ_notes/img/ch01-good-sunshine.jpg",
      "econ_notes/img/ch01-good-sunshine.jpg?v=2",
      "econ_notes/img/ch01-good-orchid.jpg",
      "econ_notes/img/ch01-good-orchid.jpg?v=2",
      "econ_notes/img/ch01-good-wifi.jpg",
      "econ_notes/img/ch01-good-wifi.jpg?v=2",
      "econ_notes/img/ch01-good-booklet.jpg",
      "econ_notes/img/ch01-good-booklet.jpg?v=2",
      "econ_notes/img/ch01-choice.jpg",
      "econ_notes/tb/Ch01_chi_TbEx.pdf",
      "econ_notes/tb/Ch01_chi_TbEx_Ans.pdf",
      "econ_notes/tb/Ch01_eng_TbEx.pdf",
      "econ_notes/tb/Ch01_eng_TbEx_Ans.pdf",
      "econ_tools/ch01_lab.html",
      "econ_tools/bafs_501_lab.html",
      "econ_tools/bafs_502_lab.html",
      "econ_tools/deposit_creation.html",
      "econ_tools/money_market.html",
      "econ_tools/monetary_policy.html",
      "econ_tools/seating_planner.html"
    ];
    const cdn = [
      "https://cdn.jsdelivr.net/npm/i18next@23.7.6/dist/umd/i18next.min.js",
      "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
      "https://cdn.tailwindcss.com",
      "https://unpkg.com/react@18.3.1/umd/react.development.js",
      "https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js",
      "https://unpkg.com/@babel/standalone@7.26.10/babel.min.js",
      "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"
    ];
    const localUrls = local.map(function (p) { return new URL(p, root).href; });
    return { localUrls: localUrls, urls: localUrls.concat(cdn) };
  }

  async function download(onProgress) {
    if ("serviceWorker" in navigator) {
      try { await navigator.serviceWorker.ready; } catch (err) {}
    }
    const cache = await caches.open(CACHE);
    const pack = packList();
    const urls = pack.urls;
    const coreN = pack.localUrls.length;
    let ok = 0;
    let fail = 0;
    let coreFail = 0;
    for (let i = 0; i < urls.length; i++) {
      if (onProgress) onProgress(i + 1, urls.length);
      try {
        const res = await fetch(urls[i], { cache: "reload", credentials: "omit", mode: "cors" });
        if (!res.ok) throw new Error(String(res.status));
        await cache.put(urls[i], res.clone());
        ok += 1;
      } catch (err) {
        fail += 1;
        if (i < coreN) coreFail += 1;
      }
    }
    if (!coreFail) {
      try { localStorage.setItem(KEY_AT, String(Date.now())); } catch (err) {}
    }
    return { ok: ok, fail: fail, total: urls.length, coreFail: coreFail };
  }

  function lastAt() {
    try {
      const n = Number(localStorage.getItem(KEY_AT) || "");
      return n ? new Date(n) : null;
    } catch (err) {
      return null;
    }
  }

  function preferUrl() {
    return new URL(PREF_PATH, rootUrl()).href;
  }

  function getPreferOffline() {
    try {
      return localStorage.getItem(KEY_PREF) === "1";
    } catch (err) {
      return false;
    }
  }

  async function setPreferOffline(on) {
    try {
      localStorage.setItem(KEY_PREF, on ? "1" : "0");
    } catch (err) {}
    try {
      const cache = await caches.open(CACHE);
      await cache.put(preferUrl(), new Response(on ? "1" : "0", {
        headers: { "Content-Type": "text/plain" }
      }));
    } catch (err) {}
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "preferOffline", value: !!on });
    }
  }

  global.OfflinePack = { download, lastAt, packList, getPreferOffline, setPreferOffline };
})(window);
