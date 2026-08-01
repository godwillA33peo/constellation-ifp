// §5.3 Sky Gallery — photo-free for now. A free-roaming, pannable,
// zoomable starfield where each country is a softly pulsing cluster
// of light in its own palette, labelled with just the country name
// and fellow count. Drag to pan, pinch/scroll-wheel to zoom, tap a
// cluster to bloom and show the count. No names, no photos, no moon
// — this can be swapped for real photography later without
// restructuring the scene.
import { allCountries } from "./countries.js";
import { el, handLine, drawIn, mulberry32, hashString, reducedMotion } from "./sky.js";
import { bloomTone } from "./soundscape.js";
import { esc } from "./ui.js";

export const SKY_W = 1900;
export const SKY_H = 1240;

export function layoutSky(countries) {
  const cols = Math.ceil(Math.sqrt(countries.length * (SKY_W / SKY_H)));
  const rows = Math.ceil(countries.length / cols);
  const cellW = (SKY_W - 240) / cols;
  const cellH = (SKY_H - 240) / rows;

  return countries.map((country, i) => {
    const rng = mulberry32(hashString(country.name) ^ 0x5eed);
    const cx = 120 + (i % cols) * cellW + cellW * (0.3 + rng() * 0.4);
    const cy = 120 + Math.floor(i / cols) * cellH + cellH * (0.3 + rng() * 0.4);
    // one point of light per fellow, loosely orbiting the cluster centre
    const points = Array.from({ length: country.fellow_count }, (_, j) => {
      const angle = j * 2.399963 + rng() * 6.28;
      const radius = country.fellow_count === 1 ? 0 : 26 + rng() * 22;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.85 };
    });
    return { country, cx, cy, points, rng };
  });
}

