/*
 * Regenerates icons/icon-*.png. Run with: node tools/make-icons.js
 *
 * Chrome will not accept SVG action icons, so the mark (a ring with a slash
 * through it on a rounded square) is rasterised here with 4x supersampling.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---- minimal PNG writer ------------------------------------------------ */

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---- the mark ---------------------------------------------------------- */

const SAMPLES = 4;

// Coordinates below are fractions of the icon size.
const CORNER = 0.22;
const RING_OUTER = 0.345;
const RING_INNER = 0.235;
const SLASH_HALF_WIDTH = 0.052;
const SLASH_HALF_LENGTH = 0.30;

function insideRoundedSquare(x, y) {
  const r = CORNER;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideMark(x, y) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const dist = Math.hypot(dx, dy);
  if (dist >= RING_INNER && dist <= RING_OUTER) return true;
  // Slash along the 45 degree diagonal.
  const along = (dx + dy) / Math.SQRT2;
  const across = (dx - dy) / Math.SQRT2;
  return Math.abs(across) <= SLASH_HALF_WIDTH && Math.abs(along) <= SLASH_HALF_LENGTH;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;
          if (!insideRoundedSquare(x, y)) continue;
          bg++;
          if (insideMark(x, y)) fg++;
        }
      }
      const total = SAMPLES * SAMPLES;
      const alpha = bg / total;
      const mark = bg ? fg / bg : 0;
      // Indigo to violet, top to bottom.
      const t = py / Math.max(1, size - 1);
      const base = [
        Math.round(79 + (124 - 79) * t),
        Math.round(70 + (58 - 70) * t),
        Math.round(229 + (237 - 229) * t),
      ];
      const offset = (py * size + px) * 4;
      rgba[offset + 0] = Math.round(base[0] * (1 - mark) + 255 * mark);
      rgba[offset + 1] = Math.round(base[1] * (1 - mark) + 255 * mark);
      rgba[offset + 2] = Math.round(base[2] * (1 - mark) + 255 * mark);
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, render(size));
  console.log('wrote', path.relative(path.join(__dirname, '..'), file));
}
