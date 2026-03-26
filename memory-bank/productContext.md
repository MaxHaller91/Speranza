# Product Context

## Why Speranza Exists
Max (the developer) is building this as a passion project in the Arc Raiders universe — a game he enjoys. The goal is a colony builder with more visual personality than typical browser-based idle games. It scratches the itch of "what if Fallout Shelter had the cross-section depth of Oxygen Not Included but ran in a browser."

## Target Player Experience
- **First 60 seconds:** Player sees a visually striking underground base, understands intuitively what rooms do, starts placing their first structures
- **Minutes 5-15:** Managing the resource balance feels satisfying and tense. The heat meter creeping up creates real dread. The first raid is a genuine surprise.
- **Minutes 15-30:** Colonists have names and histories. The player feels attached. Losing one to a raid or expedition is meaningful, not just a number going down.
- **Endgame tension:** Late-game raids are brutal. Tech unlocks feel earned. Memorial wall becomes a graveyard of friends.

## What Makes It Feel Good
- The sky changing from night to dawn to day while you manage the colony below
- Sprites that look like actual rooms, not colored rectangles
- Colonist names appearing in the log ("Mira was injured in the raid")
- The surface defense minigame breaking the passive management pattern
- Run codes at game over — a shareable record of how your colony died

## What Breaks the Experience
- Resources doubling or behaving incorrectly (destroys trust immediately)
- UI elements disappearing behind overlays (tooltips, modals)
- Worker assignments not responding (dots must be clickable)
- Game freezing or stuttering (tick loop health is critical)
- Cline making "improvements" to systems the player never complained about

## Design Principles
1. **Clarity over cleverness** — if the player can't read the state at a glance, fix the UI
2. **Visual feedback for everything** — heat flashes, raid pulse, XP bars, injury countdowns
3. **No mandatory tutorials** — the UI should explain itself through design
4. **Earned complexity** — new mechanics unlock (T2 tech, expeditions) rather than all appearing at once
