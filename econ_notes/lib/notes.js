const $ = (id) => document.getElementById(id);
const cfg = document.body.dataset;

function langParam(){
  return document.body.classList.contains("en") ? "en" : "zh-hk";
}
function syncLangLinks(){
  const q = "lang=" + langParam();
  const home = $("link-home");
  const lab = $("link-lab");
  if(home) home.href = "../index.html?" + q;
  if(lab && cfg.lab) lab.href = cfg.lab + (cfg.lab.includes("?") ? "&" : "?") + q;
  document.querySelectorAll("a.tool-link[data-tool]").forEach(a => {
    const base = cfg.lab || "../econ_tools/ch01_lab.html";
    const join = base.includes("?") ? "&" : "?";
    a.href = base + join + q + "#" + a.dataset.tool;
  });
}
function setLang(en){
  document.body.classList.toggle("en", en);
  document.documentElement.lang = en ? "en" : "zh-HK";
  document.querySelectorAll(".zh").forEach(el => { el.hidden = !!en; });
  document.querySelectorAll(".en").forEach(el => { el.hidden = !en; });
  $("btn-en").classList.toggle("active", en);
  $("btn-zh").classList.toggle("active", !en);
  const params = new URLSearchParams(location.search);
  params.set("lang", en ? "en" : "zh-hk");
  history.replaceState(null, "", "?" + params.toString() + location.hash);
  document.title = en ? (cfg.titleEn || document.title) : (cfg.titleZh || document.title);
  syncLangLinks();
  requestAnimationFrame(() => { if(typeof resizeInk === "function") resizeInk(); });
}
function setMode(mode){
  document.body.classList.remove("mode-blank","mode-click");
  if(mode === "blank") document.body.classList.add("mode-blank");
  if(mode === "click") document.body.classList.add("mode-click");
  document.querySelectorAll(".ans").forEach(el => el.classList.remove("open"));
  $("btn-full").classList.toggle("active", mode === "full");
  $("btn-blank").classList.toggle("active", mode === "blank");
  $("btn-click").classList.toggle("active", mode === "click");
  const params = new URLSearchParams(location.search);
  if(mode === "full") params.delete("mode");
  else params.set("mode", mode);
  history.replaceState(null, "", "?" + params.toString() + location.hash);
  requestAnimationFrame(() => { if(typeof resizeInk === "function") resizeInk(); });
}
$("btn-zh").onclick = () => setLang(false);
$("btn-en").onclick = () => setLang(true);
$("btn-full").onclick = () => setMode("full");
$("btn-blank").onclick = () => setMode("blank");
$("btn-click").onclick = () => setMode("click");
document.addEventListener("click", (e) => {
  if(document.body.classList.contains("draw-on")) return;
  const a = e.target.closest(".ans");
  if(!a || !document.body.classList.contains("mode-click")) return;
  a.classList.toggle("open");
});
$("btn-print").onclick = () => window.print();
const q = new URLSearchParams(location.search);
setLang(q.get("lang") === "en");
if(q.get("mode") === "blank") setMode("blank");
else if(q.get("mode") === "click") setMode("click");
else setMode("full");

const INK_KEY = cfg.inkKey || "econ-notes-ink-v1";
const canvas = $("ink");
const ctx = canvas.getContext("2d", { desynchronized: true });
const notesBody = $("notes-body");
let strokes = [];
let current = null;
let erasing = false;
let penColor = "#111827";
let extraCount = 0;
let inkW = 0;
let paperW = 0;
let shareFile = null;

function tUI(zh, en){
  return document.body.classList.contains("en") ? en : zh;
}
function pt(e){
  const r = canvas.getBoundingClientRect();
  const sx = r.width ? (canvas.offsetWidth / r.width) : 1;
  const sy = r.height ? (canvas.offsetHeight / r.height) : 1;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}
