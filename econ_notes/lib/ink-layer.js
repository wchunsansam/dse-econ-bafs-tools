(function (global) {
  const NS = "http://www.w3.org/2000/svg";

  function strokePath(s) {
    const pts = s.points || [];
    if (!pts.length) return "";
    if (pts.length === 1) {
      const p = pts[0];
      const r = Math.max(0.6, (s.width || 2.75) / 2);
      return "M " + (p.x - r) + " " + p.y + " a " + r + " " + r + " 0 1 0 " + (r * 2) + " 0 a " + r + " " + r + " 0 1 0 " + (-r * 2) + " 0";
    }
    return pts.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" ");
  }

  function paintStrokeOn(c, s) {
    if (!s.points || !s.points.length) return;
    c.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineWidth = s.width;
    c.lineCap = "round";
    c.lineJoin = "round";
    if (s.points.length === 1) {
      c.beginPath();
      c.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      s.points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";
  }

  function addPath(parent, s, forMask) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", strokePath(s));
    path.setAttribute("fill", s.points && s.points.length === 1 ? (forMask ? "#000" : s.color) : "none");
    path.setAttribute("stroke", forMask ? "#000" : s.color);
    path.setAttribute("stroke-width", String(s.width || 2.75));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    parent.appendChild(path);
    return path;
  }

  function create(svg, getSize) {
    function size() {
      const s = getSize() || { w: 1, h: 1 };
      return { w: Math.max(1, s.w), h: Math.max(1, s.h) };
    }
    function fit(opts) {
      const { w, h } = size();
      svg.setAttribute("viewBox", "0 0 " + w + " " + h);
      svg.setAttribute("preserveAspectRatio", "none");
      if (opts && opts.fill) {
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.width = "100%";
        svg.style.height = "100%";
      } else {
        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h));
        svg.style.width = "100%";
        svg.style.height = h + "px";
      }
    }
    function pt(e) {
      const r = svg.getBoundingClientRect();
      const { w, h } = size();
      return {
        x: (e.clientX - r.left) * (w / Math.max(r.width, 1)),
        y: (e.clientY - r.top) * (h / Math.max(r.height, 1))
      };
    }
    let liveEl = null;
    function inkGroup() {
      return svg.querySelector("g");
    }
    function inkMask() {
      return svg.querySelector("mask");
    }
    function redraw(strokes) {
      liveEl = null;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const { w, h } = size();
      const maskId = (svg.id || "ink") + "-mask";
      const defs = document.createElementNS(NS, "defs");
      const mask = document.createElementNS(NS, "mask");
      mask.setAttribute("id", maskId);
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      const bg = document.createElementNS(NS, "rect");
      bg.setAttribute("x", "0");
      bg.setAttribute("y", "0");
      bg.setAttribute("width", String(w));
      bg.setAttribute("height", String(h));
      bg.setAttribute("fill", "#fff");
      mask.appendChild(bg);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("mask", "url(#" + maskId + ")");
      (strokes || []).forEach(s => {
        if (s.erase) addPath(mask, s, true);
        else addPath(g, s, false);
      });
      defs.appendChild(mask);
      svg.appendChild(defs);
      svg.appendChild(g);
    }
    function startLive(s) {
      if (!inkGroup()) redraw([]);
      const parent = s.erase ? inkMask() : inkGroup();
      liveEl = addPath(parent, s, !!s.erase);
      return liveEl;
    }
    function updateLive(s) {
      if (!liveEl) startLive(s);
      liveEl.setAttribute("d", strokePath(s));
      const one = s.points && s.points.length === 1;
      liveEl.setAttribute("fill", one ? (s.erase ? "#000" : s.color) : "none");
    }
    function endLive() {
      liveEl = null;
    }
    return { fit, pt, redraw, size, startLive, updateLive, endLive };
  }

  global.InkLayer = { create, paintStrokeOn, strokePath };
})(window);
