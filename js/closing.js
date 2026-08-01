// §5.6 Closing — the camera pulls back to a wide view of the
// completed sky: 22 clusters of colour, Galway glowing brightest at
// the centre, above the flat black Galway skyline. No group photo,
// no individual names — just the light we all made, together.
import { allCountries, totalFellows } from "./countries.js";
import { el, handLine, drawIn, mulberry32, hashString, reducedMotion } from "./sky.js";

const VIEW_W = 1000;
const VIEW_H = 560;

export function initClosing() {
  const mount = document.getElementById("closing-constellation");
  if (!mount) return;

  const countries = allCountries();
  const svg = el("svg", { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, "aria-hidden": "true" });

  // Galway at the centre, countries ringed around it, ordered
  // west → east so the chain reads like the journey that built it
  const galway = { x: VIEW_W / 2, y: VIEW_H * 0.42 };
  const sorted = [...countries].sort((a, b) => a.lng - b.lng);
  const n = sorted.length;
  const spots = sorted.map((c, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = Math.min(VIEW_W, VIEW_H) * 0.36;
    return { c, x: galway.x + Math.cos(angle) * r, y: galway.y + Math.sin(angle) * r * 0.62 };
  });

  const paths = [];
  const rng = mulberry32(2601);
  for (let i = 0; i < spots.length; i++) {
    const a = spots[i];
    const b = spots[(i + 1) % spots.length];
    const p = handLine(a.x, a.y, b.x, b.y, rng, "constellation-line faint");
    svg.append(p);
    paths.push(p);
  }
  for (const s of spots) {
    const p = handLine(s.x, s.y, galway.x, galway.y, rng, "constellation-line gold faint");
    svg.append(p);
    paths.push(p);
  }

  const clusterEls = [];
  spots.forEach((s, i) => {
    const [c1, c2] = s.c.palette;
    const glow = el("circle", {
      cx: s.x, cy: s.y, r: 3 + s.c.fellow_count * 1.1,
      class: "closing-cluster",
    });
    glow.style.setProperty("--i", i);
    glow.style.setProperty("--c1", c1);
    glow.style.setProperty("--c2", c2 || c1);
    const title = el("title");
    title.textContent = `${s.c.name} — ${s.c.fellow_count} fellow${s.c.fellow_count > 1 ? "s" : ""}`;
    glow.append(title);
    svg.append(glow);
    clusterEls.push(glow);
  });

  // Galway — brightest, built from every colour that landed there
  const galwayStar = el("circle", { cx: galway.x, cy: galway.y, r: 7, class: "closing-galway" });
  svg.append(galwayStar);
  const galwayLabel = el("text", {
    x: galway.x, y: galway.y + 22, class: "closing-galway-label",
  });
  galwayLabel.textContent = "Galway";
  svg.append(galwayLabel);

  mount.append(svg);

  const caption = document.createElement("p");
  caption.className = "closing-tally";
  caption.textContent = `${totalFellows()} of us. ${countries.length} countries. One sky.`;
  mount.after(caption);

  let played = false;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting) || played) return;
    played = true;
    io.disconnect();
    mount.classList.add("constellation-on");
    if (!reducedMotion()) drawIn(paths, { duration: 1300, stagger: 22 });
  }, { threshold: 0.3 });
  io.observe(mount);
}
