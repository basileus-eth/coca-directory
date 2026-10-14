// TODO: add the pinned X post URL beside the @basileus_eth credit when it exists.

const SHORT = { B: "Blood Guard", O: "Old World", N: "New World", G: "Great Spirits", L: "IRL & NFC Lisbon", A: "Auxiliaire" };
const VIEW_KEY = "coca-directory-view";

const httpUrl = value => {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

const safePath = value => {
  if (typeof value !== "string" || !value) return "";
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { return ""; }
  if (decoded.startsWith("/") || decoded.startsWith("\\") || /^[a-z][a-z0-9+.-]*:/i.test(decoded)) return "";
  if (decoded.split(/[/\\]/).some(part => part === "" || part === "." || part === "..")) return "";
  return value;
};

const pretty = u => u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
const tone = c => /^#[0-9a-fA-F]{6}$/.test(c || "") ? c : "#2c2e37";
const paintTone = (el, color) => el.style.setProperty("--tone", tone(color));
const motion = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
const chatClass = c => /^[A-Z]$/.test(c) ? c : "";

function externalLink(href, text) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = text;
  return a;
}

function appendLinkified(parent, text) {
  const re = /(https?:\/\/[^\s<>"']+)|(^|[^\w])@([A-Za-z0-9_]{1,15})/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) parent.append(document.createTextNode(text.slice(last, match.index)));
    if (match[1]) {
      const raw = match[1];
      const trimmed = raw.replace(/[.,;:)…]+$/, "");
      const href = httpUrl(trimmed);
      parent.append(href ? externalLink(href, pretty(trimmed)) : document.createTextNode(trimmed));
      if (raw.length > trimmed.length) parent.append(document.createTextNode(raw.slice(trimmed.length)));
    } else {
      if (match[2]) parent.append(document.createTextNode(match[2]));
      parent.append(externalLink(`https://x.com/${encodeURIComponent(match[3])}`, `@${match[3]}`));
    }
    last = re.lastIndex;
  }
  if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
}

function whenImageFails(img, fn) {
  if (!img) return;
  const fail = () => fn();
  if (img.complete && img.naturalWidth === 0) fail();
  else img.addEventListener("error", fail);
}

