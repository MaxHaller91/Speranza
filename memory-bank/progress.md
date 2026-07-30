# Progress

## What Works ✅

### Core Game Loop
- [x] Tick system with timescale controls (pause, 0.5×, 1×, 2×, 4×, 10×)
- [x] 4×7 grid with excavation system (row unlocks via dig)
- [x] Room building (click empty cell → build menu → place room)
- [x] Worker assignment (dots on room cells, +/- buttons in side panel)
- [x] Resource production/consumption per tick per worker
- [x] Resource bars with visual fill indicators (energy, food, water, scrap, RP)
- [x] Net flow display (FlowPanel) with hover breakdown tooltips
- [x] Population cap via Barracks rooms
- [x] Colonist recruitment

### Colonist System
- [x] Named colonists with backstories and quirks
- [x] Status tracking (idle, working, injured, sheltered, onExpedition)
- [x] XP and leveling (20 XP per level)
- [x] Trait system (permanent perks on level-up)
- [x] Injury and healing (hospital, nurse workers, tick countdown)
- [x] Memorial wall (fallen colonists recorded with epitaphs)

### Threat & Raids
- [x] Heat meter (builds from rooms, expeditions, conditions)
- [x] Sentry post heat reduction
- [x] Raid window system (warning banner before raid launches)
- [x] Radio tower (identifies incoming raid size)
- [x] Barricades tech (% chance to block raids)
- [x] Surface defense minigame (tower defense, turret placement)
- [x] Scrap delta bug fixed (no more doubling)
- [x] Raid flash (red outline on container during active raid)
- [x] Colonist casualties during raids

### Expeditions
- [x] Armory room + armed armorer unlocks expeditions
- [x] Duration picker (20/40/60/80 ticks)
- [x] Multiple expedition types (scavenge, recon, etc.)
- [x] Live expedition panels with progress bars and event log
- [x] Loot accumulation (scrap, salvage, arc tech, survivor)
- [x] Surface haul display in header

### Progression
- [x] T2 technology tree (research lab + RP)
- [x] Dilemma events (branching choice modals)
- [x] Milestone system (achievements that trigger toasts)
- [x] Surface conditions (affect production, radio tower, heat)
- [x] Shelter system (alarm → all colonists safe but unproductive)
- [x] History log and game over screen with run code

### Visual Systems
- [x] Day/night sky cycle (SkyBackground — gradient, stars, sun/moon arc)
- [x] Earth texture mortise overlay (ColonyGrid SVG — rooms carved from earth)
- [x] Building sprites (pixelated interior art where defined, emoji fallback)
- [x] Colonist hover tooltips (follow mouse, zIndex 9999)
- [x] Room hover tooltips (production info, worker count)
- [x] Build menu hover tooltips (cost, requirements, sprite preview)
- [x] Raid pulse animation (CSS keyframe on raid banner)
- [x] Toast notification system (auto-pauses game, dismiss to resume)
- [x] Milestone toast (gold, fixed center screen)

### Code Quality
- [x] Phase 1 refactor: gameData.js extracted (constants + helpers)
- [x] Phase 2 refactor: 12 UI components extracted to /components/
- [x] Surface defense bug fixed (scrap delta, effect isolation)
- [x] DN-001 save/load foundations implemented (autosave ring, header controls, export/import, raid-safe load normalization)
- [x] Mid-raid save gating implemented (save/load/export/import/delete disabled during volatile raid states)

## Playtest Bug Pass — 2026-07-30 (opus-5)

Found by playing the game to Day 8 with an automated anomaly observer, plus a
follow-up player report. All fixed:

- **Starvation deaths displayed as "left"** — deprivation deaths were tagged
  `moraleDeath`, which fell through to the memorial's generic "Left the colony".
  Now `starved` / `thirst` with their own epitaph pools and labels.
- **Milestones could fire twice** — the guard read `firedMilestonesRef`, which
  only syncs via an effect. `checkMilestones` is called from the tick loop AND
  raid-end, so two calls in one tick both saw a stale ref. Ref now updates
  synchronously at the point of firing.
- **Population cap bypass** — expedition survivors and dilemma `recruitFree`
  both added colonists without checking `popCap` (only the RECRUIT button did).
  Observed 6/5. Both now check.
- **Colony Log paused the game indefinitely** — `journalOpen` / `effectsOpen`
  were in the overlay-pause set, so opening a read-only side panel froze the
  colony with no visible cause. Removed; they no longer pause.
