# SPERANZA UNDERGROUND — Project Handoff Document

## What This Is
A browser-based Fallout Shelter / Oxygen Not Included-style colony management game set in the Arc Raiders universe. Built as a single React JSX component, deployed via Vite + GitHub Pages. The player manages an underground colony surviving Arc raids while expanding and researching new technology.

**Live URL:** https://maxhaller91.github.io/Speranza/
**Repo:** https://github.com/MaxHaller91/Speranza

---

## Current Files
- `src/Speranza.jsx` — all game logic and UI (~1400 lines)
- `src/sounds.js` — audio manager (playlist + Web Audio SFX)
- `src/main.jsx` — React entry point
- `public/music1.mp3` – `music4.mp3` — background music tracks

## Project Structure
```
├── src/
│   ├── Speranza.jsx   ← all game logic lives here
│   ├── sounds.js      ← audio manager (music playlist + synthesized SFX)
│   └── main.jsx       ← React entry point (mounts Speranza)
├── public/
│   ├── music1.mp3     ← background tracks (looped in order)
│   ├── music2.mp3
│   ├── music3.mp3
│   └── music4.mp3
├── index.html         ← HTML shell
├── vite.config.js     ← sets base path to /Speranza/ for GitHub Pages
├── package.json       ← React + Vite dependencies
├── .github/
│   └── workflows/
│       └── deploy.yml ← auto-builds & deploys on every push to main
└── speranza (4).jsx   ← original source file (keep for reference)
```

## Deploying Changes
Edit files in `src/`, then:
```
git add .
git commit -m "your message"
git push origin main
```
GitHub Actions builds and deploys automatically (~30s). No manual steps needed.

---

## What's Been Built

### Core Systems
- **Tick loop**: `useEffect` with `timescale` dep. Interval = `TICK_MS / timescale`. Supports pause (0×), .5×, 1×, 2×, 4×, 10× speeds. All state read through refs (`gridRef`, `colonistsRef`, etc.) to avoid stale closure bugs — this is **critical**, do not change this pattern.
- **Resource system**: energy, food, water, scrap, rp (research points). Stored in a single `res` object. Max 300 per resource.
- **Grid**: 7×4 cells. Each cell: `{ id, type, workers, damaged }`. Click empty = build menu. Click room = management panel.
- **Supply/demand bars**: center-zero bars showing net flow per tick for each resource.
- **Colony log**: timestamped event history, last 30 entries. Edge-triggered warnings (only log once per transition into critical state, not every tick).
- **Toast notifications**: fixed-position popups, 4 types (raid/injury/success/info), auto-dismiss after 4.5s, slide-in animation.

### Audio System (`src/sounds.js`)
- **Background music**: `HTMLAudioElement` playlist — plays `music1.mp3 → music2.mp3 → music3.mp3 → music4.mp3` and loops. Volume 40%.
  - To add more tracks: drop `.mp3` in `public/`, add filename to the `TRACKS` array at top of `sounds.js`
  - Music starts on first user click (browser autoplay policy)
  - Ducks to 10% volume during active raids, restores on raid end
- **Mute button**: 🔊/🔇 toggle in the timescale controls row. Silences both music and SFX.
- **Synthesized SFX** (Web Audio API, no files):
  - `playBuild()` — short click when placing a room
  - `playRaid()` — pulsing alarm when raid begins
  - `playInjury()` — low thud when colonist injured
  - `playKill()` — harsh descending buzz when colonist killed
  - `playSuccess()` — ascending two-note chime (tech unlock, expedition return, colonist recovered)
  - `playAlert()` — triple beep on resource critical warning
  - `playExpedition()` — ascending sweep on expedition launch
  - `playTickAlarm()` — metallic tick, plays 5 ticks before each raid strike
  - `duckMusic()` / `unduckMusic()` — called by raid system

### Colonist System
- Colonists are **individual named objects**: `{ id, name, status, injuryTicksLeft }`
- Status values: `idle | working | onExpedition | injured | onSentry`
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

