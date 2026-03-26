# Plan: DN-001 Save / Load System
Generated: 2026-03-02 | Status: APPROVED FOR IMPLEMENTATION

## Decision Updates (User Confirmed)
- Autosave cadence: **once per in-game day at 00:00** (midnight), not every 10 ticks.
- Autosave retention: **3 rolling autosave slots**.
- Frontend flow: after loading screen, show a **main menu** with options: **New / Load / Continue / Help**.
- Save controls location: keep save actions continuously available in **`ColonyHeader`**.
- Raid safety policy: **no save/load actions during volatile raid phases** (`raidWindow`, `activeRaid`, `surfaceDefenseActive`, or `pendingRaidSize`).

## Finalized Raid-Safe Save Policy (v1)
To reduce lifecycle corruption risk in v1, save/load is explicitly gated during active or pending raid states.

### No-save periods
- `raidWindow` is active
- `activeRaid` is active
- `surfaceDefenseActive` is `true`
- `pendingRaidSize` is non-null

### Behavior during no-save periods
1. **Manual Save / Export Save** in `ColonyHeader`: disabled (clear reason text/tooltip).
2. **Load / Import** while in-run: disabled.
3. **Midnight autosave**: if midnight occurs during no-save period, autosave is deferred and written on the first safe tick after raid state clears.
4. **Load normalization safety**: imported/legacy payloads with live raid/minigame runtime state are normalized to a safe non-raid load state for v1.

## What We're Solving
Speranza currently loses all run progress on refresh. We want a save system that works on web first (GitHub Pages), is resilient to schema changes, and does not destabilize the tick loop. The target is a single canonical save format used by both autosave and file export/import, with migration support from day one.

## Current State Inventory

### Systems involved
- `src/Speranza.jsx` (all authoritative game state, tick loop, handlers, restart logic)
- `src/gameData.js` (constants, pure helpers, initial state factories)
- `src/components/ColonyHeader.jsx` (existing utility controls area: timescale, bug report)
- `src/components/SidePanel.jsx` (possible alternate location for save controls)
- `memory-bank/design-notes.md` (DN-001 constraints and goals)

### Relevant state currently owned in `Speranza.jsx`
- Core simulation: `tick`, `timescale`, `res`, `heat`, `morale`
- Colony state: `grid`, `unlockedRows`, `excavations`, `colonists`
- Raid/threat: `raidWindow`, `activeRaid`, `surfaceDefenseActive`, `pendingRaidSize`
- Progression: `unlockedTechs`, `surfaceHaul`, `expeditions`, `expeditionsCompleted`
- Narrative/history: `activeDilemma`, `firedDilemmas`, `recentDilemmaOutcomes`, `historyLog`, `memorial`
- UI/transient: `selected`, `buildMenu`, hover states, toast arrays, panel-open flags

### Existing code paths relevant to saves
- `downloadBugReport()` in `Speranza.jsx` already serializes a near-complete `fullState` payload (strong baseline)
- `handleRestart()` in `Speranza.jsx` shows complete reset/default state expectations
- `gameData.js` exports init factories (`initGrid`, `initColonists`, `INIT_RES`) and pure helpers suitable for migration defaults

### What currently works and must not break
- Tick loop ref-mirror pattern (stale closure prevention)
- Surface defense integration handoff (`raidWindow` → `activeRaid`/`surfaceDefenseActive`)
- Toast/pause behavior and overlay pause semantics
- Existing component props-only separation from `Speranza.jsx`

### Related known issues
- No save system (explicit known limitation)
- Several raid/surface-defense issues already queued; save restore must avoid worsening lifecycle consistency

## Files Affected
- `src/Speranza.jsx`
- `src/gameData.js`
- `src/components/ColonyHeader.jsx`

## Recommended Option: B — Moderate (Canonical Save Format + Autosave + File Import/Export)
Option B gives a robust v1 without over-architecting. It introduces schema versioning, validation, and migration now, while keeping implementation centralized in existing files and patterns. It avoids adding new major app structure but still prevents future save-breakage debt.

## What It Does
1. Define canonical save payload shape in pure helpers:
   - `saveVersion`, `savedAt`, `meta`, `state`
2. Add pure save helpers in `gameData.js`:
   - build payload from snapshot
   - validate payload shape
   - migrate payload by version
   - extract loadable state with defaults
