# Step 3 — UI scale pass for Steam

Body text across the game is 7–9px. That is survivable in a browser toy and is
the single most obvious "hobby project" tell on a store page. Mechanical work,
high payoff, low risk.

## Approach

Do **not** hand-edit every `fontSize:` — there are hundreds. Introduce a scale
and route sizes through it.

1. Add a `UI_SCALE` constant and a small `fs()` helper in `gameData.js`:
   ```js
   export const UI_SCALE = 1.35;              // tune once, everything follows
   export const fs = (px) => Math.round(px * UI_SCALE * 10) / 10;
   ```
2. Sweep each component replacing `fontSize: 8` with `fontSize: fs(8)`.
   Do it per-file with a script, then eyeball each screen.
3. Grid cell height (78) and side panel width (205) will need to grow with it,
   or text will overflow. `gridMetrics` is measured at runtime, so the sprite
   layer follows automatically — verify anyway.

## Then make it a setting

Once it routes through one constant, expose it: Small / Medium / Large in the
header. Persist in `localStorage` alongside `speranza_master_volume`.

## Watch out for

- `ColonistLayer` draws canvas text at fixed px (`"bold 7px monospace"`). It is
  DPR-scaled, not UI-scaled — decide whether name tags should scale too.
- `surface_defense.jsx` renders its own canvas UI at fixed sizes.
- The layout is `maxWidth: 920` centred. At larger scales consider widening it.

## Done when

- [ ] No hardcoded `fontSize` below `fs(8)` in `src/components/`
- [ ] Every screen legible at default scale on a 1080p display
- [ ] Scale setting persists across reload
- [ ] Nothing overflows or clips at the largest setting