export function initGallery() {
  const stage = document.getElementById("gallery-sky");
  const countries = allCountries();
  const small = window.innerWidth < 700;

  // -- parallax star layers --
  const layers = [
    { factor: 0.35, count: small ? 45 : 90 },
    { factor: 0.65, count: small ? 60 : 120 },
  ];
  const layerNodes = layers.map((layer, li) => {
    const c = document.createElement("canvas");
    c.className = "parallax-layer";
    c.width = SKY_W / 2;
    c.height = SKY_H / 2;
    c.style.width = `${SKY_W}px`;
    c.style.height = `${SKY_H}px`;
    const g = c.getContext("2d");
    const rng = mulberry32(311 + li * 97);
    g.fillStyle = "#F5F3EE";
    for (let i = 0; i < layer.count; i++) {
      g.globalAlpha = 0.12 + rng() * (li === 0 ? 0.2 : 0.34);
      g.beginPath();
      g.arc(rng() * c.width, rng() * c.height, 0.4 + rng() * (li === 0 ? 0.7 : 1.0), 0, Math.PI * 2);
      g.fill();
    }
    stage.append(c);
    return { node: c, factor: layer.factor };
  });

  const canvas = document.createElement("div");
  canvas.className = "gallery-canvas";
  canvas.style.width = `${SKY_W}px`;
  canvas.style.height = `${SKY_H}px`;

  const svg = el("svg", { viewBox: `0 0 ${SKY_W} ${SKY_H}`, width: SKY_W, height: SKY_H, "aria-hidden": "true" });
  canvas.append(svg);

  const allPaths = [];
  const clusterEls = [];

  for (const cluster of layoutSky(countries)) {
    const [c1, c2] = cluster.country.palette;
    for (const p of cluster.points) {
      if (p.x === cluster.cx && p.y === cluster.cy) continue;
      const path = handLine(cluster.cx, cluster.cy, p.x, p.y, cluster.rng, "constellation-line faint");
      svg.append(path);
      allPaths.push(path);
    }

    const btn = document.createElement("button");
    btn.className = "palette-cluster";
    btn.style.left = `${cluster.cx}px`;
    btn.style.top = `${cluster.cy}px`;
    btn.style.setProperty("--c1", c1);
    btn.style.setProperty("--c2", c2 || c1);
    btn.setAttribute("aria-label", `${cluster.country.name} — ${cluster.country.fellow_count} fellow${cluster.country.fellow_count > 1 ? "s" : ""}`);

    const glow = document.createElement("span");
    glow.className = "cluster-glow born";
    btn.append(glow);

    for (const p of cluster.points) {
      const dot = document.createElement("span");
      dot.className = "cluster-point";
      dot.style.left = `${p.x - cluster.cx}px`;
      dot.style.top = `${p.y - cluster.cy}px`;
      dot.style.setProperty("--drift-dur", `${7 + cluster.rng() * 6}s`);
      dot.style.setProperty("--drift-delay", `${-cluster.rng() * 8}s`);
      btn.append(dot);
    }

    const label = document.createElement("span");
    label.className = "cluster-name";
    label.textContent = cluster.country.name;
    const info = document.createElement("span");
    info.className = "bloom-info";
    info.innerHTML = `<span class="bi-name">${esc(cluster.country.name)}</span>
      <span class="bi-meta">${cluster.country.fellow_count} fellow${cluster.country.fellow_count > 1 ? "s" : ""}</span>`;

    btn.append(label, info);
    btn.addEventListener("click", (e) => {
      if (suppressClick) return;
      e.stopPropagation();
      toggleBloom(btn);
    });
    canvas.append(btn);
    clusterEls.push(btn);
  }

  stage.append(canvas);

  // zoom controls
  const controls = document.createElement("div");
  controls.className = "gallery-controls";
  controls.innerHTML = `
    <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
    <button type="button" data-zoom="reset" aria-label="Reset view">✦</button>`;
  stage.append(controls);

  let exploring = false;
  stage.style.touchAction = "pan-y";
  const exploreBtn = document.createElement("button");
  exploreBtn.className = "explore-toggle";
  exploreBtn.type = "button";
  exploreBtn.setAttribute("aria-pressed", "false");
  exploreBtn.textContent = "✦ explore the sky";
  exploreBtn.addEventListener("click", () => {
    exploring = !exploring;
    exploreBtn.setAttribute("aria-pressed", String(exploring));
    exploreBtn.textContent = exploring ? "✕ done exploring" : "✦ explore the sky";
    exploreBtn.classList.toggle("on", exploring);
    stage.style.touchAction = exploring ? "none" : "pan-y";
  });
  stage.append(exploreBtn);

  // -- camera state --
  const view = { x: 0, y: 0, s: 1 };
  const S_MIN = 0.5, S_MAX = 2.6;
  let suppressClick = false;

  function clampView() {
    view.s = Math.min(S_MAX, Math.max(S_MIN, view.s));
    const w = stage.clientWidth, h = stage.clientHeight;
    const minX = Math.min(0, w - SKY_W * view.s) - 80;
    const minY = Math.min(0, h - SKY_H * view.s) - 80;
    view.x = Math.min(80, Math.max(minX, view.x));
    view.y = Math.min(80, Math.max(minY, view.y));
  }
  function apply() {
    clampView();
    canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
    layerNodes.forEach((l) => {
      l.node.style.transform = `translate(${view.x * l.factor}px, ${view.y * l.factor}px) scale(${view.s})`;
    });
  }
  function zoomAt(px, py, factor) {
    const ns = Math.min(S_MAX, Math.max(S_MIN, view.s * factor));
    const k = ns / view.s;
    view.x = px - (px - view.x) * k;
    view.y = py - (py - view.y) * k;
    view.s = ns;
    apply();
  }
  function resetView() {
    view.s = Math.max(S_MIN, Math.min(1, stage.clientHeight / SKY_H * 1.4));
    view.x = (stage.clientWidth - SKY_W * view.s) / 2;
    view.y = (stage.clientHeight - SKY_H * view.s) / 3;
    apply();
  }
  resetView();
  window.addEventListener("resize", apply, { passive: true });

  controls.addEventListener("click", (e) => {
    const kind = e.target.dataset?.zoom;
    if (!kind) return;
    const cx = stage.clientWidth / 2, cy = stage.clientHeight / 2;
    if (kind === "in") zoomAt(cx, cy, 1.35);
    else if (kind === "out") zoomAt(cx, cy, 1 / 1.35);
    else resetView();
  });

  const pointers = new Map();
  let lastMid = null, lastDist = 0, moved = 0;

  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".gallery-controls") || e.target.closest(".explore-toggle")) return;
    if (e.pointerType !== "mouse" && !exploring) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pointers.size === 1) stage.classList.add("dragging");
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      lastDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  stage.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const rect = stage.getBoundingClientRect();
    if (pointers.size === 1) {
      view.x += e.clientX - p.x;
      view.y += e.clientY - p.y;
      moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
      apply();
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist > 0) zoomAt(mid.x - rect.left, mid.y - rect.top, d / lastDist);
      view.x += mid.x - lastMid.x;
      view.y += mid.y - lastMid.y;
      apply();
      lastMid = mid; lastDist = d;
      moved += 10;
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) { lastMid = null; lastDist = 0; }
    if (pointers.size === 0) {
      stage.classList.remove("dragging");
      if (moved > 8) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 120); }
    }
  };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  stage.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  stage.addEventListener("keydown", (e) => {
    const step = 60;
    if (e.key === "ArrowLeft") { view.x += step; apply(); }
    else if (e.key === "ArrowRight") { view.x -= step; apply(); }
    else if (e.key === "ArrowUp") { view.y += step; apply(); }
    else if (e.key === "ArrowDown") { view.y -= step; apply(); }
    else if (e.key === "+" || e.key === "=") zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.2);
    else if (e.key === "-") zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1 / 1.2);
    else return;
    e.preventDefault();
  });

  function toggleBloom(btn) {
    const current = canvas.querySelector(".palette-cluster.bloom");
    if (current && current !== btn) current.classList.remove("bloom");
    if (current === btn) { btn.classList.remove("bloom"); stage.classList.remove("dimmed"); return; }
    btn.classList.add("bloom");
    stage.classList.add("dimmed");
    bloomTone();
  }
  stage.addEventListener("click", (e) => {
    if (suppressClick || e.target.closest(".palette-cluster") || e.target.closest(".gallery-controls")) return;
    const current = canvas.querySelector(".palette-cluster.bloom");
    if (current) { current.classList.remove("bloom"); stage.classList.remove("dimmed"); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const current = canvas.querySelector(".palette-cluster.bloom");
    if (current) { current.classList.remove("bloom"); stage.classList.remove("dimmed"); }
  });

  let bornPlayed = false;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((x) => x.isIntersecting) || bornPlayed) return;
    bornPlayed = true;
    io.disconnect();
    if (reducedMotion()) {
      clusterEls.forEach((b) => b.classList.add("born"));
      return;
    }
    const order = [...clusterEls].sort(() => Math.random() - 0.5);
    order.forEach((b, i) => setTimeout(() => b.classList.add("born"), 120 + i * 90));
    setTimeout(() => drawIn(allPaths, { duration: 900, stagger: 30 }), 400);
  }, { threshold: 0.15 });
  io.observe(stage);
}