3. Add persistence handlers in `Speranza.jsx`:
   - local autosave writer (every N ticks)
   - local load/clear handlers
   - file export (download `.speranza`)
   - file import (parse → validate → migrate → apply)
4. Add one controlled restore entrypoint in `Speranza.jsx`:
   - set authoritative states in safe order
   - reset/align refs after load
   - force `timescale = 0` on load for deterministic resume
5. Add minimal UI controls to `ColonyHeader.jsx`:
   - Load Autosave
   - Export Save
   - Import Save
   - Delete Autosave
6. Keep v1 conservative on transient UI state:
   - do not restore hover/selection/toasts/panel-open state
   - recompute transient display next tick

## What Could Go Wrong
- **Silent state/ref desync after load:** refs may briefly point at old values if restore order is wrong.
- **Raid lifecycle corruption on load:** loading mid-raid/minigame could duplicate callbacks or create impossible combinations.
- **Version drift bugs:** missing fields in old saves can load “successfully” but corrupt behavior unless migrations are strict.
- **Autosave churn:** writing too frequently can create performance noise and stale-overwrite edge cases.
- **Import trust issues:** malformed JSON may pass loose checks and poison state if validation is shallow.

## Critical Pass

### Over-complication check
- **Option A (minimal):** low complexity, no new architecture.
- **Option B (recommended):** introduces only schema/migration helpers and handlers; aligns with existing patterns.
- **Option C (comprehensive):** adds adapter layers/multi-slot/checkpoints and broader UI flows; highest architectural overhead.

### Blast radius check
- **Option A:** `Speranza.jsx` only.
- **Option B:** `Speranza.jsx`, `gameData.js`, `ColonyHeader.jsx` (moderate, bounded).
- **Option C:** adds more components/files and likely new module boundaries.

### Assumption check
- Assumes bug report `fullState` remains representative of authoritative run state.
- Assumes forcing load to paused (`timescale=0`) is acceptable UX.
- Assumes save controls in header are acceptable without dedicated modal flow.

### Minimal option check
- Option A can satisfy basic “do not lose progress” via local autosave only.
- It does **not** satisfy file backup/share and is weak against schema evolution.

### Silent breakage check
- Restored `colonists` status may not match `grid` worker counts in edge saves.
- Surface defense (`surfaceDefenseActive`, `pendingRaidSize`) may resume in inconsistent state.
- Milestone/trigger counters may double-fire if restored refs and state diverge for one tick.

### Open questions
- Whether to ship startup autosave prompt in v1 or defer.

## What Needs Your Decision Before Starting
1. ✅ **Mid-raid policy chosen:** disable save/load actions during raid/minigame windows and normalize loaded raid runtime state to safe non-raid values in v1.
2. ✅ **Autosave interval chosen:** once per in-game day at midnight.
3. ✅ **Autosave slots chosen:** 3 rolling snapshots.
4. ✅ **Startup behavior chosen:** add a main menu after loading screen (New / Load / Continue / Help).
5. ✅ **UI location chosen:** keep save controls in `ColonyHeader`.

## Options Considered

### Option A — Minimal
- **Changes:** `Speranza.jsx` only; localStorage autosave + load on boot; no file import/export; no formal migration layer.
- **Complexity:** ~2–3 hours.
- **Risk:** low blast radius, but technical debt on schema changes.
- **Doesn’t solve:** portable backups/sharing, robust version migration.

### Option B — Moderate (Recommended)
- **Changes:** `Speranza.jsx`, `gameData.js`, `ColonyHeader.jsx`; canonical format + validation + migration + autosave + file import/export.
- **Complexity:** ~4–7 hours.
- **Risk:** moderate, but controlled and future-safe.
- **Doesn’t solve:** advanced multi-slot UX, cloud/Tauri save adapters.

### Option C — Comprehensive
- **Changes:** broader save manager architecture, multi-slot UI, checkpointing, richer conflict handling, startup flow polish.
- **Complexity:** ~8–14 hours.
- **Risk:** higher blast radius and more opportunities for lifecycle regressions.
- **Doesn’t solve:** nothing major for scope, but likely overkill for immediate need.

## Do Not
- Do **not** move state ownership out of `Speranza.jsx`.
- Do **not** restore ephemeral UI state (hover/tooltips/toasts/open panels).
- Do **not** skip `saveVersion` + migration pipeline, even for v1.
- Do **not** auto-resume loaded runs at non-zero timescale.
- Do **not** introduce a new global state library for this feature.