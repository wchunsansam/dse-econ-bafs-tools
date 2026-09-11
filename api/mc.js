const crypto = require("crypto");

const BLOB_PATH = "mc-grader/state.json";
const BLOB_FILES = "mc-grader/state-files.json";
const BLOB_SUBS = "mc-grader/state-subs.json";
const SESSION_BLOB_PREFIX = "mc-grader/sessions/";
const PUT_MAX = 4000000;
const LARGE_STR = 20000;
const SESSION_MS = 180 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERS = 120000;
const FILE_MAX = 15 * 1024 * 1024;
const FILE_POST_MAX = 2800000;
const FILE_PART_MAX = 12;
const DEFAULT_TEACHER = "sam";
const TEACHER_SEEDS = [
  { user: "Sam", password: "0312", name: "Sam Wong" },
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
  compactState(state, SESSION_KEEP);
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

const SESSION_KEEP = 80;
const SESSION_KEEP_MIN = 4;
const HEAVY_KEYS = {
  data: 1,
  fileBlob: 1,
  fileData: 1,
  buf: 1,
  buffer: 1,
  bytes: 1,
  payload: 1,
  chunk: 1,
  chunks: 1
};

function isBufferish(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return true;
  return value.type === "Buffer" && Array.isArray(value.data);
}

function stripHeavyRecord(rec) {
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) return;
  Object.keys(rec).forEach((key) => {
    if (HEAVY_KEYS[key] || isBufferish(rec[key])) delete rec[key];
  });
}

function stripLargeStrings(value, depth) {
  if (!value || typeof value !== "object" || depth > 10) return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) stripLargeStrings(value[i], depth + 1);
    return;
  }
  Object.keys(value).forEach((key) => {
    const v = value[key];
    if (typeof v === "string") {
      if (HEAVY_KEYS[key] || v.length > LARGE_STR) delete value[key];
    } else if (HEAVY_KEYS[key] || isBufferish(v)) {
      delete value[key];
    } else if (v && typeof v === "object") {
      stripLargeStrings(v, depth + 1);
    }
  });
}

function capSessions(state, maxKeep) {
  pruneSessions(state);
  const cap = Math.max(1, Number(maxKeep) || SESSION_KEEP);
  const list = (state.sessions || []).slice().sort((a, b) => (Number(b.exp) || 0) - (Number(a.exp) || 0));
  state.sessions = list.length > cap ? list.slice(0, cap) : list;
}

function compactState(state, maxSessions) {
  if (!state || typeof state !== "object") return state;
  capSessions(state, maxSessions == null ? SESSION_KEEP : maxSessions);
  (state.files || []).forEach(stripHeavyRecord);
  (state.mcSubmissions || []).forEach(stripHeavyRecord);
  (state.pdfSubmissions || []).forEach(stripHeavyRecord);
  stripLargeStrings(state, 0);
  return state;
}

function cloudFileHref(raw) {
  const href = clampText(raw, 800);
  if (!href || /^blob:|^data:/i.test(href)) return "";
  try {
    const host = new URL(href).hostname || "";
    if (host.indexOf("vercel-storage.com") >= 0 || host.indexOf("blob.vercel-storage.com") >= 0) return href;
  } catch {}
  return "";
}

