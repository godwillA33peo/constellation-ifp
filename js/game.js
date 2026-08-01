// §4 Star Chart — ten questions themed on Galway and the cohort,
// one comet each. The comet's arc IS the countdown; every correct
// answer sets a star in a faint background constellation that, at
// ten from ten, reveals itself as a Claddagh ring. Streaks brighten
// the whole sky (via skyfield).
import { state, getLeaderboard, submitScore, onLeaderboardChange } from "./store.js";
import { el, handLine, drawIn, mulberry32, hashString, reducedMotion } from "./sky.js";
import { setSkyBoost } from "./skyfield.js";
import { esc } from "./ui.js";

const QUESTIONS = 10;
const SECONDS = 12;
const BASE_POINTS = 100;
const STREAK_BONUS = 25;
const STREAK_CAP = 100;

let root;
let quizData = null;

export function initGame() {
  root = document.getElementById("game-root");
  renderStart();
  onLeaderboardChange(() => {
    const list = root.querySelector("[data-lb]");
    if (list) refreshLeaderboard(list);
  });
}

async function loadQuizData() {
  if (quizData) return quizData;
  try {
    quizData = await (await fetch("data/questions.json")).json();
  } catch {
    quizData = { lore: [], places: [], realfake: [] };
  }
  return quizData;
}

/* ================= question generation ================= */

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// options in, answer index tracked through the shuffle
function mcq(kind, clue, options, answerIdx, { note = "", photo = null } = {}) {
  const paired = options.map((text, i) => ({ text, right: i === answerIdx }));
  const mixed = shuffle(paired);
  return { kind, clue, photo, note, options: mixed.map((o) => o.text), answerIdx: mixed.findIndex((o) => o.right) };
}

function fellowQuestion(fellows) {
  const fellow = fellows[Math.floor(Math.random() * fellows.length)];
  const roll = Math.random();
  const type = roll < 0.55 && fellow.funFact ? "fact" : roll < 0.85 ? "course" : "country";
  let kind, clue, pool;
  if (type === "fact") {
    kind = "Guess the fellow";
    clue = `“${fellow.funFact}”`;
    pool = fellows.filter((f) => f.id !== fellow.id);
  } else if (type === "course") {
    kind = "Guess the fellow";
    clue = `${fellow.course} at ${fellow.university}. Who is it?`;
    pool = fellows.filter((f) => f.id !== fellow.id && f.course !== fellow.course);
  } else {
    kind = "Guess the fellow";
    clue = `Calls ${fellow.country} home.`;
    pool = fellows.filter((f) => f.country !== fellow.country);
  }
  const distractors = [];
  for (const f of shuffle(pool)) {
    if (distractors.length === 3) break;
    if (type === "country" && distractors.some((d) => d.country === f.country)) continue;
    distractors.push(f);
  }
  const names = [fellow.name, ...distractors.map((d) => d.name)];
  const q = mcq(kind, clue, names, 0);
  return q;
}

export function buildRound(fellows, quiz) {
  const qs = [];
  const usedFellowClues = new Set();
  while (qs.length < 3) {
    const q = fellowQuestion(fellows);
    if (usedFellowClues.has(q.clue)) continue;
    usedFellowClues.add(q.clue);
    qs.push(q);
  }
  for (const item of shuffle(quiz.lore).slice(0, 3)) {
    qs.push(mcq("Galway lore", item.q, item.options, item.answer, { note: item.note }));
  }
  for (const item of shuffle(quiz.places).slice(0, 2)) {
    qs.push(mcq("Somewhere in Galway", item.clue, item.options, item.answer, { note: item.note, photo: item.photo }));
  }
  for (const item of shuffle(quiz.realfake).slice(0, 2)) {
    qs.push(mcq("Real or made up?", item.claim, ["Real", "Made up"], item.real ? 0 : 1, { note: item.note }));
  }
  return shuffle(qs).slice(0, QUESTIONS);
}

