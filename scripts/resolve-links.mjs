#!/usr/bin/env node
// Follow shortened URLs in data/people.json and write data/link-report.md.
// Does not modify people.json.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PEOPLE = path.join(ROOT, "data/people.json");
const REPORT = path.join(ROOT, "data/link-report.md");
const SHORTENERS = new Set([
  "shorturl.at", "bit.ly", "tinyurl.com", "t.co", "ow.ly",
  "buff.ly", "is.gd", "cutt.ly", "rb.gy", "spoti.fi",
]);
const URL_RE = /https?:\/\/[^\s<>"']+/g;
const HOPS = 5;
const TIMEOUT_MS = 10000;

function hostOf(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function clean(value) {
  return value.replace(/[.,;:)…]+$/, "");
}

function collect(person) {
  const found = [];
  const add = (where, value) => {
    if (!value || !SHORTENERS.has(hostOf(value))) return;
    const row = found.find(item => item.original === value);
    if (row) row.where.push(where);
    else found.push({ handle: person.handle, where: [where], original: value });
  };
  if (person.website) add("website", person.website);
  for (const link of person.bioLinks || []) add("bioLinks", link);
  for (const match of String(person.bio || "").match(URL_RE) || []) add("bio", clean(match));
  return found;
}

async function resolve(start) {
  let current = start;
  for (let hop = 0; hop < HOPS; hop++) {
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; coca-directory-link-check/1.0)" },
    });
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      const location = res.headers.get("location");
      if (!location) return { final: current, note: `HTTP ${res.status} without a location` };
      const next = new URL(location, current).href;
      if (!/^https?:\/\//i.test(next)) return { final: current, note: `refused non-http redirect to ${next}` };
      current = next;
      continue;
    }
    let extra = "";
    if (SHORTENERS.has(hostOf(current))) {
      const title = ((await res.text()).match(/<title>([^<]*)/i) || [])[1] || "";
      const cleanTitle = title.replace(/\s+/g, " ").trim();
      extra = cleanTitle ? `, ${cleanTitle}` : "";
    } else {
      await res.body?.cancel();
    }
    if (current === start) return { final: current, note: `unresolved (HTTP ${res.status}${extra})` };
    if (SHORTENERS.has(hostOf(current))) return { final: current, note: `still on shortener (HTTP ${res.status}${extra})` };
    let note = `HTTP ${res.status}`;
    try {
      if (new URL(current).pathname === "/") note = `HTTP ${res.status}; final is the site homepage`;
    } catch { /* keep the status note */ }
    return { final: current, note };
  }
  return { final: current, note: "stopped after 5 redirects" };
}

function cell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const directory = JSON.parse(await fs.readFile(PEOPLE, "utf8"));
const rows = (directory.people || []).flatMap(collect);
for (const row of rows) {
  try { Object.assign(row, await resolve(row.original)); }
  catch (error) { row.final = row.original; row.note = error.name === "TimeoutError" ? "timed out" : error.message; }
}

const lines = [
  "# Link report",
  "",
  "Shortened URLs in `data/people.json`. This file records where they redirect. It does not change `people.json`.",
  "linktr.ee and other link pages are not listed.",
  "",
  "| Person | Where | Original | Final | Note |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map(row => `| ${cell(row.handle)} | ${cell(row.where.join(", "))} | ${cell(row.original)} | ${cell(row.final)} | ${cell(row.note || "")} |`),
  "",
];
if (!rows.length) lines.push("No shortened URLs found.", "");
await fs.writeFile(REPORT, lines.join("\n"));
console.log(`Wrote ${rows.length} row${rows.length === 1 ? "" : "s"} to data/link-report.md`);
for (const row of rows) console.log(`- ${row.handle}: ${row.original} -> ${row.final} (${row.note || "ok"})`);
