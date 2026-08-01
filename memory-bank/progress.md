# Progress

## What Works ✅

### Core Game Loop
- [x] Tick system with timescale controls (pause, 0.5×, 1×, 2×, 4×, 10×)
- [x] 4×7 grid with excavation system (row unlocks via dig)
- [x] Room building (click empty cell → build menu → place room)
- [x] Worker assignment (dots on room cells, +/- buttons in side panel)
- [x] Resource production/consumption per tick per worker
- [x] Resource bars with visual fill indicators (energy, food, water, scrap, RP)
- [x] Net flow display (FlowPanel) with hover breakdown tooltips
- [x] Population cap via Barracks rooms
- [x] Colonist recruitment

### Colonist System
- [x] Named colonists with backstories and quirks
- [x] Status tracking (idle, working, injured, sheltered, onExpedition)
- [x] XP and leveling (20 XP per level)
- [x] Trait system (permanent perks on level-up)
- [x] Injury and healing (hospital, nurse workers, tick countdown)
- [x] Memorial wall (fallen colonists recorded with epitaphs)

### Threat & Raids
- [x] Heat meter (builds from rooms, expeditions, conditions)
- [x] Sentry post heat reduction
- [x] Raid window system (warning banner before raid launches)
- [x] Radio tower (identifies incoming raid size)
- [x] Barricades tech (% chance to block raids)
- [x] Surface defense minigame (tower defense, turret placement)
- [x] Scrap delta bug fixed (no more doubling)
- [x] Raid flash (red outline on container during active raid)
- [x] Colonist casualties during raids

### Expeditions
- [x] Armory room + armed armorer unlocks expeditions
- [x] Duration picker (20/40/60/80 ticks)
- [x] Multiple expedition types (scavenge, recon, etc.)
- [x] Live expedition panels with progress bars and event log
- [x] Loot accumulation (scrap, salvage, arc tech, survivor)
- [x] Surface haul display in header

### Progression
- [x] T2 technology tree (research lab + RP)
- [x] Dilemma events (branching choice modals)
- [x] Milestone system (achievements that trigger toasts)
- [x] Surface conditions (affect production, radio tower, heat)
- [x] Shelter system (alarm → all colonists safe but unproductive)
- [x] History log and game over screen with run code

### Visual Systems
- [x] Day/night sky cycle (SkyBackground — gradient, stars, sun/moon arc)
- [x] Earth texture mortise overlay (ColonyGrid SVG — rooms carved from earth)
- [x] Building sprites (pixelated interior art where defined, emoji fallback)
- [x] Colonist hover tooltips (follow mouse, zIndex 9999)
- [x] Room hover tooltips (production info, worker count)
- [x] Build menu hover tooltips (cost, requirements, sprite preview)
- [x] Raid pulse animation (CSS keyframe on raid banner)
- [x] Toast notification system (auto-pauses game, dismiss to resume)
- [x] Milestone toast (gold, fixed center screen)

### Code Quality
- [x] Phase 1 refactor: gameData.js extracted (constants + helpers)
- [x] Phase 2 refactor: 12 UI components extracted to /components/
- [x] Surface defense bug fixed (scrap delta, effect isolation)
- [x] DN-001 save/load foundations implemented (autosave ring, header controls, export/import, raid-safe load normalization)
- [x] Mid-raid save gating implemented (save/load/export/import/delete disabled during volatile raid states)

## Playtest Bug Pass — 2026-07-30 (opus-5)

Found by playing the game to Day 8 with an automated anomaly observer, plus a
follow-up player report. All fixed:

- **Starvation deaths displayed as "left"** — deprivation deaths were tagged
  `moraleDeath`, which fell through to the memorial's generic "Left the colony".
  Now `starved` / `thirst` with their own epitaph pools and labels.
- **Milestones could fire twice** — the guard read `firedMilestonesRef`, which
  only syncs via an effect. `checkMilestones` is called from the tick loop AND
  raid-end, so two calls in one tick both saw a stale ref. Ref now updates
  synchronously at the point of firing.
