// §2.3 Star Chart — one mechanic: every clue is a fact, every answer
// is a fellow. Falling-star timer, streak + speed bonuses, one shared
// leaderboard.
import { state, getLeaderboard, submitScore, onLeaderboardChange } from "./store.js";
import { el, handLine, drawIn, mulberry32, reducedMotion } from "./sky.js";
import { esc } from "./ui.js";

const QUESTIONS = 10;
const SECONDS = 12;
const BASE_POINTS = 100;
const STREAK_BONUS = 25;   // per consecutive correct answer beyond the first
const STREAK_CAP = 100;

let root;

export function initGame() {
  root = document.getElementById("game-root");
  renderStart();
  onLeaderboardChange(() => {
    const list = root.querySelector("[data-lb]");
    if (list) refreshLeaderboard(list);
  });
}

/* ---------- question generation ---------- */

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuestions(fellows, n = QUESTIONS) {
  const answers = shuffle(fellows).slice(0, Math.min(n, fellows.length));
  return answers.map((fellow) => {
    const roll = Math.random();
    const type = roll < 0.5 && fellow.funFact ? "fact" : roll < 0.8 ? "course" : "country";

    let clue, kind, pool;
    if (type === "fact") {
      kind = "Whose story is this?";
      clue = `“${fellow.funFact}”`;
      pool = fellows.filter((f) => f.id !== fellow.id);
    } else if (type === "course") {
      kind = "Who's on this course?";
      clue = `${fellow.course} at ${fellow.university}.`;
      pool = fellows.filter((f) => f.id !== fellow.id && f.course !== fellow.course);
    } else {
      kind = "Whose light started here?";
      clue = `Calls ${fellow.country} home.`;
      pool = fellows.filter((f) => f.country !== fellow.country);
    }

    const distractors = [];
    const seen = new Set([fellow.id]);
    for (const f of shuffle(pool)) {
      if (distractors.length === 3) break;
      if (seen.has(f.id)) continue;
      // country clues: keep distractor countries distinct so exactly
      // one option is right
      if (type === "country" && distractors.some((d) => d.country === f.country)) continue;
      distractors.push(f);
      seen.add(f.id);
    }
    return { fellow, kind, clue, options: shuffle([fellow, ...distractors]) };
  });
}

/* ---------- screens ---------- */

function renderStart() {
  root.innerHTML = `
    <div class="game-card">
      <h2>Ten falling stars</h2>
      <p>Each clue is one of us — a course, a country, or a story you've
         definitely heard in the kitchen. Name the fellow before the star
         lands. Fast answers and streaks score extra.</p>
      <button class="btn" data-start>Start the round</button>
      <h3 style="margin-top:2rem">Leaderboard</h3>
      <div class="leaderboard" data-lb></div>
    </div>`;
  root.querySelector("[data-start]").addEventListener("click", () => runRound());
  refreshLeaderboard(root.querySelector("[data-lb]"));
}

function runRound() {
  const questions = buildQuestions(state.fellows);
  const round = { score: 0, streak: 0, best: 0, correct: 0, i: 0, questions };
  nextQuestion(round);
}

