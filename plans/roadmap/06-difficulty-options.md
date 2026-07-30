# Step 6 — Difficulty options

There is one difficulty. Adding options widens the audience a lot, and the
refactoring already done makes it genuinely small: the balance levers are now
isolated pure functions.

## The levers

All in `gameData.js`, all pure:

- `calcHeatDelta({ builtRooms, sentryWorkers, threatMult, suppressed })`
- `calcRaidChance(heat)`
- `waveBudget(waveIdx, totalWaves, wealthBracket)` in `surface_defense.jsx`
- `DEPRIVE_COLLAPSE_TICKS` / `DEPRIVE_DEATH_TICKS`
- `RAID_GRACE_TICKS`

## Build

```js
export const DIFFICULTIES = {
  settler:   { label: "SETTLER",   heatMult: 0.7, raidMult: 0.7, waveMult: 0.75, graceMult: 1.5 },
  survivor:  { label: "SURVIVOR",  heatMult: 1.0, raidMult: 1.0, waveMult: 1.0,  graceMult: 1.0 },
  condemned: { label: "CONDEMNED", heatMult: 1.3, raidMult: 1.35, waveMult: 1.3, graceMult: 0.6 },
};
```

Thread a `difficulty` key through as state, pass the multipliers into those
functions. Because they are pure, this is parameter plumbing, not redesign.

Choose at new-colony time. Store it in the save. Show it on the game-over screen
(it belongs in the obituary).

## Verify with simulation, not vibes

The heat/raid curve was tuned by simulating 40-day runs, not by playing. Reuse
that approach — write a throwaway node script that reports raids/day per 5-day
window for each difficulty, and confirm the curves are actually distinct.

## Done when

- [ ] Three difficulties produce measurably different raid cadence in simulation
- [ ] Setting persists in save and appears on the game-over screen
- [ ] Existing saves default to `survivor`
