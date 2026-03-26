# Plan: Remaining Known Issues Resolution Pass
Generated: 2026-03-02 | Status: AWAITING APPROVAL

## What We're Solving
We just finished DN-001 save/load safety and now need a structured plan for the **remaining known issues** in `memory-bank/progress.md`. The goal is to fix as many issues as safely possible in one coordinated effort, while explicitly separating high-risk raid-pipeline work (which can silently break runs) from lower-risk UI/data issues. This plan identifies what can be safely batched, what is too risky for the same pass, and where a dedicated follow-up focus pass is warranted.

## Current State Inventory

### Systems Involved
- `src/Speranza.jsx`
- `src/surface_defense.jsx`
- `src/components/ColonyGrid.jsx`
- `src/components/SidePanel.jsx`
- `src/components/GameOverModal.jsx`
- `src/gameData.js` (helper placement if pure helpers are needed)
- `memory-bank/progress.md` (status updates after implementation)
- `memory-bank/activeContext.md` (session wrap updates)
- `memory-bank/systemPatterns.md` (if raid or lifecycle patterns change)

### Relevant State
- `surfaceDefenseActive: boolean`
- `pendingRaidSize: string | null`
- `activeRaid: null | { sizeKey, ticksLeft, strikeCountdown }`
- `raidWindow: null | { sizeIdx, escalations }`
- `colonists: Colonist[]` (status transitions and removal integrity)
- `grid: Cell[][]` (`workers`, `damaged`, tooltip calculations)
- `memorial: MemorialEntry[]` (raid casualty consistency)
- `toasts: Toast[]` + dedupe refs (`toastDedupeRef`, `currentTickToastTagsRef`)
- `gameOver: object | null` (data shown by `GameOverModal`)

### What Must Not Break
- Heat → raid pipeline handoff (`raidWindow` → `activeRaid` → resolution)
- Surface defense scrap delta contract (`onScrapChange(delta)`)
- Tick loop stability (no stale closure regressions)
- Existing save lock behavior during raid-volatile states
- Colonist assignment/worker dot interactions

### Existing Code to Reuse
- `isSaveLockedByRaidState(...)` pattern in `gameData.js` (centralized boolean gate pattern)
- Existing toast dedupe mechanism in `addToast` (`opts.key`, `toastDedupeRef`)
- Existing memorial helper path (`addToMemorialRef.current(...)`)
- Existing ref-mirror pattern for tick-loop-read state
- Existing component wiring boundaries (logic in `Speranza.jsx`, UI in components)

---

## Phase 1 — Understand (Inventory + Reuse Scan)

### Scope restatement
User wants to use the planning feature to tackle the rest of known issues and explicitly judge if something is too hard and should be split into its own focus pass.

### Related known issues to target (from `progress.md`)
1. Memorial panel visible without Memorial Hall built.
2. Game over screen colonist levels incorrect.
3. Surface defense frame width mismatch vs colony grid.
4. Surface defense dev raid-size selector still visible.
5. Surface defense incomplete integration (3 confirmed):
   - Raid strike logic still runs while `surfaceDefenseActive` is true.
   - Raid toast duplicate firing.
   - `raidFled` entries added to memorial but colonist not removed.
6. Surface defense lifecycle safety:
   - `onRaidLost` can schedule multiple times.
   - orphaned timeouts (`showMessage`, delayed onRaid callbacks).
   - RAF loop keeps running while inactive.
7. Worker/status consistency edge-path desyncs (broad risk area).
8. ColonyGrid tooltip accuracy issues (zero-worker staffed rooms, fallback condition).

### Verified reuse opportunities
- **Do not invent a second raid orchestrator**; patch existing `Speranza.jsx` tick logic and `surface_defense.jsx` lifecycle guards.
- **Do not add new global state** unless absolutely needed; reuse existing refs/flags.
- Use existing component prop interfaces and update only where required.

---

## Phase 2 — Options

### Option A — Minimal (Low-risk bug batch only)
**What changes**
- `src/components/SidePanel.jsx`: gate memorial panel visibility behind `memorialHallBuilt`.
- `src/components/ColonyGrid.jsx`: correct tooltip production/consumption rendering for zero-worker staffed rooms + fallback text condition.
- `src/surface_defense.jsx`: remove dev raid-size selector UI.
- `src/surface_defense.jsx` + container styling alignment for surface frame width.
- `src/components/GameOverModal.jsx` (+ maybe data source check in `Speranza.jsx`) to fix level display.

