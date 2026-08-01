// Smooth-scroll + scroll-choreography layer (tiers 1–2 only).
// Lenis adds inertia on top of native scroll; GSAP + ScrollTrigger
// drive the kinetic reveals. Nav clicks glide the camera (i.e. the
// scroll position) to each stop instead of jumping.
//
// Everything degrades: if the CDN imports fail, we return nulls and
// the site behaves like tier 3 (native scroll, IO-driven reveals).
let lenis = null;
let gsap = null;
let ScrollTrigger = null;

export async function initScrollLibs(tier) {
  if (tier >= 3) return { gsap: null, lenis: null };
  try {
    const [gsapMod, stMod, lenisMod] = await Promise.all([
      import("https://esm.sh/gsap@3.12.5"),
      import("https://esm.sh/gsap@3.12.5/ScrollTrigger"),
      import("https://esm.sh/lenis@1.1.14"),
    ]);
    gsap = gsapMod.gsap || gsapMod.default;
    ScrollTrigger = stMod.ScrollTrigger || stMod.default;
    gsap.registerPlugin(ScrollTrigger);

    const Lenis = lenisMod.default;
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", () => ScrollTrigger.update());
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    return { gsap, ScrollTrigger, lenis };
  } catch (err) {
    console.warn("Scroll libs unavailable, native scroll only:", err);
    return { gsap: null, lenis: null };
  }
}

// nav = camera controls: glide to the stop
export function wireNav() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 3) });
      else target.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });
}