function normUploadName(name) {
  return String(name || "").replace(/\s*p\.\d+\s*$/i, "").replace(/\.[^.]+$/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function fileIdFromHref(href) {
  try {
    const path = decodeURIComponent(new URL(String(href || "")).pathname || "");
    const last = path.split("/").filter(Boolean).pop() || "";
    return last.replace(/\.[a-z0-9]+$/i, "");
  } catch {
    return "";
  }
}

function blobHrefTries(url) {
  const href = String(url || "");
  const out = [];
  if (href) out.push(href);
  const qAt = href.indexOf("?");
  const path = qAt >= 0 ? href.slice(0, qAt) : href;
  const query = qAt >= 0 ? href.slice(qAt) : "";
  if (href && !/\.[a-z0-9]{2,5}$/i.test(path)) {
    [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".gif"].forEach((ext) => out.push(path + ext + query));
  }
  return out;
}

function filePathnames(assignmentId, id) {
  const asg = String(assignmentId || "");
  const fid = String(id || "").replace(/^\//, "");
  if (!asg || !fid) return [];
  const base = "mc-grader/files/" + asg + "/" + fid;
  const out = [base];
  [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".gif", ".heic", ".heif"].forEach((ext) => out.push(base + ext));
  return out;
}

function recordFileIds(rec) {
  const out = [];
  const add = (v) => {
    const s = String(v || "");
    if (s && out.indexOf(s) < 0) out.push(s);
  };
  add(rec && rec.id);
  add(rec && rec.fileId);
  if (Array.isArray(rec && rec.fileIds)) rec.fileIds.forEach(add);
  add(fileIdFromHref(rec && (rec.url || rec.fileUrl)));
  return out;
}

function slimFile(f) {
  if (!f || !f.id) return null;
  const href = cloudFileHref(f.url || f.fileUrl);
  return {
    id: f.id,
    assignmentId: f.assignmentId,
    stno: f.stno,
    fileName: clampText(f.fileName, 120),
    mime: clampText(f.mime, 80),
    url: href,
    fileUrl: href,
    kind: clampText(f.kind, 20),
    source: clampText(f.source, 40),
    batchId: clampText(f.batchId, 80),
    at: clampText(f.at, 40),
    late: f.late ? true : undefined
  };
}

function stateReplacer(key, value) {
  if (HEAVY_KEYS[key]) return undefined;
  if (isBufferish(value)) return undefined;
  if (typeof value === "string" && value.length > LARGE_STR) return undefined;
  return value;
}

function findTeacherSeed(user) {
  const u = teacherKey(user);
  return TEACHER_SEEDS.find((s) => teacherKey(s.user) === u) || null;
}

function repairTeacherHashIfSeed(rec, password) {
  if (!rec) return false;
  if (verifyPass(password, rec.salt, rec.hash)) return false;
  const seed = findTeacherSeed(rec.user);
  if (!seed || String(password) !== String(seed.password)) return false;
  const hashed = hashPass(password);
  rec.salt = hashed.salt;
  rec.hash = hashed.hash;
  return true;
}

function b64urlEncode(str) {
  return Buffer.from(String(str), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64").toString("utf8");
}

function signSessionToken(sess) {
  const secret = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!secret || !sess) return "";
  const payload = b64urlEncode(JSON.stringify({
    stno: sess.stno || "",
    account: sess.account || "",
    name: sess.name || "",
    role: sess.role,
    exp: sess.exp
  }));
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return payload + "." + sig;
}

function verifySignedToken(token) {
  const secret = process.env.BLOB_READ_WRITE_TOKEN || "";
  const raw = String(token || "");
  const dot = raw.lastIndexOf(".");
  if (!secret || dot < 8) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(b64urlDecode(payload));
  } catch {
    return null;
  }
  if (!data || (data.role !== "teacher" && data.role !== "student")) return null;
  if (!(Number(data.exp) > Date.now())) return null;
  return {
    token: raw,
    stno: data.stno || "",
    account: data.account || "",
    name: data.name || "",
    role: data.role,
    exp: Number(data.exp)
  };
}

function findSession(state, token) {
  if (!token) return null;
  pruneSessions(state);
  const hit = (state.sessions || []).find((s) => s.token === token);
  if (hit) return hit;
  return verifySignedToken(token);
}

function findAccount(state, stno) {
  return (state.accounts || []).find((a) => a && a.stno === stno) || null;
}

function normalizeUser(raw) {
  return String(raw || "").trim().toLowerCase();
}

function teacherKey(raw) {
  const u = normalizeUser(raw);
  if (u === "chunsansamwong" || u === "sam") return "sam";
  return u;
}

function teacherUser(session) {
  return teacherKey(session && (session.account || session.stno));
}

function canManageStudents(session) {
  return teacherUser(session) === DEFAULT_TEACHER;
}

function assignmentOwner(a) {
  return teacherKey((a && a.createdBy) || DEFAULT_TEACHER);
}

function teacherOwnsAssignment(asg, sessionOrUser) {
  if (!asg) return false;
  const user = typeof sessionOrUser === "string"
    ? teacherKey(sessionOrUser)
    : teacherUser(sessionOrUser);
  return assignmentOwner(asg) === user;
}

function teacherOwnedAssignmentIds(state, session) {
  const me = teacherUser(session);
  const ids = new Set();
  (state.assignments || []).forEach((a) => {
    if (a && a.id && assignmentOwner(a) === me) ids.add(a.id);
  });
  return ids;
}

function forbidTeacher(res, loaded, state, role, session) {
  return send(res, 200, {
    ok: false,
    error: "forbidden",
    mode: loaded.mode,
    state: publicState(state, role, session)
  });
}

function findTeacher(state, user) {
  const u = teacherKey(user);
  return (state.teachers || []).find((t) => t && teacherKey(t.user) === u) || null;
}

function ensureTeachers(state) {
  if (!Array.isArray(state.teachers)) state.teachers = [];
  state.teachers.forEach((t) => {
    if (t && normalizeUser(t.user) === "chunsansamwong") t.user = "Sam";
  });
  const seen = new Set();
  state.teachers = state.teachers.filter((t) => {
    if (!t || !t.user) return false;
    const k = teacherKey(t.user);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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

function subjectsAllowedForForm(form) {
  const f = normalizeForm(form);
  if (f === "3") return ["BF"];
  if (f === "4" || f === "5" || f === "6") return SUBJECT_IDS.filter((id) => id !== "BF");
  return SUBJECT_IDS.slice();
}

function clampSubjectsToForm(subjects, form) {
  const allow = subjectsAllowedForForm(form);
  const next = normalizeSubjects(subjects).filter((id) => allow.indexOf(id) >= 0);
  if (normalizeForm(form) === "3" && !next.length) return ["BF"];
  return next;
}

function subjectForForm(subject, form) {
  const f = normalizeForm(form);
  const id = normalizeSubjectId(subject);
  if (f === "3") return "BF";
  if ((f === "4" || f === "5" || f === "6") && id === "BF") return "ECON-CHI";
  return id || (f === "3" ? "BF" : "ECON-CHI");
}

function normalizeForm(raw) {
  const s = String(raw || "").trim();
  return /^[1-6]$/.test(s) ? s : "";
}

function clampText(v, n) {
  return String(v == null ? "" : v).trim().slice(0, n);
}

function sanitizeDeadline(v) {
  if (v == null || v === "") return "";
  const ms = Date.parse(String(v));
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

function assignmentDeadlinePassed(a) {
  if (!a || !a.deadline) return false;
  const ms = Date.parse(a.deadline);
  return Number.isFinite(ms) && Date.now() >= ms;
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
  const user = teacherKey(stno);
  state.sessions = (state.sessions || []).filter((s) => {
    if (nextRole === "teacher") {
      return !(s.role === "teacher" && teacherUser(s) === user);
    }
    return s.stno !== stno;
  });
  const sess = {
    token: crypto.randomBytes(24).toString("hex"),
    stno: nextRole === "teacher" ? "" : stno,
    account: nextRole === "teacher" ? String(stno || "").trim() : "",
    name: name || "",
    role: nextRole,
    exp: Date.now() + SESSION_MS
  };
  sess.token = signSessionToken(sess) || sess.token;
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

function latestMcByStudent(state, assignmentId) {
  const map = new Map();
  (state.mcSubmissions || []).forEach((s) => {
    if (!s || s.assignmentId !== assignmentId || !s.stno) return;
    if (!Array.isArray(s.answers)) return;
    const prev = map.get(s.stno);
    if (!prev || String(s.at || "") >= String(prev.at || "")) map.set(s.stno, s);
  });
  return [...map.values()];
}

function sanitizePhotoReselects(raw, prev) {
  const src = Object.prototype.hasOwnProperty.call(raw || {}, "photoReselects")
    ? raw.photoReselects
    : (prev && prev.photoReselects);
  if (!src || typeof src !== "object" || Array.isArray(src)) return {};
  const out = {};
  const keys = Object.keys(src);
  for (let i = 0; i < keys.length && Object.keys(out).length < 400; i++) {
    const stno = normalizeStno(keys[i]) || clampText(keys[i], 8);
    const rec = src[keys[i]];
    if (!stno || !rec || typeof rec !== "object") continue;
    const at = clampText(rec.at, 40);
    const tryId = clampText(rec.tryId, 80);
    if (!at) continue;
    out[stno] = { at, tryId, seen: !!rec.seen };
  }
  return out;
}

function sanitizeCountedTries(raw, prev) {
  const src = Object.prototype.hasOwnProperty.call(raw || {}, "countedTries")
    ? raw.countedTries
    : (prev && prev.countedTries);
  if (!src || typeof src !== "object" || Array.isArray(src)) return {};
  const out = {};
  const keys = Object.keys(src);
  for (let i = 0; i < keys.length && Object.keys(out).length < 400; i++) {
    const stno = normalizeStno(keys[i]) || clampText(keys[i], 8);
    const id = clampText(src[keys[i]], 80);
    if (stno && id) out[stno] = id;
  }
  return out;
}

function countedTryIdOf(a, stno) {
  const map = a && a.countedTries && typeof a.countedTries === "object" && !Array.isArray(a.countedTries)
    ? a.countedTries
    : {};
  const raw = String(stno || "");
  const norm = normalizeStno(stno) || raw;
  return clampText(map[norm] || map[raw] || "", 80);
}

function sanitizeFileIds(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < list.length && out.length < 8; i++) {
    const id = clampText(list[i], 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function mcAnswerFill(s) {
  return (Array.isArray(s && s.answers) ? s.answers : []).filter((a) => a && a !== "-").length;
}

function pickBestMcRecord(list) {
  const rows = (list || []).filter(Boolean);
  if (!rows.length) return null;
  return rows.slice().sort((a, b) => {
    const fa = mcAnswerFill(a);
    const fb = mcAnswerFill(b);
    if (fa !== fb) return fb - fa;
    const sa = Number(a && a.score);
    const sb = Number(b && b.score);
    const na = Number.isFinite(sa) ? sa : -1;
    const nb = Number.isFinite(sb) ? sb : -1;
    if (na !== nb) return nb - na;
    return String((b && b.at) || "").localeCompare(String((a && a.at) || ""));
  })[0];
}

function collapseStudentMcBatch(subs, studentStno) {
  const groups = new Map();
  (subs || []).forEach((s) => {
    if (!s || !s.assignmentId) return;
    if (s.stno && String(s.stno) !== String(studentStno)) return;
    const key = String(s.assignmentId) + ":" + String(studentStno);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  });
  return [...groups.values()].map((list) => pickBestMcRecord(list)).filter(Boolean);
}

function countedMcByStudent(state, a) {
  const latest = latestMcByStudent(state, a && a.id);
  return latest.map((s) => {
    const want = countedTryIdOf(a, s && s.stno);
    if (!want) return s;
    const hit = (state.mcSubmissions || []).find((x) => (
      x && x.id === want && x.assignmentId === (a && a.id) &&
      String(x.stno) === String(s.stno) && Array.isArray(x.answers)
    ));
    return hit || s;
  });
}

function assignmentFacility(state, a) {
  const n = Math.max(0, Math.min(60, Math.round(Number(a && a.n) || 0)));
  const key = Array.isArray(a && a.key) ? a.key : [];
  const rows = countedMcByStudent(state, a);
  const out = [];
  for (let q = 0; q < n; q++) {
    const k = key[q] || "";
    let correct = 0;
    rows.forEach((s) => {
      const ans = Array.isArray(s.answers) ? s.answers[q] : "";
      if (k && k !== "-" && ans === k) correct += 1;
    });
    const total = rows.length;
    out.push({
      q: q + 1,
      key: String(k).slice(0, 4),
      pct: total ? Math.round(1000 * correct / total) / 10 : 0,
      n: total
    });
  }
  return out;
}

function sanitizeReturnedStnos(raw) {
  const seen = new Set();
  const out = [];
  const list = Array.isArray(raw) ? raw : [];
  for (let i = 0; i < list.length && out.length < 400; i++) {
    const stno = normalizeStno(list[i]);
    if (!stno || seen.has(stno)) continue;
    seen.add(stno);
    out.push(stno);
  }
  return out;
}

function assignmentScriptsReturnedTo(a, stno) {
  if (!a) return false;
  if (a.scriptsReturned) return true;
  const want = normalizeStno(stno) || String(stno || "").trim();
  if (!want) return false;
  const list = Array.isArray(a.returnedStnos) ? a.returnedStnos : [];
  return list.some((s) => String(s) === want || normalizeStno(s) === want);
}

function findAssignment(state, id) {
  return (state.assignments || []).find((a) => a && a.id === id) || null;
}

function stripAssignment(a, state) {
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
    writtenMarks: Array.isArray(a.writtenMarks) ? a.writtenMarks : [],
    writtenSource: a.writtenSource || "",
    mcSource: a.mcSource || "",
    mcMarkEach: a.mcMarkEach,
    mcMarks: Array.isArray(a.mcMarks) ? a.mcMarks : [],
    answersPublished: !!a.answersPublished,
    scriptsReturned: !!a.scriptsReturned,
    deadline: a.deadline || "",
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
  if (a.answersPublished) {
    out.key = Array.isArray(a.key) ? a.key : [];
    out.facility = assignmentFacility(state || { mcSubmissions: [] }, a);
  }
  return out;
}

function filePublic(f) {
  if (!f || !f.id) return null;
  const href = cloudFileHref(f.url || f.fileUrl);
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
    batchId: f.batchId || "",
    at: f.at || ""
  };
}

function publicState(state, role, session) {
  if (role === "teacher") {
    const mine = teacherOwnedAssignmentIds(state, session);
    const onMine = (x) => !!(x && mine.has(x.assignmentId));
    return {
      schoolName: state.schoolName,
      assignments: (state.assignments || []).filter((a) => a && mine.has(a.id)),
      mcSubmissions: (state.mcSubmissions || []).filter(onMine),
      pdfSubmissions: (state.pdfSubmissions || []).filter(onMine),
      writtenScores: (state.writtenScores || []).filter(onMine),
      files: (state.files || []).map(filePublic).filter((f) => f && mine.has(f.assignmentId)),
      accounts: (state.accounts || []).map(accountPublic).filter(Boolean),
      teacher: teacherPublic(findTeacher(state, teacherUser(session)))
    };
  }
  const acc = role === "student" && session && session.stno ? findAccount(state, session.stno) : null;
  const list = (state.assignments || []).filter((a) => acc && studentMayAccess(a, acc));
  const published = new Set(list.filter((a) => a.answersPublished).map((a) => a.id));
  const stno = acc ? acc.stno : "";
  return {
    schoolName: state.schoolName,
    assignments: list.map((a) => {
      const out = stripAssignment(a, state);
      const countedTryId = countedTryIdOf(a, stno);
      if (countedTryId) out.countedTryId = countedTryId;
      const noteMap = a.photoReselects && typeof a.photoReselects === "object" && !Array.isArray(a.photoReselects)
        ? a.photoReselects
        : {};
      const note = noteMap[stno] || noteMap[normalizeStno(stno)] || null;
      if (note && note.at) out.photoReselect = { at: note.at, tryId: note.tryId || "", seen: !!note.seen };
      if (assignmentScriptsReturnedTo(a, stno)) {
        out.scriptsReturned = true;
        out.returnedStnos = [stno];
      }
      return out;
    }),
    mcSubmissions: (state.mcSubmissions || []).filter((s) => s && s.stno === stno && published.has(s.assignmentId)),
    pdfSubmissions: (state.pdfSubmissions || []).filter((s) => {
      if (!s || s.stno !== stno || s.source !== "teacher-scan") return false;
      return assignmentScriptsReturnedTo(findAssignment(state, s.assignmentId), stno);
    }),
    writtenScores: (state.writtenScores || []).filter((s) => {
      if (!s || s.stno !== stno) return false;
      const asg = findAssignment(state, s.assignmentId);
      if (!asg || !acc || !studentMayAccess(asg, acc)) return false;
      return assignmentScriptsReturnedTo(asg, stno);
    }),
    files: latestStudentOriginals((state.files || []).map(filePublic).filter((f) => {
      if (!f) return false;
      if (f.source === "student-upload") return f.stno === stno;
      if (!assignmentScriptsReturnedTo(findAssignment(state, f.assignmentId), stno)) return false;
      if (f.source === "official-answer") return true;
      if ((f.source === "teacher-scan" || f.source === "teacher-mark") && f.stno === stno) {
        const latest = latestTeacherReturnFile(state.files, f.assignmentId, stno);
        return !!(latest && latest.id === f.id);
      }
      return false;
    }), state),
    account: acc ? accountPublic(acc) : null
  };
}

function upsertById(list, item) {
  const next = Array.isArray(list) ? list.slice() : [];
  if (!item || !item.id) {
    next.push(item);
    return next;
  }
  const i = next.findIndex((s) => s && sameRecId(s.id, item.id));
  if (i >= 0) next[i] = { ...next[i], ...item, id: String(next[i].id) };
  else next.push({ ...item, id: String(item.id) });
  return next;
}

function sanitizeAssignment(raw, owner, prev) {
  const n = Math.max(1, Math.min(60, Math.round(numOr(raw && raw.n, 10))));
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
    subject: subjectForForm(
      normalizeSubjectId(raw && raw.subject) || (prev && prev.subject) || "",
      normalizeForm(raw && raw.form) || (prev && prev.form) || ""
    ),
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
    returnedStnos: sanitizeReturnedStnos(
      Object.prototype.hasOwnProperty.call(raw || {}, "returnedStnos")
        ? raw.returnedStnos
        : (prev && prev.returnedStnos)
    ),
    countedTries: sanitizeCountedTries(raw, prev),
    photoReselects: sanitizePhotoReselects(raw, prev),
    deadline: sanitizeDeadline(
      Object.prototype.hasOwnProperty.call(raw || {}, "deadline") ? raw.deadline : (prev && prev.deadline)
    ),
    createdBy: owner,
    createdAt: (prev && prev.createdAt) || (raw && raw.createdAt) || new Date().toISOString(),
    updatedAt: (raw && raw.updatedAt) || new Date().toISOString()
  };
}

const blobUrlCache = Object.create(null);
let memPack = { at: 0, raw: "" };
const MEM_MS = 8000;

async function streamToJson(stream) {
  if (!stream) return null;
  const text = await new Response(stream).text();
  if (!text) return null;
  return JSON.parse(text);
}

async function fetchJsonFromUrl(url, token) {
  const sep = String(url).indexOf("?") >= 0 ? "&" : "?";
  const res = await fetch(url + sep + "cache=0", {
    headers: { authorization: "Bearer " + token },
    cache: "no-store"
  });
  if (!res.ok) return null;
  return await res.json();
}

async function loadBlobJson(pathname, loose) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !pathname) return null;
  try {
    const blobMod = await import("@vercel/blob");
    if (typeof blobMod.get === "function") {
      try {
        const result = await blobMod.get(pathname, { access: "private", token, useCache: false });
        if (result && result.statusCode === 200) {
          if (result.blob && result.blob.url) blobUrlCache[pathname] = result.blob.url;
          const json = await streamToJson(result.stream);
          if (json) return json;
        }
      } catch {}
    }
    if (typeof blobMod.head === "function") {
      try {
        const meta = await blobMod.head(pathname, { token });
        if (meta && meta.url) {
          blobUrlCache[pathname] = meta.url;
          const json = await fetchJsonFromUrl(meta.url, token);
          if (json) return json;
        }
      } catch {}
    }
    if (blobUrlCache[pathname]) {
      const json = await fetchJsonFromUrl(blobUrlCache[pathname], token);
      if (json) return json;
      delete blobUrlCache[pathname];
    }
    if (!loose) return null;
    const listed = await blobMod.list({ prefix: pathname, token, limit: 20 });
    const hit = (listed.blobs || []).find((b) => b.pathname === pathname)
      || (listed.blobs || [])[0];
    if (!hit || !hit.url) return null;
    blobUrlCache[pathname] = hit.url;
    return await fetchJsonFromUrl(hit.url, token);
  } catch {
    return null;
  }
}

function rememberMemState(state) {
  try {
    memPack = { at: Date.now(), raw: encodeState(state) };
  } catch {
    memPack = { at: 0, raw: "" };
  }
}

async function loadState() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false, mode: "local", state: emptyState() };
  if (memPack.raw && Date.now() - memPack.at < MEM_MS) {
    try {
      const state = normalizeStore(JSON.parse(memPack.raw));
      restoreReferencedFiles(state);
      return { ok: true, mode: "blob", state };
    } catch {}
  }
  try {
    let json = await loadBlobJson(BLOB_PATH, false);
    if (!json) json = await loadBlobJson(BLOB_PATH, true);
    if (!json) return { ok: true, mode: "blob", state: emptyState() };
    const state = normalizeStore(json);
    if (json && json.parts && json.parts.files) {
      const extra = await loadBlobJson(BLOB_FILES, false);
      if (extra && Array.isArray(extra.files)) state.files = extra.files;
    }
    if (json && json.parts && json.parts.subs) {
      const extra = await loadBlobJson(BLOB_SUBS, false);
      if (extra) {
        if (Array.isArray(extra.mcSubmissions)) state.mcSubmissions = extra.mcSubmissions;
        if (Array.isArray(extra.pdfSubmissions)) state.pdfSubmissions = extra.pdfSubmissions;
      }
    }
    restoreReferencedFiles(state);
    compactState(state, SESSION_KEEP);
    rememberMemState(state);
    return { ok: true, mode: "blob", state };
  } catch (err) {
    console.error("mc loadState", err && (err.message || err));
    return { ok: false, mode: "local", state: emptyState() };
  }
}

async function putPathJson(pathname, json) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const { put } = await import("@vercel/blob");
  const out = await put(pathname, json, {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json"
  });
  if (out && out.url) blobUrlCache[pathname] = out.url;
}

function encodeState(state) {
  return JSON.stringify(state, stateReplacer);
}

async function saveState(state) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: false, mode: "local" };
  restoreReferencedFiles(state);
  compactState(state, SESSION_KEEP);
  let json = "";
  try {
    json = encodeState(state);
    if (json.length > PUT_MAX) {
      compactState(state, SESSION_KEEP_MIN);
      json = encodeState(state);
    }
    if (json.length <= PUT_MAX) {
      delete state.parts;
      json = encodeState(state);
      await putPathJson(BLOB_PATH, json);
      rememberMemState(state);
      return { ok: true, mode: "blob" };
    }
    const files = (state.files || []).map(slimFile).filter(Boolean);
    const mcSubmissions = state.mcSubmissions || [];
    const pdfSubmissions = state.pdfSubmissions || [];
    const filesJson = JSON.stringify({ files }, stateReplacer);
    const subsJson = JSON.stringify({ mcSubmissions, pdfSubmissions }, stateReplacer);
    if (filesJson.length > PUT_MAX || subsJson.length > PUT_MAX) {
      const msg = "state too large files=" + filesJson.length + " subs=" + subsJson.length;
      console.error("mc saveState", msg);
      return { ok: false, mode: "local", error: "save", message: msg, bytes: json.length };
    }
    await putPathJson(BLOB_FILES, filesJson);
    await putPathJson(BLOB_SUBS, subsJson);
    state.files = [];
    state.mcSubmissions = [];
    state.pdfSubmissions = [];
    state.parts = { files: true, subs: true };
    try {
      const coreJson = encodeState(state);
      if (coreJson.length > PUT_MAX) {
        const msg = "core too large " + coreJson.length;
        console.error("mc saveState", msg);
        return { ok: false, mode: "local", error: "save", message: msg, bytes: coreJson.length };
      }
      await putPathJson(BLOB_PATH, coreJson);
      state.files = files;
      state.mcSubmissions = mcSubmissions;
      state.pdfSubmissions = pdfSubmissions;
      rememberMemState(state);
      return { ok: true, mode: "blob" };
    } finally {
      state.files = files;
      state.mcSubmissions = mcSubmissions;
      state.pdfSubmissions = pdfSubmissions;
    }
  } catch (err) {
    const msg = String((err && err.message) || err || "save").slice(0, 240);
    console.error("mc saveState", msg, json && json.length);
    try {
      compactState(state, SESSION_KEEP_MIN);
      json = encodeState(state);
      if (json.length <= PUT_MAX) {
        delete state.parts;
        json = encodeState(state);
        await putPathJson(BLOB_PATH, json);
        rememberMemState(state);
        return { ok: true, mode: "blob" };
      }
    } catch (err2) {
      console.error("mc saveState retry", err2 && (err2.message || err2));
    }
    return { ok: false, mode: "local", error: "save", message: msg, bytes: json && json.length };
  }
}

