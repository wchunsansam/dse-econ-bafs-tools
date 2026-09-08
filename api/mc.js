const crypto = require("crypto");

const BLOB_PATH = "mc-grader/state.json";
const SESSION_MS = 180 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERS = 120000;
const FILE_MAX = 15 * 1024 * 1024;
const FILE_POST_MAX = 2800000;
const FILE_PART_MAX = 12;
const DEFAULT_TEACHER = "chunsansamwong";
const TEACHER_SEEDS = [
  { user: "chunsansamwong", password: "0312", name: "Sam Wong" },
  { user: "irene", password: "1234", name: "Irene" },
  { user: "lily", password: "1234", name: "Lily" },
  { user: "kristy", password: "1234", name: "Kristy" }
];
const SUBJECT_IDS = ["BAFS-CHI", "BAFS-ENG", "ECON-CHI", "ECON-ENG", "BF"];

function emptyState() {
  return {
    schoolName: "HTMS",
    assignments: [],
    mcSubmissions: [],
    pdfSubmissions: [],
    writtenScores: [],
    files: [],
    accounts: [],
    teachers: [],
    sessions: []
  };
}

function normalizeStore(raw) {
  const state = { ...emptyState(), ...(raw || {}) };
  state.accounts = Array.isArray(raw && raw.accounts) ? raw.accounts : [];
  state.sessions = Array.isArray(raw && raw.sessions) ? raw.sessions : [];
  state.writtenScores = Array.isArray(raw && raw.writtenScores) ? raw.writtenScores : [];
  state.files = Array.isArray(raw && raw.files) ? raw.files : [];
  state.teachers = Array.isArray(raw && raw.teachers) ? raw.teachers : [];
  ensureTeachers(state);
  return state;
}

function normalizeStno(raw) {
  const s = String(raw || "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (/^\d{4}$/.test(s)) return s;
  const m = /^([1-6])([A-I])(\d{2})$/.exec(s);
  if (m) return m[1] + String(m[2].charCodeAt(0) - 64) + m[3];
  return null;
}

function hashPass(password, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), s, PBKDF2_ITERS, 32, "sha256").toString("hex");
  return { salt: s, hash };
}

function verifyPass(password, salt, hash) {
  try {
    const next = crypto.pbkdf2Sync(String(password), String(salt), PBKDF2_ITERS, 32, "sha256");
    const prev = Buffer.from(String(hash), "hex");
    if (next.length !== prev.length) return false;
    return crypto.timingSafeEqual(next, prev);
  } catch {
    return false;
  }
}

function pruneSessions(state) {
  const now = Date.now();
  state.sessions = (state.sessions || []).filter((s) => s && s.token && s.exp > now);
}

function findSession(state, token) {
  if (!token) return null;
  pruneSessions(state);
  return (state.sessions || []).find((s) => s.token === token) || null;
}

function findAccount(state, stno) {
  return (state.accounts || []).find((a) => a && a.stno === stno) || null;
}

function normalizeUser(raw) {
  return String(raw || "").trim().toLowerCase();
}

function teacherUser(session) {
  return normalizeUser(session && (session.account || session.stno));
}

function assignmentOwner(a) {
  return normalizeUser((a && a.createdBy) || DEFAULT_TEACHER);
}

function findTeacher(state, user) {
  const u = normalizeUser(user);
  return (state.teachers || []).find((t) => t && normalizeUser(t.user) === u) || null;
}

function ensureTeachers(state) {
  if (!Array.isArray(state.teachers)) state.teachers = [];
  TEACHER_SEEDS.forEach((seed) => {
    if (findTeacher(state, seed.user)) return;
    const hashed = hashPass(seed.password);
    state.teachers.push({
      user: seed.user,
      name: seed.name,
      salt: hashed.salt,
      hash: hashed.hash,
      createdAt: new Date().toISOString()
    });
  });
}

