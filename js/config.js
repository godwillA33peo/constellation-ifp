// ============================================================
// Supabase connection — fill these two values in after creating
// your Supabase project (see README.md, "Supabase setup").
//
//   SUPABASE_URL      → Project Settings → API → Project URL
//   SUPABASE_ANON_KEY → Project Settings → API → anon public key
//
// The anon key is safe to publish in frontend code: it only allows
// what the Row Level Security policies in supabase/schema.sql permit
// (read the leaderboard/menu, insert scores and wishlist votes —
// nothing else; no personal data is ever stored in Supabase).
//
// While both are empty the site runs in demo mode: scores and Menu
// votes save to localStorage instead of Supabase. The roster itself
// (data/countries.json) is static and needs no backend either way.
// ============================================================

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

// ------------------------------------------------------------
// Identity — change the wordmark here and it changes everywhere
// (header, page title, preloader assembly text).
// ------------------------------------------------------------
export const WORDMARK = "Ireland Fellows — Galway '26";
export const PRELOADER_MARK = "GALWAY '26"; // what the star particles assemble
