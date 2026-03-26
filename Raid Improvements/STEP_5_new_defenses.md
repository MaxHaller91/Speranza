# Step 5 — New Defenses (Armory L2 Gated)

## Files Touched
- `src/surface_defense.jsx` (new defense types, rendering, behavior)
- `src/Speranza.jsx` (pass armoryLevel prop)

---

## Overview

Two new defenses unlocked at Armory Level 2. The Flak Battery is the dedicated air-defense answer to flying units from Step 2. The EMP Cannon is a high-cost, low-rate-of-fire crowd control tool — the panic button that can turn a losing wave.

Both are visible in the defense picker but locked (grayed out with a lock icon) until `armoryLevel >= 2`. This means this step depends on the Armory upgrade system existing in Speranza.jsx.

**If Armory upgrades don't exist yet:** Implement the defense types and all their behavior now, but render them as permanently locked in the UI. When the Armory upgrade system lands, the only change needed is updating the lock condition.

---

## Speranza.jsx — Pass armoryLevel

Derive armory level from the grid. For now, use a simplified read: find the highest-level Armory room in the grid.

```js
const armoryLevel = (() => {
  let maxLevel = 0;
  grid.forEach(row => row.forEach(cell => {
    if (cell.type === "armory") maxLevel = Math.max(maxLevel, cell.roomLevel ?? 1);
  }));
  return maxLevel; // 0 if no armory built
})();
```

Pass to SurfaceDefense:
```jsx
<SurfaceDefense
  ...
  armoryLevel={armoryLevel}
/>
```

---

## surface_defense.jsx — New Defense Types

Add to `DEFENSE_TYPES`:

```js
flakBattery: {
  label: "FLAK BATTERY",
  cost: 55,
  hp: 50, maxHp: 50,
  range: 110,
  damage: 18,           // per flak burst projectile
  burstCount: 3,        // fires 3 projectiles per burst
  fireRate: 25,         // ticks between bursts (fast)
  color: "#ffaa00",
  width: 20, height: 28,
  requiresArmoryLevel: 2,
  antiAir: true,        // prioritizes flying enemies; 50% damage to ground
},
empCannon: {
  label: "EMP CANNON",
  cost: 65,
  hp: 35, maxHp: 35,
  range: 200,
  damage: 0,            // no HP damage
  stunRadius: 65,       // px — stun all enemies in radius on hit
  stunDuration: 180,    // ticks enemies are stunned (3 seconds at 60fps)
  fireRate: 130,        // slow recharge
  color: "#44ddff",
  width: 16, height: 36,
  requiresArmoryLevel: 2,
  isEMP: true,
},
```

### Accept armoryLevel prop

```js
export default function SurfaceDefense({
  ...,
  armoryLevel = 0,
}) {
```

Pass armoryLevel into stateRef on activation:
```js
s.armoryLevel = armoryLevel;
```

---

## Defense Picker UI — Lock State

In the defense picker button render (around line 651):

```jsx
{phase === "prep" && Object.entries(DEFENSE_TYPES).map(([key, def]) => {
  const requiredLevel = def.requiresArmoryLevel ?? 1;
  const locked = armoryLevel < requiredLevel;
  return (
    <button
      key={key}
      onClick={() => !locked && setSelectedTool(key)}
      title={locked ? `ARMORY LVL ${requiredLevel} REQUIRED` : `${def.label} — ${def.cost} scrap`}
      style={{
        fontFamily: "monospace", fontSize: 8, letterSpacing: 1,
        padding: "4px 8px",
        background: locked
          ? "rgba(255,255,255,0.01)"
          : selectedTool === key ? `${def.color}22` : "rgba(255,255,255,0.03)",
        border: `1px solid ${locked ? "#1a1a1a" : selectedTool === key ? def.color : "#222"}`,
        color: locked ? "#222" : selectedTool === key ? def.color : "#445",
        cursor: locked ? "not-allowed" : "pointer",
        borderRadius: 2,
        opacity: locked ? 0.4 : 1,
      }}
    >
      {locked ? `🔒 ${def.label}` : `${def.label} (${def.cost}⚙)`}
    </button>
  );
})}
```

---

## Flak Battery — Behavior

The Flak Battery fires bursts at flying enemies with priority. Modify the defenses-fire section:

