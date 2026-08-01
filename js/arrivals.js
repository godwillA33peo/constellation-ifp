// §2 Arrivals — the world map dissolves into the sky (radial mask in
// CSS, dotted land). Clusters light up one by one, their lines
// converging on Galway; tapping a cluster zooms the camera in
// (a transform, not a modal) to reveal the fellows inside it.
import { state } from "./store.js";
import { el, makeStar, handLine, constellationLinks, drawIn, mulberry32, hashString, initials, reducedMotion } from "./sky.js";
import { MAP_W, MAP_H, project, fetchLandPath, graticule } from "./worldmap.js";
import { openFellowCard } from "./ui.js";

const GALWAY = project(53.27, -9.05);

export function groupByCountry(fellows) {
  const map = new Map();
  for (const f of fellows) {
    if (!map.has(f.country)) map.set(f.country, []);
    map.get(f.country).push(f);
  }
  return map;
}

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

  const svg = el("svg", { viewBox: `0 0 ${MAP_W} ${MAP_H}`, class: "map-svg", "aria-hidden": "true" });
  const zoomG = el("g", { id: "zoom-g" });
  svg.append(zoomG);

  zoomG.append(graticule());
  const landGroup = el("g");
  zoomG.append(landGroup);

  const linesGroup = el("g");
  const starsGroup = el("g");
  zoomG.append(linesGroup, starsGroup);

  // Galway — where every line ends
  const galwayStar = makeStar(GALWAY[0], GALWAY[1], 3.2, { gold: true });
  const galwayLabel = el("text", { class: "galway-label", x: GALWAY[0], y: GALWAY[1] - 8 });
  galwayLabel.textContent = "Galway";
  zoomG.append(galwayStar, galwayLabel);

  const clusters = [...groupByCountry(state.fellows).entries()]
    .sort((a, b) => dist(project(a[1][0].lat, a[1][0].lng), GALWAY) - dist(project(b[1][0].lat, b[1][0].lng), GALWAY));

  const clusterEls = [];

  for (const [country, fellows] of clusters) {
    const rng = mulberry32(hashString(country));
    const anchor = project(fellows[0].lat, fellows[0].lng);
    const points = clusterPositions(fellows, anchor);

    const g = el("g", { class: "cluster", tabindex: "0", role: "button" });
    g.setAttribute("aria-label", `${country} — ${fellows.length} fellow${fellows.length > 1 ? "s" : ""}. Zoom in.`);
    g.style.setProperty("--beat-delay", `${(rng() * 3).toFixed(2)}s`);

    // line home to Galway (behind the stars)
    const converge = handLine(anchor[0], anchor[1], GALWAY[0], GALWAY[1], rng, "constellation-line faint converge-line");
    linesGroup.append(converge);

    const innerLines = [];
    for (const [a, b] of constellationLinks(points)) {
      const p = handLine(a[0], a[1], b[0], b[1], rng);
      innerLines.push(p);
    }

    const starsSub = el("g", { class: "cluster-stars" });
    innerLines.forEach((p) => starsSub.append(p));
    points.forEach((p) => starsSub.append(makeStar(p[0], p[1], 2.4 + rng() * 0.8, { rng })));
    g.append(el("circle", { class: "cluster-hit", cx: anchor[0], cy: anchor[1], r: 22 }), starsSub);

    const label = el("text", { class: "cluster-label", x: anchor[0], y: anchor[1] + 26 });
    label.textContent = country;
    g.append(label);

    g.append(buildFellowNodes(country, fellows, anchor, rng));

    const open = () => zoomTo(g, anchor);
    g.addEventListener("click", (e) => { e.stopPropagation(); if (!svg.classList.contains("zoomed")) open(); });
    g.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !svg.classList.contains("zoomed")) { e.preventDefault(); open(); }
    });

    starsGroup.append(g);
    clusterEls.push({ g, converge, innerLines });
  }

  const back = document.createElement("button");
  back.className = "map-back";
  back.hidden = true;
  back.textContent = "← back to the whole sky";
  wrap.append(svg, back);

  back.addEventListener("click", zoomOut);
  svg.addEventListener("click", (e) => {
    if (svg.classList.contains("zoomed") && !e.target.closest(".fellow-node")) zoomOut();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && svg.classList.contains("zoomed")) zoomOut();
  });

  function zoomTo(g, anchor) {
    const scale = 6;
    zoomG.style.transformOrigin = `${anchor[0]}px ${anchor[1]}px`;
    zoomG.style.transform =
      `translate(${MAP_W / 2 - anchor[0]}px, ${MAP_H / 2 - anchor[1]}px) scale(${scale})`;
    svg.classList.add("zoomed");
    g.classList.add("zoom-target");
    back.hidden = false;
  }

  function zoomOut() {
    zoomG.style.transform = "none";
    svg.classList.remove("zoomed");
    svg.querySelectorAll(".zoom-target").forEach((n) => n.classList.remove("zoom-target"));
    back.hidden = true;
  }

  // arrival sequence: countries light up one by one, nearest to
  // Galway first, each line drawing home as its cluster wakes
  let played = false;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting) || played) return;
    played = true;
    io.disconnect();
    if (reducedMotion()) {
      clusterEls.forEach(({ g }) => g.classList.add("lit"));
      return;
    }
    clusterEls.forEach(({ g, converge, innerLines }, i) => {
      setTimeout(() => {
        g.classList.add("lit");
        drawIn([...innerLines, converge], { duration: 900, stagger: 70 });
      }, 350 + i * 240);
    });
  }, { threshold: 0.25 });
  io.observe(wrap);

  fetchLandPath().then((d) => {
    if (d) landGroup.append(el("path", { class: "map-land", d }));
  });

  return svg;
}

// The zoomed-in reveal: fellows ringed around their country's anchor,
// name + course + photo star, all in map coordinates so the camera
// move is one transform.
function buildFellowNodes(country, fellows, anchor, rng) {
  const wrap = el("g");
  const n = fellows.length;
  fellows.forEach((f, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = n === 1 ? 0 : 30;
    const x = anchor[0] + Math.cos(angle) * r * 1.25;
    const y = anchor[1] + Math.sin(angle) * r * 0.8;

    const node = el("g", { class: "fellow-node", tabindex: "-1" });

    // initials star underneath; the photo covers it when it loads
    node.append(el("circle", { cx: x, cy: y, r: 7.5, fill: "rgba(5,7,20,0.85)", stroke: "rgba(230,200,122,0.7)", "stroke-width": 0.4 }));
    const init = el("text", {
      x, y: y + 2.2, style:
        "fill:#E6C87A;font-family:Fraunces,serif;font-size:5px;text-anchor:middle;",
    });
    init.textContent = initials(f.name);
    node.append(init);

    const clipId = `clip-${hashString(f.id)}`;
    const clip = el("clipPath", { id: clipId });
    clip.append(el("circle", { cx: x, cy: y, r: 7.5 }));
    node.append(clip);
    const img = el("image", {
      href: f.photoUrl.replace(/^\//, ""),
      x: x - 7.5, y: y - 7.5, width: 15, height: 15,
      "clip-path": `url(#${clipId})`,
      preserveAspectRatio: "xMidYMid slice",
    });
    node.append(img);

    const nameEl = el("text", { class: "fn-name", x, y: y + 12.5 });
    nameEl.textContent = f.name;
    const courseEl = el("text", { class: "fn-course", x, y: y + 15.6 });
    courseEl.textContent = f.course;
    node.append(nameEl, courseEl);

    node.addEventListener("click", (e) => { e.stopPropagation(); openFellowCard(f); });
    wrap.append(node);
  });
  return wrap;
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
