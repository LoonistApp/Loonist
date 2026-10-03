/**
 * Rasterizes the LOONIST brand mark (the hexagon-with-center-dot CAD glyph
 * already used as the in-app system-menu logo in RibbonBar.tsx) into a PNG,
 * for use as the Electron window/taskbar icon. Hand-rolls the PNG encoding
 * with Node's built-in zlib so no new dependency (sharp/canvas) is needed
 * just to produce one static icon asset.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIZE = 256;
const BG = [0x00, 0x8b, 0xa3]; // #008ba3, the cyan used by the in-app logo button
const FG = [0xff, 0xff, 0xff];

// Regular hexagon, pointy-top, matching the proportions of the existing glyph's
// SVG path (outer circumradius : inner circumradius : dot radius ~= 10 : 7.6 : 3).
const cx = SIZE / 2;
const cy = SIZE / 2;
const outerR = SIZE * 0.42;
const innerR = outerR * 0.76;
const dotR = outerR * 0.3;

function hexVertices(r) {
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3;
    verts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return verts;
}

function insideConvexPolygon(px, py, verts) {
  let sign = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
    if (cross !== 0) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

const outerHex = hexVertices(outerR);
const innerHex = hexVertices(innerR);

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4)); // 1 filter-type byte + RGBA per row
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0; // filter type: None
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5;
    const py = y + 0.5;
    const inRing = insideConvexPolygon(px, py, outerHex) && !insideConvexPolygon(px, py, innerHex);
    const dx = px - cx;
    const dy = py - cy;
    const inDot = dx * dx + dy * dy <= dotR * dotR;
    const [r, g, b] = inRing || inDot ? FG : BG;
    const o = rowStart + 1 + x * 4;
    raw[o] = r;
    raw[o + 1] = g;
    raw[o + 2] = b;
    raw[o + 3] = 255;
  }
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const idat = deflateSync(raw);
const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
]);

const outPath = path.join(__dirname, '..', 'public', 'icon-256.png');
writeFileSync(outPath, png);
console.log(`LOONIST app icon written to ${outPath} (${png.length} bytes)`);
