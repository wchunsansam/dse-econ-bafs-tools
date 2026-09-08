const mc = require("./mc");

const FILE_MAX = 15 * 1024 * 1024;
const FILE_BODY_MAX = 4 * 1024 * 1024;

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        reject(new Error("too-large"));
        try { req.destroy(); } catch {}
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function headerText(req, name, max) {
  const raw = req.headers[name] || req.headers[String(name).toLowerCase()] || "";
  let v = String(Array.isArray(raw) ? raw[0] : raw);
  try { v = decodeURIComponent(v); } catch {}
  return String(v || "").slice(0, max || 120);
}

function safeName(name) {
  return String(name || "file").replace(/[\r\n"]/g, "").slice(0, 120) || "file";
}

module.exports = async function handler(req, res) {
  const {
    loadState, saveState, putFileBlob, findSession, sessionRole, findAccount,
    uploadFileGuard, fileRecordFromUpload, findStoredFile, studentMayReadFile,
    fetchBlobBytes, upsertById, publicState, send, emptyState, ensureTeachers, clampText
  } = mc.helpers();

  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-headers", "content-type, x-mc-session, x-mc-id, x-mc-assignment, x-mc-stno, x-mc-name, x-mc-mime, x-mc-kind, x-mc-source");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  const loaded = await loadState();
  if (!loaded.ok) return send(res, 200, { ok: false, mode: "local", error: "local" });
  const state = loaded.state || emptyState();
  ensureTeachers(state);
  const session = findSession(state, String(req.headers["x-mc-session"] || ""));
  const role = sessionRole(session);
  if (!role) return send(res, 401, { ok: false, error: "auth" });
  const studentStno = role === "student" && session ? session.stno : null;
  const account = studentStno ? findAccount(state, studentStno) : null;

  if (req.method === "GET") {
    let id = clampText(req.query && req.query.id, 80);
    if (!id) {
      try { id = clampText(new URL(req.url, "http://localhost").searchParams.get("id"), 80); } catch { id = ""; }
    }
    const rec = findStoredFile(state, id);
    const href = rec && (rec.url || rec.fileUrl);
    if (!rec || !href) return send(res, 404, { ok: false, error: "missing" });
    if (role === "student" && !studentMayReadFile(state, rec, studentStno)) {
      return send(res, 403, { ok: false, error: "forbidden" });
    }
    const file = await fetchBlobBytes(href);
    if (!file || !file.buf || !file.buf.length) return send(res, 404, { ok: false, error: "missing" });
    res.setHeader("content-type", rec.mime || file.type || "application/octet-stream");
    res.setHeader("cache-control", "private, no-store");
    res.setHeader("content-disposition", "inline; filename=\"" + safeName(rec.fileName) + "\"");
    return res.status(200).end(file.buf);
  }

  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  const body = {
    id: headerText(req, "x-mc-id", 80),
    assignmentId: headerText(req, "x-mc-assignment", 80),
    stno: headerText(req, "x-mc-stno", 8),
    fileName: headerText(req, "x-mc-name", 120),
    mime: headerText(req, "x-mc-mime", 80),
    kind: headerText(req, "x-mc-kind", 20),
    source: headerText(req, "x-mc-source", 40)
  };
  const gate = uploadFileGuard(role, studentStno, account, state, body);
  if (gate.error) return send(res, 200, { ok: false, error: gate.error });

  let buf;
  try {
    buf = await readBody(req, FILE_BODY_MAX);
  } catch {
    return send(res, 200, { ok: false, error: "file" });
  }
  if (!buf || !buf.length || buf.length > FILE_MAX) return send(res, 200, { ok: false, error: "file" });

  const mime = body.mime || String(req.headers["content-type"] || "").split(";")[0] || "application/octet-stream";
  const url = await putFileBlob(gate.assignmentId, gate.id, buf, mime);
  if (!url) return send(res, 200, { ok: false, mode: "local", error: "file" });
  state.files = upsertById(state.files || [], fileRecordFromUpload(role, body, gate.id, gate.assignmentId, gate.stno, mime, url));
  const saved = await saveState(state);
  return send(res, 200, {
    ok: saved.ok,
    mode: saved.mode || loaded.mode,
    url,
    state: publicState(state, role, session)
  });
};

module.exports.config = {
  maxDuration: 60,
  api: {
    bodyParser: false
  }
};
