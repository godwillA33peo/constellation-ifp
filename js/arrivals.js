// §5.2 Arrivals — "the community grows". The signature section.
//
// A dotted world map fades out of the starfield. Then, one fellow at
// a time (west → east): their country's dot pulses, their flag
// materialises deep in the field as a particle mosaic, rushes forward,
// holds a half-beat, dissolves into a swarm in the flag's colours that
// streams along a luminous arc to Galway — and a small head joins the
// growing huddle. A counter ticks to 35; the finished huddle pulses
// under the caption. Ambient, never a gate: scrolling is untouched,
// and a replay star runs it again.
//
// Afterwards the map is explorable: tap a country dot and the camera
// flies in to meet its fellows.
import { state } from "./store.js";
import { el, makeStar, handLine, drawIn, mulberry32, hashString, initials, reducedMotion } from "./sky.js";
import { MAP_W, MAP_H, project, fetchLandPath, graticule } from "./worldmap.js";
import { flagMosaic, flagColors } from "./flags.js";
import { pulseSky } from "./atmosphere.js";
import { arrivalNote, arrivalChord } from "./soundscape.js";
import { openFellowCard } from "./ui.js";

const GALWAY = project(53.27, -9.05);
const TURN_MS = 640;        // a new departure this often
const FLY_MS = 520;         // flag grows/sharpens
const HOLD_MS = 260;        // full-size half-beat
const ARC_MS = 1200;        // stardust flight to Galway

export function groupByCountry(fellows) {
  const map = new Map();
  for (const f of fellows) {
    if (!map.has(f.country)) map.set(f.country, []);
    map.get(f.country).push(f);
  }
  return map;
}

// kept for the projector view
export function clusterPositions(fellows, anchor, spread = 11) {
  return fellows.map((f, i) => {
    if (fellows.length === 1) return anchor;
    const angle = i * 2.399963 + hashString(f.country) % 7;
    const radius = spread * (0.55 + 0.45 * ((i % 3) / 2));
    return [anchor[0] + Math.cos(angle) * radius, anchor[1] + Math.sin(angle) * radius];
  });
}

// huddle ring seats around the Galway point
function huddleSeats(n) {
  const rings = [[9, 13], [12, 22], [14, 31]]; // [seats, radius]
  const seats = [];
  let placed = 0;
  for (const [cap, r] of rings) {
    for (let i = 0; i < cap && placed < n; i++, placed++) {
      const a = -Math.PI / 2 + (i / cap) * Math.PI * 2 + (r % 7) * 0.13;
      seats.push([GALWAY[0] + Math.cos(a) * r, GALWAY[1] + Math.sin(a) * r * 0.85]);
    }
  }
  return seats;
}