**Reuse**: existing UI patterns only; no new architecture.

**Risk to working behavior**: low.

**Complexity**: ~2–4 hours.

**Does not solve**
- Raid pipeline integration bugs.
- Lifecycle safety and worker/status consistency issues.

---

### Option B — Moderate (Recommended)
**What changes**
- Everything in Option A.
- `src/Speranza.jsx`: apply confirmed raid integration fixes:
  - skip strike/casualty block while `surfaceDefenseActive`.
  - enforce single raid-start toast event per launch path.
  - ensure `raidFled` removes colonist from `colonists[]` consistently.
- `src/surface_defense.jsx`: lifecycle hardening:
  - single-fire guards for `onRaidWon/onRaidLost`.
  - centralized timeout tracking + cleanup on unmount/inactive.
  - stop RAF churn while inactive.

**Reuse**
- Existing refs and callback structure.
- Existing toast dedupe, no new notification system.

**Risk to working behavior**: medium/high (raid lifecycle touch = high risk area).

**Complexity**: ~6–10 hours.

**Does not solve**
- Broader worker/status consistency audit (all edge-paths).

---

### Option C — Comprehensive (Full stabilization)
**What changes**
- Everything in Option B.
- Deeper worker/status consistency refactor in `Speranza.jsx` handlers + tick loop to enforce strict source-of-truth synchronization between colonist statuses and room worker counts.
- Potential extraction of raid/lifecycle pure helpers into `gameData.js`.
- Expanded integration QA matrix and possible additional UI messaging around raid state transitions.

**Reuse**: partial reuse; introduces more abstraction.

**Risk to working behavior**: very high blast radius.

**Complexity**: ~12–20+ hours.

**Does not solve**
- N/A in this area, but highest regression risk.

---

## Phase 3 — Critical Pass

### General checks

**Over-complication check**
- Option A: minimal, no new patterns.
- Option B: adds lifecycle guards/cleanup only, still aligned with current architecture.
- Option C: likely introduces new abstractions not currently needed for immediate bug closure.

**Blast radius check**
- Option A touches mostly UI components and local minigame UI.
- Option B touches core raid pipeline + minigame lifecycle (high-risk but bounded).
- Option C touches broad cross-cutting logic in `Speranza.jsx` and has the largest chance of silent regressions.

**Assumption check**
- Assumed `raidFled` currently does not remove colonist in active branch (confirmed in current `Speranza.jsx`).
- Assumed duplicate raid toasts are from launch-path/event timing overlap (needs targeted instrumentation while implementing).
- Assumed game-over level issue may be data-shape mismatch between stored casualty level and displayed value; must verify with reproducible scenario before changing schema.

**Minimal option check**
- Option A satisfies “fix some known issues” but not the highest-impact raid correctness bugs.

**Silent breakage check**
- Raid state handoff regressions (window/active/minigame desync).
- Delayed callbacks firing after state reset/restart.
- Toast dedupe keys suppressing legitimate distinct alerts.
- Worker counts/status mismatch when flee/death/shelter flows intersect.

**Reuse check**
- Recommended option (B) maximizes reuse of existing refs, handlers, and component boundaries.

### Speranza-specific checks

**Tick loop check**
- Option B can likely avoid adding new tick-read state; if added, ref mirrors are mandatory.

**Raid lifecycle check (HIGH RISK)**
- Options B/C touch `raidWindow`, `activeRaid`, `surfaceDefenseActive`, callbacks — explicit ordered handling required.

**Restart handler check**
- If any new state refs/flags are added for lifecycle guards, `handleRestart()` must reset them.

**Component prop chain check**
- Option A may require no new props unless frame sizing is coordinated through parent layout.

**gameData.js boundary check**
- Any new pure helper for raid gating/tooltip math should go in `gameData.js`, not inline in JSX.

### Open questions
1. Should we execute Option B in one pass, or split raid lifecycle hardening into a separate focused task after Option A?
2. For the “game over level incorrect” issue, do you want strict bug fix only, or align with DN-005 richer redesign now?

---

