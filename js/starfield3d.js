// The 3D sky (tiers 1–2). Thousands of point-sprite stars in a deep
// field; scroll position drives the camera down a gentle winding path
// through it, grading dusk → midnight as it goes. A soft amber glow
// sits near the start of the journey, a Milky Way particle band near
// the end, shooting stars cross every 15–20s, and the mouse adds a
// small parallax lean. Game streaks brighten the whole field.
//
// This layer is pure presentation: it never carries content, and if
// anything here throws, atmosphere.js falls back to the 2D sky.
import * as THREE from "https://esm.sh/three@0.170.0";
import { mulberry32 } from "./sky.js";

const rng = mulberry32(53927);

let renderer, scene, camera;
let starGroups = [];
let milkyPoints = null;
let duskGlow = null;
let shooting = null;
let nextShotAt = 0;

let tier = 1;
let DEPTH = 4200;
let progress = 0;       // 0 top of page → 1 bottom
let boost = 0;
let boostShown = 0;
let flash = 0;          // event pulse (arrivals landing etc.)
let auroras = [];
let rafId = null;
let clockStart = 0;

// nightfall colour stops (match the 2D sky)
const DUSK = new THREE.Color("#221848");
const MID = new THREE.Color("#0B1026");
const NIGHT = new THREE.Color("#030510");
const scratch = new THREE.Color();

export async function init(t) {
  tier = t;
  DEPTH = tier === 1 ? 4200 : 2600;

  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 1 ? 1.75 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.id = "skyfield";
  renderer.domElement.setAttribute("aria-hidden", "true");
  document.body.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = DUSK.clone();
  scene.fog = new THREE.Fog(DUSK.clone(), 180, tier === 1 ? 1650 : 1150);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 2400);
  camera.position.set(0, 0, 300);

  buildStars();
  buildDuskGlow();
  buildMilkyWay();
  buildAurora();

  // hard rule: the background never reacts to the cursor —
  // no pointer listeners here, and the canvas ignores events
  renderer.domElement.style.pointerEvents = "none";
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  onScroll();
  clockStart = performance.now();
  nextShotAt = clockStart + 5000 + rng() * 8000;
  start();
}

export function setBoost(n) {
  boost = Math.min(10, Math.max(0, n));
}

// a brief warm brightening (arrival landings, celebrations)
export function pulse(strength = 1) {
  flash = Math.min(1.6, flash + 0.55 * strength);
}

/* ---------- world building ---------- */

function softDotTexture(size = 64, inner = "rgba(255,252,240,1)", outer = "rgba(255,252,240,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace("1)", "0.6)"));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePointCloud(positions, { size, opacity, color = 0xf5f3ee }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size,
    map: softDotTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

function buildStars() {
  const total = tier === 1 ? 4500 : 1600;
  const perGroup = Math.floor(total / 3);
  starGroups = [];
  for (let gi = 0; gi < 3; gi++) {
    const positions = [];
    for (let i = 0; i < perGroup; i++) {
      positions.push(
        (rng() - 0.5) * 2800,
        (rng() - 0.5) * 1800,
        400 - rng() * (DEPTH + 800)
      );
    }
    const cloud = makePointCloud(positions, {
      size: 4.5 + gi * 1.5,
      opacity: 0.5 + gi * 0.14,
    });
    cloud.userData = { baseOpacity: 0.5 + gi * 0.14, baseSize: 4.5 + gi * 1.5, phase: gi * 2.1, speed: 0.35 + gi * 0.22 };
    scene.add(cloud);
    starGroups.push(cloud);
  }
}

function buildDuskGlow() {
  // warm amber horizon near the start of the journey; the camera
  // leaves it behind as the night deepens
  const tex = softDotTexture(128, "rgba(232,166,92,0.9)", "rgba(232,166,92,0)");
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending });
  duskGlow = new THREE.Sprite(mat);
  duskGlow.position.set(0, -620, -350);
  duskGlow.scale.set(3400, 1500, 1);
  scene.add(duskGlow);
}

function buildMilkyWay() {
  // a diagonal band of dense faint stars parked near the end of the
  // journey, so nightfall scrolls you into it
  const count = tier === 1 ? 1400 : 520;
  const positions = [];
  const endZ = -(DEPTH - 550);
  for (let i = 0; i < count; i++) {
    const t = rng() * 2 - 1;
    const gauss = (rng() + rng() + rng() - 1.5) / 1.5;
    positions.push(
      t * 2200 + gauss * 140,
      t * 700 + gauss * 300,
      endZ + (rng() - 0.5) * 700
    );
  }
  milkyPoints = makePointCloud(positions, { size: 3.2, opacity: 0.32, color: 0xaab8e8 });
  scene.add(milkyPoints);
}

