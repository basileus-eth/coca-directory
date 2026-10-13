#!/usr/bin/env node
// Downloads every member's avatar and banner from X at full quality, keeps the
// originals untouched, and writes web-sized copies plus a manifest the page reads.
//
// Usage:  npm install sharp@0.35.5   (once)
//         node scripts/fetch-media.mjs            # fetch anything not yet downloaded
//         node scripts/fetch-media.mjs --refresh  # re-download everything
//
// Reads:  data/people.json
// Writes: media/originals/<handle>-avatar.<ext>, <handle>-banner.jpg   (byte-for-byte from X)
//         media/web/<handle>-avatar-256.webp, -avatar-512.webp,
//                   <handle>-banner-750.webp, -banner-1500.webp
//         data/media-manifest.json

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PEOPLE = path.join(ROOT, "data/people.json");
const ORIG = path.join(ROOT, "media/originals");
const WEB = path.join(ROOT, "media/web");
const MANIFEST = path.join(ROOT, "data/media-manifest.json");
const REFRESH = process.argv.includes("--refresh");
const CONCURRENCY = 3;          // be polite to X's image servers
const DELAY_MS = 400;           // pause between downloads per worker
// High quality on purpose: these are artists' works.
const AVATAR_Q = 92, BANNER_Q = 90;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => fs.access(p).then(() => true, () => false);

async function download(url, dest, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "coca-directory-media/1.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      await fs.writeFile(dest, buf);
      return buf;
    } catch (e) {
      if (i === tries) throw new Error(`${url}: ${e.message}`);
      await sleep(1000 * i);
    }
  }
}

async function getOriginal(urls, dest) {
  if (!REFRESH && await exists(dest)) return fs.readFile(dest);
  let lastErr;
  for (const u of urls.filter(Boolean)) {
    try { return await download(u, dest); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function dominantColor(buf) {
  const { dominant } = await sharp(buf).stats();
  return "#" + [dominant.r, dominant.g, dominant.b].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function processPerson(p) {
  const h = p.handle;
  const out = { handle: h, avatar: null, banner: null, color: null, errors: [] };
  const rel = f => path.relative(ROOT, f).split(path.sep).join("/");

  // Avatar: try the original upload first, fall back to the 400px version.
  try {
    const ext = (p.source.avatar_original.match(/\.(\w+)$/) || [, "jpg"])[1];
    const orig = path.join(ORIG, `${h}-avatar.${ext}`);
    const buf = await getOriginal([p.source.avatar_original, p.source.avatar_400], orig);
    const meta = await sharp(buf).metadata();
    const a256 = path.join(WEB, `${h}-avatar-256.webp`);
    const a512 = path.join(WEB, `${h}-avatar-512.webp`);
    await sharp(buf).resize(256, 256, { fit: "cover" }).webp({ quality: AVATAR_Q }).toFile(a256);
    await sharp(buf).resize(512, 512, { fit: "cover", withoutEnlargement: true }).webp({ quality: AVATAR_Q }).toFile(a512);
    out.avatar = { original: rel(orig), w: meta.width, h: meta.height, src256: rel(a256), src512: rel(a512) };
    out.color = await dominantColor(buf);
  } catch (e) { out.errors.push("avatar: " + e.message); }

  // Banner: X's largest standard size is 1500x500.
  try {
    if (p.source.banner_1500) {
      const orig = path.join(ORIG, `${h}-banner.jpg`);
      const buf = await getOriginal([p.source.banner_1500], orig);
      const meta = await sharp(buf).metadata();
      const b750 = path.join(WEB, `${h}-banner-750.webp`);
      const b1500 = path.join(WEB, `${h}-banner-1500.webp`);
      await sharp(buf).resize(750, null, { withoutEnlargement: true }).webp({ quality: BANNER_Q }).toFile(b750);
      await sharp(buf).resize(1500, null, { withoutEnlargement: true }).webp({ quality: BANNER_Q }).toFile(b1500);
      out.banner = { original: rel(orig), w: meta.width, h: meta.height, src750: rel(b750), src1500: rel(b1500) };
      if (!out.color) out.color = await dominantColor(buf);
    }
  } catch (e) { out.errors.push("banner: " + e.message); }

  return out;
}

async function main() {
  await fs.mkdir(ORIG, { recursive: true });
  await fs.mkdir(WEB, { recursive: true });
  const { people } = JSON.parse(await fs.readFile(PEOPLE, "utf8"));
  const results = new Array(people.length);
  let next = 0, done = 0;

  async function worker() {
    while (next < people.length) {
      const i = next++;
      results[i] = await processPerson(people[i]);
      done++;
      const r = results[i];
      process.stdout.write(`${String(done).padStart(3)}/${people.length} ${r.handle}${r.errors.length ? "  ⚠ " + r.errors.join("; ") : ""}\n`);
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const manifest = {
    generated: new Date().toISOString(),
    media: Object.fromEntries(results.map(r => [r.handle.toLowerCase(), { avatar: r.avatar, banner: r.banner, color: r.color }])),
  };
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 1));
  const failed = results.filter(r => r.errors.length);
  console.log(`\nDone. ${results.length - failed.length} complete, ${failed.length} with problems.`);
  if (failed.length) { failed.forEach(r => console.log(" -", r.handle, r.errors.join("; "))); process.exitCode = 1; }
}

main().catch(e => { console.error(e); process.exit(1); });
