// The arrival. A percentage counts up while assets load; scattered
// star particles drift inward and assemble into the CONSTELLATION
// wordmark. At 100% the wordmark holds a beat, the stars scatter
// into the sky, and the overlay lifts. Tap/click/key skips.
//
// Timers drive completion; requestAnimationFrame only paints — so
// the sequence still resolves in throttled or non-compositing tabs.
import { PRELOADER_MARK } from "./config.js";

export function runPreloader(tracker, tier) {
  const overlay = document.getElementById("preloader");
  if (!overlay) return Promise.resolve();

  const counter = overlay.querySelector(".pre-count");
  const canvas = overlay.querySelector("canvas");
  const simple = tier === 3 || !canvas;

  return new Promise((resolve) => {
    let displayed = 0;
    let finishing = false;
    let skipped = false;
    let raf = null;
    const t0 = performance.now();
    const MIN_MS = simple ? 700 : 2100;
    const CAP_MS = 6000;

    // ---- particles assembling the wordmark ----
    let particles = [];
    let phase = "gather"; // gather → hold → scatter
    let ctx = null;

    if (!simple) {
      ctx = canvas.getContext("2d");
      const W = (canvas.width = window.innerWidth);
      const H = (canvas.height = window.innerHeight);
      const targets = sampleWordmark(W, H);
      particles = targets.map((tgt, i) => ({
        x: W / 2 + (Math.random() - 0.5) * W * 1.1,
        y: H / 2 + (Math.random() - 0.5) * H * 1.1,
        tx: tgt.x, ty: tgt.y,
        vx: 0, vy: 0,
        delay: (i / targets.length) * 900,
        r: 0.7 + Math.random() * 1.1,
      }));
      const paint = (now) => {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#F5F3EE";
        const el = now - t0;
        for (const p of particles) {
          if (phase === "gather" || phase === "hold") {
            if (el > p.delay) {
              p.x += (p.tx - p.x) * 0.085;
              p.y += (p.ty - p.y) * 0.085;
            }
          } else { // scatter
            p.x += p.vx; p.y += p.vy;
            p.vx *= 1.02; p.vy *= 1.02;
          }
          ctx.globalAlpha = phase === "scatter" ? Math.max(0, 1 - (now - scatterAt) / 650) : 0.92;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(paint);
      };
      raf = requestAnimationFrame(paint);
    }

    let scatterAt = 0;

    // ---- percent counter: real progress, floored by a time curve ----
    const tick = setInterval(() => {
      const elapsed = performance.now() - t0;
      const timeCurve = Math.min(0.99, elapsed / MIN_MS);
      const real = tracker.progress();
      const target = Math.max(real, Math.min(timeCurve, real >= 1 ? 1 : 0.99)) * 100;
      displayed = Math.max(displayed, Math.min(100, Math.round(target)));
      if (counter) counter.textContent = `${displayed}`;
      const done = (real >= 1 && displayed >= 100 && elapsed >= MIN_MS) || elapsed > CAP_MS;
      if (done && !finishing) { finishing = true; finish(); }
    }, 60);

    function finish() {
      clearInterval(tick);
      if (counter) counter.textContent = "100";
      if (skipped || simple) return lift(180);
      phase = "hold";
      setTimeout(() => {
        phase = "scatter";
        scatterAt = performance.now();
        const W = canvas.width, H = canvas.height;
        for (const p of particles) {
          const dx = p.x - W / 2, dy = p.y - H / 2;
          const d = Math.hypot(dx, dy) || 1;
          const v = 6 + Math.random() * 9;
          p.vx = (dx / d) * v + (Math.random() - 0.5) * 2;
          p.vy = (dy / d) * v + (Math.random() - 0.5) * 2;
        }
        lift(700);
      }, 450);
    }

    function lift(delay) {
      setTimeout(() => {
        overlay.classList.add("done");
        setTimeout(() => {
          if (raf) cancelAnimationFrame(raf);
          overlay.remove();
          resolve();
        }, 500);
      }, delay);
    }

    const skip = () => {
      if (finishing) return;
      skipped = true;
      finishing = true;
      clearInterval(tick);
      if (counter) counter.textContent = "100";
      lift(60);
    };
    overlay.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip, { once: true });
  });
}

// draw the wordmark offscreen and sample it into particle targets
function sampleWordmark(W, H) {
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const g = off.getContext("2d");
  const size = Math.min((W * 0.9) / (PRELOADER_MARK.length * 0.62), 110);
  g.font = `400 ${size}px Fraunces, Georgia, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.fillText(PRELOADER_MARK, W / 2, H / 2);

  const data = g.getImageData(0, 0, W, H).data;
  const small = W < 700;
  const step = small ? 5 : 4;
  const targets = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        targets.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2 });
      }
    }
  }
  const cap = small ? 420 : 850;
  while (targets.length > cap) targets.splice(Math.floor(Math.random() * targets.length), 1);
  return targets;
}
