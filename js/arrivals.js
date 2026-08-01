// §2.1 Arrivals — the world map as a night sky. Each country is a
// small star-cluster (one star per fellow), lines draw in on load.
import { state } from "./store.js";
import { el, makeStar, handLine, constellationLinks, drawIn, mulberry32, hashString } from "./sky.js";
import { MAP_W, MAP_H, project, fetchLandPath, graticule } from "./worldmap.js";
import { openFellowCard, esc } from "./ui.js";

export function groupByCountry(fellows) {
  const map = new Map();
  for (const f of fellows) {
    if (!map.has(f.country)) map.set(f.country, []);
    map.get(f.country).push(f);
  }
  return map;
}

// Jittered star position for a fellow within its country cluster —
// golden-angle spread so 2–3 stars read as a wee constellation.
export function clusterPositions(fellows, anchor, spread = 11) {
  return fellows.map((f, i) => {
    if (fellows.length === 1) return anchor;
    const angle = i * 2.399963 + hashString(f.country) % 7;
    const radius = spread * (0.55 + 0.45 * ((i % 3) / 2));
    return [anchor[0] + Math.cos(angle) * radius, anchor[1] + Math.sin(angle) * radius];
  });
}

export async function initArrivals() {
  const wrap = document.getElementById("arrivals-map");
  const panel = document.getElementById("cluster-panel");

  const svg = el("svg", { viewBox: `0 0 ${MAP_W} ${MAP_H}`, "aria-hidden": "true" });
  svg.append(graticule());

  const landGroup = el("g");
  svg.append(landGroup);

  const linesGroup = el("g");
  const starsGroup = el("g");
  svg.append(linesGroup, starsGroup);

  const clusters = groupByCountry(state.fellows);
  const allPaths = [];

  for (const [country, fellows] of clusters) {
    const rng = mulberry32(hashString(country));
    const anchor = project(fellows[0].lat, fellows[0].lng);
    const points = clusterPositions(fellows, anchor);

    for (const [a, b] of constellationLinks(points)) {
      const path = handLine(a[0], a[1], b[0], b[1], rng);
      linesGroup.append(path);
      allPaths.push(path);
    }

    const g = el("g", { class: "cluster", tabindex: "0", role: "button" });
    g.setAttribute("aria-label", `${country} — ${fellows.length} fellow${fellows.length > 1 ? "s" : ""}`);
    g.append(el("circle", { class: "cluster-hit", cx: anchor[0], cy: anchor[1], r: 22 }));
    points.forEach((p) => g.append(makeStar(p[0], p[1], 2.4 + rng() * 0.8, { rng })));

    const label = el("text", {
      class: "cluster-label",
      x: anchor[0],
      y: anchor[1] + 26,
    });
    label.textContent = country;
    g.append(label);

    const open = () => openClusterPanel(panel, country, fellows);
    g.addEventListener("click", open);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    starsGroup.append(g);
  }

  wrap.append(svg);

  // The orchestrated moment: sky assembles once the section is seen.
  let drawn = false;
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !drawn) {
      drawn = true;
      drawIn(allPaths, { duration: 1100, stagger: 55 });
      io.disconnect();
    }
  }, { threshold: 0.2 });
  io.observe(wrap);

  // Land loads async; stars never wait for it.
  fetchLandPath().then((d) => {
    if (d) landGroup.append(el("path", { class: "map-land", d }));
  });

  return svg; // display mode reuses this
}

function openClusterPanel(panel, country, fellows) {
  panel.hidden = false;
  panel.innerHTML = `
    <h2>${esc(country)}</h2>
    <p class="cluster-count">${fellows.length} of us started here</p>
    <div class="fellow-chiplist"></div>
    <button class="panel-close">Close</button>`;
  const list = panel.querySelector(".fellow-chiplist");
  for (const f of fellows) {
    const chip = document.createElement("button");
    chip.className = "fellow-chip";
    chip.textContent = f.name;
    chip.addEventListener("click", () => openFellowCard(f));
    list.append(chip);
  }
  panel.querySelector(".panel-close").addEventListener("click", () => {
    panel.hidden = true;
  });
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
