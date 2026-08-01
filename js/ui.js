// Small shared UI pieces: the fellow card modal.
import { photoOrInitials } from "./sky.js";

const modalRoot = () => document.getElementById("modal-root");

export function openFellowCard(fellow) {
  closeModal();
  const scrim = document.createElement("div");
  scrim.className = "modal-scrim";
  scrim.addEventListener("click", (e) => { if (e.target === scrim) closeModal(); });

  const card = document.createElement("div");
  card.className = "fellow-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", fellow.name);

  const close = document.createElement("button");
  close.className = "modal-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  close.addEventListener("click", closeModal);

  const photo = photoOrInitials(fellow, "card-photo");

  card.append(close, photo);
  // fields still blank in the data simply don't render
  card.insertAdjacentHTML(
    "beforeend",
    `<h2>${esc(fellow.name)}</h2>
     <p class="card-country">${esc(fellow.country)}</p>
     ${fellow.course ? `<p class="card-course">${esc(fellow.course)}</p>` : ""}
     ${fellow.university ? `<p class="card-uni">${esc(fellow.university)}</p>` : ""}
     ${fellow.funFact ? `<p class="card-fact">“${esc(fellow.funFact)}”</p>` : ""}`
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
