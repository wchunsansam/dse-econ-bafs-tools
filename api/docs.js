const crypto = require("crypto");

const PREFIX = "teacher-docs/";

function send(res, code, body) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(code).json(body);
}

function b64urlDecode(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64").toString("utf8");
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
  if (!data || data.role !== "teacher") return null;
  if (!(Number(data.exp) > Date.now())) return null;
  return {
    account: data.account || "",
    name: data.name || "",
    role: "teacher",
    exp: Number(data.exp)
  };
}

function teacherFrom(req) {
  return verifySignedToken(req.headers["x-mc-session"] || "");
}

function teacherKey(raw) {
  const u = String(raw || "").trim().toLowerCase();
  if (u === "chunsansamwong" || u === "sam") return "sam";
  const safe = u.replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return safe;
}

function indexPath(key) {
  return PREFIX + key + "/index.json";
}

function fileExt(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return m ? "." + m[1] : "";
}

function displayName(raw) {
  const name = String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, " ")
    .trim()
    .slice(0, 180);
  return name || "file";
}

function clampMime(raw) {
  const mime = String(raw || "").trim().slice(0, 120);
  return mime || "application/octet-stream";
}

function numSize(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function emptyDoc() {
  return { files: [], pending: [] };
}

function freshPending(pending) {
  const now = Date.now();
  return (pending || []).filter((row) => row && Number(row.exp) > now);
}

async function loadBlobJson(pathname) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const blobMod = await import("@vercel/blob");
  try {
    if (typeof blobMod.get === "function") {
      const result = await blobMod.get(pathname, { access: "private", token, useCache: false });
      if (result && result.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        if (text) return JSON.parse(text);
      }
    }
  } catch {}
  try {
    if (typeof blobMod.head === "function") {
      const meta = await blobMod.head(pathname, { token });
      if (meta && meta.url) {
        const res = await fetch(meta.url, { headers: { authorization: "Bearer " + token }, cache: "no-store" });
        if (res.ok) return await res.json();
      }
    }
  } catch {}
  return null;
}

async function putBlobJson(pathname, json) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const { put } = await import("@vercel/blob");
  await put(pathname, json, {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json"
  });
}

async function readDoc(key) {
  const json = await loadBlobJson(indexPath(key));
  const doc = json && typeof json === "object" ? json : emptyDoc();
  doc.files = Array.isArray(doc.files) ? doc.files : [];
  doc.pending = freshPending(doc.pending);
  return doc;
}

async function writeDoc(key, doc) {
  doc.pending = freshPending(doc.pending);
  await putBlobJson(indexPath(key), JSON.stringify({
    files: doc.files || [],
    pending: doc.pending || []
  }));
}

function publicFile(row) {
  if (!row || !row.id || !row.url) return null;
  return {
    id: String(row.id),
    name: displayName(row.name),
    mime: clampMime(row.mime),
    size: numSize(row.size),
    url: String(row.url),
    downloadUrl: String(row.downloadUrl || row.url),
    at: String(row.at || "")
  };
}

function blobPathOf(raw) {
  let u;
  try {
    u = new URL(String(raw || ""));
  } catch {
    return "";
  }
  const host = String(u.hostname || "").toLowerCase();
  if (host.indexOf("vercel-storage.com") < 0 && host.indexOf("blob.vercel-storage.com") < 0) return "";
  try {
    return decodeURIComponent(u.pathname || "").replace(/^\/+/, "");
  } catch {
    return String(u.pathname || "").replace(/^\/+/, "");
  }
}

function pathMatches(url, pathname) {
  const got = blobPathOf(url);
  const want = String(pathname || "").replace(/^\/+/, "");
  if (!got || !want) return false;
  if (got === want) return true;
  if (got.indexOf(want) !== 0) return false;
  const next = got.charAt(want.length);
  return !!next && !/[a-z0-9]/i.test(next);
}

