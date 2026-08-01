// The core colour-and-count data for v4.2. No individual names or
// photos anywhere on the public site — countries only. A palette is
// 2–3 hues sampled from that country's flag, stored as colour alone;
// the flag itself is never rendered.
let countries = null;
let loading = null;

export function loadCountries() {
  if (!loading) {
    loading = fetch("data/countries.json")
      .then((r) => r.json())
      .then((data) => { countries = data.countries; return countries; })
      .catch(() => { countries = []; return countries; });
  }
  return loading;
}

export function allCountries() {
  return countries || [];
}

export function countryOf(name) {
  return countries?.find((c) => c.name === name) || null;
}

export function paletteOf(name) {
  return countryOf(name)?.palette || ["#E6C87A"];
}

export function totalFellows() {
  return (countries || []).reduce((sum, c) => sum + c.fellow_count, 0);
}