function formatCollected(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return value || "the latest collection";
  return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

let people = [];
let media = {};
let chatFull = {};
let active = new Set();
let view = "directory";
let viewer = { handle: null, kind: "banner" };

function loadView() {
  try { return localStorage.getItem(VIEW_KEY) === "wall" ? "wall" : "directory"; }
  catch { return "directory"; }
}
function saveView(name) {
  try { localStorage.setItem(VIEW_KEY, name); } catch { /* keep the in-memory choice */ }
}

function prepare(raw) {
  const chats = Array.isArray(raw.chats) ? raw.chats : String(raw.chats || "").split("");
  const name = raw.name || raw.handle || "";
  const plain = name.normalize("NFKC").toLowerCase();
  const stripped = plain.replace(/^[^\p{L}\p{N}]+/u, "");
  const key = stripped || String(raw.handle || "").toLowerCase();
  const first = key.charAt(0);
  const letter = /[a-z]/.test(first) ? first.toUpperCase() : "#";
  const bio = raw.bio || "";
  const bioLinks = raw.bioLinks || [];
  const website = raw.website || "";
  const location = (raw.location || "").trim();
  return {
    handle: raw.handle, name, bio, bioLinks, website, location, chats, key, letter,
    hay: [raw.handle, name, bio, website, location, ...bioLinks].join(" ").toLowerCase(),
  };
}

function initial(p) {
  if (p.letter !== "#") return p.letter;
  return (p.name || p.handle || "").trim().charAt(0) || "#";
}

function personMedia(p) {
  return media[String(p.handle || "").toLowerCase()] || {};
}

function makeImg(src, srcset, sizes, width, height, alt, className) {
  const safeSrc = safePath(src);
  if (!safeSrc) return null;
  const img = document.createElement("img");
  img.src = safeSrc;
  img.width = width;
  img.height = height;
  img.alt = alt;
  img.loading = "lazy";
  img.decoding = "async";
  if (className) img.className = className;
  const parts = (srcset || []).map(([path, descriptor]) => {
    const safe = safePath(path);
    return safe ? `${safe} ${descriptor}` : "";
  }).filter(Boolean);
  if (parts.length) {
    img.srcset = parts.join(", ");
    img.sizes = sizes;
  }
  return img;
}

function initialAvatar(p, m) {
  const face = document.createElement("div");
  face.className = "avatar";
  face.setAttribute("aria-hidden", "true");
  face.textContent = initial(p);
  paintTone(face, m.color);
  return face;
}

function cardBanner(p, m) {
  const wrap = document.createElement("div");
  wrap.className = "card-banner";
  paintTone(wrap, m.color);
  const banner = m.banner;
  const img = banner && makeImg(
    banner.src1500,
    [[banner.src750, "750w"], [banner.src1500, "1500w"]],
    "(min-width: 900px) 50vw, 100vw",
    1500, 500, `Banner art by ${p.name}`, ""
  );
  if (!img) return wrap;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "zoom";
  button.dataset.kind = "banner";
  button.dataset.handle = p.handle;
  button.setAttribute("aria-label", `Banner art by ${p.name}`);
  whenImageFails(img, () => button.remove());
  button.append(img);
  wrap.append(button);
  return wrap;
}

function cardAvatar(p, m) {
  const avatar = m.avatar;
  const img = avatar && makeImg(
    avatar.src512,
    [[avatar.src256, "256w"], [avatar.src512, "512w"]],
    "88px",
    512, 512, `Avatar of ${p.name}`, ""
  );
  if (!img) return initialAvatar(p, m);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "avatar-btn";
  button.dataset.kind = "avatar";
  button.dataset.handle = p.handle;
  button.setAttribute("aria-label", `Avatar of ${p.name}`);
  paintTone(button, m.color);
  whenImageFails(img, () => button.replaceWith(initialAvatar(p, m)));
  button.append(img);
  return button;
}

function tags(p) {
  const row = document.createElement("div");
  row.className = "tags";
  for (const key of p.chats) {
    const full = chatFull[key] || SHORT[key] || key;
    const tag = document.createElement("span");
    tag.className = chatClass(key) ? `tag ${chatClass(key)}` : "tag";
    tag.title = full;
    tag.textContent = SHORT[key] || full;
    row.append(tag);
  }
  return row;
}

function textBlock(p) {
  const bio = document.createElement("p");
  const trimmed = p.bio.trim();
  if (trimmed) {
    bio.className = "bio";
    appendLinkified(bio, trimmed);
  } else {
    bio.className = "bio empty";
    bio.textContent = "No profile text.";
  }
  const list = document.createElement("dl");
  const siteTerm = document.createElement("dt");
  siteTerm.textContent = "Website";
  const site = document.createElement("dd");
  const siteHref = httpUrl(p.website);
  if (siteHref) site.append(externalLink(siteHref, pretty(siteHref)));
  list.append(siteTerm, site);
  const extras = [];
  for (const link of p.bioLinks) {
    const href = httpUrl(link);
    if (href) extras.push(href);
  }
  if (extras.length) {
    const term = document.createElement("dt");
    term.textContent = "Links";
    const dd = document.createElement("dd");
    const ul = document.createElement("ul");
    for (const href of extras) {
      const li = document.createElement("li");
      li.append(externalLink(href, pretty(href)));
      ul.append(li);
    }
    dd.append(ul);
    list.append(term, dd);
  }
  return [bio, list];
}

function card(p) {
  const article = document.createElement("article");
  article.className = "card";
  article.id = `p-${p.handle}`;
  const m = personMedia(p);
  const body = document.createElement("div");
  body.className = "card-body";
  const who = document.createElement("div");
  who.className = "who";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = p.name;
  who.append(name, externalLink(`https://x.com/${encodeURIComponent(p.handle)}`, `@${p.handle}`));
  who.lastChild.classList.add("handle");
  if (p.location) {
    const loc = document.createElement("div");
    loc.className = "loc";
    loc.textContent = p.location;
    who.append(loc);
  }
  who.append(tags(p));
  body.append(cardAvatar(p, m), who, ...textBlock(p));
  article.append(cardBanner(p, m), body);
  return article;
}

function tile(p) {
  const m = personMedia(p);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tile";
  button.id = `w-${p.handle}`;
  button.dataset.goto = p.handle;
  paintTone(button, m.color);
  const banner = m.banner;
  const bannerImg = banner && makeImg(
    banner.src1500,
    [[banner.src750, "750w"], [banner.src1500, "1500w"]],
    "(min-width: 900px) 33vw, 100vw",
    1500, 500, "", "tile-banner"
  );
  if (bannerImg) {
    whenImageFails(bannerImg, () => bannerImg.remove());
    button.append(bannerImg);
  }
  const cap = document.createElement("span");
  cap.className = "tile-cap";
  const avatar = m.avatar;
  const face = avatar && makeImg(
    avatar.src256,
    [[avatar.src256, "256w"], [avatar.src512, "512w"]],
    "32px",
    256, 256, "", "tile-avatar"
  );
  if (face) {
    whenImageFails(face, () => {
      const fallback = document.createElement("span");
      fallback.className = "tile-initial";
      fallback.textContent = initial(p);
      paintTone(fallback, m.color);
      face.replaceWith(fallback);
    });
    cap.append(face);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "tile-initial";
    fallback.textContent = initial(p);
    paintTone(fallback, m.color);
    cap.append(fallback);
  }
  const label = document.createElement("span");
  label.className = "tile-name";
  label.textContent = p.name;
  cap.append(label);
  button.append(cap);
  return button;
}

function boldCount(n) {
  const b = document.createElement("b");
  b.textContent = String(n);
  return b;
}

function render(directory) {
  chatFull = directory.chats || {};
  people = (directory.people || []).map(prepare).sort((a, b) =>
    (a.letter === "#") - (b.letter === "#") || a.key.localeCompare(b.key, "en", { sensitivity: "base" })
  );
  active = new Set(Object.keys(chatFull));
  const groups = {};
  for (const person of people) (groups[person.letter] ||= []).push(person);
  const letters = Object.keys(groups).sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));
  const list = document.getElementById("list");
  list.replaceChildren();
  for (const letter of letters) {
    const section = document.createElement("section");
    section.className = "letter";
    section.id = `L-${letter === "#" ? "other" : letter}`;
    const heading = document.createElement("h2");
    heading.textContent = letter;
    const entries = document.createElement("div");
    entries.className = "entries";
    for (const person of groups[letter]) entries.append(card(person));
    section.append(heading, entries);
    list.append(section);
  }
  const wall = document.getElementById("wall");
  wall.replaceChildren();
  for (const person of people) wall.append(tile(person));

  const chats = document.getElementById("chats");
  chats.replaceChildren();
  for (const key of Object.keys(chatFull)) {
    const full = chatFull[key] || SHORT[key] || key;
    const button = document.createElement("button");
    button.className = "toggle";
    button.type = "button";
    button.dataset.k = key;
    button.setAttribute("aria-pressed", "true");
    button.title = full;
    const dot = document.createElement("span");
    dot.className = chatClass(key) ? `dot ${chatClass(key)}` : "dot";
    button.append(dot, document.createTextNode(SHORT[key] || full));
    chats.append(button);
  }

  const stats = document.getElementById("stats");
  const peopleStat = document.createElement("span");
  peopleStat.append(boldCount(people.length), document.createTextNode(" people"));
  const bits = [peopleStat];
  for (const key of Object.keys(chatFull)) {
    const span = document.createElement("span");
    const count = people.filter(person => person.chats.includes(key)).length;
    span.append(document.createTextNode(`${SHORT[key] || chatFull[key] || key} `), boldCount(count));
    bits.push(span);
  }
  const sites = document.createElement("span");
  sites.append(document.createTextNode("With website "), boldCount(people.filter(person => httpUrl(person.website)).length));
  bits.push(sites);
  stats.replaceChildren(...bits);

  const collected = formatCollected(directory.collected);
  const asof = document.getElementById("asof");
  asof.textContent = `Profiles as of ${collected}. Confirm mint links on the artist's own X profile.`;
  const date = document.getElementById("collected-date");
  date.textContent = collected;
  if (/^\d{4}-\d{2}-\d{2}$/.test(directory.collected || "")) date.dateTime = directory.collected;
}

