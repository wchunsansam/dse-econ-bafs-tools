const crypto = require("crypto");

const TEACHER_USER = "chunsansamwong";
const TEACHER_PASS = "0312";
const BLOB_PATH = "mc-grader/state.json";
const SESSION_MS = 180 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERS = 120000;

function emptyState() {
  return {
    schoolName: "HTMS",
    assignments: [],
    mcSubmissions: [],
    pdfSubmissions: [],
    writtenScores: [],
    accounts: [],
    sessions: []
  };
}

function normalizeStore(raw) {
  const state = { ...emptyState(), ...(raw || {}) };
  state.accounts = Array.isArray(raw && raw.accounts) ? raw.accounts : [];
  state.sessions = Array.isArray(raw && raw.sessions) ? raw.sessions : [];
  state.writtenScores = Array.isArray(raw && raw.writtenScores) ? raw.writtenScores : [];
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

function makeSession(state, stno, name, role) {
  pruneSessions(state);
  const nextRole = role === "teacher" ? "teacher" : "student";
  state.sessions = (state.sessions || []).filter((s) => {
    if (nextRole === "teacher") return s.role !== "teacher";
    return s.stno !== stno;
  });
  const sess = {
    token: crypto.randomBytes(24).toString("hex"),
    stno,
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
  return {
    id: a.id,
    title: a.title,
    subject: a.subject,
    n: a.n,
    open: a.open,
    paperOnly: !!a.paperOnly,
    hasWritten: !!a.hasWritten,
    writtenMax: a.writtenMax,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

function publicState(state, role) {
  if (role === "teacher") {
    return {
      schoolName: state.schoolName,
      assignments: state.assignments || [],
      mcSubmissions: state.mcSubmissions || [],
      pdfSubmissions: state.pdfSubmissions || [],
      writtenScores: state.writtenScores || []
    };
  }
  return {
    schoolName: state.schoolName,
    assignments: (state.assignments || []).map(stripAssignment),
    mcSubmissions: [],
    pdfSubmissions: [],
    writtenScores: []
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

function send(res, code, body) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(code).json(body);
}

function authReply(res, state, stno, name, mode, role) {
  const sess = makeSession(state, stno, name, role);
  return { token: sess.token, stno, name: name || "", role: sess.role, mode };
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
    if (op === "teacherLogin") {
      const user = String(body.account || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (user !== TEACHER_USER || password !== TEACHER_PASS) {
        return send(res, 200, { ok: false, error: "auth" });
      }
      const reply = authReply(res, state, TEACHER_USER, "", "blob", "teacher");
      const saved = await saveState(state);
      return send(res, 200, { ok: true, role: "teacher", account: TEACHER_USER, token: reply.token, mode: saved.mode || "blob" });
    }
    const stno = normalizeStno(body.stno);
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 80);
    if (!stno) return send(res, 200, { ok: false, error: "stno" });
    if (password.length < 4 || password.length > 80) return send(res, 200, { ok: false, error: "password" });

    if (op === "register") {
      if (findAccount(state, stno)) return send(res, 200, { ok: false, error: "exists" });
      const hashed = hashPass(password);
      state.accounts.push({
        stno,
        name,
        salt: hashed.salt,
        hash: hashed.hash,
        createdAt: new Date().toISOString()
      });
      const reply = authReply(res, state, stno, name, "blob");
      const saved = await saveState(state);
      return send(res, 200, { ok: true, ...reply, mode: saved.mode || "blob" });
    }

    const acc = findAccount(state, stno);
    if (!acc || !verifyPass(password, acc.salt, acc.hash)) {
      return send(res, 200, { ok: false, error: "auth" });
    }
    const reply = authReply(res, state, acc.stno, acc.name, "blob");
    const saved = await saveState(state);
    return send(res, 200, { ok: true, ...reply, mode: saved.mode || "blob" });
  }

  const session = findSession(loaded.state || emptyState(), String(req.headers["x-mc-session"] || ""));
  const role = sessionRole(session);
  if (!role) return send(res, 401, { ok: false, error: "auth" });
  const studentStno = role === "student" && session ? session.stno : null;
  const account = studentStno ? findAccount(loaded.state || emptyState(), studentStno) : null;

  if (req.method === "GET") {
    if (!loaded.ok) return send(res, 200, { ok: false, mode: "local" });
    return send(res, 200, { ok: true, mode: loaded.mode, state: publicState(loaded.state, role) });
  }

  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  let state = loaded.state || emptyState();

  if (!loaded.ok && (op === "submitMcBatch" || op === "upsertAssignment" || op === "submitPdfBatch" || op === "saveWrittenScores" || op === "saveMeta" || op === "deleteAssignment" || op === "changePassword")) {
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
    const reply = authReply(res, state, acc.stno, acc.name, "blob");
    const saved = await saveState(state);
    return send(res, 200, { ok: true, mode: saved.mode || "blob", ...reply });
  }

  if (op === "saveMeta" && role === "teacher") {
    state.schoolName = String(body.schoolName || "HTMS").slice(0, 80);
  } else if (op === "upsertAssignment" && role === "teacher" && body.assignment) {
    const a = body.assignment;
    const i = state.assignments.findIndex((x) => x.id === a.id);
    if (i >= 0) state.assignments[i] = a;
    else state.assignments.unshift(a);
  } else if (op === "deleteAssignment" && role === "teacher") {
    state.assignments = state.assignments.filter((x) => x.id !== body.id);
  } else if (op === "submitMcBatch" && Array.isArray(body.submissions)) {
    if (role === "student") {
      const mismatch = body.submissions.find((s) => s && s.stno && String(s.stno) !== studentStno);
      if (mismatch) {
        return send(res, 200, { ok: false, error: "stno-mismatch", expected: studentStno, got: String(mismatch.stno) });
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
          at: s.at || new Date().toISOString()
        };
        const asg = state.assignments.find((x) => x.id === copy.assignmentId);
        if (!asg || asg.open === false || asg.paperOnly) return;
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
      });
    } else {
      body.submissions.forEach((s) => {
        state.mcSubmissions = upsertById(state.mcSubmissions, s);
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
      }
      const rec = {
        id: s.id,
        assignmentId: s.assignmentId,
        stno: role === "student" ? studentStno : String(s.stno).slice(0, 8),
        hwCode: String(s.hwCode || "").slice(0, 4),
        name: String((role === "student" && account && account.name) || s.name || "").slice(0, 80),
        fileName: String(s.fileName || "").slice(0, 120),
        kind: "pdf",
        source: role === "student" ? "student-upload" : "teacher-scan",
        at: s.at || new Date().toISOString()
      };
      if (role === "teacher" && s.writtenScore != null && Number.isFinite(Number(s.writtenScore))) {
        rec.writtenScore = Math.max(0, Math.min(100, Number(s.writtenScore)));
      }
      state.pdfSubmissions = upsertById(state.pdfSubmissions, rec);
    });
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
        source: s.source === "scan" ? "scan" : "manual",
        at: s.at || new Date().toISOString()
      });
    });
  } else {
    return send(res, 400, { ok: false, error: "op" });
  }

  const saved = await saveState(state);
  return send(res, 200, { ok: saved.ok, mode: saved.mode || loaded.mode, state: publicState(state, role) });
};