/* ================= the Claddagh constellation ================= */
// hands first, then the heart, the crown last
const CLAD_PTS = [
  [34, 72], [166, 72],            // hands
  [72, 74], [128, 74], [100, 106], // heart sides + point
  [82, 54], [118, 54],             // heart lobes
  [78, 32], [122, 32], [100, 18],  // crown
];
const CLAD_EDGES = [
  [0, 2], [1, 3],
  [2, 4], [3, 4], [2, 5], [3, 6], [5, 6],
  [5, 7], [6, 8], [7, 9], [8, 9],
];

function claddaghSVG(lit, { reveal = false } = {}) {
  const svg = el("svg", { viewBox: "0 0 200 122", "aria-hidden": "true" });
  const rng = mulberry32(1849);
  const paths = [];
  for (const [a, b] of CLAD_EDGES) {
    if (a < lit && b < lit) {
      const p = handLine(CLAD_PTS[a][0], CLAD_PTS[a][1], CLAD_PTS[b][0], CLAD_PTS[b][1], rng, "clad-line");
      svg.append(p);
      paths.push(p);
    }
  }
  CLAD_PTS.forEach(([x, y], i) => {
    const c = el("circle", { cx: x, cy: y, r: i < lit ? 2.6 : 1.4, class: `clad-star${i < lit ? " lit" : ""}` });
    svg.append(c);
  });
  if (reveal && !reducedMotion()) {
    requestAnimationFrame(() => drawIn(paths, { duration: 900, stagger: 110 }));
  }
  return svg;
}

/* ================= the comet ================= */

class Comet {
  constructor(strip, durationMs) {
    this.duration = durationMs;
    this.state = "flying"; // flying | burst | fizzle | landed
    this.stateAt = 0;
    this.sparks = [];
    this.small = window.innerWidth < 700;

    this.canvas = document.createElement("canvas");
    strip.append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, this.small ? 1.5 : 2);
    this.w = strip.clientWidth;
    this.h = strip.clientHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.start = performance.now();
    this.trail = [];
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  // arc: rises from the left, peaks, lands to the right
  pos(t) {
    const p0 = { x: this.w * 0.03, y: this.h * 0.72 };
    const p1 = { x: this.w * 0.5, y: -this.h * 0.35 };
    const p2 = { x: this.w * 0.97, y: this.h * 0.88 };
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  }

  burst() { this.setState("burst", 38, "gold"); }
  fizzle() { this.setState("fizzle", 14, "smoke"); }
  land() { this.setState("landed", 0); }

  setState(name, sparkCount, flavor) {
    if (this.state !== "flying") return;
    this.state = name;
    this.stateAt = performance.now();
    const t = Math.min(1, (this.stateAt - this.start) / this.duration);
    const { x, y } = this.pos(t);
    for (let i = 0; i < sparkCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = flavor === "gold" ? 0.03 + Math.random() * 0.09 : 0.005 + Math.random() * 0.02;
      this.sparks.push({
        x, y,
        vx: Math.cos(a) * v * this.w,
        vy: flavor === "gold" ? Math.sin(a) * v * this.w : -Math.abs(Math.sin(a)) * v * this.w * 0.7,
        life: 1,
        decay: flavor === "gold" ? 0.02 + Math.random() * 0.02 : 0.008 + Math.random() * 0.008,
        gold: flavor === "gold",
      });
    }
  }

