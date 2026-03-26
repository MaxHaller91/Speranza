# Step 4 — Wealth-Scaling Raids

## Files Touched
- `src/Speranza.jsx` only

---

## Overview

Colony wealth determines raid severity — how many enemies per wave, and the starting size bracket. Heat still controls how *often* raids happen. Wealth controls how *hard* they hit. This creates Rimworld's "success spiral tension": the better you do, the more dangerous your situation becomes.

---

## Wealth Formula

Add this helper outside the component (near other helper functions):

```js
function calcColonyWealth(res, grid, colonists) {
  const resourceWealth = (res.scrap ?? 0) + (res.energy ?? 0) + (res.food ?? 0) + (res.water ?? 0);
  let builtRooms = 0;
  grid.forEach(row => row.forEach(cell => { if (cell.type) builtRooms++; }));
  const roomWealth = builtRooms * 40;
  const popWealth = colonists.length * 15;
  return resourceWealth + roomWealth + popWealth;
}
```

**Wealth brackets:**
| Bracket | Wealth Range | Label |
|---------|-------------|-------|
| 0 | < 300 | Struggling |
| 1 | 300–599 | Established |
| 2 | 600–999 | Prosperous |
| 3 | ≥ 1000 | Wealthy |

Add a helper:
```js
function getWealthBracket(wealth) {
  if (wealth < 300) return 0;
  if (wealth < 600) return 1;
  if (wealth < 1000) return 2;
  return 3;
}
```

---

## Raid Size — Replace Current Logic

**Current code** (~line 961–964):
```js
const hState = getHeatState(next);
let sizeIdx = 0;
if (hState.label === "TARGETED" || hState.label === "HUNTED") sizeIdx = 1;
if (hState.label === "MARKED") sizeIdx = Math.random() < 0.4 ? 2 : 1;
setRaidWindow({ sizeIdx, escalations: 0 });
```

**Replace with:**
```js
const hState = getHeatState(next);
const wealth = calcColonyWealth(resRef.current, gridRef.current, colonistsRef.current);
const wBracket = getWealthBracket(wealth);

let sizeIdx = 0;
// Wealth bracket 0 (Struggling): always Small
// Wealth bracket 1 (Established): Small, 25% chance Medium
// Wealth bracket 2 (Prosperous): Medium, 25% chance Large
// Wealth bracket 3 (Wealthy): Medium, 50% chance Large
if (wBracket === 1) sizeIdx = Math.random() < 0.25 ? 1 : 0;
if (wBracket === 2) sizeIdx = Math.random() < 0.25 ? 2 : 1;
if (wBracket === 3) sizeIdx = Math.random() < 0.50 ? 2 : 1;

// Heat state can push size up one tier (MARKED adds pressure)
if (hState.label === "MARKED" && sizeIdx < 2) sizeIdx = Math.min(sizeIdx + 1, 2);

setRaidWindow({ sizeIdx, escalations: 0, wealthBracket: wBracket });
```

Note: `wealthBracket` is stored on the raidWindow object so it's available when the raid launches and gets passed to the mini-game.

---

## Passing wealthBracket to Mini-game

When the raid transitions from raidWindow to activeRaid (~line 921), `pendingRaidSize` is set. Also need to pass wealth bracket to SurfaceDefense. Two options:

**Simplest:** Add `wealthBracket` to state alongside `pendingRaidSize`:
```js
const [pendingWealthBracket, setPendingWealthBracket] = useState(0);
```

When raid fires (line 921 block):
```js
setSurfaceDefenseActive(true);
setPendingRaidSize(sizeKey);
setPendingWealthBracket(rw.wealthBracket ?? 0);  // from raidWindow state
```

In SurfaceDefense JSX:
```jsx
<SurfaceDefense
  ...
  wealthBracket={pendingWealthBracket}
/>
```

Reset `pendingWealthBracket` to 0 in `handleSurfaceRaidWon`, `handleSurfaceRaidLost`, and `handleNewGame`.

---

## surface_defense.jsx — Wave Intensity

Accept `wealthBracket` prop (default 0):

```js
export default function SurfaceDefense({
  ...,
  wealthBracket = 0,
}) {
```

Add to stateRef:
```js
wealthBracket: 0,
```

Set it on raid activation:
```js
s.wealthBracket = wealthBracket;
```

In `generateWave(idx, totalWaves)`, add a wealth intensity multiplier:

```js
function generateWave(waveIdx, totalWaves, wealthBracket = 0) {
  const w = waveIdx;
  const intensityMult = 1 + (wealthBracket * 0.25);  // 1.0 / 1.25 / 1.5 / 1.75
  const groups = [];

  const gruntCount = Math.round((2 + Math.floor(w * 1.5)) * intensityMult);
  // ... rest of existing logic with gruntCount scaled
```

The `intensityMult` scales enemy counts within a wave. A wealthy colony facing a small raid still gets more grunts per wave than a struggling colony — the *size* (wave count) is the same, but the *density* scales.

Update all `startWave` calls to pass `s.wealthBracket`:
```js
const wave = generateWave(idx, s.totalWaves, s.wealthBracket);
```

---

## resRef

The wealth formula reads `resRef.current`. Check that a ref exists for `res`:

```js
const resRef = useRef(res);
useEffect(() => { resRef.current = res; }, [res]);
```

If this ref doesn't already exist, add it. (It may exist under a different name — check before adding.)

---

## UI — Show Wealth Bracket to Player

In the existing colony log or a header element, optionally show: when a raid window opens, log the wealth bracket context:

```js
addLog(`☢ Arc forces detected — raid incoming! [Colony status: ${["STRUGGLING","ESTABLISHED","PROSPEROUS","WEALTHY"][wBracket]}]`);
```

This gives the player feedback about why they're getting harder raids without needing a dedicated UI element.

---

## Balancing Notes

Starting values are conservative — the brackets and probabilities should be tuned through playtesting. Key tension points:
- Bracket 2 (Prosperous) is where the game starts getting hard. Most players will hit this around Day 8–12.
- Bracket 3 (Wealthy) should feel relentless. By this point the player has all the tools to deal with it.
- The MARKED heat state adding +1 size tier on top of wealth bracket means a Wealthy + MARKED colony is almost always facing Large raids. That's by design — late game should be brutal.

---

## Verification Checklist

- [ ] New colony (bracket 0): only Small raids trigger
- [ ] Mid-game colony (bracket 1–2): mixture of Small/Medium, heat state can push to Large
- [ ] Late-game colony (bracket 3): mostly Medium/Large
- [ ] MARKED heat state correctly bumps size by 1 tier
- [ ] `wealthBracket` is passed to SurfaceDefense and visible in `stateRef`
- [ ] Wave intensity visibly increases with bracket (more grunts per wave at bracket 3 vs bracket 0 same size raid)
- [ ] Wealth bracket logged when raid window opens
- [ ] `pendingWealthBracket` resets to 0 on new game and both raid outcome handlers
