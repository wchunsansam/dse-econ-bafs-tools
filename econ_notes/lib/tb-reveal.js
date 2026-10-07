(function () {
  const POLL_MS = 4000;
  let chapter = "";
  let on = false;
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

  function teacherHeader() {
    const code = window.HTMSGate && HTMSGate.TEACHER_CODE;
    return code ? { "x-htms-teacher": code } : {};
  }

  function isTeacher() {
    return !!(window.HTMSGate && typeof HTMSGate.isTeacher === "function" && HTMSGate.isTeacher());
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
    if (mode === "error") {
      zh.textContent = "未能更新，請再按";
      enEl.textContent = "Could not update. Tap again.";
    } else if (on) {
      zh.textContent = "向學生隱藏書本答案";
      enEl.textContent = "Hide textbook answers";
    } else {
      zh.textContent = "顯示書本答案給學生";
      enEl.textContent = "Show textbook answers to students";
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
    try {
      const res = await fetch(apiUrl() + "?chapter=" + encodeURIComponent(chapter), { cache: "no-store" });
      const data = await res.json();
      if (data && data.ok && !saving) {
        on = !!data.on;
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
        headers: Object.assign({ "content-type": "application/json" }, teacherHeader()),
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
    whenReady: function () { return first || Promise.resolve(false); },
    paint: function () { paint("force"); }
  };
})();
