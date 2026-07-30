# Step 5 — Morale visible as behaviour

Morale is currently a number and a bar. The sprite layer (`ColonistLayer.jsx`)
already exists and already animates per-colonist state — so low morale can be
something the player *sees* rather than reads.

## Build

In `ColonistLayer.jsx`, take colony morale (or per-colonist state) as a prop and
vary behaviour:

- **High morale** — brisk walk, occasional idle flourish.
- **Low morale** — slower walk speed, slumped posture (shift the torso/head down
  a pixel), longer idle pauses.
- **Collapse** — colonists visibly stop at their posts, or drift toward the
  barracks and stand still.

The `act` field on an agent already drives pose (`work` / `idle` / `dig` /
`guard` / `bed` / `crouch`). Add posture as a modifier on top rather than new
acts, so the existing pose logic is untouched.

Use `/Speranza/sprites.html` to iterate — it renders every pose at magnification
without needing to drive the game into each state.

## Also worth it

Small ambient signals in the grid: a Tavern with workers could show a warm
flicker; a damaged room could smoke. Cheap and makes the base feel alive.

## Done when

- [ ] Morale change is noticeable from the grid alone, without reading the bar
- [ ] Posture changes visible in the sprite sheet harness
- [ ] No measurable frame cost (the loop is already 60fps with N agents)
