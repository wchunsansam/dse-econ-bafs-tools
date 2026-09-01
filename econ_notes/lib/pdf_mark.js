const $ = (id) => document.getElementById(id);
const FILE_RE = /^tb\/[A-Za-z0-9._-]+\.pdf$/i;
const FROM_RE = /^[A-Za-z0-9._-]+\.html$/;
const q = new URLSearchParams(location.search);
const file = q.get("file") || "";
const INK_KEY = "pdf-ink:" + file;

let pdfDoc = null;
let pageViews = [];
let current = null;
let lastView = null;
let undoStack = [];
let erasing = false;
let penColor = "#111827";
let rendering = false;

function tUI(zh, en){
  return document.body.classList.contains("en") ? en : zh;
}
function setStatus(msg){
  $("pdf-status").textContent = msg || "";
}
function langParam(){
  return document.body.classList.contains("en") ? "en" : "zh-hk";
}
function setLang(en){
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
  document.title = en
    ? "DSE ECON | PDF annotator" + (file ? " — " + file.replace(/^tb\//, "") : "")
    : "DSE ECON｜PDF 筆記器" + (file ? " — " + file.replace(/^tb\//, "") : "");
}
function syncBack(){
  const back = $("link-back");
  const from = q.get("from") || "";
  const lang = "lang=" + langParam();
  if(FROM_RE.test(from)){
    back.href = from + "?" + lang;
  }else{
    back.href = "../index.html?" + lang;
  }
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
function persist(){
  try{
    const pages = {};
    pageViews.forEach(v => {
      pages[v.n] = { w: v.base.width, h: v.base.height, strokes: v.strokes };
    });
    localStorage.setItem(INK_KEY, JSON.stringify({ file, pages }));
  }catch(err){}
}
function loadSaved(){
  try{
    return JSON.parse(localStorage.getItem(INK_KEY) || "null") || { pages: {} };
  }catch(err){
    return { pages: {} };
  }
}
function scaleStrokes(strokes, fromW, fromH, toW, toH){
  if(!fromW || fromW === toW) return strokes;
  const sx = toW / fromW;
  const sy = toH / (fromH || toH);
  strokes.forEach(s => (s.points || []).forEach(p => {
    p.x *= sx;
    p.y *= sy;
  }));
  return strokes;
}

function bindDraw(view){
  const svg = view.svg;
  const layer = view.layer;
  svg.addEventListener("pointerdown", (e) => {
    if(!document.body.classList.contains("draw-on")) return;
    e.preventDefault();
    try{ svg.setPointerCapture(e.pointerId); }catch(err){}
    current = {
      view,
      stroke: {
        color: penColor,
        width: erasing ? 18 : 2.4,
        erase: erasing,
        points: [layer.pt(e)]
      }
    };
    view.strokes.push(current.stroke);
    lastView = view;
    undoStack.push(view);
    layer.startLive(current.stroke);
  }, { passive: false });
  svg.addEventListener("pointermove", (e) => {
    if(!current || current.view !== view) return;
    e.preventDefault();
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    (evs.length ? evs : [e]).forEach(ev => current.stroke.points.push(layer.pt(ev)));
    layer.updateLive(current.stroke);
  }, { passive: false });
  function up(){
    if(!current || current.view !== view) return;
    current = null;
    layer.endLive();
    layer.redraw(view.strokes);
    persist();
  }
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
}

async function paintBitmap(view){
  const page = await pdfDoc.getPage(view.n);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(320, view.wrap.clientWidth || $("pdf-pages").clientWidth || 800);
  const vp = page.getViewport({ scale: (cssW / view.base.width) * dpr });
  view.canvas.width = Math.max(1, Math.round(vp.width));
  view.canvas.height = Math.max(1, Math.round(vp.height));
  view.canvas.style.width = "100%";
  view.canvas.style.height = "auto";
  const ctx = view.canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  view.layer.fit({ fill: true });
}

async function renderPages(){
  if(!pdfDoc || rendering) return;
  rendering = true;
  const host = $("pdf-pages");
  const saved = loadSaved();
  host.innerHTML = "";
  pageViews = [];
  current = null;
  try{
    for(let n = 1; n <= pdfDoc.numPages; n++){
      setStatus(tUI(
        "正在載入第 " + n + "／" + pdfDoc.numPages + " 頁…",
        "Loading page " + n + " of " + pdfDoc.numPages + "…"
      ));
      const page = await pdfDoc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const wrap = document.createElement("div");
      wrap.className = "pdf-page";
      wrap.dataset.page = String(n);
      const canvas = document.createElement("canvas");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("id", "ink-p" + n);
      svg.setAttribute("aria-hidden", "true");
      const lab = document.createElement("div");
      lab.className = "page-lab no-print";
      lab.textContent = n + " / " + pdfDoc.numPages;
      wrap.appendChild(canvas);
      wrap.appendChild(svg);
      wrap.appendChild(lab);
      host.appendChild(wrap);
      const rec = (saved.pages && (saved.pages[n] || saved.pages[String(n)])) || {};
      const strokes = scaleStrokes(rec.strokes || [], rec.w, rec.h, base.width, base.height);
      const layer = InkLayer.create(svg, () => ({ w: base.width, h: base.height }));
      const view = { n, base, canvas, svg, layer, strokes, wrap };
      pageViews.push(view);
      await paintBitmap(view);
      layer.redraw(strokes);
      bindDraw(view);
    }
    setStatus(tUI(
      "共 " + pdfDoc.numPages + " 頁。開啟畫筆後可在頁上書寫；下載 PDF 會把筆跡印在頁面上。",
      pdfDoc.numPages + " page(s). Turn the pen on to write; Download PDF flattens ink onto the pages."
    ));
  }finally{
    rendering = false;
  }
}

async function exportAnnotated(){
  if(!pdfDoc || !window.jspdf) throw new Error("pdf");
  const JsPDF = window.jspdf.jsPDF;
  let out = null;
  const scale = 2;
  for(let i = 0; i < pageViews.length; i++){
    const view = pageViews[i];
    setStatus(tUI(
      "正在產生 PDF（第 " + (i + 1) + "／" + pageViews.length + " 頁）…",
      "Creating PDF (page " + (i + 1) + " of " + pageViews.length + ")…"
    ));
    const page = await pdfDoc.getPage(view.n);
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(vp.width));
    c.height = Math.max(1, Math.round(vp.height));
    const ctx = c.getContext("2d", { alpha: false });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    ctx.save();
    ctx.scale(scale, scale);
    view.strokes.forEach(s => InkLayer.paintStrokeOn(ctx, s));
    ctx.restore();
    const img = c.toDataURL("image/jpeg", 0.92);
    const orient = view.base.width > view.base.height ? "l" : "p";
    const fmt = [view.base.width, view.base.height];
    if(!out){
      out = new JsPDF({ orientation: orient, unit: "pt", format: fmt, compress: true });
    }else{
      out.addPage(fmt, orient);
    }
    out.addImage(img, "JPEG", 0, 0, view.base.width, view.base.height);
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
function fileName(){
  const d = new Date();
  const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const base = (file.split("/").pop() || "notes.pdf").replace(/\.pdf$/i, "");
  return base + "-marked-" + stamp + ".pdf";
}

$("btn-zh").onclick = () => setLang(false);
$("btn-en").onclick = () => setLang(true);
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
  const view = undoStack.pop() || lastView;
  if(!view || !view.strokes.length) return;
  view.strokes.pop();
  view.layer.redraw(view.strokes);
  lastView = undoStack[undoStack.length - 1] || view;
  persist();
};
$("btn-clear").onclick = () => {
  if(!pageViews.some(v => v.strokes.length)) return;
  if(!confirm(tUI("清除這份 PDF 上的所有筆跡？","Clear all ink on this PDF?"))) return;
  pageViews.forEach(v => {
    v.strokes = [];
    v.layer.redraw(v.strokes);
  });
  undoStack = [];
  lastView = null;
  persist();
};
$("btn-print").onclick = () => window.print();
$("btn-save").onclick = async () => {
  if(!pdfDoc) return;
  $("btn-save").disabled = true;
  try{
    const blob = await exportAnnotated();
    downloadBlob(blob, fileName());
    setStatus(tUI("已下載含筆跡的 PDF。","Annotated PDF downloaded."));
  }catch(err){
    setStatus(tUI("未能產生 PDF。可改用「列印」→「儲存為 PDF」。","Could not create the PDF. Use Print → Save as PDF instead."));
  }finally{
    $("btn-save").disabled = false;
  }
};

setLang(q.get("lang") === "en");

(async function boot(){
  if(!FILE_RE.test(file)){
    setStatus(tUI("沒有可開啟的課本 PDF。請從課堂筆記按「書本練習」或「書本答案」。","No textbook PDF specified. Open this page from Class notes → Tb Ex / Tb Ans."));
    return;
  }
  if(!window.pdfjsLib){
    setStatus(tUI("未能載入 PDF 顯示程式（可能離線）。","Could not load the PDF viewer (you may be offline)."));
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  setStatus(tUI("正在開啟 PDF…","Opening PDF…"));
  try{
    pdfDoc = await pdfjsLib.getDocument({
      url: file,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true
    }).promise;
    await renderPages();
  }catch(err){
    setStatus(tUI("無法開啟這個 PDF。","Could not open this PDF."));
  }
})();

let resizeTick = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeTick);
  resizeTick = requestAnimationFrame(() => {
    pageViews.forEach(v => { paintBitmap(v); });
  });
});
