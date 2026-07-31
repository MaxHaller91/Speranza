# Active Context

**This file describes what is true *now*.** History belongs in `progress.md` —
do not append session logs here. If something here is stale, rewrite it.

Entry point for a fresh session: **`HANDOFF.md`** at the repo root.

## Branch: `opus-5` (branched from `testing`) — current as of 2026-07-31

### The three rules

**1. Never write `cell.workers` directly.** Colonists own `assignedRoom`;
`cell.workers` is a derived mirror maintained by a reconciler effect. Set the
colonist and let `pruneInvalidAssignments` / `reconcileGridWorkers` follow.
Before this, every "remove a worker" path picked a *random* staffed room — a
raid could injure someone in Hydroponics and dock a worker from the Armory.

**2. No randomness or side effects inside state updaters.** `main.jsx` renders
under `StrictMode`, which double-invokes updaters in development. Decide first,
keep the updater a pure transform, run effects after. This one mistake caused
raid toasts firing twice (misblamed on a missing dedupe guard for months),
level-ups logging twice, and every expedition resolving twice per tick with
different outcomes. Audit script is in `plans/MASTER_ROADMAP.md`; it must
report `0`.

**3b. Never call `setTimescale` to pause.** The clock is derived: `speed` is the
player's choice, `manualPause` is their toggle, and `pauseReason` lists
everything that blocks the clock. To add a blocking overlay, add one line to
`pauseReason` in `Speranza.jsx`. Five callers used to write `timescale`
independently and silently undo each other.

**3. The tick loop reads refs, never state.** The interval has `[timescale]`
deps, so every piece of state it touches needs a ref mirror kept in sync by its
own effect. Commit expedition state and update `expeditionsRef.current` in the
same breath, or the next tick reads stale data.

### What landed on this branch

Colonist→room assignment model · animated colonist sprites
(`components/ColonistLayer.jsx`, canvas + its own RAF loop, deliberately not
React state) · heat/raid rebalance (sentries mitigate a *percentage*, raids roll
every 8 ticks) · starvation as a survivable process with a visible countdown ·
StrictMode purity sweep across 11 sites · base-defense depth (upgrade, repair,
sell, EMP, budget-driven wave curve) · expeditions phases 1–2 (pure advancement
transition, destinations, manual crew) · room adjacency + colony naming · two
playtest bug passes, ten fixes total · production-build soak harness
(`npm run soak`, `window.__speranza`, `state.pauseCause`) · **difficulty
options** (roadmap step 6): `DIFFICULTIES` in `gameData.js` — settler /
survivor / condemned — scaling heat gain, raid frequency, raid wave budget,
raid cooldown, and (a fourth lever beyond the original plan) morale drain.
Chosen on the game-over "NEW COLONY" screen, persists in the save, shown on
the header and game-over screen. Details and a bug found+fixed during
verification: `memory-bank/progress.md` under "Difficulty Options".

Commit-by-commit detail: `plans/roadmap/README.md`.

### Still open

Ordered queue with a detail doc per step: **`plans/roadmap/README.md`**.
Highest-value open threads, with reasoning: **`HANDOFF.md` §4**.

Short version — re-run the long playtest to a continuous day 25 now that
difficulty options exist (not yet re-run), resources being floats at the source,
roadmap steps 2, 3, 4, 5, 7–9b, expeditions phases 3–6, and the Arc Raiders IP
rename before any store page exists.

Roadmap 9a (talent points) is **done**: Resolve is earned only by winning
raids, spent on 8 permanent talents, and lives in its own `speranza_meta`
localStorage key so it survives losing a colony and is not carried by run saves.

Pause ownership is **done** — see rule 3b above and `HANDOFF.md` §4c.

## Working patterns

Max prefers:
- Read the file first, always, before any edit
- Surgical edits over rewrites
- One thing at a time — verify it works before moving on
- Python scripts for complex multi-step file transformations (safer than
  sequential str_replace); print ASCII only, `cp1252` will throw on emoji and
  can kill the script *before* it writes
- Testing in the browser before declaring anything "done"

## Do not

- Touch refactored component prop contracts without reading them first
- Revert `surface_defense.jsx` scrap handling to absolute values — it passes
  deltas, and the absolute version caused a scrap-doubling bug
- Unlock save controls during `raidWindow`, `activeRaid`, `surfaceDefenseActive`,
  or `pendingRaidSize` — the lock is deliberate, raid state is volatile
- Start roadmap steps 7–8 unattended; they touch excavation, build validation,
  the mortise SVG, and sprite pathing at once
