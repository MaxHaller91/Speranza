# SPERANZA UNDERGROUND — Project Handoff Document

## What This Is
A browser-based Fallout Shelter / Oxygen Not Included-style colony management game set in the Arc Raiders universe. Built as a single React JSX artifact, runs entirely in the browser with no build tools. The player manages an underground colony surviving Arc raids while expanding and researching new technology.

---

## Current File
`speranza.jsx` — single file React component, ~1160 lines. No external dependencies beyond React.

---

## What's Been Built

### Core Systems
- **2-second tick loop** using `useEffect` with empty deps. All state read through refs (`gridRef`, `colonistsRef`, etc.) to avoid stale closure bugs — this is critical, do not change this pattern.
- **Resource system**: energy, food, water, scrap, rp (research points). Stored in a single `res` object. Max 300 per resource.
- **Grid**: 7×4 cells. Each cell: `{ id, type, workers }`. Click empty = build menu. Click room = management panel.
- **Supply/demand bars**: center-zero bars showing net flow per tick for each resource.
- **Colony log**: timestamped event history, last 30 entries.
- **Toast notifications**: fixed-position popups, 4 types (raid/injury/success/info), auto-dismiss after 4.5s, slide-in animation.

### Colonist System
- Colonists are **individual named objects**: `{ id, name, status, injuryTicksLeft }`
- Status values: `idle | working | onExpedition | injured`
- Names drawn from Arc Raiders-style name pool (VASQUEZ, CHEN, OKAFOR, etc.)
- `unassigned` count is **derived** from the array — not separate state
- Assignments log by name: "VASQUEZ assigned to Hydroponics"
- Collapsible roster panel below supply/demand bars showing each colonist with colored status dot
- Injured colonists show tick countdown: "⚕ 23 ticks to recover"

### Room Types (T1)
| Room | Cost | Effect |
|---|---|---|
| Power Cell | 10 scrap | +4 energy/tick per worker, cap 2 |
| Water Recycler | 15 scrap | +3 water/tick, -1 energy, cap 2 |
| Hydroponics | 20 scrap | +2 food/tick, -1 energy -1 water, cap 2 |
| Workshop | Free | +2 scrap/tick, -1 energy, cap 2 |
| Barracks | 25 scrap | +2 pop cap, no workers needed |
| Armory | 40 scrap | Enables expeditions, needs 1 armorer, -1 energy |
| Hospital | 35 scrap | Heals injured colonists, 1 nurse = 3 patients, cap 2 |
| Research Lab | 45 scrap | +1 rp/tick per worker, -1 energy, cap 2 |

### Expedition System
- Requires Armory with 1 worker assigned
- One expedition active at a time
- **Scavenge Run**: 1 colonist, 5 ticks, 10% fail, +25 scrap reward, +2 threat
- **Arc Strike**: 2 colonists, 8 ticks, 30% fail, +60 scrap +30 energy, +18 threat
- Expedition colonists named in log and countdown panel
- On return: named toast ("VASQUEZ & CHEN returned!")

### Injury & Hospital System
- Injured colonists: `status: "injured"`, `injuryTicksLeft: 40`
- Without hospital nurses: heals 1 tick/tick (40 ticks = 80s real time)
- With nurses: heals 4 ticks/tick (10 ticks = 20s). 1 nurse handles up to 3 patients
- Hospital room panel shows all current patients with individual countdowns
- On recovery: toast + log, status returns to `idle`

### Threat & Raid System
- **Threat scaling**: `1.2 + (built rooms × 0.8)` per tick — expanding colony draws more Arc attention
- **Raid window**: when threat hits threshold (currently 500 for testing, real value = 100), a window opens. Threat holds at max while open.
- **Each tick during window**: 60% chance raid fires, 40% chance it delays and escalates
- **Escalation**: Small → Medium → Large if delayed
- **Raid sizes**:
  - Small: 1 target, barricade block 75%
  - Medium: 2 targets, barricade block 30%
  - Large: 3 targets, barricade block 10%
- **Per-target outcome roll**: 50% flee (idle), 30% injured, 20% killed (permanent)
- **Threat bar**: striped red animation during raid window, shows current raid size + block chance
- **Raid flash**: red outline on entire screen when raid hits

### Research Lab & T2 Tech Tree
- Research Lab produces 1 RP/tick per assigned researcher
- RP bar appears in header once a Research Lab is built
- Click Research Lab room → side panel shows T2 tech tree
- **T2 Techs** (all currently defined, Barricades implemented):
  - 🛡 Barricades (50 RP) — **IMPLEMENTED**: passive, blocks raids by size, costs 15 scrap to repair on successful block
  - 🪖 Sentry Post (75 RP) — unlocks building (not yet built)
  - 📡 Radio Tower (75 RP) — unlocks building (not yet built)
  - 🏠 Shelter (100 RP) — unlocks building (not yet built)

---

## Architecture Rules — Keep These

