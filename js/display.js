// §5 Display mode (?display=true) — the projector view for the party.
// No controls: cycles Arrivals map → Sky Gallery → live leaderboard.
// Winner reveal is manual: press R (or load with ?reveal=true).
// Esc returns from the reveal to the cycle.
import { getLeaderboard, onLeaderboardChange } from "./store.js";
import { el, makeStar, handLine, drawIn, mulberry32, reducedMotion } from "./sky.js";
import { MAP_W, MAP_H, project, fetchLandPath, graticule } from "./worldmap.js";
import { allCountries, totalFellows } from "./countries.js";
import { layoutSky, SKY_W, SKY_H } from "./gallery.js";
import { renderLeaderboard } from "./game.js";

const PHASE_MS = 18000;

let phases = [];
let phaseIndex = 0;
let cycleTimer = null;
let revealOpen = false;

export async function initDisplay(params) {
  document.body.classList.add("display-mode");
  const rootEl = document.getElementById("display-root");

  const stage = document.createElement("div");
  stage.className = "display-stage";
  rootEl.append(stage);

  phases = [buildMapPhase(), buildGalleryPhase(), buildLeaderboardPhase()];
  phases.forEach((p) => stage.append(p.el));

  const hint = document.createElement("p");
  hint.className = "display-hint";
  hint.textContent = "R — reveal the winner · Esc — back to the sky";
  rootEl.append(hint);

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") openReveal();
    if (e.key === "Escape") closeReveal();
  });

  showPhase(0);
  cycleTimer = setInterval(() => {
    if (!revealOpen) showPhase((phaseIndex + 1) % phases.length);
  }, PHASE_MS);

  if (params.get("reveal") === "true") openReveal();
}

function showPhase(i) {
  phaseIndex = i;
  phases.forEach((p, j) => p.el.classList.toggle("active", j === i));
  phases[i].onEnter?.();
}

/* ---------- phase 1: the map ---------- */

function buildMapPhase() {
  const wrap = document.createElement("div");
  wrap.className = "display-phase";
  wrap.innerHTML = `<h2>One sky, <span class="gold">${totalFellows()} of us</span></h2>`;

  const holder = document.createElement("div");
  holder.className = "display-map";
  const svg = el("svg", { viewBox: `0 0 ${MAP_W} ${MAP_H}`, "aria-hidden": "true" });
  svg.append(graticule());
  const landGroup = el("g");
  svg.append(landGroup);
  fetchLandPath().then((d) => {
    if (d) landGroup.append(el("path", { class: "map-land", d }));
  });

  const galway = project(53.27, -9.05);
  const paths = [];
  for (const country of allCountries()) {
    const rng = mulberry32(country.name.length * 7919);
    const anchor = project(country.lat, country.lng);
    const p = handLine(anchor[0], anchor[1], galway[0], galway[1], rng, "constellation-line faint");
    svg.append(p);
    paths.push(p);
    svg.append(makeStar(anchor[0], anchor[1], 2.2 + country.fellow_count * 0.3, { gold: false, rng }));
    const label = el("text", { class: "cluster-label", x: anchor[0], y: anchor[1] + 14 });
    label.textContent = country.name;
    label.setAttribute("style", "fill: rgba(245,243,238,0.35); font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; text-anchor: middle;");
    svg.append(label);
  }
  svg.append(makeStar(galway[0], galway[1], 3.4, { gold: true }));

  holder.append(svg);
  wrap.append(holder);
  return {
    el: wrap,
    onEnter: () => drawIn(paths, { duration: 1100, stagger: 50 }),
  };
}

/* ---------- phase 2: the gallery, auto-panning ---------- */

