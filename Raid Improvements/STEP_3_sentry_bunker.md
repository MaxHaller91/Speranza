# Step 3 — Sentry Post → Bunker Integration

## Purpose

Make colony sentry staffing matter directly during the surface-defense minigame.

---

## Files Touched

- `src/Speranza.jsx`
- `src/surface_defense.jsx`

---

## Ownership

- `Speranza.jsx` owns deriving sentry-worker count from colony state and applying colony-side injury consequences
- `surface_defense.jsx` owns bunker entity behavior, rendering, targeting, and local damage handling

Do not move this feature into `src/components/`.

---

## Read First

Before implementing:

1. re-read worker assignment logic in `Speranza.jsx`
2. verify how Sentry Post workers are represented today
3. re-read the `SurfaceDefense` prop interface in `Speranza.jsx`
4. re-read minigame defense/enemy update logic in `surface_defense.jsx`
5. verify the current callback style for raid outcomes and colony consequences

Do not assume a status name or room-level shape without checking the live code.

---

## Core Design

High-level behavior:

- assigned Sentry Post workers create a bunker in the minigame
- bunker contributes auto-fire support during the raid
- bunker can be destroyed
- if destroyed, the corresponding colony workers suffer a penalty back in the colony

---

## Colony-Side Integration (`Speranza.jsx`)

### Derive sentry worker count

Recommended approach:

- derive the worker count from the live `grid` data immediately before passing props to `SurfaceDefense`
- keep this as a derived value, not a second source of truth

### Apply bunker-destruction consequences

Recommended approach:

- add a parent handler such as `handleBunkerDestroyed`
- inside the handler, update colonists via functional state updates
- apply only the intended colony-side consequences

### Important verification note

If the current code uses a dedicated sentry status such as `"onSentry"`, align with that existing pattern.

If it does not, do not invent one casually. First decide whether the feature can use existing worker assignment data without expanding the colonist model.

---

## Minigame-Side Integration (`surface_defense.jsx`)

### New props

Recommended props:

- `sentryWorkers`
- `onBunkerDestroyed`

### Bunker state

The bunker should remain minigame-local state, created when the raid activates.

Suggested fields:

- position
- hp / maxHp
- slot count derived from `sentryWorkers`
- fire cooldown / fire rate
- damage / range

### Bunker behavior

Recommended behavior:

- auto-target nearby enemies
- fire a modest number of shots based on staffed slots
- function as helpful support, not a full replacement for player defenses
- take damage from appropriate enemy interactions

### Callback safety

If `onBunkerDestroyed` is called from the minigame:

- ensure it cannot fire repeatedly after HP already reached 0
- use the same lifecycle discipline as other raid outcome callbacks

---

## Rendering Guidance

The bunker should look distinct from player-built defenses.

Recommended visual language:

- low fortified silhouette
- obvious gun ports or firing positions
- readable HP bar
- rubble state once destroyed

Keep all drawing inside the canvas render path in `surface_defense.jsx`.

---

## What Not To Do

- do not create a second authoritative worker count outside the grid/colonist systems
- do not apply colony injuries directly inside `surface_defense.jsx`
- do not assume bunker callbacks are safe to spam; guard them
- do not over-upgrade the bunker into a full tower type unless the task explicitly expands scope

---

## Verification Checklist

- [ ] Zero sentry workers produces no bunker
- [ ] One or more sentry workers produces a bunker with scaled effectiveness
- [ ] Bunker auto-fire behaves consistently and does not replace player defense strategy
- [ ] Bunker destruction triggers the parent callback once
- [ ] Colony-side sentry workers receive the intended consequence and only those workers
- [ ] Rendering clearly distinguishes active bunker vs destroyed bunker
- [ ] No colony/minigame state desync appears after bunker destruction
