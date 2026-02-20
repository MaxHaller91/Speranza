================================================================================
SESSION A — UI & FEEL
================================================================================

You are working on a React colony management game called Speranza. It is a Vite
project using ES modules.

File to edit: Y:\Coding\PYTHON\Speranza Game\src\speranza.jsx

Read the entire file before making any changes. This session makes zero changes
to game mechanics. Every change is presentation and UI only. Do not touch the
tick loop logic, raid system, expedition logic, or resource calculations except
the morale drain fix explicitly described below.

---

CHANGE 1: DAY/HOUR DISPLAY

Add this helper function near the top of the file, before the main component:

  const tickToDayHour = (t) => {
    const day = Math.floor(t / 48) + 1;
    const totalHalfHours = t % 48;
    const hour = String(Math.floor(totalHalfHours / 2)).padStart(2, '0');
    const min = totalHalfHours % 2 === 1 ? '30' : '00';
    return `DAY ${day} · ${hour}:${min}`;
  };

Find the header section that displays the current tick number. Replace the tick
display with tickToDayHour(tick). Do NOT remove the tick variable from state —
it is used throughout the game logic. Only stop displaying it in the header UI.

---

CHANGE 2: REMOVE ROOM TYPES LEGEND PANEL

Find the panel or section in the side panel area that renders a static list or
legend of all available room types. This is purely decorative reference content.
Delete this entire block.

After deletion, the side panel empty state should show:
- If memorial array in state has entries: render the memorial wall (see Change 3)
- If memorial is empty: a single centered line of muted gray text:
  "Select a cell to build or manage a room"

---

CHANGE 3: MEMORIAL WALL

Add memorial to state if it does not already exist:
  memorial: []

Each memorial entry shape:
  { name, level, traits, quirk, cause, day, hour, backstory, epitaph }

Add a helper that creates a memorial entry when a colonist dies. Call it from
every place in the code where a colonist is removed due to death. Pass the
appropriate cause string: 'raidKilled' | 'expeditionKilled' | 'raidFled' | 'moraleDeath'

The helper should:
1. Look up the colonist's full data
2. Convert current tick to day/hour using tickToDayHour
3. Pick a random epitaph from the appropriate pool below
4. Push the entry to memorial state

Epitaph pools:
  raidKilled:       ["Held their post. Didn't make it.", "Was in the wrong room when the strike hit.", "Didn't run. That wasn't in them.", "Took the hit that was meant for someone else. Maybe.", "Died the way they lived — at their post."]
  expeditionKilled: ["Went topside one too many times.", "The surface takes eventually. It took them.", "Knew the risk. Went anyway. That was them.", "Their last transmission was clear. Then it wasn't.", "Volunteered for the run. Nobody made them."]
  raidFled:         ["Left during a raid. Nobody blames them. Not out loud.", "The fear got them in the end.", "Decided the odds weren't worth it."]
  moraleDeath:      ["The colony couldn't hold them here anymore.", "Left when the lights went out in people's eyes.", "Walked into the tunnels. Didn't say goodbye."]

Memorial wall render (shown in side panel when nothing selected and memorial has entries):
  Scrollable div with heading "MEMORIAL" in small caps, bottom border.
  For each entry (most recent first):
    - Name in white bold + "LVL X" in muted text on same line
    - Cause and day/hour in orange: "Killed in raid — DAY 4 · 06:00"
    - Epitaph in italic muted smaller text
    - Thin separator line between entries
  Max height with overflow-y: auto.

---

CHANGE 4: HOVER TOOLTIPS ON BUILT ROOMS

Add to state:
  hoveredCell: null   (shape: { r: number, c: number } | null)

On each grid cell div that contains a built room:
  Add onMouseEnter={() => setHoveredCell({r, c})}
  Add onMouseLeave={() => setHoveredCell(null)}