- **Losing a raid was indistinguishable from winning** — the minigame simply
  vanished and scrap went UP. Now flashes, sounds, and posts an explicit
  breach toast naming how many ticks of strikes are incoming.
- **Raid economy was broken** — every kill reward and wave bonus was forwarded
  into colony scrap, paying ~685 (medium) / ~1289 (large) whether you won or
  lost. Raids were the most profitable activity in the game. The minigame now
  runs on a committed DEFENSE BUDGET; the colony pays up front and receives a
  bounded salvage per wave cleared. Clean win ~ -15 scrap, loss ~ -90.
- **`SCRAP: 212.99999999999994`** — raw float in the minigame header, now rounded
  and relabelled BUDGET.
- **Volume slider did not affect sound effects** — `applySfxVolume()` pinned SFX
  to a constant with the comment "music slider only controls background music",
  and the old mute button no longer exists in the UI. Setting 0% silenced music
  but left alert dings at full volume with no way to stop them. The slider now
  governs music and SFX, and 0 means silent.

## Known Issues / Limitations ⚠️

### Save System Validation Pending
DN-001 foundations are now in place, but full runtime QA is still pending (especially raid lock-state UX, autosave defer timing, and import/load edge-case handling).

### Grid is Hardcoded
4 rows × 7 columns. Changing this would require updates in ColonyGrid, all row-based excavation logic, and possibly surface defense positioning.

### No Sound Sprites for Some Events
Some game events may not have corresponding sounds yet. The sounds.js file has the functions but some may be stubs.

### Sprite Coverage
Not all room types have custom sprites. Rooms without `def.sprite` fall back to emoji + colored background, which is less impressive visually.

### Memorial Panel Visible Without Building
The memorial side panel is accessible without the memorial building being built.

### Game Over Screen — Colonist Levels Incorrect
Colonist levels are not displaying correctly on the game over screen.

### Surface Defense — Incomplete Integration with Main Raid System
The surface defense minigame (`surface_defense.jsx`) is not fully integrated with Speranza's raid lifecycle.

~~1. Raid toast notification fires twice in the same tick when a raid launches — likely no deduplication guard on the announcement.~~
**FIXED (opus-5 branch).** The cause was not a missing dedupe guard. The raid
roll — `Math.random()`, `setRaidWindow`, `addLog`, `addToast` — lived *inside* a
`setHeat(prev => ...)` updater. `main.jsx` renders under `StrictMode`, which
double-invokes state updaters in development, so the whole roll ran twice per
tick and every announcement fired twice. The roll now happens outside the
updater. Keep side effects out of state updaters.

Do not touch this system without reading `systemPatterns.md` (Heat → Raid Pipeline section) and understanding the full `activeRaid` / `surfaceDefenseActive` / `raidWindow` state handoff first.

### Surface Defense UI — Frame Sizing
The "Surface — Arc Controlled Zone" frame is approximately 100px too wide on each side. It should match the width of the colony grid below it exactly.

### Step 5 Deferred Pending Building Upgrades
The new-defense step in `Raid Improvements/STEP_5_new_defenses.md` is intentionally deferred until the colony has a real building-upgrade system. Do not implement Flak/EMP upgrade gating with placeholder `roomLevel`/`armoryLevel` fields.

#### Surface Defense Lifecycle Safety
- RAF loop continues to run while inactive, creating background CPU churn.

#### Worker/Status Consistency (Main Loop + Handlers) — RESOLVED (opus-5 branch)
Root cause: `cell.workers` was a standalone count with no link to *which*
colonist was in the room, so every removal path picked a random staffed room.

Colonists now own `assignedRoom`, and `cell.workers` is a derived mirror kept
honest by a reconciler effect in `Speranza.jsx` (`pruneInvalidAssignments` +
`reconcileGridWorkers`, both identity-preserving so the effect converges).

**Rule: never write `cell.workers` directly.** Change the colonist's
`assignedRoom` and let the reconciler update the count.

#### UI Data Accuracy
- `ColonyGrid` room tooltip can show staffed production/consumption values when a staffed room has zero workers.
- `ColonyGrid` passive-room tooltip fallback condition appears logically unreachable in some cases, causing missing/inconsistent descriptive text.

## What's Not Started / Future Work 🔲

