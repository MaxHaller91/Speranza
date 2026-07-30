# Speranza — Master Roadmap

Branch: `opus-5` (off `testing`) · Last updated: 2026-07-30

This is the handoff document. It covers what changed, the rules the codebase now
depends on, and the ordered work remaining. Read **Non-Negotiable Rules** before
touching anything — two of them explain bugs that were mis-diagnosed for months.

---

## Non-Negotiable Rules

### 1. Never write `cell.workers` directly

`cell.workers` is a **derived mirror** of colonist assignments. To staff or
unstaff a room, set the colonist's `assignedRoom` and let the reconciler in
`Speranza.jsx` update the count.

```js
// WRONG — the count will drift from reality
setGrid(g => { g[r][c].workers -= 1; return g; });

// RIGHT
setColonists(prev => prev.map(c => c.id === id ? { ...c, assignedRoom: null, status: "idle" } : c));
```

Before this, every "remove a worker" path picked a **random staffed room**, so a
raid could injure someone in the Hydroponics and dock a worker from the Armory.
That was the "worker/status desync" in `progress.md`.

Helpers: `pruneInvalidAssignments`, `reconcileGridWorkers`, `occupiedSeats`,
`reclaimPost`, `postStatusFor`, `isOnPost` — all in `gameData.js`.

### 2. No randomness or side effects inside state updaters

`main.jsx` renders under `StrictMode`, which **double-invokes every state
updater in development**. Anything impure inside one runs twice.

```js
// WRONG — logs twice, and rolls twice with different results
setColonists(prev => {
  if (Math.random() < 0.1) { addLog("X deserted"); return prev.filter(...); }
  return prev;
});

// RIGHT — decide first, updater is a pure transform, effects after
const victim = pick(colonistsRef.current);
if (victim && Math.random() < 0.1) {
  setColonists(prev => prev.filter(c => c.id !== victim.id));
  addLog(`${victim.name} deserted`);
}
```

This single mistake caused, at various times: raid toasts firing twice
(previously blamed on a missing dedupe guard), level-ups logged twice, and
**every expedition resolving twice per tick with different outcomes**.

Audit script — must report **0**:

```bash
python - <<'EOF'
import io,re
s=io.open('src/Speranza.jsx',encoding='utf-8').read().split('\n')
starts=[i for i,l in enumerate(s) if re.search(r'\bset[A-Z]\w*\(\s*\(?\s*\w+\s*\)?\s*=>', l)]
out=[]
for i in starts:
    depth=0; body=[]
    for j in range(i, min(i+90, len(s))):
        depth += s[j].count('(') - s[j].count(')')
        body.append(s[j])
        if depth<=0 and j>=i: break
    kinds={k for t in body[1:] for k in
        ['addLog','addToast','Math.random','pushEventTrace','setGameOver','addToMemorial','changeMorale']
        if k+'(' in t}
    if any(re.search(r'\bplay[A-Z]',t) for t in body[1:]): kinds.add('play')
    if kinds: out.append((i+1, s[i].strip()[:56], sorted(kinds)))
print('impure updaters:', len(out))
for ln,h,k in out: print(f'  line {ln}: {h} -> {", ".join(k)}')
EOF
```

A *deterministic* `prev => prev.map(...)` is fine — purity is the requirement,
not "avoid updaters".

### 3. The tick loop reads refs, never state

The interval has `[timescale]` deps. Every piece of state it touches needs a ref
mirror kept in sync by its own effect. When a handler commits expedition state,
update `expeditionsRef.current` in the same breath or the next tick reads stale
data.

### 4. Testing gotchas that will waste your time

- **`npm run build` reloads the dev page.** Vite watches the project directory
  and `dist/` is inside it. Never build in the middle of an in-browser test.
- **Editing any project file reloads the page too**, including markdown.
- **Opening the Colony Log pauses the game** — `journalOpen` is in the
  overlay-pause list. A log-watching test will fight the clock.

---

## Done on `opus-5`

