const crypto = require("crypto");
const dns = require("dns").promises;
const fs = require("fs");
const os = require("os");
const path = require("path");

const BLOB_PATH = "news-corner/items.json";
const MAX_ITEMS = 80;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function storeMode() {
  if (process.env.NEWS_LOCAL_STORE === "1") return "file";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "none";
}

function localPath() {
  return path.join(os.tmpdir(), "dse-news-corner.json");
}

function send(res, code, body) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(code).json(body);
}

function clamp(raw, max) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function b64urlEncode(str) {
  return Buffer.from(String(str), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
    token: raw,
    account: data.account || "",
    name: data.name || "",
    role: "teacher",
    exp: Number(data.exp)
  };
}

function teacherFrom(req) {
  return verifySignedToken(req.headers["x-mc-session"] || "");
}

function isPrivateIp(ip) {
  const raw = String(ip || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!raw) return true;
  if (raw.includes(":")) {
    if (raw === "::1" || raw === "::") return true;
    if (raw.startsWith("fe80:") || raw.startsWith("fc") || raw.startsWith("fd")) return true;
    if (raw.startsWith("::ffff:")) return isPrivateIp(raw.slice(7));
    return false;
  }
  const m = raw.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    const err = new Error("url");
    err.code = "url";
    throw err;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    const err = new Error("url");
    err.code = "url";
    throw err;
  }
  if (u.username || u.password) {
    const err = new Error("url");
    err.code = "url";
    throw err;
  }
  if (u.port && u.port !== "80" && u.port !== "443") {
    const err = new Error("url");
    err.code = "url";
    throw err;
  }
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    const err = new Error("url");
    err.code = "url";
    throw err;
  }
  let addrs = [];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    const err = new Error("fetch");
    err.code = "fetch";
    throw err;
  }
  if (!addrs.length || addrs.some((row) => isPrivateIp(row.address))) {
    const err = new Error("url");
    err.code = "url";
    throw err;
  }
  return u;
}

async function readLimited(res, max) {
  if (!res.body || typeof res.body.getReader !== "function") {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.subarray(0, max);
  }
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  while (n < max) {
    const step = await reader.read();
    if (step.done) break;
    const value = Buffer.from(step.value);
    n += value.length;
    chunks.push(value);
  }
  try { await reader.cancel(); } catch {}
  const buf = Buffer.concat(chunks);
  return buf.subarray(0, max);
}

function decodeHtml(buf, ctype) {
  const head = buf.subarray(0, 2500).toString("latin1");
  const fromType = /charset=([^;\s]+)/i.exec(ctype || "");
  const fromMeta = /charset=["']?\s*([\w.-]+)/i.exec(head);
  const name = String((fromType && fromType[1]) || (fromMeta && fromMeta[1]) || "utf-8").replace(/["']/g, "").toLowerCase();
  try {
    return new TextDecoder(name).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

async function fetchHtml(start) {
  let current = String(start || "");
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(current);
    current = u.href;
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-HK,zh;q=0.9,en;q=0.8"
      }
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        const err = new Error("fetch");
        err.code = "fetch";
        throw err;
      }
      current = new URL(loc, current).href;
      continue;
    }
    if (!res.ok) {
      const err = new Error("fetch");
      err.code = "fetch";
      throw err;
    }
    const buf = await readLimited(res, 900000);
    const ctype = res.headers.get("content-type") || "";
    const peek = buf.subarray(0, 40).toString("utf8");
    if (ctype && !/html|xml|text\/plain/i.test(ctype) && !/^\s*</.test(peek)) {
      const err = new Error("type");
      err.code = "type";
      throw err;
    }
    return { html: decodeHtml(buf, ctype).slice(0, 800000), finalUrl: current };
  }
  const err = new Error("fetch");
  err.code = "fetch";
  throw err;
}

function decodeEntities(raw) {
  let out = String(raw || "");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&#0*39;/g, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
        const c = parseInt(h, 16);
        return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : "";
      })
      .replace(/&#(\d+);/g, (_, d) => {
        const c = parseInt(d, 10);
        return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : "";
      });
  }
  return out;
}

