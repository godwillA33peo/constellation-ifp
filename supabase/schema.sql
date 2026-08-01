-- ============================================================
-- Constellation — Supabase schema + seed data
-- Run this ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → paste everything → Run
-- Safe to re-run: it drops and recreates the three tables.
-- ============================================================

drop table if exists public.fellows cascade;
drop table if exists public.leaderboard cascade;
drop table if exists public.skills_zone cascade;

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

-- one row per Trade Zone entry
create table public.skills_zone (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  offering   text[] not null default '{}',
  seeking    text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security: the public anon key may READ everything,
-- and INSERT scores/skills within sane limits. Nothing else —
-- no updates, no deletes, no editing fellows from the browser.
-- ------------------------------------------------------------

alter table public.fellows     enable row level security;
alter table public.leaderboard enable row level security;
alter table public.skills_zone enable row level security;

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

create policy "anyone can read skills"
  on public.skills_zone for select using (true);

create policy "anyone can log a skill"
  on public.skills_zone for insert
  with check (
    char_length(name) between 1 and 60
    and array_length(offering, 1) between 1 and 2
  );

-- live leaderboard on the party-night projector
alter publication supabase_realtime add table public.leaderboard;

-- ------------------------------------------------------------
-- Seed: 35 placeholder fellows (swap in real details later,
-- either here or directly in Dashboard → Table Editor → fellows)
-- ------------------------------------------------------------

insert into public.fellows
  (id, name, country, lat, lng, course, university, photo_url, fun_fact)
values
  ('fellow-01', 'Tendai Moyo', 'Zimbabwe', -17.8292, 31.0522, 'MSc Health Data Science', 'University of Galway', '/assets/photos/placeholder-01.jpg', 'Has an opinion about every Stan warning message you''ve ever ignored.'),
  ('fellow-02', 'Rutendo Chikafu', 'Zimbabwe', -17.8292, 31.0522, 'MSc International Development', 'NUI Galway', '/assets/photos/placeholder-02.jpg', 'Makes the accommodation block''s best sadza, no contest.'),
  ('fellow-03', 'Farai Nyathi', 'Zimbabwe', -17.8292, 31.0522, 'LLM International Law', 'Trinity College Dublin', '/assets/photos/placeholder-03.jpg', 'Once argued a parking ticket down to a warning, purely on technicalities.'),
  ('fellow-04', 'Wanjiru Kamau', 'Kenya', -1.2921, 36.8219, 'MSc Public Health', 'University College Cork', '/assets/photos/placeholder-04.jpg', 'Still undefeated at pool in the common room.'),
  ('fellow-05', 'Otieno Odhiambo', 'Kenya', -1.2921, 36.8219, 'MSc Renewable Energy', 'University of Limerick', '/assets/photos/placeholder-05.jpg', 'Can recite the Premier League table from memory, unprompted.'),
  ('fellow-06', 'Achieng Auma', 'Kenya', -1.2921, 36.8219, 'MSc Epidemiology', 'University of Galway', '/assets/photos/placeholder-06.jpg', 'Tried to learn Irish in a week. It did not go well.'),
  ('fellow-07', 'Chisomo Banda', 'Malawi', -13.9626, 33.7741, 'MSc Food Security', 'University College Dublin', '/assets/photos/placeholder-07.jpg', 'Grows chillies on the windowsill against all Galway weather odds.'),
  ('fellow-08', 'Thandiwe Phiri', 'Malawi', -13.9626, 33.7741, 'MEd Education', 'Maynooth University', '/assets/photos/placeholder-08.jpg', 'Has a playlist for every mood, including ''stats deadline panic.'''),
  ('fellow-09', 'Mwansa Mulenga', 'Zambia', -15.3875, 28.3228, 'MSc Agricultural Economics', 'University College Cork', '/assets/photos/placeholder-09.jpg', 'Negotiates group dinner bills like it''s a UN summit.'),
  ('fellow-10', 'Bwalya Kabwe', 'Zambia', -15.3875, 28.3228, 'MSc Statistics', 'University of Galway', '/assets/photos/placeholder-10.jpg', 'Owns exactly one raincoat and has never once needed a second.'),
  ('fellow-11', 'Nakato Namuli', 'Uganda', 0.3476, 32.5825, 'MA Development Practice', 'Trinity College Dublin', '/assets/photos/placeholder-11.jpg', 'Photographs every single sunset over the Corrib.'),
  ('fellow-12', 'Ssenyonga Musoke', 'Uganda', 0.3476, 32.5825, 'MSc Data Analytics', 'Dublin City University', '/assets/photos/placeholder-12.jpg', 'Debugged a classmate''s R script over a phone call from the bus.'),
  ('fellow-13', 'Nabirye Kobusingye', 'Uganda', 0.3476, 32.5825, 'MSc Environmental Engineering', 'University of Limerick', '/assets/photos/placeholder-13.jpg', 'Has strong, specific opinions about the correct way to make chapati.'),
  ('fellow-14', 'Amani Mushi', 'Tanzania', -6.163, 35.7516, 'MSc Global Health', 'University of Galway', '/assets/photos/placeholder-14.jpg', 'Can spot a typo in a slide deck from across the room.'),
  ('fellow-15', 'Neema Kileo', 'Tanzania', -6.163, 35.7516, 'MSc Biomedical Science', 'Royal College of Surgeons in Ireland', '/assets/photos/placeholder-15.jpg', 'Runs every morning regardless of what the Galway sky is doing.'),
  ('fellow-16', 'Selamawit Bekele', 'Ethiopia', 9.03, 38.74, 'MSc Water Resources Management', 'University College Dublin', '/assets/photos/placeholder-16.jpg', 'Makes coffee properly, and has quietly judged everyone else''s kettle instant.'),
  ('fellow-17', 'Dawit Alemu', 'Ethiopia', 9.03, 38.74, 'MSc Climate Change', 'Maynooth University', '/assets/photos/placeholder-17.jpg', 'Keeps a running spreadsheet of every hostel he''s ever slept in.'),
  ('fellow-18', 'Hiwot Tesfaye', 'Ethiopia', 9.03, 38.74, 'MA Human Rights', 'Trinity College Dublin', '/assets/photos/placeholder-18.jpg', 'Has read every book on the cohort''s shared shelf, twice.'),
  ('fellow-19', 'Kwame Asante', 'Ghana', 5.6037, -0.187, 'MBA', 'University College Cork', '/assets/photos/placeholder-19.jpg', 'Has a five-year plan and a backup five-year plan.'),
  ('fellow-20', 'Abena Owusu', 'Ghana', 5.6037, -0.187, 'MSc Nursing', 'University of Galway', '/assets/photos/placeholder-20.jpg', 'Adopted a stray cat outside the library and it now waits for her daily.'),
  ('fellow-21', 'Kofi Mensah', 'Ghana', 5.6037, -0.187, 'MSc Computer Science', 'Dublin City University', '/assets/photos/placeholder-21.jpg', 'Will absolutely beat you at FIFA and will absolutely mention it after.'),
  ('fellow-22', 'Mariama Kamara', 'Sierra Leone', 8.4657, -13.2317, 'MSc Social Work', 'University College Dublin', '/assets/photos/placeholder-22.jpg', 'Organises every group trip down to the minute, unofficially.'),
  ('fellow-23', 'Ibrahim Sesay', 'Sierra Leone', 8.4657, -13.2317, 'MSc Public Health', 'University of Galway', '/assets/photos/placeholder-23.jpg', 'Never misses five-a-side, rain, sleet, or deadline.'),
  ('fellow-24', 'Amelia Cossa', 'Mozambique', -25.9692, 32.5732, 'MSc International Development', 'University of Limerick', '/assets/photos/placeholder-24.jpg', 'Speaks four languages and mixes up words from all of them by Friday.'),
  ('fellow-25', 'Jose Machava', 'Mozambique', -25.9692, 32.5732, 'MSc Renewable Energy', 'University College Cork', '/assets/photos/placeholder-25.jpg', 'Built a tiny solar charger in the kitchen ''just to see if it''d work.'''),
  ('fellow-26', 'Palesa Mokoena', 'Lesotho', -29.3142, 27.4833, 'MSc Food Security', 'University of Galway', '/assets/photos/placeholder-26.jpg', 'Knits during every single seminar and somehow still takes better notes than anyone.'),
  ('fellow-27', 'Thabo Ramaema', 'Lesotho', -29.3142, 27.4833, 'MA Human Rights', 'Trinity College Dublin', '/assets/photos/placeholder-27.jpg', 'Has a laugh you can hear from two rooms away.'),
  ('fellow-28', 'Linh Nguyen', 'Vietnam', 21.0278, 105.8342, 'MSc Data Analytics', 'University of Galway', '/assets/photos/placeholder-28.jpg', 'Brought her own rice cooker across three flights, no regrets.'),
  ('fellow-29', 'Minh Tran', 'Vietnam', 21.0278, 105.8342, 'MSc Climate Change', 'Maynooth University', '/assets/photos/placeholder-29.jpg', 'Has cycled every greenway within an hour of Galway.'),
  ('fellow-30', 'Sopheak Chan', 'Cambodia', 11.5564, 104.9282, 'MSc Water Resources Management', 'University College Dublin', '/assets/photos/placeholder-30.jpg', 'Draws a small comic strip of each seminar and shares it in the group chat.'),
  ('fellow-31', 'Bopha Sok', 'Cambodia', 11.5564, 104.9282, 'MSc Statistics', 'University of Galway', '/assets/photos/placeholder-31.jpg', 'Once explained a p-value using a bag of Tayto. It worked.'),
  ('fellow-32', 'Rania Awad', 'Palestine', 31.9038, 35.2034, 'MSc Global Health', 'Trinity College Dublin', '/assets/photos/placeholder-32.jpg', 'Bakes knafeh for the whole floor whenever someone''s having a rough week.'),
  ('fellow-33', 'Yousef Hammad', 'Palestine', 31.9038, 35.2034, 'LLM International Law', 'University College Cork', '/assets/photos/placeholder-33.jpg', 'Can find a loophole in absolutely anything, including the seminar attendance policy.'),
  ('fellow-34', 'Somchai Vong', 'Laos', 17.9757, 102.6331, 'MSc Agricultural Economics', 'University of Limerick', '/assets/photos/placeholder-34.jpg', 'Keeps a small notebook of every Irish idiom that''s confused him so far.'),
  ('fellow-35', 'Kham Southavong', 'Laos', 17.9757, 102.6331, 'MSc Computer Science', 'Dublin City University', '/assets/photos/placeholder-35.jpg', 'Built a Discord bot to remind the group chat of assignment deadlines.');
