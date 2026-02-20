# Speranza — Implementation Plan
Last updated: February 2026

## File Structure
- `Speranza.jsx` — All game logic, state, tick loop, React components, mechanical constants
- `speranza-lore.js` — All flavor text, narrative content, exported as named constants
  - Import at top of Speranza.jsx: `import { BACKSTORIES, QUIRKS, ... } from './speranza-lore.js'`

**Rule:** If it's words, it lives in the lore file.
If it's numbers or logic, it lives in the JSX.

---

## PROMPT A — UI & Feel (Quick Wins)

**Goal:** Game feels polished and readable before adding more systems.
No new mechanics. Pure presentation.

### 1. Day/Hour Display
- 1 tick = 30 in-world minutes
- 48 ticks = 1 in-world day
- Display format: `DAY 4 · 14:00` in header, replacing or alongside tick counter
- Helper: `const tickToDay = (t) => ({ day: Math.floor(t/48)+1, hour: (t%48)*0.5 })`
- Milestone toasts use day/hour. Memorial records use day/hour.

### 2. Remove Room Types Legend Panel
- Delete the `{!selected && <LegendPanel />}` block (or equivalent)
- When nothing selected: side panel shows Memorial wall (if deaths exist) or empty with hint text
- Build menu only opens on click of empty cell
- Management panel opens on click of built room

### 3. Hover Tooltips on Built Rooms
- `hoveredCell: {r,c} | null` in state
- `onMouseEnter` / `onMouseLeave` on each grid cell
- Absolutely positioned tooltip div near cell
- Shows: room name + icon, workers/cap, net production this tick, repair cost if damaged
- Special lines: Hospital (patients), Armory (gear stock), Research Lab (RP/tick)
- No tooltip on empty cells or locked rows

### 4. Morale Drain Fix
```js
// In tick loop — replace current drain calculation:
const drainableColonists = Math.max(0, colonists.length - 7);
const moraleDrain = drainableColonists * 0.3;
```
Zero drain under 8 colonists. Scales naturally above that.

### 5. Colony Milestones
- `firedMilestones: Set` in state (serialized as array for seed)
- Check on every relevant state change (not every tick — on death, raid repel, pop change etc.)
- Trigger conditions checked against MILESTONES array from lore file
- Display as special gold-border toast, 5 seconds, non-dismissable
- `+5 morale` on any milestone fire

### 6. Colonist Detail Window
- Click colonist card → sets `selectedColonist: id` in state
- Renders in side panel replacing other content
- Shows: name, status, level badge, backstory (from BACKSTORIES), quirk with icon/desc,
  trait cards, XP bar, stats (ticks alive as day/hour, expeditions completed, raids survived, times injured)
- Back button clears selectedColonist

---

## PROMPT B — Core Systems

**Goal:** Memorial, game over, heat rework, lore wiring. These are foundational.

### 7. Memorial Wall
- `memorial: []` in state — entry added on every colonist death
- Entry shape: `{ name, level, traits, quirk, cause, day, hour, location (if expedition), backstory, artifactName (if created) }`
- Epitaph generated from EPITAPHS[cause] pool on death
- Rendered in side panel when nothing else selected
- Each entry: name (bold), day/hour died, cause, epitaph in italic
- Scrollable if long

### 8. Memorial Building
- `MEMORIAL` in BUILDING_DEFS: 30 scrap, no workers, passive effect
- Effect: morale loss from death events -40%, morale loss from raids -2 (stacks with other defenses)
- Narrative: "Having a place to grieve makes loss meaningful rather than demoralizing."

### 9. Game Over Screen
- Triggers when: population hits 0 OR morale hits -100 and collapse event fires
- Full-screen overlay, not dismissable (only New Game)
- Shows:
  - Days + hours survived
  - Raids repelled
  - Total casualties with names
  - Peak population
  - First death (name, cause, day)
  - Arc Tech collected total
  - Schematics found count
  - Letter grade: LEGEND (80+ days) / DEFENDER (40+) / SURVIVOR (20+) / LOST (under 20)
- Colony history timeline: auto-populated key events in chronological order
  - Pulled from `historyLog: []` state array
  - Add entries on: first raid, first death, excavation unlocks, T3 buildings, first expedition, milestones
- Seed string: `btoa(JSON.stringify({ days, raidsRepelled, deaths, peakPop, grade }))` — displayed as `SPZ-[8chars]`
- Copy button for seed

### 10. Heat Meter Rework
Replaces current threat bar entirely.