function buildGalleryPhase() {
  const wrap = document.createElement("div");
  wrap.className = "display-phase";
  wrap.innerHTML = `<h2>The <span class="gold">Sky Gallery</span></h2>`;

  const holder = document.createElement("div");
  holder.className = "display-gallery";

  const canvas = document.createElement("div");
  canvas.className = "gallery-canvas";
  canvas.style.width = `${SKY_W}px`;
  canvas.style.height = `${SKY_H}px`;
  canvas.style.position = "absolute";

  const svg = el("svg", { viewBox: `0 0 ${SKY_W} ${SKY_H}`, width: SKY_W, height: SKY_H, "aria-hidden": "true" });
  canvas.append(svg);

  for (const cluster of layoutSky(allCountries())) {
    const [c1, c2] = cluster.country.palette;
    for (const p of cluster.points) {
      if (!(p.x === cluster.cx && p.y === cluster.cy)) {
        svg.append(handLine(cluster.cx, cluster.cy, p.x, p.y, cluster.rng, "constellation-line faint"));
      }
    }
    const glow = document.createElement("span");
    glow.className = "palette-cluster display-cluster";
    glow.style.left = `${cluster.cx}px`;
    glow.style.top = `${cluster.cy}px`;
    glow.style.setProperty("--c1", c1);
    glow.style.setProperty("--c2", c2 || c1);
    glow.innerHTML = `<span class="cluster-glow born"></span><span class="cluster-name">${cluster.country.name}</span>`;
    canvas.append(glow);
  }

  holder.append(canvas);
  wrap.append(holder);

  let raf = null;
  const pan = () => {
    const start = performance.now();
    const maxX = SKY_W - holder.clientWidth;
    const maxY = SKY_H - holder.clientHeight;
    const step = (now) => {
      const t = ((now - start) / PHASE_MS) % 1;
      const ease = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      canvas.style.transform = `translate(${-maxX * ease}px, ${-maxY * 0.4 * ease}px)`;
      raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf);
    if (!reducedMotion()) raf = requestAnimationFrame(step);
  };

  return { el: wrap, onEnter: pan };
}

/* ---------- phase 3: live leaderboard ---------- */

function buildLeaderboardPhase() {
  const wrap = document.createElement("div");
  wrap.className = "display-phase";
  wrap.innerHTML = `
    <h2>Star Chart — <span class="gold">live standings</span></h2>
    <div class="display-leaderboard"><div class="leaderboard" data-display-lb></div></div>`;
  const lb = wrap.querySelector("[data-display-lb]");

  const refresh = async () => renderLeaderboard(lb, await getLeaderboard(10));
  onLeaderboardChange(refresh);
  refresh();

  return { el: wrap, onEnter: refresh };
}

/* ---------- the winner reveal ---------- */

async function openReveal() {
  if (revealOpen) return;
  const entries = await getLeaderboard(10);
  if (!entries.length) return; // nothing to reveal yet
  revealOpen = true;

  const winner = entries[0];
  const others = entries.slice(1, 9);

  const overlay = document.createElement("div");
  overlay.className = "reveal-overlay";
  overlay.dataset.reveal = "true";

  const W = 800, H = 500, cx = W / 2, cy = H / 2 - 30;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}` });
  const rng = mulberry32(777);

  // ambient dust
  for (let i = 0; i < 60; i++) {
    svg.append(el("circle", {
      cx: (rng() * W).toFixed(0), cy: (rng() * H).toFixed(0),
      r: (0.5 + rng()).toFixed(1), fill: "rgba(245,243,238,0.25)",
    }));
  }

  // runner-up stars in a loose ring; lines redraw toward the winner
  const paths = [];
  others.forEach((entry, i) => {
    const angle = (i / Math.max(others.length, 1)) * Math.PI * 2 + 0.4;
    const radius = 150 + rng() * 60;
    const x = cx + Math.cos(angle) * radius * 1.35;
    const y = cy + Math.sin(angle) * radius * 0.75;
    svg.append(makeStar(x, y, 2.6, { rng }));
    const nameEl = el("text", {
      x, y: y + 18, style:
        "fill: rgba(245,243,238,0.4); font-size: 10px; text-anchor: middle; font-family: Inter, sans-serif;",
    });
    nameEl.textContent = entry.playerName;
    svg.append(nameEl);
    const p = handLine(x, y, cx, cy, rng);
    svg.append(p);
    paths.push(p);
  });

  const winnerStar = makeStar(cx, cy, 6, { gold: true, twinkle: false });
  winnerStar.classList.add("reveal-winner-star");
  winnerStar.style.transformOrigin = `${cx}px ${cy}px`;
  svg.append(winnerStar);

  const title = el("text", { x: cx, y: cy + 80, class: "reveal-title" });
  title.textContent = "Star of the night";
  const name = el("text", { x: cx, y: cy + 130, class: "reveal-name" });
  name.textContent = winner.playerName;
  const score = el("text", { x: cx, y: cy + 160, class: "reveal-score" });
  score.textContent = `${winner.score} points`;
  svg.append(title, name, score);

  overlay.append(svg);
  document.getElementById("display-root").append(overlay);

  setTimeout(() => {
    drawIn(paths, { duration: 1300, stagger: 110 });
    overlay.classList.add("lit");
  }, 60);
}

function closeReveal() {
  const overlay = document.querySelector(".reveal-overlay");
  if (overlay) overlay.remove();
  revealOpen = false;
}
