# Speranza.jsx — Feature Implementation Brief

You are adding several interconnected systems to an existing React colony management game (`Speranza.jsx`). The file is ~1610 lines of single-component React JSX with no build tools. Read the entire file before writing a single line. Implement in the exact order listed below — each pass must be complete and working before the next begins. Run a Babel JSX syntax check after every pass.

---

## Architecture Rules — Do Not Break These

- The tick loop uses `useEffect` with `[timescale]` as its only dependency. ALL state read inside the tick loop must go through a ref. Pattern: `const xRef = useRef(x); useEffect(() => { xRef.current = x; }, [x]);`
- Never add state variables to the tick loop dependency array.
- Prefer surgical `str_replace` edits. Read the target section before editing.
- Run a syntax check after every pass: `node -e "require('@babel/parser').parse(require('fs').readFileSync('Speranza.jsx','utf8'),{sourceType:'module',plugins:['jsx']}); console.log('OK')"`

---

## New State to Add

```js
// Colony-wide
const [morale, setMorale] = useState(50);              // -100 to +100, starts at 50
const [unlockedRows, setUnlockedRows] = useState([0]); // which grid rows are buildable
const [surfaceHaul, setSurfaceHaul] = useState({ salvage: 0, arcTech: 0, schematics: [] });
const [excavations, setExcavations] = useState({});    // { [rowIndex]: { workersAssigned, ticksLeft, totalTicks } | null }
```

Add refs for all of these that the tick loop needs: `moraleRef`, `unlockedRowsRef`, `surfaceHaulRef`, `excavationsRef`.

---

## New Colonist Fields

Add to `COLONIST_BASE()`:
```js
// already exists: xp, level, traits, dutyTicks, ticksAlive, pendingTraitPick
// add nothing new — excavating is a status, not a field
```

Add `"excavating"` to the status system:
- `STATUS_COLOR`: `"#a0522d"` (brown)
- `STATUS_LABEL`: `"EXCAVATING"`
- Excavating colonists count as row 3 weight for raid targeting (deepest, safest)
- Excavating colonists cannot be assigned to rooms or expeditions

---

## Pass 1 — Foundation: Rows, Surface Haul, Morale State

### 1a. Grid Row Locking

Change `GRID_ROWS` logic so locked rows render differently. The grid still has 4 rows internally, but cells in locked rows cannot be built on.

**In `handleBuild`:** Check `unlockedRows.includes(r)` — if not, log `"⚠ This level is not excavated yet"` and return.

**Grid cell render:** Locked rows (row index not in `unlockedRows`) render as:
```
background: "#040508"
All cells in the row replaced by a single full-width locked row bar showing:
  🔒  -[depth]m  SEALED — excavation required
  A "DIG" button on the right side
```
Use `r === 0` as -10m, `r === 1` as -20m, `r === 2` as -30m, `r === 3` as -40m.

The locked row replaces the normal 7-cell render for that row. It still takes the same height (~78px).

**DIG button behavior:** Opens a dig confirmation in the side panel (reuse `selected` state by setting `selected = { dig: true, row: r }`). Or simpler: clicking DIG directly calls `handleStartExcavation(r)` if affordable.

### 1b. Excavation Mechanic

**Excavation costs:**
```js
const EXCAVATION_DEFS = {
  1: { scrap: 40,  workers: 1, ticks: 15, label: "-20m", discovery: "Old utility tunnels. Power Cell costs 5 less scrap on this level." },
  2: { scrap: 80,  workers: 2, ticks: 25, label: "-30m", discovery: "Pre-Arc storage vaults. +60 scrap found in the rubble." },
  3: { scrap: 150, workers: 2, ticks: 40, label: "-40m", discovery: "Deep geothermal vents detected. Geothermal Generator unlocked." },
};
```

**`handleStartExcavation(rowIndex)`:**
1. Check scrap cost. Deduct scrap.
2. Find N idle colonists (N = `workers` required for that row). If fewer available, take what's available (partial workers = slower dig, see tick loop).
3. Set those colonists to `status: "excavating"`.
4. Set `excavations[rowIndex] = { workersAssigned: actualCount, ticksLeft: totalTicks, totalTicks }` where `totalTicks = Math.ceil(def.ticks * (def.workers / actualCount))` — fewer workers = proportionally longer.
5. Log: `"⛏ Excavation of ${def.label} begun. ${actualCount} worker(s) assigned."`

