# Step 2 — Wire the unused lore content

**Why this is the highest value-per-hour work left.** `speranza-lore.js` contains
several fully-authored systems that nothing imports. `checkMilestoneTrigger()` in
`gameData.js` even handles `commandersKilled`, `tradersVisited`, `artifacts`, and
`directivesActive` — milestone triggers for systems that do not exist. Someone
designed these and never connected them.

Wiring existing content is far cheaper than authoring new content, and it is
already tonally consistent.

## Audit first

Before building anything, confirm what is actually unused:

```bash
for sym in TRADERS DIRECTIVES ARTIFACT_TEMPLATES ARTIFACT_ITEMS \
           COMMANDER_NAMES COMMANDER_WEAKNESSES COMMANDER_STRENGTHS; do
  echo "=== $sym ==="
  grep -rn "$sym" src/ --include=*.js --include=*.jsx | grep -v Backups
done
```

`SURFACE_LOCATIONS` was in this state until `8829d88` — it had `rollMods` on all
eight destinations that nothing read, so every destination played identically.
Expect more of the same.

## Recommended order

Do these one at a time, verifying each in the browser before the next. Do **not**
build all four in parallel.

**Status: 2a, 2b, 2c done. 2d (Commanders) is the only one left.** See
`memory-bank/progress.md` for the writeup of each.

### 2a. Traders — DONE

Cheapest and most immediately fun. A trader arrives periodically, offers a
bounded swap, and leaves.

- New state: `activeTrader: null | { id, name, offers, expiresAtTick }`,
  plus a ref mirror (the tick loop reads it).
- Trigger it the same way dilemmas are triggered — in the tick-loop body, **not**
  inside a state updater. Copy the shape of the dilemma trigger in `Speranza.jsx`
  (search `dilemmaTimerRef`).
- Reuse `DilemmaModal`'s props-only pattern for the UI; do not invent a new
  modal system.
- Feeds the existing `tradersVisited` milestone trigger.
- Gate on the Radio Tower being built, so the building earns a second purpose.

### 2b. Artifacts — DONE

`ARTIFACT_TEMPLATES` / `ARTIFACT_ITEMS` are a natural expedition reward and slot
into the loot pipeline that already exists.

- Add `artifact` to the expedition loot object in `advanceExpeditions()`
  (`gameData.js`), alongside `schematicFound`. Follow that field exactly — it
  already handles claim-tracking so two simultaneous expeditions cannot both
  find the same one.
- Surface found artifacts in the colonist detail panel or a small colony
  collection view.
- Feeds the existing `artifacts` milestone trigger.

### 2c. Directives — DONE

Colony-wide standing orders the player sets, with a tradeoff.

- New state `activeDirectives: string[]` + ref mirror.
- Apply effects in the tick loop where the relevant number is computed.
- Feeds `directivesActive`.

Shipped as designed, with one deliberate deviation: the lore file's header
comment said "Unlocked via Research Lab L3", but this codebase has no room
upgrade-level system (`HANDOFF.md`/`progress.md` explicitly warn against
inventing placeholder level fields for exactly this reason). Gated on a
**built** Research Lab instead — the same pattern Traders already used for the
Radio Tower, an existing room earning a second purpose. `MAX_ACTIVE_DIRECTIVES
= 3` per the file's own comment. Also skipped triageProtocol's "Worn Out risk
reduced" clause — there is no Worn Out mechanic in the codebase to reduce
(`injuryCount` is tracked and displayed but nothing reads it as a death
trigger); its other two effects (production, heal rate) shipped as described.

### 2d. Commanders

Named raid leaders with a strength and a weakness. Biggest of the four — do last.

- Attach a commander to a raid when the raid window opens.
- `COMMANDER_WEAKNESSES` should map to something the player can actually exploit
  in the surface defense minigame (e.g. weak to missiles, or to EMP stun).
- Feeds `commandersKilled`.

## Rules

- Every new piece of top-level state needs: a ref mirror, inclusion in
  `buildSaveState()` / `applyLoadedState()`, and a reset in `handleRestart()`.
  Search for `deprivedTicks` in `Speranza.jsx` — it is a complete recent example
  of all four.
- Triggers and rolls go in the tick-loop body. Not in updaters.
- New modals must obey the existing overlay pause. Do **not** add another
  `setTimescale` caller — see the pause-ownership warning in
  `../expedition-decisions-v2.md`.

## Done when

- [ ] The audit command reports no remaining unused lore exports
- [ ] Each wired system fires in a real playthrough, verified in browser
- [ ] The dormant milestone triggers can actually be reached
- [ ] `npm run build` passes and the impure-updater audit still reports `0`
