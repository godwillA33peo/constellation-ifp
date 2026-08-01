// Kinetic typography: headings marked data-kinetic split into words
// that rise and settle one by one with a slight overshoot, then a
// gold shimmer sweeps the line once. GSAP + ScrollTrigger when
// available; IO + CSS (same look, springy cubic-bezier) otherwise.
// Words are only hidden once JS arms them — no-JS keeps plain text.
let gsapRef = null;
let stRef = null;

export function initKinetic({ gsap = null, ScrollTrigger = null } = {}, tier = 3) {
  gsapRef = gsap;
  stRef = ScrollTrigger;

  document.querySelectorAll("[data-kinetic]").forEach((el) => {
    if (tier === 3) return; // static: leave the text untouched
    splitWords(el);
    const isHero = !!el.closest("#hero");
    if (gsapRef && stRef) armGsap(el, isHero);
    else armCss(el, isHero);
  });
}

function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = "";
  el.classList.add("kin");
  words.forEach((w, i) => {
    const outer = document.createElement("span");
    outer.className = "kw";
    const inner = document.createElement("span");
    inner.className = "kwi";
    inner.style.setProperty("--wi", i);
    inner.textContent = w;
    outer.append(inner);
    el.append(outer, document.createTextNode(" "));
  });
}

function shimmer(el) {
  // the sweep travels the line: each word's gradient starts a beat
  // after the previous word's, proportional to its position
  const words = [...el.querySelectorAll(".kwi")];
  const total = el.getBoundingClientRect().width || 1;
  words.forEach((w) => {
    const off = w.getBoundingClientRect().left - el.getBoundingClientRect().left;
    w.style.setProperty("--shine-delay", `${(off / total) * 0.55}s`);
  });
  el.classList.add("shone");
}

function armGsap(el, heroManual = false) {
  const words = el.querySelectorAll(".kwi");
  // words resolve into focus like stars: blurred and dim → sharp and
  // bright. No rises, no overshoot — understated, cinematic.
  gsapRef.set(words, { opacity: 0.05, filter: "blur(9px)" });
  if (heroManual) return; // playHero() fires this one when the preloader lifts
  gsapRef.to(words, {
    opacity: 1,
    filter: "blur(0px)",
    ease: "power2.out",
    duration: 0.62,
    stagger: 0.09,
    scrollTrigger: { trigger: el, start: "top 78%", once: true },
    onComplete: () => shimmer(el),
  });
}

function armCss(el, heroManual = false) {
  el.classList.add("kin-armed");
  if (heroManual) return; // playHero() adds .kin-in at the reveal
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    el.classList.add("kin-in");
    const words = el.querySelectorAll(".kwi").length;
    setTimeout(() => shimmer(el), words * 70 + 750);
  }, { threshold: 0.4 });
  io.observe(el);
}

// hero fires the moment the preloader lifts, not on scroll
export function playHero() {
  const el = document.querySelector("#hero [data-kinetic]");
  if (!el || !el.classList.contains("kin")) return;
  if (gsapRef && stRef) {
    const words = el.querySelectorAll(".kwi");
    gsapRef.to(words, {
      opacity: 1, filter: "blur(0px)", ease: "power2.out", duration: 0.7, stagger: 0.11,
      onComplete: () => shimmer(el),
    });
  } else {
    el.classList.add("kin-in");
    setTimeout(() => shimmer(el), el.querySelectorAll(".kwi").length * 70 + 800);
  }
}
