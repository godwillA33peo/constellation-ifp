// Micro-sound, entirely synthesised (no audio files): a soft ambient
// pad, a chime for correct answers, a warmer tone for photo blooms.
// Muted by default with a visible toggle; the AudioContext is only
// created after the user unmutes (a user gesture), so nothing ever
// autoplays.
let ctx = null;
let muted = true;
let pad = null;
let button = null;

export function initSound() {
  button = document.createElement("button");
  button.className = "sound-toggle";
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", "Sound: off. Toggle ambient sound.");
  button.textContent = "♪";
  document.querySelector(".site-header")?.append(button);
  button.addEventListener("click", toggle);
}

function toggle() {
  muted = !muted;
  button.setAttribute("aria-pressed", String(!muted));
  button.setAttribute("aria-label", muted ? "Sound: off. Toggle ambient sound." : "Sound: on. Toggle ambient sound.");
  button.classList.toggle("on", !muted);
  if (!muted) {
    ensureCtx();
    startPad();
  } else {
    stopPad();
  }
}

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
}

/* ---------- the ambient pad ---------- */

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

  // slow breathing on the filter
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  filter.connect(gain).connect(ctx.destination);
  pad = { oscs, lfo, gain };
}

function stopPad() {
  if (!pad || !ctx) return;
  const { oscs, lfo, gain } = pad;
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); }, 900);
  pad = null;
}

/* ---------- one-shot tones ---------- */

function bell(partials, baseGain, decay) {
  if (muted || !ctx) return;
  const now = ctx.currentTime;
  partials.forEach(([freq, rel], i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(baseGain * rel, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay + i * 0.1);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + decay + 0.3);
  });
}

// correct answer
export function chime() {
  bell([[880, 1], [1318.5, 0.55], [1760, 0.3]], 0.05, 1.2);
}

// photo bloom
export function bloomTone() {
  bell([[523.25, 1], [784, 0.5]], 0.035, 0.9);
}
