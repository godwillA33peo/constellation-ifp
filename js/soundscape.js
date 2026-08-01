// §7 Reactive sound — entirely synthesised, muted by default behind a
// visible star-shaped toggle. Nothing autoplays unmuted; the
// AudioContext is only created on the user's unmute gesture.
//
// The signature moment: each Arrivals landing plays one soft plucked
// note stepping up a pentatonic scale across the 35 arrivals,
// resolving into a gentle chord when the huddle completes.
// All effects are quiet and rounded — celestial, never arcade-y —
// and the ambient pad ducks beneath them. The pad's filter opens
// with scroll depth: warm at dusk, airy at midnight.
let ctx = null;
let muted = true;
let pad = null;
let button = null;
let master = null;

export function initSound() {
  button = document.createElement("button");
  button.className = "sound-toggle";
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", "Sound: off. Toggle ambient sound.");
  button.textContent = "✦";
  document.querySelector(".site-header")?.append(button);
  button.addEventListener("click", toggle);

  window.addEventListener("scroll", () => {
    if (!pad || !ctx) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    pad.filter.frequency.setTargetAtTime(300 + p * 800, ctx.currentTime, 0.4);
  }, { passive: true });
}

function toggle() {
  muted = !muted;
  button.setAttribute("aria-pressed", String(!muted));
  button.setAttribute("aria-label", muted ? "Sound: off. Toggle ambient sound." : "Sound: on. Toggle ambient sound.");
  button.classList.toggle("on", !muted);
  if (!muted) { ensureCtx(); startPad(); }
  else stopPad();
}

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}

// briefly lower the pad so effects sit on top
function duck(amount = 0.45, seconds = 0.9) {
  if (!pad || !ctx) return;
  const g = pad.gain.gain;
  g.cancelScheduledValues(ctx.currentTime);
  g.setTargetAtTime(0.028 * amount, ctx.currentTime, 0.05);
  g.setTargetAtTime(0.028, ctx.currentTime + seconds, 0.4);
}

/* ---------- ambient pad ---------- */

function startPad() {
  if (pad || !ctx) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 3);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 340;
  filter.Q.value = 0.6;

  const oscs = [
    { type: "triangle", freq: 110 },
    { type: "triangle", freq: 110.6 },
    { type: "sine", freq: 220.4 },
  ].map((cfg) => {
    const o = ctx.createOscillator();
    o.type = cfg.type;
    o.frequency.value = cfg.freq;
    o.connect(filter);
    o.start();
    return o;
  });

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  filter.connect(gain).connect(master);
  pad = { oscs, lfo, gain, filter };
}

function stopPad() {
  if (!pad || !ctx) return;
  const { oscs, lfo, gain } = pad;
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); }, 900);
  pad = null;
}

/* ---------- one-shot voices ---------- */

function bell(partials, baseGain, decay) {
  if (muted || !ctx) return;
  duck();
  const now = ctx.currentTime;
  partials.forEach(([freq, rel], i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(baseGain * rel, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay + i * 0.1);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + decay + 0.3);
  });
}

// a soft pluck: triangle through a closing lowpass
function pluck(freq, gain = 0.05, decay = 1.1) {
  if (muted || !ctx) return;
  duck(0.55, 0.6);
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(freq * 5, now);
  f.frequency.exponentialRampToValueAtTime(freq * 1.2, now + decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
  o.connect(f).connect(g).connect(master);
  o.start(now);
  o.stop(now + decay + 0.2);
}

/* ---------- the public voices ---------- */

// A-minor pentatonic, low A upward — one step per arrival
const PENT = [0, 3, 5, 7, 10];
export function arrivalNote(index, total = 35) {
  const span = 24; // two octaves across the whole sequence
  const semis = PENT[index % 5] + 12 * Math.floor((index / total) * (span / 12));
  pluck(220 * Math.pow(2, semis / 12), 0.045, 1.25);
}

// the huddle completes: a gentle resolving chord
export function arrivalChord() {
  if (muted || !ctx) return;
  bell([[220, 0.9], [330, 0.7], [440, 0.55], [660, 0.3]], 0.045, 2.6);
}

// game: rising shimmer on correct
export function chime() {
  bell([[880, 1], [1318.5, 0.55], [1760, 0.3]], 0.05, 1.2);
}

// game: muted fizzle on wrong — a short hush of filtered noise
export function fizzleSound() {
  if (muted || !ctx) return;
  duck(0.6, 0.5);
  const now = ctx.currentTime;
  const len = ctx.sampleRate * 0.4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(900, now);
  f.frequency.exponentialRampToValueAtTime(220, now + 0.4);
  f.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = 0.03;
  src.connect(f).connect(g).connect(master);
  src.start(now);
}

// Claddagh reveal: warm chime
export function claddaghChime() {
  bell([[440, 1], [554.4, 0.7], [659.3, 0.6], [880, 0.4]], 0.05, 2.2);
}

// gallery bloom: faint airy swell
export function bloomTone() {
  bell([[523.25, 1], [784, 0.5]], 0.03, 0.9);
}

// The Menu: a soft clink on add
export function clink() {
  bell([[1568, 1], [2093, 0.5]], 0.035, 0.35);
}
