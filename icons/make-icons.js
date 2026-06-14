/* Génère les icônes PNG (sans dépendance externe) à partir d'un dessin simple. */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let c, table = crc32.t || (crc32.t = (() => {
    const t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size) {
  const W = size, H = size;
  const buf = Buffer.alloc(W * H * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const cx = W / 2, cy = H / 2;
  const radius = W * 0.22; // rounded corner
  const inCorner = (x, y) => {
    // distance to nearest corner center for rounded rect
    const rx = Math.min(x, W - 1 - x), ry = Math.min(y, H - 1 - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx, dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inCorner(x, y)) { set(x, y, 0, 0, 0, 0); continue; }
      // gradient teal
      const t = (x + y) / (W + H);
      const r = Math.round(15 + (17 - 15) * t);
      const g = Math.round(118 + (94 - 118) * t);
      const b = Math.round(110 + (89 - 110) * t);
      set(x, y, r, g, b, 255);
    }
  }
  // outer ring
  const ringR = W * 0.30, ringW = W * 0.045;
  // compass triangle points
  const ax = cx, ay = cy - W * 0.21;
  const bx = cx + W * 0.10, by = cy + W * 0.09;
  const dx2 = cx - W * 0.13, dy2 = cy + W * 0.05;
  const sign = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inCorner(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - ringR) < ringW) set(x, y, 204, 251, 241, 255); // ring
      // triangle (filled white-ish)
      const s1 = sign(x, y, ax, ay, bx, by);
      const s2 = sign(x, y, bx, by, dx2, dy2);
      const s3 = sign(x, y, dx2, dy2, ax, ay);
      const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
      const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
      if (!(hasNeg && hasPos)) set(x, y, 236, 254, 255, 255);
      // center dot
      if (d < W * 0.035) set(x, y, 255, 255, 255, 255);
    }
  }
  return png(W, H, buf);
}

const dir = __dirname;
for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'icon-180.png' : `icon-${size}.png`;
  fs.writeFileSync(path.join(dir, name), draw(size));
  console.log('écrit', name);
}
