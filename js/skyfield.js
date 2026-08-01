// The sky itself. One fixed full-viewport canvas behind everything:
// scroll-through-nightfall gradient (dusk → midnight), twinkling
// stars, an occasional shooting star, and a Milky Way band that
// emerges near the bottom of the page. All drawing is plain canvas
// fills — no layout work, no DOM churn.
import { reducedMotion, mulberry32 } from "./sky.js";

const rng = mulberry32(53927); // Galway's sky is deterministic

let canvas, ctx, W, H, DPR;
let stars = [];
let boostStars = [];
let milky = null;      // offscreen canvas, pre-rendered band
let shooting = null;   // active shooting star
let nextShotAt = 0;
let boost = 0;         // game streak feeds this (0..10)
let boostShown = 0;    // eased toward boost
let scrollT = 0;       // 0 top of page → 1 bottom
let small = false;
let staticMode = false;
let rafId = null;

// colour stops for the nightfall gradient [top, bottom] per phase
const DUSK_TOP = [34, 24, 74];    // deep indigo/violet
const DUSK_BOT = [24, 16, 52];
const MID_TOP  = [8, 11, 32];     // v1 deep-space navy territory
const MID_BOT  = [6, 8, 24];
const NITE_TOP = [2, 4, 12];      // near-black midnight
const NITE_BOT = [4, 6, 18];

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export function initSkyfield() {
  canvas = document.createElement("canvas");
  canvas.id = "skyfield";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  ctx = canvas.getContext("2d");

  staticMode = reducedMotion();
  resize();
  updateScroll();

  window.addEventListener("resize", () => { resize(); if (staticMode) paint(0); }, { passive: true });
  window.addEventListener("scroll", () => {
    updateScroll();
    if (staticMode) paint(0);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  if (staticMode) paint(0);
  else start();
}

// The game brightens the sky as a streak grows.
export function setSkyBoost(n) {
  boost = Math.min(10, Math.max(0, n));
  if (staticMode) paint(0);
}

// event pulse — a brief warm brightening (kept subtle in 2D)
let flash2d = 0;
export function pulseSky() {
  flash2d = 1;
  if (!staticMode) return;
  paint(0);
  setTimeout(() => { flash2d = 0; paint(0); }, 450);
}

function resize() {
  small = window.innerWidth < 700;
  DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  seedStars();
  buildMilkyWay();
}

function updateScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollT = max > 0 ? clamp01(window.scrollY / max) : 0;
}

function seedStars() {
  const base = small ? 70 : 150;
  stars = [];
  for (let i = 0; i < base; i++) {
    stars.push({
      x: rng() * W, y: rng() * H,
      r: 0.4 + rng() * 1.2,
      phase: rng() * Math.PI * 2,
      speed: 0.4 + rng() * 1.1,
      a: 0.35 + rng() * 0.5,
    });
  }
  boostStars = [];
  const extra = small ? 24 : 44;
  for (let i = 0; i < extra; i++) {
    boostStars.push({
      x: rng() * W, y: rng() * H,
      r: 0.4 + rng() * 1.0,
      phase: rng() * Math.PI * 2,
      speed: 0.5 + rng() * 1.2,
      at: (i % 10) + 1, // appears once the streak reaches this level
    });
  }
}

// A soft diagonal wash of faint stars, rendered once to an offscreen
// canvas so the per-frame cost is a single drawImage.
function buildMilkyWay() {
  milky = document.createElement("canvas");
  milky.width = Math.round(W * DPR);
  milky.height = Math.round(H * DPR);
  const m = milky.getContext("2d");
  m.setTransform(DPR, 0, 0, DPR, 0, 0);
  const mrng = mulberry32(91);
  // band axis: lower-left → upper-right
  const ax = -W * 0.1, ay = H * 1.05, bx = W * 1.1, by = -H * 0.1;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const bandW = Math.min(W, H) * 0.34;
  // gradient wash
  const grad = m.createLinearGradient(ax + nx * bandW, ay + ny * bandW, ax - nx * bandW, ay - ny * bandW);
  grad.addColorStop(0, "rgba(140,160,220,0)");
  grad.addColorStop(0.5, "rgba(150,170,230,0.055)");
  grad.addColorStop(1, "rgba(140,160,220,0)");
  m.fillStyle = grad;
  m.fillRect(0, 0, W, H);
  // dust stars, gaussian-ish around the axis
  const count = small ? 160 : 340;
  for (let i = 0; i < count; i++) {
    const t = mrng();
    const off = (mrng() + mrng() + mrng() - 1.5) / 1.5 * bandW * 0.8;
    const x = ax + dx * t + nx * off;
    const y = ay + dy * t + ny * off;
    m.globalAlpha = 0.12 + mrng() * 0.3;
    m.fillStyle = "#F5F3EE";
    m.beginPath();
    m.arc(x, y, 0.3 + mrng() * 0.8, 0, Math.PI * 2);
    m.fill();
  }
  m.globalAlpha = 1;
}

function start() {
  if (staticMode || rafId) return;
  nextShotAt = performance.now() + 4000 + rng() * 8000;
  const loop = (now) => { paint(now); rafId = requestAnimationFrame(loop); };
  rafId = requestAnimationFrame(loop);
}
function stop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function paint(now) {
  const t = scrollT;
  // two-phase interpolation: dusk → deep navy → midnight
  const topC = t < 0.5 ? lerp3(DUSK_TOP, MID_TOP, t * 2) : lerp3(MID_TOP, NITE_TOP, (t - 0.5) * 2);
  const botC = t < 0.5 ? lerp3(DUSK_BOT, MID_BOT, t * 2) : lerp3(MID_BOT, NITE_BOT, (t - 0.5) * 2);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(topC));
  g.addColorStop(1, css(botC));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // amber dusk glow at the horizon, gone by mid-scroll
  const amber = (1 - clamp01(t * 2.2)) * 0.16;
  if (amber > 0.004) {
    const ag = ctx.createRadialGradient(W * 0.5, H * 1.12, H * 0.05, W * 0.5, H * 1.12, H * 0.75);
    ag.addColorStop(0, `rgba(232,166,92,${amber})`);
    ag.addColorStop(1, "rgba(232,166,92,0)");
    ctx.fillStyle = ag;
    ctx.fillRect(0, 0, W, H);
  }

  // Milky Way emerges over the second half of the scroll
  const milkA = clamp01((t - 0.45) / 0.4);
  if (milkA > 0.01) {
    ctx.globalAlpha = milkA;
    ctx.drawImage(milky, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // streak boost eases in and out; event flashes decay
  boostShown += (boost - boostShown) * 0.06;
  flash2d *= 0.93;
  const lift = 1 + boostShown * 0.05 + flash2d * 0.2;

  ctx.fillStyle = "#F5F3EE";
  const time = now / 1000;
  for (const s of stars) {
    const tw = staticMode ? 0.8 : 0.62 + 0.38 * Math.sin(time * s.speed + s.phase);
    ctx.globalAlpha = Math.min(1, s.a * tw * lift);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of boostStars) {
    if (boostShown + 0.35 < s.at) continue;
    const reveal = clamp01(boostShown + 0.35 - s.at);
    const tw = staticMode ? 0.8 : 0.55 + 0.45 * Math.sin(time * s.speed + s.phase);
    ctx.globalAlpha = 0.65 * tw * reveal;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (!staticMode) paintShootingStar(now);
}

function paintShootingStar(now) {
  if (!shooting && now >= nextShotAt) {
    const angle = (25 + rng() * 40) * (Math.PI / 180) * (rng() > 0.5 ? 1 : -1);
    const fromLeft = Math.cos(angle) > 0;
    shooting = {
      x: fromLeft ? -40 : W + 40,
      y: H * (0.05 + rng() * 0.4),
      vx: Math.cos(angle) * (0.55 + rng() * 0.35) * W * (fromLeft ? 1 : -1) / 1000,
      vy: Math.abs(Math.sin(angle)) * H * 0.35 / 1000,
      born: now,
      life: 1400,
    };
    nextShotAt = now + 15000 + rng() * 5000;
  }
  if (!shooting) return;
  const age = now - shooting.born;
  if (age > shooting.life || shooting.x < -80 || shooting.x > W + 80 || shooting.y > H + 40) {
    shooting = null;
    return;
  }
  const dt = 16.7;
  shooting.x += shooting.vx * dt;
  shooting.y += shooting.vy * dt;
  const fade = 1 - age / shooting.life;
  const tailX = shooting.x - shooting.vx * 220;
  const tailY = shooting.y - shooting.vy * 220;
  const grad = ctx.createLinearGradient(shooting.x, shooting.y, tailX, tailY);
  grad.addColorStop(0, `rgba(245,243,238,${0.9 * fade})`);
  grad.addColorStop(1, "rgba(245,243,238,0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(shooting.x, shooting.y);
  ctx.lineTo(tailX, tailY);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,252,244,${fade})`;
  ctx.beginPath();
  ctx.arc(shooting.x, shooting.y, 1.6, 0, Math.PI * 2);
  ctx.fill();
}