- **Population cap bypass** — expedition survivors and dilemma `recruitFree`
  both added colonists without checking `popCap` (only the RECRUIT button did).
  Observed 6/5. Both now check.
- **Colony Log paused the game indefinitely** — `journalOpen` / `effectsOpen`
  were in the overlay-pause set, so opening a read-only side panel froze the
  colony with no visible cause. Removed; they no longer pause.
- **Losing a raid was indistinguishable from winning** — the minigame simply
  vanished and scrap went UP. Now flashes, sounds, and posts an explicit
  breach toast naming how many ticks of strikes are incoming.
- **Raid economy was broken** — every kill reward and wave bonus was forwarded
  into colony scrap, paying ~685 (medium) / ~1289 (large) whether you won or
  lost. Raids were the most profitable activity in the game. The minigame now
  runs on a committed DEFENSE BUDGET; the colony pays up front and receives a
  bounded salvage per wave cleared. Clean win ~ -15 scrap, loss ~ -90.
- **`SCRAP: 212.99999999999994`** — raw float in the minigame header, now rounded
  and relabelled BUDGET.
- **Volume slider did not affect sound effects** — `applySfxVolume()` pinned SFX
  to a constant with the comment "music slider only controls background music",
  and the old mute button no longer exists in the UI. Setting 0% silenced music
  but left alert dings at full volume with no way to stop them. The slider now
  governs music and SFX, and 0 means silent.

## Automated Soak Test — 2026-07-31 (opus-5)

> **Correction (same day).** The harness in this run called the dev hook's
> `assign` as `assign(colonistId, {r, c})`. The real signature is
> `handleAssign(r, c, delta)` — it picks the first idle colonist itself — so
> every assignment silently failed and **that colony was never staffed at all**.
> Findings below about morale collapse and population are therefore about an
> *unstaffed* colony, not a badly-played one. The correctness findings (floats,
> stale hook, pause causes) are unaffected.


First soak run against a real production build (`npm run soak`, port 4180).
**Reached day 10 on one continuous colony, then the colony was wiped by a large
raid and the harness restarted it.** Day 25 continuous was *not* reached — see
"why" below. Roughly 8 minutes of wall clock, 6 raids played.

Caveat: the run used `sandboxTopUp` and `sandboxMorale` to stay alive, so
**nothing here is evidence about balance** — only about correctness and pacing.

### Infrastructure fixed to make this possible

- `npm run soak` = production build (honest clock) that keeps the
  `window.__speranza` hook, via `--mode soak` / `.env.soak`. Plain
  `npm run build` still strips it — verified 363.77 kB without, 365.15 kB with.
- **The hook used to hand back frozen state.** Its effect had no dependency
  array, so every render replaced `window.__speranza` with a new object whose
  getter closed over that render's variables. `const s = window.__speranza` —
  the obvious harness idiom — then read a snapshot forever. It burned a run:
  the harness saw `surfaceDefenseActive: true` for 229 polls after the raid
  ended and never restarted the clock. Identity is now stable, state reads
  through a ref.
- Added `state.pauseCause` so a harness can tell *why* the clock is stopped.
  Previously every cause looked like `timescale: 0`.

### Findings

1. **Floats confirmed on energy, food AND water** — `197.60000000000002`,
   `210.20000000000002`. Broader than the previously-recorded energy-only note.
2. **An unmanaged colony dies on day 3 of morale collapse with full stores.**
   Resources pinned at 150; morale still reached −100 and everyone died. Morale,
   not supply, is the binding early constraint.
3. **Heat only ratchets up.** Day-by-day: 0, 65, 130, 168, 197, 152, 197, 150,
   219. It dips slightly after a raid and then resumes climbing. Over 10 days it
   never returned near zero.
4. **Raids are very frequent and escalate fast** — days 3, 4, 6, 6, 8, 9, with
   `large` raids appearing on **day 3** against a 3-person colony. The day-10
   wipe was 4/4 colonists `raidKilled` in one large raid.
