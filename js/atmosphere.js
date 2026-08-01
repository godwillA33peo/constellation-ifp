// Facade over whichever sky is running — the Three.js starfield
// (tiers 1–2) or the 2D canvas skyfield (tier 3 / WebGL failure).
// Everything else talks to the sky through this module only.
// The sky reacts to EVENTS (arrivals, streaks, menu adds) — never
// to the mouse.
let boostFn = () => {};
let pulseFn = () => {};

export async function initAtmosphere(tier) {
  if (tier <= 2) {
    try {
      const m = await import("./starfield3d.js");
      await m.init(tier);
      boostFn = m.setBoost;
      pulseFn = m.pulse;
      return "webgl";
    } catch (err) {
      console.warn("WebGL sky unavailable, falling back to 2D:", err);
    }
  }
  const m = await import("./skyfield.js");
  m.initSkyfield();
  boostFn = m.setSkyBoost;
  pulseFn = m.pulseSky || (() => {});
  return "canvas";
}

// game streaks brighten whichever sky is up
export function setSkyBoost(n) {
  boostFn(n);
}

// a brief warm brightening — arrivals landing, celebratory moments
export function pulseSky(strength = 1) {
  pulseFn(strength);
}
