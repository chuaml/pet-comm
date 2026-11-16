import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(process.cwd(), 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function encodeRgbaPng(width, height, pixels) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderPawIcon(size, maskable = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.76 : 0.9;
  const center = size / 2;
  const radius = (size / 2) * 0.92;
  const corner = maskable ? 0 : size * 0.22;

  const ellipses = [
    { cx: 0.0, cy: 0.14, rx: 0.23, ry: 0.19 },
    { cx: -0.24, cy: -0.1, rx: 0.095, ry: 0.125 },
    { cx: -0.08, cy: -0.22, rx: 0.095, ry: 0.13 },
    { cx: 0.08, cy: -0.22, rx: 0.095, ry: 0.13 },
    { cx: 0.24, cy: -0.1, rx: 0.095, ry: 0.125 },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      let insideCard = true;
      if (!maskable) {
        const dx = Math.max(Math.abs(x + 0.5 - center) - (radius - corner), 0);
        const dy = Math.max(Math.abs(y + 0.5 - center) - (radius - corner), 0);
        insideCard = Math.hypot(dx, dy) <= corner;
      }

      if (!insideCard) {
        pixels[idx + 3] = 0;
        continue;
      }

      const nx = (x + 0.5 - center) / (size * scale);
      const ny = (y + 0.5 - center) / (size * scale);
      const ringDist = Math.hypot(nx, ny);

      let r = 0x00;
      let g = 0x57;
      let b = 0xb8;

      if (ringDist > 0.38 && ringDist < 0.43) {
        r = 0xff;
        g = 0xd6;
        b = 0x00;
      } else if (ringDist <= 0.38) {
        r = 0x0b;
        g = 0x1f;
        b = 0x3a;
      }

      for (const e of ellipses) {
        const ex = (nx - e.cx) / e.rx;
        const ey = (ny - e.cy) / e.ry;
        if (ex * ex + ey * ey <= 1) {
          r = 0xff;
          g = 0xd6;
          b = 0x00;
          break;
        }
      }

      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
  return encodeRgbaPng(size, size, pixels);
}

writeFileSync(join(OUT_DIR, 'icon-192.png'), renderPawIcon(192, false));
writeFileSync(join(OUT_DIR, 'icon-512.png'), renderPawIcon(512, false));
writeFileSync(join(OUT_DIR, 'icon-maskable-512.png'), renderPawIcon(512, true));
writeFileSync(join(OUT_DIR, 'apple-touch-icon.png'), renderPawIcon(180, true));

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0057B8"/>
  <circle cx="64" cy="64" r="49" fill="#0B1F3A" stroke="#FFD600" stroke-width="6"/>
  <g fill="#FFD600">
    <ellipse cx="64" cy="78" rx="22" ry="18"/>
    <ellipse cx="40" cy="54" rx="9" ry="12"/>
    <ellipse cx="56" cy="42" rx="9" ry="13"/>
    <ellipse cx="72" cy="42" rx="9" ry="13"/>
    <ellipse cx="88" cy="54" rx="9" ry="12"/>
  </g>
</svg>
`;
writeFileSync(join(OUT_DIR, 'favicon.svg'), svgIcon, 'utf8');
