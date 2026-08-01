// Entry point: load data, then either hand over to display mode
// (?display=true, for the projector) or boot the four sections with
// simple hash routing (#arrivals / #gallery / #game / #trade).
import { initStore, state } from "./store.js";
import { initArrivals } from "./arrivals.js";
import { initGallery } from "./gallery.js";
import { initGame } from "./game.js";
import { initTrade } from "./trade.js";
import { initDisplay } from "./display.js";

const SECTIONS = ["arrivals", "gallery", "game", "trade"];

async function boot() {
  const params = new URLSearchParams(location.search);

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

  window.addEventListener("hashchange", route);
  route();
}

function route() {
  const target = location.hash.replace("#", "") || "arrivals";
  const current = SECTIONS.includes(target) ? target : "arrivals";
  for (const id of SECTIONS) {
    document.getElementById(id).hidden = id !== current;
  }
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.setAttribute("aria-current", a.dataset.nav === current ? "true" : "false");
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

boot();
