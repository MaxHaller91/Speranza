# Speranza — Architecture & File Structure

## Project Root
```
src/
├── Speranza.jsx          ← Game brain: ALL state, ALL refs, tick loop, ALL handlers
├── gameData.js           ← ALL constants, types, pure helpers (no state, no React)
├── sounds.js             ← Audio engine (import functions, never inline audio)
├── surface_defense.jsx   ← Self-contained surface defense minigame component
├── components/           ← Pure UI components (no game logic, no direct state)
│   ├── SkyBackground.jsx
│   ├── RaidBanner.jsx
│   ├── GameOverModal.jsx
│   ├── DilemmaModal.jsx
│   ├── TraitPicker.jsx
│   ├── BuildMenu.jsx
│   ├── ToastPanel.jsx
│   ├── ColonyHeader.jsx
│   ├── FlowPanel.jsx
│   ├── ColonistRoster.jsx
│   ├── ColonyGrid.jsx
│   └── SidePanel.jsx
└── speranza-lore.js      ← Narrative content (backstories, dilemmas, expedition flavor)
```

## The Golden Rule: Logic vs UI separation

**Speranza.jsx owns:**
- All `useState` and `useRef` declarations
- The main tick loop (`useEffect` with interval)
- All handler functions (`handleBuild`, `handleAssign`, `handleRecruit`, etc.)
- All derived values (`selCell`, `armoryArmed`, `totalColonists`, etc.)
- Wiring components together via props

**Components in `/components/` own:**
- JSX rendering only
- Local hover/animation state is fine
- Must receive everything they need via props
- Must NOT import from Speranza.jsx or call setState directly
- CAN import constants from gameData.js

**gameData.js owns:**
- All constants (ROOM_TYPES, RAID_SIZES, TRAITS, T2_TECHS, etc.)
- Pure helper functions (clamp, tickToDayHour, getHeatState, etc.)
- Initial state factories (makeColonist, initGrid, initColonists)
- Must have NO React imports, NO useState, NO side effects

## Adding New Features
1. Constants/types → gameData.js
2. Game logic/state → Speranza.jsx (tick loop or new handler)
3. Visual output → existing component or new component in /components/
4. New component → props-only interface, import constants from gameData.js
5. Lore/narrative → speranza-lore.js

## What NOT to do
- Do NOT add useState to components that already receive state as props
- Do NOT import Speranza.jsx into components
- Do NOT inline game logic (tick calculations, probability rolls) in JSX
- Do NOT create new files in src/ root unless they are major independent systems
- Do NOT refactor working systems unless the task explicitly requires it
