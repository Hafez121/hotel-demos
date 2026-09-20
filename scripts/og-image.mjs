#!/usr/bin/env node
// Renders a 1200x630 Open Graph image per hotel from its poster frame + wordmark.
// Usage: node scripts/og-image.mjs <slug>
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/og-image.mjs <slug>");
  process.exit(1);
}

const hotelDir = path.join(ROOT, "hotels", slug);
const config = JSON.parse(await fs.readFile(path.join(hotelDir, "config.json"), "utf8"));
const posterPath = path.join(hotelDir, "media", "poster.jpg");
const posterBuf = await fs.readFile(posterPath);
const posterDataUrl = `data:image/jpeg;base64,${posterBuf.toString("base64")}`;
const wordmarkSvg = await fs.readFile(path.join(ROOT, "template", "assets", "wordmark.svg"), "utf8");
const frauncesBuf = await fs.readFile(path.join(ROOT, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff2"));
const figtreeBuf = await fs.readFile(path.join(ROOT, "node_modules/@fontsource/figtree/files/figtree-latin-500-normal.woff2"));
const frauncesDataUrl = `data:font/woff2;base64,${frauncesBuf.toString("base64")}`;
const figtreeDataUrl = `data:font/woff2;base64,${figtreeBuf.toString("base64")}`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Fraunces"; src: url("${frauncesDataUrl}") format("woff2"); font-weight: 600; }
  @font-face { font-family: "Figtree"; src: url("${figtreeDataUrl}") format("woff2"); font-weight: 500; }
  html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden;font-family:"Figtree",sans-serif}
  .stage{position:relative;width:1200px;height:630px;background:#0E2A47;}
  .stage img.bg{position:absolute;inset:0;width:1200px;height:630px;object-fit:cover;opacity:0.55}
  .scrim{position:absolute;inset:0;background:linear-gradient(180deg, rgba(14,42,71,0.35) 0%, rgba(14,42,71,0.85) 100%);}
  .content{position:absolute;left:80px;bottom:70px;color:#fff;}
  .content .wordmark{background:#F7F6F2;padding:18px 26px;border-radius:16px;display:inline-block;margin-bottom:22px;}
  .content .wordmark svg{display:block;height:44px;width:auto;}
  .content .wordmark svg text{font-family:"Fraunces",serif !important;}
  .content .tagline{font-family:"Figtree",sans-serif;font-size:30px;max-width:820px;line-height:1.35;font-weight:500;text-shadow:0 2px 12px rgba(0,0,0,0.35)}
</style></head>
<body>
  <div class="stage">
    <img class="bg" src="${posterDataUrl}">
    <div class="scrim"></div>
    <div class="content">
      <div class="wordmark">${wordmarkSvg}</div>
      <div class="tagline">${config.tagline.en}</div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "load" });
const outPath = path.join(hotelDir, "media", "og.jpg");
await page.screenshot({ path: outPath, type: "jpeg", quality: 90 });
await browser.close();
console.log("OG image written to", outPath);