export async function initArrivals() {
  const wrap = document.getElementById("arrivals-map");

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
    <p class="arrivals-counter" aria-live="polite"><span data-count>0</span> / ${state.fellows.length} arrived</p>
    <button class="arrivals-replay" type="button" hidden>✦ replay the arrivals</button>`;
  const caption = document.createElement("p");
  caption.className = "arrivals-caption";
  caption.setAttribute("data-kinetic-late", "");
  caption.textContent = `${state.fellows.length} of us. 22 countries. One Galway.`;

  wrap.append(scroller, hud, caption);

  const zoomG = el("g", { id: "zoom-g" });
  svg.append(zoomG);
  zoomG.append(graticule());
  const landGroup = el("g");
  zoomG.append(landGroup);
  fetchLandPath().then((d) => {
    if (d) landGroup.append(el("path", { class: "map-land", d }));
  });

  // Galway: the warm-gold point everything converges on
  const galwayStar = makeStar(GALWAY[0], GALWAY[1], 3.6, { gold: true });
  const galwayLabel = el("text", { class: "galway-label", x: GALWAY[0], y: GALWAY[1] - 42 });
  galwayLabel.textContent = "Galway";
  zoomG.append(galwayStar, galwayLabel);

  // ---- country dots (west → east order drives the sequence) ----
  const countries = [...groupByCountry(state.fellows).entries()]
    .sort((a, b) => a[1][0].lng - b[1][0].lng)
    .map(([country, fellows]) => ({ country, fellows, anchor: project(fellows[0].lat, fellows[0].lng) }));

  const dotEls = new Map();
  for (const c of countries) {
    const g = el("g", { class: "country-dot", tabindex: "0", role: "button" });
    g.setAttribute("aria-label", `${c.country} — ${c.fellows.length} fellow${c.fellows.length > 1 ? "s" : ""}. Zoom in.`);
    g.append(
      el("circle", { class: "cluster-hit", cx: c.anchor[0], cy: c.anchor[1], r: 18 }),
      el("circle", { class: "dot-core", cx: c.anchor[0], cy: c.anchor[1], r: 2.6 })
    );
    const label = el("text", { class: "cluster-label", x: c.anchor[0], y: c.anchor[1] + 14 });
    label.textContent = c.country;
    g.append(label, buildFellowNodes(c.fellows, c.anchor));
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!svg.classList.contains("zoomed")) zoomTo(g, c.anchor);
    });
    g.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !svg.classList.contains("zoomed")) {
        e.preventDefault(); zoomTo(g, c.anchor);
      }
    });
    zoomG.append(g);
    dotEls.set(c.country, g);
  }

  // ---- the huddle (SVG avatars around Galway) ----
  const huddle = el("g", { class: "huddle" });
  zoomG.append(huddle);
  const seats = huddleSeats(state.fellows.length);

  function addHead(fellow, seatIdx) {
    const [x, y] = seats[seatIdx];
    const node = el("g", { class: "huddle-head" });
    node.append(el("circle", { cx: x, cy: y, r: 5.2, fill: "rgba(5,7,20,0.9)", stroke: "rgba(230,200,122,0.75)", "stroke-width": 0.5 }));
    const init = el("text", {
      x, y: y + 1.7,
      style: "fill:#E6C87A;font-family:Fraunces,serif;font-size:3.6px;text-anchor:middle;",
    });
    init.textContent = initials(fellow.name);
    node.append(init);
    const clipId = `hclip-${hashString(fellow.id)}`;
    const clip = el("clipPath", { id: clipId });
    clip.append(el("circle", { cx: x, cy: y, r: 5.2 }));
    node.append(clip);
    node.append(el("image", {
      href: fellow.photoUrl.replace(/^\//, ""),
      x: x - 5.2, y: y - 5.2, width: 10.4, height: 10.4,
      "clip-path": `url(#${clipId})`, preserveAspectRatio: "xMidYMid slice",
    }));
    const title = el("title");
    title.textContent = `${fellow.name} — ${fellow.country}`;
    node.append(title);
    node.style.transformOrigin = `${x}px ${y}px`;
    huddle.append(node);
    requestAnimationFrame(() => node.classList.add("in"));
    return node;
  }

  // ---- particle layer (flag mosaics + arcs) ----
  const particles = [];
  let ctx = null, cw = 0, ch = 0, scale = 1, prng = mulberry32(2026);
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
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].dead) particles.splice(i, 1);
    }
    raf = particles.length ? requestAnimationFrame(paintLoop) : null;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(paintLoop); }

  // one fellow's flight: mosaic grows at the country, dissolves, arcs home.
  // The landing itself is TIMER-driven (counter/huddle/sound must fire even
  // when rAF is throttled); the canvas particles are presentation only.
  function launch(fellow, anchor, onLand, timerBag) {
    const pts = flagMosaic(fellow.country);
    const t0 = performance.now();
    const [ax, ay] = anchor;
    const [gx, gy] = GALWAY;
    // control point above the straight line → parabolic flight
    const mx = (ax + gx) / 2, my = Math.min(ay, gy) - 60 - prng() * 40;
    const flagW = 46, flagH = 30;

    timerBag.push(setTimeout(() => {
      onLand();
      // a soft gold splash where they land
      for (let i = 0; i < 10; i++) {
        const a = prng() * Math.PI * 2, v = 0.4 + prng() * 0.9;
        particles.push(splash(gx, gy, Math.cos(a) * v, Math.sin(a) * v));
      }
      wake();
    }, FLY_MS + HOLD_MS + ARC_MS));

    particles.push({
      dead: false,
      draw(c, now) {
        const t = now - t0;
        if (t < FLY_MS + HOLD_MS) {
          // materialise: tiny + blurred deep in the field → full size
          const k = Math.min(1, t / FLY_MS);
          const e = 1 - Math.pow(1 - k, 3);
          const w = flagW * (0.12 + 0.88 * e);
          const h = flagH * (0.12 + 0.88 * e);
          const alpha = 0.15 + 0.85 * e;
          const blur = (1 - e) * 5;
          c.save();
          if (blur > 0.4) c.filter = `blur(${blur.toFixed(1)}px)`;
          for (const p of pts) {
            c.globalAlpha = alpha * 0.95;
            c.fillStyle = p.color;
            c.beginPath();
            c.arc((ax - w / 2 + p.u * w) * scale, (ay - 14 - h + p.v * h) * scale, 1.5 * e + 0.5, 0, Math.PI * 2);
            c.fill();
          }
          c.restore();
        } else if (t < FLY_MS + HOLD_MS + ARC_MS + 350) {
          // dissolve into stardust streaming along the arc
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const lead = (i % 17) / 17 * 0.3; // the swarm stretches out
            const k = Math.min(1, Math.max(0, (t - FLY_MS - HOLD_MS) / ARC_MS - lead * 0.4 + 0.12));
            if (k <= 0 || k >= 1) continue;
            const u = 1 - k;
            const sx = ax - flagW / 2 + p.u * flagW;
            const sy = ay - 14 - flagH + p.v * flagH;
            const x = u * u * sx + 2 * u * k * mx + k * k * gx;
            const y = u * u * sy + 2 * u * k * my + k * k * gy;
            c.globalAlpha = 0.85 * Math.sin(Math.PI * k);
            c.fillStyle = p.color;
            c.beginPath();
            c.arc(x * scale, y * scale, 1.4 - k * 0.7, 0, Math.PI * 2);
            c.fill();
          }
        } else {
          this.dead = true;
        }
        c.globalAlpha = 1;
      },
    });
    wake();
  }

  function splash(x, y, vx, vy) {
    const t0 = performance.now();
    return {
      dead: false,
      draw(c, now) {
        const t = (now - t0) / 600;
        if (t >= 1) { this.dead = true; return; }
        c.globalAlpha = (1 - t) * 0.8;
        c.fillStyle = "#E6C87A";
        c.beginPath();
        c.arc((x + vx * t * 26) * scale, (y + vy * t * 26) * scale, 1.3 * (1 - t) + 0.3, 0, Math.PI * 2);
        c.fill();
      },
    };
  }

  // ---- the sequence itself ----
  const order = countries.flatMap((c) => c.fellows.map((f) => ({ fellow: f, anchor: c.anchor, country: c.country })));
  const counterEl = hud.querySelector("[data-count]");
  const replayBtn = hud.querySelector(".arrivals-replay");
  let arrived = 0;
  let running = false;
  const timers = [];

  function resetSequence() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    huddle.innerHTML = "";
    particles.length = 0;
    arrived = 0;
    counterEl.textContent = "0";
    caption.classList.remove("shown");
    huddle.classList.remove("complete");
  }

  function showFinalState() {
    resetSequence();
    order.forEach((o, i) => addHead(o.fellow, i));
    arrived = order.length;
    counterEl.textContent = String(arrived);
    caption.classList.add("shown");
    replayBtn.hidden = false;
  }

  function play() {
    if (running) return;
    running = true;
    resetSequence();
    replayBtn.hidden = true;
    order.forEach((o, i) => {
      timers.push(setTimeout(() => {
        const dot = dotEls.get(o.country);
        dot.classList.add("pulsing");
        timers.push(setTimeout(() => dot.classList.remove("pulsing"), FLY_MS + HOLD_MS));
        launch(o.fellow, o.anchor, () => {
          if (arrived >= order.length) return;
          addHead(o.fellow, arrived);
          arrived += 1;
          counterEl.textContent = String(arrived);
          pulseSky();          // the sky warms briefly with each landing
          arrivalNote(i, order.length); // one plucked note, stepping up the scale
          if (arrived === order.length) {
            huddle.classList.add("complete");
            caption.classList.add("shown");
            replayBtn.hidden = false;
            arrivalChord();
            running = false;
          }
        }, timers);
      }, i * TURN_MS));
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
  // belt and braces: IO ties to the rendering lifecycle, so also
  // check plain scroll position — the signature moment must not
  // depend on one API
  const scrollCheck = () => {
    const r = wrap.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.65 && r.bottom > window.innerHeight * 0.25) startIfVisible();
  };
  window.addEventListener("scroll", scrollCheck, { passive: true });

  // ---- explore: tap a dot, the camera flies in ----
  const back = document.createElement("button");
  back.className = "map-back";
  back.hidden = true;
  back.textContent = "← back to the whole sky";
  wrap.append(back);

  function zoomTo(g, anchor) {
    zoomG.style.transformOrigin = `${anchor[0]}px ${anchor[1]}px`;
    zoomG.style.transform =
      `translate(${MAP_W / 2 - anchor[0]}px, ${MAP_H / 2 - anchor[1]}px) scale(6)`;
    svg.classList.add("zoomed");
    g.classList.add("zoom-target");
    back.hidden = false;
    canvas.style.opacity = "0";
  }
  function zoomOut() {
    zoomG.style.transform = "none";
    svg.classList.remove("zoomed");
    svg.querySelectorAll(".zoom-target").forEach((n) => n.classList.remove("zoom-target"));
    back.hidden = true;
    canvas.style.opacity = "1";
  }
  back.addEventListener("click", zoomOut);
  svg.addEventListener("click", (e) => {
    if (svg.classList.contains("zoomed") && !e.target.closest(".fellow-node")) zoomOut();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && svg.classList.contains("zoomed")) zoomOut();
  });

  return svg;
}

