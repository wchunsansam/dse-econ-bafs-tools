(function () {
  "use strict";

  const TEACHER_USER = "chunsansamwong";
  const TCH_KEY = "htms-mc-teachers-v1";
  const TEACHER_SEEDS = [
    { user: "chunsansamwong", password: "0312", name: "Sam Wong" },
    { user: "irene", password: "1234", name: "Irene" },
    { user: "lily", password: "1234", name: "Lily" },
    { user: "kristy", password: "1234", name: "Kristy" }
  ];
  const LS_KEY = "htms-mc-grader-v1";
  const ROLE_KEY = "htms-mc-role";
  const SESSION_KEY = "htms-mc-session-v1";
  const ACC_KEY = "htms-mc-accounts-v1";
  const IDB_NAME = "htms-mc-grader";
  const IDB_STORE = "files";
  const FILE_MAX = 15 * 1024 * 1024;
  const FILE_POST_MAX = 1200000;
  const FILE_BINARY_MAX = 4000000;
  const FILE_CHUNK = 1200000;
  const SUBJECTS = [
    { id: "BAFS-CHI", zh: "BAFS(CHIN)", en: "BAFS (Chinese)" },
    { id: "BAFS-ENG", zh: "BAFS(ENG)", en: "BAFS (English)" },
    { id: "ECON-CHI", zh: "ECON(CHIN)", en: "ECON (Chinese)" },
    { id: "ECON-ENG", zh: "ECON(ENG)", en: "ECON (English)" },
    { id: "BF", zh: "商業基礎 BF", en: "Business Fundamentals" }
  ];
  const FORMS = [
    { id: "3", zh: "中三", en: "Form 3" },
    { id: "4", zh: "中四", en: "Form 4" },
    { id: "5", zh: "中五", en: "Form 5" },
    { id: "6", zh: "中六", en: "Form 6" }
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
    head: { x: 26, w: 52 },
    hw: { x0: 91.0, y0: 26.4, colPitch: 8.5, rowPitch: 4.08, r: 1.18 },
    id: { x0: 121.0, y0: 26.4, colPitch: 7.5, rowPitch: 4.08, r: 1.18 },
    mark: { x0: 164.0, y0: 26.4, colPitch: 7.8, rowPitch: 4.08, r: 1.14 },
    q: {
      x0: 18,
      y0: 76,
      colPitch: 63,
      rowPitch: 10.4,
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

  function scoreCenter(place, value) {
    return {
      x: L.mark.x0 + place * L.mark.colPitch,
      y: L.mark.y0 + value * L.mark.rowPitch
    };
  }

  function sheetLang(spec) {
    if (spec && spec.lang === "en") return "en";
    if (spec && spec.lang === "zh") return "zh";
    const s = normalizeSubjectId(spec && spec.subject);
    if (s === "BAFS-ENG" || s === "ECON-ENG" || s === "BF") return "en";
    return "zh";
  }

  function sl(spec, zh, en) {
    return sheetLang(spec) === "en" ? en : zh;
  }

  function sheetSubjectName(spec) {
    const n = normalizeSubjectId(spec && spec.subject);
    const s = SUBJECTS.find((x) => x.id === n);
    if (s) return sl(spec, s.zh, s.en);
    if (n === "ECON") return sl(spec, "經濟 ECON", "ECON");
    if (n === "BAFS") return sl(spec, "企會財 BAFS", "BAFS");
    return (spec && spec.subject) || "";
  }

  const WORK_TYPES = [
    { id: "H", zh: "功課", en: "Homework" },
    { id: "C", zh: "堂課", en: "Classwork" },
    { id: "U", zh: "統測", en: "Uniform test" }
  ];

  function normalizeWorkType(raw) {
    const s = String(raw || "").trim().toUpperCase();
    if (!s) return "";
    if (s === "H" || s === "HW" || s === "HOMEWORK") return "H";
    if (s === "C" || s === "CW" || s === "CLASSWORK" || s === "CLASS") return "C";
    if (s === "U" || s === "UT" || s === "TEST" || s === "UNIFORM") return "U";
    return "";
  }

  function workTypeMeta(id) {
    const n = normalizeWorkType(id);
    return WORK_TYPES.find((x) => x.id === n) || WORK_TYPES[0];
  }

  function asgWorkType(a) {
    return normalizeWorkType(a && a.workType);
  }

  function asgWorkNo(a) {
    if (!a || a.workNo === "" || a.workNo == null) return null;
    const n = Math.round(Number(a.workNo));
    return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : null;
  }

  function assignmentHwCode(a) {
    const kind = asgWorkType(a);
    const num = asgWorkNo(a);
    if (!kind || num == null) return "";
    return kind + String(num).padStart(2, "0");
  }

  function nextWorkNo(type) {
    const kind = normalizeWorkType(type);
    let max = 0;
    (state.assignments || []).forEach((a) => {
      if (asgWorkType(a) !== kind) return;
      if (asgWorkNo(a) > max) max = asgWorkNo(a);
    });
    return Math.min(99, max + 1);
  }

  function parseHwCode(value) {
    const s = String(value || "").trim().toUpperCase();
    const m = /^(H|C|U)(\d)(\d)$/.exec(s);
    if (!m) return null;
    const kind = m[1];
    const num = Number(m[2]) * 10 + Number(m[3]);
    const meta = workTypeMeta(kind);
    const suffix = num ? " " + num : "";
    return {
      code: s,
      kind,
      num,
      ok: true,
      label: meta.zh + suffix,
      labelEn: meta.en + suffix
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

  function normalizeStno(raw) {
    const s = String(raw || "").trim().toUpperCase().replace(/[\s-]/g, "");
    if (/^\d{4}$/.test(s)) return s;
    const m = /^([1-6])([A-I])(\d{2})$/.exec(s);
    if (m) return m[1] + String(m[2].charCodeAt(0) - 64) + m[3];
    return null;
  }

  function stnoLabel(stno) {
    const p = parseStno(stno);
    return p ? p.stno + "（" + p.label + "）" : String(stno || "");
  }

  function formOfStno(stno) {
    const p = parseStno(stno);
    return p && /^[1-6]$/.test(p.grade) ? p.grade : "";
  }

  function normalizeForm(raw) {
    const s = String(raw || "").trim();
    return /^[1-6]$/.test(s) ? s : "";
  }

  function formLabel(form) {
    const f = normalizeForm(form);
    const hit = FORMS.find((x) => x.id === f);
    if (hit) return t(hit.zh, hit.en);
    return f ? t("中" + "一二三四五六"[Number(f) - 1], "Form " + f) : t("未設年級", "No form");
  }

  function normalizeSubjectId(raw) {
    let s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    s = s.replace(/[()]/g, "").replace(/_+/g, "-");
    if (s === "ECONOMICS") s = "ECON";
    if (s === "ECON" || s === "BAFS") return s;
    const aliases = {
      "ECON-CHI": "ECON-CHI", "ECONCHI": "ECON-CHI", "ECON-CHIN": "ECON-CHI", "ECONCHIN": "ECON-CHI", "ECON-CHINESE": "ECON-CHI",
      "ECON-ENG": "ECON-ENG", "ECONENG": "ECON-ENG", "ECON-ENGLISH": "ECON-ENG",
      "BAFS-CHI": "BAFS-CHI", "BAFSCHI": "BAFS-CHI", "BAFS-CHIN": "BAFS-CHI", "BAFSCHIN": "BAFS-CHI", "BAFS-CHINESE": "BAFS-CHI",
      "BAFS-ENG": "BAFS-ENG", "BAFSENG": "BAFS-ENG", "BAFS-ENGLISH": "BAFS-ENG",
      "BF": "BF", "BUS-FUND": "BF", "BUSFUND": "BF",
      "BUSINESS-FUNDAMENTALS": "BF", "BUSINESSFUNDAMENTALS": "BF", "BUSINESSFUND": "BF"
    };
    if (aliases[s]) return aliases[s];
    return SUBJECTS.some((x) => x.id === s) ? s : "";
  }

  function normalizeSubjects(raw) {
    const ids = Array.isArray(raw) ? raw : String(raw || "").split(/[,+\s]+/);
    const out = [];
    ids.forEach((x) => {
      const id = normalizeSubjectId(x);
      if (id && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  function subjectLabel(id) {
    const n = normalizeSubjectId(id);
    const s = SUBJECTS.find((x) => x.id === n);
    if (s) return t(s.zh, s.en);
    if (n === "ECON") return t("經濟 ECON（舊）", "ECON (legacy)");
    if (n === "BAFS") return t("企會財 BAFS（舊）", "BAFS (legacy)");
    return id || "";
  }

  function subjectsLabel(raw) {
    const ids = normalizeSubjects(raw);
    if (!ids.length) return t("未選科目", "No subject");
    return ids.map((id) => subjectLabel(id)).join(" · ");
  }

  function subjectMatches(asgSubj, studentSubs) {
    const asg = normalizeSubjectId(asgSubj) || "ECON";
    const mine = normalizeSubjects(studentSubs);
    if (!mine.length) return true;
    if (mine.indexOf(asg) >= 0) return true;
    const econ = asg === "ECON" || asg === "ECON-CHI" || asg === "ECON-ENG";
    const bafs = asg === "BAFS" || asg === "BAFS-CHI" || asg === "BAFS-ENG";
    if (econ && (asg === "ECON" || mine.indexOf("ECON") >= 0)) return true;
    if (bafs && (asg === "BAFS" || mine.indexOf("BAFS") >= 0)) return true;
    return false;
  }

  function asgForm(a) {
    return normalizeForm(a && a.form);
  }

  function studentCanAccess(a, me) {
    if (!a) return false;
    const form = asgForm(a);
    const sf = formOfStno(me && me.stno);
    if (form && sf && form !== sf) return false;
    return subjectMatches(a.subject, me && me.subjects);
  }

  function readSubjectPicks(prefix) {
    const ids = [];
    SUBJECTS.forEach((s) => {
      const box = $(prefix + "-" + s.id.toLowerCase());
      if (box && box.checked) ids.push(s.id);
    });
    return ids;
  }

  function subjectPickHtml(prefix, selected) {
    const ids = normalizeSubjects(selected);
    return '<div class="subj-picks">' +
      SUBJECTS.map((s) =>
        '<label class="chk"><input type="checkbox" id="' + prefix + "-" + s.id.toLowerCase() + '"' +
        (ids.indexOf(s.id) >= 0 ? " checked" : "") + "> " + t(s.zh, s.en) + "</label>"
      ).join("") +
    "</div>";
  }

  function hexToBytes(hex) {
    const out = new Uint8Array(String(hex || "").length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  function bytesToHex(u8) {
    return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function timingEqual(a, b) {
    const x = String(a || "");
    const y = String(b || "");
    if (x.length !== y.length) return false;
    let n = 0;
    for (let i = 0; i < x.length; i++) n |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return n === 0;
  }

  async function hashPassword(password, saltHex) {
    const enc = new TextEncoder();
    const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt,
      iterations: 120000,
      hash: "SHA-256"
    }, key, 256);
    return { salt: bytesToHex(salt), hash: bytesToHex(new Uint8Array(bits)) };
  }

  function loadLocalAccounts() {
    try {
      const list = JSON.parse(localStorage.getItem(ACC_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveLocalAccounts(list) {
    localStorage.setItem(ACC_KEY, JSON.stringify(list));
  }

  function getSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
      if (!raw || !raw.token) return null;
      if (raw.role === "teacher") return raw;
      if (/^\d{4}$/.test(raw.stno)) return raw;
    } catch {}
    return null;
  }

  function setSession(sess) {
    try {
      const json = JSON.stringify(sess);
      sessionStorage.setItem(SESSION_KEY, json);
      localStorage.setItem(SESSION_KEY, json);
    } catch {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  function accountStno() {
    const me = getSession();
    return me && me.role !== "teacher" && /^\d{4}$/.test(me.stno) ? me.stno : "";
  }

  function stnoMismatchMsg(got, expected) {
    return t(
      "紙上的學號是 " + stnoLabel(got) + "，與此帳戶 " + stnoLabel(expected) + " 不符，不能提交。",
      "The sheet class no. is " + stnoLabel(got) + ", which does not match this account " + stnoLabel(expected) + ". Submission blocked."
    );
  }

  function defaultState() {
    return { schoolName: "HTMS", assignments: [], mcSubmissions: [], pdfSubmissions: [], writtenScores: [], files: [] };
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      return {
        schoolName: raw.schoolName || "HTMS",
        assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
        mcSubmissions: Array.isArray(raw.mcSubmissions) ? raw.mcSubmissions : [],
        pdfSubmissions: Array.isArray(raw.pdfSubmissions) ? raw.pdfSubmissions : [],
        writtenScores: Array.isArray(raw.writtenScores) ? raw.writtenScores : [],
        files: Array.isArray(raw.files) ? raw.files : []
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
      const sess = getSession();
      if (sess && sess.role === "teacher") return "teacher";
      const r = sessionStorage.getItem(ROLE_KEY) || localStorage.getItem(ROLE_KEY);
      if (r === "student" && sess && sess.role !== "teacher") return "student";
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
    const out = {
      id: a.id,
      title: a.title,
      subject: a.subject,
      form: normalizeForm(a.form),
      n: a.n,
      open: a.open,
      paperOnly: !!a.paperOnly,
      hasMc: a.hasMc !== false,
      hasWritten: !!a.hasWritten,
      workType: asgWorkType(a) || "",
      workNo: asgWorkNo(a),
      writtenMax: a.writtenMax,
      writtenN: a.writtenN,
      writtenEach: a.writtenEach,
      writtenSource: a.writtenSource || "",
      mcSource: a.mcSource || "",
      answersPublished: !!a.answersPublished,
      scriptsReturned: !!a.scriptsReturned,
      createdAt: a.createdAt
    };
    if (a.answersPublished) {
      out.key = Array.isArray(a.key) ? a.key : [];
      out.mcMarks = Array.isArray(a.mcMarks) ? a.mcMarks : [];
      out.mcMarkEach = a.mcMarkEach;
    }
    return out;
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
      incoming.paperOnly = incoming.paperOnly === true;
      if (getRole() === "teacher" && old && Array.isArray(old.key) && old.key.some(Boolean) && (!incoming.key || !incoming.key.some(Boolean))) {
        incoming.key = old.key;
      }
      if (!old || (incoming.updatedAt || incoming.createdAt || "") >= (old.updatedAt || old.createdAt || "")) {
        aMap.set(incoming.id, incoming);
      }
    });
    const mcMap = byId(local.mcSubmissions);
    (r.mcSubmissions || []).forEach((x) => {
      const id = x.id || [x.assignmentId, x.stno, x.at, "mc"].join(":");
      const prev = mcMap.get(id);
      if (!prev || (x.at || "") >= (prev.at || "")) mcMap.set(id, { ...x, id });
    });
    const pdfMap = byId(local.pdfSubmissions);
    (r.pdfSubmissions || []).forEach((x) => {
      const id = x.id || [x.assignmentId, x.stno, x.at, "pdf"].join(":");
      const prev = pdfMap.get(id);
      if (!prev || (x.at || "") >= (prev.at || "")) pdfMap.set(id, { ...x, id });
    });
    const wrMap = byId(local.writtenScores);
    (r.writtenScores || []).forEach((x) => {
      const id = x.id || [x.assignmentId, x.stno, x.at, "wr"].join(":");
      const prev = wrMap.get(id);
      if (!prev || (x.at || "") >= (prev.at || "")) wrMap.set(id, { ...x, id });
    });
    const fileMap = byId(local.files);
    (r.files || []).forEach((x) => {
      if (!x || !x.id) return;
      const prev = fileMap.get(x.id) || {};
      const href = x.fileUrl || x.url || prev.fileUrl || prev.url || "";
      fileMap.set(x.id, { ...prev, ...x, fileUrl: href, url: href, kind: x.kind || prev.kind || "" });
    });
    return {
      schoolName: r.schoolName || local.schoolName,
      assignments: [...aMap.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      mcSubmissions: [...mcMap.values()],
      pdfSubmissions: [...pdfMap.values()],
      writtenScores: [...wrMap.values()],
      files: [...fileMap.values()]
    };
  }

  function apiUrl(query) {
    const origin = (typeof location !== "undefined" && location.origin) ? location.origin : "";
    return origin + "/api/mc" + (query ? "?" + query : "");
  }

  function authHeaders() {
    const headers = { "content-type": "application/json" };
    const sess = getSession();
    if (sess && sess.token) headers["x-mc-session"] = sess.token;
    return headers;
  }

  async function api(payload, method) {
    const headers = authHeaders();
    const opt = { method: method || (payload ? "POST" : "GET"), headers };
    if (payload) opt.body = JSON.stringify(payload);
    const url = payload ? apiUrl() : apiUrl("view=" + (getRole() === "teacher" ? "full" : "open"));
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctrl) opt.signal = ctrl.signal;
    const waitMs = payload && String(payload.op || "").indexOf("uploadFile") === 0 ? 60000 : 15000;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, waitMs) : null;
    try {
      const res = await fetch(url, opt);
      if (res.status === 401 && getRole()) {
        const sess = getSession();
        if (!sess || sess.source !== "local") {
          clearSession();
          clearRole();
          status(t("登入已過期，請重新登入。", "Session expired. Please sign in again."), true);
          renderGate();
        }
      }
      if (!res.ok) throw new Error("api " + res.status);
      return res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function apiPublic(payload) {
    const opt = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    };
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (ctrl) opt.signal = ctrl.signal;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    try {
      const res = await fetch(apiUrl(), opt);
      if (!res.ok) throw new Error("api " + res.status);
      return res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  let cloudOk = false;

  function applySyncResult(remote) {
    if (remote && remote.ok && remote.mode !== "local") {
      cloudOk = true;
      syncNote = t("已同步到雲端。學生請按「重新整理作業」或重新進入此頁。",
        "Synced. Students should tap Refresh assignments or reopen this page.");
      status(syncNote);
      return true;
    }
    cloudOk = false;
    syncNote = t("只存在這部電腦。學生用其他手機／電腦看不到這份作業。",
      "Saved on this device only. Students on other devices will not see this assignment.");
    status(syncNote, true);
    return false;
  }

  async function pullRemote(cur) {
    const role = getRole();
    if (!role) return cur;
    try {
      const remote = await api();
      if (remote && remote.ok) {
        cloudOk = remote.mode !== "local";
        if (role === "teacher" && remote.state && Array.isArray(remote.state.accounts)) {
          roster = remote.state.accounts.map((a) => ({
            stno: a.stno,
            name: a.name || "",
            subjects: normalizeSubjects(a.subjects),
            createdAt: a.createdAt || ""
          }));
        }
        if (role === "teacher" && remote.state && remote.state.teacher) {
          const sess = getSession();
          if (sess) {
            sess.account = remote.state.teacher.user || sess.account;
            sess.name = remote.state.teacher.name || sess.name || "";
            setSession(sess);
          }
        }
        if (role === "student" && remote.state && remote.state.account) {
          const sess = getSession();
          if (sess && sess.stno === remote.state.account.stno) {
            sess.subjects = normalizeSubjects(remote.state.account.subjects);
            sess.name = remote.state.account.name || sess.name || "";
            setSession(sess);
          }
        }
        return mergeState(cur, remote);
      }
    } catch {}
    cloudOk = false;
    return cur;
  }

  async function refreshCloud(opts) {
    const silent = !!(opts && opts.silent);
    const before = (state.assignments || []).map((a) => a.id + ":" + (a.updatedAt || a.title || "")).join("|");
    if (!silent) status(t("正在更新作業…", "Updating assignments…"));
    state = await pullRemote(state);
    saveState(state);
    const after = (state.assignments || []).map((a) => a.id + ":" + (a.updatedAt || a.title || "")).join("|");
    if (!silent || before !== after) renderApp();
    if (!silent) {
      if (cloudOk) status(t("作業清單已更新。", "Assignment list updated."));
      else status(t("未能連上雲端，仍顯示這部裝置上的作業。", "Cloud unavailable; showing assignments on this device."), true);
    }
  }

  async function pushRemote(op, body) {
    const role = getRole();
    if (!role) return { ok: false };
    try {
      return await api({ op, ...body });
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

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  function fileHref(rec) {
    return (rec && (rec.fileUrl || rec.url)) || "";
  }

  const SHEET_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.heic,.heif,image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,image/*,application/pdf,.pdf";

  function isPdfFile(file) {
    return !!(file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")));
  }

  function mimeOfFile(file) {
    if (file && file.type && file.type !== "application/octet-stream") return file.type;
    const n = (file && file.name) || "";
    if (/\.pdf$/i.test(n)) return "application/pdf";
    if (/\.png$/i.test(n)) return "image/png";
    if (/\.jpe?g$/i.test(n)) return "image/jpeg";
    if (/\.webp$/i.test(n)) return "image/webp";
    if (/\.gif$/i.test(n)) return "image/gif";
    if (/\.heic$/i.test(n)) return "image/heic";
    if (/\.heif$/i.test(n)) return "image/heif";
    return (file && file.type) || "";
  }

  function isSheetFile(file) {
    if (!file) return false;
    const mime = mimeOfFile(file);
    if (mime === "application/pdf" || (mime && mime.indexOf("image/") === 0)) return true;
    return /\.(pdf|png|jpe?g|webp|gif|heic|heif)$/i.test(file.name || "");
  }

  function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
        return;
      }
      try {
        const data = canvas.toDataURL("image/jpeg", quality);
        const bin = atob((data.split(",")[1] || ""));
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: "image/jpeg" }));
      } catch {
        resolve(null);
      }
    });
  }

  async function decodeImageFile(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {}
      try {
        return await createImageBitmap(file);
      } catch {}
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image"));
        el.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function drawImageToCanvas(img) {
    const w = img.width || img.naturalWidth || 0;
    const h = img.height || img.naturalHeight || 0;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0);
    if (img.close) img.close();
    return canvas;
  }

  async function fileForCloud(file) {
    if (!file || isPdfFile(file)) return file;
    try {
      const img = await decodeImageFile(file);
      let canvas = fitCanvas(drawImageToCanvas(img), 2400);
      let q = 0.82;
      let blob = await canvasToJpegBlob(canvas, q);
      while (blob && blob.size > FILE_MAX && q > 0.45) {
        q -= 0.1;
        blob = await canvasToJpegBlob(canvas, q);
      }
      while (blob && blob.size > FILE_MAX && canvas.width > 900) {
        canvas = fitCanvas(canvas, Math.round(canvas.width * 0.75));
        blob = await canvasToJpegBlob(canvas, 0.7);
      }
      if (blob && blob.size && blob.size <= FILE_MAX) {
        const name = String(file.name || "sheet").replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
      }
      return file;
    } catch {
      return file;
    }
  }

  async function pushFileBinary(rec, file) {
    const sess = getSession();
    if (!(sess && sess.token) || !file || !file.size || file.size > FILE_BINARY_MAX) {
      return { ok: false, error: "upload" };
    }
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 60000) : null;
    try {
      const res = await fetch((typeof location !== "undefined" ? location.origin : "") + "/api/mc-file", {
        method: "POST",
        headers: {
          "content-type": (file && file.type) || rec.mime || "application/octet-stream",
          "x-mc-session": sess.token,
          "x-mc-id": rec.id,
          "x-mc-assignment": rec.assignmentId,
          "x-mc-stno": rec.stno || "",
          "x-mc-name": encodeURIComponent(rec.fileName || file.name || ""),
          "x-mc-mime": rec.mime || file.type || "",
          "x-mc-kind": rec.kind || "",
          "x-mc-source": rec.source || ""
        },
        body: file,
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) return { ok: false, error: "upload" };
      return await res.json();
    } catch {
      return { ok: false, error: "upload" };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function pushFileToCloud(rec, file) {
    const meta = {
      id: rec.id,
      assignmentId: rec.assignmentId,
      stno: rec.stno,
      fileName: rec.fileName,
      mime: rec.mime,
      source: rec.source || "",
      kind: fileKindOf(rec) || rec.kind || ""
    };
    if (file.size <= FILE_POST_MAX) {
      const data = await fileToBase64(file);
      return pushRemote("uploadFile", { ...meta, data });
    }
    const total = Math.ceil(file.size / FILE_CHUNK);
    const parts = [];
    for (let i = 0; i < total; i++) {
      status(t("正在上載原件… ", "Uploading original… ") + (i + 1) + "/" + total);
      const slice = file.slice(i * FILE_CHUNK, Math.min(file.size, (i + 1) * FILE_CHUNK));
      const data = await fileToBase64(slice);
      const remote = await pushRemote("uploadFilePart", {
        id: rec.id,
        assignmentId: rec.assignmentId,
        stno: rec.stno,
        index: i,
        total,
        data
      });
      if (!remote || !remote.ok || !remote.url) return remote || { ok: false, error: "upload" };
      parts.push(remote.url);
    }
    return pushRemote("uploadFileFinish", { ...meta, total, parts, size: file.size });
  }

  let blobPutMod = null;
  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(function () { reject(new Error("timeout")); }, ms);
      promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
    });
  }

  async function loadBlobPut() {
    if (blobPutMod) return blobPutMod.put || null;
    const urls = [
      "https://esm.sh/@vercel/blob@2.8.0/client?bundle",
      "https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.0/+esm"
    ];
    for (let i = 0; i < urls.length; i++) {
      try {
        const mod = await withTimeout(import(urls[i]), 4000);
        if (mod && typeof mod.put === "function") {
          blobPutMod = mod;
          return mod.put;
        }
      } catch {}
    }
    blobPutMod = {};
    return null;
  }

  async function putBlobOfficial(pathname, file, clientToken) {
    try {
      const put = await loadBlobPut();
      if (!put) return "";
      const out = await put(pathname, file, {
        access: "private",
        token: clientToken,
        contentType: (file && file.type) || "application/octet-stream"
      });
      return (out && out.url) || "";
    } catch {
      return "";
    }
  }

  async function putBlobPrivate(pathname, file, clientToken) {
    const mime = (file && file.type) || "application/octet-stream";
    const url = "https://vercel.com/api/blob/?" + new URLSearchParams({ pathname }).toString();
    const versions = ["12", "10", "7"];
    const storeId = String(clientToken || "").split("_")[3] || "x";
    for (let v = 0; v < versions.length; v++) {
      try {
        const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 120000) : null;
        const res = await fetch(url, {
          method: "PUT",
          headers: {
            authorization: "Bearer " + clientToken,
            "x-api-version": versions[v],
            "x-content-type": mime,
            "x-vercel-blob-access": "private",
            "x-api-blob-request-id": storeId + ":" + Date.now() + ":" + Math.random().toString(16).slice(2)
          },
          body: file,
          signal: ctrl ? ctrl.signal : undefined
        });
        if (timer) clearTimeout(timer);
        if (!res.ok) continue;
        const json = await res.json();
        if (json && json.url) return json.url;
      } catch {}
    }
    return "";
  }

  async function putBlobClient(pathname, file, clientToken) {
    let url = await putBlobOfficial(pathname, file, clientToken);
    if (!url) url = await putBlobPrivate(pathname, file, clientToken);
    return url;
  }

  async function pushFileViaBlobToken(rec, file) {
    status(t("正在上載原件到雲端…", "Uploading original to the cloud…"));
    const tok = await pushRemote("blobToken", {
      id: rec.id,
      assignmentId: rec.assignmentId,
      stno: rec.stno,
      fileName: rec.fileName,
      mime: rec.mime,
      kind: rec.kind || ""
    });
    if (!tok || !tok.clientToken || !tok.pathname) return tok || { ok: false, error: "upload" };
    const url = await putBlobClient(tok.pathname, file, tok.clientToken);
    if (!url) return { ok: false, error: "upload" };
    const saved = await pushRemote("registerFile", {
      id: rec.id,
      assignmentId: rec.assignmentId,
      stno: rec.stno,
      fileName: rec.fileName,
      mime: rec.mime,
      source: rec.source || "",
      kind: rec.kind || "",
      url
    });
    if (saved && saved.ok === false && !saved.url) return { ok: false, error: (saved && saved.error) || "upload" };
    return { ok: true, url: (saved && saved.url) || url };
  }

  function fileKindOf(rec) {
    if (!rec) return "";
    if (rec.kind === "written" || rec.kind === "pdf") return "written";
    if (rec.kind === "mc") return "mc";
    return "";
  }

  function fileKindLabel(kind) {
    if (kind === "written" || kind === "pdf") return t("作答紙", "written sheet");
    if (kind === "mc") return t("MC 紙", "MC sheet");
    return "";
  }

  async function persistSubmissionFile(rec, file) {
    if (!rec || !file) return rec;
    const upload = await fileForCloud(file);
    rec.fileName = rec.fileName || upload.name || file.name || "";
    rec.mime = mimeOfFile(upload) || mimeOfFile(file) || rec.mime || "";
    if (upload !== file && upload.type === "image/jpeg") {
      rec.fileName = String(rec.fileName || "sheet").replace(/\.[^.]+$/, "") + ".jpg";
      rec.mime = "image/jpeg";
    }
    try { await idbPut("file:" + rec.id, upload); } catch {}
    const sess = getSession();
    if (!(sess && sess.token)) {
      rec.fileError = "local";
      return rec;
    }
    if (!upload.size) {
      rec.fileError = "empty";
      return rec;
    }
    if (upload.size > FILE_MAX) {
      rec.fileError = "too-large";
      return rec;
    }
    try {
      let remote = null;
      if (upload.size <= FILE_BINARY_MAX) remote = await pushFileBinary(rec, upload);
      if (!(remote && remote.url)) remote = await pushFileViaBlobToken(rec, upload);
      if (!(remote && remote.url) && upload.size <= FILE_POST_MAX) remote = await pushFileToCloud(rec, upload);
      if (remote && remote.url) {
        rec.fileUrl = remote.url;
        rec.url = remote.url;
        rec.fileError = "";
      } else {
        rec.fileError = (remote && remote.error) || "upload";
      }
    } catch {
      rec.fileError = "upload";
    }
    return rec;
  }

  function upsertFileMeta(state, rec) {
    if (!state.files) state.files = [];
    if (!rec || !rec.id) return;
    const href = fileHref(rec);
    const next = { ...rec, fileUrl: href, url: href, kind: fileKindOf(rec) || rec.kind || "" };
    const i = state.files.findIndex((s) => s.id && s.id === rec.id);
    if (i >= 0) state.files[i] = { ...state.files[i], ...next };
    else state.files.push(next);
  }

  async function storeOriginalUpload(assignment, file, kind, stno) {
    if (!assignment || !file || !stno) return null;
    const rec = {
      id: uid(),
      assignmentId: assignment.id,
      stno,
      fileName: file.name || (kind === "written" ? "written.png" : "mc.png"),
      mime: mimeOfFile(file),
      source: "student-upload",
      kind: kind === "written" ? "written" : "mc",
      at: new Date().toISOString()
    };
    await persistSubmissionFile(rec, file);
    upsertFileMeta(state, rec);
    return rec;
  }

  async function saveStudentOriginals(assignment, files, source) {
    const me = getSession();
    if (getRole() !== "student" || !me || !me.stno || !files || !files.length) return [];
    const kind = source === "written" ? "written" : "mc";
    const out = [];
    status(t("正在保存原件…", "Saving original…"));
    for (let i = 0; i < files.length; i++) {
      const rec = await storeOriginalUpload(assignment, files[i], kind, me.stno);
      if (rec) out.push({ file: files[i], rec });
    }
    saveState(state);
    return out;
  }

  function originalForFile(originals, file) {
    if (!originals || !file) return null;
    const hit = originals.find((o) => o && o.file === file);
    return hit ? hit.rec : null;
  }

  function studentOriginalStatus(messages, originals) {
    const list = originals || [];
    const cloud = list.some((o) => o && o.rec && fileHref(o.rec));
    const failed = list.some((o) => o && o.rec && (o.rec.fileError === "too-large" || o.rec.fileError === "upload" || o.rec.fileError === "empty"));
    const localOnly = list.some((o) => o && o.rec && o.rec.fileError === "local");
    const prefix = messages && messages.length ? messages.join(" ") + " " : "";
    if (failed && !cloud) {
      return prefix + t("原件未能交給老師。每檔最多 15MB，請縮小後再上載。", "The original could not reach the teacher. Each file can be up to 15MB; please shrink it and upload again.");
    }
    if (localOnly && !cloud) {
      return prefix + t("原件只留在這部電腦，老師看不到。請確認已連線後再上載。", "The original stayed on this device; the teacher cannot see it. Connect and upload again.");
    }
    return prefix + t("原件已交給老師，但未能讀到答題紙。請確認四角黑格入鏡。", "Original saved for the teacher, but the sheet could not be read. Keep all four black squares in view.");
  }

  function attachStoredOriginal(sub, row, originals) {
    if (!sub || !row) return;
    const stored = (row.storedFileId
      ? { id: row.storedFileId, fileUrl: row.fileUrl, url: row.fileUrl }
      : originalForFile(originals, row.fileBlob)) || null;
    if (stored && fileHref(stored)) {
      sub.fileUrl = fileHref(stored);
      sub.fileId = stored.id;
    }
  }

  function lookupFileHref(rec) {
    if (!rec) return "";
    const direct = fileHref(rec);
    if (direct) return direct;
    const pools = [state.files || [], state.mcSubmissions || [], state.pdfSubmissions || []];
    const match = (f) => f && fileHref(f) && (!rec.assignmentId || f.assignmentId === rec.assignmentId) && (!rec.stno || String(f.stno) === String(rec.stno));
    for (let p = 0; p < pools.length; p++) {
      const pool = pools[p];
      const same = pool.find((f) => match(f) && (f.id === rec.id || (rec.fileId && f.id === rec.fileId)));
      if (same) return fileHref(same);
      const byName = pool.find((f) => match(f) && rec.fileName && f.fileName === rec.fileName);
      if (byName) return fileHref(byName);
    }
    for (let p = 0; p < pools.length; p++) {
      const any = pools[p].find(match);
      if (any) return fileHref(any);
    }
    return "";
  }

  function assignmentFileRecords(assignmentId, stno) {
    const out = [];
    const seen = new Set();
    const add = (r, kindHint) => {
      if (!r || !r.id || seen.has(r.id)) return;
      if (assignmentId && r.assignmentId !== assignmentId) return;
      if (stno && String(r.stno) !== String(stno)) return;
      const href = lookupFileHref(r);
      if (!href) return;
      seen.add(r.id);
      out.push({
        ...r,
        fileUrl: href,
        url: href,
        kind: fileKindOf(r) || kindHint || ""
      });
    };
    (state.files || []).forEach((r) => add(r));
    (state.pdfSubmissions || []).forEach((s) => {
      if (s && (s.fileUrl || s.url || s.fileName)) add(s, "written");
    });
    (state.mcSubmissions || []).forEach((s) => {
      if (s && (s.fileUrl || s.url || s.fileName) && s.source !== "web") add(s, "mc");
    });
    return out.sort((a, b) => Number(!fileHref(b)) - Number(!fileHref(a)) || String(a.stno).localeCompare(String(b.stno)) || String(a.at || "").localeCompare(String(b.at || "")));
  }

  async function openCloudFile(id) {
    if (!id) return null;
    const res = await fetch((typeof location !== "undefined" ? location.origin : "") + "/api/mc-file?id=" + encodeURIComponent(id), {
      headers: authHeaders()
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob && blob.size ? blob : null;
  }

  async function openStoredFile(rec) {
    if (!rec) return;
    const ids = [rec.id, rec.fileId].filter(Boolean);
    const tryIds = async () => {
      for (let i = 0; i < ids.length; i++) {
        try {
          const blob = await openCloudFile(ids[i]);
          if (blob) return blob;
        } catch {}
      }
      return null;
    };
    let blob = await tryIds();
    if (!blob) {
      try {
        state = await pullRemote(state);
        saveState(state);
      } catch {}
      blob = await tryIds();
    }
    if (blob) {
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
      return;
    }
    const href = lookupFileHref(rec) || fileHref(rec);
    if (href && /public\.blob\.vercel-storage\.com/i.test(href)) {
      window.open(href, "_blank", "noopener");
      return;
    }
    try { blob = await idbGet("file:" + rec.id); } catch {}
    if (!blob) {
      try { blob = await idbGet("pdf:" + rec.id); } catch {}
    }
    if (!blob) {
      status(t("這份檔案只留在當初上載的那部電腦。請學生再上載一次 PNG／相片／PDF。", "This file is only on the device that uploaded it. Ask the student to upload the PNG / photo / PDF again."), true);
      return;
    }
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  }

  function fileListHtml(recs, opts) {
    const showStno = !(opts && opts.hideStno);
    if (!recs || !recs.length) {
      return '<p class="hint">' + t("尚未有上載檔案。", "No uploaded files yet.") + "</p>";
    }
    return '<ul class="file-list">' + recs.map((r) => {
      const klab = fileKindLabel(fileKindOf(r) || r.kind);
      return "<li><strong>" + (showStno ? escapeHtml(r.stno || "") + " " : "") + "</strong>" +
      escapeHtml(r.fileName || t("檔案", "File")) +
      (klab ? " · " + escapeHtml(klab) : "") +
      (parseHwCode(r.hwCode) ? " · " + escapeHtml(hwDisplay(r.hwCode)) : "") +
      " · " + escapeHtml(sourceLabel(r.source)) +
      (r.at ? " · " + escapeHtml(formatAt(r.at)) : "") +
      ' <button type="button" class="btn" data-openfile="' + escapeHtml(r.id) + '">' + t("開啟", "Open") + "</button></li>";
    }).join("") + "</ul>";
  }

  function bindFileList(host, recs) {
    if (!host) return;
    host.querySelectorAll("[data-openfile]").forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute("data-openfile");
        openStoredFile((recs || []).find((r) => r.id === id));
      };
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

  function markPts(markList, i) {
    const v = Array.isArray(markList) ? Number(markList[i]) : NaN;
    return Number.isFinite(v) && v >= 0 ? v : 1;
  }

  function mcMarkList(asg) {
    const n = (asg && asg.n) || 0;
    const custom = (asg && Array.isArray(asg.mcMarks)) ? asg.mcMarks : [];
    const each = Number(asg && asg.mcMarkEach);
    const fallback = Number.isFinite(each) && each > 0 ? each : 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = Number(custom[i]);
      out.push(Number.isFinite(v) && v >= 0 ? v : fallback);
    }
    return out;
  }

  function asgHasWritten(a) {
    return !!(a && a.hasWritten);
  }

  function asgHasMc(a) {
    return !!(a && a.hasMc !== false);
  }

  function asgTypeLabel(a) {
    const kind = asgWorkType(a);
    const num = asgWorkNo(a);
    if (!kind && num == null) return "";
    if (!kind) return String(num);
    const meta = WORK_TYPES.find((x) => x.id === kind);
    const name = meta ? t(meta.zh, meta.en) : kind;
    if (num == null || num === 0) return name;
    return name + " " + num;
  }

  function asgShortMeta(a) {
    const bits = [];
    if (asgForm(a)) bits.push(formLabel(asgForm(a)));
    bits.push(subjectLabel(a.subject));
    const typeLab = asgTypeLabel(a);
    if (typeLab) bits.push(typeLab);
    if (asgHasMc(a)) bits.push((a.n || 0) + t("題", "Q"));
    if (asgHasWritten(a)) bits.push(t("連長題", "written"));
    return bits.join(" · ");
  }

  function writtenItemMaxes(asg) {
    const n = Math.max(1, Math.min(5, Math.round(Number(asg && asg.writtenN) || 1)));
    const each = Number(asg && asg.writtenEach);
    const fb = Number.isFinite(each) && each > 0 ? each : 0;
    const custom = (asg && Array.isArray(asg.writtenMarks)) ? asg.writtenMarks : [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = Number(custom[i]);
      out.push(Number.isFinite(v) && v >= 0 ? v : fb);
    }
    return out;
  }

  function writtenMaxOf(asg) {
    const sum = writtenItemMaxes(asg).reduce((p, n) => p + n, 0);
    if (sum > 0) return Math.min(100, sum);
    const v = Number(asg && asg.writtenMax);
    return Number.isFinite(v) && v > 0 ? Math.min(100, v) : 100;
  }

  function asgAnswersPublished(a) {
    return !!(a && a.answersPublished);
  }

  function asgScriptsReturned(a) {
    return !!(a && a.scriptsReturned);
  }

  function teacherAccount() {
    const me = getSession();
    return String((me && (me.account || me.stno)) || "").trim().toLowerCase();
  }

  function assignmentOwner(a) {
    return String((a && a.createdBy) || TEACHER_USER).trim().toLowerCase();
  }

  function canDeleteAssignment(a) {
    return !!a && assignmentOwner(a) === teacherAccount();
  }

  function fmtMark(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const r = Math.round(Number(n) * 10) / 10;
    return Math.abs(r - Math.round(r)) < 1e-6 ? String(Math.round(r)) : r.toFixed(1);
  }

  function gradeAnswers(answers, key, markList) {
    const list = Array.isArray(answers) ? answers : [];
    if (!key || !key.length) return { score: null, max: list.length, marks: list.map(() => null) };
    const n = Math.max(list.length, key.length);
    const marks = [];
    let score = 0;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const k = String(key[i] || "").toUpperCase();
      const a = list[i];
      const pts = markPts(markList, i);
      if (!k || k === "-" || k === ".") {
        marks.push(null);
        continue;
      }
      max += pts;
      const ok = a === k;
      marks.push(ok);
      if (ok) score += pts;
    }
    return { score, max, marks };
  }

  function upsertWritten(state, rec) {
    if (!state.writtenScores) state.writtenScores = [];
    const i = state.writtenScores.findIndex((s) => s.id && s.id === rec.id);
    if (i >= 0) state.writtenScores[i] = rec;
    else state.writtenScores.push(rec);
  }

  function latestWritten(assignmentId, stno) {
    const list = (state.writtenScores || []).filter((s) => s.assignmentId === assignmentId && (!stno || s.stno === stno));
    if (stno) {
      let best = null;
      list.forEach((s) => {
        if (!best || (s.at || "") >= (best.at || "")) best = s;
      });
      return best;
    }
    const map = new Map();
    list.forEach((s) => {
      const prev = map.get(s.stno);
      if (!prev || (s.at || "") >= (prev.at || "")) map.set(s.stno, s);
    });
    return [...map.values()];
  }

  function upsertMc(state, sub) {
    const i = state.mcSubmissions.findIndex((s) => s.id && s.id === sub.id);
    if (i >= 0) state.mcSubmissions[i] = sub;
    else state.mcSubmissions.push(sub);
  }

  function upsertPdf(state, sub) {
    const i = state.pdfSubmissions.findIndex((s) => s.id && s.id === sub.id);
    if (i >= 0) state.pdfSubmissions[i] = sub;
    else state.pdfSubmissions.push(sub);
  }

  function latestByStudent(list, assignmentId, needAnswers) {
    const map = new Map();
    (list || []).forEach((s) => {
      if (s.assignmentId !== assignmentId) return;
      if (needAnswers && !Array.isArray(s.answers)) return;
      const prev = map.get(s.stno);
      if (!prev || (s.at || "") >= (prev.at || "")) map.set(s.stno, s);
    });
    return [...map.values()];
  }

  function historyByStudent(list, assignmentId, stno, needAnswers) {
    return (list || []).filter((s) => {
      if (s.assignmentId !== assignmentId || s.stno !== stno) return false;
      if (needAnswers && !Array.isArray(s.answers)) return false;
      return true;
    }).slice().sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  }

  function formatAt(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
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

  function addWriteLines(root, cls, topMm, botMm, pitch) {
    const wrap = el("div", cls, {
      top: topMm + "mm",
      bottom: (L.pageH - botMm) + "mm"
    });
    const count = Math.max(0, Math.floor((botMm - topMm) / pitch));
    for (let i = 0; i < count; i++) wrap.appendChild(el("div", "mc-rule"));
    root.appendChild(wrap);
    return wrap;
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
    const title = String(spec.title || "").trim();
    const n = Math.max(1, Math.min(60, spec.n || 40));

    const head = el("div", "mc-head");
    head.innerHTML =
      '<div class="mc-school"><span class="mc-school-name"></span></div>' +
      '<div class="mc-sub"></div>' +
      '<div class="mc-name-row"><span class="mc-k"></span><span class="mc-name-line"></span><span class="mc-k"></span><span class="mc-date-line"></span></div>' +
      '<div class="mc-hint"></div>';
    head.querySelector(".mc-school-name").textContent = school;
    if (title) {
      const asg = el("span", "mc-school-asg");
      asg.textContent = title;
      head.querySelector(".mc-school").appendChild(asg);
    }
    head.querySelector(".mc-sub").textContent = sheetSubjectName(spec);
    const keys = head.querySelectorAll(".mc-k");
    keys[0].textContent = sl(spec, "姓名", "Name");
    keys[1].textContent = sl(spec, "日期", "Date");
    head.querySelector(".mc-hint").textContent = kind === "mc"
      ? sl(spec,
        "請用深色筆將圓圈完全填滿，勿打剔。功課／UT：H=功課、U=統測，後兩格編號（功課 3 → H03）。",
        "Fill each bubble completely in dark ink. Do not tick. H = homework, U = uniform test; last two digits are the number (HW 3 → H03).")
      : sl(spec,
        "請用深色筆將學號與功課／UT 圓圈填滿，然後在橫線上作答。功課 3 → H03。右側評分欄僅老師改卷後填總分（0–100）。",
        "Fill class no. and HW/UT bubbles in dark ink, then write on the lines. HW 3 → H03. The marks column on the right is for the teacher to fill the total (0–100).");
    root.appendChild(head);

    const hwLab = el("div", "mc-hwlab");
    hwLab.textContent = sl(spec, "功課 / UT 編號", "HW / UT no.");
    root.appendChild(hwLab);
    const idLab = el("div", "mc-idlab");
    idLab.appendChild(document.createTextNode(sl(spec, "班別 / 學號", "Class no.")));
    const idEx = el("span", "mc-idex");
    idEx.textContent = "4A01 → 4101";
    idLab.appendChild(idEx);
    root.appendChild(idLab);
    const labsvg = makeLabelSvg();
    root.appendChild(labsvg);
    const colCapY = L.id.y0 - L.id.r - 3.15;
    const hwCaps = ["H/U", sl(spec, "十", "10"), sl(spec, "個", "1")];
    for (let d = 0; d < 3; d++) {
      svgCap(labsvg, hwCenter(d, 0).x, colCapY, hwCaps[d], 1.85);
    }
    for (let d = 0; d < 4; d++) {
      svgCap(labsvg, idCenter(d, 0).x, colCapY, "D" + (d + 1), 1.9);
    }
    ["H", "U"].forEach((ch, v) => {
      const cy = hwCenter(0, v).y;
      const lab = el("div", "mc-idv mc-hwkind", {
        left: (L.hw.x0 - 8.6) + "mm",
        top: (cy - 1.15) + "mm"
      });
      lab.textContent = ch;
      root.appendChild(lab);
      addBubble(root, hwCenter(0, v).x, cy, L.hw.r);
    });
    for (let v = 0; v < 10; v++) {
      const cy = hwCenter(1, v).y;
      const lab = el("div", "mc-idv", {
        left: (hwCenter(1, v).x - 5.6) + "mm",
        top: (cy - 1.15) + "mm"
      });
      lab.textContent = String(v);
      root.appendChild(lab);
      addBubble(root, hwCenter(1, v).x, cy, L.hw.r);
      addBubble(root, hwCenter(2, v).x, cy, L.hw.r);
    }
    for (let v = 0; v < 10; v++) {
      const cy = idCenter(0, v).y;
      const lab = el("div", "mc-idv", {
        left: (idCenter(0, v).x - 6.2) + "mm",
        top: (cy - 1.15) + "mm"
      });
      lab.textContent = String(v);
      root.appendChild(lab);
      for (let d = 0; d < 4; d++) {
        const c = idCenter(d, v);
        const pre = String(spec.prefillStno || "");
        addBubble(root, c.x, c.y, L.id.r, pre.length === 4 && pre[d] === String(v) ? "filled" : "");
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
      const page = spec.page || 1;
      const total = Math.max(1, Math.min(WR_PAGES_MAX, spec.writtenPages || WR_PAGES_MAX));
      const linePitch = 6.35;
      const lineBot = L.pageH - 14;
      const bandBot = Math.max(
        L.id.y0 + 9 * L.id.rowPitch + L.id.r,
        page === 1 ? scoreCenter(2, 9).y + L.mark.r : 0
      ) + 2.4;
      if (page === 1) {
        const wqLab = el("div", "mc-wqlab");
        wqLab.textContent = sl(spec, "評分欄 0–100（僅老師填）", "Marks 0–100 (teacher only)");
        root.appendChild(wqLab);
        for (let v = 0; v < 10; v++) {
          const cy = scoreCenter(0, v).y;
          const lab = el("div", "mc-idv", {
            left: (L.mark.x0 - 6.2) + "mm",
            top: (cy - 1.15) + "mm"
          });
          lab.textContent = String(v);
          root.appendChild(lab);
        }
        const totLabs = sl(spec, ["百", "十", "個"], ["100", "10", "1"]);
        const totMax = [1, 9, 9];
        for (let place = 0; place < 3; place++) {
          svgCap(labsvg, scoreCenter(place, 0).x, colCapY, totLabs[place], 1.8);
          for (let v = 0; v <= totMax[place]; v++) {
            const c = scoreCenter(place, v);
            addBubble(root, c.x, c.y, L.mark.r);
          }
        }
      }
      addWriteLines(root, "mc-lines mc-lines-full", bandBot, lineBot, linePitch);
      const foot = el("div", "mc-write-foot");
      foot.textContent = "P." + page + " / " + total +
        (page < total ? sl(spec, "  ·  不夠空位可續下頁", "  ·  Continue overleaf") : "");
      root.appendChild(foot);
    }
    recenterInk(labsvg);
    return root;
  }

  const WR_PAGES_MAX = 6;
  const WR_PAGES_KEY = "htms-mc-wr-pages-v1";

  function writtenPageCount() {
    const box = $("s-wr-pages") || $("t-wr-pages");
    if (box) {
      const n = Math.max(1, Math.min(WR_PAGES_MAX, Number(box.value) || WR_PAGES_MAX));
      try { sessionStorage.setItem(WR_PAGES_KEY, String(n)); } catch {}
      return n;
    }
    try {
      const n = Number(sessionStorage.getItem(WR_PAGES_KEY));
      if (n >= 1 && n <= WR_PAGES_MAX) return n;
    } catch {}
    return WR_PAGES_MAX;
  }

  function writtenPagesSelectHtml(id) {
    const cur = writtenPageCount();
    return '<label class="wr-pages">' + t("作答紙頁數", "Written pages") +
      '<select id="' + id + '">' +
      Array.from({ length: WR_PAGES_MAX }, (_, i) => {
        const n = i + 1;
        return '<option value="' + n + '"' + (n === cur ? " selected" : "") + ">" + n + "</option>";
      }).join("") +
      "</select></label>";
  }

  function sheetsForPrint(spec) {
    if (spec.kind === "written") {
      const pages = Math.max(1, Math.min(WR_PAGES_MAX, spec.writtenPages || writtenPageCount()));
      return Array.from({ length: pages }, (_, i) =>
        renderSheet({ ...spec, kind: "written", page: i + 1, writtenPages: pages })
      );
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

  function readWrittenMark(H, gray, w, h, paper) {
    const pickRow = (row, maxV) => {
      const scores = [];
      for (let v = 0; v <= maxV; v++) {
        const c = scoreCenter(row, v);
        scores.push(sampleDisk(H, gray, w, h, c.x, c.y, L.mark.r, 0.62));
      }
      return pickMarked(scores, paper, 0.06);
    };
    const hun = pickRow(0, 1);
    const ten = pickRow(1, 9);
    const one = pickRow(2, 9);
    const any = [hun, ten, one].some((p) => p.index >= 0);
    if (!any) return { ok: false, score: null, flag: "" };
    if (hun.flag === "multi" || ten.flag === "multi" || one.flag === "multi") {
      return { ok: false, score: null, flag: "multi" };
    }
    const hunVal = hun.index < 0 ? 0 : hun.index;
    const tenVal = ten.index < 0 ? 0 : ten.index;
    const oneVal = one.index < 0 ? 0 : one.index;
    let score = hunVal * 100 + tenVal * 10 + oneVal;
    if (score > 100) score = 100;
    return { ok: true, score, flag: "" };
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

    if (kind === "written") {
      const mark = readWrittenMark(H, gray, w, h, paper);
      result.writtenItems = [];
      result.writtenScore = mark.score;
      result.writtenOk = mark.ok;
      if (mark.flag) result.flags.push("score:" + mark.flag);
      return result;
    }

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
    } else if ((spec.page || 1) === 1) {
      const rowMax = [1, 9, 9];
      for (let row = 0; row < 3; row++) {
        for (let v = 0; v <= rowMax[row]; v++) {
          const c = scoreCenter(row, v);
          ctx.beginPath();
          ctx.arc(c.x * scale, c.y * scale, L.mark.r * scale, 0, Math.PI * 2);
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
      if ((spec.page || 1) === 1 && fills.writtenScore != null && fills.writtenScore !== "") {
        const n = Math.max(0, Math.min(100, Math.round(Number(fills.writtenScore))));
        if (Number.isFinite(n)) {
          fillDiskOnSheetCanvas(ctx, scale, scoreCenter(0, Math.floor(n / 100)).x, scoreCenter(0, Math.floor(n / 100)).y, L.mark.r);
          fillDiskOnSheetCanvas(ctx, scale, scoreCenter(1, Math.floor((n % 100) / 10)).x, scoreCenter(1, Math.floor((n % 100) / 10)).y, L.mark.r);
          fillDiskOnSheetCanvas(ctx, scale, scoreCenter(2, n % 10).x, scoreCenter(2, n % 10).y, L.mark.r);
        }
      }
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
    const answers = ["A", "C", "B", "D", "A", "A", "B", "C", "D", "B", "C", "A"];
    const cases = [];
    const add = (name, spec, fills, forceKind, check) => {
      const canvas = rasterizeSheet(spec, fills);
      const read = readSheet(canvas, { n: spec.n || 20, forceKind });
      let error = "";
      try { error = check(read) || ""; } catch (err) { error = String(err && err.message || err); }
      cases.push({
        name,
        pass: !error,
        error,
        read: {
          ok: read.ok,
          stno: read.stno,
          hwCode: read.hwCode,
          kind: read.kind,
          writtenScore: read.writtenScore,
          writtenItems: read.writtenItems,
          answers: (read.answers || []).slice(0, 12),
          flags: read.flags
        }
      });
      return read;
    };
    const mcChi = { kind: "mc", n: 12, subject: "ECON-CHI", title: "SELFTEST", schoolName: "HTMS" };
    const mcEng = { kind: "mc", n: 12, subject: "ECON-ENG", title: "SELFTEST", schoolName: "HTMS" };
    const wrChi = { kind: "written", n: 20, subject: "BAFS-CHI", title: "WR-ZH", schoolName: "HTMS", page: 1 };
    const wrEng = { kind: "written", n: 20, subject: "BAFS-ENG", title: "WR-EN", schoolName: "HTMS", page: 1 };
    const wrBf = { kind: "written", n: 20, subject: "BF", title: "WR-BF", schoolName: "HTMS", page: 1 };
    const read = add("mc-zh-4101-H03", mcChi, { stno: "4101", hwCode: "H03", answers }, "mc", (r) => {
      if (!r.ok || r.stno !== "4101" || r.hwCode !== "H03") return "id/hw";
      if (!answers.every((a, i) => r.answers[i] === a)) return "answers";
      return "";
    });
    const utRead = add("mc-en-4203-U12", mcEng, { stno: "4203", hwCode: "U12", answers }, "mc", (r) => {
      if (!r.ok || r.stno !== "4203" || r.hwCode !== "U12") return "id/hw";
      if (!answers.every((a, i) => r.answers[i] === a)) return "answers";
      return "";
    });
    add("mc-f3-3108-H01", { ...mcChi, subject: "BF" }, { stno: "3108", hwCode: "H01", answers }, "mc", (r) => {
      if (r.stno !== "3108" || r.hwCode !== "H01") return "id/hw";
      return "";
    });
    add("mc-6501-U09", mcEng, { stno: "6501", hwCode: "U09", answers }, "mc", (r) => {
      if (r.stno !== "6501" || r.hwCode !== "U09") return "id/hw";
      return "";
    });
    add("wr-zh-total-73", wrChi, { stno: "4101", hwCode: "H01", writtenScore: 73 }, "written", (r) => {
      if (r.stno !== "4101" || r.hwCode !== "H01" || r.kind !== "written") return "id/hw/kind";
      if (r.writtenScore !== 73) return "score " + r.writtenScore;
      return "";
    });
    add("wr-en-total-100", wrEng, { stno: "4208", hwCode: "U05", writtenScore: 100 }, "written", (r) => {
      if (r.stno !== "4208" || r.hwCode !== "U05") return "id/hw";
      if (r.writtenScore !== 100) return "score " + r.writtenScore;
      return "";
    });
    add("wr-bf-total-8", wrBf, { stno: "3302", hwCode: "H15", writtenScore: 8 }, "written", (r) => {
      if (r.stno !== "3302" || r.hwCode !== "H15") return "id/hw";
      if (r.writtenScore !== 8) return "score " + r.writtenScore;
      return "";
    });
    add("wr-zh-total-0", wrChi, { stno: "4112", hwCode: "H02", writtenScore: 0 }, "written", (r) => {
      if (r.writtenScore !== 0) return "score " + r.writtenScore;
      return "";
    });
    add("wr-zh-total-99", wrChi, { stno: "5301", hwCode: "H07", writtenScore: 99 }, "written", (r) => {
      if (r.stno !== "5301" || r.hwCode !== "H07") return "id/hw";
      if (r.writtenScore !== 99) return "score " + r.writtenScore;
      return "";
    });
    add("wr-en-total-1", wrEng, { stno: "6404", hwCode: "U03", writtenScore: 1 }, "written", (r) => {
      if (r.writtenScore !== 1) return "score " + r.writtenScore;
      return "";
    });
    add("wr-total-88", wrChi, { stno: "4106", hwCode: "H04", writtenScore: 88 }, "written", (r) => {
      if (r.writtenScore !== 88) return "total " + r.writtenScore;
      return "";
    });
    add("wr-zeros-id", wrEng, { stno: "0000", hwCode: "H00", writtenScore: 40 }, "written", (r) => {
      if (r.stno !== "0000" || r.hwCode !== "H00") return "id/hw";
      if (r.writtenScore !== 40) return "total " + r.writtenScore;
      return "";
    });
    const forty = Array(40).fill("A");
    forty[0] = "B";
    forty[19] = "C";
    forty[20] = "D";
    forty[39] = "B";
    add("mc-40-q21", { ...mcChi, n: 40 }, { stno: "4111", hwCode: "H05", answers: forty }, "mc", (r) => {
      if (r.stno !== "4111" || r.hwCode !== "H05") return "id/hw";
      if (r.answers[0] !== "B") return "q1 " + r.answers[0];
      if (r.answers[19] !== "C") return "q20 " + r.answers[19];
      if (r.answers[20] !== "D") return "q21 " + r.answers[20];
      if (r.answers[39] !== "B") return "q40 " + r.answers[39];
      return "";
    });
    try {
      const pngCanvas = rasterizeSheet(mcChi, { stno: "4101", hwCode: "H03", answers });
      const pngBlob = await new Promise((resolve, reject) => {
        pngCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
      });
      const pngFile = new File([pngBlob], "homework.png", { type: "image/png" });
      if (!isSheetFile(pngFile)) throw new Error("accept");
      const pngPages = await fileToCanvases(pngFile);
      const pngRead = readSheet(pngPages[0], { n: 12 });
      let pngErr = "";
      if (!pngRead.ok || pngRead.stno !== "4101" || pngRead.hwCode !== "H03") pngErr = "id/hw";
      else if (!answers.every((a, i) => pngRead.answers[i] === a)) pngErr = "answers";
      cases.push({ name: "png-upload", pass: !pngErr, error: pngErr, read: { ok: pngRead.ok, stno: pngRead.stno, hwCode: pngRead.hwCode } });
      const jpgBlob = await canvasToJpegBlob(pngCanvas, 0.88);
      const jpgFile = new File([jpgBlob], "homework.jpg", { type: "image/jpeg" });
      const jpgPages = await fileToCanvases(jpgFile);
      const jpgRead = readSheet(jpgPages[0], { n: 12 });
      let jpgErr = "";
      if (!jpgRead.ok || jpgRead.stno !== "4101") jpgErr = "id";
      else if (jpgRead.answers[0] !== answers[0]) jpgErr = "q1";
      cases.push({ name: "jpg-upload", pass: !jpgErr, error: jpgErr, read: { ok: jpgRead.ok, stno: jpgRead.stno } });
    } catch (err) {
      cases.push({ name: "png-upload", pass: false, error: String(err && err.message || err), read: {} });
    }
    const gapErr = layoutOverlapError();
    cases.push({ name: "layout-clearance", pass: !gapErr, error: gapErr, read: {} });
    const pass = cases.every((c) => c.pass);
    return { pass, cases, read, utRead, expect: { stno: "4101", hwCode: "H03", answers } };
  }

  function layoutOverlapError() {
    const minGap = 0.85;
    const far = (a, b, r) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy) + 1e-6 >= 2 * r + minGap;
    };
    for (let v = 0; v < 9; v++) {
      if (!far(idCenter(0, v), idCenter(0, v + 1), L.id.r)) return "id-row";
      if (!far(hwCenter(1, v), hwCenter(1, v + 1), L.hw.r)) return "hw-row";
    }
    if (!far(hwCenter(0, 0), hwCenter(0, 1), L.hw.r)) return "hw-kind";
    for (let d = 0; d < 3; d++) {
      if (!far(idCenter(d, 0), idCenter(d + 1, 0), L.id.r)) return "id-col";
    }
    if (!far(hwCenter(0, 0), hwCenter(1, 0), L.hw.r)) return "hw-col";
    if (!far(hwCenter(2, 0), hwCenter(1, 0), L.hw.r)) return "hw-col2";
    if (!far(scoreCenter(0, 0), scoreCenter(1, 0), L.mark.r)) return "mark-col";
    if (!far(scoreCenter(1, 0), scoreCenter(2, 0), L.mark.r)) return "mark-col2";
    for (let v = 0; v < 9; v++) {
      if (!far(scoreCenter(1, v), scoreCenter(1, v + 1), L.mark.r)) return "mark-row";
    }
    const lastId = idCenter(3, 9);
    if (lastId.x + L.id.r + 1.5 > L.mark.x0 - 6.2) return "id-mark-gap";
    const qLabY = L.q.y0 - L.q.r - 2.45;
    if (lastId.y + L.id.r + 3.5 > qLabY) return "id-into-mc";
    if (L.q.y0 + 19 * L.q.rowPitch + L.q.r > 277.5) return "mc-bottom";
    if (scoreCenter(2, 0).x + L.mark.r > 191) return "mark-fid";
    if (L.mark.x0 - 6.2 + 4.2 > L.mark.x0 - L.mark.r - 0.55) return "mark-lab";
    if (L.head.x + L.head.w + 1.2 > L.hw.x0 - 8.6) return "date-hw-gap";
    return "";
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
    }, { stno: "4101", hwCode: "H01", writtenScore: 73 });
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
      pass: failed.length === 0 && writtenRead.stno === "4101" && writtenRead.hwCode === "H01" && writtenRead.kind === "written" && writtenRead.writtenScore === 73,
      paperCount: omr.length,
      failed: failed.map((r) => ({ note: r.note, expect: r.expect, read: r.read, matchStno: r.matchStno, matchHw: r.matchHw, matchAns: r.matchAns })),
      omr,
      written: { stno: writtenRead.stno, hwCode: writtenRead.hwCode, kind: writtenRead.kind, ok: writtenRead.ok, writtenScore: writtenRead.writtenScore },
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
    if (isPdfFile(file)) {
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
    const img = await decodeImageFile(file);
    return [fitCanvas(drawImageToCanvas(img), 2800)];
  }

  function currentSpec(state, assignment, kind) {
    const me = getSession();
    return {
      kind: kind || "mc",
      schoolName: state.schoolName || "HTMS",
      subject: assignment ? assignment.subject : "ECON-CHI",
      title: assignment ? assignment.title : "",
      n: assignment ? assignment.n : 40,
      prefillStno: getRole() === "student" && me ? me.stno : "",
      writtenPages: kind === "written" ? writtenPageCount() : 1
    };
  }

  function asgOpen(a) {
    return !!(a && a.open !== false);
  }

  function asgPaperOnly(a) {
    return !!(a && a.paperOnly);
  }

  function asgStudentSubmit(a) {
    if (!(asgOpen(a) && !asgPaperOnly(a))) return false;
    if (getRole() === "student") return studentCanAccess(a, getSession());
    return true;
  }

  function studentMcFrozen(a) {
    return getRole() === "student" && !asgStudentSubmit(a);
  }

  function asgBadgeClass(a) {
    if (!asgOpen(a)) return "lock";
    if (asgPaperOnly(a)) return "paper";
    return "open";
  }

  function asgLockLabel(a) {
    if (!asgOpen(a)) return t("已上鎖", "Locked");
    if (asgPaperOnly(a)) return t("只收紙本", "Paper only");
    return t("開放提交", "Open");
  }

  function studentBlockReason(assignment) {
    if (getRole() === "student" && assignment && !studentCanAccess(assignment, getSession())) {
      return t("這份作業不屬於你的年級或科目。", "This assignment is not for your form or subject.");
    }
    if (asgStudentSubmit(assignment)) return "";
    if (!asgOpen(assignment)) return t("這份作業已上鎖，不能再交。", "This assignment is locked. Submissions are closed.");
    return t("這份只收紙本。請列印後交回老師，由老師掃描。", "This assignment is paper-only. Print the sheet, hand it in, and the teacher will scan it.");
  }

  function studentAssignmentList(includeClosed) {
    const me = getSession();
    return (state.assignments || []).filter((a) => {
      if (!includeClosed && !asgOpen(a)) return false;
      return studentCanAccess(a, me);
    });
  }

  function assignmentPool(includeClosed) {
    if (getRole() === "student") return studentAssignmentList(includeClosed);
    return includeClosed ? (state.assignments || []) : openAssignments(state);
  }

  function openAssignments(stateObj) {
    const list = ((stateObj || state).assignments || []).filter(asgOpen);
    if (getRole() === "student") return list.filter((a) => studentCanAccess(a, getSession()));
    return list;
  }

  /* ---------- UI ---------- */

  let state = defaultState();
  let teacherTab = "work";
  let roster = [];
  let lastReview = [];
  let lastAssignmentId = "";
  let syncNote = "";
  let cloudWatchBound = false;

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
    document.title = t("作業角", "Assignment Corner");
    renderApp();
  }

  function status(msg, isErr) {
    const eln = $("mc-status");
    if (!eln) return;
    eln.textContent = msg || "";
    eln.classList.toggle("err", !!isErr);
  }

  function assignmentSelectHtml(id, includeClosed) {
    const list = assignmentPool(includeClosed);
    if (!list.length) return '<option value="">' + t("（未有作業）", "(No assignment)") + "</option>";
    return list.map((a) =>
      '<option value="' + a.id + '"' + (a.id === lastAssignmentId ? " selected" : "") + ">" +
        escapeHtml(a.title || t("未命名", "Untitled")) +
        " · " + asgShortMeta(a) +
        " · " + asgLockLabel(a) +
      "</option>"
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
    const pool = assignmentPool(true);
    const asg = pool.find((a) => a.id === id) || pool[0] || (getRole() === "teacher" ? state.assignments[0] : null) || null;
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
    if (getRole() === "student" && !asgStudentSubmit(assignment)) {
      status(studentBlockReason(assignment), true);
      return;
    }
    const incoming = [...fileList];
    if (!incoming.length) return;
    const files = incoming.filter(isSheetFile);
    if (!files.length) {
      status(t("請上載 PNG、JPG、相片或 PDF。", "Please upload a PNG, JPG, photo, or PDF."), true);
      return;
    }
    if (files.some((f) => f.size > FILE_MAX)) {
      status(t("每檔最多 15MB。請縮小後再上載。", "Each file can be up to 15MB. Please shrink it and upload again."), true);
      return;
    }
    const originals = await saveStudentOriginals(assignment, files, source);
    status(t("正在辨識…", "Reading…"));
    const rows = [];
    for (let f = 0; f < files.length; f++) {
      let canvases;
      try {
        canvases = await fileToCanvases(files[f]);
      } catch (err) {
        rows.push({ ok: false, file: files[f].name, message: t("無法開啟此 PNG／相片／PDF。請另存成 PNG 或 JPG 再試。", "Could not open this PNG / photo / PDF. Save as PNG or JPG and try again.") });
        continue;
      }
      for (let p = 0; p < canvases.length; p++) {
        status(t("正在辨識… ", "Reading… ") + (f + 1) + "/" + files.length + " · p." + (p + 1));
        const forceKind = (getRole() === "teacher" && source === "written") ? "written" : undefined;
        const read = readSheet(canvases[p], { n: assignment.n, forceKind });
        read.file = files[f].name + (canvases.length > 1 ? " p." + (p + 1) : "");
        read.fileBlob = files[f];
        read.assignmentId = assignment.id;
        const stored = originalForFile(originals, files[f]);
        if (stored) {
          read.fileUrl = fileHref(stored);
          read.storedFileId = stored.id;
        }
        if (read.kind === "written" && p > 0) {
          read.writtenOk = false;
          read.writtenScore = null;
        }
        rows.push(read);
      }
    }
    lastReview = rows;
    const writtenRows = rows.filter((r) => r.ok && r.kind === "written");
    const mcRows = rows.filter((r) => r.ok && r.kind !== "written");
    if (writtenRows.length) await commitWritten(writtenRows, assignment, files, originals);
    if (mcRows.length) await commitMc(mcRows, assignment, source === "written" ? "student-upload" : source, originals);
    if (!writtenRows.length && !mcRows.length) {
      if (source === "written") await commitWritten(rows, assignment, files, originals);
      else await commitMc(rows, assignment, source, originals);
    }
    renderApp();
  }

  async function commitMc(rows, assignment, source, originals) {
    if (getRole() === "student" && !asgStudentSubmit(assignment)) {
      status(studentBlockReason(assignment), true);
      return;
    }
    const me = getSession();
    const created = [];
    const messages = [];
    let saved = 0, failed = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri];
      if (!r.ok) {
        failed += 1;
        if (r.message) messages.push(r.message);
        continue;
      }
      if (r.kind === "written") continue;
      r.assignmentId = assignment.id;
      lastAssignmentId = assignment.id;
      let stno = r.stnoOk ? r.stno : "";
      if (getRole() === "student") {
        if (!me) {
          r.ok = false;
          failed += 1;
          messages.push(t("請先登入帳戶。", "Please sign in first."));
          continue;
        }
        if (!stno) {
          stno = me.stno;
          r.stno = stno;
          r.stnoOk = true;
          if (Array.isArray(r.flags)) r.flags.push("stno-account");
        }
        if (stno !== me.stno) {
          r.ok = false;
          failed += 1;
          messages.push(stnoMismatchMsg(stno, me.stno));
          continue;
        }
      } else if (!stno) {
        const typed = prompt(t("未能讀到學號。請輸入 4 位數字（例如 4101）：", "Could not read class no. Enter 4 digits (e.g. 4101):"), String(r.stno || "").replace(/\D/g, "").slice(0, 4));
        if (/^\d{4}$/.test(String(typed || "").trim())) {
          stno = String(typed).trim();
          r.stno = stno;
          r.stnoOk = true;
        } else {
          r.needStno = true;
          failed += 1;
          continue;
        }
      }
      const g = gradeAnswers(r.answers, assignment.key, mcMarkList(assignment));
      const sub = {
        id: uid(),
        assignmentId: assignment.id,
        stno,
        hwCode: r.hwOk ? r.hwCode : "",
        name: (getRole() === "student" && me && me.name) ? me.name : (lookupName(stno) || r.name || ""),
        answers: r.answers,
        score: g.score,
        max: g.max,
        flags: r.flags,
        source: source || "scan",
        fileName: r.file || "",
        at: new Date().toISOString()
      };
      if (source !== "web") {
        attachStoredOriginal(sub, r, originals);
        if (!fileHref(sub) && r.fileBlob) {
          await persistSubmissionFile(sub, r.fileBlob);
          upsertFileMeta(state, {
            id: sub.id,
            assignmentId: assignment.id,
            stno,
            fileName: sub.fileName,
            fileUrl: fileHref(sub),
            url: fileHref(sub),
            source: sub.source,
            kind: "mc",
            at: sub.at
          });
        }
      }
      upsertMc(state, sub);
      created.push(sub);
      saved += 1;
    }
    if (!created.length) {
      if (getRole() === "student" && originals && originals.length) {
        status(studentOriginalStatus(messages, originals), true);
        return;
      }
      status(messages.join(" ") || t("沒有可提交的答卷。", "Nothing to submit."), true);
      return;
    }
    saveState(state);
    const remote = await pushRemote("submitMcBatch", {
      assignmentId: assignment.id,
      submissions: getRole() === "student" ? created : state.mcSubmissions.filter((s) => s.assignmentId === assignment.id)
    });
    if (remote && remote.error === "stno-mismatch") {
      status(stnoMismatchMsg(remote.got, remote.expected), true);
      return;
    }
    if (remote && (remote.error === "locked" || remote.error === "paper-only")) {
      if (getRole() === "student" && assignment) {
        if (remote.error === "locked") assignment.open = false;
        if (remote.error === "paper-only") assignment.paperOnly = true;
        created.forEach((sub) => {
          state.mcSubmissions = (state.mcSubmissions || []).filter((s) => s.id !== sub.id);
        });
        saveState(state);
      }
      status(studentBlockReason(assignment), true);
      return;
    }
    syncNote = remote && remote.ok ? t("已同步到雲端。", "Synced.") : t("本機已儲存（雲端未接上時，成績留在這部電腦）。", "Saved on this device. Cloud sync is off until Blob storage is connected.");
    if (getRole() === "student") {
      const first = created[0];
      const origWarn = originals && originals.some((o) => o && o.rec && !fileHref(o.rec))
        ? t(" 答卷已入帳，但原件未能同步到雲端。請再上載一次（每檔最多 15MB），方便老師查看。", " Answers were filed, but the original did not sync. Upload again (up to 15MB) so the teacher can open it.")
        : "";
      status(
        (messages.length ? messages.join(" ") + " " : "") +
        t("已交卷。學號 ", "Submitted. Class no. ") + (first ? first.stno : "") +
        (first && first.hwCode ? " · " + first.hwCode : "") +
        t("。再交會另存一筆；老師看得到歷次，成績只計最後一次。", ". Submit again to save another attempt. The teacher sees all tries; only the last counts.") +
        origWarn,
        !!messages.length || !!origWarn
      );
    } else {
      status(t("完成：讀到 ", "Done: read ") + saved + t(" 份。", " script(s).") + (failed ? t(" 未能入帳 ", " Not filed ") + failed + t(" 頁。", " page(s).") : ""), failed && !saved);
    }
  }

  async function commitWritten(rows, assignment, files, originals) {
    if (getRole() === "student" && !asgStudentSubmit(assignment)) {
      status(studentBlockReason(assignment), true);
      return;
    }
    const me = getSession();
    const created = [];
    const messages = [];
    let saved = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.ok) {
        if (r.message) messages.push(r.message);
        continue;
      }
      if (r.kind === "mc" && getRole() === "teacher") continue;
      if (getRole() === "student") {
        if (!me) {
          messages.push(t("請先登入帳戶。", "Please sign in first."));
          continue;
        }
        if (r.stnoOk && r.stno !== me.stno) {
          messages.push(stnoMismatchMsg(r.stno, me.stno));
          continue;
        }
        if (!r.stnoOk) {
          r.stno = me.stno;
          r.stnoOk = true;
          if (Array.isArray(r.flags)) r.flags.push("stno-account");
        }
      } else if (!r.stnoOk) {
        continue;
      }
      const sub = {
        id: uid(),
        assignmentId: assignment.id,
        stno: r.stno,
        hwCode: r.hwOk ? r.hwCode : "",
        name: (getRole() === "student" && me && me.name) ? me.name : (lookupName(r.stno) || ""),
        fileName: r.file || "",
        kind: "pdf",
        source: getRole() === "student" ? "student-upload" : "teacher-scan",
        writtenScore: getRole() === "teacher" && r.writtenOk ? r.writtenScore : null,
        writtenItems: Array.isArray(r.writtenItems) ? r.writtenItems : [],
        at: new Date().toISOString()
      };
      const blob = r.fileBlob || (files && files[Math.min(i, files.length - 1)]);
      attachStoredOriginal(sub, r, originals);
      if (blob) {
        try { await idbPut("pdf:" + sub.id, blob); } catch {}
        if (!fileHref(sub)) {
          await persistSubmissionFile(sub, blob);
          upsertFileMeta(state, {
            id: sub.id,
            assignmentId: assignment.id,
            stno: sub.stno,
            fileName: sub.fileName,
            fileUrl: fileHref(sub),
            url: fileHref(sub),
            source: sub.source,
            kind: "written",
            at: sub.at
          });
        }
      }
      upsertPdf(state, sub);
      created.push(sub);
      if (getRole() === "teacher" && r.writtenOk && r.writtenScore != null) {
        upsertWritten(state, {
          id: uid(),
          assignmentId: assignment.id,
          stno: r.stno,
          score: r.writtenScore,
          max: writtenMaxOf(assignment),
          items: Array.isArray(r.writtenItems) ? r.writtenItems : [],
          source: "scan",
          at: new Date().toISOString()
        });
      }
      saved += 1;
    }
    if (!created.length) {
      if (getRole() === "student" && originals && originals.length) {
        status(studentOriginalStatus(messages, originals), true);
        return;
      }
      status(messages.join(" ") || t("沒有可提交的答卷。", "Nothing to submit."), true);
      return;
    }
    saveState(state);
    const remote = await pushRemote("submitPdfBatch", { assignmentId: assignment.id, submissions: getRole() === "student" ? created : state.pdfSubmissions.filter((s) => s.assignmentId === assignment.id) });
    if (remote && remote.error === "stno-mismatch") {
      status(stnoMismatchMsg(remote.got, remote.expected), true);
      return;
    }
    if (getRole() === "teacher") {
      await pushRemote("saveWrittenScores", { assignmentId: assignment.id, scores: (state.writtenScores || []).filter((s) => s.assignmentId === assignment.id) });
    }
    const scored = rows.filter((r) => r.ok && r.writtenOk).length;
    const origWarn = getRole() === "student" && originals && originals.some((o) => o && o.rec && !fileHref(o.rec))
      ? t(" 作答紙已入帳，但原件未能同步到雲端。請再上載一次（每檔最多 15MB），方便老師查看。", " The written script was filed, but the original did not sync. Upload again (up to 15MB) so the teacher can open it.")
      : "";
    status(
      (messages.length ? messages.join(" ") + " " : "") +
      t("已收作答紙 ", "Collected written scripts: ") + saved + t(" 份。", ".") +
      (getRole() === "teacher"
        ? (scored ? t(" 讀到長題分 ", " Read written marks for ") + scored + t(" 份。", ".") : t(" 未讀到分數圓圈者可在成績頁手輸入。", " Scripts without score bubbles can be typed on Results."))
        : t(" 長題由老師批改後入分。", " The teacher will mark the written work.")) +
      origWarn,
      !!messages.length || !!origWarn
    );
  }

  function analysisOf(assignment) {
    const rows = latestByStudent(state.mcSubmissions, assignment.id, true);
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

  function sharePct(n, total) {
    if (!total) return "0%";
    return (Math.round(1000 * n / total) / 10) + "%";
  }

  function optionShareHtml(st) {
    const total = st.total || 0;
    const bits = ["A", "B", "C", "D"].map((opt) => {
      const n = st.counts[opt] || 0;
      return '<span class="opt-share' + (st.key === opt ? " key" : "") + '">' + opt + " " + sharePct(n, total) + "</span>";
    });
    bits.push('<span class="opt-share">' + t("空", "blank") + " " + sharePct(st.counts.blank || 0, total) + "</span>");
    if (st.counts.star) bits.push('<span class="opt-share">* ' + sharePct(st.counts.star, total) + "</span>");
    return '<div class="opt-shares">' + bits.join("") + "</div>";
  }

  function scoreRoster(asg) {
    const marks = mcMarkList(asg);
    const mcMap = new Map();
    latestByStudent(state.mcSubmissions, asg.id, true).forEach((s) => mcMap.set(s.stno, s));
    const wrMap = new Map();
    if (asgHasWritten(asg)) latestWritten(asg.id).forEach((s) => wrMap.set(s.stno, s));
    const pdfMap = new Map();
    latestByStudent(state.pdfSubmissions.filter((s) => s.assignmentId === asg.id), asg.id, false).forEach((s) => pdfMap.set(s.stno, s));
    const fileStnos = [];
    (state.files || []).forEach((f) => {
      if (f && f.assignmentId === asg.id && f.stno) fileStnos.push(String(f.stno));
    });
    const ids = new Set([...mcMap.keys(), ...wrMap.keys(), ...pdfMap.keys(), ...fileStnos]);
    return [...ids].sort().map((stno) => {
      const mc = mcMap.get(stno);
      const wr = wrMap.get(stno);
      const pdf = pdfMap.get(stno);
      const firstFile = (state.files || []).find((f) => f && f.assignmentId === asg.id && String(f.stno) === String(stno));
      const g = mc ? gradeAnswers(mc.answers, asg.key, marks) : { score: null, max: 0 };
      const tries = historyByStudent(state.mcSubmissions, asg.id, stno, true);
      const wMax = writtenMaxOf(asg);
      const wScore = wr && wr.score != null && wr.score !== "" ? Number(wr.score) : null;
      const mcScore = g.score;
      const mcMax = g.max || 0;
      const hasW = asgHasWritten(asg);
      const total = (mcScore || 0) + (hasW && wScore != null ? wScore : 0);
      const totalMax = mcMax + (hasW ? wMax : 0);
      return {
        stno,
        name: (mc && mc.name) || (pdf && pdf.name) || lookupName(stno) || "",
        hwCode: (mc && mc.hwCode) || (pdf && pdf.hwCode) || "",
        source: (mc && mc.source) || (pdf && pdf.source) || (wr && wr.source) || (firstFile && firstFile.source) || "",
        answers: mc ? mc.answers : [],
        id: mc && mc.id,
        tries,
        mcScore,
        mcMax,
        wScore,
        wMax,
        total,
        totalMax,
        complete: !hasW || wScore != null
      };
    });
  }

  async function saveManualWritten(asg, stno, raw) {
    if (!asg || !stno) return;
    const max = writtenMaxOf(asg);
    if (raw === "" || raw == null) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    upsertWritten(state, {
      id: uid(),
      assignmentId: asg.id,
      stno,
      score: Math.max(0, Math.min(max, n)),
      max,
      source: "manual",
      at: new Date().toISOString()
    });
    saveState(state);
    await pushRemote("saveWrittenScores", { assignmentId: asg.id, scores: (state.writtenScores || []).filter((s) => s.assignmentId === asg.id) });
  }

  function studentAnswerGrid(answers, key, showKey) {
    const list = Array.isArray(answers) ? answers : [];
    const g = gradeAnswers(list, key);
    const n = Math.max(list.length, (key && key.length) || 0);
    let html = '<div class="qgrid">';
    for (let i = 0; i < n; i++) {
      const a = list[i] || "";
      const k = key && key[i] ? key[i] : "";
      const mark = g.marks[i];
      const cls = a && mark === true ? " ok" : a && mark === false ? " bad" : "";
      html += '<span class="qchip' + cls + '"><i>' + (i + 1) + "</i>" + escapeHtml(a || "–") +
        (showKey && k ? "<em>" + escapeHtml(k) + "</em>" : "") + "</span>";
    }
    return html + "</div>";
  }

  function exportCsv(assignment) {
    const pack = scoreRoster(assignment);
    const n = assignment.n;
    const head = ["stno", "class", "hwCode", "name", "mc", "mcMax", "written", "writtenMax", "total", "totalMax", "attempts"].concat(Array.from({ length: n }, (_, i) => "Q" + (i + 1)));
    const lines = [head.join(",")];
    pack.forEach((s) => {
      const p = parseStno(s.stno);
      const cells = [s.stno, (p && p.label) || "", s.hwCode || "", csvCell(s.name), s.mcScore, s.mcMax, s.wScore, s.wMax, s.total, s.totalMax, s.tries.length];
      for (let i = 0; i < n; i++) cells.push((s.answers && s.answers[i]) || "");
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

  let studentView = "home";

  function renderGate() {
    const already = $("gate") && !$("gate").hidden;
    $("app-student").hidden = true;
    $("app-teacher").hidden = true;
    $("gate").hidden = false;
    $("who").textContent = "";
    if ($("btn-logout")) $("btn-logout").hidden = true;
    if ($("btn-profile")) $("btn-profile").hidden = true;
    if (!already) {
      showGatePane("student");
      showStuForm("login");
    }
  }

  function showGatePane(which) {
    if ($("gate-stu")) $("gate-stu").hidden = which !== "student";
    if ($("gate-tch")) $("gate-tch").hidden = which !== "teacher";
    if ($("gate-tab-stu")) $("gate-tab-stu").classList.toggle("active", which === "student");
    if ($("gate-tab-tch")) $("gate-tab-tch").classList.toggle("active", which === "teacher");
  }

  function showStuForm(which) {
    if ($("stu-login")) $("stu-login").hidden = which !== "login";
    if ($("stu-register")) $("stu-register").hidden = which !== "register";
    gateError("");
  }

  function gateError(msg) {
    const box = $("gate-err");
    if (!box) return;
    box.hidden = !msg;
    box.textContent = msg || "";
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
    if ($("btn-logout")) $("btn-logout").hidden = false;
    const me = getSession();
    if ($("btn-profile")) $("btn-profile").hidden = !(role === "student" || role === "teacher");
    $("who").textContent = role === "teacher"
      ? t("老師 · ", "Teacher · ") + ((me && (me.name || me.account)) ? (me.name || me.account) : TEACHER_USER)
      : (me ? t("學號 ", "No. ") + stnoLabel(me.stno) : t("交功課", "Submit homework"));
    if (role === "student") {
      if (studentView === "profile") renderProfile();
      else renderStudent();
    } else renderTeacher();
  }

  function renderStudent() {
    const box = $("app-student");
    const asgList = openAssignments(state);
    const me = getSession();
    box.innerHTML =
      '<p class="lead">' + t("交卷會記入你的帳戶。網頁作答的學號已鎖定；紙本上學號必須與此帳戶相同。",
        "Submissions are saved to your account. The web form class no. is locked; a paper scan must match this account.") +
      (me ? " " + t("你的學號是 ", "Your class no. is ") + stnoLabel(me.stno) +
        (formOfStno(me.stno) ? " · " + formLabel(formOfStno(me.stno)) : "") +
        (normalizeSubjects(me.subjects).length ? " · " + subjectsLabel(me.subjects) : "") + "。" : "") + "</p>" +
      '<div class="row-split">' +
        '<label>' + t("作業", "Assignment") + '<select id="s-asg">' + assignmentSelectHtml("s-asg", true) + "</select></label>" +
        '<button type="button" class="btn" id="s-refresh">' + t("重新整理作業", "Refresh assignments") + "</button>" +
      "</div>" +
      '<div id="s-review"></div>' +
      (studentAssignmentList(true).length ? "" : '<p class="warn">' + (
        (state.assignments || []).length
          ? t("目前沒有你年級或科目的作業。", "There is no assignment for your form or subject yet.")
          : (cloudOk
            ? t("老師尚未開放作業。你仍可下載空白紙；網頁交卷須等老師開放。", "No assignment is open yet. You can still download a blank sheet. Web submit waits until one is open.")
            : t("未能讀到雲端作業。請按「重新整理作業」。若仍沒有，即老師那份只存在他的電腦。", "Could not load cloud assignments. Tap Refresh assignments. If it is still empty, the teacher’s copy is only on their device."))
      ) + "</p>") +
      '<div class="web-card" id="s-web"></div>' +
      '<div class="paper-sec">' +
        "<h2>" + t("紙本交卷", "Paper submission") + "</h2>" +
        '<p class="hint">' + t("列印時請用 A4、實際大小。紙上已預填你的學號圓圈，請勿改塗其他學號。紙本功課／UT 圓圈：H03、U12。網頁交卷的類型由老師設定。作答紙範本最多 6 頁，可先選頁數再列印或下載。", "Print A4 at actual size. Your class-no. bubbles are pre-filled; do not mark a different number. Paper HW/UT bubbles: H03, U12. The web form type is set by the teacher. The written template has up to 6 pages; choose how many to print or download.") + "</p>" +
        '<div class="actions">' +
          '<button type="button" class="btn" id="s-print-mc">' + t("列印 MC 答題紙", "Print MC sheet") + "</button>" +
          '<button type="button" class="btn" id="s-dl-mc">' + t("下載 MC PDF", "Download MC PDF") + "</button>" +
          '<span id="s-wr-pages-wrap">' + writtenPagesSelectHtml("s-wr-pages") + "</span>" +
          '<button type="button" class="btn" id="s-print-wr">' + t("列印 PDF 作答紙", "Print written sheet") + "</button>" +
          '<button type="button" class="btn" id="s-dl-wr">' + t("下載作答紙 PDF", "Download written PDF") + "</button>" +
        "</div>" +
        '<div class="drop" id="s-drop-mc"><strong>' + t("上載已填的 MC 紙", "Upload a filled MC sheet") + "</strong><p>" + t("可上載 PNG、JPG、相片或 PDF（可多張，每檔最多 15MB）。系統會掃描入分，原件交給老師。", "Upload PNG, JPG, a photo, or PDF (several files OK, 15MB each). The system scans and scores it; the original goes to the teacher.") + '</p><input id="s-file-mc" type="file" accept="' + SHEET_ACCEPT + '" multiple></div>' +
        '<div class="drop" id="s-drop-pdf"><strong>' + t("上載已填的作答紙", "Upload a filled written sheet") + "</strong><p>" + t("可上載 PNG、JPG、相片或 PDF（可多張／多頁，每檔最多 15MB）。系統會掃描並交給老師；長題分由老師批改後入分。分數圓圈留給老師。", "Upload PNG, JPG, a photo, or PDF (several pages OK, 15MB each). The system scans it for the teacher; written marks are entered after the teacher grades. Leave the score bubbles for the teacher.") + '</p><input id="s-file-pdf" type="file" accept="' + SHEET_ACCEPT + '" multiple></div>' +
      "</div>";
    bindStudent();
    paintWebForm();
    paintStudentReview(selectedAssignment("s-asg"));
    paintMcTools(selectedAssignment("s-asg"));
    paintWrittenTools(selectedAssignment("s-asg"));
  }

  function paintStudentReview(assignment) {
    const host = $("s-review");
    if (!host) return;
    if (!assignment) {
      host.innerHTML = "";
      return;
    }
    const bits = [];
    const typeLab = asgTypeLabel(assignment);
    if (typeLab) bits.push('<p class="hint">' + t("類型：", "Type: ") + escapeHtml(typeLab) + "</p>");
    if (asgHasMc(assignment) && assignment.mcSource) {
      bits.push('<p class="hint">' + t("MC 來源：", "MC source: ") + escapeHtml(assignment.mcSource) + "</p>");
    }
    if (asgHasWritten(assignment) && assignment.writtenSource) {
      bits.push('<p class="hint">' + t("長題來源：", "Written source: ") + escapeHtml(assignment.writtenSource) +
        (assignment.writtenN ? " · " + assignment.writtenN + t("題", "Q") : "") +
        " · " + t("滿分 ", "Full marks ") + writtenMaxOf(assignment) + "</p>");
    }
    if (asgAnswersPublished(assignment)) {
      const mine = latestByStudent(state.mcSubmissions, assignment.id, true).find((s) => s.stno === accountStno());
      bits.push("<h2>" + t("已發佈答案", "Published answers") + "</h2>");
      bits.push('<p class="hint">' + t("綠＝你選對，紅＝你選錯。細字是正確選項。", "Green = your choice is right, red = wrong. The small letter is the key.") + "</p>");
      if (mine) {
        const g = gradeAnswers(mine.answers, assignment.key, mcMarkList(assignment));
        bits.push('<p><b>' + (g.score != null ? fmtMark(g.score) + "/" + fmtMark(g.max) : "—") + "</b></p>");
        bits.push(studentAnswerGrid(mine.answers, assignment.key, true));
      } else {
        bits.push('<p class="hint">' + t("尚未找到你的交卷，仍可看正確答案。", "No script of yours yet; the key is still shown.") + "</p>");
        bits.push(studentAnswerGrid([], assignment.key, true));
      }
    }
    const mineUploads = assignmentFileRecords(assignment.id, accountStno()).filter((f) => f.source === "student-upload");
    if (mineUploads.length) {
      bits.push("<h2>" + t("你已上載的原件", "Your uploaded originals") + "</h2>");
      bits.push(fileListHtml(mineUploads, { hideStno: true }));
    }
    if (asgScriptsReturned(assignment)) {
      const files = assignmentFileRecords(assignment.id, accountStno()).filter((f) => f.source === "teacher-scan");
      bits.push("<h2>" + t("已發還功課／試卷", "Returned scripts") + "</h2>");
      bits.push(fileListHtml(files, { hideStno: true }));
    }
    host.innerHTML = bits.join("");
    bindFileList(host, assignmentFileRecords(assignment.id, accountStno()));
  }

  function paintWrittenTools(assignment) {
    const show = asgHasWritten(assignment);
    ["s-print-wr", "s-dl-wr", "s-drop-pdf", "s-wr-pages-wrap", "t-print-wr", "t-dl-wr", "t-wr-pages"].forEach((id) => {
      if ($(id)) $(id).hidden = !show;
    });
  }

  function paintMcTools(assignment) {
    const show = asgHasMc(assignment);
    ["s-print-mc", "s-dl-mc", "s-drop-mc", "t-print-mc", "t-dl-mc", "t-drop"].forEach((id) => {
      if ($(id)) $(id).hidden = !show;
    });
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

  function webBub(prefix, values, selected, frozen) {
    return values.map((v) =>
      '<button type="button" class="web-bub' + (String(selected) === String(v) ? " on" : "") + '" data-web="' + prefix + '" data-v="' + escapeHtml(String(v)) + '"' + (frozen ? " disabled" : "") + ">" + escapeHtml(String(v)) + "</button>"
    ).join("");
  }

  function webCol(cap, prefix, values, selected) {
    return '<div class="web-col"><span class="cap">' + cap + "</span><div class=\"web-bubs\">" + webBub(prefix, values, selected) + "</div></div>";
  }

  function webSelected(prefix) {
    const on = document.querySelector('#s-web .web-bub.on[data-web="' + prefix + '"]');
    return on ? on.getAttribute("data-v") : "";
  }

  function readWebForm(n, assignment) {
    const me = getSession();
    const stno = accountStno() || [0, 1, 2, 3].map((d) => webSelected("id" + d)).join("");
    const hw = assignment ? assignmentHwCode(assignment) : "";
    const answers = [];
    for (let i = 0; i < n; i++) answers.push(webSelected("q" + i) || "");
    return {
      name: ($("s-web-name") && $("s-web-name").value.trim()) || (me && me.name) || "",
      stno,
      hw,
      answers
    };
  }

  function persistWebForm(assignment) {
    if (!assignment || studentMcFrozen(assignment)) return;
    const cur = readWebForm(assignment.n, assignment);
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
    const cur = readWebForm(assignment.n, assignment);
    const p = parseStno(cur.stno);
    const bits = [];
    bits.push(p ? t("學號 ", "No. ") + cur.stno + "（" + p.label + "）" : t("尚未填齊四位學號", "Class no. incomplete"));
    const typeLab = asgTypeLabel(assignment);
    if (typeLab) bits.push(typeLab);
    if (asgHasMc(assignment)) bits.push(t("已答 ", "Answered ") + cur.answers.filter(Boolean).length + "/" + assignment.n);
    eln.textContent = bits.join("  ·  ");
  }

  function paintWebForm() {
    const host = $("s-web");
    if (!host) return;
    const assignment = selectedAssignment("s-asg");
    if (!assignment) {
      host.innerHTML = "<p class='hint'>" + t("選一份作業後，即可在此用按鈕作答。", "Choose an assignment to answer with buttons here.") + "</p>";
      return;
    }
    const locked = !asgOpen(assignment);
    const paperOnly = asgPaperOnly(assignment);
    const blocked = !asgStudentSubmit(assignment);
    if (getRole() === "student" && !studentCanAccess(assignment, getSession())) {
      host.innerHTML =
        "<h2>" + t("網頁作答（按鈕）", "Web answer sheet (buttons)") + "</h2>" +
        '<p class="warn">' + studentBlockReason(assignment) + "</p>";
      ["s-drop-mc", "s-drop-pdf"].forEach((id) => {
        if ($(id)) $(id).classList.add("off");
      });
      paintMcTools(assignment);
      paintWrittenTools(assignment);
      return;
    }
    if (paperOnly && asgOpen(assignment)) {
      const printHint = asgHasMc(assignment)
        ? t("請用下面「列印 MC 答題紙」。填好後親自交給老師。網上交卷已關，同學不能代你交。", "Use Print MC sheet below. Fill it in and hand it to the teacher yourself. Online submit is off, so a classmate cannot submit for you.")
        : t("請用下面「列印 PDF 作答紙」。填好後親自交給老師。網上交卷已關，同學不能代你交。", "Use Print written sheet below. Fill it in and hand it to the teacher yourself. Online submit is off, so a classmate cannot submit for you.");
      host.innerHTML =
        "<h2>" + t("網頁作答（按鈕）", "Web answer sheet (buttons)") + "</h2>" +
        '<p class="warn">' + studentBlockReason(assignment) + "</p>" +
        '<p class="hint">' + escapeHtml(assignment.title || "") + " · " + asgShortMeta(assignment) + " · " + asgLockLabel(assignment) + "</p>" +
        '<p class="hint">' + printHint + "</p>";
      ["s-drop-mc", "s-drop-pdf"].forEach((id) => {
        if ($(id)) $(id).classList.add("off");
      });
      paintMcTools(assignment);
      paintWrittenTools(assignment);
      return;
    }
    if (!asgHasMc(assignment)) {
      host.innerHTML =
        "<h2>" + t("網頁作答（按鈕）", "Web answer sheet (buttons)") + "</h2>" +
        (locked ? '<p class="warn">' + t("老師已上鎖，這份不能交卷。仍可列印空白紙。", "The teacher locked this assignment. You cannot submit. You may still print a blank sheet.") + "</p>" : "") +
        '<p class="hint">' + escapeHtml(assignment.title || "") + " · " + asgShortMeta(assignment) + " · " + asgLockLabel(assignment) + "</p>" +
        '<div class="web-meta">' +
          (asgWorkType(assignment)
            ? '<div class="web-block">' +
                "<h3>" + t("作業類型", "Assignment type") + "</h3>" +
                '<p class="acct-locked">' + escapeHtml(asgTypeLabel(assignment)) + "</p>" +
                '<p class="hint">' + t("老師開作業時已選定功課／堂課／統測。", "The teacher already set homework / classwork / uniform test.") + "</p>" +
              "</div>"
            : "") +
          '<div class="web-block">' +
            "<h3>" + t("班別 / 學號", "Class no.") + "</h3>" +
            '<p class="acct-locked">' + escapeHtml(stnoLabel(accountStno())) + "</p>" +
          "</div>" +
        "</div>" +
        '<p class="hint">' + t("此份沒有選擇題。請用下面列印或上載作答紙。", "This assignment has no multiple choice. Print or upload the written sheet below.") + "</p>";
      ["s-drop-mc", "s-drop-pdf"].forEach((id) => {
        if ($(id)) $(id).classList.toggle("off", blocked);
      });
      paintMcTools(assignment);
      paintWrittenTools(assignment);
      return;
    }
    let draft = loadWebDraft();
    if (draft.assignmentId && draft.assignmentId !== assignment.id) {
      draft = { name: draft.name || "", stno: draft.stno || "", hw: assignmentHwCode(assignment), answers: [] };
    }
    const me = getSession();
    const stno = accountStno() || String(draft.stno || "    ");
    const namePrefill = (me && me.name) || draft.name || "";
    const frozen = locked || blocked || studentMcFrozen(assignment);
    const mine = latestByStudent(state.mcSubmissions, assignment.id, true).find((s) => s.stno === accountStno());
    let ans = Array.isArray(draft.answers) ? draft.answers.slice() : [];
    if (frozen && mine && Array.isArray(mine.answers)) {
      ans = mine.answers.slice();
      saveWebDraft({
        assignmentId: assignment.id,
        name: namePrefill,
        stno,
        hw: assignmentHwCode(assignment),
        answers: ans
      });
    }
    const n = assignment.n;
    const cols = Math.min(3, Math.max(1, n));
    const qRows = Math.ceil(n / cols);
    let qHtml = "";
    for (let i = 0; i < n; i++) {
      qHtml += '<div class="web-q"><span class="qn">' + (i + 1) + "</span><div class=\"web-bubs\">" + webBub("q" + i, OPTS, ans[i] || "", frozen) + "</div></div>";
    }
    host.innerHTML =
      "<h2>" + t("網頁作答（按鈕）", "Web answer sheet (buttons)") + "</h2>" +
      (locked ? '<p class="warn">' + t("老師已上鎖，選擇題不能再改，也不能交卷。仍可列印空白紙。", "The teacher locked this assignment. MC answers cannot be changed and you cannot submit. You may still print a blank sheet.") + "</p>" : "") +
      (frozen
        ? '<p class="hint">' + t("圓圈已凍結，只供查看。", "The circles are frozen and are for viewing only.") + "</p>"
        : '<p class="hint">' + t("點圓圈作答，再按「交卷」。不必列印。再交會另存一筆，成績只計最後一次。", "Tap the circles, then Submit. No printing needed. Another submit saves a new attempt; only the last counts.") + "</p>") +
      '<p class="hint">' + escapeHtml(assignment.title || "") + " · " + asgShortMeta(assignment) + " · " + asgLockLabel(assignment) + "</p>" +
      '<label>' + t("姓名（可選）", "Name (optional)") + '<input id="s-web-name" type="text" maxlength="80" value="' + escapeHtml(namePrefill) + '"' + (frozen ? " disabled" : "") + "></label>" +
      '<div class="web-meta">' +
        (asgWorkType(assignment)
          ? '<div class="web-block">' +
              "<h3>" + t("作業類型", "Assignment type") + "</h3>" +
              '<p class="acct-locked">' + escapeHtml(asgTypeLabel(assignment)) + "</p>" +
              '<p class="hint">' + t("老師開作業時已選定功課／堂課／統測，不用再選。", "The teacher already set homework / classwork / uniform test. You do not choose it here.") + "</p>" +
            "</div>"
          : "") +
        '<div class="web-block">' +
          "<h3>" + t("班別 / 學號", "Class no.") + "</h3>" +
          '<p class="acct-locked">' + escapeHtml(stnoLabel(stno)) + "</p>" +
          '<p class="hint">' + t("已鎖定為此帳戶的學號，不能更改。紙本上的學號必須相同。", "Locked to this account. A paper scan must use the same class no.") + "</p>" +
        "</div>" +
      "</div>" +
      '<p class="web-sum" id="s-web-sum"></p>' +
      "<h3>" + t("選擇題", "MC items") + "</h3>" +
      '<div class="web-qs' + (frozen ? " is-locked" : "") + '" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr));grid-template-rows:repeat(' + qRows + ',auto)">' + qHtml + "</div>" +
      '<div class="actions">' +
        '<button type="button" class="btn primary" id="s-web-submit"' + (blocked || frozen ? " disabled" : "") + ">" + t("交卷", "Submit") + "</button>" +
        '<button type="button" class="btn" id="s-web-clear"' + (locked || frozen ? " disabled" : "") + ">" + t("清空答案", "Clear answers") + "</button>" +
      "</div>";
    paintWebSummary(assignment);
    ["s-drop-mc", "s-drop-pdf"].forEach((id) => {
      if ($(id)) $(id).classList.toggle("off", blocked);
    });
    host.onclick = (e) => {
      const b = e.target.closest(".web-bub");
      if (!b || !host.contains(b)) return;
      if (frozen || studentMcFrozen(assignment) || b.disabled) {
        status(studentBlockReason(assignment) || t("老師已上鎖，選擇題不能再改。", "This assignment is locked. MC answers cannot be changed."), true);
        return;
      }
      const prefix = b.getAttribute("data-web");
      const wasOn = b.classList.contains("on");
      host.querySelectorAll('.web-bub[data-web="' + prefix + '"]').forEach((x) => x.classList.remove("on"));
      if (!wasOn) b.classList.add("on");
      persistWebForm(assignment);
      paintWebSummary(assignment);
    };
    if ($("s-web-name") && !frozen) {
      $("s-web-name").oninput = () => persistWebForm(assignment);
    }
    paintMcTools(assignment);
    paintWrittenTools(assignment);
    if ($("s-web-submit")) $("s-web-submit").onclick = () => submitWebForm(assignment);
    if ($("s-web-clear")) $("s-web-clear").onclick = () => {
      if (frozen || locked || !asgOpen(assignment) || studentMcFrozen(assignment)) {
        status(t("老師已上鎖，不能清空答案。", "This assignment is locked. You cannot clear answers."), true);
        return;
      }
      if (!confirm(t("清空本題答案？學號已鎖定。", "Clear MC answers? Class no. stays locked."))) return;
      const d = loadWebDraft();
      d.answers = [];
      d.assignmentId = assignment.id;
      d.hw = assignmentHwCode(assignment);
      saveWebDraft(d);
      paintWebForm();
    };
  }

  async function submitWebForm(assignment) {
    if (!assignment || !asgStudentSubmit(assignment)) {
      status(studentBlockReason(assignment), true);
      return;
    }
    persistWebForm(assignment);
    const cur = readWebForm(assignment.n, assignment);
    const me = getSession();
    if (!me || me.stno !== cur.stno || !/^\d{4}$/.test(cur.stno)) {
      status(t("請用自己的帳戶交卷。學號已鎖定為帳戶學號。", "Submit with your own account. Class no. is locked to the account."), true);
      return;
    }
    const hwCode = assignmentHwCode(assignment);
    const hwParsed = parseHwCode(hwCode);
    const filled = cur.answers.filter(Boolean).length;
    const p = parseStno(cur.stno);
    const typeLab = asgTypeLabel(assignment);
    const msg = t("確定交卷？", "Submit now?") +
      "\n" + t("學號 ", "Class no. ") + cur.stno + (p ? "（" + p.label + "）" : "") +
      (typeLab ? "\n" + typeLab : "") +
      "\n" + t("已答 ", "Answered ") + filled + "/" + assignment.n +
      (filled < assignment.n ? t("（尚有空白）", " (some blank)") : "");
    if (!confirm(msg)) return;
    const row = {
      ok: true,
      kind: "mc",
      stno: cur.stno,
      stnoOk: true,
      stnoLabel: p ? p.label : "",
      hwCode: hwParsed ? hwParsed.code : hwCode,
      hwOk: true,
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
    if ($("s-wr-pages")) $("s-wr-pages").onchange = () => writtenPageCount();
    $("s-file-mc").onchange = (e) => processMcFiles(e.target.files, "student-upload");
    $("s-file-pdf").onchange = (e) => processMcFiles(e.target.files, "written");
    if ($("s-asg")) {
      $("s-asg").onchange = () => {
        lastAssignmentId = $("s-asg").value;
        paintWebForm();
        paintStudentReview(selectedAssignment("s-asg"));
        paintMcTools(selectedAssignment("s-asg"));
        paintWrittenTools(selectedAssignment("s-asg"));
      };
    }
    if ($("s-refresh")) $("s-refresh").onclick = () => refreshCloud();
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
      ["students", t("學生", "Students")],
      ["print", t("列印", "Print")],
      ["scan", t("上載批改", "Scan & mark")],
      ["scores", t("成績", "Results")],
      ["profile", t("個人", "Profile")]
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
    else if (teacherTab === "students") renderStudents($("t-panel"));
    else if (teacherTab === "print") renderPrint($("t-panel"));
    else if (teacherTab === "scan") renderScan($("t-panel"));
    else if (teacherTab === "profile") renderTeacherProfile($("t-panel"));
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
      '<div class="asg-roster" id="t-asg-roster"></div>' +
      '<div class="card" id="t-asg-form"></div>' +
      '<p class="hint">' + t("學生看到的是雲端作業。新增或儲存後須顯示「已同步到雲端」，學生再按「重新整理作業」。紙本掃描批改只需這部電腦。", "Students see the cloud list. After New / Save you should see “Synced”. Students then tap Refresh assignments. Paper scans stay on this computer.") + "</p>" +
      '<p class="hint">' + (syncNote || "") + "</p>";
    $("t-school").onchange = () => {
      state.schoolName = $("t-school").value.trim() || "HTMS";
      saveState(state);
      pushRemote("saveMeta", { schoolName: state.schoolName });
    };
    $("t-new").onclick = async () => {
      const n = {
        id: uid(),
        title: t("新作業", "New assignment"),
        subject: "ECON-CHI",
        form: "4",
        n: 40,
        key: Array(40).fill(""),
        open: true,
        paperOnly: false,
        hasMc: true,
        hasWritten: false,
        workType: "",
        workNo: null,
        writtenMax: 100,
        writtenN: 1,
        writtenEach: 0,
        writtenSource: "",
        mcSource: "",
        mcMarkEach: 1,
        mcMarks: [],
        answersPublished: false,
        scriptsReturned: false,
        createdBy: teacherAccount() || TEACHER_USER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.assignments.unshift(n);
      lastAssignmentId = n.id;
      saveState(state);
      status(t("正在同步作業…", "Saving assignment…"));
      const remote = await pushRemote("upsertAssignment", { assignment: n });
      applySyncResult(remote);
      renderWork(panel);
    };
    bindAsgSelect(() => { fillAsgForm(); paintRoster(); });
    fillAsgForm();
    function paintRoster() {
      const box = $("t-asg-roster");
      if (!box) return;
      if (!state.assignments.length) {
        box.innerHTML = "";
        return;
      }
      box.innerHTML = state.assignments.map((a) => {
        const on = a.id === lastAssignmentId || (!lastAssignmentId && a === state.assignments[0]);
        return '<div class="asg-row' + (on ? " on" : "") + '" data-id="' + escapeHtml(a.id) + '">' +
          '<span class="ttl">' + escapeHtml(a.title || t("未命名", "Untitled")) +
            " · " + asgShortMeta(a) +
            (asgAnswersPublished(a) ? t(" · 已發答案", " · key out") : "") +
            (asgScriptsReturned(a) ? t(" · 已發還", " · returned") : "") +
          "</span>" +
          '<span class="badge ' + asgBadgeClass(a) + '">' + asgLockLabel(a) + "</span>" +
          '<button type="button" class="btn" data-paper="' + escapeHtml(a.id) + '">' +
            (asgPaperOnly(a) ? t("准網上交", "Allow online") : t("改為只收紙本", "Paper only")) +
          "</button>" +
          '<button type="button" class="btn" data-lock="' + escapeHtml(a.id) + '">' +
            (asgOpen(a) ? t("上鎖，停止提交", "Lock submissions") : t("解鎖，開放提交", "Unlock submissions")) +
          "</button>" +
          '<button type="button" class="btn" data-keypub="' + escapeHtml(a.id) + '">' +
            (asgAnswersPublished(a) ? t("收回答案", "Hide answers") : t("發佈答案", "Publish answers")) +
          "</button>" +
          '<button type="button" class="btn" data-return="' + escapeHtml(a.id) + '">' +
            (asgScriptsReturned(a) ? t("收回發還", "Recall scripts") : t("發還功課", "Return scripts")) +
          "</button>" +
          (canDeleteAssignment(a)
            ? '<button type="button" class="btn danger" data-del="' + escapeHtml(a.id) + '">' + t("刪除", "Delete") + "</button>"
            : "") +
        "</div>";
      }).join("");
      box.onclick = async (e) => {
        const paperBtn = e.target.closest("[data-paper]");
        if (paperBtn) {
          e.preventDefault();
          const asg = state.assignments.find((x) => x.id === paperBtn.getAttribute("data-paper"));
          if (asg) await toggleAssignmentPaper(asg);
          return;
        }
        const lockBtn = e.target.closest("[data-lock]");
        if (lockBtn) {
          e.preventDefault();
          const asg = state.assignments.find((x) => x.id === lockBtn.getAttribute("data-lock"));
          if (asg) await toggleAssignmentLock(asg);
          return;
        }
        const keyBtn = e.target.closest("[data-keypub]");
        if (keyBtn) {
          e.preventDefault();
          const asg = state.assignments.find((x) => x.id === keyBtn.getAttribute("data-keypub"));
          if (asg) await toggleAssignmentFlag(asg, "answersPublished");
          return;
        }
        const retBtn = e.target.closest("[data-return]");
        if (retBtn) {
          e.preventDefault();
          const asg = state.assignments.find((x) => x.id === retBtn.getAttribute("data-return"));
          if (asg) await toggleAssignmentFlag(asg, "scriptsReturned");
          return;
        }
        const delBtn = e.target.closest("[data-del]");
        if (delBtn) {
          e.preventDefault();
          const asg = state.assignments.find((x) => x.id === delBtn.getAttribute("data-del"));
          if (asg) await deleteAssignmentWithConfirm(asg);
          return;
        }
        const row = e.target.closest(".asg-row");
        if (!row) return;
        lastAssignmentId = row.getAttribute("data-id");
        if ($("t-asg")) $("t-asg").value = lastAssignmentId;
        fillAsgForm();
        paintRoster();
      };
    }
    paintRoster();
    function fillAsgForm() {
      const asg = selectedAssignment("t-asg");
      const form = $("t-asg-form");
      if (!asg) {
        form.innerHTML = "<p class='hint'>" + t("按「新增作業」開始。", "Click New assignment to start.") + "</p>";
        return;
      }
      const opened = asgOpen(asg);
      const paper = asgPaperOnly(asg);
      const barCls = !opened ? "locked" : paper ? "paper" : "opened";
      const barHint = !opened
        ? t("學生不能交卷。老師仍可列印、掃描和看成績。", "Students cannot submit. You can still print, scan and view scores.")
        : paper
          ? t("學生只可列印空白紙，不能網上交或上載，避免同學冒認。收回紙後到「上載批改」掃描。", "Students may only print a blank sheet. No web submit or upload, so classmates cannot submit for them. Collect the papers and scan them under Scan & mark.")
          : t("學生可用網頁或上載交卷。老師掃描不受影響。", "Students may submit on the page or by upload. Teacher scans still work.");
      form.innerHTML =
        '<div class="lock-bar ' + barCls + '">' +
          "<div><b>" + asgLockLabel(asg) + "</b><div class='hint'>" + barHint + "</div></div>" +
          '<button type="button" class="btn" id="a-paper">' +
            (paper ? t("准網上交", "Allow online") : t("改為只收紙本", "Paper only")) +
          "</button>" +
          '<button type="button" class="btn" id="a-lock">' +
            (opened ? t("上鎖，停止提交", "Lock submissions") : t("解鎖，開放提交", "Unlock submissions")) +
          "</button>" +
          '<button type="button" class="btn" id="a-keypub">' +
            (asgAnswersPublished(asg) ? t("收回答案", "Hide answers") : t("發佈答案", "Publish answers")) +
          "</button>" +
          '<button type="button" class="btn" id="a-return">' +
            (asgScriptsReturned(asg) ? t("收回發還", "Recall scripts") : t("發還功課／試卷", "Return scripts")) +
          "</button>" +
        "</div>" +
        '<label class="chk"><input id="a-paper-chk" type="checkbox"' + (paper ? " checked" : "") + "> " +
          t("只收老師掃描（統測建議開）。學生只可列印，不能網上交，以免同學冒認學號。", "Paper only — recommended for tests. Students may print, but cannot submit online, so classmates cannot use another student’s number.") +
        "</label>" +
        '<label>' + t("標題", "Title") + '<input id="a-title" type="text" value="' + escapeHtml(asg.title) + '"></label>' +
        '<div class="field-pair">' +
          '<label>' + t("年級", "Form") + '<select id="a-form">' +
            '<option value=""' + (asgForm(asg) ? "" : " selected") + ">" + t("請選年級", "Choose form") + "</option>" +
            FORMS.map((f) => '<option value="' + f.id + '"' + (asgForm(asg) === f.id ? " selected" : "") + ">" + t(f.zh, f.en) + "</option>").join("") +
          "</select></label>" +
          '<label>' + t("科目", "Subject") + '<select id="a-subj">' +
            (normalizeSubjectId(asg.subject) && !SUBJECTS.some((s) => s.id === asg.subject)
              ? '<option value="' + escapeHtml(asg.subject) + '" selected>' + escapeHtml(subjectLabel(asg.subject)) + "</option>"
              : "") +
            SUBJECTS.map((s) => '<option value="' + s.id + '"' + (asg.subject === s.id ? " selected" : "") + ">" + t(s.zh, s.en) + "</option>").join("") +
          "</select></label>" +
        "</div>" +
        '<p class="hint">' + t("只有該年級、並在註冊時選了此科目的學生看得到交卷頁。", "Only students in this form who registered for this subject can open the submission page.") + "</p>" +
        '<div class="field-pair">' +
          '<label>' + t("類型（可選）", "Type (optional)") + '<select id="a-wtype">' +
            '<option value=""' + (asgWorkType(asg) ? "" : " selected") + ">" + t("（不選）", "—") + "</option>" +
            WORK_TYPES.map((w) => '<option value="' + w.id + '"' + (asgWorkType(asg) === w.id ? " selected" : "") + ">" + t(w.zh, w.en) + "</option>").join("") +
          "</select></label>" +
          '<label>' + t("編號（可選，0–99，紙本如 H03）", "Number (optional, 0–99, e.g. H03)") +
            '<input id="a-wno" type="number" min="0" max="99" value="' + (asgWorkNo(asg) == null ? "" : asgWorkNo(asg)) + '"></label>' +
        "</div>" +
        '<p class="hint">' + t("可留空。填了之後學生網頁交卷會自動記入此類型，不用再選功課／堂課／統測。", "Optional. If you set them, the web form records this type automatically. Students do not choose homework / classwork / uniform test.") + "</p>" +
        '<div class="asg-sec">' +
          "<h3>" + t("選擇題 MC", "Multiple choice") + "</h3>" +
          '<label class="chk"><input id="a-mc" type="checkbox"' + (asgHasMc(asg) ? " checked" : "") + "> " +
            t("這份有選擇題。", "This assignment has MCQ.") +
          "</label>" +
          '<p class="hint">' + t("開了之後學生用網頁或答題紙交 MC。取消勾選則只出長題。", "Students submit MC on the web form or the printed sheet. Uncheck for written-only.") + "</p>" +
          '<div id="a-mc-box"' + (asgHasMc(asg) ? "" : " hidden") + ">" +
            '<label>' + t("MC 題來源（如：書 P.13）", "MC source (e.g. Book p.13)") +
              '<input id="a-mc-src" type="text" maxlength="120" value="' + escapeHtml(asg.mcSource || "") + '" placeholder="' + t("書 P.13", "Book p.13") + '"></label>' +
            '<label>' + t("題數（最多 60）", "Number of questions (max 60)") + '<input id="a-n" type="number" min="1" max="60" value="' + asg.n + '"></label>' +
            '<label>' + t("每題 MC 預設佔分", "Default marks per MC item") + '<input id="a-mk-each" type="number" min="0" max="20" step="0.5" value="' + escapeHtml(asg.mcMarkEach != null ? asg.mcMarkEach : 1) + '"></label>' +
            '<p class="hint">' + t("可在下面改個別題的佔分。標準答案仍按對錯計，再乘該題佔分。", "You can change marks for single items below. The key still marks right/wrong, then multiplies by that item’s marks.") + "</p>" +
            '<div class="mk-grid" id="a-mark-grid"></div>' +
            '<label>' + t("標準答案（可貼 ABCDA… 或 1A 2C）", "Answer key (paste ABCDA… or 1A 2C)") +
              '<textarea id="a-key" rows="3">' + escapeHtml(keyToText(asg)) + "</textarea></label>" +
            '<div class="key-grid" id="a-key-grid"></div>' +
          "</div>" +
        "</div>" +
        '<div class="asg-sec">' +
          "<h3>" + t("長題／作答紙", "Written / long questions") + "</h3>" +
          '<label class="chk"><input id="a-written" type="checkbox"' + (asgHasWritten(asg) ? " checked" : "") + "> " +
            t("這份有長題。開了之後學生要交 written sheet，成績會加 MC + 長題分。", "This assignment has written work. Students upload the written sheet. Results add MC + written marks.") +
          "</label>" +
          '<div id="a-written-box">' +
            '<div class="field-pair">' +
              '<label>' + t("長題題數（1–5）", "Written items (1–5)") +
                '<input id="a-wn" type="number" min="1" max="5" value="' + Math.max(1, Math.min(5, Number(asg.writtenN) || 1)) + '"></label>' +
              '<label>' + t("每題佔分", "Marks per written item") +
                '<input id="a-weach" type="number" min="0" max="100" step="0.5" value="' + escapeHtml(asg.writtenEach != null ? asg.writtenEach : 0) + '"></label>' +
            "</div>" +
            '<label>' + t("長題來源", "Written source") +
              '<input id="a-wsrc" type="text" maxlength="120" value="' + escapeHtml(asg.writtenSource || "") + '" placeholder="' + t("書 P.20 / 工作紙", "Book p.20 / worksheet") + '"></label>' +
            '<label>' + t("長題滿分（1–100）", "Written full marks (1–100)") + '<input id="a-wmax" type="number" min="1" max="100" value="' + writtenMaxOf(asg) + '"></label>' +
            '<p class="hint">' + t("改卷後請在作答紙首頁右側評分欄塗總分（百／十／個，0–100），再上載已改 PDF。亦可在成績頁手輸入。", "After marking, fill the total (100s / 10s / 1s, 0–100) in the marks column on page 1, then upload the marked PDF. You can also type the mark on Results.") + "</p>" +
          "</div>" +
        "</div>" +
        '<div class="actions">' +
          '<button type="button" class="btn primary" id="a-save">' + t("儲存作業", "Save assignment") + "</button>" +
          (canDeleteAssignment(asg)
            ? '<button type="button" class="btn danger" id="a-del">' + t("刪除作業", "Delete") + "</button>"
            : '<p class="hint">' + t("只有建立這份作業的老師可以刪除。", "Only the teacher who created this assignment can delete it.") + "</p>") +
        "</div>";
      drawKeyGrid(asg);
      drawMarkGrid(asg);
      if ($("a-mc")) {
        $("a-mc").onchange = () => {
          asg.hasMc = !!$("a-mc").checked;
          if ($("a-mc-box")) $("a-mc-box").hidden = !asg.hasMc;
        };
      }
      $("a-written").onchange = () => {
        asg.hasWritten = !!$("a-written").checked;
      };
      ["a-mc-src", "a-n", "a-mk-each", "a-key"].forEach((id) => {
        const box = $(id);
        if (!box) return;
        box.addEventListener("input", () => {
          if ($("a-mc") && !$("a-mc").checked) {
            $("a-mc").checked = true;
            asg.hasMc = true;
            if ($("a-mc-box")) $("a-mc-box").hidden = false;
          }
        });
      });
      ["a-wn", "a-weach", "a-wsrc", "a-wmax"].forEach((id) => {
        const box = $(id);
        if (!box) return;
        box.addEventListener("input", () => {
          if ($("a-written") && !$("a-written").checked) $("a-written").checked = true;
        });
      });
      if ($("a-mk-each")) $("a-mk-each").onchange = () => {
        asg.mcMarkEach = Math.max(0, Number($("a-mk-each").value) || 1);
        asg.mcMarks = [];
        drawMarkGrid(asg);
      };
      $("a-lock").onclick = () => toggleAssignmentLock(asg);
      $("a-paper").onclick = () => toggleAssignmentPaper(asg);
      $("a-paper-chk").onchange = () => toggleAssignmentPaper(asg);
      if ($("a-keypub")) $("a-keypub").onclick = () => toggleAssignmentFlag(asg, "answersPublished");
      if ($("a-return")) $("a-return").onclick = () => toggleAssignmentFlag(asg, "scriptsReturned");
      function syncWrittenMax() {
        const n = Math.max(1, Math.min(5, Number($("a-wn") && $("a-wn").value) || 1));
        const each = Math.max(0, Number($("a-weach") && $("a-weach").value) || 0);
        if ($("a-wmax") && each > 0) $("a-wmax").value = Math.min(100, n * each);
      }
      if ($("a-wn")) $("a-wn").onchange = syncWrittenMax;
      if ($("a-weach")) $("a-weach").onchange = syncWrittenMax;
      if ($("a-n")) $("a-n").onchange = () => {
        const n = Math.max(1, Math.min(60, Number($("a-n").value) || 40));
        $("a-n").value = n;
        asg.n = n;
        if (!Array.isArray(asg.key)) asg.key = [];
        while (asg.key.length < n) asg.key.push("");
        asg.key = asg.key.slice(0, n);
        if (Array.isArray(asg.mcMarks)) asg.mcMarks = asg.mcMarks.slice(0, n);
        drawKeyGrid(asg);
        drawMarkGrid(asg);
      };
      if ($("a-key")) $("a-key").onchange = () => {
        asg.key = parseKey($("a-key").value, asg.n);
        drawKeyGrid(asg);
      };
      $("a-save").onclick = () => saveAsgFromForm(asg);
      if ($("a-del")) $("a-del").onclick = () => deleteAssignmentWithConfirm(asg);
    }
  }

  function drawMarkGrid(asg) {
    const g = $("a-mark-grid");
    if (!g) return;
    const marks = mcMarkList(asg);
    g.innerHTML = marks.map((m, i) =>
      '<label class="mk">Q' + (i + 1) + '<input data-mk="' + i + '" type="number" min="0" max="20" step="0.5" value="' + m + '"></label>'
    ).join("");
  }

  function readMarkGrid(n, fallback) {
    const fb = Number.isFinite(Number(fallback)) ? Number(fallback) : 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const inp = document.querySelector('#a-mark-grid input[data-mk="' + i + '"]');
      const v = inp ? Number(inp.value) : fb;
      out.push(Number.isFinite(v) && v >= 0 ? v : fb);
    }
    return out;
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

  async function toggleAssignmentLock(asg) {
    if (!asg) return;
    asg.open = !asgOpen(asg);
    asg.updatedAt = new Date().toISOString();
    lastAssignmentId = asg.id;
    saveState(state);
    status(t("正在同步上鎖狀態…", "Saving lock state…"));
    const remote = await pushRemote("upsertAssignment", { assignment: asg });
    applySyncResult(remote);
    if (remote && remote.ok && remote.mode !== "local") {
      status(asgOpen(asg)
        ? t("已解鎖並同步。學生可交卷。", "Unlocked and synced. Students may submit.")
        : t("已上鎖並同步。學生不能再交。", "Locked and synced. Students cannot submit."));
    }
    renderApp();
  }

  async function toggleAssignmentFlag(asg, field) {
    if (!asg || (field !== "answersPublished" && field !== "scriptsReturned")) return;
    asg[field] = !asg[field];
    asg.updatedAt = new Date().toISOString();
    lastAssignmentId = asg.id;
    saveState(state);
    status(t("正在同步…", "Saving…"));
    const remote = await pushRemote("upsertAssignment", { assignment: asg });
    applySyncResult(remote);
    if (remote && remote.ok && remote.mode !== "local") {
      if (field === "answersPublished") {
        status(asg.answersPublished
          ? t("已發佈答案。學生重新整理後會看到正確答案和自己的選項。", "Answers published. Students will see the key and their choices after refresh.")
          : t("已收回答案。", "Answers hidden from students."));
      } else {
        status(asg.scriptsReturned
          ? t("已發還功課／試卷。學生會看到按學號對上的已改 PDF。", "Scripts returned. Students will see the marked PDFs matched to their class no.")
          : t("已收回發還。", "Returned scripts hidden from students."));
      }
    }
    renderApp();
  }

  async function deleteAssignmentWithConfirm(asg) {
    if (!asg) return;
    if (!canDeleteAssignment(asg)) {
      status(t("只有建立這份作業的老師可以刪除。", "Only the teacher who created this assignment can delete it."), true);
      return;
    }
    const title = asg.title || t("未命名", "Untitled");
    if (!confirm(t(
      "警告：即將刪除「" + title + "」。學生將不能再開這份交卷頁。此操作不能復原。",
      "Warning: this will delete “" + title + "”. Students will no longer see this assignment. This cannot be undone."
    ))) return;
    if (!confirm(t(
      "再確認一次：真的刪除這份功課／測驗？按取消可保留。",
      "Confirm again: delete this assignment / test? Cancel to keep it."
    ))) return;
    state.assignments = state.assignments.filter((x) => x.id !== asg.id);
    saveState(state);
    const remote = await pushRemote("deleteAssignment", { id: asg.id });
    if (remote && remote.error === "forbidden") {
      status(t("伺服器拒絕刪除：只有建立者可以刪。", "Delete rejected: only the creator can delete this."), true);
      return;
    }
    applySyncResult(remote);
    renderApp();
  }

  async function toggleAssignmentPaper(asg) {
    if (!asg) return;
    asg.paperOnly = !asgPaperOnly(asg);
    asg.updatedAt = new Date().toISOString();
    lastAssignmentId = asg.id;
    saveState(state);
    status(t("正在同步收取方式…", "Saving collection mode…"));
    const remote = await pushRemote("upsertAssignment", { assignment: asg });
    applySyncResult(remote);
    if (remote && remote.ok && remote.mode !== "local") {
      status(asgPaperOnly(asg)
        ? t("已改為只收紙本並同步。學生不能網上交。", "Set to paper-only and synced. Students cannot submit online.")
        : t("已准網上交並同步。", "Online submit enabled and synced."));
    }
    renderApp();
  }

  async function saveAsgFromForm(asg) {
    asg.title = $("a-title").value.trim() || t("未命名", "Untitled");
    asg.form = normalizeForm($("a-form") && $("a-form").value);
    if (!asg.form) {
      status(t("請選擇年級。只有該年級學生看得到交卷頁。", "Choose a form. Only that form can open the submission page."), true);
      return;
    }
    asg.subject = $("a-subj").value;
    asg.workType = normalizeWorkType($("a-wtype") && $("a-wtype").value);
    const rawNo = $("a-wno") ? String($("a-wno").value).trim() : "";
    asg.workNo = rawNo === "" ? null : asgWorkNo({ workNo: rawNo });
    if ($("a-n")) asg.n = Math.max(1, Math.min(60, Number($("a-n").value) || 40));
    if ($("a-key")) asg.key = parseKey($("a-key").value, asg.n);
    if ($("a-paper-chk")) asg.paperOnly = !!$("a-paper-chk").checked;
    const writtenFilled = Number($("a-weach") && $("a-weach").value) > 0
      || !!($("a-wsrc") && $("a-wsrc").value.trim());
    asg.hasMc = !!($("a-mc") && $("a-mc").checked);
    asg.hasWritten = !!($("a-written") && $("a-written").checked) || writtenFilled;
    if (!asg.hasMc && !asg.hasWritten) {
      status(t("請至少勾選選擇題或長題。", "Turn on multiple choice or written work."), true);
      return;
    }
    asg.mcSource = ($("a-mc-src") && $("a-mc-src").value.trim()) || "";
    asg.mcMarkEach = Math.max(0, Number($("a-mk-each") && $("a-mk-each").value) || 1);
    asg.mcMarks = readMarkGrid(asg.n, asg.mcMarkEach);
    asg.writtenN = Math.max(1, Math.min(5, Number($("a-wn") && $("a-wn").value) || 1));
    asg.writtenEach = Math.max(0, Number($("a-weach") && $("a-weach").value) || 0);
    asg.writtenSource = ($("a-wsrc") && $("a-wsrc").value.trim()) || "";
    asg.writtenMax = Math.max(1, Math.min(100, Number($("a-wmax") && $("a-wmax").value) || writtenMaxOf(asg)));
    if (!asg.createdBy) asg.createdBy = teacherAccount() || TEACHER_USER;
    asg.updatedAt = new Date().toISOString();
    saveState(state);
    status(t("正在同步作業…", "Saving assignment…"));
    const remote = await pushRemote("upsertAssignment", { assignment: asg });
    applySyncResult(remote);
    renderApp();
  }

  function currentRoster() {
    if (cloudOk) return roster.slice();
    return loadLocalAccounts().map((a) => ({
      stno: a.stno,
      name: a.name || "",
      subjects: normalizeSubjects(a.subjects),
      createdAt: a.createdAt || ""
    }));
  }

  function renderStudents(panel) {
    const list = currentRoster().sort((a, b) => String(a.stno).localeCompare(String(b.stno)));
    panel.innerHTML =
      "<h2>" + t("已註冊學生", "Registered students") + "</h2>" +
      '<p class="hint">' + t("可改姓名、科目或重設密碼。學生自己不能改科目。刪除帳戶不會清走已交的成績。", "You can edit name, subjects or reset a password. Students cannot change their subject later. Removing an account does not delete submitted scores.") + "</p>" +
      (list.length
        ? '<div class="table-wrap"><table class="stu-admin"><thead><tr>' +
          "<th>" + t("學號", "Class no.") + "</th>" +
          "<th>" + t("年級", "Form") + "</th>" +
          "<th>" + t("姓名", "Name") + "</th>" +
          "<th>" + t("科目", "Subjects") + "</th>" +
          "<th></th></tr></thead><tbody>" +
          list.map((a) =>
            '<tr data-stno="' + escapeHtml(a.stno) + '">' +
              "<td>" + escapeHtml(stnoLabel(a.stno)) + "</td>" +
              "<td>" + escapeHtml(formLabel(formOfStno(a.stno))) + "</td>" +
              "<td>" + escapeHtml(a.name || "—") + "</td>" +
              "<td>" + escapeHtml(subjectsLabel(a.subjects)) + "</td>" +
              '<td><button type="button" class="btn" data-edit="' + escapeHtml(a.stno) + '">' + t("編輯", "Edit") + "</button></td>" +
            "</tr>"
          ).join("") +
          "</tbody></table></div>"
        : '<p class="warn">' + t("尚未有學生註冊。學生在登入頁建立帳戶後會出現在這裡。", "No student has registered yet. Accounts appear here after they sign up.") + "</p>") +
      '<div id="t-stu-edit"></div>';
    panel.onclick = (e) => {
      const btn = e.target.closest("[data-edit]");
      if (!btn) return;
      paintStudentEditor(btn.getAttribute("data-edit"));
    };
  }

  function paintStudentEditor(stno) {
    const box = $("t-stu-edit");
    if (!box) return;
    const acc = currentRoster().find((a) => a.stno === stno);
    if (!acc) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML =
      '<form class="card stu-edit" id="t-stu-form">' +
        "<h3>" + t("編輯 ", "Edit ") + escapeHtml(stnoLabel(acc.stno)) + "</h3>" +
        "<label>" + t("姓名", "Name") + '<input id="t-stu-name" type="text" maxlength="80" value="' + escapeHtml(acc.name || "") + '"></label>' +
        "<p class='hint'>" + t("科目", "Subjects") + "</p>" +
        subjectPickHtml("t-stu", acc.subjects) +
        "<label>" + t("新密碼（留空則不改）", "New password (leave blank to keep)") +
          '<input id="t-stu-pass" type="password" autocomplete="new-password"></label>' +
        '<div class="actions">' +
          '<button type="submit" class="btn primary">' + t("儲存學生資料", "Save student") + "</button>" +
          '<button type="button" class="btn danger" id="t-stu-del">' + t("刪除帳戶", "Remove account") + "</button>" +
        "</div>" +
        '<p id="t-stu-msg" hidden></p>' +
      "</form>";
    box.querySelector("#t-stu-form").onsubmit = async (e) => {
      e.preventDefault();
      const subjects = readSubjectPicks("t-stu");
      const msg = $("t-stu-msg");
      const result = await teacherSaveStudent(acc.stno, {
        name: $("t-stu-name").value.trim(),
        subjects,
        password: $("t-stu-pass").value
      });
      msg.hidden = false;
      if (!result.ok) {
        msg.style.color = "var(--danger)";
        msg.textContent = result.error === "subjects"
          ? t("請至少選一個科目。", "Choose at least one subject.")
          : authErrorText(result.error);
        return;
      }
      status(t("已儲存學生資料。", "Student details saved."));
      renderTeacher();
    };
    $("t-stu-del").onclick = async () => {
      if (!confirm(t("刪除此學生帳戶？學號 ", "Remove this student account? Class no. ") + stnoLabel(acc.stno))) return;
      await teacherDeleteStudent(acc.stno);
      renderTeacher();
    };
  }

  async function teacherSaveStudent(stno, patch) {
    const subjects = normalizeSubjects(patch.subjects);
    if (!subjects.length) return { ok: false, error: "subjects" };
    try {
      const remote = await api({
        op: "updateStudent",
        stno,
        name: patch.name || "",
        subjects,
        password: patch.password || ""
      });
      if (remote && remote.ok) {
        if (remote.state && Array.isArray(remote.state.accounts)) {
          roster = remote.state.accounts.slice();
        } else {
          const i = roster.findIndex((a) => a.stno === stno);
          const row = { stno, name: patch.name || "", subjects, createdAt: i >= 0 ? roster[i].createdAt : "" };
          if (i >= 0) roster[i] = { ...roster[i], ...row };
          else roster.push(row);
        }
        applySyncResult(remote);
        return { ok: true, cloud: remote.mode !== "local" };
      }
      if (remote && remote.mode === "local") return localUpdateStudent(stno, patch);
      if (remote && remote.error) return { ok: false, error: remote.error };
    } catch {}
    return localUpdateStudent(stno, patch);
  }

  async function teacherDeleteStudent(stno) {
    try {
      const remote = await api({ op: "deleteStudent", stno });
      if (remote && remote.ok) {
        if (remote.state && Array.isArray(remote.state.accounts)) roster = remote.state.accounts.slice();
        else roster = roster.filter((a) => a.stno !== stno);
        applySyncResult(remote);
        return { ok: true };
      }
    } catch {}
    return localDeleteStudent(stno);
  }

  async function localUpdateStudent(stno, patch) {
    const list = loadLocalAccounts();
    const acc = list.find((a) => a.stno === stno);
    if (!acc) return { ok: false, error: "missing" };
    const subjects = normalizeSubjects(patch.subjects);
    if (!subjects.length) return { ok: false, error: "subjects" };
    acc.name = patch.name || "";
    acc.subjects = subjects;
    if (patch.password) {
      if (String(patch.password).length < 4) return { ok: false, error: "password" };
      const hashed = await hashPassword(patch.password);
      acc.salt = hashed.salt;
      acc.hash = hashed.hash;
    }
    saveLocalAccounts(list);
    const i = roster.findIndex((a) => a.stno === stno);
    const row = { stno, name: acc.name, subjects, createdAt: acc.createdAt || "" };
    if (i >= 0) roster[i] = row;
    else roster.push(row);
    return { ok: true, local: true };
  }

  function localDeleteStudent(stno) {
    saveLocalAccounts(loadLocalAccounts().filter((a) => a.stno !== stno));
    roster = roster.filter((a) => a.stno !== stno);
    return { ok: true, local: true };
  }

  function renderPrint(panel) {
    panel.innerHTML =
      '<label>' + t("列印哪一份作業", "Print which assignment") + '<select id="t-asg">' + assignmentSelectHtml("t-asg", true) + "</select></label>" +
      '<p class="hint">' + t("列印時請用 A4、實際大小（100%），不要「符合頁面」。四角黑格必須印出。作答紙範本最多 6 頁，可先選頁數再列印或下載。", "Print on A4 at 100% actual size, not “fit to page”. Keep the four corner squares. The written template has up to 6 pages; choose how many to print or download.") + "</p>" +
      '<div class="actions">' +
        '<button type="button" class="btn primary" id="t-print-mc">' + t("列印 MC 答題紙", "Print MC sheet") + "</button>" +
        '<button type="button" class="btn" id="t-dl-mc">' + t("下載 MC PDF", "Download MC PDF") + "</button>" +
        writtenPagesSelectHtml("t-wr-pages") +
        '<button type="button" class="btn primary" id="t-print-wr">' + t("列印 PDF 作答紙", "Print written sheet") + "</button>" +
        '<button type="button" class="btn" id="t-dl-wr">' + t("下載作答紙 PDF", "Download written PDF") + "</button>" +
      "</div>" +
      '<div class="preview-wrap" id="t-preview"></div>';
    bindAsgSelect(() => renderPrint(panel));
    const a = selectedAssignment("t-asg");
    const pv = $("t-preview");
    if (asgHasMc(a)) {
      sheetsForPrint(currentSpec(state, a, "mc")).forEach((sh) => {
        sh.classList.add("preview");
        placeSheet(pv, sh);
      });
    }
    if (asgHasWritten(a)) {
      sheetsForPrint(currentSpec(state, a, "written")).forEach((sh) => {
        sh.classList.add("preview");
        placeSheet(pv, sh);
      });
    }
    paintMcTools(a);
    paintWrittenTools(a);
    if ($("t-print-mc")) $("t-print-mc").onclick = () => printSpec("mc");
    if ($("t-dl-mc")) $("t-dl-mc").onclick = () => downloadSheetPdf("mc");
    if ($("t-print-wr")) $("t-print-wr").onclick = () => printSpec("written");
    if ($("t-dl-wr")) $("t-dl-wr").onclick = () => downloadSheetPdf("written");
    if ($("t-wr-pages")) $("t-wr-pages").onchange = () => renderPrint(panel);
  }

  function renderScan(panel) {
    panel.innerHTML =
      '<label>' + t("批改哪一份作業", "Mark which assignment") + '<select id="t-asg">' + assignmentSelectHtml("t-asg", true) + "</select></label>" +
      '<div id="t-scan-hint"></div>' +
      '<div class="drop" id="t-drop"><strong>' + t("上載收回的 MC 紙（PNG／相片／PDF）", "Upload collected MC sheets (PNG / photo / PDF)") + "</strong>" +
        '<p>' + t("影印機掃描的多頁 PDF 或逐張 PNG／JPG 均可：一頁一人，每檔最多 15MB。系統會掃描入分。", "A multi-page scanner PDF or separate PNG / JPG files are fine: one student per page, 15MB each. The system scans and scores them.") + "</p>" +
        '<input id="t-file-mc" type="file" accept="' + SHEET_ACCEPT + '" multiple>' +
      "</div>" +
      '<div class="drop" id="t-drop-wr"><strong>' + t("上載收回的作答紙（PNG／相片／PDF）", "Upload collected written sheets (PNG / photo / PDF)") + "</strong>" +
        '<input id="t-file-wr" type="file" accept="' + SHEET_ACCEPT + '" multiple>' +
      "</div>" +
      '<div class="actions">' +
        '<button type="button" class="btn" id="t-test">' + t("試機（合成一張已填紙）", "Self-test (synthetic filled sheet)") + "</button>" +
      "</div>" +
      '<div id="t-review"></div>';
    function fillScanHint() {
      const hint = $("t-scan-hint");
      const asg = selectedAssignment("t-asg");
      if (!hint) return;
      const bits = [];
      if (asg && asgPaperOnly(asg) && asgOpen(asg)) {
        bits.push('<p class="warn">' + t("這份設為只收紙本。請掃描學生交回的答題紙。", "This assignment is paper-only. Scan the sheets students handed in.") + "</p>");
      }
      if (asg && asgHasWritten(asg)) {
        bits.push('<p class="hint">' + t("長題改好後，請在作答紙首頁右側評分欄塗總分（百／十／個，0–100），再上載 PDF。系統按學號入帳；按「發還功課」後學生才看得到已改卷。", "After marking, fill the total (100s / 10s / 1s, 0–100) in the marks column on page 1, then upload the PDF. Files are filed by class no. Students see them after you tap Return scripts.") + "</p>");
      } else if (asgHasMc(asg)) {
        bits.push('<p class="hint">' + t("掃描已改好的紙，系統按卷上學號入帳。再按「發還功課」以 PDF 發還給該生。", "Scan marked papers; the system files them by the class no. on the sheet. Tap Return scripts to send the PDF back to that student.") + "</p>");
      }
      hint.innerHTML = bits.join("");
      paintMcTools(asg);
      if ($("t-drop-wr")) $("t-drop-wr").hidden = !asgHasWritten(asg);
    }
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
    const filesHost = el("div", "t-files");
    filesHost.id = "t-files";
    panel.appendChild(filesHost);
    async function paintFiles() {
      try {
        state = await pullRemote(state);
        saveState(state);
      } catch {}
      const asg = selectedAssignment("t-asg");
      const recs = asg ? assignmentFileRecords(asg.id) : [];
      filesHost.innerHTML = "<h3>" + t("已保留的上載檔（學生／掃描）", "Kept uploads (student / scan)") + "</h3>" +
        '<p class="hint">' + t("學生上載的 PDF／相片會留在此，方便核實。只顯示已同步到雲端的原件。掃描已改卷後按學號入帳，發還後學生才看得到。", "Student PDFs/photos stay here for checking. Only originals synced to the cloud are listed. Scanned marked papers are filed by class no. and shown to students after you return them.") + "</p>" +
        fileListHtml(recs);
      bindFileList(filesHost, recs);
    }
    bindAsgSelect(() => { fillScanHint(); paintFiles(); });
    fillScanHint();
    paintFiles();
    $("t-test").onclick = async () => {
      const r = await selfTest();
      status(r.pass
        ? t("試機通過：" + (r.cases || []).length + " 項（學號、功課編號、MC 與長題評分）。", "Self-test passed: " + (r.cases || []).length + " cases (class no., HW/UT, MC and written marks).")
        : t("試機未通過：", "Self-test failed: ") + ((r.cases || []).filter((c) => !c.pass).map((c) => c.name + " " + c.error).join("；") || ((r.read && r.read.stno) + " " + (r.read && r.read.hwCode))),
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
    async function fillScores() {
      try {
        state = await pullRemote(state);
        saveState(state);
      } catch {}
      const asg = selectedAssignment("t-asg");
      const box = $("t-scorebox");
      if (!asg) {
        box.innerHTML = "<p class='hint'>" + t("未有作業。", "No assignment.") + "</p>";
        return;
      }
      const { stats } = analysisOf(asg);
      const graded = scoreRoster(asg);
      const hasMc = asgHasMc(asg);
      const hasW = asgHasWritten(asg);
      const withMc = graded.filter((s) => s.mcScore != null && s.mcMax);
      const withTotal = graded.filter((s) => s.complete && s.totalMax);
      const avgMc = withMc.length ? (withMc.reduce((p, s) => p + (s.mcScore || 0), 0) / withMc.length) : 0;
      const avgTot = withTotal.length ? (withTotal.reduce((p, s) => p + s.total, 0) / withTotal.length) : 0;
      const pdfAll = state.pdfSubmissions.filter((s) => s.assignmentId === asg.id);
      const extraTries = graded.reduce((n, s) => n + Math.max(0, s.tries.length - 1), 0);
      const cols = hasW ? 10 : 8;
      box.innerHTML =
        '<div class="statline' + (hasW ? " four" : "") + '">' +
          (hasMc
            ? '<div><b>' + withMc.length + "</b><span>" + t("MC 交卷（計分）", "MC scripts (counted)") + "</span></div>" +
              '<div><b>' + (withMc.length ? fmtMark(avgMc) + "/" + fmtMark(withMc[0].mcMax) : "—") + "</b><span>" + t("MC 平均（最後一次）", "MC average (last try)") + "</span></div>"
            : "") +
          (hasW
            ? '<div><b>' + (withTotal.length ? fmtMark(avgTot) + "/" + fmtMark(withTotal[0].totalMax) : "—") + "</b><span>" + (hasMc ? t("平均總分（MC+長題）", "Average total (MC+written)") : t("平均長題分", "Average written")) + "</span></div>"
            : "") +
          '<div><b>' + pdfAll.filter((s, i, arr) => arr.findIndex((x) => x.stno === s.stno) === i).length + "</b><span>" + t("PDF 作答紙", "Written PDFs") + "</span></div>" +
        "</div>" +
        (extraTries ? '<p class="hint">' + t("另有 ", "Plus ") + extraTries + t(" 次重交已存檔，只給老師看；平均分與答對率只計每人最後一次。", " earlier attempt(s) kept for teachers. Averages and facility use each student’s last script only.") + "</p>" : "") +
        (hasW ? '<p class="hint">' + t("長題分可在表內手輸入，或上載已塗分數圓圈的作答紙。總分 = MC + 長題。", "Type written marks in the table, or upload a marked sheet with score bubbles filled. Total = MC + written.") + "</p>" : "") +
        '<div class="actions">' +
          '<button type="button" class="btn primary" id="t-csv">' + t("下載成績 CSV", "Download CSV") + "</button>" +
        "</div>" +
        '<h3>' + t("各人分數", "Scores") + "</h3>" +
        '<p class="hint">' + t("點一列可看該生每題選了甚麼，以及上載的 MC／作答紙原件。綠＝對，紅＝錯。", "Tap a row to see that student’s answers and uploaded MC / written originals. Green = right, red = wrong.") + "</p>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>' + t("學號", "No.") + "</th><th>" + t("班別", "Class") + "</th><th>" + t("類型", "Type") + "</th><th>" + t("姓名", "Name") + "</th>" +
        (hasW
          ? "<th>MC</th><th>" + t("長題", "Written") + "</th><th>" + t("總分", "Total") + "</th>"
          : "<th>" + t("分數", "Score") + "</th>") +
        "<th>%</th><th>" + t("次數", "Tries") + "</th><th>" + t("來源", "Source") + "</th></tr></thead><tbody>" +
        (graded.length ? graded.map((s) => {
          const p = parseStno(s.stno);
          const pctBase = hasW ? (s.complete ? s.totalMax : s.mcMax) : s.mcMax;
          const pctVal = hasW && s.complete ? s.total : s.mcScore;
          const pct = pctBase ? Math.round(1000 * (pctVal || 0) / pctBase) / 10 : "";
          const lastId = s.id;
          const origRecs = assignmentFileRecords(asg.id, s.stno);
          const origHtml = '<div class="stu-orig"><h4>' + t("上載原件", "Uploaded originals") + "</h4>" +
            (origRecs.length
              ? fileListHtml(origRecs, { hideStno: true })
              : '<p class="hint">' + t("尚未有已同步的原件。請學生再上載一次 PNG／相片／PDF。", "No synced original yet. Ask the student to upload the PNG / photo / PDF again.") + "</p>") +
            "</div>";
          const detail = s.tries.map((tr, i) => {
            const g = gradeAnswers(tr.answers, asg.key, mcMarkList(asg));
            const last = tr.id === lastId || i === s.tries.length - 1;
            return '<div class="try' + (last ? " on" : "") + '">' +
              "<div><b>" + (last ? t("計分（最後一次）", "Counted (last try)") : t("較早第 ", "Earlier #") + (i + 1)) + "</b> · " +
              escapeHtml(formatAt(tr.at)) + " · " + escapeHtml(sourceLabel(tr.source)) +
              (parseHwCode(tr.hwCode) ? " · " + escapeHtml(hwDisplay(tr.hwCode)) : "") +
              " · " + (g.score != null ? fmtMark(g.score) + "/" + fmtMark(g.max) : "—") +
              "</div>" +
              studentAnswerGrid(tr.answers, asg.key) +
            "</div>";
          }).join("");
          const scoreCells = hasW
            ? "<td>" + (s.mcScore != null ? fmtMark(s.mcScore) + "/" + fmtMark(s.mcMax) : "—") + "</td>" +
              '<td><input class="wscore" data-stno="' + escapeHtml(s.stno) + '" type="number" min="0" max="' + s.wMax + '" step="0.5" value="' + (s.wScore != null ? s.wScore : "") + '"> / ' + fmtMark(s.wMax) + "</td>" +
              "<td>" + fmtMark(s.total) + "/" + fmtMark(s.totalMax) + (s.complete ? "" : t("（長題未入）", " (written pending)")) + "</td>"
            : "<td>" + (s.mcScore != null ? fmtMark(s.mcScore) + "/" + fmtMark(s.mcMax) : "—") + "</td>";
          return '<tr class="stu-row" data-stno="' + escapeHtml(s.stno) + '"><td>' + escapeHtml(s.stno) + "</td><td>" + escapeHtml((p && p.label) || "") + "</td><td>" + escapeHtml(parseHwCode(s.hwCode) ? hwDisplay(s.hwCode) : "—") + "</td><td>" + escapeHtml(s.name || "") + "</td>" + scoreCells + "<td>" + pct + "</td><td>" + s.tries.length + "</td><td>" + escapeHtml(sourceLabel(s.source)) + "</td></tr>" +
            '<tr class="stu-detail" data-stno="' + escapeHtml(s.stno) + '" hidden><td colspan="' + cols + '">' +
            (detail || (s.answers && s.answers.length ? studentAnswerGrid(s.answers, asg.key) : '<p class="hint">' + t("尚未有 MC 答案。", "No MC answers yet.") + "</p>")) +
            origHtml +
            "</td></tr>";
        }).join("") : '<tr><td colspan="' + cols + '">' + t("尚未有交卷。", "No scripts yet.") + "</td></tr>") +
        "</tbody></table></div>" +
        (asgHasMc(asg)
          ? '<h3>' + t("各題答對率", "Item facility") + "</h3>" +
            '<p class="hint">' + t("答對率條是全班最後一次；下面是各選項佔比。藍框是標準答案。", "The bar is class facility from last scripts. Pills show the share who chose each option. Blue = key.") + "</p>" +
            '<div class="bars">' + stats.map((st) => {
              const pct = st.pct;
              const cls = pct < 40 ? "low" : pct < 70 ? "mid" : "high";
              return '<div class="bar-item"><div class="bar-row"><span class="qn">Q' + st.q + '</span><span class="k">' + (st.key || "-") + '</span><div class="bar"><i class="' + cls + '" style="width:' + pct + '%"></i></div><span class="pct">' + pct + "%</span></div>" +
                optionShareHtml(st) + "</div>";
            }).join("") + "</div>"
          : "") +
        "<h3>" + t("已保留檔案（核實）", "Kept files (verify)") + "</h3>" +
        fileListHtml(assignmentFileRecords(asg.id));
      bindFileList(box, assignmentFileRecords(asg.id));
      const csvBtn = $("t-csv");
      if (csvBtn) csvBtn.onclick = () => exportCsv(asg);
      box.querySelectorAll("input.wscore").forEach((inp) => {
        inp.onclick = (e) => e.stopPropagation();
        inp.onchange = async () => {
          await saveManualWritten(asg, inp.getAttribute("data-stno"), inp.value);
          fillScores();
        };
      });
      box.querySelectorAll(".stu-row").forEach((tr) => {
        tr.onclick = (e) => {
          if (e.target.closest("input,button,label")) return;
          const id = tr.getAttribute("data-stno");
          const det = box.querySelector('.stu-detail[data-stno="' + id + '"]');
          const open = det && !det.hidden;
          box.querySelectorAll(".stu-detail").forEach((d) => { d.hidden = true; });
          box.querySelectorAll(".stu-row").forEach((r) => r.classList.remove("on"));
          if (det && !open) {
            det.hidden = false;
            tr.classList.add("on");
          }
        };
      });
    }
  }

  function enterStudent(info) {
    setSession({
      token: info.token,
      stno: info.stno,
      name: info.name || "",
      subjects: normalizeSubjects(info.subjects),
      role: "student",
      source: info.mode === "blob" ? "blob" : "local"
    });
    setRole("student");
  }

  async function ensureLocalTeachers() {
    let list;
    try {
      list = JSON.parse(localStorage.getItem(TCH_KEY) || "[]");
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    for (let i = 0; i < TEACHER_SEEDS.length; i++) {
      const seed = TEACHER_SEEDS[i];
      if (list.some((x) => String(x.user || "").toLowerCase() === seed.user)) continue;
      const hashed = await hashPassword(seed.password);
      list.push({
        user: seed.user,
        name: seed.name,
        salt: hashed.salt,
        hash: hashed.hash,
        createdAt: new Date().toISOString()
      });
    }
    localStorage.setItem(TCH_KEY, JSON.stringify(list));
    return list;
  }

  function enterTeacher(info) {
    setSession({
      token: info.token,
      account: String(info.account || info.stno || TEACHER_USER).toLowerCase(),
      name: info.name || "",
      role: "teacher",
      source: info.mode === "blob" ? "blob" : "local"
    });
    setRole("teacher");
  }

  async function localTeacherLogin(account, password) {
    const user = String(account || "").trim().toLowerCase();
    const list = await ensureLocalTeachers();
    const rec = list.find((x) => String(x.user || "").toLowerCase() === user);
    if (!rec) return { ok: false, error: "auth" };
    const hashed = await hashPassword(password, rec.salt);
    if (!timingEqual(hashed.hash, rec.hash)) return { ok: false, error: "auth" };
    enterTeacher({ token: "local-" + uid(), account: rec.user, name: rec.name || rec.user, mode: "local" });
    return { ok: true, local: true };
  }

  async function loginTeacher(account, password) {
    const user = String(account || "").trim().toLowerCase();
    if (!user || !password) return { ok: false, error: "auth" };
    try {
      const remote = await apiPublic({ op: "teacherLogin", account: user, password });
      if (remote && remote.ok && remote.token) {
        enterTeacher(remote);
        return { ok: true, cloud: remote.mode !== "local" };
      }
      if (remote && remote.error === "auth") return { ok: false, error: "auth" };
      if (remote && remote.mode === "local") return localTeacherLogin(user, password);
    } catch {}
    return localTeacherLogin(user, password);
  }

  async function localChangeTeacherPassword(oldPassword, newPassword) {
    const user = teacherAccount();
    const list = await ensureLocalTeachers();
    const rec = list.find((x) => String(x.user || "").toLowerCase() === user);
    if (!rec) return { ok: false, error: "old" };
    const check = await hashPassword(oldPassword, rec.salt);
    if (!timingEqual(check.hash, rec.hash)) return { ok: false, error: "old" };
    const next = await hashPassword(newPassword);
    rec.salt = next.salt;
    rec.hash = next.hash;
    localStorage.setItem(TCH_KEY, JSON.stringify(list));
    return { ok: true };
  }

  async function changeTeacherPassword(oldPassword, newPassword, newPassword2) {
    if (String(newPassword || "").length < 4) return { ok: false, error: "password" };
    if (newPassword !== newPassword2) return { ok: false, error: "confirm" };
    const me = getSession();
    if (!me || me.source === "local") return localChangeTeacherPassword(oldPassword, newPassword);
    try {
      const remote = await api({ op: "changeTeacherPassword", oldPassword, newPassword });
      if (remote && remote.ok) {
        if (remote.token) enterTeacher(remote);
        return { ok: true };
      }
      if (remote && (remote.error === "old" || remote.error === "password")) return { ok: false, error: remote.error };
      if (remote && remote.mode === "local") return localChangeTeacherPassword(oldPassword, newPassword);
    } catch {}
    return localChangeTeacherPassword(oldPassword, newPassword);
  }

  function renderTeacherProfile(panel) {
    const me = getSession();
    panel.innerHTML =
      "<h2>" + t("老師個人資料", "Teacher profile") + "</h2>" +
      '<dl class="profile-dl">' +
        "<dt>" + t("帳戶名", "Account") + "</dt><dd>" + escapeHtml((me && me.account) || "") + "</dd>" +
        "<dt>" + t("顯示名稱", "Name") + "</dt><dd>" + escapeHtml((me && me.name) || (me && me.account) || "") + "</dd>" +
      "</dl>" +
      (me && me.source === "local"
        ? '<p class="warn">' + t("目前只連到這部電腦。改密碼只影響本機。", "You are on this device only. A password change stays local.") + "</p>"
        : "") +
      '<form class="card" id="tp-pass" style="margin-top:16px">' +
        "<h3>" + t("更改密碼", "Change password") + "</h3>" +
        "<label>" + t("舊密碼", "Current password") + '<input id="tp-old" type="password" autocomplete="current-password"></label>' +
        "<label>" + t("新密碼（至少 4 位）", "New password (at least 4 characters)") + '<input id="tp-new" type="password" autocomplete="new-password"></label>' +
        "<label>" + t("確認新密碼", "Confirm new password") + '<input id="tp-new2" type="password" autocomplete="new-password"></label>' +
        '<button type="submit" class="btn primary">' + t("儲存新密碼", "Save new password") + "</button>" +
        '<p id="tp-err" hidden></p>' +
      "</form>";
    $("tp-pass").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("tp-err");
      const result = await changeTeacherPassword($("tp-old").value, $("tp-new").value, $("tp-new2").value);
      if (!result.ok) {
        err.hidden = false;
        err.style.color = "var(--danger)";
        err.textContent = authErrorText(result.error);
        return;
      }
      $("tp-old").value = "";
      $("tp-new").value = "";
      $("tp-new2").value = "";
      err.hidden = false;
      err.style.color = "var(--success)";
      err.textContent = t("密碼已更新。", "Password updated.");
    };
  }

  function authErrorText(code) {
    if (code === "stno") return t("請輸入有效學號（例：4101 或 4A01）。", "Enter a valid class no. (e.g. 4101 or 4A01).");
    if (code === "password") return t("密碼至少 4 個字元。", "Password must be at least 4 characters.");
    if (code === "exists") return t("此學號已有帳戶，請直接登入。", "This class no. already has an account. Please sign in.");
    if (code === "auth") return t("學號或密碼不正確。", "Class no. or password is incorrect.");
    if (code === "old") return t("舊密碼不正確。", "Current password is incorrect.");
    if (code === "confirm") return t("兩次輸入的密碼不一致。", "The two passwords do not match.");
    if (code === "subjects") return t("請至少選一個科目：BAFS(CHIN)、BAFS(ENG)、ECON(CHIN)、ECON(ENG)、商業基礎 BF。", "Choose at least one subject: BAFS(CHIN), BAFS(ENG), ECON(CHIN), ECON(ENG), Business Fundamentals.");
    if (code === "missing") return t("找不到這個帳戶。", "This account was not found.");
    return t("未能完成。請再試。", "Could not complete. Please try again.");
  }

  async function localRegister(stno, password, name, subjects) {
    const list = loadLocalAccounts();
    if (list.some((a) => a.stno === stno)) return { ok: false, error: "exists" };
    const picked = normalizeSubjects(subjects);
    if (!picked.length) return { ok: false, error: "subjects" };
    const hashed = await hashPassword(password);
    list.push({ stno, name: name || "", subjects: picked, salt: hashed.salt, hash: hashed.hash, createdAt: new Date().toISOString() });
    saveLocalAccounts(list);
    enterStudent({ token: "local-" + uid(), stno, name: name || "", subjects: picked, mode: "local" });
    return { ok: true, local: true };
  }

  async function localLogin(stno, password) {
    const acc = loadLocalAccounts().find((a) => a.stno === stno);
    if (!acc) return { ok: false, error: "auth" };
    const hashed = await hashPassword(password, acc.salt);
    if (!timingEqual(hashed.hash, acc.hash)) return { ok: false, error: "auth" };
    enterStudent({ token: "local-" + uid(), stno, name: acc.name || "", subjects: acc.subjects, mode: "local" });
    return { ok: true, local: true };
  }

  async function localChangePassword(oldPassword, newPassword) {
    const me = getSession();
    if (!me) return { ok: false, error: "auth" };
    const list = loadLocalAccounts();
    const acc = list.find((a) => a.stno === me.stno);
    if (!acc) return { ok: false, error: "old" };
    const check = await hashPassword(oldPassword, acc.salt);
    if (!timingEqual(check.hash, acc.hash)) return { ok: false, error: "old" };
    const next = await hashPassword(newPassword);
    acc.salt = next.salt;
    acc.hash = next.hash;
    saveLocalAccounts(list);
    return { ok: true };
  }

  async function registerStudent(stnoRaw, password, password2, name, subjects) {
    const stno = normalizeStno(stnoRaw);
    if (!stno) return { ok: false, error: "stno" };
    if (String(password || "").length < 4) return { ok: false, error: "password" };
    if (password !== password2) return { ok: false, error: "confirm" };
    const picked = normalizeSubjects(subjects);
    if (!picked.length) return { ok: false, error: "subjects" };
    try {
      const remote = await apiPublic({ op: "register", stno, password, name: name || "", subjects: picked });
      if (remote && remote.ok && remote.token) {
        enterStudent(remote);
        return { ok: true, cloud: remote.mode !== "local" };
      }
      if (remote && remote.error === "exists") return { ok: false, error: "exists" };
      if (remote && (remote.error === "stno" || remote.error === "password" || remote.error === "subjects")) return { ok: false, error: remote.error };
      if (remote && remote.mode === "local") return localRegister(stno, password, name, picked);
    } catch {}
    return localRegister(stno, password, name, picked);
  }

  async function loginStudent(stnoRaw, password) {
    const stno = normalizeStno(stnoRaw);
    if (!stno) return { ok: false, error: "stno" };
    if (!password) return { ok: false, error: "auth" };
    try {
      const remote = await apiPublic({ op: "login", stno, password });
      if (remote && remote.ok && remote.token) {
        enterStudent(remote);
        return { ok: true, cloud: remote.mode !== "local" };
      }
      if (remote && remote.error === "auth") {
        const local = await localLogin(stno, password);
        return local.ok ? { ok: true, local: true } : { ok: false, error: "auth" };
      }
      if (remote && remote.error === "stno") return { ok: false, error: "stno" };
      if (remote && remote.mode === "local") return localLogin(stno, password);
    } catch {}
    return localLogin(stno, password);
  }

  async function changeStudentPassword(oldPassword, newPassword, newPassword2) {
    if (String(newPassword || "").length < 4) return { ok: false, error: "password" };
    if (newPassword !== newPassword2) return { ok: false, error: "confirm" };
    const me = getSession();
    if (!me || me.source === "local") return localChangePassword(oldPassword, newPassword);
    try {
      const remote = await api({ op: "changePassword", oldPassword, newPassword });
      if (remote && remote.ok) {
        if (remote.token) enterStudent(remote);
        return { ok: true };
      }
      if (remote && (remote.error === "old" || remote.error === "password")) return { ok: false, error: remote.error };
      if (remote && remote.mode === "local") return localChangePassword(oldPassword, newPassword);
    } catch {}
    return localChangePassword(oldPassword, newPassword);
  }

  function renderProfile() {
    const box = $("app-student");
    const me = getSession();
    if (!me) {
      renderGate();
      return;
    }
    const p = parseStno(me.stno);
    box.innerHTML =
      "<h2>" + t("個人資料", "Profile") + "</h2>" +
      '<dl class="profile-dl">' +
        "<dt>" + t("帳戶名", "Account") + "</dt><dd>" + escapeHtml(me.stno) + "</dd>" +
        "<dt>" + t("學號", "Class no.") + "</dt><dd>" + escapeHtml(stnoLabel(me.stno)) + (p ? "" : "") + "</dd>" +
        "<dt>" + t("年級", "Form") + "</dt><dd>" + escapeHtml(formLabel(formOfStno(me.stno))) + "</dd>" +
        (me.name ? "<dt>" + t("姓名", "Name") + "</dt><dd>" + escapeHtml(me.name) + "</dd>" : "") +
        "<dt>" + t("科目", "Subjects") + "</dt><dd>" + escapeHtml(subjectsLabel(me.subjects)) +
          "<div class='hint'>" + t("註冊時選定，不能自行更改。若選錯請老師在學生頁改正。", "Chosen at sign-up and cannot be changed here. Ask the teacher to correct it on the Students page.") + "</div></dd>" +
      "</dl>" +
      (me.source === "local"
        ? '<p class="warn">' + t("此帳戶目前只存在這部電腦。到學校網站請再建立一次，才能在其他裝置登入。", "This account exists only on this device. Create it again on the school site to sign in elsewhere.") + "</p>"
        : "") +
      '<form class="card" id="pf-pass" style="margin-top:16px">' +
        "<h3>" + t("更改密碼", "Change password") + "</h3>" +
        "<label>" + t("舊密碼", "Current password") + '<input id="pf-old" type="password" autocomplete="current-password"></label>' +
        "<label>" + t("新密碼（至少 4 位）", "New password (at least 4 characters)") + '<input id="pf-new" type="password" autocomplete="new-password"></label>' +
        "<label>" + t("確認新密碼", "Confirm new password") + '<input id="pf-new2" type="password" autocomplete="new-password"></label>' +
        '<button type="submit" class="btn primary">' + t("儲存新密碼", "Save new password") + "</button>" +
        '<p id="pf-err" hidden></p>' +
      "</form>" +
      '<p style="margin-top:16px"><button type="button" class="btn" id="pf-back">' + t("返回作業", "Back to assignments") + "</button></p>";
    $("pf-back").onclick = () => {
      studentView = "home";
      renderApp();
    };
    $("pf-pass").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("pf-err");
      const result = await changeStudentPassword($("pf-old").value, $("pf-new").value, $("pf-new2").value);
      if (!result.ok) {
        err.hidden = false;
        err.style.color = "var(--danger)";
        err.textContent = authErrorText(result.error);
        return;
      }
      $("pf-old").value = "";
      $("pf-new").value = "";
      $("pf-new2").value = "";
      err.hidden = false;
      err.style.color = "var(--success)";
      err.textContent = t("密碼已更新。", "Password updated.");
    };
  }

  async function onStuLogin(e) {
    e.preventDefault();
    gateError("");
    const result = await loginStudent($("login-stno").value, $("login-pass").value);
    if (!result.ok) {
      gateError(authErrorText(result.error));
      return false;
    }
    if (result.local) status(t("此帳戶只存在這部電腦。", "This account exists only on this device."), true);
    else status("");
    studentView = "home";
    bootApp();
    return false;
  }

  async function onStuRegister(e) {
    e.preventDefault();
    gateError("");
    const result = await registerStudent($("reg-stno").value, $("reg-pass").value, $("reg-pass2").value, $("reg-name").value.trim(), readSubjectPicks("reg"));
    if (!result.ok) {
      gateError(authErrorText(result.error));
      return false;
    }
    if (result.local) status(t("帳戶已建立，但只存在這部電腦。到學校網站請再建立一次。", "Account created on this device only. Create it again on the school site."), true);
    else status(t("帳戶已建立。", "Account created."));
    studentView = "home";
    bootApp();
    return false;
  }

  async function onTeacherLogin(e) {
    e.preventDefault();
    gateError("");
    const result = await loginTeacher($("tch-user") && $("tch-user").value, $("tch-pass") && $("tch-pass").value);
    if (!result.ok) {
      gateError(t("帳戶或密碼不正確。", "Account or password is incorrect."));
      if ($("tch-pass")) $("tch-pass").select();
      return false;
    }
    if (result.local) status(t("未能連上雲端，老師頁只存在這部電腦。", "Cloud unavailable; the teacher page is on this device only."), true);
    else status("");
    bootApp();
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
    if ($("gate-tab-stu")) $("gate-tab-stu").onclick = () => { showGatePane("student"); showStuForm("login"); };
    if ($("gate-tab-tch")) $("gate-tab-tch").onclick = () => { showGatePane("teacher"); };
    if ($("link-stu-register")) $("link-stu-register").onclick = () => showStuForm("register");
    if ($("link-stu-login")) $("link-stu-login").onclick = () => showStuForm("login");
    if ($("stu-login")) $("stu-login").onsubmit = onStuLogin;
    if ($("stu-register")) $("stu-register").onsubmit = onStuRegister;
    if ($("gate-tch")) $("gate-tch").onsubmit = onTeacherLogin;
    if ($("btn-profile")) {
      $("btn-profile").onclick = () => {
        if (getRole() === "teacher") {
          teacherTab = "profile";
          renderApp();
          return;
        }
        studentView = "profile";
        renderApp();
      };
    }
    $("btn-logout").onclick = () => {
      clearSession();
      clearRole();
      studentView = "home";
      if ($("tch-user")) $("tch-user").value = "";
      if ($("tch-pass")) $("tch-pass").value = "";
      if ($("login-pass")) $("login-pass").value = "";
      status("");
      renderGate();
    };
    if (!cloudWatchBound) {
      cloudWatchBound = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && getRole() === "student") refreshCloud({ silent: true });
      });
    }
    setLang(q === "en");
    if (getRole()) bootApp();
    else renderGate();
  }

  async function testCloudOriginals(times) {
    const n = Math.max(1, Math.min(8, Number(times) || 5));
    const asg = selectedAssignment("t-asg") || selectedAssignment("s-asg") || (state.assignments || [])[0];
    const me = getSession();
    const stno = (me && me.stno) || "4101";
    const results = [];
    if (!asg || !me || !me.token) {
      return { pass: false, error: "login", results };
    }
    for (let i = 0; i < n; i++) {
      const canvas = rasterizeSheet({
        kind: "mc",
        n: 12,
        subject: "ECON-CHI",
        title: "PNG-TEST",
        schoolName: "HTMS"
      }, { stno: stno, hwCode: "H03", answers: ["A", "B", "C", "D", "A", "A", "B", "C", "D", "B", "C", "A"] });
      const png = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
      });
      const file = new File([png], "teacher-open-" + (i + 1) + ".png", { type: "image/png" });
      const rec = {
        id: uid(),
        assignmentId: asg.id,
        stno,
        fileName: file.name,
        mime: "image/png",
        source: getRole() === "student" ? "student-upload" : "teacher-scan",
        kind: "mc",
        at: new Date().toISOString()
      };
      await persistSubmissionFile(rec, file);
      upsertFileMeta(state, rec);
      try { await idbPut("file:" + rec.id, new Blob(["x"])); } catch {}
      try {
        state = await pullRemote(state);
      } catch {}
      const href = lookupFileHref(rec);
      let reachable = false;
      try {
        const blob = await openCloudFile(rec.id);
        reachable = !!(blob && blob.size > 20);
      } catch {
        reachable = false;
      }
      results.push({
        n: i + 1,
        file: file.name,
        bytes: file.size,
        href: href || "",
        error: rec.fileError || "",
        ok: !!(href && reachable)
      });
    }
    saveState(state);
    return { pass: results.every((r) => r.ok), results };
  }

  window.MCGrader = { start, selfTest, testCloudOriginals, readSheet, renderSheet, parseStno, parseHwCode, normalizeStno, rasterizeSheet, runReviewSim };
})();
