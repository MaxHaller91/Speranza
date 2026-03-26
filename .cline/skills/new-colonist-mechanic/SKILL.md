---
name: new-colonist-mechanic
description: Add a new colonist mechanic, status, trait, or property to Speranza. Use when adding new ways colonists can behave, new permanent upgrades, new status conditions, or new things tracked on the colonist object.
---

# New Colonist Mechanic

Colonists are plain JS objects. The system is deliberately simple — there's no class, no prototype. New mechanics slot in by: (1) adding the property to the colonist shape, (2) updating the tick loop to change it, and (3) updating the UI to display it.

## The Colonist Object (current shape)

```js
{
  id:                    string,     // uuid, never changes
  name:                  string,
  backstory:             string,
  quirk:                 { icon, label, desc, effect } | null,
  status:                "idle" | "working" | "injured" | "sheltered" | "onExpedition",
  xp:                    number,
  level:                 number,     // floor(xp / 20)
  traits:                string[],   // keys into TRAITS (gameData.js)
  pendingTraitPick:      boolean,    // true when level-up choice is available
  injuryTicksLeft:       number,     // ticks until status returns to idle
  joinTick:              number,
  expeditionsCompleted:  number,
  raidsSurvived:         number,
  injuryCount:           number,
}
```

## Adding a New Status

**When:** You need colonists to enter a state that affects their behavior and is mutually exclusive with other states.

**Steps:**

1. Add the status string to the JSDoc/comment in gameData.js (the `STATUS_COLOR` and `STATUS_LABEL` maps)
2. Add an entry to `STATUS_COLOR` (hex color for the indicator dot)
3. Add an entry to `STATUS_LABEL` (display string shown in roster)
4. In the tick loop, add logic to transition into/out of the new status
5. In Speranza.jsx handlers, check `col.status === "yourStatus"` where behavior differs
6. In ColonistRoster.jsx and SidePanel.jsx, the status label and dot color render automatically from the maps

**Note:** The `working` status is set when a colonist is assigned to any room with a worker slot. Don't add logic that conflicts with worker assignment — check that your new status correctly blocks or allows assignment.

## Adding a New Trait

Traits are permanent perks earned at level-up via the TraitPicker modal.

**Steps:**

1. Add the trait to `TRAITS` in gameData.js:
```js
TRAITS.yourTraitKey = {
  key:   "yourTraitKey",
  label: "Trait Name",
  icon:  "🔮",
  color: "#9988cc",
  desc:  "What this trait does (shown in tooltip).",
  // The effect itself is NOT in TRAITS — it's applied in the tick loop
};
```

2. Add the key to `TRAIT_KEYS` array in gameData.js

3. Apply the effect in the tick loop. Search for existing trait checks like `col.traits.includes("yourExistingTrait")` to find where to add yours. Most trait effects modify resource generation, injury recovery, or XP gain:
```js
// Example: trait that speeds up injury recovery
if (col.traits.includes("quickHealer")) {
  col.injuryTicksLeft = Math.max(0, col.injuryTicksLeft - 1);
}
```

4. Nothing needs to change in TraitPicker.jsx or the level-up flow — it renders from TRAITS automatically

## Adding a New Colonist Property

**When:** You need to track a new piece of data per colonist (e.g., a cooldown, a resource they carry, a flag).

**Steps:**

1. Update `makeColonist()` in gameData.js to include the new property with a default value:
```js
export function makeColonist(name, backstory, quirk) {
  return {
    // ... existing props
    yourNewProp: defaultValue,
  };
}
```

2. Update any colonist "resurrection" or "recover" logic that constructs colonist objects from templates to also include the new prop

3. Update the tick loop where the prop changes

4. Update SidePanel.jsx or ColonistRoster.jsx to display it if it's player-facing

5. Update the memorial entry structure if this prop should be recorded on death

## Adding a New Quirk Effect

Quirks are assigned randomly at colonist creation. Effects are applied in the tick loop.

1. Add the quirk to the `QUIRKS` array or generation logic in `speranza-lore.js` / `gameData.js`
2. Add an `effect` field to the quirk object: a string key that the tick loop checks
3. In the tick loop, find the quirk effect application section and add:
```js
if (col.quirk?.effect === "yourQuirkEffect") {
  // apply the effect
}
```

## Colonist Death / Memorial

When a colonist dies (raid, expedition), they're removed from `colonists[]` and added to `memorial[]`:
```js
memorial.push({
  id:     col.id,
  name:   col.name,
  level:  col.level,
  cause:  "raidKilled" | "expeditionKilled" | "raidFled",
  day:    currentDay,
  hour:   currentHour,
  epitaph: generateEpitaph(col),
});
```

If your new mechanic tracks something worth preserving in the memorial (e.g., a special achievement), add it to the memorial entry and update the memorial display in SidePanel.jsx.

## Safety Checks Before Adding Any Colonist Mechanic

- [ ] Does the new status/property have a sensible default so existing colonists (loaded before the change) don't break?
- [ ] Does the tick loop guard against undefined? (`col.yourProp ?? defaultValue`)
- [ ] If it's a new status, does it interact correctly with `idle`, `working`, and the worker assignment system?
- [ ] If it's a new trait, is the effect clearly bounded so it can't cause runaway resource generation?
