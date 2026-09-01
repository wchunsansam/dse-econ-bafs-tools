import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(root, "src");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function applyInline(s) {
  return s
    .replace(/\[\[wide:\s*([\s\S]*?)\]\]/g, '<span class="ans wide">$1</span>')
    .replace(/\[\[([\s\S]*?)\]\]/g, '<span class="ans">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function splitTitle(s) {
  const idx = s.indexOf(" | ");
  if (idx < 0) return { zh: s.trim(), en: s.trim() };
  return { zh: s.slice(0, idx).trim(), en: s.slice(idx + 3).trim() };
}

function bi(zh, en) {
  if (zh === en) return applyInline(zh);
  return `<span class="zh">${applyInline(zh)}</span><span class="en" hidden>${applyInline(en)}</span>`;
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) throw new Error("frontmatter not closed");
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const meta = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const val = m[2];
    if (val === "") {
      i++;
      const arr = [];
      while (i < lines.length && /^\s+-/.test(lines[i])) {
        const item = lines[i].trim().slice(1).trim();
        const pair = item.match(/^\[(.+),\s*(.+)\]$/);
        arr.push(pair ? [pair[1].trim(), pair[2].trim()] : item);
        i++;
      }
      meta[key] = arr;
      continue;
    }
    if (val === "true") meta[key] = true;
    else if (val === "false") meta[key] = false;
    else meta[key] = val;
    i++;
  }
  return { meta, body };
}

function readBlock(lines, start, file) {
  const header = lines[start].trim();
  if (!header.startsWith(":::") || header === ":::") {
    throw new Error(`${file}: expected ::: block at line ${start + 1}`);
  }
  const kind = header.slice(3).trim();
  let depth = 1;
  const inner = [];
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith(":::") && t !== ":::") {
      depth++;
      inner.push(lines[i]);
    } else if (t === ":::") {
      depth--;
      if (depth === 0) return { kind, inner, next: i + 1 };
      inner.push(lines[i]);
    } else {
      inner.push(lines[i]);
    }
  }
  throw new Error(`${file}: unclosed ::: ${kind}`);
}

function compilePairs(inner, tight, file) {
  const parts = [];
  for (const line of inner) {
    const t = line.trim();
    if (!t) continue;
    const style = tight ? ' style="margin:0"' : "";
    if (t.startsWith("zh:")) parts.push(`<p class="zh"${style}>${applyInline(t.slice(3).trim())}</p>`);
    else if (t.startsWith("en:")) parts.push(`<p class="en" hidden${style}>${applyInline(t.slice(3).trim())}</p>`);
    else throw new Error(`${file}: expected zh:/en: in block, got: ${t}`);
  }
  return parts.join("\n");
}

function parseQ(inner, file) {
  const f = {};
  for (const line of inner) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(mark_zh|mark_en|q_zh|q_en|a_zh|a_en|why_zh|why_en):\s*(.*)$/);
    if (!m) throw new Error(`${file}: bad drill field: ${t}`);
    f[m[1]] = m[2];
  }
  return f;
}

function compileDrill(inner, num, file) {
  const qBlocks = [];
  let i = 0;
  while (i < inner.length) {
    const t = inner[i].trim();
    if (!t) { i++; continue; }
    if (t.startsWith(":::")) {
      const b = readBlock(inner, i, file);
      if (b.kind.split(/\s+/)[0] === "q") qBlocks.push(parseQ(b.inner, file));
      else throw new Error(`${file}: only :::q is allowed inside :::drill`);
      i = b.next;
      continue;
    }
    throw new Error(`${file}: unexpected line in :::drill: ${t}`);
  }
  const qs = qBlocks.map((q) => `<div class="q">
        <p class="mark">${bi(q.mark_zh || "題", q.mark_en || "Q")}</p>
        <p class="zh">${applyInline(q.q_zh || "")}</p>
        <p class="en" hidden>${applyInline(q.q_en || "")}</p>
        <p class="zh">答案：<span class="ans">${applyInline(q.a_zh || "")}</span></p>
        <p class="en" hidden>Answer: <span class="ans">${applyInline(q.a_en || "")}</span></p>
        <p class="why zh">${applyInline(q.why_zh || "")}</p>
        <p class="why en" hidden>${applyInline(q.why_en || "")}</p>
      </div>`).join("\n      ");
  const titleZh = num ? `小練習　${num}` : "小練習";
  const titleEn = num ? `Quick check　${num}` : "Quick check";
  return `<div class="drill">
      <h3>${bi(titleZh, titleEn)}</h3>
      ${qs}
    </div>`;
}

