#!/usr/bin/env node
/**
 * Generate iOS splash screen images for PWA install.
 * Run: npm run generate:splash
 * Requires: npm install --save-dev sharp
 * Colors match app theme: #0b0d14 background, #2bff86 accent
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "splash");

const SIZES = [
  { w: 1170, h: 2532, media: "(device-width: 390px) and (device-height: 844px)" }, // iPhone 14/15
  { w: 1290, h: 2796, media: "(device-width: 430px) and (device-height: 932px)" }, // iPhone 15 Pro Max
  { w: 1242, h: 2688, media: "(device-width: 414px) and (device-height: 896px)" }, // iPhone XR/11
  { w: 1284, h: 2778, media: "(device-width: 428px) and (device-height: 926px)" }, // iPhone 12/13 Pro Max
  { w: 750, h: 1334, media: "(device-width: 375px) and (device-height: 667px)" },  // iPhone SE
];

const BG = "#0b0d14";
const ACCENT = "#2bff86";

async function generate() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch (_) {
    console.error("Install sharp: npm install --save-dev sharp");
    process.exit(1);
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const { w, h, media } of SIZES) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${BG}"/>
            <stop offset="100%" style="stop-color:#0e1118"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <circle cx="${w / 2}" cy="${h / 2}" r="60" fill="none" stroke="${ACCENT}" stroke-width="4" opacity="0.4"/>
      </svg>
    `;
    const buf = Buffer.from(svg);
    const pngPath = join(outDir, `splash-${w}x${h}.png`);
    await sharp(buf).png().toFile(pngPath);
    console.log(`Created ${pngPath}`);
  }
}

generate();