**In tick loop — excavation progress (add as step 6 after XP accumulation):**
```
For each active excavation:
  decrement ticksLeft by 1
  if ticksLeft <= 0:
    unlock the row: setUnlockedRows(prev => [...prev, rowIndex])
    free excavating colonists back to idle
    fire discovery event toast + log
    if row 2 discovery: setRes(prev => ({...prev, scrap: prev.scrap + 60}))
    remove from excavations
```

**Partial worker handling:** `ticksLeft` is already pre-calculated at dig start with the slower rate factored in. No special tick logic needed.

**Excavation progress bar:** Show in locked row UI — if `excavations[r]` exists, replace the DIG button with a progress bar: `ticksLeft / totalTicks`.

### 1c. Surface Haul Display

Add a `SurfaceHaul` display section after the resource bars, only visible if `surfaceHaul.salvage > 0 || surfaceHaul.arcTech > 0 || surfaceHaul.schematics.length > 0`.

```
🔩 SALVAGE: {salvage}   ⚙️ ARC TECH: {arcTech}   📋 SCHEMATICS: {schematics.length}
```

Styled like the RP bar — compact, dark background.

### 1d. Morale State + Display

Add a morale bar to the header, between the threat meter and the colonist counter.

**Morale bar display:**
- Label: MORALE
- Value: `Math.floor(morale)` with sign
- Color: `morale > 50 ? "#7ed321" : morale > 0 ? "#f5a623" : morale > -50 ? "#ff7744" : "#ff2222"`
- Tier label: `morale > 75 ? "THRIVING" : morale > 25 ? "STABLE" : morale > 0 ? "UNEASY" : morale > -50 ? "STRAINED" : morale > -75 ? "FRACTURED" : "COLLAPSE"`
- Bar fills center-out like threat meter, but bidirectional: positive = green right half, negative = red left half
- Range display: -100 to +100, bar center = 0

**No mechanical effects yet — just display. Effects come in Pass 3.**

---

## Pass 2 — Morale Events (Wiring Existing Systems)

Add morale changes to existing event code. Use a helper:
```js
const changeMorale = useCallback((delta, reason) => {
  setMorale(prev => clamp(prev + delta, -100, 100));
  // only log reason if delta <= -10 or delta >= +10 (skip small changes to avoid log spam)
  if (Math.abs(delta) >= 10) addLog(`${delta > 0 ? "📈" : "📉"} Morale ${delta > 0 ? "+" : ""}${delta} — ${reason}`);
}, []);
```

Add `changeMorale` ref so tick loop can call it.

**Wire these morale events:**

| Location in code | Event | Delta |
|---|---|---|
| Colonist flees (roll < 0.50 branch) | Colonist fled | -5 |
| Colonist injured (roll 0.50–0.80 branch) | Colonist injured in raid | -10 |
| Colonist killed (roll > 0.80 branch) | Colonist killed | -20 |
| Each arc strike fires (per strike, regardless of outcome) | Raid strike landed | -3 |
| Raid fully repelled by barricades | Barricades held | +10 |
| Raid ends (activeRaid ticksLeft <= 0) | Raid survived | +8 |
| Expedition returns successful | Successful run | +8 |
| Expedition returns failed | Mission failed | -5 |
| Colonist levels up (in XP step) | Morale boost from achievement | +5 |

**In tick loop — passive morale drain (add at start of tick, before resource production):**
```js
const colCount = colonistsRef.current.length;
const moraleBuildings = // count tavern + dining hall workers (from grid)
const moraleDrain = colCount * 0.3;
const moraleGain = moraleBuildings * 1.5;
const netMoraleDelta = moraleGain - moraleDrain;
setMorale(prev => clamp(prev + netMoraleDelta, -100, 100));
```

Also add veteran passive morale gain:
```js
const veteranCount = colonistsRef.current.filter(c => c.traits?.includes("veteran")).length;
setMorale(prev => clamp(prev + veteranCount * 0.1, -100, 100));
```

**Morale tier effects on production (add to resource production step):**
```js
// After normal production calculation, apply morale multiplier
const moraleMultiplier = moraleRef.current > 75 ? 1.1 : 1.0;
// Apply: next[r] += (produced amount * 0.1) if moraleMultiplier > 1
```

