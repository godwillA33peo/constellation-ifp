// Data layer. One interface, two backends:
//  - Supabase (shared, live) when keys are set in config.js
//  - seed JSON + localStorage (this device only) otherwise
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const LS_SCORES = "constellation_leaderboard";
const LS_MENU = "constellation_menu";
const LS_VOTED = "constellation_menu_voted";

export const state = {
  fellows: [],
  live: false, // true when Supabase is connected
};

let supabase = null;
let leaderboardListeners = [];

// -- helpers ---------------------------------------------------

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  country: r.country,
  lat: r.lat,
  lng: r.lng,
  course: r.course,
  university: r.university,
  photoUrl: r.photo_url ?? r.photoUrl ?? "",
  funFact: r.fun_fact ?? r.funFact ?? "",
});

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

// -- init ------------------------------------------------------

export async function initStore() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabase.from("fellows").select("*").order("country");
      if (error) throw error;
      state.fellows = data.map(fromRow);
      state.live = true;
      subscribeLeaderboard();
      return state;
    } catch (err) {
      console.warn("Supabase unreachable, falling back to demo mode:", err);
      supabase = null;
    }
  }
  const res = await fetch("data/fellows.json");
  const seed = await res.json();
  state.fellows = seed.fellows.map(fromRow);
  state.live = false;
  return state;
}

// -- leaderboard -----------------------------------------------

export async function getLeaderboard(limit = 50) {
  if (supabase) {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("player_name, score, completed_at")
      .order("score", { ascending: false })
      .order("completed_at", { ascending: true })
      .limit(limit);
    if (error) { console.warn(error); return []; }
    return data.map((r) => ({ playerName: r.player_name, score: r.score, completedAt: r.completed_at }));
  }
  return readLS(LS_SCORES)
    .sort((a, b) => b.score - a.score || a.completedAt.localeCompare(b.completedAt))
    .slice(0, limit);
}

export async function submitScore(playerName, score) {
  playerName = playerName.trim().slice(0, 40);
  if (!playerName) throw new Error("We need a name for the leaderboard.");
  if (supabase) {
    const { error } = await supabase
      .from("leaderboard")
      .insert({ player_name: playerName, score });
    if (error) throw error;
  } else {
    const rows = readLS(LS_SCORES);
    rows.push({ playerName, score, completedAt: new Date().toISOString() });
    writeLS(LS_SCORES, rows);
    notifyLeaderboard();
  }
}

export function onLeaderboardChange(cb) {
  leaderboardListeners.push(cb);
}
function notifyLeaderboard() {
  leaderboardListeners.forEach((cb) => cb());
}
function subscribeLeaderboard() {
  supabase
    .channel("leaderboard-live")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "leaderboard" },
      () => notifyLeaderboard()
    )
    .subscribe();
}

// -- The Menu ("bring your country to the table") ---------------

export async function getMenu() {
  if (supabase) {
    const [{ data: items, error }, { data: votes }] = await Promise.all([
      supabase.from("menu").select("id, name, item, kind, country, note, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("menu_votes").select("item_id"),
    ]);
    if (error) { console.warn(error); return []; }
    const counts = {};
    (votes || []).forEach((v) => { counts[v.item_id] = (counts[v.item_id] || 0) + 1; });
    return items.map((r) => ({ ...r, votes: counts[r.id] || 0 }));
  }
  return readLS(LS_MENU);
}

export async function addMenuItem({ name, item, kind, country, note }) {
  name = name.trim().slice(0, 60);
  item = item.trim().slice(0, 80);
  note = (note || "").trim().slice(0, 120);
  kind = kind === "drink" ? "drink" : "food";
  if (!name || !item) throw new Error("A name and a dish (or drink), please.");
  if (supabase) {
    const { error } = await supabase.from("menu").insert({ name, item, kind, country, note });
    if (error) throw error;
  } else {
    const rows = readLS(LS_MENU);
    rows.unshift({
      id: `local-${Date.now()}`, name, item, kind, country, note,
      votes: 0, created_at: new Date().toISOString(),
    });
    writeLS(LS_MENU, rows);
  }
}

// one upvote per item per device
export function hasVoted(itemId) {
  return readLS(LS_VOTED).includes(itemId);
}

export async function upvoteMenuItem(itemId) {
  if (hasVoted(itemId)) return false;
  if (supabase) {
    const { error } = await supabase.from("menu_votes").insert({ item_id: itemId });
    if (error) throw error;
  } else {
    const rows = readLS(LS_MENU);
    const row = rows.find((r) => r.id === itemId);
    if (row) { row.votes = (row.votes || 0) + 1; writeLS(LS_MENU, rows); }
  }
  writeLS(LS_VOTED, [...readLS(LS_VOTED), itemId]);
  return true;
}
