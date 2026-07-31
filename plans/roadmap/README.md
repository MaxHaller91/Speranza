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

- [x] Start screen + pause-ownership consolidation — difficulty is now pickable
      on a first colony instead of only after dying once; five independent
      `setTimescale` callers reduced to one owner

### Next

**Step 9a (talent points) is pulled to the front**, out of numerical order. It is
not polish — the raid economy fix in `32e7bcc` correctly removed a broken reward
and left surviving a raid paying *nothing* (a clean win nets about −15 scrap).
9a closes that hole. 9b (2-D tower-defense placement) stays gated behind it and
behind a day-25 playtest.

Re-running the soak to a continuous day 25 (now possible on `settler`
difficulty) is also high value, but is a verification pass rather than a
roadmap step — see `HANDOFF.md` §4a.

- [ ] **Step 9a** — Talent points meta-currency · `09-talent-points-and-td-depth.md`
- [ ] **Step 2** — Wire the unused lore content · `02-wire-unused-lore.md`
- [ ] **Step 3** — UI scale pass for Steam · `03-ui-scale-pass.md`
- [ ] **Step 4** — Game-over as an obituary · `04-game-over-obituary.md`
- [ ] **Step 5** — Morale visible as behaviour · `05-morale-as-behaviour.md`
- [ ] **Step 7** — Variable room sizes (silhouette) · `07-variable-room-sizes.md`
- [ ] **Step 8** — Per-cell excavation (player-carved shape) · `08-per-cell-excavation.md`
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
