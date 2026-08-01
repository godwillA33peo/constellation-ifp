// Progressive experience tiers, decided once at load.
//   1 — modern desktop: full WebGL journey
//   2 — modern mobile / modest hardware: simplified WebGL
//   3 — reduced motion, no WebGL, or low-end: static 2D sky (same content)
export function detectTier() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 3;
  if (!webglAvailable()) return 3;

  const small = window.innerWidth < 820 || /Mobi|Android/i.test(navigator.userAgent);
  const lowMem = navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4;
  const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 3;

  if (small && lowMem && lowCores) return 3;
  if (small || lowMem || lowCores) return 2;
  return 1;
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
