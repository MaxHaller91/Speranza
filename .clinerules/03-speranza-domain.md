# Speranza — Game Domain Knowledge

## What This Game Is
Underground colony builder. Arc Raiders universe. Players manage a cross-section of subterranean rooms, assign colonists to work them, survive raids, and send expeditions to the surface. Visual aesthetic: Fallout Shelter meets Oxygen Not Included. Single JSX file game (now refactored into components).

## The Tick System
- 1 tick = one game loop iteration
- 48 ticks = 1 in-game day
- `timescale` controls speed: 0 = paused, 0.5/1/2/4/10 = multipliers
- `TICK_MS = 400` is the base interval (at 1× speed)
- The tick loop lives in Speranza.jsx as a `useInterval`-style effect
- `tick` (state) increments every loop; `tickToDayHour(tick)` converts to "Day X · HH:MM"

## The Grid
- 4 rows × 7 columns = 28 cells
- Rows unlock via excavation (row 0 is unlocked by default)
- `unlockedRows: number[]` tracks which row indices are accessible
- `grid[r][c]` = `{ type: string|null, workers: number, damaged: boolean }`
- `excavations[r]` = `{ ticksLeft, totalTicks, scrap }` during active dig
- `EXCAVATION_DEFS[r]` = cost and duration per row in gameData.js

## Key State Variables (Speranza.jsx)
```
res           { energy, food, water, scrap, rp }   — main resources
heat          number (0-1000)                       — raid threat meter
morale        number (-100 to 100)                  — colony mood
colonists     Colonist[]                            — all personnel
grid          Cell[][]                              — 4×7 room grid
tick          number                                — current tick count
timescale     number                                — speed multiplier
activeRaid    RaidState|null                        — ongoing raid
raidWindow    RaidWindow|null                       — incoming raid warning
expeditions   Expedition[]                          — active surface runs
surfaceHaul   { salvage, arcTech, schematics[] }   — expedition loot
unlockedTechs string[]                              — researched T2 techs
activeDilemma Dilemma|null                          — active choice modal
memorial      MemorialEntry[]                       — fallen colonists
gameOver      GameOver|null                         — triggers game over screen
```

## Key Constants (gameData.js)
- `ROOM_TYPES` — all buildable rooms, keyed by type string
- `RAID_SIZES` — `{ small, medium, large }` with duration, strikes, rewards
- `RAID_SIZE_ORDER` — `["small", "medium", "large"]` for index lookups
- `RAID_LAUNCH_CHANCE` — per-tick probability during a raid window
- `HEAT_MAX = 1000` — heat ceiling
- `T2_TECHS` — researchable upgrades (barricades, reinforcement, etc.)
- `TRAITS` / `TRAIT_KEYS` — colonist level-up perks
- `EXPEDITION_TYPES` — surface mission definitions
- `MAX_RES = 999` — resource cap
- `INIT_RES` — starting resources

## Colonist Object Shape
```js
{
  id, name, status,          // status: "idle"|"working"|"injured"|"sheltered"|"onExpedition"
  xp, level,
  traits: string[],          // from TRAIT_KEYS
  quirk: { icon, label, desc, effect },
  backstory: string,
  injuryTicksLeft: number,
  pendingTraitPick: boolean, // true when level-up trait choice is pending
  joinTick, expeditionsCompleted, raidsSurvived, injuryCount
}
```

## Heat & Raid System
1. Heat builds from room count, surface conditions, expeditions
2. Sentry posts reduce heat (`-5/tick per worker`)
3. When heat exceeds threshold → `raidWindow` opens (shows warning banner)
4. Each tick during window: rolls against `RAID_LAUNCH_CHANCE` → raid starts
5. Raid launches → `activeRaid` set, `surfaceDefenseActive` → true
6. Surface defense minigame runs in `surface_defense.jsx`
7. `handleSurfaceRaidWon` / `handleSurfaceRaidLost` are the callbacks
8. Barricades tech gives % chance to block raid entirely before it launches

## Resource Flow
- Each room produces/consumes per tick based on `workers` assigned
- `netFlow` (state) = net per-tick delta for display in FlowPanel
- `statBreakdown` (state) = per-resource breakdown of what's adding/subtracting (used for hover tooltip)
- Resources are capped at `MAX_RES`, floored at 0
- `scrap` is the construction currency; also used for repairs (20 scrap)
- `rp` (research points) only visible/produced if a researchLab exists

## Surface Defense (surface_defense.jsx)
- Completely self-contained tower-defense minigame
- Props: `scrap`, `onScrapChange(delta)`, `raidSize`, `active`, `onRaidWon`, `onRaidLost`
- `onScrapChange` receives **deltas** (not absolute values): `-cost` for placement, `+reward` for kills
- Critical bug history: passing initial scrap value caused doubling — always pass delta

## Visual Systems
- Day/night sky: `SkyBackground` component, driven by `(tick % 48) / 48` fraction
- Earth texture mortise: SVG overlay in `ColonyGrid`, punches holes where rooms are excavated
- Building sprites: `def.sprite` on ROOM_TYPES entries (base64 or path); falls back to emoji icon
- Worker dots: clickable circles at bottom of room cells, `onClick` calls `handleAssign`
- Raid flash: outer container gets `outline: "3px solid #ff4444"` during `raidFlash` state

## Things That Have Been Fixed (Don't Re-Break)
- **Scrap doubling bug:** surface_defense onScrapChange must receive deltas not absolute values
- **Effect re-triggering:** active useEffect in surface_defense uses separate effects for ref sync vs reset logic
- **Tooltip z-index:** all fixed-position tooltips use zIndex 9999 and pointerEvents none
- **Worker dot propagation:** dot clicks use e.stopPropagation() to avoid triggering cell selection