### T2 Buildings (unlock via Research Lab)
| Room | RP Cost | Effect |
|---|---|---|
| Sentry Post | 75 RP | Each assigned sentry -5 threat/tick; sentries are raid targets |
| Radio Tower | 75 RP | (Coming soon) Reveals raid size during window |
| Shelter | 100 RP | (Coming soon) Colonists immune to raids when sheltered |

### Expedition System
- Requires Armory with 1 worker assigned
- One expedition active at a time
- **Scavenge Run**: 1 colonist, 5 ticks, 10% fail, +25 scrap reward, +2 threat
- **Arc Strike**: 2 colonists, 8 ticks, 30% fail, +60 scrap +30 energy, +18 threat
- Expedition colonists named in log and countdown panel
- On return: named toast ("VASQUEZ & CHEN returned!")

### Injury & Hospital System
- Injured colonists: `status: "injured"`, `injuryTicksLeft: 40`
- Without hospital nurses: heals 1 tick/tick (40 ticks)
- With nurses: heals 4 ticks/tick (10 ticks). 1 nurse handles up to 3 patients
- Hospital room panel shows all current patients with individual countdowns
- On recovery: toast + log, status returns to `idle`

### Threat & Raid System (Two-Phase)
- **Threat scaling**: `1.2 + (built rooms × 0.8)` per tick — expanding colony draws more Arc attention
- **Sentry mitigation**: each assigned sentry reduces threat by 5/tick
- **Threat threshold**: 500 (`THREAT_RAID_THRESHOLD`)

#### Phase 1 — Raid Window
- When threat hits 500, a raid window opens. Threat holds at max while open.
- Each tick: 60% chance raid fires (`RAID_LAUNCH_CHANCE`), 40% chance it delays and escalates
- **Escalation**: Small → Medium → Large if delayed multiple ticks
- **Barricades** (if unlocked): block chance before raid fires (75%/30%/10% by size); costs 15 scrap to repair on block
- **Pending banner**: full-width red panel showing size, escalation count, 60% roll info, barricade block %

