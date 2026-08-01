// §5.2 Arrivals — countries feed into Galway, fast palette version.
//
// A dotted world map fades out of the starfield. Then, brisk and
// rhythmic (~10–12s total, not a slow one-at-a-time reveal): each
// country's dot flashes in its own flag-derived palette and sends a
// quick streak of that colour arcing to Galway. Countries with
// several fellows fire several fast pulses in immediate succession.
// Every landing nudges Galway's point brighter and very slightly
// larger, and briefly washes that country's colour into the
// surrounding sky — so by the end Galway has grown into a rich,
// layered glow built from all 22 palettes.
//
// No names, no photos, no flags: dots, colour, and a country-based
// tally ("14 / 22 countries converging…"). Afterwards the map stays
// explorable — tap a dot to see that country's fellow count.
import { allCountries } from "./countries.js";
import { el, handLine, drawIn, mulberry32, reducedMotion } from "./sky.js";
import { MAP_W, MAP_H, project, fetchLandPath, graticule } from "./worldmap.js";
import { pulseSky } from "./atmosphere.js";
import { arrivalNote, arrivalChord } from "./soundscape.js";
import { openCountryCard } from "./ui.js";

const GALWAY = project(53.27, -9.05);
const SEQUENCE_MS = 11000;   // the whole 35-arc cascade, start to finish
const ARC_MS = 480;          // one quick streak of colour, country → Galway