function normalizeSubjectId(raw) {
  let s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  s = s.replace(/[()]/g, "").replace(/_+/g, "-");
  if (s === "ECONOMICS") s = "ECON";
  if (s === "ECON" || s === "BAFS") return s;
  const aliases = {
    "ECON-CHI": "ECON-CHI",
    "ECONCHI": "ECON-CHI",
    "ECON-CHIN": "ECON-CHI",
    "ECONCHIN": "ECON-CHI",
    "ECON-CHINESE": "ECON-CHI",
    "ECON-ENG": "ECON-ENG",
    "ECONENG": "ECON-ENG",
    "ECON-ENGLISH": "ECON-ENG",
    "BAFS-CHI": "BAFS-CHI",
    "BAFSCHI": "BAFS-CHI",
    "BAFS-CHIN": "BAFS-CHI",
    "BAFSCHIN": "BAFS-CHI",
    "BAFS-CHINESE": "BAFS-CHI",
    "BAFS-ENG": "BAFS-ENG",
    "BAFSENG": "BAFS-ENG",
    "BAFS-ENGLISH": "BAFS-ENG",
    "BF": "BF",
    "BUS-FUND": "BF",
    "BUSFUND": "BF",
    "BUSINESS-FUNDAMENTALS": "BF",
    "BUSINESSFUNDAMENTALS": "BF",
    "BUSINESSFUND": "BF"
  };
  if (aliases[s]) return aliases[s];
  return SUBJECT_IDS.indexOf(s) >= 0 ? s : "";
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

function subjectMatches(asgSubj, studentSubs) {
  const asg = normalizeSubjectId(asgSubj) || "ECON";
  const mine = normalizeSubjects(studentSubs);
  if (!mine.length) return true;
  if (mine.indexOf(asg) >= 0) return true;
  const econ = asg === "ECON" || asg === "ECON-CHI" || asg === "ECON-ENG";
  const bafs = asg === "BAFS" || asg === "BAFS-CHI" || asg === "BAFS-ENG";
  if (econ && mine.some((m) => m === "ECON" || m === "ECON-CHI" || m === "ECON-ENG")) {
    if (asg === "ECON" || mine.indexOf("ECON") >= 0) return true;
  }
  if (bafs && mine.some((m) => m === "BAFS" || m === "BAFS-CHI" || m === "BAFS-ENG")) {
    if (asg === "BAFS" || mine.indexOf("BAFS") >= 0) return true;
  }
  return false;
}

function formOfStno(stno) {
  const s = String(stno || "");
  return /^[1-6]/.test(s) ? s[0] : "";
}

function normalizeForm(raw) {
  const s = String(raw || "").trim();
  return /^[1-6]$/.test(s) ? s : "";
}

function clampText(v, n) {
  return String(v == null ? "" : v).trim().slice(0, n);
}

function numOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeWorkType(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return "";
  if (s === "H" || s === "HW" || s === "HOMEWORK") return "H";
  if (s === "C" || s === "CW" || s === "CLASSWORK" || s === "CLASS") return "C";
  if (s === "U" || s === "UT" || s === "TEST" || s === "UNIFORM") return "U";
  return "";
}

function clampWorkNo(raw) {
  if (raw === "" || raw == null) return null;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : null;
}

function sanitizeHasMc(raw, prev) {
  if (raw && Object.prototype.hasOwnProperty.call(raw, "hasMc")) return !!raw.hasMc;
  if (prev && Object.prototype.hasOwnProperty.call(prev, "hasMc")) return !!prev.hasMc;
  return true;
}

function accountPublic(a) {
  if (!a || !a.stno) return null;
  return {
    stno: a.stno,
    name: a.name || "",
    subjects: normalizeSubjects(a.subjects),
    createdAt: a.createdAt || ""
  };
}

function teacherPublic(t) {
  if (!t || !t.user) return null;
  return { user: t.user, name: t.name || t.user };
}

function studentMayAccess(asg, acc) {
  if (!asg || !acc) return false;
  const form = normalizeForm(asg.form);
  const sf = formOfStno(acc.stno);
  if (form && sf && form !== sf) return false;
  return subjectMatches(asg.subject, acc.subjects);
}

function makeSession(state, stno, name, role) {
  pruneSessions(state);
  const nextRole = role === "teacher" ? "teacher" : "student";
  const user = normalizeUser(stno);
  state.sessions = (state.sessions || []).filter((s) => {
    if (nextRole === "teacher") {
      return !(s.role === "teacher" && teacherUser(s) === user);
    }
    return s.stno !== stno;
  });
  const sess = {
    token: crypto.randomBytes(24).toString("hex"),
    stno: nextRole === "teacher" ? "" : stno,
    account: nextRole === "teacher" ? user : "",
    name: name || "",
    role: nextRole,
    exp: Date.now() + SESSION_MS
  };
  state.sessions.push(sess);
  return sess;
}

function sessionRole(session) {
  if (!session) return null;
  return session.role === "teacher" ? "teacher" : "student";
}

function markAt(asg, qi) {
  if (!asg) return 1;
  const custom = Array.isArray(asg.mcMarks) ? Number(asg.mcMarks[qi]) : NaN;
  if (Number.isFinite(custom) && custom >= 0) return custom;
  const each = Number(asg.mcMarkEach);
  return Number.isFinite(each) && each > 0 ? each : 1;
}

function stripAssignment(a) {
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
    workType: normalizeWorkType(a.workType) || "",
    workNo: clampWorkNo(a.workNo),
    writtenMax: a.writtenMax,
    writtenN: a.writtenN,
    writtenEach: a.writtenEach,
    writtenSource: a.writtenSource || "",
    mcSource: a.mcSource || "",
    answersPublished: !!a.answersPublished,
    scriptsReturned: !!a.scriptsReturned,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
  if (a.answersPublished) {
    out.key = Array.isArray(a.key) ? a.key : [];
    out.mcMarks = Array.isArray(a.mcMarks) ? a.mcMarks : [];
    out.mcMarkEach = a.mcMarkEach;
  }
  return out;
}

function filePublic(f) {
  if (!f || !f.id) return null;
  const href = f.url || f.fileUrl || "";
  return {
    id: f.id,
    assignmentId: f.assignmentId,
    stno: f.stno,
    fileName: f.fileName || "",
    mime: f.mime || "",
    url: href,
    fileUrl: href,
    kind: f.kind || "",
    source: f.source || "",
    at: f.at || ""
  };
}

function publicState(state, role, session) {
  if (role === "teacher") {
    return {
      schoolName: state.schoolName,
      assignments: state.assignments || [],
      mcSubmissions: state.mcSubmissions || [],
      pdfSubmissions: state.pdfSubmissions || [],
      writtenScores: state.writtenScores || [],
      files: (state.files || []).map(filePublic).filter(Boolean),
      accounts: (state.accounts || []).map(accountPublic).filter(Boolean),
      teacher: teacherPublic(findTeacher(state, teacherUser(session)))
    };
  }
  const acc = role === "student" && session && session.stno ? findAccount(state, session.stno) : null;
  const list = (state.assignments || []).filter((a) => acc && studentMayAccess(a, acc));
  const published = new Set(list.filter((a) => a.answersPublished).map((a) => a.id));
  const returned = new Set(list.filter((a) => a.scriptsReturned).map((a) => a.id));
  const stno = acc ? acc.stno : "";
  return {
    schoolName: state.schoolName,
    assignments: list.map(stripAssignment),
    mcSubmissions: (state.mcSubmissions || []).filter((s) => s && s.stno === stno && published.has(s.assignmentId)),
    pdfSubmissions: (state.pdfSubmissions || []).filter((s) => s && s.stno === stno && returned.has(s.assignmentId) && s.source === "teacher-scan"),
    writtenScores: [],
    files: (state.files || []).map(filePublic).filter((f) => {
      if (!f || f.stno !== stno) return false;
      if (f.source === "student-upload") return true;
      return returned.has(f.assignmentId) && f.source === "teacher-scan";
    }),
    account: acc ? accountPublic(acc) : null
  };
}

function upsertById(list, item) {
  const next = Array.isArray(list) ? list.slice() : [];
  if (!item || !item.id) {
    next.push(item);
    return next;
  }
  const i = next.findIndex((s) => s.id === item.id);
  if (i >= 0) next[i] = { ...next[i], ...item, id: next[i].id };
  else next.push(item);
  return next;
}

function sanitizeAssignment(raw, owner, prev) {
  const n = Math.max(1, Math.min(60, Math.round(numOr(raw && raw.n, 40))));
  const writtenN = Math.max(0, Math.min(5, Math.round(numOr(raw && raw.writtenN, prev && prev.writtenN || 0))));
  const marks = Array.isArray(raw && raw.mcMarks) ? raw.mcMarks.slice(0, 60).map((v) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : 1;
  }) : (prev && prev.mcMarks) || [];
  const wMarks = Array.isArray(raw && raw.writtenMarks) ? raw.writtenMarks.slice(0, 5).map((v) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  }) : (prev && prev.writtenMarks) || [];
  return {
    id: String((raw && raw.id) || (prev && prev.id) || ""),
    title: clampText(raw && raw.title, 120) || (prev && prev.title) || "",
    subject: normalizeSubjectId(raw && raw.subject) || (prev && prev.subject) || "ECON-CHI",
    form: normalizeForm(raw && raw.form) || (prev && prev.form) || "",
    n,
    key: Array.isArray(raw && raw.key) ? raw.key.slice(0, 60) : (prev && prev.key) || [],
    open: raw && raw.open === false ? false : true,
    paperOnly: !!(raw && raw.paperOnly),
    hasMc: sanitizeHasMc(raw, prev),
    hasWritten: !!(raw && raw.hasWritten),
    workType: Object.prototype.hasOwnProperty.call(raw || {}, "workType")
      ? normalizeWorkType(raw.workType)
      : normalizeWorkType(prev && prev.workType),
    workNo: Object.prototype.hasOwnProperty.call(raw || {}, "workNo")
      ? clampWorkNo(raw.workNo)
      : clampWorkNo(prev && prev.workNo),
    writtenMax: Math.max(1, Math.min(100, numOr(raw && raw.writtenMax, (prev && prev.writtenMax) || 100))),
    writtenN: raw && raw.hasWritten ? Math.max(1, writtenN || 1) : writtenN,
    writtenEach: Math.max(0, Math.min(100, numOr(raw && raw.writtenEach, (prev && prev.writtenEach) || 0))),
    writtenMarks: wMarks,
    writtenSource: clampText(raw && raw.writtenSource, 120),
    mcSource: clampText(raw && raw.mcSource, 120),
    mcMarkEach: Math.max(0, numOr(raw && raw.mcMarkEach, (prev && prev.mcMarkEach) || 1)),
    mcMarks: marks,
    answersPublished: !!(raw && raw.answersPublished),
    scriptsReturned: !!(raw && raw.scriptsReturned),
    createdBy: owner,
    createdAt: (prev && prev.createdAt) || (raw && raw.createdAt) || new Date().toISOString(),
    updatedAt: (raw && raw.updatedAt) || new Date().toISOString()
  };
}

