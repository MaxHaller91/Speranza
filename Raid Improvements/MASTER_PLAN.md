# Raid System Overhaul — Master Plan

## Purpose

This folder is a staged implementation plan for improving raids in Speranza.

These docs are design plus implementation guidance, not a literal transcript of the live code. They must follow current project rules:

- Read the target file before editing it
- Prefer surgical edits over rewrites
- Keep `gameData.js` pure
- Keep `Speranza.jsx` as the game brain
- Keep `src/components/` props-only
- Keep `src/surface_defense.jsx` self-contained for minigame internals
- Never rely on stale line numbers without re-reading the file first

If any step conflicts with the real codebase, the codebase and `.clinerules/` files win.

---

## Design Intent

Every raid should begin as the surface-defense minigame. The older underground strike system should only matter if the surface layer fails and the hatch is breached.

The system should feel:

- tense and skill-expressive in the minigame
- meaningfully connected to the colony the player built
- scalable as the colony grows stronger

---

## Implementation Discipline For Every Step

Before touching code for any step in this folder:

1. Read the target files again
2. Verify the exact insertion point in the live file
3. Match existing patterns in that file
4. If the tick loop reads a new piece of state, add a ref mirror
5. Preserve known safeguards, especially delta-based `onScrapChange`
6. Do not move logic into UI components just because a doc says “render” something

Use these ownership rules:

- **`src/gameData.js`** → constants, pure helpers, named exports only
- **`src/Speranza.jsx`** → state, refs, tick-loop integration, handlers, derived values passed downward
- **`src/surface_defense.jsx`** → minigame-only entities, wave generation, projectiles, rendering, local lifecycle
- **`src/components/`** → props-only UI, no game logic

---

## Steps — In Order

| Step | Name | Primary Files | Goal |
|------|------|---------------|------|
| 1 | Bug Fixes & Debug Cleanup | `src/Speranza.jsx`, `src/surface_defense.jsx` | Stabilize the current raid flow before adding features |
| 2 | Flying Arc Units | `src/surface_defense.jsx` | Add air threats that bypass barricades |
| 3 | Sentry Post → Bunker Integration | `src/Speranza.jsx`, `src/surface_defense.jsx` | Make colony sentry staffing show up in the minigame |
| 4 | Wealth-Scaling Raids | `src/gameData.js`, `src/Speranza.jsx`, `src/surface_defense.jsx` | Make raid severity reflect colony success |
| 4B | Raid Cadence, Pause, and Prep Flow Polish | `src/Speranza.jsx`, `src/surface_defense.jsx` | Fix raid timing, cooldowns, pause behavior, and prep/countdown flow |
| 5 | New Defenses (Armory-Locked) | `src/Speranza.jsx`, `src/surface_defense.jsx` | **Deferred until a real building-upgrade system exists** |

---

## Step Summaries

### Step 1 — Bug Fixes & Debug Cleanup

Do the cleanup work first.

Main goals:

1. Ensure underground strike damage does not resolve while `surfaceDefenseActive` is running
2. Remove any remaining dev-only raid controls from the minigame UI
3. Remove dev-only restart behavior that can desync colony state and minigame state
4. Fix known raid-lifecycle bugs before layering on more mechanics

### Step 2 — Flying Arc Units

Add two flying enemies inside `src/surface_defense.jsx`:

- **Arc Drone**: fast, light air attacker with repeated hatch attack runs
- **Arc Gunship**: slow heavy air unit that suppresses defenses with splash rockets

### Step 3 — Sentry Post → Bunker Integration

Connect colony staffing to the minigame.

High-level flow:

- `Speranza.jsx` derives the number of active sentry workers from live colony state
- `Speranza.jsx` passes that value into `SurfaceDefense`
- `surface_defense.jsx` creates and manages the bunker using that prop
- if bunker destruction has colony consequences, `surface_defense.jsx` reports the event upward via callback and `Speranza.jsx` applies the colony-side state changes

### Step 4 — Wealth-Scaling Raids

Separate raid frequency from raid severity:

- heat still determines when raids happen
- wealth determines how dangerous they are

Ownership:

- wealth-calculation helpers belong in `gameData.js` if they can stay pure
- raid-trigger integration belongs in `Speranza.jsx`
- wave-density tuning inside the minigame belongs in `surface_defense.jsx`

### Step 4B — Raid Cadence, Pause, and Prep Flow Polish

This is the post-integration cleanup pass for raid pacing and player-facing flow.

Goals:

- prevent raids from firing immediately on a fresh game
- prevent back-to-back raids by adding at least a one-day cooldown
- keep heat as the raid-pressure system, but add a hard cooldown gate on raid-window creation
- pause the colony when a raid starts so the player gets setup time
- change the first prep button to **Start Raid**
- give the player a paused setup phase when a raid begins
- use a 10-second countdown between waves instead of indefinite manual starts
- audit/fix raid scrap display so minigame scrap cannot drift from colony scrap

Ownership:

- `Speranza.jsx` owns raid cooldowns, first-day grace, and pause-on-raid-start behavior
- `surface_defense.jsx` owns the prep/intermission countdown flow and raid scrap display behavior

Preferred implementation order inside this step:

1. add a raid cooldown gate to the heat → raid-window pipeline
2. pause colony time when surface defense activates
3. refactor wave flow to use Start Raid + 10-second inter-wave countdowns
4. audit and fix scrap sync so raid UI and colony scrap stay aligned

### Step 5 — New Defenses (Armory-Locked)

**Status: Deferred until the colony has a real building-upgrade system.**

Add two new placeable defenses:

- **Flak Battery** → dedicated anti-air response
- **EMP Cannon** → crowd-control / stun tool

Defense behavior and rendering live in `surface_defense.jsx`. Armory-derived unlock state is calculated in `Speranza.jsx` and passed down as a prop.

---

## Cross-Step Safety Rules

Across all five steps:

- Keep `onScrapChange` delta-based
- If the main tick loop reads a new value, mirror it through a ref
- Avoid broad refactors of `Speranza.jsx`
- Do not move colony logic into `surface_defense.jsx`
- Do not move minigame internals into UI components
- Re-check imports after any edit to `Speranza.jsx`
- When line numbers drift, use section/function names instead

---

## Suggested Execution Order

Implement in this order only:

1. Step 1
2. Step 2
3. Step 3
4. Step 4
5. Step 4B
6. Step 5 (only after building upgrades exist)

---

## What This Plan Does Not Change

- the shared scrap economy between colony and minigame
- the basic heat → raid window → raid launch pipeline
- the role of `handleSurfaceRaidWon` / `handleSurfaceRaidLost` as primary handoff points

If implementation reveals hidden lifecycle issues, fix those surgically before proceeding to the next step.
