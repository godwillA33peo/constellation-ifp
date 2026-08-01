// Flags rendered as light. Loads data/flags.json once and hands out
// colour data (particle mosaics, comet bursts, star tints) and
// flagcdn image URLs (silk bloom backdrop; The Menu's label chips —
// the only place flat flags are allowed).
let flags = null;
let loading = null;

export function loadFlags() {
  if (!loading) {
    loading = fetch("data/flags.json")
      .then((r) => r.json())
      .then((data) => { delete data._readme; flags = data; return flags; })
      .catch(() => { flags = {}; return flags; });
  }
  return loading;
}

export function flagOf(country) {
  return flags?.[country] || null;
}

export function flagColors(country) {
  return flagOf(country)?.stripes || ["#E6C87A"];
}

export function flagTint(country) {
  return flagOf(country)?.tint || "#E6C87A";
}

export function flagImgUrl(country, width = 80) {
  const iso = flagOf(country)?.iso;
  return iso ? `https://flagcdn.com/w${width}/${iso}.png` : "";
}

// The particle-mosaic layout: a small grid of points coloured in the
// flag's stripe pattern. Returns [{u, v, color}] with u,v in [0,1].
export function flagMosaic(country, cols = 12, rows = 8) {
  const flag = flagOf(country);
  const stripes = flag?.stripes || ["#E6C87A"];
  const vertical = flag?.dir === "v";
  const pts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols;
      const v = (r + 0.5) / rows;
      const band = Math.min(stripes.length - 1, Math.floor((vertical ? u : v) * stripes.length));
      pts.push({ u, v, color: stripes[band] });
    }
  }
  return pts;
}