async function loadState() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false, mode: "local", state: emptyState() };
  try {
    const { list } = await import("@vercel/blob");
    const listed = await list({ prefix: BLOB_PATH, token });
    const hit = (listed.blobs || []).find((b) => b.pathname === BLOB_PATH) || (listed.blobs || [])[0];
    if (!hit) return { ok: true, mode: "blob", state: emptyState() };
    const sep = hit.url.indexOf("?") >= 0 ? "&" : "?";
    const res = await fetch(hit.url + sep + "cache=0", {
      headers: { authorization: "Bearer " + token },
      cache: "no-store"
    });
    if (!res.ok) return { ok: true, mode: "blob", state: emptyState() };
    const json = await res.json();
    return { ok: true, mode: "blob", state: normalizeStore(json) };
  } catch {
    return { ok: false, mode: "local", state: emptyState() };
  }
}

async function saveState(state) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false, mode: "local" };
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(state), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json"
  });
  return { ok: true, mode: "blob" };
}

async function putFileBlob(assignmentId, id, buf, mime) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return "";
  try {
    const { put } = await import("@vercel/blob");
    const pathname = "mc-grader/files/" + String(assignmentId) + "/" + String(id);
    const body = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    const base = {
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mime || "application/octet-stream"
    };
    const modes = ["private", "public"];
    for (let i = 0; i < modes.length; i++) {
      try {
        const out = await put(pathname, body, { ...base, access: modes[i] });
        if (out && out.url) return out.url;
      } catch {}
    }
    return "";
  } catch {
    return "";
  }
}