async function deleteBlob(url) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !url) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(url, { token });
  } catch {}
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-headers", "content-type, x-mc-session");
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 200, { ok: false, error: "cloud" });

  const teacher = teacherFrom(req);
  if (!teacher) return send(res, 401, { ok: false, error: "auth" });
  const key = teacherKey(teacher.account);
  if (!key) return send(res, 401, { ok: false, error: "auth" });

  const body = req.body || {};
  const op = body.op;

  if (op === "list") {
    const doc = await readDoc(key);
    const files = doc.files.map(publicFile).filter(Boolean)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return send(res, 200, {
      ok: true,
      account: key,
      name: teacher.name || teacher.account || key,
      files
    });
  }

  if (op === "prepare") {
    const name = displayName(body.name);
    const id = crypto.randomBytes(12).toString("hex");
    const pathname = PREFIX + key + "/" + id + fileExt(name);
    try {
      const blobClient = await import("@vercel/blob/client");
      const makeToken = blobClient.generateClientTokenFromReadWriteToken;
      if (!makeToken) return send(res, 200, { ok: false, error: "cloud" });
      const clientToken = await makeToken({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        pathname,
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        validUntil: Date.now() + 6 * 60 * 60 * 1000
      });
      const doc = await readDoc(key);
      doc.pending.push({
        id,
        pathname,
        name,
        mime: clampMime(body.mime),
        size: numSize(body.size),
        exp: Date.now() + 6 * 60 * 60 * 1000
      });
      await writeDoc(key, doc);
      return send(res, 200, { ok: true, id, pathname, clientToken });
    } catch (err) {
      console.error("docs prepare", err && (err.message || err));
      return send(res, 200, { ok: false, error: "cloud" });
    }
  }

  if (op === "register") {
    const id = String(body.id || "");
    const doc = await readDoc(key);
    const pending = doc.pending.find((row) => row && row.id === id);
    if (!pending) return send(res, 200, { ok: false, error: "missing" });
    const url = String(body.url || "");
    const downloadUrl = String(body.downloadUrl || url);
    if (!pathMatches(url, pending.pathname) || !pathMatches(downloadUrl, pending.pathname)) {
      return send(res, 200, { ok: false, error: "file" });
    }
    doc.pending = doc.pending.filter((row) => !row || row.id !== id);
    doc.files = doc.files.filter((row) => !row || row.id !== id);
    doc.files.push({
      id,
      name: displayName(body.name || pending.name),
      mime: clampMime(body.mime || pending.mime),
      size: numSize(body.size != null ? body.size : pending.size),
      url,
      downloadUrl,
      pathname: pending.pathname,
      at: new Date().toISOString()
    });
    try {
      await writeDoc(key, doc);
    } catch (err) {
      console.error("docs register", err && (err.message || err));
      return send(res, 200, { ok: false, error: "cloud" });
    }
    const files = doc.files.map(publicFile).filter(Boolean)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return send(res, 200, { ok: true, files });
  }

  if (op === "delete") {
    const id = String(body.id || "");
    if (!id) return send(res, 200, { ok: false, error: "missing" });
    const doc = await readDoc(key);
    const hit = doc.files.find((row) => row && row.id === id);
    if (!hit) return send(res, 200, { ok: false, error: "missing" });
    doc.files = doc.files.filter((row) => !row || row.id !== id);
    try {
      await writeDoc(key, doc);
    } catch (err) {
      console.error("docs delete", err && (err.message || err));
      return send(res, 200, { ok: false, error: "cloud" });
    }
    await deleteBlob(hit.url);
    if (hit.downloadUrl && hit.downloadUrl !== hit.url) await deleteBlob(hit.downloadUrl);
    const files = doc.files.map(publicFile).filter(Boolean)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return send(res, 200, { ok: true, files });
  }

  return send(res, 200, { ok: false, error: "op" });
}

module.exports = handler;
module.exports.teacherKey = teacherKey;
module.exports.fileExt = fileExt;
module.exports.displayName = displayName;
module.exports.pathMatches = pathMatches;
module.exports.blobPathOf = blobPathOf;
