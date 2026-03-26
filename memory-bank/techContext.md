# Tech Context

## Stack
- **Framework:** React 18 (functional components, hooks only — no class components)
- **Build tool:** Vite
- **Language:** JSX (no TypeScript)
- **Styling:** Inline styles throughout — no CSS modules, no Tailwind, no styled-components
- **Audio:** Custom Web Audio API wrapper in sounds.js
- **No backend, no database, no routing**

## File Locations
```
Y:\Coding\PYTHON\Speranza Game\
├── src/
│   ├── Speranza.jsx          ~1,827 lines
│   ├── gameData.js           ~400 lines
│   ├── sounds.js
│   ├── surface_defense.jsx
│   ├── speranza-lore.js
│   └── components/           12 component files
├── public/
│   └── assets/               sprites and textures
├── package.json
└── vite.config.js
```

## Import Conventions
```js
// In Speranza.jsx — imports from gameData
import { ROOM_TYPES, RAID_SIZES, makeColonist, ... } from "./gameData.js";

// In Speranza.jsx — imports components
import ColonyGrid from './components/ColonyGrid.jsx';

// In components — imports from gameData (relative path goes up one level)
import { ROOM_TYPES, TRAITS } from "../gameData.js";

// In components — NO imports from Speranza.jsx (would create circular deps)
```

## Sprite System
- Room sprites are stored as base64 data URIs or paths in `ROOM_TYPES[key].sprite`
- When `def.sprite` exists: render as `<img>` filling the full cell
- When `def.sprite` is null/undefined: fall back to `def.icon` (emoji)
- Sprites are AI-generated in Arc Raiders aesthetic (dark sci-fi underground)
- Image rendering: `imageRendering: "pixelated"` for crisp scaling

## Earth Texture
- `earthTexture` is exported from gameData.js as a base64 data URI
- Used in the mortise SVG overlay in ColonyGrid
- The SVG clips the texture with "punch holes" where rooms are excavated
- This is the main visual trick that makes the colony look underground

## Audio Architecture (sounds.js)
```js
// Initialize on first user interaction (avoids autoplay policy)
startMusic()
setMusicVolume(0-100)
getMusicVolume()

// Event sounds
playBuild(), playRaid(), playRaidOver()
playInjury(), playKill(), playSuccess()
playAlert(), playExpedition()
playUiClick(), playLevelUp()
playAssign(), playUnassign()
playMilestone(), playDilemma(), playDilemmaResolve()
playDemolish(), playRepair(), playRecruit()
playShelterAlarm(), playSurfaceCondition()
playStructuralDamage(), playBarricadesHold()
playTurret(), playEMP(), playTickAlarm()
duckMusic(), unduckMusic()
```

## Development Notes
- Run with `npm run dev` in the project root
- Hot module replacement works — edits to components update without losing game state
- Edits to Speranza.jsx cause full re-mount (game state resets) — expected
- Browser console is useful for debugging; the tick loop logs aren't spammy
- No tests currently — manual testing only

## Known Technical Constraints
- No save/load system — refreshing the page loses all progress
- Context window fills up on long sessions — Cline should check memory bank files at start of tasks
- Single-threaded tick loop — heavy computation in the loop causes visible stuttering
- The grid is hardcoded 4×7 — changing this requires updates to ColonyGrid and all row-based logic