function attrMap(source) {
  const attrs = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(source))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] || m[3] || m[4] || "");
  }
  return attrs;
}

function stripTags(raw) {
  return decodeEntities(String(raw || ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectMeta(html) {
  const map = {};
  const re = /<meta\s+([^>]*?)\/?>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = attrMap(m[1]);
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (key && attrs.content && map[key] == null) map[key] = attrs.content.trim();
  }
  return map;
}

function collectJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let n = 0;
  while ((m = re.exec(html)) && n < 8) {
    n += 1;
    try {
      flattenLd(JSON.parse(m[1].trim().slice(0, 100000)), out);
    } catch {}
  }
  return out;
}

function flattenLd(node, out) {
  if (!node || out.length > 40) return;
  if (Array.isArray(node)) {
    node.forEach((row) => flattenLd(row, out));
    return;
  }
  if (typeof node !== "object") return;
  out.push(node);
  if (node["@graph"]) flattenLd(node["@graph"], out);
}

function ldText(nodes, keys) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    for (let k = 0; k < keys.length; k++) {
      const value = node[keys[k]];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (value && typeof value === "object" && typeof value.name === "string" && value.name.trim()) return value.name.trim();
    }
  }
  return "";
}

function tagText(html, tag) {
  const m = new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)</" + tag + ">", "i").exec(html);
  return m ? stripTags(m[1]).slice(0, 300) : "";
}

function articleText(html) {
  let chunk = "";
  const art = /<article\b[\s\S]*?<\/article>/i.exec(html);
  if (art) chunk = art[0];
  else {
    const main = /<main\b[\s\S]*?<\/main>/i.exec(html);
    if (main) chunk = main[0];
  }
  if (!chunk) chunk = html;
  const paras = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(chunk)) && paras.length < 2) {
    const text = stripTags(m[1]);
    if (text.length >= 40) paras.push(text);
  }
  return paras.join(" ").slice(0, 500);
}

function detectLang(text) {
  const cjk = (String(text || "").match(/[\u4e00-\u9fff]/g) || []).length;
  const lat = (String(text || "").match(/[A-Za-z]/g) || []).length;
  if (!cjk && !lat) return "";
  return cjk >= lat ? "zh" : "en";
}

function asDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const plain = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (plain && !/[tT]/.test(s)) {
    return plain[1] + "-" + plain[2].padStart(2, "0") + "-" + plain[3].padStart(2, "0");
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  if (y < 1990 || y > 2100) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch {
    return "";
  }
}

function cleanTitle(title, source) {
  let t = clamp(title, 180);
  if (!source) return t;
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  t = t.replace(new RegExp("\\s*[|–—\\-]\\s*" + escaped + "\\s*$", "i"), "").trim();
  return t.slice(0, 180);
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function safeHttp(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (u.username || u.password) return "";
    return u.href.slice(0, 2000);
  } catch {
    return "";
  }
}

function safeImage(raw, base) {
  try {
    const u = new URL(String(raw || "").trim(), base || undefined);
    if (u.protocol !== "https:") return "";
    return u.href.slice(0, 500);
  } catch {
    return "";
  }
}

function parseArticle(html, pageUrl) {
  const meta = collectMeta(html);
  const ld = collectJsonLd(html);
  const source = clamp(
    meta["og:site_name"] || ldText(ld, ["publisher", "sourceOrganization"]) || hostLabel(pageUrl),
    80
  );
  const title = cleanTitle(
    meta["og:title"] || meta["twitter:title"] || ldText(ld, ["headline", "name"]) || tagText(html, "title"),
    source
  );
  const fromMeta = clamp(meta["og:description"] || meta["twitter:description"] || meta.description || ldText(ld, ["description"]), 700);
  const fromBody = articleText(html);
  const summary = fromMeta.length >= 40 ? fromMeta : (fromBody || fromMeta);
  const publishedAt = asDate(
    meta["article:published_time"] || meta["og:published_time"] || ldText(ld, ["datePublished", "dateCreated"]) || meta["date"]
  );
  const image = safeImage(meta["og:image"] || meta["twitter:image"] || ldText(ld, ["image"]), pageUrl);
  const lang = detectLang(title + " " + summary);
  return {
    url: safeHttp(pageUrl),
    source,
    title,
    summary: clamp(summary, 700),
    publishedAt,
    image,
    lang,
    partial: !title || summary.length < 40
  };
}

