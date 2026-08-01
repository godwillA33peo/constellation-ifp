-- ============================================================
-- Ireland Fellows — Galway '26: Supabase schema + seed data (v4.1)
-- Run this ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → paste everything → Run
-- Safe to re-run: it drops and recreates the tables.
-- ============================================================

drop table if exists public.fellows cascade;
drop table if exists public.leaderboard cascade;
drop table if exists public.skills_zone cascade;  -- superseded by The Menu
drop table if exists public.menu cascade;
drop table if exists public.menu_votes cascade;

-- one row per fellow (the stars)
create table public.fellows (
  id         text primary key,
  name       text not null,
  country    text not null,
  lat        double precision not null,
  lng        double precision not null,
  course     text,
  university text,
  photo_url  text,
  fun_fact   text
);

-- one row per submitted game score
create table public.leaderboard (
  id           uuid primary key default gen_random_uuid(),
  player_name  text not null,
  score        integer not null,
  completed_at timestamptz not null default now()
);

-- The Menu: one row per dish/drink brought to the table
create table public.menu (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  item       text not null,
  kind       text not null check (kind in ('food', 'drink')),
  country    text,
  note       text,
  created_at timestamptz not null default now()
);

-- star-tap upvotes, insert-only (votes are counted, never edited)
create table public.menu_votes (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.menu(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security: the public anon key may READ everything,
-- and INSERT scores / menu items / votes within sane limits.
-- No updates, no deletes, no editing fellows from the browser.
-- ------------------------------------------------------------

alter table public.fellows     enable row level security;
alter table public.leaderboard enable row level security;
alter table public.menu        enable row level security;
alter table public.menu_votes  enable row level security;

create policy "anyone can read fellows"
  on public.fellows for select using (true);

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

create policy "anyone can bring a dish"
  on public.menu for insert
  with check (
    char_length(name) between 1 and 60
    and char_length(item) between 1 and 80
  );

create policy "anyone can read votes"
  on public.menu_votes for select using (true);

create policy "anyone can wish for a dish"
  on public.menu_votes for insert with check (true);

-- live leaderboard on the party-night projector
alter publication supabase_realtime add table public.leaderboard;

-- ------------------------------------------------------------
-- Seed: the real roster (35 fellows). Courses, photos and
-- fun facts are blank until Godwill adds them — edit rows in
-- Dashboard → Table Editor → fellows.
-- ------------------------------------------------------------

insert into public.fellows
  (id, name, country, lat, lng, course, university, photo_url, fun_fact)
values
  ('fellow-01', 'Limbie', 'Malawi', -13.9626, 33.7741, 'LLM', null, '/assets/photos/fellow-01.jpg', null),
  ('fellow-02', 'Joseph', 'Zambia', -15.3875, 28.3228, null, null, '/assets/photos/fellow-02.jpg', null),
  ('fellow-03', 'Farai', 'Zimbabwe', -17.8292, 31.0522, null, null, '/assets/photos/fellow-03.jpg', null),
  ('fellow-04', 'Zulu', 'Zimbabwe', -17.8292, 31.0522, null, null, '/assets/photos/fellow-04.jpg', null),
  ('fellow-05', 'Zozie', 'South Africa', -25.7479, 28.2293, null, null, '/assets/photos/fellow-05.jpg', null),
  ('fellow-06', 'Faith', 'South Africa', -25.7479, 28.2293, null, null, '/assets/photos/fellow-06.jpg', null),
  ('fellow-07', 'Zizi', 'South Africa', -25.7479, 28.2293, null, null, '/assets/photos/fellow-07.jpg', null),
  ('fellow-08', 'Eva', 'Kenya', -1.2921, 36.8219, null, null, '/assets/photos/fellow-08.jpg', null),
  ('fellow-09', 'Ali', 'Kenya', -1.2921, 36.8219, null, null, '/assets/photos/fellow-09.jpg', null),
  ('fellow-10', 'Paula', 'Ecuador', -0.1807, -78.4678, null, null, '/assets/photos/fellow-10.jpg', null),
  ('fellow-11', 'Aline', 'Brazil', -15.7939, -47.8828, null, null, '/assets/photos/fellow-11.jpg', null),
  ('fellow-12', 'Misgana', 'Ethiopia', 9.03, 38.74, null, null, '/assets/photos/fellow-12.jpg', null),
  ('fellow-13', 'Sofia', 'Somalia', 2.0469, 45.3182, null, null, '/assets/photos/fellow-13.jpg', null),
  ('fellow-14', 'Seble', 'Ethiopia', 9.03, 38.74, null, null, '/assets/photos/fellow-14.jpg', null),
  ('fellow-15', 'Mitchell', 'Zambia', -15.3875, 28.3228, null, null, '/assets/photos/fellow-15.jpg', null),
  ('fellow-16', 'Namutami', 'Zambia', -15.3875, 28.3228, null, null, '/assets/photos/fellow-16.jpg', null),
  ('fellow-17', 'Ruth', 'Malawi', -13.9626, 33.7741, null, null, '/assets/photos/fellow-17.jpg', null),
  ('fellow-18', 'Sipho', 'Malawi', -13.9626, 33.7741, null, null, '/assets/photos/fellow-18.jpg', null),
  ('fellow-19', 'Tryphine', 'Zimbabwe', -17.8292, 31.0522, null, null, '/assets/photos/fellow-19.jpg', null),
  ('fellow-20', 'Mbene', 'Senegal', 14.7167, -17.4677, null, null, '/assets/photos/fellow-20.jpg', null),
  ('fellow-21', 'John', 'South Sudan', 4.8517, 31.5825, null, null, '/assets/photos/fellow-21.jpg', null),
  ('fellow-22', 'Zin', 'Maldives', 4.1755, 73.5093, null, null, '/assets/photos/fellow-22.jpg', null),
  ('fellow-23', 'Reesha', 'Maldives', 4.1755, 73.5093, null, null, '/assets/photos/fellow-23.jpg', null),
  ('fellow-24', 'Makeba', 'St Lucia', 14.0101, -60.9875, null, null, '/assets/photos/fellow-24.jpg', null),
  ('fellow-25', 'Ali Gaza', 'Palestine', 31.9038, 35.2034, null, null, '/assets/photos/fellow-25.jpg', null),
  ('fellow-26', 'Beesan', 'Palestine', 31.9038, 35.2034, null, null, '/assets/photos/fellow-26.jpg', null),
  ('fellow-27', 'Bernardo', 'Argentina', -34.6037, -58.3816, null, null, '/assets/photos/fellow-27.jpg', null),
  ('fellow-28', 'Toan', 'Vietnam', 21.0278, 105.8342, null, null, '/assets/photos/fellow-28.jpg', null),
  ('fellow-29', 'Zwi', 'Vietnam', 21.0278, 105.8342, null, null, '/assets/photos/fellow-29.jpg', null),
  ('fellow-30', 'Mariam', 'Sierra Leone', 8.4657, -13.2317, null, null, '/assets/photos/fellow-30.jpg', null),
  ('fellow-31', 'Isabella', 'Honduras', 14.0723, -87.1921, null, null, '/assets/photos/fellow-31.jpg', null),
  ('fellow-32', 'Maria Jose', 'Colombia', 4.711, -74.0721, null, null, '/assets/photos/fellow-32.jpg', null),
  ('fellow-33', 'Nayvi', 'Peru', -12.0464, -77.0428, null, null, '/assets/photos/fellow-33.jpg', null),
  ('fellow-34', 'Helena', 'Mozambique', -25.9692, 32.5732, null, null, '/assets/photos/fellow-34.jpg', null),
  ('fellow-35', 'Zaram', 'Nigeria', 9.0765, 7.3986, null, null, '/assets/photos/fellow-35.jpg', null);
