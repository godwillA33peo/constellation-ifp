// §2.2 Sky Gallery — every fellow's photo inside a star-point on one
// big pannable sky, grouped loosely by country and tied back to it
// with the same thin lines as Arrivals.
import { state } from "./store.js";
import { el, handLine, drawIn, mulberry32, hashString, photoOrInitials, reducedMotion } from "./sky.js";
import { groupByCountry } from "./arrivals.js";
import { openFellowCard } from "./ui.js";

export const SKY_W = 1900;
export const SKY_H = 1240;

// Lay countries out across the big sky canvas on a jittered grid,
// then scatter each country's fellows around its anchor.
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
      return {
        fellow: f,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.8,
      };
    });
    return { country, cx, cy, stars, rng };
  });
}

export function initGallery() {
  const sky = document.getElementById("gallery-sky");
  const canvas = document.createElement("div");
  canvas.className = "gallery-canvas";
  canvas.style.width = `${SKY_W}px`;
  canvas.style.height = `${SKY_H}px`;

  const svg = el("svg", {
    viewBox: `0 0 ${SKY_W} ${SKY_H}`,
    width: SKY_W,
    height: SKY_H,
    "aria-hidden": "true",
  });
  canvas.append(svg);

  // ambient background stars
  const bgRng = mulberry32(20260801);
  for (let i = 0; i < 130; i++) {
    const dot = el("circle", {
      cx: (bgRng() * SKY_W).toFixed(0),
      cy: (bgRng() * SKY_H).toFixed(0),
      r: (0.6 + bgRng() * 1.1).toFixed(1),
      fill: "rgba(245,243,238,0.35)",
    });
    if (!reducedMotion() && bgRng() > 0.5) {
      dot.classList.add("twinkle");
      dot.style.setProperty("--tw-dur", `${4 + bgRng() * 5}s`);
      dot.style.setProperty("--tw-delay", `${-bgRng() * 6}s`);
      dot.style.setProperty("--tw-min", "0.15");
    }
    svg.append(dot);
  }

  const layout = layoutSky(state.fellows);
  const allPaths = [];

  for (const cluster of layout) {
    // lines from each photo-star back to the country anchor
    for (const s of cluster.stars) {
      if (s.x === cluster.cx && s.y === cluster.cy) continue;
      const path = handLine(cluster.cx, cluster.cy, s.x, s.y, cluster.rng, "constellation-line faint");
      svg.append(path);
      allPaths.push(path);
    }
    const anchorDot = el("circle", {
      cx: cluster.cx, cy: cluster.cy, r: 2.2, class: "star-core gold",
    });
    svg.append(anchorDot);

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
      btn.append(photoOrInitials(s.fellow));
      const nameTag = document.createElement("span");
      nameTag.className = "photo-name";
      nameTag.textContent = s.fellow.name.split(" ")[0];
      btn.append(nameTag);
      btn.addEventListener("click", () => openFellowCard(s.fellow));
      canvas.append(btn);
    }
  }

  sky.append(canvas);

  // draw lines in the first time the gallery is visible
  let drawn = false;
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !drawn) {
      drawn = true;
      drawIn(allPaths, { duration: 900, stagger: 35 });
      io.disconnect();
    }
  }, { threshold: 0.1 });
  io.observe(sky);

  // start roughly centred
  requestAnimationFrame(() => {
    sky.scrollLeft = (SKY_W - sky.clientWidth) / 2;
    sky.scrollTop = (SKY_H - sky.clientHeight) / 3;
  });

  enableDragPan(sky);
}

// drag-to-pan for mouse users; touch devices scroll natively
function enableDragPan(sky) {
  let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
  sky.addEventListener("mousedown", (e) => {
    if (e.target.closest(".photo-star")) return;
    dragging = true;
    sky.classList.add("dragging");
    sx = e.clientX; sy = e.clientY; sl = sky.scrollLeft; st = sky.scrollTop;
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    sky.scrollLeft = sl - (e.clientX - sx);
    sky.scrollTop = st - (e.clientY - sy);
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    sky.classList.remove("dragging");
  });
}
