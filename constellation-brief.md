# Constellation — Ireland Fellows Farewell Site
### Handover brief for Claude Code

---

## 1. Concept

A night-sky / constellation site for the Ireland Fellows Programme cohort in Galway, built as their journey together wraps up. **Each fellow is a star. Their home country is where their light originated. The farewell party is the one night the whole constellation is visible at once.**

Everything in the design should reuse this visual language — stars, thin connecting lines, clusters — rather than treating the map, gallery, game, and directory as four unrelated pages.

**Scale:** ~35 fellows, ~15 countries, 20+ courses. Countries with multiple fellows should read as small clusters (a handful of stars linked by short lines), not just single dots — this is where the "constellation" idea actually pays off visually.

---

## 2. Site structure — four sections, one coherent world

### 2.1 Arrivals (hero + map)
- World map, dark field, each home country lights up as a star-cluster.
- Clusters sized/grouped by how many fellows are from that country.
- Click a cluster → expands to show the individual fellows inside it.
- Click a fellow → card with name, course/university, one-line "what I'll miss / what's next."
- Page load: constellation lines draw themselves in, like the sky assembling (the one orchestrated motion moment — see §4).

### 2.2 Sky Gallery (photos)
- Not a standard grid. Each fellow's photo sits inside a star-point on the same dark field.
- Circular crop, soft glow on hover/focus, subtle idle twinkle.
- Faint lines connect each photo-star back to its country-cluster from Arrivals — visually the same sky, zoomed in.
- Pannable/scrollable across the full "sky" rather than paginated.

### 2.3 Star Chart (the game)
- Timed rounds. Each clue is a fact (course detail, country detail, a fun personal fact) — the answer is **which fellow it is**. This merges "trivia" and "guess-the-fellow" into one mechanic rather than two separate games.
- Falling-star combo timer for the arcade feel: streak bonuses, speed bonuses.
- One score per player, submitted to a shared leaderboard.
- Winner (highest score, or top of leaderboard at party time) gets the prize — so the leaderboard needs to be visible/live at the party itself.

### 2.4 Trade Zone (the lasting piece)
- Each fellow logs 1–2 skills they can offer and 1 they're looking for.
- Renders as a searchable/filterable card grid.
- This is meant to outlive the party as a standing "help network," so it should read as a directory, not a game — calmer, more utilitarian than the other three sections, same palette.

---

## 3. Design tokens

**Palette**
| Role | Hex | Use |
|---|---|---|
| Deep space navy | `#0B1026` | primary background |
| Near-black indigo | `#050714` | depth layers / gallery background |
| Starlight gold | `#F2C879` | single accent — CTAs, active states, winner highlight |
| Cluster-line blue | `#5B7FDE` | constellation lines, secondary UI |
| Soft white | `#F5F3EE` | body text, star fill |

Avoid generic AI-design defaults: no warm-cream/terracotta, no acid-green-on-black, no broadsheet hairline-rule layout. This palette is a deliberate departure from those.

**Type**
- Display face: a characterful serif or slightly irregular face with an old star-atlas feel, for names and headlines. Used with restraint (headlines, fellow names, section titles only).
- Body/UI face: clean, highly legible sans — scores, instructions, directory text, form labels.
- Keep a clear type scale; don't let the display face bleed into UI chrome.

**Signature element**
The constellation lines: thin, slightly hand-drawn-feeling animated SVG paths connecting stars within a cluster. Reused across Arrivals, Sky Gallery, and even the leaderboard (e.g. top scorers linked by a faint line) so all four sections visually rhyme.

**Motion**
Restrained. Idle: slow ambient twinkle on stars. One orchestrated moment: lines draw themselves in on load/scroll. No scattered decorative animation elsewhere. Respect `prefers-reduced-motion`.

---

## 4. Data model

```
fellows
  id, name, country, lat, lng, course, university, photoUrl, funFact

leaderboard
  id, playerName, score, completedAt

skills_zone
  id, name, offering (array/text), seeking (array/text)
```

Seed with placeholder data (~35 rows spread across ~15 countries, 20+ courses) so the site is fully functional before real fellow data is added — real names/photos/courses to be swapped in later.

---

## 5. Hosting & architecture

- **Frontend:** static site (plain HTML/CSS/JS, or a lightweight framework if preferred) deployed on **GitHub Pages** — free, simple, no server to maintain.
- **Backend/persistence:** **Supabase** (free tier) for the `fellows`, `leaderboard`, and `skills_zone` tables. Needed because the leaderboard and Trade Zone must persist across many people using the site over several days, not just a single session — GitHub Pages alone can't do this since it can't run server-side code or store writes.
  - Supabase's realtime subscriptions are worth using for the leaderboard specifically, so the party-night projector view updates live as people submit scores from their phones.
- Alternative if preferred: Netlify or Vercel, which can host the static frontend *and* small serverless functions / a KV store in one place, avoiding the GitHub Pages + Supabase split. Either is fine — pick based on whichever the builder is more comfortable with.

**Two access modes:**
1. **Mobile (QR code)** — compact single-column layout, game playable one-handed, this is the primary way most fellows will interact with it.
2. **Display mode (`?display=true`)** — no controls, cycles Arrivals map → Sky Gallery → live leaderboard, meant for a projector/big screen at the party itself.

**Winner reveal:** the top of the Star Chart leaderboard is announced live at the party, so display mode needs a distinct "reveal" state — not just a static leaderboard, but a moment. Suggest: the winner's star brightens and pulls to the center of the constellation while their connecting lines redraw toward it, name and score animating in. Should be triggerable manually (a key press or a `?reveal=true` param) rather than firing automatically, since it needs to happen on cue during the party, not on a timer.

---

## 6. Build notes / constraints

- Mobile-first responsive throughout, not just the game.
- Visible keyboard focus states; reduced-motion respected.
- Cut anything decorative that doesn't serve the constellation concept — one signature move (the connecting lines), everything else disciplined.
- Copy should be written in plain, warm, first-person-cohort voice ("we," not "the system") — this is a farewell artifact from and for the group, not a product.
