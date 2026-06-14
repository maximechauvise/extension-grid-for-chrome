/**
 * Génère des icônes PNG simples pour l'extension Grid Tab.
 * Usage : node tools/generate-icons.js
 * Nécessite Node.js uniquement (zlib natif).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'grid-tab', 'icons');

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBytes, data]));
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc)]);
}

function makePNG(size, r, g, b) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT : raw scanlines (filter byte 0 + RGB per pixel)
  const scanline = Buffer.alloc(1 + size * 3);
  scanline[0] = 0; // filter None
  for (let x = 0; x < size; x++) {
    // Dessin d'une grille 2×2 simplifiée au centre
    const margin = Math.floor(size * 0.15);
    const mid = Math.floor(size / 2);
    const gap = Math.max(1, Math.floor(size * 0.06));

    const inGrid = x >= margin && x < size - margin;
    const isSep = Math.abs(x - mid) <= gap / 2;

    scanline[1 + x * 3] = inGrid && !isSep ? r : Math.floor(r * 0.55);
    scanline[1 + x * 3 + 1] = inGrid && !isSep ? g : Math.floor(g * 0.55);
    scanline[1 + x * 3 + 2] = inGrid && !isSep ? b : Math.floor(b * 0.55);
  }

  const rows = [];
  for (let y = 0; y < size; y++) {
    const margin = Math.floor(size * 0.15);
    const mid = Math.floor(size / 2);
    const gap = Math.max(1, Math.floor(size * 0.06));
    const inGrid = y >= margin && y < size - margin;
    const isSep = Math.abs(y - mid) <= gap / 2;

    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const xMargin = Math.floor(size * 0.15);
      const xMid = Math.floor(size / 2);
      const xGap = Math.max(1, Math.floor(size * 0.06));
      const xInGrid = x >= xMargin && x < size - xMargin;
      const xIsSep = Math.abs(x - xMid) <= xGap / 2;

      const lit = inGrid && xInGrid && !isSep && !xIsSep;
      row[1 + x * 3] = lit ? r : Math.floor(r * 0.45);
      row[1 + x * 3 + 1] = lit ? g : Math.floor(g * 0.45);
      row[1 + x * 3 + 2] = lit ? b : Math.floor(b * 0.45);
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw);

  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = [16, 48, 128];
// Violet clair (203, 166, 247) sur fond sombre (30, 30, 46)
SIZES.forEach((size) => {
  const png = makePNG(size, 203, 166, 247);
  const out = path.join(OUT_DIR, `${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`Créé : ${out}`);
});

console.log('Icônes générées avec succès.');