function compileMarkdownBody(body, file) {
  const lines = body.split(/\r?\n/);
  const parts = [];
  let i = 0;
  let sectionOpen = false;
  const closeSection = () => {
    if (sectionOpen) {
      parts.push("  </section>");
      sectionOpen = false;
    }
  };
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i++; continue; }
    if (line.startsWith(":::")) {
      const { kind, inner, next } = readBlock(lines, i, file);
      i = next;
      const name = kind.split(/\s+/)[0];
      const rest = kind.slice(name.length).trim();
      if (name === "html") parts.push(inner.join("\n"));
      else if (name === "zh") parts.push(`    <p class="zh">${applyInline(inner.join("\n").trim())}</p>`);
      else if (name === "en") parts.push(`    <p class="en" hidden>${applyInline(inner.join("\n").trim())}</p>`);
      else if (["def", "exam", "warn"].includes(name)) {
        parts.push(`    <div class="${name}">\n      ${compilePairs(inner, true, file)}\n    </div>`);
      } else if (name === "eg") {
        parts.push(`    <div class="eg">\n      ${compilePairs(inner, false, file)}\n    </div>`);
      } else if (name === "drill") {
        parts.push(`    ${compileDrill(inner, rest, file)}`);
      } else {
        throw new Error(`${file}: unknown block ::: ${kind}`);
      }
      continue;
    }
    const hm = line.match(/^(#{1,4})\s+(.+?)(?:\s+\{#([a-zA-Z0-9_-]+)\})?\s*$/);
    if (hm) {
      const level = hm[1].length;
      const { zh, en } = splitTitle(hm[2]);
      const id = hm[3];
      if (level === 2) {
        closeSection();
        parts.push(`  <section${id ? ` id="${esc(id)}"` : ""}>`);
        sectionOpen = true;
        parts.push(`    <h2>${bi(zh, en)}</h2>`);
      } else {
        parts.push(`    <h${level}>${bi(zh, en)}</h${level}>`);
      }
      i++;
      continue;
    }
    if (line.startsWith("zh:") || line.startsWith("en:")) {
      const { html, next } = compilePairRun(lines, i);
      parts.push(html);
      i = next;
      continue;
    }
    if (line.startsWith("<")) {
      parts.push(raw);
      i++;
      continue;
    }
    throw new Error(`${file}:${i + 1}: cannot parse: ${line}`);
  }
  closeSection();
  return parts.join("\n");
}

function compilePairRun(lines, i) {
  const parts = [];
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }
    if (t.startsWith("zh:")) {
      parts.push(`    <p class="zh">${applyInline(t.slice(3).trim())}</p>`);
      i++;
      continue;
    }
    if (t.startsWith("en:")) {
      parts.push(`    <p class="en" hidden>${applyInline(t.slice(3).trim())}</p>`);
      i++;
      continue;
    }
    break;
  }
  return { html: parts.join("\n"), next: i };
}