function send(res, code, body) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(code).json(body);
}

function authReply(res, state, stno, name, mode, role, subjects) {
  const sess = makeSession(state, stno, name, role);
  return {
    token: sess.token,
    stno: sess.stno || stno,
    account: sess.account || "",
    name: name || "",
    role: sess.role,
    subjects: normalizeSubjects(subjects),
    mode
  };
}

const WRITE_OPS = [
  "submitMcBatch", "upsertAssignment", "submitPdfBatch", "saveWrittenScores",
  "saveMeta", "deleteAssignment", "changePassword", "changeTeacherPassword",
  "updateStudent", "deleteStudent", "uploadFile", "uploadFilePart", "uploadFileFinish",
  "blobToken", "registerFile"
];

function rememberSubmissionFile(state, role, s, kind) {
  const href = clampText(s && (s.fileUrl || s.url), 800);
  if (!s || !href || !s.assignmentId || !s.stno) return;
  const id = clampText(s.fileId || s.id, 80);
  if (!id) return;
  state.files = upsertById(state.files || [], fileRecordFromUpload(role, {
    fileName: s.fileName,
    kind: kind || s.kind,
    source: s.source
  }, id, s.assignmentId, String(s.stno).slice(0, 8), clampText(s.mime, 80), href));
}

function uploadFileGuard(role, studentStno, account, state, body) {
  const id = clampText(body.id, 80);
  const assignmentId = clampText(body.assignmentId, 80);
  const stno = role === "student" ? studentStno : normalizeStno(body.stno) || clampText(body.stno, 8);
  if (!id || !assignmentId || !stno) return { error: "op" };
  if (role === "student") {
    const asg = state.assignments.find((x) => x.id === assignmentId);
    if (!asg || asg.open === false || asg.paperOnly) return { error: "op" };
    if (account && !studentMayAccess(asg, account)) return { error: "op" };
  }
  return { id, assignmentId, stno };
}

function decodeBase64File(raw, max) {
  let buf;
  try {
    buf = Buffer.from(String(raw || "").replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }
  if (!buf.length || buf.length > max) return null;
  return buf;
}

function fileRecordFromUpload(role, body, id, assignmentId, stno, mime, url) {
  return {
    id,
    assignmentId,
    stno,
    fileName: clampText(body.fileName, 120),
    mime,
    url,
    fileUrl: url,
    kind: clampText(body.kind, 20),
    source: role === "student" ? "student-upload" : clampText(body.source, 40) || "teacher-scan",
    at: new Date().toISOString()
  };
}

function findStoredFile(state, id) {
  if (!id) return null;
  const pools = [state.files, state.mcSubmissions, state.pdfSubmissions];
  for (let i = 0; i < pools.length; i++) {
    const hit = (pools[i] || []).find((f) => f && f.id === id);
    if (hit) return hit;
  }
  return null;
}

function studentMayReadFile(state, rec, stno) {
  if (!rec || !stno || String(rec.stno) !== String(stno)) return false;
  if (rec.source === "student-upload") return true;
  const asg = (state.assignments || []).find((a) => a && a.id === rec.assignmentId);
  return !!(asg && asg.scriptsReturned && rec.source === "teacher-scan");
}

async function fetchBlobBytes(url) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: token ? { authorization: "Bearer " + token } : {},
      cache: "no-store"
    });
    if (!res.ok) return null;
    return {
      buf: Buffer.from(await res.arrayBuffer()),
      type: res.headers.get("content-type") || ""
    };
  } catch {
    return null;
  }
}

