(function (global) {
  let el = null;
  let padH = 0;
  let lastKey = "";
  const baseDpr = window.devicePixelRatio || 1;
  const basePinch = (window.visualViewport && window.visualViewport.scale) || 1;

  function zoomFactor(vv) {
    const pinch = (vv && vv.scale) || 1;
    const pinchRatio = pinch / basePinch;
    const dprRatio = (window.devicePixelRatio || 1) / baseDpr;
    if (Math.abs(dprRatio - pinchRatio) < 0.04) return pinchRatio || 1;
    return (pinchRatio * dprRatio) || 1;
  }

  function sync() {
    if (!el) return;
    const vv = window.visualViewport;
    const scale = zoomFactor(vv);
    const left = vv ? vv.offsetLeft : 0;
    const top = vv ? vv.offsetTop : 0;
    const vw = vv ? vv.width : window.innerWidth;
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.right = "auto";
    el.style.margin = "0";
    el.style.zIndex = "40";
    el.style.transformOrigin = "0 0";
    el.style.width = Math.max(1, vw * scale) + "px";
    el.style.maxWidth = "none";
    el.style.transform = "none";
    const layoutH = el.offsetHeight;
    el.style.transform = "translate(" + left + "px," + top + "px) scale(" + (1 / scale) + ")";
    const visualH = Math.max(1, el.getBoundingClientRect().height || layoutH / scale);
    const key = Math.round(vw * scale) + ":" + (document.body.classList.contains("draw-on") ? "1" : "0") + ":" + Math.round(scale * 100) + ":" + Math.round(visualH);
    if (key !== lastKey || !padH) {
      lastKey = key;
      padH = visualH;
      document.documentElement.style.setProperty("--chrome-pad", padH + "px");
      document.documentElement.style.scrollPaddingTop = Math.max(48, padH + 12) + "px";
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
