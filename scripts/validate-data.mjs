#!/usr/bin/env node
// Fail if data/people.json has a non-http(s) URL, a shortener, a repeated
// handle, or a person without a handle or name.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PEOPLE = path.join(ROOT, "data/people.json");
const SHORTENERS = new Set([
  "shorturl.at", "bit.ly", "tinyurl.com", "t.co", "ow.ly",
  "buff.ly", "is.gd", "cutt.ly", "rb.gy", "spoti.fi",
]);
const SCHEME_RE = /\b[a-z][a-z0-9+.-]*:[^\s<>"']+/gi;
const LABELED_HTTP = /^([a-z][a-z0-9+.-]*):(https?:\/\/.+)$/i;
const OPAQUE = new Set(["javascript", "data", "vbscript", "blob", "file"]);

function hostOf(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function httpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch { return false; }
}

const problems = [];
const directory = JSON.parse(await fs.readFile(PEOPLE, "utf8"));
const seen = new Map();

(directory.people || []).forEach((person, index) => {
  const label = person.handle || `person ${index + 1}`;
  if (!String(person.handle || "").trim()) problems.push(`${label}: missing handle`);
  if (!String(person.name || "").trim()) problems.push(`${label}: missing name`);
  const key = String(person.handle || "").toLowerCase();
  if (key) {
    if (seen.has(key)) problems.push(`${label}: handle repeats ${seen.get(key)}`);
    else seen.set(key, person.handle);
  }

  const urls = [];
  if (person.website) urls.push(["website", person.website]);
  for (const link of person.bioLinks || []) urls.push(["bioLinks", link]);
  for (const match of String(person.bio || "").match(SCHEME_RE) || []) {
    const cleaned = match.replace(/[.,;:)…]+$/u, "");
    const labeled = LABELED_HTTP.exec(cleaned);
    const value = labeled && !OPAQUE.has(labeled[1].toLowerCase())
      ? labeled[2].replace(/[.,;:)…]+$/u, "")
      : cleaned;
    urls.push(["bio", value]);
  }

  for (const [where, value] of urls) {
    if (!httpUrl(value)) {
      problems.push(`${label}: ${where} is not an http(s) URL: ${value}`);
      continue;
    }
    const host = hostOf(value);
    if (SHORTENERS.has(host)) problems.push(`${label}: ${where} still uses shortener ${host}: ${value}`);
  }
});

if (problems.length) {
  for (const problem of problems) console.error(problem);
  console.error(`${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`OK: ${directory.people.length} people`);