async function translateOne(text, target) {
  const q = clamp(text, 700);
  if (!q) return "";
  try {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="
      + encodeURIComponent(target) + "&dt=t&q=" + encodeURIComponent(q);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": UA, accept: "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      const parts = Array.isArray(data && data[0]) ? data[0] : [];
      const out = parts.map((row) => (row && row[0]) || "").join("").trim();
      if (out) return clamp(out, 700);
    }
  } catch {}
  const pair = target === "en" ? "zh-TW|en" : "en|zh-TW";
  const backup = "https://api.mymemory.translated.net/get?langpair=" + pair + "&q=" + encodeURIComponent(q.slice(0, 450));
  const res = await fetch(backup, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const err = new Error("translate");
    err.code = "translate";
    throw err;
  }
  const data = await res.json();
  const out = data && data.responseData && data.responseData.translatedText;
  if (!out || /QUERY LENGTH|INVALID/i.test(out)) {
    const err = new Error("translate");
    err.code = "translate";
    throw err;
  }
  return clamp(decodeEntities(out), 700);
}

function fillTranslation(fields) {
  const jobs = [];
  [
    ["titleZh", "titleEn"],
    ["summaryZh", "summaryEn"],
    ["promptZh", "promptEn"]
  ].forEach((pair) => {
    const zh = clamp(fields[pair[0]], 700);
    const en = clamp(fields[pair[1]], 700);
    if (zh && !en) jobs.push({ from: pair[0], to: pair[1], text: zh, target: "en" });
    else if (en && !zh) jobs.push({ from: pair[1], to: pair[0], text: en, target: "zh-TW" });
  });
  return jobs;
}

function publicItem(item) {
  return {
    id: item.id,
    url: item.url || "",
    titleZh: item.titleZh || "",
    titleEn: item.titleEn || "",
    summaryZh: item.summaryZh || "",
    summaryEn: item.summaryEn || "",
    promptZh: item.promptZh || "",
    promptEn: item.promptEn || "",
    source: item.source || "",
    publishedAt: item.publishedAt || "",
    subject: item.subject || "both",
    pinned: !!item.pinned,
    image: item.image || "",
    sourceLang: item.sourceLang || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    author: item.author || ""
  };
}

function sortItems(items) {
  return items.slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const ad = a.publishedAt || a.createdAt || "";
    const bd = b.publishedAt || b.createdAt || "";
    return String(bd).localeCompare(String(ad));
  });
}

function sanitizeItem(raw, prev, author) {
  const titleZh = clamp(raw.titleZh, 180);
  const titleEn = clamp(raw.titleEn, 180);
  if (!titleZh && !titleEn) return null;
  const subject = raw.subject === "econ" || raw.subject === "bafs" ? raw.subject : "both";
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.publishedAt || "")) ? String(raw.publishedAt) : "";
  const sourceLang = raw.sourceLang === "zh" || raw.sourceLang === "en"
    ? raw.sourceLang
    : ((prev && prev.sourceLang) || "");
  const now = new Date().toISOString();
  return {
    id: prev ? prev.id : crypto.randomBytes(8).toString("hex"),
    url: safeHttp(raw.url),
    titleZh,
    titleEn,
    summaryZh: clamp(raw.summaryZh, 700),
    summaryEn: clamp(raw.summaryEn, 700),
    promptZh: clamp(raw.promptZh, 300),
    promptEn: clamp(raw.promptEn, 300),
    source: clamp(raw.source, 80),
    publishedAt,
    subject,
    pinned: !!raw.pinned,
    image: safeImage(raw.image),
    sourceLang,
    createdAt: prev && prev.createdAt ? prev.createdAt : now,
    updatedAt: now,
    author: clamp((prev && prev.author) || author, 40)
  };
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

