// §5.5 The Menu — a simple wishlist, not a contribution list. This
// isn't "bring a dish"; it's asking what people want to eat and
// drink at the party. Two tabs (Food / Drinks), a few preset picks
// plus free text, one tap to vote. Anonymous — no attribution beyond
// the vote itself. Each submission joins a small "most wanted"
// constellation and lights a lantern near the Galway skyline.
import { getMenu, voteMenuItem, hasVotedFor, markVoted } from "./store.js";
import { el, handLine, drawIn, mulberry32, reducedMotion } from "./sky.js";
import { clink } from "./soundscape.js";
import { esc } from "./ui.js";

const PRESETS = {
  food: ["Jollof rice", "Nsima & ndiwo", "Injera", "Pilau", "BBQ", "Vegetarian platter", "Pizza"],
  drink: ["Soft drinks", "Local beer", "Wine", "Tea & coffee", "Mocktails", "Punch"],
};

let entries = [];
let root;
let tab = "food";

export async function initMenu() {
  root = document.getElementById("menu-root");
  root.innerHTML = `
    <div class="menu-tabs" role="tablist" aria-label="Food or drinks">
      <button role="tab" data-tab="food" aria-selected="true">Food</button>
      <button role="tab" data-tab="drink" aria-selected="false">Drinks</button>
    </div>
    <div class="menu-presets" data-presets></div>
    <form class="menu-other">
      <label for="mo-item" class="sr-only">Something else</label>
      <input id="mo-item" type="text" maxlength="60" placeholder="Something else you're craving…">
      <button class="btn btn-ghost" type="submit">Add it</button>
    </form>
    <p class="form-note" data-menu-note aria-live="polite"></p>
    <h3 class="menu-wanted-title">Most wanted</h3>
    <div class="menu-wanted" data-wanted></div>`;

  root.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      render();
    }));

  root.querySelector(".menu-other").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = root.querySelector("#mo-item");
    const note = root.querySelector("[data-menu-note]");
    const val = input.value.trim();
    if (!val) return;
    try {
      await castVote(val, tab);
      input.value = "";
      note.classList.add("ok");
      note.textContent = "Added to the wishlist — a lantern just lit for it.";
    } catch (err) {
      note.classList.remove("ok");
      note.textContent = err.message || "That didn't save — try again?";
    }
  });

  entries = await getMenu();
  render();
  initLanterns(entries.reduce((s, e) => s + (e.votes || 0), 0));
}

function keyFor(item, kind) {
  return `${kind}:${item.toLowerCase()}`;
}

async function castVote(item, kind) {
  const key = keyFor(item, kind);
  if (hasVotedFor(key)) return;
  await voteMenuItem({ item, kind });
  markVoted(key);
  entries = await getMenu();
  render();
  clink();
  lightLantern();
}

function render() {
  const presetsBox = root.querySelector("[data-presets]");
  presetsBox.innerHTML = PRESETS[tab]
    .map((p) => {
      const key = keyFor(p, tab);
      const voted = hasVotedFor(key);
      const count = entries.find((e) => e.kind === tab && e.item.toLowerCase() === p.toLowerCase())?.votes || 0;
      return `<button class="preset-chip${voted ? " voted" : ""}" data-preset="${esc(p)}" ${voted ? "disabled" : ""}>
        ${esc(p)}${count ? ` <span class="preset-count">${count}</span>` : ""}
      </button>`;
    })
    .join("");
  presetsBox.querySelectorAll("[data-preset]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { await castVote(btn.dataset.preset, tab); }
      catch { btn.disabled = false; }
    }));

  renderWanted();
}

function renderWanted() {
  const box = root.querySelector("[data-wanted]");
  const list = entries.filter((e) => e.kind === tab && e.votes > 0).sort((a, b) => b.votes - a.votes).slice(0, 8);

  if (!list.length) {
    box.innerHTML = `<p class="leaderboard-empty">Nobody's voted yet — be the first star.</p>`;
    return;
  }

  box.innerHTML = `<svg class="wanted-lines" aria-hidden="true"></svg><ul class="wanted-list"></ul>`;
  const ul = box.querySelector(".wanted-list");
  const max = list[0].votes || 1;
  list.forEach((e, i) => {
    const li = document.createElement("li");
    li.className = "wanted-item";
    const size = 0.75 + (e.votes / max) * 0.7;
    li.innerHTML = `<span class="wanted-star" style="font-size:${size.toFixed(2)}rem">✦</span>
      <span class="wanted-name">${esc(e.item)}</span>
      <span class="wanted-votes">${e.votes}</span>`;
    ul.append(li);
  });

  requestAnimationFrame(() => {
    const svg = box.querySelector(".wanted-lines");
    const stars = [...box.querySelectorAll(".wanted-star")];
    if (stars.length < 2) return;
    const rect = box.getBoundingClientRect();
    if (!rect.width) return;
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    const rng = mulberry32(2600);
    const pts = stars.map((s) => {
      const r = s.getBoundingClientRect();
      return [r.left - rect.left + r.width / 2, r.top - rect.top + r.height / 2];
    });
    const paths = [];
    for (let i = 1; i < pts.length; i++) {
      const p = handLine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], rng, "constellation-line faint");
      svg.append(p);
      paths.push(p);
    }
    if (!reducedMotion()) drawIn(paths, { duration: 700, stagger: 90 });
  });
}

/* ---------- lanterns near the Galway skyline ---------- */

const LANTERN_SPOTS = [23, 27, 31, 36, 55, 59, 63, 71, 75, 79, 84, 88];
const MAX_LANTERNS = LANTERN_SPOTS.length;
let lanternCount = 0;

function lanternHost() {
  let host = document.querySelector(".skyline .lanterns");
  if (!host) {
    host = document.createElement("div");
    host.className = "lanterns";
    document.querySelector(".skyline")?.append(host);
  }
  return host;
}

function initLanterns(count) {
  const host = lanternHost();
  lanternCount = Math.min(count, MAX_LANTERNS);
  for (let i = 0; i < lanternCount; i++) addLanternDot(host, i, false);
}

function lightLantern() {
  if (lanternCount >= MAX_LANTERNS) return;
  addLanternDot(lanternHost(), lanternCount, true);
  lanternCount += 1;
}

function addLanternDot(host, i, fresh) {
  const dot = document.createElement("span");
  dot.className = `lantern${fresh ? " fresh" : ""}`;
  dot.style.left = `${LANTERN_SPOTS[i % LANTERN_SPOTS.length]}%`;
  dot.style.animationDelay = `${(i * 1.7) % 5}s`;
  host.append(dot);
}
