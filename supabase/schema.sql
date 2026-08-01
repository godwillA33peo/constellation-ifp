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
  ('fellow-02', 'Rutendo Chikafu', 'Zimbabwe', -17.8292, 31.0522, 'MSc International Development', 'University of Galway', '/assets/photos/placeholder-02.jpg', 'Makes the accommodation block''s best sadza, no contest.'),
  ('fellow-03', 'Mwansa Mulenga', 'Zambia', -15.3875, 28.3228, 'MSc Agricultural Economics', 'University College Cork', '/assets/photos/placeholder-03.jpg', 'Negotiates group dinner bills like it''s a UN summit.'),
  ('fellow-04', 'Bwalya Kabwe', 'Zambia', -15.3875, 28.3228, 'MSc Statistics', 'University of Galway', '/assets/photos/placeholder-04.jpg', 'Owns exactly one raincoat and has never once needed a second.'),
  ('fellow-05', 'Ana Clara Ribeiro', 'Brazil', -15.7939, -47.8828, 'MSc Marine Science', 'University of Galway', '/assets/photos/placeholder-05.jpg', 'Swears the Atlantic at Salthill is ''basically Copacabana with extra character.'''),
  ('fellow-06', 'João Almeida', 'Brazil', -15.7939, -47.8828, 'MSc Renewable Energy', 'University of Limerick', '/assets/photos/placeholder-06.jpg', 'Started a five-a-side league that now has a written constitution.'),
  ('fellow-07', 'Valentina Suárez', 'Argentina', -34.6037, -58.3816, 'MA Journalism', 'Dublin City University', '/assets/photos/placeholder-07.jpg', 'Interviewed three Shop Street buskers ''for research.'' It became a podcast.'),
  ('fellow-08', 'Carlos Mejía', 'Honduras', 14.0723, -87.1921, 'MSc Water Resources Management', 'University College Dublin', '/assets/photos/placeholder-08.jpg', 'Rates every Galway shower against ''real rain back home.'' Galway is winning.'),
  ('fellow-09', 'Selamawit Bekele', 'Ethiopia', 9.03, 38.74, 'MSc Public Health', 'University College Cork', '/assets/photos/placeholder-09.jpg', 'Makes coffee properly, and has quietly judged everyone else''s kettle instant.'),
  ('fellow-10', 'Dawit Alemu', 'Ethiopia', 9.03, 38.74, 'MSc Climate Change', 'Maynooth University', '/assets/photos/placeholder-10.jpg', 'Keeps a running spreadsheet of every hostel he''s ever slept in.'),
  ('fellow-11', 'Camila Zambrano', 'Ecuador', -0.1807, -78.4678, 'MSc Biodiversity & Land Use', 'University of Galway', '/assets/photos/placeholder-11.jpg', 'Can name every bird on the Corrib. The swans have names now too.'),
  ('fellow-12', 'Santiago Vargas', 'Colombia', 4.711, -74.0721, 'LLM International Human Rights Law', 'University of Galway', '/assets/photos/placeholder-12.jpg', 'Won a moot court and celebrated with chips at the Spanish Arch, alone, at 4pm.'),
  ('fellow-13', 'Mariana Restrepo', 'Colombia', 4.711, -74.0721, 'MSc Health Psychology', 'Trinity College Dublin', '/assets/photos/placeholder-13.jpg', 'Runs a group-chat poll for every decision, including what to poll next.'),
  ('fellow-14', 'Wanjiru Kamau', 'Kenya', -1.2921, 36.8219, 'MSc Epidemiology', 'University of Galway', '/assets/photos/placeholder-14.jpg', 'Still undefeated at pool in the common room.'),
  ('fellow-15', 'Otieno Odhiambo', 'Kenya', -1.2921, 36.8219, 'MSc Data Analytics', 'Dublin City University', '/assets/photos/placeholder-15.jpg', 'Can recite the Premier League table from memory, unprompted.'),
  ('fellow-16', 'Deng Majok', 'South Sudan', 4.8517, 31.5825, 'MA Conflict Resolution', 'University of Limerick', '/assets/photos/placeholder-16.jpg', 'Tallest person in every cohort photo, and somehow always holding the flag.'),
  ('fellow-17', 'Achol Bol', 'South Sudan', 4.8517, 31.5825, 'MEd Education', 'Maynooth University', '/assets/photos/placeholder-17.jpg', 'Taught half the cohort to braid hair during one storm-cancelled weekend.'),
  ('fellow-18', 'Naledi Dlamini', 'South Africa', -25.7479, 28.2293, 'MSc Occupational Therapy', 'University College Cork', '/assets/photos/placeholder-18.jpg', 'Brought a braai to Salthill in January. It worked. Twice.'),
  ('fellow-19', 'Sipho Ndlovu', 'South Africa', -25.7479, 28.2293, 'MBA', 'University College Dublin', '/assets/photos/placeholder-19.jpg', 'Has a five-year plan and a backup five-year plan.'),
  ('fellow-20', 'Chisomo Banda', 'Malawi', -13.9626, 33.7741, 'MSc Food Security', 'University College Dublin', '/assets/photos/placeholder-20.jpg', 'Grows chillies on the windowsill against all Galway weather odds.'),
  ('fellow-21', 'Thandiwe Phiri', 'Malawi', -13.9626, 33.7741, 'MSc Nursing', 'University of Galway', '/assets/photos/placeholder-21.jpg', 'Has a playlist for every mood, including ''stats deadline panic.'''),
  ('fellow-22', 'Adaeze Okonkwo', 'Nigeria', 9.0765, 7.3986, 'MSc Biomedical Science', 'Royal College of Surgeons in Ireland', '/assets/photos/placeholder-22.jpg', 'Can spot a typo in a slide deck from across the room.'),
  ('fellow-23', 'Emeka Adeyemi', 'Nigeria', 9.0765, 7.3986, 'MSc Computer Science', 'Dublin City University', '/assets/photos/placeholder-23.jpg', 'Built a Discord bot to remind the group chat of assignment deadlines.'),
  ('fellow-24', 'Aminata Diallo', 'Senegal', 14.7167, -17.4677, 'MA Development Practice', 'Trinity College Dublin', '/assets/photos/placeholder-24.jpg', 'Organises every group trip down to the minute, unofficially.'),
  ('fellow-25', 'Aishath Naseem', 'Maldives', 4.1755, 73.5093, 'MSc Coastal & Marine Environments', 'University of Galway', '/assets/photos/placeholder-25.jpg', 'Points out, weekly, that her whole country sits lower than the Prom wall.'),
  ('fellow-26', 'Kereen Joseph', 'St Lucia', 14.0101, -60.9875, 'MA Public Advocacy & Activism', 'University of Galway', '/assets/photos/placeholder-26.jpg', 'Convinced the whole floor that soca beats trad. The session diplomatically disagrees.'),
  ('fellow-27', 'Lucía Quispe', 'Peru', -12.0464, -77.0428, 'MSc Rural Development', 'University College Dublin', '/assets/photos/placeholder-27.jpg', 'Calls every hill in Connemara ''a warm-up'' compared to home.'),
  ('fellow-28', 'Diego Huamán', 'Peru', -12.0464, -77.0428, 'MSc Civil Engineering', 'University of Galway', '/assets/photos/placeholder-28.jpg', 'Photographs bridges. Just bridges. Has 400 photos of the Salmon Weir.'),
  ('fellow-29', 'Linh Nguyen', 'Vietnam', 21.0278, 105.8342, 'MSc Finance', 'University College Dublin', '/assets/photos/placeholder-29.jpg', 'Brought her own rice cooker across three flights, no regrets.'),
  ('fellow-30', 'Minh Tran', 'Vietnam', 21.0278, 105.8342, 'MSc Cybersecurity', 'University of Limerick', '/assets/photos/placeholder-30.jpg', 'Has cycled every greenway within an hour of Galway.'),
  ('fellow-31', 'Rania Awad', 'Palestine', 31.9038, 35.2034, 'MSc Global Health', 'Trinity College Dublin', '/assets/photos/placeholder-31.jpg', 'Bakes knafeh for the whole floor whenever someone''s having a rough week.'),
  ('fellow-32', 'Yousef Hammad', 'Palestine', 31.9038, 35.2034, 'LLM International Law', 'University College Cork', '/assets/photos/placeholder-32.jpg', 'Can find a loophole in absolutely anything, including the seminar attendance policy.'),
  ('fellow-33', 'Amelia Cossa', 'Mozambique', -25.9692, 32.5732, 'MSc Gender, Globalisation & Rights', 'University of Galway', '/assets/photos/placeholder-33.jpg', 'Speaks four languages and mixes up words from all of them by Friday.'),
  ('fellow-34', 'Jose Machava', 'Mozambique', -25.9692, 32.5732, 'MSc Energy Systems Engineering', 'University of Limerick', '/assets/photos/placeholder-34.jpg', 'Built a tiny solar charger in the kitchen ''just to see if it''d work.'''),
  ('fellow-35', 'Hodan Warsame', 'Somalia', 2.0469, 45.3182, 'MSc Health Promotion', 'University of Galway', '/assets/photos/placeholder-35.jpg', 'Fastest walker in Galway. The Prom takes her twenty minutes, flat.');