async function saveSessionRecord(sess) {
  if (!sess || !sess.token) return { ok: false };
  try {
    await putPathJson(SESSION_BLOB_PREFIX + sess.token + ".json", JSON.stringify(sess));
    return { ok: true };
  } catch (err) {
    console.error("mc saveSession", err && (err.message || err));
    return { ok: false };
  }
}

async function loadSessionRecord(tokenStr) {
  const raw = String(tokenStr || "");
  if (!raw || raw.length > 80) return null;
  try {
    const sess = await loadBlobJson(SESSION_BLOB_PREFIX + raw + ".json");
    if (!sess || sess.token !== raw || !(sess.exp > Date.now())) return null;
    return sess;
  } catch {
    return null;
  }
}

async function resolveSession(state, tokenStr) {
  let session = findSession(state, tokenStr);
  if (session) return session;
  session = await loadSessionRecord(tokenStr);
  if (session && state) {
    if (!Array.isArray(state.sessions)) state.sessions = [];
    if (!state.sessions.some((s) => s && s.token === session.token)) state.sessions.push(session);
  }
  return session;
}

async function persistAuth(res, state, payload, needSave) {
  if (!needSave && payload && payload.token && verifySignedToken(payload.token)) {
    return send(res, 200, { ok: true, ...payload, mode: "blob" });
  }
  const saved = await saveState(state);
  if (saved && saved.ok) {
    return send(res, 200, { ok: true, ...payload, mode: saved.mode || "blob" });
  }
  if (payload.token && verifySignedToken(payload.token)) {
    return send(res, 200, { ok: true, ...payload, mode: "blob" });
  }
  const sess = (state.sessions || []).find((s) => s && s.token === payload.token);
  if (sess) {
    const side = await saveSessionRecord(sess);
    if (side && side.ok) {
      return send(res, 200, { ok: true, ...payload, mode: "blob" });
    }
  }
  return send(res, 200, {
    ok: false,
    error: "server",
    message: (saved && saved.message) || "Could not save sign-in session."
  });
}