#### Phase 2 — Active Raid
When the 60% roll succeeds (and barricades don't block), the raid becomes **active** for a duration:
- **Small**: 20 ticks
- **Medium**: 30 ticks
- **Large**: 60 ticks

Every 10 ticks during the active raid → **Arc Strike** fires:
- Targets up to N exposed workers (`targets` field per size)
- Per-target roll: 50% flee (idle), 30% injured, 20% killed
- Building damage chance per strike: 0% small, 10% medium, 25% large
- 5 ticks before each strike → `playTickAlarm()` fires
- Screen flashes red on each strike

When duration expires → raid ends, threat resets to 25, music restores.

**Active raid banner**: shows size icon, ticks remaining countdown, next strike countdown (turns red at ≤5), progress bar.

#### State
```js
// raidWindow: pending/escalating phase
raidWindow: null | { sizeIdx: 0|1|2, escalations: number }

// activeRaid: sustained raid phase
activeRaid: null | { sizeKey: "small"|"medium"|"large", ticksLeft: number, strikeCountdown: number }
```
Both have corresponding refs (`raidWindowRef`, `activeRaidRef`) synced via `useEffect`.

### Research Lab & T2 Tech Tree
- Research Lab produces 1 RP/tick per assigned researcher
- RP bar appears in header once a Research Lab is built
- Click Research Lab room → side panel shows T2 tech tree
- **T2 Techs**:
  - 🛡 **Barricades** (50 RP) — **IMPLEMENTED**: passive block on raid launch, costs 15 scrap repair on block
  - 🪖 **Sentry Post** (75 RP) — **IMPLEMENTED**: unlocks building, sentries reduce threat -5/tick each
  - 📡 **Radio Tower** (75 RP) — unlocks building (not yet functional)
  - 🏠 **Shelter** (100 RP) — unlocks building (not yet functional)

### Warning System
- Edge-triggered: warnings only log/play sound when condition transitions from safe → critical
- Resets when condition clears, so it can warn again if it re-enters critical
- Thresholds: food/water/energy < 20, threat > 350 (70% of max)
- Implemented via `prevWarn` ref tracking previous tick state

---

## Architecture Rules — Keep These

### 1. Stale Closure Pattern (CRITICAL)
The tick loop has `[timescale]` deps (restarts when speed changes). ALL state must be read through refs:
```js
const gridRef = useRef(grid);
useEffect(() => { gridRef.current = grid; }, [grid]);
```
Every new piece of state that the tick loop needs gets its own ref + sync effect. Never add state directly to the useEffect deps array (except `timescale`).

### 2. Surgical Edits Over Rewrites
Prefer targeted `str_replace` edits. Only do full rewrites when the change touches >40% of the file or fixes a fundamental architecture issue.

### 3. Read Before Writing
Always read the relevant sections of the file before making edits. Never edit from memory.

### 4. Plan Before Coding
For any feature that touches more than 2 systems: write out the exact data structure changes, state changes, and which functions are affected before writing a line of code.

### 5. Derived State Over Separate State
`unassigned` = `colonists.filter(c => c.status === "idle").length` — don't track separately.
`popCap` = calculated from grid — don't track separately.
If a value can be computed from existing state, don't add new state for it.

### 6. The Colonist Object Shape
```js
{ 
  id: string,           // unique, e.g. "c${Date.now()}-${Math.random()}"
  name: string,         // from NAME_POOL
  status: "idle" | "working" | "onExpedition" | "injured" | "onSentry",
  injuryTicksLeft: number | undefined,
}
```
Intentionally flat. Don't add deeply nested properties.

### 7. Room `special` Flag Pattern
Rooms with behavior beyond produce/consume get a `special` string. The tick loop skips standard production for special rooms. Current special values: `"barracks"`, `"armory"`, `"hospital"`, `"researchLab"`, `"sentryPost"`.

### 8. RAID_SIZES Config
Add new raid tiers by adding to `RAID_SIZES` — the system is data-driven:
```js
const RAID_SIZES = {
  small:  { label: "SMALL",  targets: 1, icon: "⚡", duration: 20, strikeEvery: 10 },
  medium: { label: "MEDIUM", targets: 2, icon: "🔥", duration: 30, strikeEvery: 10 },
  large:  { label: "LARGE",  targets: 3, icon: "💀", duration: 60, strikeEvery: 10 },
  // boss: { label: "BOSS", targets: 5, icon: "☠", duration: 100, strikeEvery: 8 },
};
```
Boss tier is planned — add to `RAID_SIZE_ORDER` when ready.

---

## Planned Next Steps (in order)

### Next — Radio Tower (functional)
- When raid window opens, reveal the raid size immediately in the banner (currently always shown — needs to be hidden without Radio Tower)
- Currently the banner shows size during the window regardless; make it "UNKNOWN" without Radio Tower

### Then — Shelter (functional)
- Grid building, cap 4 colonists
- "SOUND ALARM" button: moves colonists to `status: "sheltered"`, stores `previousRoom` on colonist
- Sheltered colonists immune to raid strikes
- "BACK TO WORK" returns them via `previousRoom` (or idle if room was damaged)
- Makes the Large raid 60-tick duration meaningful — player must actively manage shelter

### Then — Boss Raid Tier
- New entry in `RAID_SIZES`: 5 targets, 100 ticks, strikeEvery: 8
- Needs Shelter to be survivable
- Special intro message / different banner color

### Future — Colonist Depth
- Colonists gain `ticksInColony`, `history[]`
- Click a colonist card to open a profile panel
- This is a standalone feature — do not start until Shelter is done

### Future — T3 Tech Tree
Plan exists but don't design until T2 is fully implemented and tested.

---

## Key Design Principles

**Expansion should feel dangerous.** Every room built increases threat. The player should feel the weight of growing the colony, not just the benefits.

**Named colonists should hurt to lose.** The name system exists so "VASQUEZ was KILLED" lands differently than "-1 colonist." Don't abstract it back away.

**Information before agency.** Radio Tower is useless without Shelter. Don't add warnings the player can't act on. Every information system needs a corresponding action system.

**Arc Raiders flavor.** The Arc is overwhelming machine intelligence — you don't beat it, you survive around it. Defenses are about mitigation and delay, not domination. The tone should feel like a losing battle you're winning through cleverness.