5. **Population never grew** past 4 against a cap of 5 across the whole run,
   while raids removed colonists steadily (4→3→3→3→2→2→0).
6. **Expeditions and tech never fired** — `exp: 0` and `techs: 0` for all 10
   days. Large parts of the game are simply not reachable on this trajectory.
7. **Three separate things hard-pause the colony** waiting on human input: the
   raid minigame, dilemmas, and trait picks. This is the autoplayability
   blocker, and it is a category rather than a single bug.
8. **Worth checking:** the harness kept clicking `⚡ EMP BURST` after its label
   read `(0)`. The button appears to remain present and clickable at zero
   charges — confirm whether it is actually disabled.

### Why day 25 was not reached

Raids kill the colony faster than it can grow, and a death restarts the run at
day 1. Getting a *continuous* 25 days needs either a harness that plays the
tower defense competently, or difficulty options (roadmap step 6) to run the
soak on an easier setting. The second is cheaper and is real product work.

## Difficulty Options — 2026-07-31 (opus-5)

Landed roadmap step 6, pulled forward ahead of 9a for this exact reason: the
first soak run above couldn't reach a continuous day 25 without an easier
setting. `DIFFICULTIES` (`gameData.js`) adds three presets — `settler` /
`survivor` / `condemned` — each scaling four levers: `heatMult`, `raidMult`,
`waveMult` (raid wave threat budget), and `graceMult` (raid cooldown length).

