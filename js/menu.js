// §5.5 The Menu — "bring your country to the table."
// Each fellow adds a dish or drink from home; submissions render as
// glowing plates along a feast-table silhouette under the stars,
// each labelled with a small round flag chip (the one place flat
// flags are allowed). Star-tap upvotes, Food/Drinks tabs, search,
// a "most wished for" ranking — and every new submission lights a
// tiny lantern near the Galway skyline.
import { state, getMenu, addMenuItem, upvoteMenuItem, hasVoted } from "./store.js";
import { flagImgUrl } from "./flags.js";
import { clink } from "./soundscape.js";
import { esc } from "./ui.js";

let entries = [];
let root;
let tab = "all";

const COUNTRIES = () =>
  [...new Set(state.fellows.map((f) => f.country))].sort().concat(["Ireland", "Somewhere else"]);

export async function initMenu() {
  root = document.getElementById("menu-root");
  root.innerHTML = `
    <div class="trade-toolbar">
      <input type="search" placeholder="Search the table…" aria-label="Search the menu">
      <div class="menu-tabs" role="tablist" aria-label="Filter by type">
        <button role="tab" data-tab="all" aria-selected="true">All</button>
        <button role="tab" data-tab="food" aria-selected="false">Food</button>
        <button role="tab" data-tab="drink" aria-selected="false">Drinks</button>
      </div>
    </div>
    <div class="menu-ranking" data-ranking></div>
    <div class="menu-table">
      <div class="menu-items" data-items></div>
      <svg class="table-line" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M10,18 Q500,34 990,18" fill="none" stroke="rgba(230,200,122,0.5)" stroke-width="2" stroke-linecap="round"/>
        <path d="M60,20 L48,58 M940,20 L952,58 M330,24 L326,58 M670,24 L674,58"
              stroke="rgba(230,200,122,0.28)" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <form class="trade-form menu-form">
      <h3>Bring something to the table</h3>
      <label for="mf-name">Your name</label>
      <input id="mf-name" type="text" maxlength="60" required>
      <label for="mf-item">The dish or drink (or any party wish)</label>
      <input id="mf-item" type="text" maxlength="80" placeholder="e.g. nsima & ndiwo, tereré, knafeh…" required>
      <label for="mf-kind">It's a…</label>
      <select id="mf-kind">
        <option value="food">Food</option>
        <option value="drink">Drink</option>
      </select>
      <label for="mf-country">From</label>
      <select id="mf-country"></select>
      <label for="mf-note">A note (optional)</label>
      <input id="mf-note" type="text" maxlength="120" placeholder="vegetarian · I'll cook it · needs a blender…">
      <button class="btn" type="submit">Add it to the menu</button>
      <p class="form-note" aria-live="polite"></p>
    </form>`;

  const countrySelect = root.querySelector("#mf-country");
  countrySelect.innerHTML = COUNTRIES().map((c) => `<option>${esc(c)}</option>`).join("");

  root.querySelector("input[type=search]").addEventListener("input", renderItems);
  root.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach((x) =>
        x.setAttribute("aria-selected", String(x === b)));
      renderItems();
    }));
  root.querySelector(".menu-form").addEventListener("submit", onSubmit);

  entries = await getMenu();
  renderItems();
  initLanterns(entries.length);
}