const allLetters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];

function drawRail() {
  const rail = document.getElementById("rail");
  rail.replaceChildren();
  for (const letter of allLetters) {
    const id = `L-${letter === "#" ? "other" : letter}`;
    const section = document.getElementById(id);
    if (section && !section.hidden) {
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent = letter;
      rail.append(link);
    } else {
      const span = document.createElement("span");
      span.textContent = letter;
      rail.append(span);
    }
  }
}

function apply() {
  const terms = document.getElementById("q").value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const person of people) {
    const ok = person.chats.some(key => active.has(key)) && terms.every(term => person.hay.includes(term));
    const entry = document.getElementById(`p-${person.handle}`);
    const wallTile = document.getElementById(`w-${person.handle}`);
    if (entry) entry.hidden = !ok;
    if (wallTile) wallTile.hidden = !ok;
    if (ok) shown++;
  }
  for (const section of document.querySelectorAll(".letter")) {
    section.hidden = ![...section.querySelectorAll(".card")].some(entry => !entry.hidden);
  }
  document.getElementById("count").textContent = people.length ? `${shown} of ${people.length} shown` : "";
  document.getElementById("none").hidden = shown !== 0;
  drawRail();
}

function setView(name) {
  view = name === "wall" ? "wall" : "directory";
  document.getElementById("list").hidden = view !== "directory";
  document.getElementById("wall").hidden = view !== "wall";
  document.getElementById("rail").hidden = view !== "directory";
  document.getElementById("view-directory").setAttribute("aria-pressed", String(view === "directory"));
  document.getElementById("view-wall").setAttribute("aria-pressed", String(view === "wall"));
  saveView(view);
}

