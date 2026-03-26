# Step 2 — Flying Arc Units

## Files Touched
- `src/surface_defense.jsx` only

---

## Overview

Two new enemy types that fly above the ground plane, bypassing all barricades. They force the player to reconsider turret placement and create demand for the Flak Battery (Step 5). Both are introduced gradually — light fliers appear in medium raids from wave 3+, large raids from wave 2+. Heavy fliers only appear in large raids.

---

## Data — New Enemy Types

Add to `ENEMY_TYPES` object:

```js
drone: {
  hp: 25, maxHp: 25,
  speed: 0.9,           // fast
  damage: 6,            // per machine-gun round (fires 3 in a burst)
  burstCount: 3,        // rounds per attack pass
  burstInterval: 8,     // ticks between rounds in a burst
  reward: 12,
  w: 10,
  color: "#ff6600",
  altitude: 55,         // y position (above GROUND_Y = 130, so this is sky level)
  flying: true,
  attackStyle: "machinegun",
},
gunship: {
  hp: 180, maxHp: 180,
  speed: 0.22,          // slow and deliberate
  damage: 45,           // rocket damage (splash)
  splashRadius: 55,     // px — damages defenses in radius on hit
  reward: 40,
  w: 28,
  color: "#cc2200",
  altitude: 28,         // higher altitude
  flying: true,
  attackStyle: "rocket",
  rocketSpeed: 2.5,     // slower projectile
},
```

---

## Enemy Object Shape — Extended Fields

`makeEnemy` needs new fields for flying units:

```js
function makeEnemy(side, type = "grunt") {
  const def = ENEMY_TYPES[type];
  const flying = def.flying ?? false;
  return {
    id: eid++, type,
    x: side === "left" ? -30 : W + 30,
    y: flying ? def.altitude : GROUND_Y,     // altitude for fliers, ground for walkers
    dir: side === "left" ? 1 : -1,
    hp: def.hp, maxHp: def.maxHp,
    speed: def.speed, damage: def.damage, reward: def.reward, w: def.w,
    color: def.color,
    flying,
    altitude: def.altitude ?? GROUND_Y,
    attackStyle: def.attackStyle ?? "melee",
    attackCooldown: 0,
    hatchCooldown: 0,
    // Drone-specific
    burstCount: def.burstCount ?? 0,
    burstInterval: def.burstInterval ?? 0,
    burstRemaining: 0,
    burstTimer: 0,
    attackPhase: "approach",  // "approach" | "burst" | "retreat" | "loop"
    loopTimer: 0,
    // Gunship-specific
    splashRadius: def.splashRadius ?? 0,
    rocketSpeed: def.rocketSpeed ?? 5,
    dead: false,
  };
}
```

---

## Movement & Behavior Logic

### Drone (Arc Drone) — machine-gun attacker

Movement follows an attack-run pattern with three phases:

**Phase: "approach"**
- Moves toward the hatch at full speed
- When within 80px of hatch: switch to "burst"

**Phase: "burst"**
- Stops horizontal movement (hovers)
- Fires one projectile per `burstInterval` ticks, up to `burstCount` times
- `burstRemaining` tracks shots left
- Each shot: `makeProjectile(en.x, en.y, HATCH_X, GROUND_Y - 3, en.damage, en.color)`
- When `burstRemaining <= 0`: switch to "retreat"

**Phase: "retreat"**
- Moves away from hatch at 1.2× normal speed (banking away)
- When off-screen (x < -40 or x > W+40): switch to "loop"

**Phase: "loop"**
- `loopTimer` counts down from 90 ticks
- When done: respawn from original side, switch to "approach"
- (Re-enter from same side — the drone is circling back for another pass)

