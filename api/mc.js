const TEACHER = "samsir";
const STUDENT = "student";
const BLOB_PATH = "mc-grader/state.json";

function roleOf(req) {
  const pass = String(req.headers["x-mc-pass"] || "");
  if (pass === TEACHER) return "teacher";
  if (pass === STUDENT) return "student";
  return null;
}

function emptyState() {
  return { schoolName: "HTMS", assignments: [], mcSubmissions: [], pdfSubmissions: [] };
}

function stripAssignment(a) {
  return {
    id: a.id,
    title: a.title,
    subject: a.subject,
    n: a.n,
    open: a.open,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

function publicState(state, role) {
  if (role === "teacher") return state;
  return {
    schoolName: state.schoolName,
    assignments: (state.assignments || []).filter((a) => a.open !== false).map(stripAssignment),
    mcSubmissions: [],
    pdfSubmissions: []
  };
}

function upsertByStudent(list, item, kind) {
  const next = Array.isArray(list) ? list.slice() : [];
  const i = next.findIndex((s) => s.assignmentId === item.assignmentId && s.stno === item.stno && (kind === "pdf" ? true : true));
  if (kind === "pdf") {
    const j = next.findIndex((s) => s.assignmentId === item.assignmentId && s.stno === item.stno);
    if (j >= 0) next[j] = { ...next[j], ...item, id: next[j].id };
    else next.push(item);
    return next;
  }
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
    return { ok: true, mode: "blob", state: { ...emptyState(), ...json } };
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

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-headers", "content-type, x-mc-pass");
    return res.status(204).end();
  }

  const role = roleOf(req);
  if (!role) return send(res, 401, { ok: false, error: "auth" });

  const loaded = await loadState();
  if (req.method === "GET") {
    if (!loaded.ok) return send(res, 200, { ok: false, mode: "local" });
    return send(res, 200, { ok: true, mode: loaded.mode, state: publicState(loaded.state, role) });
  }

  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  const body = req.body || {};
  const op = body.op;
  let state = loaded.state || emptyState();

  if (!loaded.ok && (op === "submitMcBatch" || op === "upsertAssignment" || op === "submitPdfBatch" || op === "saveMeta" || op === "deleteAssignment")) {
    return send(res, 200, { ok: false, mode: "local" });
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
      body.submissions.forEach((s) => {
        if (!s || !s.stno || !s.assignmentId) return;
        const copy = {
          id: s.id,
          assignmentId: s.assignmentId,
          stno: String(s.stno).slice(0, 8),
          hwCode: String(s.hwCode || "").slice(0, 4),
          name: String(s.name || "").slice(0, 80),
          answers: Array.isArray(s.answers) ? s.answers.slice(0, 60) : [],
          flags: s.flags || [],
          source: "student-upload",
          at: new Date().toISOString()
        };
        const asg = state.assignments.find((x) => x.id === copy.assignmentId);
        if (asg && asg.key) {
          let score = 0, max = 0;
          asg.key.forEach((k, qi) => {
            if (!k || k === "-") return;
            max += 1;
            if (copy.answers[qi] === k) score += 1;
          });
          copy.score = score;
          copy.max = max;
        }
        state.mcSubmissions = upsertByStudent(state.mcSubmissions, copy, "mc");
      });
    } else {
      body.submissions.forEach((s) => {
        state.mcSubmissions = upsertByStudent(state.mcSubmissions, s, "mc");
      });
    }
  } else if (op === "submitPdfBatch" && Array.isArray(body.submissions)) {
    body.submissions.forEach((s) => {
      if (!s || !s.stno) return;
      state.pdfSubmissions = upsertByStudent(state.pdfSubmissions, {
        id: s.id,
        assignmentId: s.assignmentId,
        stno: String(s.stno).slice(0, 8),
        hwCode: String(s.hwCode || "").slice(0, 4),
        name: String(s.name || "").slice(0, 80),
        fileName: String(s.fileName || "").slice(0, 120),
        kind: "pdf",
        source: role === "student" ? "student-upload" : "teacher-scan",
        at: new Date().toISOString()
      }, "pdf");
    });
  } else {
    return send(res, 400, { ok: false, error: "op" });
  }

  const saved = await saveState(state);
  return send(res, 200, { ok: saved.ok, mode: saved.mode || loaded.mode, state: publicState(state, role) });
};
