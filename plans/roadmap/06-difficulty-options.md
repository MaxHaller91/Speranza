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

- [x] Three difficulties produce measurably different raid cadence in simulation —
  a throwaway 25-day, 10-seed sim (raids/5-day-window) gave totals of 7.2
  (settler) / 10.4 (survivor) / 16.2 (condemned).
- [x] Setting persists in save and appears on the game-over screen
- [x] Existing saves default to `survivor`

## Implementation notes (2026-07-31)

Added a fourth lever beyond the three in this doc's original sketch:
`moraleDrainMult`, scaling every *negative* morale delta (passive
crowding/adjacency drain, quirk stress, and all event-driven losses routed
through `changeMorale` — raids, dilemmas, desertion, deprivation). The soak
test (`memory-bank/progress.md`, "Automated Soak Test") found morale collapse,
not resource starvation, kills an unmanaged early colony, so heat/raid
softening alone wouldn't have unblocked the soak.

`DIFFICULTIES` lives in `gameData.js`. Difficulty is chosen on the game-over
screen's "NEW COLONY" flow (`GameOverModal.jsx`) — there is no separate
main-menu/start-screen in this codebase, so that is the only "new colony"
moment that exists. The very first colony of a fresh session always starts on
`survivor`. `waveMult` also required a new parameter on `waveBudget` /
`generateWave` / `waveComposition` in `surface_defense.jsx`; `heatMult` and
`raidMult` fold into the existing `threatMult`/`condRaidMult` multipliers at
the tick-loop call site rather than changing `calcHeatDelta`'s/
`calcRaidChance`'s signatures. `graceMult` scales `RAID_GRACE_TICKS` and
`raidCooldownFor()`'s per-size cooldowns.
