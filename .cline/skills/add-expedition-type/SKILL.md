---
name: add-expedition-type
description: Add a new expedition type to Speranza. Use when the user wants a new kind of surface mission that colonists can be sent on from the armory.
---

# Add Expedition Type

Expeditions live entirely in `gameData.js` (the type definition) and `Speranza.jsx` (the resolution logic). The UI in SidePanel.jsx renders expedition buttons generically from `EXPEDITION_TYPES` — no component changes needed unless the new type has unique UI.

## Step 1 — Add to EXPEDITION_TYPES in gameData.js

Read the existing EXPEDITION_TYPES entries first to match the pattern:

```js
yourExpeditionKey: {
  label:             "Expedition Name",
  icon:              "🗺️",
  desc:              "Short description shown on the launch button.",
  color:             "#f5a623",        // accent color for the live panel
  colonistsRequired: 1,               // how many colonists are pulled from idle pool
  threatDelta:       15,              // heat added when this expedition launches
  
  // Loot tables — these are used in the tick resolution logic
  loot: {
    scrapPerTick:    { min: 0, max: 2 },    // scrap earned per scav tick
    salvageChance:   0.05,                  // per-tick chance to earn salvage
    arcTechChance:   0.01,                  // per-tick chance to earn arc tech
    survivorChance:  0.02,                  // per-tick chance to find a survivor colonist
    strikeDamage:    { min: 5, max: 20 },   // HP damage on strike events
    strikeChance:    0.15,                  // per-tick chance of a strike event
  },

  // Flavor text for the live event log
  events: {
    scav:    ["Found something useful...", "Hauling scrap from the ruins."],
    strike:  ["Arc drone spotted!", "Taking fire from above."],
    safe:    ["Moving carefully.", "All quiet for now."],
    found:   ["Survivor discovered!", "Unexpected find."],
  },
},
```

**Balancing guidelines:**
- Short missions (20t): higher strike chance, lower loot, lower threat delta
- Long missions (60-80t): lower strike chance, higher total loot, higher threat delta
- Specialist missions: high salvage/arcTech chance, 2+ colonists required, highest threat
- `colonistsRequired: 2` makes it much harder to launch — use only for powerful missions

## Step 2 — Wire into tick resolution in Speranza.jsx

The tick loop processes active expeditions each tick. Read the expedition processing section carefully (search for `expeditions.map` or `expedition tick`). You likely don't need to add new logic — the existing resolution code reads from `exp.type` and looks up `EXPEDITION_TYPES[exp.type].loot`.

Only add type-specific tick logic if the expedition has a unique mechanic (e.g., "this expedition type can return early if a condition is met"). If you do add it, wrap it in `if (exp.type === "yourExpeditionKey")`.

## Step 3 — Add flavor events to speranza-lore.js (optional but recommended)

If the expedition type has narrative weight, add a larger pool of event strings to `speranza-lore.js` and reference them from `EXPEDITION_TYPES[key].events`. This keeps the game data file lean.

## Step 4 — Verify

Check that:
- [ ] The key matches the type identifier used elsewhere
- [ ] `colonistsRequired` is 1 or 2 (the cap is hardcoded as 2 active expeditions)
- [ ] All `loot` fields are present (the tick resolution reads all of them)
- [ ] `events.scav`, `events.strike`, `events.safe` all have at least 2 strings
- [ ] `color` is visible on the dark background (#0d0008)

## What the Live Panel Shows
The SidePanel expedition panel renders:
- Expedition type icon + label (from def)
- Colonist names (resolved from IDs)
- Progress bar (ticksLeft / duration)
- Last 3 event log entries
- Accumulated loot (scrap, salvage, arcTech, survivor)

All of this is generic — it just reads from `exp.eventLog` and `exp.lootAccumulated`, which are populated by the tick loop. No component changes needed.
