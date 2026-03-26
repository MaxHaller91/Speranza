---
name: sprite-integration
description: Add or replace a room sprite in Speranza. Use when the user has a new pixel art image to assign to a room type, or wants to update an existing room's visual appearance.
---

# Sprite Integration

Room sprites replace the emoji icon and fill the grid cell with a pixelated interior image. The system supports base64 data URIs (recommended, no external file dependency) or relative paths from the public/ folder.

## How the Sprite System Works

In `ROOM_TYPES`, each entry has a `sprite` field:
```js
workshopRoom: {
  sprite: null,  // null = use emoji icon
  // or:
  sprite: "data:image/png;base64,iVBORw0KGgo...",  // base64 = embedded
  // or:
  sprite: "/assets/rooms/workshop.png",  // path = from public/
  ...
}
```

When `def.sprite` is set, ColonyGrid renders it as:
```jsx
<img
  src={def.sprite}
  style={{
    position: "absolute", inset: 0,
    width: "100%", height: "100%",
    imageRendering: "pixelated",
    objectFit: "cover",
    objectPosition: "center",
  }}
/>
```
The label and worker dots are overlaid in a gradient bar at the bottom of the cell.

## Method A — Base64 (Recommended)

Converts the image to a string so it's embedded in the code. No file management needed.

**To convert an image to base64:**
```bash
# In the terminal (Windows PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\sprite.png"))

# Or in Node.js:
const fs = require('fs');
const b64 = fs.readFileSync('sprite.png').toString('base64');
console.log('data:image/png;base64,' + b64);
```

Then set in ROOM_TYPES:
```js
sprite: "data:image/png;base64,iVBORw0KGgo...",
```

**Limit:** Very large images (>500KB) will bloat gameData.js. For large sprites, use Method B.

## Method B — Public Folder Path

Place the image in `public/assets/rooms/yourRoom.png` and reference it:
```js
sprite: "/assets/rooms/yourRoom.png",
```

Vite serves the `public/` folder at root. The path must start with `/`.

## Build Menu Preview

The BuildMenu also renders a sprite preview in the hover tooltip:
```jsx
{def.sprite
  ? <img src={def.sprite} style={{ width: 52, height: 52, imageRendering: "pixelated", objectFit: "contain" }} />
  : <div style={{ fontSize: 18 }}>{def.icon}</div>
}
```
This is automatic — the same `sprite` field powers both the grid cell and the tooltip. No separate change needed.

## Sprite Design Guidelines

For Speranza's aesthetic to stay consistent:
- **Resolution:** 48×48px or 96×96px (scales well at integer multiples)
- **Style:** Dark underground interiors — stone/metal walls, dim lighting, industrial equipment
- **Color palette:** Muted, desaturated base with one saturated accent matching the room's `color` field
- **Format:** PNG with transparency (alpha channel) for clean cell edges
- **Subject:** Interior cross-section of the room — not icons, not overhead views
- **Arc Raiders aesthetic:** Worn sci-fi, post-collapse, brutalist underground architecture

## After Adding the Sprite

No additional code changes needed. The sprite renders automatically wherever `ROOM_TYPES[key].sprite` is checked. Verify by:
1. Building the room in-game
2. Confirming the sprite fills the cell
3. Checking the worker dots are visible over the gradient overlay
4. Confirming the build menu tooltip shows the sprite preview at 52×52

## Removing a Sprite

Set `sprite: null` to revert to emoji. The component handles null gracefully.
