(function () {
  "use strict";

  const PASS_STUDENT = "student";
  const PASS_TEACHER = "samsir";
  const LS_KEY = "htms-mc-grader-v1";
  const ROLE_KEY = "htms-mc-role";
  const IDB_NAME = "htms-mc-grader";
  const IDB_STORE = "files";
  const SUBJECTS = [
    { id: "ECON", zh: "經濟 ECON", en: "Economics" },
    { id: "BAFS", zh: "企會財 BAFS", en: "BAFS" }
  ];
  const OPTS = ["A", "B", "C", "D"];

  const L = {
    pageW: 210,
    pageH: 297,
    fidSize: 8,
    fid: [
      { x: 10, y: 10 },
      { x: 192, y: 10 },
      { x: 10, y: 279 },
      { x: 192, y: 279 }
    ],
    ori: { x: 19.6, y: 10, w: 3.4, h: 8 },
    bits: { x0: 108, y: 11.2, pitch: 5.2, size: 3.2 },
    hw: { x0: 89, y0: 24.2, colPitch: 11.5, rowPitch: 3.42, r: 1.38 },
    id: { x0: 132, y0: 24.2, colPitch: 16.2, rowPitch: 3.42, r: 1.38 },
    q: {
      x0: 18,
      y0: 70,
      colPitch: 63,
      rowPitch: 10.55,
      opt0: 14,
      optPitch: 9.2,
      r: 1.72,
      cols: 3,
      rows: 20
    },
    time: { x: 12.2, w: 2.1, h: 2.1 }
  };

  function fidCenter(i) {
    const f = L.fid[i];
    return { x: f.x + L.fidSize / 2, y: f.y + L.fidSize / 2 };
  }

  function qPos(k) {
    const col = Math.floor(k / L.q.rows);
    const row = k % L.q.rows;
    const xNum = L.q.x0 + col * L.q.colPitch;
    const cy = L.q.y0 + row * L.q.rowPitch;
    return { col, row, xNum, cy };
  }

  function optCenter(k, optIndex) {
    const p = qPos(k);
    return { x: p.xNum + L.q.opt0 + optIndex * L.q.optPitch, y: p.cy };
  }

  function idCenter(digit, value) {
    return {
      x: L.id.x0 + digit * L.id.colPitch,
      y: L.id.y0 + value * L.id.rowPitch
    };
  }

  function hwCenter(digit, value) {
    return {
      x: L.hw.x0 + digit * L.hw.colPitch,
      y: L.hw.y0 + value * L.hw.rowPitch
    };
  }

  function parseHwCode(value) {
    const s = String(value || "").trim().toUpperCase();
    const m = /^(H|U)(\d)(\d)$/.exec(s);
    if (!m) return null;
    const kind = m[1];
    const num = Number(m[2]) * 10 + Number(m[3]);
    return {
      code: s,
      kind,
      num,
      ok: true,
      label: (kind === "H" ? "功課" : "UT") + " " + num,
      labelEn: (kind === "H" ? "HW" : "UT") + " " + num
    };
  }

  function hwDisplay(code) {
    const p = parseHwCode(code);
    if (!p) return String(code || "");
    return p.code + " · " + t(p.label, p.labelEn);
  }

  let lang = "zh";
  const t = (zh, en) => (lang === "en" ? en : zh);
  const $ = (id) => document.getElementById(id);

  function uid() {
    return (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  }

  function parseStno(value) {
    const stno = String(value || "").trim().replace(/\.0$/, "");
    if (!/^\d{4}$/.test(stno)) return null;
    const grade = stno[0];
    const classNum = Number(stno[1]);
    const number = stno.slice(2);
    if (classNum < 1 || classNum > 9) {
      return { stno, label: stno, grade, classLetter: "?", number };
    }
    const classLetter = String.fromCharCode(64 + classNum);
    return { stno, label: grade + classLetter + number, grade, classLetter, number };
  }

  function defaultState() {
    return { schoolName: "HTMS", assignments: [], mcSubmissions: [], pdfSubmissions: [] };
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      return {
        schoolName: raw.schoolName || "HTMS",
        assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
        mcSubmissions: Array.isArray(raw.mcSubmissions) ? raw.mcSubmissions : [],
        pdfSubmissions: Array.isArray(raw.pdfSubmissions) ? raw.pdfSubmissions : []
      };
    } catch {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function getRole() {
    try {
      const r = sessionStorage.getItem(ROLE_KEY) || localStorage.getItem(ROLE_KEY);
      if (r === "teacher" || r === "student") return r;
    } catch {}
    return null;
  }

  function setRole(role) {
    try {
      sessionStorage.setItem(ROLE_KEY, role);
      localStorage.setItem(ROLE_KEY, role);
    } catch {}
  }

  function clearRole() {
    try {
      sessionStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(ROLE_KEY);
    } catch {}
  }

  function stripKey(a) {
    return {
      id: a.id,
      title: a.title,
      subject: a.subject,
      n: a.n,
      open: a.open,
      createdAt: a.createdAt
    };
  }

  function mergeState(local, remote) {
    if (!remote || !remote.ok || !remote.state) return local;
    const r = remote.state;
    const byId = (arr) => {
      const m = new Map();
      (arr || []).forEach((x) => m.set(x.id, x));
      return m;
    };
    const aMap = byId(local.assignments);
    (r.assignments || []).forEach((x) => {
      const old = aMap.get(x.id);
      const incoming = { ...x };
      if (old && Array.isArray(old.key) && old.key.some(Boolean) && (!incoming.key || !incoming.key.some(Boolean))) {
        incoming.key = old.key;
      }
      if (!old || (incoming.updatedAt || incoming.createdAt || "") >= (old.updatedAt || old.createdAt || "")) {
        aMap.set(incoming.id, incoming);
      }
    });
    const mcMap = byId(local.mcSubmissions);
    (r.mcSubmissions || []).forEach((x) => {
      const key = x.id || (x.assignmentId + ":" + x.stno + ":mc");
      const prev = mcMap.get(key) || [...mcMap.values()].find((s) => s.assignmentId === x.assignmentId && s.stno === x.stno);
      if (!prev || (x.at || "") >= (prev.at || "")) mcMap.set(prev ? prev.id : key, { ...x, id: (prev && prev.id) || x.id || key });
    });
    const pdfMap = byId(local.pdfSubmissions);
    (r.pdfSubmissions || []).forEach((x) => {
      const prev = pdfMap.get(x.id) || [...pdfMap.values()].find((s) => s.assignmentId === x.assignmentId && s.stno === x.stno && s.kind === "pdf");
      if (!prev || (x.at || "") >= (prev.at || "")) pdfMap.set((prev && prev.id) || x.id, { ...x, id: (prev && prev.id) || x.id });
    });
    return {
      schoolName: r.schoolName || local.schoolName,
      assignments: [...aMap.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      mcSubmissions: [...mcMap.values()],
      pdfSubmissions: [...pdfMap.values()]
    };
  }

  async function api(pass, payload, method) {
    const headers = { "x-mc-pass": pass, "content-type": "application/json" };
    const opt = { method: method || (payload ? "POST" : "GET"), headers };
    if (payload) opt.body = JSON.stringify(payload);
    const url = payload ? "../api/mc" : "../api/mc?view=" + (pass === PASS_TEACHER ? "full" : "open");
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctrl) opt.signal = ctrl.signal;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 4000) : null;
    try {
      const res = await fetch(url, opt);
      if (!res.ok) throw new Error("api " + res.status);
      return res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function pullRemote(state) {
    const role = getRole();
    if (!role) return state;
    try {
      const remote = await api(role === "teacher" ? PASS_TEACHER : PASS_STUDENT);
      if (remote && remote.ok) return mergeState(state, remote);
    } catch {}
    return state;
  }

  async function pushRemote(op, body) {
    const role = getRole();
    if (!role) return { ok: false };
    try {
      return await api(role === "teacher" ? PASS_TEACHER : PASS_STUDENT, { op, ...body });
    } catch {
      return { ok: false, mode: "local" };
    }
  }

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(key, blob) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function lookupName(stno) {
    try {
      const plans = JSON.parse(localStorage.getItem("dse-econ-bafs-seating-plans") || "[]");
      for (let i = 0; i < plans.length; i++) {
        const students = plans[i].students || [];
        for (let j = 0; j < students.length; j++) {
          if (String(students[j].stno || "").replace(/\.0$/, "") === stno) return students[j].name || "";
        }
      }
    } catch {}
    return "";
  }

  function subjectLabel(id) {
    const s = SUBJECTS.find((x) => x.id === id);
    return s ? t(s.zh, s.en) : id;
  }

  function gradeAnswers(answers, key) {
    if (!key || !key.length) return { score: null, max: answers.length, marks: answers.map(() => null) };
    const n = Math.min(answers.length, key.length);
    const marks = [];
    let score = 0;
    for (let i = 0; i < n; i++) {
      const k = String(key[i] || "").toUpperCase();
      const a = answers[i];
      if (!k || k === "-" || k === ".") {
        marks.push(null);
        continue;
      }
      const ok = a === k;
      marks.push(ok);
      if (ok) score += 1;
    }
    const max = key.filter((k) => k && k !== "-" && k !== ".").length;
    return { score, max, marks };
  }

  function upsertMc(state, sub) {
    const i = state.mcSubmissions.findIndex((s) => s.assignmentId === sub.assignmentId && s.stno === sub.stno);
    if (i >= 0) {
      sub.id = state.mcSubmissions[i].id;
      state.mcSubmissions[i] = sub;
    } else state.mcSubmissions.push(sub);
  }

  function upsertPdf(state, sub) {
    const i = state.pdfSubmissions.findIndex((s) => s.assignmentId === sub.assignmentId && s.stno === sub.stno);
    if (i >= 0) {
      sub.id = state.pdfSubmissions[i].id;
      state.pdfSubmissions[i] = sub;
    } else state.pdfSubmissions.push(sub);
  }

  /* ---------- sheet DOM ---------- */

  function el(tag, cls, styles) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (styles) Object.keys(styles).forEach((k) => { n.style[k] = styles[k]; });
    return n;
  }

  function addBubble(root, cx, cy, r, extraClass) {
    const b = el("div", "mc-bubble" + (extraClass ? " " + extraClass : ""), {
      left: (cx - r) + "mm",
      top: (cy - r) + "mm",
      width: (2 * r) + "mm",
      height: (2 * r) + "mm"
    });
    root.appendChild(b);
    return b;
  }

  function makeLabelSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "mc-labsvg");
    svg.setAttribute("viewBox", "0 0 210 297");
    svg.setAttribute("width", "210mm");
    svg.setAttribute("height", "297mm");
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }

  function svgCap(svg, xMm, yMm, text, sizeMm) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", String(xMm));
    t.setAttribute("y", String(yMm));
    t.setAttribute("data-cx", String(xMm));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", String(sizeMm));
    t.setAttribute("font-weight", "700");
    t.setAttribute("font-family", "Arial, Helvetica, sans-serif");
    t.setAttribute("fill", "#000");
    t.textContent = text;
    svg.appendChild(t);
    return t;
  }

  function recenterInk(svg) {
    svg.querySelectorAll("text").forEach((t) => {
      const target = Number(t.getAttribute("data-cx"));
      if (!isFinite(target)) return;
      try {
        const bb = t.getBBox();
        if (!bb.width) return;
        const inkCx = bb.x + bb.width / 2;
        t.setAttribute("x", String(Number(t.getAttribute("x")) + (target - inkCx)));
      } catch (err) {}
    });
  }

  function placeSheet(parent, sheet) {
    parent.appendChild(sheet);
    const svg = sheet.querySelector(".mc-labsvg");
    if (svg) recenterInk(svg);
    return sheet;
  }

  function renderSheet(spec) {
    const root = el("div", "mc-sheet");
    L.fid.forEach((p) => {
      root.appendChild(el("div", "mc-fid", {
        left: p.x + "mm",
        top: p.y + "mm",
        width: L.fidSize + "mm",
        height: L.fidSize + "mm"
      }));
    });
    root.appendChild(el("div", "mc-fid mc-ori", {
      left: L.ori.x + "mm",
      top: L.ori.y + "mm",
      width: L.ori.w + "mm",
      height: L.ori.h + "mm"
    }));

    const kind = spec.kind === "written" ? "written" : "mc";
    const fillBits = kind === "mc" ? [1, 0, 1] : [1, 1, 0];
    for (let i = 0; i < 3; i++) {
      const box = el("div", "mc-bit" + (fillBits[i] ? " filled" : ""), {
        left: (L.bits.x0 + i * L.bits.pitch) + "mm",
        top: L.bits.y + "mm",
        width: L.bits.size + "mm",
        height: L.bits.size + "mm"
      });
      root.appendChild(box);
    }

    const school = spec.schoolName || "HTMS";
    const subj = SUBJECTS.find((s) => s.id === spec.subject) || SUBJECTS[0];
    const title = spec.title || "";
    const n = Math.max(1, Math.min(60, spec.n || 40));

    const head = el("div", "mc-head");
    head.innerHTML =
      '<div class="mc-school"></div>' +
      '<div class="mc-sub"></div>' +
      '<div class="mc-title"></div>' +
      '<div class="mc-name-row"><span class="mc-k">姓名 Name</span><span class="mc-name-line"></span></div>' +
      '<div class="mc-hint"></div>';
    head.querySelector(".mc-school").textContent = school;
    head.querySelector(".mc-sub").textContent = subj.zh + "  /  " + subj.en;
    head.querySelector(".mc-title").textContent = title;
    head.querySelector(".mc-hint").textContent = kind === "mc"
      ? "請用深色筆將圓圈完全填滿，勿打剔。功課／UT：H=功課、U=統測，後兩格編號（功課 3 → H03）。"
      : "請用深色筆將學號與功課／UT 圓圈填滿，然後在橫線上作答。功課 3 → H03。";
    root.appendChild(head);

    const hwLab = el("div", "mc-hwlab");
    hwLab.textContent = "功課 / UT 編號";
    root.appendChild(hwLab);
    const idLab = el("div", "mc-idlab");
    idLab.appendChild(document.createTextNode("班別 / 學號  ·  Class no."));
    const idEx = el("span", "mc-idex");
    idEx.textContent = "4A01 → 4101";
    idLab.appendChild(idEx);
    root.appendChild(idLab);
    const labsvg = makeLabelSvg();
    root.appendChild(labsvg);
    const idBaseline = L.id.y0 - L.id.r - 2.15;
    const hwCaps = ["H/U", "十", "個"];
    for (let d = 0; d < 3; d++) {
      svgCap(labsvg, hwCenter(d, 0).x, idBaseline, hwCaps[d], 2.2);
    }
    for (let d = 0; d < 4; d++) {
      svgCap(labsvg, idCenter(d, 0).x, idBaseline, "D" + (d + 1), 2.45);
    }
    ["H", "U"].forEach((ch, v) => {
      const cy = hwCenter(0, v).y;
      const lab = el("div", "mc-idv mc-hwkind", {
        left: (L.hw.x0 - 8) + "mm",
        top: (cy - 1.5) + "mm"
      });
      lab.textContent = ch;
      root.appendChild(lab);
      addBubble(root, hwCenter(0, v).x, cy, L.hw.r);
    });
    for (let v = 0; v < 10; v++) {
      const cy = hwCenter(1, v).y;
      const lab = el("div", "mc-idv", {
        left: (L.hw.x0 + L.hw.colPitch - 7.2) + "mm",
        top: (cy - 1.5) + "mm"
      });
      lab.textContent = String(v);
      root.appendChild(lab);
      addBubble(root, hwCenter(1, v).x, cy, L.hw.r);
      addBubble(root, hwCenter(2, v).x, cy, L.hw.r);
    }
    for (let v = 0; v < 10; v++) {
      const cy = idCenter(0, v).y;
      const lab = el("div", "mc-idv", {
        left: (L.id.x0 - 7.5) + "mm",
        top: (cy - 1.5) + "mm"
      });
      lab.textContent = String(v);
      root.appendChild(lab);
      for (let d = 0; d < 4; d++) {
        const c = idCenter(d, v);
        addBubble(root, c.x, c.y, L.id.r);
      }
    }

    if (kind === "mc") {
      for (let k = 0; k < n; k++) {
        const p = qPos(k);
        const num = el("div", "mc-qnum", {
          left: (p.xNum - 2) + "mm",
          top: (p.cy - 1.8) + "mm"
        });
        num.textContent = String(k + 1);
        root.appendChild(num);
        const tmark = el("div", "mc-fid mc-time", {
          left: L.time.x + "mm",
          top: (p.cy - L.time.h / 2) + "mm",
          width: L.time.w + "mm",
          height: L.time.h + "mm"
        });
        if (p.col === 0) root.appendChild(tmark);
        for (let o = 0; o < 4; o++) {
          const c = optCenter(k, o);
          addBubble(root, c.x, c.y, L.q.r);
          svgCap(labsvg, c.x, c.y - L.q.r - 2.45, OPTS[o], 2.25);
        }
      }
    } else {
      const wrap = el("div", spec.page === 2 ? "mc-lines mc-lines-full" : "mc-lines");
      const pitch = 8;
      const topMm = 68;
      const count = Math.floor((L.pageH - topMm - 14) / pitch);
      for (let i = 0; i < count; i++) wrap.appendChild(el("div", "mc-rule"));
      root.appendChild(wrap);
      const foot = el("div", "mc-write-foot");
      foot.textContent = spec.page === 2 ? "P.2" : "P.1  ·  不夠空位可續下頁 / continue overleaf";
      root.appendChild(foot);
    }
    recenterInk(labsvg);
    return root;
  }

  function sheetsForPrint(spec) {
    if (spec.kind === "written") {
      return [renderSheet({ ...spec, kind: "written", page: 1 }), renderSheet({ ...spec, kind: "written", page: 2 })];
    }
    return [renderSheet({ ...spec, kind: "mc" })];
  }

  /* ---------- OMR ---------- */

  function canvasToGray(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Uint8Array(canvas.width * canvas.height);
    const d = img.data;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      gray[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    }
    return { gray, w: canvas.width, h: canvas.height, img };
  }

  function downsampleGray(src, w, h, maxW) {
    if (w <= maxW) return { gray: src, w, h, scale: 1 };
    const scale = maxW / w;
    const nw = maxW;
    const nh = Math.max(1, Math.round(h * scale));
    const out = new Uint8Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(h - 1, Math.round(y / scale));
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(w - 1, Math.round(x / scale));
        out[y * nw + x] = src[sy * w + sx];
      }
    }
    return { gray: out, w: nw, h: nh, scale };
  }

  function otsuThreshold(gray) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, max = -1, thr = 120;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > max) {
        max = between;
        thr = t;
      }
    }
    return thr;
  }

  function findDarkSquares(gray, w, h) {
    const thr = Math.min(110, otsuThreshold(gray) - 8);
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) bin[i] = gray[i] < thr ? 1 : 0;
    const seen = new Uint8Array(w * h);
    const comps = [];
    const stack = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i0 = y * w + x;
        if (!bin[i0] || seen[i0]) continue;
        stack.length = 0;
        stack.push(i0);
        seen[i0] = 1;
        let minx = x, maxx = x, miny = y, maxy = y, area = 0;
        while (stack.length) {
          const i = stack.pop();
          area++;
          const cx = i % w;
          const cy = (i - cx) / w;
          if (cx < minx) minx = cx;
          if (cx > maxx) maxx = cx;
          if (cy < miny) miny = cy;
          if (cy > maxy) maxy = cy;
          const nbs = [i - 1, i + 1, i - w, i + w];
          for (let k = 0; k < 4; k++) {
            const j = nbs[k];
            if (j < 0 || j >= bin.length || seen[j] || !bin[j]) continue;
            const nx = j % w;
            const ny = (j - nx) / w;
            if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
            seen[j] = 1;
            stack.push(j);
          }
        }
        const bw = maxx - minx + 1;
        const bh = maxy - miny + 1;
        const aspect = bw / bh;
        const fill = area / (bw * bh);
        const minSide = Math.min(w, h);
        if (bw < minSide * 0.012 || bh < minSide * 0.012) continue;
        if (bw > minSide * 0.14 || bh > minSide * 0.14) continue;
        if (aspect < 0.62 || aspect > 1.55) continue;
        if (fill < 0.45) continue;
        comps.push({
          minx, miny, maxx, maxy, bw, bh, area, fill,
          cx: (minx + maxx) / 2,
          cy: (miny + maxy) / 2,
          score: fill * Math.min(aspect, 1 / aspect) * Math.min(bw, bh)
        });
      }
    }
    comps.sort((a, b) => b.score - a.score);
    return comps;
  }

  function pickCornerSquares(comps, w, h) {
    const regions = [
      { x0: 0, y0: 0, x1: w * 0.28, y1: h * 0.22 },
      { x0: w * 0.72, y0: 0, x1: w, y1: h * 0.22 },
      { x0: 0, y0: h * 0.78, x1: w * 0.28, y1: h },
      { x0: w * 0.72, y0: h * 0.78, x1: w, y1: h }
    ];
    const picked = [];
    for (let r = 0; r < 4; r++) {
      let best = null;
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        if (c.cx < regions[r].x0 || c.cx > regions[r].x1 || c.cy < regions[r].y0 || c.cy > regions[r].y1) continue;
        if (!best || c.score > best.score) best = c;
      }
      if (!best) return null;
      picked.push(best);
    }
    return picked;
  }

  function pickNearestCorners(comps, w, h) {
    if (!comps.length) return null;
    const cand = comps.slice(0, 16);
    const targets = [
      { x: w * 0.06, y: h * 0.05 },
      { x: w * 0.94, y: h * 0.05 },
      { x: w * 0.06, y: h * 0.95 },
      { x: w * 0.94, y: h * 0.95 }
    ];
    const used = new Set();
    const out = [];
    for (let t = 0; t < 4; t++) {
      let best = -1, bestD = 1e15;
      for (let i = 0; i < cand.length; i++) {
        if (used.has(i)) continue;
        const dx = cand[i].cx - targets[t].x;
        const dy = cand[i].cy - targets[t].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) return null;
      used.add(best);
      out.push(cand[best]);
    }
    return out;
  }

  function gaussSolve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let i = 0; i < n; i++) {
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
      if (Math.abs(M[piv][i]) < 1e-12) return null;
      if (piv !== i) {
        const tmp = M[i];
        M[i] = M[piv];
        M[piv] = tmp;
      }
      const div = M[i][i];
      for (let c = i; c <= n; c++) M[i][c] /= div;
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f = M[r][i];
        for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
      }
    }
    return M.map((row) => row[n]);
  }

  function homography(src, dst) {
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const x = src[i].x, y = src[i].y, X = dst[i].x, Y = dst[i].y;
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
      b.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
      b.push(Y);
    }
    const h = gaussSolve(A, b);
    if (!h) return null;
    return h.concat([1]);
  }

  function applyH(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    if (Math.abs(w) < 1e-9) return { x: 0, y: 0 };
    return {
      x: (H[0] * x + H[1] * y + H[2]) / w,
      y: (H[3] * x + H[4] * y + H[5]) / w
    };
  }

  function sampleBilinear(gray, w, h, x, y) {
    if (x < 1 || y < 1 || x >= w - 2 || y >= h - 2) return null;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const i = y0 * w + x0;
    const a = gray[i], b = gray[i + 1], c = gray[i + w], d = gray[i + w + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }

  function sampleDisk(H, gray, w, h, cx, cy, r, inner) {
    const rad = r * (inner || 0.58);
    const step = Math.max(0.18, rad / 3.2);
    let sum = 0, n = 0;
    for (let dy = -rad; dy <= rad; dy += step) {
      for (let dx = -rad; dx <= rad; dx += step) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const p = applyH(H, cx + dx, cy + dy);
        const g = sampleBilinear(gray, w, h, p.x, p.y);
        if (g == null) continue;
        sum += g;
        n++;
      }
    }
    return n ? sum / n : 255;
  }

  function paperRef(H, gray, w, h) {
    return sampleDisk(H, gray, w, h, 100, 63.5, 2.4, 1);
  }

  function pickMarked(scores, paper, minLead) {
    const darkness = scores.map((s) => (paper - s) / Math.max(18, paper));
    let best = 0;
    let second = -1;
    for (let i = 1; i < darkness.length; i++) {
      if (darkness[i] > darkness[best]) {
        second = best;
        best = i;
      } else if (second < 0 || darkness[i] > darkness[second]) {
        second = i;
      }
    }
    const lead = second < 0 ? darkness[best] : darkness[best] - darkness[second];
    if (darkness[best] < 0.16) return { index: -1, flag: "blank", darkness, lead };
    if (lead < (minLead || 0.07) && second >= 0 && darkness[second] > 0.14) {
      return { index: -1, flag: "multi", darkness, lead };
    }
    return { index: best, flag: "", darkness, lead };
  }

  function readKind(H, gray, w, h, paper) {
    const bits = [];
    for (let i = 0; i < 3; i++) {
      const cx = L.bits.x0 + L.bits.size / 2 + i * L.bits.pitch;
      const cy = L.bits.y + L.bits.size / 2;
      const s = sampleDisk(H, gray, w, h, cx, cy, L.bits.size * 0.42, 1);
      bits.push((paper - s) / Math.max(18, paper) > 0.18 ? 1 : 0);
    }
    const key = bits.join("");
    if (key === "110") return "written";
    return "mc";
  }

  function readSheet(canvas, spec) {
    const n = Math.max(1, Math.min(60, (spec && spec.n) || 40));
    const full = canvasToGray(canvas);
    const small = downsampleGray(full.gray, full.w, full.h, 900);
    const comps = findDarkSquares(small.gray, small.w, small.h);
    let picked = pickCornerSquares(comps, small.w, small.h);
    if (!picked) picked = pickNearestCorners(comps, small.w, small.h);
    if (!picked) {
      return { ok: false, error: "fiducials", message: t("找不到定位方格。請整張紙入鏡、四角黑格勿裁走。", "Could not find corner marks. Keep all four black squares in view.") };
    }
    const scale = small.scale;
    const imgPts = picked.map((c) => ({ x: c.cx / scale, y: c.cy / scale }));
    const canon = [0, 1, 2, 3].map(fidCenter);
    const ordered = [imgPts[0], imgPts[1], imgPts[2], imgPts[3]];
    let H = homography(canon, ordered);
    if (!H) return { ok: false, error: "homography", message: t("無法對齊掃描。", "Could not align the scan.") };

    const gray = full.gray, w = full.w, h = full.h;
    const paper = paperRef(H, gray, w, h);
    const oriDark = (paper - sampleDisk(H, gray, w, h, L.ori.x + L.ori.w / 2, L.ori.y + L.ori.h / 2, 1.4, 1)) / Math.max(18, paper);
    if (oriDark < 0.12) {
      const swapped = [ordered[3], ordered[2], ordered[1], ordered[0]];
      const H2 = homography(canon, swapped);
      if (H2) {
        const ori2 = (paperRef(H2, gray, w, h) - sampleDisk(H2, gray, w, h, L.ori.x + L.ori.w / 2, L.ori.y + L.ori.h / 2, 1.4, 1)) / 18;
        if (ori2 > oriDark) H = H2;
      }
    }

    const kind = (spec && spec.forceKind) || readKind(H, gray, w, h, paper);
    const digits = [];
    const digitFlags = [];
    const idDebug = [];
    for (let d = 0; d < 4; d++) {
      const scores = [];
      for (let v = 0; v < 10; v++) {
        const c = idCenter(d, v);
        scores.push(sampleDisk(H, gray, w, h, c.x, c.y, L.id.r, 0.62));
      }
      const pick = pickMarked(scores, paper, 0.06);
      digits.push(pick.index < 0 ? "?" : String(pick.index));
      if (pick.flag) digitFlags.push("d" + (d + 1) + ":" + pick.flag);
      idDebug.push({ d, pick, scores: scores.map((s) => Math.round(s)) });
    }
    const stno = digits.join("");
    const parsed = parseStno(stno.replace(/\?/g, "0"));

    const kindScores = [0, 1].map((v) => {
      const c = hwCenter(0, v);
      return sampleDisk(H, gray, w, h, c.x, c.y, L.hw.r, 0.62);
    });
    const kindPick = pickMarked(kindScores, paper, 0.06);
    const hwKind = kindPick.index === 0 ? "H" : kindPick.index === 1 ? "U" : "?";
    if (kindPick.flag) digitFlags.push("hw:" + kindPick.flag);
    const hwDigits = [];
    for (let d = 1; d < 3; d++) {
      const scores = [];
      for (let v = 0; v < 10; v++) {
        const c = hwCenter(d, v);
        scores.push(sampleDisk(H, gray, w, h, c.x, c.y, L.hw.r, 0.62));
      }
      const pick = pickMarked(scores, paper, 0.06);
      hwDigits.push(pick.index < 0 ? "?" : String(pick.index));
      if (pick.flag) digitFlags.push("hw" + d + ":" + pick.flag);
    }
    const hwCode = hwKind + hwDigits.join("");
    const hwParsed = parseHwCode(hwCode);

    const result = {
      ok: true,
      kind,
      stno: /^\d{4}$/.test(stno) ? stno : stno,
      stnoOk: /^\d{4}$/.test(stno),
      stnoLabel: parsed && /^\d{4}$/.test(stno) ? parsed.label : "",
      hwCode: hwParsed ? hwParsed.code : hwCode,
      hwOk: !!hwParsed,
      hwLabel: hwParsed ? hwParsed.label : "",
      flags: digitFlags.slice(),
      answers: [],
      H,
      paper,
      preview: canvas,
      debug: { paper, digits: idDebug, q: [] }
    };

    if (kind === "written") return result;

    for (let k = 0; k < n; k++) {
      const scores = [];
      for (let o = 0; o < 4; o++) {
        const c = optCenter(k, o);
        scores.push(sampleDisk(H, gray, w, h, c.x, c.y, L.q.r, 0.6));
      }
      const pick = pickMarked(scores, paper, 0.065);
      if (k < 4 || pick.flag) result.debug.q.push({ k: k + 1, scores: scores.map((s) => Math.round(s)), darkness: pick.darkness.map((x) => Math.round(x * 1000) / 1000), flag: pick.flag, index: pick.index });
      if (pick.index < 0) {
        result.answers.push(pick.flag === "multi" ? "*" : "");
        if (pick.flag) result.flags.push("q" + (k + 1) + ":" + pick.flag);
      } else result.answers.push(OPTS[pick.index]);
    }
    return result;
  }

  function fillDiskOnSheetCanvas(ctx, scale, cx, cy, r) {
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx * scale, cy * scale, r * scale * 0.82, 0, Math.PI * 2);
    ctx.fill();
  }

  function sheetToCanvas(sheetEl, scale) {
    const s = scale || 8;
    const w = Math.round(L.pageW * s);
    const h = Math.round(L.pageH * s);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    L.fid.forEach((p) => ctx.fillRect(p.x * s, p.y * s, L.fidSize * s, L.fidSize * s));
    ctx.fillRect(L.ori.x * s, L.ori.y * s, L.ori.w * s, L.ori.h * s);
    const bits = sheetEl.classList.contains("written") ? [1, 1, 0] : [1, 0, 1];
    for (let i = 0; i < 3; i++) {
      const x = (L.bits.x0 + i * L.bits.pitch) * s;
      const y = L.bits.y * s;
      const sz = L.bits.size * s;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = Math.max(1, s * 0.3);
      ctx.strokeRect(x, y, sz, sz);
      if (bits[i]) ctx.fillRect(x, y, sz, sz);
    }
    return { canvas, ctx, scale: s };
  }

  function rasterizeSheet(spec, fills) {
    const host = el("div");
    host.style.cssText = "position:fixed;left:-4000px;top:0;width:210mm;";
    const sheet = renderSheet(spec);
    if (spec.kind === "written") sheet.classList.add("written");
    host.appendChild(sheet);
    recenterInk(sheet.querySelector(".mc-labsvg"));
    document.body.appendChild(host);
    const { canvas, ctx, scale } = sheetToCanvas(sheet, 7);
    document.body.removeChild(host);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = Math.max(1, 0.32 * scale);
    if (spec.kind !== "written") {
      const n = Math.max(1, Math.min(60, spec.n || 40));
      for (let k = 0; k < n; k++) {
        for (let o = 0; o < 4; o++) {
          const c = optCenter(k, o);
          ctx.beginPath();
          ctx.arc(c.x * scale, c.y * scale, L.q.r * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    for (let d = 0; d < 4; d++) {
      for (let v = 0; v < 10; v++) {
        const c = idCenter(d, v);
        ctx.beginPath();
        ctx.arc(c.x * scale, c.y * scale, L.id.r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    [0, 1].forEach((v) => {
      const c = hwCenter(0, v);
      ctx.beginPath();
      ctx.arc(c.x * scale, c.y * scale, L.hw.r * scale, 0, Math.PI * 2);
      ctx.stroke();
    });
    for (let d = 1; d < 3; d++) {
      for (let v = 0; v < 10; v++) {
        const c = hwCenter(d, v);
        ctx.beginPath();
        ctx.arc(c.x * scale, c.y * scale, L.hw.r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (fills) {
      if (fills.stno) {
        String(fills.stno).split("").forEach((ch, d) => {
          const v = Number(ch);
          if (d < 4 && v >= 0 && v <= 9) {
            const c = idCenter(d, v);
            fillDiskOnSheetCanvas(ctx, scale, c.x, c.y, L.id.r);
          }
        });
      }
      if (fills.hwCode) {
        const hw = String(fills.hwCode).toUpperCase();
        if (hw[0] === "H" || hw[0] === "U") {
          fillDiskOnSheetCanvas(ctx, scale, hwCenter(0, hw[0] === "H" ? 0 : 1).x, hwCenter(0, hw[0] === "H" ? 0 : 1).y, L.hw.r);
        }
        [1, 2].forEach((d) => {
          const v = Number(hw[d]);
          if (v >= 0 && v <= 9) {
            const c = hwCenter(d, v);
            fillDiskOnSheetCanvas(ctx, scale, c.x, c.y, L.hw.r);
          }
        });
      }
      (fills.answers || []).forEach((ans, k) => {
        const o = OPTS.indexOf(ans);
        if (o < 0) return;
        const c = optCenter(k, o);
        fillDiskOnSheetCanvas(ctx, scale, c.x, c.y, L.q.r);
      });
      (fills.extraMarks || []).forEach((m) => {
        const k = Number(m.q);
        const o = typeof m.opt === "number" ? m.opt : OPTS.indexOf(m.opt);
        if (!(k >= 0) || o < 0) return;
        const c = optCenter(k, o);
        fillDiskOnSheetCanvas(ctx, scale, c.x, c.y, L.q.r);
      });
    }
    return canvas;
  }

  async function selfTest() {
    const spec = { kind: "mc", n: 12, subject: "ECON", title: "SELFTEST", schoolName: "HTMS" };
    const answers = ["A", "C", "B", "D", "A", "A", "B", "C", "D", "B", "C", "A"];
    const canvas = rasterizeSheet(spec, { stno: "4101", hwCode: "H03", answers });
    const read = readSheet(canvas, { n: 12, forceKind: "mc" });
    const utCanvas = rasterizeSheet(spec, { stno: "4203", hwCode: "U12", answers });
    const utRead = readSheet(utCanvas, { n: 12, forceKind: "mc" });
    const pass = read.ok && read.stno === "4101" && read.hwCode === "H03"
      && utRead.ok && utRead.stno === "4203" && utRead.hwCode === "U12"
      && answers.every((a, i) => read.answers[i] === a && utRead.answers[i] === a);
    return { pass, read, utRead, expect: { stno: "4101", hwCode: "H03", answers } };
  }

  function mutateAnswers(key, wrongAt) {
    return key.map((k, i) => {
      if (wrongAt.indexOf(i) < 0) return k;
      const rest = OPTS.filter((o) => o !== k);
      return rest[i % rest.length];
    });
  }

  async function runReviewSim() {
    const mkAsg = (id, title, n, keyStr) => ({
      id,
      title,
      subject: "ECON",
      n,
      key: keyStr.split(""),
      open: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const hw1 = mkAsg("sim-hw-h01", "Ch.1 功課 H01", 20, "ABCDABCDABCDABCDABCD");
    const hw2 = mkAsg("sim-hw-h02", "Ch.2 功課 H02", 20, "BCDABCDABCDABCDABCDA");
    const ut1 = mkAsg("sim-ut-u01", "Ch.1–2 統測 U01", 20, "DCBADCBADCBADCBADCBA");
    state.assignments = [hw1, hw2, ut1].concat(state.assignments.filter((a) => !String(a.id).startsWith("sim-")));
    state.mcSubmissions = state.mcSubmissions.filter((s) => !String(s.assignmentId).startsWith("sim-"));
    state.pdfSubmissions = state.pdfSubmissions.filter((s) => !String(s.assignmentId).startsWith("sim-"));

    const papers = [
      { asg: hw1, stno: "4101", hwCode: "H01", answers: hw1.key.slice(), note: "功課滿分" },
      { asg: hw1, stno: "4102", hwCode: "H01", answers: mutateAnswers(hw1.key, [15, 16, 17, 18, 19]), note: "功課 15/20" },
      { asg: hw1, stno: "4103", hwCode: "H01", answers: Array(20).fill("A"), note: "功課全填 A" },
      { asg: hw1, stno: "4104", hwCode: "H01", answers: hw1.key.map((k, i) => (i >= 16 ? "" : k)), note: "功課末四題空白" },
      { asg: hw1, stno: "4105", hwCode: "H01", answers: hw1.key.slice(), extraMarks: [{ q: 0, opt: "B" }], note: "功課 Q1 雙填" },
      { asg: hw1, stno: "4112", hwCode: "", answers: mutateAnswers(hw1.key, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]), note: "功課未填編號" },
      { asg: hw2, stno: "4201", hwCode: "H02", answers: hw2.key.slice(), note: "功課2滿分 4B01" },
      { asg: hw2, stno: "4208", hwCode: "H02", answers: mutateAnswers(hw2.key, [1, 3, 5, 7, 9, 11]), note: "功課2 14/20" },
      { asg: hw2, stno: "4215", hwCode: "H02", answers: Array(20).fill("C"), note: "功課2 全 C" },
      { asg: ut1, stno: "4106", hwCode: "U01", answers: ut1.key.slice(), note: "統測滿分" },
      { asg: ut1, stno: "4109", hwCode: "U01", answers: mutateAnswers(ut1.key, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), note: "統測 10/20" },
      { asg: ut1, stno: "4304", hwCode: "U01", answers: Array(20).fill("A"), note: "統測全錯 4C04" }
    ];

    const specOf = (asg) => ({
      kind: "mc",
      n: asg.n,
      subject: asg.subject,
      title: asg.title,
      schoolName: state.schoolName || "HTMS"
    });

    const omr = [];
    const byAsg = new Map();
    for (let i = 0; i < papers.length; i++) {
      const p = papers[i];
      const canvas = rasterizeSheet(specOf(p.asg), {
        stno: p.stno,
        hwCode: p.hwCode,
        answers: p.answers,
        extraMarks: p.extraMarks
      });
      const read = readSheet(canvas, { n: p.asg.n, forceKind: "mc" });
      read.assignmentId = p.asg.id;
      const gExpect = gradeAnswers(p.answers.map((a, qi) => (p.extraMarks && p.extraMarks.some((m) => m.q === qi) ? "*" : a)), p.asg.key);
      const gRead = gradeAnswers(read.answers, p.asg.key);
      const row = {
        note: p.note,
        expect: { stno: p.stno, hwCode: p.hwCode || "", score: gExpect.score, max: gExpect.max },
        read: {
          ok: read.ok,
          stno: read.stno,
          stnoOk: read.stnoOk,
          hwCode: read.hwCode,
          hwOk: read.hwOk,
          answers: read.answers.slice(),
          flags: (read.flags || []).slice(),
          score: gRead.score,
          max: gRead.max
        },
        matchStno: read.stno === p.stno,
        matchHw: (p.hwCode ? read.hwCode === p.hwCode : !read.hwOk),
        matchAns: read.answers.every((a, qi) => {
          if (p.extraMarks && p.extraMarks.some((m) => m.q === qi)) return a === "*";
          return a === (p.answers[qi] || "");
        })
      };
      omr.push(row);
      if (!byAsg.has(p.asg.id)) byAsg.set(p.asg.id, { asg: p.asg, rows: [] });
      byAsg.get(p.asg.id).rows.push(read);
    }

    const writtenCanvas = rasterizeSheet({
      kind: "written",
      n: 20,
      subject: "ECON",
      title: hw1.title,
      schoolName: state.schoolName || "HTMS"
    }, { stno: "4101", hwCode: "H01" });
    const writtenRead = readSheet(writtenCanvas, { n: 20, forceKind: "written" });

    for (const pack of byAsg.values()) {
      lastReview = pack.rows;
      await commitMc(pack.rows, pack.asg, "sim-scan");
    }
    await commitWritten([writtenRead], hw1, []);

    const analysis = [hw1, hw2, ut1].map((asg) => {
      const { rows, stats } = analysisOf(asg);
      const graded = rows.map((s) => {
        const g = gradeAnswers(s.answers, asg.key);
        return { stno: s.stno, hwCode: s.hwCode, score: g.score, max: g.max, classLabel: (parseStno(s.stno) || {}).label };
      }).sort((a, b) => String(a.stno).localeCompare(String(b.stno)));
      return {
        id: asg.id,
        title: asg.title,
        n: asg.n,
        scripts: graded.length,
        avg: graded.length ? Math.round(10 * graded.reduce((p, s) => p + (s.score || 0), 0) / graded.length) / 10 : 0,
        scores: graded,
        facility: stats.map((st) => ({ q: st.q, key: st.key, pct: st.pct, counts: st.counts }))
      };
    });

    saveState(state);
    teacherTab = "scores";
    renderApp();

    const failed = omr.filter((r) => !r.matchStno || !r.matchHw || !r.matchAns || !r.read.ok);
    return {
      pass: failed.length === 0 && writtenRead.stno === "4101" && writtenRead.hwCode === "H01" && writtenRead.kind === "written",
      paperCount: omr.length,
      failed: failed.map((r) => ({ note: r.note, expect: r.expect, read: r.read, matchStno: r.matchStno, matchHw: r.matchHw, matchAns: r.matchAns })),
      omr,
      written: { stno: writtenRead.stno, hwCode: writtenRead.hwCode, kind: writtenRead.kind, ok: writtenRead.ok },
      analysis
    };
  }

  /* ---------- files ---------- */

  function fitCanvas(src, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
    if (scale >= 0.98) return src;
    const c = document.createElement("canvas");
    c.width = Math.round(src.width * scale);
    c.height = Math.round(src.height * scale);
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  async function fileToCanvases(file) {
    const name = file.name || "";
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);
    if (isPdf) {
      if (!window.pdfjsLib) throw new Error("pdfjs");
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      }
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2.15 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        pages.push(fitCanvas(canvas, 2800));
      }
      return pages;
    }
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d").drawImage(bmp, 0, 0);
    bmp.close && bmp.close();
    return [fitCanvas(canvas, 2800)];
  }

  function currentSpec(state, assignment, kind) {
    return {
      kind: kind || "mc",
      schoolName: state.schoolName || "HTMS",
      subject: assignment ? assignment.subject : "ECON",
      title: assignment ? assignment.title : "",
      n: assignment ? assignment.n : 40
    };
  }

  function openAssignments(state) {
    return (state.assignments || []).filter((a) => a.open !== false);
  }

  /* ---------- UI ---------- */

  let state = defaultState();
  let teacherTab = "work";
  let lastReview = [];
  let lastAssignmentId = "";
  let syncNote = "";

  function setLang(en) {
    lang = en ? "en" : "zh";
    document.documentElement.lang = en ? "en" : "zh-HK";
    document.body.classList.toggle("en", en);
    document.querySelectorAll(".zh").forEach((n) => { n.hidden = !!en; });
    document.querySelectorAll(".en").forEach((n) => { n.hidden = !en; });
    $("btn-en").classList.toggle("active", en);
    $("btn-zh").classList.toggle("active", !en);
    const params = new URLSearchParams(location.search);
    params.set("lang", en ? "en" : "zh-hk");
    history.replaceState(null, "", "?" + params.toString() + location.hash);
    $("link-home").href = "../index.html?lang=" + (en ? "en" : "zh-hk");
    document.title = t("MC 答題紙批改", "MC answer-sheet grader");
    renderApp();
  }

  function status(msg, isErr) {
    const eln = $("mc-status");
    if (!eln) return;
    eln.textContent = msg || "";
    eln.classList.toggle("err", !!isErr);
  }

  function assignmentSelectHtml(id, includeClosed) {
    const list = includeClosed ? state.assignments : openAssignments(state);
    if (!list.length) return '<option value="">' + t("（未有作業）", "(No assignment)") + "</option>";
    return list.map((a) =>
      '<option value="' + a.id + '"' + (a.id === lastAssignmentId ? " selected" : "") + ">" + escapeHtml(a.title || t("未命名", "Untitled")) + " · " + a.subject + " · " + a.n + t("題", "Q") + "</option>"
    ).join("");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function sourceLabel(s) {
    if (s === "web") return t("網頁作答", "Web form");
    if (s === "student-upload") return t("學生上載", "Student upload");
    if (s === "teacher-scan" || s === "sim-scan") return t("掃描", "Scan");
    return String(s || "");
  }

  function selectedAssignment(selId) {
    const fromSel = ($(selId) && $(selId).value) || "";
    const id = fromSel || lastAssignmentId || "";
    const asg = state.assignments.find((a) => a.id === id) || openAssignments(state)[0] || state.assignments[0] || null;
    if (asg) lastAssignmentId = asg.id;
    return asg;
  }

  function bindAsgSelect(onChange) {
    const sel = $("t-asg");
    if (!sel) return;
    if (lastAssignmentId && [...sel.options].some((o) => o.value === lastAssignmentId)) {
      sel.value = lastAssignmentId;
    } else if (sel.value) {
      lastAssignmentId = sel.value;
    }
    sel.onchange = () => {
      lastAssignmentId = sel.value;
      if (onChange) onChange();
    };
  }

  function printSpec(kind) {
    const a = getRole() === "teacher" ? selectedAssignment("t-asg") : selectedAssignment("s-asg");
    const spec = currentSpec(state, a, kind);
    const root = $("print-root");
    root.innerHTML = "";
    sheetsForPrint(spec).forEach((sh) => placeSheet(root, sh));
    document.body.classList.add("printing");
    const done = () => {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 50);
  }

  async function downloadSheetPdf(kind) {
    if (!window.jspdf || !window.html2canvas) {
      printSpec(kind);
      return;
    }
    const a = getRole() === "teacher" ? selectedAssignment("t-asg") : selectedAssignment("s-asg");
    const spec = currentSpec(state, a, kind);
    const holder = el("div");
    holder.style.cssText = "position:fixed;left:-5000px;top:0;background:#fff;";
    const sheets = sheetsForPrint(spec);
    sheets.forEach((sh) => placeSheet(holder, sh));
    document.body.appendChild(holder);
    const JsPDF = window.jspdf.jsPDF;
    const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    for (let i = 0; i < sheets.length; i++) {
      const canvas = await html2canvas(sheets[i], { scale: 2, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i) doc.addPage();
      doc.addImage(img, "JPEG", 0, 0, 210, 297);
    }
    document.body.removeChild(holder);
    const fname = (kind === "written" ? "HTMS-written-" : "HTMS-MC-") + (spec.subject || "") + ".pdf";
    doc.save(fname);
  }

  async function processMcFiles(fileList, source) {
    const assignment = getRole() === "teacher" ? selectedAssignment("t-asg") : selectedAssignment("s-asg");
    if (!assignment) {
      status(t("請先選一份作業。", "Choose an assignment first."), true);
      return;
    }
    lastAssignmentId = assignment.id;
    const files = [...fileList];
    if (!files.length) return;
    status(t("正在辨識…", "Reading…"));
    const rows = [];
    for (let f = 0; f < files.length; f++) {
      let canvases;
      try {
        canvases = await fileToCanvases(files[f]);
      } catch (err) {
        rows.push({ ok: false, file: files[f].name, message: t("無法開啟檔案。", "Could not open this file.") });
        continue;
      }
      for (let p = 0; p < canvases.length; p++) {
        status(t("正在辨識… ", "Reading… ") + (f + 1) + "/" + files.length + " · p." + (p + 1));
        const read = readSheet(canvases[p], { n: assignment.n, forceKind: source === "written" ? "written" : undefined });
        read.file = files[f].name + (canvases.length > 1 ? " p." + (p + 1) : "");
        read.assignmentId = assignment.id;
        rows.push(read);
      }
    }
    lastReview = rows;
    if (source === "written" || rows.some((r) => r.kind === "written")) {
      await commitWritten(rows, assignment, files);
    } else {
      await commitMc(rows, assignment, source);
    }
    renderApp();
  }

  async function commitMc(rows, assignment, source) {
    let saved = 0, failed = 0;
    rows.forEach((r) => {
      if (!r.ok) {
        failed += 1;
        return;
      }
      if (r.kind === "written") return;
      r.assignmentId = assignment.id;
      lastAssignmentId = assignment.id;
      let stno = r.stnoOk ? r.stno : "";
      if (!stno) {
        const typed = prompt(t("未能讀到學號。請輸入 4 位數字（例如 4101）：", "Could not read class no. Enter 4 digits (e.g. 4101):"), String(r.stno || "").replace(/\D/g, "").slice(0, 4));
        if (/^\d{4}$/.test(String(typed || "").trim())) {
          stno = String(typed).trim();
          r.stno = stno;
          r.stnoOk = true;
        } else {
          r.needStno = true;
          failed += 1;
          return;
        }
      }
      const g = gradeAnswers(r.answers, assignment.key);
      const sub = {
        id: uid(),
        assignmentId: assignment.id,
        stno,
        hwCode: r.hwOk ? r.hwCode : "",
        name: lookupName(stno) || r.name || "",
        answers: r.answers,
        score: g.score,
        max: g.max,
        flags: r.flags,
        source: source || "scan",
        at: new Date().toISOString()
      };
      upsertMc(state, sub);
      saved += 1;
    });
    saveState(state);
    const remote = await pushRemote("submitMcBatch", {
      assignmentId: assignment.id,
      submissions: state.mcSubmissions.filter((s) => s.assignmentId === assignment.id)
    });
    syncNote = remote && remote.ok ? t("已同步到雲端。", "Synced.") : t("本機已儲存（雲端未接上時，成績留在這部電腦）。", "Saved on this device. Cloud sync is off until Blob storage is connected.");
    if (getRole() === "student") {
      const first = rows.find((r) => r.ok && r.stnoOk);
      status(
        t("已交卷。學號 ", "Submitted. Class no. ") + (first ? first.stno : "") +
        (first && first.hwOk ? " · " + first.hwCode : "") +
        t("。同一學號再交會覆蓋。", ". Submit again with the same class no. to replace."),
        false
      );
    } else {
      status(t("完成：讀到 ", "Done: read ") + saved + t(" 份。", " script(s).") + (failed ? t(" 未能入帳 ", " Not filed ") + failed + t(" 頁。", " page(s).") : ""), failed && !saved);
    }
  }

  async function commitWritten(rows, assignment, files) {
    let saved = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.ok || !r.stnoOk) continue;
      if (r.kind === "mc" && getRole() === "teacher") continue;
      const sub = {
        id: uid(),
        assignmentId: assignment.id,
        stno: r.stno,
        hwCode: r.hwOk ? r.hwCode : "",
        name: lookupName(r.stno) || "",
        fileName: r.file || "",
        kind: "pdf",
        source: getRole() === "student" ? "student-upload" : "teacher-scan",
        at: new Date().toISOString()
      };
      upsertPdf(state, sub);
      if (files && files[0]) {
        try { await idbPut("pdf:" + sub.id, files[Math.min(i, files.length - 1)]); } catch {}
      }
      saved += 1;
    }
    saveState(state);
    await pushRemote("submitPdfBatch", { assignmentId: assignment.id, submissions: state.pdfSubmissions.filter((s) => s.assignmentId === assignment.id) });
    status(t("已收 PDF 作答紙 ", "Collected written scripts: ") + saved + t(" 份。學號已辨識；長題需老師自行批改。", ". Class no. read; written work is not auto-marked."));
  }

  function analysisOf(assignment) {
    const rows = state.mcSubmissions.filter((s) => s.assignmentId === assignment.id && Array.isArray(s.answers));
    const n = assignment.n;
    const key = assignment.key || [];
    const stats = [];
    for (let q = 0; q < n; q++) {
      const k = key[q];
      const counts = { A: 0, B: 0, C: 0, D: 0, blank: 0, star: 0 };
      let correct = 0;
      rows.forEach((s) => {
        const a = s.answers[q];
        if (!a) counts.blank += 1;
        else if (a === "*") counts.star += 1;
        else if (counts[a] != null) counts[a] += 1;
        if (k && k !== "-" && a === k) correct += 1;
      });
      const total = rows.length;
      stats.push({ q: q + 1, key: k || "", counts, correct, total, pct: total ? Math.round(1000 * correct / total) / 10 : 0 });
    }
    return { rows, stats };
  }

  function exportCsv(assignment) {
    const { rows } = analysisOf(assignment);
    const n = assignment.n;
    const head = ["stno", "class", "hwCode", "name", "score", "max"].concat(Array.from({ length: n }, (_, i) => "Q" + (i + 1)));
    const lines = [head.join(",")];
    rows.slice().sort((a, b) => a.stno.localeCompare(b.stno)).forEach((s) => {
      const p = parseStno(s.stno);
      const g = gradeAnswers(s.answers, assignment.key);
      const cells = [s.stno, (p && p.label) || "", s.hwCode || "", csvCell(s.name), g.score, g.max];
      for (let i = 0; i < n; i++) cells.push(s.answers[i] || "");
      lines.push(cells.join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (assignment.title || "mc") + "-scores.csv";
    a.click();
  }

  function csvCell(s) {
    const v = String(s || "");
    if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function renderGate() {
    $("app-student").hidden = true;
    $("app-teacher").hidden = true;
    $("gate").hidden = false;
  }

  function renderApp() {
    const role = getRole();
    if (!role) {
      renderGate();
      return;
    }
    $("gate").hidden = true;
    $("app-student").hidden = role !== "student";
    $("app-teacher").hidden = role !== "teacher";
    $("who").textContent = role === "teacher" ? t("老師頁面", "Teacher") : t("交功課", "Submit homework");
    if (role === "student") renderStudent();
    else renderTeacher();
  }

  function renderStudent() {
    const box = $("app-student");
    const asgList = openAssignments(state);
    box.innerHTML =
      '<p class="lead">' + t("可在下面用按鈕填學號與答案，直接交卷；亦可列印塗卡紙後拍照上載。長題請用 PDF 作答紙。",
        "Fill class no. and answers with the buttons below and submit on this page, or print the bubble sheet and upload a photo. For written work, use the PDF template.") + "</p>" +
      '<label>' + t("作業", "Assignment") + '<select id="s-asg">' + assignmentSelectHtml("s-asg", false) + "</select></label>" +
      (asgList.length ? "" : '<p class="warn">' + t("老師尚未開放作業。你仍可下載空白紙；網頁交卷須等老師開放。", "No assignment is open yet. You can still download a blank sheet. Web submit waits until one is open.") + "</p>") +
      '<div class="web-card" id="s-web"></div>' +
      '<div class="paper-sec">' +
        "<h2>" + t("紙本交卷", "Paper submission") + "</h2>" +
        '<p class="hint">' + t("列印時請用 A4、實際大小。學號四格：4A01 → 4101。功課／UT：H03、U12。", "Print A4 at actual size. Class no.: 4A01 → 4101. HW/UT: H03, U12.") + "</p>" +
        '<div class="actions">' +
          '<button type="button" class="btn" id="s-print-mc">' + t("列印 MC 答題紙", "Print MC sheet") + "</button>" +
          '<button type="button" class="btn" id="s-dl-mc">' + t("下載 MC PDF", "Download MC PDF") + "</button>" +
          '<button type="button" class="btn" id="s-print-wr">' + t("列印 PDF 作答紙", "Print written sheet") + "</button>" +
          '<button type="button" class="btn" id="s-dl-wr">' + t("下載作答紙 PDF", "Download written PDF") + "</button>" +
        "</div>" +
        '<div class="drop" id="s-drop-mc"><strong>' + t("上載已填的 MC 紙", "Upload a filled MC sheet") + "</strong><p>" + t("拖入或點選相片／PDF（可多頁，一人一頁）。", "Drop or choose a photo / PDF (one student per page).") + '</p><input id="s-file-mc" type="file" accept="image/*,application/pdf" multiple></div>' +
        '<div class="drop" id="s-drop-pdf"><strong>' + t("上載 PDF 作答紙", "Upload written PDF") + "</strong><p>" + t("請用本頁範本，首頁須填學號圓圈。", "Use this page’s template. Fill the class-no. bubbles on page 1.") + '</p><input id="s-file-pdf" type="file" accept="application/pdf,image/*"></div>' +
      "</div>";
    bindStudent();
    paintWebForm();
  }

  const WEB_DRAFT_KEY = "htms-mc-web-draft-v1";

  function loadWebDraft() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(WEB_DRAFT_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function saveWebDraft(draft) {
    try { sessionStorage.setItem(WEB_DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }

  function webBub(prefix, values, selected) {
    return values.map((v) =>
      '<button type="button" class="web-bub' + (String(selected) === String(v) ? " on" : "") + '" data-web="' + prefix + '" data-v="' + escapeHtml(String(v)) + '">' + escapeHtml(String(v)) + "</button>"
    ).join("");
  }

  function webCol(cap, prefix, values, selected) {
    return '<div class="web-col"><span class="cap">' + cap + "</span>" + webBub(prefix, values, selected) + "</div>";
  }

  function webSelected(prefix) {
    const on = document.querySelector('#s-web .web-bub.on[data-web="' + prefix + '"]');
    return on ? on.getAttribute("data-v") : "";
  }

  function readWebForm(n) {
    const stno = [0, 1, 2, 3].map((d) => webSelected("id" + d)).join("");
    const hw = webSelected("hwk") + webSelected("hw1") + webSelected("hw2");
    const answers = [];
    for (let i = 0; i < n; i++) answers.push(webSelected("q" + i) || "");
    return {
      name: ($("s-web-name") && $("s-web-name").value.trim()) || "",
      stno,
      hw,
      answers
    };
  }

  function persistWebForm(assignment) {
    if (!assignment) return;
    const cur = readWebForm(assignment.n);
    saveWebDraft({
      assignmentId: assignment.id,
      name: cur.name,
      stno: cur.stno,
      hw: cur.hw,
      answers: cur.answers
    });
  }

  function paintWebSummary(assignment) {
    const eln = $("s-web-sum");
    if (!eln || !assignment) return;
    const cur = readWebForm(assignment.n);
    const p = parseStno(cur.stno);
    const hw = parseHwCode(cur.hw);
    const filled = cur.answers.filter(Boolean).length;
    const bits = [];
    bits.push(p ? t("學號 ", "No. ") + cur.stno + "（" + p.label + "）" : t("尚未填齊四位學號", "Class no. incomplete"));
    bits.push(hw ? hwDisplay(hw.code) : t("功課／UT 未填或未填齊", "HW/UT incomplete"));
    bits.push(t("已答 ", "Answered ") + filled + "/" + assignment.n);
    eln.textContent = bits.join("  ·  ");
  }

  function paintWebForm() {
    const host = $("s-web");
    if (!host) return;
    const assignment = selectedAssignment("s-asg");
    if (!assignment) {
      host.innerHTML = "<p class='hint'>" + t("選一份已開放的作業後，即可在此用按鈕作答。", "Choose an open assignment to answer with buttons here.") + "</p>";
      return;
    }
    let draft = loadWebDraft();
    if (draft.assignmentId && draft.assignmentId !== assignment.id) {
      draft = { name: draft.name || "", stno: draft.stno || "", hw: draft.hw || "", answers: [] };
    }
    const stno = String(draft.stno || "    ");
    const hw = String(draft.hw || "   ");
    const ans = Array.isArray(draft.answers) ? draft.answers : [];
    const n = assignment.n;
    const cols = Math.min(3, Math.max(1, n));
    const qRows = Math.ceil(n / cols);
    let qHtml = "";
    for (let i = 0; i < n; i++) {
      qHtml += '<div class="web-q"><span class="qn">' + (i + 1) + "</span>" + webBub("q" + i, OPTS, ans[i] || "") + "</div>";
    }
    host.innerHTML =
      "<h2>" + t("網頁作答（按鈕）", "Web answer sheet (buttons)") + "</h2>" +
      '<p class="hint">' + t("點圓圈作答，再按「交卷」。不必列印。同一學號再交會覆蓋上次。", "Tap the circles, then Submit. No printing needed. Submitting again with the same class no. replaces the last script.") + "</p>" +
      '<p class="hint">' + escapeHtml(assignment.title || "") + " · " + assignment.subject + " · " + n + t("題", "Q") + "</p>" +
      '<label>' + t("姓名（可選）", "Name (optional)") + '<input id="s-web-name" type="text" maxlength="80" value="' + escapeHtml(draft.name || "") + '"></label>' +
      '<div class="web-meta">' +
        '<div class="web-block">' +
          "<h3>" + t("功課 / UT 編號", "HW / UT code") + "</h3>" +
          '<p class="hint">' + t("H＝功課，U＝統測，後兩格 0–9。例：功課 3 → H 0 3。", "H = homework, U = uniform test, then two digits. e.g. HW 3 → H 0 3.") + "</p>" +
          '<div class="web-cols">' +
            webCol("H/U", "hwk", ["H", "U"], hw[0] || "") +
            webCol(t("十", "Tens"), "hw1", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], hw[1] || "") +
            webCol(t("個", "Ones"), "hw2", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], hw[2] || "") +
          "</div>" +
        "</div>" +
        '<div class="web-block">' +
          "<h3>" + t("班別 / 學號", "Class no.") + "</h3>" +
          '<p class="web-idex">4A01 → 4101</p>' +
          '<p class="hint">' + t("首位年級，次位班別（1＝A、2＝B），後兩位班號。", "Form, class (1=A, 2=B), then class number.") + "</p>" +
          '<div class="web-cols">' +
            webCol("D1", "id0", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], stno[0] || "") +
            webCol("D2", "id1", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], stno[1] || "") +
            webCol("D3", "id2", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], stno[2] || "") +
            webCol("D4", "id3", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], stno[3] || "") +
          "</div>" +
        "</div>" +
      "</div>" +
      '<p class="web-sum" id="s-web-sum"></p>' +
      "<h3>" + t("選擇題", "MC items") + "</h3>" +
      '<div class="web-qs" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr));grid-template-rows:repeat(' + qRows + ',auto)">' + qHtml + "</div>" +
      '<div class="actions">' +
        '<button type="button" class="btn primary" id="s-web-submit">' + t("交卷", "Submit") + "</button>" +
        '<button type="button" class="btn" id="s-web-clear">' + t("清空答案", "Clear answers") + "</button>" +
      "</div>";
    paintWebSummary(assignment);
    host.onclick = (e) => {
      const b = e.target.closest(".web-bub");
      if (!b || !host.contains(b)) return;
      const prefix = b.getAttribute("data-web");
      const wasOn = b.classList.contains("on");
      host.querySelectorAll('.web-bub[data-web="' + prefix + '"]').forEach((x) => x.classList.remove("on"));
      if (!wasOn) b.classList.add("on");
      persistWebForm(assignment);
      paintWebSummary(assignment);
    };
    if ($("s-web-name")) {
      $("s-web-name").oninput = () => persistWebForm(assignment);
    }
    $("s-web-submit").onclick = () => submitWebForm(assignment);
    $("s-web-clear").onclick = () => {
      if (!confirm(t("清空本題答案？學號與編號會保留。", "Clear MC answers? Class no. and HW/UT stay."))) return;
      const d = loadWebDraft();
      d.answers = [];
      d.assignmentId = assignment.id;
      saveWebDraft(d);
      paintWebForm();
    };
  }

  async function submitWebForm(assignment) {
    if (!assignment || assignment.open === false) {
      status(t("這份作業未開放交卷。", "This assignment is not open."), true);
      return;
    }
    persistWebForm(assignment);
    const cur = readWebForm(assignment.n);
    if (!/^\d{4}$/.test(cur.stno)) {
      status(t("請先填齊四位學號（例：4A01 → 4101）。", "Fill all four class-no. digits first (e.g. 4A01 → 4101)."), true);
      return;
    }
    const hwParsed = parseHwCode(cur.hw);
    const filled = cur.answers.filter(Boolean).length;
    const p = parseStno(cur.stno);
    const msg = t("確定交卷？", "Submit now?") +
      "\n" + t("學號 ", "Class no. ") + cur.stno + (p ? "（" + p.label + "）" : "") +
      "\n" + (hwParsed ? hwDisplay(hwParsed.code) : t("功課／UT：未填", "HW/UT: blank")) +
      "\n" + t("已答 ", "Answered ") + filled + "/" + assignment.n +
      (filled < assignment.n ? t("（尚有空白）", " (some blank)") : "");
    if (!confirm(msg)) return;
    const row = {
      ok: true,
      kind: "mc",
      stno: cur.stno,
      stnoOk: true,
      stnoLabel: p ? p.label : "",
      hwCode: hwParsed ? hwParsed.code : "",
      hwOk: !!hwParsed,
      answers: cur.answers.slice(),
      flags: [],
      assignmentId: assignment.id,
      name: cur.name
    };
    await commitMc([row], assignment, "web");
    renderApp();
  }

  function bindStudent() {
    $("s-print-mc").onclick = () => printSpec("mc");
    $("s-dl-mc").onclick = () => downloadSheetPdf("mc");
    $("s-print-wr").onclick = () => printSpec("written");
    $("s-dl-wr").onclick = () => downloadSheetPdf("written");
    $("s-file-mc").onchange = (e) => processMcFiles(e.target.files, "student-upload");
    $("s-file-pdf").onchange = (e) => processMcFiles(e.target.files, "written");
    if ($("s-asg")) {
      $("s-asg").onchange = () => {
        lastAssignmentId = $("s-asg").value;
        paintWebForm();
      };
    }
    ["s-drop-mc", "s-drop-pdf"].forEach((id) => {
      const z = $(id);
      z.ondragover = (e) => { e.preventDefault(); z.classList.add("over"); };
      z.ondragleave = () => z.classList.remove("over");
      z.ondrop = (e) => {
        e.preventDefault();
        z.classList.remove("over");
        processMcFiles(e.dataTransfer.files, id === "s-drop-pdf" ? "written" : "student-upload");
      };
    });
  }

  function renderTeacher() {
    const box = $("app-teacher");
    const tabs = [
      ["work", t("作業與答案", "Assignment & key")],
      ["print", t("列印", "Print")],
      ["scan", t("上載批改", "Scan & mark")],
      ["scores", t("成績", "Results")]
    ];
    box.innerHTML =
      '<div class="tabs">' + tabs.map(([id, lab]) =>
        '<button type="button" data-tab="' + id + '"' + (teacherTab === id ? ' class="active"' : "") + ">" + lab + "</button>"
      ).join("") + "</div>" +
      '<div id="t-panel"></div>';
    box.querySelector(".tabs").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      teacherTab = b.dataset.tab;
      renderTeacher();
    };
    if (teacherTab === "work") renderWork($("t-panel"));
    else if (teacherTab === "print") renderPrint($("t-panel"));
    else if (teacherTab === "scan") renderScan($("t-panel"));
    else renderScores($("t-panel"));
  }

  function renderWork(panel) {
    const a = state.assignments[0] || null;
    panel.innerHTML =
      '<label>' + t("學校名稱", "School name") + '<input id="t-school" type="text" value="' + escapeHtml(state.schoolName || "HTMS") + '"></label>' +
      '<div class="row-split">' +
        '<label>' + t("現有作業", "Assignments") + '<select id="t-asg">' + assignmentSelectHtml("t-asg", true) + "</select></label>" +
        '<button type="button" class="btn" id="t-new">' + t("新增作業", "New assignment") + "</button>" +
      "</div>" +
      '<div class="card" id="t-asg-form"></div>' +
      '<p class="hint">' + t("紙本掃描批改只需這部電腦。若要學生在家上載、老師另一部電腦看成績，請在 Vercel 專案接上 Blob 儲存。", "Paper scans are marked on this computer. For students to upload at home and you to see results on another device, connect Blob storage on the Vercel project.") + "</p>" +
      '<p class="hint">' + (syncNote || "") + "</p>";
    $("t-school").onchange = () => {
      state.schoolName = $("t-school").value.trim() || "HTMS";
      saveState(state);
      pushRemote("saveMeta", { schoolName: state.schoolName });
    };
    $("t-new").onclick = () => {
      const n = {
        id: uid(),
        title: t("新作業", "New assignment"),
        subject: "ECON",
        n: 40,
        key: Array(40).fill(""),
        open: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.assignments.unshift(n);
      lastAssignmentId = n.id;
      saveState(state);
      pushRemote("upsertAssignment", { assignment: n });
      renderWork(panel);
    };
    bindAsgSelect(fillAsgForm);
    fillAsgForm();
    function fillAsgForm() {
      const asg = selectedAssignment("t-asg");
      const form = $("t-asg-form");
      if (!asg) {
        form.innerHTML = "<p class='hint'>" + t("按「新增作業」開始。", "Click New assignment to start.") + "</p>";
        return;
      }
      form.innerHTML =
        '<label>' + t("標題", "Title") + '<input id="a-title" type="text" value="' + escapeHtml(asg.title) + '"></label>' +
        '<label>' + t("科目", "Subject") + '<select id="a-subj">' +
          SUBJECTS.map((s) => '<option value="' + s.id + '"' + (asg.subject === s.id ? " selected" : "") + ">" + t(s.zh, s.en) + "</option>").join("") +
        "</select></label>" +
        '<label>' + t("題數（最多 60）", "Number of questions (max 60)") + '<input id="a-n" type="number" min="1" max="60" value="' + asg.n + '"></label>' +
        '<label class="chk"><input id="a-open" type="checkbox"' + (asg.open !== false ? " checked" : "") + "> " + t("開放給學生交功課", "Open for student submission") + "</label>" +
        '<label>' + t("標準答案（可貼 ABCDA… 或 1A 2C）", "Answer key (paste ABCDA… or 1A 2C)") +
          '<textarea id="a-key" rows="3">' + escapeHtml(keyToText(asg)) + "</textarea></label>" +
        '<div class="key-grid" id="a-key-grid"></div>' +
        '<div class="actions">' +
          '<button type="button" class="btn primary" id="a-save">' + t("儲存作業", "Save assignment") + "</button>" +
          '<button type="button" class="btn danger" id="a-del">' + t("刪除作業", "Delete") + "</button>" +
        "</div>";
      drawKeyGrid(asg);
      $("a-n").onchange = () => {
        const n = Math.max(1, Math.min(60, Number($("a-n").value) || 40));
        $("a-n").value = n;
        asg.n = n;
        if (!Array.isArray(asg.key)) asg.key = [];
        while (asg.key.length < n) asg.key.push("");
        asg.key = asg.key.slice(0, n);
        drawKeyGrid(asg);
      };
      $("a-key").onchange = () => {
        asg.key = parseKey($("a-key").value, asg.n);
        drawKeyGrid(asg);
      };
      $("a-save").onclick = () => saveAsgFromForm(asg);
      $("a-del").onclick = () => {
        if (!confirm(t("刪除此作業及本機相關成績？", "Delete this assignment and its scores on this device?"))) return;
        state.assignments = state.assignments.filter((x) => x.id !== asg.id);
        saveState(state);
        pushRemote("deleteAssignment", { id: asg.id });
        renderApp();
      };
    }
  }

  function drawKeyGrid(asg) {
    const g = $("a-key-grid");
    if (!g) return;
    g.innerHTML = "";
    for (let i = 0; i < asg.n; i++) {
      const row = el("div", "key-row");
      row.innerHTML = '<span>Q' + (i + 1) + "</span>";
      OPTS.forEach((o) => {
        const b = el("button", "opt" + (asg.key[i] === o ? " on" : ""));
        b.type = "button";
        b.textContent = o;
        b.onclick = () => {
          asg.key[i] = asg.key[i] === o ? "" : o;
          $("a-key").value = keyToText(asg);
          drawKeyGrid(asg);
        };
        row.appendChild(b);
      });
      g.appendChild(row);
    }
  }

  function keyToText(asg) {
    const key = asg.key || [];
    if (key.every((k) => k)) return key.join("");
    return key.map((k, i) => (k ? (i + 1) + k : "")).filter(Boolean).join(" ");
  }

  function parseKey(text, n) {
    const raw = String(text || "").toUpperCase().replace(/[^A-D0-9\s,]/g, "");
    const key = Array(n).fill("");
    const compact = raw.replace(/[^A-D]/g, "");
    if (compact.length === n) {
      for (let i = 0; i < n; i++) key[i] = compact[i];
      return key;
    }
    const re = /(\d+)\s*([A-D])/g;
    let m;
    while ((m = re.exec(raw))) {
      const i = Number(m[1]) - 1;
      if (i >= 0 && i < n) key[i] = m[2];
    }
    if (key.some(Boolean)) return key;
    for (let i = 0; i < Math.min(n, compact.length); i++) key[i] = compact[i];
    return key;
  }

  function saveAsgFromForm(asg) {
    asg.title = $("a-title").value.trim() || t("未命名", "Untitled");
    asg.subject = $("a-subj").value;
    asg.n = Math.max(1, Math.min(60, Number($("a-n").value) || 40));
    asg.open = $("a-open").checked;
    asg.key = parseKey($("a-key").value, asg.n);
    asg.updatedAt = new Date().toISOString();
    saveState(state);
    pushRemote("upsertAssignment", { assignment: asg });
    status(t("已儲存作業。", "Assignment saved."));
    renderApp();
  }

  function renderPrint(panel) {
    panel.innerHTML =
      '<label>' + t("列印哪一份作業", "Print which assignment") + '<select id="t-asg">' + assignmentSelectHtml("t-asg", true) + "</select></label>" +
      '<p class="hint">' + t("列印時請用 A4、實際大小（100%），不要「符合頁面」。四角黑格必須印出。", "Print on A4 at 100% actual size, not “fit to page”. Keep the four corner squares.") + "</p>" +
      '<div class="actions">' +
        '<button type="button" class="btn primary" id="t-print-mc">' + t("列印 MC 答題紙", "Print MC sheet") + "</button>" +
        '<button type="button" class="btn" id="t-dl-mc">' + t("下載 MC PDF", "Download MC PDF") + "</button>" +
        '<button type="button" class="btn primary" id="t-print-wr">' + t("列印 PDF 作答紙", "Print written sheet") + "</button>" +
        '<button type="button" class="btn" id="t-dl-wr">' + t("下載作答紙 PDF", "Download written PDF") + "</button>" +
      "</div>" +
      '<div class="preview-wrap" id="t-preview"></div>';
    bindAsgSelect(() => renderPrint(panel));
    const a = selectedAssignment("t-asg");
    const pv = $("t-preview");
    sheetsForPrint(currentSpec(state, a, "mc")).forEach((sh) => {
      sh.classList.add("preview");
      placeSheet(pv, sh);
    });
    sheetsForPrint(currentSpec(state, a, "written")).forEach((sh) => {
      sh.classList.add("preview");
      placeSheet(pv, sh);
    });
    $("t-print-mc").onclick = () => printSpec("mc");
    $("t-dl-mc").onclick = () => downloadSheetPdf("mc");
    $("t-print-wr").onclick = () => printSpec("written");
    $("t-dl-wr").onclick = () => downloadSheetPdf("written");
  }

  function renderScan(panel) {
    panel.innerHTML =
      '<label>' + t("批改哪一份作業", "Mark which assignment") + '<select id="t-asg">' + assignmentSelectHtml("t-asg", true) + "</select></label>" +
      '<div class="drop" id="t-drop"><strong>' + t("上載收回的 MC 紙（PDF 或相片）", "Upload collected MC sheets (PDF or photos)") + "</strong>" +
        '<p>' + t("影印機掃描的多頁 PDF 亦可：一頁一人。", "A multi-page scanner PDF is fine: one student per page.") + "</p>" +
        '<input id="t-file-mc" type="file" accept="application/pdf,image/*" multiple>' +
      "</div>" +
      '<div class="drop" id="t-drop-wr"><strong>' + t("上載收回的 PDF 作答紙", "Upload collected written PDFs") + "</strong>" +
        '<input id="t-file-wr" type="file" accept="application/pdf,image/*" multiple>' +
      "</div>" +
      '<div class="actions">' +
        '<button type="button" class="btn" id="t-test">' + t("試機（合成一張已填紙）", "Self-test (synthetic filled sheet)") + "</button>" +
      "</div>" +
      '<div id="t-review"></div>';
    bindAsgSelect();
    $("t-file-mc").onchange = (e) => processMcFiles(e.target.files, "teacher-scan");
    $("t-file-wr").onchange = (e) => processMcFiles(e.target.files, "written");
    ["t-drop", "t-drop-wr"].forEach((id) => {
      const z = $(id);
      z.ondragover = (e) => { e.preventDefault(); z.classList.add("over"); };
      z.ondragleave = () => z.classList.remove("over");
      z.ondrop = (e) => {
        e.preventDefault();
        z.classList.remove("over");
        processMcFiles(e.dataTransfer.files, id === "t-drop-wr" ? "written" : "teacher-scan");
      };
    });
    $("t-test").onclick = async () => {
      const r = await selfTest();
      status(r.pass
        ? t("試機通過：學號、功課編號與 12 題答案皆讀對。", "Self-test passed: class no., HW/UT code and 12 answers matched.")
        : t("試機未通過。讀到：", "Self-test failed. Read: ") + (r.read && r.read.stno) + " " + (r.read && r.read.hwCode) + " " + ((r.read && r.read.answers) || []).join(""),
      !r.pass);
    };
    paintReview($("t-review"));
  }

  function paintReview(host) {
    if (!host) return;
    if (!lastReview.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = "<h3>" + t("今次辨識", "This batch") + "</h3>" + lastReview.map((r, i) => {
      if (!r.ok) return '<div class="rev bad">' + escapeHtml(r.file || "") + " — " + escapeHtml(r.message || "") + "</div>";
      const g = (r.assignmentId && state.assignments.find((a) => a.id === r.assignmentId)) || selectedAssignment("t-asg");
      const gr = g ? gradeAnswers(r.answers || [], g.key) : { score: "—", max: "" };
      return '<div class="rev">' +
        '<div><strong>' + escapeHtml(r.stno || "?") + "</strong> " + escapeHtml(r.stnoLabel || "") +
        (parseHwCode(r.hwCode) ? " · " + escapeHtml(hwDisplay(r.hwCode)) : "") +
        (r.kind === "written" ? t(" · 作答紙", " · written") : " · " + (gr.score != null ? gr.score + "/" + gr.max : "—")) +
        "</div>" +
        '<div class="muted">' + escapeHtml(r.file || "") + (r.flags && r.flags.length ? " · " + r.flags.join(", ") : "") + "</div>" +
        (r.answers && r.answers.length ? '<div class="ansline">' + r.answers.map((a, qi) => (qi + 1) + (a || "–")).join(" ") + "</div>" : "") +
      "</div>";
    }).join("");
  }

  function renderScores(panel) {
    panel.innerHTML =
      '<label>' + t("查看哪一份作業", "View which assignment") + '<select id="t-asg">' + assignmentSelectHtml("t-asg", true) + "</select></label>" +
      '<div id="t-scorebox"></div>';
    bindAsgSelect(() => fillScores());
    fillScores();
    function fillScores() {
      const asg = selectedAssignment("t-asg");
      const box = $("t-scorebox");
      if (!asg) {
        box.innerHTML = "<p class='hint'>" + t("未有作業。", "No assignment.") + "</p>";
        return;
      }
      const { rows, stats } = analysisOf(asg);
      const graded = rows.map((s) => {
        const g = gradeAnswers(s.answers, asg.key);
        return { ...s, score: g.score, max: g.max };
      }).sort((a, b) => String(a.stno).localeCompare(String(b.stno)));
      const withScore = graded.filter((s) => s.score != null && s.max);
      const avg = withScore.length ? (withScore.reduce((p, s) => p + s.score, 0) / withScore.length) : 0;
      const pdfs = state.pdfSubmissions.filter((s) => s.assignmentId === asg.id);
      box.innerHTML =
        '<div class="statline">' +
          '<div><b>' + graded.length + "</b><span>" + t("MC 交卷", "MC scripts") + "</span></div>" +
          '<div><b>' + (withScore.length ? avg.toFixed(1) + "/" + (withScore[0].max) : "—") + "</b><span>" + t("平均分", "Average") + "</span></div>" +
          '<div><b>' + pdfs.length + "</b><span>" + t("PDF 作答紙", "Written PDFs") + "</span></div>" +
        "</div>" +
        '<div class="actions">' +
          '<button type="button" class="btn primary" id="t-csv">' + t("下載成績 CSV", "Download CSV") + "</button>" +
        "</div>" +
        '<h3>' + t("各人分數", "Scores") + "</h3>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>' + t("學號", "No.") + "</th><th>" + t("班別", "Class") + "</th><th>" + t("功課/UT", "HW/UT") + "</th><th>" + t("姓名", "Name") + "</th><th>" + t("分數", "Score") + "</th><th>%</th><th>" + t("來源", "Source") + "</th></tr></thead><tbody>" +
        (graded.length ? graded.map((s) => {
          const p = parseStno(s.stno);
          const pct = s.max ? Math.round(1000 * s.score / s.max) / 10 : "";
          return "<tr><td>" + escapeHtml(s.stno) + "</td><td>" + escapeHtml((p && p.label) || "") + "</td><td>" + escapeHtml(parseHwCode(s.hwCode) ? hwDisplay(s.hwCode) : "—") + "</td><td>" + escapeHtml(s.name || "") + "</td><td>" + (s.score != null ? s.score + "/" + s.max : "—") + "</td><td>" + pct + "</td><td>" + escapeHtml(sourceLabel(s.source)) + "</td></tr>";
        }).join("") : '<tr><td colspan="7">' + t("尚未有交卷。", "No scripts yet.") + "</td></tr>") +
        "</tbody></table></div>" +
        '<h3>' + t("各題答對率", "Item facility") + "</h3>" +
        '<div class="bars">' + stats.map((st) => {
          const pct = st.pct;
          const cls = pct < 40 ? "low" : pct < 70 ? "mid" : "high";
          return '<div class="bar-row"><span class="qn">Q' + st.q + '</span><span class="k">' + (st.key || "-") + '</span><div class="bar"><i class="' + cls + '" style="width:' + pct + '%"></i></div><span class="pct">' + pct + "%</span>" +
            '<span class="dist">A' + st.counts.A + " B" + st.counts.B + " C" + st.counts.C + " D" + st.counts.D + (st.counts.blank ? t(" 空", " blank") + st.counts.blank : "") + "</span></div>";
        }).join("") + "</div>" +
        (pdfs.length ? "<h3>" + t("已收 PDF 作答紙", "Written PDFs received") + "</h3><ul class='plain'>" +
          pdfs.map((s) => "<li><strong>" + escapeHtml(s.stno) + "</strong> " + escapeHtml(parseHwCode(s.hwCode) ? hwDisplay(s.hwCode) : "") + " " + escapeHtml(s.name || "") + " · " + escapeHtml(s.fileName || "") + "</li>").join("") + "</ul>" : "");
      const csvBtn = $("t-csv");
      if (csvBtn) csvBtn.onclick = () => exportCsv(asg);
    }
  }

  function tryLogin(e) {
    e.preventDefault();
    const raw = ($("mc-pass").value || "").trim();
    const err = $("mc-pass-err");
    if (raw === PASS_TEACHER) {
      setRole("teacher");
      err.hidden = true;
      status("");
      bootApp();
    } else if (raw === PASS_STUDENT) {
      setRole("student");
      err.hidden = true;
      status("");
      bootApp();
    } else {
      err.hidden = false;
      $("mc-pass").select();
    }
    return false;
  }

  async function bootApp() {
    state = loadState();
    state = await pullRemote(state);
    saveState(state);
    renderApp();
  }

  function start() {
    const params = new URLSearchParams(location.search);
    const q = (params.get("lang") || "").toLowerCase();
    state = loadState();
    $("btn-zh").onclick = () => setLang(false);
    $("btn-en").onclick = () => setLang(true);
    $("mc-login").onsubmit = tryLogin;
    $("btn-logout").onclick = () => {
      clearRole();
      $("mc-pass").value = "";
      status("");
      renderGate();
    };
    setLang(q === "en");
    if (getRole()) bootApp();
    else renderGate();
  }

  window.MCGrader = { start, selfTest, readSheet, renderSheet, parseStno, parseHwCode, rasterizeSheet, runReviewSim };
})();