function visiblePeople() {
  return people.filter(person => {
    const entry = document.getElementById(`p-${person.handle}`);
    return entry && !entry.hidden;
  });
}

function showViewerFallback(person, m) {
  const img = document.getElementById("viewer-img");
  const fallback = document.getElementById("viewer-fallback");
  img.hidden = true;
  img.removeAttribute("src");
  fallback.hidden = false;
  fallback.textContent = viewer.kind === "avatar" ? initial(person) : "";
  paintTone(fallback, m.color);
}

function paintViewer() {
  const person = people.find(entry => entry.handle === viewer.handle);
  const dialog = document.getElementById("viewer");
  if (!person) {
    dialog.close();
    return;
  }
  const m = personMedia(person);
  const item = viewer.kind === "avatar" ? m.avatar : m.banner;
  const caption = viewer.kind === "avatar" ? `Avatar of ${person.name}` : `Banner by ${person.name}`;
  document.getElementById("viewer-cap").textContent = caption;
  const link = document.getElementById("viewer-link");
  link.href = `https://x.com/${encodeURIComponent(person.handle)}`;
  link.textContent = `@${person.handle}`;
  const original = item && safePath(item.original);
  const img = document.getElementById("viewer-img");
  if (!original) {
    showViewerFallback(person, m);
    return;
  }
  img.hidden = false;
  img.alt = caption;
  document.getElementById("viewer-fallback").hidden = true;
  img.src = original;
}

