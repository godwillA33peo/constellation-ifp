// Facade over whichever sky is running — the Three.js starfield
// (tiers 1–2) or the 2D canvas skyfield (tier 3 / WebGL failure).
// Everything else talks to the sky through this module only.
let boostFn = () => {};

export async function initAtmosphere(tier) {
  if (tier <= 2) {
    try {
      const m = await import("./starfield3d.js");
      await m.init(tier);
      boostFn = m.setBoost;
      return "webgl";
    } catch (err) {
      console.warn("WebGL sky unavailable, falling back to 2D:", err);
    }
  }
  const m = await import("./skyfield.js");
  m.initSkyfield();
  boostFn = m.setSkyBoost;
  return "canvas";
}

// game streaks brighten whichever sky is up
export function setSkyBoost(n) {
  boostFn(n);
}