async function putFileBlob(assignmentId, id, buf, mime) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return "";
  try {
    const { put } = await import("@vercel/blob");
    const pathname = "mc-grader/files/" + String(assignmentId) + "/" + String(id);
    const body = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    const out = await put(pathname, body, {
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mime || "application/octet-stream",
      access: "private"
    });
    return (out && out.url) || "";
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
  "blobToken", "registerFile", "deleteStudentOriginals", "deleteTeacherMark",
  "deleteTeacherOriginals",
  "returnStudentScripts", "recallStudentScripts", "ackPhotoReselect"
];

const STUDENT_ORIG_KEEP = 6;
const STUDENT_ORIG_FILE_MAX = 6;

function originalBatchKey(rec) {
  if (!rec) return "";
  if (rec.batchId) return String(rec.batchId);
  const name = String(rec.fileName || "").replace(/\s*p\.\d+\s*$/i, "").replace(/\.[^.]+$/, "");
  return [rec.kind || "", String(rec.at || "").slice(0, 16), name].join("|");
}

function referencedOriginalIds(state, assignmentId, stno) {
  const ids = new Set();
  const consider = (s) => {
    if (!s || String(s.assignmentId || "") !== String(assignmentId)) return;
    if (stno && String(s.stno) !== String(stno)) return;
    recordFileIds(s).forEach((id) => ids.add(id));
  };
  (state && state.mcSubmissions || []).forEach(consider);
  (state && state.pdfSubmissions || []).forEach(consider);
  return ids;
}

function studentTrySource(s) {
  const src = String((s && s.source) || "");
  return src === "student-upload" || src === "web";
}

function originalMcFrozen(state, asg, stno, file) {
  if (!asg || !asg.answersPublished || !file) return false;
  const hasMc = latestMcByStudent(state, asg.id).some((s) => s && String(s.stno) === String(stno));
  if (!hasMc) return false;
  const kind = String(file.kind || "");
  if (kind === "written" || kind === "pdf") return false;
  if (kind === "mc") return true;
  return (state.mcSubmissions || []).some((s) => (
    s && String(s.assignmentId) === String(asg.id) && String(s.stno) === String(stno) &&
    recordFileIds(s).indexOf(String(file.id)) >= 0
  ));
}

function unlinkStudentTriesForOriginals(state, assignmentId, stno, dropIds) {
  const ids = new Set([...dropIds].map(String));
  const mine = (s) => s && String(s.assignmentId) === String(assignmentId) && String(s.stno) === String(stno);
  const refsDrop = (s) => recordFileIds(s).some((id) => ids.has(String(id)));
  let droppedPdf = false;
  state.mcSubmissions = (state.mcSubmissions || []).filter((s) => !(mine(s) && studentTrySource(s) && refsDrop(s)));
  state.pdfSubmissions = (state.pdfSubmissions || []).filter((s) => {
    if (!(mine(s) && studentTrySource(s) && refsDrop(s))) return true;
    droppedPdf = true;
    return false;
  });
  if (droppedPdf) {
    state.writtenScores = (state.writtenScores || []).filter((s) => !mine(s));
  }
}

function pruneStudentOriginals(files, assignmentId, stno, extraKeep) {
  const mine = (files || []).filter((f) => (
    f && f.source === "student-upload" && f.assignmentId === assignmentId && String(f.stno) === String(stno)
  ));
  const batches = new Map();
  mine.forEach((f) => {
    const k = originalBatchKey(f);
    if (!batches.has(k)) batches.set(k, { at: f.at || "", ids: [] });
    const b = batches.get(k);
    if ((f.at || "") > b.at) b.at = f.at || "";
    b.ids.push(String(f.id));
  });
  const keep = new Set(
    [...batches.values()].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, STUDENT_ORIG_KEEP).flatMap((b) => b.ids)
  );
  if (extraKeep) extraKeep.forEach((id) => keep.add(String(id)));
  return (files || []).filter((f) => {
    if (!f || f.source !== "student-upload") return true;
    if (f.assignmentId !== assignmentId || String(f.stno) !== String(stno)) return true;
    return keep.has(String(f.id));
  });
}

