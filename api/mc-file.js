const { Readable } = require("stream");
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

function asciiFileName(name, mime) {
  const raw = String(name || "file");
  const ext = /\.pdf$/i.test(raw) || /pdf/i.test(String(mime || "")) ? ".pdf"
    : /\.png$/i.test(raw) ? ".png"
    : /\.webp$/i.test(raw) ? ".webp"
    : /\.gif$/i.test(raw) ? ".gif"
    : ".jpg";
  let base = raw.replace(/[^\x20-\x7E]/g, "_").replace(/[\r\n"]/g, "").replace(/_+/g, "_").trim();
  if (!base || base === "_" || base === ".") base = "file";
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base.slice(0, 100);
  return (base.slice(0, 80) || "file") + ext;
}

function contentDispositionInline(name, mime) {
  const ascii = asciiFileName(name, mime);
  const raw = safeName(name) || ascii;
  return "inline; filename=\"" + ascii + "\"; filename*=UTF-8''" + encodeURIComponent(raw);
}

async function pipeBlobToRes(res, upstream, rec) {
  res.setHeader("content-type", (rec && rec.mime) || upstream.headers.get("content-type") || "application/octet-stream");
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("content-disposition", contentDispositionInline(rec && rec.fileName, rec && rec.mime));
  const len = upstream.headers.get("content-length");
  if (len) res.setHeader("content-length", len);
  res.status(200);
  if (upstream.body && typeof Readable.fromWeb === "function" && typeof upstream.body.getReader === "function") {
    await new Promise((resolve, reject) => {
      const nodeStream = Readable.fromWeb(upstream.body);
      nodeStream.on("error", reject);
      res.on("error", reject);
      res.on("finish", resolve);
      nodeStream.pipe(res);
    });
    return;
  }
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

module.exports = async function handler(req, res) {
  const {
    loadState, saveState, putFileBlob, findSession, resolveSession, sessionRole, findAccount,
    uploadFileGuard, fileRecordFromUpload, findStoredFile, alternateStoredFiles, studentMayReadFile,
    fetchBlobResponse, studentBatchOverflow, applyUploadedFile, publicState, send, emptyState, ensureTeachers, clampText,
    teacherMayReadFile
  } = mc.helpers();

  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-headers", "content-type, x-mc-session, x-mc-id, x-mc-assignment, x-mc-stno, x-mc-name, x-mc-mime, x-mc-kind, x-mc-source, x-mc-batch, x-mc-at");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  const loaded = await loadState();
  if (!loaded.ok) return send(res, 200, { ok: false, mode: "local", error: "local" });
  const state = loaded.state || emptyState();
  ensureTeachers(state);
  const session = await resolveSession(state, String(req.headers["x-mc-session"] || ""));
  const role = sessionRole(session);
  if (!role) return send(res, 401, { ok: false, error: "auth" });
  const studentStno = role === "student" && session ? session.stno : null;
  const account = studentStno ? findAccount(state, studentStno) : null;

  if (req.method === "GET") {
    try {
      let id = clampText(req.query && req.query.id, 80);
      if (!id) {
        try { id = clampText(new URL(req.url, "http://localhost").searchParams.get("id"), 80); } catch { id = ""; }
      }
      const first = findStoredFile(state, id);
      const candidates = [];
      const seen = new Set();
      const add = (rec) => {
        if (!rec || !rec.id || seen.has(rec.id)) return;
        if (role === "student" && !studentMayReadFile(state, rec, studentStno)) return;
        if (role === "teacher" && !teacherMayReadFile(state, rec, session)) return;
        seen.add(rec.id);
        candidates.push(rec);
      };
      add(first);
      if (first) alternateStoredFiles(state, first).forEach(add);
      else if (id) {
        const hint = { id, fileName: "", assignmentId: "", stno: "" };
        alternateStoredFiles(state, hint).forEach(add);
      }
      for (let i = 0; i < candidates.length; i++) {
        const rec = candidates[i];
        const href = rec && (rec.url || rec.fileUrl);
        if (!href) continue;
        const upstream = await fetchBlobResponse(href);
        if (!upstream) continue;
        await pipeBlobToRes(res, upstream, rec);
        return;
      }
      return send(res, 404, { ok: false, error: "missing" });
    } catch (err) {
      console.error("api/mc-file GET", err && (err.message || err));
      if (res.headersSent) return;
      return send(res, 500, { ok: false, error: "file" });
    }
  }

  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  const body = {
    id: headerText(req, "x-mc-id", 80),
    assignmentId: headerText(req, "x-mc-assignment", 80),
    stno: headerText(req, "x-mc-stno", 8),
    fileName: headerText(req, "x-mc-name", 120),
    mime: headerText(req, "x-mc-mime", 80),
    kind: headerText(req, "x-mc-kind", 20),
    source: headerText(req, "x-mc-source", 40),
    batchId: headerText(req, "x-mc-batch", 80),
    at: headerText(req, "x-mc-at", 40)
  };
  const gate = uploadFileGuard(role, studentStno, account, state, body, session);
  if (gate.error === "forbidden") {
    return send(res, 200, { ok: false, error: "forbidden", mode: loaded.mode, state: publicState(state, role, session) });
  }
  if (gate.error) return send(res, 200, { ok: false, error: gate.error });
  if (studentBatchOverflow(state, role, body, gate.assignmentId, gate.stno, gate.id)) {
    return send(res, 200, { ok: false, error: "too-many-files" });
  }

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
  const applied = applyUploadedFile(state, role, body, gate.id, gate.assignmentId, gate.stno, mime, url);
  if (applied.error) return send(res, 200, { ok: false, error: applied.error });
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
