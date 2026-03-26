# Step 3 — Sentry Post → Bunker Integration

## Files Touched
- `src/Speranza.jsx` (prop calculation + new callback handler)
- `src/surface_defense.jsx` (bunker rendering + behavior)

---

## Overview

Sentry Post colonists assigned in the colony automatically appear as a Bunker unit in the surface defense mini-game. This creates a direct, visible connection between colony decisions and mini-game outcomes. Building and staffing a Sentry Post has a tangible payoff in every raid. Losing the Bunker has a real consequence: those colonists get injured back in the colony.

---

## Speranza.jsx Changes

### 1. Calculate sentryWorkers

In the render section (or just before the SurfaceDefense JSX at line 2723), derive the count:

```js
const sentryWorkers = (() => {
  let count = 0;
  grid.forEach(row => row.forEach(cell => {
    if (cell.type === "sentryPost") count += cell.workers;
  }));
  return count;
})();
```

### 2. Add `onBunkerDestroyed` handler

When the Bunker is destroyed, all Sentry Post workers become injured in the colony. Add near `handleSurfaceRaidWon` / `handleSurfaceRaidLost`:

```js
const handleBunkerDestroyed = () => {
  setColonists(prev => prev.map(c => {
    if (c.status === "onSentry") {
      return { ...c, status: "injured", injuryTicksLeft: INJURY_TICKS_BASE, injuryCount: (c.injuryCount ?? 0) + 1 };
    }
    return c;
  }));
  addLog("💥 Surface bunker destroyed — sentry workers are injured.");
  addToast("💥 BUNKER DESTROYED\nSentry workers caught in the blast.\nAll sentries injured.", "injury");
  playInjury();
  changeMoraleRef.current(-8, "bunker destroyed");
};
```

Note: colonists with `status === "onSentry"` are the Sentry Post workers. No new status needed.

### 3. Pass new props to SurfaceDefense

```jsx
<SurfaceDefense
  scrap={res.scrap}
  onScrapChange={(delta) => setRes(r => ({ ...r, scrap: Math.max(0, r.scrap + delta) }))}
  raidSize={pendingRaidSize ?? "small"}
  active={surfaceDefenseActive}
  onRaidWon={handleSurfaceRaidWon}
  onRaidLost={handleSurfaceRaidLost}
  sentryWorkers={sentryWorkers}           // NEW
  onBunkerDestroyed={handleBunkerDestroyed} // NEW
/>
```

---

## surface_defense.jsx Changes

### 1. Accept new props

```js
export default function SurfaceDefense({
  active, scrap: initialScrap, onScrapChange, raidSize: initialRaidSize,
  onRaidWon, onRaidLost,
  sentryWorkers = 0,          // NEW
  onBunkerDestroyed,          // NEW
}) {
```

### 2. Bunker state in stateRef

Add to `stateRef.current` initial shape:

```js
bunker: null,  // null | { x, hp, maxHp, slots, fireCooldown }
```

On raid activation (in the `active` useEffect, where state is reset):

```js
s.bunker = sentryWorkers > 0 ? {
  x: HATCH_X - 120,              // positioned left of hatch
  hp: sentryWorkers * 60,        // 60 HP per sentry worker
  maxHp: sentryWorkers * 60,
  slots: sentryWorkers,          // number of gun positions
  fireCooldown: 0,
  damage: 4,                     // low damage per shot
  fireRate: 20,                  // ticks between shots (per slot fires independently)
  range: 140,
} : null;
```

### 3. Bunker behavior in game loop

Add after the defenses-fire section, before cleanup:

```js
// ── BUNKER (sentry workers) ──
if (s.bunker && s.bunker.hp > 0) {
  const bk = s.bunker;
  bk.fireCooldown--;
  if (bk.fireCooldown <= 0) {
    // Each slot fires at nearest enemy in range
    const inRange = s.enemies.filter(en => !en.dead && Math.abs(en.x - bk.x) <= bk.range);
    const targets = inRange.slice(0, bk.slots); // one target per slot
    targets.forEach(t => {
      s.projectiles.push(makeProjectile(bk.x, GROUND_Y - 20, t.x, t.y - 10, bk.damage, "#ffcc00"));
    });
    bk.fireCooldown = bk.fireRate;
  }
}

// Enemies attack bunker if adjacent (bunker is a collideable structure)
s.enemies.forEach(en => {
  if (!en.dead && s.bunker && s.bunker.hp > 0 && !en.flying) {
    const dist = Math.abs(en.x - s.bunker.x);
    if (dist < 25) {
      // Stop and attack bunker same as barricade logic
      en.attackCooldown--;
      if (en.attackCooldown <= 0) {
        s.bunker.hp -= en.damage;
        en.attackCooldown = 60;
        if (s.bunker.hp <= 0) {
          s.bunker.hp = 0;
          if (onBunkerDestroyed) onBunkerDestroyed();
        }
      }
    }
  }
});
```

