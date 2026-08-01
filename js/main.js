// Entry point. The page is one continuous sky now — no hash routing,
// no hidden sections. Load data, light the skyfield, boot the four
// sections, and keep the nav in step with scrolling. ?display=true
// still hands the whole screen to the projector view.
import { initStore, state } from "./store.js";
import { initSkyfield } from "./skyfield.js";
import { initArrivals } from "./arrivals.js";
import { initGallery } from "./gallery.js";
import { initGame } from "./game.js";
import { initTrade } from "./trade.js";
import { initDisplay } from "./display.js";

const SECTIONS = ["arrivals", "gallery", "game", "trade"];

async function boot() {
  const params = new URLSearchParams(location.search);

  initSkyfield();

  try {
    await initStore();
  } catch (err) {
    document.getElementById("app").innerHTML =
      `<section class="section"><h1>The sky won't load</h1>
       <p>Something went wrong fetching our data — try a refresh?</p></section>`;
    console.error(err);
    return;
  }

  if (params.get("display") === "true") {
    await initDisplay(params);
    return;
  }

  document.getElementById("demo-banner").hidden = state.live;

  await initArrivals();
  initGallery();
  initGame();
  initTrade();

  scrollSpy();
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