## Recommended Option: B — Moderate with explicit split gate
Option B best matches your request to tackle the rest of known issues while still being practical. It resolves both visible UI problems and the confirmed raid integration defects without a full architecture refactor. However, because raid lifecycle is high-risk, this plan includes **phase gates**: complete low-risk fixes first, verify, then proceed to raid fixes only after the verification checkpoint passes.

## Phased Implementation

### Phase 1 — Low-risk UI/data correctness fixes
- Fix memorial panel visibility rule (requires Memorial Hall).
- Fix ColonyGrid tooltip math/conditions for zero-worker staffed rooms.
- Remove dev raid-size selector from `surface_defense.jsx`.
- Align surface defense frame width with colony grid container.
- Fix game-over level rendering path (after reproducing mismatch).

**Verify before moving to Phase 2:**
- [ ] Memorial section hidden before Memorial Hall; visible after building it.
- [ ] Room tooltips show correct per-tick values at 0 workers and >0 workers.
- [ ] Surface defense has no Small/Medium/Large debug selector.
- [ ] Surface frame visually matches colony grid width.
- [ ] Game over modal levels match expected colonist level values.

### Phase 2 — Raid integration correctness (Speranza tick/handlers)
- Prevent main raid strike/casualty strike path from running while `surfaceDefenseActive` is true.
- Ensure raid launch toast/event emits once per launch.
- Ensure `raidFled` consistently removes colonist from roster after memorial entry.

**Verify before moving to Phase 3:**
- [ ] During active surface defense, no background strike casualties occur in colony roster.
- [ ] Raid launch shows one toast/log event per launch tick.
- [ ] Fled colonists are absent from roster and present in memorial.

### Phase 3 — Surface defense lifecycle hardening
- Add single-fire guard for `onRaidWon/onRaidLost`.
- Track and clear all timeouts on unmount/inactive transitions.
- Halt RAF updates while inactive (or fully suspend loop activity).

**Verify before moving to Phase 4:**
- [ ] Reaching hatch 0 HP does not trigger duplicate parent callbacks.
- [ ] No delayed callback fires after leaving/restarting minigame.
- [ ] Inactive surface defense does not continue background animation churn.

### Phase 4 — Regression pass + memory updates
- Run build/syntax checks.
- Perform focused manual raid scenario checks (small/medium/large).
- Update memory bank docs (`activeContext`, `progress`, `systemPatterns` as needed).

**Verify before closing:**
- [ ] `npm run build` passes.
- [ ] Known issues list updated with resolved items and remaining deferred items.

## What Could Go Wrong
- Skipping strikes during `surfaceDefenseActive` could accidentally skip intended heat/morale side effects if not scoped only to casualty logic.
- Over-aggressive toast dedupe could hide legitimate distinct raid messages.
- Callback guards in minigame could suppress valid completion events if not reset correctly on new runs.
- Worker/colonist desync may still surface from unrelated handlers if we don’t widen scope into full consistency audit (intentionally deferred unless chosen).

## Decisions Needed Before Starting

1. **Execution strategy for raid-risk work:**
   - Option A: Do Phase 1 only in first implementation task; create a separate focused task for Phases 2–3.
   - Option B: Execute all phases in one implementation task with strict phase gates.

2. **Game over screen scope:**
   - Option A: Fix only the level bug now (minimal).
   - Option B: Fold in small DN-005-aligned cleanup if discovered while fixing levels.

3. **Worker/status consistency item from progress.md:**
   - Option A: Defer entirely to dedicated future pass (recommended for risk control).
   - Option B: Attempt selected edge-path fixes opportunistically in this pass.

## Decisions Made

1. 
2.
3.

## Options Considered
- **A (Minimal):** safest and fastest, but leaves high-impact raid correctness bugs unresolved.
- **B (Moderate, recommended):** balances coverage and risk; resolves both UI and confirmed raid bugs with phase gates.
- **C (Comprehensive):** addresses everything but has very high blast radius and likely needs its own dedicated sprint.

## Do Not
- Do not refactor Speranza architecture or split files beyond issue scope.
- Do not change save/load policy logic while addressing raid issues.
- Do not introduce new global state unless absolutely required; if added, ensure ref mirror + restart reset.
- Do not touch unrelated progression/content systems during this pass.