function latestStudentOriginals(files, state) {
  const groups = new Map();
  (files || []).forEach((f) => {
    if (!f || f.source !== "student-upload") return;
    groups.set(String(f.assignmentId || "") + "|" + String(f.stno || ""), {
      assignmentId: f.assignmentId,
      stno: f.stno
    });
  });
  let next = files || [];
  groups.forEach((g) => {
    next = pruneStudentOriginals(
      next,
      g.assignmentId,
      g.stno,
      state ? referencedOriginalIds(state, g.assignmentId, g.stno) : undefined
    );
  });
  return next;
}

function restoreReferencedFiles(state) {
  if (!state) return 0;
  let n = 0;
  const have = new Set((state.files || []).filter(Boolean).map((f) => String(f.id)));
  const consider = (s, kind) => {
    if (!s || !s.assignmentId || !s.stno) return;
    const href = cloudFileHref(s.fileUrl || s.url);
    const id = clampText(s.fileId || fileIdFromHref(href), 80);
    if (!id || have.has(String(id))) return;
    const rec = fileRecordFromUpload("student", {
      fileName: s.fileName,
      kind: kind || s.kind,
      source: "student-upload",
      batchId: s.batchId,
      at: s.at,
      late: !!s.late
    }, id, s.assignmentId, String(s.stno).slice(0, 8), clampText(s.mime, 80), href, state);
    state.files = upsertById(state.files || [], rec);
    have.add(String(id));
    n += 1;
  };
  (state.mcSubmissions || []).forEach((s) => consider(s, "mc"));
  (state.pdfSubmissions || []).forEach((s) => consider(s, s.kind || "written"));
  return n;
}

function keepStudentOriginals(state, role, assignmentId, stno) {
  if (role !== "student" || !assignmentId || !stno) return;
  state.files = pruneStudentOriginals(state.files, assignmentId, stno, referencedOriginalIds(state, assignmentId, stno));
}

function studentBatchFileCount(files, assignmentId, stno, batchId, exceptId) {
  if (!batchId) return 0;
  return (files || []).filter((f) => (
    f && f.source === "student-upload" &&
    f.assignmentId === assignmentId &&
    String(f.stno) === String(stno) &&
    originalBatchKey(f) === String(batchId) &&
    f.id !== exceptId
  )).length;
}

function studentBatchOverflow(state, role, body, assignmentId, stno, id) {
  if (role !== "student") return false;
  const batchId = clampText(body && body.batchId, 80);
  if (!batchId) return false;
  return studentBatchFileCount(state.files, assignmentId, stno, batchId, id) >= STUDENT_ORIG_FILE_MAX;
}

function applyUploadedFile(state, role, body, id, assignmentId, stno, mime, url) {
  if (studentBatchOverflow(state, role, body, assignmentId, stno, id)) {
    return { error: "too-many-files" };
  }
  state.files = upsertById(state.files || [], fileRecordFromUpload(role, body, id, assignmentId, stno, mime, url, state));
  keepStudentOriginals(state, role, assignmentId, stno);
  return { ok: true };
}

function studentUploadFileIds(files, assignmentId, stno, fileId) {
  return (files || []).filter((f) => (
    f &&
    f.source === "student-upload" &&
    f.assignmentId === assignmentId &&
    String(f.stno) === String(stno) &&
    (!fileId || f.id === fileId)
  ));
}

async function deleteStoredBlobs(targets, allFiles) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !targets || !targets.length) return;
  try {
    const { del } = await import("@vercel/blob");
    const urls = [];
    targets.forEach((f) => {
      const href = f && (f.url || f.fileUrl);
      if (!href) return;
      const shared = (allFiles || []).some((o) => (
        o && o.id !== f.id && (o.url === href || o.fileUrl === href)
      ));
      if (!shared) urls.push(href);
    });
    if (urls.length) await del(urls, { token });
  } catch {}
}

function rememberSubmissionFile(state, role, s, kind) {
  if (!s || !s.assignmentId || !s.stno) return;
  const href = cloudFileHref(s && (s.fileUrl || s.url));
  const id = clampText(s.fileId || fileIdFromHref(href), 80);
  if (!id) return;
  const stno = String(s.stno).slice(0, 8);
  state.files = upsertById(state.files || [], fileRecordFromUpload(role, {
    fileName: s.fileName,
    kind: kind || s.kind,
    source: s.source,
    batchId: s.batchId,
    at: s.at,
    late: !!s.late
  }, id, s.assignmentId, stno, clampText(s.mime, 80), href, state));
  keepStudentOriginals(state, role, s.assignmentId, stno);
}

function uploadFileGuard(role, studentStno, account, state, body, session) {
  const id = clampText(body.id, 80);
  const assignmentId = clampText(body.assignmentId, 80);
  const source = clampText(body.source, 40);
  const stno = role === "student" ? studentStno : (normalizeStno(body.stno) || clampText(body.stno, 8));
  if (!id || !assignmentId) return { error: "op" };
  if (role === "teacher") {
    const asg = findAssignment(state, assignmentId);
    if (!asg) return { error: "op" };
    if (!teacherOwnsAssignment(asg, session)) return { error: "forbidden" };
    if (source === "official-answer") {
      return { id, assignmentId, stno: stno || "" };
    }
  }
  if (!stno) return { error: "op" };
  if (role === "student") {
    const asg = state.assignments.find((x) => x.id === assignmentId);
    if (!asg || asg.open === false || asg.paperOnly) return { error: "op" };
    if (account && !studentMayAccess(asg, account)) return { error: "op" };
    const kind = clampText(body.kind, 20);
    if (asg.answersPublished && kind === "mc" && latestMcByStudent(state, asg.id).some((s) => s && s.stno === studentStno)) {
      return { error: "answers-published" };
    }
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

function fileRecordFromUpload(role, body, id, assignmentId, stno, mime, url, state) {
  const asg = state && (state.assignments || []).find((x) => x && x.id === assignmentId);
  const rec = {
    id,
    assignmentId,
    stno,
    fileName: clampText(body.fileName, 120),
    mime,
    url,
    fileUrl: url,
    kind: clampText(body.kind, 20),
    source: role === "student" ? "student-upload" : clampText(body.source, 40) || "teacher-scan",
    batchId: clampText(body.batchId, 80),
    at: clampText(body.at, 40) || new Date().toISOString()
  };
  if (role === "student" && (body.late || assignmentDeadlinePassed(asg))) rec.late = true;
  return rec;
}

function sameRecId(a, b) {
  return String(a || "") !== "" && String(a) === String(b || "");
}

function findStoredFile(state, id, hint) {
  const want = String(id || (hint && hint.id) || "");
  const name = normUploadName((hint && hint.fileName) || want);
  const stem = want.replace(/\.[a-z0-9]+$/i, "");
  const asg = hint && hint.assignmentId;
  const stno = hint && hint.stno;
  const scored = [];
  const pools = [state.files, state.mcSubmissions, state.pdfSubmissions];
  for (let p = 0; p < pools.length; p++) {
    (pools[p] || []).forEach((f) => {
      if (!f) return;
      if (asg && f.assignmentId && f.assignmentId !== asg) return;
      if (stno && f.stno && String(f.stno) !== String(stno)) return;
      let score = 0;
      const ids = recordFileIds(f);
      if (want && ids.some((x) => sameRecId(x, want) || sameRecId(x, stem))) score += 100;
      const fname = normUploadName(f.fileName);
      if (name && fname && (fname === name || fname === stem || fname === normUploadName(want))) score += 50;
      if (!score) return;
      if (cloudFileHref(f.url || f.fileUrl)) score += 20;
      if (!Array.isArray(f.answers)) score += 5;
      scored.push({ f, score });
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return (scored[0] && scored[0].f) || null;
}

function latestTeacherReturnFile(files, assignmentId, stno) {
  const marks = (files || []).filter((f) => (
    f &&
    (f.source === "teacher-mark" || f.source === "teacher-scan") &&
    f.assignmentId === assignmentId &&
    String(f.stno) === String(stno)
  ));
  marks.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  return marks.length ? marks[marks.length - 1] : null;
}

function studentMayReadFile(state, rec, stno) {
  if (!rec || !stno) return false;
  if (rec.source === "student-upload") return String(rec.stno) === String(stno);
  const asg = findAssignment(state, rec.assignmentId);
  if (!asg || !assignmentScriptsReturnedTo(asg, stno)) return false;
  if (rec.source === "official-answer") return true;
  if ((rec.source === "teacher-scan" || rec.source === "teacher-mark") && String(rec.stno) === String(stno)) {
    const latest = latestTeacherReturnFile(state.files, rec.assignmentId, stno);
    return !!(latest && latest.id === rec.id);
  }
  return false;
}

function teacherMayReadFile(state, rec, session) {
  if (!rec) return false;
  if (rec.assignmentId) {
    const asg = findAssignment(state, rec.assignmentId);
    return teacherOwnsAssignment(asg, session);
  }
  const mine = teacherOwnedAssignmentIds(state, session);
  const pools = [state.files, state.mcSubmissions, state.pdfSubmissions];
  for (let i = 0; i < pools.length; i++) {
    const hit = (pools[i] || []).some((f) => f && mine.has(f.assignmentId) && (
      sameRecId(f.id, rec.id) || (rec.fileName && normUploadName(f.fileName) === normUploadName(rec.fileName))
    ));
    if (hit) return true;
  }
  return false;
}

async function fetchBlobByGet(target) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const want = String(target || "");
  if (!token || !want) return null;
  try {
    const blobMod = await import("@vercel/blob");
    if (typeof blobMod.get !== "function") return null;
    const result = await blobMod.get(want, { access: "private", token, useCache: false });
    if (result && result.statusCode === 200 && result.stream) {
      const headers = result.headers || new Headers();
      if (result.blob && result.blob.contentType && typeof headers.get === "function" && !headers.get("content-type")) {
        headers.set("content-type", result.blob.contentType);
      }
      return new Response(result.stream, { status: 200, headers });
    }
  } catch {}
  return null;
}

async function fetchBlobByPathname(pathnameOrUrl) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const target = String(pathnameOrUrl || "");
  if (!token || !target) return null;
  const viaGet = await fetchBlobByGet(target);
  if (viaGet) return viaGet;
  try {
    const blobMod = await import("@vercel/blob");
    if (typeof blobMod.head === "function") {
      const meta = await blobMod.head(target, { token });
      if (meta && meta.url) {
        const viaUrl = await fetchBlobByGet(meta.url);
        if (viaUrl) return viaUrl;
        try {
          const res = await fetch(meta.url, {
            headers: { authorization: "Bearer " + token },
            cache: "no-store"
          });
          if (res && res.ok) return res;
        } catch {}
      }
    }
  } catch {}
  return null;
}

async function fetchBlobResponse(url) {
  const hrefs = blobHrefTries(url);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  for (let i = 0; i < hrefs.length; i++) {
    const viaGet = await fetchBlobByGet(hrefs[i]);
    if (viaGet) return viaGet;
    try {
      const res = await fetch(hrefs[i], {
        headers: token ? { authorization: "Bearer " + token } : {},
        cache: "no-store"
      });
      if (res && res.ok) return res;
    } catch {}
  }
  return null;
}

async function listBlobsByPrefix(prefix) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const pre = String(prefix || "");
  if (!token || !pre) return [];
  try {
    const blobMod = await import("@vercel/blob");
    if (typeof blobMod.list !== "function") return [];
    const out = [];
    let cursor;
    for (let page = 0; page < 8; page++) {
      const listed = await blobMod.list({ prefix: pre, token, limit: 1000, cursor });
      const blobs = (listed && listed.blobs) || [];
      for (let i = 0; i < blobs.length; i++) out.push(blobs[i]);
      if (!listed || !listed.hasMore || !listed.cursor) break;
      cursor = listed.cursor;
    }
    return out;
  } catch {
    return [];
  }
}

async function listAssignmentBlobs(assignmentId) {
  const asg = String(assignmentId || "");
  if (!asg) return [];
  return listBlobsByPrefix("mc-grader/files/" + asg + "/");
}

function isDistinctFileToken(tok) {
  const s = String(tok || "").trim();
  if (!s) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  if (/^[0-9]{12,}$/.test(s)) return true;
  return s.length >= 16;
}

function fileSearchTokens(rec) {
  const tokens = [];
  const add = (v) => {
    const s = String(v || "").trim();
    if (!s || tokens.indexOf(s) >= 0) return;
    tokens.push(s);
  };
  recordFileIds(rec).forEach(add);
  const raw = String((rec && rec.fileName) || "").trim();
  if (raw) {
    add(raw);
    add(raw.replace(/\.[^.]+$/, ""));
    add(normUploadName(raw));
  }
  return tokens;
}

function pathnameMatchesRecord(pathname, rec) {
  const path = String(pathname || "");
  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch {}
  const asg = String((rec && rec.assignmentId) || "");
  const ids = recordFileIds(rec);
  const tokens = fileSearchTokens(rec);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!isDistinctFileToken(tok) && ids.indexOf(tok) < 0) continue;
    if (asg && (path === "mc-grader/files/" + asg + "/" + tok || decoded === "mc-grader/files/" + asg + "/" + tok)) return true;
    if (path.indexOf("/" + tok + ".") >= 0 || decoded.indexOf("/" + tok + ".") >= 0) return true;
    if (path.endsWith("/" + tok) || decoded.endsWith("/" + tok)) return true;
    if (isDistinctFileToken(tok) && (path.indexOf(tok) >= 0 || decoded.indexOf(tok) >= 0)) return true;
  }
  return false;
}