**Morale collapse mechanic (add after healing step in tick loop):**
```js
if (moraleRef.current <= -100) {
  // 10% chance per tick a colonist deserts
  if (Math.random() < 0.10) {
    const vulnerable = cols.filter(c => c.status === "idle" || c.status === "working");
    if (vulnerable.length > 0) {
      const deserter = vulnerable[Math.floor(Math.random() * vulnerable.length)];
      setColonists(prev => prev.filter(c => c.id !== deserter.id));
      setMorale(prev => clamp(prev - 15, -100, 100));
      addLog(`🚪 ${deserter.name} has deserted — morale has collapsed.`);
      addToast(`🚪 DESERTION\n${deserter.name} left the colony.\nMorale has completely collapsed.`, "raid");
    }
  }
}
```

**Strained behavior (-50 to 0 morale):**
```js
if (moraleRef.current < 0 && moraleRef.current > -50) {
  if (Math.random() < 0.05) {
    const working = cols.filter(c => c.status === "working");
    if (working.length > 0) {
      const refuser = working[Math.floor(Math.random() * working.length)];
      setColonists(prev => prev.map(c => c.id === refuser.id ? { ...c, status: "idle" } : c));
      setGrid(prev => {
        const ng = prev.map(row => row.map(c => ({ ...c })));
        ng.forEach((row, r) => row.forEach((cell, c) => {
          if (cell.type && cell.workers > 0) {
            // find the cell this colonist was in and decrement
          }
        }));
        return ng;
      });
      addLog(`😤 ${refuser.name} refused their post — morale is strained.`);
    }
  }
}
```
Note: For the strained refusal, since we can't easily map colonist→room, simplify: just set colonist to idle and call `setGrid` to decrement workers from a random staffed room (same pattern as raid worker decrement).

---

## Pass 3 — New Buildings: Tavern + Dining Hall

Add to `ROOM_TYPES`:

```js
tavern: {
  label: "Tavern",        icon: "🍺", color: "#d4a843", bg: "#1a1000", border: "#d4a843",
  cost: { scrap: 40 },   produces: {}, consumes: { water: 1, energy: 1 }, cap: 2,
  desc: "Boosts colony morale. Each bartender generates +1.5 morale/tick. Requires water + energy.",
  special: "tavern",
},
diningHall: {
  label: "Dining Hall",   icon: "🍽", color: "#e8855a", bg: "#1a0a00", border: "#e8855a",
  cost: { scrap: 35 },   produces: {}, consumes: { food: 2, energy: 1 }, cap: 2,
  desc: "Boosts colony morale. Each cook generates +1.5 morale/tick. Requires food + energy.",
  special: "diningHall",
},
```

These produce no standard resources — morale gain is handled in the tick loop passive morale section by counting workers in `tavern` and `diningHall` rooms:

```js
let moraleWorkers = 0;
g.forEach(row => row.forEach(cell => {
  if ((cell.type === "tavern" || cell.type === "diningHall") && cell.workers > 0) {
    moraleWorkers += cell.workers;
  }
}));
```

Tavern and Dining Hall should consume their resources (`water`/`food`/`energy`) through the standard production loop. Add them to the production loop skip conditions — they consume but produce nothing in `res` (their output is morale). Handle consumption manually like the armory energy drain:

```js
// After main production loop
g.forEach(row => row.forEach(cell => {
  if (cell.type === "tavern" && cell.workers > 0) {
    next.water  = clamp(next.water  - 1 * cell.workers, 0, MAX_RES);
    next.energy = clamp(next.energy - 1 * cell.workers, 0, MAX_RES);
  }
  if (cell.type === "diningHall" && cell.workers > 0) {
    next.food   = clamp(next.food   - 2 * cell.workers, 0, MAX_RES);
    next.energy = clamp(next.energy - 1 * cell.workers, 0, MAX_RES);
  }
}));
```

Add `"tavern"` and `"diningHall"` to the production skip list alongside `"barracks"` and `"armory"`.

---

## Pass 4 — Expedition Overhaul

### Expedition State Shape Change

Replace the existing expedition state (single object) with an array of up to 2 active expeditions:

```js
const [expeditions, setExpeditions] = useState([]); // max 2
```