| Commit | What |
|---|---|
| `1d18fef` | Colonist→room assignment as single source of truth |
| `1109176` | Animated colonist sprites that walk to their modules |
| `423dae8` | Heat/raid rebalance; starvation as a survivable process |
| `8a8e879` | All randomness/side effects out of state updaters (11 sites) |
| `6d75ac2` | Base defense minigame depth |
| `39f0a3a` | Double-logged level-ups |
| `0a6fdac` | Expeditions phase 1 — pure advancement transition |

### Balance changes worth knowing

- **Sentries** mitigate a *percentage* of heat gain (18% each, 60% cap). They
  used to be a flat −5/tick, which meant one fully-staffed Sentry Post out-ran
  the maximum gain of a completely full grid — building one switched raids off
  for the rest of the run.
- **Raids roll every 8 ticks**, not once at midnight. Simulated: 0.28 raids/day
  early → 0.65 late, heat climbing 165 → 787.
- **Post-raid heat relief is proportional** (35%), producing a sawtooth instead
  of pinning at max forever.
- **Wave difficulty** uses a threat budget (20 → 210) spent across a fixed unit
  mix, replacing an if-ladder that cliffed from 2 grunts to 35+ units.

### Dev harnesses (excluded from production build — verify this stays true)

- `/Speranza/sprites.html` — every colonist pose at magnification
- `/Speranza/defense.html` — the minigame at any raid size / wealth / sentry count

---

## Remaining Work, In Order

### A. Expeditions — phases 2-6

Follow `plans/expedition-decisions-v2.md`. **Phase 1 is done and verified.**

Four gaps in that plan to close before implementing past Phase 2:

1. **What happens to `EXPEDITION_ROLL_TABLES`?** Phase 1 kept automatic rolls;
   Phase 3 adds authored decisions. The plan never says whether both run. If
   they do, it is still a slot machine with extra clicks. *Recommendation:*
   authored decisions replace the roll table for meaningful outcomes; keep the
   table only for low-stakes ambient colour, or delete it.
2. **Pause ownership is unspecified.** `ToastPanel`'s dismiss handler calls
   `setTimescale` independently, and so does the overlay effect in
   `Speranza.jsx`. Make one owner *before* adding expedition prompts as a third
   caller, or overlays will resume the game underneath each other.
3. **`pacePenalty` has no unit.** Define it: flat ticks added to `ticksLeft`, or
   a multiplier. Pick one and write it down.
4. **`applyLoadedState` never reads `saveVersion`.** It destructures
   `payload.state` directly, so a v1 save loads with `undefined` for every new
   field. Migration must be explicit before the colonist schema grows.

### B. Failure-state polish

Starvation is now a visible process, but the **game-over screen itself** is
still abrupt. It should summarise the decline — when things turned, what the
player could have done — not just print a run code.

### C. UI scale pass for Steam

Body text is 7–9px throughout. That is fine in a browser toy and not acceptable
in a paid product. Needs a typographic scale and a settings toggle. This is
mechanical but touches every component.

### D. Tutorial / onboarding

The Field Manual is five pages of text shown once, before the player has any
context. Replace with staged prompts tied to the first real occurrence of each
system (first build, first raid window, first expedition, first injury).

### E. Audio coverage

`sounds.js` has synthesized SFX and a 6-track playlist. Several newer events
(deprivation stages, EMP burst, upgrade/repair/sell) have no sound.

### F. Content breadth

More room types, more T3 tech, more dilemmas, more surface conditions. Cheapest
value-per-hour work, but only worth doing once the loops above are fun.

---

## Known Issues Still Open

- `RAID_SIZES` wave counts are now shared, but `surface_defense.jsx` still keeps
  its own `ENEMY_TYPES` and `DEFENSE_TYPES` — fine for now, they are minigame-internal.
- The memorial side panel is reachable without a Memorial Hall built.
- Colonist levels display incorrectly on the game-over screen.
- `ColonyGrid` room tooltip shows single-worker production for an unstaffed room
  (`Math.max(1, workers)`).
- The surface-defense frame is wider than the colony grid below it.
- No test framework. The pure helpers in `gameData.js` (`calcHeatDelta`,
  `calcRaidChance`, `waveBudget`, `generateWave`, `advanceExpeditions`,
  `reconcileGridWorkers`) were written to be testable — that is the place to start.
