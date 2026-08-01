// Small shared UI pieces: the country card modal. No individual
// names or photos anywhere on the public site — a tap on a country
// (Arrivals, Sky Gallery) shows only its fellow count, lit in that
// country's palette.
import { paletteOf } from "./countries.js";

const modalRoot = () => document.getElementById("modal-root");

export function openCountryCard(country) {
  closeModal();
  const scrim = document.createElement("div");
  scrim.className = "modal-scrim";
  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeModal(); });

  const card = document.createElement("div");
  card.className = "fellow-card country-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", country.name);

  const close = document.createElement("button");
  close.className = "modal-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  close.addEventListener("click", closeModal);

  const [c1, c2] = paletteOf(country.name);
  const glow = document.createElement("div");
  glow.className = "country-glow";
  glow.style.background = `radial-gradient(circle, ${c1}, ${c2 || c1}, transparent 72%)`;

  card.append(close, glow);
  card.insertAdjacentHTML(
    "beforeend",
    `<h2>${esc(country.name)}</h2>
     <p class="card-country">${country.fellow_count} fellow${country.fellow_count > 1 ? "s" : ""} from here</p>`
  );

  scrim.append(card);
  modalRoot().append(scrim);
  close.focus();
  document.addEventListener("keydown", escClose);
}

export function closeModal() {
  modalRoot().innerHTML = "";
  document.removeEventListener("keydown", escClose);
}

function escClose(e) {
  if (e.key === "Escape") closeModal();
}

export function esc(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