```js
// State:
heat: 0,  // 0-1000

// Constants:
HEAT_DECAY = 0.3,        // per tick passive decay
HEAT_STRIKE_GAIN = 20,   // per Arc Strike expedition
HEAT_PROBE_GAIN = 60,    // probe looted
HEAT_RAID_GAIN = 15,     // per raid that fires

// Raid probability formula (replaces threshold system):
// Every tick: roll Math.random() < (0.03 + (heat/1000)*0.12)
// = 3% base chance up to 15% at max heat

// Heat states (read by UI and raid behavior):
const HEAT_STATES = [
  { min: 0,   max: 199, label: "UNDETECTED", color: "#7ed321" },
  { min: 200, max: 399, label: "SCANNING",   color: "#ffcc00" },
  { min: 400, max: 599, label: "TARGETED",   color: "#ff8800" },
  { min: 600, max: 799, label: "HUNTED",     color: "#ff4444" },
  { min: 800, max: 1000, label: "MARKED",    color: "#ff0000", pulse: true },
];
```

**Heat state behavior differences:**
- SCANNING+: Snitch unit appears 2 ticks before raid. If Sentry kills it → heat +0. If it escapes → heat +30 extra.
- TARGETED+: Raid size +1 on rolls
- HUNTED+: Commander raids possible (if 5+ raids repelled)
- MARKED: Constant pressure, raids can chain (second raid possible within 20 ticks of first)

### 11. Lore File Wiring
- Import all lore exports at top of Speranza.jsx
- **Backstories:** `colonist.backstory = BACKSTORIES[Math.floor(Math.random()*BACKSTORIES.length)]` at spawn
- **Quirks:** same pattern, assign `colonist.quirk = QUIRKS[...]`, wire mechanical effects in tick loop per quirk.id
- **Surface Conditions:** add `surfaceCondition` state, rotate every 80-120 ticks using weighted pick from SURFACE_CONDITIONS
  - Show current condition in header with icon + label + color
  - Snapshot into expedition at launch: `expedition.conditionSnapshot = surfaceCondition`
  - Apply condition effects to expedition roll weights and food drain in tick loop
- **Dilemmas:** add `activeDilemma: null` state
  - Every 50 ticks: 40% chance → pick eligible dilemma (check minTick, minPop, condition)
  - Render as side panel overlay with choice buttons
  - On choice: run `apply` object through dilemma handler in tick loop
- **Expedition chatter:** prefix each expedition log entry with random EXPEDITION_FLAVOR line
  - Skip if `surfaceCondition.effects.expedSilent === true`
- **Milestones:** check MILESTONES array each tick against current game state

---

## PROMPT C — Colonist Tiers + Directives + Room Upgrades

**Goal:** Mid-game depth. New progression axes.

### 12. Colonist Tier System
Triggers when colonist reaches Level 3. Player chooses path.

**Raider path:**
- Requires: Armory exists AND Gear in stock
- Armory L3 upgrade produces Gear: 1 unit per 30 ticks, costs 5 scrap/unit
- `gearStock: number` in state
- Raider tier effects: +25% expedition good rolls, unlocks 4th trait slot, -10% raid flee chance
- Card badge: ⚔️ RAIDER
- Drops back to Survivor if gearStock < 1 for 20 ticks

**Citizen path:**
- Requires: Tavern exists AND Strong Drink in stock
- Tavern L3 upgrade produces Strong Drink: 1 unit per 25 ticks, costs 2 water/unit
- `strongDrinkStock: number` in state
- Citizen tier effects: passive +1.5 morale/tick, +20% production, death morale loss -30%
- Card badge: 🏠 CITIZEN
- Drops back to Survivor if strongDrinkStock < 1 for 20 ticks

**Supply depletion warning:** header shows gear and drink stock counts when either path is active

### 13. Worn Out Status
- Track `colonist.injuryCount` — increments on each injury event
- If `injuryCount >= 3` AND `Hospital` was never present in colony: set `colonist.wornOut = true`
- Worn Out: -50% production, cannot go on expeditions, cannot be Sentry, card shows "WORN OUT" badge
- Permanent unless Hospital built (Hospital presence prevents Worn Out from triggering)
- Memorial notes "Worn Out" as cause contribution

### 14. Colony Directives
- Unlock: Research Lab Level 3
- `activeDirectives: []` in state (max 3)
- Directives panel in side UI: list from DIRECTIVES, toggle on/off
- Each directive's mechanical effects applied every tick in tick loop
- Max 3 active simultaneously — 4th toggle rejected with a warning toast

**Directive mechanics (in JSX constants):**
```js
const DIRECTIVE_EFFECTS = {
  overtime:      { moralePerWorker: -0.2, productionMult: 1.20 },
  rationing:     { moraleFlat: -0.3,     foodDrainMult: 0.60 },
  conscription:  { moraleFlat: -0.1,     autoAssign: true },
  lockdown:      { blockExpeditions: true, heatDecayMult: 2.0 },
  openComms:     { heatPerTick: +0.15,    expedGoodMult: 1.15 },
  combatDrills:  { scrapPerTick: -2,      injuryChanceMult: 0.85 },
  triageProtocol:{ productionMult: 0.90,  healRateMult: 1.50 },
};
```