```js
s.defenses.forEach(def => {
  if (def.dead || def.range === 0) return;
  def.fireCooldown--;
  if (def.fireCooldown > 0) return;

  const isFlak = def.type === "flakBattery";
  const isEMP = def.type === "empCannon";

  if (isEMP) {
    // EMP logic — see below
  } else {
    // Normal targeting — flak prioritizes flying enemies
    const flyingInRange = s.enemies.filter(en => !en.dead && en.flying && Math.abs(en.x - def.x) <= def.range);
    const groundInRange = s.enemies.filter(en => !en.dead && !en.flying && Math.abs(en.x - def.x) <= def.range);

    let targets;
    if (isFlak && flyingInRange.length > 0) {
      targets = flyingInRange.sort((a, b) => Math.abs(a.x - def.x) - Math.abs(b.x - def.x)).slice(0, 1);
    } else {
      targets = [...flyingInRange, ...groundInRange].sort((a, b) => Math.abs(a.x - def.x) - Math.abs(b.x - def.x)).slice(0, 1);
    }

    if (targets.length > 0) {
      const target = targets[0];
      const burstCount = def.burstCount ?? 1;
      const dmg = isFlak && !target.flying ? def.damage * 0.5 : def.damage; // flak halved vs ground
      for (let i = 0; i < burstCount; i++) {
        // Slight spread for burst shots
        const spread = i * 8 - ((burstCount - 1) * 4);
        s.projectiles.push(makeProjectile(
          def.x, def.y - def.height + 4,
          target.x + spread, target.y - 10,
          dmg, def.color
        ));
      }
      def.fireCooldown = def.fireRate;
    }
  }
});
```

---

## EMP Cannon — Behavior

EMP fires a slow-moving pulse projectile. On hit, it stuns all enemies in `stunRadius`. Add `stun` fields to enemy objects and check them in movement:

### Enemy object — add stun fields in makeEnemy:
```js
stunned: false,
stunTimer: 0,
```

### In enemy movement block, skip stunned enemies:
```js
s.enemies.forEach(en => {
  if (en.dead) return;

  // Tick down stun
  if (en.stunned) {
    en.stunTimer--;
    if (en.stunTimer <= 0) en.stunned = false;
    return;  // stunned enemies skip all movement and attacks
  }

  // ... existing movement logic
});
```

### EMP projectile — special type:
Add `isEMP: true` flag to EMP projectiles:

```js
function makeEMPProjectile(sx, sy) {
  return {
    id: pid++,
    x: sx, y: sy,
    vx: 0, vy: -0.5,    // slow upward arc
    damage: 0, color: "#44ddff",
    isEMP: true,
    dead: false,
  };
}
```

Wait — EMP should travel toward the center of the enemy cluster, not upward. Find the centroid of all enemies in range and fire toward that:

```js
// In EMP fire logic:
if (isEMP) {
  const inRange = s.enemies.filter(en => !en.dead && Math.sqrt((en.x - def.x)**2 + (en.y - def.y)**2) <= def.range);
  if (inRange.length > 0) {
    const cx = inRange.reduce((sum, e) => sum + e.x, 0) / inRange.length;
    const cy = inRange.reduce((sum, e) => sum + e.y, 0) / inRange.length;
    const dx = cx - def.x, dy = cy - (def.y - def.height);
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const speed = 2;
    s.projectiles.push({
      id: pid++, x: def.x, y: def.y - def.height,
      vx: (dx/dist)*speed, vy: (dy/dist)*speed,
      damage: 0, color: "#44ddff",
      isEMP: true,
      stunRadius: def.stunRadius ?? 65,
      stunDuration: def.stunDuration ?? 180,
      dead: false,
    });
    def.fireCooldown = def.fireRate;
  }
  return;  // skip normal targeting
}
```

### EMP projectile hit detection:

In the projectile-hit section, handle `p.isEMP` separately:

