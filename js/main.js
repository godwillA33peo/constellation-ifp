// Entry point for the v3 journey.
//
// Boot order: detect the experience tier → start loading everything
// in parallel behind the preloader (data, fonts, map, sky engine,
// scroll libs) → build the DOM sections (the accessible content
// layer) → when the preloader lifts, play the hero and hand over to
// the scroll experience. ?display=true still routes straight to the
// projector view, skipping the cinematic arrival.
import { initStore, state } from "./store.js";
import { detectTier } from "./tiers.js";
import { initAtmosphere } from "./atmosphere.js";
import { runPreloader } from "./preloader.js";
import { initScrollLibs, wireNav } from "./scroll.js";
import { initKinetic, playHero } from "./kinetic.js";
import { initCursor } from "./cursor.js";
import { initSound } from "./soundscape.js";
import { fetchLandPath } from "./worldmap.js";
import { initArrivals } from "./arrivals.js";
import { initGallery } from "./gallery.js";
import { initGame } from "./game.js";
import { initTrade } from "./trade.js";
import { initClosing } from "./closing.js";
import { initDisplay } from "./display.js";

const SECTIONS = ["arrivals", "gallery", "game", "trade"];

function makeTracker() {
  let total = 0, settled = 0;
  return {
    track(promise) {
      total += 1;
      return Promise.resolve(promise)
        .catch((e) => { console.warn("asset load:", e); })
        .finally(() => { settled += 1; });
    },
    progress() { return total === 0 ? 1 : settled / total; },
  };
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const tier = detectTier();
  document.body.dataset.tier = tier;

  // projector mode: no preloader, no smooth-scroll layer
  if (params.get("display") === "true") {
    document.getElementById("preloader")?.remove();
    try { await initStore(); } catch (e) { console.error(e); return; }
    await initAtmosphere(tier);
    await initDisplay(params);
    return;
  }

  // load everything behind the arrival sequence
  const tracker = makeTracker();
  const pStore = tracker.track(initStore());
  tracker.track(fetchLandPath());
  tracker.track(document.fonts ? document.fonts.load("560 90px Fraunces") : Promise.resolve());
  tracker.track(fetch("data/questions.json"));
  tracker.track(initAtmosphere(tier));
  const pLibs = tier < 3 ? initScrollLibs(tier) : Promise.resolve({ gsap: null, lenis: null });
  tracker.track(pLibs);

  const preloaderDone = runPreloader(tracker, tier);

  try {
    await pStore;
  } catch (err) {
    document.getElementById("preloader")?.remove();
    document.getElementById("app").innerHTML =
      `<section class="section"><h1>The sky won't load</h1>
       <p>Something went wrong fetching our data — try a refresh?</p></section>`;
    console.error(err);
    return;
  }

  document.getElementById("demo-banner").hidden = state.live;

  await initArrivals();
  initGallery();
  initGame();
  initTrade();
  initClosing();
  scrollSpy();

  const libs = await pLibs;
  initKinetic(libs, tier);
  wireNav();

  await preloaderDone;

  // the sky opens: hero type rises, chrome comes alive
  playHero();
  initCursor(tier);
  initSound();
}

// keep the nav's gold star on the section in view
function scrollSpy() {
  const links = [...document.querySelectorAll("[data-nav]")];
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        links.forEach((a) => a.setAttribute("aria-current", a.dataset.nav === id ? "true" : "false"));
      }
    },
    { rootMargin: "-35% 0px -55% 0px" }
  );
  SECTIONS.forEach((id) => spy.observe(document.getElementById(id)));
}

boot();