### Gameplay
- [ ] Surface defense expansion (more turret types, enemy variety)
- [ ] More room types (beyond current set)
- [ ] Trader system (TRADERS in speranza-lore.js exists but may not be wired)
- [ ] Directive system (DIRECTIVES in lore exists but may not be wired)
- [ ] Multiple colony types or starting conditions

### Technical

- [ ] Testing framework
- [ ] Performance profiling for very long runs

## Session Updates — 2026-03-26

### Documentation
- [x] `Raid Improvements/MASTER_PLAN.md` updated to match Speranza architecture and workflow rules
- [x] `Raid Improvements/STEP_1_bug_fixes.md` updated to use live-code verification guidance instead of stale line-number-based instructions
- [x] `Raid Improvements/STEP_2_flying_units.md` updated to keep minigame enemy logic in `surface_defense.jsx` unless pure extraction is justified
- [x] `Raid Improvements/STEP_3_sentry_bunker.md` updated to distinguish colony-side ownership (`Speranza.jsx`) from minigame ownership (`surface_defense.jsx`)
- [x] `Raid Improvements/STEP_4_wealth_scaling.md` updated so pure wealth helpers belong in `gameData.js` and raid integration stays in `Speranza.jsx`
- [x] `Raid Improvements/STEP_5_new_defenses.md` updated to avoid assuming nonexistent armory upgrade fields and to keep unlock logic conservative
- [x] Added `Raid Improvements/STEP_4B_raid_cadence_and_prep_flow.md` to capture the next raid cadence / prep-flow fix pass

### Step 1 Implementation
- [x] Deferred Step 5 until a real building-upgrade system exists
- [x] Removed the fled-colonist ghost bug in `Speranza.jsx`
- [x] Removed the visible RESTART button from `surface_defense.jsx`
- [x] Added duplicate `onRaidLost` guard in `surface_defense.jsx`
- [x] Added timeout tracking/cleanup for delayed raid-resolution and message timers in `surface_defense.jsx`
- [x] Confirmed the underground-strike suppression guard was already present in live `Speranza.jsx`
- [x] Confirmed the raid-size debug selector was already absent in live `surface_defense.jsx`

### Step 2 Implementation
- [x] Added flying enemy types (`drone`, `gunship`) to `surface_defense.jsx`
- [x] Added flying-unit wave generation rules for medium/large raids
- [x] Added drone approach / burst / retreat / loop behavior
- [x] Added gunship rocket splash attacks against defenses
- [x] Added flying-unit rendering and turret air-damage penalty

### Step 3 Implementation
- [x] Derived `sentryWorkers` in `Speranza.jsx`
- [x] Passed `sentryWorkers` and `onBunkerDestroyed` into `SurfaceDefense`
- [x] Added bunker state, auto-fire, rendering, and destruction handling in `surface_defense.jsx`
- [x] Bunker destruction now injures colony sentry workers in `Speranza.jsx`

### Step 4 Implementation
- [x] Added pure wealth helpers `calcColonyWealth()` and `getWealthBracket()` to `gameData.js`
- [x] Replaced heat-only raid size selection with wealth-bracket-based severity in `Speranza.jsx`
- [x] Added `pendingWealthBracket` state and passed it into `SurfaceDefense`
- [x] Added minigame wave-density scaling based on wealth bracket

### Notes
- Verified that `onSentry` exists in live `Speranza.jsx`, so Step 3 may reference it — but docs now instruct future work to re-check live code first rather than assuming.
- Verified that `surfaceDefenseActiveRef` and `pendingRaidSize` already exist in live `Speranza.jsx`.
- Verified that no `roomLevel`/`armoryLevel` references currently exist in `src/`, so Step 5 docs now explicitly warn against assuming those fields are already present.
- `npm run build` passed after implementing Steps 1–4.

### Visual
- [ ] Sprites for all room types
- [ ] Worker animations (CSS animation on the worker dots when active)
- [ ] More surface condition visual indicators

### Session Update — Flow Tooltip Accuracy Pass
- [x] Removed fake `"No major modifiers this tick"` fallback injection from flow breakdown state in `src/Speranza.jsx`
- [x] Flow tooltip now shows real per-tick **Supply** and **Demand** sources instead of "modifiers"
- [x] Flow tooltip empty states are now render-only and neutral (`No supply this tick` / `No demand this tick`)
- [x] `npm run build` passed after the tooltip/breakdown update
