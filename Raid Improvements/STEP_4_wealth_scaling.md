# Step 4 — Wealth-Scaling Raids

## Purpose

Make raid severity reflect colony prosperity.

Design target:

- **heat** determines how often raids happen
- **wealth** determines how severe they are

---

## Files Touched

- `src/gameData.js`
- `src/Speranza.jsx`
- optionally `src/surface_defense.jsx` if wave density is also adjusted there

---

## Ownership

- `gameData.js` owns pure wealth helpers and named exported constants/helpers
- `Speranza.jsx` owns raid-launch integration and state/prop plumbing
- `surface_defense.jsx` owns any minigame-only interpretation of severity such as denser wave generation

Do not put React logic in `gameData.js`.

---

## Read First

Before implementing:

1. re-read the raid-window creation logic in `Speranza.jsx`
2. re-read how raid size is currently chosen
3. confirm which refs already exist for tick-loop reads (`resRef`, `gridRef`, `colonistsRef`, etc.)
4. re-read the `SurfaceDefense` prop interface if wealth info needs to be passed down
5. re-read `gameData.js` export patterns before adding helpers

---

## Pure Helper Guidance (`gameData.js`)

If colony wealth is computed from resources, room count, and colonist count, that calculation belongs in `gameData.js` as a pure helper.

Recommended helper boundaries:

- `calcColonyWealth(res, grid, colonists)`
- `getWealthBracket(wealth)`

Rules:

- named exports only
- no React imports
- no side effects
- no direct state access

---

## Raid Integration Guidance (`Speranza.jsx`)

When a raid window is created or escalated:

- read live values through the existing tick-safe refs if the code is inside the tick loop
- compute colony wealth using the pure helper
- derive raid size from wealth brackets
- preserve the existing role of heat in determining raid frequency

If a new value such as `pendingWealthBracket` is introduced and later read inside effects or the tick loop, mirror it through a ref only if the live code actually requires that pattern.

---

## Optional Minigame Scaling (`surface_defense.jsx`)

If the step includes varying wave density as well as raid size:

- pass only the minimum necessary derived signal downward (for example `wealthBracket`)
- keep density math local to wave generation in `surface_defense.jsx`
- do not make the minigame recalculate colony wealth itself

---

## What Not To Do

- do not replace heat with wealth entirely
- do not put pure helper math directly into JSX if it belongs in `gameData.js`
- do not hardcode model/state assumptions that are not revalidated in the live files
- do not add React hooks or mutable state to `gameData.js`

---

## Verification Checklist

- [ ] Low-wealth colonies skew toward smaller raids
- [ ] Higher-wealth colonies skew toward harsher raid sizes
- [ ] Heat still controls when raids occur
- [ ] Any wealth helper lives in `gameData.js` and stays pure
- [ ] Any new value passed to `SurfaceDefense` is derived in `Speranza.jsx`, not recomputed in the minigame
- [ ] Tick-loop reads use existing ref-safe patterns where needed
- [ ] Logging/UX messaging, if added, explains tougher raids without exposing implementation noise