async function loadItems() {
  if (storeMode() === "none") return { ok: false, items: [] };
  if (storeMode() === "file") {
    try {
      const data = JSON.parse(fs.readFileSync(localPath(), "utf8"));
      return { ok: true, items: Array.isArray(data.items) ? data.items : [] };
    } catch {
      return { ok: true, items: [] };
    }
  }
  try {
    const data = await loadBlobJson(BLOB_PATH);
    return { ok: true, items: data && Array.isArray(data.items) ? data.items : [] };
  } catch {
    return { ok: false, items: [] };
  }
}

async function saveItems(items) {
  const json = JSON.stringify({ items });
  if (storeMode() === "file") {
    fs.writeFileSync(localPath(), json);
    return { ok: true };
  }
  if (storeMode() !== "blob") return { ok: false };
  try {
    await putBlobJson(BLOB_PATH, json);
    return { ok: true };
  } catch (err) {
    console.error("news save", err && (err.message || err));
    return { ok: false };
  }
}

async function handler(req, res) {
  if (req.method === "GET") {
    const loaded = await loadItems();
    if (!loaded.ok) return send(res, 200, { ok: false, error: "server" });
    return send(res, 200, { ok: true, items: sortItems(loaded.items).map(publicItem) });
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method" });

  const teacher = teacherFrom(req);
  if (!teacher) return send(res, 401, { ok: false, error: "auth" });
  const body = req.body || {};
  const op = body.op;

  if (op === "preview") {
    try {
      const page = await fetchHtml(body.url);
      const article = parseArticle(page.html, page.finalUrl);
      if (!article.title && !article.summary) return send(res, 200, { ok: false, error: "empty" });
      return send(res, 200, { ok: true, article });
    } catch (err) {
      const code = err && (err.code === "url" || err.code === "type" || err.code === "fetch") ? err.code : "fetch";
      return send(res, 200, { ok: false, error: code });
    }
  }

  if (op === "translate") {
    const fields = {
      titleZh: body.titleZh,
      titleEn: body.titleEn,
      summaryZh: body.summaryZh,
      summaryEn: body.summaryEn,
      promptZh: body.promptZh,
      promptEn: body.promptEn
    };
    const jobs = fillTranslation(fields);
    if (!jobs.length) return send(res, 200, { ok: true, translated: false, fields });
    try {
      for (let i = 0; i < jobs.length; i++) {
        fields[jobs[i].to] = await translateOne(jobs[i].text, jobs[i].target);
      }
      return send(res, 200, { ok: true, translated: true, fields });
    } catch {
      return send(res, 200, { ok: false, error: "translate", fields });
    }
  }

  if (op === "save") {
    const loaded = await loadItems();
    if (!loaded.ok) return send(res, 200, { ok: false, error: "server" });
    const incoming = body.item || {};
    const id = clamp(incoming.id, 40);
    const index = id ? loaded.items.findIndex((item) => item && item.id === id) : -1;
    if (id && index < 0) return send(res, 200, { ok: false, error: "missing" });
    const author = teacher.name || teacher.account || "";
    const next = sanitizeItem(incoming, index >= 0 ? loaded.items[index] : null, author);
    if (!next) return send(res, 200, { ok: false, error: "fields" });
    if (index < 0 && loaded.items.length >= MAX_ITEMS) return send(res, 200, { ok: false, error: "limit" });
    if (index >= 0) loaded.items[index] = next;
    else loaded.items.unshift(next);
    const saved = await saveItems(loaded.items);
    if (!saved.ok) return send(res, 200, { ok: false, error: "server" });
    return send(res, 200, { ok: true, item: publicItem(next), items: sortItems(loaded.items).map(publicItem) });
  }

  if (op === "delete") {
    const loaded = await loadItems();
    if (!loaded.ok) return send(res, 200, { ok: false, error: "server" });
    const id = clamp(body.id, 40);
    const next = loaded.items.filter((item) => item && item.id !== id);
    if (next.length === loaded.items.length) return send(res, 200, { ok: false, error: "missing" });
    const saved = await saveItems(next);
    if (!saved.ok) return send(res, 200, { ok: false, error: "server" });
    return send(res, 200, { ok: true, items: sortItems(next).map(publicItem) });
  }

  return send(res, 200, { ok: false, error: "op" });
}

handler.parseArticle = parseArticle;
handler.assertPublicUrl = assertPublicUrl;
module.exports = handler;