### 15. Room Upgrade Levels
- Add `roomLevel: 1 | 2 | 3` to each placed room in grid
- Upgrade button in room management panel (not during raids)
- Costs: L2 = 1.5× original build cost. L3 = 2.5× original build cost.
- Production multiplier: L1 = 1.0, L2 = 1.3, L3 = 1.6
- L3 special abilities (per room — trigger room-specific logic):
  - **Workshop L3:** can craft Arc Circuitry (3 Arc Tech + 5 Salvage → 1 Circuitry, 15 ticks)
  - **Tavern L3:** produces Strong Drink (enables Citizen path)
  - **Armory L3:** produces Gear (enables Raider path), adds 2nd expedition slot
  - **Barracks L3:** Raider faction morale bonus, flee chance -10%
  - **Hospital L3:** Prevents Worn Out, heals 2× faster
  - **Research Lab L3:** Unlocks Directives panel
  - **Power Cell L3:** +3 energy/tick
  - **Hydroponics L3:** +2 food/tick
  - **Water Recycler L3:** +2 water/tick
  - **Radio Tower L3:** Enables surface outposts, upgrades snitch detection to 40%

---

## PROMPT D — Threat Events + Late Game

**Goal:** Probe events, Harvester, named commander, expedition locations, traders.

### 16. Surface Incursion (Probe Event)
- Fires every 80-120 ticks (independent of dilemma timer)
- Condition: not during dustStorm, not during a raid
- Uses arc_probe_incursion dilemma from lore file
- Heat state affects frequency: higher heat = more frequent probes

### 17. Harvester Mega-Event
- Fires once per run, randomly between tick 200-400
- State: `harvesterActive: { ticksRemaining: 60, destroyed: false } | null`
- While active:
  - Special "HARVESTER DETECTED" header warning with countdown
  - All Arc Strike expeditions to Forward Position: loot ×2, death risk +30%
  - Every 10 ticks: additional raid chance roll fires
  - Directive Lockdown blocks the expedition opportunity
- If expedition destroys it (special outcome roll, ~20% on any strike expedition while active):
  - Massive drop: +10 Arc Tech, +15 Salvage, +5 Scrap
  - Heat -200, morale +25
  - Trophy awarded: stored in `trophies: []` state, triggers Trophy Room unlock
  - Milestone fires
- If it leaves (ticksRemaining hits 0): nothing bad, just missed the window
- Only fires once per run

### 18. Trophy Room
- Unlocked when first trophy earned (Harvester destroyed OR commander killed)
- Building: 45 scrap, no workers
- `trophies: [{ name, source, day, hour, flavor }]` in state
- Passive morale: +0.5/tick per trophy, max +5/tick (caps at 10 trophies)
- Trophy names generated from source event + flavor from lore templates

### 19. Named Arc Commander
- Triggers at heat 600+ AND 5+ raids repelled
- `activeCommander: { name, weakness, strength, raidsUntilSpecial: 3 } | null` in state
- Every 3rd raid while commander active is a Commander Raid (+1 size, guaranteed Arc Tech drop on repel)
- Kill via special Arc Strike expedition with high roll (10% base, +5% per heat 100 above 600)
- On kill: heat -300, trophy, milestone, morale +15, commander null
- New commander spawns 150 ticks after kill if heat stays above 400

### 20. Named Expedition Locations
- Add `destination: locationId` to expedition launch UI
- Destination picker: row of buttons from SURFACE_LOCATIONS array
- `expedition.locationId` stored, rollMods applied to all expedition rolls
- Location name shown in expedition panel header and event log
- Location shown in memorial for expedition deaths
- Outposts (Radio Tower L3): `outposts: [locationId]` in state
  - Build at location: 30 Salvage + 20 Scrap
  - Effect: that location's badMult -0.1, goodMult +0.15
  - Can be destroyed (dilemma event fires if threatened)

### 21. Trading System
- Colony reputation score: `rep = Math.floor((avgMorale50 * population * daysAlive) / 100)`
- Traders arrive at rep 50+, every 100-150 ticks
- `activeTrade: { trader, offers: [{ give, receive }], ticksLeft: 8 } | null` in state
- 2-3 barter offers shown, player picks one or declines
- Offer quality scales with rep tier: higher rep = Arc Tech and schematics available
- Trader name/line from TRADERS pool in lore file
- After trade or decline, next trader not for 100-150 ticks

---

## PROMPT E — Faction Tension + Artifacts (Polish Pass)

