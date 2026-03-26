# Step 1 — Bug Fixes & Debug Cleanup

## Files Touched
- `src/surface_defense.jsx`
- `src/Speranza.jsx`

---

## Fix 1: Remove Debug Raid-Size Selector

### Problem
Lines 700–717 of `surface_defense.jsx` render SMALL / MEDIUM / LARGE buttons during the prep phase, letting the player freely change the raid difficulty. This is dev tooling that was never removed.

### What to delete
The entire block at lines 700–717:
```jsx
{phase === "prep" && (
  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
    <span style={{ color: "#334", fontSize: 8, letterSpacing: 1 }}>RAID:</span>
    {["small","medium","large"].map(sz => (
      <button key={sz} onClick={() => resetGame(sz)} style={{ ... }}>
        {sz} ({RAID_SIZES[sz]}W)
      </button>
    ))}
  </div>
)}
```

### After deletion
Nothing replaces this. The `resetGame` function can stay — it's used by the RESTART button on game over. Just remove the raid-size picker UI block.

---

## Fix 2: Suppress Underground Strikes During Surface Defense

### Problem
When a raid fires, both the surface mini-game AND the old tick-based underground strike system start simultaneously. Colonists can be injured/killed during the mini-game even if the player is actively defending. The mini-game outcome should be the only thing that matters:
- WIN → no underground strikes, raid fully repelled
- LOSE → hatch breached, underground strikes take over

### Root Cause
`surfaceDefenseActive` has no ref. The tick loop at ~line 1005 (`if (newStrikeCD <= 0 && newTicksLeft > 0)`) has no awareness of the mini-game state.

### Changes to `src/Speranza.jsx`

**1. Add a ref for surfaceDefenseActive** (add near the other refs, ~line 515):
```js
const surfaceDefenseActiveRef = useRef(false);
useEffect(() => { surfaceDefenseActiveRef.current = surfaceDefenseActive; }, [surfaceDefenseActive]);
```

**2. Guard the strike block in the tick loop** (~line 1004):

Before (current):
```js
// Strike fires this tick
if (newStrikeCD <= 0 && newTicksLeft > 0) {
```

After:
```js
// Strike fires this tick — only if surface defense is not active (mini-game handles surface phase)
if (newStrikeCD <= 0 && newTicksLeft > 0 && !surfaceDefenseActiveRef.current) {
```

That single guard is the entire fix. While the mini-game is running, the strike clock keeps counting down (so when the hatch breaches, strikes resume at the correct cadence) but no damage actually fires.

**3. Verify `handleSurfaceRaidLost` behavior**

Current code (line 1775):
```js
const handleSurfaceRaidLost = () => {
  setSurfaceDefenseActive(false);   // this sets ref to false → strikes resume
  setPendingRaidSize(null);
  unduckMusic();
  addLog("⚠ Surface defenses breached — Arc forces entering colony.");
};
```

This is already correct. When `surfaceDefenseActive` goes false, `surfaceDefenseActiveRef.current` becomes false on the next render, and the strike guard lifts. The existing `activeRaid` continues from wherever its `ticksLeft` and `strikeCountdown` are — the breach consequence kicks in automatically.

**4. Verify `handleSurfaceRaidWon` behavior**

Current code (line 1739):
```js
const handleSurfaceRaidWon = () => {
  setSurfaceDefenseActive(false);
  setActiveRaid(null);   // ← kills the old system entirely
  ...
};
```

Also already correct. No changes needed here.

---

## Verification Checklist

After implementing:
- [ ] No SMALL/MEDIUM/LARGE buttons visible to player during prep phase
- [ ] Start a raid (trigger from heat), place defenses, intentionally lose — confirm "BREACH" message appears and then colonists start taking hits (log shows strike events)
- [ ] Start a raid, win the mini-game — confirm NO colonist strikes fired during OR after the mini-game
- [ ] Check that the `resetGame` button on the won/lost screen still works (it doesn't use the deleted UI, only references `raidSize` state which remains)