Update all references from `expedition` → `expeditions[0]` or map over the array where needed. Update `expedRef` to match.

Each expedition object:
```js
{
  id: string,                  // unique
  type: "scav" | "strike",
  duration: number,            // total ticks chosen by player
  ticksLeft: number,
  rollEvery: number,           // scav: 8, strike: 6
  rollCountdown: number,       // counts down to next roll
  colonistIds: string[],
  eventLog: string[],          // ["T42: CHEN found salvage.", ...]
  lootAccumulated: { scrap: 0, salvage: 0, arcTech: 0, survivor: false },
  moraleSnapshot: number,      // morale at launch time, used as modifier
  risk: "scav" | "strike",    // same as type for now, extensible later
}
```

### Player Duration Choice

In the Armory expedition launch UI, replace the single launch button with:

1. A duration selector — four buttons: **20t / 40t / 60t / 80t**
2. A selected duration state (local, default 40)
3. Launch button triggers with the selected duration

### Roll Tables

```js
const EXPEDITION_ROLL_TABLES = {
  scav: [
    { id: "scrap_cache",  weight: 35, type: "good",    label: "Found a scrap cache",          apply: (e) => ({ scrap: randBetween(15, 30) }) },
    { id: "salvage",      weight: 25, type: "good",    label: "Recovered salvage",             apply: (e) => ({ salvage: randBetween(2, 4) }) },
    { id: "survivor",     weight: 8,  type: "good",    label: "Encountered a survivor",        apply: (e) => ({ survivor: true }) },
    { id: "nothing",      weight: 20, type: "neutral", label: "Nothing found — kept moving",   apply: (e) => ({}) },
    { id: "injured",      weight: 8,  type: "bad",     label: "took a hit",                    apply: (e) => "injure" },
    { id: "killed",       weight: 4,  type: "bad",     label: "was killed",                    apply: (e) => "kill" },
  ],
  strike: [
    { id: "arc_tech",     weight: 30, type: "good",    label: "Salvaged Arc Tech components",  apply: (e) => ({ arcTech: randBetween(1, 2) }) },
    { id: "salvage",      weight: 25, type: "good",    label: "Recovered salvage haul",        apply: (e) => ({ salvage: randBetween(3, 6) }) },
    { id: "schematic",    weight: 5,  type: "good",    label: "Found a schematic",             apply: (e) => ({ schematic: true }) },
    { id: "ambush",       weight: 15, type: "neutral", label: "Ambushed — retreated empty",    apply: (e) => ({}) },
    { id: "injured",      weight: 15, type: "bad",     label: "took a hit",                    apply: (e) => "injure" },
    { id: "killed",       weight: 10, type: "bad",     label: "was killed",                    apply: (e) => "kill" },
  ],
};

function randBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
```

**Morale modifier on rolls:**
```js
function applyMoraleModifier(table, moraleSnapshot) {
  const modifier = moraleSnapshot > 75 ? 1.15 : moraleSnapshot > 25 ? 1.0 : moraleSnapshot > 0 ? 0.9 : 0.8;
  return table.map(entry => ({
    ...entry,
    weight: entry.type === "good" ? entry.weight * modifier
          : entry.type === "bad"  ? entry.weight / modifier
          : entry.weight,
  }));
}
```

**Trait modifiers on rolls:**
- Colonist has `scavenger` trait on a scav run: good event weights × 1.15
- Colonist has `ghost` trait: bad event weights × 0.9
- Apply per-colonist, stacking (multiply sequentially)

### Roll Resolution in Tick Loop

Replace the existing expedition countdown block with:

