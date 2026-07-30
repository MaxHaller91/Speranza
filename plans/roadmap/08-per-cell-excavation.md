# Step 8 — Per-cell excavation (player-carved silhouette)

**The big one. Do not start this mid-session.**

Excavation currently unlocks whole rows, so every colony is the same rectangle
with different boxes inside it. If the player excavated *individual cells*, the
silhouette becomes something they authored — the negative space, the earth
itself, is shaped by their decisions. That is the deepest available answer to
"make it feel like the player really built this".

## The good news

The renderer already does this. `ColonyGrid`'s mortise SVG carves a hole per
cell out of an earth texture — it just currently carves every cell of every
unlocked row:

```js
const EXCAVATED = Math.max(0, Math.min(ROWS, unlockedRows.length));
for (let row = 0; row < EXCAVATED; row++)
  for (let col = 0; col < COLS; col++) { ...carve... }
```

Change that loop to iterate a set of excavated cells and the visual works. The
expensive-looking part is built.

## Model

Replace `unlockedRows: number[]` with `excavatedCells: Set<"r-c">` (serialise as
an array). Keep `unlockedRows` derived for anything that still needs it, or
migrate call sites.

Excavation rules:
- A cell may be dug if orthogonally adjacent to an already-dug cell
- Cost scales with depth (row index), so going deep stays a real investment
- The starting cells are the row-0 seed the colony begins with

## Touch points

1. `handleStartExcavation` — takes a cell, not a row
2. Build validation — cell must be excavated
3. Mortise SVG — iterate the excavated set
4. **`ColonistLayer` pathing** — the hard part. Colonists currently assume a
   full row is walkable and route via the shaft in the depth column. With an
   arbitrary shape they need real pathfinding (BFS over excavated cells) or a
   constrained rule (e.g. the shaft column must always be dug).
   *Recommended:* require the shaft column to be excavated to open a row. That
   keeps the existing three-leg route valid and avoids writing a pathfinder.
5. `EXCAVATION_DEFS` — per-row definitions become per-depth cost curves
6. Save migration — `SAVE_VERSION` bump; convert `unlockedRows` to the cell set

## Risk

This touches excavation, build validation, rendering, sprite pathing, and save
format simultaneously. Land steps 2–7 first. Do it as a dedicated session with
a working save to test migration against.

## Done when

- [ ] Two colonies visibly differ in outline
- [ ] Colonists path correctly through an irregular base
- [ ] A pre-existing row-based save migrates without corruption
- [ ] Digging cost still makes depth a meaningful commitment