  frame(now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const t = Math.min(1, (now - this.start) / this.duration);

    if (this.state === "flying") {
      const head = this.pos(t);
      this.trail.push(head);
      if (this.trail.length > 16) this.trail.shift();
      // shed a spark now and then
      if (Math.random() < 0.35) {
        this.sparks.push({
          x: head.x, y: head.y,
          vx: (Math.random() - 0.5) * 0.4,
          vy: Math.random() * 0.6,
          life: 0.8, decay: 0.03, gold: true,
        });
      }
      // tail
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const k = i / this.trail.length;
        ctx.globalAlpha = k * 0.55;
        ctx.fillStyle = "#E6C87A";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1 + k * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // head
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 9);
      g.addColorStop(0, "rgba(255,250,235,1)");
      g.addColorStop(0.4, "rgba(230,200,122,0.85)");
      g.addColorStop(1, "rgba(230,200,122,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state === "landed") {
      const p = this.pos(1);
      const age = (now - this.stateAt) / 600;
      ctx.globalAlpha = Math.max(0, 0.7 - age);
      ctx.fillStyle = "#E6C87A";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // sparks
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += s.gold ? 0.05 : -0.01; // gold falls, smoke rises
      s.life -= s.decay;
      if (s.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, s.life) * (s.gold ? 0.9 : 0.4);
      ctx.fillStyle = s.gold ? "#E6C87A" : "#9aa3b8";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.gold ? 1.3 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    ctx.globalAlpha = 1;

    const settled = this.state !== "flying" && now - this.stateAt > 1500 && this.sparks.length === 0;
    if (!settled) this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  destroy() { cancelAnimationFrame(this.raf); this.canvas.remove(); }
}

// reduced-motion countdown: a thin line and a number, no particles
function makeFallbackTimer(container, durationMs) {
  container.innerHTML = `<div class="cf-line"></div><span class="cf-count">${SECONDS}</span>`;
  const line = container.querySelector(".cf-line");
  const count = container.querySelector(".cf-count");
  line.style.transition = `transform ${durationMs}ms linear`;
  line.getBoundingClientRect();
  line.style.transform = "scaleX(0)";
  const iv = setInterval(() => {
    const left = Math.max(0, SECONDS - Math.round((performance.now() - t0) / 1000));
    count.textContent = left;
  }, 500);
  const t0 = performance.now();
  return {
    burst() {}, fizzle() {}, land() {},
    destroy() { clearInterval(iv); container.innerHTML = ""; },
  };
}

/* ================= screens ================= */

function renderStart() {
  setSkyBoost(0);
  root.innerHTML = `
    <div class="game-screen">
      <p>Somewhere in Galway · Guess the fellow · Galway lore · Real or made up.
         Answer before the comet lands — speed and streaks both count, and every
         right answer sets a star in something we're drawing together.</p>
      <button class="btn" data-start>Start the round</button>
      <h3 style="margin-top:2.5rem">Leaderboard</h3>
      <div class="leaderboard" data-lb></div>
    </div>`;
  root.querySelector("[data-start]").addEventListener("click", () => runRound());
  refreshLeaderboard(root.querySelector("[data-lb]"));
}

async function runRound() {
  const quiz = await loadQuizData();
  const questions = buildRound(state.fellows, quiz);
  const round = { score: 0, streak: 0, best: 0, correct: 0, i: 0, questions, comet: null };
  nextQuestion(round);
}

function nextQuestion(round) {
  round.comet?.destroy();
  if (round.i >= round.questions.length) return renderEnd(round);
  const q = round.questions[round.i];

  root.innerHTML = `
    <div class="game-screen">
      <div class="clad-progress" aria-hidden="true"></div>
      <div class="game-hud">
        <span>Comet ${round.i + 1} / ${round.questions.length}</span>
        <span class="hud-streak${round.streak >= 3 ? " hot" : ""}">${round.streak > 1 ? `streak ×${round.streak}` : ""}</span>
        <span class="hud-score">${round.score}</span>
      </div>
      <div class="${reducedMotion() ? "comet-fallback" : "comet-strip"}"></div>
      <p class="clue-text"><span class="clue-kind">${esc(q.kind)}</span>${q.photo ? `<img class="clue-photo" src="${esc(q.photo)}" alt="">` : ""}${esc(q.clue)}</p>
      <div class="option-grid"></div>
      <p class="round-note" aria-live="polite"></p>
    </div>`;

  root.querySelector(".clad-progress").append(claddaghSVG(round.correct));

  const strip = root.querySelector(".comet-strip, .comet-fallback");
  round.comet = reducedMotion()
    ? makeFallbackTimer(strip, SECONDS * 1000)
    : new Comet(strip, SECONDS * 1000);

  const note = root.querySelector(".round-note");
  const grid = root.querySelector(".option-grid");
  const started = performance.now();
  let settled = false;

  const timeout = setTimeout(() => settle(-1), SECONDS * 1000);

  function settle(chosenIdx) {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    const buttons = [...grid.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    const rightBtn = buttons[q.answerIdx];
    const extra = q.note ? ` ${esc(q.note)}` : "";

    if (chosenIdx === q.answerIdx) {
      round.comet.burst();
      const elapsed = (performance.now() - started) / 1000;
      const speed = Math.max(0, Math.round(BASE_POINTS * (1 - elapsed / SECONDS)));
      round.streak += 1;
      round.best = Math.max(round.best, round.streak);
      round.correct += 1;
      setSkyBoost(round.streak);
      const streakBonus = Math.min(STREAK_CAP, Math.max(0, round.streak - 1) * STREAK_BONUS);
      const gain = BASE_POINTS + speed + streakBonus;
      round.score += gain;
      rightBtn.classList.add("correct");
      note.innerHTML = `<span class="gain">+${gain}</span> — ${speed} for speed${streakBonus ? `, ${streakBonus} for the streak` : ""}.${extra}`;
      // the new star takes its place
      const prog = root.querySelector(".clad-progress");
      prog.innerHTML = "";
      prog.append(claddaghSVG(round.correct));
    } else {
      round.streak = 0;
      setSkyBoost(0);
      if (chosenIdx >= 0) {
        round.comet.fizzle();
        buttons[chosenIdx].classList.add("wrong");
        note.innerHTML = `It's ${esc(q.options[q.answerIdx])}.${extra}`;
      } else {
        round.comet.land();
        note.innerHTML = `The comet landed — it was ${esc(q.options[q.answerIdx])}.${extra}`;
      }
      rightBtn.classList.add("correct");
    }
    setTimeout(() => { round.i += 1; nextQuestion(round); }, 1600);
  }

  q.options.forEach((text, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = text;
    btn.addEventListener("click", () => settle(idx));
    grid.append(btn);
  });
}

function renderEnd(round) {
  round.comet?.destroy();
  setSkyBoost(0);
  const perfect = round.correct === QUESTIONS;
  root.innerHTML = `
    <div class="game-screen">
      <h2>${perfect ? "The whole ring, revealed" : "The sky settles"}</h2>
      <div class="clad-final${perfect ? " reveal" : ""}"></div>
      <p class="clad-caption">${
        perfect
          ? "The Claddagh — hands for friendship, heart for love, crown for loyalty. Ten for ten."
          : `${round.correct} of ${QUESTIONS} stars set in the Claddagh.`
      }</p>
      <p class="score-final">${round.score}</p>
      <p>Brightness ${Math.round((round.correct / QUESTIONS) * 100)}% · best streak ×${Math.max(round.best, 1)}.</p>
      <form class="name-form">
        <input type="text" maxlength="40" placeholder="Your name for the leaderboard" required aria-label="Your name">
        <button class="btn" type="submit">Add my star</button>
      </form>
      <p class="round-note" aria-live="polite"></p>
      <button class="btn-ghost btn" data-again>Play again</button>
      <h3 style="margin-top:2.5rem">The brightest stars</h3>
      <div class="lb-sky" data-lb-sky></div>
      <div class="leaderboard" data-lb></div>
    </div>`;

  root.querySelector(".clad-final").append(claddaghSVG(round.correct, { reveal: perfect }));
  refreshLeaderboard(root.querySelector("[data-lb]"));
  refreshLeaderboardSky(root.querySelector("[data-lb-sky]"));

  const form = root.querySelector(".name-form");
  const note = root.querySelector(".round-note");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.querySelector("input").value;
    form.querySelector("button").disabled = true;
    try {
      await submitScore(name, round.score);
      note.textContent = "You're in the sky. See you at the top?";
      refreshLeaderboard(root.querySelector("[data-lb]"));
      refreshLeaderboardSky(root.querySelector("[data-lb-sky]"));
      form.querySelector("input").disabled = true;
    } catch (err) {
      note.textContent = err.message || "That didn't save — try again?";
      form.querySelector("button").disabled = false;
    }
  });
  root.querySelector("[data-again]").addEventListener("click", () => runRound());
}

/* ================= leaderboards ================= */

export async function refreshLeaderboard(container, limit = 10) {
  const entries = await getLeaderboard(limit);
  renderLeaderboard(container, entries);
}

async function refreshLeaderboardSky(container) {
  if (!container) return;
  const entries = await getLeaderboard(8);
  renderLeaderboardSky(container, entries);
}

// the leaderboard as sky: brightest star at the top, the rest
// scattered below, linked rank-to-rank by one faint line
export function renderLeaderboardSky(container, entries) {
  container.innerHTML = "";
  if (!entries.length) {
    container.innerHTML = `<p class="leaderboard-empty">No stars up there yet — be the first.</p>`;
    return;
  }
  const W = container.clientWidth || 500;
  const H = container.clientHeight || 230;
  const rng = mulberry32(1888);
  const spots = entries.map((e, i) => {
    if (i === 0) return { x: W * 0.5, y: H * 0.2 };
    const col = (i - 1) % 4;
    const row = Math.floor((i - 1) / 4);
    return {
      x: W * (0.14 + col * 0.24) + (rng() - 0.5) * W * 0.08,
      y: H * (0.52 + row * 0.32) + (rng() - 0.5) * H * 0.08,
    };
  });

  const svg = el("svg", { "aria-hidden": "true", viewBox: `0 0 ${W} ${H}` });
  const paths = [];
  for (let i = 1; i < spots.length; i++) {
    const p = handLine(spots[i - 1].x, spots[i - 1].y, spots[i].x, spots[i].y, rng, "constellation-line faint");
    svg.append(p);
    paths.push(p);
  }
  container.append(svg);

  const maxScore = entries[0].score || 1;
  entries.forEach((e, i) => {
    const node = document.createElement("span");
    node.className = `lbs-node rank-${i + 1}`;
    node.style.left = `${spots[i].x}px`;
    node.style.top = `${spots[i].y}px`;
    const size = 0.8 + (e.score / maxScore) * (i === 0 ? 1.6 : 0.8);
    node.innerHTML = `
      <span class="lbs-glyph" style="font-size:${size.toFixed(2)}rem">✦</span>
      <span class="lbs-name">${esc(e.playerName)}</span>
      <span class="lbs-score">${e.score}</span>`;
    container.append(node);
  });

  if (!reducedMotion()) drawIn(paths, { duration: 800, stagger: 100 });
}

export function renderLeaderboard(container, entries) {
  if (!entries.length) {
    container.innerHTML = `<p class="leaderboard-empty">No stars on the chart yet — be the first.</p>`;
    return;
  }
  container.innerHTML = `
    <svg class="lb-lines" aria-hidden="true"></svg>
    <ol>${entries
      .map(
        (e) => `
      <li>
        <span class="rank-star" aria-hidden="true">✦</span>
        <span class="lb-name">${esc(e.playerName)}</span>
        <span class="lb-score">${e.score}</span>
      </li>`
      )
      .join("")}</ol>`;

  requestAnimationFrame(() => {
    const svg = container.querySelector(".lb-lines");
    const stars = [...container.querySelectorAll(".rank-star")].slice(0, 5);
    if (stars.length < 2) return;
    const box = container.getBoundingClientRect();
    if (!box.width) return;
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    svg.setAttribute("width", box.width);
    svg.setAttribute("height", box.height);
    const rng = mulberry32(42);
    const pts = stars.map((s) => {
      const r = s.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    });
    const paths = [];
    for (let i = 1; i < pts.length; i++) {
      const p = handLine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], rng, "constellation-line faint");
      svg.append(p);
      paths.push(p);
    }
    if (!reducedMotion()) drawIn(paths, { duration: 700, stagger: 120 });
  });
}