// zoomed-in fellows around their country's dot
function buildFellowNodes(fellows, anchor) {
  const wrap = el("g");
  const n = fellows.length;
  fellows.forEach((f, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = n === 1 ? 0 : 30;
    const x = anchor[0] + Math.cos(angle) * r * 1.25;
    const y = anchor[1] + Math.sin(angle) * r * 0.8;

    const node = el("g", { class: "fellow-node", tabindex: "-1" });
    node.append(el("circle", { cx: x, cy: y, r: 7.5, fill: "rgba(5,7,20,0.85)", stroke: "rgba(230,200,122,0.7)", "stroke-width": 0.4 }));
    const init = el("text", {
      x, y: y + 2.2,
      style: "fill:#E6C87A;font-family:Fraunces,serif;font-size:5px;text-anchor:middle;",
    });
    init.textContent = initials(f.name);
    node.append(init);

    const clipId = `clip-${hashString(f.id)}`;
    const clip = el("clipPath", { id: clipId });
    clip.append(el("circle", { cx: x, cy: y, r: 7.5 }));
    node.append(clip);
    node.append(el("image", {
      href: f.photoUrl.replace(/^\//, ""),
      x: x - 7.5, y: y - 7.5, width: 15, height: 15,
      "clip-path": `url(#${clipId})`, preserveAspectRatio: "xMidYMid slice",
    }));

    const nameEl = el("text", { class: "fn-name", x, y: y + 12.5 });
    nameEl.textContent = f.name;
    node.append(nameEl);
    if (f.course) {
      const courseEl = el("text", { class: "fn-course", x, y: y + 15.6 });
      courseEl.textContent = f.course;
      node.append(courseEl);
    }
    node.addEventListener("click", (e) => { e.stopPropagation(); openFellowCard(f); });
    wrap.append(node);
  });
  return wrap;
}
