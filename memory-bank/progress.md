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

### Surface Defense UI — Frame Sizing
The "Surface — Arc Controlled Zone" frame is approximately 100px too wide on each side. It should match the width of the colony grid below it exactly.

### Surface Defense — Dev Testing Artifacts
The raid size selector (Small / Medium / Large buttons) is hardcoded and visible in the minigame UI. This was a testing artifact and must be removed — raid size should be determined exclusively by the `raidWindow.sizeIdx` value passed in from Speranza's heat/raid calculations.

### Surface Defense — Incomplete Integration with Main Raid System
The surface defense minigame (`surface_defense.jsx`) is not fully integrated with Speranza's raid lifecycle. Three confirmed bugs from bug report tick-306:
1. Main tick loop raid strike logic runs in parallel while `surfaceDefenseActive: true` — colonists can be killed/injured by the background raid system while the player is in the minigame. Fix: wrap the tick loop's colonist strike/casualty section with `if (!surfaceDefenseActive)`.
2. Raid toast notification fires twice in the same tick when a raid launches — likely no deduplication guard on the announcement.
3. Colonists with `raidFled` cause are added to `memorial[]` but NOT removed from `colonists[]` — the fled colonist becomes a ghost who still exists in the roster as idle. Fix: ensure the flee handler splices the colonist from the colonists array after pushing to memorial.

Do not touch this system without reading `systemPatterns.md` (Heat → Raid Pipeline section) and understanding the full `activeRaid` / `surfaceDefenseActive` / `raidWindow` state handoff first.

### Newly Discovered (Codebase Audit — 2026-03-01)

#### Surface Defense Lifecycle Safety
- `onRaidLost` callback can be scheduled multiple times after hatch HP reaches 0, causing duplicate parent-side resolution effects.
- `surface_defense.jsx` has timeout lifecycle gaps (`showMessage`, delayed raid won/lost callbacks) that are not centrally tracked/cleared.
- RAF loop continues to run while inactive, creating background CPU churn.

#### Worker/Status Consistency (Main Loop + Handlers)
- Potential worker ↔ colonist state desync in edge paths: room worker counts can diverge from which specific colonists are transitioned between statuses.
- Alarm/sentry transitions can produce impossible combinations (e.g., status implying active sentry duty while room worker counts are reset).

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

### Notes
- Verified that `onSentry` exists in live `Speranza.jsx`, so Step 3 may reference it — but docs now instruct future work to re-check live code first rather than assuming.
- Verified that `surfaceDefenseActiveRef` and `pendingRaidSize` already exist in live `Speranza.jsx`.
- Verified that no `roomLevel`/`armoryLevel` references currently exist in `src/`, so Step 5 docs now explicitly warn against assuming those fields are already present.

### Visual
- [ ] Sprites for all room types
- [ ] Worker animations (CSS animation on the worker dots when active)
- [ ] More surface condition visual indicators
