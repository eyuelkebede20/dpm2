import fs from "fs";
import path from "path";
import zlib from "zlib";

const publicIconsDir = path.join(process.cwd(), "public", "icons");
if (!fs.existsSync(publicIconsDir)) {
  fs.mkdirSync(publicIconsDir, { recursive: true });
}

// 1. Generate crisp SVG Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#3730a3" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#4f46e5" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Background with rounded corners -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="#334155" stroke-width="4" stroke-opacity="0.6" />

  <!-- Shield Shape / Emblem -->
  <g filter="url(#glow)">
    <path d="M 256,80 L 390,140 C 390,260 256,380 256,380 C 256,380 122,260 122,140 Z" fill="url(#accentGrad)" />
    <path d="M 256,100 L 370,152 C 370,250 256,355 256,355 C 256,355 142,250 142,152 Z" fill="#1e1b4b" opacity="0.4" />
  </g>

  <!-- Munitions / Gear / Caliber Silhouette in center -->
  <g fill="url(#goldGrad)">
    <!-- Cartridge / Projectile -->
    <path d="M 256,130 C 244,145 238,175 238,205 L 238,275 L 274,275 L 274,205 C 274,175 268,145 256,130 Z" />
    <!-- Primer / Rim base -->
    <rect x="232" y="278" width="48" height="12" rx="3" fill="#fbbf24" />
    <rect x="230" y="293" width="52" height="7" rx="2" fill="#d97706" />
  </g>

  <!-- Stylized Industrial Lines -->
  <circle cx="256" cy="225" r="75" fill="none" stroke="#e0e7ff" stroke-width="4" stroke-dasharray="12 12" opacity="0.6" />

  <!-- Brand Typography -->
  <text x="256" y="445" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">DPM</text>
  <text x="256" y="475" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="2">HOMICHO AMMUNITION</text>
</svg>`;

fs.writeFileSync(path.join(publicIconsDir, "icon.svg"), svgIcon);
console.log("✓ Created public/icons/icon.svg");

// 2. Helper to generate valid binary PNG
function createPng(width, height, drawFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ -1);
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Pixel drawer for high quality brand icon
function brandIconDrawer(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background
  const bgR = 15 + Math.floor((x / w) * 15);
  const bgG = 23 + Math.floor((y / h) * 18);
  const bgB = 42 + Math.floor((x / w) * 17);

  // Rounded rect radius for standard icon, full for maskable
  if (!isMaskable) {
    const cornerR = w * 0.22;
    const inBoxX = Math.abs(dx) > (w / 2 - cornerR);
    const inBoxY = Math.abs(dy) > (h / 2 - cornerR);
    if (inBoxX && inBoxY) {
      const cdx = Math.abs(dx) - (w / 2 - cornerR);
      const cdy = Math.abs(dy) - (h / 2 - cornerR);
      if (cdx * cdx + cdy * cdy > cornerR * cornerR) {
        return [0, 0, 0, 0]; // Transparent outer corner
      }
    }
  }

  // Inner Shield / Emblem
  const shieldScale = isMaskable ? 0.38 : 0.44;
  const inShieldY = y > h * 0.16 && y < h * 0.78;
  const halfWidthAtY = (1 - Math.max(0, (y - h * 0.35) / (h * 0.43))) * (w * shieldScale);
  if (inShieldY && Math.abs(dx) < Math.max(w * 0.05, halfWidthAtY)) {
    // Inside shield: Indigo / purple gradient
    const t = (y - h * 0.16) / (h * 0.62);
    const shR = Math.floor(99 * (1 - t) + 79 * t);
    const shG = Math.floor(102 * (1 - t) + 70 * t);
    const shB = Math.floor(241 * (1 - t) + 229 * t);

    // Bullet / projectile in center
    const inBullet = Math.abs(dx) < w * 0.06 && y > h * 0.28 && y < h * 0.60;
    if (inBullet) {
      // Gold gradient
      return [251, 191, 36, 255];
    }

    return [shR, shG, shB, 255];
  }

  // Thin outer border
  if (!isMaskable && (x === 0 || x === w - 1 || y === 0 || y === h - 1)) {
    return [51, 65, 85, 200];
  }

  return [bgR, bgG, bgB, 255];
}

// Generate Icons
const icon192 = createPng(192, 192, (x, y, w, h) => brandIconDrawer(x, y, w, h, false));
fs.writeFileSync(path.join(publicIconsDir, "icon-192.png"), icon192);
console.log("✓ Created public/icons/icon-192.png (192x192)");

const icon512 = createPng(512, 512, (x, y, w, h) => brandIconDrawer(x, y, w, h, false));
fs.writeFileSync(path.join(publicIconsDir, "icon-512.png"), icon512);
console.log("✓ Created public/icons/icon-512.png (512x512)");

const iconMaskable = createPng(512, 512, (x, y, w, h) => brandIconDrawer(x, y, w, h, true));
fs.writeFileSync(path.join(publicIconsDir, "icon-maskable.png"), iconMaskable);
console.log("✓ Created public/icons/icon-maskable.png (512x512 maskable)");

const appleTouchIcon = createPng(180, 180, (x, y, w, h) => brandIconDrawer(x, y, w, h, false));
fs.writeFileSync(path.join(publicIconsDir, "apple-touch-icon.png"), appleTouchIcon);
console.log("✓ Created public/icons/apple-touch-icon.png (180x180)");

console.log("🎨 All PWA icon assets generated successfully!");