### 22. Raider vs Builder Faction Tension
- Activate when 3+ Raider-path colonists AND 3+ Citizen-path colonists exist
- Every 50 ticks: check faction satisfaction
  - Raiders satisfied by: expedition slots, Armory level, Barracks level
  - Builders satisfied by: production room levels, Hospital level, food surplus
- If neglected faction: faction-specific dilemma fires
  - Raiders unhappy: "Three of your raiders cornered you in the workshop..."
  - Builders unhappy: "The production workers held a quiet meeting last night..."
- Siding with one: morale +10 for that faction's colonists, -5 for other

### 23. Colonist Artifacts
- When colonist reaches Level 5: trigger artifact creation
- Pick random template from ARTIFACT_TEMPLATES, random item from ARTIFACT_ITEMS
- `colonist.artifact = { name, template, created: { day, hour } }`
- While alive: +0.5 morale/tick (passive, applied in tick loop)
- On death: artifact moves to memorial entry, +0.2 morale/tick permanent tribute
- Milestone fires on first artifact
- Shown in colonist detail window

---

## State Shape — New Fields Summary

```js
// Add to initial state:
heat: 0,                    // 0-1000, replaces threatLevel
surfaceCondition: SURFACE_CONDITIONS[0],  // current condition
surfaceConditionTimer: 0,   // ticks until next rotation
activeDilemma: null,        // { event, onChoose }
memorial: [],               // { name, level, traits, quirk, cause, day, hour, backstory, epitaph }
historyLog: [],             // { tick, day, hour, text } — for game over screen
firedMilestones: new Set(), // milestone ids
gearStock: 0,               // for Raider tier
strongDrinkStock: 0,        // for Citizen tier
activeDirectives: [],       // directive ids, max 3
harvesterActive: null,      // { ticksRemaining, destroyed }
activeCommander: null,      // { name, weakness, strength, raidsUntilSpecial }
trophies: [],               // { name, source, day, hour }
outposts: [],               // locationIds with Radio Tower L3
colonyRep: 0,               // reputation score for trading
activeTrade: null,          // current trader offer
factionTension: null,       // 'raiders' | 'builders' | null
```

---

## Mechanical Constants (All in Speranza.jsx, NOT lore file)

```js
const TICKS_PER_DAY = 48;
const HEAT_DECAY_PER_TICK = 0.3;
const HEAT_STRIKE_GAIN = 20;
const HEAT_RAID_GAIN = 15;
const HEAT_PROBE_GAIN = 60;
const HEAT_RAID_PROB_BASE = 0.03;
const HEAT_RAID_PROB_MAX = 0.12;
const MORALE_DRAIN_THRESHOLD = 7;       // no drain under 8 colonists
const MORALE_DRAIN_PER_COL = 0.3;
const ARTIFACT_LEVEL = 5;               // level required to create artifact
const WORN_OUT_INJURY_COUNT = 3;        // injuries before Worn Out
const GEAR_PRODUCTION_TICKS = 30;       // ticks per gear unit from Armory L3
const GEAR_SCRAP_COST = 5;
const DRINK_PRODUCTION_TICKS = 25;      // ticks per drink from Tavern L3
const DRINK_WATER_COST = 2;
const TIER_SUPPLY_GRACE_TICKS = 20;     // ticks before tier drop from supply shortage
const HARVESTER_SPAWN_MIN = 200;
const HARVESTER_SPAWN_MAX = 400;
const HARVESTER_DURATION = 60;
const COMMANDER_HEAT_THRESHOLD = 600;
const COMMANDER_MIN_RAIDS = 5;
const TRADER_REP_THRESHOLD = 50;
const TRADER_INTERVAL_MIN = 100;
const TRADER_INTERVAL_MAX = 150;
const DIRECTIVE_MAX_ACTIVE = 3;
const ROOM_UPGRADE_MULT = [1.0, 1.3, 1.6];  // L1, L2, L3 production multipliers
```

---

## Cline Prompt Strategy

Given the scope, split across 5 Cline sessions:

**Session A** — UI & Feel (Prompts 1-6): Day/hour display, remove legend, hover tooltips, morale drain fix, milestones, colonist detail window. ~200 line delta.

**Session B** — Core Systems (Prompts 7-11): Memorial, game over screen, heat rework, lore file import + wiring. ~400 line delta.

**Session C** — Progression (Prompts 12-15): Colonist tiers, Worn Out, directives, room upgrades. ~350 line delta.

**Session D** — Events (Prompts 16-21): Probe event, Harvester, commander, expedition locations, outposts, traders. ~400 line delta.

**Session E** — Polish (Prompts 22-23): Faction tension, artifacts. ~150 line delta.

Each session gets its own Cline prompt. Start each prompt by referencing this plan.
Each session: read current file → implement → validate syntax → output patch file alongside updated JSX.