```js
// For each active expedition:
setExpeditions(prev => prev.map(exp => {
  let updated = { ...exp, ticksLeft: exp.ticksLeft - 1, rollCountdown: exp.rollCountdown - 1 };

  // Roll fires this tick
  if (updated.rollCountdown <= 0 && updated.ticksLeft > 0) {
    const cols = colonistsRef.current;
    const expColonists = cols.filter(c => exp.colonistIds.includes(c.id));
    
    // Build modified table
    let table = [...EXPEDITION_ROLL_TABLES[exp.type]];
    // Apply morale modifier
    table = applyMoraleModifier(table, exp.moraleSnapshot);
    // Apply trait modifiers
    expColonists.forEach(col => {
      if (col.traits?.includes("scavenger") && exp.type === "scav") {
        table = table.map(e => ({ ...e, weight: e.type === "good" ? e.weight * 1.15 : e.weight }));
      }
      if (col.traits?.includes("ghost")) {
        table = table.map(e => ({ ...e, weight: e.type === "bad" ? e.weight * 0.9 : e.weight }));
      }
    });

    // Weighted random pick
    const totalWeight = table.reduce((s, e) => s + e.weight, 0);
    let rand = Math.random() * totalWeight;
    let picked = table[table.length - 1];
    for (const entry of table) { rand -= entry.weight; if (rand <= 0) { picked = entry; break; } }

    // Resolve outcome
    const result = picked.apply(exp);
    const tickLabel = `[T${tickRef.current}]`;

    if (result === "injure" || result === "kill") {
      const target = expColonists[Math.floor(Math.random() * expColonists.length)];
      if (target) {
        if (result === "injure") {
          setColonists(prev => prev.map(c => c.id === target.id ? { ...c, status: "injured", injuryTicksLeft: INJURY_TICKS_BASE } : c));
          updated.eventLog = [...updated.eventLog, `${tickLabel} ${target.name} ${picked.label}.`];
          changeMoraleRef.current(-10, "colonist injured on expedition");
          playInjury();
        } else {
          setColonists(prev => prev.filter(c => c.id !== target.id));
          updated.eventLog = [...updated.eventLog, `${tickLabel} ${target.name} ${picked.label}.`];
          changeMoraleRef.current(-20, "colonist killed on expedition");
          playKill();
        }
      }
    } else if (typeof result === "object") {
      // Accumulate loot
      const newLoot = { ...updated.lootAccumulated };
      if (result.scrap)    { newLoot.scrap    = (newLoot.scrap    || 0) + result.scrap;    }
      if (result.salvage)  { newLoot.salvage  = (newLoot.salvage  || 0) + result.salvage;  }
      if (result.arcTech)  { newLoot.arcTech  = (newLoot.arcTech  || 0) + result.arcTech;  }
      if (result.survivor) { newLoot.survivor = true; }
      if (result.schematic) {
        // Pick a random unowned schematic
        const allSchematics = ["turretSchematics","empSchematics","fortSchematics","geoSchematics","researchSchematics"];
        const owned = surfaceHaulRef.current.schematics;
        const available = allSchematics.filter(s => !owned.includes(s));
        if (available.length > 0) {
          const found = available[Math.floor(Math.random() * available.length)];
          newLoot.schematicFound = found;
          updated.eventLog = [...updated.eventLog, `${tickLabel} 📋 SCHEMATIC FOUND — ${found}!`];
          addToast(`📋 SCHEMATIC RECOVERED\n${found}\nCheck the build menu.`, "success");
        }
      }
      updated.lootAccumulated = newLoot;
      if (picked.type === "good") {
        updated.eventLog = [...updated.eventLog, `${tickLabel} ${picked.label}. +${JSON.stringify(result)}`];
      } else {
        updated.eventLog = [...updated.eventLog, `${tickLabel} ${picked.label}.`];
      }
    }

    updated.rollCountdown = exp.rollEvery; // reset countdown
  }

  // Expedition ends
  if (updated.ticksLeft <= 0) {
    const loot = updated.lootAccumulated;
    // Apply accumulated loot to game state
    if (loot.scrap)   setRes(prev => ({ ...prev, scrap: clamp(prev.scrap + loot.scrap, 0, MAX_RES) }));
    if (loot.salvage || loot.arcTech || loot.schematicFound) {
      setSurfaceHaul(prev => ({
        salvage:    prev.salvage + (loot.salvage  || 0),
        arcTech:    prev.arcTech + (loot.arcTech  || 0),
        schematics: loot.schematicFound ? [...prev.schematics, loot.schematicFound] : prev.schematics,
      }));
    }
    if (loot.survivor) {
      // Spawn a new colonist
      const newCol = makeColonist();
      setColonists(prev => [...prev, newCol]);
      addLog(`🧍 Surface survivor found — ${newCol.name} joined the colony!`);
    }
    // Return colonists still alive to idle
    setColonists(prev => prev.map(c => updated.colonistIds.includes(c.id) ? { ...c, status: "idle" } : c));
    const hasGoodLoot = loot.scrap > 0 || loot.salvage > 0 || loot.arcTech > 0;
    addLog(`✅ Expedition returned. ${hasGoodLoot ? "Haul: " + JSON.stringify(loot) : "Empty-handed."}`);
    addToast(`✅ EXPEDITION COMPLETE\n${hasGoodLoot ? "Resources recovered." : "They came back empty-handed."}`, hasGoodLoot ? "success" : "info");
    changeMoraleRef.current(hasGoodLoot ? 8 : -5, hasGoodLoot ? "expedition success" : "expedition failed");
    playSuccess();
    return null; // mark for removal
  }

  return updated;
}).filter(Boolean)); // remove completed expeditions
```