function renderItems() {
  const grid = root.querySelector("[data-items]");
  const ranking = root.querySelector("[data-ranking]");
  const q = root.querySelector("input[type=search]").value.trim().toLowerCase();

  const visible = entries.filter((e) => {
    if (tab !== "all" && e.kind !== tab) return false;
    const hay = `${e.item} ${e.name} ${e.country} ${e.note || ""}`.toLowerCase();
    return !q || hay.includes(q);
  });

  // most wished for
  const top = [...entries].sort((a, b) => b.votes - a.votes).filter((e) => e.votes > 0).slice(0, 3);
  ranking.innerHTML = top.length
    ? `<span class="trade-label">Most wished for</span>` + top
        .map((e, i) => `<span class="rank-chip">${"✦".repeat(3 - i)} ${esc(e.item)} <em>${e.votes}</em></span>`)
        .join("")
    : "";

  if (!visible.length) {
    grid.innerHTML = `<p class="leaderboard-empty">${
      entries.length ? "Nothing matches that search." :
      "The table is empty — bring the first dish from home."
    }</p>`;
    return;
  }

  grid.innerHTML = visible
    .map((e) => `
      <button class="plate" data-id="${esc(e.id)}" aria-label="${esc(e.item)} from ${esc(e.country || "somewhere")}, added by ${esc(e.name)}">
        <span class="plate-glow ${e.kind}">${e.kind === "drink" ? "🥂" : "🍽"}</span>
        <span class="plate-name">${esc(e.item)}</span>
        ${e.country && flagImgUrl(e.country) ? `<img class="flag-chip" src="${flagImgUrl(e.country, 40)}" alt="" loading="lazy">` : ""}
        <span class="plate-votes${hasVoted(e.id) ? " voted" : ""}">✦ ${e.votes || 0}</span>
      </button>`)
    .join("");

  grid.querySelectorAll(".plate").forEach((p) =>
    p.addEventListener("click", () => openPlate(p.dataset.id)));
}

function openPlate(id) {
  const e = entries.find((x) => String(x.id) === String(id));
  if (!e) return;
  const scrim = document.createElement("div");
  scrim.className = "modal-scrim";
  scrim.innerHTML = `
    <div class="fellow-card plate-card" role="dialog" aria-modal="true" aria-label="${esc(e.item)}">
      <button class="modal-close" aria-label="Close">✕</button>
      ${e.country && flagImgUrl(e.country) ? `<img class="flag-chip big" src="${flagImgUrl(e.country, 80)}" alt="">` : ""}
      <h2>${esc(e.item)}</h2>
      <p class="card-country">${esc(e.country || "")}</p>
      <p class="card-course">brought by ${esc(e.name)}</p>
      ${e.note ? `<p class="card-fact">“${esc(e.note)}”</p>` : ""}
      <button class="btn btn-ghost upvote-btn" ${hasVoted(e.id) ? "disabled" : ""}>
        ✦ ${hasVoted(e.id) ? "wished" : "I wish for this"} · <span data-votes>${e.votes || 0}</span>
      </button>
    </div>`;
  const close = () => scrim.remove();
  scrim.addEventListener("click", (ev) => {
    if (ev.target === scrim || ev.target.closest(".modal-close")) close();
  });
  scrim.querySelector(".upvote-btn").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      const ok = await upvoteMenuItem(e.id);
      if (ok) {
        e.votes = (e.votes || 0) + 1;
        btn.querySelector("[data-votes]").textContent = e.votes;
        renderItems();
      }
    } catch { btn.disabled = false; }
  });
  document.getElementById("modal-root").append(scrim);
}

async function onSubmit(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const note = form.querySelector(".form-note");
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  note.classList.remove("ok");
  try {
    await addMenuItem({
      name: form.querySelector("#mf-name").value,
      item: form.querySelector("#mf-item").value,
      kind: form.querySelector("#mf-kind").value,
      country: form.querySelector("#mf-country").value,
      note: form.querySelector("#mf-note").value,
    });
    entries = await getMenu();
    renderItems();
    form.reset();
    note.classList.add("ok");
    note.textContent = "On the table — a lantern just lit for it.";
    clink();
    lightLantern();
  } catch (err) {
    note.textContent = err.message || "That didn't save — try again?";
  } finally {
    btn.disabled = false;
  }
}

/* ---------- lanterns near the Galway skyline ---------- */
// tiny warm lights that accumulate with every dish added

const LANTERN_SPOTS = [23, 27, 31, 36, 55, 59, 63, 71, 75, 79, 84, 88]; // % across
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
