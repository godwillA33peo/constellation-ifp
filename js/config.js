// ============================================================
// Supabase connection — fill these two values in after creating
// your Supabase project (see README.md, "Supabase setup").
//
//   SUPABASE_URL      → Project Settings → API → Project URL
//   SUPABASE_ANON_KEY → Project Settings → API → anon public key
//
// The anon key is safe to publish in frontend code: it only allows
// what the Row Level Security policies in supabase/schema.sql permit
// (read everything, insert scores and skills — nothing else).
//
// While both are empty the site runs in demo mode: fellows load from
// data/fellows-seed-data.json and scores/skills save to localStorage.
// ============================================================

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

// ------------------------------------------------------------
// Identity — change the wordmark here and it changes everywhere
// (header, page title, preloader assembly text).
// ------------------------------------------------------------
export const WORDMARK = "Ireland Fellows — Galway '26";
export const PRELOADER_MARK = "GALWAY '26"; // what the star particles assemble
