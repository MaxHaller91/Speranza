# Step 1 — Bug Fixes & Debug Cleanup

## Purpose

This step is the stabilization pass. Do this before adding new raid features.

Follow the project rules while implementing:

- re-read the file before editing it
- do not trust old line numbers
- make surgical edits
- preserve `onScrapChange(delta)` semantics
- if the tick loop reads state, use a ref mirror

---

## Files Touched

- `src/surface_defense.jsx`
- `src/Speranza.jsx`

---

## Ownership

- `src/surface_defense.jsx` owns minigame UI, local lifecycle, local debug controls, minigame-only restart affordances
- `src/Speranza.jsx` owns main raid lifecycle, colony consequences, tick-loop strike resolution, and parent callbacks

Do not move logic into `src/components/` for this step.

---

## Audit Before Coding

Before implementing anything in this step, verify in the live files:

1. whether the raid-size debug picker is still present
2. whether `surfaceDefenseActiveRef` already exists
3. whether the underground strike block is already guarded
4. whether a post-win/post-loss restart button still exists
5. whether the fled-colonist ghost bug is still present

If something is already fixed, mark it as complete and do not re-implement it.

---

## Current Known Scope

This step covers four cleanup targets:

| Fix | Description |
|-----|-------------|
| 1a | Remove any dev-only raid-size selector still visible to players |
| 1b | Suppress underground strike damage while surface defense is active |
| 1c | Remove any dev-only restart UI that can desync state |
| 1d | Fix the fled-colonist ghost bug |

---

## Fix 1a — Remove Debug Raid-Size Selector

### Intent

Players should not be able to choose raid difficulty from minigame debug buttons.

### Implementation guidance

- re-read the prep-phase controls in `src/surface_defense.jsx`
- if a SMALL / MEDIUM / LARGE picker still exists, remove only that UI block
- do not remove the underlying reset/helper function unless the function is truly unused after the UI is gone

---

## Fix 1b — Suppress Underground Strikes During Surface Defense

### Intent

While the surface minigame is active, the underground strike system should not apply damage. Only a breach should allow underground consequences to resume.

### Implementation guidance

In `src/Speranza.jsx`:

1. identify the main strike-resolution block inside the tick loop
2. ensure that block is gated by the current surface-defense state
3. if the tick loop reads `surfaceDefenseActive`, confirm it uses a ref mirror rather than direct state access

Preferred pattern:

- `surfaceDefenseActive` state in React
- `surfaceDefenseActiveRef` mirrored through `useEffect`
- strike block guarded with `!surfaceDefenseActiveRef.current`

---

## Fix 1c — Remove Dev-Only Restart UI

### Intent

The player should not be able to locally restart the minigame after a won/lost outcome if doing so leaves colony state, raid state, or scrap state out of sync.

### Implementation guidance

In `src/surface_defense.jsx`:

- re-read the post-outcome controls for `phase === "won"` and `phase === "lost"`
- if a visible restart button exists, remove the button only
- keep internal reset helpers if they are still used by activation/reset lifecycle

---

## Fix 1d — Fled Colonist Ghost Bug

### Intent

If a colonist flees and is recorded in the memorial, they must not remain in the active colony roster.

### Implementation guidance

In `src/Speranza.jsx`:

1. find the raid-strike path where a colonist flees
2. verify whether the code currently marks them idle while also adding them to the memorial
3. if so, remove them from `colonists[]` rather than leaving them in the roster

Use the same style already used elsewhere for removing dead colonists if such a pattern already exists.

---

## Verification Checklist

- [ ] No dev-only raid-size selector is visible during prep
- [ ] No dev-only restart button is visible after win/loss
- [ ] Underground strikes do not resolve while `surfaceDefenseActive` is true
- [ ] Winning the minigame fully resolves the raid without underground strikes resuming afterward
- [ ] Losing the minigame allows underground consequences to resume through the normal parent-side lifecycle
- [ ] A fleeing colonist is not present in both the roster and memorial
- [ ] `onScrapChange` remains delta-based after all edits
