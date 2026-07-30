# Active Context

## Branch: `opus-5` (branched from `testing`) — 2026-07-30

Work in progress on gameplay depth and presentation. Four things landed:

**1. Colonist→room assignment is now the single source of truth.**
`cell.workers` used to be a standalone number with no link to *which* colonist
was in a room, so every removal path picked a random staffed room. Colonists now
own `assignedRoom`; `cell.workers` is a derived mirror maintained by a reconciler
effect. **Never write `cell.workers` directly** — set the colonist's
`assignedRoom` and let `pruneInvalidAssignments` / `reconcileGridWorkers` follow.
Colonists also have `previousRoom`, so they return to their post after shelter,
injury, expedition, or excavation.

**2. Animated colonist sprites** (`components/ColonistLayer.jsx`).
Canvas overlay with its own RAF loop — deliberately NOT React state, since
sprites move at 60fps while the sim ticks every 4s. `pointerEvents:"none"` so
grid clicks still work; hover is hit-tested against the shared `mousePos`.
The depth column doubles as the vertical access shaft. Dev sprite sheet at
`/Speranza/sprites.html` (excluded from the production build).

**3. Heat/raid rebalance.** Sentries mitigate a *percentage* of heat gain
(18% each, 60% cap) instead of a flat -5/tick that made one Sentry Post switch
raids off permanently. Raids roll every 8 ticks, not once at midnight. Post-raid
heat relief is proportional (35%), so heat cycles instead of pinning at max.

**4. Starvation is a process, not a cliff.** Empty stores start a clock —
warning, collapses at 6 ticks, deaths at 16 — and the run ends at zero
population. `FlowPanel` shows time-to-empty; `CrisisBanner` escalates.

### Rule learned the hard way: no side effects inside state updaters
`main.jsx` renders under `StrictMode`, which double-invokes updaters in dev.
The raid roll (`Math.random`, `setRaidWindow`, `addLog`, `addToast`) was inside a
`setHeat` updater, so it ran twice per tick — that was the long-standing
"raid toast fires twice" bug, misattributed to a missing dedupe guard. The
game-over check was inside a `setRes` updater for the same reason. Both moved out.

### Still open on this branch
- Base defense minigame depth (one verb: place a tower; difficulty cliff in `generateWave`)
- Expeditions have zero player input after launch
- `RAID_SIZES` is still duplicated between `gameData.js` and `surface_defense.jsx`

## Current Status
The codebase is in a **stable, build-passing state** after implementing DN-001 save/load foundations.

Latest completed implementation work:
- Header-level save controls added (save now, load autosave, export, import, delete autosaves)
- Mid-raid save gating implemented per policy (manual save/load/export/import/delete disabled while raid state is volatile)
- Midnight autosave implemented with deferral (if locked at midnight, autosave writes on first unlocked tick)
- Load/apply normalization forces volatile raid runtime state to safe idle values

Known issues are tracked in `memory-bank/progress.md` (this file previously saying "no known bugs" is obsolete).

## What Was Just Completed
**Phase 2 Refactor — UI Component Extraction**

Extracted 12 UI components from Speranza.jsx into `src/components/`. The refactor was done in two sessions:

Session 1 (Phase 2a–g) — Modals and overlays:
- SkyBackground, RaidBanner, GameOverModal, DilemmaModal, TraitPicker, BuildMenu, ToastPanel

Session 2 (Phase 2h–l) — Layout components:
- ColonyHeader, FlowPanel, ColonistRoster, ColonyGrid, SidePanel

**Line count reduction:** 3,829 → 1,827 lines in Speranza.jsx (52% reduction)

Prior to Phase 2, a critical **scrap doubling bug** was fixed in surface_defense.jsx:
- Root cause: `onScrapChange` was receiving initial scrap value instead of deltas
- Secondary cause: feedback loop from `initialScrap` being in the effect dependency array
- Fix: split effects, pass actual deltas (-cost, +reward, +bonus)

## What Is NOT Being Done Right Now
- Phase 3 (game system extraction) remains deferred — "don't push our luck"
- Surface defense lifecycle hardening issues are still open (see progress.md)
- No broad visual overhaul is in progress

## What's On the Horizon (When Dev Resumes)
Near-term likely follow-up:
- End-to-end runtime verification of save controls and lock states in active raid scenarios
- Additional save schema/version hardening if migration helpers are needed beyond v1 payloads