function fitPaper(){
  if(!notesBody || !paperW) return;
  notesBody.style.width = paperW + "px";
  notesBody.style.maxWidth = paperW + "px";
  notesBody.style.transform = "none";
  notesBody.style.left = "auto";
  notesBody.style.marginLeft = "auto";
  notesBody.style.marginRight = "auto";
  const frame = $("paper-frame");
  if(frame) frame.style.height = "auto";
}
function resizeInk(){
  if(!notesBody) return;
  const frame = $("paper-frame");
  if(!paperW){
    paperW = inkW || Math.max(320, Math.round(frame ? frame.clientWidth : notesBody.clientWidth));
  }
  notesBody.style.width = paperW + "px";
  notesBody.style.maxWidth = paperW + "px";
  const w = paperW;
  const h = Math.max(notesBody.scrollHeight, notesBody.clientHeight);
  if(inkW && w && w !== inkW){
    const s = w / inkW;
    strokes.forEach(st => st.points.forEach(p => { p.x *= s; p.y *= s; }));
  }
  inkW = w;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  fitPaper();
  redrawInk();
}
function redrawInk(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for(const s of strokes){
    paintStroke(s);
  }
}
function paintStrokeOn(c, s){
  if(!s.points.length) return;
  c.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  c.strokeStyle = s.color;
  c.fillStyle = s.color;
  c.lineWidth = s.width;
  c.lineCap = "round";
  c.lineJoin = "round";
  if(s.points.length === 1){
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
function paintStroke(s){
  paintStrokeOn(ctx, s);
}
function persistInk(){
  try{
    localStorage.setItem(INK_KEY, JSON.stringify({ strokes, extraCount, inkW }));
  }catch(err){}
}
function addPaper(){
  extraCount += 1;
  const en = document.body.classList.contains("en");
  const page = document.createElement("div");
  page.className = "paper-sheet";
  page.innerHTML = `<p class="paper-lab"><span class="zh"${en ? " hidden" : ""}>空白頁 ${extraCount}</span><span class="en"${en ? "" : " hidden"}>Blank page ${extraCount}</span></p>`;
  $("extra-pages").appendChild(page);
  requestAnimationFrame(resizeInk);
}
function setDraw(on){
  document.body.classList.toggle("draw-on", on);
  $("btn-draw").classList.toggle("active", on);
}
function setEraser(on){
  erasing = on;
  $("btn-eraser").classList.toggle("active", on);
  if(on) document.querySelectorAll(".swatch").forEach(b => b.classList.remove("active"));
}

$("btn-draw").onclick = () => setDraw(!document.body.classList.contains("draw-on"));
$("btn-eraser").onclick = () => setEraser(!erasing);
document.querySelectorAll(".swatch").forEach(btn => {
  btn.onclick = () => {
    penColor = btn.dataset.color;
    setEraser(false);
    document.querySelectorAll(".swatch").forEach(b => b.classList.toggle("active", b === btn));
  };
});
$("btn-undo").onclick = () => {
  strokes.pop();
  redrawInk();
  persistInk();
};
$("btn-clear").onclick = () => {
  if(!strokes.length) return;
  if(!confirm(tUI("清除所有筆跡？空白頁會保留。","Clear all ink? Extra pages are kept."))) return;
  strokes = [];
  redrawInk();
  persistInk();
};
$("btn-paper").onclick = () => {
  addPaper();
  persistInk();
};

canvas.addEventListener("pointerdown", (e) => {
  if(!document.body.classList.contains("draw-on")) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  current = {
    color: penColor,
    width: erasing ? 22 : 2.75,
    erase: erasing,
    points: [pt(e)]
  };
  strokes.push(current);
  paintStroke(current);
}, { passive: false });
canvas.addEventListener("pointermove", (e) => {
  if(!current) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  evs.forEach(ev => current.points.push(pt(ev)));
  paintStroke({
    ...current,
    points: current.points.slice(-2)
  });
}, { passive: false });
canvas.addEventListener("pointerup", () => { current = null; persistInk(); });
canvas.addEventListener("pointercancel", () => { current = null; persistInk(); });

function fileName(ext){
  const d = new Date();
  const stamp = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  return (cfg.filePrefix || "notes") + "-" + stamp + "." + ext;
}
function openShareUI(msg){
  $("share-status").textContent = msg;
  $("share-backdrop").hidden = false;
  $("share-sheet").hidden = false;
}
function closeShareUI(){
  $("share-backdrop").hidden = true;
  $("share-sheet").hidden = true;
}
function loadScript(src){
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
function loadHtml2Canvas(){
  if(window.html2canvas) return Promise.resolve();
  return loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
}
function loadJsPdf(){
  if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
  return loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js");
}
function exportScale(cssW){
  return Math.min(3, Math.max(2, 2400 / Math.max(1, cssW)));
}
function visiblePaperCrop(){
  const cssW = paperW || notesBody.clientWidth;
  const cssH = notesBody.scrollHeight;
  const r = notesBody.getBoundingClientRect();
  const bar = document.querySelector(".toolbar");
  const clipTop = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  const visLeft = Math.max(r.left, 0);
  const visTop = Math.max(r.top, clipTop);
  const visRight = Math.min(r.right, window.innerWidth);
  const visBottom = Math.min(r.bottom, window.innerHeight);
  const sx = r.width ? cssW / r.width : 1;
  const sy = r.height ? cssH / r.height : 1;
  return {
    x: Math.max(0, (visLeft - r.left) * sx),
    y: Math.max(0, (visTop - r.top) * sy),
    width: Math.max(1, (visRight - visLeft) * sx),
    height: Math.max(1, (visBottom - visTop) * sy)
  };
}
function extraHasInk(){
  const extra = $("extra-pages");
  if(!extra || !extra.children.length) return false;
  const top = extra.offsetTop;
  return strokes.some(s => s.points.some(p => p.y >= top - 4));
}
function notesExportHeight(hideExtra){
  if(!hideExtra) return notesBody.scrollHeight;
  const extra = $("extra-pages");
  if(!extra || extraHasInk()) return notesBody.scrollHeight;
  return Math.max(1, extra.offsetTop);
}
function overlayInk(octx, crop, scale){
  octx.save();
  octx.setTransform(scale, 0, 0, scale, -crop.x * scale, -crop.y * scale);
  for(const s of strokes) paintStrokeOn(octx, s);
  octx.restore();
}
async function rasterPaper(crop, scale, opts){
  const hideExtra = !!(opts && opts.hideExtra);
  const cssW = paperW || notesBody.clientWidth;
  const shot = await window.html2canvas(notesBody, {
    backgroundColor: "#f7f9fc",
    scale: scale,
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height,
    windowWidth: Math.max(window.innerWidth, cssW + 80),
    windowHeight: Math.max(window.innerHeight, notesBody.scrollHeight),
    scrollX: 0,
    scrollY: 0,
    useCORS: true,
    logging: false,
    onclone: (doc) => {
      const el = doc.getElementById("notes-body");
      const frame = doc.getElementById("paper-frame");
      if(frame){
        frame.style.height = "auto";
        frame.style.overflow = "visible";
      }
      if(!el) return;
      el.style.transform = "none";
      el.style.left = "0";
      el.style.top = "0";
      el.style.position = "relative";
      el.style.width = cssW + "px";
      el.style.maxWidth = cssW + "px";
      el.style.boxSizing = "border-box";
      el.querySelectorAll(".lead,.footer-note").forEach(n => { n.style.display = "none"; });
      if(hideExtra){
        const extra = doc.getElementById("extra-pages");
        if(extra) extra.style.display = "none";
      }
    }
  });
  const out = document.createElement("canvas");
  out.width = shot.width;
  out.height = shot.height;
  const octx = out.getContext("2d");
  octx.drawImage(shot, 0, 0);
  overlayInk(octx, crop, shot.width / crop.width);
  return out;
}
async function captureNotes(mode){
  await loadHtml2Canvas();
  fitPaper();
  const cssW = paperW || notesBody.clientWidth;
  const cssH = notesBody.scrollHeight;
  const crop = mode === "view" ? visiblePaperCrop() : { x: 0, y: 0, width: cssW, height: cssH };
  const scale = exportScale(cssW);
  const prev = canvas.style.visibility;
  canvas.style.visibility = "hidden";
  try{
    return await rasterPaper(crop, scale);
  }finally{
    canvas.style.visibility = prev || "visible";
  }
}
async function notesToPdf(){
  await loadHtml2Canvas();
  await loadJsPdf();
  fitPaper();
  const hideExtra = !extraHasInk();
  const cssW = paperW || notesBody.clientWidth;
  const cssH = notesExportHeight(hideExtra);
  const scale = exportScale(cssW);
  const JsPDF = window.jspdf.jsPDF;
  const pdf = new JsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginMm = 20;
  const innerW = pageW - marginMm * 2;
  const innerH = pageH - marginMm * 2;
  const pageCssH = cssW * (innerH / innerW);
  const pages = Math.max(1, Math.ceil(cssH / pageCssH));
  const prev = canvas.style.visibility;
  canvas.style.visibility = "hidden";
  try{
    for(let i = 0; i < pages; i++){
      $("share-status").textContent = tUI(
        "正在產生高清 PDF（第 " + (i + 1) + "／" + pages + " 頁）…",
        "Creating high-res PDF (page " + (i + 1) + " of " + pages + ")…"
      );
      const y = i * pageCssH;
      const h = Math.min(pageCssH, cssH - y);
      const shot = await rasterPaper({ x: 0, y: y, width: cssW, height: h }, scale, { hideExtra });
      const jpg = shot.toDataURL("image/jpeg", 0.93);
      if(i) pdf.addPage();
      const hMm = (h / cssW) * innerW;
      pdf.addImage(jpg, "JPEG", marginMm, marginMm, innerW, Math.min(hMm, innerH));
      await new Promise(r => setTimeout(r, 0));
    }
  }finally{
    canvas.style.visibility = prev || "visible";
  }
  return pdf.output("blob");
}
function canvasToPng(shot){
  return new Promise((resolve, reject) => {
    shot.toBlob(blob => blob ? resolve(blob) : reject(new Error("blob")), "image/png");
  });
}
async function runCapture(mode){
  shareFile = null;
  $("share-pick").hidden = true;
  $("share-send").hidden = true;
  openShareUI(tUI("正在產生檔案，請稍候…","Creating file, please wait…"));
  try{
    if(mode === "view"){
      const shot = await captureNotes("view");
      const blob = await canvasToPng(shot);
      shareFile = new File([blob], fileName("png"), { type: "image/png" });
    }else{
      const blob = await notesToPdf();
      shareFile = new File([blob], fileName("pdf"), { type: "application/pdf" });
    }
    $("share-status").textContent = mode === "view"
      ? tUI("已準備好圖片，版面與你現在看到的同一張紙。iPad 請按「分享到郵件」。","Image ready — same page layout as on screen. On iPad tap Share to Mail.")
      : tUI("已準備好 PDF（A4 分頁）。iPad 請按「分享到郵件」。","PDF ready (A4 pages). On iPad tap Share to Mail.");
    $("share-send").hidden = false;
  }catch(err){
    $("share-status").textContent = tUI(
      "未能產生檔案（可能離線或頁面太長）。可改用「列印」儲存為 PDF，再從檔案 App 用郵件傳送。",
      "Could not create the file (offline or the page is too long). Use Print to save a PDF, then attach it in Mail."
    );
    $("share-pick").hidden = false;
  }
}
$("btn-share").onclick = () => {
  shareFile = null;
  $("share-pick").hidden = false;
  $("share-send").hidden = true;
  openShareUI(tUI(
    "「目前畫面」跟螢幕同一張紙。「整份筆記」含筆跡，四周留白方便列印。沒有筆跡、要最清的 PDF：關閉此窗，按「列印」→「儲存為 PDF」。",
    "Current view matches the screen. Whole notes includes ink and print margins. For the sharpest PDF without ink: close this, tap Print → Save as PDF."
  ));
};
$("btn-capture-view").onclick = () => runCapture("view");
$("btn-capture-full").onclick = () => runCapture("full");
function downloadShare(){
  if(!shareFile) return;
  const url = URL.createObjectURL(shareFile);
  const a = document.createElement("a");
  a.href = url;
  a.download = shareFile.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$("btn-share-now").onclick = async () => {
  if(!shareFile) return;
  const data = {
    files: [shareFile],
    title: tUI(cfg.shareZh || "課堂筆記（含筆跡）", cfg.shareEn || "Annotated class notes"),
    text: tUI(cfg.shareZh || "課堂筆記（含筆跡）", cfg.shareEn || "Annotated class notes")
  };
  try{
    if(navigator.canShare && navigator.canShare({ files: [shareFile] })){
      await navigator.share(data);
    }else{
      downloadShare();
    }
  }catch(err){
    if(err && err.name === "AbortError") return;
    downloadShare();
  }
};
$("btn-download").onclick = downloadShare;
$("btn-share-close").onclick = closeShareUI;
$("share-backdrop").onclick = closeShareUI;

try{
  const saved = JSON.parse(localStorage.getItem(INK_KEY) || "null");
  if(saved){
    const n = saved.extraCount || 0;
    extraCount = 0;
    for(let i = 0; i < n; i++) addPaper();
    strokes = saved.strokes || [];
    inkW = saved.inkW || 0;
  }
}catch(err){}
resizeInk();
let resizeTick = 0;
function scheduleInk(){
  cancelAnimationFrame(resizeTick);
  resizeTick = requestAnimationFrame(resizeInk);
}
if(window.ResizeObserver){
  new ResizeObserver(scheduleInk).observe(notesBody);
}
window.addEventListener("resize", scheduleInk);
