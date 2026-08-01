// Data layer. One interface, two backends:
//  - Supabase (shared, live) when keys are set in config.js
//  - localStorage (this device only) otherwise
//
// v4.2: no personal data lives here any more — the roster (countries
// only, no names) is static JSON loaded via countries.js. This layer
// only ever persists what visitors submit themselves: game scores
// and Menu wishlist votes.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const LS_SCORES = "constellation_leaderboard";
const LS_MENU = "constellation_menu";
const LS_VOTED = "constellation_menu_voted";

export const state = {
  live: false, // true when Supabase is connected
};

let supabase = null;
let leaderboardListeners = [];

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
      const { error } = await supabase.from("leaderboard").select("id").limit(1);
      if (error) throw error;
      state.live = true;
      subscribeLeaderboard();
      return state;
    } catch (err) {
      console.warn("Supabase unreachable, falling back to demo mode:", err);
      supabase = null;
    }
  }
  state.live = false;
  return state;
}

// -- leaderboard -----------------------------------------------
// leaderboard names are self-opted by the player at the moment they
// finish a round — the one place a name appears on the public site.

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

// -- The Menu: an anonymous wishlist/poll -----------------------
// Not "bring a dish" — just what people want to eat and drink.
// A submission is a preference vote, nothing more; no attribution
// beyond an optional first name.

export async function getMenu() {
  if (supabase) {
    const { data, error } = await supabase
      .from("menu")
      .select("id, item, kind, votes")
      .order("votes", { ascending: false });
    if (error) { console.warn(error); return []; }
    return data;
  }
  return readLS(LS_MENU);
}

// vote for an existing item, or add a new one ("something else")
export async function voteMenuItem({ item, kind }) {
  item = item.trim().slice(0, 60);
  kind = kind === "drink" ? "drink" : "food";
  if (!item) throw new Error("Tell us what you're craving.");
  if (supabase) {
    const { data: existing } = await supabase
      .from("menu").select("id, votes").eq("kind", kind).ilike("item", item).limit(1);
    if (existing?.length) {
      const { error } = await supabase.from("menu")
        .update({ votes: existing[0].votes + 1 }).eq("id", existing[0].id);
      if (error) throw error;
      return existing[0].id;
    }
    const { data, error } = await supabase.from("menu")
      .insert({ item, kind, votes: 1 }).select("id").single();
    if (error) throw error;
    return data.id;
  }
  const rows = readLS(LS_MENU);
  const match = rows.find((r) => r.kind === kind && r.item.toLowerCase() === item.toLowerCase());
  if (match) {
    match.votes += 1;
    writeLS(LS_MENU, rows);
    return match.id;
  }
  const id = `local-${Date.now()}`;
  rows.unshift({ id, item, kind, votes: 1 });
  writeLS(LS_MENU, rows);
  return id;
}

// one vote per browser per item, tracked client-side only (the
// wishlist itself is anonymous)
export function hasVotedFor(key) {
  return readLS(LS_VOTED).includes(key);
}
export function markVoted(key) {
  writeLS(LS_VOTED, [...readLS(LS_VOTED), key]);
}
