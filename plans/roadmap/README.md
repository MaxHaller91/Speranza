# Speranza Roadmap

Branch `opus-5`. Tick items off as they land. **Read `../MASTER_ROADMAP.md`
first** — it contains two invariants that, if broken, silently corrupt the game.

## The two rules that matter most

1. **Never write `cell.workers` directly.** It is derived from colonist
   `assignedRoom`. Change the colonist, let the reconciler follow.
2. **Never put randomness or side effects inside a state updater.** `StrictMode`
   double-invokes them in dev. Audit script is in `../MASTER_ROADMAP.md`; it must
   report `0`.

---

## Progress

### Done
- [x] Colonist→room assignment as single source of truth — `1d18fef`
- [x] Animated colonist sprites walking to assigned modules — `1109176`
- [x] Heat/raid rebalance + starvation as a survivable process — `423dae8`
- [x] All randomness/side effects out of state updaters (11 sites) — `8a8e879`
- [x] Base defense minigame: upgrade/repair/sell/EMP, budget wave curve — `6d75ac2`
- [x] Expeditions phase 1 — pure advancement transition — `0a6fdac`
- [x] Expeditions phase 2 — destinations + manual crew — `8829d88`
- [x] **Step 1** Room adjacency + colony naming — `fb99027`
- [x] Playtest bug pass — 8 fixes — `32e7bcc`
- [x] **Step 6** Difficulty options (settler/survivor/condemned; heat, raid,
      wave-budget, raid-cooldown, and morale-drain multipliers) — `d9cc056`,
      see `memory-bank/progress.md` "Difficulty Options" for the fourth-lever
      rationale and a NaN bug found+fixed during verification

- [x] **Step 9a** — Talent points: Resolve earned only by repelling raids,
      spent on 8 permanent talents that modify existing pure helpers. Meta
      progression survives colony death (own localStorage key, not the run save)
- [x] Start screen + pause-ownership consolidation — difficulty is now pickable
      on a first colony instead of only after dying once; five independent
      `setTimescale` callers reduced to one owner
- [x] Floats fixed at source + Traders wired — **Step 2a**
- [x] Artifacts wired, plus a level-up announcement bug it exposed — **Step 2b**
- [x] Colony Directives wired — **Step 2c**: 7 toggleable standing orders
      (`DIRECTIVES` in `speranza-lore.js`), max 3 active, gated on a built
      Research Lab, mechanics in `directiveEffects()`/`DIRECTIVE_MECHANICS`
      (`gameData.js`). See `memory-bank/progress.md` "Colony Directives" for the
      in-browser numeric verification.

## Claiming work (read this before starting anything)

Two agents share this queue: an interactive session and a scheduled run that
fires every 5 hours. They have already picked the same step at the same time
once.

**Before starting a step, claim it**: add `— CLAIMED <agent> <date>` to its line
below, commit that single change, and push. If a step is already claimed and the
claim is under 24h old, pick the next unclaimed one instead. Release a claim by
ticking the item off when you land it, or by removing the marker if you abandon
it.

A claim is one commit touching one line. It costs seconds and it prevents two
agents writing the same file.

### Next

Step 2 is one sub-step from done: **2d, Arc Commanders**, is the last unwired
lore export (`COMMANDER_NAMES`/`COMMANDER_WEAKNESSES`/`COMMANDER_STRENGTHS`).
It is the biggest of the four per `02-wire-unused-lore.md` — do it on its own,
not bundled with something else.

Also still open: **re-run the long playtest to a continuous day 25**. It is a
verification pass rather than a roadmap step (see `HANDOFF.md` §4a) and is
expensive to run unattended — the harness has to answer dilemmas, trait picks,
*and* play the real-time canvas raid minigame, none of which can be scripted as
cheaply as the dev-hook actions used to verify Directives. Both mechanical
blockers (difficulty options, single clock owner) are gone; what is missing is
an interactive harness or a human playtest session.

9b (2-D tower-defense placement) stays gated behind that day-25 playtest.

- [ ] **Step 3** — UI scale pass for Steam · `03-ui-scale-pass.md`
- [ ] **Step 4** — Game-over as an obituary · `04-game-over-obituary.md`
- [ ] **Step 5** — Morale visible as behaviour · `05-morale-as-behaviour.md`
- [ ] **Step 7** — Variable room sizes (silhouette) · `07-variable-room-sizes.md`
- [ ] **Step 8** — Per-cell excavation (player-carved shape) · `08-per-cell-excavation.md`
- [ ] **Step 10** — Sustained pressure: the colony is currently solved once
      hydro + water are staffed · `10-sustained-pressure.md`
- [ ] **Step 9b** — 2-D tower-defense placement (gated) · `09-talent-points-and-td-depth.md`
- [ ] Expeditions phases 3–6 · `../expedition-decisions-v2.md`
- [ ] IP rename pass — see below

---

## IP rename (do before any store page)

The fiction is currently lifted from Arc Raiders: the enemy faction is "the
Arc", resources are "Arc Tech", buildings are "Arc Turret" / "EMP Array", and
`README.md` describes the game as set "in the Arc Raiders universe".

This is a commercial risk, and it is cheap to fix now and expensive later
(store page, trailer, wishlists all bake the name in). It is almost entirely
strings in `speranza-lore.js`, `gameData.js`, and the component copy. Pick a new
antagonist name and do a mechanical find/replace pass.

"Speranza" itself is fine to keep or change — it is now the *default* colony
name, and the player can rename it.

---

## Order rationale

Adjacency came first because it makes position mean something, and everything
visual after it (room sizes, carved silhouettes) is more interesting once
position matters. Building shape onto an inert grid would have been decoration.

Steps 7 and 8 are the big structural ones — they are deliberately last because
they touch excavation, build validation, the mortise SVG, and sprite pathing all
at once. Do not start them mid-session.