// two–three translucent green-violet ribbons drifting near the
// horizon; they follow the camera at a fixed distance so the aurora
// lives at the edge of every stretch of the journey
function auroraTexture(c1, c2) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.45, c1);
  grad.addColorStop(0.75, c2);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  // gently waving band
  g.beginPath();
  g.moveTo(0, 128);
  for (let x = 0; x <= 512; x += 16) {
    g.lineTo(x, 34 + Math.sin(x / 63) * 16);
  }
  g.lineTo(512, 128);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildAurora() {
  if (tier > 1 && window.innerWidth < 700) return; // keep mobile lean
  const specs = [
    { c1: "rgba(64,196,140,0.20)", c2: "rgba(120,90,200,0.12)", y: -420, z: -1150, w: 3600, h: 520, speed: 0.021 },
    { c1: "rgba(90,120,220,0.14)", c2: "rgba(64,196,140,0.10)", y: -330, z: -1450, w: 4200, h: 460, speed: -0.014 },
    { c1: "rgba(110,200,160,0.10)", c2: "rgba(150,100,220,0.08)", y: -500, z: -900, w: 3000, h: 420, speed: 0.011 },
  ].slice(0, tier === 1 ? 3 : 2);
  auroras = specs.map((s) => {
    const mat = new THREE.MeshBasicMaterial({
      map: auroraTexture(s.c1, s.c2),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    mesh.position.set(0, s.y, s.z);
    scene.add(mesh);
    return { mesh, spec: s };
  });
}

/* ---------- runtime ---------- */

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function start() {
  if (rafId) return;
  const loop = (now) => { render(now); rafId = requestAnimationFrame(loop); };
  rafId = requestAnimationFrame(loop);
}
function stop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function grade(p) {
  if (p < 0.5) return scratch.copy(DUSK).lerp(MID, p * 2);
  return scratch.copy(MID).lerp(NIGHT, (p - 0.5) * 2);
}

function render(now) {
  const p = progress;
  const t = (now - clockStart) / 1000;

  // the camera's journey: forward through the field with a gentle
  // winding drift plus slow perpetual sway — autonomous, never
  // cursor-driven
  camera.position.z = 300 - p * (DEPTH - 700);
  camera.position.x = Math.sin(p * 3.1) * 90 + Math.sin(t * 0.10) * 26;
  camera.position.y = Math.sin(p * 2.2) * 46 + Math.sin(t * 0.13 + 1.7) * 14;
  camera.rotation.y = Math.sin(p * 2.4) * 0.02 + Math.sin(t * 0.07) * 0.012;
  camera.rotation.x = Math.sin(t * 0.09 + 0.8) * 0.008;

  // nightfall
  const bg = grade(p);
  scene.background.copy(bg);
  scene.fog.color.copy(bg);
  duskGlow.material.opacity = Math.max(0, 0.34 * (1 - p * 2.4));

  // streak boost eases; event flashes decay; stars twinkle in
  // three phased groups
  boostShown += (boost - boostShown) * 0.05;
  flash *= 0.94;
  const lift = 1 + boostShown * 0.055 + flash * 0.22;

  // aurora ribbons ride ahead of the camera, breathing slowly
  for (let i = 0; i < auroras.length; i++) {
    const a = auroras[i];
    a.mesh.position.z = camera.position.z + a.spec.z;
    a.mesh.position.x = Math.sin(t * a.spec.speed * 10 + i * 2.1) * 260;
    a.mesh.material.opacity = (0.55 + 0.35 * Math.sin(t * 0.11 + i * 1.9)) * (1 - p * 0.45);
  }
  for (const ggroup of starGroups) {
    const u = ggroup.userData;
    const tw = 0.82 + 0.18 * Math.sin(t * u.speed * 2 + u.phase);
    ggroup.material.opacity = Math.min(1, u.baseOpacity * tw * lift);
    ggroup.material.size = u.baseSize * (1 + boostShown * 0.04);
  }
  milkyPoints.material.opacity = 0.32 * Math.min(1, Math.max(0, (p - 0.35) / 0.4) + 0.25);

  updateShootingStar(now);

  renderer.render(scene, camera);
}

function updateShootingStar(now) {
  if (!shooting && now >= nextShotAt) {
    const dir = rng() > 0.5 ? 1 : -1;
    const base = new THREE.Vector3(
      camera.position.x - dir * 700,
      camera.position.y + 250 + rng() * 250,
      camera.position.z - 650 - rng() * 300
    );
    const vel = new THREE.Vector3(dir * (7 + rng() * 4), -(2.5 + rng() * 2.5), 0);
    const geo = new THREE.BufferGeometry().setFromPoints([base, base.clone()]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xfff8e8, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    shooting = { line: new THREE.Line(geo, mat), head: base, vel, born: now, life: 1300 };
    scene.add(shooting.line);
    nextShotAt = now + 15000 + rng() * 5000;
  }
  if (!shooting) return;
  const age = now - shooting.born;
  if (age > shooting.life) {
    scene.remove(shooting.line);
    shooting.line.geometry.dispose();
    shooting.line.material.dispose();
    shooting = null;
    return;
  }
  shooting.head.add(shooting.vel);
  const tail = shooting.head.clone().addScaledVector(shooting.vel, -16);
  shooting.line.geometry.setFromPoints([shooting.head, tail]);
  shooting.line.material.opacity = 0.9 * (1 - age / shooting.life);
}
