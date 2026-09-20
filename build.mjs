#!/usr/bin/env node
// Renders every (or one) hotel config in hotels/ into docs/<slug>/ (EN) and docs/<slug>/ar/ (AR).
// Adding a new hotel requires only a new hotels/<slug>/config.json + hotels/<slug>/media/ — no template edits.
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderPage } from "./template/render.mjs";

const ROOT = process.cwd();
const CANONICAL_BASE = "https://hafez121.github.io/hotel-demos";

const argSlug = process.argv[2];
const hotelsDir = path.join(ROOT, "hotels");
const allSlugs = (await fs.readdir(hotelsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const slugs = argSlug ? [argSlug] : allSlugs;

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function ensureFonts() {
  const fontsOut = path.join(ROOT, "docs", "fonts");
  await fs.mkdir(fontsOut, { recursive: true });
  const specs = [
    { pkg: "@fontsource/fraunces/files/fraunces-latin-600-normal.woff2", out: "fraunces-latin-600-normal.woff2" },
    { pkg: "@fontsource/fraunces/files/fraunces-latin-700-normal.woff2", out: "fraunces-latin-700-normal.woff2" },
    { pkg: "@fontsource/figtree/files/figtree-latin-400-normal.woff2", out: "figtree-latin-400-normal.woff2" },
    { pkg: "@fontsource/figtree/files/figtree-latin-600-normal.woff2", out: "figtree-latin-600-normal.woff2" },
    { pkg: "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2", out: "ibm-plex-sans-arabic-arabic-400-normal.woff2" },
    { pkg: "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2", out: "ibm-plex-sans-arabic-arabic-600-normal.woff2" }
  ];
  for (const spec of specs) {
    const src = path.join(ROOT, "node_modules", spec.pkg);
    const dest = path.join(fontsOut, spec.out);
    if (fssync.existsSync(src)) await fs.copyFile(src, dest);
    else console.warn("Font source missing:", src);
  }
}

async function buildHotel(slug) {
  const hotelDir = path.join(hotelsDir, slug);
  const config = JSON.parse(await fs.readFile(path.join(hotelDir, "config.json"), "utf8"));
  const photosPath = path.join(hotelDir, "media", "photos.json");
  const photos = fssync.existsSync(photosPath) ? JSON.parse(await fs.readFile(photosPath, "utf8")) : [];

  const outDir = path.join(ROOT, "docs", slug);
  const outDirAr = path.join(outDir, "ar");
  await fs.mkdir(outDirAr, { recursive: true });

  for (const lang of ["en", "ar"]) {
    const html = renderPage({ config, lang, photos, canonicalBase: CANONICAL_BASE });
    const dest = lang === "en" ? path.join(outDir, "index.html") : path.join(outDirAr, "index.html");
    await fs.writeFile(dest, html);
  }

  // Copy per-hotel media (photos + video) alongside each language folder needs relative "media/" —
  // EN page is at docs/<slug>/index.html referencing "media/...", AR page at docs/<slug>/ar/index.html
  // also references "media/..." (relative), so mirror media under both.
  const mediaSrc = path.join(hotelDir, "media");
  if (fssync.existsSync(mediaSrc)) {
    await copyDir(mediaSrc, path.join(outDir, "media"));
    await copyDir(mediaSrc, path.join(outDirAr, "media"));
  }

  console.log(`Built ${slug}: docs/${slug}/ (en), docs/${slug}/ar/ (ar)`);
}

async function buildShared() {
  await copyDir(path.join(ROOT, "template", "css"), path.join(ROOT, "docs", "_shared_css_tmp"));
  // main.css imports tokens.css by relative path; ship both flattened at docs root as main.css + tokens.css
  await fs.copyFile(path.join(ROOT, "template", "css", "main.css"), path.join(ROOT, "docs", "main.css"));
  await fs.copyFile(path.join(ROOT, "template", "css", "tokens.css"), path.join(ROOT, "docs", "tokens.css"));
  await fs.rm(path.join(ROOT, "docs", "_shared_css_tmp"), { recursive: true, force: true });

  await fs.copyFile(path.join(ROOT, "template", "js", "main.js"), path.join(ROOT, "docs", "main.js"));
  await copyDir(path.join(ROOT, "template", "assets"), path.join(ROOT, "docs", "assets"));
  await ensureFonts();

  // favicon + apple-touch-icon at docs root (shared brand assets)
  const faviconSrc = path.join(ROOT, "template", "assets", "logo-mark.svg");
  await fs.copyFile(faviconSrc, path.join(ROOT, "docs", "favicon.svg"));

  const svgBuf = await fs.readFile(faviconSrc);
  await sharp(svgBuf, { density: 384 }).resize(32, 32).png().toFile(path.join(ROOT, "docs", "favicon-32.png"));
  await sharp(svgBuf, { density: 384 }).resize(180, 180).png().toFile(path.join(ROOT, "docs", "apple-touch-icon.png"));
}

await buildShared();
for (const slug of slugs) {
  await buildHotel(slug);
}
console.log("Build complete.");