function markdownChrome(meta, compiled) {
  const toc = (meta.toc || []).map(([label, id]) => {
    if (label === "詞彙" || label === "Terms") {
      return `<a href="#${esc(id)}"><span class="zh">詞彙</span><span class="en" hidden>Terms</span></a>`;
    }
    return `<a href="#${esc(id)}">${esc(label)}</a>`;
  }).join("\n    ");
  return `  <p class="kicker"><span class="zh">${esc(meta.kickerZh || "HTMS 經濟科課堂筆記 | 編輯：Mr. Sam Wong | 重要聲明：本課堂筆記僅供已購買課本之學生使用，並僅限內部參考。")}</span><span class="en" hidden>${esc(meta.kickerEn || "HTMS Economics Lesson Notes | Editor: Mr. Sam Wong")}<br>Important: These lesson notes are intended only for students who have purchased the textbook and are for internal use only.</span></p>
  <h1><span class="zh">${esc(meta.headingZh || meta.titleZh || "")}</span><span class="en" hidden>${esc(meta.headingEn || meta.titleEn || "")}</span></h1>
  <div class="meta">
    <div><label><span class="zh">姓名</span><span class="en" hidden>Name</span></label><input type="text"></div>
    <div><label><span class="zh">班別</span><span class="en" hidden>Class</span></label><input type="text"></div>
  </div>
  <nav class="toc">
    ${toc}
  </nav>
${compiled}`;
}

function renderPage(meta, bodyHtml) {
  return `<!DOCTYPE html>
<!-- Generated by econ_notes/build.mjs. Edit src/, then run: node econ_notes/build.mjs -->
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(meta.titleZh || "DSE ECON notes")}</title>
<link rel="stylesheet" href="lib/notes.css">
</head>
<body
  data-ink-key="${esc(meta.inkKey)}"
  data-title-zh="${esc(meta.titleZh)}"
  data-title-en="${esc(meta.titleEn)}"
  data-file-prefix="${esc(meta.filePrefix || "notes")}"
  data-share-zh="${esc(meta.shareZh || "課堂筆記（含筆跡）")}"
  data-share-en="${esc(meta.shareEn || "Annotated class notes")}"
  data-lab="${esc(meta.lab || "../econ_tools/ch01_lab.html")}">
<div class="wrap">
  <div class="toolbar no-print">
    <div class="left">
      <a class="back-link" id="link-home" href="../index.html"><span class="zh">← 返回首頁</span><span class="en" hidden>← Home</span></a>
    </div>
    <div class="right">
      <div class="seg" role="group" aria-label="Language">
        <button type="button" id="btn-zh" class="active">繁</button>
        <button type="button" id="btn-en">EN</button>
      </div>
      <div class="seg" role="group" aria-label="View mode">
        <button type="button" id="btn-full" class="active"><span class="zh">完整</span><span class="en" hidden>Full</span></button>
        <button type="button" id="btn-blank"><span class="zh">填空</span><span class="en" hidden>Blanks</span></button>
        <button type="button" id="btn-click"><span class="zh">點揭</span><span class="en" hidden>Click</span></button>
      </div>
      <div class="draw-bar">
        <div class="seg" role="group" aria-label="Ink">
          <button type="button" id="btn-draw"><span class="zh">畫筆</span><span class="en" hidden>Pen</span></button>
          <button type="button" id="btn-paper"><span class="zh">加紙</span><span class="en" hidden>Add paper</span></button>
        </div>
        <div class="draw-tools" id="draw-tools">
          <button type="button" class="swatch active" data-color="#111827" style="background:#111827" aria-label="Black"></button>
          <button type="button" class="swatch" data-color="#dc2626" style="background:#dc2626" aria-label="Red"></button>
          <button type="button" class="swatch" data-color="#2563eb" style="background:#2563eb" aria-label="Blue"></button>
          <button type="button" class="swatch" data-color="#16a34a" style="background:#16a34a" aria-label="Green"></button>
          <button type="button" class="btn" id="btn-eraser"><span class="zh">擦膠</span><span class="en" hidden>Eraser</span></button>
          <button type="button" class="btn" id="btn-undo"><span class="zh">復原</span><span class="en" hidden>Undo</span></button>
          <button type="button" class="btn" id="btn-clear"><span class="zh">清除筆跡</span><span class="en" hidden>Clear ink</span></button>
        </div>
      </div>
      <a class="btn primary" id="link-lab" href="${esc(meta.lab || "../econ_tools/ch01_lab.html")}"><span class="zh">開啟教具</span><span class="en" hidden>Open lab</span></a>
      <div class="seg" role="group" aria-label="Export">
        <button type="button" id="btn-print"><span class="zh">列印</span><span class="en" hidden>Print</span></button>
        <button type="button" id="btn-share"><span class="zh">分享</span><span class="en" hidden>Share</span></button>
      </div>
    </div>
  </div>

  <p class="click-hint no-print"><span class="zh">點揭模式：空白處點一下就顯示該格答案，再點可藏起。適合投影提問。</span><span class="en" hidden>Click mode: tap a blank to reveal that answer; tap again to hide it. Useful when projecting questions.</span></p>
  <p class="draw-hint no-print"><span class="zh">畫筆已開：可在筆記任何位置書寫。關閉畫筆後才可捲動、點揭或開連結。寫完請按「分享」，在 iPad 選郵件寄出。</span><span class="en" hidden>Pen is on: write anywhere on the notes. Turn the pen off to scroll, tap blanks, or open links. When finished, tap Share and choose Mail on iPad.</span></p>

  <div id="paper-frame">
  <div id="notes-body">
${bodyHtml}
  <div id="extra-pages"></div>
  <canvas id="ink" aria-hidden="true"></canvas>
  </div>
  </div>
</div>
<div id="share-backdrop" class="share-backdrop no-print" hidden></div>
<div id="share-sheet" class="share-sheet no-print" hidden>
  <h3><span class="zh">儲存／分享</span><span class="en" hidden>Save / share</span></h3>
  <p id="share-status"></p>
  <div class="row" id="share-pick">
    <button type="button" class="btn primary" id="btn-capture-view"><span class="zh">目前畫面</span><span class="en" hidden>Current view</span></button>
    <button type="button" class="btn" id="btn-capture-full"><span class="zh">整份筆記</span><span class="en" hidden>Whole notes</span></button>
  </div>
  <div class="row" id="share-send" hidden>
    <button type="button" class="btn primary" id="btn-share-now"><span class="zh">分享到郵件</span><span class="en" hidden>Share to Mail</span></button>
    <button type="button" class="btn" id="btn-download"><span class="zh">下載檔案</span><span class="en" hidden>Download file</span></button>
  </div>
  <div class="row">
    <button type="button" class="btn" id="btn-share-close"><span class="zh">關閉</span><span class="en" hidden>Close</span></button>
  </div>
</div>
<script src="lib/notes.js" defer></script>
</body>
</html>
`;
}

