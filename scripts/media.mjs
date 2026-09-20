#!/usr/bin/env node
// Downloads and processes all media for one hotel config into hotels/<slug>/media/.
// Usage: node scripts/media.mjs <slug>
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const ROOT = process.cwd();
const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/media.mjs <slug>");
  process.exit(1);
}

const hotelDir = path.join(ROOT, "hotels", slug);
const configPath = path.join(hotelDir, "config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

const cacheDir = path.join(ROOT, "media-cache", slug);
const outDir = path.join(hotelDir, "media");
const photosOut = path.join(outDir, "photos");

await fs.mkdir(cacheDir, { recursive: true });
await fs.mkdir(photosOut, { recursive: true });

const WIDTHS = [640, 1024, 1600];

async function download(url, dest) {
  if (fssync.existsSync(dest)) {
    console.log("cached:", path.basename(dest));
    return dest;
  }
  console.log("downloading:", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return dest;
}

// ---------- Photos ----------
async function processPhotos() {
  const files = config.media?.photoFiles || [];
  const manifest = [];
  for (const entry of files) {
    const srcUrl = `${config.media.photoSource}/${entry.file}`;
    const cachePath = path.join(cacheDir, entry.file);
    await download(srcUrl, cachePath);

    const meta = await sharp(cachePath).metadata();
    if (meta.width < 800) {
      console.log(`skip ${entry.file}: width ${meta.width} < 800`);
      continue;
    }
    const baseName = path.parse(entry.file).name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const variants = [];
    for (const w of WIDTHS) {
      const targetWidth = Math.min(w, meta.width);
      for (const format of ["avif", "webp"]) {
        const outName = `${baseName}-${targetWidth}.${format}`;
        const outPath = path.join(photosOut, outName);
        if (!fssync.existsSync(outPath)) {
          let pipeline = sharp(cachePath).resize({ width: targetWidth, withoutEnlargement: true });
          pipeline = format === "avif" ? pipeline.avif({ quality: 55 }) : pipeline.webp({ quality: 72 });
          await pipeline.toFile(outPath);
        }
        variants.push({ width: targetWidth, format, file: `photos/${outName}` });
      }
      if (targetWidth < w) break; // reached source resolution cap, don't repeat
    }
    manifest.push({
      id: baseName,
      alt: entry.alt,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      aspect: +(meta.width / meta.height).toFixed(4),
      variants
    });
  }
  await fs.writeFile(path.join(outDir, "photos.json"), JSON.stringify(manifest, null, 2));
  console.log(`processed ${manifest.length} photos`);
}

// ---------- Hero video ----------
async function processHeroVideo() {
  const hv = config.media?.heroVideo;
  if (!hv) return;
  const srcPath = path.join(cacheDir, "hero-source.mp4");
  await download(hv.sourceUrl, srcPath);

  const probe = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    srcPath
  ]);
  const sourceDuration = parseFloat(probe.stdout.trim());
  const LOOP_LEN = Math.min(12, Math.floor(sourceDuration - 0.5)); // seconds, pre-crossfade
  const OVERLAP = 1; // seconds

  const loopFilter =
    `[0:v]trim=0:${LOOP_LEN},setpts=PTS-STARTPTS[v0];` +
    `[v0]split[main][tmp];` +
    `[main]trim=0:${LOOP_LEN - OVERLAP},setpts=PTS-STARTPTS[part1];` +
    `[tmp]trim=${LOOP_LEN - OVERLAP}:${LOOP_LEN},setpts=PTS-STARTPTS[tail];` +
    `[v0]trim=0:${OVERLAP},setpts=PTS-STARTPTS[head];` +
    `[tail][head]xfade=transition=fade:duration=${OVERLAP}:offset=0[blend];` +
    `[part1][blend]concat=n=2:v=1:a=0[outv]`;

  const loopedPath = path.join(cacheDir, "hero-looped.mp4");
  if (!fssync.existsSync(loopedPath)) {
    console.log("building seamless loop...");
    await run("ffmpeg", [
      "-y", "-i", srcPath,
      "-filter_complex", loopFilter,
      "-map", "[outv]", "-an",
      "-c:v", "libx264", "-crf", "18", "-preset", "medium",
      loopedPath
    ]);
  }

  const targets = [
    { name: "hero-1080.mp4", scale: 1920, codec: ["-c:v", "libx264", "-crf", "30", "-preset", "slow", "-movflags", "+faststart", "-pix_fmt", "yuv420p"] },
    { name: "hero-1080.webm", scale: 1920, codec: ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1"] },
    { name: "hero-720.mp4", scale: 1280, codec: ["-c:v", "libx264", "-crf", "30", "-preset", "slow", "-movflags", "+faststart", "-pix_fmt", "yuv420p"] }
  ];
  for (const t of targets) {
    const dest = path.join(outDir, t.name);
    if (fssync.existsSync(dest)) { console.log("cached:", t.name); continue; }
    console.log("encoding:", t.name);
    await run("ffmpeg", [
      "-y", "-i", loopedPath,
      "-vf", `scale=${t.scale}:-2`,
      "-an",
      ...t.codec,
      dest
    ]);
    const stat = await fs.stat(dest);
    console.log(`  -> ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  }

  // Poster frame (first frame of the loop)
  const posterJpg = path.join(outDir, "poster.jpg");
  const posterWebp = path.join(outDir, "poster.webp");
  if (!fssync.existsSync(posterJpg)) {
    await run("ffmpeg", ["-y", "-i", loopedPath, "-vframes", "1", "-q:v", "3", posterJpg]);
  }
  if (!fssync.existsSync(posterWebp)) {
    await sharp(posterJpg).webp({ quality: 78 }).toFile(posterWebp);
  }
}

await processPhotos();
await processHeroVideo();
console.log("Media pipeline complete for", slug);