async function fetchRecordBlob(rec) {
  if (!rec) return null;
  const hrefs = [rec.url, rec.fileUrl].filter((u, i, arr) => u && arr.indexOf(u) === i);
  for (let i = 0; i < hrefs.length; i++) {
    const got = await fetchBlobResponse(hrefs[i]);
    if (got) return got;
  }
  const ids = recordFileIds(rec);
  const pathnames = [];
  const addPath = (p) => {
    if (p && pathnames.indexOf(p) < 0) pathnames.push(p);
  };
  ids.forEach((id) => {
    filePathnames(rec.assignmentId, id).forEach(addPath);
  });
  const rawName = String((rec && rec.fileName) || "").trim();
  const nameStem = rawName.replace(/\.[^.]+$/, "");
  if (rec.assignmentId && isDistinctFileToken(nameStem)) {
    filePathnames(rec.assignmentId, rawName).forEach(addPath);
    filePathnames(rec.assignmentId, nameStem).forEach(addPath);
    try {
      filePathnames(rec.assignmentId, encodeURIComponent(rawName)).forEach(addPath);
    } catch {}
  }
  for (let i = 0; i < pathnames.length; i++) {
    const got = await fetchBlobByPathname(pathnames[i]);
    if (got) return got;
  }
  if (!rec.assignmentId) return null;
  const prefixes = [];
  const addPre = (p) => {
    if (p && prefixes.indexOf(p) < 0) prefixes.push(p);
  };
  ids.forEach((id) => addPre("mc-grader/files/" + rec.assignmentId + "/" + id));
  if (isDistinctFileToken(nameStem)) {
    addPre("mc-grader/files/" + rec.assignmentId + "/" + nameStem);
    addPre("mc-grader/files/" + rec.assignmentId + "/" + rawName);
  }
  addPre("mc-grader/files/" + rec.assignmentId + "/");
  const seenPath = new Set();
  for (let p = 0; p < prefixes.length; p++) {
    const blobs = await listBlobsByPrefix(prefixes[p]);
    for (let i = 0; i < blobs.length; i++) {
      const pathname = String((blobs[i] && blobs[i].pathname) || "");
      if (!pathname || seenPath.has(pathname)) continue;
      seenPath.add(pathname);
      if (!pathnameMatchesRecord(pathname, rec)) continue;
      const got = (blobs[i] && blobs[i].url && await fetchBlobResponse(blobs[i].url)) || await fetchBlobByPathname(pathname);
      if (got) return got;
    }
  }
  return null;
}

async function fetchBlobBytes(url) {
  const res = await fetchBlobResponse(url);
  if (!res) return null;
  try {
    return {
      buf: Buffer.from(await res.arrayBuffer()),
      type: res.headers.get("content-type") || ""
    };
  } catch {
    return null;
  }
}

