# System Patterns

## Architecture Decision: Logic/UI Split
The codebase went through a two-phase refactor to separate concerns:

**Phase 1 (completed):** Extracted all constants and pure helpers into `gameData.js`
**Phase 2 (completed):** Extracted all UI components into `src/components/`

Result: Speranza.jsx is now ~1,827 lines of pure game brain (was 3,829 at peak). Components are props-only. This was the right call — don't undo it.

## Component Relationship Map
```
Speranza.jsx (orchestrator)
├── SkyBackground       ← tick → sky math → renders gradient/stars/sun/moon
├── ColonyHeader        ← tick, res, heat, morale, timescale, colonists → top bar
├── RaidBanner          ← activeRaid, raidWindow → threat banner
├── TraitPicker         ← colonists, onPickTrait → level-up modal
├── GameOverModal       ← gameOver, historyLog, onRestart → death screen
├── DilemmaModal        ← activeDilemma, onChoice → choice modal
├── BuildMenu           ← res, surfaceHaul, unlockedTechs, mousePos → build picker
├── [MAIN LAYOUT]
│   ├── [Grid Column]
│   │   ├── SurfaceDefense   ← scrap, raidSize, active, onRaidWon/Lost
│   │   ├── ColonyGrid       ← grid, unlockedRows, excavations, handlers
│   │   ├── FlowPanel        ← netFlow, statBreakdown, mousePos → supply/demand bars
│   │   └── ColonistRoster   ← colonists, roster state, mousePos → roster cards
│   └── SidePanel        ← journalOpen, colonist detail, room panel, expedition UI
└── ToastPanel          ← toasts, milestoneToast, dismiss callbacks
```

## Key Design Patterns

### Save/Load Safety Pattern (DN-001)
- Save/load controls are centralized in `Speranza.jsx` and exposed via props to `ColonyHeader` (UI stays props-only).
- Raid-volatile states are treated as a hard lock window for persistence actions.
- Canonical lock helper lives in `gameData.js`:
  - `isSaveLockedByRaidState({ raidWindow, activeRaid, surfaceDefenseActive, pendingRaidSize })`
- While locked:
  - manual save disabled
  - autosave load disabled
  - export/import disabled
  - delete-autosaves disabled
- Midnight autosave (`tick % 48 === 0`) uses deferral semantics:
  - if locked at midnight, set deferred flag
  - write autosave on first unlocked tick
- Load/import normalization intentionally does **not** restore in-progress raid runtime state; apply flow forces safe state (`raidWindow=null`, `activeRaid=null`, `surfaceDefenseActive=false`, `pendingRaidSize=null`) and pauses (`timescale=0`).

### Tick Loop Pattern
The tick loop is a `useEffect` with `setInterval`. It reads state via refs (not directly from state) to avoid stale closures. Every piece of state the loop reads has a parallel ref:
```js
const timescaleRef = useRef(timescale);
useEffect(() => { timescaleRef.current = timescale; }); // sync every render
```

### Toast + Pause Pattern
When an important event happens, a toast is pushed to `toasts[]` AND `timescale` is set to 0 (pause). The dismiss callbacks restore `timescaleBeforeToastRef.current`. This creates the "game pauses for notifications" behavior.

### Surface Defense Integration
`surfaceDefenseActive` (bool) triggers the `surface_defense.jsx` component. It receives `onScrapChange(delta)` — a delta, not an absolute value. The component is self-contained and manages its own game loop while active. Raid won/lost callbacks flow back up to Speranza.jsx handlers.

### Heat → Raid Pipeline
```
heat rises → exceeds threshold → raidWindow opens
→ each tick rolls RAID_LAUNCH_CHANCE
→ roll succeeds → raid launches → surfaceDefenseActive = true
→ player wins/loses surface defense → handleSurfaceRaidWon/Lost
→ raid clears, heat affected, heat suppression ticks added
```

### Worker Assignment Pattern
Worker dots are rendered inside grid cells. Clicking a dot calls `handleAssign(r, c, delta)` where delta is +1 or -1. The handler validates against caps and idle colonist count before updating. Dot clicks use `e.stopPropagation()` to avoid triggering cell selection.

## What Worked, What Didn't

### Worked Well
- Props-only components with clear interfaces are easy to maintain
- Reading from refs in tick loop eliminated the stale closure bugs
- Splitting surface defense into its own component file made it independently debuggable
- The mortise SVG overlay approach (punch holes in earth texture) gives great depth without complex CSS

### Caused Problems
- Inline `onScrapChange` that passed initial scrap instead of delta → doubling bug
- Having `initialScrap` in the effect dependency array → feedback loop on every colony scrap change
- Mixing UI state (hover keys, mouse position) with game state (res, heat) in large combined effects
