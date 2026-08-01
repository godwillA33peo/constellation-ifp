// §3 Sky Gallery — an open patch of sky that bleeds off its edges
// (CSS mask). Drag to pan, pinch (or buttons / ctrl+wheel) to zoom,
// tap a photo-star and it blooms while the rest of the sky dims.
// Two parallax star layers drift at different speeds behind the
// photos so the sky reads as deep, not flat.
import { state } from "./store.js";
import { el, handLine, drawIn, mulberry32, hashString, photoOrInitials, reducedMotion } from "./sky.js";
import { groupByCountry } from "./arrivals.js";
import { bloomTone } from "./soundscape.js";
import { esc } from "./ui.js";

export const SKY_W = 1900;
export const SKY_H = 1240;

export function layoutSky(fellows) {
  const clusters = [...groupByCountry(fellows).entries()];
  const cols = Math.ceil(Math.sqrt(clusters.length * (SKY_W / SKY_H)));
  const rows = Math.ceil(clusters.length / cols);
  const cellW = (SKY_W - 240) / cols;
  const cellH = (SKY_H - 240) / rows;

  return clusters.map(([country, members], i) => {
    const rng = mulberry32(hashString(country) ^ 0x5eed);
    const cx = 120 + (i % cols) * cellW + cellW * (0.3 + rng() * 0.4);
    const cy = 120 + Math.floor(i / cols) * cellH + cellH * (0.3 + rng() * 0.4);
    const stars = members.map((f, j) => {
      const angle = j * 2.399963 + rng() * 6.28;
      const radius = members.length === 1 ? 0 : 70 + rng() * 55;
      return { fellow: f, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.8 };
    });
    return { country, cx, cy, stars, rng };
  });
}

export function initGallery() {
  const stage = document.getElementById("gallery-sky");
  const small = window.innerWidth < 700;

  // -- parallax star layers (pre-rendered canvases, translate-only) --
  const layers = [
    { factor: 0.35, count: small ? 45 : 90, node: null },
    { factor: 0.65, count: small ? 60 : 120, node: null },
  ];
  layers.forEach((layer, li) => {
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
    layer.node = c;
    stage.append(c);
  });

  // -- the photo sky itself --
  const canvas = document.createElement("div");
  canvas.className = "gallery-canvas";
  canvas.style.width = `${SKY_W}px`;
  canvas.style.height = `${SKY_H}px`;

  const svg = el("svg", { viewBox: `0 0 ${SKY_W} ${SKY_H}`, width: SKY_W, height: SKY_H, "aria-hidden": "true" });
  canvas.append(svg);

  const allPaths = [];
  const photoStars = [];

  for (const cluster of layoutSky(state.fellows)) {
    for (const s of cluster.stars) {
      if (s.x === cluster.cx && s.y === cluster.cy) continue;
      const path = handLine(cluster.cx, cluster.cy, s.x, s.y, cluster.rng, "constellation-line faint");
      svg.append(path);
      allPaths.push(path);
    }
    svg.append(el("circle", { cx: cluster.cx, cy: cluster.cy, r: 2.2, class: "star-core gold" }));

    const label = document.createElement("span");
    label.className = "gallery-anchor-label";
    label.style.left = `${cluster.cx}px`;
    label.style.top = `${cluster.cy - 16}px`;
    label.textContent = cluster.country;
    canvas.append(label);

    for (const s of cluster.stars) {
      const btn = document.createElement("button");
      btn.className = "photo-star";
      btn.style.left = `${s.x}px`;
      btn.style.top = `${s.y}px`;
      btn.setAttribute("aria-label", `${s.fellow.name}, ${s.fellow.country}`);

      const inner = document.createElement("span");
      inner.className = "ps-inner";
      const rng = mulberry32(hashString(s.fellow.id));
      inner.style.setProperty("--drift-dur", `${7 + rng() * 6}s`);
      inner.style.setProperty("--drift-delay", `${-rng() * 8}s`);
      inner.style.setProperty("--drift-x", `${(rng() * 8 - 4).toFixed(1)}px`);
      inner.style.setProperty("--drift-y", `${(rng() * 8 - 4).toFixed(1)}px`);
      inner.append(photoOrInitials(s.fellow));

      const nameTag = document.createElement("span");
      nameTag.className = "photo-name";
      nameTag.textContent = s.fellow.name.split(" ")[0];

      const info = document.createElement("span");
      info.className = "bloom-info";
      info.innerHTML = `<span class="bi-name">${esc(s.fellow.name)}</span>
        <span class="bi-meta">${esc(s.fellow.course)}</span>
        <span class="bi-meta">${esc(s.fellow.country)}</span>`;

      btn.append(inner, nameTag, info);
      btn.addEventListener("click", (e) => {
        if (suppressClick) return;
        e.stopPropagation();
        toggleBloom(btn);
      });
      canvas.append(btn);
      photoStars.push(btn);
    }
  }

  stage.append(canvas);

  // zoom controls (also the no-pinch fallback)
  const controls = document.createElement("div");
  controls.className = "gallery-controls";
  controls.innerHTML = `
    <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
    <button type="button" data-zoom="reset" aria-label="Reset view">✦</button>`;
  stage.append(controls);

  // -- camera state --
  const view = { x: 0, y: 0, s: 1 };
  const S_MIN = 0.5, S_MAX = 2.6;

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
    layers.forEach((l) => {
      l.node.style.transform =
        `translate(${view.x * l.factor}px, ${view.y * l.factor}px) scale(${view.s})`;
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

  // -- pointer pan + pinch --
  const pointers = new Map();
  let lastMid = null, lastDist = 0, moved = 0, suppressClick = false;

  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".gallery-controls")) return;
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
      if (moved > 8) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 120);
      }
    }
  };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  // trackpad pinch arrives as ctrl+wheel; plain wheel keeps scrolling the page
  stage.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  // keyboard pan/zoom for the focused stage
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

  // -- bloom --
  function toggleBloom(btn) {
    const current = canvas.querySelector(".photo-star.bloom");
    if (current && current !== btn) current.classList.remove("bloom");
    if (current === btn) {
      btn.classList.remove("bloom");
      stage.classList.remove("dimmed");
      return;
    }
    btn.classList.add("bloom");
    stage.classList.add("dimmed");
    bloomTone();
  }
  stage.addEventListener("click", (e) => {
    if (suppressClick || e.target.closest(".photo-star") || e.target.closest(".gallery-controls")) return;
    const current = canvas.querySelector(".photo-star.bloom");
    if (current) { current.classList.remove("bloom"); stage.classList.remove("dimmed"); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const current = canvas.querySelector(".photo-star.bloom");
    if (current) { current.classList.remove("bloom"); stage.classList.remove("dimmed"); }
  });

  // -- stars appear one at a time at dusk --
  let bornPlayed = false;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((x) => x.isIntersecting) || bornPlayed) return;
    bornPlayed = true;
    io.disconnect();
    if (reducedMotion()) {
      photoStars.forEach((b) => b.classList.add("born"));
      drawInStatic();
      return;
    }
    const order = [...photoStars].sort(() => Math.random() - 0.5);
    order.forEach((b, i) => setTimeout(() => b.classList.add("born"), 120 + i * 90));
    setTimeout(() => drawIn(allPaths, { duration: 900, stagger: 30 }), 400);
  }, { threshold: 0.15 });
  io.observe(stage);

  function drawInStatic() { /* lines are already visible; nothing to animate */ }
}