```js
if (p.isEMP) {
  // EMP hits ground on reaching GROUND_Y level, or after traveling certain distance
  if (p.y >= GROUND_Y - 5) {
    // Stun all enemies in radius
    s.enemies.forEach(en => {
      if (!en.dead) {
        const dist = Math.sqrt((en.x - p.x)**2 + (en.y - p.y)**2);
        if (dist <= p.stunRadius) {
          en.stunned = true;
          en.stunTimer = p.stunDuration;
        }
      }
    });
    p.dead = true;
    // Visual: EMP pulse ring — store in a separate effects array for rendering
    s.empPulses = s.empPulses ?? [];
    s.empPulses.push({ x: p.x, y: p.y, radius: 0, maxRadius: p.stunRadius, age: 0 });
  }
} else if (p.splash) {
  // existing splash logic
} else {
  // existing single-target hit logic
}
```

### EMP visual pulse ring:

Add `empPulses: []` to `stateRef`. In the render section, draw expanding rings:

```js
s.empPulses = (s.empPulses ?? []).map(pulse => ({ ...pulse, radius: pulse.radius + 3, age: pulse.age + 1 }))
  .filter(pulse => pulse.radius < pulse.maxRadius);

s.empPulses.forEach(pulse => {
  ctx.beginPath();
  ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(68,221,255,${1 - pulse.radius/pulse.maxRadius})`;
  ctx.lineWidth = 2;
  ctx.stroke();
});
```

### Stunned enemy visual:

When rendering enemies, if `en.stunned`, draw a blue flickering overlay:
```js
if (en.stunned && Math.sin(s.tick * 0.5) > 0) {
  ctx.fillStyle = "rgba(68,221,255,0.3)";
  ctx.fillRect(en.x - en.w/2 - 2, en.y - 36, en.w + 4, 36);
}
```

---

## Rendering — New Defenses

### Flak Battery

```
Base: wide square (20×12px), orange-gold (#ffaa00)
Barrel array: 3 short barrels side by side, angled slightly upward
Central mount: raised box connecting barrels to base
Visual cue: distinctly looks like it's pointing UP, not forward — distinguishing it from turrets
```

```js
if (d.type === "flakBattery") {
  ctx.fillStyle = d.color;
  // Base
  ctx.fillRect(x - 10, y - 12, 20, 12);
  // Three barrels angled upward
  ctx.save();
  ctx.translate(x, y - 12);
  [-6, 0, 6].forEach(ox => {
    ctx.save();
    ctx.translate(ox, 0);
    ctx.rotate(-0.6);  // angled skyward
    ctx.fillRect(-1.5, -14, 3, 14);
    ctx.restore();
  });
  ctx.restore();
}
```

### EMP Cannon

```
Tall slender tower (16×36px)
Dish at top: circular arc/parabola facing upward, 16px diameter
Charging indicator: vertical bar on the side that fills as fireCooldown counts down
Color: cyan (#44ddff)
```

```js
if (d.type === "empCannon") {
  ctx.fillStyle = d.color;
  // Shaft
  ctx.fillRect(x - 4, y - d.height, 8, d.height);
  // Dish
  ctx.beginPath();
  ctx.arc(x, y - d.height, 8, Math.PI, 0, false);
  ctx.fill();
  // Charge bar on side
  const chargeRatio = 1 - (d.fireCooldown / d.fireRate);
  ctx.fillStyle = "#111";
  ctx.fillRect(x + 5, y - d.height + 4, 3, d.height - 8);
  ctx.fillStyle = "#44ddff";
  ctx.fillRect(x + 5, y - (d.height - 8) * chargeRatio - 4, 3, (d.height - 8) * chargeRatio);
}
```

---

## Verification Checklist

- [ ] Flak Battery and EMP Cannon appear in defense picker as locked (grayed) when armoryLevel < 2
- [ ] Clicking locked defense does nothing (no purchase, no selection)
- [ ] armoryLevel >= 2: both defenses purchasable at correct costs
- [ ] Flak Battery prioritizes flying enemies; fires 3-round burst; deals half damage to ground
- [ ] EMP Cannon fires slow projectile toward enemy cluster centroid
- [ ] EMP hit stuns all enemies in radius for correct duration
- [ ] Stunned enemies stop moving and attacking
- [ ] EMP pulse ring expands and fades on hit
- [ ] Stunned enemies show blue flicker overlay
- [ ] EMP charge bar fills between shots
- [ ] Flak and EMP have distinct silhouettes clearly different from Turret/Barricade/Missile
- [ ] Both defenses have HP bars and take damage normally
