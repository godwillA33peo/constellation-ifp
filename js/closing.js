// §3.6 Closing — the camera pulls back and the whole cohort appears
// as one completed constellation above the Galway skyline: every
// fellow a star, country clusters linked internally, cluster anchors
// chained west → east into a single figure.
import { state } from "./store.js";
import { el, handLine, constellationLinks, drawIn, mulberry32, hashString, reducedMotion } from "./sky.js";
import { layoutSky, SKY_W, SKY_H } from "./gallery.js";

const VIEW_W = 1000;
const VIEW_H = 560;

export function initClosing() {
  const mount = document.getElementById("closing-constellation");
  if (!mount) return;

  const svg = el("svg", { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, "aria-hidden": "true" });
  const sx = VIEW_W / SKY_W;
  const sy = VIEW_H / SKY_H;

  const clusters = layoutSky(state.fellows)
    .map((c) => ({
      ...c,
      cx: c.cx * sx, cy: c.cy * sy,
      stars: c.stars.map((s) => ({ ...s, x: s.x * sx, y: s.y * sy })),
    }))
    .sort((a, b) => a.cx - b.cx); // chain west → east

  const paths = [];
  const starEls = [];

  // one line threading every country anchor together
  for (let i = 1; i < clusters.length; i++) {
    const p = handLine(
      clusters[i - 1].cx, clusters[i - 1].cy,
      clusters[i].cx, clusters[i].cy,
      mulberry32(i * 631), "constellation-line gold faint"
    );
    svg.append(p);
    paths.push(p);
  }

  for (const c of clusters) {
    const rng = mulberry32(hashString(c.country));
    const pts = c.stars.map((s) => [s.x, s.y]);
    for (const [a, b] of constellationLinks(pts)) {
      const p = handLine(a[0], a[1], b[0], b[1], rng, "constellation-line faint");
      svg.append(p);
      paths.push(p);
    }
    c.stars.forEach((s, i) => {
      const star = el("circle", {
        cx: s.x, cy: s.y, r: 2.1 + rng() * 1.1,
        class: "closing-star",
      });
      star.style.setProperty("--i", starEls.length);
      const title = el("title");
      title.textContent = `${s.fellow.name} — ${s.fellow.country}`;
      star.append(title);
      svg.append(star);
      starEls.push(star);
    });
  }

  mount.append(svg);

  let played = false;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting) || played) return;
    played = true;
    io.disconnect();
    mount.classList.add("constellation-on");
    if (!reducedMotion()) drawIn(paths, { duration: 1200, stagger: 26 });
  }, { threshold: 0.3 });
  io.observe(mount);
}
