# Raid System Overhaul — Master Plan

## Design Intent

Every raid begins as a surface defense mini-game. The old tick-based underground strike system only fires if the player's surface defenses are breached (hatch HP reaches 0). Winning on the surface means the colony takes zero hits. Losing means Arc forces are underground and the colony suffers the consequences.

The mini-game should feel tense, skill-expressive, and directly connected to the colony you've built. Your Sentry Post workers show up as defenders. Your colony's wealth determines how hard the Arc hits you.

---

## Steps — In Order

| Step | Name | File | Status |
|------|------|------|--------|
| 1 | Bug Fixes & Debug Cleanup | STEP_1_bug_fixes.md | TODO |
| 2 | Flying Arc Units | STEP_2_flying_units.md | TODO |
| 3 | Sentry Post → Bunker Integration | STEP_3_sentry_bunker.md | TODO |
| 4 | Wealth-Scaling Raids | STEP_4_wealth_scaling.md | TODO |
| 5 | New Defenses (Armory L2 Gated) | STEP_5_new_defenses.md | TODO |

---

## Step Summaries

### Step 1 — Bug Fixes & Debug Cleanup
Two problems to fix before any new features land:
1. The underground strike system runs during the mini-game. It should be completely suppressed while surface defense is active — strikes only resume if the hatch is breached.
2. The surface_defense.jsx has a visible raid-size selector (SMALL / MEDIUM / LARGE buttons) that lets the player pick their raid difficulty. This is dev tooling that was never removed.

### Step 2 — Flying Arc Units
Two new enemy types that fly above ground level, bypassing all barricades and forcing the player to think about defense placement differently.

**Light Flier — Arc Drone**
- Fast, low HP, mid-altitude (~y 60)
- Sinusoidal weave path — harder for turrets to lead
- Fires a burst of 3 small machine-gun rounds at the hatch, then loops back, then re-approaches
- Not blocked by barricades at all — flies over them
- Turrets can target it normally. Barricades are useless against it.

**Heavy Flier — Arc Gunship**
- Slow, high HP, high altitude (~y 30)
- Fires one large slow rocket per pass that deals splash damage — can destroy multiple defenses at once
- Does NOT attack the hatch directly — it suppresses defenses so ground units can push through
- Countered by: Missile Launchers (prioritize air targets). Turrets deal 50% damage to it.
- The terror unit. Demands a specific defensive response.

Wave generator changes: fliers appear from wave 3 onwards in medium raids, wave 2 in large raids.

### Step 3 — Sentry Post → Bunker Integration
Sentry Post colonists assigned in the colony automatically appear as defenders in the surface mini-game.

- Speranza.jsx passes `sentryWorkers` count as prop to SurfaceDefense
- SurfaceDefense renders a Bunker structure in center-left of the surface
- Each sentry worker = 1 gun slot in the bunker
- Bunker auto-fires at nearest enemy: low damage (4 per shot), fast fire rate (every 20 ticks)
- Bunker has its own HP pool (60 HP per worker slot, shared)
- If Bunker HP reaches 0: all bunker-assigned colonists become `injured` back in the colony (real consequence — passed via callback)
- Bunker workers do NOT count as idle colonists during the raid

### Step 4 — Wealth-Scaling Raids
Colony wealth (not a fixed formula) determines starting raid size and wave intensity. Rich, expanded colonies draw harder raids.

**Wealth formula:**
```
wealth = (res.scrap + res.energy + res.food + res.water) + (builtRooms * 40) + (colonists.length * 15)
```

**Raid scaling:**
- Wealth < 300: always starts Small
- Wealth 300–600: starts Small, 30% chance Medium
- Wealth 600–1000: starts Medium, 20% chance Large
- Wealth > 1000: starts Large, 20% chance Boss (once Boss tier exists)

Additionally: total wave count within a size scales with wealth. A "small" raid against a wealthy colony sends more enemies per wave than a small raid against a struggling colony. Wave count = base ± 1 based on wealth bracket.

This replaces the current "heat state → size index" mapping at tick loop line 961–964. Heat state still controls raid frequency. Wealth controls raid severity.

### Step 5 — New Defenses (Armory L2 Gated)
Two new placeable defenses unlocked when the colony has a Level 2 Armory.

**Flak Battery** (cost: 55 scrap)
- Short range (100), burst fire (fires every 20 ticks, 3 projectiles per burst)
- Targets flying enemies with priority — ground enemy damage halved
- Splash radius: projectiles deal 50% damage to nearby enemies on hit
- The dedicated anti-air answer. Pairs with turrets for full coverage.

**EMP Cannon** (cost: 65 scrap)
- Long range (200), very slow fire rate (every 120 ticks)
- On hit: stuns all enemies in a 60px radius for 3 seconds (180 ticks)
- Deals no HP damage — pure crowd control
- The "oh shit" button. One well-placed EMP can save a wave when everything is breaking.

**Gating mechanism:** SurfaceDefense receives `armoryLevel` prop from Speranza.jsx. In the defense picker UI, Flak Battery and EMP Cannon show as locked (grayed, lock icon, "ARMORY LVL 2") when `armoryLevel < 2`. Note: this requires the Armory upgrade system to exist. If it doesn't yet, these defenses remain hidden entirely until that system lands.

---

## Architecture Notes

### Prop Interface — SurfaceDefense Component
After this update, the SurfaceDefense component accepts:
```js
SurfaceDefense({
  active,           // bool — whether raid is currently happening
  scrap,            // number — colony scrap passed in
  onScrapChange,    // (delta) => void — reports scrap spent/earned back to colony
  raidSize,         // "small" | "medium" | "large" — set by the raid system
  wealthBracket,    // 0|1|2|3 — controls wave intensity within size (Step 4)
  sentryWorkers,    // number — colonists in Sentry Post (Step 3)
  armoryLevel,      // number — unlocks new defenses (Step 5)
  onRaidWon,        // () => void — surface fully defended
  onRaidLost,       // () => void — hatch breached, old system takes over
  onBunkerDestroyed,// () => void — sentry workers injured (Step 3)
})
```

### Speranza.jsx Touch Points
- Step 1: Add `surfaceDefenseRef`, guard strike block at ~line 1005
- Step 3: Add `sentryWorkers` calculation, pass to SurfaceDefense, add `onBunkerDestroyed` handler
- Step 4: Add wealth calculation, replace sizeIdx logic at ~line 961
- Step 5: Pass `armoryLevel` prop (reads from grid state)

---

## What This Does NOT Change
- The scrap pool remains shared — colony scrap is mini-game scrap
- The raid trigger system (heat → raid window → raid launch) is unchanged
- `handleSurfaceRaidWon` and `handleSurfaceRaidLost` callbacks remain the handoff points
- The old underground strike tick loop remains intact — it just only runs post-breach