Render a tooltip div when hoveredCell matches a built room cell. Position it
absolutely near the cell. Style: dark background (#1a1a2e), 1px border, padding,
z-index 999.

Tooltip content:
  Line 1: Room icon + room name in white bold
  Line 2: "Workers: X / X"
  Line 3: Net production per tick — each resource the room produces or consumes,
           e.g. "+2 food/tick" in green, "-1 water/tick" in red
  Line 4: If damaged: "⚠ DAMAGED — repair: X scrap" in orange
  Line 5 per special rooms:
           Hospital → "Patients: X"
           Research Lab → "+X RP/tick"
           Sentry Post → "Guards: X"
           Barricade → show durability if tracked

No tooltip on empty cells, locked rows, or entrance row.

---

CHANGE 5: MORALE DRAIN FIX

Find the passive morale drain calculation in the tick loop. Replace it with:

  const drainableColonists = Math.max(0, colonists.length - 7);
  const moraleDrain = drainableColonists * 0.3;

Zero drain at 7 or fewer colonists. Scales from there. Do not change anything
else about morale.

---

CHANGE 6: COLONY MILESTONES

Add to state:
  firedMilestones: []    (array of milestone id strings)
  milestoneToast: null   (shape: { title, text } | null)

Add these counters to state if they don't already exist:
  raidsRepelled: 0
  expeditionsCompleted: 0

Increment raidsRepelled wherever a raid ends with the colony surviving.
Increment expeditionsCompleted wherever an expedition returns successfully.

Add this milestone definitions array before the component:

  const MILESTONE_DEFS = [
    { id: 'firstRaidSurvived',    check: (s) => s.raidsRepelled >= 1,           title: 'FIRST RAID REPELLED',       text: "They found you. You're still here. That won't be the last of them." },
    { id: 'firstDeath',           check: (s) => s.memorial.length >= 1,          title: 'THE FIRST LOSS',             text: "We lost our first. It won't be the last. Remember them." },
    { id: 'firstExpedReturn',     check: (s) => s.expeditionsCompleted >= 1,     title: 'FIRST EXPEDITION RETURNED',  text: "They came back. That's not always guaranteed." },
    { id: 'pop8',                 check: (s) => s.colonists.length >= 8,         title: 'EIGHT COLONISTS',            text: "Eight mouths. Eight reasons to keep the lights on." },
    { id: 'pop12',                check: (s) => s.colonists.length >= 12,        title: 'TWELVE COLONISTS',           text: "A real colony now. With all the problems that come with it." },
    { id: 'day7',                 check: (s) => s.tick >= 48 * 7,               title: 'ONE WEEK UNDERGROUND',       text: "Seven days. The colony holds." },
    { id: 'day14',                check: (s) => s.tick >= 48 * 14,              title: 'TWO WEEKS',                  text: "Fourteen days. Some colonies don't last this long." },
    { id: 'day30',                check: (s) => s.tick >= 48 * 30,              title: 'ONE MONTH',                  text: "A month in the dark. Keep going." },
    { id: 'day60',                check: (s) => s.tick >= 48 * 60,              title: 'TWO MONTHS',                 text: "Sixty days underground. The colony has outlasted most." },
    { id: 'moraleHigh',           check: (s) => s.morale >= 85,                  title: 'COLONY MORALE: HIGH',        text: "Morale has never been higher. Don't waste it." },
    { id: 'moraleLow',            check: (s) => s.morale <= -50,                 title: 'MORALE: FRACTURED',          text: "People are starting to ask what they're even fighting for." },
    { id: 'firstSchematic',       check: (s) => (s.surfaceHaul?.schematics?.length ?? 0) >= 1,  title: 'SCHEMATIC RECOVERED', text: "Someone built this once. We can build it again." },
    { id: 'firstT3',              check: (s) => s.t3BuiltCount >= 1,             title: 'T3 CONSTRUCTION COMPLETE',   text: "They didn't think we'd make it this far." },
    { id: 'firstLargeRaid',       check: (s) => s.largeRaidsRepelled >= 1,       title: 'LARGE RAID SURVIVED',        text: "A full Arc assault. We're still here." },
  ];

Add t3BuiltCount and largeRaidsRepelled to state, both starting at 0. Increment
t3BuiltCount when a T3 building is built. Increment largeRaidsRepelled when a
large raid is repelled (use whatever threshold the existing raid size logic uses).

Inside the tick loop, after all state changes for that tick, run a milestone check:

  for (const m of MILESTONE_DEFS) {
    if (!newState.firedMilestones.includes(m.id) && m.check(newState)) {
      newState.firedMilestones = [...newState.firedMilestones, m.id];
      newState.milestoneToast = { title: m.title, text: m.text };
      newState.morale = Math.min(100, newState.morale + 5);
      break; // only fire one per tick
    }
  }

Render the milestone toast when milestoneToast is not null:
  Fixed position, horizontally centered, near top of screen (top: 80px).
  Gold border (#ffd700), dark background (#0d0d1a), padding 16px 24px, border-radius 6px.
  Title in bold gold text. Text below in white.
  Auto-dismiss: use a useEffect that watches milestoneToast — when it becomes
  non-null, set a 5 second timeout to clear it.
  pointer-events: none so it doesn't block interaction.
  z-index: 1000.

---

CHANGE 7: COLONIST DETAIL WINDOW

Add to state:
  selectedColonist: null   (colonist id | null)

When a colonist card is clicked anywhere, set selectedColonist to that colonist's
id. If already that id, set to null (toggle).

Add these fields to each colonist object. Set them to 0 at spawn. For existing
colonists already in state that don't have them, default to 0:
  joinTick: 0         (set to current tick at spawn, not 0)
  expeditionsCompleted: 0
  raidsSurvived: 0
  injuryCount: 0

Increment the appropriate field:
  expeditionsCompleted on this colonist when they return from an expedition alive
  raidsSurvived on all surviving colonists when a raid ends
  injuryCount on a colonist when they are injured

When selectedColonist is set, render the colonist detail view in the side panel
replacing all other side panel content.

Colonist detail view:

  Header row:
    Status color dot matching existing status colors
    Name in white bold, large
    Level badge pill: gold background for level 3+, gray for lower
    × close button top right, clears selectedColonist on click

  BACKGROUND section:
    Label "BACKGROUND" small caps muted
    colonist.backstory in italic — if no backstory field, show "No record."

  QUIRK section (only if colonist.quirk exists):
    Label "QUIRK" small caps muted
    Quirk icon + label in a pill
    Quirk desc in muted smaller text

  TRAITS section:
    Label "TRAITS" small caps muted
    Trait pills same style as existing trait rendering elsewhere in the UI

  SERVICE RECORD section:
    Label "SERVICE RECORD" small caps muted
    "Joined:" tickToDayHour(colonist.joinTick)
    "Expeditions completed:" colonist.expeditionsCompleted
    "Raids survived:" colonist.raidsSurvived
    "Times injured:" colonist.injuryCount

  EXPERIENCE section:
    Label "EXPERIENCE" small caps muted
    XP progress bar, same style as existing XP bar but wider
    "Level X · X XP to next level"

  ASSIGNMENT section:
    "Currently:" + status description based on colonist's current status field,
    colored to match status (working = green, injured = yellow, idle = gray, etc.)

Only the × button closes the detail view. Clicking elsewhere does not close it.

---

After all 7 changes, verify syntax and output the complete updated speranza.jsx.


================================================================================
SESSION B — CORE SYSTEMS
================================================================================

You are working on a React colony management game called Speranza. Vite project,
ES modules.

Files:
  Y:\Coding\PYTHON\Speranza Game\src\speranza.jsx     ← edit this
  Y:\Coding\PYTHON\Speranza Game\speranza-lore.js     ← read only, import from here

Read both files completely before making any changes.

---

CHANGE 1: IMPORT LORE FILE

At the top of speranza.jsx add:

  import {
    BACKSTORIES,
    QUIRKS,
    SURFACE_CONDITIONS,
    SURFACE_LOCATIONS,
    DILEMMA_EVENTS,
    EXPEDITION_FLAVOR,
    ARTIFACT_TEMPLATES,
    ARTIFACT_ITEMS,
    COMMANDER_NAMES,
    COMMANDER_WEAKNESSES,
    COMMANDER_STRENGTHS,
    TRADERS,
    DIRECTIVES,
    MILESTONES,
    EPITAPHS,
  } from '../speranza-lore.js';

Replace the hardcoded epitaph pools from Session A with lookups into EPITAPHS
from the lore file. Replace the hardcoded MILESTONE_DEFS array from Session A
with a function that evaluates the MILESTONES array from the lore file:

  const checkMilestones = (state) => {
    const day = Math.floor(state.tick / 48) + 1;
    for (const m of MILESTONES) {
      if (state.firedMilestones.includes(m.id)) continue;
      const t = m.trigger;
      const fired =
        (t.raidsRepelled      && state.raidsRepelled >= t.raidsRepelled) ||
        (t.totalDeaths        && state.memorial.length >= t.totalDeaths) ||
        (t.expeditionsCompleted && state.expeditionsCompleted >= t.expeditionsCompleted) ||
        (t.population         && state.colonists.length >= t.population) ||
        (t.day                && day >= t.day) ||
        (t.schematics         && (state.surfaceHaul?.schematics?.length ?? 0) >= t.schematics) ||
        (t.t3Built            && state.t3BuiltCount >= t.t3Built) ||
        (t.morale             && state.morale >= t.morale) ||
        (t.moraleLow          && state.morale <= t.moraleLow) ||
        (t.largeRaidsRepelled && state.largeRaidsRepelled >= t.largeRaidsRepelled) ||
        (t.level5Colonists    && state.colonists.filter(c => c.level >= 5).length >= t.level5Colonists) ||
        (t.artifacts          && state.trophies?.length >= t.artifacts) ||
        (t.commandersKilled   && state.commandersKilled >= t.commandersKilled) ||
        (t.harvestersDestroyed && state.harvestersDestroyed >= t.harvestersDestroyed) ||
        (t.tradersVisited     && state.tradersVisited >= t.tradersVisited) ||
        (t.directivesActive   && state.activeDirectives?.length >= t.directivesActive);
      if (fired) return m;
    }
    return null;
  };

---

CHANGE 2: WIRE BACKSTORIES AND QUIRKS AT COLONIST SPAWN

Find every place in the code where a new colonist object is created (at game
start and when new colonists are recruited/rescued). Add:

  backstory: BACKSTORIES[Math.floor(Math.random() * BACKSTORIES.length)],
  quirk: QUIRKS[Math.floor(Math.random() * QUIRKS.length)],

The quirk object shape from the lore file is:
  { id, label, icon, desc, mechanical }

Now wire the mechanical effects of each quirk.id in the tick loop. Add a section
in the tick loop that iterates all colonists and applies their quirk effect each
tick. Handle these ids:

  'lightSleeper':   if colonist is not injured: morale += 0.1 (accumulate across all colonists with this quirk)
  'claustrophobic': morale -= 0.1 per colonist with this quirk
  'workaholic':     XP threshold reduced: 8 ticks instead of 10 (handle in XP award logic)
                    healRate *= 0.75 (handle in injury heal logic)
  'ironStomach':    this colonist's food and water drain contribution *= 0.70
                    (reduce their share of the per-tick food/water drain)
  'loudmouth':      when an expedition this colonist is on returns alive, fire changeMorale(+5)
                    (handle in expedition return logic)
  'tunnelBlind':    filter this colonist out of the expedition candidate list
                    (handle in expedition assignment logic)
  'steadyHands':    in raid outcome rolls, downgrade kill result to injury, injury to flee
                    (handle in raid resolution logic)
  'surfaceBorn':    good event weights * 1.20 on expeditions this colonist is on
  'packRat':        scrap and salvage expedition results + 1
  'paranoid':       flee result treated as hold/injury regardless of roll
  'arcSensitive':   when a raid window opens: 20% chance to log a warning to the main log
                    one tick before the raid fires. Message: "[NAME]'s instincts are firing.
                    Something is coming."
  'insomniac':      healRate *= 0.85

---

CHANGE 3: SURFACE CONDITIONS

Add to state:
  surfaceCondition: SURFACE_CONDITIONS[0],   (starts on 'clear')
  surfaceConditionTimer: 0,

In the tick loop, increment surfaceConditionTimer each tick. When it exceeds a
randomly chosen threshold (between 80 and 120 ticks), rotate to a new condition:

  - Pick a new condition using weighted random selection based on each condition's
    `weight` field in SURFACE_CONDITIONS
  - Do not pick the same condition that is currently active
  - Reset surfaceConditionTimer to 0
  - Log to the main event log: "Surface conditions changed: [condition.label] — [condition.flavor]"

Apply condition effects in the tick loop:
  foodDrainMult:  multiply the food drain this tick by this value
  threatMult:     multiply any heat gain this tick by this value (prep for heat system in this session)
  raidFreqMult:   multiply the raid probability check by this value
  radioOffline:   if true and Radio Tower exists, it provides no raid warning this condition
  expedBlocked:   block expedition launches while true (show message in UI)
  expedSilent:    if true, suppress EXPEDITION_FLAVOR chatter prefix from expedition log entries

Display current surface condition in the header:
  condition.icon + condition.label in a pill/badge, colored with condition.color
  Hovering it shows condition.desc as a tooltip

When launching an expedition, snapshot the current condition onto the expedition:
  expedition.conditionSnapshot = { ...surfaceCondition }
Apply expedition roll modifiers from the snapshotted condition during expedition tick processing:
  expedGoodMult multiplies the good event roll weights
  expedBadMult multiplies the bad event roll weights

---

CHANGE 4: HEAT METER (REPLACES THREAT BAR)

This replaces the existing threat/threat level system entirely.

Remove: the existing threat state variable, threat bar UI, threat threshold logic,
and any threat-related calculations. Replace with heat.

Add to state:
  heat: 0,   (0 to 1000)

Add these constants before the component:
  const HEAT_DECAY_PER_TICK = 0.3;
  const HEAT_STRIKE_GAIN = 20;
  const HEAT_RAID_GAIN = 15;
  const HEAT_PROBE_GAIN = 60;
  const HEAT_RAID_PROB_BASE = 0.03;
  const HEAT_RAID_PROB_SCALE = 0.12;

  const HEAT_STATES = [
    { min: 0,   max: 199, label: 'UNDETECTED', color: '#7ed321' },
    { min: 200, max: 399, label: 'SCANNING',   color: '#ffcc00' },
    { min: 400, max: 599, label: 'TARGETED',   color: '#ff8800' },
    { min: 600, max: 799, label: 'HUNTED',     color: '#ff4444' },
    { min: 800, max: 1000, label: 'MARKED',    color: '#ff0000' },
  ];

  const getHeatState = (heat) => HEAT_STATES.find(s => heat >= s.min && heat <= s.max) || HEAT_STATES[0];

In the tick loop:
  1. Decay heat each tick: heat = Math.max(0, heat - HEAT_DECAY_PER_TICK)
  2. Multiply any heat gain this tick by surfaceCondition.effects.threatMult
  3. Raid probability check each tick:
       const raidChance = HEAT_RAID_PROB_BASE + (heat / 1000) * HEAT_RAID_PROB_SCALE;
       if (Math.random() < raidChance * surfaceCondition.effects.raidFreqMult) { /* trigger raid */ }
     Replace the existing threshold-based raid trigger with this probability check.
  4. When an Arc Strike expedition returns: heat += HEAT_STRIKE_GAIN
  5. When a raid fires: heat += HEAT_RAID_GAIN

Heat state behaviors — apply these in raid logic:
  SCANNING (200+): Before the raid, log "Scanning units detected near the entrance."
                   20% chance the Sentry Post detects and eliminates the scout early,
                   preventing +20 heat that would otherwise be added.
  TARGETED (400+): Raid size + 1 (one additional attacker added to the raid)
  HUNTED (600+):   After 5+ raids repelled, named Arc Commander events become possible
                   (commander system implemented in Session D)
  MARKED (800+):   If a raid fires and heat is still above 700 twenty ticks later,
                   a second raid can trigger (chain raids possible)

Replace the threat bar in the UI with a heat bar:
  Label: getHeatState(heat).label in the matching color
  Bar fill colored with getHeatState(heat).color
  Bar fills left to right: heat / 1000
  At MARKED state, add a CSS pulse/glow animation on the bar
  Show numeric heat value next to the bar (e.g. "847 / 1000")

---

CHANGE 5: DILEMMA EVENTS

Add to state:
  activeDilemma: null,   (shape: { event: DilemmaEvent, onResolve: fn } | null)
  dilemmaTimer: 0,

In the tick loop, increment dilemmaTimer each tick. When dilemmaTimer >= 50:
  Reset dilemmaTimer to 0
  Roll Math.random() < 0.40 — if true, attempt to fire a dilemma:
    Filter DILEMMA_EVENTS to eligible events:
      event.minTick <= current tick
      event.minPop (if defined) <= colonists.length
      event.condition (if defined) === surfaceCondition.id
      event.id not in firedDilemmas (add firedDilemmas: [] to state — track fired ids)
    If eligible events exist, pick one at random and set activeDilemma

When activeDilemma is set, render a dilemma panel in the side panel area
(replacing other side panel content, like a modal within the side panel):

  The dilemma panel has:
    No close button — player MUST choose
    Dilemma text in white, readable size, with some top padding
    Each choice as a distinct button, full width, with the choice.label in bold
    Below each button, choice.outcome in small italic muted text
    Dark background, slightly different shade from the side panel

When a choice button is clicked:
  1. Apply the choice's apply object through this handler:

    const applyDilemma = (apply, state) => {
      const next = { ...state };
      if (apply.morale)               next.morale = Math.max(-100, Math.min(100, next.morale + apply.morale));
      if (apply.scrap)                next.scrap = Math.max(0, next.scrap + apply.scrap);
      if (apply.food)                 next.food = Math.max(0, next.food + apply.food);
      if (apply.water)                next.water = Math.max(0, next.water + apply.water);
      if (apply.arcTech)              next.surfaceHaul = { ...next.surfaceHaul, arcTech: (next.surfaceHaul?.arcTech ?? 0) + apply.arcTech };
      if (apply.salvage)              next.surfaceHaul = { ...next.surfaceHaul, salvage: (next.surfaceHaul?.salvage ?? 0) + apply.salvage };
      if (apply.heatDelta)            next.heat = Math.max(0, Math.min(1000, next.heat + apply.heatDelta));
      if (apply.recruitFree)          { /* spawn a new colonist at current tick */ }
      if (apply.removeRandomColonist) { /* pick a random non-essential colonist, add to memorial with cause 'moraleDeath', remove */ }
      if (apply.injureRandom)         { /* pick a random healthy colonist and set them to injured status */ }
      if (apply.schematicRandom)      { /* add one random schematic to surfaceHaul.schematics */ }
      if (apply.suppressHeatTicks)    next.heatSuppressedTicks = apply.suppressHeatTicks;
      return next;
    };

  2. Add event id to firedDilemmas
  3. Log the choice.outcome text to the main event log
  4. Set activeDilemma to null

Add heatSuppressedTicks: 0 to state. In the tick loop, if heatSuppressedTicks > 0,
skip all heat gain for that tick and decrement heatSuppressedTicks by 1.

---

CHANGE 6: EXPEDITION FLAVOR CHATTER

In the expedition event log logic, when a new expedition log entry is generated
(good/bad/neutral outcome text), prefix it with a random line from
EXPEDITION_FLAVOR[expeditionType][outcomeCategory].

Skip the prefix entirely if surfaceCondition.effects.expedSilent is true.
The prefix format: the flavor line + "\n" + the normal event text.

---

CHANGE 7: MEMORIAL BUILDING

Add a new building to the BUILDING_DEFS (or wherever buildings are defined):

  key: 'MEMORIAL_HALL'
  name: 'Memorial Hall'
  icon: '🕯'
  cost: { scrap: 30 }
  workers: 0  (passive — no workers needed)
  desc: 'A place to grieve. Morale loss from deaths reduced by 40%. Raid morale loss -2.'
  row: 0  (can be built on any row)
  passive effect:
    - When a colonist death event fires the morale change, multiply that delta by 0.60
      (i.e. reduce death morale loss by 40%) if MEMORIAL_HALL exists in the grid
    - Raid morale loss reduced by 2 if MEMORIAL_HALL exists

---

CHANGE 8: GAME OVER SCREEN

Add to state:
  gameOver: false,
  historyLog: [],   (shape: [{ tick, text }])

Trigger game over (set gameOver: true, stop the tick loop) when:
  - colonists.length === 0
  - OR morale hits -100 AND a 10% per tick chance fires (existing collapse mechanic)

Add a historyLog helper. Call it at key moments to record events:
  addHistory(tick, text) — pushes { tick, text } to historyLog

Call addHistory at:
  - First raid fired: "First Arc raid detected"
  - First colonist death: "First loss: [name]"
  - Each excavation unlock: "Level [-Xm] excavated"
  - First T3 building built: "[building name] constructed"
  - First expedition launched: "First expedition launched"
  - Named commander appears: "Arc commander [name] detected"
  - Harvester event: "Harvester detected on the surface"
  - Each milestone fires: use the milestone title

When gameOver is true, render a full-screen overlay (position: fixed, inset: 0,
background: rgba(0,0,0,0.92), z-index: 2000) containing:

  Title: "COLONY LOST" in large red text, centered at top
  Subtitle: tickToDayHour(tick) + " — Colony fell"

  Grade badge (center):
    tick >= 48*80  → "LEGEND"    gold
    tick >= 48*40  → "DEFENDER"  silver
    tick >= 48*20  → "SURVIVOR"  bronze
    else           → "LOST"      gray

  Stats grid (2 columns):
    Days survived: Math.floor(tick/48)
    Raids repelled: raidsRepelled
    Peak population: (add peakPopulation: 0 to state, update when colonists.length > peakPopulation)
    Colonists lost: memorial.length
    First death: memorial[memorial.length-1]?.name + " — " + cause (last entry = first death, array is newest-first)
    Arc Tech recovered: surfaceHaul?.arcTech ?? 0
    Schematics found: surfaceHaul?.schematics?.length ?? 0

  Colony history timeline:
    Section titled "COLONY HISTORY"
    Render historyLog entries in chronological order (oldest first)
    Each entry: tickToDayHour(entry.tick) in muted text, entry.text in white

  Casualties section:
    Section titled "CASUALTIES"
    List every entry in memorial: name, cause, day/hour

  Share code:
    Generate: const seed = btoa(JSON.stringify({ d: Math.floor(tick/48), r: raidsRepelled, p: peakPopulation, c: memorial.length, g: gradeId })).slice(0, 12).toUpperCase()
    Display: "RUN CODE: [seed]"
    Copy button that copies seed to clipboard

  New Game button — resets all state to initial values, sets gameOver: false

---

After all changes verify syntax and output the complete updated speranza.jsx.


================================================================================
SESSION C — PROGRESSION SYSTEMS
================================================================================

You are working on a React colony management game called Speranza. Vite project,
ES modules.

File to edit: Y:\Coding\PYTHON\Speranza Game\src\speranza.jsx

Read the entire file before making any changes.

---

CHANGE 1: ROOM UPGRADE LEVELS

Every placed room in the grid currently has a type. Add a level field to each
placed room: roomLevel: 1 (default). Existing rooms in state that don't have
roomLevel should default to 1.

Add upgrade button to the room management panel (the panel that shows when a
built room is selected). The button shows:
  "Upgrade to L2 — [cost] scrap"  when roomLevel is 1
  "Upgrade to L3 — [cost] scrap"  when roomLevel is 2
  Nothing when roomLevel is 3

Upgrade costs:
  L2: Math.floor(originalBuildCost * 1.5) scrap
  L3: Math.floor(originalBuildCost * 2.5) scrap

Where originalBuildCost is the scrap cost of the building as defined in BUILDING_DEFS.

Disable the upgrade button during raids or while a room is damaged.

Production multipliers by level — apply these to all production/output values
for that room in the tick loop:
  L1: ×1.0 (no change)
  L2: ×1.3
  L3: ×1.6

L3 special abilities — trigger these only when the room reaches L3:

  Workshop L3:
    Adds a "CRAFT ARC CIRCUITRY" button to the Workshop management panel.
    Cost: 3 Arc Tech + 5 Salvage. Duration: 15 ticks.
    Produces 1 Arc Circuitry item (add arcCircuitry: 0 to surfaceHaul state).
    Only one craft job at a time. Show progress bar while crafting.

  Tavern L3:
    Enables Strong Drink production.
    Every 25 ticks, if Tavern has at least 1 worker: consume 2 water, produce 1 strongDrinkStock.
    Add strongDrinkStock: 0 to state.

  Armory L3:
    Enables Gear production.
    Every 30 ticks, if Armory has at least 1 worker: consume 5 scrap, produce 1 gearStock.
    Add gearStock: 0 to state.
    Also: adds a 2nd expedition slot (increase max simultaneous expeditions from 2 to 3).

  Barracks L3:
    Raid flee chance reduced by 10% for all colonists.
    All Raider-tier colonists (see Change 2) get +0.2 morale/tick.

  Hospital L3:
    Prevents Worn Out status from triggering (see Change 3).
    Heal rate ×2 instead of the L2 ×1.3.

  Research Lab L3:
    Unlocks the Directives panel (see Change 4).

  Power Cell L3:
    +3 energy/tick on top of the L3 production multiplier.

  Hydroponics L3:
    +2 food/tick on top of the L3 production multiplier.

  Water Recycler L3:
    +2 water/tick on top of the L3 production multiplier.

  Radio Tower L3:
    Snitch detection chance increases from 20% to 40%.
    Enables Surface Outpost building (implemented in Session D).

Show the current room level visually on the grid cell: a small "L2" or "L3"
badge in the corner of the room tile. L1 rooms show nothing.

---

CHANGE 2: COLONIST TIER SYSTEM

Add tier: 'survivor' to every colonist object. Existing colonists default to 'survivor'.
Valid values: 'survivor' | 'raider' | 'citizen'

When a colonist reaches level 3 (exactly when they level up to 3, not before):
  If no tier choice has been offered yet for this colonist (add tierChosen: false):
    Set a pending tier choice on them (add pendingTierChoice: true)

Render the tier choice in the colonist detail window (from Session A):
  When colonist.pendingTierChoice is true, show in the detail window:
    "CHOOSE A PATH" heading
    Two buttons:
      "⚔️ RAIDER PATH"
        Shows: "+25% expedition good rolls, 4th trait slot, -10% flee chance"
        Shows requirement: "Requires Gear from Armory L3"
      "🏠 CITIZEN PATH"
        Shows: "+1.5 morale/tick, +20% production, -30% death morale loss"
        Shows requirement: "Requires Strong Drink from Tavern L3"
    Clicking a button:
      Sets colonist.tier to 'raider' or 'citizen'
      Sets colonist.pendingTierChoice to false
      Sets colonist.tierChosen to true
      Logs to event log: "[Name] has chosen the [path] path."

Tier supply consumption — in the tick loop, every 25 ticks:
  For each Citizen-tier colonist: consume 1 strongDrinkStock
  For each Raider-tier colonist: consume 1 gearStock
  Track tierSupplyMissedTicks: 0 on each colonist.
  If the required stock is 0 when consumption would occur:
    Increment colonist.tierSupplyMissedTicks
    If tierSupplyMissedTicks >= 20: revert colonist.tier to 'survivor', log warning, fire morale -5

Tier mechanical effects — apply in tick loop and relevant logic:

  Raider tier:
    +25% good expedition roll weights on expeditions they join
    Unlocks a 4th trait slot (show in detail window — currently only 3 show)
    Raid flee roll: subtract 0.10 from flee probability for this colonist
    Show ⚔️ badge on colonist card

  Citizen tier:
    +1.5 morale/tick passive (per citizen-tier colonist, accumulated)
    Production room output: +20% for rooms this colonist is working in
    When this colonist dies, the death morale change is multiplied by 0.70
    Show 🏠 badge on colonist card

Show gearStock and strongDrinkStock in the header resource bar when either > 0.
Show a warning toast if either hits 0 and there are tier colonists depending on them.

---

CHANGE 3: WORN OUT STATUS

Add injuryCount: 0 to every colonist if it doesn't already exist (Session A added
this — just ensure it's there).

Add wornOut: false to every colonist.

In the injury logic, wherever a colonist is injured:
  Increment colonist.injuryCount

After incrementing injuryCount, check:
  If colonist.injuryCount >= 3 AND Hospital L3 is NOT present in the grid:
    Set colonist.wornOut = true
    Log: "[Name] is Worn Out. Too many injuries without proper care."
    Fire morale -8

Worn Out colonist behavior (enforced in tick loop and assignment logic):
  Production output: ×0.50 (half effectiveness)
  Cannot be assigned to expeditions (filter from expedition candidates)
  Cannot be assigned to Sentry Post
  Cannot earn XP or level up while Worn Out

Display on colonist card: "WORN OUT" badge in dark orange. Show in detail window.

If Hospital L3 is built while a colonist is already Worn Out:
  Do NOT retroactively cure them — Worn Out is permanent once triggered without Hospital.
  Hospital L3 only prevents future Worn Out, it doesn't reverse it.

Add a note in the Hospital management panel: "L3: Prevents Worn Out status."

---

CHANGE 4: COLONY DIRECTIVES

Directives are unlocked when Research Lab reaches L3.

Add to state:
  activeDirectives: [],   (array of directive id strings, max 3)
  directivesUnlocked: false,

When Research Lab is upgraded to L3: set directivesUnlocked to true.

Render the Directives panel: when directivesUnlocked is true, add a "DIRECTIVES"
button in the header or main UI that opens a panel (can be a modal overlay or
slide-in from the side).

The directives panel shows all 7 directives from the DIRECTIVES import (from
speranza-lore.js). Each directive shows:
  icon + label (bold)
  cost text (in red/orange)
  benefit text (in green)
  desc text (muted italic)
  Toggle button: "ENACT" if not active, "REPEAL" if active, green/red respectively

When toggling on: if activeDirectives.length >= 3, show a warning toast
"Maximum 3 directives active" and do not add. Otherwise add to activeDirectives.
When toggling off: remove from activeDirectives.

Apply directive mechanical effects in the tick loop every tick:

  overtime:
    For each colonist currently working (not idle, not injured, not on expedition):
      moraleDrain for this tick += 0.2 (extra per working colonist)
    All production this tick *= 1.20

  rationing:
    morale drain this tick += 0.3 (flat, applied once)
    foodConsumed this tick *= 0.60

  conscription:
    After normal assignment logic runs, if any colonist is idle and any room has
    an open worker slot: auto-assign that colonist to fill the slot.

  lockdown:
    Block all expedition launches. Show "LOCKDOWN ACTIVE" message on expedition UI.
    Heat decay per tick *= 2.0 (faster decay — colony going dark)

  openComms:
    heat += 0.15 each tick (passive heat gain from broadcasting)
    All expedition good roll weights *= 1.15

  combatDrills:
    scrap -= 2 each tick
    Injury probability in raids *= 0.85

  triageProtocol:
    All production this tick *= 0.90
    healRate for all injured colonists *= 1.50

Directives that conflict (e.g. lockdown blocks expeditions that openComms benefits):
  Apply both and let effects stack — the player chose both, their problem.

---

After all changes, verify syntax and output the complete updated speranza.jsx.


================================================================================
SESSION D — EVENTS & LATE GAME
================================================================================

You are working on a React colony management game called Speranza. Vite project,
ES modules.

File to edit: Y:\Coding\PYTHON\Speranza Game\src\speranza.jsx

Read the entire file before making any changes.

---

CHANGE 1: NAMED EXPEDITION LOCATIONS

The expedition launch UI currently lets the player pick type (scav/strike) and
duration. Add a third selection: destination.

Add a destination picker to the expedition launch panel: a row of buttons, one per
location from the SURFACE_LOCATIONS array (imported from speranza-lore.js).

Each button shows: location.icon + location.label. Selected location gets a
highlighted border. A risk badge shows location.risk colored:
  LOW = green, MEDIUM = yellow, HIGH = orange, EXTREME = red, UNKNOWN = gray

Below the buttons, show location.flavor in italic muted text.

Store the selected location on the expedition object:
  expedition.locationId = selectedLocation.id
  expedition.locationLabel = selectedLocation.label

When the expedition launches, apply location.rollMods to the expedition's roll
tables:
  scrapMult:      multiply scrap yield on good rolls
  salvageMult:    multiply salvage yield
  arcTechMult:    multiply arc tech yield
  badMult:        multiply probability of bad outcome rolls
  survivorChance: flat % chance per roll to find a survivor (adds free colonist on return)
  schematicBonus: flat % chance per roll to find a schematic
  mysteryEventChance: flat % chance of a mystery event log entry (flavor only for now)
  foodBonus:      if true, add 5-15 food to expedition loot on good rolls

Show the destination name in the expedition's live panel header:
  "[icon] [Name] — [type] — [ticks left] ticks"

Show destination in the memorial entry for expedition deaths:
  "Killed on expedition — [location.label] — DAY X · HH:MM"

---

CHANGE 2: SURFACE OUTPOSTS

Unlocked when Radio Tower reaches L3 (implemented in Session C).

Add to state:
  outposts: []   (array of locationId strings)

Add a new building to BUILDING_DEFS:
  key: 'SURFACE_OUTPOST'
  name: 'Surface Outpost'
  icon: '🏕'
  cost: { scrap: 20, salvage: 30 }
  workers: 0
  desc: 'Establishes a supply cache at a surface location. Improves expedition outcomes there.'
  special: true  (not placed in the grid — placed at a location)

When Radio Tower is L3, show an "ESTABLISH OUTPOST" button in the expedition
launch UI next to each location that doesn't already have an outpost.

Clicking it deducts the cost and adds the locationId to outposts array.

Outpost effect: for expeditions to that location:
  badMult: -0.10 (applied on top of location's own rollMods)
  expedGoodMult: +0.15

Outpost destruction: when heat >= 600, once per 100 ticks, roll 15% chance per
outpost — if triggered, fire a dilemma:
  "An Arc unit was detected near [location.label]. Our outpost there may be
  compromised."
  Choices:
    "Abandon it" — removes outpost from array, no resource cost
    "Send someone to defend it" — 40% chance outpost survives (roll on choice),
      40% chance it survives but the defender is injured,
      20% chance it's lost anyway and defender injured

Show active outposts in the expedition destination picker with a 🏕 indicator on
the location button.

---

CHANGE 3: SURFACE INCURSION (PROBE EVENT)

Add to state:
  probeTimer: 0,

In the tick loop, increment probeTimer each tick. When probeTimer exceeds a
threshold (80 + Math.floor(Math.random() * 40) ticks):
  Reset probeTimer to 0
  If surfaceCondition.id !== 'dustStorm' AND no active raid AND activeDilemma is null:
    Fire the 'arc_probe_incursion' dilemma event directly (bypass the normal
    50-tick dilemma timer). This event is already defined in DILEMMA_EVENTS in the
    lore file. Look it up by id and set activeDilemma to it.

At SCANNING heat state (200+): probeTimer resets to a shorter threshold
(50 + Math.floor(Math.random() * 30)) — probes are more frequent when they've
noticed you.

---

CHANGE 4: HARVESTER MEGA-EVENT

Add to state:
  harvesterActive: null,      (shape: { ticksRemaining: number, destroyed: boolean } | null)
  harvesterFired: false,      (only fires once per run)
  harvestersDestroyed: 0,

In the tick loop: once harvesterFired is false, after tick 200, each tick roll:
  Math.random() < 0.008  (roughly fires once in the 200-400 tick window)
  If true: set harvesterActive to { ticksRemaining: 60, destroyed: false }
           set harvesterFired to true
           log to historyLog and main event log:
           "⚠ HARVESTER DETECTED — A massive Arc machine has landed on the surface.
            60 ticks. Whatever's inside, it won't be there forever."

While harvesterActive is not null:
  Decrement harvesterActive.ticksRemaining each tick
  Every 10 ticks: run an additional raid probability check (same formula as normal
    raids but using 0.08 base chance instead of 0.03 — the Harvester draws Arc to the area)
  When ticksRemaining hits 0: set harvesterActive to null, log "The Harvester has departed."

Show a prominent warning in the header while Harvester is active:
  Pulsing orange/red banner: "⚠ HARVESTER ON SURFACE — [ticks] TICKS REMAINING"

When an Arc Strike expedition is launched while harvesterActive is not null:
  Apply to that expedition: loot ×2 (scrapMult ×2, salvageMult ×2, arcTechMult ×2)
  Apply: bad event probability +30% (death risk higher — it's guarded)
  On expedition return with a good outcome (not bad), roll 20% chance:
    Set harvesterActive.destroyed = true
    Set harvesterActive.ticksRemaining = 0 (ends event)
    Increment harvestersDestroyed
    Award: scrap +20, salvage +15, arcTech +10
    heat -= 200
    morale += 25
    Add trophy: { name: 'Harvester Core', source: 'harvester', day: current day, hour: current hour }
    Milestone check fires

---

CHANGE 5: NAMED ARC COMMANDER

Add to state:
  activeCommander: null,    (shape: { name, weakness, strength, raidsSinceSpawn, specialRaidCountdown } | null)
  commandersKilled: 0,
  commanderCooldown: 0,

Commander spawn condition — check each tick:
  heat >= 600 AND raidsRepelled >= 5 AND activeCommander === null AND commanderCooldown === 0:
    Roll 2% per tick
    If triggers: spawn commander:
      name: random from COMMANDER_NAMES
      weakness: random from COMMANDER_WEAKNESSES
      strength: random from COMMANDER_STRENGTHS
      raidsSinceSpawn: 0
      specialRaidCountdown: 3
    Log to event log and historyLog: "Arc commander [name] has been assigned to your sector."
    Fire a special toast (red border, not gold) with the commander's name and weakness/strength

While activeCommander is not null:
  Increment raidsSinceSpawn when a raid fires
  Decrement specialRaidCountdown when a raid fires
  When specialRaidCountdown hits 0:
    The next raid is a Commander Raid:
      Raid size +2 (larger than normal escalation)
      On repel: guaranteed +3 Arc Tech drop, log "Commander raid repelled — Arc Tech recovered."
      Reset specialRaidCountdown to 3
  Apply weakness: find which defense the weakness text references and double its effectiveness
    (The weakness strings reference Sentry Post, Barricades, Arc Turret, EMP Array, or Blast Doors.
     Apply the appropriate multiplier to that building's raid defense roll.)
  Apply strength: find which defense the strength text references and set its effectiveness to 0

Kill the commander via expedition:
  When an Arc Strike expedition returns while activeCommander is not null:
    Roll: 5% base + 1% per 100 heat above 600 (so at heat 1000 = 9% chance)
    If triggers:
      heat -= 300
      commandersKilled += 1
      morale += 15
      Add trophy: { name: activeCommander.name + ' Command Core', source: 'commander', ... }
      Log: "[commander.name] has been eliminated."
      Set activeCommander to null
      Set commanderCooldown to 150 (ticks before next commander can spawn)

Decrement commanderCooldown each tick until 0.

Show active commander in the UI: when activeCommander is not null, add a small
section below the heat bar:
  Commander name in red
  Weakness in green small text
  Strength in red small text

---

CHANGE 6: TROPHY ROOM

Add to state:
  trophies: [],    (shape: [{ name, source, day, hour }])
  trophyRoomBuilt: false,

Trophies are earned from:
  Harvester destroyed (added in Change 4)
  Commander killed (added in Change 5)

When trophies array goes from 0 to 1 for the first time:
  Unlock the Trophy Room building (make it visible in the build menu)

Add to BUILDING_DEFS:
  key: 'TROPHY_ROOM'
  name: 'Trophy Room'
  icon: '🏆'
  cost: { scrap: 45 }
  workers: 0
  desc: 'Displays earned trophies. +0.5 morale/tick per trophy (max +5/tick).'
  unlockedByTrophies: true   (hidden until first trophy earned)

When built: set trophyRoomBuilt to true

Passive effect in tick loop:
  If trophyRoomBuilt: morale += Math.min(5, trophies.length * 0.5) each tick

Show trophy list in the Trophy Room management panel when it's selected:
  Each trophy: icon 🏆, name, source label, day/hour earned

---

CHANGE 7: TRADING SYSTEM

Add to state:
  colonyRep: 0,
  activeTrade: null,       (shape: { trader, offers, ticksLeft } | null)
  tradeTimer: 0,
  tradersVisited: 0,
  nextTradeInterval: 0,    (randomized on each trade departure)

Colony reputation score — recalculate each tick:
  const avgMorale = /* rolling average of last 50 ticks' morale values, or just current morale for simplicity */;
  colonyRep = Math.floor((Math.max(0, avgMorale) * colonists.length * Math.floor(tick/48)) / 200);

Trader arrival — in tick loop, increment tradeTimer each tick.
When tradeTimer >= nextTradeInterval:
  Reset tradeTimer to 0
  Set nextTradeInterval to 100 + Math.floor(Math.random() * 50)
  If colonyRep >= 50 AND activeTrade === null:
    Pick random trader from TRADERS array
    Generate 2-3 trade offers based on trader.specialty:

    Offer generation by specialty:
      'scrap':      [{ give: { arcTech: 2 }, receive: { scrap: 60 } }, { give: { salvage: 5 }, receive: { scrap: 40 } }]
      'salvage':    [{ give: { scrap: 50 }, receive: { salvage: 8 } }, { give: { arcTech: 3 }, receive: { salvage: 12 } }]
      'arcTech':    [{ give: { scrap: 80 }, receive: { arcTech: 4 } }, { give: { salvage: 10 }, receive: { arcTech: 6 } }]
      'medicine':   [{ give: { scrap: 40 }, receive: { healAllColonists: true } }, { give: { arcTech: 2 }, receive: { healAllColonists: true, injuryCountReset: true } }]
      'schematics': [{ give: { arcTech: 5, salvage: 8 }, receive: { schematicRandom: true } }]

    Scale offer quantities by rep tier:
      rep 50-99:   base quantities as above
      rep 100-199: quantities ×1.5
      rep 200+:    quantities ×2, schematics offers become available regardless of specialty

    Set activeTrade: { trader, offers, ticksLeft: 8 }
    Log: "[trader.name] has arrived at the colony. " + trader.line
    tradersVisited++

While activeTrade is not null:
  Decrement ticksLeft each tick
  When ticksLeft hits 0: set activeTrade to null, log "[trader.name] has moved on."

Trade UI — render in side panel when activeTrade is not null (alongside or below
the normal content, not replacing it):
  Trader name in bold, trader.line in italic below
  Each offer as a card:
    "GIVE: [X resource(s)]" → "RECEIVE: [X resource(s)]"
    "Accept" button — deducts give cost, applies receive benefits, removes offer
  "Send them away" button — clears activeTrade
  Countdown: "Leaves in [ticksLeft] ticks"

Apply trade benefits:
  healAllColonists: set all colonists with status 'injured' to 'idle', clear injuryTick
  injuryCountReset: set injuryCount to 0 for all colonists
  schematicRandom: add a random schematic to surfaceHaul.schematics

---

After all changes, verify syntax and output the complete updated speranza.jsx.


================================================================================
SESSION E — FACTION TENSION & ARTIFACTS
================================================================================

You are working on a React colony management game called Speranza. Vite project,
ES modules.

File to edit: Y:\Coding\PYTHON\Speranza Game\src\speranza.jsx

Read the entire file before making any changes.

---

CHANGE 1: COLONIST ARTIFACTS

When a colonist reaches Level 5 (exactly on level-up):
  If they do not already have an artifact (add artifact: null to colonist objects):
    Generate an artifact using templates from the lore file imports
    (ARTIFACT_TEMPLATES and ARTIFACT_ITEMS are already imported):

    const item = ARTIFACT_ITEMS[Math.floor(Math.random() * ARTIFACT_ITEMS.length)];
    const template = ARTIFACT_TEMPLATES[Math.floor(Math.random() * ARTIFACT_TEMPLATES.length)];
    const artifactName = template.replace('[NAME]', colonist.name).replace('[ITEM]', item);

    Set colonist.artifact = {
      name: artifactName,
      item,
      created: { day: currentDay, hour: currentHour }
    }

    Log to event log: "[colonist.name] created something. " + artifactName
    Fire milestone check (level5Colonists trigger)

While the colonist is alive and has an artifact:
  Add +0.5 to the morale gain each tick (passive, applied in morale calculations)

When the colonist dies and has an artifact:
  The memorial entry for this colonist already stores the colonist data — ensure
  colonist.artifact is included in the memorial entry object.
  After death: continue applying +0.2 morale/tick permanently as long as any
  colonist artifact exists in any memorial entry.
  This represents the artifact remaining in the colony as a tribute.
  Add tributeMoraleGain to the tick loop:
    const tributeBonus = memorialWithArtifacts.length * 0.2;
    (where memorialWithArtifacts = memorial.filter(e => e.artifact))

Display in colonist detail window (from Session A):
  When colonist has an artifact, add an ARTIFACT section below traits:
    Label "ARTIFACT" in small caps muted
    Artifact name in italic white
    "Created " + day/hour

Display in memorial wall (from Session A):
  Under each memorial entry that has an artifact field:
    "Left behind: [artifact name]" in small italic gold text

---

CHANGE 2: RAIDER VS BUILDER FACTION TENSION

This system activates passively once the player has built up enough colonists on
each path.

Add to state:
  factionTension: null,        ('raiders' | 'builders' | null)
  factionTensionTimer: 0,

Faction tension activates when:
  raiderColonists.length >= 3 AND citizenColonists.length >= 3
  (where raiderColonists = colonists.filter(c => c.tier === 'raider'), same for citizen)

When active, increment factionTensionTimer each tick.
When factionTensionTimer >= 50: reset to 0, run faction satisfaction check:

  Compute raiderSatisfaction score (0-100):
    +30 if Armory exists in grid
    +20 if Armory is L2+
    +20 if Armory is L3
    +20 if Barracks is L2+
    +10 if gearStock > raiderColonists.length * 2

  Compute builderSatisfaction score (0-100):
    +30 if Hospital exists in grid
    +20 if Hospital is L2+
    +20 if Hydroponics is L2+
    +20 if Tavern is L2+
    +10 if food > 40 and water > 40

  If raiderSatisfaction < 40: set factionTension to 'raiders', fire raider dilemma
  Else if builderSatisfaction < 40: set factionTension to 'builders', fire builder dilemma
  Else: set factionTension to null

Raider faction dilemma (fire via activeDilemma system):
  text: "Three of your raiders cornered you near the armory. They've been watching the
  builders get better food, a better hospital, more production. They want upgrades to
  the Barracks and Armory or they start taking runs for themselves."
  choices:
    { label: "Commit to upgrading their facilities",
      outcome: "They're satisfied. For now.",
      apply: { morale: +10 } }
      // Also: set a flag that gives raider colonists +5 morale each for 20 ticks
    { label: "Tell them the colony decides together",
      outcome: "They back down. They don't forget.",
      apply: { morale: -5 } }
    { label: "Assign them double expedition rotations",
      outcome: "They're too busy to complain. Expeditions yield 15% more for 30 ticks.",
      apply: { morale: -8 } }
      // Also: set a temp expedition bonus flag for 30 ticks

Builder faction dilemma (fire via activeDilemma system):
  text: "The production workers held a quiet meeting. You found out second-hand. They think
  the raiders get the glory, the gear, and the attention, while they keep the lights on
  and get nothing. They want Hospital upgrades and better food allocation."
  choices:
    { label: "Redirect resources to production upgrades",
      outcome: "Morale among production workers improves noticeably.",
      apply: { morale: +10 } }
    { label: "Explain that everyone's role matters",
      outcome: "They hear you. The resentment doesn't fully go away.",
      apply: { morale: -3 } }
    { label: "Institute a formal recognition system",
      outcome: "Small gesture. Surprisingly effective.",
      apply: { morale: +6, scrap: -15 } }

After resolving a faction dilemma:
  Set factionTension to null
  Apply morale delta separately to the relevant faction colonists (not colony-wide):
    Positive outcomes: +8 morale to all colonists of the satisfied faction
    Negative outcomes: -5 morale to all colonists of the neglected faction
    (Apply by calling changeMorale for each affected colonist's contribution,
     or simply adjust colony morale as specified in the apply object)

Show faction tension in the UI when factionTension is not null:
  A small warning pill in the header or side panel: "⚠ FACTION TENSION: [RAIDERS/BUILDERS]"
  Colored orange, clicking it opens the colonist list filtered to the tense faction

---

After all changes, verify syntax and output the complete updated speranza.jsx.
