# Ireland Fellows — Galway '26 ✦

A farewell night-sky for the Ireland Fellows cohort at University of Galway.
**35 of us, 22 countries.** Every country is a point of light; the party is
the night the whole sky is visible at once.

**v4.2 note — no names, no photos, no flags.** Nothing on the public site
identifies an individual fellow: not a name, not a photo, not a flag image.
Countries are represented purely as colour (2–3 hues sampled from each flag,
stored as data — the flag itself is never drawn) and a fellow count. The one
exception is the Star Chart leaderboard, where a name is self-opted by the
player at the moment they finish a round — that's about them choosing to be
on a leaderboard, not the site displaying a roster.

**Four stops on the journey:** Arrivals (each country flashes its palette and
sends a quick streak of colour arcing to Galway — brisk, ~11 seconds for all
35, building Galway into one glow made of every colour) · Sky Gallery
(pannable, zoomable clusters of country-coloured light) · Star Chart (comet
timer, five round types — Somewhere in Galway, Guess the country, Galway
lore, Real or made up, and a palette-guessing round — with a live
leaderboard) · The Menu (an anonymous food/drink wishlist — vote for a
preset or add your own, ranked by votes).

Wordmark text is a one-line change in `js/config.js` (`WORDMARK` /
`PRELOADER_MARK`). The roster lives in `data/countries.json` — name, fellow
count, and colour palette per country, nothing else. The quiz lives in
`data/questions.json`.

## How it's built

- **Frontend** — plain HTML/CSS/JS (no build step), hosted on GitHub Pages.
- **The sky** — a Three.js WebGL starfield with a scroll-driven camera
  (nightfall gradient, aurora ribbons, Milky Way, shooting stars), with
  GSAP + ScrollTrigger for kinetic type and Lenis for inertia scrolling —
  all loaded from CDNs at runtime. Three experience tiers detected at load:
  full journey (desktop), simplified WebGL (mobile), and a static 2D-canvas
  sky (reduced motion, no WebGL, or low-end devices) with identical content
  and functionality. The background never intercepts pointer events or
  reacts to the cursor — it reacts to events (an Arrivals landing, a game
  streak, a Menu vote), not the mouse. All content lives in the DOM in
  logical order — the 3D scene is presentation, never the only path to
  anything.
- **Data** — Supabase free tier: `leaderboard` and `menu` tables only (see
  the v4.2 note above — there's no personal data to store). Realtime
  updates on the leaderboard for the projector view.
- **Demo mode** — until Supabase keys are added to `js/config.js`, scores
  and Menu votes save to localStorage on this device only. Everything else
  works immediately either way, since the roster is static JSON.

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
   project: any name, a strong database password (you won't need it
   day-to-day — store it somewhere safe), and the **West EU (Ireland)**
   region. Wait ~2 minutes while it provisions.
2. **Create the tables.** In the left sidebar open **SQL Editor** → *New
   query*. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo,
   paste the whole file in, and click **Run**. That creates the
   `leaderboard` and `menu` tables, sets the security policies, and turns on
   realtime for the leaderboard.
3. **Get your two keys.** Sidebar → **Project Settings** (gear icon) → **API**:
   - *Project URL* — looks like `https://abcdefgh.supabase.co`
   - *anon public* key — a long string starting `eyJ…`
4. **Paste them into [`js/config.js`](js/config.js).** The anon key is
   designed to be public — the SQL you ran restricts it to reading data,
   inserting scores/wishlist items, and incrementing vote counts, nothing
   more.
5. **Check it worked.** Reload the site — the "demo mode" banner should be
   gone, and a score you submit should appear in Supabase under
   **Table Editor → leaderboard**.

**Editing the roster:** edit [`data/countries.json`](data/countries.json)
directly — name, fellow count, and a 2–3 colour palette per country. No
Supabase table needed; it's static data, not user-generated.

**Editing the quiz:** all Galway lore / places / real-or-made-up questions
live in [`data/questions.json`](data/questions.json) — plain JSON, no code.
Each "Somewhere in Galway" question has a `photo` slot: drop an image into
`assets/quiz/` and put its path there to turn a text clue into a photo
round. Guess-the-country and palette-guessing questions generate themselves
from `data/countries.json`.

## Deploying to GitHub Pages

1. Create a new repository on GitHub — public, empty (no README/license,
   this folder already has them).
2. From this folder:

```bash
git init
```

```bash
git add -A
```

```bash
git commit -m "Ireland Fellows — Galway '26"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

```bash
git push -u origin main
```

3. On GitHub: repo → **Settings → Pages** → under *Build and deployment*, set
   **Source** to *Deploy from a branch*, choose branch **main** and folder
   **/ (root)**, and save.
4. After a minute the site is live at
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`. That's the URL to put in
   the QR code; add `?display=true` for the laptop driving the projector.

Any later change is just commit + push — Pages redeploys automatically.

## Party-night checklist

- [ ] Campus photos added for the "Somewhere in Galway" round
- [ ] QR code printed (pointing at the Pages URL)
- [ ] Projector laptop open on `?display=true`, plugged in, sleep disabled
- [ ] Someone knows the **R** key triggers the winner reveal