function partUrlAllowed(url, assignmentId, id, index) {
  try {
    const u = new URL(String(url || ""));
    const host = String(u.hostname || "");
    if (host.indexOf("vercel-storage.com") < 0 && host.indexOf("blob.vercel-storage.com") < 0) return false;
    const path = decodeURIComponent(u.pathname || "");
    const part = String(id) + ".p" + index;
    return path.indexOf(part) >= 0 && path.indexOf(String(assignmentId)) >= 0;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-headers", "content-type, x-mc-pass, x-mc-session");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  const body = req.method === "POST" ? (req.body || {}) : {};
  const op = body.op;
  const isAuthOp = req.method === "POST" && (op === "register" || op === "login" || op === "teacherLogin");

  const loaded = await loadState();

  if (isAuthOp) {
    if (!loaded.ok) return send(res, 200, { ok: false, mode: "local", error: "local" });
    const state = loaded.state || emptyState();
    ensureTeachers(state);
    if (op === "teacherLogin") {
      const user = normalizeUser(body.account);
      const password = String(body.password || "");
      const rec = findTeacher(state, user);
      if (!rec || !verifyPass(password, rec.salt, rec.hash)) {
        return send(res, 200, { ok: false, error: "auth" });
      }
      const reply = authReply(res, state, rec.user, rec.name || rec.user, "blob", "teacher");
      const saved = await saveState(state);
      return send(res, 200, { ok: true, role: "teacher", account: rec.user, name: rec.name || rec.user, token: reply.token, mode: saved.mode || "blob" });
    }
    const stno = normalizeStno(body.stno);
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 80);
    if (!stno) return send(res, 200, { ok: false, error: "stno" });
    if (password.length < 4 || password.length > 80) return send(res, 200, { ok: false, error: "password" });

    if (op === "register") {
      if (findAccount(state, stno)) return send(res, 200, { ok: false, error: "exists" });
      const subjects = normalizeSubjects(body.subjects);
      if (!subjects.length) return send(res, 200, { ok: false, error: "subjects" });
      const hashed = hashPass(password);
      state.accounts.push({
        stno,
        name,
        subjects,
        salt: hashed.salt,
        hash: hashed.hash,
        createdAt: new Date().toISOString()
      });
      const reply = authReply(res, state, stno, name, "blob", "student", subjects);
      const saved = await saveState(state);
      return send(res, 200, { ok: true, ...reply, mode: saved.mode || "blob" });
    }

    const acc = findAccount(state, stno);
    if (!acc || !verifyPass(password, acc.salt, acc.hash)) {
      return send(res, 200, { ok: false, error: "auth" });
    }
    const reply = authReply(res, state, acc.stno, acc.name, "blob", "student", acc.subjects);
    const saved = await saveState(state);
    return send(res, 200, { ok: true, ...reply, mode: saved.mode || "blob" });
  }

  const session = findSession(loaded.state || emptyState(), String(req.headers["x-mc-session"] || ""));
  const role = sessionRole(session);
  if (!role) return send(res, 401, { ok: false, error: "auth" });
  const studentStno = role === "student" && session ? session.stno : null;
  const account = studentStno ? findAccount(loaded.state || emptyState(), studentStno) : null;
  const tUser = role === "teacher" ? teacherUser(session) : "";

  if (req.method === "GET") {
    if (!loaded.ok) return send(res, 200, { ok: false, mode: "local" });
    return send(res, 200, { ok: true, mode: loaded.mode, state: publicState(loaded.state, role, session) });
  }

  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  let state = loaded.state || emptyState();
  ensureTeachers(state);

  if (!loaded.ok && WRITE_OPS.indexOf(op) >= 0) {
    return send(res, 200, { ok: false, mode: "local" });
  }

  if (op === "changePassword" && role === "student") {
    const acc = findAccount(state, studentStno);
    const oldPassword = String(body.oldPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!acc || !verifyPass(oldPassword, acc.salt, acc.hash)) {
      return send(res, 200, { ok: false, error: "old" });
    }
    if (newPassword.length < 4 || newPassword.length > 80) {
      return send(res, 200, { ok: false, error: "password" });
    }
    const hashed = hashPass(newPassword);
    acc.salt = hashed.salt;
    acc.hash = hashed.hash;
    const reply = authReply(res, state, acc.stno, acc.name, "blob", "student", acc.subjects);
    const saved = await saveState(state);
    return send(res, 200, { ok: true, mode: saved.mode || "blob", ...reply });
  }

  if (op === "changeTeacherPassword" && role === "teacher") {
    const rec = findTeacher(state, tUser);
    const oldPassword = String(body.oldPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!rec || !verifyPass(oldPassword, rec.salt, rec.hash)) {
      return send(res, 200, { ok: false, error: "old" });
    }
    if (newPassword.length < 4 || newPassword.length > 80) {
      return send(res, 200, { ok: false, error: "password" });
    }
    const hashed = hashPass(newPassword);
    rec.salt = hashed.salt;
    rec.hash = hashed.hash;
    const reply = authReply(res, state, rec.user, rec.name || rec.user, "blob", "teacher");
    const saved = await saveState(state);
    return send(res, 200, { ok: true, mode: saved.mode || "blob", ...reply, account: rec.user, name: rec.name || rec.user });
  }

  let extra = {};
  let skipSave = false;

  if (op === "saveMeta" && role === "teacher") {
    state.schoolName = String(body.schoolName || "HTMS").slice(0, 80);
  } else if (op === "upsertAssignment" && role === "teacher" && body.assignment) {
    const incoming = body.assignment;
    const i = state.assignments.findIndex((x) => x.id === incoming.id);
    const prev = i >= 0 ? state.assignments[i] : null;
    const owner = prev ? assignmentOwner(prev) : tUser;
    const next = sanitizeAssignment(incoming, owner, prev);
    if (!next.id) return send(res, 200, { ok: false, error: "op" });
    if (i >= 0) state.assignments[i] = next;
    else state.assignments.unshift(next);
  } else if (op === "deleteAssignment" && role === "teacher") {
    const asg = (state.assignments || []).find((x) => x.id === body.id);
    if (asg && assignmentOwner(asg) !== tUser) {
      return send(res, 200, { ok: false, error: "forbidden", mode: loaded.mode, state: publicState(state, role, session) });
    }
    const delId = body.id;
    state.assignments = (state.assignments || []).filter((x) => x.id !== delId);
    state.mcSubmissions = (state.mcSubmissions || []).filter((x) => !x || x.assignmentId !== delId);
    state.pdfSubmissions = (state.pdfSubmissions || []).filter((x) => !x || x.assignmentId !== delId);
    state.writtenScores = (state.writtenScores || []).filter((x) => !x || x.assignmentId !== delId);
    state.files = (state.files || []).filter((x) => !x || x.assignmentId !== delId);
  } else if (op === "submitMcBatch" && Array.isArray(body.submissions)) {
    if (role === "student") {
      const mismatch = body.submissions.find((s) => s && s.stno && String(s.stno) !== studentStno);
      if (mismatch) {
        return send(res, 200, { ok: false, error: "stno-mismatch", expected: studentStno, got: String(mismatch.stno) });
      }
      for (let si = 0; si < body.submissions.length; si++) {
        const gateSub = body.submissions[si];
        if (!gateSub || !gateSub.assignmentId) continue;
        const gateAsg = state.assignments.find((x) => x.id === gateSub.assignmentId);
        if (!gateAsg || gateAsg.open === false) return send(res, 200, { ok: false, error: "locked" });
        if (gateAsg.paperOnly) return send(res, 200, { ok: false, error: "paper-only" });
        if (account && !studentMayAccess(gateAsg, account)) return send(res, 200, { ok: false, error: "op" });
      }
      body.submissions.forEach((s) => {
        if (!s || !s.stno || !s.assignmentId) return;
        if (String(s.stno) !== studentStno) return;
        const copy = {
          id: s.id,
          assignmentId: s.assignmentId,
          stno: studentStno,
          hwCode: String(s.hwCode || "").slice(0, 4),
          name: String((account && account.name) || s.name || "").slice(0, 80),
          answers: Array.isArray(s.answers) ? s.answers.slice(0, 60) : [],
          flags: s.flags || [],
          source: s.source === "web" ? "web" : "student-upload",
          fileName: clampText(s.fileName, 120),
          fileUrl: clampText(s.fileUrl, 800),
          at: s.at || new Date().toISOString()
        };
        const asg = state.assignments.find((x) => x.id === copy.assignmentId);
        if (!asg || asg.open === false || asg.paperOnly) return;
        if (account && !studentMayAccess(asg, account)) return;
        if (asg && asg.key) {
          let score = 0, max = 0;
          asg.key.forEach((k, qi) => {
            if (!k || k === "-") return;
            const pts = markAt(asg, qi);
            max += pts;
            if (copy.answers[qi] === k) score += pts;
          });
          copy.score = score;
          copy.max = max;
        }
        state.mcSubmissions = upsertById(state.mcSubmissions, copy);
        rememberSubmissionFile(state, role, copy, "mc");
      });
    } else {
      body.submissions.forEach((s) => {
        state.mcSubmissions = upsertById(state.mcSubmissions, s);
        rememberSubmissionFile(state, role, s, "mc");
      });
    }
  } else if (op === "submitPdfBatch" && Array.isArray(body.submissions)) {
    if (role === "student") {
      const mismatch = body.submissions.find((s) => s && s.stno && String(s.stno) !== studentStno);
      if (mismatch) {
        return send(res, 200, { ok: false, error: "stno-mismatch", expected: studentStno, got: String(mismatch.stno) });
      }
    }
    body.submissions.forEach((s) => {
      if (!s || !s.stno) return;
      if (role === "student") {
        if (String(s.stno) !== studentStno) return;
        const asg = state.assignments.find((x) => x.id === s.assignmentId);
        if (!asg || asg.open === false || asg.paperOnly) return;
        if (account && !studentMayAccess(asg, account)) return;
      }
      const rec = {
        id: s.id,
        assignmentId: s.assignmentId,
        stno: role === "student" ? studentStno : String(s.stno).slice(0, 8),
        hwCode: String(s.hwCode || "").slice(0, 4),
        name: String((role === "student" && account && account.name) || s.name || "").slice(0, 80),
        fileName: String(s.fileName || "").slice(0, 120),
        fileUrl: clampText(s.fileUrl, 800),
        kind: "pdf",
        source: role === "student" ? "student-upload" : "teacher-scan",
        writtenItems: Array.isArray(s.writtenItems) ? s.writtenItems.slice(0, 5) : [],
        at: s.at || new Date().toISOString()
      };
      if (role === "teacher" && s.writtenScore != null && Number.isFinite(Number(s.writtenScore))) {
        rec.writtenScore = Math.max(0, Math.min(100, Number(s.writtenScore)));
      }
      state.pdfSubmissions = upsertById(state.pdfSubmissions, rec);
      rememberSubmissionFile(state, role, rec, "written");
    });
  } else if (op === "uploadFile" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    const buf = decodeBase64File(body.data, FILE_POST_MAX);
    if (!buf) return send(res, 200, { ok: false, error: "file" });
    const mime = clampText(body.mime, 80) || "application/octet-stream";
    const url = await putFileBlob(gate.assignmentId, gate.id, buf, mime);
    if (!url) return send(res, 200, { ok: false, mode: "local", error: "file" });
    state.files = upsertById(state.files || [], fileRecordFromUpload(role, body, gate.id, gate.assignmentId, gate.stno, mime, url));
    extra.url = url;
  } else if (op === "uploadFilePart" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    const index = Number(body.index);
    const total = Number(body.total);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total || total < 2 || total > FILE_PART_MAX) {
      return send(res, 200, { ok: false, error: "file" });
    }
    const buf = decodeBase64File(body.data, FILE_POST_MAX);
    if (!buf) return send(res, 200, { ok: false, error: "file" });
    const url = await putFileBlob(gate.assignmentId, gate.id + ".p" + index, buf, "application/octet-stream");
    if (!url) return send(res, 200, { ok: false, mode: "local", error: "file" });
    skipSave = true;
    extra.url = url;
    extra.index = index;
  } else if (op === "uploadFileFinish" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    const parts = Array.isArray(body.parts) ? body.parts : [];
    const total = Number(body.total);
    if (!Number.isInteger(total) || total < 2 || total > FILE_PART_MAX || parts.length !== total) {
      return send(res, 200, { ok: false, error: "file" });
    }
    const chunks = [];
    let size = 0;
    for (let i = 0; i < total; i++) {
      const partUrl = String(parts[i] || "");
      if (!partUrlAllowed(partUrl, gate.assignmentId, gate.id, i)) return send(res, 200, { ok: false, error: "file" });
      let partRes;
      try {
        partRes = await fetch(partUrl);
      } catch {
        return send(res, 200, { ok: false, error: "file" });
      }
      if (!partRes || !partRes.ok) return send(res, 200, { ok: false, error: "file" });
      const chunk = Buffer.from(await partRes.arrayBuffer());
      size += chunk.length;
      if (size > FILE_MAX) return send(res, 200, { ok: false, error: "file" });
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);
    if (!buf.length || buf.length > FILE_MAX) return send(res, 200, { ok: false, error: "file" });
    const mime = clampText(body.mime, 80) || "application/octet-stream";
    const url = await putFileBlob(gate.assignmentId, gate.id, buf, mime);
    if (!url) return send(res, 200, { ok: false, mode: "local", error: "file" });
    state.files = upsertById(state.files || [], fileRecordFromUpload(role, body, gate.id, gate.assignmentId, gate.stno, mime, url));
    extra.url = url;
    try {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        const { del } = await import("@vercel/blob");
        await del(parts.map(String), { token });
      }
    } catch {}
  } else if (op === "blobToken" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    const mimeHint = String(clampText(body.mime, 80) || "").toLowerCase();
    const ext = mimeHint.indexOf("pdf") >= 0 ? ".pdf"
      : mimeHint.indexOf("png") >= 0 ? ".png"
      : mimeHint.indexOf("webp") >= 0 ? ".webp"
      : mimeHint.indexOf("gif") >= 0 ? ".gif"
      : mimeHint.indexOf("heic") >= 0 ? ".heic"
      : mimeHint.indexOf("heif") >= 0 ? ".heif"
      : ".jpg";
    const pathname = "mc-grader/files/" + gate.assignmentId + "/" + gate.id + ext;
    try {
      const blobClient = await import("@vercel/blob/client");
      const makeToken = blobClient.generateClientTokenFromReadWriteToken;
      if (!makeToken) return send(res, 200, { ok: false, error: "file" });
      const clientToken = await makeToken({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        pathname,
        access: "private",
        allowedContentTypes: [
          "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
          "image/heic", "image/heif", "application/pdf", "application/octet-stream"
        ],
        maximumSizeInBytes: FILE_MAX,
        addRandomSuffix: false,
        allowOverwrite: true,
        validUntil: Date.now() + 30 * 60 * 1000
      });
      skipSave = true;
      extra.clientToken = clientToken;
      extra.pathname = pathname;
    } catch {
      return send(res, 200, { ok: false, error: "file" });
    }
  } else if (op === "registerFile" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    const url = clampText(body.url, 800);
    let host = "";
    try { host = new URL(url).hostname || ""; } catch { host = ""; }
    if (!url || (host.indexOf("vercel-storage.com") < 0 && host.indexOf("blob.vercel-storage.com") < 0)) {
      return send(res, 200, { ok: false, error: "file" });
    }
    const mime = clampText(body.mime, 80) || "application/octet-stream";
    state.files = upsertById(state.files || [], fileRecordFromUpload(role, body, gate.id, gate.assignmentId, gate.stno, mime, url));
    extra.url = url;
  } else if (op === "updateStudent" && role === "teacher") {
    const stno = normalizeStno(body.stno);
    const acc = findAccount(state, stno);
    if (!acc) return send(res, 200, { ok: false, error: "missing" });
    if (body.name != null) acc.name = String(body.name || "").trim().slice(0, 80);
    if (body.subjects != null) {
      const subjects = normalizeSubjects(body.subjects);
      if (!subjects.length) return send(res, 200, { ok: false, error: "subjects" });
      acc.subjects = subjects;
    }
    if (body.password) {
      if (String(body.password).length < 4 || String(body.password).length > 80) {
        return send(res, 200, { ok: false, error: "password" });
      }
      const hashed = hashPass(body.password);
      acc.salt = hashed.salt;
      acc.hash = hashed.hash;
    }
  } else if (op === "deleteStudent" && role === "teacher") {
    const stno = normalizeStno(body.stno);
    if (!stno) return send(res, 200, { ok: false, error: "stno" });
    state.accounts = (state.accounts || []).filter((a) => a.stno !== stno);
    state.sessions = (state.sessions || []).filter((s) => s.stno !== stno);
  } else if (op === "saveWrittenScores" && role === "teacher" && Array.isArray(body.scores)) {
    body.scores.forEach((s) => {
      if (!s || !s.stno || !s.assignmentId) return;
      const score = Number(s.score);
      if (!Number.isFinite(score)) return;
      state.writtenScores = upsertById(state.writtenScores || [], {
        id: s.id,
        assignmentId: s.assignmentId,
        stno: String(s.stno).slice(0, 8),
        score: Math.max(0, Math.min(100, score)),
        max: Math.max(1, Math.min(100, Number(s.max) || 100)),
        items: Array.isArray(s.items) ? s.items.slice(0, 5) : [],
        source: s.source === "scan" ? "scan" : "manual",
        at: s.at || new Date().toISOString()
      });
    });
  } else {
    return send(res, 400, { ok: false, error: "op" });
  }

  if (skipSave) {
    return send(res, 200, { ok: true, mode: loaded.mode, ...extra });
  }
  const saved = await saveState(state);
  return send(res, 200, { ok: saved.ok, mode: saved.mode || loaded.mode, state: publicState(state, role, session), ...extra });
};

module.exports.config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "4.5mb"
    }
  }
};

module.exports.helpers = function helpers() {
  return {
    loadState,
    saveState,
    putFileBlob,
    findSession,
    sessionRole,
    findAccount,
    uploadFileGuard,
    fileRecordFromUpload,
    findStoredFile,
    studentMayReadFile,
    fetchBlobBytes,
    upsertById,
    publicState,
    send,
    emptyState,
    clampText,
    normalizeStno,
    ensureTeachers
  };
};
