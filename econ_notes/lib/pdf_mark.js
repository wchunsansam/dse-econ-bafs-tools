const $ = (id) => document.getElementById(id);
const FILE_RE = /^tb\/[A-Za-z0-9._-]+\.pdf$/i;
const FROM_RE = /^[A-Za-z0-9._-]+\.html$/;
const q = new URLSearchParams(location.search);
const file = q.get("file") || "";
const INK_KEY = "pdf-ink:" + file;
const COLORS = [
  { id: "red", hex: "#dc2626" },
  { id: "blue", hex: "#2563eb" },
  { id: "green", hex: "#16a34a" },
  { id: "orange", hex: "#ea580c" },
  { id: "purple", hex: "#7c3aed" },
  { id: "black", hex: "#111827" }
];
const WIDTHS = { thin: 0.0028, mid: 0.0046, thick: 0.0082 };
const ERASE_WIDTHS = { thin: 0.006, mid: 0.012, thick: 0.024 };

let pdfDoc = null;
let studio = null;
let fingerPan = null;

function tUI(zh, en){
  return document.body.classList.contains("en") ? en : zh;
}
function langParam(){
  return document.body.classList.contains("en") ? "en" : "zh-hk";
}
function studentLocked(){
  if(!window.HTMSGate) return false;
  if(typeof HTMSGate.role === "function") return HTMSGate.role() === "student";
  return true;
}
function isAnsFile(f){
  return /_TbEx_Ans\.pdf$/i.test(f);
}
function canPair(f){
  return /_TbEx(_Ans)?\.pdf$/i.test(f);
}
function exFileOf(f){
  return f.replace(/_TbEx_Ans\.pdf$/i, "_TbEx.pdf");
}
function ansFileOf(f){
  if(isAnsFile(f)) return f;
  return f.replace(/_TbEx\.pdf$/i, "_TbEx_Ans.pdf");
}
function langTwin(f, en){
  if(en && f.indexOf("_chi_") !== -1) return f.replace("_chi_", "_eng_");
  if(!en && f.indexOf("_eng_") !== -1) return f.replace("_eng_", "_chi_");
  return f;
}
function markUrl(nextFile){
  const params = new URLSearchParams(location.search);
  params.set("file", nextFile);
  params.set("lang", langParam());
  return "pdf_mark.html?" + params.toString();
}
function setStatus(msg){
  const el = $("pdf-status");
  if(el) el.textContent = msg || "";
}
function fileTitle(){
  const name = (file.split("/").pop() || "").replace(/\.pdf$/i, "");
  const ch = (name.match(/^Ch0?(\d+)/i) || [])[1];
  const ans = isAnsFile(file);
  if(ch){
    return ans
      ? tUI("第 " + ch + " 章書本答案", "Ch." + ch + " Tb Ans")
      : tUI("第 " + ch + " 章書本練習", "Ch." + ch + " Tb Ex");
  }
  return ans ? tUI("書本答案", "Tb Ans") : tUI("書本練習", "Tb Ex");
}
function setLang(en){
  const twin = langTwin(file, en);
  if(twin !== file && FILE_RE.test(twin)){
    persist();
    const params = new URLSearchParams(location.search);
    params.set("lang", en ? "en" : "zh-hk");
    params.set("file", twin);
    location.assign("pdf_mark.html?" + params.toString());
    return;
  }
  document.body.classList.toggle("en", en);
  document.documentElement.lang = en ? "en" : "zh-HK";
  document.querySelectorAll(".zh").forEach(el => { el.hidden = !!en; });
  document.querySelectorAll(".en").forEach(el => { el.hidden = !en; });
  $("btn-zh").classList.toggle("active", !en);
  $("btn-en").classList.toggle("active", en);
  const params = new URLSearchParams(location.search);
  params.set("lang", en ? "en" : "zh-hk");
  history.replaceState(null, "", "?" + params.toString());
  syncBack();
  syncTbSwitch();
  syncLabels();
  document.title = (en ? "DSE ECON | PDF annotator" : "DSE ECON｜PDF 筆記器")
    + (file ? " — " + file.replace(/^tb\//, "") : "");
}
function syncBack(){
  const back = $("link-back");
  const from = q.get("from") || "";
  const lang = "lang=" + langParam();
  if(FROM_RE.test(from)) back.href = from + "?" + lang;
  else back.href = "../index.html?" + lang;
}
function syncTbSwitch(){
  const box = $("tb-switch");
  const ex = $("link-tb-ex");
  const ans = $("link-tb-ans");
  if(!box || !ex || !ans) return;
  const exF = canPair(file) ? exFileOf(file) : "";
  const ansF = canPair(file) ? ansFileOf(file) : "";
  if(studentLocked() || !FILE_RE.test(exF) || !FILE_RE.test(ansF) || exF === ansF){
    box.hidden = true;
    return;
  }
  box.hidden = false;
  ex.href = markUrl(exF);
  ans.href = markUrl(ansF);
  const onAns = isAnsFile(file);
  ex.classList.toggle("active", !onAns);
  ans.classList.toggle("active", onAns);
  if(onAns) ex.removeAttribute("aria-current"); else ex.setAttribute("aria-current", "page");
  if(onAns) ans.setAttribute("aria-current", "page"); else ans.removeAttribute("aria-current");
}
function syncLabels(){
  if($("mark-title")) $("mark-title").textContent = fileTitle();
  if($("mark-tool-pen")) $("mark-tool-pen").textContent = tUI("畫筆", "Pen");
  if($("mark-tool-line")) $("mark-tool-line").textContent = tUI("間尺／直線", "Ruler / line");
  if($("mark-tool-circle")) $("mark-tool-circle").textContent = tUI("圓／橢圓", "Circle / oval");
  if($("mark-tool-eraser")) $("mark-tool-eraser").textContent = tUI("擦膠", "Eraser");
  if($("mark-dash")) $("mark-dash").textContent = tUI("虛線", "Dashed");
  if($("mark-w1")) $("mark-w1").textContent = tUI("幼", "Thin");
  if($("mark-w2")) $("mark-w2").textContent = tUI("中", "Mid");
  if($("mark-w3")) $("mark-w3").textContent = tUI("粗", "Thick");
  if($("mark-undo")) $("mark-undo").textContent = tUI("還原", "Undo");
  if($("mark-redo")) $("mark-redo").textContent = tUI("重做", "Redo");
  if($("mark-zoom-fit")) $("mark-zoom-fit").textContent = tUI("適寬", "Fit");
  if($("mark-prev")) $("mark-prev").textContent = tUI("上一頁", "Prev");
  if($("mark-next")) $("mark-next").textContent = tUI("下一頁", "Next");
  if($("mark-save")) $("mark-save").textContent = tUI("儲存筆記", "Save notes");
  if($("mark-download")) $("mark-download").textContent = tUI("下載 PDF", "Download PDF");
  syncHint();
  syncDrawMode();
}
function isFineMouse(){
  try{
    return window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;
  }catch{
    return true;
  }
}
function defaultHint(){
  return isFineMouse()
    ? tUI("滑鼠一按就畫。筆跡跟頁面座標，放大不會移位。按「儲存筆記」會留在這部裝置，下次打開同一份會還原。", "Mouse draws immediately. Strokes stay on the page when you zoom. Save notes keeps them on this device; they return the next time you open this file.")
    : tUI("預設移動頁面。按「開始書寫」才畫；有觸控筆時只用筆畫，手指只負責移頁。按「儲存筆記」會留在這部裝置。", "Default is pan. Tap Start writing to draw. With a stylus, only the pen draws; fingers pan. Save notes keeps them on this device.");
}
function syncHint(){
  const el = $("mark-hint");
  if(!el || !studio) return;
  if(studio.tool === "eraser"){
    el.textContent = tUI("擦膠只擦你這次畫的筆跡，不會改課本底圖。幼／中／粗可調擦膠大小。", "Eraser only removes your ink, not the textbook page. Thin / Mid / Thick change eraser size.");
    return;
  }
  if(studio.tool === "circle"){
    el.textContent = tUI("拖出矩形畫橢圓；按住 Shift 畫正圓。", "Drag a box for an oval. Hold Shift for a circle.");
    return;
  }
  el.textContent = defaultHint();
}
function pagePos(ev, canvas){
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (ev.clientX - r.left) / Math.max(1, r.width))),
    y: Math.min(1, Math.max(0, (ev.clientY - r.top) / Math.max(1, r.height)))
  };
}
function paintStroke(ctx, st, canvas){
  const pts = (st && st.points) || [];
  if(!pts.length) return;
  const w = canvas.width, h = canvas.height;
  const erase = !!(st.tool === "eraser" || st.erase);
  ctx.save();
  if(erase){
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
  }else{
    ctx.strokeStyle = st.color || "#dc2626";
  }
  ctx.lineWidth = Math.max(1.4, (st.width || (erase ? ERASE_WIDTHS.mid : WIDTHS.mid)) * w);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if(st.dash && !erase){
    const d = ctx.lineWidth * 2.4;
    ctx.setLineDash([d, d * 0.9]);
  }else ctx.setLineDash([]);
  if(st.tool === "circle" && pts.length >= 2){
    let x0 = pts[0].x * w, y0 = pts[0].y * h;
    let x1 = pts[pts.length - 1].x * w, y1 = pts[pts.length - 1].y * h;
    if(st.lockCircle){
      const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + side * (x1 >= x0 ? 1 : -1);
      y1 = y0 + side * (y1 >= y0 ? 1 : -1);
    }
    const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    if(rx >= 0.4 || ry >= 0.4){
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  if(pts.length === 1) ctx.lineTo(pts[0].x * w + 0.8, pts[0].y * h);
  for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
  ctx.stroke();
  ctx.restore();
}
function currentStrokes(){
  if(!studio) return [];
  if(!studio.strokes[studio.page]) studio.strokes[studio.page] = [];
  return studio.strokes[studio.page];
}
function drawInk(){
  if(!studio) return;
  const ink = $("mark-ink");
  if(!ink) return;
  const ctx = ink.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ink.width, ink.height);
  currentStrokes().forEach(st => paintStroke(ctx, st, ink));
  if(studio.draft) paintStroke(ctx, studio.draft, ink);
}
function renderPage(){
  if(!studio) return;
  const page = studio.pages[studio.page];
  const wrap = $("mark-page");
  const pdfC = $("mark-pdf");
  const inkC = $("mark-ink");
  const stage = $("mark-stage");
  if(!page || !wrap || !pdfC || !inkC || !stage) return;
  const cssW = Math.max(280, Math.round((stage.clientWidth - 32) * studio.zoom));
  const cssH = Math.round(cssW * page.height / page.width);
  wrap.style.width = cssW + "px";
  wrap.style.height = cssH + "px";
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  [pdfC, inkC].forEach(c => {
    c.style.width = cssW + "px";
    c.style.height = cssH + "px";
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
  });
  const ctx = pdfC.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(page, 0, 0, cssW, cssH);
  drawInk();
  if($("mark-page-lab")) $("mark-page-lab").textContent = (studio.page + 1) + " / " + studio.pages.length;
  if($("mark-zoom-lab")) $("mark-zoom-lab").textContent = Math.round(studio.zoom * 100) + "%";
  pinChrome();
}
function setZoom(next){
  if(!studio) return;
  const z = Math.min(3.2, Math.max(0.5, Math.round(Number(next) * 100) / 100));
  if(z === studio.zoom) return;
  studio.zoom = z;
  renderPage();
}
function pinChrome(){
  const chrome = $("mark-chrome");
  const overlay = $("mark-overlay");
  const dock = $("mark-dock");
  const vv = window.visualViewport;
  if(!chrome || !overlay) return;
  const scale = (vv && vv.scale) || 1;
  if(scale === 1){
    chrome.style.transform = "";
    chrome.style.width = "";
    if(dock){ dock.style.transform = ""; dock.style.width = ""; }
    return;
  }
  chrome.style.transformOrigin = "top left";
  chrome.style.transform = "scale(" + (1 / scale) + ")";
  chrome.style.width = (overlay.clientWidth * scale) + "px";
  if(dock){
    dock.style.transformOrigin = "bottom left";
    dock.style.transform = "scale(" + (1 / scale) + ")";
    dock.style.width = (overlay.clientWidth * scale) + "px";
  }
}
function syncTools(){
  if(!studio) return;
  const on = (id, yes) => { if($(id)) $(id).classList.toggle("on", !!yes); };
  on("mark-tool-pen", studio.tool === "pen");
  on("mark-tool-line", studio.tool === "line");
  on("mark-tool-circle", studio.tool === "circle");
  on("mark-tool-eraser", studio.tool === "eraser");
  on("mark-dash", studio.dash);
  const usingErase = studio.tool === "eraser";
  const widths = usingErase ? ERASE_WIDTHS : WIDTHS;
  const curW = usingErase ? studio.eraseWidth : studio.width;
  on("mark-w1", curW === widths.thin);
  on("mark-w2", curW === widths.mid);
  on("mark-w3", curW === widths.thick);
  const host = $("mark-colors");
  if(host){
    host.querySelectorAll(".mark-swatch").forEach(btn => {
      btn.classList.toggle("on", studio.tool !== "eraser" && btn.getAttribute("data-color") === studio.color);
    });
  }
}
function canDraw(ev){
  if(!studio) return false;
  const type = (ev && ev.pointerType) || "mouse";
  if(type === "mouse") return true;
  if(type === "pen"){
    studio.sawPen = true;
    return true;
  }
  if(studio.sawPen) return false;
  return !!studio.drawOn;
}
function shouldLockGestures(){
  return !!(studio && (studio.drawOn || studio.sawPen || studio.penDown || studio.draft));
}
function applyStageTouch(){
  const stage = $("mark-stage");
  const ov = $("mark-overlay");
  if(!stage) return;
  const mouse = isFineMouse();
  const lock = !mouse || shouldLockGestures();
  stage.style.touchAction = lock ? "none" : "pan-x pan-y";
  if(ov) ov.style.touchAction = lock ? "none" : "";
}
function syncDrawMode(){
  if(!studio) return;
  const ink = $("mark-ink");
  const lock = $("mark-draw-lock");
  const ov = $("mark-overlay");
  const mouse = isFineMouse();
  const drawing = mouse || studio.drawOn || studio.sawPen;
  if(ink){
    ink.style.cursor = drawing ? (studio.tool === "eraser" ? "cell" : "crosshair") : "grab";
  }
  if(ov){
    ov.classList.toggle("is-mouse", mouse);
    ov.classList.toggle("is-touch", !mouse);
    ov.classList.toggle("is-drawing", !!(studio.drawOn || studio.draft));
    ov.classList.toggle("is-pen", !!studio.sawPen);
    ov.classList.toggle("is-erase", studio.tool === "eraser");
  }
  applyStageTouch();
  if(lock){
    lock.classList.toggle("on", !!studio.drawOn);
    lock.textContent = studio.drawOn
      ? tUI("書寫中（再按鎖定）", "Writing on (tap to lock)")
      : tUI("開始書寫", "Start writing");
  }
}
function persist(){
  if(!studio) return;
  try{
    localStorage.setItem(INK_KEY, JSON.stringify({
      v: 2,
      file,
      strokes: studio.strokes
    }));
    studio.dirty = false;
  }catch(err){}
}
function loadSaved(){
  try{
    return JSON.parse(localStorage.getItem(INK_KEY) || "null");
  }catch{
    return null;
  }
}
function migrateStrokes(saved, pageCount){
  const out = [];
  for(let i = 0; i < pageCount; i++) out.push([]);
  if(!saved) return out;
  if(saved.v === 2 && Array.isArray(saved.strokes)){
    saved.strokes.forEach((list, i) => { if(i < pageCount) out[i] = list || []; });
    return out;
  }
  const pages = saved.pages || {};
  for(let i = 0; i < pageCount; i++){
    const rec = pages[i + 1] || pages[String(i + 1)] || {};
    const w = rec.w || 0, h = rec.h || 0;
    out[i] = (rec.strokes || []).map(st => ({
      tool: st.erase ? "eraser" : "pen",
      erase: !!st.erase,
      color: st.color || "#111827",
      width: w ? (st.width || 2.4) / w : WIDTHS.mid,
      dash: false,
      points: (st.points || []).map(p => ({
        x: w ? p.x / w : 0,
        y: h ? p.y / h : 0
      }))
    }));
  }
  return out;
}
function pushStroke(st){
  if(!studio || !st || !st.points || !st.points.length) return;
  currentStrokes().push(st);
  studio.redo = [];
  studio.dirty = true;
  persist();
}
function flattenPage(i){
  const src = studio.pages[i];
  const w = Math.min(1600, src.width || 1240);
  const h = Math.round(w * src.height / src.width);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  const ink = document.createElement("canvas");
  ink.width = w;
  ink.height = h;
  const ictx = ink.getContext("2d");
  (studio.strokes[i] || []).forEach(st => paintStroke(ictx, st, ink));
  ctx.drawImage(ink, 0, 0);
  return c;
}
async function exportPdf(){
  if(!studio || !window.jspdf) throw new Error("pdf");
  const JsPDF = window.jspdf.jsPDF;
  let out = null;
  for(let i = 0; i < studio.pages.length; i++){
    setStatus(tUI("正在產生 PDF（第 " + (i + 1) + "／" + studio.pages.length + " 頁）…", "Creating PDF (page " + (i + 1) + " of " + studio.pages.length + ")…"));
    const src = studio.pages[i];
    const c = flattenPage(i);
    const img = c.toDataURL("image/jpeg", 0.92);
    const orient = src.width > src.height ? "l" : "p";
    const fmt = [src.width, src.height];
    if(!out) out = new JsPDF({ orientation: orient, unit: "pt", format: fmt, compress: true });
    else out.addPage(fmt, orient);
    out.addImage(img, "JPEG", 0, 0, src.width, src.height);
    await new Promise(r => setTimeout(r, 0));
  }
  return out.output("blob");
}
function downloadBlob(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function downloadName(){
  const d = new Date();
  const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const base = (file.split("/").pop() || "notes.pdf").replace(/\.pdf$/i, "");
  return base + "-notes-" + stamp + ".pdf";
}

function bindUi(){
  const colors = $("mark-colors");
  if(colors){
    colors.innerHTML = COLORS.map(c =>
      '<button type="button" class="mark-swatch" data-color="' + c.hex + '" style="background:' + c.hex + '" title="' + c.id + '"></button>'
    ).join("");
    colors.onclick = (e) => {
      const btn = e.target.closest("[data-color]");
      if(!btn || !studio) return;
      studio.color = btn.getAttribute("data-color");
      if(studio.tool === "eraser") studio.tool = "pen";
      syncTools();
      syncHint();
      syncDrawMode();
    };
  }
  const setTool = (tool) => () => {
    if(!studio) return;
    studio.tool = tool;
    syncTools();
    syncHint();
    syncDrawMode();
  };
  $("mark-tool-pen").onclick = setTool("pen");
  $("mark-tool-line").onclick = setTool("line");
  $("mark-tool-circle").onclick = setTool("circle");
  $("mark-tool-eraser").onclick = setTool("eraser");
  $("mark-dash").onclick = () => { if(studio){ studio.dash = !studio.dash; syncTools(); } };
  const setW = (key) => () => {
    if(!studio) return;
    if(studio.tool === "eraser") studio.eraseWidth = ERASE_WIDTHS[key];
    else studio.width = WIDTHS[key];
    syncTools();
  };
  $("mark-w1").onclick = setW("thin");
  $("mark-w2").onclick = setW("mid");
  $("mark-w3").onclick = setW("thick");
  $("mark-undo").onclick = () => {
    if(!studio) return;
    const list = currentStrokes();
    if(!list.length) return;
    studio.redo.push(list.pop());
    studio.dirty = true;
    persist();
    drawInk();
  };
  $("mark-redo").onclick = () => {
    if(!studio || !studio.redo.length) return;
    currentStrokes().push(studio.redo.pop());
    studio.dirty = true;
    persist();
    drawInk();
  };
  $("mark-draw-lock").onclick = () => {
    if(!studio) return;
    studio.drawOn = !studio.drawOn;
    syncDrawMode();
  };
  $("mark-zoom-in").onclick = () => setZoom((studio && studio.zoom || 1) + 0.25);
  $("mark-zoom-out").onclick = () => setZoom((studio && studio.zoom || 1) - 0.25);
  $("mark-zoom-fit").onclick = () => setZoom(1);
  $("mark-prev").onclick = () => {
    if(!studio || studio.page <= 0) return;
    studio.page -= 1;
    studio.redo = [];
    studio.draft = null;
    renderPage();
  };
  $("mark-next").onclick = () => {
    if(!studio || studio.page >= studio.pages.length - 1) return;
    studio.page += 1;
    studio.redo = [];
    studio.draft = null;
    renderPage();
  };
  $("mark-save").onclick = () => {
    persist();
    setStatus(tUI("已儲存在這部裝置。下次打開同一份 PDF 會還原筆跡。", "Saved on this device. Your ink returns the next time you open this PDF."));
  };
  $("mark-download").onclick = async () => {
    if(!studio) return;
    persist();
    $("mark-download").disabled = true;
    try{
      const blob = await exportPdf();
      downloadBlob(blob, downloadName());
      setStatus(tUI("已下載含筆跡的 PDF。", "Annotated PDF downloaded."));
    }catch(err){
      setStatus(tUI("未能產生 PDF。可改用瀏覽器列印 → 儲存為 PDF。", "Could not create the PDF. Use the browser Print → Save as PDF instead."));
    }finally{
      $("mark-download").disabled = false;
    }
  };
  $("btn-zh").onclick = () => setLang(false);
  $("btn-en").onclick = () => setLang(true);
  ["link-tb-ex","link-tb-ans"].forEach(id => {
    const a = $(id);
    if(!a) return;
    a.addEventListener("click", (e) => {
      if(a.classList.contains("active")) e.preventDefault();
      else persist();
    });
  });

  const ink = $("mark-ink");
  ink.onpointerdown = (ev) => {
    if(!studio || ev.button) return;
    if(ev.pointerType === "pen"){
      studio.sawPen = true;
      studio.penDown = true;
      syncDrawMode();
    }
    if(!canDraw(ev)){
      if(ev.pointerType === "touch"){
        const stage = $("mark-stage");
        if(stage){
          ev.preventDefault();
          ink.setPointerCapture(ev.pointerId);
          fingerPan = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
        }
      }
      return;
    }
    ev.preventDefault();
    ink.setPointerCapture(ev.pointerId);
    const p = pagePos(ev, ink);
    studio.draft = {
      tool: studio.tool,
      erase: studio.tool === "eraser",
      color: studio.color,
      width: studio.tool === "eraser" ? studio.eraseWidth : studio.width,
      dash: studio.tool === "eraser" ? false : studio.dash,
      lockCircle: false,
      points: [p]
    };
    syncDrawMode();
    drawInk();
  };
  ink.onpointermove = (ev) => {
    if(!studio) return;
    if(fingerPan && ev.pointerId === fingerPan.id){
      ev.preventDefault();
      const stage = $("mark-stage");
      if(stage){
        stage.scrollLeft = fingerPan.sl - (ev.clientX - fingerPan.x);
        stage.scrollTop = fingerPan.st - (ev.clientY - fingerPan.y);
      }
      return;
    }
    if(!studio.draft) return;
    ev.preventDefault();
    const p = pagePos(ev, ink);
    if(studio.tool === "line" || studio.tool === "circle"){
      studio.draft.points = [studio.draft.points[0], p];
      if(studio.tool === "circle") studio.draft.lockCircle = !!ev.shiftKey;
    }else studio.draft.points.push(p);
    drawInk();
  };
  const endDraw = (ev) => {
    if(!studio) return;
    if(ev && fingerPan && ev.pointerId === fingerPan.id){
      fingerPan = null;
      return;
    }
    if(ev && ev.pointerType === "pen") studio.penDown = false;
    if(!studio.draft){
      syncDrawMode();
      return;
    }
    if(ev) ev.preventDefault();
    if(studio.draft.tool === "circle") studio.draft.lockCircle = !!(ev && ev.shiftKey);
    pushStroke(studio.draft);
    studio.draft = null;
    syncDrawMode();
    drawInk();
  };
  ink.onpointerup = endDraw;
  ink.onpointercancel = endDraw;

  const overlay = $("mark-overlay");
  overlay.addEventListener("wheel", (ev) => {
    if(!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    setZoom(studio.zoom + (ev.deltaY > 0 ? -0.1 : 0.1));
  }, { passive: false });
  const stage = $("mark-stage");
  stage.addEventListener("pointerdown", (ev) => {
    if(!studio || ev.button) return;
    if(ev.target === ink || ink.contains(ev.target)) return;
    if(ev.pointerType !== "touch" || canDraw(ev)) return;
    ev.preventDefault();
    try{ stage.setPointerCapture(ev.pointerId); }catch(_){}
    fingerPan = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
  });
  stage.addEventListener("pointermove", (ev) => {
    if(!fingerPan || ev.pointerId !== fingerPan.id) return;
    ev.preventDefault();
    stage.scrollLeft = fingerPan.sl - (ev.clientX - fingerPan.x);
    stage.scrollTop = fingerPan.st - (ev.clientY - fingerPan.y);
  });
  const endPan = (ev) => {
    if(fingerPan && (!ev || ev.pointerId === fingerPan.id)) fingerPan = null;
  };
  stage.addEventListener("pointerup", endPan);
  stage.addEventListener("pointercancel", endPan);
  window.addEventListener("resize", () => { if(studio) renderPage(); });
  window.addEventListener("pagehide", persist);
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", pinChrome);
    window.visualViewport.addEventListener("scroll", pinChrome);
  }
}

async function rasterPages(){
  const pages = [];
  for(let n = 1; n <= pdfDoc.numPages; n++){
    setStatus(tUI("正在載入第 " + n + "／" + pdfDoc.numPages + " 頁…", "Loading page " + n + " of " + pdfDoc.numPages + "…"));
    const page = await pdfDoc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1400 / base.width);
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(vp.width));
    c.height = Math.max(1, Math.round(vp.height));
    await page.render({ canvasContext: c.getContext("2d", { alpha: false }), viewport: vp }).promise;
    pages.push(c);
  }
  return pages;
}