### Expedition UI in Armory Panel

Replace the existing expedition countdown with a live expedition panel showing:
- Expedition type + risk label
- Ticks remaining + progress bar
- Colonist names
- Last 5 lines of `eventLog` (scrollable, newest at bottom)
- Accumulated loot preview: `🔩 3 salvage · ⚙️ 1 Arc Tech · +40 scrap`

Duration picker and launch button (when no expeditions active or only 1 active):
- Four duration buttons: 20t / 40t / 60t / 80t (selected one highlighted)
- Show expected rolls at current duration: `~${Math.floor(duration / rollEvery)} rolls`
- Launch button disabled if not enough idle colonists

---

## Pass 5 — Row-Based Raid Targeting

### Weighted Targeting by Row

When selecting colonist targets during a strike, use weighted random selection instead of `slice(0, n)`:

```js
function weightedTargetPick(colonists, grid) {
  // assign each colonist a weight based on their room's row
  const rowWeights = [4, 3, 2, 1]; // row 0 = most exposed
  const weighted = colonists.map(col => {
    // find which row their room is in
    let rowIdx = 0;
    grid.forEach((row, r) => row.forEach(cell => {
      if (cell.workers > 0 && col.status === "working") rowIdx = r; // approximate
    }));
    if (col.status === "idle") rowIdx = 0;         // idle = surface level risk
    if (col.status === "onSentry") rowIdx = 0;     // sentries are exposed
    if (col.status === "excavating") rowIdx = 3;   // excavating = deepest
    return { col, weight: rowWeights[rowIdx] ?? 1 };
  });
  // weighted random pick N targets without replacement
  const targets = [];
  for (let i = 0; i < sizeDef.targets && weighted.length > 0; i++) {
    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let rand = Math.random() * total;
    for (let j = 0; j < weighted.length; j++) {
      rand -= weighted[j].weight;
      if (rand <= 0) { targets.push(weighted[j].col); weighted.splice(j, 1); break; }
    }
  }
  return targets;
}
```

Replace `atRisk.slice(0, sizeDef.targets)` with `weightedTargetPick(atRisk, g)`.

For **building damage**, also weight by row — row 0 rooms are 4× more likely to be damaged than row 3 rooms:

```js
const weightedRooms = [];
g.forEach((row, r) => row.forEach((cell, c) => {
  if (cell.type && !cell.damaged) {
    const w = [4, 3, 2, 1][r] ?? 1;
    for (let i = 0; i < w; i++) weightedRooms.push({ r, c, type: cell.type });
  }
}));
// then pick randomly from weightedRooms
```

---

## Pass 6 — T3 Buildings (Schematic-Gated)

Add to `ROOM_TYPES`:

