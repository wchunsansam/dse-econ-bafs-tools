const crypto = require("crypto");
const dns = require("dns").promises;
const fs = require("fs");
const os = require("os");
const path = require("path");

const BLOB_PATH = "news-corner/items.json";
const MAX_ITEMS = 80;
const TEXT_MAX = 8000;
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

function clampText(raw, max) {
  const text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, max);
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
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|h\d|tr|blockquote|section|article|table|ul|ol)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u3000\s]+/g, " ")
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

function joinNames(list) {
  const names = list.filter(Boolean);
  if (!names.length) return "";
  const sep = /[\u4e00-\u9fff]/.test(names.join("")) ? "、" : ", ";
  return names.slice(0, 4).join(sep);
}

function personName(value) {
  if (Array.isArray(value)) return joinNames(value.map(personName));
  if (value && typeof value === "object") return personName(value.name);
  const s = String(value || "").replace(/\s+/g, " ").trim();
  if (!s || s.length > 120) return "";
  if (/^https?:\/\//i.test(s) || /^www\./i.test(s)) return "";
  if (/^@/.test(s) && !/[\u4e00-\u9fff]/.test(s)) return "";
  return s;
}

function ldAuthors(nodes) {
  const byId = {};
  nodes.forEach((node) => {
    if (node && node["@id"]) byId[node["@id"]] = node;
  });
  const names = [];
  nodes.forEach((node) => {
    let raw = node && node.author;
    if (!raw) return;
    if (raw && typeof raw === "object" && !Array.isArray(raw) && raw["@id"] && !raw.name && byId[raw["@id"]]) raw = byId[raw["@id"]];
    if (Array.isArray(raw)) {
      raw = raw.map((row) => (row && row["@id"] && !row.name && byId[row["@id"]] ? byId[row["@id"]] : row));
    }
    const name = personName(raw);
    if (name && names.indexOf(name) < 0) names.push(name);
  });
  return joinNames(names);
}

function writerName(value, source) {
  const name = personName(value);
  if (!name || (source && name === source)) return "";
  if (/^(admin|editor|editors|staff|reporter|編輯|編輯部|本報記者|記者|網站管理員)$/i.test(name)) return "";
  return name;
}

function imageOf(node) {
  if (!node) return "";
  const img = node.image;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return imageOf({ image: img[0] });
  if (img && typeof img === "object") return img.url || img.contentUrl || "";
  return "";
}

function articleWriter(meta, ld) {
  const keys = ["author", "article:author", "og:article:author", "parsely-author", "sailthru.author", "byl", "dc.creator", "dcterms.creator"];
  for (let i = 0; i < keys.length; i++) {
    const name = personName(meta[keys[i]]);
    if (name) return name;
  }
  return ldAuthors(ld);
}

function tagText(html, tag) {
  const m = new RegExp("<" + tag + "\\b[^>]*>([\\s\\S]*?)</" + tag + ">", "i").exec(html);
  return m ? stripTags(m[1]).slice(0, 300) : "";
}

function isJunkLine(text) {
  return /相關新聞|相關文章|相關報|延伸閱讀|你可能有興趣|你可能也喜歡|推薦閱讀|熱門文章|最多人看|廣告|立即訂閱|版權所有|分享這|下載應用|圖像來源|圖像加註|圖片來源|圖片說明|熱讀|本文原以|人工智能協助翻譯|follow us|sign up|newsletter|cookie policy|privacy policy|related stories|related articles|most read|advertisement|subscribe/i.test(text);
}

function titleKey(title) {
  return String(title || "").replace(/[\s|｜\-–—:：,，.。!！?？"'“”「」]/g, "").slice(0, 14);
}

function articleNodes(nodes) {
  return (nodes || []).filter((node) => {
    const raw = node && node["@type"];
    const types = Array.isArray(raw) ? raw : [raw];
    return types.some((name) => /Article|BlogPosting|Reportage|LiveBlog/i.test(String(name || "")));
  });
}

function bestArticleNode(nodes, title) {
  const articles = articleNodes(nodes);
  const key = titleKey(title);
  let best = null;
  let bestScore = -1;
  articles.forEach((node) => {
    const headline = String((node && (node.headline || node.name)) || "");
    const body = typeof node.articleBody === "string" ? node.articleBody : "";
    let score = body.length;
    const blob = titleKey(headline + body);
    if (key.length >= 4 && blob.includes(key)) score += 20000;
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  });
  return best;
}

function elementAt(html, index, tag) {
  const re = new RegExp("<" + tag + "\\b[^>]*>|<\\/" + tag + ">", "gi");
  re.lastIndex = index;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) !== "/") depth += 1;
    else {
      depth -= 1;
      if (depth === 0) return html.slice(index, re.lastIndex);
    }
  }
  return "";
}

