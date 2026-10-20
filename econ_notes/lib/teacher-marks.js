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
  const SESSION_KEY = "htms-mc-session-v1";
  const needsAccount = /^(ch\d|bafs_)/i.test(page);
  let session = null;
  let role = "";
  let ownerData = null;
  if (needsAccount) document.body.classList.add("notes-lock");

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
  hint.innerHTML = '<span class="zh">改字已開：選取字詞，再選畫重點、做成填空或改字。這些改動存在你的帳號，你的學生會看到。</span><span class="en" hidden>Marking is on: select words, then highlight, make a blank, or edit them. Changes stay on your account, and your students see them.</span> <span class="tmark-err"><span class="zh">未能儲存，請再試。</span><span class="en" hidden>Could not save. Try again.</span></span>';
  const frame = document.getElementById("paper-frame");
  if (frame) frame.insertAdjacentElement("beforebegin", hint);

  function pageId(pathname) {
    const base = String(pathname || "").split(/[/\\]/).pop().replace(/\.html?$/i, "");
    return /^[A-Za-z0-9_-]{1,80}$/.test(base) ? base : "";
  }

  function isTeacher() {
    return role === "teacher";
  }

  function loadSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
      if (!raw || !raw.token) return null;
      if (raw.role === "teacher" && String(raw.account || raw.stno || "").trim()) return raw;
      if (raw.role !== "teacher" && /^\d{4}$/.test(String(raw.stno || ""))) return raw;
    } catch (err) {}
    return null;
  }

  function storeSession(next) {
    session = next;
    const json = JSON.stringify(next);
    try {
      sessionStorage.setItem(SESSION_KEY, json);
      localStorage.setItem(SESSION_KEY, json);
    } catch (err) {}
  }

  function syncAccountClass() {
    const teacher = role === "teacher" || (!role && !!(session && session.role === "teacher"));
    document.documentElement.classList.toggle("notes-teacher", teacher);
  }

  function clearSession() {
    session = null;
    role = "";
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (err) {}
    syncAccountClass();
  }

  function sessionHeader() {
    return session && session.token ? { "x-mc-session": session.token } : {};
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
        headers: Object.assign({ "content-type": "application/json" }, sessionHeader()),
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
      const res = await fetch(apiUrl() + "?page=" + encodeURIComponent(page), {
        cache: "no-store",
        headers: sessionHeader()
      });
      if (res.status === 401) {
        clearSession();
        showLogin("");
        return;
      }
      const data = await res.json();
      if (!data || !data.ok) {
        if (needsAccount && data && data.error === "server") {
          showLogin(document.body.classList.contains("en") ? "Could not reach the account list. Try again." : "未能連線，請再試。");
        }
        return;
      }
      if (saving) return;
      role = data.role || "";
      syncAccountClass();
      unlockNotes(data);
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

  const login = document.createElement("form");
  login.className = "notes-login no-print";
  login.hidden = true;
  login.innerHTML = [
    '<h2><span class="zh">登入後才看筆記</span><span class="en" hidden>Sign in to open the notes</span></h2>',
    '<div class="seg" role="group">',
    '<button type="button" data-who="teacher" class="active"><span class="zh">老師</span><span class="en" hidden>Teacher</span></button>',
    '<button type="button" data-who="student"><span class="zh">學生</span><span class="en" hidden>Student</span></button>',
    '</div>',
    '<label class="who-teacher"><span class="zh">帳號</span><span class="en" hidden>Account</span></label>',
    '<label class="who-student" hidden><span class="zh">學號</span><span class="en" hidden>Class no.</span></label>',
    '<input name="account" autocomplete="username" required>',
    '<label><span class="zh">密碼</span><span class="en" hidden>Password</span></label>',
    '<input name="password" type="password" autocomplete="current-password" required>',
    '<p class="err" hidden></p>',
    '<div class="row"><button class="btn primary" type="submit"><span class="zh">登入</span><span class="en" hidden>Sign in</span></button></div>',
    '<p class="cap"><span class="zh">改字只限老師。改動存在這位老師的帳號，學生看到的是自己老師的筆記。</span><span class="en" hidden>Only a teacher can change the notes. Changes stay on that teacher’s account, and students see their own teacher’s notes.</span></p>'
  ].join("");
  if (frame) frame.insertAdjacentElement("beforebegin", login);
  else document.body.appendChild(login);
  const err = login.querySelector(".err");
  let who = "teacher";

  function paintLogin() {
    const en = document.body.classList.contains("en");
    login.querySelectorAll(".zh").forEach(function (el) { el.hidden = en; });
    login.querySelectorAll(".en").forEach(function (el) { el.hidden = !en; });
    login.querySelectorAll(".who-teacher").forEach(function (el) { el.hidden = who !== "teacher"; });
    login.querySelectorAll(".who-student").forEach(function (el) { el.hidden = who !== "student"; });
    login.querySelectorAll("[data-who]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.who === who);
    });
  }

  function showLogin(message) {
    if (!needsAccount) return;
    document.body.classList.add("notes-lock");
    login.hidden = false;
    err.hidden = !message;
    err.textContent = message || "";
    paintLogin();
    const btn = document.getElementById("btn-tmark");
    if (btn) btn.remove();
    document.body.classList.remove("tmark-on");
    hideBar();
  }

  function showOwner(data) {
    let el = document.getElementById("notes-owner");
    if (!el) {
      el = document.createElement("span");
      el.id = "notes-owner";
      el.className = "notes-owner";
      const group = document.querySelector("[aria-label='View mode']");
      if (group) group.insertAdjacentElement("afterend", el);
    }
    ownerData = data || ownerData;
    const current = data || ownerData || {};
    const en = document.body.classList.contains("en");
    if (current.ambiguous) {
      el.hidden = false;
      el.textContent = en ? "More than one teacher matches this class. Showing the original notes." : "這一班有多於一位老師，先顯示原本筆記。";
      return;
    }
    const name = current.teacherName || current.teacher;
    if (!name) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = en ? name + "’s notes" : name + "的筆記";
  }

  function unlockNotes(data) {
    document.documentElement.classList.remove("notes-account");
    document.body.classList.remove("notes-lock");
    login.hidden = true;
    window.requestAnimationFrame(function () {
      window.dispatchEvent(new Event("resize"));
    });
    showOwner(data || {});
    if (isTeacher()) mountButton();
    paintLangBits();
    if (window.TbReveal && typeof window.TbReveal.refresh === "function") window.TbReveal.refresh();
  }

  login.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-who]");
    if (!btn) return;
    e.preventDefault();
    who = btn.dataset.who === "student" ? "student" : "teacher";
    paintLogin();
  });

  login.addEventListener("submit", function (e) {
    e.preventDefault();
    const account = String(login.elements.account.value || "").trim();
    const password = String(login.elements.password.value || "");
    err.hidden = true;
    const payload = who === "teacher"
      ? { op: "teacherLogin", account: account, password: password }
      : { op: "login", stno: account, password: password };
    fetch(new URL("../api/mc", location.href).href, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (!data || !data.ok || !data.token) {
        showLogin(document.body.classList.contains("en") ? "Account or password is incorrect." : "帳號或密碼不正確。");
        return;
      }
      storeSession({
        token: data.token,
        role: data.role,
        account: data.account || "",
        stno: data.stno || "",
        name: data.name || ""
      });
      login.elements.password.value = "";
      syncAccountClass();
      refresh();
    }).catch(function () {
      showLogin(document.body.classList.contains("en") ? "Could not sign in. Try again." : "未能登入，請再試。");
    });
  });

  session = loadSession();
  syncAccountClass();
  if (needsAccount && !session) showLogin("");
  else refresh();
  timer = window.setInterval(refresh, POLL_MS);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });
  const langButtons = document.querySelectorAll("#btn-zh, #btn-en");
  langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.setTimeout(function () {
        paintLangBits();
        paintLogin();
        showOwner(ownerData);
      }, 0);
    });
  });
})();
