// Shared night-sky vocabulary: stars, hand-drawn constellation lines,
// the draw-in animation, twinkle, seeded randomness, initials fallback.

export const SVG_NS = "http://www.w3.org/2000/svg";

export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Deterministic RNG so every visitor sees the same sky.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// A star: bright core + soft halo, with idle twinkle.
export function makeStar(x, y, r, { gold = false, twinkle = true, rng = Math.random } = {}) {
  const g = el("g", { class: "star" });
  const halo = el("circle", {
    cx: x, cy: y, r: r * 3,
    fill: gold ? "rgba(242,200,121,0.16)" : "rgba(245,243,238,0.10)",
  });
  const core = el("circle", { cx: x, cy: y, r, class: `star-core${gold ? " gold" : ""}` });
  if (twinkle && !reducedMotion()) {
    core.classList.add("twinkle");
    core.style.setProperty("--tw-dur", `${3 + rng() * 4}s`);
    core.style.setProperty("--tw-delay", `${-rng() * 5}s`);
    core.style.setProperty("--tw-min", (0.35 + rng() * 0.25).toFixed(2));
  }
  g.append(halo, core);
  return g;
}

// The signature element: a thin line with a slight hand-drawn bend.
export function handLine(x1, y1, x2, y2, rng = Math.random, cls = "constellation-line") {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bend = (rng() - 0.5) * Math.min(10, len * 0.18);
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return el("path", {
    d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    class: cls,
  });
}

// Connect points into an organic little constellation:
// each point links to its nearest already-placed point.
export function constellationLinks(points) {
  const links = [];
  for (let i = 1; i < points.length; i++) {
    let best = 0, bestD = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
      if (d < bestD) { bestD = d; best = j; }
    }
    links.push([points[i], points[best]]);
  }
  return links;
}

// The one orchestrated motion moment: paths draw themselves in.
export function drawIn(paths, { duration = 900, stagger = 90, delay = 0 } = {}) {
  if (reducedMotion()) return;
  paths.forEach((p, i) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    p.getBoundingClientRect(); // flush so the transition runs
    p.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.25,0.1,0.25,1) ${delay + i * stagger}ms`;
    p.style.strokeDashoffset = "0";
  });
}

export function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// Photo with graceful fallback to an initials star while real
// photos are still placeholders.
export function photoOrInitials(fellow, className = "") {
  const img = document.createElement("img");
  img.className = className;
  img.alt = fellow.name;
  img.loading = "lazy";
  img.src = fellow.photoUrl.replace(/^\//, ""); // keep relative for GitHub Pages subpaths
  img.addEventListener("error", () => {
    const div = document.createElement("div");
    div.className = `initials ${className}`.trim();
    div.textContent = initials(fellow.name);
    img.replaceWith(div);
  });
  return img;
}