function extractBalanced(html, tag) {
  const re = new RegExp("<" + tag + "\\b[^>]*>|<\\/" + tag + ">", "gi");
  const out = [];
  const stack = [];
  let m;
  while ((m = re.exec(html))) {
    if (m[0].charAt(1) !== "/") stack.push(m.index);
    else if (stack.length) {
      const start = stack.pop();
      if (!stack.length) out.push(html.slice(start, re.lastIndex));
    }
  }
  return out;
}

function stripNoise(html) {
  let out = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|aside|form|iframe|svg)\b[\s\S]*?<\/\1>/gi, " ");
  const re = /<(div|section|aside)\b[^>]*(?:id|class)\s*=\s*["'][^"']*(?:related|recommend|sidebar|comments?|share-bar|newsletter|breadcrumb|most-read|article-list|outbrain|taboola)[^"']*["'][^>]*>/gi;
  const cuts = [];
  let m;
  while ((m = re.exec(out)) && cuts.length < 12) {
    const el = elementAt(out, m.index, m[1].toLowerCase());
    if (el && el.length < 100000) cuts.push({ start: m.index, end: m.index + el.length });
  }
  cuts.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  cuts.forEach((cut) => {
    if (kept.some((prev) => cut.start >= prev.start && cut.end <= prev.end)) return;
    kept.push(cut);
  });
  kept.sort((a, b) => b.start - a.start).forEach((cut) => {
    out = out.slice(0, cut.start) + out.slice(cut.end);
  });
  return out;
}

function storyBlocks(region) {
  const blocks = [];
  const re = /<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  let total = 0;
  while ((m = re.exec(region || ""))) {
    const kind = m[1].toLowerCase();
    const open = m[0].slice(0, 220);
    if (/class\s*=\s*["'][^"']*(?:copyright|caption|byline|image-credit)/i.test(open)) continue;
    const inner = m[2];
    const text = stripTags(inner.replace(/<br\s*\/?>/gi, " "));
    if (!text) continue;
    const links = inner.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];
    const linkRatio = text.length ? stripTags(links.join(" ")).length / text.length : 0;
    const min = kind === "h2" || kind === "h3" ? 2 : (kind === "li" ? 28 : 12);
    if (text.length < min) continue;
    if (linkRatio > (kind === "li" ? 0.4 : 0.72)) continue;
    if (isJunkLine(text) && text.length < 180) continue;
    blocks.push(text);
    total += text.length;
    if (total >= TEXT_MAX) break;
  }
  return blocks;
}

function plainParagraphs(region) {
  const text = decodeEntities(String(region || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h\d|li|blockquote|section|article|tr|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, ""));
  const paras = [];
  let total = 0;
  const rows = text.split(/\n+/);
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].replace(/[\u3000 \t]+/g, " ").trim();
    if (line.length < 12) continue;
    if (isJunkLine(line) && line.length < 180) continue;
    paras.push(line);
    total += line.length;
    if (total >= TEXT_MAX) break;
  }
  return paras;
}