Longer-horizon ideas:
- Surface defense mechanics expansion (more tower types, etc.)
- Kingdom: New Lands-inspired surface engagement layer
- Additional room types / T2 buildings

## Working Patterns
Max prefers:
- Read the file first, always, before any edit
- Surgical edits over rewrites
- One thing at a time — verify it works before moving on
- Python scripts for complex multi-step file transformations (safer than sequential str_replace)
- Testing in browser before declaring anything "done"

## Important Context for Next Session
When resuming work:
1. Read this file and systemPatterns.md first
2. Check progress.md for known issues
3. Don't touch the refactored component interfaces without understanding the prop contracts
4. The surface_defense scrap delta bug is fixed — do not revert to absolute value passing
5. Save controls now intentionally lock during `raidWindow`, `activeRaid`, `surfaceDefenseActive`, and `pendingRaidSize`

## Documentation Alignment Work — 2026-03-26
- The `Raid Improvements/` planning docs were updated to follow current Speranza Cline rules instead of stale implementation assumptions.
- The docs now explicitly align with:
  - `gameData.js` for pure helpers/constants
  - `Speranza.jsx` for state, refs, tick-loop integration, and handlers
  - `surface_defense.jsx` for minigame internals
  - props-only components in `src/components/`
- Brittle line-number instructions were removed in favor of section/function-oriented guidance.
- The docs now tell future implementation work to verify live code assumptions first before editing.

## Step 1 Raid Stabilization Work — 2026-03-26
- Step 5 in `Raid Improvements/` is now explicitly deferred until a real building-upgrade system exists.
- Step 1 implementation work has started and the first bug-fix pass landed in live code.
- Confirmed code changes made this session:
  - removed fled-colonist ghost behavior by removing `raidFled` colonists from `colonists[]` instead of setting them back to idle
  - removed the visible post-win/post-loss RESTART button from `surface_defense.jsx`
  - added duplicate-loss-callback protection in `surface_defense.jsx`
  - added cleanup/tracking for delayed win/loss + message timeouts in `surface_defense.jsx`
- The underground strike suppression guard was already present in live `Speranza.jsx` when this session began and was intentionally left in place.
- The raid-size debug selector was already absent in live `surface_defense.jsx` when this session began.

## Raid Improvements Implementation Progress — 2026-03-26
- Step 2 implemented in `src/surface_defense.jsx`:
  - added flying enemy types (`drone`, `gunship`)
  - added drone attack-run behavior
  - added gunship rocket splash behavior
  - added flying-unit rendering and turret air-damage penalty
- Step 3 implemented across `src/Speranza.jsx` and `src/surface_defense.jsx`:
  - `Speranza.jsx` now derives `sentryWorkers`
  - `SurfaceDefense` now receives sentry worker count and renders a bunker
  - bunker destruction reports back to colony state and injures sentry workers
- Step 4 implemented across `src/gameData.js`, `src/Speranza.jsx`, and `src/surface_defense.jsx`:
  - added pure helpers `calcColonyWealth()` and `getWealthBracket()` to `gameData.js`
  - raid severity now uses colony wealth instead of only heat-state mapping
  - wealth bracket is passed into `SurfaceDefense` and scales wave density
- Production build passed after Steps 1–4 code changes.
- New planning follow-up added: **Step 4B — Raid Cadence, Pause, and Prep Flow Polish**.
- That step captures the newly reported issues around immediate raids, back-to-back raids, pause-on-start, Start Raid wording, 10-second inter-wave countdowns, and scrap UI sync.

## Flow Tooltip Accuracy Pass — 2026-03-26
- Updated the bottom `FlowPanel` hover tooltip so it no longer talks about nonexistent "modifiers."
- `Speranza.jsx` now passes through the real per-tick supply/demand source breakdowns for energy, food, water, and morale without injecting fake fallback lines into state.
- `FlowPanel.jsx` now labels the hover sections as **Supply** and **Demand** and uses neutral empty-state copy (`No supply this tick` / `No demand this tick`) only at render time.
- The tooltip footer continues to read from the same `net` breakdown value used to explain the hover lines, keeping the displayed per-tick amount internally consistent.
- `npm run build` passed after this change.
