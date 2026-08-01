// Custom cursor (desktop, fine pointers, tiers 1–2): a small glowing
// star trailing faint comet dust. Interactive elements pull the star
// toward their centre and pick up a soft glow while it's near.
export function initCursor(tier) {
  if (tier === 3) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.id = "cursor-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  document.body.classList.add("has-cursor");

  const ctx = canvas.getContext("2d");
  let W, H;
  const fit = () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };
  fit();
  window.addEventListener("resize", fit, { passive: true });

  const mouse = { x: -100, y: -100 };
  const head = { x: -100, y: -100 };
  let magnet = null;
  let visible = false;
  const trail = [];

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    visible = true;
  }, { passive: true });
  document.addEventListener("mouseleave", () => { visible = false; });

  // magnetic pull toward interactive elements
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("a, button, [data-magnetic], input, select");
    if (el === magnet) return;
    magnet?.classList.remove("cursor-near");
    magnet = el;
    magnet?.classList.add("cursor-near");
  });
  document.addEventListener("mouseout", (e) => {
    if (magnet && e.target.closest("a, button, [data-magnetic], input, select") === magnet) {
      magnet.classList.remove("cursor-near");
      magnet = null;
    }
  });

  function frame() {
    ctx.clearRect(0, 0, W, H);
    if (visible) {
      // attraction: bias the star toward the hovered element's centre
      let tx = mouse.x, ty = mouse.y;
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        if (r.width && r.width < 420) {
          tx = mouse.x * 0.65 + (r.left + r.width / 2) * 0.35;
          ty = mouse.y * 0.65 + (r.top + r.height / 2) * 0.35;
        }
      }
      head.x += (tx - head.x) * 0.35;
      head.y += (ty - head.y) * 0.35;

      trail.push({ x: head.x, y: head.y, life: 1 });
      if (trail.length > 22) trail.shift();

      for (const p of trail) {
        p.life -= 0.045;
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life * 0.28;
        ctx.fillStyle = "#E6C87A";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6 * p.life + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // the star head: four-point sparkle
      const s = magnet ? 7.5 : 5;
      ctx.globalAlpha = 1;
      ctx.fillStyle = magnet ? "#E6C87A" : "#F5F3EE";
      ctx.shadowColor = "rgba(230,200,122,0.8)";
      ctx.shadowBlur = magnet ? 14 : 8;
      ctx.beginPath();
      ctx.moveTo(head.x, head.y - s);
      ctx.quadraticCurveTo(head.x + s * 0.22, head.y - s * 0.22, head.x + s, head.y);
      ctx.quadraticCurveTo(head.x + s * 0.22, head.y + s * 0.22, head.x, head.y + s);
      ctx.quadraticCurveTo(head.x - s * 0.22, head.y + s * 0.22, head.x - s, head.y);
      ctx.quadraticCurveTo(head.x - s * 0.22, head.y - s * 0.22, head.x, head.y - s);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