function bestRegion(html, title) {
  const cleaned = stripNoise(html);
  const candidates = extractBalanced(cleaned, "article").concat(extractBalanced(cleaned, "main"));
  const open = /<(div|section)\b[^>]*(?:id|class)\s*=\s*["'][^"']*(?:article[-_ ]?(?:body|content|detail)|story[-_ ]?(?:body|content)|post[-_ ]?(?:content|body)|entry-content|news[-_ ]?(?:body|detail|content)|detail[-_ ]?content)[^"']*["'][^>]*>/gi;
  let m;
  let n = 0;
  while ((m = open.exec(cleaned)) && n < 8) {
    n += 1;
    const el = elementAt(cleaned, m.index, m[1].toLowerCase());
    if (el) candidates.push(el);
  }
  if (!candidates.length) return cleaned;
  const key = titleKey(title);
  const ranked = candidates.map((region) => {
    const blocks = storyBlocks(region);
    const text = blocks.join("\n");
    const avg = blocks.length ? text.length / blocks.length : 0;
    const flat = stripTags(region).replace(/\s+/g, "");
    const hit = key.length >= 4 && flat.includes(key);
    const density = (text.length * text.length) / Math.max(region.length, 1);
    return { region, text, avg, hit, density };
  }).filter((row) => row.text.length >= 40);
  if (!ranked.length) return candidates[0];
  const hits = ranked.filter((row) => row.hit);
  if (hits.length) {
    const articles = hits.filter((row) => /^<article\b/i.test(row.region.trim()) && row.text.length >= 160);
    if (articles.length) {
      articles.sort((a, b) => b.text.length - a.text.length);
      return articles[0].region;
    }
    const blocks = hits.filter((row) => row.text.length >= 160 && !/^<main\b/i.test(row.region.trim()));
    if (blocks.length) {
      blocks.sort((a, b) => b.density - a.density);
      return blocks[0].region;
    }
    hits.sort((a, b) => b.text.length - a.text.length);
    return hits[0].region;
  }
  const prose = ranked.filter((row) => row.avg >= 45);
  const pool = prose.length ? prose : ranked;
  pool.sort((a, b) => b.text.length - a.text.length);
  return pool[0].region;
}

function cleanLdBody(raw) {
  return String(raw || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sentencesOf(line) {
  return String(line || "")
    .split(/(?<=[。！？])\s*|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && !isJunkLine(s));
}

function joinSentences(list) {
  return list.reduce((acc, sentence) => {
    if (!acc) return sentence;
    if (/[。！？]$/.test(acc)) return acc + sentence;
    return acc + " " + sentence;
  }, "");
}

function paragraphize(text) {
  const cleaned = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const blocks = /\n\s*\n/.test(cleaned) ? cleaned.split(/\n\s*\n/) : [cleaned];
  const paras = [];
  blocks.forEach((block) => {
    const line = block.replace(/[^\S\n]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
    if (line.length < 12) return;
    if (isJunkLine(line) && line.length < 140) return;
    const sents = sentencesOf(line);
    const joined = sents.length ? joinSentences(sents) : "";
    const whole = joined.length >= line.length * 0.75 ? joined : line;
    if (sents.length <= 3 || whole.length <= 280 || joined.length < line.length * 0.75) {
      paras.push(whole);
      return;
    }
    let bucket = [];
    let len = 0;
    sents.forEach((sentence) => {
      bucket.push(sentence);
      len += sentence.length;
      if (bucket.length >= 3 || len >= 220) {
        paras.push(joinSentences(bucket));
        bucket = [];
        len = 0;
      }
    });
    if (bucket.length) paras.push(joinSentences(bucket));
  });
  return paras.filter(Boolean);
}

function fitParagraphs(paras, max) {
  const out = [];
  let count = 0;
  for (let i = 0; i < paras.length; i++) {
    const add = paras[i].length + (out.length ? 2 : 0);
    if (count + add > max) break;
    out.push(paras[i]);
    count += add;
  }
  return out;
}

function sameStory(a, b) {
  const ka = String(a || "").replace(/\s+/g, "").slice(0, 36);
  const kb = String(b || "").replace(/\s+/g, "").slice(0, 36);
  if (ka.length < 16 || kb.length < 16) return false;
  return ka.includes(kb.slice(0, 16)) || kb.includes(ka.slice(0, 16));
}

function compact(text) {
  return String(text || "").replace(/[\s\u3000|｜\-–—:：,，.。!！?？"'“”「」＊*]/g, "");
}

function dropBoilerplate(paras, title) {
  const seen = {};
  const titleFlat = compact(title);
  return paras.filter((para) => {
    const flat = compact(para);
    if (!flat) return false;
    if (titleFlat.length >= 8 && (flat === titleFlat || (Math.abs(flat.length - titleFlat.length) <= 4 && (flat.startsWith(titleFlat) || titleFlat.startsWith(flat))))) return false;
    if (/^(圖像來源|圖像加註|圖片來源|圖片說明|image source|image caption|photo credit|author|role|reporting from|published)\b/i.test(String(para || "").trim())) return false;
    if (isJunkLine(para) && para.length < 180) return false;
    if (seen[flat]) return false;
    seen[flat] = true;
    return true;
  });
}

function readableRegion(region) {
  return String(region || "")
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, " ")
    .replace(/<figcaption\b[\s\S]*?<\/figcaption>/gi, " ");
}

function preferBody(htmlText, ldText, title) {
  const htmlBody = String(htmlText || "").trim();
  const ldBody = String(ldText || "").trim();
  if (!ldBody) return htmlBody;
  if (!htmlBody) return ldBody;
  const key = titleKey(title);
  const hit = (text) => key.length >= 4 && String(text).replace(/\s+/g, "").includes(key);
  const htmlHit = hit(htmlBody);
  const ldHit = hit(ldBody);
  if (sameStory(htmlBody, ldBody)) return ldBody.length > htmlBody.length ? ldBody : htmlBody;
  if (htmlHit && !ldHit) return htmlBody;
  if (ldHit && !htmlHit && ldBody.length >= 80) return ldBody;
  return htmlBody.length >= ldBody.length ? htmlBody : ldBody;
}

function readArticle(html, ld, title) {
  const node = bestArticleNode(ld, title);
  const fromLd = cleanLdBody(node && node.articleBody);
  const region = readableRegion(bestRegion(html, title));
  const structParas = storyBlocks(region);
  const structured = structParas.join("\n\n");
  const plain = plainParagraphs(region).join("\n\n");
  const fromPage = structParas.length >= 3 && structured.length >= 400
    ? structured
    : (plain.length > structured.length ? plain : structured);
  const raw = preferBody(fromPage, fromLd, title);
  const bodyParas = fitParagraphs(dropBoilerplate(paragraphize(raw), title), TEXT_MAX);
  const body = bodyParas.join("\n\n");
  const target = Math.min(1600, Math.max(700, Math.round(body.length * 0.55)));
  const picked = [];
  let count = 0;
  bodyParas.forEach((para) => {
    if (picked.length >= 2 && count >= target) return;
    if (picked.length >= 12) return;
    picked.push(para);
    count += para.length;
  });
  const summary = picked.join("\n\n").trim();
  return { body, summary: summary || body };
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
  const s = String(raw || "").trim();
  if (!s) return "";
  if (
    storeMode() === "file" &&
    /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s) &&
    s.length <= 1800000
  ) {
    return s;
  }
  try {
    const u = new URL(s, base || undefined);
    if (u.protocol !== "https:") return "";
    if (u.username || u.password) return "";
    return u.href.slice(0, 2000);
  } catch {
    return "";
  }
}

function imageListOf(item) {
  if (!item) return [];
  const list = Array.isArray(item.images) ? item.images.slice() : [];
  if (item.image && list.indexOf(item.image) < 0) list.unshift(item.image);
  return list.filter(Boolean);
}

function cleanImages(raw, fallback) {
  const list = [];
  const push = (value) => {
    const url = safeImage(value);
    if (url && list.indexOf(url) < 0) list.push(url);
  };
  if (Array.isArray(raw)) raw.forEach(push);
  else if (raw) push(raw);
  if (!list.length && fallback) push(fallback);
  return list.slice(0, 4);
}

function isOwnedImage(url) {
  return /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\/news-corner\/images\//i.test(String(url || ""));
}

function sniffImage(buf) {
  if (!buf || buf.length < 12 || buf.length > 1200000) return "";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  const head = buf.slice(0, 6).toString("ascii");
  if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

async function dropOwnedImages(urls) {
  const owned = (urls || []).filter(isOwnedImage);
  if (!owned.length || storeMode() !== "blob") return;
  try {
    const { del } = await import("@vercel/blob");
    await del(owned, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    console.error("news image delete", err && (err.message || err));
  }
}

async function storeImage(buf, mime) {
  if (storeMode() === "file") return "data:" + mime + ";base64," + buf.toString("base64");
  if (storeMode() !== "blob") return "";
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const pathname = "news-corner/images/" + crypto.randomBytes(12).toString("hex") + "." + ext;
  const { put } = await import("@vercel/blob");
  const out = await put(pathname, buf, {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: mime,
    cacheControlMaxAge: 60 * 60 * 24 * 30
  });
  return safeImage(out && out.url);
}

function parseArticle(html, pageUrl) {
  const meta = collectMeta(html);
  const ld = collectJsonLd(html);
  const hinted = meta["og:title"] || meta["twitter:title"] || "";
  const node = bestArticleNode(ld, hinted);
  const publisher = node && node.publisher ? personName(node.publisher) : "";
  const source = clamp(
    meta["og:site_name"] || publisher || ldText(articleNodes(ld), ["publisher", "sourceOrganization"]) || hostLabel(pageUrl),
    80
  );
  const headline = node ? (typeof node.headline === "string" ? node.headline : personName(node.headline)) : "";
  const title = cleanTitle(
    hinted || headline || tagText(html, "title"),
    source
  );
  const fromArticle = writerName(node && node.author, source);
  const fromMeta = writerName(articleWriter(meta, []), source);
  const writer = clamp(fromArticle || fromMeta, 80);
  const read = readArticle(html, ld, title);
  const blurb = clamp(meta["og:description"] || meta["twitter:description"] || meta.description || (node && node.description) || "", 500);
  let body = read.body;
  let summary = read.summary;
  if (body.length < 80 && blurb) {
    body = blurb;
    summary = blurb;
  } else if (!summary) {
    summary = blurb || body;
  }
  const publishedAt = asDate(
    meta["article:published_time"] || meta["og:published_time"] || (node && (node.datePublished || node.dateCreated)) || meta["date"]
  );
  const image = safeImage(meta["og:image"] || meta["twitter:image"] || imageOf(node), pageUrl);
  const lang = detectLang(title + " " + (body || summary));
  return {
    url: safeHttp(pageUrl),
    source,
    writer,
    title,
    summary: clampText(summary, TEXT_MAX),
    body: clampText(body, TEXT_MAX),
    publishedAt,
    image,
    lang,
    partial: !title || body.length < 80
  };
}

function textChunks(text) {
  const chunks = [];
  let rest = String(text || "");
  while (rest) {
    if (rest.length <= 700) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n", 700);
    if (cut < 180) cut = rest.lastIndexOf("。", 700);
    if (cut < 180) cut = rest.lastIndexOf(". ", 700);
    if (cut < 180) cut = 700;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  return chunks.filter(Boolean);
}

async function translateChunk(text, target) {
  const q = String(text || "").trim();
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
      if (out) return out;
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
  return decodeEntities(out);
}

function joinChunks(parts) {
  return parts.filter(Boolean).reduce((acc, part) => {
    if (!acc) return part;
    if (/[A-Za-z0-9]$/.test(acc) && /^[A-Za-z0-9]/.test(part)) return acc + " " + part;
    return acc + part;
  }, "");
}

async function translateOne(text, target) {
  const q = clampText(text, TEXT_MAX);
  if (!q) return "";
  const paras = q.split(/\n{2,}/);
  const out = [];
  for (let p = 0; p < paras.length; p++) {
    const chunks = textChunks(paras[p]);
    const parts = [];
    for (let i = 0; i < chunks.length; i++) parts.push(await translateChunk(chunks[i], target));
    const joined = joinChunks(parts).trim();
    if (joined) out.push(joined);
  }
  const result = clampText(out.join("\n\n"), TEXT_MAX);
  if (!result) {
    const err = new Error("translate");
    err.code = "translate";
    throw err;
  }
  return result;
}

function pairText(key, value) {
  if (String(key).indexOf("summary") === 0) return clampText(value, TEXT_MAX);
  if (String(key).indexOf("prompt") === 0) return clamp(value, 300);
  return clamp(value, 180);
}

function fillTranslation(fields) {
  const jobs = [];
  [
    ["titleZh", "titleEn"],
    ["summaryZh", "summaryEn"],
    ["promptZh", "promptEn"]
  ].forEach((pair) => {
    const zh = pairText(pair[0], fields[pair[0]]);
    const en = pairText(pair[1], fields[pair[1]]);
    if (zh && !en) jobs.push({ from: pair[0], to: pair[1], text: zh, target: "en" });
    else if (en && !zh) jobs.push({ from: pair[1], to: pair[0], text: en, target: "zh-TW" });
  });
  return jobs;
}

function publicItem(item, includeBody) {
  const images = cleanImages(item.images, item.image);
  const out = {
    id: item.id,
    url: item.url || "",
    titleZh: item.titleZh || "",
    titleEn: item.titleEn || "",
    summaryZh: item.summaryZh || "",
    summaryEn: item.summaryEn || "",
    promptZh: item.promptZh || "",
    promptEn: item.promptEn || "",
    source: item.source || "",
    writer: item.writer || "",
    publishedAt: item.publishedAt || "",
    subject: item.subject || "both",
    pinned: !!item.pinned,
    image: images[0] || "",
    images,
    machineLang: item.machineLang || "",
    sourceLang: item.sourceLang || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    author: item.author || ""
  };
  if (includeBody) {
    out.bodyZh = item.bodyZh || "";
    out.bodyEn = item.bodyEn || "";
  }
  return out;
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
  const machineLang = raw.machineLang === "zh" || raw.machineLang === "en" || raw.machineLang === "both"
    ? raw.machineLang
    : "";
  const images = cleanImages(raw.images, raw.image);
  const now = new Date().toISOString();
  return {
    id: prev ? prev.id : crypto.randomBytes(8).toString("hex"),
    url: safeHttp(raw.url),
    titleZh,
    titleEn,
    summaryZh: clampText(raw.summaryZh, TEXT_MAX),
    summaryEn: clampText(raw.summaryEn, TEXT_MAX),
    bodyZh: clampText(raw.bodyZh, TEXT_MAX),
    bodyEn: clampText(raw.bodyEn, TEXT_MAX),
    promptZh: clamp(raw.promptZh, 300),
    promptEn: clamp(raw.promptEn, 300),
    source: clamp(raw.source, 80),
    writer: clamp(raw.writer, 80),
    publishedAt,
    subject,
    pinned: !!raw.pinned,
    image: images[0] || "",
    images,
    machineLang,
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
    const teacher = teacherFrom(req);
    const loaded = await loadItems();
    if (!loaded.ok) return send(res, 200, { ok: false, error: "server" });
    return send(res, 200, { ok: true, items: sortItems(loaded.items).map((item) => publicItem(item, !!teacher)) });
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

  if (op === "uploadImage") {
    const raw = String(body.data || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    let buf;
    try {
      buf = Buffer.from(raw, "base64");
    } catch {
      return send(res, 200, { ok: false, error: "image" });
    }
    const mime = sniffImage(buf);
    if (!mime) return send(res, 200, { ok: false, error: buf && buf.length > 1200000 ? "imageBig" : "image" });
    try {
      const image = await storeImage(buf, mime);
      if (!image) return send(res, 200, { ok: false, error: "server" });
      return send(res, 200, { ok: true, image });
    } catch (err) {
      console.error("news image", err && (err.message || err));
      return send(res, 200, { ok: false, error: "server" });
    }
  }

  if (op === "save") {
    const loaded = await loadItems();
    if (!loaded.ok) return send(res, 200, { ok: false, error: "server" });
    const incoming = body.item || {};
    const id = clamp(incoming.id, 40);
    const index = id ? loaded.items.findIndex((item) => item && item.id === id) : -1;
    if (id && index < 0) return send(res, 200, { ok: false, error: "missing" });
    const prev = index >= 0 ? loaded.items[index] : null;
    const author = teacher.name || teacher.account || "";
    const next = sanitizeItem(incoming, prev, author);
    if (!next) return send(res, 200, { ok: false, error: "fields" });
    if (index < 0 && loaded.items.length >= MAX_ITEMS) return send(res, 200, { ok: false, error: "limit" });
    if (index >= 0) loaded.items[index] = next;
    else loaded.items.unshift(next);
    const saved = await saveItems(loaded.items);
    if (!saved.ok) return send(res, 200, { ok: false, error: "server" });
    const kept = imageListOf(next);
    await dropOwnedImages(imageListOf(prev).filter((url) => kept.indexOf(url) < 0));
    return send(res, 200, {
      ok: true,
      item: publicItem(next, true),
      items: sortItems(loaded.items).map((item) => publicItem(item, true))
    });
  }

  if (op === "delete") {
    const loaded = await loadItems();
    if (!loaded.ok) return send(res, 200, { ok: false, error: "server" });
    const id = clamp(body.id, 40);
    const gone = loaded.items.filter((item) => item && item.id === id);
    const next = loaded.items.filter((item) => item && item.id !== id);
    if (next.length === loaded.items.length) return send(res, 200, { ok: false, error: "missing" });
    const saved = await saveItems(next);
    if (!saved.ok) return send(res, 200, { ok: false, error: "server" });
    await dropOwnedImages(gone.reduce((urls, item) => urls.concat(imageListOf(item)), []));
    return send(res, 200, { ok: true, items: sortItems(next).map((item) => publicItem(item, true)) });
  }

  return send(res, 200, { ok: false, error: "op" });
}

handler.parseArticle = parseArticle;
handler.assertPublicUrl = assertPublicUrl;
module.exports = handler;