### 1. Stale Closure Pattern (CRITICAL)
The tick loop has empty `[]` deps. ALL state must be read through refs:
```js
const gridRef = useRef(grid);
useEffect(() => { gridRef.current = grid; }, [grid]);
```
Every new piece of state that the tick loop needs gets its own ref + sync effect. Never add state directly to the useEffect deps array.

### 2. Syntax Check Before Every Output
Run Babel parse check before copying to outputs:
```js
node -e "const parser = require('@babel/parser'); 
const code = require('fs').readFileSync('speranza_v3.jsx','utf8');
try { parser.parse(code,{sourceType:'module',plugins:['jsx']}); console.log('OK'); } 
catch(e) { console.log('Error line',e.loc?.line,':',e.message); }"
```

### 3. Read Before Writing
Always `view` the relevant sections of the file before making edits. Never edit from memory.

### 4. Surgical Edits Over Rewrites
Prefer `str_replace` targeted edits. Only do full rewrites when the change touches >40% of the file or fixes a fundamental architecture issue. State the exact lines being changed before touching anything.

### 5. Plan Before Coding
For any feature that touches more than 2 systems: write out the exact data structure changes, state changes, and which functions are affected before writing a line of code. Get approval before starting.

### 6. Ask Before Starting Any Change
Never start coding a new feature without asking first. Present a plan. Confirm scope. Start only when approved.

### 7. One Step at a Time
Don't bundle multiple features into one session without explicit user approval. Each feature = its own implementation pass = its own output.

### 8. Derived State Over Separate State
`unassigned` = `colonists.filter(c => c.status === "idle").length` — don't track separately.
`popCap` = calculated from grid — don't track separately.
If a value can be computed from existing state, don't add new state for it.

### 9. The Colonist Object Shape
```js
{ 
  id: string,           // unique, e.g. "c${Date.now()}-${Math.random()}"
  name: string,         // from NAME_POOL
  status: "idle" | "working" | "onExpedition" | "injured",
  injuryTicksLeft: number | undefined,
  previousRoom: { r, c } | null  // for shelter return (not yet implemented)
}
```
This is intentionally flat. Don't add deeply nested properties.

### 10. Room `special` Flag Pattern
Rooms with behavior beyond produce/consume get a `special` string. The tick loop skips standard production for special rooms. Special behavior is handled in dedicated blocks. Current special values: `"barracks"`, `"armory"`, `"hospital"`, `"researchLab"`.

---

## Planned Next Steps (in order)

### Immediate — Sentry Post
- New room, 75 RP to unlock, then 30 scrap to build
- Cap: 2 colonists assigned as sentries (`status: "onSentry"`)
- Each sentry reduces threat by 5/tick (so 2 sentries = -10/tick)
- Sentry colonists are in the raid target pool with slightly higher injury risk
- New status color for `onSentry`

### Then — Radio Tower + Shelter (pair)
These only make sense together:
- **Radio Tower**: reveals raid size when window opens (currently hidden until it fires). Shows in threat bar.
- **Shelter**: grid building, cap 4. "SOUND ALARM" button moves colonists in. Sheltered colonists immune to raids. "BACK TO WORK" returns them using `previousRoom` stored on colonist object. If previous room was damaged, return to idle instead.

### Then — Damaged Buildings
- Grid cells get `damaged: false` field
- Medium raids: 20% chance to damage a random room. Large raids: 50% chance.
- Damaged rooms: skip production in tick loop, show red ⚠ overlay on grid cell
- Repair button in room panel: costs 20 scrap, clears damaged flag
- This becomes more meaningful once Shelter exists (raid hits, shelter protects colonists, but building still takes damage — player must choose between shelter upkeep and repair costs)

### Future — Colonist Depth (separate large feature)
- Colonists gain `ticksInColony`, `history[]`, eventually `xp`, `gear`
- Click a colonist card to open a profile panel
- History auto-populated: "Tick 12: Assigned to Workshop", "Tick 34: Injured in raid"
- This is a standalone feature — do not start until Radio/Shelter and Damaged Buildings are done

### Future — T3 Tech Tree
Plan exists but don't design until T2 is fully implemented and tested.

### Balance Note
Once testing is done, reset `THREAT_RAID_THRESHOLD` from `500` back to `100`.

---

## Key Design Principles

**Expansion should feel dangerous.** Every room built increases threat. The player should feel the weight of growing the colony, not just the benefits.

**Named colonists should hurt to lose.** The name system exists so "VASQUEZ was KILLED" lands differently than "-1 colonist." Don't abstract it back away.

**Information before agency.** Radio Tower is useless without Shelter. Don't add warnings the player can't act on. Every information system needs a corresponding action system.

**Arc Raiders flavor.** The Arc is overwhelming machine intelligence — you don't beat it, you survive around it. Defenses are about mitigation and delay, not domination. The tone should feel like a losing battle you're winning through cleverness.
