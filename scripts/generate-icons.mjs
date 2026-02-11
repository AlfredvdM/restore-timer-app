#!/usr/bin/env node
/**
 * Generate app icons for electron-builder.
 *
 * Renders the RESTORE Timer clock icon at multiple sizes,
 * then produces:
 *   build/icon.png      (1024x1024 — source)
 *   build/icon.icns     (macOS — via iconutil)
 *   build/icon.ico      (Windows — raw ICO binary)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, "..", "build");

// ── Drawing primitives (same logic as electron/main.ts) ──────

function drawPixel(buf, size, x, y, r, g, b, a) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= size || iy < 0 || iy >= size) return;
  const idx = (iy * size + ix) * 4;
  const na = Math.min(255, Math.round(a));
  if (na === 0) return;
  const ea = buf[idx + 3];
  if (ea === 0 || na === 255) {
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = na;
  } else {
    const frac = na / 255;
    const inv = 1 - frac;
    buf[idx] = Math.round(r * frac + buf[idx] * inv);
    buf[idx + 1] = Math.round(g * frac + buf[idx + 1] * inv);
    buf[idx + 2] = Math.round(b * frac + buf[idx + 2] * inv);
    buf[idx + 3] = Math.min(255, Math.round(na + ea * inv));
  }
}

function fillCircle(buf, size, cx, cy, radius, r, g, b) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius + 1) {
        const alpha = dist <= radius ? 255 : Math.round((1 - (dist - radius)) * 255);
        drawPixel(buf, size, x, y, r, g, b, alpha);
      }
    }
  }
}

function drawRing(buf, size, cx, cy, radius, thickness, r, g, b) {
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= inner - 1 && dist <= outer + 1) {
        let alpha = 255;
        if (dist < inner) alpha = Math.round((1 - (inner - dist)) * 255);
        else if (dist > outer) alpha = Math.round((1 - (dist - outer)) * 255);
        drawPixel(buf, size, x, y, r, g, b, alpha);
      }
    }
  }
}

function drawLine(buf, size, x0, y0, x1, y1, thickness, r, g, b) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 3);
  const half = thickness / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    for (let oy = -Math.ceil(half); oy <= Math.ceil(half); oy++) {
      for (let ox = -Math.ceil(half); ox <= Math.ceil(half); ox++) {
        const d = Math.sqrt(ox * ox + oy * oy);
        if (d <= half + 0.5) {
          const alpha = d <= half ? 255 : Math.round((1 - (d - half)) * 255);
          drawPixel(buf, size, Math.round(px + ox), Math.round(py + oy), r, g, b, alpha);
        }
      }
    }
  }
}

// Rounded-rect fill for the icon background
function fillRoundedRect(buf, size, x, y, w, h, radius, r, g, b) {
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      if (px < x || px >= x + w || py < y || py >= y + h) continue;
      // Check corners
      let dist = 0;
      const lx = x + radius, rx = x + w - radius;
      const ty = y + radius, by = y + h - radius;
      if (px < lx && py < ty) dist = Math.sqrt((px - lx) ** 2 + (py - ty) ** 2) - radius;
      else if (px >= rx && py < ty) dist = Math.sqrt((px - rx) ** 2 + (py - ty) ** 2) - radius;
      else if (px < lx && py >= by) dist = Math.sqrt((px - lx) ** 2 + (py - by) ** 2) - radius;
      else if (px >= rx && py >= by) dist = Math.sqrt((px - rx) ** 2 + (py - by) ** 2) - radius;
      else dist = -1;
      if (dist <= 0) {
        drawPixel(buf, size, px, py, r, g, b, 255);
      } else if (dist < 1.5) {
        drawPixel(buf, size, px, py, r, g, b, Math.round((1 - dist / 1.5) * 255));
      }
    }
  }
}

// ── Render the icon at a given size ──────────────────────────

function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 256;

  // Rounded-rect background (emerald) — macOS style rounded square
  const pad = Math.round(8 * scale);
  const cornerR = Math.round(48 * scale);
  fillRoundedRect(buf, size, pad, pad, size - pad * 2, size - pad * 2, cornerR, 5, 150, 105);

  // White clock face
  fillCircle(buf, size, cx, cy, 80 * scale, 255, 255, 255);
  // Clock ring (darker emerald)
  drawRing(buf, size, cx, cy, 80 * scale, 7 * scale, 4, 120, 87);

  // Hour marks at 12, 3, 6, 9
  const markLen = 14 * scale;
  const markDist = 70 * scale;
  const markThick = 5 * scale;
  drawLine(buf, size, cx, cy - markDist, cx, cy - markDist + markLen, markThick, 4, 120, 87);
  drawLine(buf, size, cx + markDist, cy, cx + markDist - markLen, cy, markThick, 4, 120, 87);
  drawLine(buf, size, cx, cy + markDist, cx, cy + markDist - markLen, markThick, 4, 120, 87);
  drawLine(buf, size, cx - markDist, cy, cx - markDist + markLen, cy, markThick, 4, 120, 87);

  // Hour hand (~10 o'clock)
  drawLine(buf, size, cx, cy, cx - 20 * scale, cy - 36 * scale, 8 * scale, 5, 150, 105);
  // Minute hand (~12 o'clock)
  drawLine(buf, size, cx, cy, cx + 12 * scale, cy - 56 * scale, 6 * scale, 5, 150, 105);
  // Center dot
  fillCircle(buf, size, cx, cy, 8 * scale, 5, 150, 105);
  // Stopwatch nub
  drawLine(buf, size, cx, cy - 82 * scale, cx, cy - 100 * scale, 8 * scale, 4, 120, 87);
  fillCircle(buf, size, cx, cy - 103 * scale, 9 * scale, 4, 120, 87);

  return buf;
}

// ── PNG encoder (minimal, no dependencies) ───────────────────

function createPNG(buf, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    let c = crc32(Buffer.concat([typeB, data]));
    crc.writeUInt32BE(c >>> 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT — raw image data with filter byte (0 = None) per row
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(Buffer.from([0])); // filter: None
    rawRows.push(buf.subarray(y * width * 4, (y + 1) * width * 4));
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", iend),
  ]);
}

// CRC32 for PNG chunks
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── ICO file builder ─────────────────────────────────────────

function createICO(pngBuffers) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngBuffers.length, 4); // count

  // Each directory entry: 16 bytes
  const dirSize = pngBuffers.length * 16;
  let offset = 6 + dirSize;

  const entries = [];
  for (const { size, png } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width (0 = 256)
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // color palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // size of PNG data
    entry.writeUInt32LE(offset, 12); // offset
    offset += png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.png)]);
}

// ── Main ─────────────────────────────────────────────────────

console.log("Generating icons...");

fs.mkdirSync(BUILD_DIR, { recursive: true });

// 1. Render 1024x1024 source PNG
const buf1024 = renderIcon(1024);
const png1024 = createPNG(buf1024, 1024, 1024);
fs.writeFileSync(path.join(BUILD_DIR, "icon.png"), png1024);
console.log("  build/icon.png (1024x1024)");

// 2. Create .icns via iconutil (macOS only)
const iconsetDir = path.join(BUILD_DIR, "icon.iconset");
fs.mkdirSync(iconsetDir, { recursive: true });

const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
for (const s of icnsSizes) {
  const buf = renderIcon(s);
  const png = createPNG(buf, s, s);
  if (s <= 512) {
    fs.writeFileSync(path.join(iconsetDir, `icon_${s}x${s}.png`), png);
  }
  // @2x variants
  const half = s / 2;
  if (half >= 16 && half <= 512) {
    fs.writeFileSync(path.join(iconsetDir, `icon_${half}x${half}@2x.png`), png);
  }
}

try {
  execSync(`iconutil -c icns -o "${path.join(BUILD_DIR, "icon.icns")}" "${iconsetDir}"`, {
    stdio: "pipe",
  });
  console.log("  build/icon.icns");
} catch (e) {
  console.log("  SKIP icon.icns (iconutil not available — macOS only)");
}

// Cleanup iconset
fs.rmSync(iconsetDir, { recursive: true, force: true });

// 3. Create .ico (16, 32, 48, 64, 128, 256)
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoPngs = icoSizes.map((s) => {
  const buf = renderIcon(s);
  return { size: s, png: createPNG(buf, s, s) };
});
const ico = createICO(icoPngs);
fs.writeFileSync(path.join(BUILD_DIR, "icon.ico"), ico);
console.log("  build/icon.ico");

console.log("Done!");
