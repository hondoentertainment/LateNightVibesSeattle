#!/usr/bin/env node

/**
 * build.js — Lightweight esbuild-based build step.
 *
 * Minifies JS and CSS files into dist/, copies HTML and static assets.
 * The source files remain untouched so `npx serve .` still works for dev.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/** Collect files matching extensions in a directory (non-recursive). */
function filesWithExt(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => exts.some(ext => f.endsWith(ext)))
    .map(f => path.join(dir, f));
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

async function build() {
  const start = Date.now();

  // Clean dist/
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  ensureDir(DIST);

  // ---- Minify JS ----
  const rootJS = filesWithExt(__dirname, ['.js']).filter(f => {
    const name = path.basename(f);
    // Skip build tooling, config, and test infrastructure
    return !['build.js', 'eslint.config.js', 'vitest.config.js', 'playwright.config.js'].includes(name);
  });
  const libJS = filesWithExt(path.join(__dirname, 'lib'), ['.js']);
  const allJS = [...rootJS, ...libJS];

  for (const file of allJS) {
    const rel = path.relative(__dirname, file);
    const outfile = path.join(DIST, rel);
    ensureDir(path.dirname(outfile));
    await esbuild.build({
      entryPoints: [file],
      outfile,
      minify: true,
      platform: 'browser',
      target: ['es2020'],
      // Keep files as standalone scripts (no bundling of imports)
      bundle: false,
    });
  }

  // ---- Minify CSS ----
  const rootCSS = filesWithExt(__dirname, ['.css']);
  for (const file of rootCSS) {
    const rel = path.relative(__dirname, file);
    const outfile = path.join(DIST, rel);
    await esbuild.build({
      entryPoints: [file],
      outfile,
      minify: true,
      bundle: false,
    });
  }

  // ---- Copy HTML ----
  const htmlFiles = filesWithExt(__dirname, ['.html']);
  for (const file of htmlFiles) {
    copyFile(file, path.join(DIST, path.basename(file)));
  }

  // ---- Copy static assets ----
  const staticFiles = [
    'manifest.json',
    'robots.txt',
    'sitemap.xml',
    'favicon.png',
    'favicon-512.png',
    'favicon-original.png',
    'lnv-logo.png',
    'lnv-logo-original.png',
    'og-image.png',
    'venue_list.csv',
    'venue_list_500plus.csv',
    'seattle_after_9pm_from_little_red_hen_500plus_with_vibes.xlsx',
    'vercel.json',
    'config.example.js',
  ];
  for (const name of staticFiles) {
    const src = path.join(__dirname, name);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(DIST, name));
    }
  }

  // Copy config.js if it exists (gitignored, but needed at runtime)
  const configSrc = path.join(__dirname, 'config.js');
  if (fs.existsSync(configSrc)) {
    copyFile(configSrc, path.join(DIST, 'config.js'));
  }

  // Copy directories
  const staticDirs = ['data', 'splash'];
  for (const dir of staticDirs) {
    const src = path.join(__dirname, dir);
    if (fs.existsSync(src)) {
      copyDirRecursive(src, path.join(DIST, dir));
    }
  }

  const elapsed = Date.now() - start;
  const jsCount = allJS.length;
  const cssCount = rootCSS.length;
  console.log(`Build complete in ${elapsed}ms — ${jsCount} JS files, ${cssCount} CSS files minified → dist/`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
