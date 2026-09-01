(function (global) {
  let el = null;
  let padH = 0;
  let lastKey = "";

  function chromeHeight() {
    if (!el) return 0;
    const prev = el.style.transform;
    el.style.transform = "none";
    const h = el.offsetHeight;
    el.style.transform = prev;
    return h;
  }

  function sync() {
    if (!el) return;
    const vv = window.visualViewport;
    const scale = vv && vv.scale ? vv.scale : 1;
    const left = vv ? vv.offsetLeft : 0;
    const top = vv ? vv.offsetTop : 0;
    const vw = vv ? vv.width : window.innerWidth;
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.right = "auto";
    el.style.margin = "0";
    el.style.zIndex = "30";
    el.style.transformOrigin = "0 0";
    el.style.width = Math.max(1, vw * scale) + "px";
    el.style.maxWidth = "none";
    el.style.transform = "translate(" + left + "px," + top + "px) scale(" + 1 / scale + ")";
    const key = Math.round(vw * scale) + ":" + (document.body.classList.contains("draw-on") ? "1" : "0") + ":" + Math.round(scale * 100);
    if (key !== lastKey || !padH) {
      lastKey = key;
      padH = chromeHeight();
      document.documentElement.style.setProperty("--chrome-pad", padH + "px");
      document.documentElement.style.scrollPaddingTop = Math.max(48, padH + 10) + "px";
    }
  }

  function attach(target) {
    el = target || document.querySelector(".notes-chrome");
    if (!el) return;
    const vv = window.visualViewport;
    function tick() {
      requestAnimationFrame(sync);
    }
    window.addEventListener("resize", tick);
    window.addEventListener("scroll", tick, { passive: true });
    if (vv) {
      vv.addEventListener("resize", tick);
      vv.addEventListener("scroll", tick);
    }
    sync();
  }

  global.VisualChrome = { attach, sync };
})(window);
