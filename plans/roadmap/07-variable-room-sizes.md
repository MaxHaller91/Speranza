# Step 7 — Variable room sizes (silhouette)

Every room is currently one grid cell, so every colony is a uniform 4×7 lattice
of identical rectangles. Multi-cell rooms give the base a readable shape and make
big installations feel like installations.

**Sequenced after adjacency deliberately.** Shape on an inert grid is
decoration; shape on a grid where position matters is architecture.

## Data model

Horizontal spans only. Vertical spans conflict with the row-based excavation and
depth model — do not attempt them.

- `ROOM_TYPES[key].size = 1 | 2 | 3` (default 1 when absent, so old saves load)
- Grid cell gains: head cells keep `{ type, span }`; covered cells become
  `{ type: null, coveredBy: { r, c } }`

Suggested sizes — bigger rooms should also get proportionally more `cap`, so the
extra footprint is a tradeoff rather than a straight downgrade:

| size | rooms |
|---|---|
| 1 | Power Cell, Water Recycler, Workshop, Sentry Post, Radio Tower, Memorial |
| 2 | Hydroponics, Barracks, Hospital, Armory, Research Lab, Tavern, Dining Hall, Shelter |
| 3 | Geothermal, EMP Array |

## Touch points, in order

1. **`handleBuild`** — validate `size` consecutive empty cells inside the row,
   then write the head plus covered cells.
2. **`handleDemolish`** — clear head and all covered cells. Colonists posted to
   the head must be freed via `assignedRoom` (never `cell.workers`).
3. **`ColonyGrid` render** — skip cells with `coveredBy`; give the head
   `flex: span`.
4. **Mortise SVG** — currently carves one hole per cell, which leaves an earth
   strip through the middle of a spanned room. Iterate rooms, not cells, and
   carve one wide hole per room.
5. **`ColonistLayer`** — `slotX()` must centre on the room, not the cell:
   `depthCol + (c + span/2) * cellW`.
6. **`neighboursOf()` in `gameData.js`** — must return neighbours of *any* cell
   of the room, deduped. This is the one adjacency change required.
7. **Build menu** — show footprint, and grey out rooms that will not fit.

## Migration

Old saves have no `span`. Normalise on load: any cell with a `type` and no
`span` gets `span: 1`. Do this in `applyLoadedState()`.

## Done when

- [ ] A 2-wide room renders as one room with one carved earth hole
- [ ] Build is rejected when there is not enough contiguous space
- [ ] Demolish frees every covered cell and exactly its own workers
- [ ] Sprites stand centred in spanned rooms
- [ ] Adjacency reads neighbours from all covered cells
- [ ] A pre-existing save loads without visual corruption
