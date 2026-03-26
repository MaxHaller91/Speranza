# Step 2 — Flying Arc Units

## Purpose

Add air threats to the surface-defense minigame so barricades are no longer a universal answer.

This step should stay mostly inside `src/surface_defense.jsx`. Only move data into `src/gameData.js` if doing so remains purely declarative and reusable.

---

## Files Touched

- `src/surface_defense.jsx`
- optionally `src/gameData.js` for pure enemy constants/helpers only if that clearly improves reuse

---

## Ownership

- `surface_defense.jsx` owns flying-enemy behavior, movement, targeting, rendering, projectile behavior, and wave generation
- `gameData.js` may own static enemy config if exported as named pure data
- `Speranza.jsx` should not absorb minigame-only enemy logic for this step

---

## Read First

Before editing:

1. re-read enemy definitions in `src/surface_defense.jsx`
2. re-read enemy movement/update logic
3. re-read projectile creation and hit resolution
4. re-read wave generation / wave start logic
5. re-read the render order so air units layer correctly

Do not trust old line numbers from earlier notes.

---

## Feature Summary

Add two new enemy types:

### Arc Drone

- fast
- low HP
- flies above the ground plane
- performs repeated attack runs on the hatch
- ignores barricades completely

### Arc Gunship

- slow
- high HP
- flies higher than the drone
- targets defenses with splash rockets
- should feel like a specialized suppression threat rather than a basic damage sponge

---

## Data Guidance

Whether enemy definitions live inline in `surface_defense.jsx` or move to `gameData.js`, keep the structure purely declarative.

If the minigame already uses a single local `ENEMY_TYPES` table, extending that local table is acceptable and likely safer.

---

## Behavior Guidance

### Drone

Recommended behavior phases:

- approach
- burst / hover attack
- retreat
- loop / re-entry delay

Implementation constraints:

- drone movement must bypass ground-only barricade blocking
- turret targeting may still use normal distance checks unless a later step adds explicit anti-air prioritization
- if a new state field is required on the enemy object, keep it local to minigame entity state

### Gunship

Recommended behavior:

- enters at high altitude
- moves to an attack position
- targets defenses first
- fires slower splash rockets
- exits or continues its path after firing

Implementation constraints:

- if turret damage vs air is tuned separately, keep that tuning local and explicit
- do not entangle gunship suppression logic with colony-side state in `Speranza.jsx`

---

## Projectile Guidance

If rockets or other special projectile types are added:

- keep projectile constructors/minigame projectile state inside `surface_defense.jsx`
- clearly distinguish normal, splash, and any future special projectile flags
- keep hit resolution readable and branch by projectile capability rather than by scattered ad hoc checks

---

## Wave Generation Guidance

Flying units should be introduced gradually.

Recommended approach:

- drones appear earlier than gunships
- medium raids get drones before large raids get gunships
- gunships should remain comparatively rare

---

## Rendering Guidance

Air units should read visually as airborne even in the simple canvas style.

Rendering rules:

- render flying units at their own `y`/altitude, not ground level
- keep silhouettes distinct from ground enemies
- preserve readable draw order
- any glow, trails, or pulse effects should remain lightweight and local to canvas rendering

Do not move canvas drawing into a React UI component.

---

## What Not To Do

- do not let drones collide with barricades like ground units
- do not move minigame wave logic into `Speranza.jsx`
- do not introduce React state for per-enemy simulation if the file already uses refs/local mutable state for the game loop
- do not rewrite the entire enemy system if a targeted extension works

---

## Verification Checklist

- [ ] Drones appear only in the intended raid tiers / wave ranges
- [ ] Gunships appear only in the intended higher-difficulty cases
- [ ] Flying enemies bypass barricades
- [ ] Existing defenses can still target air when appropriate
- [ ] Any anti-air damage penalty/bonus behaves as designed
- [ ] Splash rockets damage the intended targets in radius
- [ ] Flying enemies render at visible altitude and do not visually read as ground units
- [ ] Scrap rewards still resolve correctly through delta-based colony scrap updates