bindUi();
setLang(q.get("lang") === "en");
syncTbSwitch();

(async function boot(){
  if(!FILE_RE.test(file)){
    setStatus(tUI("沒有可開啟的課本 PDF。請從課堂筆記按「書本練習」或「書本答案」。", "No textbook PDF specified. Open this page from Class notes → Tb Ex / Tb Ans."));
    return;
  }
  if(isAnsFile(file) && studentLocked()){
    setStatus(tUI("書本答案只供教師帳戶開啟。", "Textbook answers are only available on a teacher account."));
    if($("mark-dock")) $("mark-dock").hidden = true;
    return;
  }
  if(!window.pdfjsLib){
    setStatus(tUI("未能載入 PDF 顯示程式（可能離線）。", "Could not load the PDF viewer (you may be offline)."));
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  setStatus(tUI("正在開啟 PDF…", "Opening PDF…"));
  try{
    pdfDoc = await pdfjsLib.getDocument({
      url: file,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true
    }).promise;
    const pages = await rasterPages();
    studio = {
      pages,
      page: 0,
      zoom: 1,
      tool: "pen",
      dash: false,
      color: COLORS[0].hex,
      width: WIDTHS.mid,
      eraseWidth: ERASE_WIDTHS.mid,
      strokes: migrateStrokes(loadSaved(), pages.length),
      redo: [],
      draft: null,
      dirty: false,
      drawOn: isFineMouse(),
      sawPen: false,
      penDown: false
    };
    syncLabels();
    syncTools();
    syncDrawMode();
    renderPage();
    setStatus(tUI(
      "共 " + pages.length + " 頁。畫完請按「儲存筆記」；也可下載含筆跡的 PDF。",
      pages.length + " page(s). Tap Save notes after writing; you can also download a PDF with your ink."
    ));
  }catch(err){
    setStatus(tUI("無法開啟這個 PDF。", "Could not open this PDF."));
  }
})();