function nextQuestion(round) {
  if (round.i >= round.questions.length) return renderEnd(round);
  const q = round.questions[round.i];

  root.innerHTML = `
    <div class="game-card">
      <div class="game-hud">
        <span>Star ${round.i + 1} / ${round.questions.length}</span>
        <span class="hud-streak${round.streak >= 3 ? " hot" : ""}">${round.streak > 1 ? `streak ×${round.streak}` : ""}</span>
        <span class="hud-score">${round.score}</span>
      </div>
      <div class="fall-track"><span class="fall-star" aria-hidden="true">✦</span></div>
      <p class="clue-text"><span class="clue-kind">${esc(q.kind)}</span>${esc(q.clue)}</p>
      <div class="option-grid"></div>
      <p class="round-note" aria-live="polite"></p>
    </div>`;

  const star = root.querySelector(".fall-star");
  star.style.setProperty("--fall-x", `${15 + Math.random() * 70}%`);
  star.style.setProperty("--fall-dur", `${SECONDS}s`);
  star.classList.add("falling");

  const note = root.querySelector(".round-note");
  const grid = root.querySelector(".option-grid");
  const started = performance.now();
  let settled = false;

  const timeout = setTimeout(() => settle(null), SECONDS * 1000);

  function settle(chosenBtn, chosenFellow) {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    star.style.animationPlayState = "paused";
    const buttons = [...grid.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    const rightBtn = buttons.find((b) => b.dataset.id === q.fellow.id);

    if (chosenFellow && chosenFellow.id === q.fellow.id) {
      const elapsed = (performance.now() - started) / 1000;
      const speed = Math.max(0, Math.round(BASE_POINTS * (1 - elapsed / SECONDS)));
      round.streak += 1;
      round.best = Math.max(round.best, round.streak);
      round.correct += 1;
      const streakBonus = Math.min(STREAK_CAP, Math.max(0, round.streak - 1) * STREAK_BONUS);
      const gain = BASE_POINTS + speed + streakBonus;
      round.score += gain;
      rightBtn.classList.add("correct");
      note.innerHTML = `<span class="gain">+${gain}</span> — ${speed} for speed${streakBonus ? `, ${streakBonus} for the streak` : ""}.`;
    } else {
      round.streak = 0;
      if (chosenBtn) chosenBtn.classList.add("wrong");
      rightBtn.classList.add("correct");
      note.textContent = chosenBtn
        ? `That's ${q.fellow.name}.`
        : `The star landed — that was ${q.fellow.name}.`;
    }
    setTimeout(() => { round.i += 1; nextQuestion(round); }, 1400);
  }

  for (const f of q.options) {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.dataset.id = f.id;
    btn.textContent = f.name;
    btn.addEventListener("click", () => settle(btn, f));
    grid.append(btn);
  }
}

function renderEnd(round) {
  root.innerHTML = `
    <div class="game-card">
      <h2>The sky settles</h2>
      <p class="score-final">${round.score}</p>
      <p>${round.correct} of ${round.questions.length} named, best streak ×${Math.max(round.best, 1)}.</p>
      <form class="name-form">
        <input type="text" maxlength="40" placeholder="Your name for the leaderboard" required aria-label="Your name">
        <button class="btn" type="submit">Add my star</button>
      </form>
      <p class="round-note" aria-live="polite"></p>
      <button class="btn-ghost btn" data-again>Play again</button>
    </div>`;

  const form = root.querySelector(".name-form");
  const note = root.querySelector(".round-note");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.querySelector("input").value;
    form.querySelector("button").disabled = true;
    try {
      await submitScore(name, round.score);
      note.textContent = "You're on the chart. See you at the top?";
      // back to the start screen — unless they've already hit Play again
      setTimeout(() => { if (root.contains(form)) renderStart(); }, 1600);
    } catch (err) {
      note.textContent = err.message || "That didn't save — try again?";
      form.querySelector("button").disabled = false;
    }
  });
  root.querySelector("[data-again]").addEventListener("click", () => runRound());
}

/* ---------- leaderboard rendering (shared with display mode) ---------- */

export async function refreshLeaderboard(container, limit = 10) {
  const entries = await getLeaderboard(limit);
  renderLeaderboard(container, entries);
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
        (e, i) => `
      <li>
        <span class="rank-star" aria-hidden="true">✦</span>
        <span class="lb-name">${esc(e.playerName)}</span>
        <span class="lb-score">${e.score}</span>
      </li>`
      )
      .join("")}</ol>`;

  // top scorers linked by a faint line — same signature as the map
  requestAnimationFrame(() => {
    const svg = container.querySelector(".lb-lines");
    const stars = [...container.querySelectorAll(".rank-star")].slice(0, 5);
    if (stars.length < 2) return;
    const box = container.getBoundingClientRect();
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