**Key properties:**
- Flying = true → barricade collision check is skipped entirely
- Barricade blocking logic currently checks `d.type === "barricade" && Math.abs(d.x - en.x) < 20` — wrap this check with `if (!en.flying)`
- Turrets can target drones normally (range check is just distance-based, altitude doesn't matter yet — add Flak priority in Step 5)

### Gunship (Arc Gunship) — rocket suppressor

Movement:
- Slow, steady flight path across the top of the screen (altitude 28)
- Does NOT target the hatch — targets defenses
- Flies from entry edge toward center, stops at x = W * 0.3 or W * 0.7 (depending on side), holds position for attack

Attack cycle:
- When in position (reached stop x), `attackCooldown` counts down from 150 ticks
- When ready: find the defense with lowest HP in range (200px) — if none, pick nearest defense
- Fire a rocket: `makeRocket(en.x, en.y, target.x, target.y - target.height/2, en.damage, en.color, en.splashRadius, en.rocketSpeed)`
- After firing: resume movement to exit the other side
- If no defenses remain: flies to hatch and attacks it directly (fallback)

**Turret damage penalty:** When a turret fires at a flying enemy, damage = `def.damage * (en.flying ? 0.5 : 1.0)`. Turrets aren't optimized for air targets.

---

## Projectile Extension — Rockets

Rockets are a new projectile subtype with splash on hit. Either extend `makeProjectile` or add `makeRocket`:

```js
function makeRocket(sx, sy, tx, ty, damage, color, splashRadius, speed) {
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    id: pid++, x: sx, y: sy,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    damage, color,
    splash: true,
    splashRadius,
    dead: false,
  };
}
```

**Splash hit logic** — in the projectile-hit section of the game loop, check `p.splash`:
```js
if (p.splash) {
  // Apply damage to all defenses within splashRadius
  s.defenses.forEach(d => {
    if (!d.dead && Math.sqrt((d.x - p.x)**2 + (d.y - p.y)**2) < p.splashRadius) {
      d.hp -= p.damage;
      if (d.hp <= 0) d.dead = true;
    }
  });
  p.dead = true;
} else {
  // existing single-target hit logic
}
```

---

## Wave Generator Changes

Update `generateWave(waveIdx)` to add fliers. Fliers come from above, not a side — pass `side: "air"` as a convention, then `makeEnemy` handles altitude automatically.

```js
// In generateWave, add after existing group definitions:
if (totalWaves >= 5 && w >= 2) {
  // Medium+ raids: drones from wave 2
  const droneCount = 1 + Math.floor((w - 1) * 0.5);
  groups.push({ type: "drone", side: w % 2 === 0 ? "right" : "left", count: droneCount, interval: Math.max(30, 50 - w * 3) });
}
if (totalWaves >= 8 && w >= 3) {
  // Large raids only: gunships from wave 3
  if (w % 3 === 0) {  // gunships every 3rd wave
    groups.push({ type: "gunship", side: w % 2 === 0 ? "left" : "right", count: 1, interval: 180 });
  }
}
```

The `totalWaves` is already on `stateRef.current.totalWaves` — pass it into `generateWave` as a second argument: `generateWave(idx, s.totalWaves)`.

---

## Rendering — Fliers

Flying enemies render at their `y = en.altitude` (not GROUND_Y). Add to the enemy render section, after the existing ground-enemy draw code:

### Drone render
```
Small angular diamond (rotated square):
- Body: 4-point polygon, ~10px, orange fill
- Pulsing glow: semi-transparent circle, radius 8, oscillates with s.tick
- Two thin wing lines extending from body horizontally
- LED: 2px circle at nose, bright red
- Trail: dashed line behind (sin-wave path visual from previous 3 positions)
```

Implementation: use `ctx.save()` / `ctx.restore()` with rotation. Diamond is a `ctx.beginPath()` with 4 `lineTo` calls.

### Gunship render
```
Wide angular body (elongated hexagon):
- Width: 28px, height: 14px
- Two swept wings extending to 50px total span
- Engine glow: two orange circles at rear (left and right)
- Nose cone: forward-pointing triangle
- Color: dark red (#cc2200) body, orange engines
```

Both fliers render **before** ground units in the draw order so ground units appear "in front" (more depth-correct).

---

## Existing Code Touch Points

| Location | Change |
|---|---|
| `ENEMY_TYPES` object | Add `drone` and `gunship` entries |
| `makeEnemy()` | Add flying fields to returned object |
| Enemy movement block | Wrap barricade check with `if (!en.flying)`; add drone phase logic; add gunship movement |
| Projectile hit block | Add `p.splash` branch with radius damage |
| `generateWave()` | Accept `totalWaves` arg; add drone/gunship groups |
| `startWave()` call | Pass `s.totalWaves`: `generateWave(idx, s.totalWaves)` |
| Enemy render section | Add drone + gunship draw code; render before ground enemies |
| Turret fire logic | Apply `en.flying ? 0.5 : 1.0` damage multiplier |

---

## Verification Checklist

- [ ] Drones appear in medium raids from wave 3, large raids from wave 2
- [ ] Drones fly at altitude 55, phasing approach → burst → retreat → loop
- [ ] Drones pass over barricades with no collision
- [ ] Turrets fire at drones (at reduced effectiveness until Flak added)
- [ ] Gunships appear in large raids only, fire rockets that splash multiple defenses
- [ ] Rockets render as larger, slower projectiles with distinct color trail
- [ ] Splash damage hits multiple defenses in radius
- [ ] No z-fighting: fliers visually appear above ground (render first in draw order)
- [ ] Killing a drone/gunship grants correct scrap reward
