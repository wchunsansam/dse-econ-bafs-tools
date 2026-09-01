import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "icons");

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}

function chunk(tag, data) {
  const t = Buffer.from(tag);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePng(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
}

function setPx(rgba, w, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = 255;
}

function fillRect(rgba, w, x0, y0, x1, y1, r, g, b) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) setPx(rgba, w, x, y, r, g, b);
  }
}

const GLYPHS = {
  E: ["11111", "10000", "11110", "10000", "11111"],
  B: ["111111", "100001", "111111", "100001", "111111"]
};

function drawGlyph(rgba, w, glyph, ox, oy, scale, r, g, b) {
  const rows = GLYPHS[glyph];
  const cols = rows[0].length;
  for (let gy = 0; gy < rows.length; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (rows[gy][gx] !== "1") continue;
      fillRect(rgba, w, ox + gx * scale, oy + gy * scale, ox + (gx + 1) * scale, oy + (gy + 1) * scale, r, g, b);
    }
  }
  return cols * scale;
}

function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  fillRect(rgba, size, 0, 0, size, size, 30, 64, 175);
  const m = Math.round(size * 0.08);
  fillRect(rgba, size, m, m, size - m, size - m, 37, 99, 235);
  const scale = Math.max(6, Math.round(size / 22));
  const gap = Math.round(scale * 1.6);
  const eW = GLYPHS.E[0].length * scale;
  const bW = GLYPHS.B[0].length * scale;
  const total = eW + gap + bW;
  const ox = Math.round((size - total) / 2);
  const oy = Math.round((size - 5 * scale) / 2 - size * 0.03);
  drawGlyph(rgba, size, "E", ox, oy, scale, 255, 255, 255);
  drawGlyph(rgba, size, "B", ox + eW + gap, oy, scale, 255, 255, 255);
  const barH = Math.max(4, Math.round(size * 0.06));
  fillRect(rgba, size, m, size - m - barH, size - m, size - m, 245, 158, 11);
  return rgba;
}

function makeMaskable(size) {
  const rgba = Buffer.alloc(size * size * 4);
  fillRect(rgba, size, 0, 0, size, size, 37, 99, 235);
  const innerSize = Math.round(size * 0.72);
  const inner = makeIcon(innerSize);
  const inset = Math.round((size - innerSize) / 2);
  for (let y = 0; y < innerSize; y++) {
    for (let x = 0; x < innerSize; x++) {
      const s = (y * innerSize + x) * 4;
      setPx(rgba, size, inset + x, inset + y, inner[s], inner[s + 1], inner[s + 2]);
    }
  }
  return rgba;
}

fs.mkdirSync(root, { recursive: true });
for (const [name, size, fn] of [
  ["apple-touch-icon.png", 180, makeIcon],
  ["icon-192.png", 192, makeIcon],
  ["icon-512.png", 512, makeIcon],
  ["icon-maskable-512.png", 512, makeMaskable]
]) {
  writePng(path.join(root, name), size, size, fn(size));
  console.log("wrote", name);
}
