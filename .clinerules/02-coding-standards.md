# Speranza — Coding Standards & Cline Workflow

## Before Writing Any Code
1. **Read the target file first.** Use the view tool on any file you plan to edit. Never assume line numbers or content.
2. **Identify the exact insertion point.** Find the surrounding context — the line before and after where your change goes.
3. **Check for existing patterns.** If similar code already exists in the file, match its style exactly.

## Editing Strategy

### Prefer surgical edits over full rewrites
- Use `str_replace` for changes under ~80 lines
- Only rewrite a full file if restructuring its entire shape
- Never rewrite Speranza.jsx in full — it is too large and too risky
- When adding a new handler: find an existing similar handler, insert after it

### When editing Speranza.jsx specifically
- Read the section you're editing BEFORE writing changes
- Speranza.jsx sections are clearly commented (── SECTION NAME ──)
- State declarations are at the top (~lines 50-130)
- Refs are after state (~lines 130-230)
- The tick loop is the largest useEffect
- Handlers are named `handle*` and follow the tick loop
- Derived UI values are just before the JSX return
- JSX return is just thin component wiring — no logic should go here

### When editing gameData.js
- All exports must be named exports (no default export)
- Constants use SCREAMING_SNAKE_CASE
- Pure functions only — if you need React, you're in the wrong file
- Keep ROOM_TYPES entries consistent: every entry needs bg, border, color, icon, label, desc, cap, produces, consumes, cost

## React Patterns We Use

### State updates
```js
// Functional updater form for state that depends on previous value
setColonists(prev => prev.map(c => c.id === id ? { ...c, xp: c.xp + 1 } : c));
setRes(r => ({ ...r, scrap: Math.max(0, r.scrap - cost) }));
```

### Refs for things the tick loop reads
```js
// If the tick loop reads a value, put it in a ref too
// Otherwise stale closure bugs will haunt you
const timescaleRef = useRef(timescale);
useEffect(() => { timescaleRef.current = timescale; });
```

### Component props style
```jsx
// Multi-line for components with more than 3 props
<SomeComponent
  propA={valueA}
  propB={valueB}
  onCallback={handleCallback}
/>
// Single-line only if 3 or fewer simple props
<RaidBanner activeRaid={activeRaid} raidWindow={raidWindow} />
```

### Inline styles (we use inline styles throughout — don't switch to CSS classes)
```jsx
// Existing pattern — match it
style={{ background: "#080b14", border: "1px solid #1a2030", borderRadius: 8, padding: 10 }}
// Colors: always hex, always lowercase
// Spacing: numbers without units for px (React converts automatically)
```

## Sound
Always use the imported sound functions from sounds.js. Never add audio inline.
```js
// Correct
import { playBuild, playRaid } from "./sounds.js";
playBuild();

// Wrong
new Audio("build.mp3").play();
```

## Common Mistakes to Avoid
- **Stale closure in tick loop:** If the loop reads state, use a ref mirror
- **Double-firing effects:** Check dependency arrays carefully — every dep must be intentional
- **Forgetting `Math.max(0, ...)` on resource deductions:** Resources should never go below 0
- **Missing `e.stopPropagation()`:** Worker dot clicks inside grid cells need this to avoid also triggering cell selection
- **Tooltip z-index:** Fixed-position tooltips need `zIndex: 9999` and `pointerEvents: "none"`
- **Scrap doubling:** When passing `onScrapChange` to surface_defense, always pass actual deltas (not absolute values)

## Task Discipline
- Complete one thing fully before starting another
- If a task reveals unexpected complexity, stop and report before proceeding
- Do not "improve" things adjacent to the task unless asked
- After any edit to Speranza.jsx, check that imports at the top still match what's used