```js
arcTurret: {
  label: "Arc Turret",       icon: "🔫", color: "#ff6622", bg: "#1a0800", border: "#ff6622",
  cost: { scrap: 60, salvage: 8, arcTech: 3 }, produces: {}, consumes: { energy: 2 }, cap: 1,
  desc: "Automated defense. 30% chance per strike to eliminate one incoming Arc unit.",
  special: "arcTurret", requiresSchematic: "turretSchematics",
},
empArray: {
  label: "EMP Array",        icon: "⚡🔲", color: "#bb44ff", bg: "#10001a", border: "#bb44ff",
  cost: { scrap: 80, salvage: 10, arcTech: 5 }, produces: {}, consumes: { energy: 3 }, cap: 1,
  desc: "Requires 1 operator. 50% to reduce raid by 1 target. Delays next strike +3 ticks.",
  special: "empArray", requiresSchematic: "empSchematics",
},
blastDoors: {
  label: "Blast Doors",      icon: "🚪🛡", color: "#aaaaaa", bg: "#111114", border: "#aaaaaa",
  cost: { scrap: 50, salvage: 6, arcTech: 2 }, produces: {}, consumes: {}, cap: 0,
  desc: "Passive. 40% chance to absorb building damage on row 0 per strike.",
  special: "blastDoors", requiresSchematic: "fortSchematics",
},
geothermal: {
  label: "Geothermal Gen",   icon: "🌋", color: "#ff8800", bg: "#1a0800", border: "#ff8800",
  cost: { scrap: 70, salvage: 12, arcTech: 4 }, produces: { energy: 6 }, consumes: {}, cap: 0,
  desc: "Passive energy generation. No workers needed. Unlocked by -40m excavation.",
  special: "geothermal", requiresSchematic: "geoSchematics",
},
```

**Build cost handling:** `handleBuild` must check `surfaceHaul.salvage >= cost.salvage` and `surfaceHaul.arcTech >= cost.arcTech` and deduct from `surfaceHaul` on build.

**Schematic gate in build menu:**
```js
// Filter ROOM_TYPES entries for the build menu:
if (def.requiresSchematic && !surfaceHaul.schematics.includes(def.requiresSchematic)) return null;
// T3 buildings also only unlockable after row excavation (must be placed in rows 1-3)
```

**T3 defense effects in active raid tick:**

```js
// Before targets are selected, check T3 defenses
let raidSizeReduction = 0;
g.forEach(row => row.forEach(cell => {
  if (cell.type === "arcTurret" && cell.workers > 0) { // workers = powered/active
    if (Math.random() < 0.30) raidSizeReduction++;
  }
  if (cell.type === "empArray" && cell.workers > 0) {
    if (Math.random() < 0.50) {
      raidSizeReduction++;
      // delay strike countdown
      // (handle by adding to strikeCountdown in activeRaid state)
    }
  }
}));
const effectiveTargets = Math.max(1, sizeDef.targets - raidSizeReduction);
if (raidSizeReduction > 0) {
  addLog(`🔫 Defenses eliminated ${raidSizeReduction} Arc unit(s) — raid reduced!`);
}
```

For Blast Doors: in the building damage roll, skip row 0 rooms 40% of the time if `blastDoors` room exists.

---

## handleRestart Updates

Add resets for all new state:
```js
setMorale(50);
setUnlockedRows([0]);
setSurfaceHaul({ salvage: 0, arcTech: 0, schematics: [] });
setExcavations({});
setExpeditions([]);
```

---

## Colonist Trait Mechanic Wiring (Step D from existing plan)

While you're in the expedition code, wire the remaining trait mechanics:

**VETERAN** — in the flee branch (`roll < 0.50`): check if target has `veteran` trait. If yes, skip the flee — colonist holds their post. Log: `"${target.name} held their post — veteran resolve."`

**IRON LUNGS** — in the heal step: if colonist has `ironLungs`, `healRate *= 2`.

**HARDENED** — in the injury branch (`roll < 0.80`): if target has `hardened` trait, re-roll injury at 20% threshold instead of 30% (i.e. `roll < 0.70` for flee, `roll < 0.80` becomes injury only if `roll > 0.70` — shift the injury window down).

**GHOST** — in `weightedTargetPick`: colonists with `ghost` trait have their weight halved.

---

## Implementation Notes

- `changeMorale` needs to be accessible in the tick loop — add `changeMoraleRef` as a ref.
- The expedition `eventLog` is display-only — don't add it to any ref, it doesn't affect game logic.
- `surfaceHaul` needs a ref (`surfaceHaulRef`) because the expedition tick loop reads it for schematic deduplication.
- Arc Turret has `cap: 0` (automated, no workers) but still needs `consumes: { energy: 2 }` — handle this the same way as Armory's energy drain (manual deduction after main production loop).
- Geothermal Generator has `cap: 0` and `produces: { energy: 6 }` — it runs automatically like a passive building. Handle in production loop but skip the `workers > 0` check for it specifically.
- Keep `THREAT_RAID_THRESHOLD = 500` (test value) — do not reset to 100.
- Do not modify `sounds.js` — all sound hooks are already imported and working.
