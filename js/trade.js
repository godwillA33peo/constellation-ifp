// §2.4 Trade Zone — the standing help network. Calmer than the rest:
// a searchable directory of what we can offer each other, wherever
// we land next.
import { getSkills, addSkill } from "./store.js";
import { esc } from "./ui.js";

let entries = [];
let root;

export async function initTrade() {
  root = document.getElementById("trade-root");
  root.innerHTML = `
    <div class="trade-toolbar">
      <input type="search" placeholder="Search skills or names…" aria-label="Search skills or names">
      <select aria-label="Filter by">
        <option value="all">Offering + seeking</option>
        <option value="offering">Offering</option>
        <option value="seeking">Seeking</option>
      </select>
    </div>
    <div class="trade-grid" data-grid></div>
    <form class="trade-form">
      <h3>Add yourself to the network</h3>
      <label for="tf-name">Your name</label>
      <input id="tf-name" type="text" maxlength="60" required>
      <label for="tf-offer">What you can offer (one or two, comma-separated)</label>
      <input id="tf-offer" type="text" placeholder="e.g. R help, grant-writing feedback" required>
      <label for="tf-seek">One thing you're looking for</label>
      <input id="tf-seek" type="text" placeholder="e.g. intros to health NGOs in Nairobi">
      <button class="btn" type="submit">Log my trade</button>
      <p class="form-note" aria-live="polite"></p>
    </form>`;

  const search = root.querySelector("input[type=search]");
  const filter = root.querySelector("select");
  search.addEventListener("input", renderGrid);
  filter.addEventListener("change", renderGrid);

  root.querySelector(".trade-form").addEventListener("submit", onSubmit);

  entries = await getSkills();
  renderGrid();
}

function renderGrid() {
  const grid = root.querySelector("[data-grid]");
  const q = root.querySelector("input[type=search]").value.trim().toLowerCase();
  const mode = root.querySelector("select").value;

  const visible = entries.filter((e) => {
    const offering = e.offering.join(" ").toLowerCase();
    const seeking = (e.seeking || "").toLowerCase();
    const hay =
      mode === "offering" ? `${e.name.toLowerCase()} ${offering}` :
      mode === "seeking"  ? `${e.name.toLowerCase()} ${seeking}` :
                            `${e.name.toLowerCase()} ${offering} ${seeking}`;
    return !q || hay.includes(q);
  });

  if (!visible.length) {
    grid.innerHTML = `<p class="leaderboard-empty">${
      entries.length ? "Nothing matches that search." :
      "Nobody's logged a trade yet — the form below takes thirty seconds."
    }</p>`;
    return;
  }

  grid.innerHTML = visible
    .map(
      (e) => `
    <article class="trade-entry">
      <h3>${esc(e.name)}</h3>
      <span class="trade-label">Can offer</span>
      <div class="skill-chips">${e.offering.map((s) => `<span class="skill-chip">${esc(s)}</span>`).join("")}</div>
      ${e.seeking ? `
        <span class="trade-label">Looking for</span>
        <div class="skill-chips"><span class="skill-chip seek">${esc(e.seeking)}</span></div>` : ""}
    </article>`
    )
    .join("");
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const note = form.querySelector(".form-note");
  const btn = form.querySelector("button");
  const name = form.querySelector("#tf-name").value;
  const offering = form.querySelector("#tf-offer").value.split(",");
  const seeking = form.querySelector("#tf-seek").value;

  btn.disabled = true;
  note.classList.remove("ok");
  try {
    await addSkill({ name, offering, seeking });
    entries = await getSkills();
    renderGrid();
    form.reset();
    note.classList.add("ok");
    note.textContent = "Logged — you're part of the network now.";
  } catch (err) {
    note.textContent = err.message || "That didn't save — try again?";
  } finally {
    btn.disabled = false;
  }
}
