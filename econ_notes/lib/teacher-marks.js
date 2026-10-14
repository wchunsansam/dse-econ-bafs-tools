(function () {
  const POLL_MS = 8000;
  const notesBody = document.getElementById("notes-body");
  if (!notesBody) return;

  const page = pageId(location.pathname);
  if (!page) return;

  let original = snapshot();
  let marks = { zh: [], en: [] };
  let lastJson = "";
  let saving = false;
  let hold = false;
  let pending = null;
  let timer = 0;

  const bar = document.createElement("div");
  bar.className = "tmark-bar no-print";
  bar.hidden = true;
  bar.innerHTML = [
    '<button type="button" data-act="highlight"><span class="zh">畫重點</span><span class="en" hidden>Highlight</span></button>',
    '<button type="button" data-act="blank"><span class="zh">做成填空</span><span class="en" hidden>Make blank</span></button>',
    '<button type="button" data-act="edit"><span class="zh">改字</span><span class="en" hidden>Edit words</span></button>',
    '<button type="button" data-act="clear"><span class="zh">還原</span><span class="en" hidden>Undo mark</span></button>',
    '<input type="text" hidden maxlength="400" aria-label="Replacement">',
    '<button type="button" data-act="save" hidden><span class="zh">確定</span><span class="en" hidden>Save</span></button>'
  ].join("");
  document.body.appendChild(bar);
  const input = bar.querySelector("input");
  const saveBtn = bar.querySelector('[data-act="save"]');

  const hint = document.createElement("p");
  hint.className = "tmark-hint no-print";
  hint.innerHTML = '<span class="zh">改字已開：選取字詞，再選畫重點、做成填空或改字。學生會看到同一改動。</span><span class="en" hidden>Marking is on: select words, then highlight, make a blank, or edit them. Students see the same change.</span> <span class="tmark-err"><span class="zh">未能儲存，請再試。</span><span class="en" hidden>Could not save. Try again.</span></span>';
  const frame = document.getElementById("paper-frame");
  if (frame) frame.insertAdjacentElement("beforebegin", hint);

  function pageId(pathname) {
    const base = String(pathname || "").split(/[/\\]/).pop().replace(/\.html?$/i, "");
    return /^[A-Za-z0-9_-]{1,80}$/.test(base) ? base : "";
  }

  function isTeacher() {
    return !!(window.HTMSGate && typeof HTMSGate.isTeacher === "function" && HTMSGate.isTeacher());
  }

  function teacherHeader() {
    const code = window.HTMSGate && HTMSGate.TEACHER_CODE;
    return code ? { "x-htms-teacher": code } : {};
  }

  function apiUrl() {
    return new URL("../api/notes-marks", location.href).href;
  }

  function snapshot() {
    const parts = [];
    Array.prototype.forEach.call(notesBody.children, function (child) {
      if (child.id === "ink" || child.id === "extra-pages") return;
      parts.push(child.outerHTML);
    });
    return parts.join("\n");
  }

  function restore() {
    const ink = document.getElementById("ink");
    const extra = document.getElementById("extra-pages");
    notesBody.innerHTML = original;
    if (extra) notesBody.appendChild(extra);
    if (ink) notesBody.appendChild(ink);
  }

  function langOf(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !notesBody.contains(el)) return "";
    const wrap = el.closest(".zh, .en");
    if (!wrap || !notesBody.contains(wrap)) return "";
    return wrap.classList.contains("en") ? "en" : "zh";
  }

  function textNodes(lang) {
    const walker = document.createTreeWalker(notesBody, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (langOf(node) !== lang) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent && parent.closest("#ink, #extra-pages, .tmark-bar")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function langText(lang) {
    return textNodes(lang).map(function (node) { return node.nodeValue; }).join("");
  }

  function offsetsToRange(nodes, start, end) {
    let pos = 0;
    let startNode = null;
    let startOff = 0;
    let endNode = null;
    let endOff = 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const len = node.nodeValue.length;
      if (!startNode && pos + len > start) {
        startNode = node;
        startOff = start - pos;
      }
      if (startNode && pos + len >= end) {
        endNode = node;
        endOff = end - pos;
        break;
      }
      pos += len;
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    return range;
  }

  function rangeFor(mark) {
    const nodes = textNodes(mark.lang);
    const full = nodes.map(function (node) { return node.nodeValue; }).join("");
    const needle = mark.before + mark.text + mark.after;
    const at = full.indexOf(needle);
    if (at < 0 || full.indexOf(needle, at + 1) !== -1) return null;
    const start = at + mark.before.length;
    return offsetsToRange(nodes, start, start + mark.text.length);
  }

  function blockOf(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el ? el.closest("p, li, h1, h2, h3, h4, td, th, div.cell, figcaption, .cap") : null;
  }

  function quoteFor(range) {
    const lang = langOf(range.startContainer);
    if (!lang || lang !== langOf(range.endContainer)) return null;
    if (blockOf(range.startContainer) !== blockOf(range.endContainer)) return null;
    const nodes = textNodes(lang);
    const full = nodes.map(function (node) { return node.nodeValue; }).join("");
    let pos = 0;
    let start = -1;
    let end = -1;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const len = node.nodeValue.length;
      if (node === range.startContainer) start = pos + range.startOffset;
      if (node === range.endContainer) end = pos + range.endOffset;
      pos += len;
    }
    if (start < 0 || end <= start) return null;
    const text = full.slice(start, end);
    if (!text.trim() || text.length > 400) return null;
    let from = start;
    let to = end;
    function count(slice) {
      let n = 0;
      let i = 0;
      while ((i = full.indexOf(slice, i)) !== -1) {
        n += 1;
        i += slice.length;
      }
      return n;
    }
    while (count(full.slice(from, to)) !== 1 && (start - from < 80 || to - end < 80)) {
      if (start - from < 80 && from > 0) from -= 1;
      if (to - end < 80 && to < full.length) to += 1;
      if (start - from >= 80 && to - end >= 80) break;
    }
    if (count(full.slice(from, to)) !== 1) return null;
    return { lang: lang, text: text, before: full.slice(from, start), after: full.slice(end, to) };
  }

  function applyOne(mark) {
    const range = rangeFor(mark);
    if (!range) return;
    if (mark.kind === "edit") {
      range.deleteContents();
      range.insertNode(document.createTextNode(mark.replacement));
      return;
    }
    const el = document.createElement(mark.kind === "blank" ? "span" : "mark");
    el.className = mark.kind === "blank" ? "ans tmark" : "tmark";
    el.dataset.markId = mark.id;
    try {
      range.surroundContents(el);
    } catch (err) {
      el.appendChild(range.extractContents());
      range.insertNode(el);
    }
  }

  function render() {
    restore();
    marks.zh.forEach(function (mark) { applyOne(Object.assign({ lang: "zh" }, mark)); });
    marks.en.forEach(function (mark) { applyOne(Object.assign({ lang: "en" }, mark)); });
    const en = document.body.classList.contains("en");
    notesBody.querySelectorAll(".zh").forEach(function (el) { el.hidden = !!en; });
    notesBody.querySelectorAll(".en").forEach(function (el) { el.hidden = !en; });
    window.dispatchEvent(new Event("resize"));
  }

  function paintLangBits() {
    const en = document.body.classList.contains("en");
    document.querySelectorAll("#btn-tmark .zh, .tmark-bar .zh, .tmark-hint .zh").forEach(function (el) { el.hidden = en; });
    document.querySelectorAll("#btn-tmark .en, .tmark-bar .en, .tmark-hint .en").forEach(function (el) { el.hidden = !en; });
  }

  function hideBar() {
    bar.hidden = true;
    input.hidden = true;
    saveBtn.hidden = true;
    pending = null;
  }

  function placeBar(rect) {
    const gap = 8;
    let top = rect.bottom + gap;
    let left = rect.left;
    bar.hidden = false;
    paintLangBits();
    const box = bar.getBoundingClientRect();
    if (left + box.width > window.innerWidth - 8) left = window.innerWidth - box.width - 8;
    if (left < 8) left = 8;
    if (top + box.height > window.innerHeight - 8) top = Math.max(8, rect.top - box.height - gap);
    bar.style.left = left + "px";
    bar.style.top = top + "px";
  }

  function currentRange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount !== 1) return null;
    const range = sel.getRangeAt(0);
    if (!notesBody.contains(range.commonAncestorContainer)) return null;
    return range;
  }

  function showForSelection() {
    if (!isTeacher() || !document.body.classList.contains("tmark-on") || hold) return;
    if (document.body.classList.contains("draw-on")) return hideBar();
    const range = currentRange();
    if (!range) return hideBar();
    const quote = quoteFor(range);
    if (!quote) return hideBar();
    pending = quote;
    input.hidden = true;
    saveBtn.hidden = true;
    placeBar(range.getBoundingClientRect());
  }

  function newId() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  async function save(lang, list) {
    marks[lang] = list;
    lastJson = JSON.stringify(marks);
    render();
    hideBar();
    if (!isTeacher()) return;
    saving = true;
    try {
      const res = await fetch(apiUrl(), {
        method: "POST",
        headers: Object.assign({ "content-type": "application/json" }, teacherHeader()),
        body: JSON.stringify({ page: page, lang: lang, marks: list }),
        cache: "no-store"
      });
      const data = await res.json();
      saving = false;
      if (!data || !data.ok) {
        hint.dataset.err = "1";
        return;
      }
      delete hint.dataset.err;
      marks = { zh: data.zh || [], en: data.en || [] };
      lastJson = JSON.stringify(marks);
    } catch (err) {
      saving = false;
      hint.dataset.err = "1";
    }
  }

  function addMark(kind, replacement) {
    if (!pending) return;
    const mark = {
      id: newId(),
      kind: kind,
      text: pending.text,
      before: pending.before,
      after: pending.after,
      replacement: replacement || ""
    };
    save(pending.lang, marks[pending.lang].concat([mark]));
  }

  function clearMarks() {
    const range = currentRange();
    if (!range || !pending) return;
    const ids = [];
    notesBody.querySelectorAll("[data-mark-id]").forEach(function (el) {
      if (range.intersectsNode && range.intersectsNode(el)) ids.push(el.dataset.markId);
    });
    if (!ids.length) return;
    save(pending.lang, marks[pending.lang].filter(function (mark) { return ids.indexOf(mark.id) < 0; }));
  }

  bar.addEventListener("pointerdown", function (e) {
    if (e.target === input) {
      hold = true;
      return;
    }
    e.preventDefault();
    hold = true;
  });

  bar.addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "highlight" || act === "blank") addMark(act, "");
    else if (act === "edit") {
      input.hidden = false;
      saveBtn.hidden = false;
      input.value = pending ? pending.text : "";
      placeBar(bar.getBoundingClientRect());
      input.focus();
      input.select();
    } else if (act === "save") {
      const next = input.value;
      if (!pending || !next.trim() || next === pending.text) return;
      addMark("edit", next);
    } else if (act === "clear") clearMarks();
    hold = false;
  });

  document.addEventListener("selectionchange", function () {
    if (hold) return;
    showForSelection();
  });
  document.addEventListener("pointerup", function () {
    hold = false;
    showForSelection();
  });

  async function refresh() {
    if (saving || document.hidden) return;
    try {
      const res = await fetch(apiUrl() + "?page=" + encodeURIComponent(page), { cache: "no-store" });
      const data = await res.json();
      if (!data || !data.ok || saving) return;
      const next = { zh: data.zh || [], en: data.en || [] };
      const json = JSON.stringify(next);
      if (json === lastJson) return;
      marks = next;
      lastJson = json;
      render();
    } catch (err) {}
  }

  function mountButton() {
    if (!isTeacher()) return;
    const group = document.querySelector("[aria-label='View mode']");
    if (!group || document.getElementById("btn-tmark")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-tmark";
    btn.className = "btn";
    btn.innerHTML = '<span class="zh">改字</span><span class="en" hidden>Mark</span>';
    btn.addEventListener("click", function () {
      const on = document.body.classList.toggle("tmark-on");
      btn.classList.toggle("primary", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (!on) hideBar();
      paintLangBits();
    });
    group.insertAdjacentElement("afterend", btn);
    paintLangBits();
  }

  mountButton();
  refresh();
  timer = window.setInterval(refresh, POLL_MS);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });
  const langButtons = document.querySelectorAll("#btn-zh, #btn-en");
  langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.setTimeout(paintLangBits, 0);
    });
  });
})();
