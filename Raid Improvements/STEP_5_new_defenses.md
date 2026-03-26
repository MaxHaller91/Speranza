# Step 5 — New Defenses (Armory-Locked)

## Status

**Deferred until a real building-upgrade system exists in the colony layer.**

Do not implement this step yet.

## Purpose

Add specialized defensive answers for the expanded raid roster.

Design target:

- **Flak Battery** handles air threats well
- **EMP Cannon** provides crowd control rather than direct damage

This step should respect existing progression and should not assume an upgrade system exists unless the live code confirms it.

---

## Files Touched

- `src/Speranza.jsx`
- `src/surface_defense.jsx`

---

## Ownership

- `Speranza.jsx` owns deriving and passing any armory-based unlock signal
- `surface_defense.jsx` owns defense definitions, targeting behavior, projectile/effect behavior, placement, and rendering

---

## Read First

Before implementing:

1. re-read current minigame defense definitions
2. re-read defense placement/purchase UI in `surface_defense.jsx`
3. verify whether colony armory progression already exists in `Speranza.jsx` / `gameData.js`
4. verify whether room cells actually carry an upgrade/level field before referencing one
5. re-read current enemy targeting so anti-air and stun logic fit the existing patterns

Do not assume `roomLevel`, `armoryLevel`, or any specific upgrade field exists without confirming it in code.

---

## Defense Concepts

### Flak Battery

Role:

- anti-air specialist
- should prioritize flying enemies
- should still interact with ground enemies conservatively if allowed at all

### EMP Cannon

Role:

- crowd-control tool
- low or zero direct damage
- strong stun / disruption utility

---

## Colony-Side Gating (`Speranza.jsx`)

If the colony has a real armory-upgrade signal already:

- derive it in `Speranza.jsx`
- pass the minimal prop required by `SurfaceDefense`

If no real upgrade system exists yet:

- do not invent one casually in this step unless the task explicitly expands to include it
- instead, keep the new defenses hidden or permanently locked until the real progression system exists

---

## Minigame Implementation (`surface_defense.jsx`)

### Defense definitions

Add the new defense types alongside the existing defense definitions.

Suggested fields:

- label
- cost
- hp / maxHp
- range
- damage or effect parameters
- fire rate
- render dimensions
- unlock requirement metadata if needed

### Picker UI

If defenses are shown before unlock:

- locked defenses should be visibly disabled
- clicking them should do nothing
- the lock reason should be readable

### Flak behavior

Implementation goals:

- prioritize air targets when available
- feel visually distinct from the standard turret
- avoid becoming the best answer to all targets simultaneously

### EMP behavior

Implementation goals:

- use a clear special projectile/effect path
- stun enemies in an area
- keep stun state local to minigame enemy entities
- render the effect clearly without overcomplicating the draw loop

---

## What Not To Do

- do not assume a nonexistent armory-upgrade field on grid cells
- do not put unlock computation inside the minigame if it depends on colony state
- do not let EMP effects leak into colony-side systems
- do not rewrite the entire defense picker when additive changes work

---

## Verification Checklist

- [ ] Unlock behavior matches the real progression system, not an invented placeholder state
- [ ] Locked defenses cannot be purchased or selected
- [ ] Flak Battery clearly performs better against air than ground
- [ ] EMP Cannon clearly provides crowd control rather than normal DPS
- [ ] Enemy stun state behaves predictably and wears off correctly
- [ ] New defenses render distinctly from existing ones
- [ ] Defense costs still affect shared scrap through delta-based updates
