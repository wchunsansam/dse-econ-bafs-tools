const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BLOB_PREFIX = "notes/marks/";
const KINDS = { highlight: 1, blank: 1, edit: 1 };

function send(res, code, body) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(code).json(body);
}

function pageId(raw) {
  const base = String(raw || "").split(/[/\\]/).pop().replace(/\.html?$/i, "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(base)) return "";
  return base;
}

function storeMode() {
  if (process.env.NOTES_MARKS_LOCAL === "1" || process.env.TB_REVEAL_LOCAL === "1") return "file";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "none";
}

function localPath(id) {
  return path.join(os.tmpdir(), "dse-notes-marks", id + ".json");
}

function teacherOk(req) {
  const expected = String(process.env.HTMS_TEACHER_CODE || "bteacher").trim().toLowerCase();
  const sent = String(req.headers["x-htms-teacher"] || "").trim().toLowerCase();
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  const body = req.body;
  if (body && typeof body === "object") return body;
  if (typeof body === "string" && body) {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return {};
}

function clip(value, max) {
  return String(value || "").slice(0, max);
}

function cleanMark(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!KINDS[raw.kind]) return null;
  const id = clip(raw.id, 40).replace(/[^\w-]/g, "");
  const text = clip(raw.text, 400);
  if (!id || !text.trim()) return null;
  return {
    id: id,
    kind: raw.kind,
    text: text,
    before: clip(raw.before, 80),
    after: clip(raw.after, 80),
    replacement: raw.kind === "edit" ? clip(raw.replacement, 400) : ""
  };
}

function cleanList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length && out.length < 80; i++) {
    const mark = cleanMark(raw[i]);
    if (mark) out.push(mark);
  }
  return out;
}

function emptyDoc() {
  return { zh: [], en: [] };
}

function blobMissing(err) {
  const msg = String(err && (err.message || err));
  const name = String(err && err.name || "");
  return /not found|404|does not exist|BlobNotFound/i.test(name + " " + msg);
}

async function loadBlob(pathname) {
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
      if (result && (result.statusCode === 404 || result.statusCode === 204)) return null;
    }
  } catch (err) {
    if (!blobMissing(err)) throw err;
    return null;
  }
  try {
    if (typeof blobMod.head === "function") {
      const meta = await blobMod.head(pathname, { token });
      if (meta && meta.url) {
        const res = await fetch(meta.url, { headers: { authorization: "Bearer " + token }, cache: "no-store" });
        if (res.status === 404) return null;
        if (res.ok) return await res.json();
      }
    }
  } catch (err) {
    if (blobMissing(err)) return null;
    throw err;
  }
  return null;
}

async function putBlob(pathname, json) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const { put } = await import("@vercel/blob");
  await put(pathname, json, {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json"
  });
}

async function readDoc(id) {
  if (storeMode() === "file") {
    try {
      const data = JSON.parse(fs.readFileSync(localPath(id), "utf8"));
      return { ok: true, doc: { zh: cleanList(data && data.zh), en: cleanList(data && data.en) } };
    } catch (err) {
      if (err && err.code === "ENOENT") return { ok: true, doc: emptyDoc() };
      return { ok: false, doc: emptyDoc() };
    }
  }
  if (storeMode() !== "blob") return { ok: false, doc: emptyDoc() };
  try {
    const data = await loadBlob(BLOB_PREFIX + id + ".json");
    if (!data) return { ok: true, doc: emptyDoc() };
    return { ok: true, doc: { zh: cleanList(data.zh), en: cleanList(data.en) } };
  } catch {
    return { ok: false, doc: emptyDoc() };
  }
}

async function writeDoc(id, doc) {
  const json = JSON.stringify({ zh: doc.zh, en: doc.en, at: Date.now() });
  if (storeMode() === "file") {
    const file = localPath(id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, json);
    return { ok: true };
  }
  if (storeMode() !== "blob") return { ok: false };
  try {
    await putBlob(BLOB_PREFIX + id + ".json", json);
    return { ok: true };
  } catch (err) {
    console.error("notes-marks save", err && (err.message || err));
    return { ok: false };
  }
}

async function handler(req, res) {
  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const id = pageId(url.searchParams.get("page"));
    if (!id) return send(res, 400, { ok: false, error: "page" });
    const loaded = await readDoc(id);
    if (!loaded.ok) return send(res, 200, { ok: false, error: "server", page: id, zh: [], en: [] });
    return send(res, 200, { ok: true, page: id, zh: loaded.doc.zh, en: loaded.doc.en });
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  if (!teacherOk(req)) return send(res, 401, { ok: false, error: "auth" });
  const body = readBody(req);
  const id = pageId(body.page);
  const lang = body.lang === "en" ? "en" : (body.lang === "zh" ? "zh" : "");
  if (!id || !lang || !Array.isArray(body.marks)) return send(res, 400, { ok: false, error: "body" });
  const loaded = await readDoc(id);
  if (!loaded.ok) return send(res, 200, { ok: false, error: "server" });
  loaded.doc[lang] = cleanList(body.marks);
  const saved = await writeDoc(id, loaded.doc);
  if (!saved.ok) return send(res, 200, { ok: false, error: "server" });
  return send(res, 200, { ok: true, page: id, zh: loaded.doc.zh, en: loaded.doc.en });
}

module.exports = handler;
