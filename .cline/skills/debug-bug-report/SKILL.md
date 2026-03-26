---
name: debug-bug-report
description: Analyse a Speranza bug report JSON file to diagnose a gameplay issue. Use when the user provides a bug report file, asks you to troubleshoot a ticket, or pastes bug report contents into the chat.
---

# Debug Bug Report

Bug reports are JSON files downloaded from the in-game bug reporter. They contain a complete game state snapshot plus a 10-tick history buffer leading up to the moment the bug was captured. Use this structured process to diagnose the issue.

## Report Structure

```json
{
  "description": "what the player typed",
  "timestamp": "ISO date string",
  "tick": 847,
  "day": 17,
  "recentHistory": [ ...last 10 tick snapshots... ],
  "lastLogEntries": [ ...last 20 colony log strings... ],
  "fullState": {
    "res": { "energy", "food", "water", "scrap", "rp" },
    "heat": 623,
    "morale": 12,
    "grid": [...],
    "colonists": [...],
    "activeRaid": null or RaidState,
    "raidWindow": null or { sizeIdx },
    "surfaceDefenseActive": false,
    "unlockedRows": [...],
    "excavations": {...},
    "expeditions": [...],
    "unlockedTechs": [...],
    "surfaceHaul": {...},
    "memorial": [...],
    "timescale": 0
  }
}
```

Each entry in `recentHistory` is a lean per-tick snapshot:
```json
{
  "tick": 847,
  "heat": 623,
  "activeRaid": false,
  "raidWindow": { "sizeIdx": 1 },
  "surfaceDefenseActive": false,
  "res": { "energy", "food", "water", "scrap" },
  "colonistStatuses": { "Reyes": "working", "Mira": "injured" },
  "toastsFired": ["colonist_injured"]
}
```

---

## Diagnostic Process

### Step 1 — Read the description first
What did the player report? Take it at face value as your starting hypothesis. Note the tick number and day.

### Step 2 — Scan recentHistory for the anomaly
Look at all 10 tick snapshots chronologically (oldest to newest). You're looking for the exact tick where something changed unexpectedly. Common patterns:

**Raid timing bugs:**
- `raidWindow` becomes non-null and then `activeRaid` becomes true in the same tick or too quickly after
- `surfaceDefenseActive` flips to true while `activeRaid` is still null
- Colonist status changes to `"injured"` while `surfaceDefenseActive` is false (raid damage applied outside the minigame)
- `toastsFired` includes `"raid_repelled"` or `"raid_incoming"` before `surfaceDefenseActive` was ever true

**Resource bugs:**
- A resource jumps by an unexpectedly large delta in a single tick (doubling pattern)
- A resource goes negative (should be floored at 0)
- `scrap` changes while `surfaceDefenseActive` is true but no turret purchase should have happened

**State corruption:**
- Both `activeRaid` and `raidWindow` are non-null simultaneously (should be mutually exclusive — raidWindow clears when raid launches)
- `timescale` is 0 (game paused) but resource values are still changing between ticks

### Step 3 — Cross-reference fullState
Once you've identified the suspect tick in history, look at `fullState` for corroborating evidence:
- What is `colonists` showing for the injured colonist? Is `injuryTicksLeft` set? Is `injuryCount` incremented?
- What is the grid state? Are sentry posts manned? Is the armory armed?
- What techs are unlocked? Barricades can block raids — was it meant to block this one?
- What is `heat` relative to `HEAT_MAX (1000)`? Is it plausible a raid triggered here?

### Step 4 — Check lastLogEntries
The colony log strings often contain the smoking gun — they're written in human-readable form at the moment events fire. Look for:
- Out-of-order messages (raid repelled before raid started)
- Duplicate messages (same event firing twice)
- Timestamps that don't match the tick number

### Step 5 — Form a hypothesis and map it to code

State your hypothesis clearly before suggesting any code change. Example:
> "At tick 844, raidWindow opened. At tick 845, activeRaid became true AND surfaceDefenseActive became true simultaneously, but colonist injury logic also fired at tick 845. This suggests the main raid damage tick runs before surfaceDefenseActive is checked, meaning the guard condition needs to move earlier in the tick loop."

Then identify the exact location in Speranza.jsx where the fix belongs. Read that section before touching it.

---

## Common Bug Patterns and Their Fixes

**Raid fires before minigame / colonists injured during minigame setup:**
→ The tick loop's colonist injury logic probably doesn't check `surfaceDefenseActive`. Add a guard: only apply raid strikes if `!surfaceDefenseActive`.

**Toast fires before event actually happened:**
→ A toast is being pushed in the wrong phase of the tick loop. Find where `toastsFired` contains the premature key and check if it's running before or after the state transition it's meant to announce.

**Resource doubling:**
→ See the `debug-tick-loop` skill. Almost always a stale closure or an `onScrapChange` receiving an absolute value instead of a delta.

**Both raidWindow and activeRaid set simultaneously:**
→ The raidWindow clear is happening after the activeRaid set instead of before it. Reorder: clear raidWindow first, then set activeRaid.

---

## What to Tell the Player After Diagnosing

Summarise in plain language:
1. What the bug was (what actually happened vs what should have happened)
2. Which tick it occurred on and what the state was
3. What the fix is
4. Whether it needs a new bug report to verify the fix worked
