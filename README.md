# Constellation ✦

A farewell night-sky for the Ireland Fellows cohort at University of Galway.
Every fellow is a star; every home country a point of origin; the party is the
one night the whole constellation is visible at once.

**Four sections:** Arrivals (world map of star-clusters) · Sky Gallery
(pannable photo sky) · Star Chart (guess-the-fellow game with a live
leaderboard) · Trade Zone (the skills network that outlives the party).

## How it's built

- **Frontend** — plain HTML/CSS/JS (no build step), hosted on GitHub Pages.
- **The sky** — a Three.js WebGL starfield with a scroll-driven camera
  (nightfall gradient, Milky Way, shooting stars), with GSAP + ScrollTrigger
  for kinetic type and Lenis for inertia scrolling — all loaded from CDNs at
  runtime. Three experience tiers detected at load: full journey (desktop),
  simplified WebGL (mobile), and a static 2D-canvas sky (reduced motion,
  no WebGL, or low-end devices) with identical content and functionality.
  All content lives in the DOM in logical order — the 3D scene is
  presentation, never the only path to anything.
- **Data** — Supabase free tier: `fellows`, `leaderboard`, `skills_zone`
  tables, with realtime updates on the leaderboard for the projector view.
- **Demo mode** — until Supabase keys are added to `js/config.js`, the site
  runs entirely from `data/fellows-seed-data.json` + localStorage, so you can
  open it and play with everything immediately. Scores/skills just won't be
  shared between devices yet.

Run it locally with any static server from this folder, e.g.:

```bash
npx serve .
```

(Opening `index.html` directly with `file://` won't work — ES modules need a server.)

## URLs

| URL | What it is |
|---|---|
| `/` | the site (mobile-first — this is what the QR code points at) |
| `/?display=true` | projector view: cycles map → gallery → live leaderboard |
| `/?display=true&reveal=true` | projector view, opening straight onto the winner reveal |

On the projector view, press **R** to trigger the winner reveal on cue, and
**Esc** to go back to the cycle.

## Supabase setup (one-time, ~10 minutes)

1. **Create an account & project.** Go to [supabase.com](https://supabase.com)
   → *Start your project* → sign up (GitHub login is easiest). Create a new
   project: any name (e.g. `constellation`), a strong database password (you
   won't need it day-to-day — store it somewhere safe), and the **West EU
   (Ireland)** region. Wait ~2 minutes while it provisions.
2. **Create the tables and load the fellows.** In the left sidebar open
   **SQL Editor** → *New query*. Open [`supabase/schema.sql`](supabase/schema.sql)
   from this repo, paste the whole file in, and click **Run**. That single run
   creates all three tables, sets the security policies, turns on realtime for
   the leaderboard, and inserts all 35 placeholder fellows.
3. **Get your two keys.** Sidebar → **Project Settings** (gear icon) → **API**:
   - *Project URL* — looks like `https://abcdefgh.supabase.co`
   - *anon public* key — a long string starting `eyJ…`
4. **Paste them into [`js/config.js`](js/config.js).** The anon key is designed
   to be public — the SQL you ran restricts it to reading data and inserting
   scores/skills, nothing more.
5. **Check it worked.** Reload the site — the "demo mode" banner should be
   gone, and a score you submit should appear in Supabase under
   **Table Editor → leaderboard**.

**Swapping in real fellows later:** edit rows in **Table Editor → fellows**
(names, courses, fun facts), and drop real photos into `assets/photos/`
matching the `photo_url` filenames. Until a photo exists, the site shows a
gold-initials star instead, so missing photos never break anything.

**Editing the quiz:** all Galway lore / places / real-or-made-up questions
live in [`data/questions.json`](data/questions.json) — plain JSON, no code.
Each "Somewhere in Galway" question has a `photo` slot: drop an image into
`assets/quiz/` and put its path there to turn a text clue into a photo round.
Guess-the-fellow questions generate themselves from the fellows data.

## Deploying to GitHub Pages

1. Create a new repository on GitHub (e.g. `constellation`) — public, empty
   (no README/license, this folder already has them).
2. From this folder:

```bash
git init
```

```bash
git add -A
```

```bash
git commit -m "Constellation — Ireland Fellows farewell site"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/constellation.git
```

```bash
git push -u origin main
```

3. On GitHub: repo → **Settings → Pages** → under *Build and deployment*, set
   **Source** to *Deploy from a branch*, choose branch **main** and folder
   **/ (root)**, and save.
4. After a minute the site is live at
   `https://YOUR-USERNAME.github.io/constellation/`. That's the URL to put in
   the QR code; add `?display=true` for the laptop driving the projector.

Any later change is just commit + push — Pages redeploys automatically.

## Party-night checklist

- [ ] Real names/photos/facts swapped into Supabase & `assets/photos/`
- [ ] QR code printed (pointing at the Pages URL)
- [ ] Projector laptop open on `?display=true`, plugged in, sleep disabled
- [ ] Someone knows the **R** key triggers the winner reveal
