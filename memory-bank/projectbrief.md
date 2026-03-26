# Project Brief: Speranza

## What It Is
Speranza is a 2D underground colony management game built in React JSX. Set in the Arc Raiders universe, players manage a cross-section of subterranean rooms carved into the earth, assign colonists to work them, survive surface raids from Arc forces, and send expeditions topside for resources.

## Core Vision
The primary differentiator is visual richness. Unlike typical text-based colony managers, Speranza renders rooms as detailed interior cross-sections — sprites showing actual room interiors, an earth texture that carves around excavated cells, a live day/night sky above ground. The aesthetic goal is Fallout Shelter meets Oxygen Not Included.

## Player Loop
1. Build rooms by excavating rows and placing structures
2. Assign colonists to rooms to generate resources (energy, food, water, scrap)
3. Manage heat (raid threat) by limiting exposure and building sentry posts
4. Survive Arc raids via the surface defense minigame (tower defense)
5. Send expedition teams to the surface for salvage, arc tech, schematics
6. Level up colonists, unlock T2 technologies, expand deeper underground
7. Survive long enough to hit milestones — or die and get a run code

## What It Is NOT
- Not a real-time action game (it's a management sim with a discrete tick system)
- Not multiplayer
- Not a mobile-first game (it's desktop web, though it runs on mobile)
- Not trying to replace Fallout Shelter — it's inspired by but distinct from it

## Technical Scope
Single-page React app. No backend. No routing. State lives entirely in Speranza.jsx. Currently one playable session per browser tab (no save/load). Game runs in a single browser tab via Vite dev server or static build.

## Success Criteria
- Visually impressive first impression (sprites, sky, earth texture)
- Readable game state at a glance (heat meter, morale bar, resource bars)
- Enough depth to keep a player engaged for 15-30 minute sessions
- Stable — no doubling bugs, no infinite loops, no state corruption on raids
