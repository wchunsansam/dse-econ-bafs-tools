(function () {
  const POLL_MS = 4000;
  const SESSION_KEY = "htms-mc-session-v1";
  let chapter = "";
  let on = false;
  let role = "";
  let button = null;
  let onChange = null;
  let timer = 0;
  let first = null;
  let saving = false;

  function chapterId(file) {
    const base = String(file || "").split("/").pop() || "";
    const m = /^Ch0*(\d{1,3})_/i.exec(base);
    if (!m) return "";
    const n = Number(m[1]);
    if (!n) return "";
    return "Ch" + String(n).padStart(2, "0");
  }

  function apiUrl() {
    return new URL("../api/tb-reveal", location.href).href;
  }

  function loadSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
      if (!raw || !raw.token) return null;
      return raw;
    } catch (err) {
      return null;
    }
  }

  function sessionHeader() {
    const session = loadSession();
    return session && session.token ? { "x-mc-session": session.token } : {};
  }

  function dropSession(sent) {
    const now = loadSession();
    if (!sent || !now || sent.token !== now.token) return;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (err) {}
    document.documentElement.classList.remove("notes-teacher");
  }

  function isTeacher() {
    return role === "teacher";
  }

  function applyClass() {
    document.documentElement.classList.toggle("tb-ans-open", !!on);
  }

  function paint(mode) {
    if (!button) return;
    if (mode !== "error" && mode !== "force" && button.dataset.err === "1") return;
    if (mode === "error") button.dataset.err = "1";
    else delete button.dataset.err;
    const en = document.body.classList.contains("en");
    const zh = button.querySelector(".zh");
    const enEl = button.querySelector(".en");
    if (!zh || !enEl) return;
    button.hidden = !isTeacher();
    if (mode === "error") {
      zh.textContent = "未能更新，請再按";
      enEl.textContent = "Could not update. Tap again.";
    } else if (on) {
      zh.textContent = "向你的學生隱藏書本答案";
      enEl.textContent = "Hide textbook answers from your students";
    } else {
      zh.textContent = "向你的學生顯示書本答案";
      enEl.textContent = "Show textbook answers to your students";
    }
    zh.hidden = en;
    enEl.hidden = !en;
    button.classList.toggle("primary", !!on && mode !== "error");
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.disabled = saving;
  }

  function emit() {
    applyClass();
    paint("poll");
    if (typeof onChange === "function") onChange(on);
  }

  async function refresh() {
    if (!chapter) return on;
    const sent = loadSession();
    try {
      const res = await fetch(apiUrl() + "?chapter=" + encodeURIComponent(chapter), {
        cache: "no-store",
        headers: sessionHeader()
      });
      if (res.status === 401) {
        dropSession(sent);
        on = false;
        role = "";
        emit();
        return on;
      }
      const data = await res.json();
      if (data && data.ok && !saving) {
        on = !!data.on;
        role = data.role || "";
        emit();
      } else if (data && data.ok === false) {
        on = false;
        emit();
      }
    } catch {}
    return on;
  }

  async function setOn(next) {
    if (!chapter || !isTeacher() || saving) return false;
    saving = true;
    paint("force");
    try {
      const res = await fetch(apiUrl(), {
        method: "POST",
        headers: Object.assign({ "content-type": "application/json" }, sessionHeader()),
        body: JSON.stringify({ chapter: chapter, on: !!next }),
        cache: "no-store"
      });
      const data = await res.json();
      saving = false;
      if (!data || !data.ok) {
        paint("error");
        return false;
      }
      on = !!data.on;
      role = data.role || role;
      emit();
      paint("force");
      return true;
    } catch {
      saving = false;
      paint("error");
      return false;
    }
  }

  let watching = false;

  function attach(opts) {
    const given = opts && opts.chapterId;
    chapter = (given && /^Ch\d{2,3}$/.test(given) ? given : "") || chapterId(opts && opts.file);
    button = opts && opts.button || null;
    onChange = opts && opts.onChange || null;
    if (button && !button.dataset.bound) {
      button.dataset.bound = "1";
      button.addEventListener("click", function () {
        setOn(!on);
      });
    }
    paint("force");
    if (timer) clearInterval(timer);
    first = refresh();
    if (!watching) {
      watching = true;
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") refresh();
      });
    }
    timer = setInterval(function () {
      if (document.visibilityState === "hidden") return;
      refresh();
    }, POLL_MS);
    return first;
  }

  window.TbReveal = {
    chapterId: chapterId,
    attach: attach,
    refresh: refresh,
    whenReady: function () { return first || Promise.resolve(false); },
    paint: function () { paint("force"); }
  };
})();
