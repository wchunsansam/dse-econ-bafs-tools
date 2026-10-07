const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BLOB_PREFIX = "notes/tb-reveal/";

function send(res, code, body) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(code).json(body);
}

function chapterId(raw) {
  const m = /^Ch0*(\d{1,3})$/i.exec(String(raw || "").trim());
  if (!m) return "";
  const n = Number(m[1]);
  if (!n) return "";
  return "Ch" + String(n).padStart(2, "0");
}

function storeMode() {
  if (process.env.TB_REVEAL_LOCAL === "1") return "file";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "none";
}

function localPath(id) {
  return path.join(os.tmpdir(), "dse-tb-reveal", id + ".json");
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

async function readFlag(id) {
  if (storeMode() === "file") {
    try {
      const data = JSON.parse(fs.readFileSync(localPath(id), "utf8"));
      return { ok: true, on: !!(data && data.on) };
    } catch (err) {
      if (err && err.code === "ENOENT") return { ok: true, on: false };
      return { ok: false, on: false };
    }
  }
  if (storeMode() !== "blob") return { ok: false, on: false };
  try {
    const data = await loadBlob(BLOB_PREFIX + id + ".json");
    return { ok: true, on: !!(data && data.on) };
  } catch {
    return { ok: false, on: false };
  }
}

async function writeFlag(id, on) {
  const json = JSON.stringify({ on: !!on, at: Date.now() });
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
    console.error("tb-reveal save", err && (err.message || err));
    return { ok: false };
  }
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

async function handler(req, res) {
  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    const id = chapterId(url.searchParams.get("chapter"));
    if (!id) return send(res, 400, { ok: false, error: "chapter" });
    const flag = await readFlag(id);
    if (!flag.ok) return send(res, 200, { ok: false, error: "server", on: false });
    return send(res, 200, { ok: true, chapter: id, on: flag.on });
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });
  if (!teacherOk(req)) return send(res, 401, { ok: false, error: "auth" });
  const body = readBody(req);
  const id = chapterId(body.chapter);
  if (!id) return send(res, 400, { ok: false, error: "chapter" });
  if (typeof body.on !== "boolean") return send(res, 400, { ok: false, error: "on" });
  const saved = await writeFlag(id, body.on);
  if (!saved.ok) return send(res, 200, { ok: false, error: "server" });
  return send(res, 200, { ok: true, chapter: id, on: body.on });
}

module.exports = handler;
