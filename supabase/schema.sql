-- ============================================================
-- Ireland Fellows — Galway '26: Supabase schema (v4.2)
-- Run this ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → paste everything → Run
-- Safe to re-run: it drops and recreates the tables.
--
-- v4.2 note: no personal data lives in Supabase any more. The
-- roster (countries + fellow counts, no names) is static JSON at
-- data/countries.json — it never needed a database table. This
-- schema only persists what visitors submit themselves: game
-- scores (a self-opted leaderboard name) and Menu wishlist votes
-- (anonymous).
-- ============================================================

drop table if exists public.fellows cascade;        -- superseded — no personal data in Supabase
drop table if exists public.skills_zone cascade;     -- superseded by The Menu
drop table if exists public.menu_votes cascade;      -- superseded by menu.votes
drop table if exists public.leaderboard cascade;
drop table if exists public.menu cascade;

-- one row per submitted game score
create table public.leaderboard (
  id           uuid primary key default gen_random_uuid(),
  player_name  text not null,
  score        integer not null,
  completed_at timestamptz not null default now()
);

-- The Menu: an anonymous food/drink wishlist. One row per distinct
-- item; votes increments in place (no per-voter attribution).
create table public.menu (
  id         uuid primary key default gen_random_uuid(),
  item       text not null,
  kind       text not null check (kind in ('food', 'drink')),
  votes      integer not null default 1,
  created_at timestamptz not null default now(),
  unique (kind, item)
);

-- ------------------------------------------------------------
-- Row Level Security: the public anon key may READ everything,
-- INSERT scores/menu items within sane limits, and UPDATE only the
-- votes column on an existing menu row. No deletes, no editing
-- anything else.
-- ------------------------------------------------------------

alter table public.leaderboard enable row level security;
alter table public.menu        enable row level security;

create policy "anyone can read the leaderboard"
  on public.leaderboard for select using (true);

create policy "anyone can submit a score"
  on public.leaderboard for insert
  with check (
    char_length(player_name) between 1 and 40
    and score between 0 and 100000
  );

create policy "anyone can read the menu"
  on public.menu for select using (true);

create policy "anyone can add a wishlist item"
  on public.menu for insert
  with check (char_length(item) between 1 and 60);

create policy "anyone can vote (increment) an existing item"
  on public.menu for update
  using (true)
  with check (true);

-- live leaderboard on the party-night projector
alter publication supabase_realtime add table public.leaderboard;