function openViewer(handle, kind) {
  viewer = { handle, kind };
  paintViewer();
  const dialog = document.getElementById("viewer");
  if (!dialog.open) dialog.showModal();
}

function stepViewer(dir) {
  const visible = visiblePeople();
  const index = visible.findIndex(person => person.handle === viewer.handle);
  if (index < 0) return;
  const next = index + dir;
  if (next < 0 || next >= visible.length) return;
  viewer.handle = visible[next].handle;
  paintViewer();
}

function scrollToCard(handle) {
  const entry = document.getElementById(`p-${handle}`);
  if (!entry) return;
  const bar = document.querySelector(".bar");
  const top = entry.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: motion() });
}

document.getElementById("chats").addEventListener("click", event => {
  const button = event.target.closest(".toggle");
  if (!button) return;
  const key = button.dataset.k;
  if (active.has(key)) active.delete(key);
  else active.add(key);
  button.setAttribute("aria-pressed", String(active.has(key)));
  apply();
});
document.getElementById("q").addEventListener("input", apply);
document.getElementById("view-directory").addEventListener("click", () => setView("directory"));
document.getElementById("view-wall").addEventListener("click", () => setView("wall"));
document.getElementById("list").addEventListener("click", event => {
  const button = event.target.closest("[data-kind]");
  if (!button) return;
  openViewer(button.dataset.handle, button.dataset.kind);
});
document.getElementById("wall").addEventListener("click", event => {
  const wallTile = event.target.closest("[data-goto]");
  if (!wallTile) return;
  setView("directory");
  scrollToCard(wallTile.dataset.goto);
});
const viewerEl = document.getElementById("viewer");
viewerEl.addEventListener("click", event => { if (event.target === viewerEl) viewerEl.close(); });
document.getElementById("viewer-close").addEventListener("click", () => viewerEl.close());
document.getElementById("viewer-img").addEventListener("error", () => {
  const person = people.find(entry => entry.handle === viewer.handle);
  if (person) showViewerFallback(person, personMedia(person));
});
document.addEventListener("keydown", event => {
  if (!viewerEl.open) return;
  if (event.key === "ArrowRight") { event.preventDefault(); stepViewer(1); }
  if (event.key === "ArrowLeft") { event.preventDefault(); stepViewer(-1); }
});

whenImageFails(document.getElementById("site-banner"), () => document.getElementById("site-banner")?.remove());
whenImageFails(document.getElementById("header-coin"), () => document.getElementById("header-coin")?.remove());
whenImageFails(document.getElementById("footer-coin"), () => document.getElementById("footer-coin")?.remove());
whenImageFails(document.getElementById("site-logo"), () => {
  document.getElementById("site-logo")?.parentElement?.classList.add("fallback");
  document.getElementById("site-logo")?.remove();
});

async function main() {
  try {
    const [peopleRes, mediaRes] = await Promise.all([
      fetch("data/people.json"),
      fetch("data/media-manifest.json"),
    ]);
    if (!peopleRes.ok || !mediaRes.ok) throw new Error("missing data");
    const directory = await peopleRes.json();
    media = (await mediaRes.json()).media || {};
    render(directory);
    document.getElementById("loading").hidden = true;
    const hash = decodeURIComponent(location.hash.slice(1));
    setView(hash.startsWith("p-") || hash.startsWith("L-") ? "directory" : loadView());
    apply();
    if (hash.startsWith("p-")) scrollToCard(hash.slice(2));
    else if (hash.startsWith("L-")) document.getElementById(hash)?.scrollIntoView({ behavior: motion(), block: "start" });
  } catch {
    document.getElementById("loading").textContent = "The directory could not be loaded.";
  }
}
main();
