#!/usr/bin/env node
// Verifies the built site (video, parallax, links, layout, screenshots).
// Usage: node scripts/verify.mjs [baseUrl]  (default: http://localhost:8090)
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const BASE = process.argv[2] || "http://localhost:8090";
const SLUG = "le-blanc-bleu";
const VERIFY_DIR = path.join(ROOT, "verify");
await fs.mkdir(VERIFY_DIR, { recursive: true });

const EXPECTED_DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=34.0823777,35.6484422&destination_place_id=ChIJ_W06iXxDHxURGZwDWFC7d0A";

let failures = [];
function check(label, cond) {
  if (cond) console.log(`  ok  ${label}`);
  else {
    console.log(`  FAIL  ${label}`);
    failures.push(label);
  }
}

const browser = await chromium.launch();

async function checkExternalLinks(page, label) {
  const hrefs = await page.$$eval("a[href^='http']", (as) => as.map((a) => a.href));
  const uniq = [...new Set(hrefs)];
  for (const url of uniq) {
    let status = null;
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      status = res.status;
      if (status === 405 || status === 501) {
        const res2 = await fetch(url, { method: "GET", redirect: "follow" });
        status = res2.status;
      }
    } catch (e) {
      status = `error: ${e.message}`;
    }
    check(`[${label}] external link ${url} -> ${status}`, status === 200 || status === 999 /* linkedin-style bot block */);
  }
}

async function runForLang(lang) {
  const url = lang === "en" ? `${BASE}/${SLUG}/` : `${BASE}/${SLUG}/ar/`;
  console.log(`\n=== ${lang.toUpperCase()} ${url} ===`);

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(500);

  // Video checks
  const videoInfo = await page.$eval("#hero-video", (v) => ({
    exists: true,
    hasPoster: !!v.getAttribute("poster"),
    muted: v.muted,
    loop: v.loop,
    paused: v.paused
  }));
  check(`[${lang}] video element exists`, videoInfo.exists);
  check(`[${lang}] video has poster attribute`, videoInfo.hasPoster);
  check(`[${lang}] video is muted`, videoInfo.muted);
  check(`[${lang}] video has loop attribute`, videoInfo.loop);

  const t0 = await page.$eval("#hero-video", (v) => v.currentTime);
  await page.waitForTimeout(2200);
  const t1 = await page.$eval("#hero-video", (v) => v.currentTime);
  check(`[${lang}] video currentTime advances (t0=${t0.toFixed(2)} t1=${t1.toFixed(2)})`, t1 > t0);

  // Parallax checks (normal motion)
  const before = await page.$eval(".hero__content", (el) => getComputedStyle(el).transform);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  const after = await page.$eval(".hero__content", (el) => getComputedStyle(el).transform);
  check(`[${lang}] parallax transform differs after scroll (before=${before} after=${after})`, before !== after);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Links
  const waHref = await page.$eval(".btn--primary[href^='https://wa.me/']", (a) => a.getAttribute("href"));
  check(`[${lang}] wa.me href well-formed`, /^https:\/\/wa\.me\/9613664844\?text=/.test(waHref));
  const telHref = await page.$eval("a[href^='tel:']", (a) => a.getAttribute("href"));
  check(`[${lang}] tel href well-formed`, telHref === "tel:+9613664844");
  const dirHref = await page.$eval(`a[href*="google.com/maps/dir"]`, (a) => a.getAttribute("href"));
  check(`[${lang}] directions URL matches exactly`, dirHref === EXPECTED_DIRECTIONS_URL);

  await checkExternalLinks(page, lang);

  // No console errors
  check(`[${lang}] no console errors (found ${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")})`, consoleErrors.length === 0);

  // Screenshots desktop
  await page.screenshot({ path: path.join(VERIFY_DIR, `${lang}-1440x900.png`) });

  await context.close();

  // Mobile viewport: overflow + screenshot
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(url, { waitUntil: "load" });
  await mobilePage.waitForTimeout(500);
  const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(`[${lang}] no horizontal overflow at 390px`, !overflow);
  await mobilePage.screenshot({ path: path.join(VERIFY_DIR, `${lang}-390x844.png`) });
  await mobileContext.close();
}

async function runReducedMotion() {
  console.log(`\n=== Reduced motion (EN) ===`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${BASE}/${SLUG}/`, { waitUntil: "load" });
  await page.waitForTimeout(500);

  const paused = await page.$eval("#hero-video", (v) => v.paused);
  check("[reduced-motion] video is paused", paused);

  const before = await page.$eval(".hero__content", (el) => getComputedStyle(el).transform);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  const after = await page.$eval(".hero__content", (el) => getComputedStyle(el).transform);
  const isIdentity = (t) => t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)";
  check(`[reduced-motion] hero transform stays identity/none (before=${before} after=${after})`, isIdentity(before) && isIdentity(after));

  await context.close();
}

await runForLang("en");
await runForLang("ar");
await runReducedMotion();

await browser.close();

console.log(`\n=== Summary ===`);
if (failures.length === 0) {
  console.log("All checks passed.");
} else {
  console.log(`${failures.length} check(s) failed:`);
  failures.forEach((f) => console.log(" - " + f));
  process.exitCode = 1;
}
