// Renders the iOS home-screen icon (iOS ignores SVG apple-touch-icons). No dependencies.
// Usage: node scripts/make-icon.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const S = 180;
const SS = 4; // supersampling for anti-aliasing

// Implicit heart: (x² + y² − 1)³ − x²y³ ≤ 0
const inHeart = (x, y) => {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
};

const rows = [];
for (let py = 0; py < S; py++) {
  const row = [0]; // filter byte
  for (let px = 0; px < S; px++) {
    let hit = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const x = ((px + (sx + 0.5) / SS) / S - 0.5) * 4;
        const y = -((py + (sy + 0.5) / SS) / S - 0.52) * 4;
        if (inHeart(x, y)) hit++;
      }
    const v = Math.round((hit / (SS * SS)) * 255); // white heart on black (iOS rounds corners itself)
    row.push(v, v, v);
  }
  rows.push(Buffer.from(row));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(Buffer.concat(rows))),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), png);
console.log('wrote public/apple-touch-icon.png', png.length, 'bytes');