function alternateStoredFiles(state, rec) {
  if (!rec) return [];
  const out = [];
  const seen = new Set();
  const add = (f) => {
    if (!f || !f.id || seen.has(String(f.id))) return;
    seen.add(String(f.id));
    out.push(f);
  };
  if (rec.fileId) add(findStoredFile(state, rec.fileId, rec));
  const fromUrl = fileIdFromHref(rec.url || rec.fileUrl);
  if (fromUrl && fromUrl !== rec.id) add(findStoredFile(state, fromUrl, rec));
  const ids = recordFileIds(rec);
  ids.forEach((id) => add(findStoredFile(state, id, rec)));
  const name = normUploadName(rec.fileName || rec.id);
  const pools = [state.files, state.mcSubmissions, state.pdfSubmissions];
  for (let i = 0; i < pools.length; i++) {
    (pools[i] || []).forEach((f) => {
      if (!f) return;
      if (rec.assignmentId && f.assignmentId && f.assignmentId !== rec.assignmentId) return;
      if (rec.stno && f.stno && String(f.stno) !== String(rec.stno)) return;
      const sameName = name && normUploadName(f.fileName) === name;
      const sameId = ids.some((id) => recordFileIds(f).some((x) => sameRecId(x, id)));
      if (sameName || sameId) add(f);
    });
  }
  if (rec.fileId && !out.some((f) => sameRecId(f.id, rec.fileId))) {
    add({
      id: rec.fileId,
      assignmentId: rec.assignmentId || "",
      stno: rec.stno || "",
      fileName: rec.fileName || "",
      url: rec.url || rec.fileUrl || "",
      fileUrl: rec.fileUrl || rec.url || "",
      mime: rec.mime || "",
      source: rec.source || "",
      kind: rec.kind || "",
      batchId: rec.batchId || "",
      at: rec.at || ""
    });
  }
  return out;
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

async function handleMcRequest(req, res) {
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
      if (rec) repairTeacherHashIfSeed(rec, password);
      if (!rec || !verifyPass(password, rec.salt, rec.hash)) {
        return send(res, 200, { ok: false, error: "auth" });
      }
      const reply = authReply(res, state, rec.user, rec.name || rec.user, "blob", "teacher");
      return persistAuth(res, state, {
        role: "teacher",
        account: rec.user,
        name: rec.name || rec.user,
        token: reply.token
      }, false);
    }
    const stno = normalizeStno(body.stno);
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 80);
    if (!stno) return send(res, 200, { ok: false, error: "stno" });
    if (password.length < 4 || password.length > 80) return send(res, 200, { ok: false, error: "password" });

    if (op === "register") {
      if (findAccount(state, stno)) return send(res, 200, { ok: false, error: "exists" });
      const subjects = clampSubjectsToForm(body.subjects, formOfStno(stno));
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
      return persistAuth(res, state, reply, true);
    }

    const acc = findAccount(state, stno);
    if (!acc || !verifyPass(password, acc.salt, acc.hash)) {
      return send(res, 200, { ok: false, error: "auth" });
    }
    const reply = authReply(res, state, acc.stno, acc.name, "blob", "student", acc.subjects);
    return persistAuth(res, state, reply, false);
  }

  const session = await resolveSession(loaded.state || emptyState(), String(req.headers["x-mc-session"] || ""));
  const role = sessionRole(session);
  if (!role) return send(res, 401, { ok: false, error: "auth" });
  if (loaded.state) ensureTeachers(loaded.state);
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
    if (prev && !teacherOwnsAssignment(prev, tUser)) {
      return forbidTeacher(res, loaded, state, role, session);
    }
    const owner = prev ? assignmentOwner(prev) : tUser;
    const next = sanitizeAssignment(incoming, owner, prev);
    if (!next.id) return send(res, 200, { ok: false, error: "op" });
    if (i >= 0) state.assignments[i] = next;
    else state.assignments.unshift(next);
  } else if (op === "returnStudentScripts" && role === "teacher") {
    const asg = findAssignment(state, body.assignmentId);
    if (!asg) return send(res, 200, { ok: false, error: "op" });
    if (!teacherOwnsAssignment(asg, tUser)) return forbidTeacher(res, loaded, state, role, session);
    const incoming = Array.isArray(body.stnos) ? body.stnos : [body.stno];
    const add = incoming.map((raw) => normalizeStno(raw)).filter(Boolean);
    if (!add.length) return send(res, 200, { ok: false, error: "op" });
    const list = sanitizeReturnedStnos(asg.returnedStnos);
    add.forEach((stno) => {
      if (!list.includes(stno)) list.push(stno);
    });
    asg.returnedStnos = list;
    asg.updatedAt = new Date().toISOString();
  } else if (op === "recallStudentScripts" && role === "teacher") {
    const asg = findAssignment(state, body.assignmentId);
    const stno = normalizeStno(body.stno);
    if (!asg || !stno) return send(res, 200, { ok: false, error: "op" });
    if (!teacherOwnsAssignment(asg, tUser)) return forbidTeacher(res, loaded, state, role, session);
    asg.returnedStnos = sanitizeReturnedStnos(asg.returnedStnos).filter((s) => s !== stno);
    asg.updatedAt = new Date().toISOString();
  } else if (op === "ackPhotoReselect" && role === "student") {
    const asg = findAssignment(state, body.assignmentId);
    const stno = studentStno;
    if (!asg || !stno || !account || !studentMayAccess(asg, account)) {
      return send(res, 200, { ok: false, error: "op" });
    }
    const key = normalizeStno(stno) || stno;
    const map = asg.photoReselects && typeof asg.photoReselects === "object" && !Array.isArray(asg.photoReselects)
      ? Object.assign({}, asg.photoReselects)
      : {};
    const rec = map[key] || map[stno];
    if (rec && typeof rec === "object") {
      map[key] = { at: rec.at, tryId: rec.tryId || "", seen: true };
      asg.photoReselects = map;
      asg.updatedAt = new Date().toISOString();
    }
  } else if (op === "deleteAssignment" && role === "teacher") {
    const asg = (state.assignments || []).find((x) => x.id === body.id);
    if (asg && !teacherOwnsAssignment(asg, tUser)) {
      return forbidTeacher(res, loaded, state, role, session);
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
        if (gateAsg.answersPublished && latestMcByStudent(state, gateAsg.id).some((s) => s && s.stno === studentStno)) {
          return send(res, 200, { ok: false, error: "answers-published" });
        }
      }
      const incoming = collapseStudentMcBatch(body.submissions, studentStno);
      incoming.forEach((s) => {
        if (!s || !s.stno || !s.assignmentId) return;
        if (String(s.stno) !== studentStno) return;
        const asg = state.assignments.find((x) => x.id === s.assignmentId);
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
          fileUrl: cloudFileHref(s.fileUrl),
          fileId: clampText(s.fileId, 80),
          fileIds: sanitizeFileIds(s.fileIds),
          batchId: clampText(s.batchId, 80),
          at: s.at || new Date().toISOString(),
          late: assignmentDeadlinePassed(asg)
        };
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
      for (let ti = 0; ti < body.submissions.length; ti++) {
        const s = body.submissions[ti];
        if (!s || !s.assignmentId) continue;
        const asg = findAssignment(state, s.assignmentId);
        if (!asg) return send(res, 200, { ok: false, error: "op" });
        if (!teacherOwnsAssignment(asg, tUser)) return forbidTeacher(res, loaded, state, role, session);
      }
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
    } else if (role === "teacher") {
      for (let ti = 0; ti < body.submissions.length; ti++) {
        const s = body.submissions[ti];
        if (!s || !s.assignmentId) continue;
        const asg = findAssignment(state, s.assignmentId);
        if (!asg) return send(res, 200, { ok: false, error: "op" });
        if (!teacherOwnsAssignment(asg, tUser)) return forbidTeacher(res, loaded, state, role, session);
      }
    }
    body.submissions.forEach((s) => {
      if (!s || !s.stno) return;
      const asg = state.assignments.find((x) => x.id === s.assignmentId);
      if (role === "student") {
        if (String(s.stno) !== studentStno) return;
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
        fileUrl: cloudFileHref(s.fileUrl),
        fileId: clampText(s.fileId, 80),
        kind: "pdf",
        source: role === "student" ? "student-upload" : "teacher-scan",
        writtenItems: Array.isArray(s.writtenItems) ? s.writtenItems.slice(0, 5) : [],
        at: s.at || new Date().toISOString(),
        late: role === "student" && assignmentDeadlinePassed(asg)
      };
      if (role === "teacher" && s.writtenScore != null && Number.isFinite(Number(s.writtenScore))) {
        rec.writtenScore = Math.max(0, Math.min(100, Number(s.writtenScore)));
      }
      state.pdfSubmissions = upsertById(state.pdfSubmissions, rec);
      rememberSubmissionFile(state, role, rec, "written");
    });
  } else if (op === "uploadFile" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body, session);
    if (gate.error === "forbidden") return forbidTeacher(res, loaded, state, role, session);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    if (studentBatchOverflow(state, role, body, gate.assignmentId, gate.stno, gate.id)) {
      return send(res, 200, { ok: false, error: "too-many-files" });
    }
    const buf = decodeBase64File(body.data, FILE_POST_MAX);
    if (!buf) return send(res, 200, { ok: false, error: "file" });
    const mime = clampText(body.mime, 80) || "application/octet-stream";
    const url = await putFileBlob(gate.assignmentId, gate.id, buf, mime);
    if (!url) return send(res, 200, { ok: false, mode: "local", error: "file" });
    const applied = applyUploadedFile(state, role, body, gate.id, gate.assignmentId, gate.stno, mime, url);
    if (applied.error) return send(res, 200, { ok: false, error: applied.error });
    extra.url = url;
  } else if (op === "uploadFilePart" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body, session);
    if (gate.error === "forbidden") return forbidTeacher(res, loaded, state, role, session);
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
    const gate = uploadFileGuard(role, studentStno, account, state, body, session);
    if (gate.error === "forbidden") return forbidTeacher(res, loaded, state, role, session);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    if (studentBatchOverflow(state, role, body, gate.assignmentId, gate.stno, gate.id)) {
      return send(res, 200, { ok: false, error: "too-many-files" });
    }
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
    const applied = applyUploadedFile(state, role, body, gate.id, gate.assignmentId, gate.stno, mime, url);
    if (applied.error) return send(res, 200, { ok: false, error: applied.error });
    extra.url = url;
    try {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        const { del } = await import("@vercel/blob");
        await del(parts.map(String), { token });
      }
    } catch {}
  } else if (op === "blobToken" && (role === "teacher" || role === "student")) {
    const gate = uploadFileGuard(role, studentStno, account, state, body, session);
    if (gate.error === "forbidden") return forbidTeacher(res, loaded, state, role, session);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    if (studentBatchOverflow(state, role, body, gate.assignmentId, gate.stno, gate.id)) {
      return send(res, 200, { ok: false, error: "too-many-files" });
    }
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
    const gate = uploadFileGuard(role, studentStno, account, state, body, session);
    if (gate.error === "forbidden") return forbidTeacher(res, loaded, state, role, session);
    if (gate.error) return send(res, 200, { ok: false, error: gate.error });
    const url = clampText(body.url, 800);
    let host = "";
    try { host = new URL(url).hostname || ""; } catch { host = ""; }
    if (!url || (host.indexOf("vercel-storage.com") < 0 && host.indexOf("blob.vercel-storage.com") < 0)) {
      return send(res, 200, { ok: false, error: "file" });
    }
    const mime = clampText(body.mime, 80) || "application/octet-stream";
    const appliedReg = applyUploadedFile(state, role, body, gate.id, gate.assignmentId, gate.stno, mime, url);
    if (appliedReg.error) return send(res, 200, { ok: false, error: appliedReg.error });
    extra.url = url;
  } else if (op === "deleteStudentOriginals" && role === "student") {
    const assignmentId = clampText(body.assignmentId, 80);
    const fileId = clampText(body.id, 80);
    const asg = (state.assignments || []).find((x) => x && x.id === assignmentId);
    if (!assignmentId || !asg) return send(res, 200, { ok: false, error: "op" });
    if (asg.open === false) return send(res, 200, { ok: false, error: "locked" });
    if (asg.paperOnly) return send(res, 200, { ok: false, error: "paper-only" });
    if (account && !studentMayAccess(asg, account)) return send(res, 200, { ok: false, error: "op" });
    if (assignmentScriptsReturnedTo(asg, studentStno)) return send(res, 200, { ok: false, error: "returned" });
    const mine = studentUploadFileIds(state.files, assignmentId, studentStno, fileId);
    if (fileId && !mine.length) return send(res, 200, { ok: false, error: "missing" });
    const frozen = mine.filter((f) => originalMcFrozen(state, asg, studentStno, f));
    const targets = mine.filter((f) => f && !frozen.some((x) => String(x.id) === String(f.id)));
    if (!targets.length && frozen.length) return send(res, 200, { ok: false, error: "answers-published" });
    if (fileId && !targets.length) return send(res, 200, { ok: false, error: "missing" });
    const dropIds = new Set(targets.map((f) => f.id));
    unlinkStudentTriesForOriginals(state, assignmentId, studentStno, dropIds);
    await deleteStoredBlobs(targets, state.files);
    state.files = (state.files || []).filter((f) => !f || !dropIds.has(f.id));
    extra.deleted = [...dropIds];
  } else if (op === "deleteTeacherMark" && role === "teacher") {
    const assignmentId = clampText(body.assignmentId, 80);
    const fileId = clampText(body.id, 80);
    if (!assignmentId || !fileId) return send(res, 200, { ok: false, error: "op" });
    const markAsg = findAssignment(state, assignmentId);
    if (!markAsg) return send(res, 200, { ok: false, error: "op" });
    if (!teacherOwnsAssignment(markAsg, tUser)) return forbidTeacher(res, loaded, state, role, session);
    const rec = findStoredFile(state, fileId);
    if (!rec || String(rec.assignmentId || "") !== assignmentId) return send(res, 200, { ok: false, error: "missing" });
    if (rec.source !== "teacher-mark") return send(res, 200, { ok: false, error: "op" });
    await deleteStoredBlobs([rec], state.files);
    const drop = (arr) => (arr || []).filter((f) => !f || f.id !== fileId);
    state.files = drop(state.files);
    state.mcSubmissions = drop(state.mcSubmissions);
    state.pdfSubmissions = drop(state.pdfSubmissions);
    extra.deleted = [fileId];
  } else if (op === "deleteTeacherOriginals" && role === "teacher") {
    const assignmentId = clampText(body.assignmentId, 80);
    const rawIds = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
    const ids = rawIds.map((x) => clampText(x, 80)).filter(Boolean);
    if (!assignmentId || !ids.length) return send(res, 200, { ok: false, error: "op" });
    const origAsg = findAssignment(state, assignmentId);
    if (!origAsg) return send(res, 200, { ok: false, error: "op" });
    if (!teacherOwnsAssignment(origAsg, tUser)) return forbidTeacher(res, loaded, state, role, session);
    const allow = { "student-upload": 1, "teacher-scan": 1, "sim-scan": 1 };
    const seen = new Set();
    const targets = [];
    ids.forEach((id) => {
      const rec = findStoredFile(state, id, { assignmentId })
        || (state.files || []).find((f) => f && sameRecId(f.id, id));
      if (!rec || seen.has(String(rec.id))) return;
      if (String(rec.assignmentId || "") !== assignmentId) return;
      if (!allow[rec.source]) return;
      seen.add(String(rec.id));
      targets.push(rec);
    });
    if (!targets.length) return send(res, 200, { ok: false, error: "missing" });
    const dropIds = new Set();
    targets.forEach((rec) => recordFileIds(rec).forEach((id) => dropIds.add(String(id))));
    const byStno = new Map();
    targets.forEach((rec) => {
      if (rec.source !== "student-upload") return;
      const stno = String(rec.stno || "");
      if (!byStno.has(stno)) byStno.set(stno, new Set());
      recordFileIds(rec).forEach((id) => byStno.get(stno).add(String(id)));
    });
    byStno.forEach((set, stno) => unlinkStudentTriesForOriginals(state, assignmentId, stno, set));
    await deleteStoredBlobs(targets, state.files);
    const shouldDrop = (s) => {
      if (!s) return false;
      if (s.source === "teacher-mark" || s.source === "official-answer") return false;
      return recordFileIds(s).some((id) => dropIds.has(String(id)));
    };
    state.files = (state.files || []).filter((f) => !shouldDrop(f));
    state.mcSubmissions = (state.mcSubmissions || []).filter((s) => !shouldDrop(s));
    state.pdfSubmissions = (state.pdfSubmissions || []).filter((s) => !shouldDrop(s));
    extra.deleted = [...dropIds];
  } else if (op === "updateStudent" && role === "teacher") {
    if (!canManageStudents(session)) return forbidTeacher(res, loaded, state, role, session);
    const stno = normalizeStno(body.stno);
    const acc = findAccount(state, stno);
    if (!acc) return send(res, 200, { ok: false, error: "missing" });
    if (body.name != null) acc.name = String(body.name || "").trim().slice(0, 80);
    if (body.subjects != null) {
      const subjects = clampSubjectsToForm(body.subjects, formOfStno(stno));
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
    if (!canManageStudents(session)) return forbidTeacher(res, loaded, state, role, session);
    const stno = normalizeStno(body.stno);
    if (!stno) return send(res, 200, { ok: false, error: "stno" });
    state.accounts = (state.accounts || []).filter((a) => a.stno !== stno);
    state.sessions = (state.sessions || []).filter((s) => s.stno !== stno);
  } else if (op === "saveWrittenScores" && role === "teacher" && Array.isArray(body.scores)) {
    for (let wi = 0; wi < body.scores.length; wi++) {
      const s = body.scores[wi];
      if (!s || !s.assignmentId) continue;
      const asg = findAssignment(state, s.assignmentId);
      if (!asg) return send(res, 200, { ok: false, error: "op" });
      if (!teacherOwnsAssignment(asg, tUser)) return forbidTeacher(res, loaded, state, role, session);
    }
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
}

module.exports = async function handler(req, res) {
  try {
    return await handleMcRequest(req, res);
  } catch (err) {
    console.error("api/mc", err && (err.stack || err.message || err));
    if (res.headersSent) return;
    return send(res, 200, { ok: false, error: "server" });
  }
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
    resolveSession,
    sessionRole,
    findAccount,
    uploadFileGuard,
    fileRecordFromUpload,
    findStoredFile,
    findAssignment,
    alternateStoredFiles,
    studentMayReadFile,
    teacherMayReadFile,
    teacherOwnsAssignment,
    assignmentOwner,
    teacherUser,
    fetchBlobBytes,
    fetchBlobResponse,
    fetchRecordBlob,
    upsertById,
    pruneStudentOriginals,
    keepStudentOriginals,
    restoreReferencedFiles,
    studentBatchOverflow,
    applyUploadedFile,
    publicState,
    send,
    emptyState,
    clampText,
    normalizeStno,
    ensureTeachers,
    compactState
  };
};
