// §3.6 Closing — the camera pulls back and the whole cohort appears
// as one completed constellation above the Galway skyline: every
// fellow a star, country clusters linked internally, cluster anchors
// chained west → east into a single figure.
import { state } from "./store.js";
import { el, handLine, constellationLinks, drawIn, mulberry32, hashString, reducedMotion } from "./sky.js";
import { layoutSky, SKY_W, SKY_H } from "./gallery.js";
import { openFellowCard } from "./ui.js";

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
    c.stars.forEach((s) => {
      // a comfortable tap target around each small star
      const hit = el("g", { class: "closing-star-hit", tabindex: "0", role: "button" });
      hit.setAttribute("aria-label", `${s.fellow.name} — ${s.fellow.course}, from ${s.fellow.country}`);
      const star = el("circle", {
        cx: s.x, cy: s.y, r: 2.1 + rng() * 1.1,
        class: "closing-star",
      });
      star.style.setProperty("--i", starEls.length);
      hit.append(
        el("circle", { cx: s.x, cy: s.y, r: 11, fill: "transparent" }),
        star
      );
      const title = el("title");
      title.textContent = `${s.fellow.name} — ${s.fellow.country}`;
      hit.append(title);
      hit.addEventListener("click", () => openFellowCard(s.fellow));
      hit.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFellowCard(s.fellow); }
      });
      svg.append(hit);
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
    if (!reducedMotion()) {
      drawIn(paths, { duration: 1200, stagger: 26 });
      setTimeout(() => beginPhotoReveal(mount), 2600);
    } else {
      beginPhotoReveal(mount, true);
    }
  }, { threshold: 0.3 });
  io.observe(mount);
}

/* ------------------------------------------------------------
   The payoff: the stars turn out to be people. The constellation
   drifts, multiplies into thousands of particles, and assembles
   into the group photo — pixels as points of light converging
   until the image resolves. Stars first, faces last.
   ------------------------------------------------------------ */

const GROUP_PHOTO = "assets/group-photo.jpg";

function beginPhotoReveal(mount, instant = false) {
  const holder = document.createElement("div");
  holder.className = "photo-reveal";
  const img = document.createElement("img");
  img.className = "reveal-photo";
  img.alt = "Our whole cohort, together";
  img.src = GROUP_PHOTO;
  const canvas = document.createElement("canvas");
  canvas.className = "reveal-canvas";
  canvas.setAttribute("aria-hidden", "true");
  holder.append(img, canvas);
  mount.after(holder);

  if (instant) {
    holder.classList.add("resolved");
    return;
  }

  img.decode?.().catch(() => {}).finally(() => {
    img.addEventListener("error", () => holder.classList.add("resolved"), { once: true });
    if (!img.naturalWidth) {
      // photo missing → just fade the frame in gracefully
      holder.classList.add("resolved");
      return;
    }
    runParticleAssembly(holder, img, canvas);
  });
}

function runParticleAssembly(holder, img, canvas) {
  const small = window.innerWidth < 700;
  const rect = holder.getBoundingClientRect();
  const W = (canvas.width = Math.max(1, Math.round(rect.width)));
  const H = (canvas.height = Math.max(1, Math.round(rect.height)));
  const ctx = canvas.getContext("2d");

  // sample the photo into a coarse grid of coloured points
  const cols = small ? 72 : 116;
  const rows = Math.round(cols * (H / W));
  const off = document.createElement("canvas");
  off.width = cols; off.height = rows;
  const og = off.getContext("2d");
  og.drawImage(img, 0, 0, cols, rows);
  const data = og.getImageData(0, 0, cols, rows).data;

  const rng = mulberry32(1926);
  const parts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 765;
      if (lum < 0.06 && rng() < 0.55) continue; // skip some near-black pixels
      parts.push({
        tx: ((c + 0.5) / cols) * W,
        ty: ((r + 0.5) / rows) * H,
        x: W / 2 + (rng() - 0.5) * W * 1.7,
        y: H / 2 + (rng() - 0.5) * H * 1.7,
        col: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
        delay: rng() * 900,
      });
    }
  }

  const t0 = performance.now();
  const DURATION = 2600;
  function frame(now) {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    let done = true;
    for (const p of parts) {
      const k = Math.min(1, Math.max(0, (t - p.delay) / DURATION));
      if (k < 1) done = false;
      const e = 1 - Math.pow(1 - k, 3);
      const x = p.x + (p.tx - p.x) * e;
      const y = p.y + (p.ty - p.y) * e;
      ctx.globalAlpha = 0.25 + 0.75 * e;
      ctx.fillStyle = p.col;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    if (!done) {
      requestAnimationFrame(frame);
    } else {
      holder.classList.add("resolved"); // the real photo fades up, particles fade out
      setTimeout(() => canvas.remove(), 1400);
    }
  }
  requestAnimationFrame(frame);
}