A **fourth lever beyond the original plan doc's sketch** was needed:
`moraleDrainMult`. The soak found morale collapse, not resource starvation,
kills an unmanaged early colony (see finding #2 above) — heat/raid softening
alone wouldn't touch that death path. It scales every *negative* morale delta
(passive crowding/adjacency drain, quirk stress, and all event-driven losses
routed through `changeMorale`: raids, dilemmas, desertion, deprivation) while
leaving positive deltas alone.

Verified with a throwaway 25-day, 10-seed simulation (raids per 5-day window):
settler totalled 7.2 raids, survivor 10.4, condemned 16.2 — a real, distinct
spread, not just noise.

**Bug found and fixed during in-browser verification, worth flagging because
it would have shipped silently:** the first implementation stored the
difficulty *key string* (`"survivor"`) in the ref the tick loop reads, then
accessed `.moraleDrainMult` / `.heatMult` / `.raidMult` / `.graceMult` on it as
if it were the resolved config object. `"survivor".moraleDrainMult` is
`undefined`, so every multiplication silently produced `NaN` — heat and morale
both went `NaN` within the first tick or two of a fresh colony, on every
difficulty, invisible in the console (no thrown error, just `NaN` propagating
through `clamp`). Caught by actually running the game in the browser and
noticing `MORALE: COLLAPSE / NaN / 100` on a day-2 colony that should have
been fine. Fixed by splitting into two refs: `difficultyRef` (raw key, used
only for the game-over report) and `diffConfigRef` (the resolved multiplier
object every lever reads). Re-verified clean afterward: heat and morale stayed
finite across a fresh run through day 2, a dilemma resolution, and into raid
territory. This is exactly the kind of silent-NaN bug the "verify numerically,
not visually" rule in `HANDOFF.md` §6 warns about — it doesn't crash, it just
quietly breaks every downstream comparison (`moraleTier`, raid-chance display,
`clamp` bounds) that reads the contaminated state.

Difficulty is chosen on the game-over screen's "NEW COLONY" flow
(`GameOverModal.jsx`) — there is no separate main-menu/start-screen in this
codebase, so that's the only "new colony" moment that exists. The very first
colony of a fresh session always starts on `survivor`. Persists in the save
(`difficulty` field, defaults to `survivor` for pre-existing saves) and shows
on both the header (small badge next to the day counter) and the game-over
screen.

## Start Screen + Pause Ownership — 2026-07-31 (opus-5)

Two jobs that turned out to be one. Difficulty was only selectable from the
game-over screen, so a first-ever colony was locked to `survivor` — you had to
die once before the game let you choose. Adding a start screen meant adding a
*sixth* independent writer of `timescale`, which `HANDOFF.md` §4c explicitly
warned against, so the pause model was fixed first.

### Pause ownership

`timescale` conflated two different things: the speed the player picked, and
whether the game is stopped. Five callers wrote it independently — the help
modal, an overlay effect that had `timescale` in its own dependency array (so it
fought every other caller), raid prep, the dilemma trigger, and save-load — and
the overlay effect restored the previous speed from a ref afterwards.

Now derived. Two stored values: `speed` (the player's choice, never 0, never
written by an overlay) and `manualPause` (their own toggle). `pauseReason` is one
ordered expression naming everything that blocks the clock; `timescale =
pauseReason ? 0 : speed`. Overlays do not write the clock — they *are* the pause,
by being open. A `setTimescale(n)` shim keeps keybindings/header/dev-hook call
sites unchanged and structurally cannot override an overlay. The dev hook's
`pauseCause` now reads the same `pauseReason` instead of recomputing the rules.

Verified in-browser: set 10x → open help → paused with cause `help`, `speed`
still 10 → close help → **back to 10x**. That last step returned 1x before, and
was the long-standing "game silently slowed down" complaint. Manual pause also
remembers the chosen speed across a pause/unpause cycle.

Census afterwards: the only writers left are the shim itself, the keybindings
(which route through it), and one deliberate `setManualPause(true)` on save-load.

### Start screen

`components/StartScreen.jsx` — colony name, difficulty picker with a
one-line description per setting (added `desc` to `DIFFICULTIES`), BEGIN.
It touches the clock not at all: `runStarted` is simply the first entry in
`pauseReason`. `handleBegin` routes through `handleRestart(difficulty)` so the
difficulty-derived refs (notably the raid grace period) are seeded correctly
rather than keeping defaults. Loading a save also sets `runStarted` — you
already have a colony at that point. The first-play help modal now waits for
BEGIN instead of stacking on top of the start screen.

### Bug found while verifying

`ToastPanel.jsx` showed **"⏸ PAUSED — notifications active"** whenever any toast
was on screen. Toasts stopped pausing the game some time ago, so that label was
telling the player the game was paused while it kept running — spotted in a
screenshot with `pauseCause: null` and the clock ticking. Replaced with an
honest notification count.

## Talent Points / Resolve (roadmap 9a) - 2026-07-31 (opus-5)

Winning a raid used to pay nothing. The raid economy fix in `32e7bcc` correctly
removed a reward that paid 685-1289 scrap win *or lose*, but nothing replaced
it, so a clean win netted about -15 scrap and the best raid was one that never
happened.

**Resolve** is a meta-currency earned only by repelling raids:
`resolveEarned({waves, hatchHp})` = 1 per wave cleared, +3 if the hatch finished
above 90%, +1 above 50%. Deliberately not scrap - more scrap just inflates the
run economy, whereas Resolve is progression.

Eight talents (`TALENTS` in `gameData.js`), each modifying a value that already
existed inside a pure helper. Nothing here adds a new system:

| talent | hooks into |
|---|---|
| Deep Silence | `calcHeatDelta` heatGainMult |
| Rationing Discipline | `deprivationStage` collapse threshold |
| Field Medicine | `HEAL_RATE_NURSE` |
| Standing Reserve | `DEFENSE_BUDGET` |
| Integrated Design | `calcAdjacency` rule strength |
| Hardened Hatch | minigame `hatchHpMax` |
| Steady Hands | `changeMorale` negative deltas |
| Deep Stores | `INIT_RES` on a new colony |

`talentEffects(unlocked)` collapses the list into one object of
multipliers/bonuses, with neutral defaults so no caller special-cases an empty
list. Multipliers compound, bonuses add.

**Restart behaviour, decided deliberately (the plan doc asked for this):**
Resolve and talents are meta-progression and **survive losing a colony**. They
live under their own `speranza_meta` localStorage key, NOT in the run save - so
importing someone else's save file cannot hand you their unlocks. `handleRestart`
does not reset them. Verified in-browser: bought two talents, starved the colony
to death, started a new one, both still owned.

### Verification

- `resolveEarned` - 7 cases including both bonus thresholds and empty input, all pass.
- `talentEffects` - neutral when empty, correct when all 8 owned, unknown keys ignored.
- Purchase guards - cannot buy twice, cannot buy unaffordable (checked in the
  handler, not just the button's disabled state).
- **The effect actually reaches the simulation**, measured rather than assumed:
  heat gain 1.35/tick without Deep Silence, 1.1025/tick with. Solving both gives
  gross 1.65 and decay 0.3, and `0.85 x 1.65 - 0.3 = 1.1025` exactly. Net heat
  falls slightly more than 15% because decay is unchanged - correct, since the
  talent scales gain.
- Economy: 61 Resolve buys the whole tree, about 7.6 perfect medium raids.

### Incidentally proved the new pause model

The talent screen is a pause reason - one line. With a dilemma stacked on top of
it, answering the dilemma left the clock stopped, and it only resumed (at the
original 10x) when the last overlay closed. That is exactly the "one overlay
resumes beneath another" failure `plans/expedition-decisions-v2.md` line 370
warned about, now structurally impossible.

## Floats fixed at source + Traders wired (step 2a) - 2026-07-31 (opus-5)

### Floats

`roundRes()` in `gameData.js`, applied once at the end of the tick's resource
updater where every drain and production has landed. Drains are fractional (0.4
food per colonist) so stores drifted to `57.599999999999994`; only the minigame's
*display* had been rounded, leaving the error in the stored values. Two decimals
is far finer than any rate, so nothing changes but the tails. Verified: stores
stay clean after minutes of play.

### Traders (roadmap step 2a)

`TRADERS` in `speranza-lore.js` was fully authored and imported by nothing, with
a dormant `tradersVisited` milestone waiting on it. Now live:

- Arrival rolled in the tick body (never in an updater): every 60 ticks, 45%
  chance, and **only with a working Radio Tower** - so that building earns a
  second purpose beyond raid identification. Visitors stay 30 ticks.
- `traderOffersFor(specialty)` and `canAffordOffer()` are pure, in `gameData.js`.
  Two offers per specialty across salvage / arcTech / medicine / schematics /
  scrap, paying from either colony resources or the surface haul.
- `TraderModal.jsx` is props-only, follows `DilemmaModal`, and does not touch
  the clock: `activeTrader` is a pause reason.
- Full state discipline: ref mirror, save payload, load (a visitor does not
  survive a reload), and restart reset.

Verified with the clock frozen so production could not confound the deltas:
scrap -70 / salvage +25, salvage -20 / arcTech +2, and the schematic offer
correctly refused at 2 Arc Tech when it costs 4. `tradersVisited` counted 3
successful trades and did not increment on the refusal.

### Four dev-hook bugs found while testing, all fixed

These would each have broken future scripted playtests:

1. **`build()` never worked.** It did `setSelected({r,c})` then fired
   `handleBuild` from a `setTimeout`, but that callback captured the render
   where `selected` was still `null`, so every scripted build silently
   no-opped. `handleBuild(type, atCell)` now takes the cell explicitly.
2. **`sandboxTopUp` ignored `MAX_RES`.** A floor above the 300 cap left every
   resource pinned at the ceiling, so a test could not tell a real gain from the
   clamp - it masked a trade result completely before being spotted.
3. **No way to reach tech-gated content.** Added `sandboxUnlockTech`, needed to
   build a Radio Tower and therefore to see a trader at all.
4. **Arrival is a 45% roll every 60 ticks**, which made trading tedious to test.
   Added `sandboxTrader(specialty)` to summon one.

Also exposed `activeTrader`, `tradersVisited` and `surfaceHaul` on the hook
snapshot - their absence made an early check report a false negative.

### Two environment notes that cost time

- **Background tabs throttle `setInterval` to ~1/minute.** The game clock ran at
  1 tick per minute until the tab was fronted, which looked exactly like a hang.
  Front the tab before timing anything.
- **Adding a method to the dev hook needs a full page reload**, not HMR, because
  the hook object is now assigned once for stable identity.

### Still unwired

`DIRECTIVES`, `ARTIFACT_TEMPLATES` / `ARTIFACT_ITEMS`, and the `COMMANDER_*`
sets remain imported-but-unused - steps 2b, 2c, 2d.

## Known Issues / Limitations ⚠️

### Save System Validation Pending
DN-001 foundations are now in place, but full runtime QA is still pending (especially raid lock-state UX, autosave defer timing, and import/load edge-case handling).

### Grid is Hardcoded
4 rows × 7 columns. Changing this would require updates in ColonyGrid, all row-based excavation logic, and possibly surface defense positioning.

### No Sound Sprites for Some Events
Some game events may not have corresponding sounds yet. The sounds.js file has the functions but some may be stubs.

### Sprite Coverage
Not all room types have custom sprites. Rooms without `def.sprite` fall back to emoji + colored background, which is less impressive visually.

### Memorial Panel Visible Without Building
The memorial side panel is accessible without the memorial building being built.

### Game Over Screen — Colonist Levels Incorrect
Colonist levels are not displaying correctly on the game over screen.

### Surface Defense — Incomplete Integration with Main Raid System
The surface defense minigame (`surface_defense.jsx`) is not fully integrated with Speranza's raid lifecycle.

~~1. Raid toast notification fires twice in the same tick when a raid launches — likely no deduplication guard on the announcement.~~
**FIXED (opus-5 branch).** The cause was not a missing dedupe guard. The raid
roll — `Math.random()`, `setRaidWindow`, `addLog`, `addToast` — lived *inside* a
`setHeat(prev => ...)` updater. `main.jsx` renders under `StrictMode`, which
double-invokes state updaters in development, so the whole roll ran twice per
tick and every announcement fired twice. The roll now happens outside the
updater. Keep side effects out of state updaters.

Do not touch this system without reading `systemPatterns.md` (Heat → Raid Pipeline section) and understanding the full `activeRaid` / `surfaceDefenseActive` / `raidWindow` state handoff first.

### Surface Defense UI — Frame Sizing
The "Surface — Arc Controlled Zone" frame is approximately 100px too wide on each side. It should match the width of the colony grid below it exactly.

### Step 5 Deferred Pending Building Upgrades
The new-defense step in `Raid Improvements/STEP_5_new_defenses.md` is intentionally deferred until the colony has a real building-upgrade system. Do not implement Flak/EMP upgrade gating with placeholder `roomLevel`/`armoryLevel` fields.

#### Surface Defense Lifecycle Safety
- RAF loop continues to run while inactive, creating background CPU churn.

#### Worker/Status Consistency (Main Loop + Handlers) — RESOLVED (opus-5 branch)
Root cause: `cell.workers` was a standalone count with no link to *which*
colonist was in the room, so every removal path picked a random staffed room.

Colonists now own `assignedRoom`, and `cell.workers` is a derived mirror kept
honest by a reconciler effect in `Speranza.jsx` (`pruneInvalidAssignments` +
`reconcileGridWorkers`, both identity-preserving so the effect converges).

**Rule: never write `cell.workers` directly.** Change the colonist's
`assignedRoom` and let the reconciler update the count.

#### UI Data Accuracy
- `ColonyGrid` room tooltip can show staffed production/consumption values when a staffed room has zero workers.
- `ColonyGrid` passive-room tooltip fallback condition appears logically unreachable in some cases, causing missing/inconsistent descriptive text.

## What's Not Started / Future Work 🔲

### Gameplay
- [ ] Surface defense expansion (more turret types, enemy variety)
- [ ] More room types (beyond current set)
- [ ] Trader system (TRADERS in speranza-lore.js exists but may not be wired)
- [ ] Directive system (DIRECTIVES in lore exists but may not be wired)
- [ ] Multiple colony types or starting conditions

### Technical

- [ ] Testing framework
- [ ] Performance profiling for very long runs

## Session Updates — 2026-03-26

### Documentation
- [x] `Raid Improvements/MASTER_PLAN.md` updated to match Speranza architecture and workflow rules
- [x] `Raid Improvements/STEP_1_bug_fixes.md` updated to use live-code verification guidance instead of stale line-number-based instructions
- [x] `Raid Improvements/STEP_2_flying_units.md` updated to keep minigame enemy logic in `surface_defense.jsx` unless pure extraction is justified
- [x] `Raid Improvements/STEP_3_sentry_bunker.md` updated to distinguish colony-side ownership (`Speranza.jsx`) from minigame ownership (`surface_defense.jsx`)
- [x] `Raid Improvements/STEP_4_wealth_scaling.md` updated so pure wealth helpers belong in `gameData.js` and raid integration stays in `Speranza.jsx`
- [x] `Raid Improvements/STEP_5_new_defenses.md` updated to avoid assuming nonexistent armory upgrade fields and to keep unlock logic conservative
- [x] Added `Raid Improvements/STEP_4B_raid_cadence_and_prep_flow.md` to capture the next raid cadence / prep-flow fix pass

### Step 1 Implementation
- [x] Deferred Step 5 until a real building-upgrade system exists
- [x] Removed the fled-colonist ghost bug in `Speranza.jsx`
- [x] Removed the visible RESTART button from `surface_defense.jsx`
- [x] Added duplicate `onRaidLost` guard in `surface_defense.jsx`
- [x] Added timeout tracking/cleanup for delayed raid-resolution and message timers in `surface_defense.jsx`
- [x] Confirmed the underground-strike suppression guard was already present in live `Speranza.jsx`
- [x] Confirmed the raid-size debug selector was already absent in live `surface_defense.jsx`

### Step 2 Implementation
- [x] Added flying enemy types (`drone`, `gunship`) to `surface_defense.jsx`
- [x] Added flying-unit wave generation rules for medium/large raids
- [x] Added drone approach / burst / retreat / loop behavior
- [x] Added gunship rocket splash attacks against defenses
- [x] Added flying-unit rendering and turret air-damage penalty

### Step 3 Implementation
- [x] Derived `sentryWorkers` in `Speranza.jsx`
- [x] Passed `sentryWorkers` and `onBunkerDestroyed` into `SurfaceDefense`
- [x] Added bunker state, auto-fire, rendering, and destruction handling in `surface_defense.jsx`
- [x] Bunker destruction now injures colony sentry workers in `Speranza.jsx`

### Step 4 Implementation
- [x] Added pure wealth helpers `calcColonyWealth()` and `getWealthBracket()` to `gameData.js`
- [x] Replaced heat-only raid size selection with wealth-bracket-based severity in `Speranza.jsx`
- [x] Added `pendingWealthBracket` state and passed it into `SurfaceDefense`
- [x] Added minigame wave-density scaling based on wealth bracket

### Notes
- Verified that `onSentry` exists in live `Speranza.jsx`, so Step 3 may reference it — but docs now instruct future work to re-check live code first rather than assuming.
- Verified that `surfaceDefenseActiveRef` and `pendingRaidSize` already exist in live `Speranza.jsx`.
- Verified that no `roomLevel`/`armoryLevel` references currently exist in `src/`, so Step 5 docs now explicitly warn against assuming those fields are already present.
- `npm run build` passed after implementing Steps 1–4.

### Visual
- [ ] Sprites for all room types
- [ ] Worker animations (CSS animation on the worker dots when active)
- [ ] More surface condition visual indicators

### Session Update — Flow Tooltip Accuracy Pass
- [x] Removed fake `"No major modifiers this tick"` fallback injection from flow breakdown state in `src/Speranza.jsx`
- [x] Flow tooltip now shows real per-tick **Supply** and **Demand** sources instead of "modifiers"
- [x] Flow tooltip empty states are now render-only and neutral (`No supply this tick` / `No demand this tick`)
- [x] `npm run build` passed after the tooltip/breakdown update