export async function initArrivals() {
  const wrap = document.getElementById("arrivals-map");
  const countries = allCountries();
  const totalFellows = countries.reduce((s, c) => s + c.fellow_count, 0);

  // ---- DOM scaffolding: svg map + particle canvas + HUD ----
  const scroller = document.createElement("div");
  scroller.className = "map-scroller";
  const svg = el("svg", { viewBox: `0 0 ${MAP_W} ${MAP_H}`, class: "map-svg", "aria-hidden": "true" });
  const canvas = document.createElement("canvas");
  canvas.className = "arrivals-canvas";
  scroller.append(svg, canvas);

  const hud = document.createElement("div");
  hud.className = "arrivals-hud";
  hud.innerHTML = `
    <p class="arrivals-counter" aria-live="polite"><span data-count>0</span> / ${countries.length} countries converging…</p>
    <button class="arrivals-replay" type="button" hidden>✦ replay the arrivals</button>`;
  const caption = document.createElement("p");
  caption.className = "arrivals-caption";
  caption.textContent = `${totalFellows} of us. ${countries.length} countries. One Galway.`;

  wrap.append(scroller, hud, caption);

  const zoomG = el("g", { id: "zoom-g" });
  svg.append(zoomG);
  zoomG.append(graticule());
  const landGroup = el("g");
  zoomG.append(landGroup);
  fetchLandPath().then((d) => {
    if (d) landGroup.append(el("path", { class: "map-land", d }));
  });

  // Galway: the point everything converges on and grows into a
  // rich, layered glow (painted on the canvas below); the star
  // itself just grows a little richer with each landing
  const galwayHalo = el("circle", { cx: GALWAY[0], cy: GALWAY[1], r: 7.8, class: "galway-halo" });
  const galwayCore = el("circle", { cx: GALWAY[0], cy: GALWAY[1], r: 2.6, class: "star-core gold galway-core" });
  const galwayLabel = el("text", { class: "galway-label", x: GALWAY[0], y: GALWAY[1] - 16 });
  galwayLabel.textContent = "Galway";
  zoomG.append(galwayHalo, galwayCore, galwayLabel);

  // ---- country dots (west → east order drives the sequence) ----
  const list = countries.map((c) => ({ ...c, anchor: project(c.lat, c.lng) }));
  const dotEls = new Map();
  for (const c of list) {
    const g = el("g", { class: "country-dot", tabindex: "0", role: "button" });
    g.setAttribute("aria-label", `${c.name} — ${c.fellow_count} fellow${c.fellow_count > 1 ? "s" : ""}. Tap to see.`);
    g.append(
      el("circle", { class: "cluster-hit", cx: c.anchor[0], cy: c.anchor[1], r: 16 }),
      el("circle", { class: "dot-core", cx: c.anchor[0], cy: c.anchor[1], r: 1.8 })
    );
    const label = el("text", { class: "cluster-label", x: c.anchor[0], y: c.anchor[1] + 12 });
    label.textContent = c.name;
    g.append(label);
    const open = () => openCountryCard(c);
    g.addEventListener("click", open);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    zoomG.append(g);
    dotEls.set(c.name, g);
  }

  // ---- particle layer: fast colour streaks + Galway's growing glow ----
  const particles = [];
  let ctx = null, cw = 0, ch = 0, scale = 1;
  function fitCanvas() {
    const r = svg.getBoundingClientRect();
    cw = canvas.width = Math.max(1, Math.round(r.width));
    ch = canvas.height = Math.max(1, Math.round(r.height));
    scale = cw / MAP_W;
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas, { passive: true });

  let raf = null;
  function paintLoop() {
    ctx = ctx || canvas.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);
    const now = performance.now();
    for (const p of particles) p.draw(ctx, now, scale);
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].dead) particles.splice(i, 1);
    raf = particles.length ? requestAnimationFrame(paintLoop) : null;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(paintLoop); }

  // Galway's glow accumulates one soft layer per landing
  const galwayLayers = [];
  function paintGalwayGlow(c, now) {
    const [gx, gy] = GALWAY;
    return {
      dead: false,
      draw(ctx2, n) {
        const age = n - now;
        const k = Math.min(1, age / 500);
        ctx2.globalAlpha = 0.16 * k;
        const r = (10 + galwayLayers.length * 1.4) * (0.4 + k * 0.6);
        const grad = ctx2.createRadialGradient(gx * scale, gy * scale, 0, gx * scale, gy * scale, r * scale);
        grad.addColorStop(0, c);
        grad.addColorStop(1, "transparent");
        ctx2.fillStyle = grad;
        ctx2.fillRect((gx - r) * scale, (gy - r) * scale, r * 2 * scale, r * 2 * scale);
      },
    };
  }

  // a brief wash of a country's colour across the surrounding sky
  function skyWash(color) {
    const t0 = performance.now();
    return {
      dead: false,
      draw(ctx2, now) {
        const k = (now - t0) / 900;
        if (k >= 1) { this.dead = true; return; }
        ctx2.globalAlpha = 0.1 * (1 - k);
        const grad = ctx2.createRadialGradient(cw / 2, ch * 0.4, 0, cw / 2, ch * 0.4, cw * 0.6);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "transparent");
        ctx2.fillStyle = grad;
        ctx2.fillRect(0, 0, cw, ch);
      },
    };
  }

  // one quick streak of colour, country → Galway
  function launch(anchor, color, onLand) {
    const t0 = performance.now();
    const [ax, ay] = anchor;
    const [gx, gy] = GALWAY;
    const mx = (ax + gx) / 2, my = Math.min(ay, gy) - 34;

    particles.push({
      dead: false,
      draw(ctx2, now) {
        const k = Math.min(1, (now - t0) / ARC_MS);
        if (k >= 1) { this.dead = true; return; }
        // a short comet-like streak riding the arc, fading tail behind
        for (let s = 0; s < 6; s++) {
          const kk = Math.max(0, k - s * 0.05);
          const u = 1 - kk;
          const x = u * u * ax + 2 * u * kk * mx + kk * kk * gx;
          const y = u * u * ay + 2 * u * kk * my + kk * kk * gy;
          ctx2.globalAlpha = (1 - s / 6) * 0.85 * Math.sin(Math.PI * Math.min(1, kk + 0.02));
          ctx2.fillStyle = color;
          ctx2.beginPath();
          ctx2.arc(x * scale, y * scale, (2.2 - s * 0.25) * scale * 0.5 + 0.6, 0, Math.PI * 2);
          ctx2.fill();
        }
        ctx2.globalAlpha = 1;
      },
    });

    setTimeout(() => {
      onLand();
      particles.push(paintGalwayGlow(color, performance.now()));
      particles.push(skyWash(color));
      wake();
    }, ARC_MS);
    wake();
  }

  // ---- the sequence ----
  const order = list.flatMap((c) => Array(c.fellow_count).fill(c));
  const counterEl = hud.querySelector("[data-count]");
  const replayBtn = hud.querySelector(".arrivals-replay");
  const perArc = SEQUENCE_MS / order.length;
  let arrivedCountries = new Set();
  let running = false;
  const timers = [];

  function resetSequence() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    particles.length = 0;
    galwayLayers.length = 0;
    arrivedCountries = new Set();
    counterEl.textContent = "0";
    caption.classList.remove("shown");
    galwayCore.classList.remove("grown");
    galwayCore.setAttribute("r", 2.6);
  }

  function showFinalState() {
    resetSequence();
    order.forEach((c) => arrivedCountries.add(c.name));
    counterEl.textContent = String(arrivedCountries.size);
    galwayLayers.push(...order.map(() => 1));
    galwayCore.setAttribute("r", 2.6 + Math.min(3.5, galwayLayers.length * 0.09));
    caption.classList.add("shown");
    replayBtn.hidden = false;
  }

  function play() {
    if (running) return;
    running = true;
    resetSequence();
    replayBtn.hidden = true;
    order.forEach((c, i) => {
      timers.push(setTimeout(() => {
        const dot = dotEls.get(c.name);
        const palette = c.palette?.[0] || "#E6C87A";
        dot.classList.add("pulsing");
        dot.style.setProperty("--dot-color", palette);
        timers.push(setTimeout(() => dot.classList.remove("pulsing"), ARC_MS + 120));
        launch(project(c.lat, c.lng), palette, () => {
          if (!arrivedCountries.has(c.name)) {
            arrivedCountries.add(c.name);
            counterEl.textContent = String(arrivedCountries.size);
          }
          galwayLayers.push(1);
          galwayCore.setAttribute("r", 2.6 + Math.min(3.5, galwayLayers.length * 0.09));
          pulseSky(0.4);
          arrivalNote(i, order.length);
          if (i === order.length - 1) {
            galwayCore.classList.add("grown");
            caption.classList.add("shown");
            replayBtn.hidden = false;
            arrivalChord();
            running = false;
          }
        });
      }, i * perArc));
    });
  }

  replayBtn.addEventListener("click", play);

  let seen = false;
  function startIfVisible() {
    if (seen) return;
    seen = true;
    io.disconnect();
    window.removeEventListener("scroll", scrollCheck);
    if (reducedMotion()) showFinalState();
    else play();
  }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) startIfVisible();
  }, { threshold: 0.35 });
  io.observe(wrap);
  const scrollCheck = () => {
    const r = wrap.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.65 && r.bottom > window.innerHeight * 0.25) startIfVisible();
  };
  window.addEventListener("scroll", scrollCheck, { passive: true });

  // ---- explore: tap a dot → gentle zoom + the country card ----
  const back = document.createElement("button");
  back.className = "map-back";
  back.hidden = true;
  back.textContent = "← back to the whole sky";
  wrap.append(back);

  function zoomTo(anchor) {
    zoomG.style.transformOrigin = `${anchor[0]}px ${anchor[1]}px`;
    zoomG.style.transform = `translate(${MAP_W / 2 - anchor[0]}px, ${MAP_H / 2 - anchor[1]}px) scale(3.2)`;
    svg.classList.add("zoomed");
    back.hidden = false;
  }
  function zoomOut() {
    zoomG.style.transform = "none";
    svg.classList.remove("zoomed");
    back.hidden = true;
  }
  dotEls.forEach((g, name) => {
    const c = list.find((x) => x.name === name);
    g.addEventListener("click", () => zoomTo(c.anchor));
  });
  back.addEventListener("click", zoomOut);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && svg.classList.contains("zoomed")) zoomOut();
  });

  return svg;
}
