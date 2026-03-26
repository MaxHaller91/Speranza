---
name: add-room-type
description: Add a new buildable room type to Speranza. Use when the user wants to create a new room, building, or structure that players can place in the colony grid.
---

# Add Room Type

Adding a new room type touches exactly two files: `gameData.js` and (optionally) `sounds.js`. Do not touch Speranza.jsx or any component unless there is special-case UI for this room.

## Step 1 — Add to ROOM_TYPES in gameData.js

Read the ROOM_TYPES object first to understand existing entries and find a good insertion point. Every entry must have ALL of these fields:

```js
yourRoomKey: {
  // Visual
  label:  "Human Readable Name",    // shown in UI
  icon:   "🔧",                      // emoji fallback (used if no sprite)
  sprite: null,                      // base64 data URI or null
  bg:     "#0a0c14",                 // cell background color (hex)
  color:  "#4ab3f4",                 // accent color for borders, text, dots
  border: "#1e3a5f",                 // border color (lighter than bg, darker than color)
  desc:   "Short description shown in the room info panel.",

  // Game mechanics
  cap:      2,                       // max workers (0 = passive room, no worker slots)
  cost:     { scrap: 40 },           // build cost — can include salvage, arcTech
  produces: { energy: 1 },          // per-tick output per worker (empty obj if none)
  consumes: { food: 0.5 },          // per-tick consumption per worker (empty obj if none)

  // Optional
  special:  "yourRoomKey",          // only set if the room has special-case UI in SidePanel
  techReq:  null,                   // set to a T2_TECHS key if this room requires a tech
  schematicReq: null,               // set to a schematic ID if this room requires a schematic
},
```

**Color guidelines:**
- Energy rooms: amber `#f5a623`
- Food/bio rooms: green `#7ed321`
- Water rooms: blue `#4a90e2`
- Military/combat rooms: red `#ff4444` or `#ff6b6b`
- Research/tech rooms: cyan `#00e5ff`
- Morale/social rooms: gold `#d4a843`
- Utility rooms: purple `#bd10e0` or neutral `#8899aa`

## Step 2 — Handle special-case UI (if needed)

If this room needs special UI in the side panel (like armory's expedition launcher, hospital's patient list, shelter's alarm button), add a block inside `SidePanel.jsx` in the "Room Panel" section, following the same `{selCell.type === "yourRoomKey" && (...)}` pattern.

**Only do this if the room genuinely needs it.** Most rooms don't — the generic worker assignment UI handles them automatically.

## Step 3 — Wire any new handler (if needed)

If the special UI needs a callback (like "sound alarm"), add the handler in Speranza.jsx following the naming convention `handleYourAction`. Pass it to SidePanel as `onYourAction={handleYourAction}`.

Update SidePanel's prop list and destructuring to include the new prop.

## Step 4 — Add a build sound (optional but nice)

If the room deserves a distinct build sound, check sounds.js for an appropriate existing function. Most rooms share `playBuild()` which fires automatically for all builds — no change needed unless you want something specific.

## Step 5 — Verify the entry

Check that:
- [ ] All required fields are present (label, icon, sprite, bg, color, border, desc, cap, cost, produces, consumes)
- [ ] `produces` and `consumes` are objects (even if empty `{}`)
- [ ] `cap: 0` for passive rooms (no worker slots rendered)
- [ ] The color is accessible against the dark backgrounds (#080b14, #060810)
- [ ] The room key matches any `special` field if set

## Common Mistakes
- Forgetting `produces: {}` or `consumes: {}` (even if empty — the component maps over these)
- Setting `cap: 0` but also setting `produces` with non-zero values (workers won't be assigned, production formula will always use 0)
- Using a `special` value that doesn't match the type key exactly (breaks the conditional render)
- Forgetting to import the type in components that reference ROOM_TYPES by key