function loadJsonChapter(file) {
  const meta = JSON.parse(fs.readFileSync(path.join(srcDir, file), "utf8"));
  const bodyPath = path.join(srcDir, meta.body);
  const bodyHtml = fs.readFileSync(bodyPath, "utf8").replace(/\s+$/, "") + "\n";
  return { meta, bodyHtml, out: meta.out };
}

function loadMarkdownChapter(file) {
  const text = fs.readFileSync(path.join(srcDir, file), "utf8");
  const { meta, body } = parseFrontmatter(text);
  if (meta.draft) return null;
  const compiled = compileMarkdownBody(body, file);
  const bodyHtml = markdownChrome(meta, compiled);
  return { meta, bodyHtml, out: meta.out };
}

const chapters = [];
for (const name of fs.readdirSync(srcDir).sort()) {
  if (name.startsWith("_") || name === "chapter.starter.md") continue;
  if (name.endsWith(".json")) chapters.push(loadJsonChapter(name));
  else if (name.endsWith(".md")) {
    const ch = loadMarkdownChapter(name);
    if (ch) chapters.push(ch);
  }
}

if (!chapters.length) {
  console.error("No chapters found in", srcDir);
  process.exit(1);
}

for (const ch of chapters) {
  if (!ch.out) throw new Error("missing out: " + JSON.stringify(ch.meta));
  const dest = path.join(root, ch.out);
  const html = renderPage(ch.meta, ch.bodyHtml);
  fs.writeFileSync(dest, html);
  console.log("wrote", path.relative(root, dest));
}