### 4. Bunker rendering

Render in the draw section, before enemies, after defenses. The bunker is a distinct fortified structure:

```
Bunker structure (x = bk.x, y = GROUND_Y):
- Main body: wide rectangle (40px × 20px), low to ground, gray (#2a2a2a)
- Sandbag mounds: 3 stacked ellipses across the top, color #8b7355
- Gun ports: slots number of small dark rectangles along the front face (facing right toward hatch)
- Muzzle flash: brief yellow circle at gun port when fireCooldown < 3

HP bar above bunker:
- 50px wide, 4px tall
- Background: #300
- Fill: hpRatio > 0.5 ? "#ffcc00" : "#ff4400"
- Label: "SENTRY × {slots}" in tiny text above bar

When bunker HP reaches 0: render as rubble (dark gray irregular shape, no gun ports)
```

```js
if (s.bunker) {
  const bk = s.bunker;
  const hpr = bk.hp / bk.maxHp;

  // Main body
  ctx.fillStyle = bk.hp > 0 ? "#2a2a2a" : "#1a1210";
  ctx.fillRect(bk.x - 20, GROUND_Y - 20, 40, 20);

  // Sandbags
  if (bk.hp > 0) {
    ctx.fillStyle = "#8b7355";
    [-12, 0, 12].forEach(ox => {
      ctx.beginPath();
      ctx.ellipse(bk.x + ox, GROUND_Y - 20, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Gun ports
  if (bk.hp > 0) {
    for (let i = 0; i < bk.slots; i++) {
      const px = bk.x - 15 + (i * (30 / Math.max(bk.slots, 1)));
      ctx.fillStyle = "#111";
      ctx.fillRect(px, GROUND_Y - 14, 6, 4);
      // Muzzle flash
      if (bk.fireCooldown < 3) {
        ctx.fillStyle = "#ffcc0088";
        ctx.beginPath();
        ctx.arc(px + 3, GROUND_Y - 12, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // HP bar
  ctx.fillStyle = "#300";
  ctx.fillRect(bk.x - 25, GROUND_Y - 32, 50, 4);
  ctx.fillStyle = hpr > 0.5 ? "#ffcc00" : "#ff4400";
  ctx.fillRect(bk.x - 25, GROUND_Y - 32, 50 * hpr, 4);

  // Label
  ctx.fillStyle = "#ffcc0088";
  ctx.font = "7px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`SENTRY ×${bk.slots}`, bk.x, GROUND_Y - 36);
}
```

---

## Balancing Notes

- 1 sentry worker: 60 HP bunker, fires at 4 dmg every 20 ticks — roughly equivalent to half a turret in DPS, but positioned fixed and cannot be upgraded
- 3 sentry workers: 180 HP, 3 simultaneous shots — a meaningful defensive anchor
- Bunker position (HATCH_X - 120) is left of the hatch — provides a choke point for ground enemies approaching from the left, and a fire arc covering center and right

The bunker should feel like a helpful but fragile bonus, not a win condition by itself. Players who invest in Sentry Posts get a noticeable advantage without the mini-game becoming trivial.

---

## Verification Checklist

- [ ] 0 sentry workers → no bunker appears in mini-game
- [ ] 1+ sentry workers → bunker appears at correct position before wave 1
- [ ] Bunker fires at nearest enemy in range, one shot per slot per fire cycle
- [ ] Ground enemies stop to attack bunker when adjacent (same as barricade behavior)
- [ ] Drones ignore bunker (flying enemies)
- [ ] Bunker HP reaching 0 calls `onBunkerDestroyed`, all sentry colonists become injured in colony
- [ ] Bunker renders as rubble after HP 0 (cosmetic, no longer functional)
- [ ] No bunker = no injury callback fired
- [ ] Bunker HP bar displays correctly, changes color at 50% HP
