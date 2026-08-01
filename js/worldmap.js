// Equirectangular world map. Land outlines come from the world-atlas
// dataset on jsDelivr; if that fetch fails (offline dev, CDN block),
// the map degrades to a graticule-only star field — everything else
// still works because fellow positions only need lat/lng math.
import { el } from "./sky.js";

export const MAP_W = 960;
export const MAP_H = 480;

export function project(lat, lng) {
  return [((lng + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];
}

const LAND_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

let landPromise = null;

export function fetchLandPath() {
  if (!landPromise) landPromise = buildLandPath().catch(() => null);
  return landPromise;
}

async function buildLandPath() {
  const [topo, { feature }] = await Promise.all([
    fetch(LAND_URL).then((r) => r.json()),
    import("https://esm.sh/topojson-client@3"),
  ]);
  const land = feature(topo, topo.objects.land);
  // feature() returns a FeatureCollection here (land is a GeometryCollection)
  const geoms = land.type === "FeatureCollection"
    ? land.features.map((f) => f.geometry)
    : [land.geometry];
  const polys = geoms.flatMap((g) =>
    g.type === "Polygon" ? [g.coordinates] : g.coordinates
  );
  let d = "";
  for (const poly of polys) {
    for (const ring of poly) {
      d += ring
        .map(([lng, lat], i) => {
          const [x, y] = project(lat, lng);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join("") + "Z";
    }
  }
  return d;
}

export function graticule() {
  const g = el("g", { class: "map-graticule" });
  for (let lng = -150; lng <= 150; lng += 30) {
    const [x] = project(0, lng);
    g.append(el("line", { x1: x, y1: 0, x2: x, y2: MAP_H }));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(lat, 0);
    g.append(el("line", { x1: 0, y1: y, x2: MAP_W, y2: y }));
  }
  return g;
}
