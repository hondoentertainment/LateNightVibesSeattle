#!/usr/bin/env node
/**
 * Optimize favicon and logo images for web.
 * Run: npm run optimize:images
 * Requires: npm install --save-dev sharp
 * Target: favicon < 20KB, logo < 50KB
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const FILES = [
  { input: "favicon.png", output: "favicon.png", maxWidth: 64, quality: 90 },
  { input: "favicon-512.png", output: "favicon-512.png", maxWidth: 512, quality: 85 },
  { input: "lnv-logo.png", output: "lnv-logo.png", maxWidth: 256, quality: 85 },
];

async function optimize() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch (_) {
    console.error("Install sharp: npm install --save-dev sharp");
    process.exit(1);
  }

  for (const { input, output, maxWidth, quality } of FILES) {
    const path = join(root, input);
    if (!existsSync(path)) {
      console.warn("Skip (missing):", input);
      continue;
    }
    try {
      const buf = readFileSync(path);
      const before = buf.length;
      const result = await sharp(buf)
        .resize(maxWidth, null, { withoutEnlargement: true })
        .png({ quality })
        .toBuffer();
      const after = result.length;
      writeFileSync(join(root, output), result);
      console.log(`${input}: ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB`);
    } catch (err) {
      console.error("Error optimizing", input, err.message);
    }
  }
}

optimize();
